# Implementation Plan: Secure Ollama Web UI Container

**Branch**: `001-ollama-web-ui` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-ollama-web-ui/spec.md`

## Summary

A lightweight, responsive, and secure Web UI for Ollama running inside a dedicated Incus container (`webui`). The application uses Python 3 with FastAPI and an asynchronous `httpx` client to stream model responses via Server-Sent Events (SSE) to an embedded, self-contained single-page chat interface. It replaces heavyweight alternatives with an ultra-efficient service consuming under 50 MB of RAM, starts automatically on container boot via a native `systemd` unit, communicates with the Ollama container via an isolated Incus proxy device (`ollama-link`), and restricts all incoming access strictly to host loopback (`127.0.0.1:8080`).

---

## Technical Context

**Language/Version**: Python 3.11+ (running in Debian Trixie container)  
**Primary Dependencies**: `fastapi`, `uvicorn[standard]`, `httpx`, `pydantic`  
**Storage**: Stateless / Browser Local Storage (no database overhead needed for single-user prompting)  
**Testing**: `pytest`, `pytest-asyncio`, `httpx` (TestClient)  
**Target Platform**: Linux (Debian Trixie container in Incus on x86_64)  
**Project Type**: Lightweight asynchronous Web Service & Single-Page Application  
**Performance Goals**: Service startup < 1.0s, initial page load < 50ms, response streaming within 1s of model output  
**Constraints**: Resident memory < 100 MB RAM (target ~40 MB), no public/LAN port exposure, 100% offline self-contained assets (no external CDNs)  
**Scale/Scope**: Single-user workstation interaction with multiple local models (`qwen3.5:4b`, etc.)  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Library-First & Modularity**: Core communication with Ollama is encapsulated in a dedicated, testable module (`app/services/ollama_client.py`) with clean boundaries. *(PASSED)*
- **Principle II: Service & Interface Clarity**: Clearly defined RESTful and SSE endpoints matching the contract specification. *(PASSED)*
- **Principle III: Test-First Enforcement**: Test contracts for Ollama connectivity, model parsing, and token streaming defined before deploying to the container. *(PASSED)*
- **Principle IV: Integration Testing**: Inter-container communication validated using live Incus device proxies. *(PASSED)*
- **Principle V: Simplicity & Observability**: Avoided heavy frameworks (Open-WebUI/Node.js); standard logging to `stdout`/`journalctl`. *(PASSED)*

---

## Project Structure

### Documentation (this feature)

```text
specs/001-ollama-web-ui/
├── spec.md              # Feature specification & requirements
├── plan.md              # Implementation plan (this file)
├── research.md          # Architecture research & technology decisions
├── data-model.md        # Entities, streaming schemas, and state transitions
├── quickstart.md        # Runnable verification and testing guide
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── contracts/
    └── api-contract.md  # API, systemd, and Incus configuration contracts
```

### Source Code (repository root)

```text
app/
├── __init__.py
├── main.py                  # FastAPI application entrypoint & HTTP routes
├── config.py                # Environment configuration (OLLAMA_HOST, PORT, HOST)
├── services/
│   ├── __init__.py
│   └── ollama_client.py     # Asynchronous client for /api/tags and /api/generate
├── static/
│   ├── index.html           # Minimalist responsive chat UI
│   ├── style.css            # Dark/light clean styling (self-contained)
│   └── app.js               # EventSource/fetch stream consumer & DOM renderer
└── systemd/
    └── ollama-webui.service # Systemd unit file for Incus container deployment

scripts/
├── deploy.sh                # Provisions dependencies & deploys service into Incus container
└── test.sh                  # Runs local test suite

tests/
├── conftest.py              # Test fixtures and mock Ollama servers
├── unit/
│   └── test_ollama_client.py
├── contract/
│   └── test_api_contract.py
└── integration/
    └── test_endpoints.py
```

**Structure Decision**: A clean single-project layout where backend logic, static frontend assets, deployment scripts, and automated tests are grouped cohesively in the workspace and deployed into the target container.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *None* | Architecture kept maximally simple; no database, no Node.js runtime, no public network exposure | Open-WebUI was rejected due to 1.2+ GB memory consumption and unnecessary complexity |
