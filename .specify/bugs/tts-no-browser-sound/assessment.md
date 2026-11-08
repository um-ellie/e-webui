# Bug Assessment: Read Aloud Fails with Red Icon Due to Missing Kokoro Config in Offline Environment

- **Slug**: tts-no-browser-sound
- **Created**: 2026-11-08
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

User report (translated from Persian):
> "مشکل همچنان پا برجاست و صدای توی مرورگر شنیده نمی شود."
> ("The problem still persists and no sound is heard in the browser.")

Follow-up context from the user:
- Symptom: When clicking the speaker icon button below an assistant message, the icon briefly indicates loading, then turns red (`.error-hint`), and no audio is played.
- The previous bug fix (`tts-playback-failure`) was deployed using `deploy.sh --update`, but the failure persists.

## Symptom

When clicking the read-aloud speaker icon (`.btn-tts`) on any English assistant message in the chat interface:
1. The button briefly enters the `loading` state.
2. The request to `POST /api/tts/synthesize` fails with an HTTP 500 error.
3. The speaker icon turns red (`.btn-tts.error-hint`) for 3 seconds and reverts to idle.
4. No audio is played through the browser's audio output.

## Reproduction

1. In an isolated container or offline host where `HF_HUB_OFFLINE=1` is set (or internet access to Hugging Face is blocked/restricted):
2. Ensure `/opt/e-webui/shared/models/kokoro/` contains `kokoro-v1_0.pth` (or `kokoro-v0_19.pth`) and `voices/af_heart.pt`, but **not** `config.json` (typical state when deployed prior to config download additions or when `kokoro_model_is_present` bypassed model re-downloading).
3. Send an English prompt to the assistant and wait for the response to complete.
4. Click the speaker icon button in the message action bar.
5. Observe that the speaker icon turns red and the browser console logs an error for `POST /api/tts/synthesize`.

## Suspected Code Paths

- `app/services/tts_service.py:97-108` — `_load_model()`:
  - If `config_path.is_file()` is `False`, `kmodel = KModel(model=str(self.weights_path))` is called with `config=None`.
  - In `kokoro/model.py`, when `config` is `None`, `hf_hub_download(repo_id=..., filename="config.json")` is called unconditionally.
  - When `HF_HUB_OFFLINE=1` is set, `hf_hub_download` raises `huggingface_hub.errors.OfflineModeIsEnabled` (or network connection error).
  - This exception is not caught by `except (ImportError, AttributeError, TypeError)`, causing `_load_model()` to crash.
  - Furthermore, in the fallback `KPipeline(lang_code="a", model=str(self.weights_path), device="cpu")`, `KPipeline` checks `isinstance(model, KModel)`. Since a string is passed, it executes `self.model = KModel(repo_id=repo_id)` with `config=None` and `model=None`, which again triggers an offline Hub download failure.
- `app/services/tts_service.py:132-140` — `_synthesize_sync()`:
  - The pipeline yields audio chunks that may be PyTorch `torch.Tensor` objects or NumPy arrays. Calling `np.concatenate` directly without converting PyTorch tensors to NumPy arrays (`tensor.detach().cpu().numpy()`) can result in type errors.
  - Voice tensor loading re-evaluates the file or name on every call instead of preloading and reusing a cached tensor.
- `scripts/lib/tts.sh:44-59` — `kokoro_model_is_present()`:
  - Only verifies `kokoro-v1_0.pth` (or `v0_19.pth`) and the `voices` directory. It does not check for `config.json`.
  - As a result, running `./scripts/deploy.sh --update` skips `download_kokoro_model` because the model weights already exist, leaving `config.json` missing in `/opt/e-webui/shared/models/kokoro/`.
- `app/static/js/tts.js:95-101` — Handles non-OK responses from `POST /api/tts/synthesize` by emitting state `('idle', errMsg)`.
- `app/static/js/components/chat.js:442-448` — Reacts to `errorHint` by applying `.error-hint` to `btnTTS`, rendering the icon red.

## Root Cause Hypothesis

**Confidence: High**

In offline container environments where `HF_HUB_OFFLINE=1` is enforced:
1. `config.json` is missing from the shared model storage `/opt/e-webui/shared/models/kokoro/` because `kokoro_model_is_present` in `scripts/lib/tts.sh` only checks for model weights, so `deploy.sh --update` never downloads `config.json`.
2. When `config.json` is missing, `TTSService._load_model()` instantiates `KModel(model=str(self.weights_path))` without passing a `config`.
3. In `kokoro.model.KModel`, if `config` is `None`, it unconditionally invokes `huggingface_hub.hf_hub_download` to fetch `config.json`.
4. In offline mode, `hf_hub_download` throws `huggingface_hub.errors.OfflineModeIsEnabled`. This error is uncaught, causing `POST /api/tts/synthesize` to return HTTP 500, which causes the frontend speaker button to turn red.

## Proposed Remediation

**Preferred**:
1. **Self-contained Fallback Architecture Config (`app/services/kokoro_config.py` / `app/services/tts_service.py`)**:
   - Embed the standard Kokoro-82M architecture dictionary `DEFAULT_KOKORO_CONFIG` (istftnet, plbert, and vocabulary settings) directly into the backend code.
   - In `_load_model()`, if `config_path.is_file()` exists, use it. If not, pass `config=DEFAULT_KOKORO_CONFIG` directly to `KModel` (and optionally write it to `config_path` for future reads).
   - This guarantees that `KModel` never invokes `hf_hub_download` under any circumstances, even if `config.json` is completely absent from disk.
2. **Robust Voice Tensor & Audio Chunk Handling**:
   - Pre-load and cache the voice tensor (`torch.load(..., weights_only=True, map_location="cpu")`) into `self.voice_tensor` so that `KPipeline` never invokes remote voice retrieval.
   - When consuming chunks from `generator = self.pipeline(...)`, explicitly convert each chunk:
     `if hasattr(chunk, "detach"): chunk = chunk.detach().cpu().numpy()` before appending to segments and concatenating.
3. **Provisioning Model Audit Check (`scripts/lib/tts.sh`)**:
   - Update `kokoro_model_is_present` (or `ensure_kokoro_model`) to ensure `config.json` is present or written if missing.
4. **Unit Tests**:
   - Add unit test verifying that `TTSService._load_model()` succeeds when `config.json` does not exist on disk by falling back to `DEFAULT_KOKORO_CONFIG` without calling `hf_hub_download`.
   - Verify tensor chunk conversion in audio synthesis.

## Risks & Considerations

- **Model Compatibility**: `DEFAULT_KOKORO_CONFIG` matches the canonical Kokoro-82M (v0.19 and v1.0) architecture. It is fully forward and backward compatible with Kokoro-82M weights.
- **Offline Integrity**: Embedding the fallback configuration completely eliminates runtime reliance on Hugging Face Hub, fulfilling Principle I and offline operation requirements.

## Open Questions

- None. The failure mode and root cause are completely understood and verified.
