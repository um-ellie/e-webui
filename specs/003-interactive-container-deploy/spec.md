# Feature Specification: Interactive and Resumable Container Deployment

**Feature Branch**: `003-interactive-container-deploy`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "می خوام روی اسکریپت deploy بیشتر کار بشه به این شکل که بعد از اجرای اسکریپت deploy در داخل کامپیوتر host. از شخص یک نام کانتینر incus درخواست بکند. و بعد از دریافت نام کانتینر همه تنظیمات را تا آخرین مرحله با کانتینر مورد نظر انجام دهد. آماده سازی کانتینر، نصب برنامه های مورد نیاز، کپی فایل های مورد نیاز از host به کانتینر، آماده سازی اجرای خودکار و بقیه چیزها. اسکریپت باید همه مراحله را در صفحه چاپ کند و هر مرحله ای که بخواهد انجام دهد. قبل انجام باید از کاربر درخواست اجازه کند و یا تایید بخواهد. اگر کاربر مرحله ای را تایید نکند اسکریپت باید به کاربر اطلاع دهد با عدم اجرای این مرحله نصب انجام نخواهد شد و در صورت اصرار کاربر باید نصب را متوقف کند. در صورت اجرای دوباره اسکریپت باید بتواند تشخص دهد تا چه مرحله ای پیش رفته است و از مرحله بعد آن اجرا کند. تا کارهای قبلی خراب نشود."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interactive Step-by-Step Container Deployment (Priority: P1)

As a system administrator deploying the application from a host machine, I want the deployment script to prompt for the target container name and request confirmation before executing each discrete phase of setup, so that I have full visibility and control over all changes applied to my containerized environment.

**Why this priority**: Interactive step execution and container targeting form the core operational journey requested by the user, providing safety and transparency during rollout.

**Independent Test**: Can be fully tested by running the script on a host machine, entering a target container name, confirming each step prompt sequentially, and verifying that each preparation, file synchronization, service configuration, and verification step completes successfully.

**Acceptance Scenarios**:

1. **Given** the host deployment script is initiated without predefined container arguments, **When** the script starts, **Then** it prompts the user to enter the target container name and validates that a non-empty name was provided.
2. **Given** a valid container name has been specified, **When** the script begins the deployment workflow, **Then** it prints an overview of all planned deployment stages before taking action.
3. **Given** the workflow reaches a deployment step, **When** the step is presented, **Then** the script displays a clear summary of what will be performed and pauses for explicit user confirmation before executing.
4. **Given** the user confirms an individual step, **When** the step executes, **Then** the script performs the actions, displays the step result (success or failure), and advances to the next step.

---

### User Story 2 - Resumable State Detection Across Re-runs (Priority: P2)

As an administrator who may pause or interrupt an ongoing deployment (or rerun it after addressing external container issues), I want the script to automatically detect previously completed steps and resume from the first incomplete step, so that existing configurations are not repeated unnecessarily and previous progress is preserved.

**Why this priority**: Prevents redundant actions, avoids clobbering existing configuration, saves administrative time, and ensures safe idempotency when operations are interrupted.

**Independent Test**: Can be tested by interrupting the script halfway through deployment, executing it again with the same container name, and verifying that the script detects prior completed stages, skips them with clear notification, and resumes at the next pending step.

**Acceptance Scenarios**:

1. **Given** a previous deployment attempt was stopped after completing step 2, **When** the user re-executes the deployment script for the same container, **Then** the script inspects the deployment state, informs the user which steps are already completed, and starts confirmation from step 3.
2. **Given** all deployment steps have already succeeded for the target container, **When** the deployment script is run again, **Then** the script reports that the deployment is already complete and healthy, offering the user a choice to re-verify or exit safely.

---

### User Story 3 - Safe Rejection and Abort Handling (Priority: P3)

As an administrator evaluating a deployment step, I want the script to explain the consequences if I decline a step, and allow me to either reconsider or cleanly abort the process without damaging the container.

**Why this priority**: Protects users from accidental partial installations while honoring administrator authority to halt deployment when conditions are not suitable.

