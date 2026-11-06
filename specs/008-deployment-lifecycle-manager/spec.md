# Feature Specification: Deployment Lifecycle Manager

**Feature Branch**: `008-deployment-lifecycle-manager`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Redesign deploy.sh into a reliable, resumable, and update-capable deployment management tool for e-webui running inside an Incus container. The tool must automatically detect the current deployment state and determine whether an initial installation or an application update is required. The deployment process must not require container deletion, operating system reinstallation, or repeated installation of system prerequisites during normal application updates."

## Clarifications

### Session 2026-11-06

- Q: How should the systemd service invoke the Python virtual environment across releases without requiring unit file edits when dependencies change? → A: Each release directory `/opt/e-webui/releases/<release-id>/` contains a symlink `venv -> /opt/e-webui/venvs/<requirements-hash>`. The systemd service defines `WorkingDirectory=/opt/e-webui/current` and `ExecStart=/opt/e-webui/current/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080`. Switching the `current` symlink atomically switches both application code and virtual environment simultaneously without rewriting the systemd unit.
- Q: How is a legacy deployment distinguished from a modern deployment and an unmanaged container? → A: A legacy deployment is identified by the presence of `/opt/e-webui/.deploy_state` formatted with legacy step markers (`STEP_*`) and `/opt/e-webui/venv`, but lacking `/opt/e-webui/releases/`. A modern deployment has `/opt/e-webui/releases/` and structured metadata. An unmanaged container lacks `/opt/e-webui/` or deployment markers altogether.
- Q: How does the health check evaluate application readiness versus Ollama backend availability? → A: The health check probes `http://127.0.0.1:8080/api/health`. An HTTP 200 response confirms application server readiness. Ollama backend status (`ollama_connected: false`) is logged as a non-blocking warning unless Ollama is explicitly configured as a mandatory dependency.
- Q: How are application secrets and persistent configurations managed across releases? → A: Persistent configurations reside in `/opt/e-webui/shared/.env` and `/opt/e-webui/deployment.env`. The systemd unit includes `EnvironmentFile=-/opt/e-webui/deployment.env` and `EnvironmentFile=-/opt/e-webui/shared/.env`. Each release also symlinks `/opt/e-webui/releases/<release-id>/data -> /opt/e-webui/shared/data`.
- Q: How is atomic release switching guaranteed without race conditions or missing links? → A: Release switching is performed using atomic symlink replacement via `ln -sfn releases/<release-id> /opt/e-webui/current_next && mv -Tf /opt/e-webui/current_next /opt/e-webui/current`. An exclusive file lock (`/opt/e-webui/.deploy.lock`) is acquired for the duration of all lifecycle operations.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast and Safe Application Updates (Priority: P1)

As a system operator maintaining an active e-webui instance, I want to run the deployment tool against an existing installation to roll out code updates without recreating the container, reinstalling base operating system packages, or re-downloading unchanged Python packages, so that routine deployments take seconds and avoid unnecessary service disruption.

**Why this priority**: Application updates represent the most frequent operational task after initial setup. Avoiding container rebuilds and package reinstallation solves the primary pain point of slow, risky, and destructive deployments.

**Independent Test**: Can be tested independently by running an update on an already-deployed container with modified source files: verify that the container is not recreated, OS packages are not reinstalled, unchanged Python dependencies are reused immediately, the new release is activated cleanly, and the service remains healthy.

**Acceptance Scenarios**:

1. **Given** a healthy managed deployment exists in the target container, **When** the operator runs the deployment tool without arguments (or with `--update`), **Then** the tool automatically identifies the existing deployment and initiates the update workflow without prompting for OS reinstallation or container creation.
2. **Given** application code has changed but the dependency manifest (`requirements.txt`) remains identical to the active release, **When** an update is executed, **Then** the existing Python virtual environment is reused directly without triggering pip download or installation steps.
3. **Given** an update is in progress, **When** the new release is prepared in staging, **Then** the currently running release continues serving user traffic unaffected until the atomic switch occurs.
4. **Given** the new release is staged and verified, **When** activation occurs, **Then** the active release pointer is updated atomically, the service is restarted, and health verification confirms HTTP readiness before concluding.
5. **Given** no application code or configuration changes exist between host and container, **When** an update is executed, **Then** the tool detects the match and reports that the deployment is already up to date without performing unnecessary restarts.

