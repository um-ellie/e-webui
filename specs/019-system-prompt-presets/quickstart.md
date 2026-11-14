# Quickstart: Validating System Prompt Presets & Model Parameters

**Feature**: `019-system-prompt-presets`  
**Date**: 2026-11-15  

## Prerequisites
- Working Python 3.10+ environment inside workspace.
- Unit test runner (`python3 -m unittest`).

---

## 1. Automated Unit Tests

Execute unit tests covering:
1. Pydantic validation of `PromptRequest` with `system`, `temperature`, `top_p`, and `num_ctx` bounds.
2. Ollama client payload translation (passing `options` and `system`).
3. UI contract validation (checking `FEATURE_REGISTRY` entries).
4. Export metadata preservation (Markdown frontmatter and JSON parameters).

```bash
python3 -m unittest tests/unit/test_ollama_client.py tests/unit/test_stream_pipeline.py tests/unit/test_ui_contracts.py tests/unit/test_export_and_storage.py
```

Expected result: All tests pass with zero failures.

---

## 2. End-to-End Visual Verification Scenarios

### Scenario A: Selecting Built-in Persona Preset
1. Open e-webui in a web browser.
2. Click the parameters button in the composer toolbar (`.pill-params`).
3. Select "Coding Specialist" from the presets dropdown.
4. Verify:
   - System prompt textarea is populated with the senior software engineer directive.
   - Temperature slider immediately adjusts to `0.2`.
   - Top-P slider adjusts to `0.8`.
   - Composer displays a visible active persona tag (`Coding Specialist · 0.2`).
5. Send a prompt (e.g., "Write a function to reverse a string in Python").
6. Verify the model response contains immediate code without conversational greeting.

### Scenario B: Custom User Preset Creation & Offline Persistence
1. Open the parameters dialog.
2. Select "Custom" or type a unique prompt: "You are a concise grammar checker."
3. Adjust Temperature to `0.1`.
4. Click "Save as Preset", enter the name "Grammar Checker", and confirm.
5. Reload the browser page (`F5` or `Ctrl+R`).
6. Open the parameters dialog again.
7. Verify "Grammar Checker" appears in the presets dropdown and can be selected or deleted.

### Scenario C: Export Provenance Verification
1. With the active conversation configured with "Coding Specialist", click the export icon in the header.
2. Export as Markdown (`.md`).
3. Inspect the downloaded file: confirm the YAML frontmatter contains `preset: Coding Specialist`, `temperature: 0.2`, `top_p: 0.8`.
4. Export as JSON (`.json`).
5. Inspect the downloaded JSON: confirm `parameters` dictionary contains `presetTitle`, `systemPrompt`, `temperature`, and `topP`.
