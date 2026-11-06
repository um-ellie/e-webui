# Bug Fix: Systemd Service Unit Push Fails with "Error: file does not exist"

- **Slug**: service-unit-push-failure
- **Fixed**: 2026-11-06T23:12:00Z
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Resolved the systemd service unit push failure during container deployment by updating `container_push` to omit `-r` on regular files and include `-p` (`--create-dirs`), ensuring parent directory creation before pushing in `install_service_unit`, and adding lifecycle test coverage.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `scripts/lib/incus.sh` | modified | Updated `container_push` to distinguish between file and directory sources, and pass `-p` (`--create-dirs`) |
| `scripts/lib/service.sh` | modified | Added `mkdir -p "$(dirname "${SYSTEMD_UNIT_PATH}")"` in `install_service_unit` before pushing unit file |
| `tests/test_deploy_lifecycle.py` | modified | Added `test_install_service_unit_pushes_unit_file` testing unit push into fresh container filesystem |

## Diff Highlights

```bash
--- a/scripts/lib/incus.sh
+++ b/scripts/lib/incus.sh
@@ -58,4 +58,8 @@ container_push() {
     local src="$1"
     local dest="$2"
     # dest format: <container>/<path>
-    incus_cmd file push -r "${src}" "${dest}"
+    if [ -d "${src}" ]; then
+        incus_cmd file push -p -r "${src}" "${dest}"
+    else
+        incus_cmd file push -p "${src}" "${dest}"
+    fi
 }
```

```bash
--- a/scripts/lib/service.sh
+++ b/scripts/lib/service.sh
@@ -54,4 +54,7 @@ install_service_unit() {
     render_service_unit "${app_dir}" "${app_port}" "${ollama_host}" > "${tmp_unit}"
 
+    # Ensure parent directory exists in container before pushing
+    run_in_container "${c_name}" mkdir -p "$(dirname "${SYSTEMD_UNIT_PATH}")"
+
     # Push to container
     container_push "${tmp_unit}" "${c_name}${SYSTEMD_UNIT_PATH}"
```

## Tests Added or Updated

- `tests/test_deploy_lifecycle.py::TestDeployLifecycle.test_install_service_unit_pushes_unit_file` — Pins down that `install_service_unit` successfully creates `/etc/systemd/system` and transfers the rendered unit file into the container with correct directives.

## Local Verification

- Commands run:
  - `python3 -m unittest tests/unit/test_manifest_tool.py tests/unit/test_release_builder.py` → 13 tests passed (OK in 2.10s).
  - `python3 -m unittest tests/test_deploy_lifecycle.py` → 19 tests passed (OK in 15.75s).
- Manual checks: Verified that `container_push` passes `-p` on file transfer and does not append `-r` for non-directory sources.

## Deviations from Assessment

None.

## Follow-ups

- None.
