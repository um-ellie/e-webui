# Implementation Plan: Kokoro-82M TTS Deployment Provisioning

**Branch**: `014-provision-kokoro-tts` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-provision-kokoro-tts/spec.md`

## Summary

Upgrade the `e-webui` deployment lifecycle manager (`scripts/deploy.sh` and `scripts/lib/*.sh`) to automatically provision an isolated execution environment for the Kokoro-82M text-to-speech model inside Debian 13 Incus containers. The deployment manager will provision a compatible Python 3.11 runtime alongside the base system Python 3.13, install OS audio prerequisites (`espeak-ng`, `libsndfile1`), install Python dependencies with CPU-only PyTorch into the application virtual environment, acquire model weights into a persistent shared directory shared across releases, seamlessly migrate existing Python 3.13 deployments on `--update`, handle download failures gracefully without failing chat deployment, and provide `--download-model`, `--skip-model-download`, `--status`, and `--repair` CLI tooling.

## Technical Context

**Language/Version**: Bash 5.x (deployment automation scripts), Python 3.11 (application runtime provisioned via standalone prebuilt distribution), Python 3.13 (container base OS interpreter, untouched).

**Primary Dependencies**: `kokoro>=0.8.4`, `soundfile>=0.12.1`, CPU-only `torch>=2.2.0,<=2.6.0`, `espeak-ng`, `espeak-ng-data`, `libsndfile1`, `curl`, `uvicorn`, `fastapi`.

**Storage**: Local container filesystem under `/opt/e-webui`:
- Shared persistent model directory: `/opt/e-webui/shared/models/kokoro/`
- Cached virtual environments: `/opt/e-webui/venvs/py3.11-${REQ_HASH}`
- Standalone interpreter: `/opt/e-webui/interpreters/python-3.11/`
- Deployment state file: `/opt/e-webui/.deploy_state`

**Testing**: Local unittest suite via `tests/test_deploy_lifecycle.py` and `tests/mock_incus.py` complying strictly with Constitution Principle I (Workspace-Only isolation).

**Target Platform**: Linux (Debian 13 "Trixie" running inside Incus containers).

**Project Type**: Infrastructure deployment lifecycle automation and CLI manager.

**Performance Goals**:
- Idempotent `--update` and `--install` completes verification in < 15 seconds when unchanged.
- Standalone Python 3.11 provisioning completes in < 5 seconds via prebuilt archive.
- CPU-only PyTorch saves 93% download bandwidth compared to standard CUDA wheels.

**Constraints**:
- Host OS Python 3.13 must never be replaced, removed, or corrupted.
- Kokoro runs strictly on CPU in the application process; no GPU, no Ollama, no extra containers.
- Model download failures must be non-blocking; the chat application must remain operational.
- Must support proxy and mirror configuration for operators in network-restricted regions (Iran).

**Scale/Scope**: Single-container deployment lifecycle management supporting atomic rollback, zero-downtime updates, and retention of up to N previous releases.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Justification / Implementation Note |
| :--- | :--- | :---: | :--- |
| **I. Infrastructure Isolation** | Agent MUST NOT interact with installed containers or Incus API directly | **PASS** | Agent operates strictly on bash scripts and tests within repository. All automated tests run locally through `tests/mock_incus.py`. Live deployments are executed exclusively by the operator on host. |
| **II. Workspace Scope Boundary** | All development and static validation MUST occur strictly within repository | **PASS** | All source changes are confined to `scripts/`, `scripts/lib/`, and `tests/`. No files outside workspace are modified. |
| **III. Transparent Hand-offs** | Document recommended commands and hand over execution to user | **PASS** | Documented in `quickstart.md` with explicit operator run commands and clear expectations. |

*Post-Design Evaluation: All gates PASS. No constitutional violations.*

## Project Structure

### Documentation (this feature)

```text
specs/014-provision-kokoro-tts/
├── plan.md              # This plan
├── research.md          # Phase 0 research & architectural decisions
├── data-model.md        # Phase 1 runtime entities & directory model
├── quickstart.md        # Phase 1 operator guide & test procedures
├── contracts/           # Phase 1 interface specifications
│   ├── deploy-cli-contract.md
│   ├── tts-environment-contract.md
│   └── systemd-unit-contract.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── spec.md              # Feature specification
```

### Source Code (repository root)

```text
scripts/
├── build-release.sh         # Release archiver and packager
├── deploy.sh                # Main deployment lifecycle CLI entry point
├── test.sh                  # Container test runner (operator)
└── lib/
    ├── common.sh            # Logging, colors, error traps, cleanup
    ├── detect.sh            # State and environment detection
    ├── diagnostics.sh       # --status and --repair CLI logic (extended with TTS checks)
    ├── health.sh            # HTTP endpoint verification and polling
    ├── incus.sh             # Incus CLI wrappers and container push/exec helpers
    ├── lock.sh              # Exclusive concurrency locking
    ├── migrate.sh           # Migration logic for incompatible venvs / releases
    ├── provision.sh         # System package and container provisioning (espeak-ng, etc.)
    ├── release.sh           # Release staging, extraction, and atomic symlink switching
    ├── rollback.sh          # Rollback execution and verification
    ├── service.sh           # Systemd unit rendering (with offline env vars)
    ├── state.sh             # JSON state file reading, updating, and committing
    ├── tts.sh               # NEW: Kokoro-82M model downloading, verification, and helpers
    ├── uninstall.sh         # Clean service and release removal
    └── venv.sh              # Standalone Python 3.11 provisioning, CPU PyTorch, venv hashing

tests/
├── conftest.py
├── mock_incus.py            # Simulated Incus container filesystem for local tests
├── test_deploy_lifecycle.py # Unit and integration test suite
└── unit/
```

**Structure Decision**: Modular shell scripts under `scripts/lib/` organized by functional domain, invoked by `scripts/deploy.sh`. Addition of `scripts/lib/tts.sh` for model downloading and speech verification, and extensions to `venv.sh`, `provision.sh`, `service.sh`, and `diagnostics.sh`.

## Complexity Tracking

*No constitutional violations or unjustified complexity introduced.*
