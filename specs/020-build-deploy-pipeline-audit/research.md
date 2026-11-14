# Phase 0 Research: Build & Deployment Pipeline Audit

**Feature**: `020-build-deploy-pipeline-audit`  
**Date**: 2026-11-15  
**Status**: Completed  

## 1. Audit Findings: Build & Packaging Pipeline (`./build-release.sh` & sub-scripts)

### Pipeline Architecture
- `./build-release.sh` is a thin root wrapper delegating directly to `scripts/build-release.sh`.
- `scripts/build-release.sh` parses CLI flags (`-o`, `-v`, `--strict`, `--archive-only`, `--dir-only`) and invokes `build_release_package` in `scripts/lib/builder.sh`.
- `scripts/lib/builder.sh` stages the release in `/tmp/e-webui-build-<release-id>.<suffix>`, archives `app/` into `payload/app.tar.gz`, copies `requirements.txt` and `systemd/e-webui.service`, invokes `manifest_tool.py create-manifest`, performs pre-publication self-verification (`validate-manifest`, `verify-checksums`, `verify-archive`), and publishes both uncompressed release directory and compressed `.tar.gz` bundle to `dist/releases/`.

### Newly Added Static Assets & File Layout
We verified that `tar -czf "${app_tar}" ... -C "${src_dir}" app` packages the entire `app/` directory recursively.
Specifically, all newly introduced assets are confirmed included:
- `app/static/vendor/prism.min.js` (Vendored offline syntax highlighter)
- `app/static/vendor/marked.min.js`, `app/static/vendor/dompurify.min.js`
- `app/static/js/presets.js` (System prompt personas & parameter service)
- `app/static/js/db.js` (IndexedDB wrapper)
- `app/static/js/storage.js` (Storage service cascade)
- `app/static/js/export.js` (Markdown & JSON export serializer)
- `app/static/js/components/composer.js`, `chat.js`, `header.js`, `settings.js`, `sidebar.js`
- `app/static/fonts/*` (Offline self-hosted fonts)
- `app/static/img/*` (Offline brand icons & SVG assets)
- `app/static/index.html` & `app/static/style.css`

### Removed Legacy Files Check
- `app/static/app.js` was deleted when modular ES6 components were introduced.
- Cross-codebase audit confirmed that **zero** shell scripts in `scripts/`, `build-release.sh`, or `deploy.sh` reference `app.js` or depend on its presence.
- Build execution on the current workspace succeeded with exit code 0, verifying that no build failure or missing-file warning occurs.

---

## 2. Audit Findings: Container Deployment Pipeline (`./deploy.sh` & sub-scripts)

### Pipeline Architecture
- `./deploy.sh` delegates to `scripts/deploy.sh`.
- `scripts/deploy.sh` supports operations:
  - `--install` (initial container launch, proxy device configuration, OS package installation, release staging, venv provisioning, systemd installation, health check).
  - `--update` (zero-rebuild release switch: stages release, verifies checksums inside container, extracts to `/opt/e-webui/releases/<id>`, links cached venv and shared data, installs systemd unit, atomically switches `current` symlink, restarts service, verifies HTTP health with automatic rollback).
  - `--status`, `--repair`, `--rollback`, `--uninstall`.

### Incus Proxy Configuration & Identified Enhancement
- In `scripts/deploy.sh`:
  - `run_install` calls `configure_proxy_devices "${CONTAINER_NAME}" "${HOST_PORT}" "${OLLAMA_TARGET}"`.
  - **Audit Finding**: `run_update` currently does *not* call `configure_proxy_devices`. If a container was provisioned without proxy devices or if host port / Ollama URL changed during update, the proxy devices are not refreshed.
  - **Remediation**: Add `configure_proxy_devices "${CONTAINER_NAME}" "${HOST_PORT}" "${OLLAMA_TARGET}"` to `run_update` in `scripts/deploy.sh`.
- In `scripts/lib/provision.sh`:
  - `configure_proxy_devices` checks `grep -q "webui-proxy"` and `grep -q "ollama-link"`.
  - **Audit Finding**: If `webui-proxy` already exists, it prints "already configured" without verifying whether the host port matches the requested `${HOST_PORT}` (e.g. if the user specified `-p 9090` instead of `8080`).
  - **Remediation**: Check if the existing device's `listen` setting matches `tcp:127.0.0.1:${host_port}`. If it differs, remove and re-add the device or update it with `incus_cmd config device set`.

### Python Virtual Environment Discovery & Caching
- `scripts/lib/venv.sh` computes `req_hash=$(calculate_requirements_hash requirements.txt)`.
- It isolates venvs at `/opt/e-webui/venvs/py3.11-<hash>`.
- If a compatible venv exists for the hash, it hits the cache and reuses it in $< 0.1\text{s}$.
- If a hash mismatch occurs (e.g., dependencies updated), it provisions a new isolated venv, upgrades pip, installs speech dependencies (torch/kokoro/soundfile), and installs `requirements.txt`.

### Atomic Release Switching & Service Lifecycle
- Extraction is performed into an immutable release directory: `/opt/e-webui/releases/<release-id>`.
- Symlink switch is atomic:
  `cd /opt/e-webui && ln -sfn 'releases/<id>' current_next && mv -Tf current_next current`
- `install_service_unit` pushes `/etc/systemd/system/e-webui.service` with:
  - `WorkingDirectory=/opt/e-webui/current`
  - `ExecStart=/opt/e-webui/current/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port <port>`
  - `Environment="PYTHONPATH=/opt/e-webui/current"`
  - `Environment="OLLAMA_HOST=http://<target>"`
- Service restarts with `systemctl restart e-webui`.
- `verify_http_health` polls `http://127.0.0.1:<port>/api/health` up to 15 times (30 seconds) for HTTP 200.
- Automatic rollback is triggered if health check fails, reverting `current` to the previous release.

---

## 3. Test Suite Audit & Legacy Harness Alignment

### Test Suites Evaluated
1. `tests/test_deploy_lifecycle.py`:
   - 25 comprehensive unit/mock integration tests verifying all lifecycle states (install, update, atomic switch, venv caching, rollback, release pruning, proxy devices).
   - Executed: **25 passed in 91.2s** using `MockIncusState`.
2. `tests/unit/test_release_builder.py`:
   - 3 tests verifying builder outputs, uncompressed directories, archive bundles, and exclusion rules.
   - Executed: **3 passed in 2.5s**.
3. `tests/unit/test_manifest_tool.py`:
   - 10 tests validating manifest creation, schema validation, checksum verification, and archive safety.
   - Executed: **10 passed in 0.1s**.
4. `tests/unit/test_deploy_script.py`:
   - **Audit Finding**: This test file was written for the early 5-step interactive wizard from spec 004/005, prior to spec 008's architecture overhaul. Its mock expected hardcoded interactive stdin strings (`"webui\ny\ny\ny\ny\ny\n"`), causing it to hang when tested against the current `scripts/deploy.sh`.
   - **Remediation**: Update `tests/unit/test_deploy_script.py` to test the actual CLI options of `scripts/deploy.sh` (`--install`, `--update`, `--status`, `--help`, `--version`) using `mock_incus.py` or skip/align with modern syntax.

---

## 4. Strict Constraint Verification: `app/` is Read-Only

- **Verification Result**: No files in `app/` need to be changed for build or deployment to succeed.
  - `app/main.py` defines `version="1.0.0"`.
  - `app/systemd/e-webui.service` is valid.
  - `app/static/` contains all required vendor and module assets.
  - Static file mounting via `FastAPI` handles `app/static/vendor/` cleanly.
- `app/` will remain strictly untouched and read-only.
