# Tasks: System Prompt Presets & Model Parameter Controls

**Input**: Design documents from `specs/019-system-prompt-presets/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/parameters-contract.md`, `quickstart.md`  

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize preset module, built-in personas, and feature flags.

- [X] T001 Create `app/static/js/presets.js` defining built-in immutable presets ("Helpful Assistant", "Coding Specialist", "Concise Editor", "Academic Explainer") with default sampling values
- [X] T002 [P] Update `app/static/js/features.js` to set status of `model.system_prompt` and `model.temperature_tune` to `'enabled'`

---

## Phase 2: Foundational (Backend Schema, Options Proxy & Storage)

**Purpose**: Core backend schema extension and client persistence pipeline that blocks user stories.

- [X] T003 [P] Add unit tests in `tests/unit/test_stream_pipeline.py` validating `PromptRequest` schema with `top_p` ("$0.0 \le p \le 1.0$, default 0.9") and `num_ctx` ("$512 \le c \le 131072$, default None")
- [X] T004 Extend `PromptRequest` in `app/models.py` with `top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0)` and `num_ctx: Optional[int] = Field(default=None, ge=512, le=131072)`
- [X] T005 [P] Add unit tests in `tests/unit/test_ollama_client.py` verifying that `stream_generate` forwards `options.temperature`, `options.top_p`, `options.num_ctx`, and `system` to Ollama POST payload
- [X] T006 Update `stream_generate` in `app/services/ollama_client.py` to forward `top_p` and `num_ctx` in `payload["options"]` and `system` instruction to Ollama `/api/generate`
- [X] T007 Update `streamGenerate` in `app/static/js/api.js` to accept and serialize `top_p` and `num_ctx` in the `/api/generate` request body
- [X] T008 Update session lifecycle in `app/static/js/store.js` to initialize and track `systemPrompt: null`, `presetId: null`, `temperature: 0.7`, `topP: 0.9`, and `numCtx: null` across session switches

**Checkpoint**: Core pipeline ready — backend validates and proxies parameters, store tracks session parameters.

---

## Phase 3: User Story 1 - System Prompt Presets & Session Persona Selection (Priority: P1) 🎯 MVP

**Goal**: Provide curated built-in system prompt presets and custom session instructions that apply to inference.  
**Independent Test**: Select "Coding Specialist" preset in composer popover, send a message, and verify system prompt is included in `/api/generate` request.

- [X] T009 [P] [US1] Add unit test in `tests/unit/test_ui_contracts.py` verifying `FEATURE_REGISTRY` enables `model.system_prompt` and `model.temperature_tune`
- [X] T010 [US1] Add composer parameter popover trigger button (`.pill-params`) and popover markup (`#params-popover`) with preset dropdown and custom system prompt textarea ("max 10,000 chars") in `app/static/index.html`
- [X] T011 [P] [US1] Add CSS styles for parameters trigger pill (`.pill-params`), popover container (`.params-popover`), preset select, and auto-sizing textarea in `app/static/style.css`
- [X] T012 [US1] Implement preset selection and custom system prompt binding in `app/static/js/components/composer.js`, syncing active persona with `store.js`
- [X] T013 [US1] Update message submission in `app/static/js/components/composer.js` to pass active session's `systemPrompt`, `temperature`, `top_p`, and `num_ctx` to `api.streamGenerate()`

**Checkpoint**: User Story 1 complete — built-in persona selection and custom system instructions function end-to-end.

---

## Phase 4: User Story 2 - Sampling Parameter Controls & Intuitive Sliders (Priority: P2)

**Goal**: Provide interactive sliders for Temperature ($0.0 - 2.0$, default 0.7, step 0.05), Top-P ($0.0 - 1.0$, default 0.9, step 0.05), Context Window select, and quick shortcuts ("Deterministic / Code", "Balanced", "Creative").  
**Independent Test**: Move Temperature slider to 0.2, verify numeric readout updates, click "Creative" shortcut, and verify sliders snap to 1.2 / 0.95 and update active session.

