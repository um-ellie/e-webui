# Storage Service Interface Contract

**Feature**: `016-chat-history-persistence`  
**Date**: 2026-11-14  

This contract defines the client-side persistence interface implemented by `app/static/js/storage.js`.

---

## 1. Storage Interface Definition

```typescript
export interface StorageService {
  /**
   * Initializes the persistent backend (IndexedDB with fallback cascade).
   * Resolves to true if persistent storage is available, or false if running in ephemeral memory.
   */
  init(): Promise<boolean>;

  /**
   * Loads all conversation sessions with their complete message arrays.
   * Ordered by session.updatedAt descending.
   */
  loadAllSessions(): Promise<ChatSession[]>;

  /**
   * Retrieves the ID of the last active conversation session, or null if none saved.
   */
  getActiveSessionId(): Promise<string | null>;

  /**
   * Saves or updates a session metadata record.
   * @param session The ChatSession to persist (metadata only)
   */
  saveSession(session: ChatSession): Promise<void>;

  /**
   * Saves or updates an individual message turn.
   * @param message The ChatMessage to persist
   */
  saveMessage(message: ChatMessage): Promise<void>;

  /**
   * Deletes a session and all its associated message turns from persistent storage.
   * @param sessionId UUID of session to delete
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Sets the active session ID preference.
   * @param sessionId UUID of the active session
   */
  setActiveSessionId(sessionId: string): Promise<void>;

  /**
   * Wipes all stored sessions, messages, and history.
   */
  clearAll(): Promise<void>;

  /**
   * Returns current storage driver in use: 'indexeddb' | 'localstorage' | 'memory'.
   */
  getDriver(): 'indexeddb' | 'localstorage' | 'memory';
}
```

---

## 2. Markdown Export Interface

```typescript
export interface ExportService {
  /**
   * Converts a ChatSession and its message turns into a clean GitHub-Flavored Markdown document.
   * @param session The ChatSession to format
   * @returns Formatted Markdown string
   */
  formatMarkdown(session: ChatSession): string;

  /**
   * Triggers a browser file download of the conversation as a .md or .json file.
   * @param session The ChatSession to export
   * @param format 'markdown' | 'json'
   */
  exportSession(session: ChatSession, format: 'markdown' | 'json'): void;

  /**
   * Generates a safe filename for downloading based on title and date.
   * @param title Raw session title
   * @param extension 'md' | 'json'
   */
  sanitizeFilename(title: string, extension: 'md' | 'json'): string;
}
```

---

## 3. Reliability & Fallback Guarantees

1. **Non-Throwing Operations**: Storage write errors (e.g. quota limits, blocked permissions) must catch internally and return rejected promises with standardized error objects without crashing callers.
2. **Atomic In-Memory Consistency**: The `ChatStore` updates its in-memory Map *synchronously* before dispatching async storage writes, ensuring zero UI latency or race conditions during rapid user input.
3. **Graceful Degradation**:
   * If `indexedDB.open()` rejects or is blocked, the service switches to `localStorage`.
   * If `localStorage` throws `QuotaExceededError` or is blocked, the service switches to ephemeral in-memory operation and emits a `'storage:warning'` event.
