# Interface Contract: API Endpoints & Security Headers

**Feature**: Security Hardening, Bug Fixes, and Code Optimization  
**Date**: 2026-11-07  

---

## 1. Global Security Headers Contract

Every HTTP response emitted by the application server MUST include the following headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';
```

---

## 2. API Contract Specification

### `GET /api/health`

- **Purpose**: Liveness probe for the web UI and upstream Ollama service.
- **Request**: No parameters.
- **Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "ollama_connected": true,
    "ollama_url": "http://127.0.0.1:11434"
  }
  ```
- **Response (Degraded 200 OK)**:
  ```json
  {
    "status": "degraded",
    "ollama_connected": false,
    "ollama_url": "http://127.0.0.1:11434"
  }
  ```

---

### `POST /api/generate`

- **Purpose**: Stream token inference events from Ollama via Server-Sent Events.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "model": "qwen3.5:4b",
    "prompt": "Hello world",
    "stream": true,
    "thinking": true,
    "temperature": 0.7
  }
  ```
- **Validation Rules**:
  - `model`: Must match `^[a-zA-Z0-9_\-\./:]+$` with length 1 to 128 characters.
  - `prompt`: String length 1 to 100,000 characters.
- **Error Response (422 Unprocessable Entity)**:
  When `model` is invalid or contains forbidden characters:
  ```json
  {
    "detail": [
      {
        "type": "string_pattern_mismatch",
        "loc": ["body", "model"],
        "msg": "String should match pattern '^[a-zA-Z0-9_\\-\\./:]+$'"
      }
    ]
  }
  ```
- **Stream Output Format**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`
