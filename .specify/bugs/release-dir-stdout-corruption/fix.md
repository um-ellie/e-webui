# Bug Fix: Release Staging Directory Path Corrupted by stdout in Archive Extraction

- **Slug**: release-dir-stdout-corruption
- **Fixed**: 2026-11-06T22:38:00Z
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Fixed stdout contamination during `.tar.gz` release package extraction in `prepare_release_package_on_host` by capturing archive pre-verification output and routing failure messages to stderr, added an optional `--quiet` flag to `manifest_tool.py verify-archive`, and added integration tests verifying clean staging and deployment from compressed archives.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `scripts/lib/archive.sh` | modified | Captured `verify-archive` stdout/stderr during host preparation, routing failures to stderr and ensuring only the clean directory path is emitted on stdout |
| `scripts/lib/manifest_tool.py` | modified | Added `--quiet` / `-q` CLI flag to `verify-archive` subcommand to suppress informational success messages when required |
| `tests/unit/test_manifest_tool.py` | modified | Added unit test `test_verify_archive_quiet_flag` |
| `tests/test_deploy_lifecycle.py` | modified | Added `_build_test_release_tarball`, `test_prepare_release_package_on_host_tarball`, and `test_deploy_consumes_tarball_release_package` |

## Diff Highlights

```bash
--- a/scripts/lib/archive.sh
+++ b/scripts/lib/archive.sh
@@ -69,8 +69,9 @@ prepare_release_package_on_host() {
         mkdir -p "${stage_dir}"
         # Validate outer bundle before extracting
         local manifest_tool="${LIB_DIR}/manifest_tool.py"
-        if ! python3 "${manifest_tool}" verify-archive "${pkg_path}" 2>/dev/null; then
-            error "Release bundle '${pkg_path}' failed safety verification (unsafe paths detected)."
+        local verify_out
+        if ! verify_out=$(python3 "${manifest_tool}" verify-archive "${pkg_path}" 2>&1); then
+            error "Release bundle '${pkg_path}' failed safety verification (unsafe paths detected):\n${verify_out}"
             return 2
         fi
         tar -xzf "${pkg_path}" -C "${stage_dir}"
```

```python
--- a/scripts/lib/manifest_tool.py
+++ b/scripts/lib/manifest_tool.py
@@ -233,4 +233,5 @@ def cmd_verify_archive(args: argparse.Namespace) -> int:
-    print(f"[VALID] Archive '{archive_path.name}' is verified safe for extraction.")
+    if not getattr(args, "quiet", False):
+        print(f"[VALID] Archive '{archive_path.name}' is verified safe for extraction.")
     return 0
```

## Tests Added or Updated

- `tests/unit/test_manifest_tool.py::TestManifestTool.test_verify_archive_quiet_flag` — Pins down that `-q` / `--quiet` flag silences stdout while still validating safe archives with exit code 0.
- `tests/test_deploy_lifecycle.py::TestDeployLifecycle.test_prepare_release_package_on_host_tarball` — Pins down that `prepare_release_package_on_host` emits strictly a single clean directory path on stdout without any log messages or validation banners.
- `tests/test_deploy_lifecycle.py::TestDeployLifecycle.test_deploy_consumes_tarball_release_package` — Pins down that `deploy.sh` cleanly consumes and unpacks compressed `.tar.gz` release archives without failing pre-flight manifest verification.

## Local Verification

- Commands run:
  - `python3 -m unittest tests/unit/test_manifest_tool.py` → 10 tests passed (OK in 0.72s).
  - `python3 -m unittest tests/unit/test_release_builder.py` → 3 tests passed (OK in 1.29s).
  - `python3 -m unittest tests/test_deploy_lifecycle.py` → 17 tests passed (OK in 15.11s), including the 2 new tarball extraction tests.
- Manual checks: Inspected stdout output of `prepare_release_package_on_host` to ensure only the absolute directory path is produced.

## Deviations from Assessment

None. The remediation followed the preferred approach outlined in the assessment.

## Follow-ups

- Consider updating `.gitignore` from unanchored `lib/` to `/lib/` or adding `!scripts/lib/` to prevent `scripts/lib/*` files from being ignored by Git.
