/**
 * Persistent ChatStore
 * Manages conversation sessions, active message turns, observable events,
 * and asynchronous persistence via StorageService.
 * Contract: specs/016-chat-history-persistence/contracts/storage-contract.md
 */

import { storageService } from './storage.js';

export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this._listeners.has(event)) {
      for (const handler of this._listeners.get(event)) {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      }
    }
  }
}

export class ChatStore extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, ChatSession>} */
    this.sessions = new Map();
    this.activeSessionId = null;
    this.defaultModel = '';
    this._saveDebounceTimers = new Map();
    this.isHydrated = false;

    /** @type {{ status: 'connected'|'degraded'|'disconnected', latencyMs: number|null, ollamaUrl: string, checkedAt: number, loadedModels: string[], errorMessage: string|null }} */
    this.connectionHealth = {
      status: 'connected',
      latencyMs: null,
      ollamaUrl: '',
      checkedAt: 0,
      loadedModels: [],
      errorMessage: null
    };
    this._healthPollTimer = null;
  }

  setConnectionHealth(snapshot) {
    this.connectionHealth = { ...this.connectionHealth, ...snapshot, checkedAt: Date.now() };
    this.emit('connection:health-changed', this.connectionHealth);
  }

  getConnectionHealth() {
    return this.connectionHealth;
  }

  startHealthPolling(probeFn, intervalMs = 30000) {
    this.stopHealthPolling();
    const runProbe = async () => {
      try {
        const result = await probeFn();
        this.setConnectionHealth({
          status: result.status,
          latencyMs: result.latency_ms,
          ollamaUrl: result.ollama_url,
          loadedModels: result.loaded_models || [],
          errorMessage: result.error
        });
      } catch (err) {
        this.setConnectionHealth({
          status: 'disconnected',
          latencyMs: null,
          ollamaUrl: '',
          loadedModels: [],
          errorMessage: err.message || 'Health probe failed'
        });
      }
    };

    runProbe();
    this._healthPollTimer = setInterval(runProbe, intervalMs);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this._healthPollTimer) {
            clearInterval(this._healthPollTimer);
            this._healthPollTimer = null;
          }
        } else {
          runProbe();
          if (!this._healthPollTimer) {
            this._healthPollTimer = setInterval(runProbe, intervalMs);
          }
        }
      });
    }
  }

  stopHealthPolling() {
    if (this._healthPollTimer) {
      clearInterval(this._healthPollTimer);
      this._healthPollTimer = null;
    }
  }

  /**
   * Initializes the persistent storage layer and hydrates saved conversations.
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isHydrated) return;

    try {
      await storageService.init();
      const savedSessions = await storageService.loadAllSessions();

      if (savedSessions && savedSessions.length > 0) {
        this.sessions.clear();
        for (const s of savedSessions) {
          if (s.systemPrompt === undefined) s.systemPrompt = null;
          if (s.presetId === undefined) s.presetId = null;
          if (s.temperature === undefined) s.temperature = 0.7;
          if (s.topP === undefined) s.topP = 0.9;
          if (s.numCtx === undefined) s.numCtx = null;
          this.sessions.set(s.id, s);
        }

        const savedActiveId = await storageService.getActiveSessionId();
        if (savedActiveId && this.sessions.has(savedActiveId)) {
          this.activeSessionId = savedActiveId;
        } else {
          this.activeSessionId = savedSessions[0].id;
        }
      } else {
        this.createSession();
      }

      this.isHydrated = true;
      const active = this.getActiveSession();
      this.emit('store:hydrated', { activeSession: active, sessions: this.listSessions() });
      if (active) {
        this.emit('session:active-changed', active);
      }
    } catch (err) {
      console.error('Failed to hydrate ChatStore from storage:', err);
      if (this.sessions.size === 0) {
        this.createSession();
      }
      this.isHydrated = true;
    }
  }

  /**
   * Generates a UUID v4 string
   */
  _generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  setDefaultModel(modelName) {
    this.defaultModel = modelName;
    const active = this.activeSessionId ? this.sessions.get(this.activeSessionId) : null;
    if (active && (!active.model || active.model === '')) {
      active.model = modelName;
      this.emit('session:updated', active);
      storageService.saveSession(active).catch(() => {});
    }
  }

  /**
   * Creates a new chat session and commits it to persistent storage.
   * @param {string} [title="New conversation"]
   * @param {string} [model]
   * @returns {ChatSession}
   */
  createSession(title = 'New conversation', model = null) {
    const now = Date.now();
    let savedModel = null;
    let savedTemp = 0.7;
    let savedTopP = 0.9;
    let savedPrompt = null;
    try {
      if (typeof localStorage !== 'undefined') {
        savedModel = localStorage.getItem('ewebui_last_model');
        const t = localStorage.getItem('ewebui_default_temperature');
        if (t !== null && !isNaN(parseFloat(t))) savedTemp = parseFloat(t);
        const p = localStorage.getItem('ewebui_default_topp');
        if (p !== null && !isNaN(parseFloat(p))) savedTopP = parseFloat(p);
        const sp = localStorage.getItem('ewebui_default_system_prompt');
        if (sp) savedPrompt = sp;
      }
    } catch (_) {}

    const session = {
      id: this._generateId(),
      title: title.slice(0, 120),
      createdAt: now,
      updatedAt: now,
      model: model || savedModel || this.defaultModel || '',
      systemPrompt: savedPrompt,
      presetId: null,
      temperature: savedTemp,
      topP: savedTopP,
      numCtx: null,
      messages: []
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

    // Asynchronously commit to storage
    storageService.saveSession(session).catch((err) => {
      console.warn('Failed to persist new session:', err);
    });
    storageService.setActiveSessionId(session.id).catch(() => {});

    this.emit('session:created', session);
    this.emit('session:active-changed', session);
    return session;
  }

  /**
   * Retrieves a session by ID
   * @param {string} id
   * @returns {ChatSession | null}
   */
  getSession(id) {
    return this.sessions.get(id) || null;
  }

  /**
   * Returns current active session or creates one if none exists
   * @returns {ChatSession}
   */
  getActiveSession() {
    if (!this.activeSessionId || !this.sessions.has(this.activeSessionId)) {
      if (this.sessions.size > 0) {
        const first = this.listSessions()[0];
        this.activeSessionId = first.id;
        return first;
      }
      return this.createSession();
    }
    return this.sessions.get(this.activeSessionId);
  }

  /**
   * Sets active session by ID and persists preference.
   * @param {string} id
   */
  setActiveSession(id) {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      storageService.setActiveSessionId(id).catch(() => {});
      this.emit('session:active-changed', this.sessions.get(id));
    }
  }

  /**
   * Updates a session's properties and persists changes.
   * @param {string} id
   * @param {Partial<ChatSession>} updates
   */
  updateSession(id, updates) {
    const session = this.sessions.get(id);
    if (!session) return null;

    if (updates.title !== undefined) {
      session.title = updates.title.trim().slice(0, 120) || 'New conversation';
    }
    if (updates.model !== undefined) {
      session.model = updates.model;
    }
    if (updates.systemPrompt !== undefined) {
      session.systemPrompt = updates.systemPrompt;
    }
    if (updates.presetId !== undefined) {
      session.presetId = updates.presetId;
    }
    if (updates.temperature !== undefined) {
      session.temperature = updates.temperature;
    }
    if (updates.topP !== undefined) {
      session.topP = updates.topP;
    }
    if (updates.numCtx !== undefined) {
      session.numCtx = updates.numCtx;
    }
    session.updatedAt = Date.now();

    storageService.saveSession(session).catch((err) => {
      console.warn('Failed to persist session update:', err);
    });

    this.emit('session:updated', session);
    return session;
  }

  /**
   * Deletes a session by ID and removes it from storage.
   * @param {string} id
   */
  deleteSession(id) {
    if (!this.sessions.has(id)) return false;

    this.sessions.delete(id);
    storageService.deleteSession(id).catch((err) => {
      console.warn('Failed to delete session from storage:', err);
    });

    this.emit('session:deleted', id);

    if (this.activeSessionId === id) {
      const remaining = this.listSessions();
      if (remaining.length > 0) {
        this.setActiveSession(remaining[0].id);
      } else {
        this.createSession();
      }
    }
    return true;
  }

  /**
   * Clears all sessions and wipes persistent storage.
   * @returns {Promise<void>}
   */
  async clearAllSessions() {
    await storageService.clearAll();
    this.sessions.clear();
    this.activeSessionId = null;
    this.createSession();
    this.emit('session:cleared');
  }

  /**
   * Returns all sessions ordered by updatedAt descending
   * @returns {ChatSession[]}
   */
  listSessions() {
    return Array.from(this.sessions.values()).sort(
      (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
    );
  }

  /**
   * Retrieves chronological history of dialogue turns formatted for Ollama
   * @param {string} sessionId
   * @returns {Array<{role: string, content: string}>}
   */
  getHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.messages) return [];
    return session.messages
      .filter((m) => m.status === 'completed' && m.content)
      .map((m) => ({
        role: m.role,
        content: m.content
      }));
  }

  /**
   * Appends a message to the active session and commits it to persistent storage.
   * @param {string} sessionId
   * @param {'user' | 'assistant'} role
   * @param {string} content
   * @param {string | null} [reasoning=null]
   * @param {string} [status='completed']
   * @returns {ChatMessage}
   */
  appendMessage(sessionId, role, content, reasoning = null, status = 'completed') {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const message = {
      id: this._generateId(),
      sessionId: session.id,
      role,
      content,
      reasoning,
      status, // 'streaming' | 'completed' | 'stopped' | 'error'
      metrics: null,
      createdAt: Date.now()
    };

    session.messages.push(message);
    session.updatedAt = Date.now();

    // Auto-title from first user message if title is default
    if (role === 'user' && session.title === 'New conversation') {
      const cleanTitle = content.split('\n')[0].trim().slice(0, 48);
      if (cleanTitle) {
        session.title = cleanTitle;
      }
    }

    // Persist immediately for non-streaming or initial turn
    storageService.saveMessage(message).catch(() => {});
    storageService.saveSession(session).catch(() => {});

    this.emit('message:appended', { session, message });
    this.emit('session:updated', session);
    return message;
  }

  /**
   * Updates an existing message and debounces storage writes during active streaming.
   * @param {string} sessionId
   * @param {string} messageId
   * @param {Partial<ChatMessage>} updates
   */
  updateMessage(sessionId, messageId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const message = session.messages.find((m) => m.id === messageId);
    if (!message) return null;

    Object.assign(message, updates);
    session.updatedAt = Date.now();

    // Storage persistence strategy
    if (message.status === 'streaming') {
      // Debounce writes during fast streaming (at most once every 1.5 seconds)
      if (!this._saveDebounceTimers.has(message.id)) {
        const timer = setTimeout(() => {
          this._saveDebounceTimers.delete(message.id);
          storageService.saveMessage(message).catch(() => {});
        }, 1500);
        this._saveDebounceTimers.set(message.id, timer);
      }
    } else {
      // Completed, stopped, or error: immediately flush and clear any pending debounce
      if (this._saveDebounceTimers.has(message.id)) {
        clearTimeout(this._saveDebounceTimers.get(message.id));
        this._saveDebounceTimers.delete(message.id);
      }
      storageService.saveMessage(message).catch(() => {});
      storageService.saveSession(session).catch(() => {});
    }

    this.emit('message:updated', { session, message });
    return message;
  }

  /**
   * Deletes a message from a session
   * @param {string} sessionId
   * @param {string} messageId
   */
  deleteMessage(sessionId, messageId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const idx = session.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return false;

    session.messages.splice(idx, 1);
    session.updatedAt = Date.now();

    storageService.deleteMessage(messageId).catch(() => {});
    storageService.saveSession(session).catch(() => {});

    this.emit('message:deleted', { sessionId, messageId });
    this.emit('session:updated', session);
    return true;
  }
}

// Global singleton instance
export const store = new ChatStore();
