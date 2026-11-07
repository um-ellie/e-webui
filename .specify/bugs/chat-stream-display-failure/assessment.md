# Bug Assessment: کرش جاوااسکریپت در نمایش پاسخ‌های مدل در چت (عدم چاپ پاسخ در وب)

- **Slug**: chat-stream-display-failure
- **Created**: 2026-11-07
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: critical

## Report (verbatim or summarized)

> مشکل هنوز پا برجا هست. و هنوز مدل به سوال ها پاسخ نمی دهد. و یا پاسخ می دهد ولی پاسخ به وب نمیرسد که در محیط چت چاپ شود.

Translation: "The problem still persists. The model still does not answer questions, or it responds but the response does not reach the web to be printed in the chat environment."

## Symptom

When a user submits a question in the chat interface:
1. The backend (`FastAPI` + `OllamaClient`) receives the request, connects to Ollama, and successfully streams response tokens (verified in uvicorn container logs: `HTTP 200 OK`, `First token emitted after 126.6ms`, `Generation ended: total_duration=1568.6ms, error_category=none`).
2. However, **nothing is rendered in the chat UI on the browser**, or the assistant message remains blank/stuck in the loading state.
3. In the browser developer tools console, an uncaught TypeError is thrown on the very first token received: `TypeError: window.marked.Renderer is not a constructor` inside `app/static/js/markdown.js:12`.

## Reproduction

1. Open the web UI in any browser (`http://<ip>:8080`).
2. Type any prompt (e.g., "سلام" or "Hi") and press Enter.
3. Open browser Developer Tools (F12) -> Console.
4. When the first streaming token arrives from `/api/generate`:
   - `composer.js` calls `onToken` -> `store.updateMessage` -> emits `message:updated`.
   - `chat.js` receives `message:updated` and executes `updateMessageDOM(msg)`.
   - `chat.js` calls `renderMarkdown(msg.content)`.
   - `renderMarkdown()` calls `getMarkedRenderer()` which executes `new window.marked.Renderer()`.
   - **CRASH**: `TypeError: window.marked.Renderer is not a constructor`.
   - The JavaScript event loop crashes for the update event, preventing DOM injection of the received tokens. As a result, the user sees no response whatsoever in the UI, even though the model generated the text successfully.

## Suspected Code Paths

- `app/static/js/markdown.js:7-33` — `getMarkedRenderer()` assumes `window.marked` is standard upstream marked.js with a constructor `new window.marked.Renderer()`. But the project uses an in-tree bundled offline parser (`app/static/vendor/marked.min.js`), which exports `{ parse: parseMarkdown }` and does **not** have a `Renderer` constructor.
- `app/static/js/markdown.js:88-89` — `renderMarkdown()` unconditionally calls `getMarkedRenderer()` whenever `window.marked` is defined, crashing with a fatal `TypeError` whenever any markdown text is parsed.
- `app/static/js/components/chat.js:247, 507, 520` — Calls `renderMarkdown()` during both streaming token updates and final completion. Because `renderMarkdown` throws an uncaught exception, `body.innerHTML` is never updated and the stream cursor/content never appears.

## Root Cause Hypothesis

**Confidence: high (100% verified via reproduction and node execution)**

The root cause is a mismatch between `markdown.js` and the bundled vendor script `app/static/vendor/marked.min.js`:
- In commit `e784c0d` and security commit `f182276`, the project implemented a lightweight, secure offline GFM markdown parser bundled as `app/static/vendor/marked.min.js`. It exports an object with `parse(text)`. It already contains its own custom code-block wrapper with copy button and language tag.
- In commit `81bc889` (Claude-style chat UI redesign), `app/static/js/markdown.js` was introduced with code that assumes official upstream marked.js:
  ```javascript
  function getMarkedRenderer() {
    if (typeof window.marked === 'undefined') return null;
    const renderer = new window.marked.Renderer(); // <-- CRASHES!
    ...
  }
  ```
- Because `window.marked.Renderer` is `undefined`, executing `new window.marked.Renderer()` throws `TypeError: window.marked.Renderer is not a constructor`.
- This exception is uncaught inside the SSE streaming callback loop (`onToken` -> `store.emit` -> `chat.js:updateMessageDOM`).
- Consequently, while the backend logs show the model replying in milliseconds, the browser immediately crashes on the first token and renders **zero tokens** to the screen.

## Proposed Remediation

**Preferred**: Update `app/static/js/markdown.js` to safely check whether `window.marked.Renderer` is a function before attempting to instantiate it, and seamlessly fall back to `window.marked.parse(content)` (or built-in parsing) when no custom renderer constructor exists.

```javascript
// In app/static/js/markdown.js:
function getMarkedRenderer() {
  if (typeof window.marked === 'undefined' || typeof window.marked.Renderer !== 'function') {
    return null;
  }
  const renderer = new window.marked.Renderer();
  ...
}

export function renderMarkdown(text) {
  if (!text) return '';
  const { content } = extractThinking(text);
  if (!content) return '';

  let rawHtml = '';
  if (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') {
    const renderer = getMarkedRenderer();
    rawHtml = renderer 
      ? window.marked.parse(content, { renderer, breaks: true, gfm: true })
      : window.marked.parse(content);
  } else {
    rawHtml = `<p>${escapeHtml(content)}</p>`;
  }

  if (typeof window.DOMPurify !== 'undefined' && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(rawHtml, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    });
  }

  return rawHtml;
}
```

**Files likely to change**:
- `app/static/js/markdown.js`
- `tests/unit/test_markdown_security.py` (or a new test verifying `renderMarkdown` works in combination with `marked.min.js` and `dompurify.min.js`)

**Tests to add or update**:
- Add unit test to verify `renderMarkdown()` successfully converts markdown to HTML without throwing when using the actual bundled `app/static/vendor/marked.min.js`.

## Risks & Considerations

- **Zero regressions**: The fix is purely defensive and restores compatibility with the existing offline vendor script.
- **Copy button functionality**: The bundled `marked.min.js` already outputs `<div class="code-block-wrapper">` with copy buttons and language headers, so code blocks remain styled and functional.

## Open Questions

None. The exact stack trace and failure mechanism have been isolated, reproduced, and confirmed.
