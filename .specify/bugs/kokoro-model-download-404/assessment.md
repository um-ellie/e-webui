# Bug Assessment: Kokoro-82M Model Weights URL Returns 404 Not Found

- **Slug**: kokoro-model-download-404
- **Created**: 2026-11-07T20:52:00+03:30
- **Source**: Pasted text from user deployment session
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

During deployment (`./scripts/deploy.sh --install`), the deployment lifecycle manager successfully provisioned the container, system packages, and Python virtual environment. When attempting to fetch the Kokoro-82M model weights from Hugging Face, the download failed with an HTTP 404 error:

```text
[INFO] Kokoro-82M model weights not found in /opt/e-webui/shared/models/kokoro. Downloading...
[INFO] Setting up Kokoro-82M persistent storage at /opt/e-webui/shared/models/kokoro...
[INFO] 1/3 Downloading Kokoro-82M model weights (kokoro-v0_19.pth)...
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:--  0:00:07 --:--:--     0
curl: (22) The requested URL returned error: 404
[ERROR] Failed to download model weights from https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.pth.
[WARNING] Kokoro model weights download failed due to network unavailability.
[WARNING] The core chat application has been deployed and will continue running normally.
[INFO] You can download/retry the model weights at any time with:
[INFO]   ./scripts/deploy.sh --download-model e-webui-app
```

The deployment safely completed without crashing or triggering an automatic rollback (as designed in spec 014 for resilient error handling), but the TTS model was left missing.

## Symptom

When `./scripts/deploy.sh --install`, `--update`, or `--download-model` attempts to download the Kokoro-82M model weights from `https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.pth`, Hugging Face responds with HTTP 404 Not Found. As a result, the model weights file cannot be downloaded, leaving the TTS environment in an unprovisioned state (`model_present: false`).

## Reproduction

1. In any environment with direct internet or Hugging Face access, run:
   ```bash
   curl -I https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.pth
   ```
2. Observe the HTTP response headers return `HTTP/2 404` (Not Found).
3. Query the `main` branch file list on `hexgrad/Kokoro-82M` or run:
   ```bash
   curl -I https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v1_0.pth
   ```
4. Observe that `kokoro-v1_0.pth` returns `HTTP/2 302` / `200` OK.

## Suspected Code Paths

- `scripts/lib/tts.sh:6` — Hardcodes `KOKORO_WEIGHTS_FILE="kokoro-v0_19.pth"`.
- `scripts/lib/tts.sh:141-148` — Formulates the download URL as `${hf_base}/hexgrad/Kokoro-82M/resolve/main/${KOKORO_WEIGHTS_FILE}`, which constructs the non-existent `.../resolve/main/kokoro-v0_19.pth`.
- `scripts/lib/tts.sh:44-65` — `kokoro_model_is_present` checks only for `kokoro-v0_19.pth`.
- `tests/mock_incus.py:223-228` — Mock harness specifically looks for `"kokoro-v0_19.pth"` in the download target path.
- `specs/014-provision-kokoro-tts/contracts/tts-environment-contract.md` — References `kokoro-v0_19.pth` in documentation and test snippets.

## Root Cause Hypothesis

`scripts/lib/tts.sh` specifies `KOKORO_WEIGHTS_FILE="kokoro-v0_19.pth"` and targets the Hugging Face `main` branch (`https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/`). The model author (`hexgrad`) upgraded the repository on the `main` branch to release version 1.0 (`kokoro-v1_0.pth`). Version 0.19 is no longer present under the `main` branch root (it exists only under tag `v0.19`). Consequently, `curl -fSL` against `resolve/main/kokoro-v0_19.pth` fails with HTTP 404. Confidence: High.

## Proposed Remediation

**Preferred**:
1. In `scripts/lib/tts.sh`, update the primary weights filename to `kokoro-v1_0.pth`, which is the official model file on `main` for `hexgrad/Kokoro-82M`.
2. Implement fallback download logic in `download_kokoro_model`:
   - First attempt to download `kokoro-v1_0.pth` from `${repo_url}/kokoro-v1_0.pth`.
   - If that returns 404 or fails, fall back to `${hf_base}/hexgrad/Kokoro-82M/resolve/v0.19/kokoro-v0_19.pth`.
3. In `kokoro_model_is_present`, check for either `kokoro-v1_0.pth` OR `kokoro-v0_19.pth` (with minimum file size verification > 300MB).
4. If `kokoro-v1_0.pth` is downloaded, create a symlink `kokoro-v0_19.pth -> kokoro-v1_0.pth` (or vice versa) in `/opt/e-webui/shared/models/kokoro/` to maintain 100% backwards compatibility with any existing scripts or specs that reference `kokoro-v0_19.pth`.
5. Update `tests/mock_incus.py` and `tests/test_deploy_lifecycle.py` to support `kokoro-v1_0.pth` as well as `kokoro-v0_19.pth`.

**Files likely to change**:
- `scripts/lib/tts.sh`
- `tests/mock_incus.py`
- `tests/test_deploy_lifecycle.py`

**Tests to add or update**:
- Test that `download_kokoro_model` successfully downloads `kokoro-v1_0.pth` and links `kokoro-v0_19.pth`.
- Test that `kokoro_model_is_present` accepts either `kokoro-v1_0.pth` or `kokoro-v0_19.pth` when present and healthy.

## Risks & Considerations

- **Backwards Compatibility**: Future TTS endpoint specs or existing documentation may refer to `kokoro-v0_19.pth`. Providing a symlink from `kokoro-v0_19.pth` to `kokoro-v1_0.pth` guarantees seamless compatibility with both versions.
- **Voice Format Compatibility**: `DEFAULT_KOKORO_VOICES` (`*.pt`) in `voices/` on Hugging Face are compatible with both v0.19 and v1.0.

## Open Questions

None. The exact root cause is verified (Hugging Face repo updated to `kokoro-v1_0.pth` on `main`).
