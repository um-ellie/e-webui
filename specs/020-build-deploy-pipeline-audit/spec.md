# Feature Specification: Build & Deployment Pipeline Audit

**Feature Branch**: `020-build-deploy-pipeline-audit`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Perform a complete audit of the build and deployment pipeline—specifically `./build-release.sh` (and its sub-scripts), `./deploy.sh` (and its sub-scripts), and everything inside the `scripts/` directory (such as `scripts/lib/*.sh`). Verify that the newly updated version of the application will be built, packaged, synced, and deployed properly into the `e-webui-app` Incus container."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build & Packaging Pipeline Verification (Priority: P1)

As a maintainer preparing an offline release of e-webui, I want the build and packaging script (`./build-release.sh`) to bundle the complete current application code—including newly introduced static assets, database wrappers, presets, vendor scripts, and dependency definitions—into a verified, checksummed, immutable release package, without failing on deleted legacy files or packaging development artifacts.

**Why this priority**: The application cannot be deployed or updated in containers if the release artifact builder fails, omits required assets, includes corrupted paths, or breaks on changed file layouts.

**Independent Test**: Can be verified by running `./build-release.sh -o dist/releases` on the current workspace and verifying that:
1. `payload/app.tar.gz` contains all newly added assets (`app/static/vendor/prism.min.js`, `app/static/js/presets.js`, `app/static/js/db.js`, `app/static/js/storage.js`, `app/static/js/export.js`).
2. Legacy removed files (`app/static/app.js`) do not trigger missing file errors during packaging.
3. Excluded patterns (`.git`, `__pycache__`, `.venv`, `tests/`, `specs/`) are properly omitted.
4. `manifest.json` and `checksums.sha256` pass internal pre-publication validation.

**Acceptance Scenarios**:

1. **Given** the current workspace state with newly added vendor libraries and ES6 modules, **When** `./build-release.sh` is executed, **Then** packaging succeeds with exit code 0, generating both an uncompressed release directory and a compressed `.tar.gz` bundle in the output directory.
2. **Given** a generated release payload, **When** the archive contents of `payload/app.tar.gz` are inspected, **Then** all essential files under `app/` are present, permissions are normalized (`g-w,o-w`), and development artifacts (`.git`, `tests/`, `specs/`, `__pycache__`) are excluded.
3. **Given** that legacy `app/static/app.js` was deleted in favor of ES6 modular components, **When** packaging runs, **Then** no build script reports errors or warnings regarding `app/static/app.js`.
4. **Given** the generated `manifest.json` and `checksums.sha256`, **When** pre-publication self-tests run (`validate-manifest`, `verify-checksums`, `verify-archive`), **Then** all files pass integrity and security verification.

---

### User Story 2 - Container Deployment & Lifecycle Execution (Priority: P2)

As a system operator deploying or updating `e-webui-app` inside an Incus container, I want `./deploy.sh` to stage release packages, verify checksums in container staging, extract code cleanly into isolated release directories, manage Python virtual environments, configure Incus proxy devices, link systemd services, and atomically switch active versions without leaving stale files or broken dependencies.

**Why this priority**: Container updates must be seamless, atomic, and idempotent. A broken deployment script can cause service downtime, stale web assets, or proxy disconnection from Ollama.

**Independent Test**: Can be verified by auditing `scripts/deploy.sh` and its sub-scripts (`scripts/lib/*.sh`), ensuring that:
1. Transfer mechanisms correctly push the full release package into container staging.
2. In-container verification validates SHA-256 checksums and audits archive paths before extraction.
3. Incus proxy device configurations (`webui-proxy` on port 8080 and `ollama-link` on 127.0.0.1:11434) are properly handled and verified.
4. Systemd unit points to the active release symlink (`/opt/e-webui/current`) with appropriate environment variables.
5. All automated unit tests in `tests/test_deploy_lifecycle.py` and `tests/unit/test_release_builder.py` pass.

**Acceptance Scenarios**:

1. **Given** a target container and release package, **When** `./deploy.sh --update` is initiated, **Then** the package is staged in `/opt/e-webui/staging/`, checksums are verified inside the container, and payload files are extracted to `/opt/e-webui/releases/<release-id>`.
2. **Given** a new application version with unchanged `requirements.txt`, **When** the deployment runs, **Then** the system detects matching requirements hash and reuses the compatible cached virtual environment without redundant re-installations.
3. **Given** an update or install operation, **When** Incus network proxy devices are inspected, **Then** `webui-proxy` (host port to container 8080) and `ollama-link` (container to Ollama host) are verified.
4. **Given** a successful release extraction, **When** the active pointer is switched, **Then** `/opt/e-webui/current` points atomically to the new release directory, the systemd unit `e-webui.service` restarts cleanly, and HTTP health checks verify operational readiness.

---

### User Story 3 - Script Defect Remediation & Hardening (Priority: P3)

As an auditor reviewing the deployment scripts, I want all bugs, outdated path assumptions, or missing flags in `build-release.sh`, `deploy.sh`, and `scripts/lib/*.sh` to be fixed directly within the shell scripts while adhering strictly to the constraint that `app/` is 100% read-only.

**Why this priority**: Any logic defects or fragile edge cases in scripts must be remediated without altering the application code itself so that testing reflects the exact state of `app/`.

