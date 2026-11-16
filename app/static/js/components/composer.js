/**
 * Composer Controller Component
 * Contextual Clean Capsule architecture with single '+' popover,
 * transient Think/Preset chips, auto-growing textarea, and round Send/Stop morphing.
 */

import { store } from '../store.js';
import { api } from '../api.js';
import { bindFeatureControl } from '../features.js';
import { presetsService } from '../presets.js';
import { showToast } from '../toast.js';

export { showToast };

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class ModelPicker {
  constructor(container) {
    this.container = container;
    this.pillBtn = container.querySelector('#mc') || container.querySelector('#mp');
    this.nameEl = container.querySelector('#mn');
    this.popover = container.querySelector('#mpop') || container.querySelector('#pop');
    this.listContainer = container.querySelector('#model-items-list') || this.popover;

    this.models = [];
    this.selectedModel = '';
    this.isLoading = false;
    this.isOffline = false;

    this.init();
  }

  init() {
    this.setupListeners();
    this.loadModels();

    store.on('session:active-changed', (session) => {
      if (session && session.model) {
        this.selectModel(session.model, false);
      }
    });

    store.on('models:reload', () => {
      this.loadModels();
    });
  }

  setupListeners() {
    if (this.pillBtn && this.popover) {
      const toggle = (show) => {
        const isExpanded = show !== undefined ? show : !this.popover.classList.contains('on');
        this.popover.classList.toggle('on', isExpanded);
        this.popover.hidden = !isExpanded;
        this.pillBtn.setAttribute('aria-expanded', String(isExpanded));

        if (isExpanded && this.models.length === 0) {
          this.loadModels();
        }
      };

      this.pillBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });

      document.addEventListener('click', (e) => {
        if (this.popover.classList.contains('on') && !this.popover.contains(e.target) && !this.pillBtn.contains(e.target)) {
          toggle(false);
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.popover.classList.contains('on')) {
          toggle(false);
          this.pillBtn.focus();
        }
      });
    }
  }

  async loadModels() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const res = await api.getModels();
      this.models = res && res.models ? res.models : [];
      this.isOffline = false;
      this.renderItems();

      const session = store.getActiveSession();
      if (session && session.model) {
        this.selectModel(session.model, false);
      } else if (this.models.length > 0) {
        const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('ewebui_last_model') : '') || this.models[0].name;
        const exists = this.models.find((m) => m.name === saved);
        this.selectModel(exists ? exists.name : this.models[0].name, false);
      } else {
        if (this.nameEl) this.nameEl.textContent = 'No models found';
      }
    } catch (err) {
      console.warn('Failed to load models:', err);
      this.models = [];
      this.isOffline = true;
      if (this.nameEl && (!this.selectedModel || this.nameEl.textContent === 'Loading…')) {
        this.nameEl.textContent = 'Ollama offline';
      }
      this.renderItems('Ollama is offline');
    } finally {
      this.isLoading = false;
    }
  }

  renderItems(customMessage = null) {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    if (customMessage) {
      const msgEl = document.createElement('div');
      msgEl.className = 'it it-msg';
      msgEl.textContent = customMessage;
      msgEl.style.color = 'var(--danger)';
      msgEl.style.justifyContent = 'center';
      this.listContainer.appendChild(msgEl);
      return;
    }

    if (this.models.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'it it-msg';
      empty.textContent = this.isOffline ? 'Ollama is offline' : 'No models found';
      empty.style.color = 'var(--mu)';
      empty.style.justifyContent = 'center';
      this.listContainer.appendChild(empty);
      return;
    }

    this.models.forEach((m) => {
      const btn = document.createElement('button');
      btn.className = 'it';
      btn.type = 'button';
      btn.dataset.model = m.name;

      const sizeStr = m.parameter_size || (m.size ? `${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : '');
      btn.innerHTML = `<span>${escapeHtml(m.name)}</span>${sizeStr ? `<em>${escapeHtml(sizeStr)}</em>` : ''}`;

      if (m.name === this.selectedModel) {
        btn.style.fontWeight = '600';
        btn.style.background = 'var(--tint)';
      }

      btn.addEventListener('click', () => {
        this.selectModel(m.name, true);
        if (this.popover) {
          this.popover.classList.remove('on');
          this.popover.hidden = true;
          this.pillBtn.setAttribute('aria-expanded', 'false');
          this.pillBtn.focus();
        }
      });

      this.listContainer.appendChild(btn);
    });
  }

  selectModel(modelName, persist = true) {
    this.selectedModel = modelName;
    if (this.nameEl) {
      this.nameEl.textContent = modelName;
    }
    const session = store.getActiveSession();
    if (session && persist) {
      store.updateSession(session.id, { model: modelName });
      store.defaultModel = modelName;
      try {
        localStorage.setItem('ewebui_last_model', modelName);
      } catch (_) {}
    }
  }
}

export class Composer {
  constructor(container) {
    this.container = container;
    this.textarea = container.querySelector('#ta') || container.querySelector('.composer-textarea');
    this.sendBtn = container.querySelector('#go') || container.querySelector('.btn-send');
    this.chipsContainer = container.querySelector('#chips');
    this.plusBtn = container.querySelector('#plus');
    this.plusPopover = container.querySelector('#ppop');
    this.thinkBtn = container.querySelector('#thinkbtn');
    this.micBtn = container.querySelector('#mic');
    this.dropOverlay = container.querySelector('.drop-overlay');

    this.modelPicker = new ModelPicker(container);

    this.thinkingEnabled = false; // Default OFF per owner requirement
    this.activePreset = null;
    this.isGenerating = false;
    this.activeAssistantMsgId = null;
    this.abortController = null;

    this.init();
  }

  init() {
    this.bindRegistryControls();
    this.setupAutoGrow();
    this.setupKeyboardEvents();
    this.setupPlusPopover();
    this.setupChips();
    this.setupDragAndDrop();
    this.updateSendButtonState();

    // Listen to store events
    store.on('composer:set-prompt', ({ prompt }) => {
      this.setPrompt(prompt);
    });

    store.on('composer:regenerate', ({ prompt }) => {
      this.sendPrompt(prompt);
    });

    store.on('composer:retry', ({ prompt, failedMessageId }) => {
      const session = store.getActiveSession();
      if (session && failedMessageId) {
        store.deleteMessage(session.id, failedMessageId);
      }
      this.sendPrompt(prompt, true);
    });
  }

  bindRegistryControls() {
    const popAttach = this.container.querySelector('#pop-attach');
    if (popAttach) bindFeatureControl(popAttach, 'chat.attach_file');

    const popTools = this.container.querySelector('#pop-tools');
    if (popTools) bindFeatureControl(popTools, 'chat.tools_menu');

    if (this.micBtn) bindFeatureControl(this.micBtn, 'chat.mic_input');
  }

  setupAutoGrow() {
    if (!this.textarea) return;

    const adjustHeight = () => {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = `${Math.min(this.textarea.scrollHeight, 200)}px`;
    };

    this.textarea.addEventListener('input', () => {
      adjustHeight();
      this.updateSendButtonState();
    });
  }

  setupKeyboardEvents() {
    if (!this.textarea) return;

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.isGenerating) {
          this.submit();
        }
      }
    });

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => {
        if (this.isGenerating) {
          this.stopGeneration();
        } else {
          this.submit();
        }
      });
    }
  }

  setupPlusPopover() {
    if (!this.plusBtn || !this.plusPopover) return;

    const toggle = (show) => {
      const isExpanded = show !== undefined ? show : !this.plusPopover.classList.contains('on');
      this.plusPopover.classList.toggle('on', isExpanded);
      this.plusBtn.setAttribute('aria-expanded', String(isExpanded));
    };

    this.plusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    document.addEventListener('click', (e) => {
      if (this.plusPopover.classList.contains('on') && !this.plusPopover.contains(e.target) && !this.plusBtn.contains(e.target)) {
        toggle(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.plusPopover.classList.contains('on')) {
        toggle(false);
        this.plusBtn.focus();
      }
    });

    // Think toggle
    if (this.thinkBtn) {
      this.thinkBtn.addEventListener('click', () => {
        this.thinkingEnabled = !this.thinkingEnabled;
        this.thinkBtn.setAttribute('aria-pressed', String(this.thinkingEnabled));
        store.setComposerThinking(this.thinkingEnabled);
        this.renderChips();
      });
    }

    // Presets
    const presetButtons = this.plusPopover.querySelectorAll('button[data-preset]');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetName = btn.dataset.preset;
        this.activePreset = presetName;
        store.setComposerPreset(presetName);
        toggle(false);
        this.renderChips();
      });
    });
  }

  setupChips() {
    store.on('composer:thinking-changed', (isThinking) => {
      this.thinkingEnabled = isThinking;
      if (this.thinkBtn) this.thinkBtn.setAttribute('aria-pressed', String(isThinking));
      this.renderChips();
    });

    store.on('composer:preset-changed', (preset) => {
      this.activePreset = preset;
      this.renderChips();
    });

    this.renderChips();
  }

  renderChips() {
    if (!this.chipsContainer) return;
    this.chipsContainer.innerHTML = '';

    // Think chip
    if (this.thinkingEnabled) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.id = 'chip-think';
      chip.innerHTML = `<span>Think</span><button type="button" aria-label="Disable think">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        this.thinkingEnabled = false;
        if (this.thinkBtn) this.thinkBtn.setAttribute('aria-pressed', 'false');
        store.setComposerThinking(false);
        this.renderChips();
      });
      this.chipsContainer.appendChild(chip);
    }

    // Preset chip
    if (this.activePreset) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.id = 'chip-preset';
      chip.innerHTML = `<span>${escapeHtml(this.activePreset)}</span><button type="button" aria-label="Clear preset">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        this.activePreset = null;
        store.setComposerPreset(null);
        this.renderChips();
      });
      this.chipsContainer.appendChild(chip);
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
    this.updateSendButtonState();
    this.sendPrompt(prompt);
  }

  async sendPrompt(promptText, isRetry = false) {
    if (this.isGenerating) return;

    const session = store.getActiveSession();
    if (!session) return;

    const modelToUse = session.model || store.defaultModel || (typeof localStorage !== 'undefined' ? localStorage.getItem('ewebui_last_model') : '') || '';

    if (!modelToUse) {
      showToast('No model selected. Please check that Ollama is running and has models available.');
      if (this.textarea && !this.textarea.value) {
        this.textarea.value = promptText;
        this.updateSendButtonState();
      }
      return;
    }

    let history = [];
    if (isRetry) {
      const fullHist = store.getHistory(session.id);
      history = fullHist.slice(0, -1);
    } else {
      history = store.getHistory(session.id);
      store.appendMessage(session.id, 'user', promptText);
    }

    // Prepare assistant message
    const assistantMsg = store.appendMessage(session.id, 'assistant', '', null, 'streaming');

    this.isGenerating = true;
    this.activeAssistantMsgId = assistantMsg.id;
    this.updateSendButtonState();
    this.abortController = new AbortController();

    const startTime = performance.now();
    let accumulatedContent = '';
    let accumulatedThinking = '';

    try {
      const systemPrompt = session.systemPrompt || null;
      const temperature = typeof session.temperature === 'number' ? session.temperature : 0.7;
      const topP = typeof session.topP === 'number' ? session.topP : 0.9;
      const numCtx = typeof session.numCtx === 'number' ? session.numCtx : undefined;

      await api.streamGenerate(
        {
          model: modelToUse,
          prompt: promptText,
          history,
          system: systemPrompt,
          temperature,
          top_p: topP,
          num_ctx: numCtx,
          stream: true,
          thinking: this.thinkingEnabled
        },
        {
          signal: this.abortController.signal,
          onToken: (token, liveMetrics) => {
            accumulatedContent += token;
            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent,
              status: 'streaming',
              liveMetrics
            });
          },
          onThinking: (chunk, liveMetrics) => {
            accumulatedThinking += chunk;
            store.updateMessage(session.id, assistantMsg.id, {
              reasoning: accumulatedThinking,
              status: 'streaming',
              liveMetrics
            });
          },
          onDone: (metrics) => {
            const durationSec = metrics?.durationSeconds ?? parseFloat(((performance.now() - startTime) / 1000).toFixed(1));
            const tps = metrics?.tokensPerSecond ?? null;

            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent,
              reasoning: accumulatedThinking || null,
              status: 'completed',
              liveMetrics: null,
              metrics: {
                model: modelToUse,
                durationSeconds: durationSec,
                tokensPerSecond: tps,
                timeToFirstTokenMs: metrics?.timeToFirstTokenMs ?? null,
                evalCount: metrics?.eval_count ?? null,
                evalDurationMs: metrics?.eval_duration ? Math.round(metrics.eval_duration / 1e6) : null,
                promptEvalCount: metrics?.prompt_eval_count ?? null,
                promptEvalDurationMs: metrics?.prompt_eval_duration ? Math.round(metrics.prompt_eval_duration / 1e6) : null,
                promptEvalTokensPerSecond: metrics?.prompt_eval_speed ?? null,
                loadDurationMs: metrics?.load_duration ? Math.round(metrics.load_duration / 1e6) : null
              }
            });
          },
          onError: (err) => {
            console.error('Generation error:', err);
            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent,
              reasoning: accumulatedThinking || null,
              error: err.message,
              errorStatus: err.status || 500,
              status: 'error'
            });
          }
        }
      );
    } catch (err) {
      console.error('Unhandled streaming error:', err);
      store.updateMessage(session.id, assistantMsg.id, {
        content: accumulatedContent,
        reasoning: accumulatedThinking || null,
        error: err.message || 'Stream connection failed',
        errorStatus: err.status || 500,
        status: 'error'
      });
    } finally {
      this.isGenerating = false;
      this.abortController = null;
      this.activeAssistantMsgId = null;
      this.updateSendButtonState();
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
    const session = store.getActiveSession();
    if (session && this.activeAssistantMsgId) {
      const msg = session.messages.find((m) => m.id === this.activeAssistantMsgId);
      if (msg && msg.status === 'streaming') {
        store.updateMessage(session.id, msg.id, { status: 'stopped' });
      }
    }
    this.isGenerating = false;
    this.updateSendButtonState();
  }

  updateSendButtonState() {
    if (!this.sendBtn) return;
    if (this.isGenerating) {
      this.sendBtn.disabled = false;
      this.sendBtn.classList.add('stop');
      this.sendBtn.title = 'Stop generation';
      this.sendBtn.setAttribute('aria-label', 'Stop generation');
      this.sendBtn.innerHTML = '<svg class="i"><use href="#stop"/></svg>';
      this.sendBtn.removeAttribute('aria-disabled');
    } else {
      this.sendBtn.classList.remove('stop');
      this.sendBtn.title = 'Send (Enter)';
      this.sendBtn.setAttribute('aria-label', 'Send message (Enter)');
      this.sendBtn.innerHTML = '<svg class="i"><use href="#send"/></svg>';
      const isEmpty = !this.textarea || this.textarea.value.trim() === '';
      this.sendBtn.disabled = isEmpty;
      if (isEmpty) {
        this.sendBtn.setAttribute('aria-disabled', 'true');
      } else {
        this.sendBtn.removeAttribute('aria-disabled');
      }
    }
  }
}
