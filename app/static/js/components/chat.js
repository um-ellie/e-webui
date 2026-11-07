/**
 * ChatView Component
 * Renders conversation messages, live token streaming with blinking rose cursor,
 * collapsible reasoning chips, code copy buttons, loading timers, error cards, and auto-scroll tracking.
 */

import { store } from '../store.js';
import { renderMarkdown, attachCodeCopyHandlers } from '../markdown.js';
import { applyDirectionToElement } from '../rtl.js';

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

    this.init();
  }

  init() {
    this.setupScrollListener();
    this.createScrollLatestButton();

    // Listen to store updates
    store.on('session:active-changed', () => this.render());
    store.on('message:appended', ({ message }) => this.appendMessageDOM(message));
    store.on('message:updated', ({ message }) => this.updateMessageDOM(message));
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
          body.innerHTML = renderMarkdown(msg.content);
          applyDirectionToElement(body, msg.content);

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
    content.textContent = reasoning;
    applyDirectionToElement(content, reasoning);

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
        content.textContent = reasoning;
        applyDirectionToElement(content, reasoning);
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

    // Metadata label (model, speed)
    if (msg.metrics) {
      const meta = document.createElement('span');
      meta.className = 'message-meta-info';
      const parts = [];
      if (msg.metrics.model) parts.push(msg.metrics.model);
      if (msg.metrics.tokensPerSecond) parts.push(`${msg.metrics.tokensPerSecond} tok/s`);
      meta.textContent = parts.join(' · ');
      bar.appendChild(meta);
    }

    return bar;
  }

  /**
   * Updates an in-flight streaming message
   * @param {ChatMessage} msg
   */
  updateMessageDOM(msg) {
    const row = document.getElementById(`msg-${msg.id}`);
    if (!row) return;

    if (msg.role === 'assistant') {
      if (msg.status === 'error') {
        this.stopLoadingTimer(msg.id);
        // Replace existing contents with error card
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

      // Handle reasoning block
      if (msg.reasoning) {
        this.updateThoughtBlock(row, msg.reasoning, msg.status === 'streaming', msg.createdAt);
      }

      let body = row.querySelector('.assistant-body');
      if (!body) {
        body = document.createElement('div');
        body.className = 'assistant-body';
        row.appendChild(body);
      }

      if (msg.status === 'streaming') {
        if (!msg.content && !msg.reasoning) {
          this.startLoadingTimer(msg.id, body);
        } else {
          this.stopLoadingTimer(msg.id);
          body.innerHTML = renderMarkdown(msg.content);
          applyDirectionToElement(body, msg.content);
          const cursor = document.createElement('span');
          cursor.className = 'stream-cursor';
          body.appendChild(cursor);
        }
      } else {
        // Stream finished (completed or stopped)
        this.stopLoadingTimer(msg.id);

        if (!msg.content && msg.reasoning) {
          body.innerHTML = '<p class="reasoning-only-note"><em>The model returned only reasoning</em></p>';
        } else {
          body.innerHTML = renderMarkdown(msg.content);
          applyDirectionToElement(body, msg.content);
        }

        attachCodeCopyHandlers(row);
        if (!row.querySelector('.message-actions')) {
          const actions = this.createMessageActions(msg);
          row.appendChild(actions);
        }
      }
    }
    this.scrollToBottom();
  }
}
