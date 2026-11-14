/**
 * ChatView Component
 * Renders conversation messages, live token streaming with blinking rose cursor,
 * collapsible reasoning chips, code copy buttons, loading timers, error cards, and auto-scroll tracking.
 */

import { store } from '../store.js';
import { renderMarkdown, attachCodeCopyHandlers } from '../markdown.js';
import { applyDirectionToElement, isPredominantlyEnglish } from '../rtl.js';
import { ttsController } from '../tts.js';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function categorizeError(err) {
  const msg = (err.message || String(err)).toLowerCase();
  const status = err.status || 0;

  if (status === 401 || msg.includes('401') || msg.includes('session expired') || msg.includes('unauthorized')) {
    return {
      category: 'session_expired',
      title: 'Session Expired',
      desc: 'Your login session has expired. Please refresh and log in again.',
      status: 401
    };
  }
  if (status === 422 || msg.includes('422') || msg.includes('unprocessable') || msg.includes('value_error')) {
    return {
      category: 'invalid_model_request',
      title: 'Invalid Model Request',
      desc: 'No valid model was specified or the request parameters were rejected by the server.',
      status: 422
    };
  }
  if (status === 404 || msg.includes('model not found') || msg.includes('not found')) {
    return {
      category: 'model_not_found',
      title: 'Model Not Found',
      desc: 'The requested model is not downloaded or no longer exists in Ollama.',
      status: status || 404
    };
  }
  if (msg.includes('out of memory') || msg.includes('oom') || msg.includes('failed to load') || msg.includes('cuda error')) {
    return {
      category: 'model_load_failed',
      title: 'Model Failed to Load',
      desc: 'The model could not be loaded into memory (e.g. insufficient VRAM or RAM).',
      status: status || 500
    };
  }
  if (msg.includes('cannot connect to ollama') || msg.includes('503') || msg.includes('connecterror')) {
    return {
      category: 'ollama_unreachable',
      title: 'Ollama Unreachable',
      desc: 'Cannot reach Ollama. Check that the Ollama instance is active and running.',
      status: status || 503
    };
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return {
      category: 'request_timeout',
      title: 'Request Timed Out',
      desc: 'The request took too long to respond.',
      status: status || 408
    };
  }
  if (msg.includes('interrupted') || msg.includes('premature') || msg.includes('stream closed')) {
    return {
      category: 'stream_interrupted',
      title: 'Stream Interrupted',
      desc: 'Connection to the server was lost mid-stream.',
      status: status || 500
    };
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return {
      category: 'backend_unreachable',
      title: 'Backend Unreachable',
      desc: 'Could not connect to the e-webui backend server.',
      status: 0
    };
  }
  return {
    category: 'generation_error',
    title: 'Generation Failed',
    desc: 'An error occurred while generating the response.',
    status: status || 500
  };
}

export class ChatView {
  constructor(container) {
    this.container = container;
    this.scrollArea = container.closest('.chat-scroll-area') || container;
    this.scrollLatestBtn = null;
    this.userScrolledUp = false;
    this.loadingTimers = new Map();

    // Frame-throttling state for live streaming
    this.throttle = {
      rafId: null,
      lastRenderTime: 0,
      throttleInterval: 40, // 40ms interval clamp (~25 fps max DOM writes)
      isDirty: false,
      pendingMessage: null
    };

    this.init();
  }

