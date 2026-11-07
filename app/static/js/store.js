/**
 * In-Memory ChatStore
 * Manages conversation sessions, active message turns, and dispatches observable events.
 * Contract: specs/012-chat-ui-redesign/data-model.md
 */

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
    }
  }

  /**
   * Creates a new chat session
   * @param {string} [title="New conversation"]
   * @param {string} [model]
   * @returns {ChatSession}
   */
  createSession(title = 'New conversation', model = null) {
    const now = Date.now();
    let savedModel = null;
    try {
      if (typeof localStorage !== 'undefined') {
        savedModel = localStorage.getItem('ewebui_last_model');
      }
    } catch (_) {}

    const session = {
      id: this._generateId(),
      title: title.slice(0, 120),
      createdAt: now,
      updatedAt: now,
      model: model || savedModel || this.defaultModel || '',
      messages: []
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

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
      return this.createSession();
    }
    return this.sessions.get(this.activeSessionId);
  }

  /**
   * Sets active session by ID
   * @param {string} id
   */
  setActiveSession(id) {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      this.emit('session:active-changed', this.sessions.get(id));
    }
  }

  /**
   * Updates a session's properties
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
    session.updatedAt = Date.now();

    this.emit('session:updated', session);
    return session;
  }

  /**
   * Deletes a session by ID
   * @param {string} id
   */
  deleteSession(id) {
    if (!this.sessions.has(id)) return false;

    this.sessions.delete(id);
    this.emit('session:deleted', id);

    if (this.activeSessionId === id) {
      const remaining = Array.from(this.sessions.values());
      if (remaining.length > 0) {
        this.setActiveSession(remaining[0].id);
      } else {
        this.createSession();
      }
    }
    return true;
  }

  /**
   * Returns all sessions ordered by updatedAt descending
   * @returns {ChatSession[]}
   */
  listSessions() {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
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
   * Appends a message to the active session
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

    this.emit('message:appended', { session, message });
    this.emit('session:updated', session);
    return message;
  }

  /**
   * Updates an existing message
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

    this.emit('message:updated', { session, message });
    return message;
  }
}

// Global singleton instance
export const store = new ChatStore();
