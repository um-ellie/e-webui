# Tasks: Markdown Response Display and Copy Actions

**Input**: Design documents from `/specs/006-render-markdown-responses/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-contracts.md`, `quickstart.md`  
**Tests**: Manual end-to-end browser scenarios defined in `quickstart.md`.  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task contains an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and vendoring client-side Markdown rendering assets

- [X] T001 Create vendor directory and install standalone offline Markdown parser in app/static/vendor/marked.min.js
- [X] T002 Include vendor script tag `<script src="/static/vendor/marked.min.js"></script>` in app/static/index.html before app.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core parser configuration and base container styling required before story-specific features

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Configure Markdown rendering initialization with GFM options, breaks, and safe HTML sanitization in app/static/app.js
- [X] T004 [P] Define core typography, spacing tokens, and `.markdown-body` container rules in app/static/style.css

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Rich Markdown Display for Assistant Responses (Priority: P1) 🎯 MVP

**Goal**: Render assistant responses with rich Markdown elements (headings, bold, italic, ordered/unordered lists, tables, blockquotes, and links) with modern typography.

**Independent Test**: Ask the model to generate a response with headings, bullet points, a markdown table, and a blockquote; verify that each element renders with proper HTML hierarchy rather than raw markdown syntax.

### Implementation for User Story 1

- [X] T005 [US1] Implement GFM table, blockquote, heading, and list rendering logic in app/static/app.js
- [X] T006 [P] [US1] Add responsive table styles (`table`, `th`, `td`, zebra striping, and `.table-wrapper` with horizontal scroll) in app/static/style.css
- [X] T007 [P] [US1] Add styles for blockquotes with accent left border, headings (h1-h6), links, and bidirectional text alignment (`dir="auto"`) in app/static/style.css

**Checkpoint**: At this point, User Story 1 is fully functional and delivers an MVP for rich markdown formatting.

---

## Phase 4: User Story 2 - One-Click Full Response Copy with Markdown Fidelity (Priority: P1)

**Goal**: Provide a ChatGPT/Gemini-style action toolbar at the bottom of each assistant message containing a copy button that copies the clean, original raw Markdown text with instant visual feedback.

**Independent Test**: Click the copy button below an assistant response, verify the button displays "Copied!" for ~1.8 seconds, and paste clipboard content into an editor to confirm exact raw Markdown preservation.

### Implementation for User Story 2

- [X] T008 [US2] Update message DOM construction to store raw response text in `msgItem.dataset.rawMarkdown` and attach `.message-actions` toolbar in app/static/app.js
- [X] T009 [US2] Implement `copyMessageResponse` handler supporting `navigator.clipboard.writeText`, fallback `execCommand`, and 1.8-second "Copied!" feedback in app/static/app.js
- [X] T010 [P] [US2] Add CSS styling for `.message-actions` toolbar, ghost `.action-btn`, copy/check SVG icons, and hover states in app/static/style.css

**Checkpoint**: At this point, User Stories 1 and 2 are functional, enabling both full markdown display and one-click copying.

---

## Phase 5: User Story 3 - Standalone Code Block Formatting and Block Copy (Priority: P2)

**Goal**: Render syntax-styled code block containers with language badges and independent code block copy buttons that copy only that specific snippet.

**Independent Test**: Generate a response containing a code block, click the copy button inside the code block header, and verify only that specific code snippet is copied to clipboard.

### Implementation for User Story 3

- [X] T011 [US3] Implement custom code block rendering with language badge, monospaced layout, and individual copy button in app/static/app.js
- [X] T012 [US3] Implement `copyCodeBlock` handler with localized button state confirmation in app/static/app.js
- [X] T013 [P] [US3] Refine `.code-block-wrapper`, `.code-block-header`, language badge, and `<pre><code>` styles in app/static/style.css

**Checkpoint**: User Stories 1, 2, and 3 are functional; users can copy entire responses or isolated code snippets independently.

---

## Phase 6: User Story 4 - Progressive Rendering and Smooth Streaming (Priority: P2)

**Goal**: Support progressive streaming updates so that incoming response chunks render without UI jitter, layout breakage, or missing text, activating the action toolbar upon completion.

**Independent Test**: Stream a response and observe progressive markdown updates with streaming cursor, followed by smooth activation of the response action toolbar upon completion.

### Implementation for User Story 4

- [X] T014 [US4] Update `renderAssistantBubble` and SSE stream event handler to progressively render markdown chunks and finalize response toolbar on completion in app/static/app.js
- [X] T015 [P] [US4] Add CSS styles for the streaming cursor and smooth height transitions during token arrival in app/static/style.css

**Checkpoint**: All user stories are complete and stream smoothly.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Visual consistency across themes and end-to-end verification

- [X] T016 [P] Verify contrast and palette styling across both Light Pastel Blue and Dark Pastel Navy themes in app/static/style.css
- [X] T017 Execute manual validation scenarios per specs/006-render-markdown-responses/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (T001, T002) - BLOCKS all user stories.
- **User Stories (Phase 3+)**:
  - **US1 (Phase 3)**: Depends on Phase 2 foundation.
  - **US2 (Phase 4)**: Depends on Phase 2 foundation and integrates with `appendMessage` in US1.
  - **US3 (Phase 5)**: Depends on Phase 2 foundation and integrates with code block rendering in US1.
  - **US4 (Phase 6)**: Depends on US1, US2, and US3 completion to finalize streaming integration.
- **Polish (Phase 7)**: Depends on all user stories being implemented.

### Parallel Opportunities

- **Phase 1**: T001 (vendor script) and T002 (HTML script tag) can be executed together.
- **Phase 2**: T003 (`app.js`) and T004 (`style.css`) can run in parallel.
- **Phase 3 (US1)**: T006 and T007 (table & typography styles in `style.css`) can run in parallel with T005 (`app.js`).
- **Phase 4 (US2)**: T010 (action button styles in `style.css`) can run in parallel with T008/T009 (`app.js`).
- **Phase 5 (US3)**: T013 (code block styles in `style.css`) can run in parallel with T011/T012 (`app.js`).
- **Phase 6 (US4)**: T015 (`style.css`) can run in parallel with T014 (`app.js`).

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (`marked.min.js` vendored and included in `index.html`).
2. Complete Phase 2: Foundational parser configuration and base styling.
3. Complete Phase 3: User Story 1 (Headings, lists, tables, blockquotes).
4. **VALIDATE MVP**: Verify rich markdown displays cleanly.

### Incremental Delivery
1. Add Phase 4 (User Story 2): Action toolbar with full-response copy button (ChatGPT/Gemini parity).
2. Add Phase 5 (User Story 3): Individual code block copy buttons and language badges.
3. Add Phase 6 (User Story 4): Progressive streaming updates without flickering.
4. Complete Phase 7: Polish and quickstart validation.
