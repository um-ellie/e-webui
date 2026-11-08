# Tasks: Read Aloud TTS for Assistant Replies

**Input**: Design documents from `/specs/015-read-aloud/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/tts-api-contract.md`, `quickstart.md`

**Tests**: Test tasks are included per `quickstart.md` to ensure automated verification within the local workspace using mocks and stubs.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`, `[US6]`)
- All task descriptions include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and configuration constants for the TTS subsystem.

- [X] T001 Add `KOKORO_MODEL_DIR` configuration setting in `app/config.py` defaulting to `os.getenv("KOKORO_MODEL_DIR", "/opt/e-webui/shared/models/kokoro")`
- [X] T002 [P] Create `TTSRequest` Pydantic model in `app/models.py` with fields: `text: str` with constraints verbatim `min_length=1, max_length=3000` and `message_id: Optional[str] = Field(default=None, max_length=64)`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core text preprocessor and in-process Kokoro inference engine required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Implement `has_speakable_content(text: str) -> bool` and `clean_text(text: str) -> str` in `app/services/text_cleaner.py` stripping fenced code blocks, inline backticks, markdown formatting, hyperlinks, and emojis
- [X] T004 [P] Create unit tests for text normalization in `tests/unit/test_text_cleaner.py` covering code block removal, link anchor preservation, emoji stripping, and speakable content evaluation
- [X] T005 Implement `TTSService` class in `app/services/tts_service.py` managing model discovery (`kokoro-v1_0.pth` / `kokoro-v0_19.pth` and `voices/`), lazy `KPipeline(lang_code="a")` initialization with `af_heart` voice, `asyncio.to_thread` worker thread execution, single-job concurrency semaphore, and `soundfile` 24kHz PCM WAV export
- [X] T006 [P] Create unit tests for `TTSService` in `tests/unit/test_tts_service.py` mocking `kokoro.KPipeline` and `soundfile.write` to verify lazy loading, concurrency limiting, and graceful 503 fallback when weights are missing

**Checkpoint**: Core text preprocessor and inference engine verified locally with unit tests.

---

## Phase 3: User Story 1 - Listen to an Assistant Reply in American English (Priority: P1) 🎯 MVP

**Goal**: Deliver end-to-end speech synthesis: clicking the speaker icon under a completed English assistant reply requests audio from `/api/tts/synthesize` and plays 24kHz WAV audio in the browser.

**Independent Test**: Complete an English chat turn. Click the speaker icon button below the response. The button shows loading, plays audio aloud, and returns to idle when playback completes.

### Tests for User Story 1

- [X] T007 [P] [US1] Create integration tests for `/api/tts/synthesize` in `tests/integration/test_tts_endpoint.py` verifying `200 OK` with `Content-Type: audio/wav`, headers, and payload validation using a mocked TTS service

### Implementation for User Story 1

- [X] T008 [US1] Implement `POST /api/tts/synthesize` endpoint in `app/main.py` accepting `TTSRequest`, validating text, invoking `tts_service.synthesize(text)`, and returning `Response(content=wav_bytes, media_type="audio/wav")`
- [X] T009 [P] [US1] Create `TTSController` in `app/static/js/tts.js` managing a single `HTMLAudioElement`, dispatching `POST /api/tts/synthesize`, converting binary blob to Object URL, and emitting playback events (`playing`, `ended`, `error`)
- [X] T010 [P] [US1] Add CSS styles for speaker button states (`.btn-tts`, `.btn-tts.loading`, `.btn-tts.playing`) in `app/static/style.css`
- [X] T011 [US1] Update `createMessageActions` in `app/static/js/components/chat.js` to render the speaker icon button for completed English messages, wiring click events to `TTSController.play(msg.id, msg.content)` and updating icon state

**Checkpoint**: At this point, User Story 1 is fully functional and delivers the core MVP value.

---

## Phase 4: User Story 2 - Playback Control and Single-Stream Audio Management (Priority: P1)

**Goal**: Ensure only one audio stream plays at a time. Re-clicking the active button stops playback; clicking another reply stops the current reply and starts the new one; switching chat threads stops playback immediately.

**Independent Test**: Start playback on Message A, click Message A again to confirm silence. Start playback on Message A, click Message B to confirm Message A stops immediately and Message B begins. Start playback and switch chat sessions in the sidebar to verify playback terminates immediately.

### Tests for User Story 2

- [X] T012 [P] [US2] Create unit tests in `tests/unit/test_ui_contracts.py` verifying single-stream stop behaviors and session change event subscriptions

### Implementation for User Story 2

- [X] T013 [US2] Update `TTSController.play(messageId, text)` in `app/static/js/tts.js` to check if `activeMessageId === messageId` and toggle stop/pause if already playing
- [X] T014 [US2] Implement `TTSController.stop()` in `app/static/js/tts.js` to immediately pause audio, reset `currentTime = 0`, and reset button states to `idle`
- [X] T015 [US2] Wire `store.on('session:active-changed', () => ttsController.stop())` in `app/static/js/app.js` to halt audio on conversation thread changes

**Checkpoint**: Single-track audio enforcement and thread isolation fully verified.

---

## Phase 5: User Story 3 - Instant Replay via Browser Session Caching (Priority: P2)

**Goal**: Cache synthesized audio blobs in the browser for the duration of the browsing session, making replaying a previously heard reply instant without re-calling the backend.

**Independent Test**: Play an assistant reply to completion. Replay the same reply while inspecting browser network traffic: verify 0 network requests are made to `/api/tts/synthesize` and playback starts in under 100ms.

### Implementation for User Story 3

- [X] T016 [US3] Implement client-side `Map<string, string>` blob URL caching in `TTSController` in `app/static/js/tts.js` that checks for cached audio before dispatching a network request
- [X] T017 [P] [US3] Create tests in `tests/unit/test_ui_contracts.py` verifying that repeated play requests for the same message ID reuse cached blob URLs without invoking `fetch`

**Checkpoint**: Replays start instantaneously from in-memory session cache.

---

## Phase 6: User Story 4 - Natural Speech with Code and Markdown Filtering (Priority: P2)

**Goal**: Ensure speech flows naturally by stripping syntax markers, hyperlinks, markdown headers/lists, and omitting code blocks entirely.

**Independent Test**: Synthesize a message containing markdown headers, bullets, inline code, a fenced python code block, raw URLs, and emojis. Verify that spoken output contains only conversational prose and skips all code blocks and syntax tokens.

### Implementation for User Story 4

- [X] T018 [US4] Refine regex normalization rules in `app/services/text_cleaner.py` to handle nested markdown syntax, multiline code fences with language tags, raw URLs, markdown anchor conversions (`[text](url)` -> `text`), and emoji unicode ranges
- [X] T019 [P] [US4] Add comprehensive test cases in `tests/unit/test_text_cleaner.py` covering code block elimination, list punctuation normalization, link anchor retention, and emoji stripping

**Checkpoint**: Audio output is audibly clean and natural without technical syntax artifacts.

---

## Phase 7: User Story 5 - Language-Aware Speaker Button Visibility (Priority: P2)

**Goal**: Display the speaker icon button only for replies that are predominantly English (Latin script) and contain speakable prose. Hide the button during active streaming, for Persian/non-Latin replies, and for code-only replies. Ensure single-word English replies ("Yes.", "Hello") display the button.

**Independent Test**: Verify Persian messages and code-only messages render no speaker icon. Verify single-word English replies render the speaker icon. Verify streaming replies display no icon until streaming finishes.

### Implementation for User Story 5

- [X] T020 [US5] Implement `isPredominantlyEnglish(text)` and `hasSpeakableContent(text)` in `app/static/js/rtl.js` evaluating Latin vs RTL character counts and presence of speakable text
- [X] T021 [US5] Update message rendering in `app/static/js/components/chat.js` so that `createMessageActions` suppresses the speaker button when `msg.status === 'streaming'`, when text is predominantly non-Latin, or when no speakable text remains after code stripping
- [X] T022 [P] [US5] Add UI contract tests in `tests/unit/test_ui_contracts.py` testing speaker button visibility on English messages, Persian messages, code-only messages, and single-word replies

**Checkpoint**: Interface remains visually unchanged for Persian and code-only messages while English messages display the speaker button.

---

## Phase 8: User Story 6 - Graceful Degradation on Missing Weights or Synthesis Errors (Priority: P3)

**Goal**: Handle missing weights, missing dependencies, or backend synthesis errors gracefully without UI freezes, broken layouts, or interruptions to core chat functionality.

**Independent Test**: Temporarily set an invalid `KOKORO_MODEL_DIR`. Click the speaker icon. Verify backend returns 503, the speaker icon returns to idle with an unobtrusive tooltip hint, and chat continues uninterrupted.

### Implementation for User Story 6

- [X] T023 [US6] Add structured error handling in `POST /api/tts/synthesize` in `app/main.py` returning `503 Service Unavailable` with details when `tts_service.available` is False or inference fails
- [X] T024 [US6] Implement error recovery in `app/static/js/tts.js` and `app/static/js/components/chat.js` resetting button state from `loading` to `idle` and displaying a non-intrusive tooltip hint on failure
- [X] T025 [P] [US6] Add test cases in `tests/integration/test_tts_endpoint.py` asserting `503 Service Unavailable` and structured JSON error responses when weights are missing

**Checkpoint**: Application resilience verified under failure and unprovisioned states.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: UI polishing, accessibility attributes, security verification, and complete test suite execution.

- [X] T026 [P] Add accessibility attributes (`aria-label="Read reply aloud"`, `aria-pressed`, `role="button"`) to speaker buttons in `app/static/js/components/chat.js`
- [X] T027 [P] Verify security headers and Content Security Policy in `app/main.py` to ensure `media-src 'self' blob:` allows playing generated audio blobs
- [X] T028 Run the complete automated test suite (`pytest tests/unit/ tests/integration/ -v`) and verify 100% pass rate
- [X] T029 Execute the manual verification scenarios documented in `specs/015-read-aloud/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — blocks all user stories.
- **User Story 1 (Phase 3 - MVP)**: Depends on Phase 2 completion.
- **User Story 2 (Phase 4)**: Depends on Phase 3 (extends client controller with single-stream controls and session change listener).
- **User Story 3 (Phase 5)**: Depends on Phase 3 (extends client controller with blob caching).
- **User Story 4 (Phase 6)**: Depends on Phase 2 & 3 (refines text normalization pipeline).
- **User Story 5 (Phase 7)**: Depends on Phase 3 (refines frontend button visibility logic).
- **User Story 6 (Phase 8)**: Depends on Phase 3 (hardens error handling on backend and frontend).
- **Polish (Phase 9)**: Depends on all user stories completed.

