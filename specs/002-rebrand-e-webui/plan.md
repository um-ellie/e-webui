# Implementation Plan: Rebrand to e-webui & Brand Logo Integration

**Branch**: `002-rebrand-e-webui` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-rebrand-e-webui/spec.md`

## Summary

Rebrand the application throughout the workspace to the canonical name `e-webui` (always lowercase with a hyphen), executing an ordered descending-length replacement (`ellie-ollama-webui` → `Ollama Web UI` → `Web UI` → `webui`) while preserving third-party dependencies and container runtime configurations. In addition, introduce the brand logo `> ~/.E _` into the chat header using native CSS variables (`--logo-prompt`, `--logo-text`), responsive typography (~28px mobile, ~34px desktop), terminal cursor blink animation with `prefers-reduced-motion: reduce` pausing, screen-reader accessibility (`aria-label="e-webui"`), and isolated bidirectional rendering (`dir="ltr"`, `unicode-bidi: isolate`).

## Technical Context

**Language/Version**: Python 3.11+, HTML5, CSS3, Vanilla JavaScript (ES6+)  
**Primary Dependencies**: FastAPI (>=0.110.0), Uvicorn (>=0.28.0), HTTPX (>=0.27.0), Pydantic (>=2.6.0) (Zero new frontend or backend dependencies)  
**Storage**: N/A (Stateless streaming chat client with direct SSE forwarding from Ollama API)  
**Testing**: Mock-based pytest integration/unit test suite; static code and CSS regex audits; DOM accessibility verification  
**Target Platform**: Linux server host / modern mobile and desktop web browsers  
**Project Type**: Single-Page Web Application & REST/SSE microservice  
**Performance Goals**: <50ms initial HTML/CSS load time, instantaneous streaming token rendering, zero jank 60fps cursor blink  
**Constraints**: Constitution Principle I (Infrastructure Isolation): Zero interaction with Incus containers; container names (`webui`) and proxy devices (`webui-proxy`) must not be touched by the agent, only documented for manual operator updates  
**Scale/Scope**: Single workspace repository (`app/`, `tests/`, `scripts/`, `specs/`, `README.md`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Plan Compliance Status | Notes |
|---|---|---|---|
| **Principle I: Infrastructure Isolation** | No interaction with Incus containers, profiles, or devices under any circumstances. Container names and devices must not be renamed by agent. | **PASSED** | Rebranding applies strictly to workspace application files. Incus container name (`webui`) and proxy devices (`webui-proxy`) are explicitly protected from automated changes and documented for manual operator handling. |
| **Principle II: Workspace-Only Scope Boundary** | All development and modifications remain within repository. | **PASSED** | Only files in `/home/ellie/Documents/Projects/ellie-ollama-webui` will be touched. |
| **Principle III: Transparent Delegation & Manual Hand-offs** | Document manual commands for container deployment/renaming. | **PASSED** | `quickstart.md` and final hand-off report provide step-by-step instructions for the operator if they choose to rename their Incus container. |

*GATE STATUS: PASSED*

## Project Structure

### Documentation (this feature)

```text
specs/002-rebrand-e-webui/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 decisions & research
├── data-model.md        # Phase 1 data entities & config
├── quickstart.md        # Phase 1 quickstart & verification guide
├── checklists/
│   └── requirements.md  # Specification quality checklist
├── contracts/
│   └── brand-logo-contract.md # UI markup, CSS, and accessibility contract
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
app/
├── __init__.py
├── config.py                 # Configuration settings (title & logger updated to e-webui)
├── main.py                   # FastAPI entrypoint (app title, metadata & logger updated)
├── models.py                 # Pydantic schema models
├── services/
│   ├── __init__.py
│   └── ollama_client.py      # Ollama HTTP client
├── static/
│   ├── app.js                # Frontend streaming logic
│   ├── index.html            # Single-page UI with new brand logo header
│   └── style.css             # CSS tokens (--logo-prompt, --logo-text), responsive styles & animations
└── systemd/
    └── e-webui.service       # Renamed from ollama-webui.service

scripts/
├── deploy.sh                 # Deployment script updated with e-webui app naming while preserving container defaults
└── test.sh                   # Test runner

tests/
├── conftest.py               # Shared pytest fixtures
├── integration/
│   └── test_endpoints.py     # FastAPI endpoint integration tests
└── unit/
    └── test_ollama_client.py # Client unit tests

README.md                     # Documentation updated to reflect e-webui
```

**Structure Decision**: Retain the existing lean single-project directory layout (`app/`, `tests/`, `scripts/`), renaming the systemd service template to `e-webui.service` and adding CSS/HTML tokens directly in the static assets without introducing extra build systems or npm dependencies.

## Complexity Tracking

> *No constitutional violations or unnecessary architectural patterns detected.*

| Item | Status | Justification |
|---|---|---|
| Zero additional dependencies | Clean | Uses vanilla CSS variables and keyframes instead of pulling in Tailwind/React |
| Manual Container Delegation | Compliant | Strictly adheres to Principle I and Principle III |
