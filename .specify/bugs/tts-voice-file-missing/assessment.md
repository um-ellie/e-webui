# Bug Assessment: TTS Synthesis Fails Due to Missing af_heart.pt Voice File in Offline Container

- **Slug**: tts-voice-file-missing
- **Created**: 2026-11-08T22:59:00+03:30
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

User request:
> "The app fails and you could not find the cause from the code alone.
> You now have permission (see the "Incus Container Access" rule) to inspect the container `e-webui-app` directly."

Investigation inside the `e-webui-app` container:
- The systemd unit `e-webui.service` is active and running (`PID 860`).
- When sending speech synthesis requests to `/api/tts/synthesize`, the service fails with HTTP 500.
- Container journalctl log reveals:
  ```text
  [INFO] e-webui.tts: Kokoro model loaded successfully.
  [ERROR] e-webui: TTS synthesis failed for message_id='...': An error happened while trying to locate the file on the Hub and we cannot find the requested files in the local cache. Please check your connection and try again or make sure your Internet connection is on.
  WARNING: Defaulting repo_id to hexgrad/Kokoro-82M. Pass repo_id='hexgrad/Kokoro-82M' to suppress this warning.
  INFO: 127.0.0.1:47750 - "POST /api/tts/synthesize HTTP/1.1" 500 Internal Server Error
  ```

## Symptom

When a client sends a synthesis request to `POST /api/tts/synthesize` in the container:
1. `uvicorn` logs an unhandled error: Kokoro attempts to contact Hugging Face Hub to locate `voices/af_heart.pt`.
2. Because the container is configured with `HF_HUB_OFFLINE=1` and has no external internet route, the Hub lookup fails.
3. The endpoint returns `500 Internal Server Error` with `{"detail": "Failed to synthesize audio."}`.

## Reproduction

1. Verify container is running:
   ```bash
   incus list
   ```
2. Send a POST request to `/api/tts/synthesize` inside `e-webui-app`:
   ```bash
   incus exec e-webui-app -- curl -i -X POST http://127.0.0.1:8080/api/tts/synthesize \
     -H "Content-Type: application/json" \
     -d '{"text":"Hello world"}'
   ```
3. Observe HTTP response:
   ```text
   HTTP/1.1 500 Internal Server Error
   {"detail":"Failed to synthesize audio."}
   ```
4. Check journalctl:
   ```bash
   incus exec e-webui-app -- journalctl -u e-webui.service -n 5 --no-pager
   ```
   Observe: `TTS synthesis failed: An error happened while trying to locate the file on the Hub...`

## Suspected Code Paths

- `app/services/tts_service.py:164-174`:
  ```python
  voice_file = self.model_dir / "voices" / "af_heart.pt"
  if self.voice_tensor is None:
      if voice_file.is_file():
          ...
      else:
          self.voice_tensor = "af_heart"
  ```
  Only checks for `af_heart.pt`. When absent, assigns the bare string `"af_heart"`.
- `site-packages/kokoro/pipeline.py:load_single_voice`:
  When the voice parameter is a string not ending in `.pt` (e.g. `"af_heart"`), Kokoro calls `hf_hub_download(repo_id=self.repo_id, filename='voices/af_heart.pt')`. In offline containers (`HF_HUB_OFFLINE=1`), this throws `OfflineModeIsEnabled`/network exception.
- `app/services/tts_service.py:82-88`:
  `_check_environment()` only verifies `voices_dir.is_dir()`, but does not verify whether any voice files actually exist or whether the expected voice profile is loadable.
- `/opt/e-webui/shared/models/kokoro/voices/`:
  Contains `af_nicole.pt`, `af_sarah.pt`, `am_adam.pt`, `am_michael.pt`, `bf_emma.pt`, `bf_isabella.pt`, `bm_george.pt`, `bm_lewis.pt`, but `af_heart.pt` is missing.

## Root Cause Hypothesis

**Confidence: High**

`app/services/tts_service.py` is hardcoded to look only for `voices/af_heart.pt`. When that specific voice file is not present on disk, the code falls back to `self.voice_tensor = "af_heart"`. In `kokoro.KPipeline`, passing a string without a `.pt` extension triggers an automatic download attempt via `hf_hub_download` from the Hugging Face Hub. Because the container is offline (`HF_HUB_OFFLINE=1` in `e-webui.service`), this network call fails with a Hub error, returning a 500 error to clients. 

Although `af_heart.pt` is absent, 8 other standard Kokoro voices exist locally in `/opt/e-webui/shared/models/kokoro/voices/` (including American Female voices `af_sarah.pt` and `af_nicole.pt`). Direct execution in the container confirmed that loading `af_sarah.pt` or `af_nicole.pt` produces valid speech audio on CPU without internet access.

## Proposed Remediation

**Preferred**:
1. Update `app/services/tts_service.py`:
   - In `_synthesize_sync`: Implement resilient voice resolution. Look for `af_heart.pt` first. If missing, automatically fall back to any available American female voice (e.g. `af_sarah.pt`, `af_nicole.pt`), then any available `*.pt` voice file in `self.model_dir / "voices"`.
   - Never pass a bare voice identifier string like `"af_heart"` without a `.pt` extension when running offline. Always pass the resolved `.pt` path or preloaded tensor.
   - If no `.pt` files exist in `voices_dir`, raise an explicit error indicating no voice files are present.
   - In `_check_environment`: Verify that at least one `.pt` file exists in `voices_dir` before reporting `self.available = True`.
2. In `scripts/lib/tts.sh`:
   - If `af_heart.pt` is missing after provisioning voices, create a fallback alias/symlink `af_heart.pt -> af_sarah.pt` if `af_sarah.pt` exists.
3. Update unit tests in `tests/unit/test_tts_service.py`:
   - Verify synthesis succeeds using `af_heart.pt` when present.
   - Verify synthesis falls back cleanly to other available local voice files (e.g., `af_sarah.pt`) when `af_heart.pt` is absent.
   - Verify `_check_environment` marks the service unavailable when the `voices/` directory contains no `.pt` files.

**Alternatives**:
- Manually place or symlink `af_heart.pt -> af_sarah.pt` in the container only. Trade-off: Fragile across new containers or clean deployments; code should be self-healing.

**Files likely to change**:
- `app/services/tts_service.py`
- `scripts/lib/tts.sh`
- `tests/unit/test_tts_service.py`

**Tests to add or update**:
- `tests/unit/test_tts_service.py`: Tests for voice fallback and empty voices directory detection.

## Risks & Considerations

- **Auditory consistency**: `af_sarah` is an American Female voice with timbre and pacing very similar to `af_heart`. Falling back to `af_sarah.pt` maintains compliance with Spec 015 ("default American English voice profile is selected (e.g. af_heart or equivalent standard American voice)").
- **Zero internet dependency**: Pre-loading the voice tensor from a local file or passing a path ending in `.pt` completely disables Hugging Face Hub network calls.

## Open Questions

- None. Root cause verified and reproduced inside the container.
