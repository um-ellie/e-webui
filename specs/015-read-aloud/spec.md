# Feature Specification: Read Aloud TTS for Assistant Replies

**Feature Branch**: `015-read-aloud`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Add a 'read aloud' feature to the e-webui chat application: a small speaker icon button under each assistant reply that reads the reply aloud in American English using the hexgrad/Kokoro-82M text-to-speech model. Prerequisite (already done by the previous feature, do not redo it): the deployment tooling already provisions a compatible Python, the Kokoro dependencies, and the model weights in a persistent local location inside the e-webui-app container. The model runs on CPU inside the application's own backend process, with no separate service or container. It does not use Ollama. User-facing behavior: 1. Every completed assistant reply shows a small speaker icon button below the reply text. The button is not shown while a reply is still streaming. 2. Clicking the button sends the whole reply text in one request to the backend and plays the returned audio in the browser. Clicking the button again while it is playing stops playback. 3. Only one reply can play at a time. Starting another reply stops the current one. Playback also stops when the user switches to another chat or when the audio ends. 4. English only, American accent only: a single fixed American English voice and normal speed. There are no voice, speed, or language settings, and no language detection UI. 5. The button is shown only for replies whose text is mostly English (Latin script). It is hidden for Persian replies and other non-English replies, so the chat page looks unchanged for them. 6. Apart from the speaker icon itself (which may show idle, loading, and playing states), the chat page must not change visually. No new panels, banners, or settings. If synthesis fails, the icon simply returns to idle and shows a short, unobtrusive error hint. 7. Audio already generated for a reply is cached in the browser for the session, so replaying it is instant and does not call the backend again. 8. This feature is unrelated to the microphone or voice-input button in the question box. Backend behavior: - A new authenticated endpoint accepts the reply text and returns playable audio. The browser never talks to the TTS engine directly. - Before synthesis, the backend cleans the text so it is read naturally: markdown formatting, links, emoji, and code blocks are removed or simplified, and code blocks are not read aloud. - Enforce a maximum text length and rate limiting. Reject empty or too-long requests with clear errors. - The model is loaded lazily on the first request and reused afterward. Synthesis must run so that it never blocks other requests, especially streaming chat responses. The first request may be slower; this should not time out. - If the model weights or dependencies are missing, the endpoint returns a clear error and the rest of the application keeps working normally. - The model must load from the local persistent weights location without needing internet access at runtime. Success criteria: - Clicking the speaker on an English reply of typical length starts audible American English speech within a few seconds on CPU, and clicking again stops it immediately. - Replies containing markdown, lists, links, and code blocks are read naturally, with code blocks skipped. - Chat streaming stays smooth while audio is being generated. - Persian replies show no speaker button, and the chat page is otherwise unchanged. - With the model missing, the app still works and the speaker button fails gracefully. Out of scope: voice or language selection, speed controls, sentence-by-sentence streaming of audio, other TTS languages, voice input, and any change to the Ollama setup or the deployment tooling."

## Clarifications

### Session 2026-11-07
- Q: Which audio format should the backend generate and return to the browser for playback? → A: WAV (`audio/wav`) 24kHz PCM packaged via soundfile for zero-overhead CPU generation and native HTMLAudioElement compatibility.
- Q: How should the speaker button behave when an assistant reply contains only code blocks with no speakable text? → A: Hide the speaker button only when no speakable text remains after cleaning (the reply is code-only, or contains solely symbols, emoji, or whitespace). If any speakable English text remains—even a single word such as "Yes." or "Hello"—the speaker button must be shown and read aloud.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listen to an Assistant Reply in American English (Priority: P1)

A user reading a completed assistant response in English clicks a speaker icon button located under the message. The application indicates that audio is generating, then plays natural-sounding American English speech of the response directly in the browser. When speech ends, the speaker icon returns to its idle state.

**Why this priority**: Core value of the feature. Allows users to listen to assistant answers hands-free without reading text on screen.

**Independent Test**: Can be tested on any completed English response by clicking the speaker icon. The response is synthesized and audibly played in the browser using an American English voice without UI disruptions.

**Acceptance Scenarios**:

1. **Given** a completed assistant reply with predominantly English text, **When** the message finishes rendering, **Then** a small, unobtrusive speaker icon button is displayed beneath the message.
2. **Given** an idle speaker icon under an English reply, **When** the user clicks the button, **Then** the button transitions to a loading state, requests audio from the backend, transitions to a playing state, and plays the audio aloud.
3. **Given** an audio track currently playing, **When** the track reaches the end of the spoken text, **Then** the speaker icon transitions back to the idle state.

---

### User Story 2 - Playback Control and Single-Stream Audio Management (Priority: P1)

A user listening to an assistant response wants to stop listening, switch to another message, or move to a different conversation. The user can toggle playback off by clicking the active speaker button, clicking a different message's speaker button, or switching conversation threads. The application guarantees that only one audio stream plays at any given moment.

**Why this priority**: Prevents overlapping audio, acoustic clutter, and confusing UI states across multiple messages and conversation tabs.

**Independent Test**: Can be tested by starting playback on Message A, clicking Message A again to confirm immediate silence, or clicking Message B to verify Message A stops immediately and Message B begins, or switching chat sessions to verify playback stops.

**Acceptance Scenarios**:

1. **Given** an audio reply currently playing, **When** the user clicks its speaker button again, **Then** playback immediately stops and the icon returns to the idle state.
2. **Given** an audio reply currently playing on Message A, **When** the user clicks the speaker button on Message B, **Then** playback for Message A stops immediately and Message B begins its loading/playing lifecycle.
3. **Given** an audio reply currently playing, **When** the user selects or switches to another chat thread, **Then** playback terminates immediately.

---

### User Story 3 - Instant Replay via Browser Session Caching (Priority: P2)

A user who has already listened to an assistant reply wants to hear it again later in the same browsing session. Clicking the speaker icon replays the audio immediately without a network request to the backend or waiting for CPU synthesis.

**Why this priority**: Enhances user experience with zero-latency replays while minimizing redundant server-side CPU utilization.

**Independent Test**: Can be tested by playing a reply to completion, observing network requests during the first play, clicking replay, and verifying no new network request is dispatched and playback starts instantaneously.

**Acceptance Scenarios**:

1. **Given** an assistant reply whose audio was previously fetched and played during the current browser session, **When** the user clicks the speaker icon again, **Then** the cached audio starts playing instantly without making a backend synthesis request.
2. **Given** audio cached for a message, **When** the user refreshes or closes the browser tab, **Then** memory resources associated with the audio session are freed according to standard browser lifecycle rules.

---

### User Story 4 - Natural Speech with Code and Markdown Filtering (Priority: P2)

An assistant reply contains formatting such as headings, bullet lists, markdown bold/italic syntax, raw hyperlinks, and technical code blocks. When synthesized, the speech engine pronounces the prose smoothly and naturally, while skipping syntax artifacts and omitting code blocks entirely so the audio remains concise and pleasant to hear.

**Why this priority**: Reading raw code blocks, syntax markers, or long URL strings aloud creates an unlistenable auditory experience.

**Independent Test**: Can be tested by generating an English reply containing a Python snippet, a markdown list, and URLs, then clicking the speaker button. The audible speech reads the explanatory prose smoothly and skips the code snippet and markdown symbols.

**Acceptance Scenarios**:

1. **Given** an English reply containing fenced code blocks (```...```), **When** audio is synthesized, **Then** the code block content and language identifiers are excluded from the spoken audio.
2. **Given** an English reply containing markdown headers, bold/italic markers, and list bullets, **When** audio is synthesized, **Then** the text is read naturally without pronouncing punctuation syntax (such as "hash hash" or "asterisk").
3. **Given** an English reply containing hyperlinks (e.g. `[Documentation](https://example.com)`), **When** audio is synthesized, **Then** only the descriptive anchor text ("Documentation") is spoken and raw URLs are omitted.
4. **Given** an English reply containing emojis, **When** audio is synthesized, **Then** the emojis are stripped or omitted from the audio stream rather than spoken as raw character names.

---

### User Story 5 - Language-Aware Speaker Button Visibility (Priority: P2)

A user receives replies in Persian (Farsi) or other non-Latin scripts. Because speech synthesis is designated exclusively for American English, messages in non-English scripts do not display a speaker button. The visual layout and appearance of the chat page remain completely unchanged for non-English chats.

