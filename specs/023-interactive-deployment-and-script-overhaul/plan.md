# Implementation Plan: Interactive Deployment & Script Modernization Overhaul

**Branch**: `023-interactive-deployment-and-script-overhaul` | **Date**: 2026-11-20 | **Spec**: [specs/023-interactive-deployment-and-script-overhaul/spec.md](spec.md)

**Input**: Feature specification from `/specs/023-interactive-deployment-and-script-overhaul/spec.md`

## Summary

Modernize the entire deployment, lifecycle management, and script ecosystem of `e-webui` by:
1. Introducing an interactive, zero-dependency Terminal User Interface (TUI) Control Center (`./ctl` or interactive `./deploy.sh`) with live health dashboards and guided actions.
2. Implementing one-step smart updates with automatic workspace packaging and rapid hot-sync dev mode.
3. Fixing critical port decoupling bugs where custom ports (`-p <PORT>`) broke container reachability.
4. Implementing modular deployment profiles (`core` vs `tts`) to guarantee <50MB RAM footprint and fast offline installation.
5. Providing multi-architecture support (x86_64 and ARM64) and native Python 3.10-3.13 support without forced GitHub downloads.
6. Introducing self-healing concurrency locks with lease expiration to eliminate permanent deadlocks.
7. Upgrading `test.sh` to support local host test execution alongside container execution.

## Technical Context

**Language/Version**: Bash 4.4+ (Host & Container), Python 3.10 - 3.13 (Native compatibility)

**Primary Dependencies**: 
- Host: Incus CLI (`incus`), standard POSIX utilities (`awk`, `grep`, `tar`, `sha256sum`, `curl`)
- Container (Core): FastAPI 0.110+, Uvicorn 0.28+, httpx 0.27+, pydantic 2.6+
- Container (Optional TTS): Kokoro-82M, Soundfile, CPU-only PyTorch (2.2 - 2.6)

**Storage**: Local filesystem inside Incus container (`/opt/e-webui/releases`, `/opt/e-webui/venvs`, `/opt/e-webui/shared/data`, `/opt/e-webui/.deploy_state`)

**Testing**: Python `unittest` / `pytest` with `mock_incus` harnesses (100% local, no live container required for unit tests)

**Target Platform**: Linux (Debian 12/13, Ubuntu 22.04/24.04, Arch Linux, Fedora) on `x86_64` and `aarch64`/ARM64

**Project Type**: Containerized Web Application & DevOps Lifecycle Management Tool

**Performance Goals**: 
- Launch interactive TUI in <100ms
- Core profile initial deployment in <45s
- Smart update with hot-switch in <5s (cache hit)
- Service start and readiness in <1s

**Constraints**:
- Container memory usage strictly <50MB RAM on core profile
- Zero external host dependencies (pure Bash TUI, no npm/node or extra python modules required on host)
- Total network air-gapping: host binds strictly to `127.0.0.1`

**Scale/Scope**: Single node / developer workstation / private homelab server

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
| :--- | :--- | :--- | :--- |
| **I. Incus Container Access** | Read-only diagnostics allowed; modifications require explicit hand-off; no touching `ollama`. | **PASS** | Implementation plan preserves strict boundary. Tests run strictly against local mock harnesses without touching live containers. |
| **II. Workspace Scope Boundary** | All development restricted to workspace repository. | **PASS** | All scripts, libraries, entrypoints, and tests are contained within repository roots (`scripts/`, `tests/`, `ctl`). |
| **III. Transparent Hand-offs** | Manual execution hand-off for container modifications. | **PASS** | Interactive TUI guides the user and presents transparent actions. Automated unit tests use `mock_incus`. |
| **IV. UI/UX Design Freedom** | Unrestricted freedom to modernize and enhance UI/UX. | **PASS** | TUI dashboard modernizes terminal developer experience with color indicators and interactive navigation. |
| **Security & Execution** | Mock-based verification for agent testing. | **PASS** | All new test suites extend existing `test_deploy_lifecycle.py` and `tests/unit/` mock suites. |

## Project Structure

### Documentation (this feature)

```text
specs/023-interactive-deployment-and-script-overhaul/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── cli-contract.md
│   └── deploy-state-contract.json
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code Architecture

```text
├── ctl                          # Root symlink or executable entrypoint for Interactive Control Center
├── deploy.sh                    # Root wrapper delegating to scripts/deploy.sh
├── build-release.sh             # Root wrapper for release packaging
├── scripts/
│   ├── ctl.sh                   # Native interactive TUI Control Center dashboard
│   ├── deploy.sh                # Headless and interactive deployment lifecycle dispatcher
│   ├── build-release.sh         # Release packaging orchestrator
│   ├── test.sh                  # Dual-mode test runner (host-local vs. container)
│   └── lib/
│       ├── common.sh            # ANSI colors, banner, safe trap management
│       ├── incus.sh             # Safe Incus CLI wrapper and container helpers
│       ├── lock.sh              # Lease-based self-healing concurrency lock
│       ├── state.sh             # Optimized JSON state manager
│       ├── service.sh           # Systemd unit generator with fixed 8080 container port
│       ├── health.sh            # HTTP health polling and journal diagnostics
│       ├── archive.sh           # Staging, discovery, and checksum validation
│       ├── venv.sh              # Multi-arch venv caching and native Python 3.10-3.13 support
│       ├── release.sh           # Atomic symlink pointer switching and pruning
│       ├── rollback.sh          # Healthy release rollback engine
│       ├── detect.sh            # Deployment state and architecture detection
│       ├── provision.sh         # Fixed proxy device configuration (Host:P -> Container:8080)
│       ├── tts.sh               # Modular Kokoro TTS provisioning (optional profile)
│       ├── diagnostics.sh       # Enhanced status inspection and self-healing repair
│       ├── builder.sh           # In-memory and disk release builder
│       └── tui.sh               # Reusable terminal UI components (menus, badges, prompts)
├── tests/
│   ├── mock_incus.py            # Local Incus mock state engine
│   ├── test_deploy_lifecycle.py # Integration test harness for deployment lifecycle
│   └── unit/
│       ├── test_deploy_script.py# Unit tests for CLI flags and edge cases
│       ├── test_lock_healing.py # Tests for stale lock expiration and recovery
│       ├── test_port_decoupling.py # Tests for host vs container port isolation
│       └── test_tui_components.py  # Tests for TUI rendering and menu parsing
```

**Structure Decision**:
Keep the modular architecture in `scripts/lib/`, add `scripts/lib/tui.sh` for reusable terminal rendering, add root executable `./ctl` for fast user access, and update `scripts/test.sh` to support `--local` execution without containers.

## Complexity Tracking

| Aspect | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| Pure Bash TUI (`tui.sh`) | Gives an interactive, polished terminal experience on any Linux host out-of-the-box. | Python curses/Textual rejected because host may not have Python packages installed in system Python without activating venvs. |
| Port Decoupling | Fixes fatal connectivity failure when using `-p <PORT>`. | Dynamically changing container port requires modifying service units during proxy changes and breaks container isolation. |
| Modular Profiles | Keeps default web UI under 50MB RAM and prevents 30-minute hangs on HuggingFace. | Hardcoded TTS in base image inflates memory and breaks air-gapped / slow networks. |
