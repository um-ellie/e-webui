# Bug Fix: Update Kokoro-82M Model Weights URL to v1.0 with v0.19 Fallback and Symlinks

- **Slug**: kokoro-model-download-404
- **Fixed**: 2026-11-07
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Updated Kokoro-82M model weights acquisition in `scripts/lib/tts.sh` to target `kokoro-v1_0.pth` from Hugging Face `main` with automatic fallback to `v0.19/kokoro-v0_19.pth` and bidirectional compatibility symlinks. This fixes the HTTP 404 error caused by Hugging Face repository restructuring while guaranteeing 100% backwards compatibility for existing deployments and specifications.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `scripts/lib/tts.sh` | modified | Updated default weights file to `kokoro-v1_0.pth`, updated `kokoro_model_is_present` to accept either version, added fallback download and symlink creation |
| `scripts/lib/diagnostics.sh` | modified | Updated `--status` to display the active model filename (`kokoro-v1_0.pth` or `kokoro-v0_19.pth`) and verified size |
| `tests/mock_incus.py` | modified | Added support for `kokoro-v1_0.pth` mock file creation and `SIMULATE_V1_404` error simulation |
| `tests/test_deploy_lifecycle.py` | modified | Updated tests to check both primary and symlink weights; added `test_model_download_fallback_to_v019` |

## Diff Highlights

```bash
# scripts/lib/tts.sh
-KOKORO_WEIGHTS_FILE="kokoro-v0_19.pth"
+KOKORO_WEIGHTS_FILE="kokoro-v1_0.pth"

# download_kokoro_model primary + fallback:
if download_file_to_container "${c_name}" "${weights_url}" "${v1_weights}" "${KOKORO_MIN_WEIGHTS_SIZE}"; then
    download_success=1
    run_in_container "${c_name}" ln -sfn kokoro-v1_0.pth "${v019_weights}" || true
else
    warn "Direct download of kokoro-v1_0.pth failed. Attempting fallback to v0.19 release..."
    local fallback_url="${hf_base}/hexgrad/Kokoro-82M/resolve/v0.19/kokoro-v0_19.pth"
    if download_file_to_container "${c_name}" "${fallback_url}" "${v019_weights}" "${KOKORO_MIN_WEIGHTS_SIZE}"; then
        download_success=1
        run_in_container "${c_name}" ln -sfn kokoro-v0_19.pth "${v1_weights}" || true
    fi
fi
```

## Tests Added or Updated

- `tests/test_deploy_lifecycle.py::test_install_provisions_tts_environment_and_persists_model` — Verified that both `kokoro-v1_0.pth` and `kokoro-v0_19.pth` are present after clean install.
- `tests/test_deploy_lifecycle.py::test_skip_model_download_and_standalone_download_model` — Verified that `--download-model` provisions both model files and `--skip-model-download` bypasses both.
- `tests/test_deploy_lifecycle.py::test_status_and_repair_tts_environment` — Verified that status and repair properly detect missing model weights and restore both.
- `tests/test_deploy_lifecycle.py::test_model_download_fallback_to_v019` — Pinned down the fallback behavior when the primary v1.0 weights download fails with HTTP 404, confirming it falls back to the v0.19 tag and sets up the symlink.

## Local Verification

- Commands run: `python3 -m unittest tests/test_deploy_lifecycle.py` → 25 tests passed (Ran 25 tests in 90.416s, OK).
- Manual checks: Verified relative symlinks preserve host and container accessibility without hardcoded host mount paths.

## Deviations from Assessment

None. The implementation followed the preferred remediation exactly.

## Follow-ups

- Validate in an actual Incus container environment when operator connectivity is available.
