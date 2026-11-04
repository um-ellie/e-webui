# Data Model: Secure e-webui

**Feature**: `001-e-webui`  
**Date**: 2026-11-04  
**Status**: Completed  

---

## 1. Entities

### 1.1 `PromptRequest`
Represents the incoming payload sent by the frontend UI to the backend proxy API.

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | Yes | Name of the target Ollama model (e.g. `qwen3.5:4b`). |
| `prompt` | `string` | Yes | The user's query or instruction text. |
| `system` | `string` | No | Optional system prompt to instruct model behavior. |
| `stream` | `boolean` | No (default: `true`) | Whether to stream tokens incrementally via SSE or return full text at once. |
| `temperature` | `float` | No (default: `0.7`) | Sampling temperature for model generation (range `0.0`–`2.0`). |

**Validation Rules**:
- `model`: Must match at least one model name present in Ollama's available models list.
- `prompt`: Must not be empty or whitespace only (minimum length: 1 character, maximum length: 100,000 characters).

---

### 1.2 `StreamChunk`
Represents the streaming token event emitted by the backend to the browser via Server-Sent Events (`text/event-stream`).

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | `string` | Yes | Incremental piece of generated text. |
| `done` | `boolean` | Yes | `true` if this is the final token signaling completion, otherwise `false`. |
| `total_duration` | `integer` | No | Total nanoseconds spent in model inference (included in final chunk). |
| `eval_count` | `integer` | No | Number of tokens evaluated/generated (included in final chunk). |

---

### 1.3 `ModelItem`
Represents model metadata retrieved from Ollama's `/api/tags` and exposed to the frontend dropdown.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Identifier used for generation requests (e.g., `qwen3.5:4b`). |
| `size` | `integer` | Model file size in bytes. |
| `parameter_size` | `string` | Human-readable parameter size (e.g., `4.2B`). |
| `quantization` | `string` | Quantization level (e.g., `Q4_K_M`). |
| `modified_at` | `string` | ISO 8601 timestamp of model update. |

---

### 1.4 `ChatMessage` (Client-side Session State)
Represents a turn in the conversation, stored in the browser's local state / session storage for immediate UI rendering.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique client-generated UUID for DOM tracking. |
| `role` | `enum ("user", "assistant", "system", "error")` | Speaker role. |
| `content` | `string` | Message content in markdown or plain text. |
| `timestamp` | `string` | ISO timestamp of message submission or completion. |
| `status` | `enum ("pending", "streaming", "completed", "failed")` | Lifecycle state of message generation. |

---

## 2. State Transitions & Lifecycle

```
[User Types Prompt]
       │
       ▼
(ChatMessage: pending)
       │
       ▼ [POST /api/generate via fetch()]
(ChatMessage: streaming) ◄─── [Incoming StreamChunk (done=false)]
       │
       ▼ [StreamChunk (done=true)]
(ChatMessage: completed)
       │
       ▼ [If Connection Drops / Ollama Error]
(ChatMessage: failed) ───> [Display error alert with retry button]
```
