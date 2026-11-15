# Implementation Plan: Pastel Design System and UI/UX Overhaul

**Branch**: `021-pastel-ui-overhaul` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-pastel-ui-overhaul/spec.md`

## Summary

Complete visual and architectural UI/UX overhaul of `e-webui`. This plan redesigns the visual theme with a modern, minimalist soft pastel color palette across both Dark and Light modes (`style.css`), completely removes the obsolete "Interface Language" dropdown and its dead references across the codebase while preserving per-message RTL/LTR detection, repairs responsive layout and popover clipping bugs on smaller viewports, upgrades collapsible thought animations using `grid-template-rows`, styles code blocks with distinct pastel chrome, and streamlines the Settings dialog with functional parameter controls.

## Technical Context

**Language/Version**: Modern Vanilla JavaScript (ES2022+ modules, no bundler needed), HTML5, CSS3 Custom Properties & Grid/Flexbox. Python 3.10+ for unit tests and local server.

**Primary Dependencies**: Native Browser Web APIs (DOM, IndexedDB, CSS Variables, ResizeObserver), vendored libraries (`marked.min.js`, `prism.min.js`, `dompurify.min.js`).

**Storage**: Browser `localStorage` (UI preferences, active model, sidebar collapse state) and `IndexedDB` (chat history and messages).

**Testing**: `python3 -m unittest discover tests/unit` for contract validation and unit test suites; manual responsive scenario validation via DevTools.

**Target Platform**: Evergreen desktop and mobile browsers (Chrome, Firefox, Safari, Edge) on viewports ranging from 320px to 4K displays.

**Project Type**: Single-page web application frontend for local Ollama LLM engine.

**Performance Goals**: 60 FPS fluid transitions on collapsible thought blocks, instant theme switching (<100ms) with zero layout shift, code block copy feedback within 100ms.

**Constraints**:
- Absolute compliance with Constitution Principle I (Infrastructure Isolation): all changes strictly confined to workspace (`app/static/`, `specs/`, `tests/`).
- Zero external build/transpilation step: pure modular ES6 and CSS.
- Preserve per-message RTL/LTR script detection without global interface direction interference.

**Scale/Scope**: 1 unified stylesheet (`app/static/style.css`), 1 HTML entrypoint (`app/static/index.html`), 5 core component controllers (`settings.js`, `composer.js`, `sidebar.js`, `chat.js`, `header.js`), and feature contract files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Infrastructure Isolation (NON-NEGOTIABLE)**: PASS. All files modified belong strictly to `app/static/` and `specs/`. No container runtime, systemd services, or host packages outside workspace are touched.
- **Principle II: Workspace-Only Scope Boundary**: PASS. All static validation, file updates, and unit testing run strictly locally inside `/home/ellie/Documents/Projects/e-webui`.
- **Principle III: Transparent Delegation & Manual Execution Hand-offs**: PASS. Any deployment or container testing instructions are documented as manual steps for the user.

## Project Structure

### Documentation (this feature)

```text
specs/021-pastel-ui-overhaul/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (/speckit-plan command output)
├── research.md          # Technical decisions & research (/speckit-plan command)
├── data-model.md        # Entity & state models (/speckit-plan command)
├── quickstart.md        # Validation scenarios guide (/speckit-plan command)
├── checklists/
│   └── requirements.md  # Spec quality validation checklist
└── contracts/           # Interface and token contracts
    ├── ui-features.json
    └── theme-tokens.json
```

### Source Code Layout (affected files)

```text
app/static/
├── index.html                   # HTML shell (settings modal cleanup, composer structure)
├── style.css                    # Complete pastel theme tokens, transitions, popovers, chrome
└── js/
    ├── features.js              # Centralized feature availability registry
    ├── i18n.js                  # Cleaned up / removed dead language code
    ├── rtl.js                   # Message-level bidirectional script detector (preserved)
    └── components/
        ├── settings.js          # Settings dialog (remove language selector, wire parameters)
        ├── composer.js          # Model picker popover bounds, send/stop button states
        ├── sidebar.js           # Session items, context menus, connection indicator
        ├── chat.js              # Collapsible thought accordion, code block copy feedback
        └── header.js            # Glassmorphism header, status pills, overflow menu

tests/unit/
└── test_ui_contracts.py         # UI contract validation tests
```

**Structure Decision**: Single-project web application layout with centralized static assets in `app/static/`.

## Complexity Tracking

*No constitutional violations or unjustified complexity.*
