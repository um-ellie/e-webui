---
description: "Task list for Offline LLM Diagnostics and Live Inference Metrics"
---

# Tasks: Offline LLM Diagnostics and Live Inference Metrics

**Input**: Design documents from `/specs/018-offline-llm-diagnostics/`  
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/metrics-contract.md](contracts/metrics-contract.md), [contracts/health-probe-contract.md](contracts/health-probe-contract.md), [quickstart.md](quickstart.md)  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story increment.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `[US1]`, `[US2]`, `[US3]`)
- Every task includes exact file paths in its description.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register diagnostics feature flags and extend backend response models.

- [X] T001 Register diagnostics and container health flags (`diagnostics.metrics` and `diagnostics.container_health`) in `app/static/js/features.js`
- [X] T002 [P] Extend `HealthResponse` schema in `app/models.py` with `latency_ms: Optional[float] = None` and `loaded_models: List[str] = Field(default_factory=list)`
- [X] T003 [P] Extend `StreamChunk` schema in `app/models.py` with optional telemetry fields `eval_duration: Optional[int] = None`, `prompt_eval_count: Optional[int] = None`, `prompt_eval_duration: Optional[int] = None`, and `load_duration: Optional[int] = None`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend proxy latency measurement, model inspection, and stream telemetry forwarding.

**⚠️ CRITICAL**: Must complete before user story UI implementation begins.

- [X] T004 Implement round-trip latency measurement and `/api/ps` model discovery in `app/services/ollama_client.py` (`OllamaClient.check_health` and `OllamaClient.get_loaded_models`)
- [X] T005 Update `GET /api/health` handler in `app/main.py` to measure latency, query loaded models, and return enriched `HealthResponse`
- [X] T006 Update `OllamaClient.stream_generate` in `app/services/ollama_client.py` to forward `eval_duration`, `prompt_eval_count`, `prompt_eval_duration`, and `load_duration` when `done` is true
- [X] T007 [P] Add unit test assertions in `tests/unit/test_ollama_client.py` and `tests/unit/test_stream_pipeline.py` verifying latency calculation, models discovery fallback, and telemetry chunk serialization

**Checkpoint**: Foundation ready - backend proxy delivers latency, health snapshots, and full stream telemetry.

---

## Phase 3: User Story 1 - Real-Time Inference Speed & Time to First Token (Priority: P1) 🎯 MVP

**Goal**: Capture Time to First Token (TTFT) upon first chunk arrival, calculate live rolling tokens/second during streaming on throttled animation frames, and persist final generation speed in message history.

**Independent Test**: Send a prompt to any local model; verify that TTFT is recorded and displayed, live tok/s speed updates dynamically during streaming, and final speed summary appears in message footer upon turn completion.

### Implementation for User Story 1
- [X] T008 [US1] Record `requestDispatchedAt`, capture `firstTokenReceivedAt`, compute `timeToFirstTokenMs`, and calculate rolling generation speed in `app/static/js/api.js` (`streamGenerate`)
- [X] T009 [US1] Update `store.updateMessage()` in `app/static/js/store.js` to structure `TurnPerformanceMetrics` and persist metrics to IndexedDB
- [X] T010 [US1] Implement live in-flight generation speed badge (`⚡ XX.X tok/s · TTFT X.Xs`) in `app/static/js/components/chat.js`, updating on throttled animation frames
- [X] T011 [US1] Render completed turn metadata pill (`model · speed tok/s · TTFT · duration`) in `app/static/js/components/chat.js` (`createMessageActions`)
- [X] T012 [P] [US1] Add styling for in-flight `.streaming-metrics-badge` and completed `.btn-meta-pill` with strict LTR monospace isolation in `app/static/style.css`

**Checkpoint**: User Story 1 (MVP) is fully functional and delivers transparent real-time inference speed and TTFT metrics.

---

## Phase 4: User Story 2 - Container & Ollama Health Indicator and Popover (Priority: P2)

**Goal**: Provide an unobtrusive status pill in the application header showing container reachability (Operational / High Latency / Disconnected) with an interactive diagnostics popover and tab inactivity throttling.

**Independent Test**: View the header health indicator; click to open the popover; verify round-trip latency in milliseconds, container status, and active models are displayed with a manual "Check Now" button.

