# Bug Fix: Fix TTS Read Aloud Red Icon Failure on Playback

- **Slug**: tts-playback-failure
- **Fixed**: 2026-11-08
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Fixed Kokoro-82M speech synthesis failure that caused the chat speaker icon button to turn red with an error hint. Updated `TTSService` to pass `model` instead of the non-existent `model_path` keyword argument, and resolved the `af_heart` voice parameter to the local `voices/af_heart.pt` file path ending in `.pt` to prevent online Hugging Face download attempts in offline/container environments.

## Changes

| File | Change | Notes |
|---|---|---|
| `app/services/tts_service.py` | modified | Replaced invalid `model_path` parameter with `KModel(config, model)` and `KPipeline(..., model=kmodel, ...)`; resolved `voice` parameter to local `voices/af_heart.pt` file path ending in `.pt`. |
| `tests/unit/test_tts_service.py` | modified | Added tests verifying `_load_model` does not pass `model_path`, uses `KModel` with local config, and ensures voice path ending in `.pt` is passed to the pipeline. |

## Diff Highlights (optional)

```python
# app/services/tts_service.py
# 1. Kokoro model instantiation with local config and weights
try:
    from kokoro import KModel, KPipeline
    config_path = self.model_dir / "config.json"
    if config_path.is_file():
        kmodel = KModel(config=str(config_path), model=str(self.weights_path))
    else:
        kmodel = KModel(model=str(self.weights_path))
    self.pipeline = KPipeline(lang_code="a", model=kmodel, device="cpu", repo_id=None)
except (ImportError, AttributeError, TypeError) as exc:
    from kokoro import KPipeline
    self.pipeline = KPipeline(lang_code="a", model=str(self.weights_path), device="cpu")

# 2. Local voice resolution (.pt suffix instructs Kokoro to bypass Hugging Face Hub download)
voice_file = self.model_dir / "voices" / "af_heart.pt"
if voice_file.is_file():
    voice_param = str(voice_file)
else:
    voice_param = "af_heart"

generator = self.pipeline(cleaned, voice=voice_param, speed=1)
```

## Tests Added or Updated

- `tests/unit/test_tts_service.py::test_load_model_initializes_with_kmodel_and_local_config` — pins down that `KPipeline` is instantiated with `model` and local `config.json` without passing `model_path`.
- `tests/unit/test_tts_service.py::test_synthesize_success_packs_wav_with_local_voice_file` — pins down that when `voices/af_heart.pt` exists locally, the pipeline receives the local `.pt` path to avoid triggering remote hub downloads.
- `tests/unit/test_tts_service.py::test_synthesize_fallback_voice_when_file_missing` — pins down graceful voice fallback when local file is absent.

## Local Verification

- Commands run:
  - `python3 -m unittest tests/unit/test_tts_service.py` → 9 tests passed in 0.009s.
  - `python3 -m unittest tests/unit/test_text_cleaner.py tests/unit/test_tts_service.py tests/unit/test_ui_contracts.py tests/unit/test_validation.py tests/unit/test_manifest_tool.py tests/unit/test_release_builder.py tests/unit/test_markdown_security.py` → 47 tests passed in 1.498s.

## Deviations from Assessment

None. The implementation followed the exact remediation proposed in `assessment.md`.

## Follow-ups

- When deploying the updated application to the container, verify using `deploy.sh --update` that clicking the speaker button plays audible American English speech on completed assistant replies without turning red.
