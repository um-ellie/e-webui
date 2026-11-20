# CLI & TUI Interface Contract

**Feature**: Interactive Deployment & Script Modernization Overhaul  
**Date**: 2026-11-20  
**Status**: Completed  

---

### 1. Interactive Control Center Interface (`./ctl` or `./deploy.sh`)

When invoked in an interactive terminal session (`[ -t 0 ] && [ -t 1 ]`) with no positional arguments:

```bash
$ ./ctl [CONTAINER_NAME]
# or
$ ./deploy.sh [CONTAINER_NAME]
```

#### Screen Layout & State Rendering:
```text
========================================================================
                      e-webui Control Center v1.1.0                     
========================================================================
 Container:   [webui]  Status: [RUNNING]      Uptime: 4h 12m
 Service:     [active] e-webui.service        Uvicorn: 127.0.0.1:8080
 Host Proxy:  http://127.0.0.1:8080           Health:  HTTP 200 (OK)
 Ollama:      http://127.0.0.1:11434          Backend: ONLINE (4 models)
 Active Rel:  20261120-034500 (v1.0.0)        Profile: core (<50MB RAM)
 Memory RSS:  39.2 MB                         Dirty:   Clean (commit: 1a608b)
========================================================================

 Actions:
   1) Smart Update       - Auto-package workspace changes & hot-switch
   2) Fast Dev-Sync      - Rapid code synchronization (hot-reload)
   3) Service Control    - Restart / Stop / Start application service
   4) Live Logs          - Stream real-time systemd journal logs
   5) Rollback           - Revert to previous healthy release
   6) Diagnostics        - Audit configuration, symlinks, and repair
   7) Modular Profiles   - Enable/Disable Kokoro TTS & model assets
   8) Port & Networking - Change host proxy port or Ollama address
   9) Test Suite Runner  - Run unit & integration tests (local/container)
   0) Exit

 Select option [0-9]: 
```

#### Interactive Action Behaviors:

- **Option 1 (Smart Update)**:
  - Scans workspace for modified files in `app/` and `requirements.txt`.
  - Prompts if uncommitted changes exist: `"Package uncommitted workspace changes? [Y/n]"`.
  - Builds release package with progress indicator.
  - Pushes, extracts, switches atomic symlink, restarts service.
  - Polls health endpoint; confirms success or triggers automatic rollback.
  - Pauses with: `"Press Enter to return to menu..."`.

- **Option 2 (Fast Dev-Sync)**:
  - Directly syncs modified `app/` files into `/opt/e-webui/current/app/` using `incus file push`.
  - Signals Uvicorn to reload (or restarts service in <1s).
  - Displays instant confirmation.

- **Option 3 (Service Control)**:
  - Submenu: `[1] Restart Service`, `[2] Stop Service`, `[3] Start Service`, `[b] Back`.

- **Option 4 (Live Logs)**:
  - Executes `incus exec <container> -- journalctl -u e-webui -f -n 50`.
  - Catches `Ctrl+C` cleanly to return to the interactive menu rather than terminating the whole script.

- **Option 5 (Rollback)**:
  - Displays available previous healthy releases with versions and timestamps.
  - Prompts for confirmation before switching symlink and restarting.

---

### 2. Scripted & Headless CLI Contract

For non-interactive use (scripts, CI/CD, pipelines):

```bash
./deploy.sh [OPERATION] [OPTIONS] [CONTAINER_NAME]
```

#### Operations:
| Flag | Description | Exit Codes |
| :--- | :--- | :--- |
| *(no flag in non-interactive)* | Automatically detects install vs update | 0: Success, 2: Pre-check, 3: Failure, 4: Health Check Fail |
| `--install` | Full container provisioning and initial deployment | 0, 1, 2, 3, 4 |
| `--update` | Auto-packages changes (if needed) and performs atomic switch | 0, 1, 2, 3, 4, 5 (Rollback fail) |
| `--dev-sync` | Direct file sync into active container for rapid testing | 0, 2, 3 |
| `--status` | Prints structured status report (supports `--json`) | 0 (Normal) |
| `--repair` | Audits and self-heals broken symlinks, venvs, and proxy devices | 0, 2, 3, 4 |
| `--rollback` | Reverts pointer to previous healthy release | 0, 2, 5 |
| `--uninstall` | Removes service and proxies (preserves shared data by default) | 0, 2 |

#### Options:
| Flag | Parameter | Description |
| :--- | :--- | :--- |
| `-p`, `--port` | `<PORT>` | Host proxy listen port (Default: 8080) |
| `-o`, `--ollama-url` | `<URL>` | Ollama upstream address (Default: 127.0.0.1:11434) |
| `--profile` | `core\|tts` | Target deployment profile (Default: core) |
| `--with-tts` | None | Shorthand for `--profile tts` |
| `--auto-package` | None | Automatically package workspace if source is modified |
| `-y`, `--yes` | None | Non-interactive mode (assumes Yes to prompts) |
| `-r`, `--reset` | None | Clears stale deployment locks and resets state |
| `--json` | None | Formats status report output as machine-readable JSON |

---

### 3. Test Runner Contract (`scripts/test.sh`)

```bash
./scripts/test.sh [OPTIONS] [CONTAINER_NAME]
```

| Flag | Description |
| :--- | :--- |
| *(no flags)* | Runs automated test suite inside container using container venv |
| `-l`, `--local` | Runs unit tests directly on host using host virtualenv or python3 |
| `-u`, `--unit` | Runs only unit tests |
| `-i`, `--integration` | Runs integration tests |
| `-v`, `--verbose` | Enables verbose pytest output |
