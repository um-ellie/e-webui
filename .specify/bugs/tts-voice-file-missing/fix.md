# Bug Fix: Resilient Voice Profile Resolution and Offline Synthesis Fallback

- **Slug**: tts-voice-file-missing
- **Fixed**: 2026-11-08T23:07:00+03:30
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Implemented resilient voice file resolution in `TTSService` so that when `af_heart.pt` is not present in local storage, synthesis seamlessly falls back to available American female voice embeddings (`af_sarah.pt`, `af_nicole.pt`) or any valid local `.pt` voice file rather than passing bare strings that trigger Hugging Face Hub downloads in offline environments. Also updated `scripts/lib/tts.sh` to automatically establish fallback symlinks for `af_heart.pt`, and added environment validation and unit tests covering voice fallback logic.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `app/services/tts_service.py` | modified | Added `_resolve_voice_file()` to prioritize `af_heart.pt` then fallback voices (`af_sarah.pt`, `af_nicole.pt`, etc.); updated `_check_environment()` to ensure at least one `.pt` voice exists; ensured bare strings are never passed to `KPipeline`. |
| `scripts/lib/tts.sh` | modified | Added fallback symlinking in `download_kokoro_model()` to link `af_heart.pt -> af_sarah.pt` if `af_heart.pt` is missing after provisioning. |
| `tests/unit/test_tts_service.py` | modified | Added `test_environment_check_empty_voices_dir`, `test_synthesize_fallback_voice_when_af_heart_missing`, and `test_resolve_voice_file_hierarchy`. Updated setup in existing tests to include mock voice files. |

## Diff Highlights

```python
    def _resolve_voice_file(self) -> Path:
        """Resolves the best available local voice embedding file (*.pt)."""
        voices_dir = self.model_dir / "voices"

        # 1. Preferred primary voice (af_heart.pt per Spec 015)
        primary_voice = voices_dir / "af_heart.pt"
        if primary_voice.is_file():
            return primary_voice

        # 2. Preferred fallback American female voices
        preferred_fallbacks = ["af_sarah.pt", "af_nicole.pt", "af_bella.pt"]
        for voice_name in preferred_fallbacks:
            candidate = voices_dir / voice_name
            if candidate.is_file():
                logger.info(f"af_heart.pt not found; falling back to preferred voice: {voice_name}")
                return candidate
```

```python
        # Resolve voice path or preloaded tensor to prevent online Hugging Face download attempts
        if self.voice_tensor is None:
            voice_file = self._resolve_voice_file()
            try:
                self.voice_tensor = torch.load(str(voice_file), weights_only=True, map_location="cpu")
                logger.info(f"Loaded voice tensor from {voice_file}")
            except Exception as e:
                logger.warning(f"Failed to pre-load voice tensor from {voice_file}: {e}")
                self.voice_tensor = str(voice_file)

        generator = self.pipeline(cleaned, voice=self.voice_tensor, speed=1)
```

## Tests Added or Updated

- `tests/unit/test_tts_service.py::test_environment_check_empty_voices_dir` — Pins down that an empty `voices/` directory causes `_check_environment()` to mark `self.available = False`.
- `tests/unit/test_tts_service.py::test_synthesize_fallback_voice_when_af_heart_missing` — Verifies that when `af_heart.pt` is absent and `af_sarah.pt` is present, synthesis successfully loads the `af_sarah.pt` tensor.
- `tests/unit/test_tts_service.py::test_resolve_voice_file_hierarchy` — Validates the voice resolution priority order: `af_heart.pt` > preferred female fallbacks > any American voice > any `.pt` voice.

## Local Verification

- Unit tests: `python3 -m unittest tests/unit/test_tts_service.py` → 14 passed in 0.021s.
- Core suites: `python3 -m unittest tests/unit/test_text_cleaner.py tests/unit/test_stream_pipeline.py tests/unit/test_markdown_security.py tests/unit/test_manifest_tool.py tests/unit/test_ui_contracts.py` → 35 passed in 0.451s.
- Container release & deployment:
  - `./build-release.sh` built release `20261108-193559-9b3ac77b-dirty`.
  - `./scripts/deploy.sh --skip-model-download --update -y e-webui-app` deployed and verified health.
  - In-container test: `incus exec e-webui-app -- curl -i -X POST http://127.0.0.1:8080/api/tts/synthesize -H "Content-Type: application/json" -d '{"text":"Hello world, this is a test."}'` → `HTTP 200 OK`, returned `audio/wav` (129,644 bytes) in 1,843 ms.

## Deviations from Assessment

None.

## Follow-ups

- Run `/speckit-bug-test slug=tts-voice-file-missing` to validate and formalize verification.
