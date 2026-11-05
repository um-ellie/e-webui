# Feature Specification: Deployment Script Hardening, Automated Container Creation & Lifecycle Improvements

**Feature Branch**: `004-enhance-deployment-script`

**Created**: 2026-11-05

**Status**: Clarified

**Input**: User description: "لطفا همه موارد آمده در گزاش را تصحیح و با پیشنهادهای خودتان بهتر کنید. ضمنا مراحل اسکریپت را از مرحله ساخت کانتینر شروع کنید. یعنی از کاربر یک نام برای کانتینر می گیرید و بعد چک می کنید که آیا incus نصب هست یا نه؟ اگر نصب بود که اسکریپت باید یک کانتینر حتما باید debian/13 یا آخرین نصخه debian stable باشد. را نصب می کند. و بقیه مراحل آماده سازی را اسکریپ مرحله به مرحله گام به گام انجام میدهد. حتی مراحل proxy کردن برای ارتباط با کانتینر ollama."

## Clarifications

### Session 2026-11-05
- Q: اگر نام کانتینری که کاربر وارد می‌کند از قبل در Incus وجود داشته باشد، اسکریپت باید چه رفتاری داشته باشد؟ → A: کانتینر موجود را تشخیص داده و وضعیت آن را نمایش دهد، سپس از کاربر بپرسد که آیا مایل است استقرار را روی همین کانتینر موجود ادامه دهد یا نام دیگری وارد کند.
- Q: در صورتی که کانتینری به نام `ollama` در Incus در حال اجرا نباشد، اسکریپت چگونه باید مقصد پروکسی Ollama را تعیین کند؟ → A: کشف خودکار هوشمند (بررسی کانتینر ollama در Incus، سپس بررسی پورت 11434 هاست)، و در صورت عدم پاسخگویی، پرسیدن آدرس دستی از کاربر به همراه پشتیبانی از پارامتر `--ollama-url`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - End-to-End Container Lifecycle from Creation to Service Verification (Priority: P1)

As an administrator on a host machine, I want the deployment script to prompt for a container name, verify that Incus is installed, and automatically launch a new pristine container (using Debian 13 or latest Debian stable) if it does not already exist, before proceeding step-by-step with dependency installation, code sync, proxy configuration, and service launch, so that I have a fully automated yet step-confirmed rollout from scratch.

**Why this priority**: Covers the primary expansion requested by the user, transforming the script from a pure configuration tool into a complete container provisioning and deployment pipeline.

**Independent Test**: Can be tested on a host with Incus installed by running the script with a fresh container name, confirming container launch, observing Incus launch `images:debian/13`, and stepping through proxy and service setup to a running application.

**Acceptance Scenarios**:

1. **Given** the deployment script is executed, **When** started, **Then** it checks for the existence of `incus` on the host, terminating with a clear installation prompt if `incus` is missing.
2. **Given** `incus` is present, **When** the user provides a container name that already exists, **Then** the script displays its status and prompts the user whether to reuse it or specify another name.
3. **Given** the container name does not exist, **When** confirmed by the user, **Then** the script launches a new container using `images:debian/13` (falling back to latest Debian stable if unavailable).
4. **Given** the container is launched and reachable, **When** the workflow advances, **Then** it proceeds through distinct interactive steps (proxy configuration, prerequisites, Python virtualenv, code sync, systemd unit, and health check).

---

### User Story 2 - Intelligent Ollama Discovery & Proxy Configuration (Priority: P2)

As an administrator configuring the application environment, I want the script to automatically probe for an Ollama instance (first in an Incus container named `ollama`, then on the host at `127.0.0.1:11434`), and fall back to asking me for an address or accepting `--ollama-url`, so that the internal container proxy (`127.0.0.1:11434`) reliably connects to my active AI model backend.

**Why this priority**: Ensures seamless LLM integration regardless of whether Ollama runs in another container, directly on the host, or on an external network endpoint.

**Independent Test**: Can be tested by running the script with Ollama in a sibling container, with Ollama on host, or with a custom `--ollama-url`, verifying the proxy device in the target container binds to the correct target.

**Acceptance Scenarios**:

1. **Given** an Incus container named `ollama` exists and is running, **When** the proxy step runs, **Then** the script detects its IP and targets it for proxying.
2. **Given** no `ollama` container exists but Ollama is running on host port 11434, **When** the proxy step runs, **Then** the script connects the proxy to host `127.0.0.1:11434`.
3. **Given** neither automated source is reachable, **When** the step runs, **Then** the script prompts the user for the Ollama IP/URL address.

---

### User Story 3 - Python Virtual Environment Isolation & Fail-Safe Execution (Priority: P3)

As a systems operator, I want Python dependencies to be installed inside a dedicated virtual environment (`/opt/e-webui/venv`) in the container and every command return code to be strictly checked (no masked errors via `|| true`), so that system packages are not compromised and any setup failure halts execution with actionable diagnostic feedback.

**Why this priority**: Prevents false-positive deployments where broken installations appear successful, and protects system stability by avoiding `--break-system-packages`.

**Independent Test**: Can be tested by simulating a network failure during dependency installation or reviewing the container filesystem to verify `/opt/e-webui/venv` is created and used by the systemd service.

**Acceptance Scenarios**:

1. **Given** the dependency preparation step, **When** Python tools are configured, **Then** the script builds `/opt/e-webui/venv` and installs `requirements.txt` into this virtual environment.
2. **Given** an error occurs during any step (APT update, pip download, proxy creation), **When** a command exits non-zero, **Then** the script halts execution, displays the exact failure, and does not record the step as completed.

