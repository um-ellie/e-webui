# Tasks: Kokoro-82M TTS Deployment Provisioning

**Input**: Design documents from `specs/014-provision-kokoro-tts/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)

**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`

**Tests**: Unit and integration tests using `tests/mock_incus.py` and `tests/test_deploy_lifecycle.py` complying with Constitution Principle I (Workspace-Only isolation).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3], [US4], [US5])
- Exact file paths are included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize directory layouts, module skeletons, and deployment state tracking for TTS provisioning.

- [X] T001 Create TTS management module skeleton in `scripts/lib/tts.sh` and register its loader in `scripts/deploy.sh`
- [X] T002 [P] Update directory initialization in `scripts/lib/provision.sh` to create `/opt/e-webui/interpreters` and `/opt/e-webui/shared/models/kokoro/voices`
- [X] T003 [P] Update state management helpers in `scripts/lib/state.sh` to serialize and parse `tts_environment` fields (`python_version`, `dependencies_ready`, `model_present`) in `/opt/e-webui/.deploy_state`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core prerequisites that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: Foundational tasks establish OS libraries, compatible Python distribution, and offline systemd configuration required across all user stories.

- [X] T004 Extend `install_system_prerequisites` in `scripts/lib/provision.sh` to idempotently check and install Debian packages `espeak-ng`, `espeak-ng-data`, and `libsndfile1`
- [X] T005 Implement prebuilt standalone Python 3.11 downloader and unpacker `ensure_compatible_python` in `scripts/lib/venv.sh` targeting `/opt/e-webui/interpreters/python-3.11/bin/python3`
- [X] T006 Update `render_service_unit` and `install_service_unit` in `scripts/lib/service.sh` to inject offline environment variables (`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `KOKORO_MODEL_DIR=/opt/e-webui/shared/models/kokoro`) into `/etc/systemd/system/e-webui.service` and `/opt/e-webui/deployment.env`
- [X] T007 [P] Extend simulated Incus environment in `tests/mock_incus.py` to mock standalone Python binaries, APT audio packages, and model file storage

**Checkpoint**: Foundation ready - user story implementation can now proceed.

---

## Phase 3: User Story 1 - Fresh Installation with Automated TTS Provisioning (Priority: P1) 🎯 MVP

**Goal**: A single execution of `deploy.sh --install` on a clean container provisions compatible Python 3.11, audio libraries, CPU-only PyTorch, Kokoro dependencies, persistent model storage, and starts an offline-ready service.

**Independent Test**: Run fresh installation test in `tests/test_deploy_lifecycle.py` against a clean container mock, verifying Python 3.11 runtime, Kokoro/torch installation, and model presence.

### Tests for User Story 1
- [X] T008 [P] [US1] Add unit and integration tests for clean install TTS provisioning in `tests/test_deploy_lifecycle.py`

### Implementation for User Story 1
- [X] T009 [US1] Implement `download_kokoro_model` and `verify_kokoro_model` in `scripts/lib/tts.sh` to fetch `kokoro-v0_19.pth` (~327 MB) and voice embedding files to `/opt/e-webui/shared/models/kokoro/` with resume and atomic rename
- [X] T010 [US1] Update `ensure_venv_in_container` in `scripts/lib/venv.sh` to key virtual environments with `py3.11-${REQ_HASH}` and install CPU-only PyTorch (`--extra-index-url https://download.pytorch.org/whl/cpu`) alongside `kokoro>=0.8.4` and `soundfile>=0.12.1`
- [X] T011 [US1] Integrate `ensure_compatible_python` and `ensure_kokoro_model` into `run_install` in `scripts/deploy.sh`

**Checkpoint**: User Story 1 (MVP) complete. Clean installation provisions a full offline TTS environment automatically.

---

## Phase 4: User Story 2 - Seamless Migration of Existing Deployments (Priority: P1)

**Goal**: Existing deployments running Python 3.13 virtual environments automatically detect the incompatible interpreter during `deploy.sh --update`, provision Python 3.11, rebuild the release venv, and atomically switch releases with rollback protection.

**Independent Test**: Execute update test in `tests/test_deploy_lifecycle.py` against an existing deployment mock configured with a Python 3.13 venv, verifying automated venv upgrade to Python 3.11 and rollback preservation.

### Tests for User Story 2
- [X] T012 [P] [US2] Add unit and integration test for Python 3.13 venv detection and automatic migration on update in `tests/test_deploy_lifecycle.py`

### Implementation for User Story 2
- [X] T013 [US2] Implement Python version checking (`python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"`) in `scripts/lib/venv.sh` to invalidate and recreate venvs when interpreter is `< 3.10` or `>= 3.13`
- [X] T014 [US2] Update `run_update` in `scripts/deploy.sh` to detect legacy Python 3.13 environments, provision compatible Python 3.11 runtime, and link the new release without manual intervention
- [X] T015 [US2] Update `trigger_rollback` in `scripts/lib/rollback.sh` to ensure rolling back restores the previous healthy release and its corresponding venv while retaining access to shared models

**Checkpoint**: User Story 2 complete. Existing deployments migrate seamlessly on `--update` without operator friction.

---

## Phase 5: User Story 3 - Resilient Deployment Under Network Constraints (Priority: P2)

**Goal**: In network-restricted environments (Iran), network failures during model weights download do NOT abort deployment or trigger rollback; instead, clear warnings and retry instructions are logged, exiting with code 0 while keeping chat operational.

**Independent Test**: Execute update test with blocked model download URL, verifying the deployment finishes with exit code 0, emits a warning with retry instructions, and the core application passes health checks.

### Tests for User Story 3
- [X] T016 [P] [US3] Add test for non-blocking model download failure and proxy propagation in `tests/test_deploy_lifecycle.py`

### Implementation for User Story 3
- [X] T017 [US3] Implement non-fatal error catching in `ensure_kokoro_model` in `scripts/lib/tts.sh` that logs warnings and instructions (`deploy.sh --download-model`) without raising an error exit code during deploy workflows
- [X] T018 [US3] Propagate proxy and mirror environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `PIP_INDEX_URL`, `PIP_EXTRA_INDEX_URL`, `HF_ENDPOINT`, `PYTHON_STANDALONE_URL`) through `scripts/deploy.sh` into `scripts/lib/tts.sh` and `scripts/lib/venv.sh`

