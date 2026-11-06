# Tasks: Security Hardening, Bug Fixes, and Code Optimization

**Input**: Design documents from `specs/011-security-and-code-optimization/` (`plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)  
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes explicit file paths

---

## Phase 1: Setup (Shared Infrastructure & Dependency Splitting)

**Purpose**: Dependency separation and repository cleanup

- [X] T001 Separate development and testing dependencies into `requirements-dev.txt`
- [X] T002 Update `requirements.txt` to contain only runtime dependencies (`fastapi`, `uvicorn[standard]`, `httpx`, `pydantic`)
- [X] T003 [P] Remove stray directory `"tar -xzf '"` from the repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core application security middleware that MUST be complete before user stories

**⚠️ CRITICAL**: Foundational security middleware blocks subsequent HTTP enhancements

- [X] T004 [P] Add HTTP security headers middleware (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy`) in `app/main.py`
- [X] T005 [P] Dynamically bind CORS origins based on `APP_PORT` in `app/main.py`

**Checkpoint**: Foundational HTTP middleware configured and ready for user stories.

---

## Phase 3: User Story 1 - Secure Interaction with Untrusted AI Responses (Priority: P1) 🎯 MVP

**Goal**: Protect user browser session against XSS in markdown links and reject malformed model parameters at the API gateway boundary.

**Independent Test**:
1. Run `tests/unit/test_validation.py` to confirm malformed model strings are rejected with HTTP 422.
2. Run `tests/unit/test_markdown_security.py` to confirm markdown links with `javascript:` or `data:` schemes are neutralized to `#`.

### Tests for User Story 1
- [X] T006 [P] [US1] Create unit tests for model name regex and length boundary validation in `tests/unit/test_validation.py`
- [X] T007 [P] [US1] Create test suite for markdown link protocol allowlist sanitization in `tests/unit/test_markdown_security.py`

### Implementation for User Story 1
- [X] T008 [P] [US1] Enforce model parameter constraint `min_length=1`, `max_length=128`, and `pattern=r"^[a-zA-Z0-9_\-\./:]+$"` in `app/models.py`
- [X] T009 [US1] Implement protocol allowlist check (`http://`, `https://`, `mailto:`, relative paths) and anchor text escaping in `app/static/vendor/marked.min.js`

**Checkpoint**: User Story 1 fully functional and independently testable (MVP delivered).

---

## Phase 4: User Story 2 - Resilient, Pooled Upstream Communication & Efficient Health Checking (Priority: P2)

**Goal**: Implement connection pooling via FastAPI lifespan and optimize health check probes to eliminate connection churn.

**Independent Test**:
Run `tests/unit/test_ollama_client.py` and `tests/integration/test_endpoints.py` to verify `check_health()` queries `GET /` and reuses persistent `httpx.AsyncClient`.

### Tests for User Story 2
- [X] T010 [P] [US2] Update unit tests in `tests/unit/test_ollama_client.py` for persistent client pooling and `GET /` liveness check
- [X] T011 [P] [US2] Update integration tests in `tests/integration/test_endpoints.py` to verify lifespan client management

### Implementation for User Story 2
- [X] T012 [US2] Refactor `OllamaClient` in `app/services/ollama_client.py` to use a shared `httpx.AsyncClient` and change `check_health()` to ping `GET /`
- [X] T013 [US2] Configure `@asynccontextmanager` lifespan handler in `app/main.py` to initialize and close the shared `OllamaClient` HTTP pool

**Checkpoint**: User Stories 1 AND 2 work independently with pooled connections and fast health probes.

---

## Phase 5: User Story 3 - Clean Deployment Toolchain & Script Consistency (Priority: P3)

**Goal**: Align script defaults and harden shell variable quoting to prevent command injection risks.

**Independent Test**:
Verify `scripts/test.sh` defaults to `e-webui-app` and run `tests/test_deploy_lifecycle.py` with mock incus harness.

### Implementation for User Story 3
- [X] T014 [P] [US3] Update default container name from `webui` to `e-webui-app` in `scripts/test.sh`
- [X] T015 [P] [US3] Harden shell variable quoting in `scripts/lib/lock.sh` and `scripts/lib/state.sh`
- [X] T016 [US3] Verify deployment lifecycle tests in `tests/test_deploy_lifecycle.py` pass without errors

**Checkpoint**: All three user stories are functionally complete and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates and comprehensive test validation across the entire workspace

- [X] T017 [P] Update `README.md` to document `requirements-dev.txt` for development and testing setup
- [X] T018 Execute full unit and integration test suite via `python3 -m unittest discover tests`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion; blocks all user stories.
- **User Stories (Phases 3 to 5)**:
  - User Story 1 (P1): Can start immediately after Foundational Phase.
  - User Story 2 (P2): Can start after Foundational Phase; independent of US1.
  - User Story 3 (P3): Can start after Foundational Phase; independent of US1/US2.
- **Polish (Phase 6)**: Depends on completion of all user stories.

### Parallel Execution Opportunities

- Phase 1: T003 can run in parallel with T001/T002.
- Phase 2: T004 and T005 can run in parallel (both in `app/main.py` or separate review).
- Phase 3 (US1): T006 and T007 tests can run in parallel; T008 (`app/models.py`) and T009 (`marked.min.js`) touch different files and can run in parallel.
- Phase 4 (US2): T010 and T011 test updates can run in parallel.
- Phase 5 (US3): T014 and T015 touch different script files and can run in parallel.

---

## Implementation Strategy (MVP First)

1. **Step 1**: Complete Phase 1 (Setup: dependencies & workspace cleanup) + Phase 2 (Foundational: security headers & CORS).
2. **Step 2**: Implement Phase 3 (User Story 1: XSS link protection & model validation) → **MVP ready & testable**.
3. **Step 3**: Implement Phase 4 (User Story 2: HTTP connection pool & fast health check).
4. **Step 4**: Implement Phase 5 (User Story 3: Script container consistency & quote hardening).
5. **Step 5**: Run Phase 6 (Polish & full test suite regression run).
