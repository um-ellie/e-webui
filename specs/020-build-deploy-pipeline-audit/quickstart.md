# Quickstart: Build & Deployment Pipeline Verification

**Feature**: `020-build-deploy-pipeline-audit`  
**Date**: 2026-11-15  

## Prerequisites
- Working Python 3.10+ environment inside workspace.
- Unit test runner (`python3 -m unittest`).
- Bash 5.0+ shell.

---

## 1. Automated Unit & Mock Integration Tests

Execute the automated test suites that validate release packaging, manifest verification, deploy CLI options, and deployment lifecycle orchestration without connecting to live containers:

```bash
# 1. Test release builder and exclusion logic
python3 -m unittest tests/unit/test_release_builder.py

# 2. Test manifest tool schema validation, checksums, and safety checks
python3 -m unittest tests/unit/test_manifest_tool.py

# 3. Test modern deployment lifecycle manager CLI options
python3 -m unittest tests/unit/test_deploy_script.py

# 4. Test deploy lifecycle manager (all 25 states)
python3 -m unittest tests/test_deploy_lifecycle.py

# 5. Run complete unit test suite
python3 -m unittest discover tests/unit
```

Expected result: All tests pass with zero failures.

---

## 2. Shell Script Syntax Verification

Run strict POSIX/Bash syntax verification across all pipeline scripts:

```bash
bash -n ./build-release.sh ./deploy.sh scripts/build-release.sh scripts/deploy.sh scripts/lib/*.sh
```

Expected result: Zero syntax errors or warnings.

---

## 3. Release Packaging Verification Scenario

Run the release packaging script to produce a verified artifact:

```bash
./build-release.sh -o dist/releases
```

### Verification Checks:
1. Verify exit code is `0`.
2. Inspect `payload/app.tar.gz` in the generated release directory:
   ```bash
   LATEST_DIR=$(ls -td dist/releases/*/ | head -n 1)
   tar -tzf "${LATEST_DIR}payload/app.tar.gz" | grep -E "prism\.min\.js|presets\.js|db\.js|storage\.js|export\.js"
   ```
   Confirm all newly added files are present.
3. Confirm legacy `app/static/app.js` is NOT in the archive:
   ```bash
   tar -tzf "${LATEST_DIR}payload/app.tar.gz" | grep -q "static/app\.js" && echo "ERROR: Stale file found" || echo "CLEAN: No stale app.js"
   ```
4. Verify manifest and checksums:
   ```bash
   python3 scripts/lib/manifest_tool.py validate-manifest "${LATEST_DIR}manifest.json"
   python3 scripts/lib/manifest_tool.py verify-checksums "${LATEST_DIR}checksums.sha256"
   python3 scripts/lib/manifest_tool.py verify-archive "${LATEST_DIR}payload/app.tar.gz"
   ```

---

## 4. Container Deployment Audit Scenario (Manual Execution Hand-Off)

To deploy or update into the live `e-webui-app` container (per Project Constitution Principle I & III):

```bash
# Initial installation into a new or clean container (provisions proxy devices, venv, service)
./deploy.sh --install e-webui-app

# Update existing deployment with newly built release (zero-rebuild, refreshes proxy devices)
./deploy.sh --update e-webui-app

# Specify custom host port (e.g. 9090) if needed
./deploy.sh --update -p 9090 e-webui-app

# Check deployment status and container health
./deploy.sh --status e-webui-app

# Roll back to previous healthy release if necessary
./deploy.sh --rollback e-webui-app
```

---

## 5. Read-Only `app/` Scope Check

Confirm that the application codebase was not altered during build, audit, and packaging tests:

```bash
git diff --stat app/
```
Expected result: No output (zero changes to `app/`).
