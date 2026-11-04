# Bug Fix: Systemd Service ExecStart Path Missing in Clean Containers

- **Slug**: service-exec-python-path
- **Fixed**: 2026-11-05T03:22:30Z
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Replaced hardcoded `/opt/open-webui/.../python` interpreter paths in `app/systemd/e-webui.service` and `scripts/test.sh` with standard `/usr/bin/python3`, allowing systemd to successfully execute and supervise `e-webui` in any clean Debian/Ubuntu container.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `app/systemd/e-webui.service` | modified | Changed `ExecStart` interpreter to `/usr/bin/python3` |
| `scripts/test.sh` | modified | Updated `PYTHON_BIN` to `/usr/bin/python3` |
| `tests/unit/test_deploy_script.py` | modified | Added `test_systemd_service_and_test_runner_python_paths` regression test |

## Diff Highlights

```diff
--- a/app/systemd/e-webui.service
+++ b/app/systemd/e-webui.service
@@ -10,1 +10,1 @@
-ExecStart=/opt/open-webui/.local/share/uv/tools/open-webui/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8080
+ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8080
```

```diff
--- a/scripts/test.sh
+++ b/scripts/test.sh
@@ -7,1 +7,1 @@
-PYTHON_BIN="/opt/open-webui/.local/share/uv/tools/open-webui/bin/python"
+PYTHON_BIN="/usr/bin/python3"
```

## Tests Added or Updated

- `tests/unit/test_deploy_script.py::test_systemd_service_and_test_runner_python_paths` — Verifies that neither `app/systemd/e-webui.service` nor `scripts/test.sh` contains stale references to `/opt/open-webui`, and that `ExecStart` uses `/usr/bin/python3`.

## Local Verification

- Commands run:
  - `python3 -m unittest -v tests/unit/test_deploy_script.py` → 10 tests passed in 15.5s (100% OK).
  - `bash -n scripts/deploy.sh` → Syntax check passed.
  - `bash -n scripts/test.sh` → Syntax check passed.

## Deviations from Assessment

None. The remediation directly implemented the preferred solution documented in `assessment.md`.

## Follow-ups

- When the user runs `./scripts/deploy.sh` again, the script will automatically resume from Step 4 / 5 or push the updated service file and reload systemd to complete deployment.