**Checkpoint**: User Story 3 complete. Deployments are resilient against connectivity issues to model hubs.

---

## Phase 6: User Story 4 - Dedicated Model Weights Lifecycle Management (Priority: P2)

**Goal**: Provide CLI flag `--skip-model-download` to bypass model checks during rapid code updates, and standalone command `--download-model` to download or verify weights without redeploying code or disrupting service.

**Independent Test**: Verify `--skip-model-download` bypasses download logic during update and `--download-model` downloads model files into shared storage without restarting the service.

### Tests for User Story 4
- [X] T019 [P] [US4] Add tests for `--skip-model-download` and `--download-model` in `tests/test_deploy_lifecycle.py`

### Implementation for User Story 4
- [X] T020 [US4] Add `--skip-model-download` flag parsing and pass-through in `scripts/deploy.sh` to bypass model acquisition in `run_install` and `run_update`
- [X] T021 [US4] Implement standalone `run_download_model` operation in `scripts/deploy.sh` and wire it to `--download-model` CLI invocation

**Checkpoint**: User Story 4 complete. Operators have full, explicit lifecycle control over model assets.

---

## Phase 7: User Story 5 - Operational Verification and Self-Healing Repair (Priority: P3)

**Goal**: `--status` reports Python runtime versions, TTS dependency import health, and model weight availability; `--repair` audits and heals missing system audio libraries, broken venv dependencies, and missing model weights.

**Independent Test**: Run status and repair tests in `tests/test_deploy_lifecycle.py` to verify diagnostic reporting and self-healing repair from missing packages or weights.

