# Implementation Plan: Chat History Persistence and Markdown Export

**Branch**: `016-chat-history-persistence` | **Date**: 2026-11-14 | **Spec**: [specs/016-chat-history-persistence/spec.md](spec.md)

**Input**: Feature specification from `/specs/016-chat-history-persistence/spec.md`

## Summary

Implement robust client-side conversation persistence and export capabilities for `e-webui`. Introduce a lightweight, zero-dependency IndexedDB storage service with graceful fallback to `localStorage` and in-memory operation. Integrate the storage layer into `ChatStore` with debounced writes to safeguard streaming render performance. Enable client-side export to formatted GitHub-Flavored Markdown (`.md`) and structured JSON (`.json`) with intact code blocks and collapsible reasoning. Add session management actions (rename persistence, session deletion, and "Clear all chats" in Settings).

## Technical Context

**Language/Version**: HTML5, CSS3, Modern JavaScript (ES2022 Modules) with zero build step; Python 3.11+ (FastAPI backend).

**Primary Dependencies**:
- Frontend: Native browser `IndexedDB`, `localStorage`, `Blob`, `URL.createObjectURL`. Zero external npm or CDN dependencies.
- Backend: FastAPI, Uvicorn, Pydantic, HTTPX.

**Storage**:
- Primary Client Storage: `IndexedDB` (`ewebui_db` v1) with object stores for `sessions`, `messages`, and `preferences`.
- Secondary Fallback: `localStorage` (`ewebui_sessions_v1`, `ewebui_active_session_id`).
- Ephemeral Fallback: In-memory `Map` with user notification if client storage is restricted or full.

**Testing**:
- Python `unittest` suite for export formatting validation and feature registry contract checks.
- Browser interactive validation for persistence, reloads, and file downloads (`quickstart.md`).

**Target Platform**: Modern web browsers (Chromium, Firefox, Safari, WebKit) on Desktop, Tablet, and Mobile.

**Performance Goals**:
- Hydration of up to 50 historical sessions and active dialogue in under 200 ms on page load.
- Zero perceptible frame drops during token streaming (storage writes debounced/throttled).
- Client-side Markdown and JSON export generated and triggered in under 1 second.

**Constraints**:
- Strict adherence to Constitution Principle I: Zero container tampering, isolated mock verification.
- 100% offline-capable, client-side data ownership: No chat transcripts sent over the network to third parties or host systems.
- Zero external libraries for database handling: Plain, maintainable ES6 Promise wrapper for IndexedDB.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Infrastructure Isolation (NON-NEGOTIABLE)
- **Status**: PASSED
- **Verification**: Zero `incus` commands, zero container runtime alterations. All modifications reside in static client scripts and unit tests.

### Principle II: Workspace-Only Scope Boundary
- **Status**: PASSED
- **Verification**: All changes are strictly within the repository workspace (`app/static/js/`, `specs/016-chat-history-persistence/`, `tests/`).

### Principle III: Transparent Delegation & Manual Execution Hand-offs
- **Status**: PASSED
- **Verification**: Browser validation procedures are clearly documented in `quickstart.md`.

## Project Structure

### Documentation (this feature)

```text
specs/016-chat-history-persistence/
├── plan.md              # Implementation plan (this file)
├── research.md          # Storage decisions, export formats, performance strategy
├── data-model.md        # ChatSession, ChatMessage, IndexedDB & fallback schema
├── quickstart.md        # Interactive & automated validation scenarios
├── contracts/           # Storage, export, and UI contracts
│   ├── storage-contract.md
│   ├── export-schema.json
│   └── ui-features.json
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
app/
├── static/
│   ├── index.html               # Add export options to menus & clear-all button in Settings
│   ├── style.css                # Danger button styling for clear-all & export dialog layout
│   └── js/
│       ├── app.js               # Async store hydration before initial render
│       ├── db.js                # [NEW] Lightweight Promise-based IndexedDB utility with fallback
│       ├── storage.js           # [NEW] StorageService implementation managing sessions/messages
│       ├── export.js            # [NEW] Client-side Markdown and JSON export formatting & download
│       ├── store.js             # Wire asynchronous persistence and debounced writes into ChatStore
│       ├── features.js          # Enable 'chat.export' and 'session.clear_all' controls
│       └── components/
│           ├── header.js        # Wire Export action in header overflow menu
│           ├── sidebar.js       # Wire Export and Delete actions in session item context menu
│           └── settings.js      # Add Clear All Conversations with confirmation dialog
tests/
└── unit/
    └── test_export_and_storage.py # [NEW] Unit tests for export formatting & contract compliance
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
