# API & Service Contracts: Secure Ollama Web UI

**Feature**: `001-ollama-web-ui`  
**Date**: 2026-11-04  
**Status**: Completed  

---

## 1. Web Application HTTP Endpoints

The FastAPI service listens on `127.0.0.1:8080` inside the container, accessible on the host at `http://127.0.0.1:8080`.

### 1.1 `GET /`
- **Description**: Serves the single-page responsive Web Chat application.
- **Request Headers**: `Accept: text/html`
- **Response**:
  - `200 OK`: HTML5 document with embedded styling and JavaScript.

---

### 1.2 `GET /api/models`
- **Description**: Proxies and formats available models queried from Ollama's `/api/tags`.
- **Request Headers**: `Accept: application/json`
- **Response Format**:
  ```json
  {
    "models": [
      {
        "name": "qwen3.5:4b",
        "size": 3324173934,
        "parameter_size": "4.2B",
        "quantization": "Q4_K_M"
      }
    ],
    "default_model": "qwen3.5:4b"
  }
  ```
- **Error Responses**:
  - `503 Service Unavailable`: Ollama service is not responding or unreachable at `http://127.0.0.1:11434`.

---

### 1.3 `POST /api/generate`
- **Description**: Receives user prompt and streams generated tokens back to the client using Server-Sent Events (SSE).
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "model": "qwen3.5:4b",
    "prompt": "Why is the sky blue?",
    "system": "You are a helpful assistant.",
    "temperature": 0.7
  }
  ```
- **Response Headers**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- **SSE Stream Protocol**:
  Each event contains a JSON string with the incremental token:
  ```text
  data: {"token": "The", "done": false}

  data: {"token": " sky", "done": false}

  data: {"token": " appears", "done": false}

  data: {"token": " blue", "done": false}

  data: {"token": "", "done": true, "eval_count": 42}
  ```
- **Error Handling**:
  If upstream generation fails, emits an event:
  ```text
  data: {"error": "Ollama generation failed: Connection reset", "done": true}
  ```

---

### 1.4 `GET /api/health`
- **Description**: Liveness and upstream connectivity probe.
- **Response**:
  ```json
  {
    "status": "ok",
    "ollama_connected": true,
    "ollama_url": "http://127.0.0.1:11434"
  }
  ```

---

## 2. Systemd Service Contract (`ollama-webui.service`)

- **File Path**: `/etc/systemd/system/ollama-webui.service`
- **Unit Configuration**:
  ```ini
  [Unit]
  Description=Lightweight Ollama Web UI
  After=network.target

  [Service]
  Type=simple
  User=root
  WorkingDirectory=/opt/ollama-webui
  ExecStart=/opt/ollama-webui/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8080
  Restart=always
  RestartSec=3
  Environment="OLLAMA_HOST=http://127.0.0.1:11434"

  [Install]
  WantedBy=multi-user.target
  ```

---

## 3. Incus Device & Security Contract

### 3.1 Host to WebUI Proxy Device
```yaml
webui-proxy:
  type: proxy
  listen: tcp:127.0.0.1:8080
  connect: tcp:127.0.0.1:8080
```
- Restricts incoming access exclusively to the host machine's loopback interface.

### 3.2 WebUI to Ollama Proxy Device
```yaml
ollama-link:
  type: proxy
  bind: instance
  listen: tcp:127.0.0.1:11434
  connect: tcp:127.0.0.1:11434
```
- Directs requests to port 11434 inside the WebUI container into Ollama's port 11434 via Incus instance proxy.
