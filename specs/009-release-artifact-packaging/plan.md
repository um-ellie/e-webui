# Implementation Plan: Release Artifact Specification and Packaging System

**Branch**: `009-release-artifact-packaging` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-release-artifact-packaging/spec.md`

---

## Summary

Design and implement a standardized, verifiable, and versioned Release Artifact packaging format for `e-webui`. This architecture decouples release creation from deployment by introducing a dedicated Release Builder (`scripts/build-release.sh` and Python helper `scripts/lib/manifest_tool.py`) that outputs structured packages with `manifest.json`, `checksums.sha256`, and `payload/`. The Deployment Manager (`deploy.sh`) is refactored from an on-the-fly source packager into a strict consumer of pre-built release packages, performing dual-gate SHA-256 integrity verification, safe path extraction, virtual environment caching, and atomic activation.

---

## Technical Context

**Language/Version**: Python 3.11+ (Standard Library: `json`, `hashlib`, `tarfile`, `pathlib`, `datetime`, `argparse`), POSIX Bash (`set -euo pipefail`).  
**Primary Dependencies**: None external for packaging (pure Python stdlib + coreutils). Deployment runtime uses existing FastAPI, Uvicorn, HTTPX.  
**Storage**: File-based release packages in `dist/releases/`; container staging at `/opt/e-webui/staging/`; versioned deployments at `/opt/e-webui/releases/<release-id>/`.  
**Testing**: Python `unittest` / `pytest` with `tests/mock_incus.py` mock harness.  
**Target Platform**: Linux (Debian 12 Incus container for deployment; standard Linux host for packaging).  
**Project Type**: Web Application + CLI Deployment Automation.  
**Performance Goals**: Release packaging < 10 seconds; Application update deployment < 15 seconds.  
**Constraints**: Zero external packaging dependencies; Strict exclusion of secrets and dev files; Complete Infrastructure Isolation (Principle I: no live `incus` calls during testing).  
**Scale/Scope**: Self-contained release packages ~100KB to 2MB; 3 retained historical releases.  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check / Constraint | Status | Notes |
|-----------|--------------------|--------|-------|
| **I. Infrastructure Isolation (NON-NEGOTIABLE)** | Zero `incus` command execution; zero live container modifications; mock-based testing only. | **PASS** | All automated tests execute via `mock_incus.py` and local filesystem trees. No live container calls. |
| **II. Workspace-Only Scope Boundary** | Operations strictly inside repository directory; no modifying host `/etc` or global systems. | **PASS** | All build artifacts publish to `${REPO_ROOT}/dist/releases/`. |
| **III. Transparent Delegation & Manual Hand-offs** | Production container deployment remains a manual user command (`deploy.sh`). | **PASS** | Tools provide explicit CLI feedback and wait for operator invocation. |

*Re-evaluation post-Phase 1*: All design artifacts (`research.md`, `data-model.md`, `contracts/`, `quickstart.md`) strictly adhere to workspace boundaries and infrastructure isolation.

---

## Project Structure

### Documentation (this feature)

```text
specs/009-release-artifact-packaging/
├── plan.md              # This implementation plan
├── research.md          # Phase 0: Architectural research & decisions
├── data-model.md        # Phase 1: Entity definitions and lifecycles
├── quickstart.md        # Phase 1: Verification procedures and scenarios
├── contracts/           # Phase 1: Interface and schema contracts
│   ├── manifest-schema.json
│   ├── builder-cli.md
│   └── deploy-consumer.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── spec.md              # Feature specification
```

### Source Code Layout

```text
e-webui/
├── app/
│   ├── systemd/
│   │   └── e-webui.service          # Canonical modern service unit template
│   ├── static/
│   ├── services/
│   ├── config.py
│   ├── main.py
│   └── models.py
├── scripts/
│   ├── build-release.sh             # Release packaging CLI entry point
│   ├── deploy.sh                    # Deployment lifecycle manager (refactored consumer)
│   └── lib/
│       ├── builder.sh               # Packaging orchestration & staging lifecycle
│       ├── manifest_tool.py         # Python stdlib manifest generator & verifier
│       ├── archive.sh               # Deprecate source packaging; add verification helpers
│       ├── release.sh               # Staging transfer, extraction, and linking
│       ├── common.sh
│       ├── state.sh
│       └── service.sh
├── dist/
│   └── releases/                    # Default output for published packages (gitignored)
└── tests/
    ├── mock_incus.py                # Isolated mock container harness
    ├── test_deploy_lifecycle.py     # End-to-end deployment lifecycle tests
    └── unit/
        ├── test_release_builder.py  # Unit tests for builder & manifest_tool
        └── test_manifest_schema.py   # Schema validation tests
```

**Structure Decision**: The release packaging logic is placed in `scripts/build-release.sh` supported by modular helper `scripts/lib/builder.sh` and Python stdlib tool `scripts/lib/manifest_tool.py`. `scripts/deploy.sh` is updated to consume published packages rather than assembling archives from source.

---

## Complexity Tracking

> No constitutional violations or unjustified complexity introduced.
