# Phase 0 Research: Interactive Deployment & Script Modernization Overhaul

**Feature**: Interactive Deployment & Script Modernization Overhaul  
**Date**: 2026-11-20  
**Status**: Completed  

---

### Research Item 1: Interactive Terminal Interface (TUI / CLI Dashboard)

- **Context**: The existing `./deploy.sh` requires memorizing long flags (`--update`, `--repair`, `--status`, `--rollback`, `--download-model`). The user requested an interactive, user-friendly method for installing, managing, and inspecting updates.
- **Decision**: Implement a native, dependency-free interactive Terminal UI (TUI) inside a dedicated `./ctl` wrapper and integrated fallback in `./deploy.sh` when invoked in an interactive terminal (TTY) without arguments.
- **Rationale**:
  - Pure Bash + ANSI/VT100 escape sequences guarantees zero external dependencies on both host and lightweight container environments (no `python-rich`, `whiptail`, or `dialog` package required on host).
  - Supports color-coded status badges, real-time single-key/numbered prompt navigation, clear menu selections, and safe streaming log viewing via `journalctl -u e-webui -f`.
  - Seamlessly keeps existing non-interactive CLI flags (`--update`, `--status`, `--repair`, etc.) intact for CI/CD, automation scripts, and headless environments.
- **Alternatives Considered**:
  - *Python `textual` or `rich` TUI*: Rejected because host machine might not have Python libraries installed in system environment without activating a virtual environment.
  - *Standard `dialog` or `whiptail`*: Rejected because `dialog`/`whiptail` may not be installed by default on minimal Linux server installs.

---

### Research Item 2: One-Step Smart Update with Auto-Packaging

- **Context**: Currently, running `./deploy.sh --update` looks only for pre-existing archives in `dist/releases/`. Modifying code in `app/` and running `--update` deploys stale archives or fails if `dist/releases/` is empty.
- **Decision**: Integrate automatic workspace change detection and ephemeral/timestamped packaging directly into the update flow.
- **Rationale**:
  - When `--update` (or TUI option `[1] Smart Update`) is invoked, the tool checks whether code changes exist in `app/` or `requirements.txt` relative to the latest packaged release.
  - If changes exist or no release package exists, it automatically invokes `build_release_package` internally to construct a fresh, verified release bundle with manifest and SHA256 checksums, and then immediately activates it in the container.
  - Eliminates human error where developers test old code while thinking they deployed their newest edits.
- **Alternatives Considered**:
  - *Direct rsync/bind-mount only*: Good for pure local dev, but breaks release immutability and atomic rollback guarantees in production containers. Fast Dev-Sync will be provided as an explicit dev option, while standard update remains immutable and atomic.

---

### Research Item 3: Port Isolation & Decoupling (Host vs. Container Port)

- **Context**: Currently, `-p <PORT>` sets the host proxy listen port, but also injects that same port into Uvicorn inside the container (`ExecStart=... --port ${app_port}`). Meanwhile, the proxy device connects to container port 8080 (`connect=tcp:127.0.0.1:8080`). This breaks any custom port deployment.
- **Decision**: Strictly decouple host port and container port.
  - Container application port is **fixed internally at 8080** (standard containerized convention).
  - Host port is configurable (default `8080`, or custom via `-p <PORT>`).
  - Incus proxy device explicitly maps: `listen=tcp:127.0.0.1:${HOST_PORT} connect=tcp:127.0.0.1:8080`.
- **Rationale**:
  - Container internal configuration never changes regardless of which host port the user binds to.
  - Systemd unit always listens on container `0.0.0.0:8080`.
  - Fixes custom port deployment 100% reliably.
- **Alternatives Considered**:
  - *Dynamically configuring both proxy connect port and uvicorn port*: Adds unnecessary complexity, requires altering systemd units whenever host proxy port changes, and creates race conditions during port re-binding.

---

### Research Item 4: Modular Profiles (Core Profile vs. TTS Add-on)

- **Context**: The app promises *“under 50 MB RAM, ultra-lightweight”*. However, `ensure_venv_in_container` unconditionally attempts to install `torch` (~500MB wheel) and `kokoro`, and `download_kokoro_model` tries to download 350MB from HuggingFace via `curl` with an 1800s timeout, causing massive bloat and 30-minute hangs in restricted networks.
- **Decision**: Introduce explicit modular deployment profiles:
  - **`core` (Default)**: Installs only FastAPI, Uvicorn, httpx, and Pydantic. Consumes <50MB RAM, deploys in <30 seconds, zero HuggingFace network dependencies.
  - **`tts` (Optional Add-on)**: Installs PyTorch (CPU) and Kokoro weights on-demand via `--with-tts` or TUI menu `[7] Manage Profiles`.
- **Rationale**:
  - Guarantees instant, lightweight, and resilient setup for all users regardless of network conditions.
  - Respects the core design philosophy of `e-webui` while keeping advanced TTS features available for users who need them.
- **Alternatives Considered**:
  - *Always installing TTS in background*: Background tasks in containers still consume CPU and network bandwidth, leading to mysterious failures on slow connections.

---

### Research Item 5: Multi-Architecture & Python 3.10-3.13 Native Compatibility

- **Context**: `STANDALONE_PYTHON_DEFAULT_URL` hardcodes `x86_64-unknown-linux-gnu`. On ARM64 (aarch64), it downloads incompatible binaries. Also, `is_compatible_python_binary` strictly rejects Python >= 3.13, even though Debian 13 includes Python 3.13.
- **Decision**:
  - Architecture detection (`uname -m`): Map to correct architecture (`x86_64` vs `aarch64`) if standalone Python is needed.
  - For Core profile, accept native system Python 3.10 through 3.13 natively (`python3 -m venv`), completely avoiding standalone external downloads when the container OS already provides Python 3.
- **Rationale**:
  - Zero internet downloads required for Python runtime on standard Debian 12/13 containers.
  - Full compatibility with Raspberry Pi 4/5, Apple Silicon VMs, and ARM cloud servers.
- **Alternatives Considered**:
  - *Forcing Docker image*: Violates project architecture which is built specifically on Incus system containers.

---

### Research Item 6: Self-Healing Concurrency Locks & Stale Lock Expiration

- **Context**: If a deployment crashes or is cancelled (`Ctrl+C`, network disconnect), `.deploy.lock` remains stuck inside the container, blocking all subsequent operations.
- **Decision**: Implement lease-based self-healing concurrency locks with PID and age validation.
  - If a lock exists, parse `.deploy.lock/info`.
  - If the lock is older than 10 minutes or the recording PID is no longer running on the host, declare it *stale*.
  - In interactive mode, prompt user: *"Stale deployment lock detected from [time]. Clear lock and proceed? [Y/n]"*. In non-interactive mode with `--reset` or expired lease, automatically heal and reclaim the lock.
- **Rationale**:
  - Completely prevents permanent lock contention while retaining true concurrency protection.
- **Alternatives Considered**:
  - *Flock on a host file*: Host-only flock does not protect against multi-host or remote incus clients targeting the same container instance.
