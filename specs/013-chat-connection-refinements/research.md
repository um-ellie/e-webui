# Research & Root Cause Analysis: Chat Connection & Composer Refinements

**Feature**: `013-chat-connection-refinements`
**Date**: 2026-11-07
**Status**: Completed

## 1. Root Cause Diagnosis: Why Model Replies Never Appeared

### Diagnosis & Findings

We investigated the full end-to-end pipeline between browser, FastAPI backend, and Ollama:

1. **Initial Session Model State Was Empty String (`""`)**:
   - In `app/static/js/app.js`, `store.createSession()` was invoked synchronously at page load before `api.getModels()` completed.
   - At creation time, `store.defaultModel` was `""`, storing `model: ""` in the active session.
   - When the user submitted a prompt, `composer.js` sent `model: ""` to `POST /api/generate`.
   - FastAPI's Pydantic model (`app/models.py:PromptRequest`) strictly validates `model` with `min_length=1` and a regex pattern. Submitting an empty model name causes FastAPI to immediately reject the request with `HTTP 422 Unprocessable Entity`.
   - Because of this 422 error, Ollama was never even contacted.

2. **Reasoning Stream Parsing & `<think>` Tag Sanitization**:
   - Ollama returns streaming tokens in the `response` field. For reasoning models (such as DeepSeek-R1 and Qwen reasoning models), the thought process is emitted inside `<think>...</think>` tags in the `response` stream rather than a separate `thinking` JSON key.
   - In `app/services/ollama_client.py`, `parsed.get("thinking")` was expecting a discrete `thinking` key which Ollama's standard `/api/generate` endpoint does not populate.
   - In the frontend, `marked.js` and `DOMPurify` stripped or swallowed unknown `<think>` tags. When a model returned only reasoning tokens, `renderMarkdown()` returned an empty string (`""`), leaving the assistant turn completely blank.
   - In `chat.js`, reasoning blocks (`.thought-wrapper`) were only instantiated if `msg.reasoning` existed when the message was initially appended. During streaming updates in `updateMessageDOM()`, the thought wrapper was never created or updated dynamically.

3. **Silent Error Swallowing in the UI**:
   - When `api.streamGenerate()` threw an error (HTTP 422, connection refused, or timeout), `composer.js` caught the error, but `chat.js` did not render an explicit error card or Retry button. The assistant container remained an empty text block with a stalled cursor.

4. **Multi-Turn Context Was Dropped**:
   - `composer.js` sent only `{ prompt: promptText }` on each request, neglecting to package previous message turns in the session into the request payload or prompt context, breaking multi-turn conversations.

### Remediation Strategy
- **Immediate Model Initialization**: Ensure `store.getActiveSession().model` is always initialized from `localStorage` or the first available model from `/api/models`. Disable the send button until a valid model is confirmed.
- **Thinking Parser**: Implement extraction of `<think>...</think>` tags in both backend `StreamChunk` processing and frontend `markdown.js` so reasoning tokens are separated from answer text and rendered in the collapsible thought chip.
- **Explicit Error Cards**: Implement structured error rendering in `chat.js` with plain-language explanations, failure classes (session expired, Ollama unreachable, model not found, timeout), and a one-click Retry button.
- **Multi-Turn History**: Include prior turns from `ChatStore` in the inference payload.

---

## 2. Composer Layout & Model Picker Architecture

### Decision
Adopt the approved `chat-mock-v2.html` design:
- Move the model selector out of the top header and into the bottom-right corner of the composer card.
- Component order in the composer bottom row (left-to-right):
  - Left: Attach (`+`), Tools, Think pill.
  - Right: Model picker pill (`.mp`), Microphone button (`.mic`), Send button (`.sendb`).
- Model picker features:
  - Pill displaying dual-tone gradient glyph (`linear-gradient(135deg, var(--rose), var(--purple))`), active model name, and parameter size badge (e.g. `14b`).
  - Upward popover menu (`.pop` with `bottom: 48px`, `border-radius: 16px`, soft shadow).
  - Search filter when model count > 8.
  - Model rows indicating name, size tag, disk size, quantization, reasoning badge, and loaded indicator.
  - Full keyboard navigation (`Enter`/`Space` opens, `ArrowUp`/`ArrowDown` navigates, `Enter` selects, `Esc` closes).

### Alternatives Considered
- *Header dropdown*: Rejected per user specification; header space is better reserved for chat title and navigation.
- *Native `<select>` in composer*: Rejected because native selects cannot render badges, gradients, loaded indicators, or search filtering.

---

## 3. Sidebar Stability & Responsive Breakpoints

### Decision
Fix the layout calculation in `app/static/style.css`:
- Use CSS variable `--sidebar-width: 264px` and `--sidebar-collapsed-width: 68px`.
- In collapsed mode, replace the full wordmark with the compact brand mark (`>E_`), preventing horizontal overflow in the header.
- Ensure `.main-stage` uses `flex: 1 1 auto; min-width: 0;` so resizing and collapsing smoothly redistributes space without window-level scrollbars.
- Tablet (640–1023 px) and mobile (<640 px) use an absolute drawer layout with backdrop overlay, completely detaching the sidebar from the reading column flow during mobile toggling.

---

## 4. Complete Removal of Suggestion Chips

### Decision
- Remove `suggestion-chips-grid` and `.suggestion-chip` from `app/static/index.html` and `app/static/style.css`.
- Remove `EmptyState.renderChips()` and prompt chip arrays from `app/static/js/components/empty.js`.
- Remove chip-related strings and registry entries from `i18n.js` and `features.js`.
- Verify with repository-wide search that zero traces remain.
