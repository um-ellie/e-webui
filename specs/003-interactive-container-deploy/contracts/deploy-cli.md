# Interface Contract: Deploy Script CLI (`scripts/deploy.sh`)

**Feature Branch**: `003-interactive-container-deploy`
**Date**: 2026-11-05
**Status**: Draft

## Command Invocation Syntax

```bash
scripts/deploy.sh [OPTIONS] [CONTAINER_NAME]
```

### Arguments

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `CONTAINER_NAME` | string | Optional | Target Incus container name. If omitted, the script prompts interactively. |

### Options / Flags

| Flag | Long Flag | Description |
|------|-----------|-------------|
| `-y` | `--yes` / `--non-interactive` | Auto-confirm all step prompts (useful for CI/automated runs). |
| `-r` | `--reset` / `--force` | Clear existing deployment state record and execute from Step 1. |
| `-h` | `--help` | Show usage documentation and exit. |

---

## Interactive Prompts

### 1. Target Container Prompt
Triggered when `CONTAINER_NAME` argument is not supplied:
```text
Enter Incus container name [default: webui]: 
```

### 2. Step Confirmation Prompt
Triggered before each step execution:
```text
============================================================
[Step 3/5] Sync Application Files & Dependencies
============================================================
Description:
  - Copy repository app/, tests/, and requirements.txt to /opt/e-webui
  - Install Python requirements inside container via pip
  - Copy app/systemd/e-webui.service to /etc/systemd/system/

Do you want to proceed with this step? [y/N]: 
```

### 3. Step Rejection & Abort Warning
Triggered when user declines (`N` or Enter):
```text
⚠️  Warning: Skipping this step ('Sync Application Files & Dependencies')
    will prevent e-webui from being deployed and functioning properly.

Do you want to abort the deployment now? [Y/n]: 
```
- If `Y` or Enter: Script halts immediately with exit code `1`.
- If `n`: Script returns to the step prompt for reconsideration.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success: All deployment steps completed and verified healthy. |
| `1` | Aborted by user: A step was declined or aborted upon warning. |
| `2` | Missing prerequisite: Incus not installed, container not found, or command syntax error. |
| `3` | Runtime failure: A step failed during execution (e.g. pip error, systemd start failure). |

---

## State Record Contract

The state is stored inside the container at `/opt/e-webui/.deploy_state`:

```ini
CONTAINER=webui
STEP_1_CONTAINER_VERIFIED=2026-11-05T03:00:00Z
STEP_2_PREREQUISITES_INSTALLED=2026-11-05T03:00:15Z
STEP_3_FILES_SYNCED=2026-11-05T03:00:45Z
STEP_4_SERVICE_CONFIGURED=2026-11-05T03:01:00Z
STEP_5_HEALTH_VERIFIED=2026-11-05T03:01:10Z
STATUS=COMPLETED
```
If a step key is absent or empty, that step is treated as pending.
