# e-webui (Incus Container)

A lightweight, secure, and responsive web interface (`e-webui`) for [Ollama](https://ollama.com/) running inside a dedicated [Incus](https://linuxcontainers.org/incus/) container (`webui`).

Designed specifically to replace heavyweight multi-gigabyte UI suites with an ultra-efficient application consuming under **50 MB RAM** that starts automatically on container boot and exposes access strictly to the host machine.

---

## 🚀 Key Features

- **Blazing Fast & Ultra-Light**: Uses ~40 MB RAM at runtime (compared to >1.2 GB for Open-WebUI).
- **Zero-Friction Auto-Start**: Runs as a native `systemd` service (`e-webui.service`). Whenever you run `incus start webui`, the web chat is ready in under 1 second.
- **Strict Host-Only Security**: Binds exclusively to `127.0.0.1:8080` via Incus proxy. No open ports on your local Wi-Fi or LAN.
- **Inter-Container Isolation**: Communicates with the `ollama` container through an internal proxy device (`127.0.0.1:11434`), completely air-gapped from external networks.
- **Real-Time Token Streaming**: Token-by-token streaming using Server-Sent Events (SSE) with support for model thinking/reasoning blocks (e.g., `qwen3.5:4b`).
- **Zero CDN Dependencies**: Self-contained single-page chat interface that works 100% offline.

---

## 🛠️ Architecture & Networking

```text
Host Browser (Desktop)
     │
     ▼ (http://127.0.0.1:8080)
[Incus Host Proxy Device: webui-proxy]
     │
     ▼ (127.0.0.1:8080 inside container)
[Incus Container: "webui"]
  └── FastAPI Async Server (systemd: e-webui.service)
     │
     ▼ (http://127.0.0.1:11434 via ollama-link proxy device)
[Incus Container: "ollama"]
  └── Ollama Daemon (GPU accelerated, e.g. qwen3.5:4b)
```

---

## 📖 Daily Usage

### 1. Start the Containers
When you want to use your models:
```bash
# Start Ollama container (if not already running)
incus start ollama

# Start container
incus start webui
```

### 2. Open in Browser
Simply navigate to:
```text
http://127.0.0.1:8080
```

Select your model (e.g. `qwen3.5:4b`), type your prompt, and view responses in real-time.

### 3. Stop the Containers
When you're done:
```bash
incus stop webui
# optionally stop ollama if not needed
incus stop ollama
```

---

## 🔧 Management & Maintenance

### Check Service Status
```bash
incus exec webui -- systemctl status e-webui
```

### View Live Logs
```bash
incus exec webui -- journalctl -u e-webui -f
```

### Run Automated Tests
```bash
./scripts/test.sh
```

### Deployment & Updates (`scripts/deploy.sh`)

Deploy or update `e-webui` in an Incus container with interactive step-by-step confirmation and automatic state resumption:

```bash
# Standard interactive deployment (prompts for container name & each step)
./scripts/deploy.sh

# Target a specific container directly
./scripts/deploy.sh webui

# Non-interactive / automated mode (auto-confirms all steps)
./scripts/deploy.sh -y webui

# Force a clean re-run from Step 1 (resets saved progress state)
./scripts/deploy.sh --reset webui
```

#### Deployment Stages:
1. **Container Runtime Verification**: Checks container existence and ensures it is running.
2. **Environment Prerequisites**: Verifies Python 3/pip and resolves port 8080 conflicts (stops conflicting services).
3. **Application Synchronization**: Copies `app/`, `tests/`, `requirements.txt`, installs pip dependencies, and registers `e-webui.service`.
4. **Systemd Activation**: Performs `systemctl daemon-reload`, enables boot startup, and restarts `e-webui`.
5. **Health Verification**: Verifies active service status and reports the live access URL.

*Note: If deployment is interrupted or stopped, re-running the script automatically detects previous progress and resumes from the first pending step.*

---

## 📁 Repository Structure

```text
├── app/
│   ├── config.py              # Application settings (ports, hosts)
│   ├── main.py                # FastAPI endpoints & static routing
│   ├── models.py              # Pydantic data schemas
│   ├── services/
│   │   └── ollama_client.py   # Async streaming client for Ollama API
│   ├── static/
│   │   ├── index.html         # Responsive chat UI
│   │   ├── style.css          # Self-contained dark styling
│   │   └── app.js             # SSE streaming reader & DOM renderer
│   └── systemd/
│       └── e-webui.service    # Systemd service unit definition
├── scripts/
│   ├── deploy.sh              # Syncs app to Incus and reloads systemd
│   └── test.sh                # Runs pytest suite in the container
├── tests/
│   ├── conftest.py            # Test fixtures & mocks
│   ├── unit/                  # Unit tests
│   └── integration/           # Endpoint integration tests
└── specs/                     # Spec-Kit specifications and task lists
```