---

### User Story 2 - Automated Environment Detection & Resumable Initial Installation (Priority: P1)

As an operator setting up e-webui for the first time or recovering an interrupted install, I want the deployment tool to automatically detect the absence of an installation and guide container creation, OS provisioning, dependency installation, network proxying, and service activation step-by-step, resuming cleanly if interrupted.

**Why this priority**: Initial provisioning is mandatory for bootstrapping new environments and must establish the foundational release-based directory structure required for all future updates.

**Independent Test**: Can be tested on a clean host where the target container does not yet exist: execute `./deploy.sh`, verify container creation, base environment setup, release structure setup, dependency installation, systemd activation, and initial healthy state recording.

**Acceptance Scenarios**:

1. **Given** the specified container does not exist, **When** the deployment tool runs, **Then** it prompts or initiates the initial installation sequence to launch the container using Debian stable.
2. **Given** a container exists but has never been managed by the deployment tool, **When** the tool runs, **Then** it warns the operator and requires explicit confirmation before performing any modifications.
3. **Given** an initial installation fails mid-way due to a temporary network glitch during package installation, **When** the operator re-runs the tool, **Then** the process resumes from the failed stage rather than re-creating the container from scratch.
4. **Given** initial installation finishes successfully, **When** health checks pass, **Then** the deployment metadata records the first healthy release ID and marks the deployment as active.

---

### User Story 3 - Automatic Rollback on Health Failure (Priority: P2)

As a site reliability engineer, I want failed deployments to automatically roll back to the previously functioning release when health checks fail, so that service outages caused by bad updates are immediately mitigated without manual intervention.

**Why this priority**: Eliminates human latency in restoring service when a newly pushed release fails to boot, crashes, or fails HTTP readiness checks.

**Independent Test**: Can be tested by deploying a release intentionally containing an invalid startup configuration or application syntax error: verify that upon health check timeout, the system automatically restores the previous healthy release pointer, restarts the service, confirms health, logs the failure, and preserves the bad release for post-mortem investigation.

**Acceptance Scenarios**:

1. **Given** a previous healthy release exists and an update activates a release that fails systemd startup or HTTP health checks, **When** the health verification window times out, **Then** the tool automatically initiates a rollback.
2. **Given** automatic rollback is triggered, **When** the rollback sequence executes, **Then** it restores the active release symlink to the previous healthy release, restarts the systemd service, and verifies that the previous release is healthy.
3. **Given** a rollback has executed, **When** reporting status, **Then** the tool captures journal logs from the failed attempt, leaves the failed release artifacts isolated in `releases/` for debugging, and returns a non-zero exit code indicating the update failed.
4. **Given** an operator explicitly runs `./deploy.sh --rollback`, **When** a prior healthy release is registered, **Then** the tool switches the active pointer to that prior release, restarts the service, and verifies health.
5. **Given** no prior healthy release exists to roll back to, **When** rollback is requested or required, **Then** the tool reports the absence of a fallback release with detailed diagnostics.

---

### User Story 4 - Persistent Data and Configuration Preservation (Priority: P2)

As an administrator managing long-lived application state, I want all user databases, uploaded files, and environment configurations (`.env`) to reside outside release-specific directories in a shared storage location, so that updating or rolling back code never deletes or corrupts user data.

**Why this priority**: Application data loss is catastrophic; separating transient release code from permanent state is fundamental to safe zero-risk updates.