  init() {
    this.setupScrollListener();
    this.createScrollLatestButton();

    // Listen to store updates
    store.on('session:active-changed', () => this.render());
    store.on('session:cleared', () => this.render());
    store.on('message:appended', ({ message }) => this.appendMessageDOM(message));
    store.on('message:updated', ({ message }) => this.updateMessageDOM(message));
    store.on('message:deleted', ({ messageId }) => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) el.remove();
    });
  }

  setupScrollListener() {
    this.scrollArea.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.scrollArea;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

      if (distanceFromBottom > 80) {
        this.userScrolledUp = true;
        if (this.scrollLatestBtn) {
          this.scrollLatestBtn.style.display = 'flex';
        }
      } else {
        this.userScrolledUp = false;
        if (this.scrollLatestBtn) {
          this.scrollLatestBtn.style.display = 'none';
        }
      }
    });
  }

  createScrollLatestButton() {
    let btn = document.getElementById('scroll-latest-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'scroll-latest-btn';
      btn.className = 'scroll-latest-btn';
      btn.type = 'button';
      btn.style.display = 'none';
      btn.innerHTML = `
        <svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        <span>Scroll to latest</span>
      `;
      btn.addEventListener('click', () => {
        this.scrollToBottom(true);
      });
      const parent = this.scrollArea.parentElement;
      if (parent) {
        parent.appendChild(btn);
      }
    }
    this.scrollLatestBtn = btn;
  }

  scrollToBottom(force = false) {
    if (!this.userScrolledUp || force) {
      this.scrollArea.scrollTop = this.scrollArea.scrollHeight;
    }
  }

  startLoadingTimer(msgId, body) {
    if (this.loadingTimers.has(msgId)) return;
    const startTime = Date.now();
    body.innerHTML = `
      <div class="model-loading-indicator">
        <span class="loading-spinner"></span>
        <span>Loading model… <span class="elapsed-time">0s</span></span>
        <span class="stream-cursor"></span>
      </div>
    `;
    const interval = setInterval(() => {
      const elapsedEl = body.querySelector('.elapsed-time');
      if (elapsedEl) {
        const secs = Math.floor((Date.now() - startTime) / 1000);
        elapsedEl.textContent = `${secs}s`;
      }
    }, 1000);
    this.loadingTimers.set(msgId, { interval, startTime });
  }

  stopLoadingTimer(msgId) {
    if (this.loadingTimers.has(msgId)) {
      clearInterval(this.loadingTimers.get(msgId).interval);
      this.loadingTimers.delete(msgId);
    }
  }

  render() {
    // Cancel any active throttled render
    if (this.throttle.rafId !== null) {
      cancelAnimationFrame(this.throttle.rafId);
      this.throttle.rafId = null;
    }
    this.throttle.isDirty = false;
    this.throttle.pendingMessage = null;

    // Clear all loading timers
    for (const [id] of this.loadingTimers) {
      this.stopLoadingTimer(id);
    }
    const session = store.getActiveSession();
    this.container.innerHTML = '';

    if (!session || session.messages.length === 0) {
      return;
    }

    for (const msg of session.messages) {
      this.appendMessageDOM(msg);
    }

    this.scrollToBottom(true);
  }

  /**
   * Appends a message DOM row
   * @param {ChatMessage} msg
   */
  appendMessageDOM(msg) {
    const row = document.createElement('div');
    row.className = `message-row message-${msg.role}`;
    row.id = `msg-${msg.id}`;

    if (msg.role === 'user') {
      const bubble = document.createElement('div');
      bubble.className = 'user-bubble';
      bubble.textContent = msg.content;
      applyDirectionToElement(bubble, msg.content);
      row.appendChild(bubble);
    } else {
      // Assistant message
      if (msg.status === 'error') {
        const errorCard = this.createErrorCard(msg);
        row.appendChild(errorCard);
      } else {
        // 1. Optional reasoning thought chip
        if (msg.reasoning) {
          const thoughtWrap = this.createThoughtBlock(msg.reasoning, msg.status === 'streaming', msg.createdAt);
          row.appendChild(thoughtWrap);
        }

        // 2. Assistant body
        const body = document.createElement('div');
        body.className = 'assistant-body';

        if (msg.status === 'streaming' && !msg.content && !msg.reasoning) {
          this.startLoadingTimer(msg.id, body);
        } else if (msg.status === 'completed' && !msg.content && msg.reasoning) {
          body.innerHTML = '<p class="reasoning-only-note"><em>The model returned only reasoning</em></p>';
        } else {
          const contentEl = document.createElement('div');
          contentEl.className = 'assistant-content';
          contentEl.innerHTML = renderMarkdown(msg.content);
          applyDirectionToElement(contentEl, msg.content);
          body.appendChild(contentEl);

          if (msg.status === 'streaming') {
            const cursor = document.createElement('span');
            cursor.className = 'stream-cursor';
            body.appendChild(cursor);
          }
        }

        row.appendChild(body);

        // 3. Action bar
        if (msg.status === 'completed' || msg.status === 'stopped') {
          const actions = this.createMessageActions(msg);
          row.appendChild(actions);
        }
      }
    }

    this.container.appendChild(row);
    attachCodeCopyHandlers(row);
    this.scrollToBottom();
  }

  /**
   * Creates collapsible thought block
   * @param {string} reasoning
   * @param {boolean} [isStreaming=false]
   * @param {number} [startTime=null]
   */
  createThoughtBlock(reasoning, isStreaming = false, startTime = null) {
    const wrap = document.createElement('div');
    wrap.className = 'thought-wrapper';

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'thought-chip';

    let labelText = 'Reasoning';
    if (isStreaming) {
      labelText = 'Thinking…';
    } else if (startTime) {
      const secs = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      labelText = `Thought for ${secs} seconds`;
    }

    chip.innerHTML = `
      <svg class="i" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>
      <span class="thought-label">${labelText}</span>
      <svg class="i chevron-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    `;

    const content = document.createElement('div');
    content.className = 'thought-content';
    const inner = document.createElement('div');
    inner.className = 'thought-inner';
    inner.textContent = reasoning;
    applyDirectionToElement(inner, reasoning);
    content.appendChild(inner);

    chip.addEventListener('click', () => {
      content.classList.toggle('open');
      const chevron = chip.querySelector('.chevron-icon');
      if (chevron) {
        chevron.style.transform = content.classList.contains('open') ? 'rotate(180deg)' : 'none';
      }
    });

    wrap.appendChild(chip);
    wrap.appendChild(content);
    return wrap;
  }

  /**
   * Updates or creates thought block in message row
   */
  updateThoughtBlock(row, reasoning, isStreaming, startTime) {
    let wrap = row.querySelector('.thought-wrapper');
    if (!wrap) {
      wrap = this.createThoughtBlock(reasoning, isStreaming, startTime);
      const body = row.querySelector('.assistant-body') || row.querySelector('.chat-error-card');
      if (body) {
        row.insertBefore(wrap, body);
      } else {
        row.appendChild(wrap);
      }
    } else {
      const content = wrap.querySelector('.thought-content');
      if (content) {
        let inner = content.querySelector('.thought-inner');
        if (!inner) {
          inner = document.createElement('div');
          inner.className = 'thought-inner';
          inner.textContent = content.textContent;
          content.textContent = '';
          content.appendChild(inner);
        }
        inner.textContent = reasoning;
        applyDirectionToElement(inner, reasoning);
      }
      const label = wrap.querySelector('.thought-label');
      if (label) {
        if (isStreaming) {
          label.textContent = 'Thinking…';
        } else {
          const secs = startTime ? Math.max(1, Math.round((Date.now() - startTime) / 1000)) : 1;
          label.textContent = `Thought for ${secs} seconds`;
        }
      }
    }
  }

  /**
   * Creates structured in-chat error card with Retry button
   * @param {ChatMessage} msg
   */
  createErrorCard(msg) {
    const errorInfo = categorizeError({ message: msg.error || msg.content, status: msg.errorStatus });
    const card = document.createElement('div');
    card.className = 'chat-error-card';
    card.innerHTML = `
      <div class="error-header">
        <svg class="i error-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="error-summary">
          <span class="error-title">${escapeHtml(errorInfo.title)}</span>
          <span class="error-desc">${escapeHtml(errorInfo.desc)}</span>
        </div>
        <button type="button" class="btn-retry" aria-label="Retry generation">
          <svg class="i" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5"/></svg>
          <span>Retry</span>
        </button>
      </div>
      <details class="error-details">
        <summary>Details</summary>
        <pre class="error-details-content"><code>Status: ${errorInfo.status || 'N/A'}
Class: ${errorInfo.category}
Message: ${escapeHtml(msg.error || msg.content || 'Unknown error')}</code></pre>
      </details>
    `;

    const retryBtn = card.querySelector('.btn-retry');
    retryBtn.addEventListener('click', () => {
      const session = store.getActiveSession();
      if (!session) return;
      const idx = session.messages.findIndex((m) => m.id === msg.id);
      if (idx > 0 && session.messages[idx - 1].role === 'user') {
        const promptText = session.messages[idx - 1].content;
        store.emit('composer:retry', { prompt: promptText, failedMessageId: msg.id });
      }
    });

    return card;
  }

  /**
   * Creates action bar below completed assistant reply
   * @param {ChatMessage} msg
   */
  createMessageActions(msg) {
    const bar = document.createElement('div');
    bar.className = 'message-actions';

    // Copy action
    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn-icon';
    btnCopy.title = 'Copy response';
    btnCopy.innerHTML = '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(msg.content);
        btnCopy.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
        setTimeout(() => {
          btnCopy.innerHTML = '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
        }, 1800);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
    bar.appendChild(btnCopy);

    // TTS Read Aloud action (English replies only)
    if (isPredominantlyEnglish(msg.content)) {
      const btnTTS = document.createElement('button');
      btnTTS.className = 'btn-icon btn-tts';
      btnTTS.title = 'Read aloud';
      btnTTS.setAttribute('aria-label', 'Read reply aloud');
      btnTTS.setAttribute('role', 'button');
      btnTTS.setAttribute('aria-pressed', 'false');

      const renderTtsIcon = (state, errorHint = null) => {
        btnTTS.classList.remove('loading', 'playing', 'error-hint');
        if (state === 'loading') {
          btnTTS.classList.add('loading');
          btnTTS.title = 'Generating speech…';
          btnTTS.setAttribute('aria-pressed', 'true');
          btnTTS.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><circle cx="17" cy="12" r="2"/></svg>';
        } else if (state === 'playing') {
          btnTTS.classList.add('playing');
          btnTTS.title = 'Stop reading aloud';
          btnTTS.setAttribute('aria-pressed', 'true');
          btnTTS.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
        } else {
          // Idle state
          btnTTS.setAttribute('aria-pressed', 'false');
          if (errorHint) {
            btnTTS.classList.add('error-hint');
            btnTTS.title = errorHint;
            setTimeout(() => {
              btnTTS.classList.remove('error-hint');
              btnTTS.title = 'Read aloud';
            }, 3000);
          } else {
            btnTTS.title = 'Read aloud';
          }
          btnTTS.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
        }
      };

      // Set initial state
      renderTtsIcon(ttsController.getState(msg.id));

      // Subscribe to controller state changes
      ttsController.subscribe((targetId, state, error) => {
        if (targetId === msg.id) {
          renderTtsIcon(state, error);
        } else if (state === 'playing') {
          renderTtsIcon('idle');
        }
      });

      btnTTS.addEventListener('click', async () => {
        await ttsController.play(msg.id, msg.content);
      });

      bar.appendChild(btnTTS);
    }

    // Like action
    const btnLike = document.createElement('button');
    btnLike.className = 'btn-icon';
    btnLike.title = 'Good response';
    btnLike.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 17.4 20H7"/></svg>';
    btnLike.addEventListener('click', () => {
      btnLike.classList.toggle('active');
    });
    bar.appendChild(btnLike);

    // Dislike action
    const btnDislike = document.createElement('button');
    btnDislike.className = 'btn-icon';
    btnDislike.title = 'Bad response';
    btnDislike.innerHTML = '<svg class="i" viewBox="0 0 24 24" style="transform:rotate(180deg)"><path d="M7 11v9H4v-9zM7 11l4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 17.4 20H7"/></svg>';
    btnDislike.addEventListener('click', () => {
      btnDislike.classList.toggle('active');
    });
    bar.appendChild(btnDislike);

    // Regenerate action
    const btnRegen = document.createElement('button');
    btnRegen.className = 'btn-icon';
    btnRegen.title = 'Regenerate response';
    btnRegen.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5"/></svg>';
    btnRegen.addEventListener('click', () => {
      const session = store.getActiveSession();
      if (!session) return;
      const idx = session.messages.findIndex((m) => m.id === msg.id);
      if (idx > 0 && session.messages[idx - 1].role === 'user') {
        const promptText = session.messages[idx - 1].content;
        store.emit('composer:regenerate', { prompt: promptText });
      }
    });
    bar.appendChild(btnRegen);

    // Metadata label & Turn Diagnostics trigger
    if (msg.metrics) {
      const parts = [];
      if (msg.metrics.model) parts.push(msg.metrics.model);
      if (msg.metrics.tokensPerSecond) parts.push(`${msg.metrics.tokensPerSecond} tok/s`);
      if (msg.metrics.timeToFirstTokenMs) {
        const ttftText = msg.metrics.timeToFirstTokenMs >= 1000
          ? `${(msg.metrics.timeToFirstTokenMs / 1000).toFixed(1)}s`
          : `${msg.metrics.timeToFirstTokenMs}ms`;
        parts.push(`TTFT ${ttftText}`);
      }
      if (msg.metrics.durationSeconds) parts.push(`${msg.metrics.durationSeconds}s`);

      const metaBtn = document.createElement('button');
      metaBtn.type = 'button';
      metaBtn.className = 'btn-meta-pill';
      metaBtn.title = 'View inference performance diagnostics';
      metaBtn.setAttribute('aria-label', 'View inference performance diagnostics');
      metaBtn.setAttribute('dir', 'ltr');
      metaBtn.textContent = parts.join(' · ');

      metaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTurnDiagnosticsPopover(metaBtn, msg);
      });

      bar.appendChild(metaBtn);
    }

    return bar;
  }

  /**
   * Toggles turn diagnostics breakdown popover modal
   * @param {HTMLElement} anchorEl
   * @param {ChatMessage} msg
   */
  toggleTurnDiagnosticsPopover(anchorEl, msg) {
    const existing = document.querySelector('.turn-diagnostics-popover');
    if (existing) {
      const isSame = existing._anchorEl === anchorEl;
      existing.remove();
      if (isSame) return;
    }

    if (!msg.metrics) return;

    const formatMs = (ms) => {
      if (ms === null || ms === undefined) return '—';
      return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
    };

    const popover = document.createElement('div');
    popover.className = 'turn-diagnostics-popover';
    popover.setAttribute('dir', 'ltr');
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Turn Performance Diagnostics');
    popover._anchorEl = anchorEl;

    popover.innerHTML = `
      <div class="popover-header">
        <h4>Turn Diagnostics</h4>
        <button type="button" class="btn-close-popover" aria-label="Close popover">
          <svg class="i" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="diag-table">
        <div class="diag-row">
          <span class="diag-label">Model</span>
          <span class="diag-val font-mono">${escapeHtml(msg.metrics.model || 'Unknown')}</span>
        </div>
        <div class="diag-row">
          <span class="diag-label">Time to First Token</span>
          <span class="diag-val font-mono">${formatMs(msg.metrics.timeToFirstTokenMs)}</span>
        </div>
        <div class="diag-row">
          <span class="diag-label">Response Generation</span>
          <span class="diag-val font-mono">${msg.metrics.evalCount ?? '—'} tok · ${msg.metrics.tokensPerSecond ? msg.metrics.tokensPerSecond + ' tok/s' : '—'}</span>
        </div>
        <div class="diag-row">
          <span class="diag-label">Prompt Evaluation</span>
          <span class="diag-val font-mono">${msg.metrics.promptEvalCount ?? '—'} tok · ${msg.metrics.promptEvalTokensPerSecond ? msg.metrics.promptEvalTokensPerSecond + ' tok/s' : '—'}</span>
        </div>
        <div class="diag-row">
          <span class="diag-label">Model Load Duration</span>
          <span class="diag-val font-mono">${formatMs(msg.metrics.loadDurationMs)}</span>
        </div>
        <div class="diag-row total-row">
          <span class="diag-label">Total Duration</span>
          <span class="diag-val font-mono">${msg.metrics.durationSeconds ? msg.metrics.durationSeconds + 's' : '—'}</span>
        </div>
      </div>
    `;

    // Position container
    anchorEl.parentElement.style.position = 'relative';
    anchorEl.parentElement.appendChild(popover);

    const closeBtn = popover.querySelector('.btn-close-popover');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
    });

    const dismissHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== anchorEl) {
        popover.remove();
        document.removeEventListener('click', dismissHandler);
        document.removeEventListener('keydown', keyHandler);
      }
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        popover.remove();
        document.removeEventListener('click', dismissHandler);
        document.removeEventListener('keydown', keyHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', dismissHandler);
      document.addEventListener('keydown', keyHandler);
    }, 0);
  }

  /**
   * Schedules a frame-throttled render pass (max ~25 updates/sec, min 40ms interval)
   * @param {ChatMessage} msg
   */
  scheduleThrottledRender(msg) {
    this.throttle.pendingMessage = msg;
    this.throttle.isDirty = true;

    if (this.throttle.rafId !== null) {
      return;
    }

    const loop = (timestamp) => {
      const elapsed = timestamp - this.throttle.lastRenderTime;
      if (elapsed >= this.throttle.throttleInterval) {
        this.throttle.lastRenderTime = timestamp;
        this.throttle.rafId = null;

        if (this.throttle.isDirty && this.throttle.pendingMessage) {
          this.throttle.isDirty = false;
          this.renderStreamingMessageDOM(this.throttle.pendingMessage);
        }
      } else {
        this.throttle.rafId = requestAnimationFrame(loop);
      }
    };

    this.throttle.rafId = requestAnimationFrame(loop);
  }

  /**
   * Performs an animation-frame update of in-flight streaming content
   * @param {ChatMessage} msg
   */
  renderStreamingMessageDOM(msg) {
    const row = document.getElementById(`msg-${msg.id}`);
    if (!row) return;

    // 1. Update reasoning thought block if present
    if (msg.reasoning) {
      this.updateThoughtBlock(row, msg.reasoning, true, msg.createdAt);
    }

    // 2. Assistant body
    let body = row.querySelector('.assistant-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'assistant-body';
      row.appendChild(body);
    }

    if (!msg.content && !msg.reasoning) {
      this.startLoadingTimer(msg.id, body);
      return;
    }

    this.stopLoadingTimer(msg.id);

    // Persistent content container
    let contentEl = body.querySelector('.assistant-content');
    if (!contentEl) {
      body.innerHTML = '';
      contentEl = document.createElement('div');
      contentEl.className = 'assistant-content';
      body.appendChild(contentEl);
    }

    contentEl.innerHTML = renderMarkdown(msg.content);
    applyDirectionToElement(contentEl, msg.content);

    // Persistent cursor - preserved across frames to eliminate blink resets
    let cursor = body.querySelector('.stream-cursor');
    if (!cursor) {
      cursor = document.createElement('span');
      cursor.className = 'stream-cursor';
      body.appendChild(cursor);
    } else if (body.lastElementChild !== cursor) {
      body.appendChild(cursor);
    }

    // In-flight streaming metrics badge
    if (msg.liveMetrics && (msg.liveMetrics.speed || msg.liveMetrics.ttftMs)) {
      let metricsBadge = body.querySelector('.streaming-metrics-badge');
      if (!metricsBadge) {
        metricsBadge = document.createElement('div');
        metricsBadge.className = 'streaming-metrics-badge';
        metricsBadge.setAttribute('dir', 'ltr');
        body.appendChild(metricsBadge);
      }
      const parts = [];
      if (msg.liveMetrics.speed) {
        parts.push(`<span class="live-item live-speed"><span class="icon-bolt">⚡</span> ${msg.liveMetrics.speed} tok/s</span>`);
      }
      if (msg.liveMetrics.ttftMs) {
        const ttftStr = msg.liveMetrics.ttftMs >= 1000
          ? `${(msg.liveMetrics.ttftMs / 1000).toFixed(1)}s`
          : `${msg.liveMetrics.ttftMs}ms`;
        parts.push(`<span class="live-item live-ttft">TTFT ${ttftStr}</span>`);
      }
      metricsBadge.innerHTML = parts.join('<span class="live-sep">·</span>');
    }

    // Auto-scroll sticky bottom only if user hasn't scrolled up
    if (!this.userScrolledUp) {
      this.scrollToBottom();
    }
  }

  /**
   * Performs an immediate synchronous final render pass upon stream completion or error
   * @param {ChatMessage} msg
   */
  renderFinalMessageDOM(msg) {
    const row = document.getElementById(`msg-${msg.id}`);
    if (!row) return;

    this.stopLoadingTimer(msg.id);

    if (msg.status === 'error') {
      row.innerHTML = '';
      if (msg.reasoning) {
        const thoughtWrap = this.createThoughtBlock(msg.reasoning, false, msg.createdAt);
        row.appendChild(thoughtWrap);
      }
      const errorCard = this.createErrorCard(msg);
      row.appendChild(errorCard);
      this.scrollToBottom();
      return;
    }

    // Update reasoning block to completed state (showing total seconds)
    if (msg.reasoning) {
      this.updateThoughtBlock(row, msg.reasoning, false, msg.createdAt);
    }

    let body = row.querySelector('.assistant-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'assistant-body';
      row.appendChild(body);
    }

    // Remove any leftover cursor or live streaming badge
    const cursor = body.querySelector('.stream-cursor');
    if (cursor) {
      cursor.remove();
    }
    const badge = body.querySelector('.streaming-metrics-badge');
    if (badge) {
      badge.remove();
    }

    if (!msg.content && msg.reasoning) {
      body.innerHTML = '<p class="reasoning-only-note"><em>The model returned only reasoning</em></p>';
    } else {
      let contentEl = body.querySelector('.assistant-content');
      if (!contentEl) {
        contentEl = document.createElement('div');
        contentEl.className = 'assistant-content';
        body.appendChild(contentEl);
      }
      contentEl.innerHTML = renderMarkdown(msg.content);
      applyDirectionToElement(contentEl, msg.content);
    }

    attachCodeCopyHandlers(row);

    const existingActions = row.querySelector('.message-actions');
    if (existingActions) {
      existingActions.remove();
    }
    const actions = this.createMessageActions(msg);
    row.appendChild(actions);

    if (!this.userScrolledUp) {
      this.scrollToBottom();
    }
  }

  /**
   * Dispatches updates to an existing message (throttled streaming or immediate final pass)
   * @param {ChatMessage} msg
   */
  updateMessageDOM(msg) {
    if (msg.role !== 'assistant') {
      const row = document.getElementById(`msg-${msg.id}`);
      if (!row) return;
      const bubble = row.querySelector('.user-bubble');
      if (bubble) {
        bubble.textContent = msg.content;
        applyDirectionToElement(bubble, msg.content);
      }
      return;
    }

    if (msg.status === 'streaming') {
      this.scheduleThrottledRender(msg);
    } else {
      // Completed, stopped, or error: cancel any pending RAF and flush immediately
      if (this.throttle.rafId !== null) {
        cancelAnimationFrame(this.throttle.rafId);
        this.throttle.rafId = null;
      }
      this.throttle.isDirty = false;
      this.throttle.pendingMessage = null;

      this.renderFinalMessageDOM(msg);
    }
  }
}
