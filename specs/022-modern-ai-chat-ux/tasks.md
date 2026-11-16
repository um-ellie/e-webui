# Tasks: Modern AI Chat & Ollama Connection UI/UX Overhaul

**Feature**: `022-modern-ai-chat-ux`  
**Input**: Design documents from `specs/022-modern-ai-chat-ux/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/ui-contracts.md`, `quickstart.md`, `reference-design.html`)  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-contracts.md`  

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize feature artifacts and staging for the Sage & Warm Sand design system

- [X] T001 Initialize design token variables and SVG icon definitions based on `specs/022-modern-ai-chat-ux/reference-design.html` in `app/static/index.html`
- [X] T002 [P] Establish automated browser test harness environment and dependencies in `tests/test_e2e_ui.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core CSS token architecture and telemetry normalization that ALL user stories depend upon

**⚠️ CRITICAL**: Must complete before user story component implementation begins

- [X] T003 Implement complete Sage & Warm Sand CSS token system for `:root` and `[data-theme="dark"]` (`--bg: #fff9ef`, `--panel: #fffefb`, `--side: #fdeedb`, `--line: #f1dfc5`, `--tx: #2c3a33`, `--mu: #5d6a5c`, `--sage: #5fc79b`, `--sd: #1b7552`, `--tint: #d6f3e4`, `--peach: #ffe2cc`, `--rose: #ff7f9c`, `--danger: #d2354f`, `--btn: #25996d` and dark equivalents) in `app/static/style.css`
- [X] T004 Implement pre-first-paint synchronous theme execution script in `<head>` to prevent theme flashes on load in `app/static/index.html`
- [X] T005 [P] Create shared canonical health telemetry normalizer module `app/static/js/health.js` classifying `/api/health` into `online`, `degraded`, `offline`, `checking` states and handling tab visibility change events
- [X] T006 Update reactive store in `app/static/js/store.js` to dispatch normalized health state and manage composer contextual chip flags (`isThinking`, `activePreset`)

**Checkpoint**: Foundation ready — token system, theme hydration, and health telemetry are operational.

---

## Phase 3: User Story 1 - Pristine Sage & Warm Sand Aesthetic with Theme Switching (Priority: P1) 🎯 MVP

**Goal**: Deliver the brand new visual atmosphere with WCAG AA compliant pastel palettes and an accessible 3-state header theme switcher (Light / Dark / System).

**Independent Test**: Switch between Light, Dark, and System modes via the header switcher, reload page to verify zero theme flash, and inspect the blinking cursor on the animated brand logo.

### Implementation for User Story 1

- [X] T007 [P] [US1] Remove legacy header status pill and dead styles completely from `app/static/index.html` and `app/static/style.css`
- [X] T008 [US1] Implement 3-state radio-group Theme Switcher markup (`[data-seg]` with Sun, Moon, and Monitor icons, sliding thumb indicator, and tooltips) in `app/static/index.html`
- [X] T009 [US1] Implement radio-group keyboard navigation (`ArrowLeft`, `ArrowRight`, `Space`, `Enter`), sliding thumb transition, and sync with `localStorage` in `app/static/js/components/header.js`
- [X] T010 [P] [US1] Integrate brand logo with animated blinking cursor (`.logo i` with `prefers-reduced-motion` compliance) in the sidebar header in `app/static/index.html`
- [X] T011 [US1] Style global application layout, ambient background gradients (`main::before`), buttons, and scrollbars according to Sage & Warm Sand specs in `app/static/style.css`

**Checkpoint**: User Story 1 is functional and testable independently (MVP ready).

---

## Phase 4: User Story 2 - Authoritative Ollama Connection Control in Sidebar (Priority: P1)

**Goal**: Provide an authoritative, multi-signal Ollama connection indicator in the sidebar footer with an interactive diagnostics popover.

**Independent Test**: Observe sidebar connection status (`Online · 2.6 ms`), click to open popover, inspect endpoint and loaded models ("No model loaded" when idle), and trigger manual "Reconnect and test".

### Implementation for User Story 2