**Why this priority**: Avoids non-functional or unintelligible speech attempts on unsupported languages and preserves a clean, distraction-free interface for non-English users.

**Independent Test**: Can be tested by asking a question in Persian to generate a Persian reply and asking a question in English to generate an English reply. The English reply shows the speaker button; the Persian reply displays no speaker button.

**Acceptance Scenarios**:

1. **Given** an assistant reply composed predominantly of non-Latin characters (such as Persian / Arabic script), **When** the reply completes, **Then** no speaker button is displayed beneath the message.
2. **Given** an assistant reply composed predominantly of Latin script (English), **When** the reply completes, **Then** the speaker button is rendered.
3. **Given** an assistant reply that is actively streaming text, **When** streaming is in progress, **Then** no speaker button is displayed until the stream has completed.

---

### User Story 6 - Graceful Degradation on Missing Weights or Synthesis Errors (Priority: P3)

If the local model weights or engine dependencies are missing, or if a backend error or timeout occurs during synthesis, the application degrades gracefully. The chat interface remains fully functional, and the speaker button returns to idle while displaying a brief, unobtrusive error hint without modal popups or broken layouts.

**Why this priority**: Guarantees that speech synthesis failures never impact core chat usability or lock the interface.

**Independent Test**: Can be tested by temporarily misconfiguring or denying access to the model weight directory. When the user clicks the speaker button, the button shows a loading indicator, fails cleanly, returns to idle with an unobtrusive error indicator, and chat messaging continues without disruption.

**Acceptance Scenarios**:

1. **Given** backend environment where model weights are missing or unreadable, **When** a user clicks the speaker icon, **Then** the backend returns a clear error status code and explanation, and the frontend button returns to idle with an unobtrusive tooltip/hint.
2. **Given** an error during synthesis, **When** the error occurs, **Then** the existing chat history, input field, and streaming chat engine remain fully responsive and functional.

---

### Edge Cases

- **Code-Only or Non-Speakable Replies**: When an assistant reply consists solely of code blocks, symbols, emojis, or whitespace (with zero speakable words remaining after cleaning), the speaker icon button is hidden completely, ensuring the message layout remains clean and avoiding blank audio requests.
- **Single-Word or Terse Replies**: Replies consisting of even a single speakable English word (e.g. "Yes.", "Hello", "Thanks") must display the speaker button and synthesize audio correctly.
- **Maximum Text Length Exceeded**: An exceptionally long assistant response exceeding the maximum synthesis character limit is either truncated safely to the maximum limit or rejected with an informative non-blocking notice.
- **Concurrent Chat Streaming**: A user requests speech synthesis while simultaneously receiving a new streaming chat response in another conversation. Chat token generation must not stutter or stall during TTS CPU execution.
- **Rapid Clicking**: A user rapidly clicks the speaker button multiple times in succession. Debounce protection prevents redundant backend requests while in the loading state.
- **Navigation Away**: A user switches conversations or navigates away while audio synthesis is in progress. The pending request or playback is cleanly aborted and no detached audio plays in the background.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST evaluate completed assistant replies and display a speaker icon button below the reply text only if the text is predominantly Latin script (English) AND contains speakable prose after removing code blocks, symbols, emojis, and whitespace. Even single-word English replies (e.g., "Yes." or "Hello") MUST display the speaker button and be read aloud.
- **FR-002**: The system MUST NOT display the speaker icon button while an assistant response is actively streaming.
- **FR-003**: The system MUST NOT display the speaker icon button for responses predominantly composed of Persian (Farsi) or non-Latin scripts.
- **FR-004**: The speaker button MUST support visual states: Idle, Loading (synthesizing), and Playing, without introducing new banners, dialogs, or page-level layout shifts.
- **FR-005**: Clicking an idle speaker button MUST trigger an authenticated backend request containing the reply text, transition to loading, and initiate browser playback upon receiving audio.
- **FR-006**: Clicking a playing speaker button MUST immediately stop audio playback and return the button to the idle state.
- **FR-007**: The system MUST enforce single-track playback: starting playback on any message MUST automatically stop any currently playing audio.
- **FR-008**: The system MUST immediately stop audio playback when the user switches to a different chat session.
- **FR-009**: The system MUST cache generated audio in the client browser for the duration of the browsing session, allowing subsequent plays of the same reply to occur instantaneously without contacting the backend.
- **FR-010**: The backend MUST expose a dedicated, authenticated endpoint that accepts text and returns playable 24kHz WAV audio (`audio/wav`) synthesized via the local Kokoro-82M model using `soundfile` packaging without requiring separate external transcoding utilities.
- **FR-011**: The backend MUST clean the incoming text prior to speech synthesis by:
  - Removing code blocks (content between triple backticks) completely.
  - Stripping markdown formatting symbols (bold, italic, strikethrough, headings, blockquotes).
  - Normalizing links by preserving the link title/anchor text and discarding raw URL targets.
  - Removing emojis and standalone decorative unicode symbols.
  - Normalizing whitespace and list bullet markers into natural sentence pauses.
