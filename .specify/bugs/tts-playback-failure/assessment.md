# Bug Assessment: TTS Read Aloud Fails with Red Icon on Playback

- **Slug**: tts-playback-failure
- **Created**: 2026-11-08
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

User report (translated from Persian):
> "وقتی دکمه پخش صدا که در پایین پاسخ آمده از مدل در صفحه ui چاپ شده را می زنم. رنگ آیکن بلندگو به رنگ قرمز در می آید ولی صدای پخش نمی شود."
> ("When I click the audio playback button below the model's reply printed in the UI, the speaker icon turns red, but no audio plays.")

## Symptom

When a user clicks the read-aloud speaker button below a completed English assistant message in the chat interface:
1. The button briefly transitions to loading, but instead of playing audio, it reverts to idle with the `.error-hint` CSS class applied.
2. The speaker icon turns red (`color: var(--danger)`).
3. No audible sound is played in the browser.

## Reproduction

1. Start the e-webui application service in an offline or standard container environment where `HF_HUB_OFFLINE=1` is enforced.
2. Send an English prompt to the assistant (e.g. *"Hello, how are you?"*).
3. Wait for the assistant reply to complete so that the speaker icon button is rendered in the message action bar.
4. Click the speaker icon button.
5. Observe that the speaker icon turns red and no audio is generated or played.

## Suspected Code Paths

- `app/services/tts_service.py:83` — `KPipeline` is instantiated with `model_path=str(self.weights_path)`:
  - `KPipeline.__init__` in the `kokoro` library does not accept a `model_path` keyword argument (it accepts `model` or a pre-initialized `KModel` instance). This raises a `TypeError` on the first lazy load attempt.
- `app/services/tts_service.py:101` — `generator = self.pipeline(cleaned, voice="af_heart", speed=1)`:
  - The voice parameter is passed as the bare string `"af_heart"`. In `kokoro/pipeline.py`, when a voice string does not end with `.pt`, `load_single_voice` attempts to download the voice tensor from Hugging Face via `hf_hub_download`. In offline container environments where `HF_HUB_OFFLINE=1` is set, this raises an exception (`OfflineModeIsEnabled` or network connection error) even though `/opt/e-webui/shared/models/kokoro/voices/af_heart.pt` is already stored locally on disk.
- `app/static/js/tts.js:63-71` — Error handler catches HTTP error response (500 or 503) from `/api/tts/synthesize` and invokes `emitState(messageId, 'idle', errMsg)`.
- `app/static/js/components/chat.js:446-455` — When `errorHint` is received in `renderTtsIcon`, it adds `btnTTS.classList.add('error-hint')`, which styles the icon with `color: var(--danger)` (red) for 3 seconds.

## Root Cause Hypothesis

**Confidence: High**

The bug is caused by two incompatible parameters in `app/services/tts_service.py`:
1. **Invalid parameter in `KPipeline` constructor**: `tts_service.py` calls `KPipeline(lang_code="a", model_path=str(self.weights_path))`. The Kokoro library does not support `model_path`; it expects either `model` as an instantiated `KModel` or `model=str(weights_path)`. This causes `_load_model()` to crash with `TypeError: KPipeline.__init__() got an unexpected keyword argument 'model_path'`.
2. **Missing local voice path resolution**: `self.pipeline(cleaned, voice="af_heart", ...)` passes the voice name as a string without a `.pt` file extension. The Kokoro pipeline's `load_single_voice` method only reads from local disk when the string ends with `.pt`; otherwise, it unconditionally invokes `hf_hub_download` to fetch from Hugging Face Hub. Because the container is configured with `HF_HUB_OFFLINE=1` (and runs without direct internet access at runtime), this call fails.
3. These backend crashes trigger a `500 Internal Server Error` in `POST /api/tts/synthesize`, which the frontend controller captures, setting the button's CSS class to `.error-hint` and turning the speaker icon red.

## Proposed Remediation

**Preferred**:
1. Update `_load_model` in `app/services/tts_service.py`:
   - Initialize `KModel` from `kokoro.model` (or `kokoro`) using the local `config.json` (if present) and the resolved local weights file path (`self.weights_path`).
   - Pass the initialized model instance to `KPipeline(lang_code="a", model=model, device="cpu", repo_id=None)`. If initializing directly, pass `model=str(self.weights_path)`.
2. Resolve local voice file path in `_synthesize_sync` in `app/services/tts_service.py`:
   - Check for `self.model_dir / "voices" / "af_heart.pt"`.
   - If the local voice file exists, pass the full file path ending in `.pt` (e.g. `str(voice_file)`) or load the voice tensor directly using `torch.load(str(voice_file), weights_only=True)` so that `KPipeline` loads the local voice tensor without attempting any Hugging Face Hub network calls.
3. Add or update unit tests in `tests/unit/test_tts_service.py` to assert that:
   - `KModel` and `KPipeline` are called with `model` (not `model_path`).
   - The voice parameter passed to the pipeline resolves to a local `.pt` path or preloaded tensor.

**Files likely to change**:
- `app/services/tts_service.py`
- `tests/unit/test_tts_service.py`

**Tests to add or update**:
- Unit test in `tests/unit/test_tts_service.py` verifying that `_load_model` does not pass `model_path` and initializes correctly with local weights and config.
- Unit test in `tests/unit/test_tts_service.py` verifying that voice loading uses the local `voices/af_heart.pt` file path ending with `.pt` without triggering online hub downloads.

## Risks & Considerations

- **Backward Compatibility**: Ensure that if `config.json` is missing in `model_dir`, `KModel` can still fall back cleanly to default architecture configuration or load weights directly.
- **Voice Pack Formats**: `af_heart.pt` is the standard American English voice tensor bundled by the deployment script in Spec 014. Passing `str(voice_path)` (ending in `.pt`) guarantees Kokoro's internal `load_single_voice` loads it directly via `torch.load` without network dependencies.

## Open Questions

None. The code paths, failure modes, and required remediation are unambiguous.
