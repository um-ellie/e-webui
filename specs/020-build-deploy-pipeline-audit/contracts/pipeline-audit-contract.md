# Interface Contract: Build & Deployment Pipeline Verification

**Feature**: `020-build-deploy-pipeline-audit`  
**Date**: 2026-11-15  
**Version**: 1.0.0  

## 1. Build & Release CLI Contract (`./build-release.sh`)

### Invocation Syntax
```bash
./build-release.sh [OPTIONS]
```

### Supported Options
- `-o, --output-dir <DIR>`: Output directory for published releases (default: `dist/releases`).
- `-v, --version <VER>`: Semantic version override (default: parsed from `app/main.py`).
- `--strict`: Fail if git working tree contains uncommitted changes.
- `--archive-only`: Publish only the `.tar.gz` compressed bundle.
- `--dir-only`: Publish only the uncompressed release directory.
- `-h, --help`: Display usage documentation.

### Exit Codes
- `0`: Success — Release package generated, verified, and published.
- `1`: User abort / interruption.
- `2`: Configuration error / dirty git tree when `--strict` is enabled.
- `3`: Packaging or manifest verification failure.

---

## 2. Deployment Manager CLI Contract (`./deploy.sh`)

### Invocation Syntax
```bash
./deploy.sh [OPERATION] [OPTIONS] [CONTAINER_NAME]
```

### Operations
- `(auto)`: Automatically detects whether to perform initial install or release update.
- `--install`: Full container launch, Incus proxy setup, prerequisite installation, release staging, venv setup, and service enablement.
- `--update`: Zero-rebuild release update: stages package, verifies checksums in-container, extracts release, links cached venv, updates proxy devices, restarts service, and performs health verification with automatic rollback.
- `--status`: Inspects container state, active release ID, venv health, systemd service status, and Kokoro TTS status.
- `--rollback`: Reverts `current` pointer to the previously recorded healthy release.
- `--repair`: Re-links broken symlinks, venvs, and services.
- `--uninstall`: Removes services and configuration.

### Options
- `--release <PATH>`: Explicit path to release directory or `.tar.gz` bundle (defaults to latest in `dist/releases`).
- `-p, --port <PORT>`: Host port mapping for `webui-proxy` (default: `8080`).
- `-o, --ollama-url <URL>`: Ollama target address for `ollama-link` (default: `127.0.0.1:11434`).
- `-y, --yes`: Non-interactive mode (automatically confirms prompts).
- `--retention <COUNT>`: Number of previous healthy releases to retain (default: 3).

### Exit Codes
- `0`: Deployment successfully completed and health verified.
- `1`: User cancellation / abort.
- `2`: Pre-check error (Incus missing, invalid argument, lock contention).
- `3`: Execution failure during staging, extraction, or venv provisioning.
- `4`: Health check failure (automatic rollback triggered).
- `5`: Rollback failure.

---

## 3. Strict Scope Contract: Read-Only `app/` Directory

- No file under `app/` may be created, edited, deleted, or reformatted.
- All fixes and enhancements must be confined to:
  - `build-release.sh`
  - `deploy.sh`
  - `scripts/build-release.sh`
  - `scripts/deploy.sh`
  - `scripts/lib/*.sh`
  - `scripts/lib/*.py`
  - `tests/`
