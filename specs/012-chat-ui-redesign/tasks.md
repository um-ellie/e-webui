# Tasks: Claude-Style Chat UI Redesign (Appearance Phase)

**Input**: Design documents from `/specs/012-chat-ui-redesign/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- All descriptions include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize static asset directories, font packages, vendor scripts, and brand logo assets.

- [X] T001 Create client asset directory structure in `app/static/fonts/`, `app/static/img/`, `app/static/vendor/`, `app/static/js/`, and `app/static/js/components/`
- [X] T002 [P] Install local web font files (Inter 400/500/600, Source Serif 4 400/500, JetBrains Mono 400/500, Vazirmatn 400/500/600) into `app/static/fonts/`
- [X] T003 [P] Copy brand logo vector files (`logo.svg`, `logo-dark.svg`, `mark.svg`), favicons, and manifest assets from `design/logo/` to `app/static/img/`
- [X] T004 [P] Vendor `dompurify.min.js` into `app/static/vendor/dompurify.min.js` and verify `app/static/vendor/marked.min.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core design tokens, feature registry, in-memory store, theme handling, and API client that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Implement core CSS design tokens, `@font-face` declarations, and `@keyframes logo-blink` in `app/static/style.css` based on `design/reference/design-tokens.css` and `design/logo/PROMPT-blinking-cursor.md`
- [X] T006 [P] Implement centralized feature-availability registry in `app/static/js/features.js` satisfying `specs/012-chat-ui-redesign/contracts/ui-features.json` with controls mapped to `"status": "enabled"` or `"status": "disabled"` and `"reason": "Not available yet"`
- [X] T007 [P] Implement in-memory `ChatStore` in `app/static/js/store.js` supporting `ChatSession` ("id string UUID", "title string max 120 chars", "createdAt number Epoch ms", "updatedAt number Epoch ms", "model string", "messages Array<ChatMessage>") and observable event emitter
- [X] T008 [P] Implement theme manager in `app/static/js/theme.js` handling `system`, `light`, `dark` modes with `localStorage` persistence and immediate document attribute application to eliminate flash of unstyled content
- [X] T009 [P] Implement backend API client and SSE stream consumer in `app/static/js/api.js` for `/api/health`, `/api/models`, and `POST /api/generate` matching `specs/012-chat-ui-redesign/contracts/backend-api.yaml`
- [X] T010 [P] Implement safe Markdown rendering and sanitization module in `app/static/js/markdown.js` integrating `marked.min.js` and `dompurify.min.js` with code block headers and copy actions
- [X] T011 [P] Implement text direction detector in `app/static/js/rtl.js` identifying Persian/Arabic Unicode ranges and isolating code blocks as LTR
- [X] T012 [P] Create UI feature registry and contract test suite in `tests/unit/test_ui_contracts.py` verifying all controls conform to `ui-features.json`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Read and Write Conversations in a Claude-Style Layout (Priority: P1) 🎯 MVP

**Goal**: Deliver the core Claude-style conversation view with centered 720 px reading column, user message bubbles on the right, assistant serif typography without bubbles, streaming rose terminal cursor, syntax-highlighted code blocks with Copy buttons, collapsible thought chips, and auto-scroll control.

**Independent Test**: Load an active session, send a prompt, and observe streaming tokens rendering without flicker in Source Serif 4 with the blinking rose cursor, followed by formatted Markdown code blocks with copy confirmation and collapsible reasoning blocks.

### Implementation for User Story 1

- [X] T013 [P] [US1] Create the conversation reading container markup with 720 px centered column in `app/static/index.html`
- [X] T014 [P] [US1] Implement conversation styling in `app/static/style.css` for user bubbles (`--user: #E8E0F4` light, `#2A2248` dark, border-radius `18px 18px 6px 18px`), assistant typography (`"Source Serif 4", Georgia, serif`, 17px/1.7), and streaming cursor (`.stream` rose background, animation `logo-blink 1.06s step-end infinite`)
- [X] T015 [US1] Implement `ChatView` component in `app/static/js/components/chat.js` rendering user and assistant messages from `ChatStore`
- [X] T016 [US1] Implement incremental token streaming with live cursor attachment and stop/halt lifecycle in `app/static/js/components/chat.js`
- [X] T017 [US1] Implement collapsible reasoning thought block (`<div class="chip">Thought for N seconds</div>`) in `app/static/js/components/chat.js`
- [X] T018 [US1] Implement code block header chrome with language tag and working Copy button (with "Copied" feedback state) in `app/static/js/components/chat.js`
- [X] T019 [US1] Implement assistant action bar (Copy, Like, Dislike, Regenerate, model/speed meta) in `app/static/js/components/chat.js`
- [X] T020 [US1] Implement viewport auto-scroll tracking and floating "Scroll to latest" button in `app/static/js/components/chat.js`

