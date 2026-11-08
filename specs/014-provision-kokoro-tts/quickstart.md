# Quickstart & Verification Guide: Kokoro-82M TTS Deployment Provisioning

**Branch**: `014-provision-kokoro-tts` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md) | **Contracts**: [CLI](contracts/deploy-cli-contract.md), [TTS Env](contracts/tts-environment-contract.md)

This guide provides step-by-step verification procedures for operators to validate all aspects of the Kokoro-82M TTS deployment provisioning on Incus containers, as well as developer instructions for running isolated unit and mock tests locally in the workspace.

---

## Developer Testing: Workspace Isolation (Mock Harness)

Per the **e-webui Constitution (Principle I)**, automated tests must execute locally without touching real container APIs.

Run the test suite using Python:

```bash
python3 -m unittest tests/test_deploy_lifecycle.py -v
```

All mock tests verify container lifecycle orchestration, standalone python acquisition, dependency installation, model download retry logic, and atomic release switching using `tests/mock_incus.py`.

---

## Operator Validation Scenarios (Live Host)

The following scenarios are executed by the operator on the container host system.

### Scenario 1: Clean Installation with Automated TTS Provisioning (Priority: P1)

1. **Build a fresh release bundle** (or verify existing in `dist/releases/`):
   ```bash
   ./scripts/build-release.sh
   ```

2. **Run initial container installation**:
   ```bash
   ./scripts/deploy.sh --install -y
   ```

3. **Verify outcome**:
   - The deployment manager creates/starts `e-webui-app` (Debian 13).
   - System packages `espeak-ng`, `espeak-ng-data`, and `libsndfile1` are installed.
   - Standalone Python 3.11 is provisioned in `/opt/e-webui/interpreters/python-3.11/`.
   - The virtual environment is provisioned with CPU-only PyTorch and Kokoro.
   - Model weights `kokoro-v0_19.pth` and voice files are placed in `/opt/e-webui/shared/models/kokoro/`.
   - The service is active and `curl http://127.0.0.1:8080/api/health` returns `200`.

---

### Scenario 2: Seamless Migration of Existing Python 3.13 Deployment (Priority: P1)

1. **Check current state of existing deployment**:
   ```bash
   ./scripts/deploy.sh --status
   ```
   *(Note if Python was previously reported as 3.13.5)*

2. **Trigger update**:
   ```bash
   ./scripts/deploy.sh --update -y
   ```

3. **Verify outcome**:
   - The tool detects the incompatible interpreter version.
   - Automatically installs standalone Python 3.11.
   - Rebuilds the release virtual environment without altering OS packages.
   - Atomically switches release symlink.
   - The active web service switches over cleanly with zero downtime.

---

### Scenario 3: Resilient Deployment Under Blocked Network (Priority: P2)

1. **Simulate network block by providing unreachable model mirror**:
   ```bash
   HF_ENDPOINT="http://192.0.2.1:1" ./scripts/deploy.sh --update -y
   ```

2. **Verify outcome**:
   - Package installation proceeds.
   - Model download times out or fails connection.
   - The deployment manager logs:
     ```text
     [WARN] Kokoro model download failed due to network unavailability.
     [INFO] The core application is running normally.
     [INFO] You can retry downloading model weights at any time with:
     [INFO]   ./scripts/deploy.sh --download-model
     ```
   - Script exits with **code 0** (Success).
   - Core chat service is running healthy.

---

### Scenario 4: Dedicated Model Download on Demand (Priority: P2)

1. **Fetch missing model weights without redeploying code**:
   ```bash
   ./scripts/deploy.sh --download-model
   ```

2. **Verify outcome**:
   - Downloads `kokoro-v0_19.pth` and voice files into `/opt/e-webui/shared/models/kokoro/`.
   - Re-running the command immediately reports:
     ```text
     [SUCCESS] Kokoro-82M model weights already present and verified.
     ```
   - Completed in under 1 second without restarting the active service.

---

### Scenario 5: Rapid Code Update Bypassing Model Check (Priority: P2)

1. **Deploy a quick code change**:
   ```bash
   ./scripts/deploy.sh --update --skip-model-download -y
   ```

2. **Verify outcome**:
   - Release switches atomically without touching or scanning model files.

---

### Scenario 6: Status & Self-Healing Repair (Priority: P3)

1. **Inspect status report**:
   ```bash
   ./scripts/deploy.sh --status
   ```
   Inspect the Text-to-Speech section:
   - Application Python: Python 3.11.x
   - System OS Python: Python 3.13.x
   - Python TTS Packages: OK
   - Kokoro-82M Weights: PRESENT

2. **Trigger repair**:
   ```bash
   ./scripts/deploy.sh --repair
   ```
   Verifies that all prerequisites, symlinks, environments, and model files are re-checked and healed.
