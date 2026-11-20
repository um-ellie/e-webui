# Feature Specification: Interactive Deployment & Script Modernization Overhaul

**Feature Branch**: `023-interactive-deployment-and-script-overhaul`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "لطفا کل پروژه و قسمت اسکریپت های آن را کامل بازبینی کن و مشکلات آن را پیدا کن. همچین بجای ./deploy --update و بقیه اسکیرپت ها روش های بهتر و تعاملی بهترو بیشتر به من پیشنهاد بده. راه حل های بهتر برای نصب و کنترل آپدیت ها و عملکرد درست."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interactive Terminal Control Center (TUI Dashboard) (Priority: P1)

As a developer or system operator, I want an interactive terminal control dashboard (CLI/TUI) when executing deployment management, so that I can inspect system health, trigger updates, restart services, view streaming logs, and manage versions without memorizing fragmented flags (`--update`, `--status`, `--repair`, `--rollback`).

**Why this priority**: Eliminates CLI flag cognitive load and replaces error-prone manual flag orchestration with an intuitive, guided terminal UI that visualizes container and service state in real-time.

**Independent Test**: Can be fully tested by launching the management tool in interactive mode (`./ctl` or `./deploy.sh`) without arguments; displays an interactive navigable menu with live container health indicators and actionable options.

**Acceptance Scenarios**:

1. **Given** a terminal session with Incus installed, **When** the user launches `./ctl` (or `./deploy.sh` without flags in an interactive TTY), **Then** the system presents a dynamic TUI menu showing: Container Status, Service Health, Active Version, Ollama Link state, and numbered actions.
2. **Given** the interactive menu is displayed, **When** the user selects option `[1] Update Application`, **Then** the tool automatically checks for local source modifications, packages the release if needed, applies zero-downtime hot-switch, and displays real-time step progress.
3. **Given** the interactive menu is displayed, **When** the user selects option `[4] View Logs`, **Then** the terminal streams real-time journal logs with an escape prompt to return back to the menu.

---

### User Story 2 - One-Step Smart Update with Auto-Packaging (Priority: P1)

As a developer modifying frontend or backend code, I want a single command or action to update the container directly from my current workspace, so that I don't have to manually build a release archive before updating.

**Why this priority**: Resolves the severe developer friction where running `./deploy.sh --update` silently deploys stale artifacts from `dist/releases/` or fails if no prior bundle was manually built.

**Independent Test**: Can be tested by editing a frontend or backend file, invoking the update command, and verifying that the live container reflects the newest code immediately with an updated version hash.

**Acceptance Scenarios**:

1. **Given** changes exist in the workspace `app/` directory, **When** an update is requested, **Then** the system detects modified source code, builds an ephemeral or timestamped release artifact automatically, and activates it in the container.
2. **Given** the workspace tree has no changes and a verified release package exists, **When** an update is requested, **Then** the system detects identical code hash and provides immediate feedback avoiding redundant virtualenv rebuilds.

---

### User Story 3 - Robust Custom Port & Network Configuration (Priority: P2)

As a system administrator running multiple services on the host, I want to bind `e-webui` to a custom host port without container networking collisions or proxy mismatch bugs, so that I can host the application on any desired port reliably.

**Why this priority**: Fixes a critical existing defect where specifying `-p <PORT>` configured the container internal uvicorn listener to the host port while the Incus proxy forwarded to container port 8080, causing total service unreachability.

**Independent Test**: Can be tested by provisioning or updating a container with a custom port (e.g. `9090`), followed by verifying that the host endpoint `http://127.0.0.1:9090/api/health` returns HTTP 200.

**Acceptance Scenarios**:

1. **Given** custom port `9090` is specified, **When** deployment completes, **Then** the Incus proxy device maps Host:9090 to Container:8080, and the container uvicorn listener binds stably to Container:8080.
2. **Given** an existing deployment with a port mismatch, **When** the diagnostic repair routine runs, **Then** the proxy device and service unit ports are harmonized automatically.

---

### User Story 4 - Multi-Architecture & Lightweight Modular Profiles (Priority: P2)

As a user on ARM64 or restricted network environments, I want the deployment system to install a lightweight core profile (<50MB RAM, zero PyTorch overhead) by default, with an optional modular opt-in for Kokoro TTS, so that installation is fast, offline-friendly, and portable across x86_64 and ARM64.

**Why this priority**: Fixes hardcoded `x86_64` standalone Python downloads that break ARM64 machines, prevents massive PyTorch CPU wheel bloat for users who only want chat UI, and avoids 30-minute hangs on HuggingFace downloads in restricted network environments.

**Independent Test**: Can be tested on a system without external HuggingFace access; the core chat application provisions and boots in under 30 seconds with minimal memory consumption.

**Acceptance Scenarios**:

1. **Given** a default installation without `--with-tts`, **When** virtual environment is provisioned, **Then** only core requirements (`fastapi`, `uvicorn`, `httpx`, `pydantic`) are installed, keeping runtime RAM under 50MB and avoiding standalone binary downloads on native Python 3.10-3.13.
2. **Given** deployment on an ARM64 machine, **When** system Python is used or standalone Python is needed, **Then** the system detects `aarch64` architecture and avoids fetching `x86_64` binaries.
3. **Given** TTS profile is requested, **When** network download fails or is offline, **Then** the core chat service remains fully operational with a clear warning and non-blocking retry helper.