- [X] T012 [P] [US2] Remove legacy avatar and "Ellie" personal profile block from the sidebar footer in `app/static/index.html`
- [X] T013 [US2] Implement sidebar footer connection capsule markup (`.conn` with multi-signal dot, activity waveform icon, label, and latency) in `app/static/index.html`
- [X] T014 [US2] Implement upward diagnostics popover markup (`#cpop` with endpoint, latency, resident models, timestamp, "Reconnect and test" button, and settings link) in `app/static/index.html`
- [X] T015 [US2] Implement connection state rendering, popover toggle, click-outside/Escape dismissal, and Reconnect trigger in `app/static/js/components/sidebar.js`
- [X] T016 [US2] Style connection capsule states (`.st-on`, `.st-slow`, `.st-off`, `.st-chk`) and upward popover (and mobile bottom sheet) in `app/static/style.css`

**Checkpoint**: User Stories 1 and 2 work seamlessly together without header status contradictions.

---

## Phase 5: User Story 3 - Contextual Minimalist Floating Composer (Priority: P2)

**Goal**: Re-architect the composer into an uncluttered contextual clean capsule with a single '+' action menu, subtle embedded mic, transient Think/Preset chips, and round Send/Stop button.

**Independent Test**: Open composer, verify clean resting state (no permanent toolbars), open '+' menu to toggle Think or select a Preset, observe appearance/dismissal of indicator chips, and send a message to observe Send/Stop morphing.

### Implementation for User Story 3

- [X] T017 [US3] Re-architect composer markup into `.cap` capsule with `#chips` container, auto-growing textarea `#ta`, subtle embedded `#mic`, single `#plus` button, model chip `#mc`, and round `.go#go` Send/Stop button in `app/static/index.html`
- [X] T018 [US3] Implement '+' quick-action popover markup (`#ppop` containing Attach file, Tools, Think switch `#thinkbtn`, and Presets list) and Model popover markup (`#mpop`) in `app/static/index.html`
- [X] T019 [US3] Implement dynamic chip rendering (Think chip with dismiss button, Preset chip with dismiss button) and 2-click action handling in `app/static/js/components/composer.js`
- [X] T020 [US3] Implement Send/Stop dynamic button morphing and stream interruption handling in `app/static/js/components/composer.js`
- [X] T021 [US3] Style contextual capsule, transient chips, floating shadow (`--sh`), popovers, and focus states in `app/static/style.css`

**Checkpoint**: Composer is clean, highly ergonomic, and provides 100% functional access in <= 2 clicks.

---

## Phase 6: User Story 4 - Task-Centric 3-Pane Settings Suite (Priority: P2)

**Goal**: Replace the legacy tab dialog with a modern 3-pane Settings dialog featuring desktop left-rail navigation (mobile top segmented control) and two-step Danger Zone protection.

**Independent Test**: Open Settings, navigate Panes 1, 2, and 3, adjust temperature and font sliders, toggle keyboard shortcuts accordion, and verify two-step confirmation on the conversation deletion button.

### Implementation for User Story 4

- [X] T022 [US4] Re-architect Settings modal markup into `.ov` backdrop, `.dlg` card, desktop `#nav` (mobile top tabs), and 3 task panes (`#p1` Workspace, `#p2` Model, `#p3` Data & system) in `app/static/index.html`
- [X] T023 [US4] Implement Pane 1 (Workspace theme segmented control, font scaling slider, and collapsed `#sc` shortcuts accordion) in `app/static/index.html` and `app/static/js/components/settings.js`
- [X] T024 [US4] Implement Pane 2 (Model default temperature and top-p sliders with live numeric badges, and system instructions textarea) in `app/static/index.html` and `app/static/js/components/settings.js`
- [X] T025 [US4] Implement Pane 3 (Data & system metadata, and Danger Zone with two-step `#del` confirmation button and 4-second reset timer) in `app/static/index.html` and `app/static/js/components/settings.js`
- [X] T026 [US4] Style 3-pane settings layout, left navigation highlights, sliders, and danger zone in `app/static/style.css`

**Checkpoint**: Settings dialog is fully redesigned, modern, and safeguards against accidental data wiping.

---

## Phase 7: User Story 5 - Asymmetric Start-Aligned Reading Flow & Minimal Canvas (Priority: P3)

