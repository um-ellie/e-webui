# Bug Fix: Default to TTS Profile on Install and Fix Kokoro Provisioning Lifecycle

- **Slug**: deploy-lifecycle-tts-provision-fixes
- **Fixed**: 2026-11-20T05:48:45Z
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Resolved the Catch-22 defaulting bug in `resolve_deployment_profile()` by defaulting fresh installations and legacy migrations to the full-featured `tts` profile. Separated Kokoro model download skipping from core profile suppression, guaranteed Python 3.11 standalone provisioning under TTS, and aligned `ctl.sh` and state defaults.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `scripts/deploy.sh` | modified | Updated `resolve_deployment_profile()` to default unconfigured installs/migrations to `tts`, and corrected `--skip-model-download` logging in both `run_update` and `run_install`. |
| `scripts/lib/state.sh` | modified | Removed hardcoded `core` fallback in `state_get_profile()`, returning empty string when unrecorded, and defaulted new release profile commitments to `tts`. |
| `scripts/lib/venv.sh` | modified | Added explicit `return 1` in `resolve_compatible_python()` when TTS profile cannot find Python 3.11/3.12, forcing standalone Python 3.11 provisioning. |
| `scripts/ctl.sh` | modified | Clarified initial installation prompt to mention TTS default, and defaulted dashboard/profile fallback to `tts`. |

## Diff Highlights (optional)

```bash
# scripts/deploy.sh
resolve_deployment_profile() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    if [ -n "${CLI_DEPLOY_PROFILE:-}" ]; then
        echo "${CLI_DEPLOY_PROFILE}"
        return 0
    fi

    if [ "$(type -t state_get_profile || true)" = "function" ]; then
        local prev_prof
        prev_prof=$(state_get_profile "${c_name}" "${app_dir}")
        if [ -n "${prev_prof}" ]; then
            echo "${prev_prof}"
            return 0
        fi
    fi

    if [ "$(type -t kokoro_model_is_present || true)" = "function" ] && \
       kokoro_model_is_present "${c_name}" "${app_dir}"; then
        echo "tts"
        return 0
    fi

    echo "tts"
}
```

```bash
# scripts/lib/venv.sh
        # Under TTS profile, do not fall through to unvalidated/3.13 system python3; force standalone provision
        return 1
```

## Tests Added or Updated

- `tests/test_deploy_lifecycle.py::test_fresh_install_tts_provisioning` — Validates that initial install (`--install`) provisions standalone Python 3.11, PyTorch/audio packages, and Kokoro model files.
- `tests/test_deploy_lifecycle.py::test_update_migrates_py313_venv` — Validates that updates from Python 3.13 cleanly migrate to standalone Python 3.11.
- `tests/test_deploy_lifecycle.py::test_skip_model_download_and_standalone_download_model` — Validates that `--skip-model-download` skips weights with correct logging and `--download-model` works standalone.
- `tests/test_deploy_lifecycle.py::test_model_download_failure_resilience` — Validates resilient non-blocking model download failure handling.
- `tests/test_deploy_lifecycle.py::test_model_download_fallback_to_v019` — Validates fallback to v0.19 model weights.

## Local Verification

- Commands run:
  - `/usr/bin/python3 -m unittest tests/test_deploy_lifecycle.py` → `Ran 26 tests in 96.032s. OK` (all 26 lifecycle tests passed, 0 failures).
  - `/usr/bin/python3 -m unittest discover -s tests/unit -p "test_*.py"` → `Ran 110 tests in 5.140s. OK (skipped=12)` (0 failures).
  - `/usr/bin/python3 -m unittest tests/test_ui_contracts.py` → `Ran 9 tests in 0.003s. OK` (0 failures).

## Deviations from Assessment

None. The implementation matched the preferred remediation steps in `assessment.md` exactly.

## Follow-ups

- Run `/speckit-bug-test slug=deploy-lifecycle-tts-provision-fixes` to record test verification.
