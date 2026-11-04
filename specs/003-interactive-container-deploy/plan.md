# Implementation Plan: Interactive and Resumable Container Deployment

**Branch**: `003-interactive-container-deploy` | **Date**: 2026-11-05 | **Spec**: [spec.md](file:///home/ellie/Documents/Projects/ellie-ollama-webui/specs/003-interactive-container-deploy/spec.md)

**Input**: Feature specification from `specs/003-interactive-container-deploy/spec.md`

## Summary

Enhance `scripts/deploy.sh` into an interactive, step-by-step deployment utility that prompts the administrator for a target Incus container, outputs clear progress stages, requests explicit user confirmation prior to each mutating action, handles user rejections with explanatory warnings and safe aborts, and persists deployment state to allow seamless resumption across script re-runs.

## Technical Context

**Language/Version**: Bash 4.4+ (POSIX-compatible utilities, `set -euo pipefail`).
**Primary Dependencies**: `incus` CLI (executed on the host by the user), standard Linux shell commands (`awk`, `grep`, `mkdir`, `read`, `printf`, `systemctl`).
**Storage**: Flat-file key-value state record stored at `/opt/e-webui/.deploy_state` inside the target container (with fallback to host temporary state if needed).
**Testing**: Offline unit test suite (`tests/unit/test_deploy_script.py` with pytest) using mocked `incus` stubs to test CLI arguments, state persistence, step resumption, and interactive rejection logic without accessing real container infrastructure.
**Target Platform**: Linux host operating system running Incus container virtualization.
**Project Type**: CLI deployment automation script.
**Performance Goals**: Instantaneous prompt response (<50ms), step resumption check <100ms.
**Constraints**: Must never touch live containers during automated agent development; must adhere strictly to Constitution Principle I (Infrastructure Isolation) and Principle III (Manual Hand-offs).
**Scale/Scope**: Refactoring `scripts/deploy.sh` and adding comprehensive offline test coverage.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Infrastructure Isolation**: PASS. The AI agent will not invoke `incus` or communicate with any running container. The deployment script is authored within the repository workspace and executed strictly by the user on the host.
- **Principle II: Workspace-Only Scope Boundary**: PASS. All code changes (`scripts/deploy.sh`, `tests/unit/test_deploy_script.py`) remain strictly within the repository workspace.
- **Principle III: Transparent Delegation & Manual Execution Hand-offs**: PASS. Clear instructions for user execution are provided in documentation and quickstart guides, and automated tests rely entirely on mocks.

**Gate Status**: ALL GATES PASSED (0 violations).

## Project Structure

### Documentation (this feature)

```text
specs/003-interactive-container-deploy/
├── plan.md              # Implementation plan (this document)
├── research.md          # Phase 0 architectural & design decisions
├── data-model.md        # Phase 1 data entities and lifecycle states
├── quickstart.md        # Phase 1 verification and execution guide
├── contracts/
│   └── deploy-cli.md    # CLI specification, flags, and prompt contracts
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
scripts/
├── deploy.sh                     # Enhanced interactive & resumable deploy script
└── test.sh                       # Local test runner script

tests/
├── unit/
│   ├── test_ollama_client.py     # Existing unit tests
│   └── test_deploy_script.py     # Unit tests for deploy script logic & state resumption
└── integration/
    └── test_endpoints.py         # Existing API integration tests
```

**Structure Decision**: Retain the existing repository layout. The deployment logic is contained in `scripts/deploy.sh` with offline unit verification in `tests/unit/test_deploy_script.py`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None      | N/A        | All requirements met with simple modular shell functions |