- **FR-012**: The backend MUST enforce an upper limit on input text length (e.g., maximum 3,000 characters) and rate limiting per user session, rejecting invalid or excessive requests with clear error codes.
- **FR-013**: The backend MUST load the Kokoro model lazily upon the initial request and keep it warm in memory for subsequent requests.
- **FR-014**: The backend MUST execute speech synthesis in a background worker thread on CPU so that concurrent chat streaming and API requests are never blocked.
- **FR-015**: The model MUST load strictly from local persistent storage without making external network calls at runtime.
- **FR-016**: If model weights or TTS dependencies are unavailable, the backend endpoint MUST return an explicit, structured error, and the client speaker icon MUST return to idle with an unobtrusive error indicator.
- **FR-017**: The voice used for synthesis MUST be a single fixed American English voice (`af_heart` with language code `a`) at standard (1.0x) speed with no user-configurable voice or speed settings.
- **FR-018**: The read aloud feature MUST remain completely isolated from microphone and voice-input functionality in the chat composer.

### Key Entities

- **Reply Audio Cache**: A client-side in-memory registry mapping message identifiers to playable audio object URLs, valid for the lifetime of the browser session.
- **Speech Synthesis Request**: A backend request payload containing the message text to synthesize, associated user authentication context, and validation parameters.
- **Speech Synthesis Response**: Binary audio stream payload (e.g., `audio/wav`) accompanied by appropriate caching and content-type headers.
- **TTS Engine State**: In-process backend singleton managing the Kokoro model lifecycle, tracking whether weights are loaded, handling thread-safe inference on CPU, and reporting availability status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For typical assistant replies (50–100 words), audio synthesis and browser playback start within 4 seconds of clicking the speaker button on standard container CPU allocations after the initial lazy load.
- **SC-002**: Subsequent replays of cached audio start within 100 milliseconds of user click with zero backend network requests.
- **SC-003**: Clicking an active speaker button stops playback within 100 milliseconds.
- **SC-004**: Switching chat sessions halts active audio playback within 100 milliseconds.
- **SC-005**: 100% of tested code blocks, raw markdown syntax markers, raw URL targets, and emojis are omitted or normalized from spoken output.
- **SC-006**: Streaming chat message token delivery experiences no measurable degradation or perceptible frame rate drop while TTS synthesis executes on CPU.
- **SC-007**: 100% of predominantly Persian or non-Latin assistant messages hide the speaker icon, preserving visual fidelity of existing non-English chat interfaces.
- **SC-008**: In environments where TTS model weights are missing, the endpoint responds with an error within 200 milliseconds, the UI fails gracefully without uncaught exceptions or screen freezes, and core chat continues uninterrupted.

## Assumptions

- Standard browser audio capabilities (`HTMLAudioElement` / Web Audio API) are available in the client browser without external browser extensions.
- Kokoro dependencies and local model weights are provisioned inside the application container by prior infrastructure automation (Spec 014) in a known persistent filesystem path.
- The default American English voice profile is selected (e.g. `af_heart` or equivalent standard American voice) with fixed pitch and natural cadence.
- A character limit of 3,000 characters is adequate for standard chat responses; responses exceeding this limit are cleanly bounded.
- Client audio caching is maintained per browser session in memory, meaning refreshing the page clears the cache and subsequent plays will re-request audio from the backend.
