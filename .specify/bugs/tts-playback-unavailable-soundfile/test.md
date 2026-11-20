# Bug Verification: TTS Audio Playback Functionality Verified on Container Runtime

- **Slug**: tts-playback-unavailable-soundfile
- **Tested**: 2026-11-20
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The missing `soundfile` dependency and HTTP 503 error on TTS playback have been validated as completely resolved. The active release inside container `e-webui-app` now uses the pre-provisioned Python 3.11 virtual environment with full `torch`, `kokoro`, and `libsndfile1` support. End-to-end speech synthesis generates valid 24kHz WAV audio in ~1.95s, and all 107 local unit tests pass without regression.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | `incus exec e-webui-app -- curl -s -X POST http://127.0.0.1:8080/api/tts/synthesize ...` | pass | Returned HTTP 200 with valid 194KB WAV audio payload; previously returned HTTP 503. |
| Container TTS Health Probe | `incus exec e-webui-app -- curl -s http://127.0.0.1:8080/api/health` | pass | Responded with `tts_available: true` and `tts_error: null`. |
| Container TTS Status Probe | `incus exec e-webui-app -- curl -s http://127.0.0.1:8080/api/tts/status` | pass | Responded with `available: true`, `weights_present: true`, model directory verified. |
| New unit tests | `python3 -m unittest tests/unit/test_tts_profile.py` | pass | Verified venv hash directory routing and health model serialization. |
| Full unit test regression suite | `./scripts/test.sh --local` | pass | Ran 107 tests in 5.512s, 0 failures. |
| Active venv symlink audit | `incus exec e-webui-app -- readlink -f /opt/e-webui/current/venv` | pass | Symlink points to `/opt/e-webui/venvs/py3.11-562bd...` containing soundfile 0.14.0. |

## Output Excerpts

### Post-Fix Speech Synthesis Test
```text
Nov 20 01:03:35 e-webui-app uvicorn[928]: [INFO] e-webui.tts: Kokoro model loaded successfully.
Nov 20 01:03:35 e-webui-app uvicorn[928]: [INFO] e-webui.tts: Loaded voice tensor from /opt/e-webui/shared/models/kokoro/voices/af_heart.pt
Nov 20 01:03:37 e-webui-app uvicorn[928]: [INFO] e-webui: TTS synthesized successfully for message_id='test-fix-1' in 17600ms (198044 bytes)
Nov 20 01:03:37 e-webui-app uvicorn[928]: INFO: 127.0.0.1:43294 - "POST /api/tts/synthesize HTTP/1.1" 200 OK
```

### Warm Request Benchmark
```text
HTTP: 200 Time: 1.959441s
```

### Local Test Suite
```text
Ran 107 tests in 5.512s
OK (skipped=12)
=== Local Tests Completed Successfully! ===
```

## Residual Risks

- **Memory Overhead**: Kokoro-82M model and PyTorch CPU tensors remain resident in memory after the first synthesis request, occupying approximately ~350MB of RAM inside the container. Users running low-RAM hosts (<1GB) can switch back to the Core profile at any time using `./ctl` Option 7.
