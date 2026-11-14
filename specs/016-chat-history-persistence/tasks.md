---
description: "Task list for Chat History Persistence and Markdown Export implementation"
---

# Tasks: Chat History Persistence and Markdown Export

**Input**: Design documents from `/specs/016-chat-history-persistence/`  
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/storage-contract.md](contracts/storage-contract.md), [contracts/ui-features.json](contracts/ui-features.json), [contracts/export-schema.json](contracts/export-schema.json), [quickstart.md](quickstart.md)  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story increment.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes exact file paths in its description.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize feature registry controls and test infrastructure.

- [X] T001 Register `chat.export` and `session.clear_all` as enabled controls in `app/static/js/features.js` per `specs/016-chat-history-persistence/contracts/ui-features.json`
- [X] T002 [P] Create initial test suite skeleton for storage and export validation in `tests/unit/test_export_and_storage.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core client storage engine and database lifecycle that MUST be complete before user stories can run.

**⚠️ CRITICAL**: No user story work can begin until this foundational storage layer is complete.

- [X] T003 [P] Implement Promise-based IndexedDB utility wrapper `app/static/js/db.js` supporting database opening (`ewebui_db` v1), stores creation (`sessions`, `messages`, `preferences`), and CRUD operations (`get`, `set`, `del`, `getAll`, `clear`)
- [X] T004 Implement `StorageService` in `app/static/js/storage.js` implementing the contract in `specs/016-chat-history-persistence/contracts/storage-contract.md` with fallback cascade (IndexedDB -> LocalStorage -> Memory) and storage quota protection
- [X] T005 Update `app/static/js/app.js` to asynchronously initialize `storage.js` and hydrate `store` before mounting UI components

**Checkpoint**: Foundation ready - client database and storage service are available for user stories.

---

## Phase 3: User Story 1 - Seamless Conversation Persistence Across Browser Sessions (Priority: P1) 🎯 MVP

**Goal**: Automatically persist all conversation sessions, message turns, reasoning traces, timestamps, and active session selection on the client device, restoring the full dialogue state across page reloads in under 200 ms.

**Independent Test**: Start a conversation, send prompts, wait for completion, reload the browser tab, and verify that the active session and all historical message turns and reasoning blocks are restored without loss.

### Tests for User Story 1
- [X] T006 [P] [US1] Add unit tests in `tests/unit/test_export_and_storage.py` validating `ChatSession` and `ChatMessage` entity serialization, 1–120 character title bounds, UUID formats, and role constraints per `specs/016-chat-history-persistence/data-model.md`

### Implementation for User Story 1
- [X] T007 [US1] Refactor `app/static/js/store.js` to integrate `storage.js`: persist session creation immediately, hydrate cached sessions on boot, and implement debounced asynchronous flushes for in-flight messages
- [X] T008 [US1] Update `app/static/js/components/composer.js` to ensure completed, stopped, and retry turns immediately commit to `storage.js` upon stream finalization
- [X] T009 [US1] Update `app/static/js/components/sidebar.js` to render hydrated sessions immediately on boot, maintaining date group buckets (Today, Yesterday, Previous 7 days, Older)

**Checkpoint**: At this point, User Story 1 (MVP) is fully functional and independently testable across browser refreshes.

---

## Phase 4: User Story 2 - Export Conversation to Formatted Markdown and Structured Data (Priority: P1)

**Goal**: Provide one-click export of any conversation as a formatted GitHub-Flavored Markdown file (`.md`) or structured JSON file (`.json`) with sanitized filenames, model attribution, code blocks, and collapsible reasoning.

**Independent Test**: Open any multi-turn conversation, click "Export" in the header or sidebar menu, select Markdown or JSON, and verify that the downloaded file contains the full dialogue structure.

### Tests for User Story 2
- [X] T010 [P] [US2] Add unit tests in `tests/unit/test_export_and_storage.py` validating Markdown serialization format (frontmatter headers, `### User`/`### Assistant`, `<details>` reasoning, code fences) and JSON export schema compliance against `specs/016-chat-history-persistence/contracts/export-schema.json`

### Implementation for User Story 2
- [X] T011 [US2] Implement client-side export utility `app/static/js/export.js` with `formatMarkdown()`, `sanitizeFilename()`, and native browser download triggers using `Blob` and `URL.createObjectURL`
- [X] T012 [US2] Update `app/static/js/components/header.js` to wire the "Export chat" action in the header overflow menu with format selection options (Markdown `.md` and JSON `.json`)
- [X] T013 [US2] Update `app/static/js/components/sidebar.js` to wire an "Export" action item in the session context menu of the sidebar list

**Checkpoint**: User Stories 1 AND 2 are both fully functional and testable.