**Goal**: Transform the empty canvas into an asymmetric start-aligned editorial greeting in the reading column without duplicate logos or engine status lines, transitioning smoothly to message streaming.

**Independent Test**: Open fresh conversation, observe start-aligned greeting in message column, submit first prompt, and verify smooth in-place transition into conversational turns and streaming blocks.

### Implementation for User Story 5

- [X] T027 [US5] Implement asymmetric start-aligned time-of-day greeting template in `app/static/js/components/empty.js` (aligned left in LTR, right in RTL, inside `.col#view`)
- [X] T028 [US5] Implement smooth transition from empty state to conversation turns without layout jump in `app/static/js/components/chat.js`
- [X] T029 [US5] Implement refined message turns styling (peach user bubble, Source Serif 4 assistant typography, collapsible pulsing thinking container with elapsed timer, syntax-highlighted code blocks with copy checkmarks, and hover action bars) in `app/static/style.css`

**Checkpoint**: Reading stage and empty canvas provide a calm, literary, and state-of-the-art AI reading experience.

---

## Phase 8: Polish, Parity Inventory & Automated Verification

**Purpose**: Execute automated verification, clean up dead code, and ensure 100% functional parity across all touched files.

- [X] T030 Author and execute end-to-end automated browser verification suite covering all 11 core user flows against `e-webui-app` (port 8080) in `tests/test_e2e_ui.py`
- [X] T031 Remove all obsolete CSS classes, legacy color variables, and unused DOM elements across `app/static/style.css` and `app/static/index.html`
- [X] T032 Update Parity Inventory in `specs/022-modern-ai-chat-ux/spec.md` with runtime test outputs and verify compliance against all acceptance criteria in `specs/022-modern-ai-chat-ux/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS** all user story phases.
- **Phase 3 (User Story 1)**: Depends on Phase 2. Can be delivered as initial visual MVP.
- **Phase 4 (User Story 2)**: Depends on Phase 2 & Phase 3 (shares header/sidebar real estate).
- **Phase 5 (User Story 3)**: Depends on Phase 2 & Phase 3 (composer capsule).
- **Phase 6 (User Story 4)**: Depends on Phase 2 & Phase 3 (settings theme sync).
- **Phase 7 (User Story 5)**: Depends on Phase 2, 3, and 5 (chat stage and composer interaction).
- **Phase 8 (Polish & Verification)**: Runs after all user story phases are completed.

### Parallel Opportunities
- T001 and T002 can execute in parallel.
- T003, T004, and T005 can execute in parallel across different files (`style.css`, `index.html`, `health.js`).
- T007 (header cleanup) and T010 (sidebar logo) can proceed in parallel.
- T012 (footer cleanup) and T016 (CSS styling) can proceed in parallel.
- T023 (Pane 1), T024 (Pane 2), and T025 (Pane 3) can be developed concurrently in modular sections.

---

## Implementation Strategy: Incremental Delivery

1. **Foundational Increment**: Implement T001-T006 (Tokens, Theme Hydration, Health Normalizer).
2. **Visual MVP (User Story 1)**: Implement T007-T011 (Sage & Warm Sand palette, 3-state Theme Switcher, blinking logo cursor). Validate theme switching without FOWT.
3. **Telemetry Increment (User Story 2)**: Implement T012-T016 (Footer connection capsule, upward diagnostics popover, Reconnect trigger). Validate elimination of header/sidebar status mismatch.
4. **Ergonomic Input Increment (User Story 3)**: Implement T017-T021 (Contextual capsule composer, '+' menu, Think/Preset chips, Send/Stop morphing). Validate inference streaming and 2-click reachability.
5. **Configuration Increment (User Story 4)**: Implement T022-T026 (3-pane Settings dialog, keyboard shortcuts accordion, Danger Zone two-step protection).
6. **Reading Experience Increment (User Story 5)**: Implement T027-T029 (Asymmetric empty state greeting, pulsing thought container, code copy feedback).
7. **Automated Verification**: Run T030-T032 (`tests/e2e-ui-validation.mjs`) to verify 100% functional parity and zero regressions.
