# Bug Assessment: Release Staging Directory Path Corrupted by stdout in Archive Extraction

- **Slug**: release-dir-stdout-corruption
- **Created**: 2026-11-06T22:25:00Z
- **Source**: Pasted text from user deployment session
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

The user ran `./deploy.sh` to install `e-webui` on a clean container (`e-webui-app`).
The deployment manager discovered and selected the latest release archive:
`/home/ellie/Documents/Projects/e-webui/dist/releases/e-webui-1.0.0-20261106-184553-e784c0dd-dirty.tar.gz`.

During host pre-flight verification, deployment failed with the error:
```text
[INFO] Consuming initial release package: /home/ellie/Documents/Projects/e-webui/dist/releases/e-webui-1.0.0-20261106-184553-e784c0dd-dirty.tar.gz
[INFO] Running host pre-flight verification on release package...
[ERROR] Release package missing 'manifest.json' in [VALID] Archive 'e-webui-1.0.0-20261106-184553-e784c0dd-dirty.tar.gz' is verified safe for extraction.
/tmp/e-webui-deploy-stage.99VKYP
```

## Symptom

When `./deploy.sh` consumes a `.tar.gz` release bundle, the staging function `prepare_release_package_on_host` returns a multiline string consisting of the `verify-archive` success message followed by the actual staging directory path. The deployment manager assigns this multiline value to `release_dir`, causing file existence checks for `${release_dir}/manifest.json` to fail and aborting the deployment before transfer. Expected behavior is for `prepare_release_package_on_host` to output only the sanitized directory path on stdout.

## Reproduction

1. Build a valid release archive: `./build-release.sh`.
2. Run `./deploy.sh` targeting any container (or run `release_dir=$(prepare_release_package_on_host "dist/releases/<release>.tar.gz" "/tmp/test-stage")`).
3. Inspect the value of `release_dir`.
4. Observe that `release_dir` contains `[VALID] Archive '...' is verified safe for extraction.\n/tmp/test-stage` instead of just `/tmp/test-stage`.

## Suspected Code Paths

- `scripts/lib/archive.sh:70` — Invokes `python3 "${manifest_tool}" verify-archive "${pkg_path}" 2>/dev/null` inside `prepare_release_package_on_host` without redirecting stdout, contaminating the function's stdout return stream.
- `scripts/lib/manifest_tool.py:233` — `cmd_verify_archive` prints informational text `[VALID] Archive ...` to stdout rather than stderr.
- `tests/test_deploy_lifecycle.py:308-335` — `_build_test_release_package` creates an uncompressed directory structure rather than packaging a `.tar.gz` bundle, bypassing the archive extraction codepath during automated integration tests.

## Root Cause Hypothesis

`prepare_release_package_on_host` is designed to return the directory path of the staged release via stdout (`echo "${stage_dir}"`). Prior to extraction, it runs `manifest_tool.py verify-archive` to ensure the archive contains no directory traversal sequences or unsafe paths. However, while stderr is redirected (`2>/dev/null`), stdout is unredirected. `manifest_tool.py:233` writes `[VALID] Archive '...' is verified safe for extraction.` to stdout. When `scripts/deploy.sh` invokes `release_dir=$(prepare_release_package_on_host ...)`, the command substitution captures both the validation banner and the directory path. Confidence: High.

## Proposed Remediation

**Preferred**:
1. In `scripts/lib/archive.sh:70`, redirect stdout of the pre-extraction archive verification call to standard error (`>&2`) or `/dev/null` (e.g. `python3 "${manifest_tool}" verify-archive "${pkg_path}" >&2` or `>/dev/null 2>&1`), ensuring `prepare_release_package_on_host` strictly emits only the path on stdout.
2. Review all helper functions in `scripts/lib/archive.sh` and `scripts/lib/release.sh` called via command substitution to ensure informational logging is directed exclusively to stderr (`>&2` or logger functions `info`/`warn`) rather than stdout.
3. Update `manifest_tool.py` so verification status messages can be silenced or written to stderr if preferred.
4. Add automated test coverage in `tests/test_deploy_lifecycle.py` and `tests/unit/test_release_builder.py` that exercises `prepare_release_package_on_host` with an actual `.tar.gz` archive bundle to prevent regression.

**Alternatives**:
- In `manifest_tool.py`, route all non-data log messages to `sys.stderr` instead of `sys.stdout`. While clean, ensuring callers redirect subcommands is still essential defense-in-depth for bash functions returning strings via stdout.

**Files likely to change**:
- `scripts/lib/archive.sh`
- `tests/test_deploy_lifecycle.py`
- `tests/unit/test_manifest_tool.py`

**Tests to add or update**:
- Add a test in `tests/test_deploy_lifecycle.py` verifying that `prepare_release_package_on_host` outputs solely a single clean directory path on stdout when given a `.tar.gz` archive.
- Add an end-to-end deployment lifecycle test where `rel_pkg` is a compressed `.tar.gz` bundle rather than an unpacked directory.

## Risks & Considerations

- Zero risk to application runtime code or API contracts.
- Low blast radius: confined to host staging and unpacking helper functions in deployment automation scripts.

## Open Questions

None. The defect is fully reproduced by code inspection and the error log.
