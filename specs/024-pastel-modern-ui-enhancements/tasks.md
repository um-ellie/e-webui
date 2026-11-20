# Tasks: Pastel Design System and Modern UI/UX Overhaul

**Input**: Design documents from `specs/024-pastel-modern-ui-enhancements/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-contracts.md`, `quickstart.md`

## Format: `[ID] [P?] [Story?] Description with file path`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User Story label (`[US1]`, `[US2]`, `[US3]`) for story-specific phases

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared asset definitions and test harness preparation.

- [X] T001 Create UI contract and token verification test file in tests/test_ui_contracts.py
- [X] T002 [P] Update SVG symbol registry in app/static/index.html with checkmark, pin, retry, and sound-wave icons

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core CSS token variables and storage structures required across all stories.

**⚠️ CRITICAL**: Must complete before user story phases begin.

- [X] T003 Define foundational token architecture and semantic custom properties matrix in app/static/style.css
- [X] T004 [P] Update pre-first-paint synchronous script in head tag of app/static/index.html to read ewebui_palette and set dataset.palette
- [X] T005 [P] Extend IndexedDB schema and session persistence in app/static/js/db.js to support pinned boolean flag

**Checkpoint**: Core tokens and pre-paint hooks initialized.

---

## Phase 3: User Story 1 - Multi-Palette Pastel Aesthetics & Live Theme Switcher (Priority: P1) 🎯 MVP

**Goal**: Deliver 4 curated pastel themes (`matcha`, `lavender`, `peach`, `ocean`) across Light and Dark modes with instant live switching and zero FOUT.

**Independent Test**: Can be verified by switching themes in Settings or header, confirming immediate visual transition across all surfaces with WCAG AA compliance (text contrast ≥ 4.5:1), and zero flash on page reload.

### Implementation for User Story 1

- [X] T006 [P] [US1] Implement complete CSS token rules for all 4 pastel palettes across light and dark modes in app/static/style.css
- [X] T007 [US1] Extend ThemeManager in app/static/js/theme.js with setPalette method, localStorage persistence, and change notification
- [X] T008 [P] [US1] Add pastel palette selector segmented control with preview color pills in app/static/index.html
- [X] T009 [US1] Wire palette selector event handlers and active state bindings in app/static/js/app.js
- [X] T010 [US1] Add automated contract assertions for 4-palette tokens and contrast validation in tests/test_ui_contracts.py

**Checkpoint**: User Story 1 (MVP) fully testable and operational.

---

## Phase 4: User Story 2 - Modern Frosted Glassmorphism & Refined Micro-Interactions (Priority: P2)

**Goal**: Deliver tactile frosted glass surfaces (`backdrop-filter: blur(16px)`), ambient pastel glow elevations, and responsive spring micro-animations.

**Independent Test**: Can be verified by scrolling conversation messages beneath floating headers and composer to inspect translucent blurring, hovering over interactive buttons to observe spring scaling, and verifying reduced-motion compliance.

### Implementation for User Story 2

- [X] T011 [P] [US2] Implement frosted glassmorphism styles with backdrop-filter blur and solid fallbacks for header and composer in app/static/style.css
- [X] T012 [P] [US2] Implement diffuse ambient pastel glow shadows and organic 14px-24px container radiuses in app/static/style.css
- [X] T013 [US2] Implement spring micro-interactions for buttons, active focus rings, and prefers-reduced-motion overrides in app/static/style.css
- [X] T014 [US2] Add automated static assertions for glassmorphism fallbacks and animation curves in tests/test_ui_contracts.py

**Checkpoint**: User Stories 1 AND 2 functional with rich visual depth.

---

## Phase 5: User Story 3 - Practical Chat Productivity & Editorial Canvas (Priority: P3)

**Goal**: Implement message hover action dock (Copy, Kokoro TTS, Edit, Retry), empty canvas pastel starter cards, collapsible reasoning drawer, and sidebar pinned chats.

**Independent Test**: Can be verified by clicking starter cards to inject prompt text into composer, hovering over assistant messages to copy text or trigger audio speech, collapsing/expanding the thinking drawer, and pinning/unpinning chats in the sidebar.

### Implementation for User Story 3

- [X] T015 [P] [US3] Add 4 editorial pastel starter prompt cards to empty canvas markup in app/static/index.html
- [X] T016 [P] [US3] Implement responsive styles and pastel category badges for starter cards in app/static/style.css
- [X] T017 [US3] Wire click handlers for starter prompt chips to populate composer and auto-focus in app/static/js/app.js
- [X] T018 [P] [US3] Implement message hover action dock markup and floating dock styling in app/static/style.css
- [X] T019 [US3] Wire message dock actions (one-click copy with morphing checkmark, Kokoro TTS audio playback, user edit, assistant retry) in app/static/js/app.js
- [X] T020 [P] [US3] Implement collapsible thinking process card with animated pastel gradient shimmer and live elapsed timer in app/static/style.css and app/static/js/app.js
- [X] T021 [US3] Implement conversation pin/unpin action and pinned group section in sidebar in app/static/js/app.js and app/static/style.css

**Checkpoint**: All user stories fully integrated and functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Refinement, RTL adjustments, and comprehensive end-to-end verification.

- [X] T022 [P] Refine RTL alignment for message action docks, Persian Vazirmatn typography line-heights, and mobile drawers in app/static/style.css
- [X] T023 [P] Execute full test suite via pytest in tests/
- [X] T024 Execute quickstart validation guide scenarios in specs/024-pastel-modern-ui-enhancements/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories.
- **Phase 3 (User Story 1 - MVP)**: Depends on Phase 2. Can be delivered independently as MVP.
- **Phase 4 (User Story 2)**: Depends on Phase 2 and token rules from US1.
- **Phase 5 (User Story 3)**: Depends on Phase 2; builds upon UI structure from US1/US2.
- **Phase 6 (Polish)**: Depends on all user stories completed.

### Parallel Opportunities
- Within Phase 1: T001 and T002 can run in parallel.
- Within Phase 2: T004 and T005 can run in parallel.
- Within Phase 3: T006, T008 can be authored in parallel before T007/T009 wiring.
- Within Phase 4: T011 and T012 can run in parallel.
- Within Phase 5: T015, T016, T018, T020 can be drafted in parallel before T017/T019/T021 interaction wiring.
- Within Phase 6: T022 and T023 can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1: 4 Pastel Palettes & Live Switcher).
3. Validate User Story 1 independently (instant switching, zero FOUT, contrast compliance).

### Incremental Delivery
1. Foundation + US1 → Live MVP with 4 pastel palettes.
2. Add US2 → Modern Frosted Glassmorphism & Spring Micro-Interactions.
3. Add US3 → Full Productivity Suite (Dock, Starters, Thinking Box, Pinned Chats).
4. Run Polish (Phase 6) and end-to-end quickstart validation.
