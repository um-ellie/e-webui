# Implementation Plan: Deployment Script Hardening, Automated Container Creation & Lifecycle Improvements

**Branch**: `004-enhance-deployment-script` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-enhance-deployment-script/spec.md`

## Summary

Enhance the deployment workflow by providing an end-to-end container lifecycle directly from the host. The script will verify Incus installation, automatically provision a fresh Debian 13/stable container if absent, detect and reuse existing containers with user confirmation, isolate dependencies in a dedicated Python virtual environment (`/opt/e-webui/venv`), detect host port conflicts, dynamically discover Ollama endpoints, eliminate silent error suppression (`|| true`), perform real HTTP 200 health checks, and expose root-level execution access (`./deploy.sh`).

## Technical Context

**Language/Version**: Bash 4.0+ (host and script runtime), Python 3.11+ (inside container)

**Primary Dependencies**: `incus` CLI (host), `curl`, `awk`, `grep`, `python3-venv` (container)

**Storage**: Local filesystem inside container (`/opt/e-webui`, `/opt/e-webui/venv`, `/opt/e-webui/.deploy_state`)

**Testing**: Local mock tests (`pytest tests/`), bash static analysis (`shellcheck`), interactive manual validation

**Target Platform**: Linux host with Incus container virtualization; Debian 13 (Trixie) or Debian 12 (Bookworm) container

**Project Type**: Infrastructure deployment script & CLI wrapper

**Performance Goals**: End-to-end container creation to live HTTP response in under 4 minutes; status inspection in under 3 seconds

**Constraints**: Adherence to Constitution Principle I (Agent never executes container commands directly); PEP 668 compliance (no `--break-system-packages` in container)

**Scale/Scope**: Single host with one or more Incus containers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Infrastructure Isolation (NON-NEGOTIABLE)**: **PASS**. The implementation focuses exclusively on authoring the script code (`scripts/deploy.sh` and root wrapper `./deploy.sh`) within the workspace. The agent will NOT run `incus` commands or interact with real containers during development or testing.
- **Principle II: Workspace-Only Scope Boundary**: **PASS**. All source files, scripts, tests, and specifications are modified and maintained strictly within the workspace directory.
- **Principle III: Transparent Delegation & Manual Execution Hand-offs**: **PASS**. Deployment execution and container testing are strictly documented for the user in `quickstart.md`, delegating runtime execution entirely to the user.

## Project Structure

### Documentation (this feature)

```text
specs/004-enhance-deployment-script/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan
├── research.md          # Technical decisions and research findings
├── data-model.md        # State machine and entities
├── quickstart.md        # Validation guide
├── contracts/
│   └── deploy-cli.md    # CLI options, exit codes, and output contracts
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository layout)

```text
.
├── deploy.sh                     # Root executable wrapper delegating to scripts/deploy.sh
├── scripts/
│   └── deploy.sh                 # Comprehensive interactive & hardened deployment script
├── app/
│   ├── systemd/
│   │   └── e-webui.service       # Service unit configured to run /opt/e-webui/venv/bin/uvicorn
│   ├── main.py
│   └── ...
├── tests/
│   └── ...
└── requirements.txt
```

**Structure Decision**: Retain the standard project layout, maintaining `scripts/deploy.sh` as the primary implementation script and adding a root wrapper `./deploy.sh` for immediate usability. Update `app/systemd/e-webui.service` to utilize `/opt/e-webui/venv/bin/uvicorn`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | All designs adhere strictly to standard Bash, Linux systemd, and Python virtual environment practices | N/A |
