---
description: "Task list for Streaming Render Optimization and Offline Code Syntax Polish"
---

# Tasks: Streaming Render Optimization and Offline Code Syntax Polish

**Input**: Design documents from `/specs/017-streaming-render-code-polish/`  
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/code-syntax-contract.md](contracts/code-syntax-contract.md), [contracts/render-pipeline-contract.md](contracts/render-pipeline-contract.md), [quickstart.md](quickstart.md)  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story increment.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `[US1]`, `[US2]`, `[US3]`)
- Every task includes exact file paths in its description.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vendor offline syntax highlighter and setup test verification.

- [X] T001 [P] Vendor lightweight offline Prism.js bundle with core languages (Python, JS, TS, Bash, JSON, YAML, SQL, HTML, CSS, Markdown) in `app/static/vendor/prism.min.js`
- [X] T002 Add `<script src="/static/vendor/prism.min.js"></script>` to `app/static/index.html` head scripts
- [X] T003 [P] Add unit test assertions in `tests/unit/test_markdown_security.py` for Prism syntax highlighting token output and language aliases

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Syntax highlighting engine integration and theme palette CSS tokens.

**⚠️ CRITICAL**: Must complete before user story styling and streaming optimizations begin.

- [X] T004 Implement syntax highlighting integration in `app/static/js/markdown.js` via `marked.Renderer.code`, calling `window.Prism.highlight` for recognized languages while escaping fallback text per `specs/017-streaming-render-code-polish/contracts/code-syntax-contract.md`
- [X] T005 [P] Add theme-aware syntax token styling rules in `app/static/style.css` for both Light and Dark mode (`.token.keyword`, `.token.string`, `.token.function`, `.token.comment`, `.token.number`, `.token.operator`)

**Checkpoint**: Foundation ready - code highlighting engine and styling are functional.

---

## Phase 3: User Story 1 - Zero-Lag Fluid Token Streaming (Priority: P1) 🎯 MVP

**Goal**: Decouple SSE token ingestion from DOM layout using a `requestAnimationFrame` throttled loop (~40ms interval), maintaining a persistent rose cursor and eliminating DOM layout thrashing during fast generation.

**Independent Test**: Stream a lengthy response (800+ tokens) at high speed; verify 60 fps smooth scroll, zero freezing, and continuous blinking cursor.

### Implementation for User Story 1
- [X] T006 [US1] Implement `RenderThrottleState` and `scheduleThrottledRender()` in `app/static/js/components/chat.js` to batch streaming DOM updates to animation frame boundaries (~40ms clamp) per `specs/017-streaming-render-code-polish/contracts/render-pipeline-contract.md`
- [X] T007 [US1] Refactor cursor management in `app/static/js/components/chat.js` to reuse a persistent `.stream-cursor` element, avoiding continuous element recreation on each token
- [X] T008 [US1] Ensure immediate final synchronous render pass upon stream completion (`done: true`, `stopped`, or `error`) in `app/static/js/components/chat.js`

**Checkpoint**: At this point, User Story 1 (MVP) delivers completely fluid, zero-lag streaming rendering.

---

## Phase 4: User Story 2 - Offline Syntax-Highlighted Code Blocks (Priority: P1)

**Goal**: Provide rich, theme-adaptive syntax highlighting on all code fences with language badges, 1-click clipboard copy with checkmark feedback, and horizontal scroll preservation.

**Independent Test**: Prompt the model for code in Python, Bash, and JSON; verify distinct syntax colors, language badge, and 1-click clipboard copy.

### Implementation for User Story 2
- [X] T009 [US2] Update code block chrome in `app/static/js/markdown.js` to include the language badge and sanitized language class (`class="language-{lang}"`)
- [X] T010 [US2] Enhance copy button feedback in `app/static/js/markdown.js` (`attachCodeCopyHandlers`) with checkmark icon transition and 2-second timeout reversion
- [X] T011 [US2] Enforce strict LTR direction (`dir="ltr"` and `unicode-bidi: isolate`) on code containers in `app/static/js/rtl.js` and `app/static/style.css`

