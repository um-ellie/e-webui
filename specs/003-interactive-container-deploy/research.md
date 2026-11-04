# Research & Architecture Decisions: Interactive and Resumable Container Deployment

**Feature Branch**: `003-interactive-container-deploy`
**Date**: 2026-11-05
**Status**: Completed

## 1. State Tracking & Resumability Mechanism

### Context & Requirements
The script needs to determine up to which phase deployment has proceeded, skip already completed steps on subsequent runs to prevent redundant operations or clobbering, and resume cleanly.

### Alternatives Considered
1. **Host-based state cache (`~/.cache/e-webui/deploy_<container>.json`)**:
   - *Pros*: Doesn't require writing to container if container filesystem isn't ready.
   - *Cons*: Tied to a specific host user/path; if executed from another machine or workspace clone, state is lost.
2. **Pure Environmental Introspection (no state file)**:
   - *Pros*: No state file to maintain or synchronize.
   - *Cons*: Ambiguous states (e.g. distinguishing between "files pushed partially" vs "files pushed completely", or "packages installation interrupted halfway").
3. **Container-Targeted State File (`/opt/e-webui/.deploy_state`) with Environmental Sanity Checks (Chosen)**:
   - *Pros*: Colocated with target environment. Follows the container regardless of where deployment is triggered.
   - *Cons*: Target directory must be created before writing the file. (Step 1 handles target directory creation and container availability).

### Decision
Use a key-value or JSON state file stored inside the target container at `/opt/e-webui/.deploy_state` (with a local fallback in `/tmp/.deploy_${CONTAINER_NAME}.state` for initial pre-mount steps). Each completed step records its completion timestamp and status:
```json
{
  "container": "webui",
  "completed_steps": ["step_check_container", "step_install_dependencies", "step_push_files"],
  "last_updated": "2026-11-05T03:00:00Z"
}
```
In addition, the script will support `--reset` or `--force` flags to deliberately bypass prior state when the user requests a full clean re-install.

---

## 2. Interactive Confirmation & Rejection Flow

### Context & Requirements
Before executing any step, the script must:
1. Explain what will happen.
2. Solicit approval (`y/N`).
3. If declined, explain the consequence (installation will not be complete).
4. Solicit secondary decision: abort deployment or reconsider.

### Decision
Implement a reusable prompt function `confirm_step(step_id, step_name, step_description)`:
- Prints step summary with distinct visual formatting (e.g., ANSI color coding, numbered bullet).
- Prompts `Do you want to proceed with this step? [y/N]: `.
- If `y` or `Y`: returns 0 (proceed).
- If declined:
  - Prints warning: `⚠️ Warning: Skipping this step ('<step_name>') means the deployment cannot complete successfully.`
  - Prompts: `Do you want to abort the deployment now? [Y/n]: `
  - If `Y` or default enter: cleanly aborts with code 1 and writes log/status note.
  - If `n`: re-prompts the step confirmation in case the user changed their mind.

---

## 3. Deployment Step Granularity

### Context & Requirements
The deployment phases need to be clear, discrete, and testable independently.

### Decision
Standardize on 5 distinct sequential steps:
1. **Step 1: Container Accessibility & Runtime Verification**
   - Check if container exists.
   - Check if running; if stopped, prompt to start `incus start <container>`.
   - Ensure network connectivity within container.
2. **Step 2: Environment & Package Prerequisites Installation**
   - Verify/install Python 3, `python3-pip`, `python3-venv` (or equivalent package manager packages).
   - Check for conflicting services (e.g., stopping active `open-webui` service on port 8080).
3. **Step 3: Application Code & Service File Push**
   - Ensure `/opt/e-webui` directory exists.
   - Synchronize `app/`, `tests/`, `requirements.txt`.
   - Install Python dependencies via pip (`pip install -r /opt/e-webui/requirements.txt`).
   - Push `e-webui.service` unit to `/etc/systemd/system/e-webui.service`.
4. **Step 4: Systemd Service Configuration & Activation**
   - Execute `systemctl daemon-reload`.
   - Enable `e-webui.service` at container startup (`systemctl enable e-webui`).
   - Restart service (`systemctl restart e-webui`).
5. **Step 5: Health Verification & Endpoint Status**
   - Wait up to 5 seconds for service initialization.
   - Check `systemctl is-active e-webui`.
   - Inspect container IP address and output the application URL (e.g., `http://<container_ip>:8080`).

---

## 4. Constitution Compliance & Automated Testing Strategy

### Context & Requirements
Project Constitution Principle I strictly prohibits the agent from executing `incus` commands or interacting with live containers.

### Decision
1. **Manual Delegation**: The script `scripts/deploy.sh` is designed for the user to execute on the host machine.
2. **Offline Verification for Automated Test Suite**:
   - Provide a unit test / mocking harness for `scripts/deploy.sh` in `tests/test_deploy_script.py` (or bash test harness) that stubs `incus` via a mock script or environment variable `INCUS_BIN=mock_incus.sh`.
   - Validate input validation, flag parsing (`--reset`, `--help`), confirmation rejections, and state file serialization without touching any real container infrastructure.
