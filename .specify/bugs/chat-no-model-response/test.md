# Bug Verification: مدل پاسخی به پیام کاربر در صفحه چت نمی‌دهد

- **Slug**: chat-no-model-response
- **Tested**: 2026-11-07
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The bug is fully resolved and verified. A client-side guard in `composer.js` now intercepts empty model selections, shows an explanatory toast, preserves user prompt input, and halts submission before sending invalid empty model requests to the backend. In addition, `chat.js` categorizes HTTP 422 errors into `invalid_model_request`, and backend Pydantic validation tests confirm strict rejection of empty model names.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix guard) | `tests/unit/test_ui_contracts.py::test_composer_has_model_guard` | pass | Verifies `composer.js` blocks execution and displays toast notification when `!modelToUse`. |
| Error categorization (422) | `tests/unit/test_ui_contracts.py::test_chat_error_categorization_handles_422` | pass | Verifies `chat.js` parses 422 into `invalid_model_request`. |
| Pydantic Model Validation | `curl -s -X POST http://127.0.0.1:8080/api/generate ... {"model":""}` | pass | Confirmed backend immediately returns HTTP 422 with `string_too_short` when model is empty. |
| End-to-end Inference | `curl -s -X POST http://127.0.0.1:8080/api/generate ... {"model":"qwen3.5:4b"}` | pass | Confirmed active container and upstream Ollama properly stream SSE tokens when a valid model is specified. |
| Syntax verification | `node -c app/static/js/components/composer.js && node -c app/static/js/components/chat.js` | pass | Clean syntax check on modified JavaScript files. |
| Full Regression Suite | `python3 -m unittest discover tests` | pass | All 19 tests in the test suite pass with exit code 0. |

## Output Excerpts

### Unit & UI Contract Tests
```
test_chat_error_categorization_handles_422 (tests.unit.test_ui_contracts.TestUIContracts.test_chat_error_categorization_handles_422) ... ok
test_composer_has_model_guard (tests.unit.test_ui_contracts.TestUIContracts.test_composer_has_model_guard) ... ok
test_features_js_matches_contract (tests.unit.test_ui_contracts.TestUIContracts.test_features_js_matches_contract) ... ok
test_ui_features_contract_exists_and_valid (tests.unit.test_ui_contracts.TestUIContracts.test_ui_features_contract_exists_and_valid) ... ok
Ran 7 tests in 0.001s (OK)
```

### Full Regression Run
```
----------------------------------------------------------------------
Ran 19 tests in 15.530s

OK
```

### Backend Empty Model Validation Output
```json
{"detail":[{"type":"string_too_short","loc":["body","model"],"msg":"String should have at least 1 character","input":"","ctx":{"min_length":1}}]}
```

## Residual Risks

- If the user has not pulled any models in Ollama (`ollama list` is empty), the UI will cleanly inform them via toast that no model is available rather than silently hanging or failing without explanation.
- Ensure the Ollama container remains running and the proxy port 11434 is forwarded properly.

## Recommendation

Close the bug — verified end-to-end. The fix properly protects against empty model dispatch, provides clear user feedback, and causes zero regressions across the codebase.
