# Implementation Plan: Modern AI Chat & Ollama Connection UI/UX Overhaul

**Branch**: `022-modern-ai-chat-ux` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/022-modern-ai-chat-ux/spec.md` and concrete reference design prototype `specs/022-modern-ai-chat-ux/reference-design.html`.

## Summary

Execute a complete ground-up visual and structural overhaul of the `e-webui` frontend based on the Soft Sage & Warm Sand design system with subtle rose accents. The legacy dark-navy styling, broken header status pill, and cluttered composer are replaced with a high-ergonomics contextual clean capsule composer, an authoritative sidebar connection widget with upward diagnostics popover, a 3-state radio-group header theme switcher, an asymmetric start-aligned empty canvas, and a 3-pane task-oriented Settings dialog. Full functional parity across all endpoints and data storage is strictly preserved and verified via end-to-end automated browser testing.

## Technical Context

**Language/Version**: HTML5, Vanilla JavaScript (ES2022 Modules), Modern CSS3 (Custom properties, CSS Grid, Flexbox, backdrop-filter). Python 3.11+ for FastAPI backend (untouched).  
**Primary Dependencies**: Marked.js (vendored), DOMPurify (vendored), Prism.js (vendored) for markdown/code rendering. No external NPM frameworks or remote CDN dependencies.  
**Storage**: Client-side IndexedDB (`app/static/js/db.js`) for conversations; `localStorage` for theme, font scale, and inference parameter defaults. Zero schema changes.  
**Testing**: Automated headless browser testing suite (`tests/e2e-ui-validation.mjs`) targeting `e-webui-app` on port 8080. Unit tests with `pytest`.  
**Target Platform**: Linux server/containers (Incus `e-webui-app`), modern desktop and mobile web browsers (Chrome, Firefox, Safari, Edge).  
**Project Type**: Web Application (Single Page Application frontend + FastAPI backend proxy).  
**Performance Goals**: Instantaneous theme switching (<50ms), smooth 60fps streaming animations without layout shift, zero flash of unstyled theme on page reload.  
**Constraints**: Zero backend route modifications; zero database schema migrations; strict offline/airgapped capability (no external asset calls); WCAG AA contrast compliance.  
**Scale/Scope**: Complete frontend redesign covering `index.html`, `style.css`, and modular JavaScript components (`header.js`, `sidebar.js`, `composer.js`, `settings.js`, `chat.js`, `app.js`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Requirement | Plan Compliance Status | Validation |
| :--- | :--- | :--- | :--- |
| **Principle I: Incus Container Access** | Read-only commands allowed for diagnosis/tests; no touching `ollama` container directly. | **PASS** | Tests execute curl commands against `e-webui-app` on port 8080; no commands modify container packages or systemd units. |
| **Principle II: Workspace-Only Scope** | All development and refactoring strictly within repository directory (`app/`, `tests/`, `specs/`). | **PASS** | Modifications are isolated to `app/static/` and `tests/`; no host system files touched. |
| **Principle III: Transparent Delegation** | Clear commands and documentation for container execution. | **PASS** | Documented step-by-step in `quickstart.md`. |
| **Principle IV: Unrestricted UI/UX Innovation** | Full freedom to redesign visual aesthetics, pastel palette, typography, and component ergonomics. | **PASS** | Ground-up visual redesign implementing Soft Sage & Warm Sand, contextual capsule composer, and 3-pane settings. |

## Project Structure

### Documentation (this feature)

```text
specs/022-modern-ai-chat-ux/
├── spec.md                  # Active feature specification with clarification consensus
├── plan.md                  # Implementation plan (this file)
├── research.md              # Technical decisions and architecture rationale
├── data-model.md            # Entity models, state transitions, and chip rules
├── quickstart.md            # Runnable verification guide and scenario steps
├── contracts/               # Component markup and state contracts
│   └── ui-contracts.md      # Header, connection, composer, and settings contracts
├── reference-design.html    # Standalone functional design reference prototype
└── checklists/
    └── requirements.md      # Specification quality checklist
```

### Source Code Architecture

```text
app/
├── static/
│   ├── index.html           # Main SPA HTML structure (header, sidebar, stage, composer, settings)
│   ├── style.css            # Complete design system tokens, typography, and component styling
│   ├── img/                 # SVG logos (logo-animated.svg, mark.svg, favicons)
│   ├── fonts/               # Self-hosted fonts (Inter, Vazirmatn, JetBrains Mono, Source Serif 4)
│   ├── vendor/              # Marked.js, DOMPurify, Prism.js
│   └── js/
│       ├── app.js           # Application bootstrapping and component mounting
│       ├── store.js         # Reactive state store and event emitter
│       ├── api.js           # REST & SSE backend client
│       ├── health.js        # Canonical health normalization and connection state machine
│       ├── theme.js         # Theme management and localStorage synchronization
│       └── components/
│           ├── header.js    # Header bar, rename trigger, 3-state segmented theme switcher
│           ├── sidebar.js   # Collapsible sidebar, session list, footer connection capsule & popover
│           ├── composer.js  # Contextual clean capsule composer, '+' menu, Think/Preset chips
│           ├── chat.js      # Message stream, thinking blocks, code headers, hover action bars
│           └── settings.js  # 3-pane task settings dialog, sliders, danger zone confirmation
tests/
└── e2e-ui-validation.mjs    # End-to-end automated browser test suite
```

## Complexity Tracking

*No constitutional violations; no unnecessary complexity introduced. Pure vanilla JavaScript and native CSS tokens preserve high performance and airgap resilience.*
