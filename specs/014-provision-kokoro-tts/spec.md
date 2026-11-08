# Feature Specification: Kokoro-82M TTS Deployment Provisioning

**Feature Branch**: `014-provision-kokoro-tts`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Upgrade the e-webui deployment lifecycle manager (scripts/deploy.sh and scripts/lib/*.sh, building on spec 008) so that it automatically provisions everything needed to run the Kokoro-82M text-to-speech model inside the existing e-webui-app Incus container. This feature only prepares the deployment environment; the read-aloud feature itself (API endpoint and UI button) is a separate, later spec and is out of scope here."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fresh Installation with Automated TTS Provisioning (Priority: P1)

An operator installs e-webui into a fresh container. The deployment tool automatically provisions a compatible Python environment (3.10–3.12) alongside the container's base system Python, installs required operating system audio packages, installs TTS dependencies (Kokoro, soundfile, CPU-only PyTorch) into the isolated virtual environment, and downloads the Kokoro-82M model weights into a persistent directory. Once finished, the container has a fully initialized TTS-ready environment without any manual intervention.

**Why this priority**: Core value of the feature. Enables headless, unattended deployment of the full application runtime including local TTS capability.

**Independent Test**: Can be tested on a clean container by running `deploy.sh --install`. The deployment completes successfully, the application service starts, and running an in-container synthesis verification command succeeds on CPU.

**Acceptance Scenarios**:

1. **Given** a fresh container running Debian 13 with system Python 3.13, **When** the operator runs `deploy.sh --install`, **Then** the deployment tool provisions a compatible Python interpreter (3.10–3.12), installs required system libraries (`espeak-ng`, `libsndfile`), builds the application virtual environment with Kokoro and CPU-only PyTorch, downloads the model weights to a persistent shared location, and starts the service in a healthy state.
2. **Given** a newly installed deployment, **When** the application virtual environment is invoked to test speech synthesis, **Then** Kokoro imports cleanly and generates audio without attempting external network calls.

---

### User Story 2 - Seamless Migration of Existing Deployments (Priority: P1)

An operator updates an existing deployment whose current release uses a Python 3.13 virtual environment. The deployment tool automatically detects that the current virtual environment uses an interpreter incompatible with Kokoro, provisions a compatible Python version, recreates the application virtual environment with the required dependencies, preserves all existing state and configuration, and activates the new release without manual intervention or service corruption.

**Why this priority**: Existing installations must not break or require manual operator recovery when updating to releases requiring Kokoro TTS.

**Independent Test**: Can be tested by executing `deploy.sh --update` against an existing deployment that runs under Python 3.13. The tool detects the incompatibility, transparently upgrades the virtual environment, and switches releases smoothly with zero manual intervention.

**Acceptance Scenarios**:

1. **Given** an active deployment running on Python 3.13, **When** the operator executes `deploy.sh --update`, **Then** the deployment lifecycle manager detects the incompatible interpreter, provisions a compatible Python interpreter, rebuilds the release virtual environment with TTS packages, switches the release atomically, and preserves the operational status of the chat application.
2. **Given** an update that fails health checks during release switching, **Then** the automatic rollback mechanism successfully restores the previous release and its corresponding virtual environment.

---

### User Story 3 - Resilient Deployment Under Network Constraints (Priority: P2)

An operator in a region with restricted or degraded internet connectivity (such as Iran) deploys or updates the application. Direct connections to upstream model repositories or package mirrors may be throttled or blocked. The deployment manager supports proxy and mirror configurations, and if model weights cannot be downloaded, the deployment does not abort or rollback; instead, it completes the application deployment, logs a clear warning, and provides instructions for retrying the model download.

**Why this priority**: Network unreliability must not prevent the core chat service from deploying or running. The chat service remains 100% operational even when the model download is deferred.

**Independent Test**: Can be tested by running `deploy.sh --install` or `deploy.sh --update` with network connectivity to model repositories blocked. The core application deploys successfully, passes health checks, and prints a clear warning and retry command.

**Acceptance Scenarios**:

1. **Given** an environment where model repository endpoints are unreachable, **When** the operator executes `deploy.sh --update`, **Then** package installation succeeds (via configured proxy or mirror), the model download attempt logs a non-fatal warning, the deployment completes with a success exit status for the application, and the operator is shown the exact command to fetch the model weights later.
2. **Given** proxy or mirror environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `PIP_INDEX_URL`, `HF_ENDPOINT`), **When** the deployment manager runs, **Then** all package and asset retrieval steps route through the specified proxies or mirror endpoints.

---

### User Story 4 - Dedicated Model Weights Lifecycle Management (Priority: P2)

An operator wants to update application code frequently without re-downloading multi-hundred megabyte model weights, or wants to manage the model asset download independently from application updates. The operator can skip model downloads during routine updates using `--skip-model-download`, or explicitly trigger the model download on demand using `--download-model`.

**Why this priority**: Avoids redundant data transfers on restricted bandwidth, speeds up code releases, and enables retrying failed model downloads without full redeployments.

**Independent Test**: Can be tested by running `deploy.sh --update --skip-model-download` to verify that no model download is attempted, and running `deploy.sh --download-model` to verify that only missing model assets are downloaded into the persistent storage location.

**Acceptance Scenarios**:

1. **Given** an existing deployment where model weights are already present in persistent storage, **When** a new release is deployed via `deploy.sh --update`, **Then** the existing model weights are reused without re-downloading.
2. **Given** an operator performing a rapid code deployment, **When** invoking `deploy.sh --update --skip-model-download`, **Then** the deployment tool bypasses model acquisition entirely.
3. **Given** a deployment missing model weights, **When** the operator runs `deploy.sh --download-model`, **Then** the tool downloads and verifies the model weights in persistent storage without restarting or disrupting the active application service.

---

### User Story 5 - Operational Verification and Self-Healing Repair (Priority: P3)

An operator inspects or repairs the deployment. The status command (`deploy.sh --status`) displays the active Python interpreter version, the status of TTS dependencies, and the presence and integrity of the local model weights. The repair command (`deploy.sh --repair`) detects missing or damaged components (such as missing system packages, broken virtual environment dependencies, or absent model weights) and restores them to a healthy state.

**Why this priority**: Ensures long-term maintainability, quick troubleshooting, and automated recovery without requiring manual container debugging.

**Independent Test**: Can be tested by running `deploy.sh --status` to inspect diagnostic output, and intentionally corrupting a dependency or deleting the model weights and running `deploy.sh --repair` to verify self-healing.

**Acceptance Scenarios**:

1. **Given** an active deployment, **When** running `deploy.sh --status`, **Then** the output displays the active Python runtime version, the verification status of TTS packages, and the presence of Kokoro model weights.
2. **Given** a deployment with missing system audio packages or absent model weights, **When** running `deploy.sh --repair`, **Then** the missing system packages are reinstalled and missing model weights are retrieved, returning the environment to a verified healthy state.

---

### Edge Cases

- **Model Download Interruption**: If the network connection drops while downloading model weights, partial files must not be left in a corrupted state that prevents future attempts. Downloads must use temporary files and atomic movement upon validation.
- **Repeated Execution (Idempotency)**: Running `--install`, `--update`, or `--download-model` multiple consecutive times must complete rapidly without re-downloading packages, rebuilding unaffected virtual environments, or replacing intact model files.
- **Rollback Consistency**: When rolling back to an earlier release via `deploy.sh --rollback`, the deployment must restore the symlinks and virtual environment of that earlier release while continuing to reference the shared persistent model storage.
- **Offline Runtime Enforcement**: When the application runs under systemd, it must be configured with environment variables ensuring that TTS libraries read exclusively from local persistent storage and do not initiate automatic downloads at inference time.
- **Disk Space Exhaustion**: If disk space is insufficient to download model weights, the download must fail gracefully, emit an explicit error explaining the required space, and leave the application service running.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The deployment lifecycle manager MUST ensure that a Python interpreter compatible with Kokoro (versions 3.10 through 3.12) is available in the deployment environment without replacing, removing, or corrupting the base operating system Python 3.13.
- **FR-002**: The deployment lifecycle manager MUST install and verify all required system-level packages for speech synthesis and audio processing (specifically `espeak-ng` and `libsndfile1`) during fresh installation and environment repair.
- **FR-003**: The deployment lifecycle manager MUST provision the application's release virtual environment using the compatible Python interpreter and install required speech dependencies including Kokoro, soundfile, and CPU-only PyTorch.
- **FR-004**: The deployment lifecycle manager MUST store Kokoro-82M model weights in a persistent, shared storage directory that survives across new releases and rollbacks.
- **FR-005**: The deployment lifecycle manager MUST automatically detect existing deployments utilizing an incompatible Python interpreter (such as Python 3.13) during `--update` and rebuild the release virtual environment using the compatible interpreter without manual intervention.
- **FR-006**: A failed or unreachable model weights download MUST NOT cause the overall deployment or update to fail and MUST NOT trigger an automatic rollback.
- **FR-007**: When a model weights download fails or is skipped, the deployment lifecycle manager MUST log a prominent warning and display the exact CLI command to retrieve or retry downloading the model weights later.
- **FR-008**: The deployment lifecycle manager MUST provide a CLI option `--skip-model-download` to bypass model asset acquisition during install and update operations.
- **FR-009**: The deployment lifecycle manager MUST provide a dedicated CLI command/option `--download-model` to download and verify model weights into persistent storage without executing a full application deployment.
- **FR-010**: All provisioning operations (system package installation, virtual environment creation, package installation, and model downloading) MUST be strictly idempotent, skipping steps when targets are already present and healthy.
- **FR-011**: The deployment lifecycle manager MUST configure the application systemd service unit with environment variables pointing to the local persistent model location and directing runtime libraries to operate fully offline.
- **FR-012**: The deployment lifecycle manager MUST support download proxies and repository mirrors via standard environment variables (including `HTTP_PROXY`, `HTTPS_PROXY`, `PIP_INDEX_URL`, and `HF_ENDPOINT`) and propagate them to package managers and model download utilities.
- **FR-013**: The `--status` command MUST report the active Python runtime version, import verification status of Kokoro and audio dependencies, and presence of the Kokoro-82M model weights.
- **FR-014**: The `--repair` command MUST verify and automatically restore missing system packages, broken virtual environment dependencies, and missing model weights.
- **FR-015**: All existing lifecycle safety mechanisms (exclusive deployment locks, atomic release symlink switching, application health checks, automatic rollback on health check failure, and release history retention) MUST remain fully operational.
- **FR-016**: All new commands and options MUST be documented in `deploy.sh --help` and adhere to existing error reporting and exit code conventions.

### Key Entities

- **Deployment Environment**: Represents the runtime host/container configuration, including OS packages, the persistent shared storage root, systemd services, and the active release symlink.
- **Compatible Python Runtime**: The Python 3.10–3.12 interpreter instance provisioned specifically for application execution, distinct from the system default Python 3.13.
- **Application Virtual Environment**: An isolated Python environment tied to a specific release, built with the compatible interpreter and containing all application and TTS library dependencies.
- **Persistent Model Store**: A shared directory located outside individual release directories (e.g., in the shared state/data hierarchy) holding immutable Kokoro-82M model weights and voice assets shared across all releases.
- **Deployment Manifest / State**: The deployment tracking state recording the active release, provisioned interpreter paths, model presence flags, and configuration settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a clean container, a single unattended execution of `deploy.sh --install` results in a healthy, running service where speech synthesis of a test sentence succeeds on CPU.
- **SC-002**: On an existing deployment running Python 3.13, a single execution of `deploy.sh --update` completes migration to a compatible interpreter with zero manual configuration steps and zero downtime for the existing chat service during preparation.
- **SC-003**: Consecutive executions of `deploy.sh --update` on an unchanged environment complete verification and release switching in under 20 seconds, re-downloading 0 bytes of packages or model weights.
- **SC-004**: If network access to model repositories is blocked, 100% of deployment executions complete the core chat deployment successfully, pass application health checks, and log clear retry instructions.
- **SC-005**: Across multiple successive code updates, model weights are downloaded at most once, maintaining zero duplicate weight files across releases.
- **SC-006**: Diagnostic inspection via `deploy.sh --status` accurately identifies each TTS component's readiness state (interpreter version, dependency import status, model weight availability) across all deployment stages.

## Assumptions

- The container CPU and memory resources are sufficient to perform Kokoro-82M text-to-speech inference (recommended: at least 2 cores and 1GB free RAM).
- The container storage has at least 1.5 GB of free space available to store the compatible Python build, audio dependencies (including PyTorch CPU wheels), and the Kokoro model files.
- The web chat application will gracefully handle missing model weights at runtime by disabling read-aloud features until weights are present, without crashing the core web UI or Ollama chat proxy.
- Direct interaction with container hypervisors or container configurations from automated agents remains strictly prohibited per project constitution; all execution of `deploy.sh` commands is performed by the operator on the container host.
- TTS API endpoints, UI read-aloud buttons, voice selection controls, and Ollama configuration changes are explicitly out of scope for this specification and will be addressed in subsequent feature specifications.