**Independent Test**: Can be tested by creating persistent data (e.g., SQLite database records, uploaded files, custom `.env` variables) in a deployed instance, running multiple consecutive updates and a rollback, and verifying all data remains intact and accessible.

**Acceptance Scenarios**:

1. **Given** active user data, uploads, and configuration files exist in the application, **When** an application update occurs, **Then** the persistent data remains untouched in `/opt/e-webui/shared/` and is referenced by the active release.
2. **Given** an update archive is created on the host, **When** packaging occurs, **Then** host `.env` files, secrets, Git metadata, and virtual environments are strictly excluded from the release archive.
3. **Given** the operator executes `./deploy.sh --uninstall`, **When** removing application services, **Then** persistent data in `shared/` is preserved by default unless an explicit destructive flag is provided.

---

### User Story 5 - Legacy Deployment Migration (Priority: P3)

As an administrator with an existing deployment created by an older version of `deploy.sh` (which used a single unversioned `/opt/e-webui/` folder), I want the redesigned tool to automatically recognize and migrate the installation to the new release-based layout without requiring a full container wipe or data loss.

**Why this priority**: Ensures seamless upgrade paths for existing installations without operational downtime or manual file restructuring.

**Independent Test**: Can be tested by constructing a legacy deployment structure with an old `.deploy_state` file and unversioned code directory, then running `./deploy.sh`: verify that the tool detects the legacy state, migrates files into the new release hierarchy, preserves existing data, and successfully verifies the active service.

**Acceptance Scenarios**:

1. **Given** a container with an existing legacy deployment is detected, **When** the deployment tool is invoked, **Then** it identifies the legacy structure and presents an upgrade migration plan.
2. **Given** the operator confirms migration, **When** migration runs, **Then** existing virtual environments and persistent assets are safely moved into the new structure (`venvs/` and `shared/`), an initial release is registered, and the active symlink is established.
3. **Given** migration completes, **When** the systemd unit is updated and service is restarted, **Then** the health check passes and the new `.deploy_state` is committed.

---

### User Story 6 - Observability, Status Inspection, and Repair (Priority: P3)

As an operator troubleshooting an installation, I want commands to inspect deployment status, view recent release history, check container health, and repair broken symlinks or service units.

**Why this priority**: Provides day-2 operational transparency and automated self-healing without requiring manual container shells.

**Independent Test**: Can be tested by running `./deploy.sh --status` to view release metadata, and simulating a broken symlink or missing systemd unit before running `./deploy.sh --repair`.

**Acceptance Scenarios**:

1. **Given** a deployed container, **When** `./deploy.sh --status` is executed, **Then** the tool displays container status, active release ID, previous release ID, virtualenv hash, systemd service state, and HTTP health status.
2. **Given** a deployment with a mispointed `current` symlink or desynced systemd service, **When** `./deploy.sh --repair` is executed, **Then** the tool restores consistent pointer relationships, verifies systemd unit configuration, reloads the daemon, and reports recovery results.

---

### Edge Cases

- **Interrupted Transfer / Lock Contention**: What happens if an operator runs two instances of `deploy.sh` concurrently or an update is killed mid-transfer?
  * The tool MUST acquire an exclusive deployment lock before modifying staging or release state. If a lock is held, secondary invocations must exit with an error. Cleanup traps must remove temporary staging archives and release stale locks on unhandled exit signals.
- **Dependency Hash Change with Failed Pip Install**: What happens if a new `requirements.txt` is introduced, a new virtualenv is created, but package installation fails?
  * The new virtualenv in `venvs/<hash>` is isolated. Because the active release still points to the previous release and previous virtualenv, the failure aborts cleanly before pointer activation, leaving the running service undisturbed.
- **Network Outage During Health Check**: What happens if the service starts but does not respond within the configured HTTP readiness timeout?
  * The health checker retries with backoff up to a defined threshold (e.g., 30s). Upon expiry, it treats the update as failed, grabs the service's recent journal logs for console output, and triggers automatic rollback.
