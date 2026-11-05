# Interface Contract: Deploy CLI & Interactive Protocol

**Feature**: `004-enhance-deployment-script`
**Date**: 2026-11-05

## 1. Command-Line Interface Schema

### Usage
```bash
./deploy.sh [OPTIONS] [CONTAINER_NAME]
```

### Arguments
| Argument | Type | Optional | Description |
|---|---|---|---|
| `CONTAINER_NAME` | Positional String | Yes | Name of target Incus container. Prompts interactively if omitted. Must match `^[a-zA-Z0-9_-]+$`. |

### Options & Flags
| Flag | Long Flag | Description | Default |
|---|---|---|---|
| `-y` | `--yes`, `--non-interactive` | Automatically confirm all step prompts | Interactive (`0`) |
| `-r` | `--reset`, `--force` | Clear saved deployment state and re-execute from step 0 | Disabled (`0`) |
| `-p` | `--port <PORT>` | Host port to expose for Web UI | `8080` |
| `-o` | `--ollama-url <URL>` | Explicit target endpoint for Ollama proxy | Auto-discovered |
| `-s` | `--status` | Read-only inspection of active deployment status without mutating container | N/A |
| `-c` | `--clean`, `--uninstall` | Interactively stop service, remove systemd unit, and remove proxy devices | N/A |
| `-h` | `--help` | Display usage manual and exit | N/A |

### Exit Codes
| Exit Code | Classification | Description |
|---|---|---|
| `0` | Success | Deployment completed and service verified healthy via HTTP 200 |
| `1` | Aborted by User | User explicitly rejected a step prompt and confirmed abort |
| `2` | Pre-check / Config Error | `incus` not installed, invalid argument, or missing prerequisites |
| `3` | Runtime Execution Failure| Command failure during step execution (APT, pip, proxy, systemd, or healthcheck) |

---

## 2. Interactive Prompts & Terminal Output Contract

### Step Confirmation Format
```text
------------------------------------------------------------
[Step N/5] <Step Title>
------------------------------------------------------------
Description:
  - <Bullet 1>
  - <Bullet 2>

Do you want to proceed with this step? [y/N]: 
```

### Abort Confirmation Format (when user responds 'n' or rejects)
```text
[WARNING] Skipping this step ('<Step Title>') will prevent e-webui from being deployed and functioning properly.
Do you want to abort the deployment now? [Y/n]: 
```
- If user responds `y` or enters default: exits with status code 1.
- If user responds `n`: reprompts the step.

### Existing Container Confirmation Format
```text
[INFO] Container '<CONTAINER_NAME>' already exists in Incus (Status: <STATUS>).
Do you want to deploy into this existing container? [Y/n]: 
```
- If user responds `n`: prompts for a new container name.

### Success Banner Contract
```text
============================================================
Deployment Successfully Completed!
============================================================

Application Access URL: http://127.0.0.1:<HOST_PORT> (via Incus Host Proxy)
Direct Container URL:   http://<CONTAINER_IP>:8080
Container Name:         <CONTAINER_NAME>
Base OS:                Debian 13 (or Debian stable)
Virtual Environment:    /opt/e-webui/venv
Service Status:         active (running) - HTTP 200 Verified
Ollama Link:            127.0.0.1:11434 -> <OLLAMA_TARGET>
```
