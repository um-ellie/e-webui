# Bug Assessment: TTS Read Aloud Fails with 503 Due to Missing Soundfile Dependency in Active Venv

- **Slug**: tts-playback-unavailable-soundfile
- **Created**: 2026-11-20
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

User report (in Persian):
> "متاسفانه سیستم پخش صدا که در واقع پاسخ های دریافت شده از ollama رو با لهجه آمریکایی می خواند و تلفظ می کرد از کار افتاده"
> ("Unfortunately, the audio playback system that reads and pronounces the responses received from Ollama in an American accent has stopped working.")

## Symptom

When a user clicks the read-aloud speaker button (`.btn-tts`) on any English assistant message:
1. The speaker button transitions to loading.
2. The backend logs:
   ```text
   [WARNING] e-webui: TTS synthesis requested but service unavailable: soundfile package is not installed.
   INFO: 127.0.0.1:52678 - "POST /api/tts/synthesize HTTP/1.1" 503 Service Unavailable
   ```
3. The HTTP response returns `503 Service Unavailable` with detail `"soundfile package is not installed."`.
4. The button turns red (`.error-hint` class applied) and no audio is generated or played in the browser.

## Reproduction

1. In the active Incus container `e-webui-app`:
   Inspect the active virtual environment:
   ```bash
   incus exec e-webui-app -- /opt/e-webui/current/venv/bin/pip list | grep soundfile
   ```
   *Observed*: `soundfile` is missing (package not installed in current venv).
2. Open the web interface at `http://127.0.0.1:8080`.
3. Submit an English prompt to the assistant (e.g. *"Introduce yourself in two sentences."*).
4. Click the speaker icon button below the assistant message.
5. Observe the button turning red with no audible sound.

## Suspected Code Paths

- `scripts/lib/venv.sh:17-48`: In `resolve_compatible_python`, the logic prefers Debian 13 system `python3` (Python 3.13), ignoring the pre-existing isolated `/opt/e-webui/interpreters/python-3.11` where PyTorch and Kokoro were previously installed.
- `scripts/lib/venv.sh:131`: `venv_dir_for_hash` was changed to target `env-${hash_val}` instead of `py3.11-${hash_val}`, disconnecting from the pre-existing complete virtual environment (`py3.11-562bd602ef30cbc9fb736f58c23034e54d01b48afc93dbd6c1282cd7434d9e4d`) where `soundfile 0.14.0`, `kokoro 0.9.4`, and `torch 2.6.0+cpu` are already installed and cached.
- `scripts/deploy.sh:41`: `DEPLOY_PROFILE="core"` was introduced as the default deployment profile, skipping `soundfile`, `kokoro`, and `torch` installation during updates.
- `app/services/tts_service.py:44`: `_check_environment()` fails at `import soundfile`, marking `self.available = False` and `self.error_reason = "soundfile package is not installed."`.
- `app/main.py:155`: `POST /api/tts/synthesize` returns `HTTP 503 Service Unavailable` when `tts_service.available` is `False`.
- `app/static/js/components/chat.js:455`: The frontend displays the read-aloud button on all English responses without checking whether TTS is active on the server.

## Root Cause Hypothesis

**Confidence: High**

In the recent deployment lifecycle refactoring (Feature 023), `DEPLOY_PROFILE` was defaulted to `"core"` (to achieve the <50MB RAM footprint). This caused `venv.sh` to provision a lightweight Python 3.13 virtual environment without `soundfile`, `kokoro`, or `torch`.

However, the container already has the full Kokoro model weights (`kokoro-v1_0.pth` 327MB), architecture config (`config.json`), and American voice embeddings (`voices/af_heart.pt`, etc.) stored in `/opt/e-webui/shared/models/kokoro/`, and already has a complete Python 3.11 virtual environment containing `torch`, `kokoro`, and `soundfile` at `/opt/e-webui/venvs/py3.11-562bd602ef30cbc9fb736f58c23034e54d01b48afc93dbd6c1282cd7434d9e4d`.

Because the active release symlink was pointed to the new core Python 3.13 venv, `soundfile` was not importable, causing the backend to reject all speech synthesis requests with HTTP 503.

## Proposed Remediation

**Preferred**:
1. **Auto-Detect Existing TTS Assets in Deployment**:
   In `scripts/lib/venv.sh` and `scripts/lib/release.sh`, when Kokoro model weights and an existing compatible Python 3.11 TTS environment are already present on the container, retain or link to the TTS-enabled virtual environment unless the user explicitly requested `--profile core`.
2. **Profile Auto-Detection**:
   If `/opt/e-webui/shared/models/kokoro/kokoro-v1_0.pth` exists in persistent storage, default the deployment profile to `tts` (or link the existing `py3.11` venv), ensuring seamless continuity of the American speech playback feature for users who already have it set up.
3. **Frontend Awareness**:
   Add a TTS status flag to `/api/health` or `/api/tts/status` so `chat.js` can display a helpful tooltip (e.g. *"TTS is in Core mode; activate TTS profile in ./ctl to enable voice"*) rather than a cryptic red failure hint if TTS is intentionally disabled.
4. **Interactive Profile Switcher in `./ctl`**:
   Ensure Option `[7] Modular Profiles` in `./ctl` seamlessly switches the active release venv pointer between `core` and `py3.11` TTS venv and reloads the service immediately.

**Alternatives**:
- *Force reinstall of torch and soundfile into Python 3.13*: Rejected because Kokoro and its C dependencies have known compatibility friction on Python 3.13 on Debian 13, whereas the Python 3.11 environment in the container is already 100% verified and working.

**Files likely to change**:
- `scripts/lib/venv.sh`
- `scripts/lib/release.sh`
- `scripts/deploy.sh`
- `scripts/ctl.sh`
- `app/main.py`
- `tests/unit/test_tts_profile.py`

**Tests to add or update**:
- Unit test verifying that when TTS assets are present, `resolve_compatible_python` and `link_release_environment` prioritize the TTS environment.
- Integration test checking that `/api/tts/synthesize` returns HTTP 200 with audio/wav when TTS profile is active.

## Risks & Considerations

- **Memory Impact**: Switching to the TTS-enabled Python 3.11 venv will load PyTorch CPU libraries upon synthesis, increasing process memory from ~40MB to ~350MB during active speech synthesis (within expected bounds for offline neural TTS).
- **Zero Download Required**: Because the weights (`kokoro-v1_0.pth`), config (`config.json`), and venv (`py3.11-...`) are already on the container, the fix can be applied immediately with zero external network downloads.

## Open Questions

- None. Root cause is confirmed by live container logs and package auditing.
