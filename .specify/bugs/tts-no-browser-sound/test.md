# Bug Verification: Read Aloud Fails with Red Icon Due to Missing Kokoro Config in Offline Environment

- **Slug**: tts-no-browser-sound
- **Tested**: 2026-11-08
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: failed

## Summary

The unit and regression tests pass in mock isolation, but live browser validation in the container environment failed: clicking the read-aloud button still fails to play audio and the speaker icon still turns red (`باز هم کار نمی کنه`).

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Live Reproduction (post-fix) | Click speaker icon on assistant message in browser UI | fail | Speaker icon turns red; no audible sound output produced. |
| Unit Tests (Text Cleaner & TTS Service) | `python3 -m unittest tests/unit/test_text_cleaner.py tests/unit/test_tts_service.py` | pass | 23 tests passed in 0.017s. |
| Deployment Lifecycle Tests | `python3 -m unittest discover -s tests -p "test_*.py"` | pass | 25 tests passed in 52.7s. |

## Output Excerpts

### Unit Test Execution
```text
Ran 23 tests in 0.017s
OK
```

### Live Reproduction Failure
```text
User feedback: "باز هم کار نمی کنه." ("It still doesn't work.")
Observed symptom: Speaker icon still transitions to .error-hint (red) without playing audio.
Suspected container runtime state:
1. `download_file_to_container` runs `curl` from INSIDE the container to fetch `config.json`.
2. In restricted or offline container environments (where HF_HUB_OFFLINE=1 or external access to Hugging Face is blocked), this curl command fails silently (`|| true`).
3. Consequently, `/opt/e-webui/shared/models/kokoro/config.json` is never created in the container.
4. `TTSService._check_environment()` flags `self.available = False` because `config.json` is missing, causing `/api/tts/synthesize` to respond with HTTP 503.
```

## Residual Risks

- Relying on external network downloads (`curl` to `huggingface.co`) during deployment or runtime in network-isolated container environments is fragile.
- If `config.json` is not bundled locally within the application source tree, offline containers cannot initialize Kokoro TTS.

## Recommendation

**Reopen** — The bug fix did not resolve the live browser symptom because `config.json` cannot be fetched inside the container when Hugging Face is unreachable.

Rerun `/speckit-bug-assess slug=tts-no-browser-sound` to plan bundling `config.json` (or self-healing configuration fallback) directly inside the repository repository so that TTS functions 100% offline without requiring container curl downloads.
