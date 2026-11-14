# Tasks: Build & Deployment Pipeline Audit

**Input**: Design documents from `specs/020-build-deploy-pipeline-audit/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/pipeline-audit-contract.md`, `quickstart.md`  

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes exact file paths
- **STRICT CONSTRAINT**: `app/` directory is strictly **READ-ONLY** (no tasks may modify files in `app/`)

---

## Phase 1: Setup (Audit Scaffolding & Scope Boundary)

**Purpose**: Baseline verification of script entry points and read-only scope constraint.

- [X] T001 Verify that git working tree status records `app/` files as read-only baseline for audit in `specs/020-build-deploy-pipeline-audit/quickstart.md`
- [X] T002 [P] Verify that root wrappers `./build-release.sh` and `./deploy.sh` correctly delegate to target scripts in `scripts/build-release.sh` and `scripts/deploy.sh`

---

## Phase 2: Foundational (Packaging and Manifest Tool Validation)

**Purpose**: Validate core manifest schema, checksum calculation, and packaging primitives.

- [X] T003 [P] Run unit tests in `tests/unit/test_manifest_tool.py` verifying schema validation, SHA-256 checksums, and archive path traversal checks
- [X] T004 Run unit tests in `tests/unit/test_release_builder.py` validating that `scripts/lib/builder.sh` packages `app/` and excludes development artifacts (`.git`, `__pycache__`, `tests`, `specs`)

**Checkpoint**: Core packaging primitives and manifest verification tools confirmed functional.

---

## Phase 3: User Story 1 - Build & Packaging Pipeline Verification (Priority: P1) 🎯 MVP

**Goal**: Verify that `./build-release.sh` packages the complete current application into a verified, checksummed release package without errors.  
**Independent Test**: Run `./build-release.sh -o dist/releases` on the current workspace and verify that `payload/app.tar.gz` contains all newly added assets (`prism.min.js`, `presets.js`, `db.js`, `storage.js`, `export.js`), omits `app.js`, and self-verification passes.

- [X] T005 [P] [US1] Audit `scripts/lib/builder.sh` packaging rules to confirm recursive archiving of all assets under `app/` without hardcoded path dependencies
- [X] T006 [US1] Execute `./build-release.sh -o dist/releases` to generate a live release package for the current application version
- [X] T007 [P] [US1] Inspect generated release archive `payload/app.tar.gz` verifying inclusion of newly added vendor and modular assets (`app/static/vendor/prism.min.js`, `app/static/js/presets.js`, `app/static/js/db.js`, `app/static/js/storage.js`, `app/static/js/export.js`)
- [X] T008 [P] [US1] Verify that legacy deleted file `app/static/app.js` is absent from `payload/app.tar.gz` and causes zero build or packaging warnings
- [X] T009 [US1] Validate generated `manifest.json` and `checksums.sha256` using `scripts/lib/manifest_tool.py validate-manifest` and `verify-checksums`

**Checkpoint**: User Story 1 complete — release builder bundles all current assets into a verified release artifact.

---

## Phase 4: User Story 2 - Container Deployment & Lifecycle Execution (Priority: P2)

**Goal**: Audit and verify that `./deploy.sh` and `scripts/lib/*.sh` correctly stage, verify, unpack, link, configure proxy devices, and restart the service without leaving stale files.  
**Independent Test**: Run `python3 -m unittest tests/test_deploy_lifecycle.py` verifying all 25 deployment lifecycle states (staging, in-container checksum check, extraction, venv caching, atomic switch, proxy devices, and rollback).

- [X] T010 [P] [US2] Audit release transfer and in-container verification logic in `scripts/lib/release.sh` and `scripts/lib/archive.sh`
- [X] T011 [US2] Enhance `run_update` in `scripts/deploy.sh` to invoke `configure_proxy_devices` ensuring `webui-proxy` and `ollama-link` are verified during release updates
- [X] T012 [P] [US2] Enhance `configure_proxy_devices` in `scripts/lib/provision.sh` to verify that existing proxy devices match the requested host port and Ollama address
- [X] T013 [US2] Verify venv caching and requirements hashing logic in `scripts/lib/venv.sh` ensuring virtual environment reuse when `requirements.txt` is unchanged
- [X] T014 [P] [US2] Audit systemd service unit generation in `scripts/lib/service.sh` verifying that `WorkingDirectory`, `ExecStart`, `PYTHONPATH`, and `OLLAMA_HOST` resolve to `/opt/e-webui/current`
- [X] T015 [US2] Execute full 25-state lifecycle test suite in `tests/test_deploy_lifecycle.py` using `tests/mock_incus.py`

**Checkpoint**: User Story 2 complete — deployment manager verified to push, link, configure proxies, and restart cleanly.

---

## Phase 5: User Story 3 - Script Defect Remediation & Hardening (Priority: P3)

**Goal**: Ensure all shell scripts in `scripts/` and root wrappers pass syntax validation, resolve legacy test fixture mismatches, and maintain strict read-only boundary on `app/`.  
**Independent Test**: Verify `git diff --stat app/` produces zero output, and unit test suite runs cleanly.

- [X] T016 [P] [US3] Align `tests/unit/test_deploy_script.py` with the modern `scripts/deploy.sh` CLI options (`--help`, `--status`, `--version`, container name validation)
- [X] T017 [US3] Run bash syntax check (`bash -n`) across all shell scripts in `./build-release.sh`, `./deploy.sh`, `scripts/build-release.sh`, `scripts/deploy.sh`, and `scripts/lib/*.sh`
- [X] T018 [P] [US3] Verify strict read-only compliance by running `git diff --stat app/` confirming zero modifications in `app/`

**Checkpoint**: User Story 3 complete — all shell scripts syntax-checked and hardened; `app/` verified 100% untouched.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full regression test suite execution and deployment hand-off documentation.

- [X] T019 [P] Run all unit and integration test suites in `tests/`
- [X] T020 Document manual execution commands for live container deployment hand-off in `specs/020-build-deploy-pipeline-audit/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: No dependencies — executes immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks User Stories.
- **Phase 3 (US1 - Build & Packaging)**: Depends on Phase 2 — unlocks MVP.
- **Phase 4 (US2 - Container Deployment)**: Depends on Phase 2 and Phase 3.
- **Phase 5 (US3 - Script Hardening & app/ Read-Only Check)**: Depends on Phase 3 and Phase 4.
- **Phase 6 (Polish)**: Depends on all user stories being complete.

### Parallel Opportunities
- `T001` and `T002` in Setup.
- `T003` (manifest tests) and `T004` (builder tests) in Foundational.
- `T005`, `T007`, `T008` in User Story 1.
- `T010`, `T012`, `T014` in User Story 2.
- `T016` and `T018` in User Story 3.
- `T019` and `T020` in Polish.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (Build & Packaging: package live workspace, verify `payload/app.tar.gz`, validate manifest and checksums).
3. Validate independent test: confirm newly added vendor assets exist in archive and deleted `app.js` causes zero issues.

### Incremental Delivery
1. Add User Story 2 (Audit transfer, venv caching, proxy device refresh, service restarts).
2. Add User Story 3 (Script syntax checks, test alignment, strict `app/` read-only check).
3. Complete Polish (regression test suite and user deployment hand-off).
