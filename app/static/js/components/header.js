/**
 * Header Component
 * Manages active chat title editing, Share button, and overflow actions.
 */

import { store } from '../store.js';
import { bindFeatureControl } from '../features.js';
import { exportSession } from '../export.js';
import { api } from '../api.js';

export class Header {
  constructor(container) {
    this.container = container;
    this.titleElement = container.querySelector('.header-chat-title');
    this.btnShare = container.querySelector('.btn-share');
    this.btnOverflow = container.querySelector('.btn-header-overflow');
    this.mobileToggle = container.querySelector('.mobile-menu-toggle');
    this.healthContainer = container.querySelector('.health-indicator-container');
    this.healthBtn = container.querySelector('.health-indicator-btn');

    this.init();
  }

  init() {
    this.bindRegistryControls();
    this.setupTitleEditing();
    this.setupMobileToggle();
    this.setupOverflowMenu();
    this.setupHealthIndicator();

    // Listen to store updates
    store.on('session:active-changed', (session) => this.update(session));
    store.on('session:updated', (session) => {
      const active = store.getActiveSession();
      if (active && active.id === session.id) {
        this.update(session);
      }
    });
  }

  bindRegistryControls() {
    if (this.btnShare) {
      bindFeatureControl(this.btnShare, 'chat.share');
    }
  }

