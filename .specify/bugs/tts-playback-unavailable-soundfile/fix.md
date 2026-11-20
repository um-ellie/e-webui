# Bug Fix: Restore Kokoro TTS Audio Playback via Intelligent Profile and Venv Resolution

- **Slug**: tts-playback-unavailable-soundfile
- **Fixed**: 2026-11-20
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Resolved the missing `soundfile` dependency and HTTP 503 error on TTS playback by enabling automatic detection of pre-existing Kokoro TTS assets in deployment workflows, properly preserving and linking the TTS-capable Python 3.11 virtual environment (`py3.11-...`), enhancing `./ctl` interactive profile management, and exposing TTS operational status via `/api/health` and `/api/tts/status`.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `scripts/lib/venv.sh` | modified | Added profile parameter to `resolve_compatible_python`, `venv_dir_for_hash`, `venv_exists_in_container`, and `ensure_venv_in_container`. For `tts` profile, prioritizes standalone/system Python 3.11 and paths matching `py3.11-${hash}`. |
| `scripts/lib/release.sh` | modified | Updated `link_release_environment` to link `py3.11-${hash}` when `profile=tts` (or fallback to existing compatible venv). |
| `scripts/deploy.sh` | modified | Added `resolve_deployment_profile` to auto-detect `tts` profile when Kokoro model weights are already present on the container; passed active profile to environment linking. |
| `scripts/ctl.sh` | modified | In Option `[7] Modular Profiles`, implemented atomic symlink switching (`current/venv`) between `core` and `tts` venvs with service reload and fallback provisioning. |
| `app/models.py` | modified | Added `tts_available` and `tts_error` fields to `HealthResponse`. |
| `app/main.py` | modified | Updated `/api/health` to report TTS availability; added `/api/tts/status` endpoint; added self-healing environment re-check in `synthesize_speech`. |
| `app/services/tts_service.py` | modified | Added `recheck_environment()` to allow live runtime status re-evaluation without process restarts. |
| `app/static/js/components/chat.js` | modified | Improved TTS error hint tooltip to inform the user when speech synthesis profile needs activation in `./ctl`. |
| `tests/unit/test_tts_profile.py` | added | Unit tests verifying `venv_dir_for_hash` profile isolation, `HealthResponse` schema serialization, and `TTSService.recheck_environment`. |

## Diff Highlights

### `scripts/deploy.sh` Auto-Detection
```bash
resolve_deployment_profile() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    if [ -n "${CLI_DEPLOY_PROFILE:-}" ]; then
        echo "${CLI_DEPLOY_PROFILE}"
        return 0
    fi

    if [ "$(type -t kokoro_model_is_present || true)" = "function" ] && \
       kokoro_model_is_present "${c_name}" "${app_dir}"; then
        echo "tts"
        return 0
    fi
    ...
```

### `scripts/lib/venv.sh` Profile Isolation
```bash
venv_dir_for_hash() {
    local app_dir="${1:-/opt/e-webui}"
    local hash_val="$2"
    local profile="${3:-${DEPLOY_PROFILE:-core}}"
    if [ "${profile}" = "tts" ]; then
        echo "${app_dir}/venvs/py3.11-${hash_val}"
    else
        echo "${app_dir}/venvs/env-${hash_val}"
    fi
}
```

## Tests Added or Updated

- `tests/unit/test_tts_profile.py::TestTTSProfileResolution::test_venv_dir_for_hash_respects_profile` — pins down profile-aware directory resolution (`py3.11-...` vs `env-...`).
- `tests/unit/test_tts_profile.py::TestTTSProfileResolution::test_health_response_schema_has_tts_fields` — pins down `tts_available` and `tts_error` serialization in `HealthResponse`.
- `tests/unit/test_tts_profile.py::TestTTSProfileResolution::test_tts_service_recheck_environment` — pins down error state reset and environment re-checking in `TTSService`.

## Local Verification

- Commands run:
  - `./scripts/test.sh --local` → `Ran 107 tests in 5.523s - OK (skipped=12)`
  - `./deploy.sh --update e-webui-app` → auto-detected `tts` profile, reused cached `py3.11-562bd...` venv, deployed release `20261120-010213-f880fea6-dirty`, HTTP health verified.
  - `incus exec e-webui-app -- readlink -f /opt/e-webui/current/venv` → `/opt/e-webui/venvs/py3.11-562bd602ef30cbc9fb736f58c23034e54d01b48afc93dbd6c1282cd7434d9e4d`
  - `incus exec e-webui-app -- curl -s http://127.0.0.1:8080/api/health` → `{"status":"ok", ..., "tts_available":true, "tts_error":null}`
  - `incus exec e-webui-app -- curl -s -X POST http://127.0.0.1:8080/api/tts/synthesize ...` → HTTP 200, generated 194KB WAV audio file. Warm response time ~1.95s on CPU.
- Manual checks:
  - Validated that changing profiles in `./ctl` seamlessly updates the symlink and reloads the service.

## Deviations from Assessment

None. The remediation followed the preferred plan documented in `assessment.md`.

## Follow-ups

- Next step is to execute `/speckit-bug-test slug=tts-playback-unavailable-soundfile` to generate the formal verification report.
