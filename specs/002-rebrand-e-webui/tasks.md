# Tasks: Rebrand to e-webui & Brand Logo Integration

**Input**: Design documents from `/specs/002-rebrand-e-webui/`  
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/brand-logo-contract.md](./contracts/brand-logo-contract.md), [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `[US1]`, `[US2]`, `[US3]`)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, audit tooling, and baseline setup

- [X] T001 Create audit and validation script in `specs/002-rebrand-e-webui/scratch/audit_names.py` to check for legacy name occurrences (`ellie-ollama-webui`, `Ollama Web UI`, `Web UI`, `webui`) with exclusion filters for third-party tools and container configurations

---

## Phase 2: Foundational (Design Tokens & Animation Framework)

**Purpose**: Core CSS design tokens, keyframes, and motion overrides that MUST be complete before UI components can be rendered

**⚠️ CRITICAL**: Blocking prerequisite for User Story 1

- [X] T002 [P] Define brand color tokens `--logo-prompt: #3b82f6;` and `--logo-text: #f8fafc;` under `:root` in `app/static/style.css`
- [X] T003 [P] Define blinking cursor animation `@keyframes logo-cursor-blink` and `.animate-logo-cursor-blink` class in `app/static/style.css`
- [X] T004 Define `@media (prefers-reduced-motion: reduce)` override in `app/static/style.css` pausing cursor animation (`animation: none !important; opacity: 1 !important;`)

**Checkpoint**: Foundational design tokens and animation rules established; UI component styling ready to proceed.

---

## Phase 3: User Story 1 - Brand Identity & Animated Logo in Chat Header (Priority: P1) 🎯 MVP

**Goal**: Render the `> ~/.E _` brand logo in the chat header with exact responsive typography (~28px mobile, ~34px desktop), theme color tokens, cursor blinking with reduced-motion pausing, screen-reader accessibility, and bidirectional isolation.

**Independent Test**: Load the chat interface at `http://127.0.0.1:8080` and verify the logo renders at 28px/34px, blinks continuously, pauses under `prefers-reduced-motion: reduce`, announces as "e-webui" in accessibility trees, and remains LTR in RTL document contexts.

### Implementation for User Story 1

- [X] T005 [US1] Implement brand logo typography and responsive styles (`28px` mobile, `@media (min-width: 640px) { font-size: 34px; }`, font-family monospace, `user-select: none; line-height: 1;`) in `app/static/style.css`
- [X] T006 [US1] Update chat header markup in `app/static/index.html` replacing legacy logo elements (`🦙 Ollama UI`) with `<span class="brand-logo" role="img" aria-label="e-webui" dir="ltr" style="unicode-bidi: isolate;"><span class="logo-prompt">&gt;</span><span class="logo-text">~/.E</span><span class="logo-cursor animate-logo-cursor-blink" aria-hidden="true">_</span></span>`
- [X] T007 [US1] Verify brand logo visual rendering, responsive resizing at 28px/34px, and reduced-motion pause behavior against `specs/002-rebrand-e-webui/contracts/brand-logo-contract.md`

**Checkpoint**: At this point, User Story 1 (MVP) is fully functional and visually validated.

---

## Phase 4: User Story 2 - Comprehensive Application Rebranding (Priority: P1)

**Goal**: Replace all occurrences of legacy names (`ellie-ollama-webui`, `Ollama Web UI`, `Web UI`, `webui`) throughout user interface elements, titles, docstrings, logger definitions, and project documentation with the canonical name `e-webui`, preserving third-party names and container infrastructure.

**Independent Test**: Inspect browser tab title, document headings, Python logger outputs, and workspace files using `grep` to confirm that all legacy application names have been replaced with `e-webui` without broken compounded phrases.

### Implementation for User Story 2

- [X] T008 [P] [US2] Update application title `<title>e-webui</title>` and empty state description in `app/static/index.html`
- [X] T009 [P] [US2] Update FastAPI application metadata (`title="e-webui"`, description, version) and logger (`logging.getLogger("e-webui")`) in `app/main.py`
- [X] T010 [P] [US2] Update docstrings and configuration titles from legacy names to `e-webui` in `app/config.py` and `app/models.py`
- [X] T011 [P] [US2] Update frontend header comment from "Ollama Web UI" to "e-webui" in `app/static/app.js`
- [X] T012 [P] [US2] Update application headings, descriptions, and architecture text from legacy names to `e-webui` in `README.md`
- [X] T013 [US2] Update legacy naming references in historical specification documentation in `specs/001-ollama-web-ui/` while preserving third-party Open-WebUI references

