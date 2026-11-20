/**
 * StorageService Implementation
 * Handles client-side persistence cascade: IndexedDB -> LocalStorage -> In-Memory.
 * Contract: specs/016-chat-history-persistence/contracts/storage-contract.md
 */

import {
  openDb,
  dbGet,
  dbSet,
  dbDel,
  dbGetAll,
  dbGetAllFromIndex,
  dbDeleteFromIndex,
  dbClear,
  isIndexedDBSupported
} from './db.js';

const LOCALSTORAGE_SESSIONS_KEY = 'ewebui_sessions_v1';
const LOCALSTORAGE_ACTIVE_KEY = 'ewebui_active_session_id';
const LOCALSTORAGE_PRESETS_KEY = 'ewebui_custom_presets_v1';

export class StorageService {
  constructor() {
    /** @type {'indexeddb' | 'localstorage' | 'memory'} */
    this.driver = 'memory';
    this.initialized = false;
    this.memoryStore = {
      sessions: new Map(),
      messages: new Map(),
      preferences: new Map()
    };
  }

  /**
   * Initializes the persistence driver cascade.
   * @returns {Promise<boolean>}
   */
  async init() {
    if (this.initialized) return this.driver !== 'memory';

    if (isIndexedDBSupported()) {
      try {
        await openDb();
        this.driver = 'indexeddb';
        this.initialized = true;
        return true;
      } catch (idbErr) {
        console.warn('IndexedDB unavailable or blocked, falling back to localStorage:', idbErr);
      }
    }

    // Fallback to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const testKey = '__ewebui_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        this.driver = 'localstorage';
        this.initialized = true;
        return true;
      }
    } catch (lsErr) {
      console.warn('localStorage unavailable or blocked, falling back to memory:', lsErr);
    }

    this.driver = 'memory';
    this.initialized = true;
    return false;
  }

  getDriver() {
    return this.driver;
  }

  /**
   * Loads all conversation sessions with their complete message arrays.
   * @returns {Promise<Array<any>>}
   */
  async loadAllSessions() {
    await this.init();

    if (this.driver === 'indexeddb') {
      try {
        const sessionMetaList = await dbGetAll('sessions');
        const allMessages = await dbGetAll('messages');

        // Group messages by sessionId
        const messageMap = new Map();
        for (const msg of allMessages) {
          if (!messageMap.has(msg.sessionId)) {
            messageMap.set(msg.sessionId, []);
          }
          messageMap.get(msg.sessionId).push(msg);
        }

        // Sort messages chronologically for each session
        const sessions = sessionMetaList.map((meta) => {
          const msgs = messageMap.get(meta.id) || [];
          msgs.sort((a, b) => a.createdAt - b.createdAt);
          return {
            ...meta,
            messages: msgs
          };
        });

        sessions.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        return sessions;
      } catch (err) {
        console.error('Failed to load sessions from IndexedDB, falling back:', err);
      }
    }

    if (this.driver === 'localstorage') {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Failed to parse sessions from localStorage:', err);
      }
    }

    // Memory fallback
    return Array.from(this.memoryStore.sessions.values()).sort(
      (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
    );
  }

  /**
   * Retrieves the ID of the last active conversation session.
   * @returns {Promise<string | null>}
   */
  async getActiveSessionId() {
    await this.init();

    if (this.driver === 'indexeddb') {
      try {
        const pref = await dbGet('preferences', 'activeSessionId');
        if (pref && pref.value) return pref.value;
      } catch (_) {}
    }

    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(LOCALSTORAGE_ACTIVE_KEY);
      } catch (_) {}
    }

    return this.memoryStore.preferences.get('activeSessionId') || null;
  }

  /**
   * Saves or updates a session metadata record.
   * @param {any} session
   * @returns {Promise<void>}
   */
  async saveSession(session) {
    if (!session || !session.id) return;
    await this.init();

    const meta = {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt || Date.now(),
      model: session.model,
      systemPrompt: session.systemPrompt || null,
      pinned: Boolean(session.pinned)
    };

    if (this.driver === 'indexeddb') {
      try {
        await dbSet('sessions', meta);
        return;
      } catch (err) {
        console.error('IndexedDB saveSession failed, trying localStorage:', err);
        if (typeof window !== 'undefined' && err && (err.name === 'QuotaExceededError' || String(err).includes('quota'))) {
          window.dispatchEvent(
            new CustomEvent('storage:warning', {
              detail: { message: 'Storage quota reached. Consider clearing or exporting older chats.' }
            })
          );
        }
      }
    }

    if (this.driver === 'localstorage') {
      this._saveSessionToLocalStorage(session);
      return;
    }

    this.memoryStore.sessions.set(session.id, { ...session });
  }

  /**
   * Saves or updates an individual message turn.
   * @param {any} message
   * @returns {Promise<void>}
   */
  async saveMessage(message) {
    if (!message || !message.id || !message.sessionId) return;
    await this.init();

    if (this.driver === 'indexeddb') {
      try {
        await dbSet('messages', message);
        return;
      } catch (err) {
        console.error('IndexedDB saveMessage failed, falling back:', err);
      }
    }

    if (this.driver === 'localstorage') {
      // In localStorage fallback, messages reside within the session object
      const raw = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
      let sessions = raw ? JSON.parse(raw) : [];
      const session = sessions.find((s) => s.id === message.sessionId);
      if (session) {
        if (!session.messages) session.messages = [];
        const idx = session.messages.findIndex((m) => m.id === message.id);
        if (idx !== -1) {
          session.messages[idx] = message;
        } else {
          session.messages.push(message);
        }
        session.updatedAt = Date.now();
        localStorage.setItem(LOCALSTORAGE_SESSIONS_KEY, JSON.stringify(sessions));
      }
      return;
    }

    this.memoryStore.messages.set(message.id, message);
  }

  /**
   * Deletes an individual message turn by ID.
   * @param {string} messageId
   * @returns {Promise<void>}
   */
  async deleteMessage(messageId) {
    if (!messageId) return;
    await this.init();

    if (this.driver === 'indexeddb') {
      try {
        await dbDel('messages', messageId);
        return;
      } catch (err) {
        console.error('IndexedDB deleteMessage failed:', err);
      }
    }

    if (this.driver === 'localstorage') {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
        if (raw) {
          const sessions = JSON.parse(raw);
          for (const s of sessions) {
            if (s.messages) {
              s.messages = s.messages.filter((m) => m.id !== messageId);
            }
          }
          localStorage.setItem(LOCALSTORAGE_SESSIONS_KEY, JSON.stringify(sessions));
        }
      } catch (_) {}
      return;
    }

    this.memoryStore.messages.delete(messageId);
  }

  /**
   * Deletes a session and all associated turns.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    if (!sessionId) return;
    await this.init();

    if (this.driver === 'indexeddb') {
      try {
        await dbDel('sessions', sessionId);
        await dbDeleteFromIndex('messages', 'sessionId', sessionId);
        return;
      } catch (err) {
        console.error('IndexedDB deleteSession failed:', err);
      }
    }

    if (this.driver === 'localstorage') {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
        if (raw) {
          let sessions = JSON.parse(raw);
          sessions = sessions.filter((s) => s.id !== sessionId);
          localStorage.setItem(LOCALSTORAGE_SESSIONS_KEY, JSON.stringify(sessions));
        }
      } catch (_) {}
      return;
    }

    this.memoryStore.sessions.delete(sessionId);
    for (const [id, msg] of this.memoryStore.messages) {
      if (msg.sessionId === sessionId) {
        this.memoryStore.messages.delete(id);
      }
    }
  }

  /**
   * Sets the active session ID preference.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async setActiveSessionId(sessionId) {
    if (!sessionId) return;
    await this.init();

    if (this.driver === 'indexeddb') {
      try {
        await dbSet('preferences', { key: 'activeSessionId', value: sessionId });
      } catch (_) {}
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCALSTORAGE_ACTIVE_KEY, sessionId);
      } catch (_) {}
    }

    this.memoryStore.preferences.set('activeSessionId', sessionId);
  }

  /**
   * Loads custom user presets from storage cascade.
   * @returns {Promise<Array<any>>}
   */
  async loadCustomPresets() {
    await this.init();

    if (this.driver === 'indexeddb') {
      try {
        const record = await dbGet('preferences', 'custom_presets');
        if (record && Array.isArray(record.value)) {
          return record.value;
        }
      } catch (err) {
        console.warn('Failed to load custom presets from IndexedDB:', err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_PRESETS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }

    return this.memoryStore.preferences.get('custom_presets') || [];
  }

  /**
   * Saves or updates a custom user preset in storage.
   * @param {any} preset
   * @returns {Promise<void>}
   */
  async saveCustomPreset(preset) {
    if (!preset || !preset.id) return;
    await this.init();

    const presets = await this.loadCustomPresets();
    const existingIndex = presets.findIndex((p) => p.id === preset.id);
    if (existingIndex >= 0) {
      presets[existingIndex] = { ...presets[existingIndex], ...preset, updatedAt: Date.now() };
    } else {
      presets.push(preset);
    }

    if (this.driver === 'indexeddb') {
      try {
        await dbSet('preferences', { key: 'custom_presets', value: presets });
      } catch (err) {
        console.warn('Failed to save custom presets to IndexedDB:', err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCALSTORAGE_PRESETS_KEY, JSON.stringify(presets));
      } catch (_) {}
    }

    this.memoryStore.preferences.set('custom_presets', presets);
  }

  /**
   * Deletes a custom user preset by ID.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteCustomPreset(id) {
    if (!id) return false;
    await this.init();

    const presets = await this.loadCustomPresets();
    const filtered = presets.filter((p) => p.id !== id);
    if (filtered.length === presets.length) return false;

    if (this.driver === 'indexeddb') {
      try {
        await dbSet('preferences', { key: 'custom_presets', value: filtered });
      } catch (err) {
        console.warn('Failed to delete custom preset from IndexedDB:', err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCALSTORAGE_PRESETS_KEY, JSON.stringify(filtered));
      } catch (_) {}
    }

    this.memoryStore.preferences.set('custom_presets', filtered);
    return true;
  }

  /**
   * Wipes all stored sessions, messages, and history.
   * @returns {Promise<void>}
   */
  async clearAll() {
    await this.init();

    if (this.driver === 'indexeddb') {
      try {
        await dbClear('sessions');
        await dbClear('messages');
        await dbDel('preferences', 'activeSessionId');
      } catch (err) {
        console.error('IndexedDB clearAll failed:', err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LOCALSTORAGE_SESSIONS_KEY);
        localStorage.removeItem(LOCALSTORAGE_ACTIVE_KEY);
      } catch (_) {}
    }

    this.memoryStore.sessions.clear();
    this.memoryStore.messages.clear();
    this.memoryStore.preferences.clear();
  }

  /**
   * Toggles the pinned status of a session.
   * @param {string} sessionId
   * @returns {Promise<boolean>} new pinned status
   */
  async togglePinSession(sessionId) {
    await this.init();
    const session = await this.getSession(sessionId);
    if (!session) return false;
    session.pinned = !session.pinned;
    await this.saveSession(session);
    return session.pinned;
  }

  /**
   * Internal helper for localStorage fallback
   * @private
   */
  _saveSessionToLocalStorage(session) {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
      let sessions = raw ? JSON.parse(raw) : [];
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx !== -1) {
        sessions[idx] = session;
      } else {
        sessions.push(session);
      }
      localStorage.setItem(LOCALSTORAGE_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.warn('localStorage save failed (quota exceeded):', err);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('storage:warning', {
            detail: { message: 'Browser storage quota reached. Consider clearing or exporting older chats.' }
          })
        );
      }
    }
  }
}

export const storageService = new StorageService();
