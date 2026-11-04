# Tasks: Interactive and Resumable Container Deployment

**Input**: Design documents from `specs/003-interactive-container-deploy/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/deploy-cli.md, quickstart.md

**Organization**: Tasks are grouped by phase and user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish test harness, baseline fixtures, and test runners for offline script verification.

- [X] T001 [P] Create mock Incus utility fixture in `tests/unit/mock_incus.sh` for simulated container interactions
- [X] T002 [P] Initialize offline deploy script unit test suite in `tests/unit/test_deploy_script.py`
- [X] T003 Ensure execute permissions and syntax check on `scripts/deploy.sh`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shell helper infrastructure that MUST be in place before implementing individual user stories.

**⚠️ CRITICAL**: All story work depends on these core CLI utilities.

- [X] T004 Implement CLI option parser and help documentation (`-h`, `--help`, `-y`, `--yes`, `-r`, `--reset`) in `scripts/deploy.sh`
- [X] T005 Implement terminal formatting and logging helper functions (`info`, `success`, `warn`, `error`, `banner`) in `scripts/deploy.sh`
- [X] T006 Implement container execution and wrapper abstraction (`run_in_container`, `push_to_container`) honoring `INCUS_BIN` override in `scripts/deploy.sh`

**Checkpoint**: Foundation ready - User Story implementation can proceed.

---

## Phase 3: User Story 1 - Interactive Step-by-Step Container Deployment (Priority: P1) 🎯 MVP

**Goal**: Prompt the administrator for target container, display deployment roadmap, confirm each phase, and execute Steps 1 through 5.

**Independent Test**: Execute `scripts/deploy.sh` without arguments, verify interactive prompt for container name, confirm steps 1 to 5, and verify that all actions execute and active service health is verified.

### Implementation for User Story 1

- [X] T007 [US1] Implement interactive container name prompt and existence validation matching `^[a-zA-Z0-9_-]+$` in `scripts/deploy.sh`
- [X] T008 [US1] Implement roadmap banner printing all 5 deployment stages at startup in `scripts/deploy.sh`
- [X] T009 [US1] Implement Step 1 (Container runtime verification and start if stopped) with confirmation prompt in `scripts/deploy.sh`
- [X] T010 [US1] Implement Step 2 (Prerequisite packages check, python3, pip, and open-webui conflict resolution) in `scripts/deploy.sh`
- [X] T011 [US1] Implement Step 3 (Application directory preparation, sync `app/`, `tests/`, `requirements.txt`, install pip deps, and push `e-webui.service`) in `scripts/deploy.sh`
- [X] T012 [US1] Implement Step 4 (Systemd daemon-reload, enable service, restart service) with confirmation prompt in `scripts/deploy.sh`
- [X] T013 [US1] Implement Step 5 (Service health inspection, wait loop, status output, and application URL display) in `scripts/deploy.sh`
- [X] T014 [US1] Add unit tests for interactive container prompting and step execution flow in `tests/unit/test_deploy_script.py`

**Checkpoint**: User Story 1 (Interactive deployment) is fully functional and independently testable.

---

## Phase 4: User Story 2 - Resumable State Detection Across Re-runs (Priority: P2)

**Goal**: Persist deployment progress state in `/opt/e-webui/.deploy_state` and resume execution from the first pending step upon subsequent runs.

**Independent Test**: Interrupt or simulate deployment stopped after Step 2, run `scripts/deploy.sh` again, verify Steps 1 and 2 are skipped with `[SKIPPED: Already Completed]` message, and execution resumes from Step 3.

### Implementation for User Story 2

- [X] T015 [US2] Implement state record reader and writer functions (`load_deploy_state`, `save_step_state`) targeting `/opt/e-webui/.deploy_state` in `scripts/deploy.sh`
- [X] T016 [US2] Integrate state checking into the main step runner to skip already completed steps in `scripts/deploy.sh`
- [X] T017 [US2] Implement `--reset` / `-r` flag handling to clear existing state and force full re-deployment in `scripts/deploy.sh`
- [X] T018 [US2] Implement completion check to notify the administrator if all steps are already completed and offer service re-verification in `scripts/deploy.sh`
- [X] T019 [US2] Add unit tests for state persistence, resumption of incomplete steps, and state reset in `tests/unit/test_deploy_script.py`

**Checkpoint**: User Stories 1 and 2 work seamlessly together.

---

## Phase 5: User Story 3 - Safe Rejection and Abort Handling (Priority: P3)

**Goal**: Gracefully handle user rejection of a step with clear consequence warning, confirmation of abort, and clean exit without state corruption.

**Independent Test**: Reject a confirmation prompt by typing `n`, verify warning message is printed, confirm abort, and verify script exits with exit code `1` while saving prior progress.

### Implementation for User Story 3

- [X] T020 [US3] Implement `confirm_step` function with rejection warning and secondary abort prompt in `scripts/deploy.sh`
- [X] T021 [US3] Implement clean abort handler ensuring non-zero exit code `1` and preservation of completed steps in `scripts/deploy.sh`
- [X] T022 [US3] Support non-interactive mode (`-y`, `--yes`) to auto-confirm all steps for headless/automated environments in `scripts/deploy.sh`
- [X] T023 [US3] Add unit tests for step rejection warning, abort exit status, and reconsideration loop in `tests/unit/test_deploy_script.py`

**Checkpoint**: All 3 user stories are complete and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, final code quality checks, and verification.

- [X] T024 [P] Update `README.md` with new deployment instructions, interactive step explanations, and CLI options
- [X] T025 Run full offline unit test suite via `pytest tests/unit/test_deploy_script.py` and ensure 100% pass
- [X] T026 Perform static bash analysis and syntax verification with `bash -n scripts/deploy.sh`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent, can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion; blocks all User Story phases.
- **User Story 1 (Phase 3)**: Depends on Phase 2. Core deployment pipeline (MVP).
- **User Story 2 (Phase 4)**: Depends on Phase 3. Adds state persistence and resumption.
- **User Story 3 (Phase 5)**: Depends on Phase 3 and Phase 4. Refines confirmation/rejection safety.
- **Polish (Phase 6)**: Depends on completion of User Stories 1, 2, and 3.

### Parallel Opportunities

- T001 and T002 in Phase 1 can be developed in parallel.
- T004, T005, and T006 in Phase 2 can be developed in parallel as modular functions.
- Test tasks (T014, T019, T023) can run alongside corresponding story implementations.
- T024 and T026 in Phase 6 can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup (T001 - T003) & Foundational (T004 - T006).
2. Complete User Story 1 (T007 - T014).
3. Validate MVP: Interactive step-by-step execution.

### Incremental Delivery
1. Add User Story 2 (T015 - T019) to provide resumability across re-runs.
2. Add User Story 3 (T020 - T023) to provide rejection handling and non-interactive flags.
3. Complete Polish (T024 - T026) to finalize documentation and static verification.
