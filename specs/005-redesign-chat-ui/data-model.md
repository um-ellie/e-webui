# Data Model: Chat UI Redesign, Preferences, & Inference Payloads

**Feature**: `005-redesign-chat-ui`  
**Date**: 2026-11-06  
**Status**: Completed

## 1. Client-Side Preferences (`localStorage`)

Persisted under the storage key: `"ewebui_settings"`

```json
{
  "theme": "light",
  "thinking": true
}
```

### Fields:
- `theme`: `"light"` | `"dark"`
  - Default: `"light"` (Light Pastel Blue mode as requested)
  - Validation: Must be either `"light"` or `"dark"`. Falls back to `"light"`.
- `thinking`: `boolean`
  - Default: `true`
  - Validation: Boolean `true` or `false`.

---

## 2. API Data Models (Pydantic / Backend)

### Request: `PromptRequest` (`app/models.py`)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `model` | `str` | Yes | - | Name of target Ollama model |
| `prompt` | `str` | Yes | - | Prompt text (min length: 1, max length: 100,000) |
| `system` | `Optional[str]` | No | `None` | Optional system instruction |
| `stream` | `bool` | No | `True` | SSE streaming flag |
| `thinking` | `bool` | No | `True` | **New**: Whether thinking tokens should be requested/streamed |
| `temperature` | `float` | No | `0.7` | Sampling temperature between 0.0 and 2.0 |

### Response: `StreamChunk` (`app/models.py`)

| Field | Type | Description |
|---|---|---|
| `token` | `str` | Content token fragment |
| `thinking` | `Optional[str]` | Reasoning / thinking fragment (omitted or suppressed if `thinking: false`) |
| `done` | `bool` | Finished flag |
| `eval_count` | `Optional[int]` | Token count evaluated |
| `total_duration` | `Optional[int]` | Total execution duration |
| `error` | `Optional[str]` | Error message if generation failed |

---

## 3. DOM Component State & Theme Tokens

### CSS Theme Tokens (`:root` / `[data-theme="dark"]`)

| Token Name | Light Pastel Mode | Dark Pastel Navy Mode | Usage |
|---|---|---|---|
| `--bg-app` | `#EBF3FA` | `#191F2D` | Main page background |
| `--bg-card` | `#FFFFFF` | `#222A3B` | Chat container / header surfaces |
| `--bg-input` | `#FFFFFF` | `#1E2536` | Textarea prompt input surface |
| `--border-subtle` | `#D9E4F0` | `#2D374D` | Subtle borders for cards and inputs |
| `--border-focus` | `#7A5EA7` | `#9F8EC7` | Focus ring around active inputs |
| `--text-primary` | `#1E293B` | `#F1F5F9` | Main readable body text |
| `--text-muted` | `#64748B` | `#94A3B8` | Subtitles, timestamps, footers |
| `--logo-prompt` | `#BA4659` | `#D25D70` | Terminal prompt `>` in brand logo |
| `--logo-text` | `#7A5EA7` | `#9F8EC7` | Terminal path `~/.E` and cursor `_` |
| `--user-bubble-bg` | `#7A5EA7` | `#6F599C` | Background for user prompt bubble |
| `--user-bubble-text` | `#FFFFFF` | `#FFFFFF` | Text color in user bubble |
| `--assistant-bubble-bg` | `#FFFFFF` | `#222A3B` | Background for assistant bubble |
| `--thinking-bg` | `#F4F0FA` | `#2B2338` | Reasoning disclosure background |
| `--thinking-border` | `#E2D9F3` | `#413454` | Reasoning disclosure border |
| `--thinking-accent` | `#7A5EA7` | `#BCA8E8` | Reasoning header & summary icon |
| `--code-bg` | `#F1F5F9` | `#141923` | Code block background |
| `--accent-burgundy` | `#BA4659` | `#BA4659` | Action / highlight accent |
