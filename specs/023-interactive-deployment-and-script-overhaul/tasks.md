---
description: "Task list for Interactive Deployment & Script Modernization Overhaul"
---

# Tasks: Interactive Deployment & Script Modernization Overhaul

**Input**: Design documents from `/specs/023-interactive-deployment-and-script-overhaul/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`  

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- All descriptions include explicit file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish core TUI utilities, entrypoint wrappers, and terminal helper libraries.

- [X] T001 Create terminal UI component library in `scripts/lib/tui.sh`
- [X] T002 [P] Enhance terminal colors, cursor controls, and dimension detection in `scripts/lib/common.sh`
- [X] T003 [P] Create executable root wrapper for interactive control in `ctl`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure fixes and state management optimizations that block user stories.

**⚠️ CRITICAL**: Must be completed before user story implementation begins.

- [X] T004 Optimize JSON state reading and writing in `scripts/lib/state.sh` to eliminate redundant Python subshell invocations
- [X] T005 [P] Refactor `render_service_unit` in `scripts/lib/service.sh` to fix container Uvicorn listener strictly to port 8080 (`0.0.0.0:8080`)
- [X] T006 [P] Update `configure_proxy_devices` in `scripts/lib/provision.sh` to map `Host:<PORT> -> Container:8080`
- [X] T007 Update `tests/mock_incus.py` to support mock proxy device inspection and mock journalctl streaming

**Checkpoint**: Foundation ready - port decoupling and optimized state management in place.

---

## Phase 3: User Story 1 - Interactive Terminal Control Center (Priority: P1) 🎯 MVP

**Goal**: Deliver a polished, zero-dependency interactive Terminal UI (`./ctl` or interactive `./deploy.sh`) with live health dashboards, real-time status badges, guided action menus, and streaming logs.

**Independent Test**: Launch `./ctl` in an interactive terminal; verify dashboard renders container status, service state, active release, and accepts numbered menu inputs.

### Tests for User Story 1
- [X] T008 [P] [US1] Create unit tests for TUI rendering, badge generation, and menu choices in `tests/unit/test_tui_components.py`

### Implementation for User Story 1
- [X] T009 [US1] Implement status card renderer and live metric formatting in `scripts/lib/tui.sh`
- [X] T010 [US1] Implement main interactive menu loop and action dispatcher in `scripts/ctl.sh`
- [X] T011 [US1] Implement clean journalctl log streaming handler with Ctrl+C trap in `scripts/ctl.sh`
- [X] T012 [US1] Integrate interactive fallback in `scripts/deploy.sh` when invoked in an interactive TTY without flags
- [X] T013 [US1] Update root `deploy.sh` wrapper to support interactive mode pass-through

**Checkpoint**: User Story 1 complete! Developers can manage deployments interactively via `./ctl`.

---

## Phase 4: User Story 2 - One-Step Smart Update with Auto-Packaging (Priority: P1)

**Goal**: Automatically detect workspace changes in `app/` and build verified release packages on-the-fly during updates, eliminating the need to run `./build-release.sh` manually.

**Independent Test**: Modify a file in `app/`, run update from `./ctl` or `./deploy.sh --update`, and confirm that changes are packaged and activated in the container.

### Tests for User Story 2
- [X] T014 [P] [US2] Create unit tests for workspace change detection and auto-packaging in `tests/unit/test_smart_update.py`

### Implementation for User Story 2
- [X] T015 [US2] Implement workspace change detection function `workspace_has_changes()` in `scripts/lib/builder.sh`
- [X] T016 [US2] Integrate automatic release building inside `run_update` in `scripts/deploy.sh` when source files are modified
- [X] T017 [US2] Implement Fast Dev-Sync handler in `scripts/lib/diagnostics.sh` and `scripts/ctl.sh` for rapid code transfer
- [X] T018 [US2] Update `tests/test_deploy_lifecycle.py` to verify one-step update without pre-existing release archive

**Checkpoint**: User Story 2 complete! Single-step updates from local workspace code fully operational.

---

## Phase 5: User Story 3 - Robust Custom Port & Network Configuration (Priority: P2)

**Goal**: Guarantee 100% reliable deployment on custom host ports (e.g. `-p 9090`) without proxy mismatch or health check failures.

