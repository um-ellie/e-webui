# Implementation Plan: Comprehensive README & .gitignore Modernization

**Branch**: `010-update-readme-gitignore` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-update-readme-gitignore/spec.md`

---

## Summary

Standardize and update the project documentation (`README.md`) and repository ignore rules (`.gitignore`) for `e-webui`. This plan establishes an English-first bilingual format with an explicit zero-emoji rule, contiguous 5-step onboarding, and complete feature coverage (including theme toggling, thinking mode, markdown rendering, and copy actions). In addition, `.gitignore` is audited and expanded to guarantee strict isolation for release packages, build artifacts, test caches, local runtime state, and editor files without risking tracked project components.

---

## Technical Context

**Language/Version**: GitHub Flavored Markdown (CommonMark), Git Ignore Pattern Syntax (fnmatch globbing), Python 3.8+ (for unicode and integrity validation scripts).  
**Primary Dependencies**: None (Standard markdown rendering engine, git).  
**Storage**: Repository-level documentation (`README.md`) and version control configuration (`.gitignore`).  
**Testing**: Python character verification scanner, bidirectional link checks, `git check-ignore` verification.  
**Target Platform**: GitHub / GitLab repository web viewers, terminal markdown viewers, Linux development workstations.  
**Project Type**: Documentation and Repository Hygiene.  
**Performance Goals**: Markdown parse time < 100ms; Automated validator script execution < 1 second.  
**Constraints**: Zero emojis in README; English section placed first; Absolute compliance with Constitution Principle I (zero Incus container modifications) and Principle II (workspace-only scope).  
**Scale/Scope**: Single repository root files (`README.md`, `.gitignore`).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check / Constraint | Status | Notes |
| :--- | :--- | :--- | :--- |
| **I. Infrastructure Isolation (NON-NEGOTIABLE)** | Zero `incus` command execution; zero live container modifications; mock-based or static testing only. | **PASS** | Documentation and `.gitignore` auditing are purely local workspace operations. No container interactions or Incus commands are executed. |
| **II. Workspace-Only Scope Boundary** | Operations strictly inside repository directory; no modifying host `/etc` or global systems. | **PASS** | Target files are strictly `${REPO_ROOT}/README.md` and `${REPO_ROOT}/.gitignore`. |
| **III. Transparent Delegation & Manual Hand-offs** | Production container deployment remains a manual user command (`deploy.sh`). | **PASS** | The README explicitly documents `./deploy.sh` and `incus` commands as instructions for the operator rather than automated background hooks. |

*Re-evaluation post-Phase 1*: All design artifacts (`research.md`, `data-model.md`, `contracts/`, `quickstart.md`) strictly adhere to workspace boundaries and infrastructure isolation.

---

## Project Structure

### Documentation (this feature)

```text
specs/010-update-readme-gitignore/
├── plan.md              # This implementation plan
├── research.md          # Phase 0: Architectural research & decisions
├── data-model.md        # Phase 1: Entity definitions and structural models
├── quickstart.md        # Phase 1: Verification scenarios and scripts
├── contracts/           # Phase 1: Interface and structural contracts
│   ├── readme-structure.md
│   └── gitignore-rules.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── spec.md              # Feature specification
```

### Source Code Layout

```text
e-webui/
├── .gitignore           # Enhanced repository ignore rules
├── README.md            # Modernized bilingual English-first documentation
├── build-release.sh     # Root wrapper for release packaging
├── deploy.sh            # Root wrapper for deployment manager
├── app/                 # FastAPI application source
├── scripts/             # Deployment and packaging bash scripts
├── tests/               # Local test suites
└── specs/               # Spec-Kit specifications
```

**Structure Decision**: No new application directories or source code packages are created. Modifications are strictly targeted at root `.gitignore` and `README.md` accompanied by design specifications under `specs/010-update-readme-gitignore/`.

---

## Complexity Tracking

> No constitution violations exist. All gates pass without exceptions.
