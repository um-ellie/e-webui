# Bug Fix: مدل پاسخی به پیام کاربر در صفحه چت نمی‌دهد

- **Slug**: chat-no-model-response
- **Fixed**: 2026-11-07
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Added a pre-send validation guard in `Composer.sendPrompt()` to prevent submitting chat requests when no model is selected or available. If `modelToUse` is empty, a user-friendly toast is displayed, the user's input prompt is preserved in the textarea, and the request is aborted early before creating a placeholder message. Additionally, updated `chat.js` error categorization to handle HTTP 422 Unprocessable Entity gracefully if an invalid request reaches the server.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `app/static/js/components/composer.js` | modified | Added check for empty `modelToUse` in `sendPrompt()` with toast notification and input preservation. |
| `app/static/js/components/chat.js` | modified | Added categorization for HTTP 422 (`invalid_model_request`) to display clear error feedback. |
| `tests/unit/test_ui_contracts.py` | modified | Added tests verifying model guard in `composer.js` and 422 categorization in `chat.js`. |
| `tests/unit/test_validation.py` | modified | Added unit test verifying that empty model names are rejected by `PromptRequest`. |

## Diff Highlights

```javascript
// app/static/js/components/composer.js
const modelToUse = session.model || store.defaultModel || (typeof localStorage !== 'undefined' ? localStorage.getItem('ewebui_last_model') : '') || '';

if (!modelToUse) {
  showToast('No model selected. Please check that Ollama is running and has models available.');
  if (this.textarea && !this.textarea.value) {
    this.textarea.value = promptText;
    this.updateSendButtonState();
  }
  return;
}
```

```javascript
// app/static/js/components/chat.js
if (status === 422 || msg.includes('422') || msg.includes('unprocessable') || msg.includes('value_error')) {
  return {
    category: 'invalid_model_request',
    title: 'Invalid Model Request',
    desc: 'No valid model was specified or the request parameters were rejected by the server.',
    status: 422
  };
}
```

## Tests Added or Updated

- `tests/unit/test_ui_contracts.py::TestUIContracts.test_composer_has_model_guard` — Verifies `composer.js` contains a guard blocking prompt submission when `modelToUse` is empty.
- `tests/unit/test_ui_contracts.py::TestUIContracts.test_chat_error_categorization_handles_422` — Verifies `chat.js` classifies 422 validation errors with an informative message.
- `tests/unit/test_validation.py::TestPromptRequestValidation.test_empty_model_validation_rejected` — Ensures empty string model name triggers validation error.

## Local Verification

- Commands run:
  - `python3 -m unittest discover tests` → 19 tests passed (OK).
  - `python3 -m unittest tests/unit/test_ui_contracts.py tests/unit/test_validation.py -v` → 7 tests passed / skipped as expected.
- Manual verification: Checked that prompt is restored to textarea when send is aborted, avoiding loss of user typing.

## Deviations from Assessment

None. The remediation directly implemented the preferred option from `assessment.md`.

## Follow-ups

- Ensure Ollama service is running and models are pulled in the target deployment container (`incus exec ollama -- ollama pull <model>`).
- Consider removing the dead legacy `app/static/app.js` file in a future cleanup.
