# Data Model: Claude-Style Chat UI Redesign

**Feature**: `012-chat-ui-redesign`
**Date**: 2026-11-07
**Status**: Completed

## 1. Core Entities (Frontend State)

### 1.1 ChatSession
Represents an individual conversation thread held in the frontend `ChatStore`.

| Field | Type | Description | Validation / Constraints |
|---|---|---|---|
| `id` | `string` (UUID v4) | Unique session identifier | Non-empty, unique |
| `title` | `string` | Human-readable chat topic | Default "New conversation", max 120 chars |
| `createdAt` | `number` (Epoch ms) | Timestamp when session was initiated | Immutable integer |
| `updatedAt` | `number` (Epoch ms) | Timestamp of last user or assistant message | Auto-updated on new turn |
| `model` | `string` | Identifier of model bound to this session | Must match an available Ollama model |
| `messages` | `Array<ChatMessage>` | Ordered sequence of dialogue turns | Zero or more messages |

**State Transitions**:
- `Created` (empty messages) → `Active` (1+ messages) → `Archived/Deleted` (removed from store).

---

### 1.2 ChatMessage
Represents an individual utterance (prompt from user or response from model).

| Field | Type | Description | Validation / Constraints |
|---|---|---|---|
| `id` | `string` (UUID v4) | Unique message identifier | Non-empty |
| `sessionId` | `string` | Foreign key reference to owning `ChatSession` | Must match an existing session |
| `role` | `enum` (`"user" \| "assistant"`) | Message speaker | Immutable |
| `content` | `string` | Primary text payload (supports Markdown) | User prompt min 1 char; Assistant can start empty during stream |
| `reasoning` | `string \| null` | Model chain-of-thought or thinking text | Optional; displayed in collapsible chip |
| `status` | `enum` | Lifecycle state of message | `"streaming" \| "completed" \| "stopped" \| "error"` |
| `metrics` | `object \| null` | Generation performance telemetry | `{ model: string, durationSeconds?: number, tokensPerSecond?: number }` |
| `createdAt` | `number` (Epoch ms) | Creation timestamp | System timestamp |

**Status Transitions**:
- Assistant message: `streaming` → `completed` (normal finish)
- Assistant message: `streaming` → `stopped` (user clicks Stop button)
- Assistant message: `streaming` → `error` (network disconnect or upstream failure)

---

### 1.3 FeatureFlagEntry
Represents an entry in the centralized feature-availability registry (`features.js`).

| Field | Type | Description | Validation / Constraints |
|---|---|---|---|
| `controlId` | `string` | Unique identifier of UI control | Dot-delimited key e.g. `"chat.attach_file"` |
| `status` | `enum` (`"enabled" \| "disabled"`) | Operational status of the control | Non-null |
| `reason` | `string \| null` | User-facing explanation if disabled | Required when `status === "disabled"` |
| `tooltip` | `string \| null` | Hover text description | Defaults to `reason` if disabled |

---

### 1.4 UserPreference
Non-sensitive user configuration options persisted to browser `localStorage`.

| Field | Type | Default | Description |
|---|---|---|---|
| `theme` | `enum` (`"system" \| "light" \| "dark"`) | `"system"` | UI color theme selection |
| `fontSize` | `enum` (`"small" \| "medium" \| "large"`) | `"medium"` | Base typography scale factor |
| `sidebarCollapsed` | `boolean` | `false` | Whether left navigation bar is minimized |
| `interfaceLanguage` | `enum` (`"en" \| "fa"`) | `"en"` | Language selector for interface strings |

---

## 2. Backend DTO Entities (FastAPI Contracts)

### 2.1 PromptRequest (Inference Request)
Payload submitted from frontend `fetch()` to `POST /api/generate`.

```json
{
  "model": "qwen3.5:4b",
  "prompt": "Explain Incus networking",
  "system": null,
  "stream": true,
  "thinking": true,
  "temperature": 0.7
}
```

### 2.2 StreamChunk (SSE Token Fragment)
Payload delivered incrementally across `POST /api/generate` SSE stream.

```json
{
  "token": "Incus ",
  "thinking": null,
  "done": false,
  "eval_count": 42,
  "total_duration": 1050000000,
  "error": null
}
```

### 2.3 ModelListResponse
Response payload returned from `GET /api/models`.

```json
{
  "models": [
    {
      "name": "qwen3.5:4b",
      "size": 2690000000,
      "parameter_size": "4.2B",
      "quantization": "Q4_K_M",
      "modified_at": "2026-11-06T18:00:00Z"
    }
  ],
  "default_model": "qwen3.5:4b"
}
```

### 2.4 HealthResponse
Response payload returned from `GET /api/health`.

```json
{
  "status": "ok",
  "ollama_connected": true,
  "ollama_url": "http://10.0.0.2:11434"
}
```
