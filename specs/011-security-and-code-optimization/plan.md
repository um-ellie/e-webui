# Implementation Plan: Security Hardening, Bug Fixes, and Code Optimization

**Branch**: `011-security-and-code-optimization` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-security-and-code-optimization/spec.md`

## Summary

This feature resolves discovered security risks, logic bugs, dependency bloat, and resource inefficiencies across `app/`, `scripts/`, and root package configurations. Specifically:
1. Hardens frontend markdown link parsing against JavaScript pseudo-protocol XSS.
2. Implements connection pooling via a FastAPI lifespan-managed `httpx.AsyncClient` and optimizes Ollama health checks to use minimal liveness probes (`GET /`).
3. Enforces strict input validation on model identifiers in `app/models.py`.
4. Injects essential HTTP security headers (`nosniff`, `DENY`, CSP, Referrer-Policy).
5. Splits production dependencies from dev/testing dependencies (`requirements.txt` vs `requirements-dev.txt`).
6. Fixes container name inconsistency in `scripts/test.sh` and cleans up stray artifacts in the repository root.

## Technical Context

**Language/Version**: Python 3.10+ / ES6+ JavaScript  
**Primary Dependencies**: FastAPI (>=0.110.0), Uvicorn (>=0.28.0), HTTPX (>=0.27.0), Pydantic (>=2.6.0)  
**Storage**: N/A (Stateless web UI proxying to Ollama)  
**Testing**: Python `unittest` / `pytest` with local mock harnesses  
**Target Platform**: Linux server (Incus container runtime)  
**Project Type**: Web service (FastAPI backend + Vanilla JS frontend)  
**Performance Goals**: <5ms health check latency, zero socket exhaustion during periodic polling, smooth 60fps streaming token rendering  
**Constraints**: Zero external frontend runtime libraries (offline bundled), strict compliance with Constitution Principle I (mock-based testing only)  
**Scale/Scope**: Single lightweight container per instance, concurrent SSE generation streams  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Infrastructure Isolation (NON-NEGOTIABLE)**: PASS. No commands in this plan invoke `incus` or interact with live container environments. All testing is local and mock-based.
- **Principle II: Workspace-Only Scope Boundary**: PASS. All changes are strictly confined to `app/`, `tests/`, `scripts/`, and root configuration files.
- **Principle III: Transparent Delegation & Manual Execution Hand-offs**: PASS. Any deployment or container update instructions are documented for manual user execution.

## Project Structure

### Documentation (this feature)

```text
specs/011-security-and-code-optimization/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contract.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── config.py            # Environment & server settings
├── main.py              # FastAPI app, lifespan connection pool, security headers
├── models.py            # Pydantic schemas with enhanced model name validation
├── services/
│   └── ollama_client.py # Reusable HTTP client pool & fast liveness health check
└── static/
    ├── app.js           # Client UI logic & stream management
    ├── index.html       # Single-page interface template
    ├── style.css        # Theme & typography styling
    └── vendor/
        └── marked.min.js # Markdown parser with protocol-allowlist link sanitization

requirements.txt         # Production runtime dependencies
requirements-dev.txt     # Development and test runner dependencies
scripts/
├── test.sh              # Container test runner (updated container default name)
└── lib/                 # Lifecycle and deployment helper scripts
tests/
├── unit/                # Unit test suite
└── integration/         # API endpoint integration tests
```

**Structure Decision**: Retains existing standard web application architecture (`app/` backend/static + `scripts/` + `tests/`) without adding unnecessary abstractions or layers.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | *N/A* | *N/A* |