---

### User Story 4 - Execution Independence, Root Access & Conflict Safety (Priority: P4)

As a developer running the script, I want to execute `./deploy.sh` directly from the repository root or from subdirectories without path breakage, and have host port availability checked before configuring proxies, so that deployment is frictionless and port conflicts are prevented upfront.

**Why this priority**: Ensures ease of use and prevents Incus proxy bind errors when host port 8080 is already in use.

**Independent Test**: Can be tested by running `./deploy.sh` from the root directory and from within `scripts/`, verifying that files are accurately synced in both cases.

**Acceptance Scenarios**:

1. **Given** a user is at the project root, **When** they execute `./deploy.sh`, **Then** the script resolves paths relative to the repository root and transfers files accurately.
2. **Given** host port 8080 is already occupied by another service, **When** the proxy step runs, **Then** the script detects the conflict prior to configuring Incus and warns the user.

---

### User Story 5 - True HTTP Health Verification & Diagnostics (Priority: P5)

As an administrator verifying the rollout, I want the health check to perform an actual HTTP readiness probe to the web UI and verify the Ollama proxy connection, so that I am certain the user interface and AI backend are truly operational.

**Why this priority**: Differentiates between a running systemd process and a functional web application that is actively serving traffic.

**Independent Test**: Can be tested by letting deployment complete and verifying that the final step polls `http://127.0.0.1:8080` until HTTP 200 is received before displaying the success banner.

**Acceptance Scenarios**:

1. **Given** the systemd service is started, **When** the verification step runs, **Then** it conducts an HTTP probe against the service endpoint with retries until healthy.
2. **Given** the Ollama proxy device is configured, **When** verification runs, **Then** it tests reachability to Ollama (`http://127.0.0.1:11434/api/tags`) from within the container.

---

### Edge Cases

- What happens if `incus` is not installed on the host machine?
  - The script prints a clear error message indicating Incus is required, gives installation hints, and exits with code 2.
- What happens if the container already exists from a previous run or manual creation?
  - The script inspects the existing container's state, informs the user, and asks whether they wish to reuse this container or enter a different name.
- What happens if the `images:debian/13` image download fails due to network issues?
  - The script catches the image launch failure, reports the issue, and allows the user to retry or specify an alternative image tag (e.g. `images:debian/12` or `images:debian/stable`).
- What happens if host port 8080 is in use?
  - The script detects the bound port and allows passing an alternative port via `--port` flag.
- What happens if neither the `ollama` container nor host Ollama is responding?
  - The script prompts the user to enter the Ollama address or flags `--ollama-url`, and warns if Ollama remains unreachable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The deployment script MUST check for the presence of the `incus` binary on the host before attempting any container operations.
- **FR-002**: The script MUST interactively prompt for a container name if not provided as an argument, validating alphanumeric characters, dashes, and underscores.
- **FR-003**: If the specified container name already exists, the script MUST detect it, display its status, and prompt the user to choose between reusing it or entering a new name.
- **FR-004**: If the target container does not exist, the script MUST create and launch it using Debian 13 (`images:debian/13` or latest Debian stable).
- **FR-005**: The script MUST automatically detect the Ollama service (first in an Incus container named `ollama`, second on host `127.0.0.1:11434`), or prompt the user for an address, and configure the `ollama-link` proxy device accordingly.
- **FR-006**: The script MUST configure Incus proxy devices for the application web interface (Host 127.0.0.1:8080 -> Container 8080).
- **FR-007**: The script MUST configure a dedicated Python virtual environment at `/opt/e-webui/venv` inside the container and install all dependencies from `requirements.txt` into it.
- **FR-008**: The systemd service unit MUST be configured to execute the application using the virtual environment's interpreter/uvicorn binary.
- **FR-009**: The script MUST eliminate silent error suppression (`|| true`), verifying command exit codes and halting on failure.
- **FR-010**: The deployment script MUST dynamically resolve the repository root directory regardless of current working directory.
- **FR-011**: A root-level `./deploy.sh` wrapper or symlink MUST be provided for direct project root execution.
- **FR-012**: The final health verification MUST include an active HTTP probe against the web interface with retries and a reachability check to the Ollama endpoint.
- **FR-013**: The script MUST support diagnostic inspection (`--status`) and clean removal (`--clean` / `--uninstall`).

### Key Entities

- **Incus Container Instance**: The target virtualized instance provisioned with Debian 13/stable.
- **Deployment State**: The recorded state tracking step completion to support idempotent resumption.
- **Service & Proxy Configuration**: The systemd service unit and Incus network proxy devices linking the host, container, and Ollama service.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A complete deployment from scratch (container creation to active web UI) can be executed in under 4 minutes on a standard broadband connection.
- **SC-002**: 100% of failed steps produce non-zero exit codes with descriptive failure diagnostics.
- **SC-003**: 100% of successful deployments pass an active HTTP 200 readiness probe before presenting the completion banner.
- **SC-004**: Zero contamination of the container's system Python packages.
- **SC-005**: Deploy script can be executed with zero path errors from any working directory.

## Assumptions

- The host environment has Incus installed and initialized (`incus admin init` already completed).
- Network access to the Incus image server (`images:`) is available to pull the Debian image.
- Ollama is running either on the host or inside a sibling Incus container named `ollama`, or on an accessible network address.
- In accordance with Project Constitution Principle I, the agent will author and validate the deployment script inside the workspace repository, delegating actual container execution to the user.
