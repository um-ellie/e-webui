# Implementation Plan: System Prompt Presets & Model Parameter Controls

**Branch**: `019-system-prompt-presets` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-system-prompt-presets/spec.md`

## Summary

Implement system prompt persona presets (built-in + user-created custom presets) and fine-grained sampling parameter controls (Temperature, Top-P, Context Window `num_ctx`) in the `e-webui` interface and inference proxy pipeline. The feature unlocks `model.system_prompt` and `model.temperature_tune` in the `FEATURE_REGISTRY`, introduces an accessible parameter tuning popover directly in the composer toolbar, unlocks the Settings modal's Models tab, persists custom presets and session parameters offline via IndexedDB, and embeds active generation parameters into Markdown and JSON export formats.

## Technical Context

**Language/Version**: Python 3.10+ (FastAPI backend), ECMAScript 2022 / ES6 modules (client UI)  
**Primary Dependencies**: FastAPI, Pydantic v2, httpx (backend); Vanilla JS, Prism.js, marked.js, DOMPurify (frontend)  
**Storage**: Client-side IndexedDB (`preferences` store for custom presets, `sessions` store for conversation parameters) with `localStorage` fallback  
**Testing**: Python `unittest` (`test_ollama_client.py`, `test_stream_pipeline.py`, `test_ui_contracts.py`, `test_export_and_storage.py`)  
**Target Platform**: Linux (self-hosted Incus container proxy + offline browser client)  
**Project Type**: Web application (FastAPI backend + vanilla modern ES6 frontend)  
**Performance Goals**: Parameter panel opens in $< 50\text{ ms}$; preset switching applies in $< 20\text{ ms}$; zero streaming latency overhead  
**Constraints**: Strict offline operation (100% self-hosted assets, zero external CDN links); Project Constitution Principle I (Infrastructure Isolation) strictly enforced  
**Scale/Scope**: Hundreds of custom user presets in IndexedDB; per-session parameter retention across unlimited chat turns  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Infrastructure Isolation (NON-NEGOTIABLE)**: PASS. No container alterations, no package installations, no service restarts or `incus` commands required.
- **Principle II: Workspace-Only Scope Boundary**: PASS. All code, templates, and tests reside strictly within the workspace (`app/`, `tests/`, `specs/`).
- **Principle III: Transparent Delegation & Manual Execution Hand-offs**: PASS. All automated testing uses offline unit test runners and mock payloads.

## Project Structure

### Documentation (this feature)

```text
specs/019-system-prompt-presets/
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 research decisions and technical evaluation
├── data-model.md        # Phase 1 entity schemas and state transitions
├── contracts/           # Phase 1 interface contracts
│   └── parameters-contract.md
├── quickstart.md        # Phase 1 validation scenarios
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code Layout

```text
app/
├── models.py                   # Extend PromptRequest with top_p and num_ctx
├── main.py                     # Verify /api/generate endpoint parameter handling
├── services/
│   └── ollama_client.py        # Forward options (temperature, top_p, num_ctx) and system to Ollama
└── static/
    ├── index.html              # Composer parameters pill & popover anchor; unlocked Models tab in settings
    ├── style.css               # Styling for parameters popover, sliders, and active persona tags
    └── js/
        ├── api.js              # Include top_p, num_ctx, system in /api/generate payload
        ├── store.js            # Bind presetId, systemPrompt, temperature, topP, numCtx to session
        ├── storage.js          # Persist custom presets to IndexedDB preferences store
        ├── presets.js          # Built-in presets, custom preset CRUD, and defaults
        ├── features.js         # Enable model.system_prompt and model.temperature_tune
        ├── export.js           # Include parameters & persona in Markdown/JSON exports
        └── components/
            ├── composer.js     # Parameters trigger button, active persona badge, generation dispatch
            └── settings.js     # Models tab controls (global defaults, preset management)

tests/unit/
├── test_ollama_client.py       # Parameter options forwarding
├── test_stream_pipeline.py     # PromptRequest validation with top_p & num_ctx
├── test_ui_contracts.py        # Feature registry status checks
└── test_export_and_storage.py  # Preset persistence and export metadata verification
```

**Structure Decision**: Standard full-stack web application structure (`app/` backend and static frontend assets; `tests/` unit suites).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | No constitutional or complexity violations. | Simple, self-contained client-side ES6 module and FastAPI schema extension. |
