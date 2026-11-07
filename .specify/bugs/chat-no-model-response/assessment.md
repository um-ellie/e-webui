# Bug Assessment: مدل پاسخی به پیام کاربر در صفحه چت نمی‌دهد

- **Slug**: chat-no-model-response
- **Created**: 2026-11-07
- **Source**: pasted text
- **Verdict**: likely valid, needs reproduction
- **Severity**: high

## Report (verbatim or summarized)

> در صفحه چت وقتی از مدل سوال رو می پرسم. مدل پاسخی به من نمیده.

Translation: "In the chat page, when I ask the model a question, the model doesn't give me a response."

## Symptom

When a user types a message in the chat interface and submits it, the model does not produce any visible response. The expected behavior is that the assistant's streaming response appears in the chat after sending a prompt. The user sees no output — neither content nor an error card.

## Reproduction

1. Open the e-webui chat interface in a browser.
2. Type a question in the composer textarea.
3. Press Enter or click the Send button.
4. Observe that no response appears from the model.

[NEEDS CLARIFICATION: Does the user see an error card, a perpetually spinning "streaming" indicator, or absolutely nothing? Is "Ollama offline" shown in the model picker? Has the user confirmed Ollama is running and has models pulled?]

## Suspected Code Paths

- `app/static/js/components/composer.js:513` — Model resolution falls back to empty string `''` when Ollama is unreachable or models haven't loaded yet. No guard prevents sending a request with an empty model name.
- `app/models.py:10-14` — `PromptRequest.model` has `min_length=1` validation; an empty string triggers HTTP 422 (Unprocessable Entity) from Pydantic, which FastAPI returns before the route handler executes.
- `app/static/js/components/composer.js:204-234` — `ModelPicker.loadModels()` is async and called from constructor; if it fails (Ollama unreachable), the picker shows "Ollama offline" but the user can still type and send. `store.defaultModel` remains `''` (initialized on `store.js:45`).
- `app/static/js/api.js:65-82` — Non-OK HTTP responses (including 422) are caught and thrown as errors. The error propagates to `composer.js:580-589` which sets the message status to `'error'`. The error card should render — unless the error message itself is malformed or the chat component fails to render it.
- `app/services/ollama_client.py:202-206` — `httpx.ConnectError` is caught when Ollama is unreachable, yielding an SSE error chunk. This path works correctly when the request reaches the backend (model is non-empty).
- `app/config.py:5` — `OLLAMA_HOST` defaults to `http://127.0.0.1:11434`. In an Incus container deployment, if the `ollama-link` proxy device isn't configured, this host is unreachable.

## Root Cause Hypothesis

**Confidence: medium-high**

There is a chain of failures that results in the user seeing "no response":

1. **Primary cause**: Ollama is not reachable from the e-webui container (proxy device not configured, Ollama not running, or no models pulled). When `ModelPicker.loadModels()` fails, `store.defaultModel` stays as `''` and no model is selected in the session.

2. **Contributing cause**: `composer.js:513` has no guard against sending with an empty model. The fallback chain `session.model || store.defaultModel || localStorage || ''` cascades to `''` when no model was ever successfully loaded or selected.

3. **Immediate trigger**: The POST to `/api/generate` with `model: ''` gets rejected by Pydantic's `min_length=1` validation on `PromptRequest.model`, returning HTTP 422. While `api.js` does handle non-OK responses by throwing, and `composer.js` does catch errors and set the message to `'error'` status, the user perceives this as "no response from the model" — the model never ran, the request was rejected at validation.

The most likely real-world scenario is that the Ollama backend is not reachable or has no models, leading to this entire chain silently degrading without a prominent user-facing warning preventing submission.

## Proposed Remediation

**Preferred**: Add a pre-send validation guard in `composer.js:sendPrompt()` that checks `modelToUse` before sending the request. If the model is empty or falsy, show a user-friendly toast notification explaining the problem and return early without creating the assistant message placeholder.

Additionally, disable the send button (and/or the Enter-to-send behavior) when no model is loaded. The `Composer` should listen for model loading state and prevent submission entirely until a valid model is available.

```js
// In sendPrompt(), after line 513:
if (!modelToUse) {
  showToast('No model selected. Please check that Ollama is running and has models available.');
  return;
}
```

**Alternatives**:

1. **Backend fallback**: Have the `/api/generate` endpoint return a more descriptive error for empty/missing model rather than a generic 422. This improves the error card experience but doesn't prevent the bad UX of the user thinking their message was sent. Trade-off: doesn't solve the root problem of allowing invalid submissions.

2. **Connection status banner**: Add a persistent status banner at the top of the chat when `/api/health` reports `ollama_connected: false`. This proactively warns the user before they even try to send. Trade-off: more UI work, but excellent UX improvement.

**Files likely to change**:

- `app/static/js/components/composer.js` — Add model validation guard in `sendPrompt()`; optionally disable send button when no model available.
- `app/static/js/components/chat.js` — Optionally add a connection status indicator.
- `app/static/js/api.js` — Optionally improve error categorization for 422 responses.

**Tests to add or update**:

- Frontend test: Verify that `sendPrompt()` returns early and shows toast when `modelToUse` is empty.
- Frontend test: Verify that send button is disabled when model picker shows "Ollama offline".
- Integration test: Verify that the full flow from chat submission with an empty model produces a user-visible error (not a silent failure).
- Backend test: Verify that POST `/api/generate` with `model: ""` returns 422 with a clear error message about model being required.

## Risks & Considerations

- **UX regression**: Adding a guard could change the feel of "instant send" if the validation is slow, but since it's a synchronous check on an in-memory variable, this is negligible.
- **Backward compatibility**: No API changes required. The backend validation (`min_length=1`) is correct and should remain — the fix is purely on the frontend to prevent invalid requests from being sent.
- **Dead code**: The legacy `app/static/app.js` (522-line IIFE) is no longer loaded by `index.html` and references DOM IDs that don't exist in the current HTML. While not the cause of this bug, it should be deleted to avoid confusion.

## Open Questions

- [NEEDS CLARIFICATION: Is Ollama running and reachable from the container? What does the model picker show — a model name or "Ollama offline"?]
- [NEEDS CLARIFICATION: Does the user see an error card in the chat, or a blank assistant message bubble, or nothing at all after submitting?]
- [NEEDS CLARIFICATION: Has `ollama pull <model>` been run to download at least one model?]
- [NEEDS CLARIFICATION: Is the `ollama-link` Incus proxy device properly configured to forward port 11434?]
