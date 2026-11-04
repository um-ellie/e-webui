# Tasks: Secure Ollama Web UI Container

**Input**: Design documents from `/specs/001-ollama-web-ui/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-contract.md`, `quickstart.md`  

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`) for story-specific phases
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository initialization, directory layout, and base dependencies

- [X] T001 Create core project directory layout in `app/services/`, `app/static/`, `app/systemd/`, `scripts/`, `tests/unit/`, and `tests/integration/`
- [X] T002 [P] Create Python dependency manifest in `requirements.txt` with `fastapi`, `uvicorn[standard]`, `httpx`, `pydantic`, `pytest`, and `pytest-asyncio`
- [X] T003 [P] Create environment configuration module in `app/config.py` defining `OLLAMA_HOST` (default: `"http://127.0.0.1:11434"`), `APP_HOST` (`"127.0.0.1"`), and `APP_PORT` (`8080`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data models, test harness, and base application routing that all user stories depend on

**⚠️ CRITICAL**: Must be completed before user story implementation begins

- [X] T004 Create Pydantic data schemas in `app/models.py` for `PromptRequest` (fields: `model: str`, `prompt: str` (min 1 char), `system: str | None`, `stream: bool = True`, `temperature: float = 0.7`), `StreamChunk` (fields: `token: str`, `done: bool`, `eval_count: int | None`), and `ModelItem`
- [X] T005 [P] Setup base FastAPI application factory and error handling in `app/main.py`
- [X] T006 [P] Create test configuration, mock HTTP client, and mock Ollama responses in `tests/conftest.py`

**Checkpoint**: Foundation ready — User Story 1 implementation can now proceed

---

## Phase 3: User Story 1 - Interactive Prompting via Browser (Priority: P1) 🎯 MVP

**Goal**: Deliver a fully working web interface where a user can select an Ollama model, enter a prompt, and view real-time streaming tokens.

**Independent Test**: Run the FastAPI application, visit `http://127.0.0.1:8080`, submit a prompt ("Why is the sky blue?"), and confirm response tokens stream incrementally into the chat window.

### Tests for User Story 1

- [X] T007 [P] [US1] Unit test Ollama client functions (`get_tags` and `stream_generate`) against mock streaming responses in `tests/unit/test_ollama_client.py`
- [X] T008 [P] [US1] Integration test for `/api/models` and `/api/generate` SSE stream endpoints in `tests/integration/test_endpoints.py`

### Implementation for User Story 1

- [X] T009 [US1] Implement asynchronous Ollama HTTP client in `app/services/ollama_client.py` using `httpx.AsyncClient` supporting model discovery and token streaming generator
- [X] T010 [US1] Implement API route handlers in `app/main.py` for `GET /api/models`, `POST /api/generate` (with `StreamingResponse` media type `text/event-stream`), and `GET /api/health`
- [X] T011 [P] [US1] Create responsive single-page chat layout in `app/static/index.html` with model selector dropdown, chat log container, prompt textarea, and send/stop button
- [X] T012 [P] [US1] Create modern self-contained dark/light CSS stylesheet in `app/static/style.css` (clean bubbles, markdown code block styling, zero CDN dependencies)
- [X] T013 [US1] Implement client-side streaming handler in `app/static/app.js` using `fetch()` and `ReadableStream`/`TextDecoder` to parse incoming SSE tokens, auto-scroll chat, and populate models dropdown

**Checkpoint**: User Story 1 is completely functional and testable locally on `127.0.0.1:8080`

---

## Phase 4: User Story 2 - Automated Boot & Systemd Service Execution (Priority: P2)

**Goal**: Package and deploy the application as an auto-starting systemd service inside the `webui` Incus container so it runs automatically on container boot with zero manual commands.

**Independent Test**: Execute `incus restart webui` and verify `incus exec webui -- systemctl is-active ollama-webui` reports `active`.

### Implementation for User Story 2

- [X] T014 [US2] Create systemd service unit file in `app/systemd/ollama-webui.service` configured for `/opt/ollama-webui`, virtualenv python, automatic restart, and loopback binding
- [X] T015 [US2] Implement deployment script in `scripts/deploy.sh` to copy application files into the `webui` Incus container (`/opt/ollama-webui`), setup virtual environment, install requirements, and enable/start `ollama-webui.service`
- [X] T016 [US2] Test container reboot cycle via `incus restart webui` and verify systemd service auto-start behavior

**Checkpoint**: Service starts automatically on container boot and survives reboots

---

## Phase 5: User Story 3 - Secure Access Control & Container Isolation (Priority: P3)

**Goal**: Verify strict localhost loopback proxy binding on the host, disable heavy legacy background services (`open-webui.service` to reclaim 1.2+ GB RAM), and validate air-gapped container-to-container link.

**Independent Test**: Query `127.0.0.1:8080` from host successfully, verify external network interfaces are blocked, and verify container memory usage is under 50 MB RSS.

### Implementation for User Story 3

- [X] T017 [US3] Disable and stop legacy heavy `open-webui.service` inside the `webui` container (`incus exec webui -- systemctl disable --now open-webui`) to reclaim 1.2+ GB of system memory
- [X] T018 [US3] Verify Incus proxy devices (`webui-proxy` listening on `127.0.0.1:8080` and `ollama-link` connecting to `127.0.0.1:11434`), verifying host-only access and inter-container link

**Checkpoint**: Container is lightweight (<50 MB RAM), completely isolated from external network, and only reachable from host `127.0.0.1:8080`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Automated test runner, validation against quickstart scenarios, and project documentation

- [X] T019 [P] Create automated test runner script in `scripts/test.sh` executing `pytest` with coverage report
- [X] T020 Run end-to-end validation scenarios according to `specs/001-ollama-web-ui/quickstart.md`
- [X] T021 [P] Create documentation in `README.md` explaining container setup, Incus device configuration, and everyday usage commands

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent — executes first
- **Foundational (Phase 2)**: Depends on Setup — blocks all User Stories
- **User Story 1 (Phase 3)**: Depends on Foundational — delivers MVP web chat
- **User Story 2 (Phase 4)**: Depends on US1 — packages application into systemd service in Incus container
- **User Story 3 (Phase 5)**: Depends on US2 — secures loopback binding and stops bloated legacy service
- **Polish (Phase 6)**: Depends on all user stories being completed

### Parallel Opportunities

- `T002` and `T003` can execute in parallel during Setup
- `T005` and `T006` can execute in parallel during Foundational
- `T007` and `T008` (tests) can run in parallel with frontend markup `T011` and `T012`
- `T019` and `T021` can run in parallel during Polish

---

## Implementation Strategy: MVP First

1. Complete **Phase 1** (Setup) & **Phase 2** (Foundational)
2. Complete **Phase 3** (User Story 1: FastAPI + Chat UI + Streaming)
3. Validate User Story 1 locally as working MVP
4. Complete **Phase 4** & **Phase 5** (Deploy into Incus `webui` container, enable systemd auto-start, disable heavy `open-webui` service)
5. Run final validation in **Phase 6**
