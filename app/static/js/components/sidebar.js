/**
 * Sidebar Navigation Component
 * Manages sessions list, date grouping (Today/Yesterday/Previous 7 days/Older),
 * instant title search, sidebar collapse, and authoritative Ollama connection
 * telemetry capsule + upward diagnostics popover.
 */

import { store } from '../store.js';
import { healthManager } from '../health.js';
import { bindFeatureControl } from '../features.js';
import { api } from '../api.js';
import { showToast } from '../toast.js';

const SIDEBAR_COLLAPSED_KEY = 'ewebui_sidebar_collapsed';

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.sessionListContainer = container.querySelector('.session-list') || container.querySelector('#session-list');
    this.searchInput = container.querySelector('.search-input');
    this.btnNewChat = container.querySelector('.btn-new-chat') || container.querySelector('#newchat');
    this.btnToggleCollapse = container.querySelector('.btn-collapse-sidebar') || container.querySelector('#sbtoggle');

    // Telemetry capsule elements
    this.connBtn = container.querySelector('#conn');
    this.cpop = container.querySelector('#cpop');
    this.cLabel = container.querySelector('#clabel');
    this.cMs = container.querySelector('#cms');
    this.cState = container.querySelector('#cstate');
    this.cEnd = container.querySelector('#cend');
    this.cLat = container.querySelector('#clat');
    this.cModels = container.querySelector('#cmodels');
    this.cTs = container.querySelector('#cts');
    this.retestBtn = container.querySelector('#retest');

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
    this.setupListeners();
    this.setupConnectionTelemetry();

    // Initial render
    this.render();
  }

  setupListeners() {
    if (this.btnNewChat) {
      this.btnNewChat.addEventListener('click', (e) => {
        e.preventDefault();
        store.createSession();
        if (window.innerWidth < 760) {
          this.container.classList.remove('open');
        }
      });
    }

    if (this.btnToggleCollapse) {
      this.btnToggleCollapse.addEventListener('click', () => {
        this.isCollapsed = !this.isCollapsed;
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.isCollapsed));
        } catch (_) {}
        this.applyCollapsedState(this.isCollapsed);
      });
    }

    const openSbBtn = document.getElementById('opensb');
    if (openSbBtn) {
      openSbBtn.addEventListener('click', () => {
        this.isCollapsed = false;
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
        } catch (_) {}
        this.applyCollapsedState(false);
        this.container.classList.toggle('open');
      });
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // React to store events
    store.on('store:hydrated', () => this.render());
    store.on('session:created', () => this.render());
    store.on('session:updated', () => this.render());
    store.on('session:deleted', () => this.render());
    store.on('session:cleared', () => this.render());
    store.on('session:active-changed', () => this.render());
  }

  applyCollapsedState(collapsed) {
    if (collapsed) {
      this.container.classList.add('collapsed');
      document.body.classList.add('sbc');
      this.container.setAttribute('aria-expanded', 'false');
    } else {
      this.container.classList.remove('collapsed');
      document.body.classList.remove('sbc');
      this.container.setAttribute('aria-expanded', 'true');
    }
  }

  setupConnectionTelemetry() {
    if (!this.connBtn || !this.cpop) return;

    // Toggle diagnostics popover
    const togglePopover = (show) => {
      const isExpanded = show !== undefined ? show : !this.cpop.classList.contains('on');
      this.cpop.classList.toggle('on', isExpanded);
      this.connBtn.setAttribute('aria-expanded', String(isExpanded));
    };

    this.connBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover();
    });

    document.addEventListener('click', (e) => {
      if (this.cpop.classList.contains('on') && !this.cpop.contains(e.target) && !this.connBtn.contains(e.target)) {
        togglePopover(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.cpop.classList.contains('on')) {
        togglePopover(false);
        this.connBtn.focus();
      }
    });

    if (this.retestBtn) {
      this.retestBtn.addEventListener('click', async () => {
        this.retestBtn.disabled = true;
        this.retestBtn.innerHTML = '<span class="dot" style="display:inline-block;margin-inline-end:6px"></span>Checking…';
        try {
          const snapshot = await healthManager.probe();
          if (snapshot.status === 'online' || snapshot.status === 'degraded') {
            let modelCount = 0;
            try {
              const modelRes = await api.getModels();
              if (modelRes && Array.isArray(modelRes.models)) {
                modelCount = modelRes.models.length;
              }
            } catch (_) {}

            const modelText = modelCount === 1 ? '1 model available' : `${modelCount} models available`;
            showToast(`Connected to Ollama · ${modelText}`, 'success');
            store.emit('models:reload');
          } else {
            const err = snapshot.errorMessage || 'Cannot connect to Ollama';
            showToast(`Connection failed: ${err}`, 'error');
          }
        } catch (err) {
          showToast(`Connection failed: ${err.message || 'Error'}`, 'error');
        } finally {
          this.retestBtn.disabled = false;
          this.retestBtn.innerHTML = '<svg class="i"><use href="#rl"/></svg>Reconnect and test';
        }
      });
    }

    // Subscribe to healthManager updates
    healthManager.subscribe((snapshot) => {
      this.updateConnectionUI(snapshot);
    });

    // Start health telemetry polling
    healthManager.startPolling();
  }

  updateConnectionUI(snapshot) {
    if (!this.connBtn) return;

    // Remove old state classes
    this.connBtn.classList.remove('st-on', 'st-slow', 'st-off', 'st-chk');

    let stateClass = 'st-chk';
    let label = 'Checking';
    let sub = '…';
    let stateDesc = 'Checking connection…';

    switch (snapshot.status) {
      case 'online':
        stateClass = 'st-on';
        label = 'Online';
        sub = snapshot.latencyMs !== null ? `${snapshot.latencyMs} ms` : 'OK';
        stateDesc = 'Operational';
        break;
      case 'degraded':
        stateClass = 'st-slow';
        label = 'Slow';
        sub = snapshot.latencyMs !== null ? `${snapshot.latencyMs} ms` : 'Slow';
        stateDesc = 'High Latency / Degraded';
        break;
      case 'offline':
        stateClass = 'st-off';
        label = 'Offline';
        sub = 'Unreachable';
        stateDesc = 'Ollama Unreachable';
        break;
      case 'checking':
      default:
        stateClass = 'st-chk';
        label = 'Checking';
        sub = '…';
        stateDesc = 'Checking…';
        break;
    }

    this.connBtn.classList.add(stateClass);
    this.connBtn.setAttribute('title', `Ollama: ${label} (${sub})`);
    if (this.cLabel) this.cLabel.textContent = label;
    if (this.cMs) this.cMs.textContent = sub;

    // Popover content
    if (this.cState) this.cState.textContent = stateDesc;
    if (this.cEnd) this.cEnd.textContent = snapshot.endpointUrl || '127.0.0.1:11434';
    if (this.cLat) this.cLat.textContent = snapshot.latencyMs !== null ? `${snapshot.latencyMs} ms` : '—';
    if (this.cModels) {
      const models = snapshot.loadedModels || [];
      this.cModels.textContent = models.length > 0 ? models.join(', ') : 'No model loaded';
    }
    if (this.cTs) {
      this.cTs.textContent = snapshot.checkedAt ? new Date(snapshot.checkedAt).toLocaleTimeString() : 'just now';
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
    const activeSession = store.getActiveSession();

    // Render Pinned Sessions Group
    const pinnedSessions = sessions.filter((s) => Boolean(s.pinned));
    const unpinnedSessions = sessions.filter((s) => !s.pinned);

    if (pinnedSessions.length > 0) {
      const pinLabel = document.createElement('div');
      pinLabel.className = 'grp section-label pinned-label';
      pinLabel.innerHTML = '<svg class="i" style="width:12px;height:12px;margin-inline-end:5px"><use href="#pin"/></svg>Pinned';
      this.sessionListContainer.appendChild(pinLabel);

      for (const session of pinnedSessions) {
        this._renderSessionItem(session, activeSession);
      }
    }

    const groups = this.groupSessions(unpinnedSessions);

    for (const [groupName, groupItems] of Object.entries(groups)) {
      if (groupItems.length === 0) continue;

      const label = document.createElement('div');
      label.className = 'grp section-label';
      label.textContent = groupName;
      this.sessionListContainer.appendChild(label);

      for (const session of groupItems) {
        this._renderSessionItem(session, activeSession);
      }
    }
  }

  _renderSessionItem(session, activeSession) {
    const item = document.createElement('button');
    item.className = 'sess session-item';
    if (session.pinned) item.classList.add('is-pinned');
    item.dataset.sessionId = session.id;
    const isActive = activeSession && activeSession.id === session.id;
    item.setAttribute('aria-current', String(isActive));
    if (isActive) item.classList.add('active');

    const titleSpan = document.createElement('span');
    titleSpan.textContent = session.title || 'New conversation';
    titleSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:start;';
    item.appendChild(titleSpan);

    const pinBtn = document.createElement('span');
    pinBtn.className = 'btn-pin-session';
    pinBtn.title = session.pinned ? 'Unpin chat' : 'Pin chat';
    pinBtn.setAttribute('role', 'button');
    pinBtn.setAttribute('tabindex', '0');
    pinBtn.innerHTML = '<svg class="i"><use href="#pin"/></svg>';
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      session.pinned = !session.pinned;
      if (store.storage) {
        await store.storage.saveSession(session);
      }
      this.render();
    });
    item.appendChild(pinBtn);

    item.addEventListener('click', () => {
      store.setActiveSession(session.id);
      if (window.innerWidth < 760) {
        this.container.classList.remove('open');
      }
    });

    this.sessionListContainer.appendChild(item);
  }
}