  setupMobileToggle() {
    if (this.mobileToggle) {
      this.mobileToggle.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
          sidebar.classList.toggle('open');
        }
      });
    }
  }

  setupTitleEditing() {
    if (!this.titleElement) return;

    this.titleElement.addEventListener('click', () => {
      const session = store.getActiveSession();
      if (!session) return;

      const currentTitle = session.title;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'header-chat-title editing';
      input.value = currentTitle;
      input.maxLength = 120;

      const save = () => {
        const newTitle = input.value.trim() || 'New conversation';
        store.updateSession(session.id, { title: newTitle });
        if (input.parentElement) {
          input.replaceWith(this.titleElement);
        }
        this.titleElement.textContent = newTitle;
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          save();
        } else if (e.key === 'Escape') {
          input.replaceWith(this.titleElement);
        }
      });
      input.addEventListener('blur', save);

      this.titleElement.replaceWith(input);
      input.focus();
      input.select();
    });
  }

  setupOverflowMenu() {
    if (!this.btnOverflow) return;

    this.btnOverflow.addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.querySelector('.context-menu');
      if (existing) existing.remove();

      const session = store.getActiveSession();
      if (!session) return;

      const menu = document.createElement('div');
      menu.className = 'context-menu';

      // Rename
      const optRename = document.createElement('div');
      optRename.className = 'menu-item';
      optRename.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Rename</span>';
      optRename.addEventListener('click', () => {
        menu.remove();
        const newTitle = prompt('Rename chat:', session.title);
        if (newTitle !== null) {
          store.updateSession(session.id, { title: newTitle });
        }
      });
      menu.appendChild(optRename);

      // Export as Markdown
      const optExportMd = document.createElement('div');
      optExportMd.className = 'menu-item';
      optExportMd.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg><span>Export Markdown (.md)</span>';
      optExportMd.addEventListener('click', () => {
        menu.remove();
        exportSession(session, 'markdown');
      });
      menu.appendChild(optExportMd);

      // Export as JSON
      const optExportJson = document.createElement('div');
      optExportJson.className = 'menu-item';
      optExportJson.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Export JSON (.json)</span>';
      optExportJson.addEventListener('click', () => {
        menu.remove();
        exportSession(session, 'json');
      });
      menu.appendChild(optExportJson);

      // Delete
      const optDelete = document.createElement('div');
      optDelete.className = 'menu-item';
      optDelete.style.color = 'var(--danger)';
      optDelete.innerHTML = '<svg class="i" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Delete</span>';
      optDelete.addEventListener('click', () => {
        menu.remove();
        if (confirm(`Delete conversation "${session.title}"?`)) {
          store.deleteSession(session.id);
        }
      });
      menu.appendChild(optDelete);

      const rect = this.btnOverflow.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.right = `${window.innerWidth - rect.right}px`;

      document.body.appendChild(menu);

      const dismissHandler = (evt) => {
        if (!menu.contains(evt.target)) {
          menu.remove();
          document.removeEventListener('click', dismissHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', dismissHandler), 10);
    });
  }

  update(session) {
    if (!session) return;
    if (this.titleElement) {
      this.titleElement.textContent = session.title || 'New conversation';
    }
  }

  setupHealthIndicator() {
    if (!this.healthBtn) return;

    this.healthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleHealthPopover();
    });

    store.on('connection:health-changed', (health) => {
      this.updateHealthIndicator(health);
    });

    this.updateHealthIndicator(store.getConnectionHealth());
  }

  updateHealthIndicator(health) {
    if (!this.healthBtn) return;
    const dot = this.healthBtn.querySelector('.health-dot');
    const label = this.healthBtn.querySelector('.health-label');
    if (!dot || !label) return;

    dot.classList.remove('status-connected', 'status-degraded', 'status-disconnected');

    if (health.status === 'connected') {
      if (health.latencyMs !== null && health.latencyMs >= 500) {
        dot.classList.add('status-degraded');
        label.textContent = `Slow (${Math.round(health.latencyMs)}ms)`;
        this.healthBtn.title = `High latency: ${Math.round(health.latencyMs)}ms`;
      } else {
        dot.classList.add('status-connected');
        label.textContent = 'Connected';
        this.healthBtn.title = health.latencyMs ? `Connected (${Math.round(health.latencyMs)}ms)` : 'Connected';
      }
    } else if (health.status === 'degraded') {
      dot.classList.add('status-degraded');
      label.textContent = 'Degraded';
      this.healthBtn.title = 'Ollama unreachable or degraded';
    } else {
      dot.classList.add('status-disconnected');
      label.textContent = 'Offline';
      this.healthBtn.title = health.errorMessage || 'e-webui proxy offline';
    }
  }

  toggleHealthPopover() {
    if (!this.healthContainer) return;
    const existing = this.healthContainer.querySelector('.health-popover');
    if (existing) {
      existing.remove();
      this.healthBtn.setAttribute('aria-expanded', 'false');
      return;
    }

    const health = store.getConnectionHealth();
    const popover = document.createElement('div');
    popover.className = 'health-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'System Diagnostics');
    popover.setAttribute('dir', 'ltr');

    const statusBadgeClass = health.status === 'connected'
      ? (health.latencyMs >= 500 ? 'status-degraded' : 'status-connected')
      : (health.status === 'degraded' ? 'status-degraded' : 'status-disconnected');

    const statusText = health.status === 'connected'
      ? (health.latencyMs >= 500 ? 'High Latency' : 'Operational')
      : (health.status === 'degraded' ? 'Degraded' : 'Offline');

    const modelsText = health.loadedModels && health.loadedModels.length > 0
      ? health.loadedModels.join(', ')
      : 'None loaded';

    popover.innerHTML = `
      <div class="popover-header">
        <h4>System Diagnostics</h4>
        <span class="popover-timestamp">Checked just now</span>
      </div>
      <div class="popover-body">
        <div class="diag-row">
          <span class="diag-label">Ollama Container</span>
          <span class="diag-value diag-status-badge ${statusBadgeClass}">${statusText}</span>
        </div>
        <div class="diag-row">
          <span class="diag-label">Round-Trip Latency</span>
          <span class="diag-value diag-latency font-mono">${health.latencyMs !== null ? health.latencyMs + ' ms' : '—'}</span>
        </div>
        <div class="diag-row">
          <span class="diag-label">Loaded in Memory</span>
          <span class="diag-value diag-models font-mono">${escapeHtml(modelsText)}</span>
        </div>
        ${health.errorMessage ? `<div class="diag-error-note">${escapeHtml(health.errorMessage)}</div>` : ''}
      </div>
      <div class="popover-footer">
        <button class="btn-diag-refresh" type="button">
          <svg class="i" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5"/></svg>
          <span>Check Now</span>
        </button>
      </div>
    `;

    this.healthContainer.appendChild(popover);
    this.healthBtn.setAttribute('aria-expanded', 'true');

    const refreshBtn = popover.querySelector('.btn-diag-refresh');
    refreshBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      refreshBtn.disabled = true;
      const icon = refreshBtn.querySelector('svg');
      if (icon) icon.classList.add('spin-animate');
      try {
        const result = await api.checkHealth();
        store.setConnectionHealth({
          status: result.status,
          latencyMs: result.latency_ms,
          ollamaUrl: result.ollama_url,
          loadedModels: result.loaded_models || [],
          errorMessage: result.error
        });
        // Re-render popover content
        popover.remove();
        this.toggleHealthPopover();
      } catch (err) {
        store.setConnectionHealth({
          status: 'disconnected',
          latencyMs: null,
          ollamaUrl: '',
          loadedModels: [],
          errorMessage: err.message || 'Check failed'
        });
        popover.remove();
        this.toggleHealthPopover();
      }
    });

    const dismissHandler = (evt) => {
      if (!popover.contains(evt.target) && !this.healthBtn.contains(evt.target)) {
        popover.remove();
        this.healthBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', dismissHandler);
        document.removeEventListener('keydown', keyHandler);
      }
    };
    const keyHandler = (evt) => {
      if (evt.key === 'Escape') {
        popover.remove();
        this.healthBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', dismissHandler);
        document.removeEventListener('keydown', keyHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', dismissHandler);
      document.addEventListener('keydown', keyHandler);
    }, 10);
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
