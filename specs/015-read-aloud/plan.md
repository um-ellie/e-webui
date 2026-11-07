# Implementation Plan: Read Aloud TTS for Assistant Replies

**Branch**: `015-read-aloud` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-read-aloud/spec.md`

## Summary

Add a lightweight, responsive "read aloud" feature to the e-webui chat application. A small speaker icon button under completed assistant replies allows users to listen to English replies synthesized on CPU via the local Kokoro-82M model in American English (`af_heart` voice). The backend exposes an authenticated `/api/tts/synthesize` endpoint that strips code blocks and Markdown syntax before running non-blocking CPU inference, returning standard 24kHz PCM WAV audio. The frontend manages a singleton audio controller, caches audio blobs per message for instant replay during the session, enforces single-track playback, stops audio on chat thread changes, and hides the button for Persian and code-only messages.

## Technical Context

**Language/Version**: Python 3.10–3.12 (in-container execution environment; compatibility with Kokoro); ES2022 JavaScript in browser.

**Primary Dependencies**:
- Backend: `FastAPI>=0.110.0`, `pydantic>=2.6.0`, `kokoro>=0.8.4` (in-container pre-provisioned), `soundfile>=0.12.1`, `torch>=2.2.0` (CPU-only).
- Frontend: Vanilla JavaScript (ES modules), HTML5 `Audio` element, Web APIs (`URL.createObjectURL`, `Blob`).

**Storage**: Persistent local disk storage for model weights at `/opt/e-webui/shared/models/kokoro/` (`kokoro-v1_0.pth` or `kokoro-v0_19.pth` and `voices/` directory). Browser in-memory `Map` for session audio blob caching.

**Testing**: `pytest`, `pytest-asyncio`, `httpx` (using mocks and stubs for Kokoro pipeline, ensuring local test execution without containers or external network calls).

**Target Platform**: Linux container (`e-webui-app` on Incus Debian container) running on host CPU; client browsers (Chrome, Firefox, Safari, Edge).

**Project Type**: Web application (FastAPI backend + vanilla JS single-page frontend).

**Performance Goals**:
- Time-to-first-sound: <4 seconds on standard container CPU allocations after initial lazy load.
- Replay from cache: <100 milliseconds.
- Concurrency protection: Chat SSE streaming jitter remains 0ms during TTS synthesis.

**Constraints**:
- Strictly CPU-only inference.
- Offline runtime: No outbound internet access required (`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`).
- Principle I Constitution compliance: Agent does not modify or invoke containers.

**Scale/Scope**: Single fixed voice (`af_heart`), American English only, max text length 3,000 characters, single active audio stream per client session.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Infrastructure Isolation (NON-NEGOTIABLE)**:
  - *Compliance*: The implementation plan touches only workspace repository files (`app/`, `tests/`, `specs/`). No `incus` commands, container configurations, or host system files are modified. In-container testing instructions are documented as manual operator hand-offs in `quickstart.md`.
  - *Status*: **PASSED**

- **Principle II: Workspace-Only Scope Boundary**:
  - *Compliance*: All code, tests, and static assets reside within the repository directory.
  - *Status*: **PASSED**

- **Principle III: Transparent Delegation & Manual Execution Hand-offs**:
  - *Compliance*: Validation procedures are separated into automated local workspace tests and manual operator steps in `quickstart.md`.
  - *Status*: **PASSED**

## Project Structure

### Documentation (this feature)

```text
specs/015-read-aloud/
├── plan.md              # This implementation plan
├── research.md          # Technical analysis & architectural decisions
├── data-model.md        # Data models and client state definitions
├── quickstart.md        # Test instructions and manual verification steps
├── contracts/
│   └── tts-api-contract.md  # API specification for /api/tts/synthesize
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
app/
├── config.py                 # Configuration settings (adds KOKORO_MODEL_DIR)
├── models.py                 # Pydantic schemas (adds TTSRequest)
├── main.py                   # FastAPI app (adds POST /api/tts/synthesize)
├── services/
│   ├── __init__.py
│   ├── ollama_client.py      # Existing Ollama proxy
│   ├── text_cleaner.py       # Text preprocessor (strips code blocks, markdown, emojis)
│   └── tts_service.py        # In-process Kokoro singleton, lazy load, CPU inference
└── static/
    ├── css/ or style.css     # CSS rules for speaker icon (idle, loading, playing)
    └── js/
        ├── app.js            # App orchestrator (wires TTS events to store)
        ├── tts.js            # TTSController (audio element, blob URL caching, lifecycle)
        ├── rtl.js            # Script detection utilities
        └── components/
            └── chat.js       # Action bar rendering with speaker button

tests/
├── conftest.py
├── unit/
│   ├── test_text_cleaner.py  # Unit tests for text normalization and speakable filter
│   ├── test_tts_service.py   # Unit tests for TTS service discovery and fallbacks
│   └── test_ui_contracts.py  # Unit tests for UI speaker button presence & states
└── integration/
    └── test_tts_endpoint.py  # API tests for /api/tts/synthesize endpoint
```

**Structure Decision**: The project maintains its established web application architecture: FastAPI backend in `app/` and modular vanilla ES modules in `app/static/js/`. The TTS feature introduces two dedicated service modules (`text_cleaner.py` and `tts_service.py`), one client controller (`tts.js`), and updates existing view components (`chat.js`) without altering existing chat or Ollama abstractions.

## Complexity Tracking

> **No constitutional violations or unjustified complexity introduced.**

| Component / Pattern | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| In-process Singleton Service | Encapsulates lazy weight loading and status tracking without repeating disk checks on each request. | Loading weights on every request would add 1–3s latency to every playback. |
| `asyncio.to_thread` with Semaphore | Offloads CPU-bound tensor generation to a worker thread and limits concurrent synthesis. | Running directly in the async event loop would block chat SSE streaming tokens. |
| Client-Side Blob Cache | Instant replays without redundant server CPU processing. | Re-synthesizing on every click wastes CPU cycles and adds unnecessary playback delay. |
