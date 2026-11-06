# Feature Specification: Release Artifact Specification and Packaging System

**Feature Branch**: `009-release-artifact-packaging`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Design a standardized, versioned, and verifiable Release Artifact format for the e-webui application. The purpose of this feature is to establish a formal contract between the application's release packaging process and the existing deploy.sh Deployment Manager. The Deployment Manager must not need to inspect the source repository, guess which files should be deployed, or construct application packages by independently selecting project files. Instead, it must consume a well-defined Release package containing all required deployment artifacts and metadata."

---

## 1. Feature Overview & Motivation

### Background & Motivation
In the current deployment implementation (`specs/008-deployment-lifecycle-manager`), the Deployment Manager (`deploy.sh`) performs release packaging directly on the host during deployment execution:
1. It inspects `${REPO_ROOT}`, hardcodes tar exclusion patterns, and packs `app/` and `requirements.txt` into an ad-hoc temporary tarball in `/tmp`.
2. It generates a transient release identifier using only the host's current wall-clock time (`generate_release_id`).
3. It has no formal manifest or code provenance metadata (e.g., git commit, semantic version, build timestamp, manifest schema version, artifact inventory, minimum manager version).
4. The deployment process is tightly coupled to the local developer workspace tree, making offline deployments, reproducible builds, pre-flight artifact auditing, and CI/CD distribution difficult and fragile.

### Core Objectives
1. **Decouple Packaging from Deployment**: Introduce an independent, reproducible Release Packaging process (e.g., `build-release.sh`) governed by a formal Release Artifact Contract.
2. **Explicit Artifact Contract**: A Release is a self-contained, verifiable, and immutable package containing application assets, dependency manifests, system service units, and machine-readable metadata.
3. **Consumer Contract for `deploy.sh`**: The Deployment Manager ceases to assemble code packages from source; it strictly consumes, validates, transfers, and activates pre-built Release packages.
4. **End-to-End Verifiability & Integrity**: Comprehensive SHA-256 integrity verification across all release components before any container modifications occur, with strict protections against path traversal and payload corruption.
5. **Architectural Continuity**: Full compatibility with the Incus-based zero-rebuild release management, virtual environment caching by dependency hash, atomic symlink switching (`current`), persistent state preservation (`shared/`), and automated rollback.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Deploying a Verified Release Package (Priority: P1)

As a DevOps engineer or system administrator, I want `deploy.sh` to consume a pre-packaged, validated Release artifact containing a manifest and checksums, so that production deployments are reproducible, verifiable, and completely decoupled from host source tree state.

**Why this priority**: Core architectural objective. Eliminates ad-hoc runtime packaging by the deployment manager and guarantees deterministic, audited code deployments.

**Independent Test**: Can be tested by generating a release package using the builder tool, pointing `deploy.sh` to the generated release via `--release <path>`, and verifying that `deploy.sh` validates manifest and checksums, transfers the artifacts into container staging, provisions dependencies, and activates the release without touching host source directories.

**Acceptance Scenarios**:

1. **Given** a valid release package exists at `dist/releases/e-webui-1.0.0-20261106-213000/` or archive `.tar.gz`, **When** the operator runs `./deploy.sh --update --release dist/releases/e-webui-1.0.0-20261106-213000/`, **Then** `deploy.sh` validates the release manifest and checksums, installs or updates the application using the package contents, and verifies health.
2. **Given** no release argument is specified and a `dist/releases/` directory contains published releases, **When** `./deploy.sh` runs, **Then** it automatically discovers the most recent valid published release package and proceeds with deployment.
3. **Given** a release is successfully activated, **When** the operator queries `./deploy.sh --status`, **Then** the output displays the application version, release ID, build timestamp, and Git commit SHA recorded in the release manifest.

---

### User Story 2 - Automated and Reproducible Release Packaging (Priority: P1)

