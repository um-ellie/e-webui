# Research & Architecture Decisions: Claude-Style Chat UI Redesign

**Feature**: `012-chat-ui-redesign`
**Date**: 2026-11-07
**Status**: Completed

## 1. Local Font Delivery & Offline Typography

### Decision
Bundle and serve all four required typography families locally under `app/static/fonts/`:
1. **Inter** (weights: 400, 500, 600) for general interface chrome, sidebar, labels, buttons.
2. **Source Serif 4** (weights: 400, 500, italic) for assistant reading output, empty-state greetings.
3. **JetBrains Mono** (weights: 400, 500) for code blocks, inline code, and terminal tokens.
4. **Vazirmatn** (weights: 400, 500, 600) for Persian/Arabic right-to-left prose.

### Rationale
- Requirement **SC-006** strictly mandates zero external CDN requests at runtime.
- FastAPI's Content Security Policy in `app/main.py` enforces `default-src 'self'`. External Google Fonts links will be blocked by CSP.
- Bundling WOFF2 files directly in `app/static/fonts/` with standard `@font-face` definitions with `font-display: swap` ensures instant font rendering without layout shift and zero network telemetry.

### Alternatives Considered
- *System font fallbacks only (`system-ui, serif, monospace`)*: Rejected because the Claude aesthetic specifically relies on a high-readability serif font (Source Serif 4) and distinct monospaced code font (JetBrains Mono).
- *External Google Fonts CDN*: Rejected due to CSP violations, network isolation requirements, and offline capability constraints.

---

## 2. Centralized Feature-Availability Registry

### Decision
Implement a centralized, single-source-of-truth registry module (`app/static/js/features.js`) defining every control's availability status, tooltip explanation, and action handlers:

```javascript
export const FEATURE_REGISTRY = {
  // Working controls (backed by current backend)
  'chat.send': { status: 'enabled' },
  'chat.stop': { status: 'enabled' },
  'chat.model_select': { status: 'enabled' },
  'chat.theme_toggle': { status: 'enabled' },
  'chat.font_size': { status: 'enabled' },
  'chat.think_toggle': { status: 'enabled' }, // conditional on model capability
  'session.new': { status: 'enabled' },
  'session.search': { status: 'enabled' },
  'session.rename': { status: 'enabled' },
  'session.delete': { status: 'enabled' },

  // Future controls (UI visible, disabled state, informative tooltip)
  'chat.attach_file': { status: 'disabled', reason: 'File upload is not available yet' },
  'chat.tools_menu': { status: 'disabled', reason: 'Tools are not available yet' },
  'chat.export': { status: 'disabled', reason: 'Export is not available yet' },
  'chat.share': { status: 'disabled', reason: 'Sharing is not available yet' },
  'session.pin': { status: 'disabled', reason: 'Pinning chats is not available yet' },
  'nav.library': { status: 'disabled', reason: 'Prompt library is not available yet' },
  'nav.tools': { status: 'disabled', reason: 'Tools catalog is not available yet' },
  'model.temperature_tune': { status: 'disabled', reason: 'Custom model parameters are not available yet' },
  'model.system_prompt': { status: 'disabled', reason: 'Custom system prompts are not available yet' }
};
```

### Rationale
- Adheres directly to the **Feature-availability rule**: every Claude control exists in the markup, but controls lacking backend support are rendered in an accessible disabled style with a `data-tooltip="Not available yet"`.
- Prevents runtime `404` or `501` errors when users click prospective controls.
- Future phases only update the entry in `features.js` and attach the backend handler without altering component layouts.

### Alternatives Considered
- *Hiding unavailable buttons*: Rejected because the specification explicitly dictates that all Claude controls must exist in the UI so subsequent features only require switching them on, not redesigning layouts.
- *Scattered disabled flags across HTML templates*: Rejected because maintaining disabled states across multiple components leads to inconsistency and difficult refactoring.

---

## 3. Bilingual Direction Detection (Persian & English)