- **Corrupted Deployment Archive**: What happens if the host-built archive is truncated during container transfer?
  * The tool computes the SHA-256 checksum on the host before transfer and verifies it inside the container before extraction. Mismatched checksums cause immediate abort and staging cleanup.
- **Rollback Candidate Is Missing or Corrupt**: What happens if automatic rollback is triggered but no previous release exists (e.g., failed initial install)?
  * The tool captures diagnostics, reports that no rollback candidate is available, halts, and does not alter the failure state.
- **Proxy Port Collision**: What happens if the requested Web UI host port is already bound on the host?
  * The tool validates port availability during pre-checks before altering container proxy devices and exits with code 2 if unavailable.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Invocation & Mode Detection
- **FR-001**: The deployment tool MUST automatically detect the operational state of the target environment when executed without explicit action flags:
  - If target container does not exist: initiate initial installation.
  - If target container exists and has valid e-webui deployment markers: initiate or propose an application update.
  - If target container exists but lacks e-webui ownership markers: prompt for explicit operator authorization before modifying anything.
- **FR-002**: The tool MUST support explicit CLI subcommands/flags:
  - `./deploy.sh` (automatic detection)
  - `./deploy.sh --install` (force initial installation workflow)
  - `./deploy.sh --update` (force update workflow)
  - `./deploy.sh --rollback` (restore previous healthy release)
  - `./deploy.sh --status` (display deployment state, releases, and service health)
  - `./deploy.sh --repair` (diagnose and restore broken release links/services)
  - `./deploy.sh --uninstall` (remove services and configuration cleanly)
  - `./deploy.sh --help` (display usage documentation and exit codes)
- **FR-003**: The tool MUST support compatible CLI arguments:
  - `-p, --port <PORT>`: host port for Web UI proxy (default: 8080).
  - `-o, --ollama-url <URL>`: explicit Ollama endpoint.
  - `-y, --yes, --non-interactive`: automatic confirmation for script prompts.
  - `-r, --reset`: reset deployment state and restart provisioning (strictly distinguished from update).
- **FR-004**: In non-interactive mode (`--yes`), automatic detection MUST automatically proceed with updates on managed deployments, but MUST exit with an error on unmanaged containers unless `--install` is explicitly passed.

#### Release Layout & Atomic Switching
- **FR-005**: All container deployments MUST use the following isolated filesystem hierarchy under `/opt/e-webui/`:
  - `releases/<release-id>/`: directory containing standalone application source releases (`app/`, `requirements.txt`), with a symbolic link `venv -> /opt/e-webui/venvs/<hash>` and `data -> /opt/e-webui/shared/data`.
  - `venvs/<requirements-hash>/`: directory containing Python virtual environments indexed by dependency hash.
  - `shared/`: persistent directory containing shared environment variables (`.env`) and application data/uploads (`data/`).
  - `current`: symbolic link pointing to the currently active release (`releases/<release-id>`).
  - `staging/`: temporary directory for receiving and verifying new release archives before promotion.
  - `deployment.env`: deployment-level configuration (ports, Ollama endpoints, container metadata).
  - `.deploy_state`: JSON/structured metadata tracking active release, previous healthy release, installation timestamp, and dependency hashes.
- **FR-006**: Activation of a new release MUST be performed atomically via atomic directory symlink replacement (`ln -sfn releases/<release-id> current_next && mv -Tf current_next current`), ensuring zero window where `current` is missing or half-extracted.
- **FR-007**: The deployment tool MUST never modify the contents of the currently active release in `releases/<active-id>/` during update staging.

#### Host Packaging & Security
- **FR-008**: The deployment tool MUST package releases on the host into an isolated tarball before transferring into the container.
- **FR-009**: Packaging MUST exclude:
  - Host environment files (`.env`, `.env.*`).
  - Host virtual environments (`.venv/`, `venv/`, `__pycache__/`, `*.pyc`).
  - Source control metadata (`.git/`, `.gitignore`).
  - Spec-Kit metadata and documentation scratch directories (`.specify/`, `specs/`).
  - Development temporary files and test logs.
