# Implementation Plan: Claude-Style Chat UI Redesign (Appearance Phase)

**Branch**: `012-chat-ui-redesign` | **Date**: 2026-11-07 | **Spec**: [specs/012-chat-ui-redesign/spec.md](file:///home/ellie/Documents/Projects/e-webui/specs/012-chat-ui-redesign/spec.md)

**Input**: Feature specification from `/specs/012-chat-ui-redesign/spec.md`

## Summary

Redesign the full e-webui client interface to match the serene, modern, and spacious aesthetic of Claude (claude.ai), incorporating the official brand logo kit with terminal blinking cursor (`> ~/.E _`), pastel color tokens (`--rose: #AD3960`, `--purple: #6A4892`, `--bg: #F6FBFE` in light mode; `--rose: #E5779B`, `--purple: #B79DE0`, `--bg: #110E20` in dark mode), local font typography (Inter, Source Serif 4, JetBrains Mono, Vazirmatn), an in-memory session management store, and a single centralized feature-availability registry (`features.js`) for upcoming capabilities.

## Technical Context

**Language/Version**: Python 3.11+ (FastAPI backend), HTML5, CSS3, Modern JavaScript (ES2022 ES Modules) with zero build step.

**Primary Dependencies**:
- Backend: FastAPI, Uvicorn, Pydantic, HTTPX.
- Frontend: Vendored `marked.min.js` (Markdown parsing) and `dompurify.min.js` (XSS sanitization); bundled SVG icons and local WOFF2 web fonts. Zero frontend bundlers or frameworks.

**Storage**:
- In-memory client-side session store (`ChatStore`) during the session.
- Browser `localStorage` for non-sensitive UI preferences only (`theme`, `fontSize`, `sidebarCollapsed`, `interfaceLanguage`). Zero storage of authentication tokens in JavaScript.

**Testing**:
- `pytest` for backend API contracts, security sanitization, and model streaming tests.
- Static visual and DOM verification against `design/reference/chat-mock.html`.

**Target Platform**: Modern standards-compliant web browsers (Desktop, Tablet, Mobile from 360 px up to 4K viewports).

**Project Type**: Web Application (FastAPI serving static assets and REST/SSE endpoints).

**Performance Goals**:
- First Contentful Paint < 1.0 second on local network.
- 60 fps typing and scrolling responsiveness up to 500+ messages in a single thread.
- Zero layout shifting or visual stutter during token streaming.

**Constraints**:
- Strict adherence to Constitution Principle I: ZERO interaction with Incus or container runtimes.
- Zero external runtime network requests: all fonts, icons, styles, and scripts served from local filesystem.
- Safe Markdown rendering without script execution (WCAG 2.2 AA compliant contrast).

**Scale/Scope**: Single-page application covering 8 screens/views (login, empty chat, active chat, settings dialog, model selector dropdown, sidebar navigation, responsive drawers, and future feature tooltips).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Infrastructure Isolation (NON-NEGOTIABLE)
- **Status**: PASSED
- **Verification**: The plan contains zero `incus` commands, zero container commands, and zero modifications to Incus configurations or host services. All verification is performed locally within the workspace via mocks and local browser inspection.

### Principle II: Workspace-Only Scope Boundary
- **Status**: PASSED
- **Verification**: All file operations and created assets reside strictly within the workspace directory (`app/`, `design/`, `specs/`, `tests/`).

### Principle III: Transparent Delegation & Manual Execution Hand-offs
- **Status**: PASSED
- **Verification**: Deployment actions or container lifecycle tasks are explicitly documented as user execution steps in `quickstart.md`; the agent does not automate container state changes.

## Project Structure

### Documentation (this feature)

```text
specs/012-chat-ui-redesign/
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 architectural decisions & research
├── data-model.md        # Phase 1 frontend & API data models
├── quickstart.md        # Phase 1 verification & run guide
├── contracts/           # Phase 1 external & UI contracts
│   ├── ui-features.json # Central feature registry contract
│   └── backend-api.yaml # FastAPI REST and SSE endpoint schema
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
app/
├── main.py                  # FastAPI server and static asset routes
├── models.py                # Pydantic data schemas
├── config.py                # Host and port configuration
├── services/
│   └── ollama_client.py     # Upstream Ollama SSE streaming client
└── static/
    ├── index.html           # Single-page application skeleton
    ├── style.css            # Design tokens and component styles
    ├── fonts/               # Bundled local fonts (Inter, Source Serif 4, JetBrains Mono, Vazirmatn)
    ├── img/                 # Brand SVG icons, logo kit, and favicons
    ├── vendor/              # Vendored dependencies (marked.min.js, dompurify.min.js)
    └── js/                  # Vanilla ES modules
        ├── app.js           # Application bootstrapping and event bus
        ├── store.js         # In-memory ChatStore implementation
        ├── features.js      # Centralized feature-availability registry
        ├── api.js           # Backend communication and SSE stream handler
        ├── markdown.js      # Markdown parser, sanitizer, and code chrome
        ├── rtl.js           # Bilingual direction and Persian font detector
        ├── theme.js         # Light/Dark/System theme switcher
        └── components/      # Modular UI view renderers
            ├── sidebar.js   # Sidebar navigation and chat history
            ├── header.js    # Header, model dropdown, and actions
            ├── chat.js      # Reading column, bubbles, and streaming cursor
            ├── composer.js  # Auto-growing composer card and tools
            ├── settings.js  # Settings modal dialog
            └── empty.js     # Time-aware greeting and starter chips

tests/
├── unit/
│   ├── test_markdown_security.py # XSS sanitization tests
│   ├── test_validation.py        # Payload validation tests
│   └── test_ui_contracts.py      # Contract tests for feature registry
└── conftest.py
```

**Structure Decision**:
- Retains existing FastAPI single-service architecture with plain HTML/CSS/JS frontend located in `app/static/`.
- Decomposes frontend JavaScript into clean ES Modules (`app/static/js/`) without introducing build steps or bundlers.
- Embeds all font assets locally under `app/static/fonts/` to enforce 100% offline self-hosted capability.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