### Parallel Opportunities

- Within Phase 1: `T002` [P] can run alongside `T001`.
- Within Phase 2: `T003` [P] and `T004` [P] can run in parallel with `T005` and `T006` [P].
- Within Phase 3: `T007` [P] (integration test) can be written in parallel with `T009` [P] (`tts.js`) and `T010` [P] (CSS).
- Phases 4, 5, 6, 7, and 8 can proceed in parallel once Phase 3 (MVP) is in place, as each touches distinct aspects of the frontend or service layer.

---

## Parallel Example: User Story 1 (MVP)

```bash
# Launch integration test, CSS styling, and client controller simultaneously:
Task: "T007 [P] [US1] Create integration tests for /api/tts/synthesize in tests/integration/test_tts_endpoint.py"
Task: "T009 [P] [US1] Create TTSController in app/static/js/tts.js"
Task: "T010 [P] [US1] Add CSS styles for speaker button states in app/static/style.css"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)
1. Complete **Phase 1: Setup** (configuration, request schemas).
2. Complete **Phase 2: Foundational** (text cleaner, in-process TTS service).
3. Complete **Phase 3: User Story 1** (synthesis endpoint, basic client playback, speaker button in chat).
4. Complete **Phase 4: User Story 2** (single-stream audio control, chat switch stop).
5. **VALIDATE MVP**: Test English speech playback and stop controls independently.

### Incremental Delivery
1. Add **User Story 3** (session audio caching for zero-latency replay).
2. Add **User Story 4** (robust markdown, link, and code block exclusion).
3. Add **User Story 5** (language filtering: hide for Persian and code-only, show for single-word English).
4. Add **User Story 6** (graceful degradation on missing weights).
5. Complete **Phase 9: Polish** (CSP audio compliance, accessibility, full test suite).