### Decision
Implement an automatic, per-message and per-block text direction detection algorithm using the Unicode Bidirectional Algorithm rule (inspecting the first strong directional character):
- Regular expression for Arabic/Persian/Hebrew strong characters: `/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/`
- Apply `dir="rtl"` and font class `font-fa` to any message or paragraph where the primary text is Persian/Arabic.
- Enforce strict `dir="ltr"` with `unicode-bidi: isolate` and `font-mono` on all inline `<code>` tags, fenced `<pre><code>` blocks, and terminal outputs regardless of parent message direction.

### Rationale
- Persian prose in an LTR block displays flipped punctuation (e.g. trailing periods and parentheses placed at the wrong end of lines) and awkward wrapping.
- Code blocks in RTL orientation break syntax formatting and indentations. Isolating code blocks as LTR guarantees correct syntax display.

### Alternatives Considered
- *Global page-level RTL switch only*: Rejected because a conversation may mix English and Persian messages in the same thread.

---

## 4. Safe Incremental Markdown & Syntax Highlighting

### Decision
- Retain the existing vendored `marked.min.js` and vendor `dompurify.min.js` locally in `app/static/vendor/dompurify.min.js`.
- During active SSE streaming:
  - Tokens are appended to an active buffer.
  - A lightweight streaming parser renders completed blocks while holding the trailing unfinished line.
  - The animated rose terminal cursor (`<span class="logo-cursor stream-cursor">_</span>`) is pinned to the end of the live DOM node.
- On markdown parsing, all HTML output is sanitized through `DOMPurify.sanitize(html, { FORBID_TAGS: ['script', 'style', 'iframe', 'object'], FORBID_ATTR: ['onerror', 'onload', 'onclick'] })`.
- Code blocks render custom header chrome with language identification and an accessible Copy button.

### Rationale
- Satisfies **FR-008** and **SC-007**: absolute immunity against cross-site scripting (XSS) from malicious or hallucinated LLM responses.
- Eliminates layout jumps and maintains smooth 60fps rendering during fast model token generation.

### Alternatives Considered
- *Client-side markdown compilation without sanitizer*: Rejected due to high security risk (model could emit raw HTML or JavaScript injection).
- *Heavy third-party highlight.js or prism.js bundle*: Rejected for initial phase; simple token classification and clean JetBrains Mono typography provides instant, zero-overhead code presentation without large syntax bundles.

---

## 5. In-Memory Conversation Store Interface (`ChatStore`)

### Decision
Create a clean modular `ChatStore` class in `app/static/js/store.js` that implements an observable repository pattern:
- Manages an in-memory collection of `ChatSession` objects.
- Provides standard CRUD operations: `createSession()`, `getSession(id)`, `updateSession(id, data)`, `deleteSession(id)`, `listSessions()`, `getActiveSession()`, `setActiveSession(id)`.
- Dispatches store change events (`store:session-updated`, `store:active-changed`) to trigger reactive UI re-renders without full-page reloads.
- Does not mislead users regarding persistence: a subtle indicator or session note acknowledges memory-only retention during the current browser lifecycle.

### Rationale
- Satisfies Story 3 acceptance criteria: multiple chats can be created, switched, searched, renamed, and deleted during the session.
- Provides a clean drop-in boundary: in the subsequent phase (database persistence), `ChatStore` methods will simply dispatch API calls to `/api/chats` without altering UI components.

### Alternatives Considered
- *Using localStorage for entire chat history*: Rejected because specification specifically defines chat history as in-memory only in this appearance phase to avoid sync conflicts with the upcoming database phase.

---

## 6. Brand Logo & Blinking Terminal Cursor Implementation

### Decision
Implement the official Ellie logo directly as inline SVG utilizing CSS variables matching `brand-tokens.css` and the specification in `design/logo/PROMPT-blinking-cursor.md`:
- Wordmark: `> ~/.E _`
- Cursor `<rect class="logo-cursor">` animated with `animation: logo-blink 1.06s step-end infinite`.
- Hard on/off (530 ms on, 530 ms off), no opacity transitions, opacity animation only.
- In `@media (prefers-reduced-motion: reduce)`, animation is suppressed (`animation: none`).
- Logo marks and wordmarks adapt automatically to light and dark theme variables (`var(--rose)` and `var(--purple)`).

### Rationale
- Exact compliance with the brand rules in `design/logo/PROMPT-blinking-cursor.md`.
- Pure CSS animation requires zero JavaScript execution cycles.
