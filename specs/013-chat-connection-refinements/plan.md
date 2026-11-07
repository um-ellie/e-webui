# Implementation Plan: Chat Connection Fix and Composer Refinements

**Branch**: `013-chat-connection-refinements` | **Date**: 2026-11-07 | **Spec**: [specs/013-chat-connection-refinements/spec.md](file:///home/ellie/Documents/Projects/e-webui/specs/013-chat-connection-refinements/spec.md)

**Input**: Feature specification from `/specs/013-chat-connection-refinements/spec.md`

## Summary

Fix the end-to-end model reply streaming pipeline (prevent empty model string payloads, extract reasoning from `<think>` tokens, provide visible loading and error states with Retry actions, and preserve multi-turn dialogue context), relocate the model picker from the header to an upward listbox menu inside the composer bottom-right row per `design/reference/chat-mock-v2.html`, update the send button to the Enter symbol (↵) with a disabled microphone button, fix sidebar collapse layout breakage across all viewport widths, and completely purge empty-state prompt suggestion chips.

## Technical Context

**Language/Version**: Python 3.11+ (FastAPI backend), HTML5, CSS3, Modern JavaScript (ES2022 Modules) with zero build step.

**Primary Dependencies**:
- Backend: FastAPI, Uvicorn, Pydantic, HTTPX.
- Frontend: Vendored `marked.min.js`, `dompurify.min.js`, self-hosted local web fonts and SVG icon kit.

**Storage**:
- In-memory `ChatStore` during user session.
- Browser `localStorage` for non-sensitive preferences (`ewebui_theme`, `ewebui_font_size`, `ewebui_sidebar_collapsed`, `ewebui_last_model`).

**Testing**:
- `unittest` for backend contracts, security sanitization, and simulated Ollama streaming test harness (`test_stream_pipeline.py`).
- Static layout and interaction checks against `design/reference/chat-mock-v2.html`.

**Target Platform**: Modern web browsers (Desktop, Tablet, Mobile from 360 px to 4K).

**Performance Goals**:
- Initial token visible in UI within 300 ms of arriving at backend.
- Flawless 60 fps streaming animation without layout shift.
- Model picker upward popover transition within 120–160 ms.

**Constraints**:
- Strict adherence to Constitution Principle I: ZERO interaction with Incus or container runtimes. All automated verification uses mock/simulated streams.
- Zero external network requests; all assets self-hosted locally.
- Safe Markdown sanitization via DOMPurify.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Infrastructure Isolation (NON-NEGOTIABLE)
- **Status**: PASSED
- **Verification**: Zero `incus` commands, zero container manipulation, zero network/proxy modifications. Automated testing uses an in-memory/mock test client.

### Principle II: Workspace-Only Scope Boundary
- **Status**: PASSED
- **Verification**: All modifications are strictly within the repository workspace (`app/`, `specs/`, `design/`, `tests/`).

### Principle III: Transparent Delegation & Manual Execution Hand-offs
- **Status**: PASSED
- **Verification**: User testing against the live Ollama container is documented as manual steps in `quickstart.md`.

## Project Structure

### Documentation (this feature)

```text
specs/013-chat-connection-refinements/
├── plan.md              # Implementation plan (this file)
├── research.md          # Root cause analysis & technical decisions
├── data-model.md        # Entities & refined API payloads
├── quickstart.md        # Interactive & automated validation guide
├── contracts/           # Updated UI feature & API schemas
│   ├── ui-features.json
│   └── backend-api.yaml
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
app/
├── main.py                  # Stream logging, request ID tracking, error handling
├── models.py                # PromptRequest with optional history context
├── services/
│   └── ollama_client.py     # Thinking token extraction, connection resilience
└── static/
    ├── index.html           # Composer bottom row per mock v2, removed chips & header model dropdown
    ├── style.css            # Model picker upward popover, Enter send icon, mic button, sidebar rail stability
    └── js/
        ├── app.js           # Guarded initialization ensuring valid active model
        ├── store.js         # Multi-turn context export and model persistence
        ├── features.js      # Registered mic and model picker controls
        ├── api.js           # Robust SSE stream parser and failure classifier
        └── components/
            ├── chat.js      # Loading model indicator, thinking extraction, retry cards
            ├── composer.js  # Relocated model picker, Enter send icon, disabled mic, history dispatch
            ├── sidebar.js   # Compact mark for collapsed rail, responsive stability
            ├── header.js    # Removed model dropdown; clean title and overflow
            └── empty.js     # Clean greeting and brand mark; zero chips
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
