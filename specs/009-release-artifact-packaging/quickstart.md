# Quickstart Validation Guide: Release Artifact Packaging System

**Feature**: `009-release-artifact-packaging`  
**Date**: 2026-11-06  
**Status**: Ready for Implementation  

This guide details step-by-step procedures to validate the Release Builder, release artifact integrity, and the Deployment Manager consumer contract. All tests comply strictly with **Constitution Principle I (Infrastructure Isolation)** and execute locally within the workspace repository.

---

## Prerequisites

1. Python 3.11+ available on host.
2. Standard coreutils (`tar`, `gzip`, `sha256sum`, `bash`).
3. Repository virtual environment with test dependencies installed (`pytest`, `httpx`, `fastapi`).

---

## Scenario 1: Build a Clean Production Release

### Objective
Verify that `scripts/build-release.sh` packages the workspace into a valid, verifiable release package adhering to the [Manifest Schema](contracts/manifest-schema.json).

### Steps
```bash
# 1. Execute the release builder
./scripts/build-release.sh

# 2. Verify publication outputs in dist/releases/
ls -la dist/releases/

# 3. Locate the generated release directory
LATEST_REL=$(ls -td dist/releases/*/ | head -n 1)
echo "Inspecting release: ${LATEST_REL}"

# 4. Verify presence of required contract files
test -f "${LATEST_REL}/manifest.json" && echo "manifest.json exists"
test -f "${LATEST_REL}/checksums.sha256" && echo "checksums.sha256 exists"
test -f "${LATEST_REL}/payload/app.tar.gz" && echo "app.tar.gz exists"
test -f "${LATEST_REL}/payload/requirements.txt" && echo "requirements.txt exists"
test -f "${LATEST_REL}/payload/systemd/e-webui.service" && echo "e-webui.service exists"

# 5. Verify checksums match exactly
cd "${LATEST_REL}"
sha256sum -c checksums.sha256
cd -
```

### Expected Outcome
- The script exits with code `0`.
- Both `dist/releases/<release-id>/` and `dist/releases/e-webui-<version>-<release_id>.tar.gz` are produced.
- `sha256sum -c` returns `OK` for all items.

---

## Scenario 2: Validate Strict Exclusion of Secrets & Dev Artifacts

### Objective
Ensure that `.git/`, `.env`, virtualenvs, test caches, and specifications are strictly excluded from the release archive.

### Steps
```bash
# Create a dummy secret and cache before building
touch .env.secret_test
mkdir -p __pycache__ && touch __pycache__/dummy.pyc

# Build release
./scripts/build-release.sh

# Inspect contents of payload/app.tar.gz
LATEST_REL=$(ls -td dist/releases/*/ | head -n 1)
tar -tzf "${LATEST_REL}/payload/app.tar.gz" > /tmp/tar_contents.txt

# Assert forbidden patterns do NOT appear in archive
! grep -E "(\.git|\.env|venv|__pycache__|\.pytest_cache|specs|\.specify|tests)" /tmp/tar_contents.txt
echo "Exclusion assertion passed!"

# Clean up temporary test files
rm -f .env.secret_test
```

### Expected Outcome
- None of the forbidden paths or secrets appear in the tarball table of contents.

---

## Scenario 3: Verify Pre-Flight Rejection on Tampered Checksum

### Objective
Verify that `deploy.sh` detects tampered artifacts on the host and refuses deployment before touching container state.

### Steps
```bash
LATEST_REL=$(ls -td dist/releases/*/ | head -n 1)

# Deliberately modify an artifact without updating checksums
echo "# tampered" >> "${LATEST_REL}/payload/requirements.txt"

# Attempt to deploy with tampered release
./deploy.sh --update --release "${LATEST_REL}"
DEPLOY_EXIT=$?

# Verify exit code indicates rejection
if [ "${DEPLOY_EXIT}" -ne 0 ]; then
    echo "Deployment correctly rejected tampered release (exit code: ${DEPLOY_EXIT})"
fi
```

### Expected Outcome
- `deploy.sh` halts with exit code `2` or `3`.
- An error message identifying the checksum mismatch is displayed.
- The active container release remains completely unchanged.

---

## Scenario 4: Run Automated Unit and Mock Integration Tests

### Objective
Execute the mock harness test suite verifying the end-to-end builder and consumer lifecycle locally without live Incus containers.

### Steps
```bash
# Run isolated unit tests for builder and deployment manager
pytest tests/unit/ -v

# Run lifecycle mock integration tests
pytest tests/test_deploy_lifecycle.py -v
```

### Expected Outcome
- All tests pass with 100% green status.
- Zero interactions with real Incus containers (Infrastructure Isolation preserved).