---

## Phase 5: User Story 3 - Session Renaming, Deletion, and Workspace Reset (Priority: P2)

**Goal**: Enable organizing conversations via immediate rename persistence, single-session deletion with cascading message cleanup, and a safe "Clear all chats" workspace reset in Settings with confirmation.

**Independent Test**: Rename a session title and confirm persistence after reload; delete a single session and confirm removal from storage; click "Clear all conversations" in Settings and confirm complete storage reset.

### Implementation for User Story 3
- [X] T014 [US3] Update `app/static/js/store.js` and `app/static/js/storage.js` to support `deleteSession()` with cascading deletion of all associated turns in the `messages` store
- [X] T015 [US3] Update `app/static/js/components/settings.js` and `app/static/index.html` to add a "Clear all conversations" danger button under the General tab with an accessible confirmation dialog
- [X] T016 [US3] Add styling rules in `app/static/style.css` for the "Clear all conversations" danger action and export format popover menu

**Checkpoint**: User Stories 1, 2, and 3 are functional and can be tested together.

---

## Phase 6: User Story 4 - Storage Resilience, Privacy, and Boundary Handling (Priority: P3)

**Goal**: Handle storage quota limits, private/incognito browsing restrictions, and data corruption gracefully without crashing the UI, maintaining 100% client-side privacy.

**Independent Test**: Simulate storage quota failure or restricted storage access; verify a toast notification displays and the application continues working seamlessly in session-only mode.

### Implementation for User Story 4
- [X] T017 [US4] Implement storage quota detection and corruption recovery in `app/static/js/storage.js`, dispatching `'storage:warning'` events when quotas or restrictions are hit
- [X] T018 [US4] Update `app/static/js/components/chat.js` and `app/static/js/components/composer.js` to display a toast notification on `'storage:warning'` while keeping messaging fully functional in memory

**Checkpoint**: All user stories are complete, resilient, and verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Code cleanup, test execution, and validation against specification criteria.

- [X] T019 Remove obsolete monolithic legacy file `app/static/app.js` from the repository
- [X] T020 [P] Run unit test suite `tests/unit/test_export_and_storage.py` and verify all contract tests pass
- [X] T021 Execute manual verification scenarios documented in `specs/016-chat-history-persistence/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
┌──────────────────────────────────────────────┐
│             Phase 1: Setup                   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          Phase 2: Foundational               │
│   (IndexedDB, StorageService, App Boot)      │
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ Phase 3: User Story 1   │ │ Phase 4: User Story 2   │
│ (Chat Persistence, MVP) │ │ (Markdown/JSON Export)  │
└──────────────┬──────────┘ └───────────┬─────────────┘
               │                        │
               └───────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │ Phase 5: User Story 3   │
              │ (Rename, Delete, Clear) │
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │ Phase 6: User Story 4   │
              │ (Resilience & Quota)    │
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │     Phase 7: Polish     │
              │ (Cleanup, Tests, QA)    │
              └─────────────────────────┘
```

- **Phase 1 (Setup)**: No dependencies - can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 - **BLOCKS all user stories**.
- **Phase 3 (User Story 1)**: Depends on Phase 2 - delivers core persistence MVP.
- **Phase 4 (User Story 2)**: Depends on Phase 2 - can proceed in parallel with or after US1.
- **Phase 5 (User Story 3)**: Depends on US1 completion (extends session deletion and management).
- **Phase 6 (User Story 4)**: Depends on storage layer implementation (adds quota protection and degradation).
- **Phase 7 (Polish)**: Depends on all user stories being complete.

---

## Parallel Opportunities

- **Setup Phase**: T001 and T002 can run in parallel.
- **Foundational Phase**: T003 (`db.js`) can be developed in parallel with test authoring.
- **User Story 1 & 2**: Once Phase 2 is complete, User Story 1 (Persistence) and User Story 2 (Export utility) touch separate files (`export.js` vs `store.js`) and can be implemented in parallel.
- **Testing**: T006, T010, and T020 can run independently.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational storage layer).
2. Complete Phase 3 (User Story 1: `store.js` persistence + reload restoration).
3. **STOP and VALIDATE**: Open the browser, chat with a model, refresh the page, and verify the conversation is restored.

### Incremental Delivery
1. **Increment 1 (MVP)**: Persistent conversations across reloads (US1).
2. **Increment 2**: Markdown & JSON export from header and sidebar (US2).
3. **Increment 3**: Renaming persistence, deletion, and "Clear all chats" (US3).
4. **Increment 4**: Storage quota guard and graceful fallback (US4).
5. **Increment 5**: Dead code cleanup and full test verification (Polish).
