# Tasks: Pastel Design System and UI/UX Overhaul

**Input**: Design documents from `/specs/021-pastel-ui-overhaul/`  
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.  

## Format: `- [ ] [TaskID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3])
- Every task includes exact file paths in description.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish token references and test harnesses for UI contracts and theme verification.

- [x] T001 Initialize contract test runner for feature 021 in `tests/unit/test_ui_contracts.py` referencing `specs/021-pastel-ui-overhaul/contracts/ui-features.json`
- [x] T002 [P] Create automated CSS token validator test in `tests/unit/test_theme_tokens.py` to verify presence of all required pastel design tokens defined in `specs/021-pastel-ui-overhaul/contracts/theme-tokens.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core CSS token architecture and variables that MUST be complete before individual UI components can be restyled.

**⚠️ CRITICAL**: Foundational tokens must be defined in `app/static/style.css` before user stories begin.

- [x] T003 Define core pastel design tokens (`--bg`, `--side`, `--card`, `--user`, `--active`, `--line`, `--ink`, `--mute`, `--codebg`, `--codehead`, `--pastel-lavender`, `--pastel-mint`, `--pastel-peach`, `--pastel-periwinkle`, `--danger`) in `:root` inside `app/static/style.css`
- [x] T004 Define cozy Dark Mode token overrides (`[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`) featuring slate/charcoal-lavender canvas (`#14121E`), card surfaces (`#201C31`), and muted borders (`#342D4E`) in `app/static/style.css`
- [x] T005 [P] Define warm Light Mode token overrides (`[data-theme="light"]`) featuring warm alabaster/cream canvas (`#FAF8F5`), crisp white cards (`#FFFFFF`), warm linen sidebar (`#F3EFEA`), and subtle dividers (`#E5DDD4`) in `app/static/style.css`
- [x] T006 [P] Update feature registry definitions in `app/static/js/features.js` to ensure parity with `specs/021-pastel-ui-overhaul/contracts/ui-features.json`

**Checkpoint**: Foundation ready - all design tokens and feature registry contracts established.

---

## Phase 3: User Story 1 - Cohesive Pastel Theming & Reading Experience (Priority: P1) 🎯 MVP

**Goal**: Deliver the modern, distraction-free pastel theme across all application surfaces, ensuring WCAG 2.1 AA contrast compliance and subtle glassmorphism.

**Independent Test**: Switch between Light Mode, Dark Mode, and System Theme in `app/static/style.css`; verify that body text meets $\ge 4.5:1$ contrast against surface background, all cards reflect pastel tints, and floating headers exhibit subtle glassmorphism without blur artifacts.

- [x] T007 [P] [US1] Apply pastel surface, border, and typography styles to the main app layout (`.app-shell`, `.chat-container`, `.message-row`) in `app/static/style.css`
- [x] T008 [P] [US1] Restyle user message bubbles (`.user-bubble`) and assistant message cards (`.assistant-card`) with warm pastel tints and rounded corners in `app/static/style.css`
- [x] T009 [US1] Implement glassmorphism elevation styling (`backdrop-filter: blur(12px)`) and soft box-shadows on floating header and composer bars in `app/static/style.css`
- [x] T010 [US1] Audit and refine font scaling rules (`--font-scale: 13.5px / 15px / 16.5px`) and typography line-heights in `app/static/style.css` to guarantee WCAG 2.1 AA readability
- [x] T011 [US1] Run automated token and contract verification via `python3 -m unittest tests/unit/test_theme_tokens.py`

**Checkpoint**: At this point, User Story 1 (MVP) is fully functional, delivering the pastel aesthetic across both dark and light modes.

---

## Phase 4: User Story 2 - Streamlined Settings Without Dead Language Controls (Priority: P1)

**Goal**: Completely remove the obsolete "Interface Language" dropdown, eliminate dead language code across the codebase, preserve per-message RTL/LTR detection, and wire functional parameter controls.

**Independent Test**: Open Settings dialog; verify that "Interface Language" is completely absent, adjust Temperature and System Prompt and verify persistence in `localStorage`, then send an Arabic/Persian message and confirm automatic right-to-left alignment while application chrome remains unaffected.

- [x] T012 [US2] Remove the "Interface Language" `<select id="setting-language">` group and label from `app/static/index.html`
- [x] T013 [US2] Remove `this.langSelect` reference, event listeners, and whole-document `dir` toggling from `app/static/js/components/settings.js`
- [x] T014 [US2] Clean up dead language dictionary code and unused string exports in `app/static/js/i18n.js`
- [x] T015 [US2] Verify `app/static/js/rtl.js` and `app/static/js/components/chat.js` isolate per-message RTL detection strictly to message containers via `applyDirectionToElement()`
- [x] T016 [US2] Wire and polish functional Settings controls (Temperature, Top-P, Default System Prompt, Clear all chats) in `app/static/js/components/settings.js` and `app/static/index.html`
- [x] T017 [US2] Clean up non-functional placeholder toggles and audit tab layouts (General, Appearance, Models, Shortcuts, About) in `app/static/index.html`
- [x] T018 [US2] Add unit test in `tests/unit/test_ui_contracts.py` ensuring no `#setting-language` element or `setting-language` binding exists

**Checkpoint**: Settings dialog is streamlined, all dead language references are eliminated, and per-message RTL remains fully operational.

---

## Phase 5: User Story 3 - Responsive Composer and Fluid Model Selection (Priority: P2)

**Goal**: Fix model picker popover clipping on smaller viewports, refine Send/Stop button states, and deliver a responsive auto-expanding composer.

**Independent Test**: On a 360px viewport in DevTools, open the model picker popover (`#pop`); verify it fits entirely within the screen width without horizontal overflow. Submit a prompt and verify the action button cleanly toggles between Send and Stop states.

- [x] T019 [US3] Add responsive viewport constraints to Model Picker popover (`.pop`) and Parameters popover (`.params-popover`) using `width: min(340px, calc(100vw - 32px))` in `app/static/style.css`
- [x] T020 [US3] Add mobile centered popover alignment rules (`@media (max-width: 640px)`) preventing right-edge clipping in `app/static/style.css`
- [x] T021 [US3] Refine Send (`.btn-send`) and Stop (`.btn-stop`) button states, icon transitions, and accessible tooltips in `app/static/style.css` and `app/static/js/components/composer.js`
- [x] T022 [US3] Enhance composer textarea auto-resize logic with smooth scrolling and maximum height bounds (220px) in `app/static/js/components/composer.js`
- [x] T023 [US3] Ensure keyboard navigation (ArrowUp, ArrowDown, Enter, Esc) in ModelPicker popover functions cleanly across screen widths in `app/static/js/components/composer.js`

**Checkpoint**: Composer and model selector operate fluidly without viewport clipping down to 320px screen width.

---

## Phase 6: User Story 4 - Polished Markdown, Syntax Highlighting & Collapsible Thought Blocks (Priority: P2)

**Goal**: Implement smooth `grid-template-rows` height transitions for reasoning thought blocks, style code blocks with pastel-tinted headers and badges, and add positive copy confirmation.

**Independent Test**: Render an assistant response containing `<think>` reasoning and code snippets. Click thought chip to confirm smooth accordion animation without layout popping; click code copy button to confirm immediate "Copied!" feedback state.

- [x] T024 [US4] Implement smooth CSS Grid transition (`grid-template-rows: 0fr -> 1fr`) on `.thought-content` with inner wrapper clipping in `app/static/style.css`
- [x] T025 [US4] Add `@media (prefers-reduced-motion: reduce)` rules for `.thought-content` and `.thought-chip` to immediately resolve transitions in `app/static/style.css`
- [x] T026 [US4] Style code container chrome (`.code-container`, `.code-header`, `.code-lang-badge`) with pastel tones and distinct borders in `app/static/style.css`
- [x] T027 [US4] Implement visual affirmative confirmation ("Copied!" with checkmark icon for 2000ms) on `.btn-code-copy` in `app/static/js/markdown.js` and `app/static/style.css`
- [x] T028 [US4] Adjust Prism syntax highlighting tokens (`--token-keyword`, `--token-string`, `--token-function`, `--token-comment`, etc.) with soft pastel hues in `app/static/style.css`

**Checkpoint**: Markdown rendering, reasoning accordions, and code blocks provide a high-polish, legible presentation.

---

## Phase 7: User Story 5 - Unified Sidebar Navigation & Real-Time Engine Status (Priority: P3)

**Goal**: Redesign sidebar session items, hover/focus quick actions (rename, export, delete), and the Ollama connection indicator into a unified, sleek layout.

**Independent Test**: Hover over sidebar sessions to verify smooth appearance of context actions; test rename, export, and delete; verify connection indicator reflects online/degraded/offline statuses with soft pastel status badges.

- [x] T029 [US5] Redesign sidebar session items (`.session-item`) with pastel active indicators, smooth hover backgrounds, and refined date section headers in `app/static/style.css`
- [x] T030 [US5] Enhance session item context actions (`.session-menu-btn` and `.context-menu`) for accessible keyboard and touch interaction in `app/static/style.css` and `app/static/js/components/sidebar.js`
- [x] T031 [US5] Redesign the Ollama connection indicator (`.connection-sub`, `.dot`, `.health-indicator-btn`) with soft pastel status badges (`connected`, `degraded`, `offline`) in `app/static/style.css`
- [x] T032 [US5] Update sidebar collapse rail styling and brand link transition in `app/static/style.css` and `app/static/js/components/sidebar.js`

**Checkpoint**: Navigation sidebar and system health indicators operate smoothly with unified visual polish.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cross-component validation, contrast audit, and documentation updates.

- [x] T033 [P] Conduct automated and manual WCAG 2.1 AA contrast check on all text tokens across light and dark modes
- [x] T034 [P] Run complete unit test suite via `python3 -m unittest discover tests/unit` ensuring zero regressions
- [x] T035 Execute end-to-end validation scenarios documented in `specs/021-pastel-ui-overhaul/quickstart.md`
- [x] T036 Update project README or UI documentation with details on the new pastel design system and removed interface language setting

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup (T001, T002)
   ↓
Phase 2: Foundational (T003, T004, T005, T006)
   ↓
Phase 3: User Story 1 - Pastel Theming (T007-T011) [MVP]
   ↓
Phase 4: User Story 2 - Settings & Dead Code Removal (T012-T018)
   ↓
Phase 5: User Story 3 - Responsive Composer & Model Popover (T019-T023)
   ↓
Phase 6: User Story 4 - Markdown & Thought Accordions (T024-T028)
   ↓
Phase 7: User Story 5 - Sidebar & Status (T029-T032)
   ↓
Phase 8: Polish & Cross-Cutting (T033-T036)
```

### Parallel Opportunities

- **Phase 1**: `T002` (token validator) can run in parallel with `T001`.
- **Phase 2**: `T005` (Light mode tokens) and `T006` (features.js) can run in parallel with `T004`.
- **Phase 3**: `T007` and `T008` can run in parallel.
- **Phase 4**: `T014` (dead code cleanup in i18n.js) can run in parallel with `T012`/`T013`.
- **Phase 8**: `T033` (contrast audit) and `T034` (test suite) can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational Tokens).
2. Complete Phase 3 (User Story 1: Pastel Theming).
3. **Validate**: Switch themes, verify WCAG AA contrast and aesthetic feel.
4. Deliver MVP baseline.

### Incremental Delivery
1. Foundation + US1 (Pastel Design System).
2. Add US2 (Settings dialog cleanup & dead language removal).
3. Add US3 (Composer responsiveness & popover bounds).
4. Add US4 (Markdown code chrome & smooth thought blocks).
5. Add US5 (Sidebar & connection indicators).
6. Polish & validation guide execution.
