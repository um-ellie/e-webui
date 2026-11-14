# Implementation Plan: Offline LLM Diagnostics & Live Inference Metrics

**Branch**: `018-offline-llm-diagnostics` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/018-offline-llm-diagnostics/spec.md`  

---

## Summary

Implement real-time Time to First Token (TTFT) and live generation throughput (`tok/s`) tracking, comprehensive turn performance diagnostics (prompt evaluation, generation speed, memory load duration), and a persistent container/proxy connection health status pill and diagnostics popover. All metrics and health probes operate strictly client-side and through existing backend proxy endpoints without host container modifications.

---

## Technical Context

**Language/Version**: Python 3.11+ (FastAPI backend), Vanilla JavaScript ES6 (Modular frontend, zero build step)  
**Primary Dependencies**: FastAPI, httpx, pydantic (Backend); native DOM, `performance.now()`, `requestAnimationFrame` (Frontend)  
**Storage**: Client-side IndexedDB (`ewebui_db` v1 via `storageService` and `db.js`) for persistent message turn metrics  
**Testing**: Python `unittest` (`test_ollama_client.py`, `test_stream_pipeline.py`, `test_ui_contracts.py`)  
**Target Platform**: Linux web interface running inside Incus container `e-webui-app`  
**Project Type**: Web application (FastAPI backend + Vanilla ES6 SPA frontend)  
**Performance Goals**: Live streaming speed updates on $\ge 40\text{ ms}$ throttled frame; health probes $< 15\text{ ms}$ local latency; zero UI jank  
**Constraints**: 100% offline self-hosted; zero external CDN calls; zero mutations to host containers (Constitution Principle I & II)  
**Scale/Scope**: Single-page chat interface supporting multi-model switches and long conversation turns  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Status | Notes |
|---|---|---|---|
| **Principle I: Infrastructure Isolation** | Does this plan require `incus file push`, `incus restart`, or container package installation? | **✓ PASS** | Zero host container modifications. Uses standard HTTP calls through existing proxy. |
| **Principle II: Workspace Scope Boundary** | Are all changes confined strictly to `app/`, `tests/`, and `specs/`? | **✓ PASS** | All source code, styles, tests, and specs are written inside workspace repository. |
| **Principle III: Transparent Delegation** | Are deployment and runtime steps clearly documented for manual user execution? | **✓ PASS** | User retains full operational control over container lifecycle. |

---

## Project Structure

### Documentation (this feature)

```text
specs/018-offline-llm-diagnostics/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Technical research & decisions (Phase 0)
├── data-model.md        # Data models & schemas (Phase 1)
├── quickstart.md        # Validation scenarios & testing guide (Phase 1)
├── contracts/           # Interface contracts (Phase 1)
│   ├── metrics-contract.md
│   └── health-probe-contract.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code Impact

```text
app/
├── models.py                  # Extend HealthResponse and StreamChunk with latency and eval metrics
├── services/
│   └── ollama_client.py       # Measure round-trip ping latency and forward prompt_eval / load duration
├── main.py                    # Update /api/health endpoint handler to populate latency & active models
└── static/
    ├── js/
    │   ├── api.js             # Capture requestDispatchedAt and firstTokenReceivedAt for TTFT
    │   ├── store.js           # Add connectionHealth state and persist turn metrics
    │   ├── components/
    │   │   ├── header.js      # Add connection health status pill and diagnostics popover
    │   │   └── chat.js        # Render live tok/s badge, TTFT, and turn diagnostics popover
    │   └── features.js        # Register diagnostics UI feature flags
    └── style.css              # Add status dot, diagnostics popover, and metrics badge styling

tests/unit/
├── test_ollama_client.py      # Unit tests for latency measurement and models discovery
├── test_stream_pipeline.py    # Unit tests for StreamChunk metrics forwarding
└── test_ui_contracts.py       # Validate UI contracts and feature flag definitions
```

---

## Phase 0: Research Summary

Refer to [research.md](research.md). Key resolutions:
1. **TTFT & Live Speed Calculation**: Captured client-side at `performance.now()` arrival of first chunk. In-flight speed calculated via rolling window and rendered on throttled RAF frame.
2. **Container Health Probes**: Measured in `OllamaClient.check_health()` via monotonic ping; active models discovered via `/api/ps` or active list. Polled every 30s, paused during background tab invisibility.
3. **UI Layout**: Unobtrusive header health pill with popover + turn metadata pill with expandable diagnostics table. Strictly LTR monospace isolated.

---

## Phase 1: Design & Contracts Summary

1. **Data Model**: Defined in [data-model.md](data-model.md) (`TurnPerformanceMetrics`, `StreamingDiagnosticsState`, `ConnectionHealthSnapshot`, updated `HealthResponse`, updated `StreamChunk`).
2. **Contracts**:
   - [contracts/metrics-contract.md](contracts/metrics-contract.md): Governs TTFT, rolling speed, completion speed, and turn metadata pill.
   - [contracts/health-probe-contract.md](contracts/health-probe-contract.md): Governs `/api/health` schema, health status thresholds, visibility-based polling, and popover DOM.
3. **Quickstart**: Defined in [quickstart.md](quickstart.md).

---

## Re-evaluation of Constitution Check Post-Design

* Post-design evaluation confirms:
  * No external network dependencies or CDN links introduced.
  * No host container configuration or systemd modifications required.
  * Fully isolated in workspace code and mock-based unit tests.
  * Status: **ALL GATES PASS**.
