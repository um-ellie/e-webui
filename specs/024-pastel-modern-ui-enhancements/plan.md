# Implementation Plan: Pastel Design System and Modern UI/UX Overhaul

**Branch**: `024-pastel-modern-ui-enhancements` | **Date**: 2026-11-20 | **Spec**: [spec.md](file:///home/ellie/Documents/Projects/e-webui/specs/024-pastel-modern-ui-enhancements/spec.md)

**Input**: Feature specification from `specs/024-pastel-modern-ui-enhancements/spec.md`

## Summary

Complete visual and practical modernization of `e-webui` introducing:
1. **Curated 4-Palette Pastel Design System**: `matcha` (Sage & Sand), `lavender` (Lavender Breeze), `peach` (Peach Sorbet & Rose), and `ocean` (Ocean Mist & Mint), each featuring individually balanced Light and Dark modes with zero theme flash.
2. **Modern Frosted Glassmorphism & Tactile Micro-Interactions**: Translucent blurred surfaces (`backdrop-filter: blur(16px)`), subtle ambient pastel glow shadows, 14px–24px organic radii, and fluid spring animations.
3. **Full Chat Productivity Suite**: Message hover action dock (instant copy with morphing checkmark, Kokoro TTS playback, prompt edit, retry), empty canvas pastel starter cards, collapsible reasoning drawer with elapsed time badge, and pinned conversation management in IndexedDB.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2022+ native modules), HTML5, CSS3 Custom Properties, Python 3.11+ (FastAPI backend).

**Primary Dependencies**: None added to frontend (uses existing native web standards, Marked, DOMPurify, Prism); existing backend dependencies (`fastapi`, `uvicorn`, `httpx`).

**Storage**:
- Browser `localStorage`: `ewebui_palette` (`'matcha' | 'lavender' | 'peach' | 'ocean'`), `ewebui_theme` (`'system' | 'light' | 'dark'`), `ewebui_font_scale` (90..120).
- Browser `IndexedDB` (`ewebui_chats`): Extended `ChatSession` objects with `pinned?: boolean`.

**Testing**: Local mock tests (`pytest`), browser console verification, static token & contract validation.

**Target Platform**: Modern desktop & mobile web browsers (Chrome, Edge, Safari, Firefox), Linux server runtime.

**Project Type**: Full-stack Local Web Application.

**Performance Goals**: 60fps scrolling with active backdrop blur; theme/palette switch under 100ms with zero layout shifts; zero theme flash before first paint.

**Constraints**: Offline-capable, zero third-party remote CDN dependencies, strict adherence to Constitution Principles I & IV.

**Scale/Scope**: ~6 frontend source files (`index.html`, `style.css`, `theme.js`, `app.js`, `db.js`, `components/`) and accompanying test scripts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Incus Container Access (e-webui-app)**: PASSED. All plan tasks and validations run locally in the workspace using unit mocks and local dev server. No container state is modified.
- **Principle II: Workspace-Only Scope Boundary**: PASSED. Changes are strictly confined to `app/static/`, `specs/024-pastel-modern-ui-enhancements/`, and `tests/`.
- **Principle III: Transparent Delegation & Manual Execution Hand-offs**: PASSED. Verification commands are clearly documented in `quickstart.md` for local testing.
- **Principle IV: Unrestricted UI/UX Innovation & Design Freedom**: PASSED. Principle IV explicitly guarantees complete autonomy to enhance pastel palettes, glassmorphism, micro-interactions, typography, and interactive controls without artificial hindrance.

*Post-Design Evaluation: All gates PASSED.*

## Project Structure

### Documentation (this feature)

```text
specs/024-pastel-modern-ui-enhancements/
├── spec.md                  # Feature specification with clarified choices
├── checklists/
│   └── requirements.md      # Specification quality checklist
├── plan.md                  # This file
├── research.md              # Phase 0 research and architectural decisions
├── data-model.md            # Phase 1 entities, interfaces, and state transitions
├── contracts/
│   └── ui-contracts.md      # CSS tokens matrix and DOM component contracts
└── quickstart.md            # Local execution and verification guide
```

### Source Code (repository root)

```text
app/
├── static/
│   ├── index.html           # Pre-paint theme/palette script, SVG symbols, starter cards
│   ├── style.css            # 4-palette CSS tokens, glassmorphism, docks, animations
│   └── js/
│       ├── theme.js         # Palette & theme switcher with localStorage persistence
│       ├── app.js           # Event listeners for docks, starters, and thought toggles
│       ├── db.js            # IndexedDB session schema with pinned flag support
│       └── tts.js           # Existing Kokoro TTS integration wired to message dock
tests/
├── unit/
└── ...
```

**Structure Decision**: Standard web application with FastAPI serving static assets from `app/static/`. Frontend enhancements operate within clean ES modules without build tooling overhead.

## Complexity Tracking

> **No violations**. Clean adherence to project architecture and design freedom constitution.
