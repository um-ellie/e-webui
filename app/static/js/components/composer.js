/**
 * Composer Controller Component
 * Manages multi-line auto-growing textarea, keyboard submissions (Enter/Shift+Enter),
 * toolbars, Think mode toggle, model dispatch, live streaming lifecycle, and drop overlay.
 */

import { store } from '../store.js';
import { api } from '../api.js';
import { bindFeatureControl } from '../features.js';

export class Composer {
  constructor(container) {
    this.container = container;
    this.textarea = container.querySelector('.composer-textarea');
    this.sendBtn = container.querySelector('.btn-send');
    this.thinkBtn = container.querySelector('.pill-think');
    this.attachBtn = container.querySelector('.btn-attach');
    this.toolsBtn = container.querySelector('.pill-tools');
    this.modelPill = container.querySelector('.composer-model-pill');
    this.dropOverlay = container.querySelector('.drop-overlay');

    this.thinkingEnabled = true;
    this.isGenerating = false;
    this.abortController = null;

    this.init();
  }

  init() {
    this.bindRegistryControls();
    this.setupAutoGrow();
    this.setupKeyboardEvents();
    this.setupActions();
    this.setupDragAndDrop();

    // Listen to external events
    store.on('composer:set-prompt', ({ prompt }) => {
      this.setPrompt(prompt);
    });

    store.on('composer:regenerate', ({ prompt }) => {
      this.sendPrompt(prompt);
    });

    store.on('session:active-changed', (session) => {
      if (this.modelPill) {
        this.modelPill.textContent = session.model || store.defaultModel || 'Default Model';
      }
    });
  }

  bindRegistryControls() {
    if (this.attachBtn) {
      bindFeatureControl(this.attachBtn, 'chat.attach_file');
    }
    if (this.toolsBtn) {
      bindFeatureControl(this.toolsBtn, 'chat.tools_menu');
    }
  }

  setupAutoGrow() {
    if (!this.textarea) return;

    const adjustHeight = () => {
      this.textarea.style.height = 'auto';
      const scrollHeight = this.textarea.scrollHeight;
      const maxHeight = 200; // ~8 lines
      this.textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      this.textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    this.textarea.addEventListener('input', adjustHeight);
  }

  setupKeyboardEvents() {
    if (!this.textarea) return;

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.isGenerating) {
          this.submit();
        }
      } else if (e.key === 'Escape' && this.isGenerating) {
        e.preventDefault();
        this.stopGeneration();
      }
    });
  }

  setupActions() {
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => {
        if (this.isGenerating) {
          this.stopGeneration();
        } else {
          this.submit();
        }
      });
    }

    if (this.thinkBtn) {
      this.thinkBtn.addEventListener('click', () => {
        this.thinkingEnabled = !this.thinkingEnabled;
        this.thinkBtn.classList.toggle('on', this.thinkingEnabled);
        this.thinkBtn.setAttribute('aria-pressed', String(this.thinkingEnabled));
      });
    }
  }

  setupDragAndDrop() {
    if (!this.dropOverlay) return;

    const dragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropOverlay.style.display = 'flex';
    };

    const dragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.container.contains(e.relatedTarget)) {
        this.dropOverlay.style.display = 'none';
      }
    };

    const drop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropOverlay.style.display = 'none';
    };

    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('dragenter', dragEnter);
    this.container.addEventListener('dragleave', dragLeave);
    this.container.addEventListener('drop', drop);
  }

  setPrompt(text) {
    if (!this.textarea) return;
    this.textarea.value = text;
    this.textarea.dispatchEvent(new Event('input'));
    this.textarea.focus();
  }

  submit() {
    if (!this.textarea) return;
    const prompt = this.textarea.value.trim();
    if (!prompt) return;

    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    this.sendPrompt(prompt);
  }

  async sendPrompt(promptText) {
    if (this.isGenerating) return;

    const session = store.getActiveSession();
    if (!session) return;

    // Append user message
    store.appendMessage(session.id, 'user', promptText);

    // Prepare assistant message
    const assistantMsg = store.appendMessage(session.id, 'assistant', '', null, 'streaming');

    this.isGenerating = true;
    this.setSendButtonState(true);
    this.abortController = new AbortController();

    const startTime = performance.now();
    let accumulatedContent = '';
    let accumulatedThinking = '';

    try {
      await api.streamGenerate(
        {
          model: session.model || store.defaultModel,
          prompt: promptText,
          stream: true,
          thinking: this.thinkingEnabled
        },
        {
          signal: this.abortController.signal,
          onToken: (token) => {
            accumulatedContent += token;
            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent,
              status: 'streaming'
            });
          },
          onThinking: (chunk) => {
            accumulatedThinking += chunk;
            store.updateMessage(session.id, assistantMsg.id, {
              reasoning: accumulatedThinking,
              status: 'streaming'
            });
          },
          onDone: (metrics) => {
            const durationSec = ((performance.now() - startTime) / 1000).toFixed(1);
            let tps = null;
            if (metrics && metrics.eval_count && metrics.total_duration) {
              const durSec = metrics.total_duration / 1e9;
              tps = durSec > 0 ? (metrics.eval_count / durSec).toFixed(1) : null;
            }

            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent,
              reasoning: accumulatedThinking || null,
              status: 'completed',
              metrics: {
                model: session.model || store.defaultModel,
                durationSeconds: parseFloat(durationSec),
                tokensPerSecond: tps ? parseFloat(tps) : null
              }
            });
          },
          onError: (err) => {
            console.error('Generation error:', err);
            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent ? `${accumulatedContent}\n\n*[Generation error: ${err.message}]*` : `Error: ${err.message}`,
              status: 'error'
            });
          }
        }
      );
    } catch (err) {
      console.error('Unhandled streaming error:', err);
    } finally {
      this.isGenerating = false;
      this.abortController = null;
      this.setSendButtonState(false);
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isGenerating = false;
    this.setSendButtonState(false);
  }

  setSendButtonState(generating) {
    if (!this.sendBtn) return;
    if (generating) {
      this.sendBtn.classList.add('btn-stop');
      this.sendBtn.title = 'Stop generation';
      this.sendBtn.setAttribute('aria-label', 'Stop generation');
      this.sendBtn.innerHTML = '<svg class="i" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
    } else {
      this.sendBtn.classList.remove('btn-stop');
      this.sendBtn.title = 'Send message';
      this.sendBtn.setAttribute('aria-label', 'Send message');
      this.sendBtn.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    }
  }
}
