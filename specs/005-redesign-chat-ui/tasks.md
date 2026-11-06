---
description: "Task list for feature implementation: Chat UI Redesign & Thinking Toggle"
---

# Tasks: Chat UI Redesign & Thinking Toggle with Pastel Developer Aesthetic

**Input**: Design documents from `/specs/005-redesign-chat-ui/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-and-api-contract.md`, `quickstart.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes the exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing environment and baseline assets

- [X] T001 Inspect existing frontend assets (`app/static/index.html`, `app/static/style.css`, `app/static/app.js`) and backend schema in `app/models.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core design tokens and backend contract schemas that MUST be complete before user stories

**⚠️ CRITICAL**: Foundational tasks establish design tokens and API contracts needed by user stories

- [X] T002 Define core pastel CSS custom properties in `app/static/style.css` (`--bg-app: #EBF3FA`, `--bg-card: #FFFFFF`, `--logo-prompt: #BA4659`, `--logo-text: #7A5EA7`, `--user-bubble-bg: #7A5EA7`, `--text-primary: #1E293B`, and subtle border tokens)
- [X] T003 Update `PromptRequest` schema in `app/models.py` to add optional `thinking: bool = Field(default=True, description="Whether to include thinking tokens")`
- [X] T004 Update `OllamaClient.stream_generate` in `app/services/ollama_client.py` to pass `"think": False` (or appropriate reasoning option) to Ollama API when `req.thinking is False` and suppress thinking chunks

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - Pastel Developer UI & Modern Aesthetic Redesign (Priority: P1) 🎯 MVP

**Goal**: Deliver a beautiful, distraction-free chat interface with soft pastel styling, crisp message bubbles, rounded cards, clean typography, and styled markdown code blocks.

**Independent Test**: Load `http://127.0.0.1:8080/` in a browser. Verify the soft pastel blue background, styled welcome card with quick-prompt pills, clean message bubbles, and code copy button.

### Implementation for User Story 1

- [X] T005 [P] [US1] Redesign semantic layout and welcome empty state card with quick-prompt pills in `app/static/index.html`
- [X] T006 [P] [US1] Implement pastel styles for chat container, user/assistant message bubbles, code blocks, copy button, and floating prompt composer in `app/static/style.css`
- [X] T007 [US1] Update chat DOM creation, markdown rendering, and auto-scrolling logic in `app/static/app.js` to support new pastel message containers and quick prompt actions

**Checkpoint**: User Story 1 complete. Chat interface has full pastel aesthetic and functions as a complete MVP.

---

## Phase 4: User Story 2 - Blinking Terminal Logo Implementation (Priority: P1)

**Goal**: Display the authentic developer brand logo `> ~/.E_` with exact colors, baseline alignment, and a steady non-shifting blinking underscore cursor.

**Independent Test**: View the top navigation header. Verify `>` is muted red/burgundy (`#BA4659`), `~/.E` is pastel purple/violet (`#7A5EA7`), and `_` pulses/blinks seamlessly at ~1s intervals without vertical or horizontal layout shifts.

### Implementation for User Story 2

- [X] T008 [P] [US2] Update brand logo markup to `<span class="brand-logo" role="img" aria-label="e-webui" dir="ltr"><span class="logo-prompt">&gt;</span><span class="logo-text">~/.E</span><span class="logo-cursor" aria-hidden="true">_</span></span>` in `app/static/index.html`
- [X] T009 [US2] Implement geometric monospace font styling, baseline alignment, and `@keyframes logo-cursor-blink` with `prefers-reduced-motion` support in `app/static/style.css`

**Checkpoint**: User Stories 1 and 2 are complete. Logo accurately reflects the developer brand aesthetic.

---

## Phase 5: User Story 3 - Thinking Mode Toggle (Priority: P2)

**Goal**: Provide a header toolbar control allowing users to toggle Thinking Mode on or off, suppressing reasoning generation and hiding thought accordions when disabled.

**Independent Test**: Toggle Thinking Mode in the header. Submit a prompt to a reasoning model. Verify thinking accordion is visible when ON and omitted/hidden when OFF, persisting the toggle state across page reloads.

### Implementation for User Story 3

- [X] T010 [P] [US3] Add Thinking Mode toggle button (`#thinking-btn`) with icon and badge to the header controls in `app/static/index.html`
- [X] T011 [P] [US3] Style Thinking Mode toggle button (active/inactive states) and pastel `<details class="thinking-container">` accordion in `app/static/style.css`
- [X] T012 [US3] Implement Thinking Mode state management, `localStorage` (`ewebui_settings.thinking`) persistence, request payload generation (`thinking: boolean`), and SSE chunk rendering logic in `app/static/app.js`

**Checkpoint**: User Story 3 complete. Users can toggle thinking traces on or off on demand.

---

## Phase 6: User Story 4 - Theme Adaptation / Palette Controls (Priority: P3)

**Goal**: Allow users to switch between Light Pastel Blue and Dark Pastel Navy palettes, persisting preference in `localStorage`.

**Independent Test**: Click theme toggle button in header. Verify colors transition instantly to Dark Pastel Navy (`#191F2D`) and persist after browser reload.

### Implementation for User Story 4

- [X] T013 [P] [US4] Add Theme switcher button (`#theme-btn`) with Sun/Moon icons to the header controls in `app/static/index.html`
- [X] T014 [P] [US4] Define `[data-theme="dark"]` CSS variables and component color overrides in `app/static/style.css`
- [X] T015 [US4] Implement theme toggle event handler and `localStorage` (`ewebui_settings.theme`) synchronization on page load in `app/static/app.js`

**Checkpoint**: User Story 4 complete. Full dual-theme pastel support active.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Responsive validation, accessibility compliance, and final end-to-end verification

- [X] T016 [P] Add responsive media queries (<640px and <480px) for compact header layout, toolbar wrapping, and touch-friendly targets in `app/static/style.css`
- [X] T017 Execute manual verification scenarios according to `specs/005-redesign-chat-ui/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Completed
- **Foundational (Phase 2)**: Completed
- **User Story 1 (Phase 3 - P1)**: Completed
- **User Story 2 (Phase 4 - P1)**: Completed
- **User Story 3 (Phase 5 - P2)**: Completed
- **User Story 4 (Phase 6 - P3)**: Completed
- **Polish (Phase 7)**: Completed

### Status: 100% COMPLETE (17/17 tasks completed)