As a developer or CI/CD workflow, I want a dedicated release packaging command that inspects source files, excludes secrets and development artifacts, packages runtime code and systemd units, computes checksums, and produces an atomic, self-contained release bundle with a signed/validated manifest.

**Why this priority**: Essential companion to P1; provides the formal builder that emits packages adhering to the Release Artifact Contract.

**Independent Test**: Can be tested by running the release builder script on the workspace repository: verify that output release directory/bundle contains `manifest.json`, `checksums.sha256`, and `payload/`, contains no excluded files (`.git`, `.env`, `tests/`), and passes full validation.

**Acceptance Scenarios**:

1. **Given** a clean workspace repository with application code, **When** the release builder executes, **Then** it generates a release package with unique release identifier, semantic version, git commit hash, artifact inventory, and SHA-256 checksums.
2. **Given** local configuration files (`.env`, `.env.local`), test caches, git metadata, or virtual environments exist in the repository, **When** the release builder runs, **Then** none of these excluded paths are packaged into the release artifacts.
3. **Given** an error occurs during packaging (e.g., missing mandatory source file or syntax error), **When** packaging aborts, **Then** all temporary staging directories are cleaned up and no incomplete or corrupt release is published.

---

### User Story 3 - Pre-Flight Rejection of Corrupt or Malicious Releases (Priority: P2)

As a security-conscious operator, I want the Deployment Manager to reject any release package that has mismatched checksums, unauthorized paths, directory traversal payloads, or unsupported schema versions before modifying any active system state.

**Why this priority**: Guarantees integrity and security. Prevents deploying corrupted archives, partial updates, or malicious archives containing path traversal exploits.

**Independent Test**: Can be tested by attempting deployment of: (a) a release with a tampered file, (b) an archive containing `../` relative paths, and (c) a manifest with an incompatible `schema_version`: verify that `deploy.sh` fails with descriptive errors and leaves the active release completely untouched.

**Acceptance Scenarios**:

1. **Given** a release package where a payload file was altered after manifest generation, **When** `./deploy.sh` validates the release, **Then** it detects the SHA-256 mismatch, halts with exit code 2/3, logs the corrupt artifact name, and leaves the active deployment intact.
2. **Given** a release package containing an archive with directory traversal sequences (e.g. `../../etc/shadow`), **When** `./deploy.sh` validates the archive prior to extraction, **Then** it rejects the archive as unsafe and aborts execution immediately.
3. **Given** a release manifest specifying an unsupported major schema version (e.g., schema `2.0.0` when manager only supports `1.x`), **When** `./deploy.sh` parses the manifest, **Then** it halts with an error explaining the schema incompatibility and required manager version.

---

### User Story 4 - Seamless Rollback and History Retention (Priority: P2)

As a site reliability engineer, I want release manifests to be retained alongside deployed releases inside the container, so that rollbacks restore both the application code and full provenance metadata, and status commands report historical release details accurately.

**Why this priority**: Maintains operational continuity and auditability across rollbacks and historical inspections.

**Independent Test**: Can be tested by deploying release A, then deploying release B which fails health checks: verify that automatic rollback cleanly reinstates release A, and `./deploy.sh --status` reports release A's manifest metadata.

**Acceptance Scenarios**:

1. **Given** a release is deployed into `/opt/e-webui/releases/<release-id>/`, **When** the release is extracted, **Then** its `manifest.json` and `checksums.sha256` are archived in the release directory.
2. **Given** an automatic rollback occurs after health failure, **When** the rollback restores the previous healthy release, **Then** the previous release's manifest metadata is reflected as active in `.deploy_state`.

---

### Edge Cases

- **Missing Release Directory**: What happens if the operator runs `./deploy.sh` but no release package exists in `dist/releases/` and no `--release` argument is provided?
  - `deploy.sh` aborts with exit code 2, outputting a clear error: `No release packages found in 'dist/releases/'. Please build a release using './scripts/build-release.sh' or specify '--release <path>'`.
