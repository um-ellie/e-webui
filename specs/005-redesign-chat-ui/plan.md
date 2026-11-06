# Implementation Plan: Chat UI Redesign & Thinking Toggle with Pastel Developer Aesthetic

**Branch**: `005-redesign-chat-ui` | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-redesign-chat-ui/spec.md`

## Summary

Complete redesign of the chat user interface located in `app/static/` (`index.html`, `style.css`, `app.js`) to provide a refined, modern developer aesthetic using soft pastel color palettes (Light Pastel Blue `#EBF3FA` default with Dark Pastel Navy `#191F2D` switcher option). The redesign introduces the official `> ~/.E_` developer brand logo with pastel burgundy (`#BA4659`), pastel violet (`#7A5EA7`), and a non-shifting blinking underscore cursor. In addition, an interactive Thinking Mode control is introduced both on the frontend and in the generation API (`PromptRequest.thinking`), allowing users to toggle whether reasoning chains are generated and displayed.

## Technical Context

**Language/Version**: Python 3.11+, HTML5, Modern CSS3, Vanilla ES6+ JavaScript  
**Primary Dependencies**: FastAPI (>=0.110.0), Uvicorn (>=0.28.0), HTTPX (>=0.27.0), Pydantic (>=2.6.0) (Zero new frontend dependencies)  
**Storage**: Browser `localStorage` (`ewebui_settings`) for client preferences  
**Testing**: Mock-based pytest integration/unit test suite; browser visual inspection and responsive layout verification  
**Target Platform**: Linux host, modern web browsers (Chrome, Firefox, Safari, Edge, mobile browsers)  
**Project Type**: Single-Page Web Application & REST/SSE microservice  
**Performance Goals**: <100ms first paint, 60fps logo blinking animation without container reflows, instant toggle switching  
**Constraints**: Constitution Principle I (Infrastructure Isolation): Zero interaction with Incus containers; all modifications remain strictly within workspace repository files (`app/static/`, `app/models.py`, `app/services/ollama_client.py`)  
**Scale/Scope**: Frontend assets in `app/static/` plus minor backward-compatible parameter addition in `app/models.py` and `app/services/ollama_client.py`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Plan Compliance Status | Notes |
|---|---|---|---|
| **Principle I: Infrastructure Isolation** | No interaction with Incus containers, profiles, devices, or incus CLI. | **PASSED** | The entire feature consists of static web assets and FastAPI route adjustments within the workspace. No container commands will be executed. |
| **Principle II: Workspace-Only Scope Boundary** | All modifications confined to workspace directory. | **PASSED** | Only files in `app/static/`, `app/models.py`, `app/services/ollama_client.py`, and `specs/` are modified. |
| **Principle III: Transparent Delegation & Manual Hand-offs** | Document manual verification instructions for user. | **PASSED** | `quickstart.md` provides explicit local run commands (`python3 -m uvicorn app.main:app`) and verification checklists. |

*GATE STATUS: PASSED*

## Project Structure

### Documentation (this feature)

```text
specs/005-redesign-chat-ui/
├── spec.md                  # Feature specification
├── plan.md                  # Implementation plan (this file)
├── research.md              # Phase 0 output: theme, logo & thinking decisions
├── data-model.md            # Phase 1 output: preferences, theme tokens & payloads
├── quickstart.md            # Phase 1 output: quickstart verification guide
├── checklists/
│   └── requirements.md      # Specification quality checklist
├── contracts/
│   └── ui-and-api-contract.md # Phase 1 output: logo, toolbar & SSE API contract
└── tasks.md                 # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
app/
├── config.py                 # Configuration settings
├── main.py                   # FastAPI entrypoint (serves static/ and routes)
├── models.py                 # Pydantic schemas (add optional thinking to PromptRequest)
├── services/
│   └── ollama_client.py      # Ollama client (support thinking suppression / parameter)
└── static/
    ├── index.html            # Redesigned semantic layout, header, toolbar, welcome state
    ├── style.css             # Pastel light/dark theme variables, logo, responsive styles
    └── app.js                # State management, thinking toggle, theme switch, streaming
```

**Structure Decision**: Single web application layout modifying existing frontend assets in `app/static/` with minimal backward-compatible schema updates in `app/models.py` and `app/services/ollama_client.py`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | Fully adheres to existing vanilla JS/CSS architecture with zero extra dependencies |
