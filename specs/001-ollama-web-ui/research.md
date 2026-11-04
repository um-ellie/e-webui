# Research & Architecture Decisions: Secure e-webui

**Feature**: `001-e-webui`  
**Date**: 2026-11-04  
**Status**: Completed  

---

## Decision 1: Application Backend Framework

- **Decision**: Python 3 with **FastAPI** (`uvicorn` + `httpx` async client).
- **Rationale**:
  - **Ultra-lightweight footprint**: Consumes only ~35–50 MB RAM at runtime, compared to ~1.25 GB RSS consumed by heavyweight suites like Open-WebUI.
  - **Native Asynchronous Streaming**: First-class async support for streaming tokens chunk-by-chunk from Ollama (`/api/generate` or `/api/chat`) to the browser using `StreamingResponse` (Server-Sent Events / chunked transfer).
  - **Zero compilation overhead**: Pure Python service that can run in a dedicated virtualenv (`uv` or `venv`) inside Debian.
  - **Fast startup**: Process launches in under 500ms.
- **Alternatives Considered**:
  - *Open-WebUI*: Already observed running in the user's container consuming over 1.2 GB of RAM and 9.2 GB virtual memory. It requires SQLite/PostgreSQL, complex vector databases, and heavy background tasks that are overkill for a simple, fast chat UI.
  - *Streamlit*: Very easy to write, but reruns the entire script on each interaction, handles streaming poorly, and consumes 200–300 MB of RAM.
  - *Go / Rust*: Extremely light and fast, but writing custom HTML streaming and template management in Python is significantly faster to develop, customize, and maintain in this project context.

---

## Decision 2: Frontend Architecture & UI Delivery

- **Decision**: Single-page modern HTML5/CSS/JavaScript with lightweight inline Markdown rendering, served directly by FastAPI.
- **Rationale**:
  - **Zero Build Tools**: No `npm`, `yarn`, or Node.js runtime needed inside the container.
  - **Embedded Assets**: Self-contained CSS and JavaScript (minimal marked.js / highlight.js if needed, or pure clean CSS) avoiding any external CDN dependencies so the UI works 100% offline and in air-gapped container networks.
  - **Interactive Token Streaming**: Uses browser native `ReadableStream` / `fetch()` or `EventSource` to render incoming tokens in real-time as the model generates them.
  - **Model Dropdown**: Dynamically queries the backend endpoint `/api/tags` to populate all installed Ollama models (e.g. `qwen3.5:4b`) automatically.
- **Alternatives Considered**:
  - *React / Vue / Svelte*: Requires Node.js build pipeline, bundling, and hundreds of megabytes of node modules in the container.
  - *Server-Side Template Only (Jinja2 without streaming)*: Blocks until full response generation is complete, resulting in poor user experience for long answers.

---

## Decision 3: Security & Access Control Model

- **Decision**: Incus Loopback Proxy Device (`127.0.0.1:8080`) binding strictly to host loopback.
- **Rationale**:
  - **Zero Public Exposure**: The Incus container network device `webui-proxy` listens on `tcp:127.0.0.1:8080` on the host machine and connects to `tcp:127.0.0.1:8080` inside the container.
  - **Air-Gapped from Local Network (LAN)**: External devices on the local Wi-Fi / Ethernet cannot reach port 8080 because it binds strictly to the host's loopback interface (`127.0.0.1`).
  - **Zero Password Friction**: Because only the local desktop user on the host can access `127.0.0.1:8080`, no repetitive passwords or session token logins are required, satisfying the requirement for "simple yet very secure".
- **Alternatives Considered**:
  - *Password / Token Auth*: Adds session management and state persistence without meaningful benefit when access is already restricted to the local host user.
  - *Reverse Proxy (Nginx/Caddy) with Basic Auth*: Adds an extra layer and daemon process inside the container without necessity for local loopback setups.

---

## Decision 4: Inter-Container Networking (WebUI to Ollama)

- **Decision**: Incus Proxy Device with instance binding (`ollama-link`).
- **Rationale**:
  - The `webui` container already has an Incus proxy device configured (`ollama-link`: `bind=instance`, `connect=tcp:127.0.0.1:11434`, `listen=tcp:127.0.0.1:11434`).
  - This allows the FastAPI app in `webui` to communicate with Ollama simply via `http://127.0.0.1:11434`, completely agnostic of container IP changes or DHCP reassignments.
  - No routing table or firewall modifications needed.
- **Alternatives Considered**:
  - *Direct Container IP (e.g., `10.100.0.157:11434`)*: Vulnerable to IP changes upon container recreation or DHCP lease expirations.
  - *Host IP routing*: Less isolated than direct Incus proxy devices.

---

## Decision 5: Service Lifecycle & Auto-Start Management

- **Decision**: Standard Linux `systemd` service unit (`e-webui.service`).
- **Rationale**:
  - Debian Trixie (the container OS) uses `systemd` as PID 1 (`/sbin/init`).
  - Creating a unit file `/etc/systemd/system/e-webui.service` and enabling it (`systemctl enable e-webui.service`) ensures that whenever the container boots (`incus start webui`), the service starts instantly.
  - Provides automatic restart on failure (`Restart=always`, `RestartSec=3`).
  - Standardized logging via `journalctl -u e-webui -f`.
- **Alternatives Considered**:
  - *Crontab `@reboot`*: Lacks process supervision, health checking, and structured logging.
  - *Manual shell script in `.bashrc`*: Requires opening an interactive shell session, violating the auto-start requirement.