**Independent Test**: Can be verified by running static analysis, shell linting/dry-runs, and mock lifecycle test suites against all modified scripts in `scripts/` and confirming that zero files in `app/` were modified.

**Acceptance Scenarios**:

1. **Given** an audit of `build-release.sh`, `deploy.sh`, and `scripts/lib/*.sh`, **When** script defects or missing options are identified, **Then** fixes are applied exclusively to files in `scripts/` or `*.sh`.
2. **Given** the strict requirement that `app/` is read-only, **When** script fixes and verification runs conclude, **Then** `git status app/` confirms zero modifications in `app/`.
3. **Given** the mock test suite (`tests/test_deploy_lifecycle.py`, `tests/unit/test_release_builder.py`), **When** executed, **Then** all tests pass with zero errors.

---

### Edge Cases

- **Dirty Working Directory**: If uncommitted changes exist in the workspace, `build-release.sh` should append `-dirty` to the release ID and proceed unless `--strict` is explicitly provided.
- **Missing or Altered Requirements**: If `requirements.txt` changes, `venv.sh` must recognize the hash mismatch and provision a fresh virtual environment tagged by hash.
- **Stale Client Files**: If a client browser or intermediate cache serves old static files, the deployment and HTML structure must ensure that versioned assets and modern ES6 modules load without falling back to deleted files.
- **Incus Proxy Device Re-configuration**: If the host port or target Ollama address changes between deployments, proxy device verification must accommodate or warn appropriately.
- **Rollback on Failed Health Check**: If a newly activated release fails the `/api/health` HTTP check, the deployment manager must automatically revert the `current` symlink to the previous healthy release and restore service.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Build pipeline (`./build-release.sh`) MUST successfully package all application assets located in `app/` into `payload/app.tar.gz`.
- **FR-002**: Build pipeline MUST include all newly added static assets (including `app/static/vendor/prism.min.js`, `app/static/js/presets.js`, `app/static/js/db.js`, `app/static/js/storage.js`, and `app/static/js/export.js`) in the generated archive.
- **FR-003**: Build pipeline MUST properly exclude `.git`, `__pycache__`, `.venv`, `tests/`, and `specs/` from the release payload.
- **FR-004**: Build pipeline MUST NOT depend on or fail due to legacy removed files (such as `app/static/app.js`).
- **FR-005**: Build pipeline MUST generate a valid `manifest.json` and `checksums.sha256` that pass schema and hash verification via `manifest_tool.py`.
- **FR-006**: Deployment manager (`./deploy.sh`) MUST support both fresh installation (`--install`) and zero-rebuild release update (`--update`) into target container `e-webui-app`.
- **FR-007**: Deployment pipeline MUST stage release packages in container staging and verify SHA-256 checksums before unpacking.
- **FR-008**: Deployment pipeline MUST extract application code into an immutable, versioned release directory (`/opt/e-webui/releases/<release-id>`).
- **FR-009**: Deployment pipeline MUST discover or provision a compatible Python virtual environment and link it to `${release_dir}/venv`.
- **FR-010**: Deployment pipeline MUST link persistent shared data (`/opt/e-webui/shared/data`) into `${release_dir}/data`.
- **FR-011**: Deployment pipeline MUST configure Incus proxy devices (`webui-proxy` and `ollama-link`) without breaking existing container connectivity.
- **FR-012**: Deployment pipeline MUST perform an atomic symlink switch (`ln -sfn releases/<id> current_next && mv -Tf current_next current`) to activate new releases.
- **FR-013**: Deployment pipeline MUST restart `e-webui.service` and verify HTTP health endpoint (`/api/health`), automatically rolling back to the previous healthy release if health verification fails.
- **FR-014**: All script fixes MUST be confined to shell scripts (`build-release.sh`, `deploy.sh`, `scripts/`, `scripts/lib/*.sh`); the `app/` directory MUST remain strictly unchanged.

### Key Entities

- **ReleasePackage**: A standardized bundle containing `manifest.json`, `checksums.sha256`, and `payload/` (`app.tar.gz`, `requirements.txt`, `systemd/e-webui.service`).
- **ReleaseManifest**: Metadata document recording `version`, `release_id`, `git` commit details, target OS, and cryptographic checksums of payload components.
- **ContainerEnvironment**: Incus container runtime (`e-webui-app`) with `/opt/e-webui` directory hierarchy (`releases/`, `venvs/`, `shared/`, `staging/`, and `current` symlink).
- **ServiceUnit**: Systemd configuration file (`e-webui.service`) executing Uvicorn with appropriate working directory and environment variables.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `./build-release.sh` produces a valid, verified release artifact bundle in under 10 seconds.
- **SC-002**: 100% of newly added assets under `app/static/` are verified present in the packaged `payload/app.tar.gz`.
- **SC-003**: 100% of existing release builder and deploy lifecycle unit test suites pass successfully.
- **SC-004**: Container update process achieves zero-downtime atomic switching with $< 5\text{s}$ service restart.
- **SC-005**: Verification confirms zero files inside the `app/` directory were modified or touched during the audit and script fix process.

## Assumptions

- The deployment target is an Incus container named `e-webui-app` running Debian 12 or 13.
- The host has standard POSIX shell tools (`bash`, `tar`, `sha256sum`, `python3`).
- Host network connectivity to Ollama container or host proxy is configured via standard Incus bridge devices (`127.0.0.1:11434`).
- Application source files inside `app/` are tested in their current state before any future modifications.
