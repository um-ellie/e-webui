# Tasks: Chat Connection Fix and Composer Refinements

**Input**: Design documents from `/specs/013-chat-connection-refinements/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- All descriptions include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish simulated streaming test harness and verification tools.

- [X] T001 [P] Create automated streaming regression test harness in `tests/unit/test_stream_pipeline.py` verifying simulated streaming chunks: normal answer, reasoning `<think>` extraction, reasoning-only response, empty response, slow initial token, and mid-stream error
- [X] T002 [P] Update UI feature registry tests in `tests/unit/test_ui_contracts.py` to assert contracts in `specs/013-chat-connection-refinements/contracts/ui-features.json` including `chat.mic_input` and `chat.manage_models`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend contract updates and registry alignments that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Update Pydantic data schemas in `app/models.py` adding `history: List[Dict[str, str]] = Field(default_factory=list)` to `PromptRequest` and adding `status: Optional[str] = None` to `StreamChunk`
- [X] T004 [P] Update `app/services/ollama_client.py` to parse `<think>...</think>` tags from Ollama response tokens, separate reasoning from response text, and yield clean `StreamChunk` items
- [X] T005 [P] Add request lifecycle logging in `app/main.py` recording request id, model name, initial token timestamp, total duration, and error category without logging prompt content or secrets
- [X] T006 [P] Update centralized feature registry in `app/static/js/features.js` registering `chat.mic_input` (`"status": "disabled"`, `"reason": "Voice input is not available yet"`) and `chat.manage_models` (`"status": "disabled"`, `"reason": "Manage models is not available yet"`)
- [X] T007 [P] Update `app/static/js/store.js` ensuring `getActiveSession().model` defaults to `localStorage.getItem('ewebui_last_model')` or first loaded model, and implement `getHistory(sessionId)` returning chronological dialogue turns

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - See the Model's Answer in the Chat (Priority: P1) 🎯 MVP

**Goal**: Deliver reliable end-to-end token streaming with visible "Loading model…" status, animated rose terminal cursor, proper reasoning chip extraction, explicit error cards with Retry action, and multi-turn context preservation.

**Independent Test**: Submit a prompt; verify that within 100 ms the assistant turn appears, displays "Loading model…" if slow, streams tokens smoothly in Source Serif 4, extracts reasoning tokens into the thought chip, preserves multi-turn context on subsequent turns, and renders an error card with Retry on failure.

### Implementation for User Story 1

- [X] T008 [US1] Update `app/static/js/api.js` to transmit `history` array from `ChatStore` and robustly parse SSE `data:` payloads across split UTF-8 chunks
- [X] T009 [US1] Update `app/static/js/markdown.js` to safely handle `<think>` tags and ensure reasoning content is parsed cleanly without being discarded by DOMPurify
- [X] T010 [US1] Update `ChatView` in `app/static/js/components/chat.js` to dynamically create and update reasoning blocks during streaming and show "The model returned only reasoning" if no body text exists
- [X] T011 [US1] Implement "Loading model…" timer and active blinking rose cursor in `app/static/js/components/chat.js` when waiting for initial token
- [X] T012 [US1] Implement structured in-chat error card in `app/static/js/components/chat.js` displaying failure class, collapsible Details accordion, and a working **Retry** button
- [X] T013 [US1] Update `Composer` in `app/static/js/components/composer.js` to dispatch multi-turn history via `api.streamGenerate()` and support Retry re-submission

**Checkpoint**: User Story 1 is fully functional and delivers an independently testable MVP.

---

## Phase 4: User Story 2 - Choose the Model Inside the Message Box (Priority: P1)

**Goal**: Relocate the model selector from the top header into the bottom-right corner of the composer card as a pill with an upward popover menu matching `design/reference/chat-mock-v2.html`.

**Independent Test**: Verify the header no longer has a model dropdown; click the composer model pill, navigate models using Arrow keys and Enter, filter with search when >8 models, and select a model that persists in `localStorage`.

### Implementation for User Story 2

- [X] T014 [P] [US2] Remove model dropdown from top header in `app/static/index.html` and update `app/static/js/components/header.js`
- [X] T015 [P] [US2] Add model picker markup (`.mw`, `.mp`, `.pop`) to composer bottom row in `app/static/index.html` matching `design/reference/chat-mock-v2.html`
- [X] T016 [P] [US2] Implement model picker styling in `app/static/style.css` for the pill (`.mp`), dual-tone gradient glyph (`.mg`), upward popover menu (`.pop`), badges (`.tag`, `.mt`), and search input
- [X] T017 [US2] Implement `ModelPicker` controller in `app/static/js/components/composer.js` managing model list rendering, Reasoning/Loaded badges, checkmark selection, instant search filtering, and persistence in `localStorage`
- [X] T018 [US2] Implement keyboard navigation for model picker in `app/static/js/components/composer.js` (`Enter`/`Space` opens, `ArrowUp`/`ArrowDown` navigates, `Enter` selects, `Esc` closes) with listbox accessibility attributes
- [X] T019 [US2] Add fallback toast in `app/static/js/components/composer.js` when remembered model is missing from backend

**Checkpoint**: Model picker is fully integrated into the composer card.

---

## Phase 5: User Story 3 - Send with an Enter-Style Button, and See the Microphone (Priority: P1)

**Goal**: Update the primary send button to the Enter key return symbol (↵) and add a disabled microphone button (`.mic`) adjacent to Send per `design/reference/chat-mock-v2.html`.

**Independent Test**: Inspect the composer action bar; verify the send button contains the down-left return arrow icon (↵), disables when input is empty, and verify the microphone button displays a disabled tooltip without throwing errors.

### Implementation for User Story 3

- [X] T020 [P] [US3] Update send button icon in `app/static/index.html` to Enter return symbol (`<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="M9 10l-5 5 5 5"/>`) with title "Send (Enter)"
- [X] T021 [P] [US3] Add microphone button markup (`.mic`) to composer bottom row in `app/static/index.html` immediately to the left of Send
- [X] T022 [P] [US3] Implement microphone button styling in `app/static/style.css` (38 px round, outlined, disabled opacity, not-allowed cursor)
- [X] T023 [US3] Wire microphone button to `features.js` (`chat.mic_input`) with tooltip "Voice input is not available yet" in `app/static/js/components/composer.js`
- [X] T024 [US3] Ensure send button is visibly disabled when textarea is empty and transforms to Stop button during active streaming in `app/static/js/components/composer.js`

**Checkpoint**: Composer action controls match the approved layout and design.

---

## Phase 6: User Story 4 - Close and Open the Sidebar Without Breaking the Page (Priority: P1)

**Goal**: Ensure toggling the sidebar open or closed maintains layout integrity on desktop, tablet, and mobile viewports with zero horizontal scroll, zero content jump, and uninterrupted streaming.

**Independent Test**: Toggle the sidebar 50 times across viewport sizes (desktop ≥1024 px, tablet 640–1023 px, mobile <640 px); verify reading column and composer stay centered with zero horizontal window scrollbars.

### Implementation for User Story 4

- [X] T025 [P] [US4] Update sidebar collapsed styles in `app/static/style.css` to render the compact brand mark (`>E_`) instead of the full wordmark, eliminating rail overflow
- [X] T026 [P] [US4] Refine `.main-stage` layout styling in `app/static/style.css` using `flex: 1 1 auto; min-width: 0;` ensuring smooth width redistribution without window-level scrollbars
- [X] T027 [US4] Update `Sidebar` component in `app/static/js/components/sidebar.js` ensuring collapse state transitions do not interrupt active streaming or scroll position
- [X] T028 [US4] Ensure mobile drawer overlay and backdrop dismissals operate smoothly without displacing reading column alignment in `app/static/js/components/sidebar.js`

**Checkpoint**: Sidebar toggle is rock solid on all screen widths.

---

## Phase 7: User Story 5 - Remove the Suggestion Chips (Priority: P2)

**Goal**: Completely purge all suggestion chip markup, styles, scripts, and translation strings from the codebase.

**Independent Test**: Open an empty chat screen; verify only the brand mark, greeting, and composer appear. Execute repository search to verify zero references to suggestion chips remain.

### Implementation for User Story 5

- [X] T029 [P] [US5] Remove suggestion chips container markup from `app/static/index.html`
- [X] T030 [P] [US5] Remove `.suggestion-chips-grid` and `.suggestion-chip` CSS rules from `app/static/style.css`
- [X] T031 [P] [US5] Remove chip generation logic and prompt arrays from `app/static/js/components/empty.js`
- [X] T032 [P] [US5] Remove suggestion chip keys from i18n dictionaries in `app/static/js/i18n.js`
- [X] T033 [US5] Execute repository-wide search confirming zero occurrences of suggestion chips remain in `app/` and `tests/`

**Checkpoint**: Empty state is simplified and all dead code is eliminated.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: System-wide verification, accessibility audits, and regression tests.

- [X] T034 [P] Update translation strings in `app/static/js/i18n.js` adding new keys for model picker, mic tooltip, loading status, and retry errors
- [X] T035 [P] Audit all updated controls for WCAG 2.2 AA contrast, 44 px touch targets, and `prefers-reduced-motion` compliance
- [X] T036 Run automated unit and stream pipeline test suite (`python3 -m unittest discover tests/unit`) confirming 100% pass rate
- [X] T037 Execute full quickstart validation scenarios documented in `specs/013-chat-connection-refinements/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──► Phase 2: Foundational ──► Phase 3: US1 (MVP) ──► Phase 4: US2 ──► Phase 5: US3 ──► Phase 6: US4
                                         │                                                                      │
                                         └──► Phase 7: US5 ────────────────────────────────────────────────────┘
                                                                                                               │
                                                                                                               ▼
                                                                                                      Phase 8: Polish
```

- **Setup (Phase 1)**: Can begin immediately; establishes test harness.
- **Foundational (Phase 2)**: Depends on Phase 1; blocks all user stories.
- **User Stories (Phases 3–7)**: Depend on Phase 2 completion.
  - Phase 3 (US1 - Model replies) is the core MVP.
  - Phases 4 & 5 (US2 & US3 - Composer refinements) can proceed in parallel once Phase 3 models are wired.
  - Phase 6 (US4 - Sidebar toggle) operates on sidebar layout.
  - Phase 7 (US5 - Suggestion chips removal) can run independently.
- **Polish (Phase 8)**: Depends on completion of all stories.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1 - Model Replies).
3. **Validate MVP**: Test prompt dispatch with simulated and live Ollama, verifying visible streaming text, thinking blocks, and error recovery cards.
4. Deliver working chat functionality.

### Incremental Delivery

1. Deliver MVP (working replies in chat).
2. Deliver Composer Refinements (Model picker popover + Enter send + mic).
3. Deliver Sidebar Fix (smooth collapse without layout breaks).
4. Deliver Empty State Cleanup (suggestion chips completely removed).
5. Final polish and automated regression test pass.