**Checkpoint**: User Stories 1 AND 2 are fully functional and testable.

---

## Phase 5: User Story 3 - Visual Polish, Smooth Accordions, and Dark Mode Contrast (Priority: P2)

**Goal**: Enable fluid CSS Grid transitions on reasoning accordions, elevate Dark Mode code block contrast, and style custom subtle scrollbars.

**Independent Test**: Click reasoning chip to verify smooth accordion expansion; toggle dark mode to verify distinct contrast on code containers; inspect thin scrollbars.

### Implementation for User Story 3
- [X] T012 [US3] Refactor reasoning block DOM in `app/static/js/components/chat.js` and CSS in `app/static/style.css` to use CSS Grid (`grid-template-rows: 0fr -> 1fr`) for fluid 0.2s expansion
- [X] T013 [US3] Elevate Dark Mode code container tokens (`--codebg: #151128; --codehead: #1F193C; --line: #352C58;`) in `app/static/style.css` for distinct visual bounding against `--card`
- [X] T014 [US3] Add cross-browser thin scrollbar rules (`scrollbar-width: thin; scrollbar-color: var(--line) transparent;`) in `app/static/style.css`

**Checkpoint**: All user stories are complete, visually polished, and responsive.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Test execution, verification, and code cleanup.

- [X] T015 [P] Run unit test suites `tests/unit/test_markdown_security.py` and `tests/unit/test_export_and_storage.py` and verify all tests pass
- [X] T016 Execute manual verification scenarios documented in `specs/017-streaming-render-code-polish/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
┌──────────────────────────────────────────────┐
│             Phase 1: Setup                   │
│   (Vendor prism.min.js, index.html, tests)   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          Phase 2: Foundational               │
│   (Markdown Prism integration, CSS tokens)   │
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ Phase 3: User Story 1   │ │ Phase 4: User Story 2   │
│ (Zero-Lag Streaming MVP)│ │ (Code Highlight Chrome) │
└──────────────┬──────────┘ └───────────┬─────────────┘
               │                        │
               └───────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │ Phase 5: User Story 3   │
              │ (Transitions & Contrast)│
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │     Phase 6: Polish     │
              │   (Tests & Validation)  │
              └─────────────────────────┘
```

- **Phase 1 (Setup)**: No dependencies - can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 - **BLOCKS all user stories**.
- **Phase 3 (User Story 1)**: Depends on Phase 2 - delivers core zero-lag streaming MVP.
- **Phase 4 (User Story 2)**: Depends on Phase 2 - delivers code syntax highlighting & copy feedback.
- **Phase 5 (User Story 3)**: Depends on Phase 3 and Phase 4.
- **Phase 6 (Polish)**: Depends on all user stories being complete.

---

## Parallel Opportunities

- **Setup Phase**: T001 (`prism.min.js`) and T003 (`test_markdown_security.py`) can run in parallel.
- **Foundational Phase**: T004 (`markdown.js`) and T005 (`style.css` syntax tokens) can run in parallel.
- **User Stories 1 & 2**: Once Phase 2 completes, T006–T008 (`chat.js` RAF throttling) and T009–T011 (`markdown.js` code chrome) touch separate files/sections and can proceed in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup: vendor Prism script).
2. Complete Phase 2 (Foundational: integrate Prism into Markdown parser).
3. Complete Phase 3 (User Story 1: implement RAF throttling in `chat.js`).
4. **STOP and VALIDATE**: Stream a long response to confirm fluid 60 fps rendering and zero CPU freeze.

### Incremental Delivery
1. **Increment 1 (MVP)**: Zero-lag streaming with RAF-throttled DOM updates (US1).
2. **Increment 2**: Offline syntax highlighting on code blocks with copy confirmation (US2).
3. **Increment 3**: Smooth reasoning accordion animation, elevated dark mode contrast, custom scrollbars (US3).
4. **Increment 4**: Full test suite validation and quickstart check (Polish).