**Independent Test**: Can be tested by answering "no" to a confirmation prompt at an intermediate stage, observing the warning message, confirming the cancellation, and verifying that the script exits cleanly without executing subsequent phases.

**Acceptance Scenarios**:

1. **Given** a confirmation prompt for a required deployment step, **When** the user declines confirmation, **Then** the script warns the user that skipping this step prevents successful deployment completion and requests secondary confirmation to abort or proceed.
2. **Given** the user insists on declining the required step, **When** abort is confirmed, **Then** the script terminates execution gracefully, records the current progress state, and prints clear instructions on how to resume later.

---

### Edge Cases

- What happens when the user enters a container name that does not exist or is currently stopped?
  - The script checks container accessibility; if missing, it halts with a clear error; if stopped, it prompts the user to confirm starting the container before continuing.
- What happens when a step fails due to network timeout or command error?
  - The script captures the error, displays diagnostic output, halts without marking the failed step as completed, and allows the user to re-run once the issue is fixed.
- What happens if the state tracking file or marker within the container is corrupted or manually deleted?
  - The script gracefully falls back to inspecting environmental evidence (e.g., verifying if directories, packages, or services exist) or prompts the user whether to restart from step 1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The deployment script MUST interactively prompt the user for the target container name at startup if not provided via command line.
- **FR-002**: The deployment script MUST validate container existence and state, prompting the user for approval to start the container if it is stopped.
- **FR-003**: The deployment script MUST organize the deployment process into sequential, distinct steps:
  1. Container availability and runtime verification.
  2. Container environment and prerequisite preparation (package installation).
  3. Application source and configuration synchronization from host to container.
  4. Automatic service configuration, daemon reload, and startup registration.
  5. Application health verification and live status reporting.
- **FR-004**: The deployment script MUST print a summary roadmap of all deployment steps to the terminal upon startup.
- **FR-005**: The deployment script MUST display an explicit description before each step and require interactive user confirmation (`y/N`) before proceeding.
- **FR-006**: If the user declines a step, the deployment script MUST inform the user that proceeding without this step will prevent functional deployment, asking if they wish to abort or reconsider.
- **FR-007**: If the user confirms cancellation, the deployment script MUST exit cleanly with a non-zero exit code and informative exit summary.
- **FR-008**: The deployment script MUST persist and detect progress state per target container, enabling resumption from the earliest pending or uncompleted step upon re-invocation.
- **FR-009**: The deployment script MUST allow an optional flag or prompt option to force a clean re-run of all steps if explicitly requested by the user.
- **FR-010**: The deployment script MUST verify the final running state of the deployed application service and display the service status and accessibility endpoint.

### Key Entities

- **Deployment Execution Session**: Represents a single deployment invocation, tracking target container name, active execution step, user inputs, and session timestamp.
- **Deployment Step Definition**: Represents an atomic unit of deployment work containing step number, title, description, execution action, validation check, and prerequisite step dependencies.
- **Deployment State Record**: Represents the persisted progress record associated with a container, indicating completed steps, timestamps, and last successful phase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can complete an end-to-end guided deployment in under 3 minutes on an active container.
- **SC-002**: 100% of deployment steps require explicit administrative authorization before executing mutable changes.
- **SC-003**: In the event of process interruption, re-running the script resumes at the exact interrupted step without re-executing already completed steps in 100% of test scenarios.
- **SC-004**: Zero unintended container changes occur when an administrator rejects a step prompt and confirms abort.
- **SC-005**: 100% of step transitions and status diagnostics are printed in human-readable output indicating clear progress.

## Assumptions

- The user executes the deployment script on the host system where container management CLI tools are installed and configured with proper user permissions.
- The target container is a Linux-based environment compatible with systemd service supervision and standard shell utilities.
- The host directory contains the application codebase (`app/`), dependencies specification (`requirements.txt`), and service definition (`app/systemd/e-webui.service`).
- The agent authoring this specification will NOT execute container commands directly, strictly adhering to project Constitution Principle I (Infrastructure Isolation) and Principle III (Transparent Delegation).
