# UI & API Contract: Chat Interface & Inference Streaming

**Feature**: `005-redesign-chat-ui`  
**Date**: 2026-11-06  
**Status**: Completed

## 1. Brand Logo UI Contract

The brand logo must be rendered in the header as follows:

```html
<span class="brand-logo" role="img" aria-label="e-webui" dir="ltr">
  <span class="logo-prompt">&gt;</span>
  <span class="logo-text">~/.E</span>
  <span class="logo-cursor" aria-hidden="true">_</span>
</span>
```

### CSS Requirements:
- Baseline alignment: `display: inline-flex; align-items: baseline;`
- Font: Modern monospace stack (`SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`).
- Animation:
  ```css
  .logo-cursor {
    display: inline-block;
    color: var(--logo-text);
    animation: logo-cursor-blink 1.05s infinite;
  }

  @keyframes logo-cursor-blink {
    0%, 45% { opacity: 1; }
    50%, 95% { opacity: 0; }
    100% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .logo-cursor {
      animation: none;
      opacity: 1;
    }
  }
  ```

---

## 2. Header Toolbar Controls Contract

The header toolbar must expose:
1. **Model Selector**: `<select id="model-select" class="model-select">`
2. **Thinking Mode Toggle**: `<button id="thinking-toggle-btn" class="toolbar-toggle" aria-pressed="true" title="Toggle Thinking Process">`
   - Visual indicator: Active state (accent border + active glow + badge), Inactive state (muted border + strikethrough/dimmed icon).
3. **Theme Switcher**: `<button id="theme-toggle-btn" class="toolbar-btn" aria-label="Toggle light/dark theme" title="Toggle Theme">`
   - Icon: Sun / Moon icon.
4. **Clear Conversation Button**: `<button id="clear-btn" class="btn btn-secondary">`
5. **Connection Status Badge**: `<div id="status-badge" class="status-badge">`

---

## 3. Inference Streaming API Contract (`/api/generate`)

### Request:
```http
POST /api/generate HTTP/1.1
Content-Type: application/json

{
  "model": "deepseek-r1:8b",
  "prompt": "Explain quantum computing in one sentence.",
  "stream": true,
  "thinking": true,
  "temperature": 0.7
}
```

### Response: Server-Sent Events (`text/event-stream`)

#### When `thinking: true`:
```text
data: {"token": "", "thinking": "Let's formulate a clear analogy...", "done": false}

data: {"token": "", "thinking": " It should be concise.", "done": false}

data: {"token": "Quantum computing harnesses ", "thinking": null, "done": false}

data: {"token": "the principles of quantum superposition and entanglement to solve complex problems exponentially faster than classical computers.", "thinking": null, "done": false}

data: {"token": "", "thinking": null, "done": true, "eval_count": 42, "total_duration": 1820000000}
```

#### When `thinking: false`:
```text
data: {"token": "Quantum computing harnesses ", "thinking": null, "done": false}

data: {"token": "the principles of quantum superposition and entanglement to solve complex problems exponentially faster than classical computers.", "thinking": null, "done": false}

data: {"token": "", "thinking": null, "done": true, "eval_count": 22, "total_duration": 920000000}
```
*(No `thinking` tokens emitted or rendered when `thinking: false`)*.
