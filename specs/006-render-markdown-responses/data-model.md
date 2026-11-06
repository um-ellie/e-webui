# Data Model: Markdown Response Display and Copy Actions

**Feature**: Markdown Response Display and Copy Actions (`006-render-markdown-responses`)  
**Date**: 2026-11-06  
**Status**: Completed  

---

## 1. Entities & Data Structures

### 1.1 Assistant Message Element (`ChatMessage`)

Represents an individual message turn rendered in the chat DOM.

| Field / Attribute | Type | Description |
|---|---|---|
| `element` | `HTMLElement` (`.message-item.assistant`) | Root DOM container for the message turn |
| `dataset.rawMarkdown` | `string` | The complete, unrendered Markdown source text of the assistant's final answer |
| `dataset.thinkingText` | `string` (optional) | The model's internal thinking process text (when Thinking Mode is enabled) |
| `isStreaming` | `boolean` | Flag indicating whether tokens are actively streaming into this message |
| `role` | `'user' \| 'assistant'` | The author role of the message |

#### State Transitions
```
[Created / Placeholder]
        ↓ (SSE stream chunks receive)
[Streaming: Accumulating rawMarkdown & Progressively Rendering HTML]
        ↓ (Stream ends / [DONE] event)
[Complete: Full Markdown Finalized, Actions Toolbar Enabled]
```

---

### 1.2 Message Action Toolbar (`MessageActionsToolbar`)

Represents the interactive action controls positioned below the assistant's message bubble.

| Component / Property | Type | Description |
|---|---|---|
| `container` | `HTMLElement` (`.message-actions`) | Bottom container aligned with the message bubble |
| `copyButton` | `HTMLButtonElement` (`.action-btn.copy-response-btn`) | Button to trigger full-response clipboard copy |
| `copyState` | `'idle' \| 'copied' \| 'error'` | Current visual state of the copy button |
| `stateTimer` | `number \| null` | Timeout ID for reverting visual feedback to `'idle'` (1800ms) |

#### Copy Button Visual States
1. **Idle**: Shows copy icon (overlapping squares / clipboard SVG) with tooltip "Copy response".
2. **Copied**: Shows checkmark SVG + text/badge "Copied!" with active highlight color.
3. **Error**: Shows warning/alert feedback if clipboard write fails.

---

### 1.3 Code Block Component (`CodeBlockElement`)

Represents a formatted block of code rendered from markdown fences (` ```lang ... ``` `).

| Property | Type | Description |
|---|---|---|
| `wrapper` | `HTMLElement` (`.code-block-wrapper`) | Container card for the code snippet |
| `header` | `HTMLElement` (`.code-block-header`) | Top bar with language badge and individual copy button |
| `language` | `string` | Detected or declared programming language (e.g. `python`, `bash`, `text`) |
| `codeText` | `string` | Extracted plain text of the code snippet |
| `copyButton` | `HTMLButtonElement` (`.copy-code-btn`) | Button that copies only this snippet to clipboard |

---

### 1.4 Markdown Render Configuration (`MarkdownConfig`)

Configuration applied to the client-side Markdown parser:

| Option | Value | Purpose |
|---|---|---|
| `gfm` | `true` | Enable GitHub Flavored Markdown (tables, task lists, strikethrough) |
| `breaks` | `true` | Convert single linebreaks (`\n`) to `<br>` for conversational naturalness |
| `headerIds` | `false` | Avoid injecting unnecessary anchor IDs to headers |
| `mangle` | `false` | Prevent email address obfuscation artifacts |
| `sanitize` | `false` (handled via DOMPurify / safe HTML escaping) | Prevent XSS injection in raw HTML tokens |
