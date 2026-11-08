# Bug Assessment: Read Aloud Playback Fails Due to Missing Bundled Kokoro Architecture Config

- **Slug**: tts-no-browser-sound
- **Created**: 2026-11-08
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

User report (translated from Persian):
> "باز هم کار نمی کنه."
> ("It still doesn't work.")

Context from verification (`.specify/bugs/tts-no-browser-sound/test.md`):
- After deploying the previous fix, clicking the read-aloud speaker button below completed assistant responses still causes the button to turn red (`.error-hint`) without producing audible sound.
- In `scripts/lib/tts.sh`, `download_kokoro_model` relies on `download_file_to_container` to download `config.json` from `https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/config.json` via `curl` executed *inside* the container.
- Because containers run in an offline/restricted network environment where `HF_HUB_OFFLINE=1` is enforced and external connectivity to Hugging Face is blocked, the container-internal `curl` fails silently.
- Consequently, `/opt/e-webui/shared/models/kokoro/config.json` is not created.
- In `app/services/tts_service.py`, `_check_environment()` checks for `self.model_dir / "config.json"`. Since the file is absent and no local fallback is bundled, `self.available` is set to `False` (`Model config (config.json) not found in /opt/e-webui/shared/models/kokoro`).
- Calls to `POST /api/tts/synthesize` return `HTTP 503 Service Unavailable`, causing the frontend `TTSController` to emit an error state and the UI button to turn red.

## Symptom

When a user clicks the read-aloud speaker button (`.btn-tts`) on any English assistant message:
1. The button briefly transitions to loading.
2. `POST /api/tts/synthesize` returns `HTTP 503` with detail `Model config (config.json) not found in /opt/e-webui/shared/models/kokoro`.
3. The button transitions to idle with the `.error-hint` class, turning the speaker icon red.
4. No audio is heard in the browser.

## Reproduction

1. In an isolated Incus container where Hugging Face access is blocked and `/opt/e-webui/shared/models/kokoro/` only has weights and voices (no `config.json`):
2. Run `./scripts/deploy.sh --update`. Observe that container-internal `curl` fails to fetch `config.json` from Hugging Face.
3. Open the web interface in the browser and prompt the model in English.
4. Click the speaker icon button below the response.
5. Observe that the button turns red and the browser console logs an HTTP 503 error.

## Suspected Code Paths

- `scripts/lib/tts.sh:176` — `download_file_to_container "${c_name}" "${config_url}" "${config_file}" 0 || true`:
  - Runs `curl` inside the container to fetch `config.json`. In offline/restricted environments, this call fails and `config.json` remains missing.
- `app/services/tts_service.py:89-95` — `_check_environment()`:
  - Requires `self.model_dir / "config.json"`. If missing, marks `self.available = False` without attempting to load or copy a bundled repository asset.
- `app/services/tts_service.py:111-113` — `_load_model()`:
  - Raises `RuntimeError` if `self.model_dir / "config.json"` is not found on disk.
- Repository structure:
  - `config.json` is not bundled anywhere in the project source tree (`app/resources/kokoro/`), forcing total dependency on Hugging Face downloads.

## Root Cause Hypothesis

**Confidence: High**

The deployment lifecycle manager expects the container to download `config.json` from Hugging Face via `curl` inside the container. Because the container is offline or network-isolated, this download fails silently. Simultaneously, `app/services/tts_service.py` requires `config.json` to be present on disk to initialize `KModel`. Because no default or bundled architecture configuration exists within the repository, the service marks itself unavailable (`HTTP 503`), turning the UI speaker icon red.

## Proposed Remediation

**Preferred**:
1. **Bundle Canonical Architecture Config**:
   - Add the standard `config.json` for Kokoro-82M directly to the repository under `app/resources/kokoro/config.json`.
2. **Self-Healing Fallback in `app/services/tts_service.py`**:
   - In `_check_environment()`:
     - Check `config_path = self.model_dir / "config.json"`.
     - If missing, check for bundled config at `app/resources/kokoro/config.json`.
     - If the bundled config is found, attempt to copy it to `self.model_dir / "config.json"`. If copying fails (e.g. read-only filesystem), use the bundled config path directly.
     - Mark `self.available = True` if weights, voices, and either local or bundled config exist.
   - In `_load_model()`:
     - Use `self.model_dir / "config.json"` if present; otherwise use the bundled config file path.
3. **Local Staging Copy in `scripts/lib/tts.sh`**:
   - In `download_kokoro_model()`, before attempting `curl` to Hugging Face, check if `app/resources/kokoro/config.json` exists in the release directory. If so, copy it directly into `${config_file}` via `run_in_container cp`.
4. **Unit Tests**:
   - Update `tests/unit/test_tts_service.py` to test self-healing fallback when `self.model_dir / "config.json"` is absent but the bundled config is available.

## Risks & Considerations

- **Model Compatibility**: Kokoro-82M's architecture config is static and canonical (it does not change between invocations). Bundling it directly in the source tree guarantees 100% offline self-containment with zero external network dependencies.
- **Repository Size**: `config.json` is under 4 KB, introducing negligible footprint.

## Open Questions

- None.
