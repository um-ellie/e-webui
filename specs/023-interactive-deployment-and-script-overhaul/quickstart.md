# Quickstart Validation Guide: Interactive Deployment & Control Center

**Feature**: Interactive Deployment & Script Modernization Overhaul  
**Date**: 2026-11-20  
**Status**: Completed  

---

## 1. Prerequisites

- Linux host operating system (Ubuntu 22.04+, Debian 12+, Arch, Fedora, etc.)
- Incus container runtime installed and user added to `incus-admin` group:
  ```bash
  incus version
  ```
- Optional: Running Ollama container or local host Ollama instance (`http://127.0.0.1:11434`)

---

## 2. Interactive Terminal Control Center Validation

### Step 1: Launch Interactive Mode
From the workspace root, run:
```bash
./ctl
# or
./deploy.sh
```

**Expected Outcome**:
- An ANSI color dashboard appears instantly displaying live container status, service state, active release, and port forwarding.
- An interactive menu with options `[0-9]` is presented.

### Step 2: One-Click Smart Update
From the interactive menu:
1. Press `1` and hit `Enter` (or run `./ctl --update`).
2. If uncommitted workspace changes exist in `app/`, the tool prompts for auto-packaging confirmation.
3. Confirm with `Y`.

**Expected Outcome**:
- Automatic packaging progress is displayed.
- The release is transferred, virtualenv cache is evaluated, atomic symlink is switched, and service is restarted.
- HTTP health check passes with `HTTP 200`.

### Step 3: Stream Live Logs
From the interactive menu:
1. Press `4` and hit `Enter`.

**Expected Outcome**:
- Real-time `journalctl` stream appears for `e-webui.service`.
- Pressing `Ctrl+C` cleanly returns to the main control menu without aborting the session.

---

## 3. Custom Port Deployment Validation

To verify the port decoupling fix:
```bash
./deploy.sh --install -p 9090 webui-test-port
```

**Validation Checks**:
1. Verify Incus device mapping:
   ```bash
   incus config device show webui-test-port
   ```
   *Expected*: `listen=tcp:127.0.0.1:9090 connect=tcp:127.0.0.1:8080`.
2. Verify container service listener:
   ```bash
   incus exec webui-test-port -- ss -tlnp
   ```
   *Expected*: Uvicorn is bound to port `8080` inside container.
3. Verify host browser access:
   ```bash
   curl -I http://127.0.0.1:9090/api/health
   ```
   *Expected*: `HTTP/1.1 200 OK`.

---

## 4. Local Test Suite Validation

To verify that tests can be executed without real Incus containers:
```bash
# Run all unit tests locally
./scripts/test.sh --local
```

**Expected Outcome**:
- All unit tests run against local mock harnesses conforming to Constitution Principle I.
- 100% of unit tests pass with zero container access required.

---

## 5. Self-Healing Concurrency Lock Validation

To simulate and verify recovery from an interrupted deployment:
```bash
# Artificially create a stale lock inside the container
incus exec webui -- mkdir -p /opt/e-webui/.deploy.lock
incus exec webui -- sh -c 'echo "pid=999999;time=2020-01-01T00:00:00Z;user=test" > /opt/e-webui/.deploy.lock/info'

# Run deploy status or update
./ctl --status
```

**Expected Outcome**:
- The tool detects the expired/stale lock and prompts to reclaim it or automatically clears it in `--reset` mode.
- Deployment operations proceed smoothly without deadlock.