**Independent Test**: Deploy or repair a container with `-p 9090` and verify HTTP 200 on `http://127.0.0.1:9090/api/health`.

### Tests for User Story 3
- [X] T019 [P] [US3] Create unit tests for port decoupling and custom port health verification in `tests/unit/test_port_decoupling.py`

### Implementation for User Story 3
- [X] T020 [US3] Fix `install_service_unit` signature and invocations in `scripts/deploy.sh` to pass fixed container port 8080
- [X] T021 [US3] Update `run_repair_cli` in `scripts/lib/diagnostics.sh` to audit and auto-repair mismatched proxy ports
- [X] T022 [US3] Add port configuration prompt and helper in `scripts/ctl.sh`

**Checkpoint**: User Story 3 complete! Custom ports function reliably without container network collisions.

---

## Phase 6: User Story 4 - Multi-Architecture & Lightweight Modular Profiles (Priority: P2)

**Goal**: Provide a lightweight Core Profile (<50MB RAM, zero PyTorch bloat) by default with native Python 3.10-3.13 support on x86_64 and ARM64, and make Kokoro TTS a modular opt-in add-on.

**Independent Test**: Install with default Core profile; verify container memory is <50MB RAM and deployment succeeds on native Python without fetching standalone binaries.

### Tests for User Story 4
- [X] T023 [P] [US4] Create unit tests for modular profiles and architecture detection in `tests/unit/test_profiles_and_arch.py`

### Implementation for User Story 4
- [X] T024 [US4] Implement architecture detection (`uname -m` mapping to `x86_64` vs `aarch64`) in `scripts/lib/detect.sh`
- [X] T025 [US4] Update `scripts/lib/venv.sh` to accept native container Python 3.10-3.13 without downloading standalone Python
- [X] T026 [US4] Decouple PyTorch and Kokoro into optional profile in `scripts/lib/venv.sh` and `scripts/lib/tts.sh`
- [X] T027 [US4] Add profile selection (`core` vs `tts`) to `./deploy.sh` flags (`--profile`, `--with-tts`) and `scripts/ctl.sh`

**Checkpoint**: User Story 4 complete! Lightweight Core profile deploys in seconds across architectures.

---

## Phase 7: User Story 5 - Self-Healing Concurrency Locks & Reliable State Inspection (Priority: P3)

**Goal**: Prevent permanent deployment deadlocks by implementing stale lock expiration and recovery, and upgrade `test.sh` for local host execution.

**Independent Test**: Create a stale `.deploy.lock` in the container; verify that subsequent deployment detects the stale lock and heals automatically.

### Tests for User Story 5
- [X] T028 [P] [US5] Create unit tests for stale lock detection and lease recovery in `tests/unit/test_lock_healing.py`

### Implementation for User Story 5
- [X] T029 [US5] Implement stale lock expiration check (>10 min or dead host PID) in `scripts/lib/lock.sh`
- [X] T030 [US5] Implement interactive prompt and `--reset` auto-clear logic in `scripts/lib/lock.sh`
- [X] T031 [US5] Upgrade `scripts/test.sh` to add `--local` flag for executing unit tests directly on host without Incus

**Checkpoint**: User Story 5 complete! Stale locks heal seamlessly and local test execution is supported.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, manual validation, and final quality checks.

- [X] T032 [P] Update `README.md` (English & Persian) to document `./ctl` interactive usage, smart updates, and profiles
- [X] T033 [P] Update `scripts/deploy.sh --help` and CLI options documentation
- [X] T034 Run comprehensive local test suite via `./scripts/test.sh --local` to verify zero regressions
- [X] T035 Validate quickstart guide scenarios from `specs/023-interactive-deployment-and-script-overhaul/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Completed.
- **Phase 2 (Foundational)**: Completed.
- **Phase 3 (User Story 1 - MVP)**: Completed.
- **Phase 4 (User Story 2)**: Completed.
- **Phase 5 (User Story 3)**: Completed.
- **Phase 6 (User Story 4)**: Completed.
- **Phase 7 (User Story 5)**: Completed.
- **Phase 8 (Polish)**: Completed.

---

## Parallel Execution Opportunities

- All parallel tasks executed and validated.

---

## Implementation Strategy: MVP First

- All 35 tasks completed and tested with 100% pass rate.