---

### User Story 5 - Self-Healing Concurrency Locks & Reliable State Inspection (Priority: P3)

As an operator whose terminal session or host was abruptly disconnected during a deployment, I want stale concurrency locks to automatically expire or offer interactive cleanup, so that future deployments are not permanently blocked.

**Why this priority**: Eliminates unrecoverable lock contention where `.deploy.lock` remains inside the container indefinitely after an unexpected exit.

**Independent Test**: Can be tested by creating an artificial `.deploy.lock` with an obsolete timestamp/PID, running the deployment tool, and confirming that it detects the stale lock, prompts or auto-heals, and completes the operation.

**Acceptance Scenarios**:

1. **Given** a lock directory exists with a timestamp older than the timeout threshold (e.g., >10 minutes) or dead PID, **When** a new deployment begins, **Then** the system reports stale lock detection and automatically clears or prompts to override the lock.
2. **Given** active concurrent deployment is genuinely running, **When** a second command starts, **Then** the lock is respected and clean error feedback is given.

---

### Edge Cases

- **Container stopped or unresponsive**: The control center detects stopped state and automatically starts the container before attempting operations, or prompts the user.
- **Incus not installed or user not in `incus-admin` group**: The tool gives clear diagnostic steps on how to add the user to the Incus group without obscure bash tracebacks.
- **Offline / Air-gapped Host**: When no internet access is present, the tool operates seamlessly using pre-cached wheels or offline archive packages without trying to contact HuggingFace or PyPI.
- **Port already in use on host**: The tool probes host port availability before applying proxy devices and suggests available alternative ports.
- **Corrupted release tarball or invalid SHA256**: The tool rejects the package in staging and rolls back immediately to the previous intact version.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an interactive TUI management interface (`./ctl` or interactive `./deploy.sh`) when invoked in a terminal without flags.
- **FR-002**: System MUST retain backward compatibility for scripted/automated usage via non-interactive CLI flags (`--install`, `--update`, `--status`, `--repair`, `--rollback`, `--non-interactive`).
- **FR-003**: System MUST provide an automatic one-step update mechanism that automatically builds a release package from the repository if source changes are detected, eliminating the requirement to run `./build-release.sh` separately.
- **FR-004**: System MUST maintain strict decoupling between host port (`--port <PORT>`) and container port (fixed at `8080`), ensuring proxy devices map `Host:<PORT> -> Container:8080` while container uvicorn binds to `0.0.0.0:8080`.
- **FR-005**: System MUST support modular profiles: Core Profile (ultra-lightweight, <50MB RAM, fast install) and Enhanced Profile (optional TTS with Kokoro-82M).
- **FR-006**: System MUST perform architecture detection (`uname -m`) before downloading external standalone binaries, preventing execution of incompatible `x86_64` binaries on `aarch64`/ARM64 systems.
- **FR-007**: System MUST support native container Python versions (3.10 through 3.13) without enforcing external Python 3.11 downloads when the container OS already provides a compatible interpreter.
- **FR-008**: System MUST implement stale lock detection and recovery for `/opt/e-webui/.deploy.lock`, checking timestamp and process status to prevent permanent lockouts.
- **FR-009**: System MUST support local host test execution in `scripts/test.sh` as well as container-based execution using the container's active virtual environment rather than system python.
- **FR-010**: System MUST optimize state queries to avoid launching repeated Python interpreter subshells for reading single JSON keys.

### Key Entities

- **Deployment Control Center**: The unified interactive entrypoint providing real-time dashboard visualization, action menus, and lifecycle management.
- **Deployment Profile**: Configuration mode (`core` vs `tts-enabled`) determining installed packages, memory profile, and external asset downloads.
- **Deployment Lock**: Concurrency barrier containing PID, timestamp, and user information with self-healing lease expiration.
- **Release Staging**: Host and container staging pipeline that validates hashes, manifests, and systemd units before switching atomic pointers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Updating the application from local source requires only 1 interactive selection or 1 command (reduction from 2 manual commands to 1).
- **SC-002**: Default installation completes in under 60 seconds on standard broadband connections (reduced from 5-10 minutes due to separating heavy TTS downloads).
- **SC-003**: Core profile container RAM footprint remains strictly under 50 MB in active idle state.
- **SC-004**: Custom port deployments on ports other than 8080 achieve 100% first-attempt HTTP 200 health check pass rate.
- **SC-005**: In interactive mode, zero CLI flags or parameters are required for users to inspect status, update, restart, or view logs.
- **SC-006**: Automated test execution (`./scripts/test.sh --local`) runs 100% of unit tests successfully on host without requiring an active Incus daemon.

## Assumptions

- Users prefer an interactive terminal menu when running commands manually in an interactive terminal, but require flag-based predictability for CI/CD or scripts.
- Debian 13/stable remains the reference container operating system.
- Incus is available on Linux host systems with standard user group permissions.
- Voice/TTS is a high-value optional feature, but chat UI functionality is the core deliverable that must not be blocked when TTS dependencies fail.