**Checkpoint**: User Story 1 is fully functional and delivers an independently testable MVP.

---

## Phase 4: User Story 2 - Compose Messages with the Full Claude-Style Composer (Priority: P1)

**Goal**: Deliver the large rounded composer card anchored at the bottom of the reading column with multi-line auto-growth up to 8 lines, keyboard sending (Enter to send, Shift+Enter for newline), accessory toolbar (Attach, Tools, Think toggle, Model pill, Send/Stop button), and drag-and-drop feedback.

**Independent Test**: Type single and multi-line queries in the composer, verify auto-growth up to 8 lines, submit via Enter, click Stop during generation, and verify Attach/Tools buttons display disabled tooltips.

### Implementation for User Story 2

- [X] T021 [P] [US2] Create composer card markup with rounded card container, textarea, and action toolbar in `app/static/index.html`
- [X] T022 [P] [US2] Implement composer card styling in `app/static/style.css` (radius 24 px, card shadow `0 8px 30px rgba(70,45,120,.08)`, send button rose circle, pill toggles)
- [X] T023 [US2] Implement `Composer` controller in `app/static/js/components/composer.js` managing textarea auto-growth up to 8 lines, Enter send, Shift+Enter newline, and empty string prevention
- [X] T024 [US2] Wire composer accessory toolbar (Attach +, Tools menu, Think toggle, Model pill, Send/Stop) to `features.js` registry and `api.js` in `app/static/js/components/composer.js`
- [X] T025 [US2] Implement file drag-and-drop overlay displaying "File upload is not available yet" in `app/static/js/components/composer.js`
- [X] T026 [US2] Add subtle centered disclaimer below composer ("Local models can make mistakes. Check important info.") in `app/static/index.html`

**Checkpoint**: User Stories 1 and 2 work together seamlessly for end-to-end reading and writing.

---

## Phase 5: User Story 3 - Navigate and Manage Sessions with the Collapsible Sidebar (Priority: P1)

**Goal**: Deliver the 264 px left sidebar featuring the brand wordmark with blinking cursor `_`, collapse toggle button, New chat button, instant title search filtering, grouped recents (Today, Yesterday, Previous 7 days, Older), hover context actions (Rename, Pin, Delete), and footer with avatar, Ollama health dot, and Settings button.

**Independent Test**: Create multiple chats, filter titles in real time using the search input, rename and delete sessions via hover context menus, collapse the sidebar to an icon rail, and observe backend connectivity status.

### Implementation for User Story 3

- [X] T027 [P] [US3] Create sidebar structure in `app/static/index.html` including top brand header, navigation buttons, search box, session list container, and footer profile bar
- [X] T028 [P] [US3] Implement sidebar styling in `app/static/style.css` (width 264 px, `--side: #E6F4FB` light, `#17132A` dark, collapsed icon rail mode, active session highlight `--active: #D5EAF6`)
- [X] T029 [US3] Implement `Sidebar` controller in `app/static/js/components/sidebar.js` managing session list rendering grouped by relative date ("Today", "Yesterday", "Previous 7 days", "Older")
- [X] T030 [US3] Implement New chat action and real-time instant title search filtering in `app/static/js/components/sidebar.js`
- [X] T031 [US3] Implement session item hover menu (Rename, Pin, Delete) in `app/static/js/components/sidebar.js` wired to `ChatStore` and `features.js` (Pin disabled with tooltip)
- [X] T032 [US3] Implement sidebar collapse/expand toggle with client-side preference persistence in `app/static/js/components/sidebar.js`
- [X] T033 [US3] Implement sidebar footer showing user avatar, name ("Ellie"), live Ollama connection health dot (`/api/health`), and Settings trigger in `app/static/js/components/sidebar.js`

**Checkpoint**: User Stories 1, 2, and 3 provide a complete chat workspace with session switching and navigation.

---

## Phase 6: User Story 4 - Select Models and Manage Settings from Header (Priority: P1)

**Goal**: Deliver the top header bar with editable conversation title, model selector dropdown populated from `/api/models`, Share/Export action menus, and the multi-tab Settings dialog (General, Appearance, Models, Shortcuts, About).

**Independent Test**: Rename the active conversation from the header, switch models via the dropdown, open the Settings modal, switch themes (System, Light, Dark) and font sizes, and view shortcuts.

### Implementation for User Story 4