### Tests for User Story 5
- [X] T022 [P] [US5] Add tests for TTS diagnostic status reporting and repair execution in `tests/test_deploy_lifecycle.py`

### Implementation for User Story 5
- [X] T023 [US5] Extend `run_status_cli` in `scripts/lib/diagnostics.sh` with the Text-to-Speech diagnostic report displaying OS Python, app Python, dependency import status, and Kokoro model/voice status
- [X] T024 [US5] Extend `run_repair_cli` in `scripts/lib/diagnostics.sh` to re-verify audio packages (`espeak-ng`, `libsndfile1`), repair release venvs, and trigger model weight acquisition if missing

**Checkpoint**: User Story 5 complete. Complete observability and automated repair for TTS components.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, release packaging exclusion checks, and end-to-end regression testing.

- [X] T025 Update `show_help` in `scripts/deploy.sh` documenting `--download-model`, `--skip-model-download`, proxy environment variables, and exit codes
- [X] T026 [P] Ensure release archiver in `scripts/lib/archive.sh` and `scripts/build-release.sh` strictly excludes `shared/models/` and prebuilt interpreters from application code tarballs
- [X] T027 Run full test suite via `python3 -m unittest tests/test_deploy_lifecycle.py` and validate all quickstart scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup
    │
    ▼
Phase 2: Foundational (Blocks all user stories)
    │
    ├───────────────────────┬───────────────────────┐
    ▼                       ▼                       ▼
Phase 3: User Story 1 (P1)  Phase 4: US 2 (P1)     Phase 5: US 3 (P2)
    │                       │                       │
    └───────────────────────┼───────────────────────┘
                            ▼
                    Phase 6: US 4 (P2)
                            │
                            ▼
                    Phase 7: US 5 (P3)
                            │
                            ▼
                    Phase 8: Polish
```

- **Setup (Phase 1)**: Independent, can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1. Blocks all user stories.
- **User Story 1 (P1)**: Depends on Foundational. Delivers core clean install MVP.
- **User Story 2 (P1)**: Depends on Foundational and US1 venv logic. Delivers automated migration.
- **User Story 3 (P2)**: Depends on US1 model download logic. Delivers network resilience.
- **User Story 4 (P2)**: Depends on US1/US3 model download logic. Delivers CLI control.
- **User Story 5 (P3)**: Depends on all prior phases. Delivers diagnostics and repair.
- **Polish (Phase 8)**: Depends on all user stories being implemented.

### Parallel Opportunities

- **Phase 1**: T002 and T003 can be executed in parallel with T001.
- **Phase 2**: T007 (test harness extensions) can be developed in parallel with T004, T005, and T006.
- **User Story Tests**: Test tasks marked `[P]` (T008, T012, T016, T019, T022) can be authored in parallel with or prior to implementation.
- **Phase 8**: T026 can run in parallel with T025.

---

## Parallel Example: User Story 1

```bash
# Author tests for User Story 1 in parallel:
Task: "T008 [P] [US1] Add unit and integration tests for clean install TTS provisioning in tests/test_deploy_lifecycle.py"

# Implement modular components in parallel:
Task: "T009 [US1] Implement download_kokoro_model and verify_kokoro_model in scripts/lib/tts.sh"
Task: "T010 [US1] Update ensure_venv_in_container in scripts/lib/venv.sh"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1).
3. Validate: Clean container installation provisions Python 3.11, Kokoro, CPU-only PyTorch, and model weights.
4. **Deploy/Demo MVP**: Clean installs now have working TTS capability!

### Incremental Delivery
1. **Increment 1 (MVP)**: Clean installation with automated TTS environment (US1).
2. **Increment 2**: Automated migration for existing Python 3.13 deployments (US2).
3. **Increment 3**: Resilient error handling and proxy/mirror support for restricted networks (US3).
4. **Increment 4**: CLI flags `--skip-model-download` and `--download-model` (US4).
5. **Increment 5**: Diagnostic visibility in `--status` and self-healing in `--repair` (US5).
6. **Increment 6**: Documentation and full test pass (Polish).