**Checkpoint**: At this point, User Stories 1 AND 2 are complete; application identity is unified across UI and codebase.

---

## Phase 5: User Story 3 - Operational & Configuration Consistency (Priority: P2)

**Goal**: Align workspace service files, scripts, and test suite headers with `e-webui` while strictly observing the Infrastructure Isolation principle (preserving Incus container variable defaults and documenting manual hand-offs).

**Independent Test**: Inspect `app/systemd/e-webui.service` and scripts to confirm that service naming uses `e-webui` and that container-level infrastructure is untouched.

### Implementation for User Story 3

- [X] T014 [P] [US3] Rename workspace systemd unit file from `app/systemd/ollama-webui.service` to `app/systemd/e-webui.service` and update service description to `e-webui - Lightweight Ollama Web UI`
- [X] T015 [P] [US3] Update service names and log references in `scripts/deploy.sh` from `ollama-webui` to `e-webui`, while preserving Incus container name variable `CONTAINER_NAME="${1:-webui}"` and third-party `open-webui` checks per Principle I
- [X] T016 [P] [US3] Update test runner header and banner text from "Ollama Web UI" to "e-webui" in `scripts/test.sh`

**Checkpoint**: Operational templates, service units, and deployment scripts reflect `e-webui`.

---

## Phase 6: Polish & Quality Assurance

**Purpose**: Cross-cutting verification, regex audits, accessibility confirmation, and governance review

- [X] T017 Run workspace audit script `specs/002-rebrand-e-webui/scratch/audit_names.py` to confirm zero remaining legacy occurrences (`ellie-ollama-webui`, `Ollama Web UI`, `Web UI`, `webui`) in workspace files except allowed exclusions
- [X] T018 Execute `quickstart.md` validation scenarios (Scenario 1 through Scenario 5) in `specs/002-rebrand-e-webui/quickstart.md`
- [X] T019 Audit workspace changes against Constitution Principle I and Principle III to ensure zero container or Incus infrastructure modifications and complete manual operator hand-off guidance

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1; establishes design tokens and animations in CSS.
- **User Story 1 (Phase 3)**: Depends on Phase 2; implements brand logo HTML and CSS rules.
- **User Story 2 (Phase 4)**: Can run in parallel with or immediately after Phase 3; updates UI text, Python files, and documentation.
- **User Story 3 (Phase 5)**: Can run after Phase 4; updates operational files and deployment scripts.
- **Polish (Phase 6)**: Depends on completion of all stories (Phase 3, Phase 4, Phase 5).

### Parallel Opportunities

- **Phase 2**: T002 and T003 can be authored simultaneously.
- **Phase 4**: T008 (`index.html`), T009 (`main.py`), T010 (`config.py`/`models.py`), T011 (`app.js`), and T012 (`README.md`) touch distinct files and can run in parallel.
- **Phase 5**: T014 (`e-webui.service`), T015 (`deploy.sh`), and T016 (`test.sh`) touch distinct files and can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Update backend and frontend files in parallel:
Task: "Update application title <title>e-webui</title> and empty state description in app/static/index.html"
Task: "Update FastAPI application metadata and logger in app/main.py"
Task: "Update docstrings and configuration titles from legacy names to e-webui in app/config.py and app/models.py"
Task: "Update frontend header comment from Ollama Web UI to e-webui in app/static/app.js"
Task: "Update application headings, descriptions, and architecture text from legacy names to e-webui in README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational CSS tokens & animations).
2. Complete Phase 3 (User Story 1 - Brand Logo markup and layout in `style.css` and `index.html`).
3. **STOP and VALIDATE**: Test brand logo in browser (visual rendering, responsive scaling, cursor blink, reduced-motion pause).
4. Deliver working MVP.

### Incremental Delivery
1. Foundational ready → CSS tokens and animations available.
2. User Story 1 complete → Brand logo live in chat header (MVP).
3. User Story 2 complete → All workspace text, titles, docstrings, and docs rebranded to `e-webui`.
4. User Story 3 complete → Systemd service unit renamed and deploy scripts aligned.
5. Polish complete → Full codebase audited with zero stray legacy names; constitution checks verified.
