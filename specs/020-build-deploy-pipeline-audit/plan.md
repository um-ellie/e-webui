# Implementation Plan: Build & Deployment Pipeline Audit

**Branch**: `020-build-deploy-pipeline-audit` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/020-build-deploy-pipeline-audit/spec.md`

## Summary

Conduct a rigorous audit of the build and deployment scripts (`./build-release.sh`, `./deploy.sh`, and `scripts/lib/*.sh`) to guarantee that the updated application (featuring offline vendored Prism.js, modular ES6 UI components, IndexedDB storage, system prompt presets, and sampling controls) packages, syncs, and deploys cleanly into the `e-webui-app` Incus container. The plan confirms that all newly added static assets are packaged into `payload/app.tar.gz`, verifies that deleted legacy files (`app/static/app.js`) do not cause build errors, hardens proxy device configuration on container update (`webui-proxy`, `ollama-link`), aligns legacy test fixtures with the modern lifecycle manager, and adheres strictly to the constraint that the `app/` directory is 100% read-only.

## Technical Context

**Language/Version**: Bash 5.0+ (POSIX shell compliant), Python 3.10+ (manifest and mock testing tools)  
**Primary Dependencies**: GNU `tar`, `sha256sum`, Linux `systemd`, `incus` CLI (virtualization interface)  
**Storage**: `/opt/e-webui/` container layout (`releases/`, `venvs/`, `shared/`, `staging/`, `current` symlink)  
**Testing**: Python `unittest` with `tests/mock_incus.py` (`test_deploy_lifecycle.py`, `test_release_builder.py`, `test_manifest_tool.py`)  
**Target Platform**: Linux host with Incus container `e-webui-app` (Debian 12/13)  
**Project Type**: Infrastructure deployment & release packaging automation  
**Performance Goals**: Release packaging completed in $< 5\text{s}$; container update switch with $< 3\text{s}$ service restart  
**Constraints**: Strict offline operation; Project Constitution Principle I (Infrastructure Isolation); **Strict Read-Only boundary on `app/`** (zero code modifications in `app/`)  
**Scale/Scope**: Automated packaging and deployment across unlimited releases with automatic retention pruning  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Infrastructure Isolation (NON-NEGOTIABLE)**: PASS. All automated verification in workspace tests runs via `MockIncusState` without modifying live container infrastructure or host daemons.
- **Principle II: Workspace-Only Scope Boundary**: PASS. All scripts, fixtures, and audit targets reside within the workspace repository.
- **Principle III: Transparent Delegation & Manual Execution Hand-offs**: PASS. Actual live deployment commands against `e-webui-app` are documented for user execution; automated testing is purely mock-based.
- **Strict Read-Only `app/` Constraint**: PASS. Confirmed that no file in `app/` requires modification for build or deployment to succeed.

## Project Structure

### Documentation (this feature)

```text
specs/020-build-deploy-pipeline-audit/
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 research & audit findings
├── data-model.md        # Phase 1 entities & state transitions
├── contracts/           # Phase 1 CLI & scope contracts
│   └── pipeline-audit-contract.md
├── quickstart.md        # Phase 1 validation scenarios & run commands
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code Layout

```text
build-release.sh               # Root release builder wrapper
deploy.sh                      # Root deploy lifecycle manager wrapper
scripts/
├── build-release.sh           # Main packaging CLI
├── deploy.sh                  # Main deployment lifecycle CLI (install, update, rollback, status)
└── lib/
    ├── builder.sh             # Release packaging, staging, and archive creation
    ├── manifest_tool.py       # Manifest schema validation and checksum verification
    ├── provision.sh           # Container launch, proxy device configuration (webui-proxy, ollama-link)
    ├── release.sh             # Release staging, in-container checksum verification, and extraction
    ├── service.sh             # Systemd service unit generation and reload
    ├── venv.sh                # Requirements hashing and venv caching
    ├── health.sh              # Service active-state checks and HTTP /api/health polling
    ├── incus.sh               # Safe Incus CLI execution wrappers
    └── archive.sh             # Release package discovery and host verification

tests/
├── test_deploy_lifecycle.py   # Comprehensive 25-state lifecycle test suite
└── unit/
    ├── test_release_builder.py # Build packaging and exclusion tests
    ├── test_manifest_tool.py  # Manifest and checksum verification tests
    └── test_deploy_script.py   # Aligned unit tests for deploy CLI
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | No constitutional or complexity violations. | Uses existing modular bash and Python tooling without adding new layers. |