- [X] T034 [P] [US4] Create top header bar markup with title pill, model dropdown, Share button, and overflow menu in `app/static/index.html`
- [X] T035 [P] [US4] Create Settings modal dialog markup with accessible tabbed navigation (General, Appearance, Models, Shortcuts, About) in `app/static/index.html`
- [X] T036 [P] [US4] Implement header bar and modal dialog styling in `app/static/style.css` (height 56 px, modal backdrop, tabs, focus rings)
- [X] T037 [US4] Implement `Header` component in `app/static/js/components/header.js` handling inline title editing, model selector population from `api.getModels()`, and overflow menu actions
- [X] T038 [US4] Implement `SettingsDialog` component in `app/static/js/components/settings.js` with tab switching, theme selection, font size adjustment, shortcuts sheet, and disabled model parameters

**Checkpoint**: Header controls and application settings are fully functional.

---

## Phase 7: User Story 5 - Greet and Prompt from an Empty Chat State (Priority: P2)

**Goal**: Deliver a welcoming empty state for new conversations featuring the brand mark `>E_`, time-sensitive greeting ("Good evening, Ellie"), centered composer, and clickable prompt suggestion chips.

**Independent Test**: Start a new chat, verify the time-of-day greeting and brand mark appear centered, click a suggestion chip, and verify prompt text populates the composer textarea.

### Implementation for User Story 5

- [X] T039 [P] [US5] Create empty chat state markup with brand mark, greeting typography, and suggestion chips container in `app/static/index.html`
- [X] T040 [P] [US5] Implement empty chat state styling in `app/static/style.css` (centered layout, Source Serif 4 greeting, rounded chip buttons)
- [X] T041 [US5] Implement `EmptyState` component in `app/static/js/components/empty.js` calculating time-of-day greeting ("Good morning / afternoon / evening, Ellie") and wiring suggestion chips to populate composer input

**Checkpoint**: Empty chat sessions display an inviting and functional greeting.

---

## Phase 8: User Story 6 - Log In with Brand Design System (Priority: P2)

**Goal**: Redesign the authentication screen using the brand design tokens (centered card, pastel background, official wordmark with blinking cursor, clear error and loading states) while strictly preserving existing session cookie authentication.

**Independent Test**: Load the login view, verify visual consistency with design tokens, submit credentials, observe loading indicator on the submit button, and verify error or successful redirection.

### Implementation for User Story 6

- [X] T042 [P] [US6] Create redesigned login card markup with official brand wordmark and accessible form controls in `app/static/index.html`
- [X] T043 [P] [US6] Implement login screen styling in `app/static/style.css` using `--card`, `--line`, `--ink`, `--rose`, and `--bg` pastel tokens
- [X] T044 [US6] Implement login form controller in `app/static/js/components/login.js` managing submission loading states, error banner display, and HttpOnly session cookie authentication

**Checkpoint**: Authentication screen matches the full application design system without auth regressions.

---

## Phase 9: User Story 7 - Persian and Mixed-Language Content (Priority: P2)

**Goal**: Support seamless Persian/Arabic text reading with automatic per-block RTL direction detection and local Vazirmatn font, while isolating all code blocks and inline code as LTR with JetBrains Mono.

**Independent Test**: Submit a Persian prompt and verify assistant response displays Persian paragraphs in `dir="rtl"` using Vazirmatn font, with all embedded code snippets strictly aligned LTR in JetBrains Mono.

### Implementation for User Story 7

- [X] T045 [P] [US7] Implement CSS classes and font rules for Persian RTL text (`.font-fa`, `[dir="rtl"]`) and isolated LTR code blocks in `app/static/style.css`
- [X] T046 [US7] Integrate `rtl.js` into `app/static/js/components/chat.js` to automatically evaluate paragraph direction and apply `dir="rtl"` to Persian content
- [X] T047 [US7] Ensure code blocks and terminal tokens in `app/static/js/markdown.js` explicitly set `dir="ltr"` and `unicode-bidi: isolate` regardless of parent direction
- [X] T048 [US7] Prepare layout mirroring CSS in `app/static/style.css` for when Persian is selected as interface language in Settings

**Checkpoint**: Bilingual English/Persian conversations render with native typographic alignment.

---

## Phase 10: User Story 8 - Responsive Multi-Device Layout and Keyboard Accessibility (Priority: P2)

**Goal**: Ensure smooth responsive behavior across desktop (pinned sidebar), tablet (overlay panel), and mobile (<640 px drawer, 44px touch targets, sticky composer), along with full keyboard shortcuts and focus trapping.

