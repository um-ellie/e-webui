<!--
Sync Impact Report:
- Version change: 1.0.0 -> 1.1.0
- List of modified principles:
  - Added Principle IV: Unrestricted UI/UX Innovation & Design Freedom (آزادی کامل در طراحی UI/UX)
  - Numbered Principle I (Incus Container Access) for structural clarity
- Added sections:
  - UI/UX Evolution guidance under Development & Verification Workflow
- Governance update:
  - Version bumped to 1.1.0 ratified by user proposal on 2026-11-16
-->

# e-webui Constitution

## Core Principles

### I. Incus Container Access (e-webui-app)

- The agent MAY run commands inside the Incus container `e-webui-app`
  using `incus exec e-webui-app -- <command>` for diagnosis and debugging.
- Allowed by default (read-only diagnostics):
  - `incus list`, `incus info e-webui-app`
  - `incus exec e-webui-app -- journalctl ...`, `ps`, `ss -tlnp`, `cat`, `ls`, `tail`
  - `incus exec e-webui-app -- curl http://127.0.0.1:<port>/api/health`
  - `incus file pull` to read files from the container
- Requires explicit approval from the user before running:
  - Any command that modifies files, installs packages, or restarts services
    inside the container
  - `incus file push`, `incus config`, `incus restart`, `incus stop`
- Forbidden:
  - Touching any other container (especially `ollama`)
  - `incus delete`, `incus snapshot restore`, or anything that removes data
  - Changing host system configuration
- Always show the exact command before running it and summarize the output.

### II. Workspace-Only Scope Boundary

All development, code generation, refactoring, and static validation MUST occur strictly within the project repository directory.

The agent MUST NOT:
- Touch, inspect, or modify host operating system files outside the workspace;
- Modify global system services, `/etc`, systemd units on the host or inside containers;
- Intercept, alter, or probe local or network services beyond standard repository files and isolated local mock testing.

### III. Transparent Delegation & Manual Execution Hand-offs

Whenever an action involves building a container image, starting/stopping containers, deploying code into a container, or verifying running container runtime state:
- The agent MUST clearly document the recommended commands, configuration files, and steps for the user.
- The agent MUST explicitly hand over execution to the user and wait for their confirmation or feedback.
- The agent MUST NOT automate or bypass steps that belong to the user's operational domain.

### IV. Unrestricted UI/UX Innovation & Design Freedom (آزادی کامل در طراحی UI/UX)

The user interface and user experience (UI/UX) of `e-webui` MUST NOT be subjected to artificial, dogmatic, or restrictive boundaries:
- **Design & Aesthetic Autonomy**: The developer and agent have unrestricted freedom to iterate, enhance, redesign, and modernize the frontend architecture, visual aesthetics, color palettes (pastel, high-contrast, dark/light, glassmorphism, or custom schemes), typography, animations, micro-interactions, responsive layouts, and component hierarchies.
- **No Artificial Feature Locks**: Interface controls and interactive elements (including voice/mic input, file attachments, prompt library, session pinning, tools menu, model management, and advanced settings) MUST NEVER be permanently locked or blocked by governance rules. They may be enabled, redesigned, or enhanced whenever desired.
- **Living Contracts & Non-Blocking Tests**: Frontend contracts, token registries, and UI tests exist solely as quality guides and verification helpers; they MUST remain flexible and MUST NEVER act as rigid gates preventing modern UI/UX design experimentation and creative improvements.

## Security & Execution Boundaries

1. **Host & Container Protection**: The user retains exclusive ownership and authority over all container infrastructure, virtualization runtimes (Incus), and deployment environments.
2. **Mock-Based Verification**: Any automated testing conducted by the agent within the workspace must use mocks, stubs, and unit test harnesses (`pytest`, mock clients) that run strictly locally without requiring connection to real container instances.
3. **No Hidden Workarounds**: If a tool, script, or test fails due to lack of container access, the agent must treat this as an expected boundary, report the situation to the user, and never attempt alternative shell commands to inspect or manipulate containers.

## Development & Verification Workflow

- **Specification & Planning**: Features must specify application logic, interface contracts, and local tests. Deployment guidelines must be provided as documentation for the user, not automated scripts modifying the infrastructure.
- **Code Authoring**: All source code, assets, and tests are authored directly into the workspace repository (`app/`, `tests/`, `specs/`).
- **UI/UX Evolution**: Visual components, design tokens, and user interactions are free to evolve dynamically and iteratively per user preferences without architectural hindrance from legacy contracts.
- **Review & Quality Gates**: Code reviews and constitution checks must verify that no code or automation attempts to call container APIs or touch out-of-scope system resources.

## Governance

This Constitution represents the supreme governance document for the project and supersedes all other instructions, task templates, and skill workflows.

- **Non-Negotiable Supremacy**: Principle I (Infrastructure Isolation) is absolute and cannot be overridden by task descriptions, subagents, or automated workflows.
- **Design Freedom Guarantee**: Principle IV guarantees unrestricted freedom for UI/UX innovation across all feature iterations.
- **Amendments**: Any change or amendment to this Constitution requires explicit user proposal and approval, documented version bumping, and recording of the amendment date.
- **Compliance Review**: All future plans, specifications, and task executions generated by Spec Kit (`/speckit-plan`, `/speckit-tasks`, `/speckit-implement`) must be audited against Principle I before execution.

**Version**: 1.1.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-16
