# Phase 0 Research: Deployment Lifecycle Manager Architecture

**Feature**: `specs/008-deployment-lifecycle-manager/spec.md`  
**Date**: 2026-11-06  
**Status**: Completed  

---

## 1. Modular Architecture & Script Organization

### Decision
Refactor `scripts/deploy.sh` from a single monolithic script into a clean orchestration entry point supported by modular, single-responsibility bash libraries under `scripts/lib/`:
- `scripts/deploy.sh`: Primary CLI parser, roadmap controller, and operation dispatcher.
- `scripts/lib/common.sh`: Logging formatting (INFO/SUCCESS/WARN/ERROR), color codes, exit trap management.
- `scripts/lib/lock.sh`: Container-side exclusive lock acquisition and release.
- `scripts/lib/incus.sh`: Safe, wrapped Incus CLI operations (`incus exec`, `file push`, `config device`). Supports mock redirection for testing.
- `scripts/lib/detect.sh`: Container status detection, ownership verification, legacy structure identification.
- `scripts/lib/archive.sh`: Host-side release packaging, exclusion filtering, SHA-256 calculation, and integrity verification.
- `scripts/lib/venv.sh`: Requirements hashing, venv discovery, caching, and isolated pip installation.
- `scripts/lib/service.sh`: Systemd unit templating, installation, reload, and service lifecycle management.
- `scripts/lib/health.sh`: Service active-state checks and HTTP readiness polling (`/api/health`).
- `scripts/lib/rollback.sh`: Automatic failure detection, diagnostic log capture, and atomic pointer reversal.
- `scripts/lib/migrate.sh`: Non-destructive migration of legacy flat installations (`STEP_*`) to the versioned release layout.

### Rationale
- **Testability**: Individual components (e.g., checksum validation, archive exclusion, venv hashing) can be tested in isolation with mock runners.
- **Maintainability**: Lowers cognitive load and avoids a fragile 1000+ line single script.
- **Direct Alignment with Phased Roadmap**: Matches the user's recommended 8-stage rollout.

### Alternatives Considered
- *Keep monolithic `deploy.sh`*: Leads to duplicate code paths, fragile regexes, and high risk of regressions across installation vs. update modes.
- *Rewrite in Python*: While Python is powerful, Bash is the primary DevOps interface on host systems where Python dependencies outside the container may vary. Bash with standard utilities (`tar`, `sha256sum`, `awk`) ensures zero host prerequisite overhead.

---

## 2. Release Isolation & Stable Virtual Environment Linking

### Decision
Each release extracted into `/opt/e-webui/releases/<release-id>/` contains a symlink pointing to the shared virtual environment:
```text
/opt/e-webui/
├── current -> releases/<release-id>
├── releases/
│   ├── <release-id>/
│   │   ├── app/
│   │   ├── requirements.txt
│   │   ├── data -> /opt/e-webui/shared/data
│   │   └── venv -> /opt/e-webui/venvs/<hash>
├── venvs/
│   └── <hash>/
```
The systemd service unit defines:
```ini
WorkingDirectory=/opt/e-webui/current
ExecStart=/opt/e-webui/current/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080
```

### Rationale
- When `current` is atomically switched, `current/venv` automatically points to the new release's virtual environment.
- The systemd unit **never needs to be edited or reloaded** during routine updates or rollbacks, even when Python packages change.
- Decouples virtualenv lifecycle from code release lifecycle while guaranteeing that every release always runs with its exact dependency set.

### Alternatives Considered
- *Updating systemd unit file with `/opt/e-webui/venvs/<hash>/bin/uvicorn` on each update*: Requires `systemctl daemon-reload` on every deployment, increases failure surface, and makes instant rollback complex.
- *Single shared venv in `/opt/e-webui/venv`*: Overwriting packages during update breaks rollback capabilities if the new release fails.

---

## 3. Atomic Release Switching Mechanism

### Decision
Switch releases inside the container using an atomic symlink swap:
```bash
ln -sfn "releases/${RELEASE_ID}" "${APP_DIR}/current_next"
mv -Tf "${APP_DIR}/current_next" "${APP_DIR}/current"
```