**Independent Test**: Resize viewport to 360 px width and verify mobile drawer behavior and zero horizontal scroll. Test keyboard shortcuts (`Ctrl+K`, `Ctrl+Shift+O`, `Ctrl+B`, `/`, `Esc`, `?`) and tab order with visible focus rings.

### Implementation for User Story 8

- [X] T049 [P] [US8] Implement responsive breakpoint styles in `app/static/style.css` for desktop (≥1024 px), tablet (640–1023 px overlay), and mobile (<640 px drawer, safe area insets, 44px touch targets)
- [X] T050 [US8] Implement mobile drawer toggle, backdrop overlay, and swipe/outside-click dismissal in `app/static/js/components/sidebar.js`
- [X] T051 [P] [US8] Implement global keyboard shortcut manager in `app/static/js/shortcuts.js` handling `Ctrl/Cmd+K`, `Ctrl/Cmd+Shift+O`, `Ctrl/Cmd+B`, `/`, `Esc`, and `?`
- [X] T052 [US8] Implement accessible modal focus trapping and keyboard focus restoration in `app/static/js/components/settings.js`
- [X] T053 [P] [US8] Add high-visibility WCAG 2.2 AA compliant focus rings (`:focus-visible`) across all interactive elements in `app/static/style.css`

**Checkpoint**: Application is fully responsive and completely operable by keyboard only.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: System-wide hardening, reduced-motion preferences, accessibility checks, and end-to-end verification.

- [X] T054 [P] Implement `@media (prefers-reduced-motion: reduce)` rules across `app/static/style.css` ensuring static cursor (`animation: none; opacity: 1`) and instant transitions
- [X] T055 [P] Implement centralized UI strings dictionary in `app/static/js/i18n.js` ensuring no hard-coded English strings in components
- [X] T056 [P] Verify zero external CDN requests: audit all HTML/CSS/JS files to ensure no third-party network fetches occur at runtime
- [X] T057 Execute full end-to-end validation scenarios documented in `specs/012-chat-ui-redesign/quickstart.md` and verify side-by-side consistency against `design/reference/chat-mock.html`
- [X] T058 Run automated test suite with `pytest` to confirm zero regression on backend contracts, models, and sanitization

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──► Phase 2: Foundational ──► Phase 3: US1 (MVP) ──► Phase 4: US2 ──► Phase 5: US3 ──► Phase 6: US4
                                         │                                                                      │
                                         └──► Phase 7: US5 ──► Phase 8: US6 ──► Phase 9: US7 ──► Phase 10: US8 ──┘
                                                                                                               │
                                                                                                               ▼
                                                                                                      Phase 11: Polish
```

- **Setup (Phase 1)**: Independent, can begin immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion; blocks all user stories.
- **User Stories (Phases 3–10)**: All depend on Phase 2 Foundational.
  - P1 Stories (Phases 3–6) deliver core chat workspace.
  - P2 Stories (Phases 7–10) add empty states, auth styling, RTL, and mobile/keyboard enhancements.
- **Polish (Phase 11)**: Depends on all user stories being implemented.

### Parallel Opportunities

- **Phase 1 Setup**: Tasks T002, T003, T004 can run concurrently.
- **Phase 2 Foundational**: Tasks T005, T006, T007, T008, T009, T010, T011, T012 can all be developed concurrently across their respective files.
- **User Story 1 (P1)**: T013 and T014 can be developed in parallel before T015–T020.
- **User Story 2 (P1)**: T021 and T022 can run in parallel before T023–T026.
- **User Story 3 (P1)**: T027 and T028 can run in parallel before T029–T033.
- **User Story 4 (P1)**: T034, T035, T036 can run in parallel before T037–T038.
- **User Story 5, 6, 7, 8**: Markup and CSS tasks marked `[P]` can run in parallel.
- **Phase 11 Polish**: Tasks T054, T055, T056 can run concurrently.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1 - Claude-Style Conversation View).
3. **Validate MVP**: Test token streaming, Source Serif 4 typography, blinking rose terminal cursor, markdown/code copy, and stop button.
4. Deliver MVP baseline.

### Incremental Feature Expansion

1. Add User Story 2 (Composer card, multi-line auto-grow, toolbars).
2. Add User Story 3 (Sidebar navigation, in-memory sessions, search filter).
3. Add User Story 4 (Header, model dropdown, Settings modal).
4. Add User Stories 5–8 (Empty state, login screen, Persian RTL, responsive mobile drawer, keyboard shortcuts).
5. Finalize with Phase 11 (Polish, accessibility, offline audit, and regression tests).
