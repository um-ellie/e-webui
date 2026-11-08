# CLI Interface Contract: Deployment Lifecycle Manager

**Feature**: `014-provision-kokoro-tts` | **Date**: 2026-11-07 | **Spec**: [spec.md](../spec.md)

This contract defines the command-line interface, options, environment variables, exit codes, and output formats for `scripts/deploy.sh`.

---

## Command Synopsis

```text
deploy.sh [OPERATION] [OPTIONS] [CONTAINER_NAME]
```

---

## Operations

| Operation | Description | Modifies Deployment |
| :--- | :--- | :--- |
| *(no operation)* | Auto-detects whether to run `--install` or `--update` | Yes |
| `--install` | Provisions container, system packages, compatible Python, dependencies, model, and service | Yes |
| `--update` | Zero-downtime release update, venv migration (if needed), and health check | Yes |
| `--download-model` | Downloads/verifies Kokoro-82M model weights into persistent storage without modifying code | Yes (models only) |
| `--rollback` | Restores previous healthy release and its corresponding virtual environment | Yes |
| `--status` | Displays container, release, service, Python runtime, and TTS diagnostic health | No |
| `--repair` | Audits and restores missing system packages, broken venvs, symlinks, and model weights | Yes |
| `--uninstall` | Removes services and release directories (preserves shared data by default) | Yes |
| `-h`, `--help` | Prints detailed help message and exit code documentation | No |

---

## New and Extended Options

### `--skip-model-download`
- **Description**: Skips downloading Kokoro-82M model weights during `--install` or `--update`.
- **Usage**: Useful for code-only updates, offline environments where models are manually transferred, or bandwidth-constrained scenarios.
- **Behavior**: The deployment manager will not attempt network connections to Hugging Face or GitHub for weights. If model weights are already present, they remain untouched; if absent, a notice is displayed.

### `--download-model`
- **Description**: Standalone operation to download or retry downloading Kokoro-82M model weights into `/opt/e-webui/shared/models/kokoro/`.
- **Usage**: `./scripts/deploy.sh --download-model [CONTAINER_NAME]`
- **Behavior**:
  - Checks if `/opt/e-webui/shared/models/kokoro/kokoro-v0_19.pth` and voice files exist.
  - If present and valid: exits 0 immediately ("Model weights already present and verified").
  - If missing/corrupt: downloads using configured proxy/mirror with resume support to `.tmp` file and atomically renames.
  - Does NOT restart or disrupt the active web service.

---

## Environment Variables Contract

The deployment script respects the following host environment variables and forwards them to in-container provisioning commands:

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `HTTP_PROXY` | Proxy server for HTTP requests | None |
| `HTTPS_PROXY` | Proxy server for HTTPS requests | None |
| `ALL_PROXY` | SOCKS / Generic proxy server | None |
| `NO_PROXY` | Comma-separated list of hosts to bypass proxy | `localhost,127.0.0.1` |
| `PIP_INDEX_URL` | Primary PyPI repository mirror | `https://pypi.org/simple` |
| `PIP_EXTRA_INDEX_URL` | Additional package index URL (e.g. PyTorch CPU wheels) | `https://download.pytorch.org/whl/cpu` |
| `HF_ENDPOINT` | Hugging Face mirror endpoint for model weights | `https://huggingface.co` |
| `PYTHON_STANDALONE_URL` | Custom mirror URL for prebuilt standalone Python archive | Astral / GitHub release default |

---

## Exit Codes

| Exit Code | Meaning | Example Trigger |
| :---: | :--- | :--- |
| **0** | Success | Operation completed and verified healthy |
| **1** | User Abort | User declined confirmation prompt in interactive mode |
| **2** | Pre-check / Config / Lock Contention | Invalid arguments, missing package, lock held |
| **3** | Execution Failure | Package install failed, venv creation failed |
| **4** | Health Check Failure | `/api/health` returned non-200; automatic rollback triggered |
| **5** | Rollback Failure | Automatic rollback to previous release also failed |

> **Note on Model Download Failure**:
> When running `--install` or `--update`, if the model download fails due to network unavailability, the script logs a warning but returns **exit code 0** (assuming the application service starts and passes `/api/health`).
> If `--download-model` is invoked explicitly as a standalone operation and fails, it returns **exit code 3** with a descriptive error.

---

## Diagnostic Output Format (`deploy.sh --status`)

```text
============================================================
  Deployment Status Report for 'e-webui-app'
============================================================
Container Name:          e-webui-app
Container Runtime:       RUNNING
Active Release:          20261107-194500
Application Version:     0.14.0
Git Commit:              abcdef123456
Previous Healthy:        20261106-180000
Virtualenv Hash:         py3.11-e3b0c44298fc...
Systemd Service:         active (running)
HTTP Health Endpoint:    OK (200) on /api/health

Text-to-Speech (TTS) Environment:
  System Audio Packages: OK (espeak-ng, libsndfile1 installed)
  Application Python:    Python 3.11.9 (/opt/e-webui/interpreters/python-3.11/bin/python3)
  System OS Python:      Python 3.13.5 (/usr/bin/python3)
  Python TTS Packages:   OK (kokoro, soundfile, torch CPU importable)
  Kokoro-82M Weights:    PRESENT (/opt/e-webui/shared/models/kokoro/kokoro-v0_19.pth, 327MB)
  Voices Available:      11 voice profiles loaded

Incus Proxy Configuration:
  webui-proxy: proxy listen=tcp:127.0.0.1:8080 connect=tcp:127.0.0.1:8080
  ollama-link: proxy listen=tcp:127.0.0.1:11434 connect=tcp:127.0.0.1:11434
```