### Rationale
- In Linux/POSIX, `mv -T` (rename) is an atomic syscall (`rename(2)`).
- Ensures that `/opt/e-webui/current` is never in a half-written, non-existent, or dangling state.
- If the host or container crashes mid-deployment, `current` remains valid pointing to the previous healthy release.

### Alternatives Considered
- `rm current && ln -s ...`: Introduces a race condition window where `current` does not exist.
- Direct `ln -sf`: Not atomic for directories on many Linux distributions (creates a symlink inside the target directory if it already exists).

---

## 4. Persistent Storage & Configuration Decoupling

### Decision
Persistent state resides strictly in `/opt/e-webui/shared/`:
- `shared/.env`: runtime application configuration and secret overrides.
- `shared/data/`: application SQLite databases, session files, or uploads.
- `deployment.env`: host-level deployment variables (port, Ollama URL).
The systemd unit includes:
```ini
EnvironmentFile=-/opt/e-webui/deployment.env
EnvironmentFile=-/opt/e-webui/shared/.env
```
And each release directory contains a symlink `releases/<release-id>/data -> /opt/e-webui/shared/data`.

### Rationale
- Completely isolates transient release files from permanent user state.
- Any release can be discarded or rolled back without touching user databases or configs.
- Uninstallation preserves `shared/` by default.

---

## 5. Concurrency Protection (Deployment Locking)

### Decision
Acquire an exclusive lock inside the container using an atomic directory lock at `/opt/e-webui/.deploy.lock`:
```bash
if ! run_in_container mkdir "${APP_DIR}/.deploy.lock" 2>/dev/null; then
    # Check if stale or active
    error "Another deployment operation is currently in progress on container '${CONTAINER_NAME}'."
    exit 2
fi
```
An exit trap (`trap 'run_in_container rmdir "${APP_DIR}/.deploy.lock" 2>/dev/null || true' EXIT INT TERM`) ensures the lock is released on normal or abnormal termination.

### Rationale
- `mkdir` is an atomic system call in POSIX.
- Works across all Linux kernels and Incus container configurations without requiring external locking daemons or background processes.

---

## 6. Legacy Migration Procedure

### Decision
Detect legacy deployments when:
- Container exists and has `/opt/e-webui/.deploy_state` containing `STEP_0_...` or `STEP_5_...`.
- `/opt/e-webui/venv` exists.
- `/opt/e-webui/releases/` does NOT exist.

Migration steps:
1. Stop `e-webui.service`.
2. Create directories: `releases/`, `venvs/`, `shared/data/`, `staging/`.
3. Compute SHA-256 hash of existing `/opt/e-webui/requirements.txt`.
4. Move `/opt/e-webui/venv` to `/opt/e-webui/venvs/<hash>/`.
5. Create `/opt/e-webui/releases/legacy-initial/`.
6. Move existing `/opt/e-webui/app` and `/opt/e-webui/requirements.txt` into `releases/legacy-initial/`.
7. Link `releases/legacy-initial/venv -> /opt/e-webui/venvs/<hash>`.
8. Link `releases/legacy-initial/data -> /opt/e-webui/shared/data`.
9. Atomically point `/opt/e-webui/current -> releases/legacy-initial`.
10. Update systemd unit to reference `current/venv/bin/uvicorn` and reload daemon.
11. Initialize new JSON `.deploy_state`.
12. Restart service and verify health.

### Rationale
- Zero downtime risk: No container destruction, no OS reinstall, no package redownload.
- Retains existing running state seamlessly while immediately unlocking release-based updates.

---

## 7. Constitution & Verification Strategy

### Decision
All agent development, refactoring, and static verification occur strictly within the workspace.
- Unit and contract tests will run locally with `pytest` in `tests/test_deploy_lifecycle.py`.
- A mocked Incus runner stub will simulate `incus` CLI subcommands (`info`, `exec`, `file push`, `config device`) to test detection, packaging, checksum verification, locking, and rollback transitions without touching live host container infrastructure.
- Real container deployment and manual verification will be handed over to the human operator with clear execution instructions.