### Implementation for User Story 2
- [X] T013 [US2] Implement `api.checkHealth()` in `app/static/js/api.js` to call `GET /api/health` and return connection health snapshot
- [X] T014 [US2] Implement `connectionHealth` state management and 30-second polling lifecycle in `app/static/js/store.js`, pausing when `document.hidden` is true and resuming upon tab visibility
- [X] T015 [US2] Render header connection health status pill (`.health-indicator-btn`) with color-coded dot and status label in `app/static/js/components/header.js`
- [X] T016 [US2] Implement interactive diagnostics popover (`.health-popover`) in `app/static/js/components/header.js` displaying container state, latency in ms, loaded models, and manual "Check Now" button
- [X] T017 [P] [US2] Add styling rules for `.health-indicator-btn`, `.health-dot` states (operational, degraded, disconnected), and `.health-popover` card with dark mode adaptivity in `app/static/style.css`

**Checkpoint**: User Stories 1 AND 2 are fully functional and testable independently.

---

## Phase 5: User Story 3 - Comprehensive Turn Performance Diagnostics Modal (Priority: P3)

**Goal**: Allow clicking the turn metadata badge to view an expanded diagnostics table (Prompt Eval tokens & throughput, Generation tokens & speed, Model load duration, Total duration), preserving metrics in conversation exports.

**Independent Test**: Click any completed turn metadata pill; verify an accessible diagnostics popover displays prompt evaluation throughput, generation throughput, model load duration, and total latency.

### Implementation for User Story 3
- [X] T018 [US3] Implement turn diagnostics popover modal in `app/static/js/components/chat.js` triggered by clicking `.btn-meta-pill`, displaying full prompt evaluation, generation speed, and load duration table
- [X] T019 [P] [US3] Add styling for turn diagnostics popover (`.turn-diagnostics-popover`) with tabular grid layout, badge accents, and dismiss backdrop in `app/static/style.css`
- [X] T020 [US3] Update conversation exports in `app/static/js/export.js` to include turn performance metrics (model, speed, TTFT) in Markdown and JSON export outputs

**Checkpoint**: All three user stories are complete, visually polished, and responsive.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Test execution, verification, and code cleanup.

- [X] T021 [P] Run automated unit test suites `tests/unit/test_ollama_client.py`, `tests/unit/test_stream_pipeline.py`, and `tests/unit/test_ui_contracts.py` and verify all tests pass
- [X] T022 Execute manual verification scenarios documented in `specs/018-offline-llm-diagnostics/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
┌──────────────────────────────────────────────┐
│             Phase 1: Setup                   │
│   (Features registration & schema models)    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          Phase 2: Foundational               │
│   (Latency probes, /api/health, chunk fields)│
└──────────────────────┬───────────────────────┘
                       │
        ┌──────────────┴───────────────┐
        ▼                              ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ Phase 3: User Story 1   │ │ Phase 4: User Story 2   │
│ (TTFT & Live tok/s MVP) │ │ (Health Pill & Popover) │
└──────────────┬──────────┘ └───────────┬─────────────┘
               │                        │
               └───────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │ Phase 5: User Story 3   │
              │ (Turn Diagnostics Popover)
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │     Phase 6: Polish     │
              │   (Tests & Validation)  │
              └─────────────────────────┘
```

- **Phase 1 (Setup)**: No dependencies - can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 - **BLOCKS all user stories**.
- **Phase 3 (User Story 1)**: Depends on Phase 2 - delivers core real-time speed and TTFT metrics (MVP).
- **Phase 4 (User Story 2)**: Depends on Phase 2 - delivers container health indicator and popover.
- **Phase 5 (User Story 3)**: Depends on Phase 3 and Phase 4.
- **Phase 6 (Polish)**: Depends on all user stories being complete.

---

## Parallel Opportunities

- **Setup Phase**: T002 (`HealthResponse`) and T003 (`StreamChunk`) can run in parallel.
- **Foundational Phase**: T007 (unit tests) can run in parallel with backend implementation.
- **User Story 1**: T012 (`style.css` metrics styling) can run in parallel with JS logic (T008–T011).
- **User Story 2**: T017 (`style.css` health popover styling) can run in parallel with header component work (T013–T016).
- **User Story 3**: T019 (`style.css` turn popover styling) can run in parallel with T018 and T020.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup: register feature flags, extend schemas).
2. Complete Phase 2 (Foundational: measure latency, forward stream telemetry).
3. Complete Phase 3 (User Story 1: TTFT capture, rolling speed, completed turn metadata pill).
4. **STOP and VALIDATE**: Send prompt; verify live tok/s, TTFT, and completed metadata in message actions.

### Incremental Delivery
1. **Increment 1 (MVP)**: Live tok/s speed indicator and Time to First Token (US1).
2. **Increment 2**: Header container health indicator, latency readout, and diagnostics popover with tab invisibility throttling (US2).
3. **Increment 3**: Expandable turn performance diagnostics table modal and export persistence (US3).
4. **Increment 4**: Full test suite validation and quickstart check (Polish).
