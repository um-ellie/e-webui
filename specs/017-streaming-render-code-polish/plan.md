# Implementation Plan: Streaming Render Optimization and Offline Code Syntax Polish

**Branch**: `017-streaming-render-code-polish` | **Date**: 2026-11-14 | **Spec**: [specs/017-streaming-render-code-polish/spec.md](spec.md)

**Input**: Feature specification from `/specs/017-streaming-render-code-polish/spec.md`

## Summary

Optimize the live token streaming rendering pipeline in `ChatView` using a `requestAnimationFrame` throttled micro-batching loop (~40ms interval), decoupling network SSE ingestion from DOM layout calculations to eliminate main-thread CPU spikes and dropped frames during 50–100 tok/s generation. Vendor a lightweight, offline-capable Prism.js syntax highlighter supporting standard developer languages (Python, JS, TS, Bash, JSON, YAML, SQL, HTML, CSS, Markdown) with theme-aware syntax colors in both light and dark mode. Polish reasoning accordions with smooth CSS grid transitions, elevate dark mode code block contrast, and apply custom subtle scrollbars.

## Technical Context

**Language/Version**: HTML5, CSS3, Modern JavaScript (ES2022 Modules) with zero build step; Python 3.11+ (FastAPI backend).

**Primary Dependencies**:
- Frontend: Vendored `marked.min.js`, `dompurify.min.js`, and newly vendored offline `prism.min.js`. Zero external network or CDN dependencies.
- Browser APIs: `window.requestAnimationFrame`, `window.cancelAnimationFrame`, `navigator.clipboard`.

**Storage**:
- In-memory `RenderThrottleState` during active stream rendering.
- No database or persistent storage alterations required.

**Testing**:
- Python `unittest` suite for Markdown escaping, syntax token parsing, and security sanitization (`test_markdown_security.py`).
- Browser interactive validation for 60 fps streaming and syntax highlighting (`quickstart.md`).

**Target Platform**: Modern web browsers (Chromium, Firefox, Safari, WebKit) on Desktop, Tablet, and Mobile.

**Performance Goals**:
- Main-thread CPU time dedicated to Markdown parsing during streaming reduced by at least 60%.
- Solid 60 fps scrolling and UI responsiveness during active token generation.
- Syntax highlighting pass completed in under 50 ms upon code block arrival.

**Constraints**:
- Strict adherence to Constitution Principle I: Zero container modifications, mock-based verification.
- 100% offline-isolated: All syntax grammars and assets self-hosted locally without CDN calls.
- Strict LTR isolation: Code blocks remain strictly LTR (`dir="ltr"` and `unicode-bidi: isolate`) regardless of surrounding text direction.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Infrastructure Isolation (NON-NEGOTIABLE)
- **Status**: PASSED
- **Verification**: Zero `incus` commands, zero container tampering. All changes are static client-side scripts, stylesheets, and unit tests.

### Principle II: Workspace-Only Scope Boundary
- **Status**: PASSED
- **Verification**: All modifications are strictly within the repository workspace (`app/static/`, `specs/017-streaming-render-code-polish/`, `tests/`).

### Principle III: Transparent Delegation & Manual Execution Hand-offs
- **Status**: PASSED
- **Verification**: Browser verification steps for streaming smoothness and syntax highlighting are documented in `quickstart.md`.

## Project Structure

### Documentation (this feature)

```text
specs/017-streaming-render-code-polish/
├── plan.md              # Implementation plan (this file)
├── research.md          # Streaming bottlenecks, Prism evaluation, syntax tokens
├── data-model.md        # RenderThrottleState, CodeBlockDescriptor, SyntaxThemeMapping
├── quickstart.md        # Interactive & automated validation scenarios
├── contracts/           # Code syntax and render pipeline contracts
│   ├── code-syntax-contract.md
│   └── render-pipeline-contract.md
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
app/
├── static/
│   ├── index.html               # Include vendored prism.min.js script tag
│   ├── style.css                # Syntax token color rules, smooth reasoning transition, dark mode contrast, custom scrollbars
│   ├── vendor/
│   │   └── prism.min.js         # [NEW] Vendored lightweight Prism.js core + standard language grammars
│   └── js/
│       ├── markdown.js          # Integrate Prism syntax highlighting in Marked renderer
│       └── components/
│           └── chat.js          # Implement RAF throttled streaming loop and stable cursor management
tests/
└── unit/
    └── test_markdown_security.py # Unit tests for syntax token output and escaping
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
