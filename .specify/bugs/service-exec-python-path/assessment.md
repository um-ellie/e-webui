# Bug Assessment: Systemd Service ExecStart Path Missing in Clean Containers

- **Slug**: service-exec-python-path
- **Created**: 2026-11-05T03:20:00Z
- **Source**: Pasted text from `./scripts/deploy.sh` execution log
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

During execution of `./scripts/deploy.sh` for container `e-webui`:
Steps 1, 2, 3, and 4 completed successfully.
At Step 5 (Health Verification & Status Reporting), `e-webui.service` failed to start with status code 203/EXEC:

```text
Nov 04 23:45:38 e-webui (python)[1638]: e-webui.service: Unable to locate executable '/opt/open-webui/.local/share/uv/tools/open-webui/bin/python': No such file or directory
Nov 04 23:45:38 e-webui (python)[1638]: e-webui.service: Failed at step EXEC spawning /opt/open-webui/.local/share/uv/tools/open-webui/bin/python: No such file or directory
Nov 04 23:45:38 e-webui systemd[1]: e-webui.service: Main process exited, code=exited, status=203/EXEC
Nov 04 23:45:38 e-webui systemd[1]: e-webui.service: Failed with result 'exit-code'.
```

## Symptom

When deploying to any container where Open-WebUI has not previously been installed using `uv`, `e-webui.service` crashes on startup with `status=203/EXEC` because systemd cannot locate the hardcoded Python executable path `/opt/open-webui/.local/share/uv/tools/open-webui/bin/python`. The expected behavior is that `e-webui.service` executes using the Python environment installed or created by `deploy.sh` (e.g. `/usr/bin/python3` or `/opt/e-webui/venv/bin/python3`).

## Reproduction

1. Launch or prepare a fresh Linux container in Incus without pre-existing Open-WebUI installation (e.g. `e-webui`).
2. Run `./scripts/deploy.sh` and select the container.
3. Confirm all steps 1 through 4.
4. Observe Step 5 failure: systemd logs report `Unable to locate executable '/opt/open-webui/.local/share/uv/tools/open-webui/bin/python'`.

## Suspected Code Paths

- `app/systemd/e-webui.service:10` — Hardcodes `ExecStart=/opt/open-webui/.local/share/uv/tools/open-webui/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8080`.
- `scripts/test.sh:7` — Hardcodes `PYTHON_BIN="/opt/open-webui/.local/share/uv/tools/open-webui/bin/python"`.
- `scripts/deploy.sh:285-300` — Step 3 pushes `app/systemd/e-webui.service` directly without adjusting the python interpreter path to match the container's environment.

## Root Cause Hypothesis

During the initial project scaffolding (`specs/001-ollama-web-ui`), the container being tested had Open-WebUI installed, so its internal uv Python binary path was reused as a temporary shortcut in `e-webui.service` and `scripts/test.sh`. In clean containers or standalone deployments, this directory structure does not exist. Confidence: High.

## Proposed Remediation

**Preferred**:
1. In `app/systemd/e-webui.service`:
   Change `ExecStart` to `/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8080` (or `/opt/e-webui/venv/bin/python3` if virtual environment isolation is implemented).
2. In `scripts/deploy.sh`:
   Optionally establish a clean virtualenv at `/opt/e-webui/venv` or install requirements using standard `/usr/bin/python3`, ensuring systemd's target interpreter exists.
3. In `scripts/test.sh`:
   Update `PYTHON_BIN` to `/usr/bin/python3` (or the virtualenv python).

**Alternatives**:
- Create a dedicated virtual environment at `/opt/e-webui/venv` during Step 3 of `deploy.sh` and point `ExecStart` to `/opt/e-webui/venv/bin/uvicorn app.main:app ...`. This eliminates PEP 668 system-package warnings from pip and ensures total dependency isolation.

**Files likely to change**:
- `app/systemd/e-webui.service`
- `scripts/test.sh`
- `scripts/deploy.sh`
- `tests/unit/test_deploy_script.py`

**Tests to add or update**:
- Add unit test verification in `tests/unit/test_deploy_script.py` ensuring `e-webui.service` does not contain references to `/opt/open-webui`.
- Verify deploy script pushes service file and checks interpreter compatibility.

## Risks & Considerations

- Modifying `ExecStart` must maintain all required arguments (`--host 127.0.0.1 --port 8080`).
- If virtualenv is used, `deploy.sh` must ensure `python3-venv` is installed and creation succeeds.

## Open Questions

- None. The issue is well understood and directly actionable.
