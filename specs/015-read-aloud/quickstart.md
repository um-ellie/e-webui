# Quickstart & Verification Guide: Read Aloud TTS for Assistant Replies

**Branch**: `015-read-aloud` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md) | **API Contract**: [tts-api-contract.md](contracts/tts-api-contract.md)

This guide documents the procedures for testing and verifying the "read aloud" text-to-speech feature locally in development and validating container deployments.

---

## 1. Local Workspace Verification (Automated Unit & Integration Tests)

In accordance with the project constitution, all automated tests executed by the agent or developer within the workspace run locally using mocks and stubs without container access or external network calls.

### Prerequisites
- Active Python virtual environment (`.venv`).
- Development dependencies installed (`pytest`, `pytest-asyncio`, `httpx`).

```bash
source .venv/bin/activate
pip install -r requirements-dev.txt
```

### Running Test Suites

#### 1. Text Normalization & Cleaning Tests
Verifies that code blocks, inline backticks, hyperlinks, markdown headers, and emojis are properly stripped, while speakable English prose and single-word responses are preserved.

```bash
pytest tests/unit/test_text_cleaner.py -v
```

#### 2. TTS Service & Fallback Tests
Verifies lazy loading, weight detection (`kokoro-v1_0.pth` / `kokoro-v0_19.pth`), graceful degradation with HTTP 503 when weights are absent, and worker thread concurrency limits.

```bash
pytest tests/unit/test_tts_service.py -v
```

#### 3. Endpoint & API Contract Tests
Verifies `POST /api/tts/synthesize`:
- Returns `200 OK` with `audio/wav` for valid English text (using mocked Kokoro pipeline).
- Returns `400 Bad Request` for code-only or non-speakable text.
- Returns `413 Payload Too Large` when text exceeds 3,000 characters.
- Returns `503 Service Unavailable` when model weights are not loaded.

```bash
pytest tests/integration/test_tts_endpoint.py -v
```

#### 4. Frontend Script Detection & UI Contract Tests
Verifies DOM logic for speaker icon display:
- Hidden during streaming.
- Hidden for Persian/RTL messages.
- Hidden for code-only replies.
- Shown for English replies (including single words like "Yes.").

```bash
pytest tests/unit/test_ui_contracts.py -k "test_tts_speaker_button" -v
```

---

## 2. End-to-End User Verification (Manual Hand-Off)

> [!NOTE]
> Per **Constitution Principle I (Infrastructure Isolation)**, the agent does not execute container operations. The operator performs these verification steps inside the running environment.

### Verification Scenarios

#### Scenario 1: Listen to an English Response
1. Open the e-webui chat interface in a browser (`http://<host>:8080`).
2. Ask an English question (e.g., *"What is an immutable data structure?"*).
3. Observe that during streaming, no speaker button is displayed.
4. Once the response completes, verify that a small speaker icon button appears below the message next to the copy and feedback buttons.
5. Click the speaker icon.
   - The button enters a loading state, followed by an active playing state.
   - Natural American English speech speaks the text clearly.
   - When the audio ends, the speaker icon returns to idle.

#### Scenario 2: Stop Playback and Single-Stream Enforcement
1. While an assistant reply is playing, click the speaker icon again.
   - Playback halts immediately and the icon returns to idle.
2. In a chat with multiple assistant replies, start playback on Reply A, then click the speaker icon on Reply B.
   - Reply A immediately stops and Reply B starts playing.
3. Start playback on any reply, then click to switch to another chat in the sidebar.
   - Playback immediately stops upon switching.

#### Scenario 3: Instant Session Replay
1. Listen to a completed reply once.
2. Open the browser DevTools Network tab.
3. Click the speaker icon on the same reply again.
   - Verify that playback starts instantly (<100ms) with **zero** additional network requests to `/api/tts/synthesize`.

#### Scenario 4: Markdown and Code Block Skipping
1. Ask the model for a Python snippet (e.g., *"Write a Python function to reverse a list and explain it."*).
2. Click the speaker icon on the completed response.
3. Verify that the spoken speech reads the explanatory sentences and completely skips the fenced code block without pronouncing syntax tokens.

#### Scenario 5: Persian Language Isolation
1. Ask a question in Persian (e.g., *"سلام، حالت چطوره؟"*).
2. When the Persian assistant reply completes, inspect the action buttons below the text.
3. Verify that **no speaker icon button** is rendered, and the chat layout remains visually identical to previous versions.

#### Scenario 6: Code-Only and Short Reply Handling
1. Generate an assistant response that consists solely of a code block (e.g. ```` ```bash\necho "hello"\n``` ````).
   - Verify that no speaker icon is displayed.
2. Generate an assistant reply that is a single English word (e.g. *"Yes."*).
   - Verify that the speaker icon is displayed and audibly synthesizes the word.

#### Scenario 7: Missing Weights Graceful Degradation
1. If model weights are missing or temporarily moved:
   - Clicking the speaker button briefly shows a loading state, returns to idle, and displays an unobtrusive tooltip hint ("Speech synthesis unavailable").
   - The chat interface remains responsive, and normal conversation continues unaffected.
