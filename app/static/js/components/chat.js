/**
 * ChatView Component
 * Renders conversation messages, live token streaming with blinking rose cursor,
 * collapsible reasoning chips, code copy buttons, and auto-scroll tracking.
 */

import { store } from '../store.js';
import { renderMarkdown, attachCodeCopyHandlers } from '../markdown.js';
import { applyDirectionToElement } from '../rtl.js';

export class ChatView {
  constructor(container) {
    this.container = container;
    this.scrollArea = container.closest('.chat-scroll-area') || container;
    this.scrollLatestBtn = null;
    this.userScrolledUp = false;
    this.activeStreamingElement = null;
    this.activeStreamingCursor = null;

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
      // Append inside the parent stage
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

  render() {
    const session = store.getActiveSession();
    this.container.innerHTML = '';

    if (!session || session.messages.length === 0) {
      // Empty state will be managed by EmptyState component
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
      // 1. Optional reasoning thought chip
      if (msg.reasoning) {
        const thoughtWrap = this.createThoughtBlock(msg.reasoning);
        row.appendChild(thoughtWrap);
      }

      // 2. Assistant body
      const body = document.createElement('div');
      body.className = 'assistant-body';
      body.innerHTML = renderMarkdown(msg.content);
      applyDirectionToElement(body, msg.content);

      if (msg.status === 'streaming') {
        const cursor = document.createElement('span');
        cursor.className = 'stream-cursor';
        body.appendChild(cursor);
        this.activeStreamingCursor = cursor;
        this.activeStreamingElement = body;
      }

      row.appendChild(body);

      // 3. Action bar
      if (msg.status !== 'streaming') {
        const actions = this.createMessageActions(msg);
        row.appendChild(actions);
      }
    }

    this.container.appendChild(row);
    attachCodeCopyHandlers(row);
    this.scrollToBottom();
  }

  /**
   * Creates collapsible thought block
   * @param {string} reasoning
   */
  createThoughtBlock(reasoning) {
    const wrap = document.createElement('div');
    wrap.className = 'thought-wrapper';

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'thought-chip';
    chip.innerHTML = `
      <svg class="i" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>
      <span>Reasoning</span>
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
      // Find the prompt that triggered this response
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
      const body = row.querySelector('.assistant-body');
      if (body) {
        body.innerHTML = renderMarkdown(msg.content);
        applyDirectionToElement(body, msg.content);

        if (msg.status === 'streaming') {
          const cursor = document.createElement('span');
          cursor.className = 'stream-cursor';
          body.appendChild(cursor);
        } else {
          // Streaming finished
          attachCodeCopyHandlers(row);
          if (!row.querySelector('.message-actions')) {
            const actions = this.createMessageActions(msg);
            row.appendChild(actions);
          }
        }
      }
    }
    this.scrollToBottom();
  }
}
