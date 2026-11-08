# Bug Fix: Bundled Kokoro Architecture Config and Self-Healing Offline Provisioning

- **Slug**: tts-no-browser-sound
- **Fixed**: 2026-11-08
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Resolved TTS browser synthesis failure and red speaker button in offline environments by bundling the canonical Kokoro-82M architecture configuration directly in the repository at `app/resources/kokoro/config.json`. `TTSService` now automatically self-heals by copying or loading the bundled config if missing from shared storage, and `scripts/lib/tts.sh` prioritizes local release/workspace copies before attempting external network downloads.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `app/resources/kokoro/config.json` | added | Bundled the canonical 2.3KB Kokoro-82M architecture configuration (istftnet, plbert, and 178-token vocabulary) directly into the application source tree. |
| `app/services/tts_service.py` | modified | Updated `_check_environment()` and `_load_model()` to detect the bundled `app/resources/kokoro/config.json` fallback, automatically copying it to shared model storage or loading it directly when missing on disk. |
| `scripts/lib/tts.sh` | modified | Enhanced `download_kokoro_model()` to check for bundled config in the container release (`${app_dir}/current/app/resources/kokoro/config.json`) or host workspace (`${REPO_ROOT}/app/resources/kokoro/config.json`) and copy/push it directly, eliminating network dependencies. |
| `tests/unit/test_tts_service.py` | modified | Added tests for automatic self-healing of missing `config.json` from bundled resources, as well as offline detection when neither local nor bundled config exists. |

## Diff Highlights

```python
# app/services/tts_service.py
# Check architecture config file (shared directory or bundled repository fallback)
config_path = self.model_dir / "config.json"
bundled_config = Path(__file__).resolve().parent.parent / "resources" / "kokoro" / "config.json"

if not config_path.is_file():
    if bundled_config.is_file():
        # Attempt to auto-populate missing config in shared model storage
        try:
            import shutil
            self.model_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(bundled_config, config_path)
            logger.info(f"Self-healed missing config: copied {bundled_config} to {config_path}")
        except Exception as e:
            logger.debug(f"Could not copy bundled config to {config_path} ({e}); using bundled path.")
    else:
        self.available = False
        self.error_reason = f"Model config (config.json) not found in {self.model_dir} or {bundled_config}"
        logger.warning(f"TTS unavailable: {self.error_reason}")
        return
```

```bash
# scripts/lib/tts.sh
# Priority chain for Kokoro architecture config
info "2/3 Checking/Provisioning Kokoro-82M architecture config (${KOKORO_CONFIG_FILE})..."
if ! container_test_file "${c_name}" "${config_file}"; then
    local repo_bundled="${REPO_ROOT:-}/app/resources/kokoro/config.json"
    local container_bundled="${app_dir}/current/app/resources/kokoro/config.json"

    if container_test_file "${c_name}" "${container_bundled}"; then
        info "Copying bundled Kokoro architecture config from current container release..."
        run_in_container "${c_name}" cp -f "${container_bundled}" "${config_file}" || true
    elif [ -n "${REPO_ROOT:-}" ] && [ -f "${repo_bundled}" ]; then
        info "Pushing bundled Kokoro architecture config from host workspace..."
        container_push "${repo_bundled}" "${c_name}${config_file}" || true
    else
        local config_url="${repo_url}/${KOKORO_CONFIG_FILE}"
        download_file_to_container "${c_name}" "${config_url}" "${config_file}" 0 || true
    fi
fi
```

## Tests Added or Updated

- `tests/unit/test_tts_service.py::test_environment_check_auto_heals_missing_config_from_bundled` — Validates that if `config.json` is absent in `model_dir`, `TTSService` automatically copies it from `app/resources/kokoro/config.json` and marks the service available.
- `tests/unit/test_tts_service.py::test_environment_check_missing_config_file_when_no_bundled` — Asserts `self.available = False` when both local and bundled config files are absent.

## Local Verification

- Unit Tests: `python3 -m unittest tests/unit/test_text_cleaner.py tests/unit/test_tts_service.py` → 24 tests passed in 0.018s.
- Deployment Lifecycle Integration: `python3 -m unittest discover -s tests -p "test_deploy_lifecycle.py"` → 25 tests passed in 49.8s.

## Deviations from Assessment

None. The implementation follows the proposed remediation exactly.

## Follow-ups

- Deploy the update to the container using `./scripts/deploy.sh --update <container_name>`. The deployment package will include `app/resources/kokoro/config.json`, and the container service will auto-provision `config.json` with zero network access required.
- Test in the browser by clicking the speaker icon under an English assistant response.
