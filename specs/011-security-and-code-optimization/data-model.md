# Phase 1: Data Model & Schema Specification

**Feature**: Security Hardening, Bug Fixes, and Code Optimization  
**Date**: 2026-11-07  

---

## 1. Request & Response Models

### `PromptRequest` (Enhanced Validation)

Payload submitted to `POST /api/generate`:

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `model` | `str` | Yes | `min_length=1`, `max_length=128`, `pattern=^[a-zA-Z0-9_\-\./:]+$` | Ollama model tag identifier |
| `prompt` | `str` | Yes | `min_length=1`, `max_length=100000` | User prompt text |
| `system` | `Optional[str]` | No | `max_length=50000` | Optional system prompt instruction |
| `stream` | `bool` | No | default: `true` | Whether to stream tokens |
| `thinking` | `bool` | No | default: `true` | Whether to retain thinking tokens |
| `temperature` | `float` | No | `ge=0.0`, `le=2.0`, default: `0.7` | Sampling temperature |

---

### `StreamChunk` (SSE Data Packet)

SSE line emitted as `data: <JSON>\n\n`:

| Field | Type | Default | Description |
|---|---|---|---|
| `token` | `str` | `""` | Generated response fragment |
| `thinking` | `Optional[str]` | `None` | Reasoning thoughts fragment |
| `done` | `bool` | `False` | Completion flag |
| `eval_count` | `Optional[int]` | `None` | Total evaluated tokens |
| `total_duration` | `Optional[int]` | `None` | Execution duration in nanoseconds |
| `error` | `Optional[str]` | `None` | Error message if generation failed |

---

### `HealthResponse`

Response from `GET /api/health`:

| Field | Type | Constraints | Description |
|---|---|---|---|
| `status` | `str` | `"ok" \| "degraded"` | Overall health status |
| `ollama_connected` | `bool` | `True \| False` | Whether Ollama is reachable |
| `ollama_url` | `str` | URL string | Upstream target host URL |

---

## 2. Frontend Security Model (Markdown Link Protocol Specification)

Rules applied inside `app/static/vendor/marked.min.js`:

```text
Input: [Anchor Text](Target URL)
│
├── Step 1: Extract URL and sanitize Anchor Text
│     safeText = escapeHtml(Anchor Text)
│
├── Step 2: Protocol Allowlist Check on Target URL
│     Target matches ^https?:\/\/   ──► ALLOW (safeUrl = escapeHtml(Target URL))
│     Target matches ^mailto:       ──► ALLOW (safeUrl = escapeHtml(Target URL))
│     Target matches ^\/[^\/\\]     ──► ALLOW (safeUrl = escapeHtml(Target URL))
│     Any other protocol / scheme   ──► NEUTRALIZE (safeUrl = "#")
│
└── Step 3: Emit Anchored Element
      <a href="{safeUrl}" target="_blank" rel="noopener noreferrer">{safeText}</a>
```

---

## 3. Dependency Structure Model

```text
requirements.txt (Production runtime only)
├── fastapi >= 0.110.0
├── uvicorn[standard] >= 0.28.0
├── httpx >= 0.27.0
└── pydantic >= 2.6.0

requirements-dev.txt (Development & Testing)
├── -r requirements.txt
├── pytest >= 8.0.0
└── pytest-asyncio >= 0.23.0
```
