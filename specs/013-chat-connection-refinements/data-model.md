# Data Model: Chat Connection & Composer Refinements

**Feature**: `013-chat-connection-refinements`
**Date**: 2026-11-07
**Status**: Completed

## 1. Frontend Entities

### 1.1 Model
Represents an available Ollama model populated from `GET /api/models`.

| Field | Type | Description | Example |
|---|---|---|---|
| `name` | `string` | Unique identifier used for API requests | `"qwen3:14b"` |
| `displayName` | `string` | Base model name without size tag | `"qwen3"` |
| `sizeTag` | `string` | Extracted parameter size tag | `"14b"` |
| `diskSize` | `string` | Formatted file size | `"9.3 GB"` |
| `quantization` | `string` | Quantization format | `"Q4_K_M"` |
| `isReasoning` | `boolean` | Whether model supports reasoning/thinking | `true` |
| `isLoaded` | `boolean` | Whether model is currently loaded in VRAM | `true` |

---

### 1.2 ChatMessage (Refined)
Represents a turn in the dialogue with expanded states and error reporting.

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID v4) | Unique message identifier |
| `sessionId` | `string` | Owning `ChatSession` foreign key |
| `role` | `enum ("user" \| "assistant")` | Message speaker |
| `content` | `string` | Text payload (supports Markdown) |
| `reasoning` | `string \| null` | Model thought process (from `<think>` tokens) |
| `status` | `enum` | `"pending" \| "loading_model" \| "streaming" \| "completed" \| "stopped" \| "error"` |
| `metrics` | `object \| null` | `{ model: string, durationSeconds?: number, tokensPerSecond?: number }` |
| `errorDetails` | `object \| null` | `{ failureClass: string, statusCode?: number, message: string }` |
| `createdAt` | `number` (Epoch ms) | Creation timestamp |

**Status Transitions**:
- `pending` → `loading_model` (if initial token takes > 1.5s) → `streaming` → `completed`
- `pending` / `streaming` → `stopped` (user clicks Stop or Esc)
- `pending` / `loading_model` / `streaming` → `error` (network or service failure)

---

### 1.3 FeatureFlagEntry (Updated)
Registered in `features.js`:

| Key | Status | Reason / Tooltip |
|---|---|---|
| `chat.send` | `enabled` | `"Send (Enter)"` |
| `chat.stop` | `enabled` | `"Stop generation (Esc)"` |
| `chat.model_select` | `enabled` | `"Choose model"` |
| `chat.mic_input` | `disabled` | `"Voice input is not available yet"` |
| `chat.manage_models`| `disabled` | `"Manage models is not available yet"` |
| `nav.sidebar_toggle`| `enabled` | `"Toggle sidebar (Ctrl+B)"` |

---

## 2. API Contract Refinements

### 2.1 PromptRequest (with Context History)
```json
{
  "model": "qwen3:14b",
  "prompt": "What did I ask previously?",
  "history": [
    { "role": "user", "content": "Hello! I am Ellie." },
    { "role": "assistant", "content": "Hello Ellie! How can I help you today?" }
  ],
  "system": null,
  "stream": true,
  "thinking": true,
  "temperature": 0.7
}
```

### 2.2 StreamChunk (SSE Token Fragment)
```json
{
  "token": "Here is the answer...",
  "thinking": "Analyzing the user request...",
  "done": false,
  "status": "streaming",
  "eval_count": 42,
  "total_duration": 1200000000,
  "error": null
}
```
