# Research: Deployment Script Hardening, Automated Container Creation & Lifecycle Improvements

**Feature**: `004-enhance-deployment-script`
**Date**: 2026-11-05

## Technical Decisions & Findings

### Decision 1: Incus Host Verification and Container Creation Strategy
- **Decision**: Check for the `incus` CLI binary on the host at the very beginning (`command -v incus`). If present, query `incus info "${CONTAINER_NAME}"`.
  - If container exists: report its active status and prompt user whether to reuse it or choose another name.
  - If container does not exist: prompt user to confirm launching a new container using `images:debian/13`, with automatic fallback to `images:debian/stable` (Debian 12 Bookworm) if `images:debian/13` is unavailable.
- **Rationale**: Debian 13 (Trixie) is the target specified by the user, but network/mirror availability may require falling back to Debian stable without crashing. Prompting when a container exists prevents accidental modification of existing instances while supporting re-entrant deployments.
- **Alternatives considered**:
  - Unconditionally creating a new container with a timestamped name: Rejected because users want deterministic naming (`webui`).
  - Aborting immediately if container exists: Rejected based on user clarification (Option A selected by user).

### Decision 2: Python Virtual Environment (`venv`) vs Global System Python
- **Decision**: Provision `/opt/e-webui/venv` inside the container using `python3 -m venv /opt/e-webui/venv`, upgrade pip inside the virtual environment, and install dependencies with `/opt/e-webui/venv/bin/pip install -r /opt/e-webui/requirements.txt`.
- **Rationale**: Modern Debian versions (Debian 12/13) enforce PEP 668 (externally-managed-environment). Using `--break-system-packages` globally risks contaminating Debian system tools. A virtual environment is self-contained, isolated, easily reproducible, and clean.
- **Alternatives considered**:
  - Global `pip install --break-system-packages`: Rejected due to Debian package manager conflict risks and security best practices.
  - Using conda / pipenv / poetry: Rejected because standard Python 3 `venv` requires zero extra host tooling or complex runtimes.

### Decision 3: Host Port Conflict Detection & Proxy Binding
- **Decision**: Before executing `incus config device add "${CONTAINER_NAME}" webui-proxy proxy listen=tcp:127.0.0.1:${HOST_PORT} connect=tcp:127.0.0.1:8080`, verify host port availability. Support a `--port` CLI flag to override the default 8080.
- **Rationale**: If port 8080 is already bound on the host (by another web server or proxy), Incus fails to bind the proxy device. Checking upfront and offering a custom port prevents deployment failure.
- **Alternatives considered**:
  - Blindly letting Incus fail: Rejected; creates confusing error traces.

### Decision 4: Intelligent Ollama Proxy Target Discovery
- **Decision**: Three-tier resolution:
  1. Check if Incus container `ollama` exists and is running (`incus info ollama`). If so, extract its IP and target `${OLLAMA_IP}:11434`.
  2. If no `ollama` container, test if host port 11434 is responding (`curl -s --connect-timeout 1 http://127.0.0.1:11434/api/tags`). If so, target `127.0.0.1:11434`.
  3. If neither responds, interactively prompt the user for the Ollama host/IP address (or read `--ollama-url` CLI argument).
- **Rationale**: Directly satisfies user clarification (Option A) and ensures flexible connectivity across different host setups.

### Decision 5: Execution Independence and Root-Level Access
- **Decision**:
  1. Add a root-level executable wrapper `./deploy.sh` that detects `REPO_ROOT` and invokes `scripts/deploy.sh "$@"`.
  2. In `scripts/deploy.sh`, calculate `REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"` dynamically, ensuring all `incus file push` calls use absolute or `REPO_ROOT`-anchored paths.
- **Rationale**: Users naturally run `./deploy.sh` from the repository root. Anchoring paths eliminates breakage when running from any sub-directory.

### Decision 6: True HTTP Readiness Health Check
- **Decision**: After systemd restarts `e-webui`, poll `http://127.0.0.1:${HOST_PORT}/` or `http://127.0.0.1:${HOST_PORT}/health` up to 15 times (with 1-second intervals) checking for HTTP 200, followed by an internal container probe to `http://127.0.0.1:11434/api/tags`.
- **Rationale**: Prevents false-positive success reporting when the process starts but crashes seconds later during startup.
