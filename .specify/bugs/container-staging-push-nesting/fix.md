# Bug Fix: Container Staging Directory Nested by incus file push

- **Slug**: container-staging-push-nesting
- **Fixed**: 2026-11-06T22:52:00Z
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Resolved directory nesting inside container staging during release package transfer by implementing `container_push_dir_contents` to transfer release contents directly into the target staging directory, adding self-healing subdirectory flattening in `verify_release_in_container`, updating `mock_incus.py` to support multi-source push, and adding regression tests.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `scripts/lib/incus.sh` | modified | Added `container_push_dir_contents` to transfer directory contents directly into container destinations |
| `scripts/deploy.sh` | modified | Updated install and update flows to call `container_push_dir_contents "${release_dir}" "${CONTAINER_NAME}${container_staging}/"` |
| `scripts/lib/archive.sh` | modified | Added defensive self-healing in `verify_release_in_container` to flatten any single nested subdirectory to container staging root |
| `tests/mock_incus.py` | modified | Updated mock `incus file push` handler to support multiple source items and directory destinations |
| `tests/test_deploy_lifecycle.py` | modified | Added `test_verify_release_in_container_flattens_nested_staging` testing auto-flattening |

## Diff Highlights

```bash
--- a/scripts/lib/incus.sh
+++ b/scripts/lib/incus.sh
@@ -63,3 +63,16 @@ container_push() {
     incus_cmd file push -r "${src}" "${dest}"
 }
+
+container_push_dir_contents() {
+    local src_dir="$1"
+    local dest="$2"
+    [[ "${dest}" != */ ]] && dest="${dest}/"
+
+    local items=()
+    for item in "${src_dir}"/*; do
+        [ -e "${item}" ] && items+=("${item}")
+    done
+    if [ ${#items[@]} -gt 0 ]; then
+        incus_cmd file push -r "${items[@]}" "${dest}"
+    fi
+}
```

```bash
--- a/scripts/lib/archive.sh
+++ b/scripts/lib/archive.sh
@@ -152,3 +152,7 @@ verify_release_in_container() {
     local container_staging_dir="$2"
 
+    # If artifacts were pushed inside a nested directory, flatten them to container_staging_dir
+    local flatten_cmd="if [ ! -f '${container_staging_dir}/checksums.sha256' ]; then sub=\$(find '${container_staging_dir}' -mindepth 1 -maxdepth 1 -type d | head -n 1); if [ -n \"\${sub}\" ] && [ -f \"\${sub}/checksums.sha256\" ]; then mv \"\${sub}\"/* '${container_staging_dir}/' && rm -rf \"\${sub}\"; fi; fi"
+    run_in_container_bash "${c_name}" "${flatten_cmd}" 2>/dev/null || true
+
     info "Verifying SHA-256 checksums inside container staging..."
```

## Tests Added or Updated

- `tests/test_deploy_lifecycle.py::TestDeployLifecycle.test_verify_release_in_container_flattens_nested_staging` — Pins down that `verify_release_in_container` detects any nested staging directory structure and flattens `checksums.sha256`, `manifest.json`, and `payload/` to the staging root prior to running `sha256sum -c`.
- `tests/test_deploy_lifecycle.py::TestDeployLifecycle.test_deploy_consumes_tarball_release_package` — Validates end-to-end transfer and activation with `container_push_dir_contents`.

## Local Verification

- Commands run:
  - `python3 -m unittest tests/unit/test_manifest_tool.py tests/unit/test_release_builder.py` → 13 tests passed (OK in 2.02s).
  - `python3 -m unittest tests/test_deploy_lifecycle.py` → 18 tests passed (OK in 15.32s).
- Manual checks: Verified that `container_push_dir_contents` correctly resolves globs and passes individual artifacts to `incus file push -r`.

## Deviations from Assessment

None. Both the direct contents push and defensive flattening remediations were implemented as proposed.

## Follow-ups

- None.