- **Manifest / Checksums Desynchronization**: What happens if `manifest.json` specifies a checksum that does not match `checksums.sha256`?
  - `deploy.sh` cross-checks `manifest.json` checksums against `checksums.sha256`. Any discrepancy causes pre-flight rejection.
- **Untracked / Dirty Git State During Release Build**: What happens if the release builder runs with uncommitted changes or untracked files?
  - The builder checks git status. If dirty, it flags the release manifest with `"git_dirty": true` and appends a `-dirty` suffix to the build identifier (or refuses build if `--strict` is enabled).
- **Symlink Attacks in Archives**: What happens if an archive in `payload/` contains a symlink pointing to an absolute path (e.g. `/etc/passwd`)?
  - Pre-extraction inspection scans all archive members. Any member that is a symlink with an absolute target or traversing relative target (`../`) triggers immediate extraction abort.
- **Concurrent Deployment Invocations**: What happens if two deployment processes attempt to deploy releases simultaneously?
  - Existing `/opt/e-webui/.deploy.lock` mechanism blocks concurrent runs; the secondary process exits with code 2.

---

## 3. Proposed Release Directory Structure

A Release package can be represented as an uncompressed directory or a compressed bundle (`.tar.gz`). Both representations follow identical internal organization.

### Directory Layout

```text
e-webui-<version>-<release_id>/
├── manifest.json
├── checksums.sha256
└── payload/
    ├── app.tar.gz
    ├── requirements.txt
    └── systemd/
        └── e-webui.service
```

### Component Details

| Path | Required | Format | Purpose |
|------|----------|--------|---------|
| `manifest.json` | **Yes** | JSON (UTF-8) | Authoritative release metadata, schema version, compatibility requirements, and artifact inventory. |
| `checksums.sha256` | **Yes** | Plain text (standard sha256sum) | Checksum list for `manifest.json` and all files under `payload/`. |
| `payload/` | **Yes** | Directory | Encapsulates all deployable assets. |
| `payload/app.tar.gz` | **Yes** | POSIX tar archive (gzip compressed) | Complete runtime application source code (`app/` tree). |
| `payload/requirements.txt` | **Yes** | Plain text | Exact Python dependency declarations used to resolve/cache the virtual environment. |
| `payload/systemd/e-webui.service` | **Yes** | Plain text systemd unit | Canonical systemd service unit template for the application. |

### Archive Distribution Format
When distributed as a single file, the entire directory above is packaged as:
`dist/releases/e-webui-<version>-<release_id>.tar.gz`
where the top-level directory inside the archive is `e-webui-<version>-<release_id>/` (or unpackaged root).

---

## 4. Formal Manifest Specification

### Format & Syntax
The manifest MUST be valid UTF-8 JSON. It MUST NOT contain executable code, shell expressions, environment variable expansions, or arbitrary command definitions. It is strictly a declarative data dictionary.

