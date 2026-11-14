# Research & Technical Decisions: Chat History Persistence and Markdown Export

**Feature**: `016-chat-history-persistence`  
**Date**: 2026-11-14  
**Status**: Completed  

---

## 1. Client Storage Architecture: IndexedDB with Fallback

### Problem Statement
The current `ChatStore` maintains all sessions and messages in a transient `Map()` in browser RAM. Any page refresh wipes conversational memory. We need persistent, client-side storage capable of holding dozens of sessions containing multi-turn conversations with code blocks, reasoning traces, and metrics, while strictly observing the offline, zero-external-dependency constraints of `e-webui`.

### Alternatives Considered
1. **`localStorage` Only**:
   * *Pros*: Simple synchronous key-value API (`localStorage.getItem`, `setItem`).
   * *Cons*: Strict ~5 MB quota per origin; synchronous serialization (`JSON.stringify`/`parse`) blocks the main JavaScript thread, causing frame drops during large writes or active streaming; strings only.
2. **Server-Side SQLite / File Storage**:
   * *Pros*: Infinite storage on container disk.
   * *Cons*: Requires server authentication, user sessions, synchronization endpoints, and backend state migrations. Violates the client-owned privacy model where conversations belong to the browser client.
3. **Pure `IndexedDB` with Asynchronous Transaction Queue (Chosen)**:
   * *Pros*: Ample quota (hundreds of megabytes), structured cloning (no full-string re-serialization overhead), asynchronous non-blocking I/O, transactional integrity, supported in all modern browsers.
   * *Cons*: Native IDB API is event/callback-heavy (`indexedDB.open`, `IDBRequest`).

### Decision & Rationale
We implement a lightweight, zero-dependency, Promise-based IndexedDB utility (`db.js`) encapsulating the database lifecycle into clean async operations: `get(store, key)`, `set(store, key, val)`, `del(store, key)`, `getAll(store)`, and `clear(store)`.

To ensure 100% resilience against private browsing restrictions (where `indexedDB` can throw `SecurityError`), the storage layer implements a graceful degradation cascade:
`IndexedDB` $\rightarrow$ `localStorage` $\rightarrow$ In-Memory RAM.

### Schema & Object Stores
* Database Name: `ewebui_db`
* Database Version: `1`
* Stores:
  1. `sessions`: Keyed by `id`. Holds metadata: `{ id, title, createdAt, updatedAt, model }`.
  2. `messages`: Keyed by `id`, with an index on `sessionId`. Holds message turns: `{ id, sessionId, role, content, reasoning, status, metrics, createdAt }`.
  3. `preferences`: Keyed by preference key. Stores active session ID and UI state.

---

## 2. Storage Write Strategy & Performance Protection

### Problem Statement
During token streaming, the application receives up to 60+ tokens/sec. Writing to storage on every token would cause unnecessary I/O thrashing and degrade rendering velocity.

### Decision & Rationale
* **In-Memory Cache + Asynchronous Flush**:
  * `ChatStore` retains an in-memory `Map` as the authoritative, synchronous source of truth for UI components and event dispatching.
  * Writes to persistent storage are buffered and decoupled:
    * **Session Metadata**: Persisted immediately upon creation, rename, or model switch.
    * **Completed Turns**: Persisted immediately when `status` transitions to `'completed'`, `'stopped'`, or `'error'`.
    * **In-Flight Streaming**: Only persisted periodically via a 2-second throttle or upon `pagehide`/`beforeunload`, preventing I/O lock during fast token generation.

---

## 3. Markdown & JSON Export Engine

### Problem Statement
Users need to export conversations for archiving and external note-taking tools. The export must be self-contained, completely client-side, and format code and reasoning appropriately.

### Format Specifications

#### Markdown (`.md`)
* **Header / Frontmatter**:
  ```markdown
  # [Conversation Title]
  
  - **Date**: YYYY-MM-DD HH:MM
  - **Model**: [model name]
  - **Exported from**: e-webui
  
  ---
  ```
* **Message Roles**:
  * User turns formatted with `### User`
  * Assistant turns formatted with `### Assistant`
* **Reasoning Blocks**:
  * Rendered as standard Markdown collapsible blocks:
    ```markdown
    <details>
    <summary>Reasoning</summary>

    [thinking content]

    </details>
    ```
* **Code Blocks**: Preserved in raw fenced form (```` ```language ````).
* **Generation Metrics**: Footnote or subtext with duration and speed: `*Generated in 4.2s (28.4 tok/s)*`.

#### JSON (`.json`)
* Full serialized JSON object compliant with `specs/016-chat-history-persistence/contracts/export-schema.json`, including complete session details, message arrays, timestamps, and metrics.

### Download Trigger Mechanism
* Pure client-side download:
  ```javascript
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizedFilename;
  a.click();
  URL.revokeObjectURL(url);
  ```
* Filename sanitization removes non-alphanumeric/unsafe characters (`/[^\w\s\-\.]/g`) and appends the ISO date (e.g. `python-debugging-2026-11-14.md`).

---

## 4. UI Integration & Feature Registry

### Decision
1. **Enable Feature in Registry**:
   In `app/static/js/features.js`, switch `chat.export` to:
   ```javascript
   'chat.export': { status: 'enabled' }
   ```
2. **Export Entry Points**:
   * Header overflow menu (`btn-header-overflow`): "Export chat" option opening an export dialog or dropdown with options "Markdown (.md)" and "JSON (.json)".
   * Sidebar session menu: Add "Export" action alongside "Rename" and "Delete".
3. **Settings General Tab**:
   * Add a "Data Management" section in `tab-general` with a "Clear all conversations" button styled with `--danger` and an accessible confirmation modal.
