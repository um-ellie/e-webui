# Quickstart & Validation Guide: Deployment Lifecycle Manager

**Feature**: `specs/008-deployment-lifecycle-manager/spec.md`  
**Date**: 2026-11-06  
**Status**: Ready for Verification  

---

## 1. Local Workspace Verification (Constitution-Compliant)

In accordance with **Constitution Principle I (Infrastructure Isolation)**, automated tests are executed locally within the workspace repository using mocked Incus runners and pytest. The agent will run these tests without invoking live Incus commands.

```bash
# Run deployment lifecycle test suite
pytest tests/test_deploy_lifecycle.py -v
```

Expected Outcome:
- All unit and scenario tests pass.
- Verification covers archive exclusion filtering, SHA-256 calculation, venv hash computation, CLI argument parsing, lock acquisition/release, and rollback logic.

---

## 2. Operator Validation Scenarios (Live Incus Environment)

The following procedures are executed by the **human operator** on the host environment:

### Scenario 1: Clean Initial Installation

1. Run the deployment script on a fresh container name:
   ```bash
   ./deploy.sh e-webui-test
   ```
2. Confirm the step prompts.
3. Verify output:
   - Container `e-webui-test` created with Debian stable.
   - Incus proxy devices configured (`webui-proxy`, `ollama-link`).
   - Prerequisites installed (`python3`, `curl`).
   - Initial release created at `/opt/e-webui/releases/<id>/`.
   - Symlink established: `/opt/e-webui/current -> releases/<id>`.
   - Service active and HTTP health verified (HTTP 200).
   - `.deploy_state` initialized.

---

### Scenario 2: Zero-Rebuild Routine Code Update

1. Modify a frontend or backend file (e.g., update a title in `app/static/index.html`).
2. Run update:
   ```bash
   ./deploy.sh --update e-webui-test
   ```
3. Verify output:
   - Tool detects existing healthy deployment.
   - Requirements hash unchanged; pip install is **completely skipped**.
   - Host packages release, calculates checksum, pushes to container `staging/`.
   - New release extracted into `/opt/e-webui/releases/<new-id>/`.
   - `current` symlink swapped atomically.
   - Total update duration < 15 seconds.
   - Container was **not** recreated or rebooted.

---

### Scenario 3: Update with New Python Dependency

1. Add a new package to `requirements.txt` (or modify version).
2. Run update:
   ```bash
   ./deploy.sh --update e-webui-test
   ```
3. Verify output:
   - Tool detects new requirements hash.
   - Creates new isolated venv at `/opt/e-webui/venvs/<new-hash>/`.
   - Previous venv remains untouched.
   - Release symlinks to new venv.
   - `current` swapped atomically.
   - Service verified healthy.

---

### Scenario 4: Automatic Rollback on Health Check Failure

1. Introduce an intentional error (e.g., syntax error in `app/main.py` or invalid port).
2. Run update:
   ```bash
   ./deploy.sh --update e-webui-test
   ```
3. Verify output:
   - New release staged and activated.
   - Service fails startup or HTTP health check times out.
   - Tool captures journal logs and prints error diagnostics.
   - **Automatic rollback initiates**:
     - Swaps `current` back to previous healthy release.
     - Restarts service.
     - Confirms HTTP 200 on restored release.
   - Tool exits with code 4 or 5.
   - Service remains available to users.

---

### Scenario 5: Legacy Deployment Migration

1. In an existing container created by legacy `deploy.sh` (where flat `/opt/e-webui/app` and `.deploy_state` with `STEP_*` exist):
   ```bash
   ./deploy.sh e-webui-legacy
   ```
2. Verify output:
   - Tool detects legacy structure.
   - Proposes automated migration.
   - Migrates existing app and venv into `releases/legacy-initial/` and `venvs/`.
   - Configures `current` symlink and updates systemd unit.
   - Health verified.
   - Zero container deletion, zero OS reinstallation.

---

### Scenario 6: Status & Diagnostics

1. Check deployment status:
   ```bash
   ./deploy.sh --status e-webui-test
   ```
2. Verify output:
   - Displays Container Status: RUNNING
   - Active Release: `<current-id>`
   - Previous Healthy Release: `<prev-id>`
   - Virtualenv Hash: `<hash>`
   - Systemd Service: active (running)
   - HTTP Health: OK (200)
