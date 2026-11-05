# Tasks: Deployment Script Hardening, Automated Container Creation & Lifecycle Improvements

**Input**: Design documents from `/specs/004-enhance-deployment-script/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/deploy-cli.md, quickstart.md

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3], [US4], [US5])
- All tasks include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initial wrapper and execution entry point

- [X] T001 Create root-level executable wrapper in `./deploy.sh` delegating to `scripts/deploy.sh`
- [X] T002 Configure executable file permissions on `./deploy.sh` and `scripts/deploy.sh`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user stories can be implemented

**⚠️ CRITICAL**: Provides argument parsing, path anchoring, and strict error handling

- [X] T003 Implement expanded CLI argument parser supporting `-p/--port`, `-o/--ollama-url`, `-s/--status`, `-c/--clean`, `-y/--yes`, `-r/--reset`, and `-h/--help` in `scripts/deploy.sh`
- [X] T004 Implement dynamic repository root detection (`REPO_ROOT`) in `scripts/deploy.sh`
- [X] T005 Implement strict container execution wrappers (`run_in_container_strict`, `incus_cmd_strict`) to eliminate silent error suppression (`|| true`) in `scripts/deploy.sh`
- [X] T006 Implement host port availability check function (`check_host_port_free`) in `scripts/deploy.sh`

**Checkpoint**: Foundation ready - user story implementations can now proceed

---

## Phase 3: User Story 1 - End-to-End Container Lifecycle from Creation to Service Verification (Priority: P1) 🎯 MVP

**Goal**: Prompt for container name, verify Incus is installed, and automatically launch a new Debian 13/stable container if not already present.

**Independent Test**: Execute `./deploy.sh <container-name>`, verify Incus presence is checked, verify existing container prompt appears if container exists, or verify container is launched using `images:debian/13` if missing.

- [X] T007 [US1] Implement host Incus availability pre-check (`command -v incus`) with installation guidance in `scripts/deploy.sh`
- [X] T008 [US1] Implement interactive container name prompt with alphanumeric validation and existing container detection in `scripts/deploy.sh`
- [X] T009 [US1] Implement Step 0: Container creation and launch using `images:debian/13` with fallback to `images:debian/stable` in `scripts/deploy.sh`
- [X] T010 [US1] Update roadmap banner, step indexing (0 to 5), and state tracking (`STEP_0_CONTAINER_PROVISIONED`) in `scripts/deploy.sh`

**Checkpoint**: User Story 1 complete - script can provision new Debian containers or target existing ones safely.

---

## Phase 4: User Story 2 - Intelligent Ollama Discovery & Proxy Configuration (Priority: P2)

**Goal**: Automatically detect Ollama in a sibling container or host port, or prompt user, and configure `webui-proxy` and `ollama-link` devices without errors.

**Independent Test**: Run deployment against a container and verify `webui-proxy` (host 8080 -> container 8080) and `ollama-link` (container 11434 -> Ollama) devices are added to Incus config.

- [X] T011 [US2] Implement `detect_ollama_target` function checking sibling container `ollama`, host `127.0.0.1:11434`, interactive prompt, and `--ollama-url` flag in `scripts/deploy.sh`
- [X] T012 [US2] Update Step 1 in `scripts/deploy.sh` to configure `webui-proxy` and `ollama-link` devices with strict error validation

**Checkpoint**: User Story 2 complete - network proxies connect cleanly to Web UI and Ollama.

---

## Phase 5: User Story 3 - Python Virtual Environment Isolation & Fail-Safe Execution (Priority: P3)

**Goal**: Isolate dependencies inside `/opt/e-webui/venv` without touching system Python, and update systemd unit to execute from venv.

**Independent Test**: Verify container filesystem contains `/opt/e-webui/venv`, `requirements.txt` packages are installed in venv, and systemd executes `/opt/e-webui/venv/bin/uvicorn`.

- [X] T013 [P] [US3] Update service unit in `app/systemd/e-webui.service` to execute `/opt/e-webui/venv/bin/uvicorn`
- [X] T014 [US3] Update Step 2 in `scripts/deploy.sh` to install `python3-venv` and system prerequisites with error checking
- [X] T015 [US3] Update Step 3 in `scripts/deploy.sh` to create `/opt/e-webui/venv` and install `requirements.txt` into the virtual environment

**Checkpoint**: User Story 3 complete - system Python is untouched and PEP 668 compliant.

---

## Phase 6: User Story 4 - Execution Independence, Root Access & Conflict Safety (Priority: P4)

**Goal**: Allow execution from any working directory and guard against host port collisions on port 8080.

**Independent Test**: Run `./deploy.sh` from project root and from sub-directories (`cd scripts && ./deploy.sh`), and verify host port conflicts are warned prior to binding.

- [X] T016 [US4] Update all host file synchronization commands in `scripts/deploy.sh` to use `${REPO_ROOT}/` paths
- [X] T017 [US4] Integrate `check_host_port_free` into Step 1 before adding `webui-proxy` and support custom `--port` in `scripts/deploy.sh`

**Checkpoint**: User Story 4 complete - path-independent execution and port conflict detection verified.

---

## Phase 7: User Story 5 - True HTTP Health Verification & Diagnostics (Priority: P5)

**Goal**: Perform real HTTP 200 polling probe against web UI, check Ollama reachability, and provide `--status` and `--clean` modes.

**Independent Test**: Verify script polls HTTP 200 before completion banner, run `--status` to view health, and test `--clean` to remove deployment.

- [X] T018 [US5] Implement HTTP readiness polling loop (up to 15 seconds) checking HTTP 200 on `http://127.0.0.1:${HOST_PORT}` in Step 5 of `scripts/deploy.sh`
- [X] T019 [US5] Implement container-internal Ollama reachability probe (`/api/tags`) in Step 5 of `scripts/deploy.sh`
- [X] T020 [US5] Implement `--status` diagnostic mode in `scripts/deploy.sh` to display container, systemd, and proxy state without making mutations
- [X] T021 [US5] Implement `--clean` / `--uninstall` teardown action in `scripts/deploy.sh` to stop service, remove systemd unit, and delete Incus proxy devices

**Checkpoint**: User Story 5 complete - true health verification and lifecycle operations functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates and static verification

- [X] T022 [P] Update `README.md` with instructions on running `./deploy.sh` and available command-line flags
- [X] T023 Run static syntax check (`bash -n scripts/deploy.sh` and `bash -n deploy.sh`) and verify all tasks match spec

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - blocks all user stories.
- **User Stories (Phase 3 through 7)**: Sequential execution according to priority (US1 -> US2 -> US3 -> US4 -> US5).
- **Polish (Phase 8)**: Depends on completion of all user story tasks.

### Parallel Opportunities
- T013 (`app/systemd/e-webui.service`) can be modified in parallel with T014/T015.
- T022 (`README.md`) can be prepared in parallel with script verification.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup: T001, T002).
2. Complete Phase 2 (Foundational: T003 - T006).
3. Complete Phase 3 (User Story 1: T007 - T010).
4. **STOP and VALIDATE**: Confirm that container creation and detection operate as expected.

### Incremental Delivery
1. Foundation + US1 -> Container provisioning works.
2. Add US2 -> Proxies connect seamlessly to Ollama and host.
3. Add US3 -> Python virtual environment isolated and PEP 668 compliant.
4. Add US4 -> Path independence and port safety validated.
5. Add US5 -> HTTP health checking, `--status`, and `--clean` available.
