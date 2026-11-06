# CLI Contract: `deploy.sh`

**Command**: `./deploy.sh`  
**Purpose**: Primary lifecycle management interface for e-webui deployments on Incus.

---

## 1. Syntax

```bash
./deploy.sh [OPERATION] [OPTIONS] [CONTAINER_NAME]
```

---

## 2. Operations (Mutually Exclusive)

If no operation is specified, automatic detection determines whether an **Install** or **Update** is appropriate.

| Flag | Name | Description |
|---|---|---|
| *(none)* | Auto-Detect | Inspects container state. If container exists with e-webui markers, performs update; if container does not exist, performs install; if container exists unmanaged, asks for authorization. |
| `--install` | Force Install | Executes initial provisioning, container launch, OS package install, proxy configuration, and initial release setup. |
| `--update` | Force Update | Packages latest host source, validates checksum, updates container release, reuses or creates venv, atomically switches active pointer, and verifies health. |
| `--rollback` | Rollback | Reverts active pointer to `previous_healthy_release` recorded in `.deploy_state`, restarts service, and verifies health. |
| `--status` | Status | Displays container runtime status, active release ID, previous healthy release ID, virtualenv hash, service status, and HTTP health. |
| `--repair` | Repair | Audits filesystem pointers, recreates missing symlinks (`current`, `venv`, `data`), regenerates systemd service if drifted, reloads daemon, and re-verifies service. |
| `--uninstall` | Uninstall | Stops service, removes systemd unit, removes Incus proxy devices, and cleans up deployment files. (Retains `shared/` persistent data unless `--purge-data` is specified). |
| `-h, --help` | Help | Displays usage instructions, available flags, and exit codes. |

---

## 3. Options

| Option | Argument | Description | Default |
|---|---|---|---|
| `-p, --port` | `<PORT>` | Host port to bind for Web UI proxy device. | `8080` |
| `-o, --ollama-url` | `<URL>` | Explicit Ollama host/endpoint target. | Auto-discovered (`127.0.0.1:11434`) |
| `-y, --yes, --non-interactive` | *(none)* | Bypasses interactive step confirmations; auto-approves safe operations. | `0` (Interactive) |
| `-r, --reset` | *(none)* | Clears deployment state and re-executes initial installation. *Not an update.* | `0` |
| `--purge-data` | *(none)* | Used with `--uninstall` to explicitly delete `shared/` persistent data. | `0` |
| `--retention` | `<COUNT>` | Number of healthy previous releases to retain. | `3` |

---

## 4. Exit Codes

| Exit Code | Meaning | Details |
|---|---|---|
| `0` | Success | Operation completed successfully and service is verified healthy via HTTP 200. |
| `1` | User Abort | Operation was aborted or cancelled by the user during interactive prompt. |
| `2` | Pre-check / Config Error | Missing CLI arguments, unknown option, lock contention, port collision, or Incus missing. |
| `3` | Execution Failure | Failure during packaging, transfer, APT install, pip install, proxy config, or systemd startup. |
| `4` | Health Check Failure | Service failed to respond with HTTP 200 within timeout (triggers automatic rollback). |
| `5` | Rollback Failure | Automatic or manual rollback was attempted but failed to restore a healthy release. |