### JSON Schema (Draft 7 / 2020-12 Equivalent)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EWebUIReleaseManifest",
  "type": "object",
  "required": [
    "schema_version",
    "application",
    "version",
    "release_id",
    "created_at",
    "compatibility",
    "artifacts"
  ],
  "additionalProperties": false,
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "application": {
      "type": "string",
      "enum": ["e-webui"]
    },
    "version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?(\\+[0-9A-Za-z.-]+)?$"
    },
    "release_id": {
      "type": "string",
      "pattern": "^[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "git": {
      "type": "object",
      "required": ["commit", "dirty"],
      "properties": {
        "commit": { "type": ["string", "null"] },
        "branch": { "type": ["string", "null"] },
        "dirty": { "type": "boolean" }
      }
    },
    "compatibility": {
      "type": "object",
      "required": ["min_deployment_manager_version", "python_version"],
      "properties": {
        "min_deployment_manager_version": { "type": "string" },
        "python_version": { "type": "string" },
        "target_os": { "type": "string" }
      }
    },
    "artifacts": {
      "type": "array",
      "minItems": 3,
      "items": {
        "type": "object",
        "required": ["name", "path", "sha256", "size_bytes", "purpose"],
        "properties": {
          "name": { "type": "string" },
          "path": { "type": "string" },
          "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
          "size_bytes": { "type": "integer", "minimum": 0 },
          "purpose": {
            "type": "string",
            "enum": ["app_source", "dependencies", "service_unit", "verification"]
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "builder": { "type": "string" },
        "notes": { "type": "string" }
      }
    }
  }
}
```

### Complete Example Manifest

```json
{
  "schema_version": "1.0.0",
  "application": "e-webui",
  "version": "1.0.0",
  "release_id": "20261106-213000-a1b2c3d4",
  "created_at": "2026-11-06T21:30:00Z",
  "git": {
    "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    "branch": "main",
    "dirty": false
  },
  "compatibility": {
    "min_deployment_manager_version": "1.0.0",
    "python_version": ">=3.11",
    "target_os": "debian-12"
  },
  "artifacts": [
    {
      "name": "app.tar.gz",
      "path": "payload/app.tar.gz",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "size_bytes": 45120,
      "purpose": "app_source"
    },
    {
      "name": "requirements.txt",
      "path": "payload/requirements.txt",
      "sha256": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "size_bytes": 110,
      "purpose": "dependencies"
    },
    {
      "name": "e-webui.service",
      "path": "payload/systemd/e-webui.service",
      "sha256": "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      "size_bytes": 620,
      "purpose": "service_unit"
    }
  ],
  "metadata": {
    "builder": "e-webui-release-builder/1.0.0",
    "notes": "Standard production release"
  }
}
```

### Complete Example `checksums.sha256`

```text
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  payload/app.tar.gz
1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef  payload/requirements.txt
fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321  payload/systemd/e-webui.service
a9b8c7d6e5f4a9b8c7d6e5f4a9b8c7d6e5f4a9b8c7d6e5f4a9b8c7d6e5f4a9b8  manifest.json
```

---

## 5. Artifact Inventory & Responsibilities

| Artifact | Producer Responsibility (Builder) | Consumer Responsibility (`deploy.sh`) |
|----------|-----------------------------------|---------------------------------------|
| `manifest.json` | Generate with valid schema, git commit, artifact sizes, purpose flags, and dependency constraints. | Parse and validate schema, verify minimum compatibility version, and extract metadata for deployment state. |
| `checksums.sha256` | Compute standard SHA-256 for manifest and all payload entries. | Verify hashes prior to container push and verify inside container staging before extraction. |
| `payload/app.tar.gz` | Package `app/` tree using strict allowlist, zero permissions drift (`0755` dirs, `0644` files), and path normalization. | Verify safe archive paths (no traversal), extract into `/opt/e-webui/releases/<release_id>/app/`. |
| `payload/requirements.txt` | Copy canonical dependency file from source root. | Calculate dependency hash (`req_hash`), resolve or build matching `/opt/e-webui/venvs/<req_hash>`, symlink `venv`. |
| `payload/systemd/e-webui.service` | Package verified canonical service unit definition. | Install unit to `/etc/systemd/system/e-webui.service` if updating unit configuration, trigger `systemctl daemon-reload`. |

---

## 6. Packaging and Exclusion Rules

### Allowlist Rules
The packaging mechanism extracts files strictly from authorized paths:
1. `app/`: All application Python modules (`*.py`), static assets (`app/static/**`), and template assets.
2. `requirements.txt`: Root dependency manifest.
3. Systemd service template: Canonical unit definition conforming to the modern release symlink layout (`current`).

### Denylist / Strict Exclusions
The release builder MUST guarantee that none of the following items are included in any payload or archive:
- **Version Control**: `.git/`, `.gitignore`, `.gitattributes`, `.gitmodules`.
- **Environment & Secrets**: `.env`, `.env.*`, `*.pem`, `*.key`, `*.token`, API credentials.
- **Python Artifacts**: `venv/`, `.venv/`, `__pycache__/`, `*.pyc`, `*.pyo`, `*.pyd`.
- **Testing & Tooling**: `tests/`, `.pytest_cache/`, `.coverage`, `htmlcov/`, `.tox/`.
- **Development Specs & Agents**: `specs/`, `.specify/`, `.agents/`, `.vscode/`, `.idea/`.
- **Temporary & Build Artifacts**: `dist/`, `build/`, `*.egg-info/`, `/tmp/`, `*.swp`, `*~`, `.DS_Store`.

---

## 7. Artifact Integrity and Security Requirements

1. **Deterministic Checksumming**: SHA-256 checksums are generated using standard RFC 4634 / FIPS 180-2 algorithms.
2. **Double Integrity Gate**:
   - **Gate 1 (Host Pre-flight)**: `deploy.sh` verifies `checksums.sha256` on the host filesystem before pushing any bytes to the container.
   - **Gate 2 (Container Pre-extraction)**: After pushing the payload archive to `${APP_DIR}/staging/`, `deploy.sh` runs `sha256sum -c` inside the container before executing tar extraction.
3. **Archive Security & Traversal Prevention**:
   - Tar archives must be validated before extraction using `tar -tzf <archive>`.
   - Any member path starting with `/` or containing `../` is rejected immediately.
   - Extraction is strictly bounded to the target release directory using `tar -xzf <archive> -C /opt/e-webui/releases/<release_id>/`.
4. **Symlink Restrictions**:
   - Any symlinks contained *inside* the archive must have relative targets that do not navigate outside the extraction root.
   - Hard links pointing outside the archive are forbidden.
5. **Ownership & Permissions Normalization**:
   - Release Builder packages files with normalized permissions: directories `0755`, regular files `0644`, executable scripts `0755`.
   - On container extraction, ownership is set to `root:root`.
6. **Integrity vs. Authenticity Distinction**:
   - SHA-256 proves **integrity** (the bits were not truncated, corrupted, or altered in transit).
   - SHA-256 does **not** prove cryptographic **authenticity** (origin identity or author validation).
   - *Future Security Extension*: Digital signatures using asymmetric signing keys (e.g., `minisign`, `signify`, or `gpg`) may be added to sign `checksums.sha256` (e.g., `checksums.sha256.sig`). The initial specification reserves this extension slot without making it mandatory.

---

## 8. Versioning and Compatibility Policy

### Semantic Versioning
- Application releases adhere to Semantic Versioning (`MAJOR.MINOR.PATCH`).
  - `MAJOR`: Breaking architectural or API changes.
  - `MINOR`: New backwards-compatible capabilities.
  - `PATCH`: Backwards-compatible bug fixes.

### Distinction Between Version Identifiers

| Identifier | Format | Example | Scope & Responsibility |
|------------|--------|---------|------------------------|
| `version` | SemVer (`X.Y.Z`) | `1.0.0` | Application feature release version. |
| `release_id` | Timestamp + hash | `20261106-213000-a1b2c3d4` | Unique physical build instance identifier. |
| `schema_version` | SemVer (`X.Y.Z`) | `1.0.0` | Specification format version for `manifest.json`. |
| `min_deployment_manager_version` | SemVer (`X.Y.Z`) | `1.0.0` | Minimum `deploy.sh` version required to consume this release. |

### Compatibility & Migration Rules
1. **Schema Version Compatibility**: The Deployment Manager supports all schema versions sharing the same `MAJOR` version (`1.x`). If a release has `schema_version >= 2.0.0`, the manager must reject it and instruct the operator to update `deploy.sh`.
2. **Duplicate Release Detection**:
   - If a release with identical `release_id` is already deployed in `/opt/e-webui/releases/<release_id>/`, `deploy.sh` detects that it is already present.
   - If that release is already the active release, `deploy.sh` reports that the system is already up-to-date and exits cleanly without restarting services.
   - If that release is an inactive past release, `deploy.sh` can re-activate it without re-extracting.
3. **Older Release Deployment (Intentional Rollback/Downgrade)**:
   - Operators may deploy older versions. The Deployment Manager does not prevent deploying an older application version provided its manifest schema is supported.

---

## 9. Release Discovery and Consumption Contract for `deploy.sh`

### How `deploy.sh` Locates a Release
1. **Explicit Argument**:
   - `./deploy.sh --release <PATH>`:
     - If `<PATH>` is a directory, `deploy.sh` consumes the uncompressed release directory.
     - If `<PATH>` is a `.tar.gz` file, `deploy.sh` unpacks the bundle into a temporary host staging directory and consumes it.
2. **Automatic Discovery (Default)**:
   - If no `--release` flag is provided, `deploy.sh` checks `${REPO_ROOT}/dist/releases/`.
   - It enumerates all valid release packages in `dist/releases/` and selects the one with the highest release identifier (or most recent creation timestamp).
   - If `dist/releases/` is empty or missing, `deploy.sh` halts with a clear error instructing the user to build a release first.

### Step-by-Step Consumption Workflow in `deploy.sh`

```text
[Operator invokes deploy.sh]
       │
       ▼
1. Discover & Select Release (via --release or latest in dist/releases/)
       │
       ▼
2. Host Pre-flight Verification:
   - Check manifest.json exists and is valid JSON
   - Check schema_version compatibility
   - Check min_deployment_manager_version
   - Check checksums.sha256 covers manifest.json and payload/*
   - Verify sha256sum on host for all files
       │
       ▼
3. Acquire Container Lock (/opt/e-webui/.deploy.lock)
       │
       ▼
4. Transfer Release Package to Container Staging:
   - Push release bundle / payload to /opt/e-webui/staging/release-<release_id>/
       │
       ▼
5. Container Pre-extraction Verification:
   - Re-verify SHA-256 inside container
   - Scan tar archive members for path traversal / unsafe symlinks
       │
       ▼
6. Safe Extraction:
   - Extract payload into /opt/e-webui/releases/<release_id>/
   - Store manifest.json and checksums.sha256 in /opt/e-webui/releases/<release_id>/
       │
       ▼
7. Dependency & Environment Provisioning:
   - Read payload/requirements.txt
   - Compute requirements_hash
   - Resolve /opt/e-webui/venvs/<hash> (build only if new)
   - Symlink /opt/e-webui/releases/<release_id>/venv -> /opt/e-webui/venvs/<hash>
   - Symlink /opt/e-webui/releases/<release_id>/data -> /opt/e-webui/shared/data
       │
       ▼
8. Atomic Release Activation:
   - Update symlink atomically: ln -sfn releases/<release_id> current_next && mv -Tf current_next current
       │
       ▼
9. Service Management:
   - Update /etc/systemd/system/e-webui.service if unit changed
   - Restart systemd service e-webui
       │
       ▼
10. Health Verification:
    - Probe /api/health on container port
    - Success -> Commit metadata to .deploy_state & prune old releases
    - Failure -> Trigger automatic rollback to previous_healthy_release
       │
       ▼
11. Release Lock & Report Status
```

---

## 10. Release Creation and Publication System

### Builder Specification (e.g. `scripts/build-release.sh`)
Release creation is executed by a dedicated builder tool that enforces atomic generation:

1. **Isolation**: Builds inside an isolated temporary directory (e.g. `mktemp -d /tmp/e-webui-build.XXXXXX`).
2. **Metadata Assembly**:
   - Reads `version` from canonical source (e.g., `app/main.py` or version file).
   - Inspects Git commit (`git rev-parse HEAD`), branch, and dirty status.
   - Generates unique `release_id`: `<UTC_YYYYMMDD-HHMMSS>-<SHORT_GIT_COMMIT>`.
3. **Payload Generation**:
   - Tarballs `app/` into `payload/app.tar.gz` with strict allowlist and permissions normalization.
   - Copies `requirements.txt` to `payload/requirements.txt`.
   - Packages canonical `systemd/e-webui.service` into `payload/systemd/e-webui.service`.
4. **Checksum & Manifest Computation**:
   - Computes SHA-256 and byte sizes for all payload files.
   - Emits `manifest.json` conforming to schema.
   - Computes SHA-256 for `manifest.json` and writes `checksums.sha256`.
5. **Pre-Publication Self-Test**:
   - Validates generated manifest against schema.
   - Verifies all checksums using `sha256sum -c checksums.sha256`.
6. **Atomic Publication**:
   - Creates `dist/releases/` if missing.
   - Atomically moves staging directory or packages bundle to `dist/releases/e-webui-<version>-<release_id>.tar.gz`.
7. **Cleanup**: Trap ensures temporary build directories are removed on exit or error.

---

## 11. Error Handling and Diagnostics

| Error Condition | Stage Detected | Behavior & Recovery | Exit Code |
|-----------------|----------------|---------------------|-----------|
| No release package found | Discovery | Halt immediately; output command suggestion to build release. | 2 |
| Invalid / Malformed `manifest.json` | Host Pre-flight | Halt immediately; report exact JSON parsing or schema validation error. | 2 |
| Incompatible `schema_version` | Host Pre-flight | Halt; report required vs supported manifest versions. | 2 |
| Checksum mismatch on host | Host Pre-flight | Halt; output file name and expected vs actual SHA-256. | 2 |
| Checksum mismatch in container staging | Container Pre-extract | Clean container staging; halt; active release unaffected. | 3 |
| Unsafe archive path (traversal / absolute) | Container Pre-extract | Clean container staging; halt; log security alert. | 3 |
| Missing required payload item | Validation | Halt; list missing required artifact path. | 2 |
| Virtualenv build failure | Provisioning | Active release unchanged; staging preserved for debug; halt. | 3 |
| Service startup / health failure | Post-activation | Automatic rollback to `previous_healthy_release`. | 4 |
| Rollback failure | Rollback | Log critical alert; preserve diagnostic logs. | 5 |

---

## 12. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a formal Release Artifact Contract consisting of `manifest.json`, `checksums.sha256`, and a `payload/` directory.
- **FR-002**: System MUST produce a machine-readable `manifest.json` adhering to the specified schema, containing `schema_version`, `application`, `version`, `release_id`, `created_at`, `git` metadata, `compatibility` constraints, and an `artifacts` inventory with individual SHA-256 hashes and file sizes.
- **FR-003**: System MUST generate a standard `checksums.sha256` file covering `manifest.json` and all files under `payload/`.
- **FR-004**: System MUST strictly exclude from all release artifacts: `.git/`, `.env` and credential files, virtual environments, Python bytecode/caches, test files, and development specifications.
- **FR-005**: System MUST provide a dedicated release builder that creates release packages atomically in an isolated build directory, ensuring partially generated releases are never published.
- **FR-006**: The Deployment Manager (`deploy.sh`) MUST consume pre-built release packages rather than packaging application files from the source tree.
- **FR-007**: The Deployment Manager MUST support specifying an explicit release path via `--release <path>` or discovering the latest published release in `dist/releases/` by default.
- **FR-008**: The Deployment Manager MUST verify the SHA-256 integrity of all artifacts on the host before initiating container transfer, and re-verify within the container staging directory prior to extraction.
- **FR-009**: The Deployment Manager MUST inspect all archive paths before extraction and reject any archive containing absolute paths or directory traversal sequences (`../`).
- **FR-010**: The Deployment Manager MUST preserve the release `manifest.json` inside `/opt/e-webui/releases/<release_id>/` and record the release metadata in the persistent deployment state (`.deploy_state`).
- **FR-011**: The Deployment Manager MUST maintain existing zero-rebuild principles, virtual environment caching by dependency hash, persistent data separation in `shared/`, atomic symlink switching, and automatic rollback on health check failure.

### Key Entities

- **Release Package**: A self-contained, versioned directory or `.tar.gz` bundle containing `manifest.json`, `checksums.sha256`, and `payload/`.
- **Manifest (`manifest.json`)**: Machine-readable JSON metadata describing release identification, provenance, compatibility bounds, and artifact inventory.
- **Payload (`payload/`)**: Encapsulated deployable runtime assets: `app.tar.gz` (application code), `requirements.txt` (dependencies), and `systemd/e-webui.service` (service unit).
- **Installed Release (`/opt/e-webui/releases/<release_id>/`)**: Extracted runtime release directory in the container, containing the active application code, dependency symlink, shared data symlink, and manifest copy.
- **Deployment State (`.deploy_state`)**: Persistent JSON record inside the container tracking active release, previous healthy release, virtualenv hashes, and deployment history.

---

## 13. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of generated release packages validate cleanly against the manifest schema and pass SHA-256 integrity checks.
- **SC-002**: 0 development-only files, secrets, or git directories are included in any published release package (verified by automated exclusion tests).
- **SC-003**: Deployment Manager executes deployments without reading, inspecting, or packaging files from the source tree when consuming a Release package.
- **SC-004**: Any tampered or corrupted artifact is detected and rejected 100% of the time prior to modifying the active release or interrupting running service.
- **SC-005**: Release packaging completes in under 10 seconds on standard developer hardware.
- **SC-006**: Application update deployment time remains under 15 seconds when reusing existing cached virtual environments.

---

## 14. Assumptions

- **Host Build Environment**: The host system creating release packages has standard POSIX utilities (`tar`, `gzip`, `sha256sum`) and Python 3.11+ installed.
- **Target Container Environment**: The Incus container runs Debian stable with `tar`, `coreutils`, `python3`, and `systemd`.
- **Default Release Directory**: Host release outputs default to `dist/releases/` within the repository root (gitignored by default except for formal distribution).
- **Service Customization**: Dynamic container port and Ollama address bindings continue to be managed via `/opt/e-webui/deployment.env` and `/opt/e-webui/shared/.env` rather than modifying the release service unit.

---

## 15. Out-of-Scope Items

- **Cryptographic Signature Verification**: Asymmetric GPG / Minisign key signing is reserved for future extensions and not required for the initial release artifact implementation.
- **Remote Artifact Repositories**: Integration with remote artifact registries (e.g., OCI registries, AWS S3, GitHub Releases) is out of scope for this workspace-based specification; the format is file-based to allow easy future upload.
- **Incus Infrastructure Changes**: Modifying Incus container creation, network configurations, or host Incus profiles is strictly out of scope, adhering to Constitution Principle I.

---

## 16. Architectural Decisions & Open Questions for User Approval

1. **Release Distribution Packaging**:
   - *Proposal*: The Release Builder outputs both an uncompressed directory `dist/releases/<release-id>/` and a compressed bundle `dist/releases/e-webui-<version>-<release-id>.tar.gz`. `deploy.sh` accepts either format.
2. **Systemd Service Unit Source**:
   - *Proposal*: Move canonical `app/systemd/e-webui.service` to the modern unit definition referencing `/opt/e-webui/current` and bundle it in `payload/systemd/e-webui.service`.
3. **Default Release Selection**:
   - *Proposal*: When `./deploy.sh` is run without `--release`, it deploys the newest valid release found in `dist/releases/`. If none exist, it cleanly prompts the operator to build one via `./scripts/build-release.sh`.
