# Bug Fix: کرش جاوااسکریپت در نمایش پاسخ‌های مدل در چت (عدم چاپ پاسخ در وب)

- **Slug**: chat-stream-display-failure
- **Fixed**: 2026-11-07
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Fixed a fatal JavaScript runtime exception in `app/static/js/markdown.js` caused by `new window.marked.Renderer()` when using the offline bundled parser (`app/static/vendor/marked.min.js`), which lacks a `Renderer` constructor. Added defensive checks before accessing `marked.Renderer` and `DOMPurify.sanitize`, falling back seamlessly to `window.marked.parse(content)`. Also updated `attachCodeCopyHandlers()` to recognize `.copy-code-btn` from the bundled markdown parser.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `app/static/js/markdown.js` | modified | Added guard `typeof window.marked.Renderer === 'function'`, added safe fallback in `renderMarkdown()`, and added `.copy-code-btn` selector in `attachCodeCopyHandlers()`. |
| `tests/unit/test_markdown_security.py` | modified | Added unit test `test_render_markdown_compatibility_with_bundled_marked` verifying `renderMarkdown()` operates cleanly with bundled `marked.min.js`. |

## Diff Highlights

```javascript
// app/static/js/markdown.js
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
    return window.DOMPurify.sanitize(rawHtml, { ... });
  }

  return rawHtml;
}
```

## Tests Added or Updated

- `tests/unit/test_markdown_security.py::TestMarkdownSecurity.test_render_markdown_compatibility_with_bundled_marked`: Verifies `renderMarkdown()` correctly parses markdown (including bold text and code blocks) without throwing `TypeError: window.marked.Renderer is not a constructor`.

## Local Verification

- Commands run:
  - `python3 -m unittest tests/unit/test_markdown_security.py -v` → 2 tests passed (OK).
  - `python3 -m unittest discover tests` → 19 tests passed (OK).
  - Synced update into live Incus container `e-webui-app` via `incus file push`.

## Deviations from Assessment

None. The implementation directly followed the preferred plan from `assessment.md`.

## Follow-ups

- Test end-to-end in the browser to confirm response tokens are visually printing and code copy buttons are active.
