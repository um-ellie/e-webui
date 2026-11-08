# Bug Fix: Enforce Kokoro Architecture Config Verification and In-Memory Voice Tensor Playback

- **Slug**: tts-no-browser-sound
- **Fixed**: 2026-11-08
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Fixed TTS synthesis failure and red speaker icon by verifying `config.json` presence in `_check_environment()`, ensuring `kokoro_model_is_present` checks for `config.json` during deployment audits (skipping redundant ~330MB weights downloads if already cached), caching voice embeddings as PyTorch tensors in memory, and converting all generated audio chunks to NumPy arrays cleanly.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `app/services/tts_service.py` | modified | Added `torch` and `config.json` existence checks to `_check_environment()`; ensured `_load_model()` fails fast if `config.json` is missing; cached voice tensors in memory using `torch.load`; and explicitly detached/converted PyTorch audio chunks to NumPy arrays before concatenation. |
| `scripts/lib/tts.sh` | modified | Updated `kokoro_model_is_present()` to check for `config.json` in shared storage; optimized `download_kokoro_model()` to detect existing weights and avoid redundant ~330MB re-downloads, immediately acquiring missing `config.json`. |
| `tests/unit/test_tts_service.py` | modified | Added tests for missing `config.json` detection, voice tensor preloading verification, and PyTorch chunk detachment/NumPy conversion. |

## Diff Highlights

```python
# app/services/tts_service.py
# Check architecture config file before reporting service available
config_path = self.model_dir / "config.json"
if not config_path.is_file():
    self.available = False
    self.error_reason = f"Model config (config.json) not found in {self.model_dir}"
    logger.warning(f"TTS unavailable: {self.error_reason}")
    return
...
# Preload and cache voice tensor in memory to avoid remote hub lookups
if self.voice_tensor is None:
    if voice_file.is_file():
        self.voice_tensor = torch.load(str(voice_file), weights_only=True, map_location="cpu")
    else:
        self.voice_tensor = "af_heart"
generator = self.pipeline(cleaned, voice=self.voice_tensor, speed=1)
for _, _, audio in generator:
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
    audio_segments.append(audio)
```

```bash
# scripts/lib/tts.sh
# Check architecture config presence in kokoro_model_is_present
local config_file="$(tts_config_path "${app_dir}")"
if ! container_test_file "${c_name}" "${config_file}"; then
    return 1
fi
```

## Tests Added or Updated

- `tests/unit/test_tts_service.py::test_environment_check_missing_config_file` — Asserts that `TTSService.available` is `False` when `config.json` is missing from the model storage directory.
- `tests/unit/test_tts_service.py::test_synthesize_success_packs_wav_with_local_voice_file` — Asserts that local voice file is loaded into a tensor with `torch.load` and passed to `KPipeline`.
- `tests/unit/test_tts_service.py::test_synthesize_converts_torch_tensor_chunks_to_numpy` — Asserts that PyTorch audio tensor chunks from Kokoro pipeline are detached and converted to NumPy arrays before `np.concatenate`.

## Local Verification

- Unit Tests: `python3 -m unittest tests/unit/test_text_cleaner.py tests/unit/test_tts_service.py` → 23 tests passed in 0.017s.
- Integration & Lifecycle Tests: `python3 -m unittest discover -s tests -p "test_*.py"` → 25 tests passed in 52.7s.

## Deviations from Assessment

None. The fix directly addresses the missing architecture configuration and voice tensor loading identified in the assessment.

## Follow-ups

- Re-deploy to the target container with `./scripts/deploy.sh --update <container>` (or `./scripts/deploy.sh --download-model <container>`) to automatically download `config.json` into `/opt/e-webui/shared/models/kokoro/config.json`.
- Run `/speckit-bug-test slug=tts-no-browser-sound` to verify the resolution.