- [X] T014 [US2] Add Temperature slider ($0.0 - 2.0$, step 0.05), Top-P slider ($0.0 - 1.0$, step 0.05), Context Window select ($2048, 4096, 8192, 16384$), and quick shortcut chips to `#params-popover` in `app/static/index.html`
- [X] T015 [P] [US2] Add CSS styling for parameter sliders, numeric badges (`.param-badge`), and shortcut chip buttons in `app/static/style.css`
- [X] T016 [US2] Wire parameter slider event listeners and shortcut click handlers in `app/static/js/components/composer.js` to update session parameters and sync UI readouts
- [X] T017 [US2] Unlock and wire Temperature and System Prompt inputs in Settings dialog `tab-models` in `app/static/js/components/settings.js`

**Checkpoint**: User Story 2 complete — sampling parameters can be adjusted via sliders, quick shortcuts, or settings modal.

---

## Phase 5: User Story 3 - Custom User Presets Management (Priority: P3)

**Goal**: Enable users to create, name, update, duplicate, and delete custom presets persisted offline in IndexedDB.  
**Independent Test**: Save a custom preset named "SQL Optimizer", reload browser, and verify it appears in the presets dropdown and persists offline.

- [X] T018 [P] [US3] Add unit tests in `tests/unit/test_export_and_storage.py` validating custom preset serialization and offline persistence cascade
- [X] T019 [US3] Implement `saveCustomPreset`, `deleteCustomPreset`, and `loadCustomPresets` in `app/static/js/storage.js` using IndexedDB `preferences` store with `localStorage` fallback
- [X] T020 [US3] Implement "Save as Preset" and "Delete Preset" modal actions in `app/static/js/presets.js` and `app/static/js/components/composer.js`

**Checkpoint**: User Story 3 complete — custom presets persist across browser restarts and offline reloads.

---

## Phase 6: User Story 4 - Visual Status Indicators & Export Transparency (Priority: P4)

**Goal**: Display active persona/parameter badge in composer/header and include full generation provenance in Markdown and JSON exports.  
**Independent Test**: Set a custom preset or temperature, verify active tag appears in composer (`⚡ Coding Specialist · 0.2`), export conversation to Markdown and JSON, and verify frontmatter/metadata parameters.

- [X] T021 [P] [US4] Add active persona tag element (`.active-persona-pill`) in composer toolbar in `app/static/index.html` and `app/static/style.css`
- [X] T022 [US4] Update session change listeners in `app/static/js/components/composer.js` to render and update active persona tag on session switch or preset change
- [X] T023 [P] [US4] Update `app/static/js/export.js` to serialize `preset`, `system_prompt`, `temperature`, `top_p`, and `context_window` in Markdown frontmatter and JSON conversation exports

**Checkpoint**: User Story 4 complete — active settings visually indicated and exported with complete provenance.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Regression testing, verification, and quickstart scenarios.

- [X] T024 [P] Run full test suite in `tests/unit/` to verify zero regressions across streaming, storage, and models
- [X] T025 Execute end-to-end validation scenarios documented in `specs/019-system-prompt-presets/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: No dependencies — executes immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — blocks all user stories.
- **Phase 3 (US1 - Presets & Session Instructions)**: Depends on Phase 2 — unlocks MVP.
- **Phase 4 (US2 - Sampling Controls & Sliders)**: Depends on Phase 2 and Phase 3.
- **Phase 5 (US3 - Custom Preset Management)**: Depends on Phase 2 and Phase 3.
- **Phase 6 (US4 - Indicators & Export Provenance)**: Depends on Phase 3 and Phase 4.
- **Phase 7 (Polish)**: Depends on all user stories being complete.

### Parallel Opportunities
- `T001` and `T002` in Setup.
- `T003` (schema tests) and `T005` (client tests) in Foundational.
- `T010` (HTML) and `T011` (CSS) in User Story 1.
- `T014` (HTML) and `T015` (CSS) in User Story 2.
- `T018` (storage tests) and `T021` (indicator styles).
- `T023` (export updates) and `T024` (regression suite).

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1: Built-in presets, custom system prompt, parameter forwarding).
3. Validate independent test: select "Coding Specialist", send query, verify concise code output.

### Incremental Delivery
1. Add User Story 2 (Sliders & quick shortcut chips).
2. Add User Story 3 (Custom preset CRUD & offline IndexedDB storage).
3. Add User Story 4 (Active pill & export provenance).
4. Run full regression suite and quickstart validation.