- **FR-010**: The tool MUST compute a SHA-256 checksum of the package archive on the host and verify the checksum inside the container before extracting to `staging/`.
- **FR-011**: The deployment tool MUST NOT configure or use any host-to-container development directory mounts; all application code in the container must be strictly isolated from the host filesystem.

#### Dependency Management
- **FR-012**: The tool MUST calculate the SHA-256 hash of `requirements.txt` for every release.
- **FR-013**: If a virtual environment matching the dependency hash already exists in `/opt/e-webui/venvs/<hash>/`, the tool MUST reuse it without executing pip install commands.
- **FR-014**: If no matching virtual environment exists, the tool MUST create a new virtual environment at `/opt/e-webui/venvs/<hash>/`, install the dependencies from the staged release, verify successful completion, and retain existing virtualenvs for potential rollbacks.
- **FR-015**: Routine code updates with unchanged dependencies MUST complete without invoking pip or modifying system packages.

#### Service Management & Health Verification
- **FR-016**: The application systemd service unit MUST use stable paths referencing `/opt/e-webui/current/` (`WorkingDirectory=/opt/e-webui/current`, `ExecStart=/opt/e-webui/current/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080`), loading environment variables from `deployment.env` and `shared/.env`.
- **FR-017**: Service updates MUST only trigger `systemctl daemon-reload` when the unit definition changes.
- **FR-018**: Following release switch and service restart, the tool MUST verify:
  1. Systemd active status (`systemctl is-active`).
  2. HTTP endpoint readiness (`GET http://127.0.0.1:8080/api/health`) returning HTTP 200 with configurable retries and timeout (default: 30 seconds). Ollama connectivity warning is reported separately without failing application health.
- **FR-019**: If health verification fails:
  - The tool MUST immediately retrieve the last 30 lines of service journal logs and output them to stderr.
  - The tool MUST NOT mark the deployment as successful.
  - The tool MUST return a non-zero exit code.

#### Automated and Manual Rollback
- **FR-020**: When an update fails health verification, the tool MUST automatically initiate rollback:
  1. Check `.deploy_state` for the recorded previous healthy release ID.
  2. If found, repoint the `current` symlink to the previous healthy release.
  3. Restart the systemd service.
  4. Perform HTTP readiness verification on the restored release.
  5. Preserve the failed release directory in `releases/` with failure annotation for troubleshooting.
- **FR-021**: The operator MUST be able to manually trigger a rollback to the previous healthy release at any time using `./deploy.sh --rollback`.
- **FR-022**: Rollback operations MUST never delete or overwrite persistent data in `shared/`.

#### Release Retention & Cleanup
- **FR-023**: The tool MUST retain a configurable number of past healthy releases (default: 3 previous releases plus the active release).
- **FR-024**: Cleanup routines MUST NEVER delete:
  - The currently active release.
  - The immediate previous healthy release required for rollback.
  - Any virtual environment still referenced by the active or rollback release.
  - Persistent data in `shared/`.

#### Legacy Migration & Backward Compatibility
- **FR-025**: The tool MUST recognize legacy deployments that used flat `/opt/e-webui/` layouts, where `/opt/e-webui/.deploy_state` contains legacy step keys (`STEP_*`) and `/opt/e-webui/venv` exists without `/opt/e-webui/releases`.
- **FR-026**: When a legacy deployment is encountered, the tool MUST provide an automated migration routine that:
  - Preserves existing persistent files (e.g., database, `.env` moved to `shared/`).
  - Converts existing application code and requirements into an initial release (`releases/legacy-initial/`).
  - Moves existing virtualenv into `venvs/` and links `releases/legacy-initial/venv -> venvs/<hash>`.
  - Atomically establishes `current -> releases/legacy-initial`.
  - Reconfigures the systemd service to use the `current` path and reloads the daemon.
  - Verifies service health without destroying the container, reinstalling the OS, or re-downloading Python packages.

