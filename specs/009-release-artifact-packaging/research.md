# Research & Architectural Decisions: Release Artifact Specification & Packaging System

**Feature**: `009-release-artifact-packaging`  
**Date**: 2026-11-06  
**Status**: Completed  

---

## 1. Release Builder Architecture & Tooling Strategy

### Decision
Implement the Release Builder as a CLI script `scripts/build-release.sh` (with a root-level convenience wrapper `build-release.sh` if desired) supported by:
1. `scripts/lib/builder.sh`: Bash wrapper handling CLI flags, temporary directory lifecycles, tar archive creation, and execution hooks.
2. `scripts/lib/manifest_tool.py`: Python 3 standard library utility responsible for JSON schema validation, manifest serialization, SHA-256 calculation, and tar member safety inspection.

### Rationale
- **Zero External Dependencies**: Python standard library modules (`json`, `hashlib`, `tarfile`, `pathlib`, `datetime`, `argparse`, `sys`, `os`) provide robust, platform-independent JSON generation, ISO-8601 formatting, and SHA-256 calculations without requiring `jq`, `openssl`, or external Python packages (`pydantic`, `jsonschema`).
- **Consistent Project Conventions**: Preserves the established architectural pattern from `008-deployment-lifecycle-manager` where bash orchestrates workflows and Python handles structured state and data contracts.
- **Fail-Safe Cleanup**: Shell traps (`trap cleanup EXIT`) ensure temporary directories (`/tmp/e-webui-build.XXXXXX`) are immediately eradicated if any step fails.

### Alternatives Considered
- *Pure Bash with `jq` and `sha256sum`*: Rejected because `jq` is not guaranteed on all development/minimal environments, and safely formatting complex JSON structures in shell is brittle.
- *Pure Python CLI (e.g. `python -m app.builder`)*: Rejected because the packaging builder operates on the repository before runtime, and using bash matches the operational style of `deploy.sh`.

---

## 2. Release Distribution Packaging Format

### Decision
The Release Builder generates two outputs per release:
1. An uncompressed release directory: `dist/releases/<release-id>/`
2. A single compressed release bundle archive: `dist/releases/e-webui-<version>-<release-id>.tar.gz`

The Deployment Manager (`deploy.sh`) will accept either format:
- `./deploy.sh --release dist/releases/e-webui-1.0.0-20261106-213000-a1b2c3d4.tar.gz`
- `./deploy.sh --release dist/releases/20261106-213000-a1b2c3d4/`
- `./deploy.sh` (auto-discovers the newest valid package in `dist/releases/`)

### Rationale
- The single compressed bundle is standard for CI/CD pipelines, artifact repositories, and remote server transfers.
- The uncompressed directory enables rapid local validation and debugging without double-compression latency.
- Accepting both in `deploy.sh` maximizes operational convenience without breaking the contract.

### Alternatives Considered
- *Only compressed tarball*: Slightly simpler for `deploy.sh`, but requires unneeded decompression overhead during local developer testing.
- *Only directory*: Fails standard CI/CD distribution expectations where artifacts are single downloadable files.

---

## 3. Archive Safety and Path Traversal Protection

### Decision
All archives (`payload/app.tar.gz` and top-level bundle `e-webui-*.tar.gz`) undergo mandatory member path validation prior to extraction on both host and inside the Incus container staging environment.

### Rules & Validation Logic
1. **Forbidden Path Patterns**:
   - Members with absolute paths (e.g., `/etc/passwd`).
   - Members containing parent directory references (e.g., `../../etc/shadow`).
   - Members containing backslashes or unexpected control characters.
2. **Symlink Inspection**:
   - Symlinks whose targets resolve outside the extraction root are strictly forbidden.
   - Hard links pointing outside the archive are forbidden.
3. **Execution**:
   - Validated via `manifest_tool.py verify-archive <tar_path>` or `tar -tzf <tar_path>` before executing `tar -xzf`.

### Rationale
Completely mitigates "Zip Slip" vulnerabilities and malicious archive injection attacks before bytes are written to the target filesystem.

---

## 4. Manifest Schema and Provenance Model

### Decision
The manifest schema version is `1.0.0`. It uses strict Semantic Versioning (`MAJOR.MINOR.PATCH`).
The manifest format separates:
- Application version (`version`): e.g. `"1.0.0"`
- Release build identifier (`release_id`): e.g. `"20261106-213000-a1b2c3d4"`
- Manifest schema version (`schema_version`): e.g. `"1.0.0"`
- Minimum Deployment Manager version (`compatibility.min_deployment_manager_version`): e.g. `"1.0.0"`

### Validation Rules
- `schema_version` must match `^1\.[0-9]+\.[0-9]+$`. A manager at `1.x` will reject schema `2.x`.
- Every artifact in `artifacts[]` must have a corresponding file on disk with matching `sha256` and `size_bytes`.
- `checksums.sha256` must verify 100% against all files.

---

## 5. Deployment Manager Integration & Source Independence

### Decision
`deploy.sh` completely deprecates host source packaging (`build_release_archive` inside `deploy.sh`).
When `deploy.sh` is executed:
1. It resolves the release candidate via `--release <path>` or `dist/releases/`.
2. If no release exists, it halts with error code 2 and prompts the user:
   ```text
   [ERROR] No valid release package found.
   Run './scripts/build-release.sh' to package a release, or specify '--release <path>'.
   ```
3. It performs host pre-flight verification on the package.
4. It transfers the release package into `/opt/e-webui/staging/`.
5. It extracts the release safely into `/opt/e-webui/releases/<release-id>/`.
6. It preserves `manifest.json` and `checksums.sha256` inside the release directory for future audits and status commands.
7. It reads `requirements.txt` from the release payload to calculate `req_hash` and link `venv`.

### Rationale
Ensures `deploy.sh` has zero knowledge of the git repository or local source code files, transforming it into a pure consumer of standardized releases.
