# Quickstart Validation Guide: Hardened Deployment & Container Lifecycle

**Feature**: `004-enhance-deployment-script`
**Date**: 2026-11-05

This guide provides runnable scenarios to validate the implementation of `./deploy.sh` and `scripts/deploy.sh`.

> [!IMPORTANT]
> In accordance with Project Constitution Principle I & III, automated test execution against actual Incus containers is strictly reserved for the user on the host system. The scenarios below guide manual user validation and local mock-based testing.

## Prerequisites
1. Host machine running Linux with `incus` installed and configured.
2. User belongs to `incus-admin` group or has permission to run `incus` commands.
3. Network access to pull Debian images from `images:`.

---

## Scenario 1: Pre-check & Missing Incus Handling
**Objective**: Verify the script safely detects missing Incus or displays help cleanly.

```bash
# Test help display from repo root
./deploy.sh --help

# Verify exit code is 0
echo $?
```
**Expected Outcome**: Complete help text displayed, listing all options (`--port`, `--ollama-url`, `--status`, `--reset`), exiting with code 0.

---

## Scenario 2: Pristine Deployment with Automated Container Creation
**Objective**: Create a new container `test-webui` from scratch on Debian 13/stable, step through confirmation, and verify health.

```bash
# Execute from root or sub-directory
./deploy.sh test-webui
```
**Steps Observed**:
1. Host checks `incus` binary presence.
2. Checks if `test-webui` exists; detects missing container and prompts to launch Debian 13 container (`images:debian/13`).
3. Verifies host port 8080 and configures `webui-proxy`.
4. Probes for Ollama (checks `ollama` container, host port 11434, or prompts) and configures `ollama-link`.
5. Prepares environment in container (`python3`, `python3-pip`, `python3-venv`).
6. Configures `/opt/e-webui/venv`, transfers `app/`, `tests/`, and installs dependencies strictly in venv.
7. Registers and starts `e-webui.service`.
8. Verifies HTTP 200 on `http://127.0.0.1:8080` and displays completion banner.

---

## Scenario 3: Resumability & Idempotent Re-runs
**Objective**: Verify re-running against an already completed container detects full completion.

```bash
./deploy.sh test-webui
```
**Expected Outcome**: Script outputs that all deployment steps are already completed, displays the service status, and exits cleanly.

---

## Scenario 4: Non-Destructive Status Inspection
**Objective**: Inspect container and deployment health without changing state.

```bash
./deploy.sh --status test-webui
```
**Expected Outcome**: Prints container running state, IP address, systemd service status, HTTP health status, and configured Incus proxy devices without executing any mutations.