#### Concurrency & Failure Recovery
- **FR-027**: The deployment tool MUST enforce an exclusive file-based deployment lock on the container to prevent race conditions from concurrent invocations.
- **FR-028**: The tool MUST register exit cleanup traps to guarantee that temporary staging archives and locks are cleared upon unexpected termination (SIGINT, SIGTERM, script failure).
- **FR-029**: The tool MUST write clear, actionable log output distinguishing between INFO, SUCCESS, WARNING, and ERROR.

---

### Key Entities

- **Deployment Target**: The Incus container instance (identified by name, e.g., `e-webui-app`), its runtime status (RUNNING/STOPPED), and assigned network proxies.
- **Release**: An immutable, versioned snapshot of the application source code residing in `/opt/e-webui/releases/<release-id>`, containing a unique release identifier (e.g., timestamp `YYYYMMDDHHMMSS` or git-derived commit ID).
- **Virtual Environment (Venv)**: A self-contained Python execution environment stored at `/opt/e-webui/venvs/<requirements-hash>`, where the hash is computed from `requirements.txt`.
- **Active Release Pointer (`current`)**: A filesystem symbolic link at `/opt/e-webui/current` resolving to the currently active release directory.
- **Shared Storage**: The permanent storage directory `/opt/e-webui/shared/` containing application state that persists across all releases, specifically `shared/.env` and `shared/data/`.
- **Deployment State (`.deploy_state`)**: A persistent JSON/key-value record at `/opt/e-webui/.deploy_state` tracking the active release ID, the previous healthy release ID, active venv hash, deployment history, and health verification timestamp.
- **Deployment Lock**: An exclusive lock mechanism (e.g. `flock` or lockfile at `/opt/e-webui/.deploy.lock`) ensuring only one lifecycle operation executes at any given time.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Routine code updates with unchanged dependencies complete within 15 seconds from command invocation to HTTP health verification.
- **SC-002**: 100% of routine code updates execute without recreating the container or reinstalling host/container operating system packages.
- **SC-003**: 100% of persistent configuration and application data (`shared/.env`, databases, user uploads) persists unchanged across updates and rollbacks.
- **SC-004**: 100% of update attempts that fail startup or HTTP health checks automatically restore the previous healthy release within 10 seconds of health-check failure.
- **SC-005**: 100% of legacy single-folder deployments can be migrated to the versioned release structure without data loss or container recreation.
- **SC-006**: During release transitions, the system undergoes an atomic pointer switch with zero window where the application path is unpopulated or invalid.
- **SC-007**: 100% of concurrent deployment invocations against the same container are blocked by deployment locking, exiting with a clear descriptive message.
- **SC-008**: 0 credentials, secrets, Git repositories, or host virtual environments are transferred into the deployment release package.

---

## Assumptions

- **Container Engine**: Incus is the supported container hypervisor/runtime on the host machine.
- **Base OS**: The container runs Debian stable (e.g., Debian 12/13), running `systemd` as PID 1.
- **Default Retention**: Release retention defaults to retaining the active release plus 3 previous healthy releases, unless overridden by configuration.
- **Health Verification**: The primary health check verifies HTTP 200/readiness from within the container or via the proxy port with a 30-second maximum timeout and 2-second retry intervals.
- **Container Name**: If not specified via CLI argument, the default container name is `e-webui-app` (with interactive confirmation in interactive mode).
- **Operator Execution & Governance Boundary**: In accordance with the project Constitution (Principle I: Infrastructure Isolation), the AI agent develops, refactors, and tests the deployment logic using local unit tests and mocked Incus harnesses within the workspace; live deployment commands against actual Incus containers are executed manually by the human operator.
- **Rollback Depth**: Rollback automatically restores the immediately preceding healthy release. Multiple rollbacks can step backward if previous healthy releases exist in `.deploy_state`.
