/**
 * Sidebar Navigation Component
 * Manages sessions list, date grouping (Today/Yesterday/7 days/Older),
 * instant title search, hover context actions (Rename, Pin, Delete),
 * collapse rail toggle, and Ollama connection status monitoring.
 */

import { store } from '../store.js';
import { api } from '../api.js';
import { bindFeatureControl } from '../features.js';

const SIDEBAR_COLLAPSED_KEY = 'ewebui_sidebar_collapsed';

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.sessionListContainer = container.querySelector('.session-list');
    this.searchInput = container.querySelector('.search-input');
    this.btnNewChat = container.querySelector('.btn-new-chat');
    this.btnToggleCollapse = container.querySelector('.btn-collapse-sidebar');
    this.connectionDot = container.querySelector('.connection-sub .dot');
    this.connectionText = container.querySelector('.connection-sub .status-text');
    this.navLibrary = container.querySelector('.nav-library');
    this.navTools = container.querySelector('.nav-tools');

    this.searchQuery = '';
    this.isCollapsed = this.getSavedCollapsedState();

    this.init();
  }

  getSavedCollapsedState() {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  init() {
    this.applyCollapsedState(this.isCollapsed);
    this.bindRegistryControls();
    this.setupListeners();
    this.pollHealth();

    // Re-poll health periodically
    setInterval(() => this.pollHealth(), 15000);

    // Initial render
    this.render();
  }

  bindRegistryControls() {
    if (this.navLibrary) {
      bindFeatureControl(this.navLibrary, 'nav.library');
    }
    if (this.navTools) {
      bindFeatureControl(this.navTools, 'nav.tools');
    }
  }

  setupListeners() {
    if (this.btnNewChat) {
      this.btnNewChat.addEventListener('click', (e) => {
        e.preventDefault();
        store.createSession();
        // If on mobile, close drawer
        if (window.innerWidth < 1024) {
          this.container.classList.remove('open');
        }
      });
    }

    if (this.btnToggleCollapse) {
      this.btnToggleCollapse.addEventListener('click', () => {
        this.isCollapsed = !this.isCollapsed;
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.isCollapsed));
        } catch (e) {
          console.warn('Failed to persist sidebar state:', e);
        }
        this.applyCollapsedState(this.isCollapsed);
      });
    }

    const brandLink = this.container.querySelector('.brand-link');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        if (this.isCollapsed) {
          e.preventDefault();
          this.isCollapsed = false;
          try {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
          } catch (_) {}
          this.applyCollapsedState(false);
        }
      });
    }

    // Backdrop dismissal on mobile/tablet
    document.addEventListener('click', (e) => {
      if (window.innerWidth < 1024 && this.container.classList.contains('open')) {
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        if (!this.container.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
          this.container.classList.remove('open');
        }
      }
    });

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // React to store events
    store.on('session:created', () => this.render());
    store.on('session:updated', () => this.render());
    store.on('session:deleted', () => this.render());
    store.on('session:active-changed', () => this.render());
  }

  applyCollapsedState(collapsed) {
    if (collapsed) {
      this.container.classList.add('collapsed');
      this.container.setAttribute('aria-expanded', 'false');
    } else {
      this.container.classList.remove('collapsed');
      this.container.setAttribute('aria-expanded', 'true');
    }
  }

  async pollHealth() {
    if (!this.connectionDot) return;
    const health = await api.getHealth();
    if (health && health.ollama_connected) {
      this.connectionDot.classList.remove('offline');
      this.connectionDot.title = `Connected to Ollama (${health.ollama_url})`;
      if (this.connectionText) this.connectionText.textContent = 'Ollama connected';
    } else {
      this.connectionDot.classList.add('offline');
      this.connectionDot.title = 'Ollama unreachable';
      if (this.connectionText) this.connectionText.textContent = 'Ollama offline';
    }
  }

  /**
   * Groups sessions into relative time buckets
   * @param {ChatSession[]} sessions
   */
  groupSessions(sessions) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysStart = todayStart - 6 * 86400000;

    const groups = {
      Today: [],
      Yesterday: [],
      'Previous 7 days': [],
      Older: []
    };

    for (const session of sessions) {
      const time = session.updatedAt || session.createdAt;
      if (time >= todayStart) {
        groups.Today.push(session);
      } else if (time >= yesterdayStart) {
        groups.Yesterday.push(session);
      } else if (time >= sevenDaysStart) {
        groups['Previous 7 days'].push(session);
      } else {
        groups.Older.push(session);
      }
    }

    return groups;
  }

  render() {
    if (!this.sessionListContainer) return;

    let sessions = store.listSessions();
    if (this.searchQuery) {
      sessions = sessions.filter((s) => s.title.toLowerCase().includes(this.searchQuery));
    }

    this.sessionListContainer.innerHTML = '';
    const groups = this.groupSessions(sessions);
    const activeSession = store.getActiveSession();

    for (const [groupName, groupItems] of Object.entries(groups)) {
      if (groupItems.length === 0) continue;

      const label = document.createElement('div');
      label.className = 'section-label hide-collapsed';
      label.textContent = groupName;
      this.sessionListContainer.appendChild(label);

      for (const item of groupItems) {
        const row = document.createElement('div');
        row.className = `session-item ${activeSession && activeSession.id === item.id ? 'active' : ''}`;
        row.title = item.title;

        // Title link
        const titleSpan = document.createElement('span');
        titleSpan.className = 'session-title hide-collapsed';
        titleSpan.textContent = item.title;
        titleSpan.addEventListener('click', () => {
          store.setActiveSession(item.id);
          if (window.innerWidth < 1024) {
            this.container.classList.remove('open');
          }
        });
        row.appendChild(titleSpan);

        // Hover Context Menu Button
        const menuBtn = document.createElement('button');
        menuBtn.className = 'session-menu-btn hide-collapsed';
        menuBtn.type = 'button';
        menuBtn.title = 'Chat options';
        menuBtn.innerHTML = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openSessionMenu(e, item);
        });
        row.appendChild(menuBtn);

        this.sessionListContainer.appendChild(row);
      }
    }
  }

  openSessionMenu(e, session) {
    // Remove existing open menus
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

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

    // Pin (disabled per feature registry)
    const optPin = document.createElement('div');
    optPin.className = 'menu-item disabled';
    optPin.innerHTML = '<svg class="i" viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-2l-3-3V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v7l-3 3v2z"/></svg><span>Pin</span>';
    bindFeatureControl(optPin, 'session.pin');
    menu.appendChild(optPin);

    // Delete
    const optDelete = document.createElement('div');
    optDelete.className = 'menu-item';
    optDelete.style.color = 'var(--danger)';
    optDelete.innerHTML = '<svg class="i" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Delete</span>';
    optDelete.addEventListener('click', () => {
      menu.remove();
      if (confirm(`Delete chat "${session.title}"?`)) {
        store.deleteSession(session.id);
      }
    });
    menu.appendChild(optDelete);

    // Position menu near button
    const rect = e.currentTarget.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - 160)}px`;

    document.body.appendChild(menu);

    // Dismiss on click outside
    const dismissHandler = (evt) => {
      if (!menu.contains(evt.target)) {
        menu.remove();
        document.removeEventListener('click', dismissHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', dismissHandler), 10);
  }
}
