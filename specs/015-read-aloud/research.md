# Research & Architectural Decisions: Read Aloud TTS for Assistant Replies

**Branch**: `015-read-aloud` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

This document records the architectural investigations, trade-off analyses, and technology selections for implementing the local Kokoro-82M text-to-speech read-aloud capability in e-webui.

---

## 1. Local Kokoro-82M TTS Engine & Lifecycle

### Context & Constraints
- The model weights and dependencies (`torch`, `kokoro>=0.8.4`, `soundfile>=0.12.1`) are provisioned inside the container at `/opt/e-webui/shared/models/kokoro/` with weights `kokoro-v1_0.pth` (or `kokoro-v0_19.pth`) and a `voices/` directory containing voice tensors like `af_heart.pt`.
- The engine must run purely on CPU without requiring GPU acceleration or network access at runtime (`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`).
- The engine must be initialized lazily on the first synthesis request to avoid delaying application startup.
- In environments where weights or dependencies are absent (e.g., bare development environments or test environments), the application must start without error, and synthesis requests must fail gracefully with structured 503 errors.

### Decision
- **Singleton Service (`app/services/tts_service.py`)**: Implement a `TTSService` class encapsulating model discovery, lazy initialization, text preprocessing, and audio rendering.
- **Model Discovery**: Check `KOKORO_MODEL_DIR` (defaulting to `/opt/e-webui/shared/models/kokoro` or local workspace fallback if configured). Check for `kokoro-v1_0.pth` first, falling back to `kokoro-v0_19.pth`.
- **Kokoro Pipeline Initialization**: Use `KPipeline(lang_code="a", model_path=weights_path)` with voice parameter `"af_heart"` and `speed=1.0`.
- **Graceful Degradation Guard**: Wrap `import kokoro` and weight file verification in try/except blocks. If dependencies or weight files are not found, mark the service as unavailable (`available=False`) with a descriptive reason.

### Alternatives Considered
- *Eager initialization during FastAPI lifespan*: Rejected because Kokoro model loading takes 1–3 seconds on CPU and allocates ~350MB RAM. Lazy loading ensures fast container service boot and liveness probe readiness.
- *External TTS daemon/container*: Rejected by explicit user requirements and project constitution (runs directly inside the application's own backend process).

---

## 2. Concurrency & Non-Blocking CPU Execution

### Context & Constraints
- Speech synthesis on CPU involves PyTorch tensor computation and phoneme generation. Although PyTorch releases the GIL during many C++ tensor operations, phonemization and chunk iteration consume CPU cycles.
- Active streaming chat responses (`/api/generate` SSE) must never stutter, stall, or drop frames while TTS audio is being generated.

### Decision
- **Async Worker Offloading**: Execute CPU-bound synthesis inside `asyncio.to_thread` (which executes tasks in a separate worker thread from `ThreadPoolExecutor`).
- **Inference Concurrency Limiter**: Implement an asynchronous Semaphore / Lock (`asyncio.Semaphore(1)` or bounded worker queue) to ensure that only one TTS synthesis job executes on CPU at a time. This prevents multiple concurrent TTS requests from saturating container CPU cores and starving Ollama token streaming.
- **Debounced Client Dispatch**: Frontend buttons are disabled/transitioned to a loading state upon click, preventing duplicate backend requests.

### Alternatives Considered
- *Running directly in async route handler*: Rejected because CPU computation in the main asyncio event loop blocks all incoming HTTP requests and pauses active SSE streaming generators.
- *Separate Celery / Redis queue*: Rejected as over-engineering for a single-container local web application with no Redis dependency.

---

## 3. Text Pre-Processing & Normalization

### Context & Constraints
- Raw assistant outputs contain rich Markdown syntax (fenced code blocks, inline code, bold/italics, blockquotes, raw URLs, Markdown tables, and emojis).
- Reading syntax markers or raw code creates a poor user experience.
- Code blocks must be completely omitted from speech.
- Single-word replies (e.g., "Yes.", "Hello") must be preserved and read aloud, whereas replies with zero speakable prose (code-only or symbol-only) must hide the button.

### Decision
- **Normalization Pipeline (`app/services/text_cleaner.py`)**:
  1. **Fenced Code Blocks**: Strip entire triple-backtick blocks: ```` ```[\w]*\n[\s\S]*?``` ````.
  2. **Inline Code**: Strip inline backticks: `` `([^`]+)` `` -> `\1` or remove if purely punctuation/symbols.
  3. **Markdown Hyperlinks**: Transform `[anchor text](url)` -> `anchor text`. Strip standalone URLs (`https?://\S+`).
  4. **Markdown Formatting**: Remove headers (`#+ `), blockquotes (`> `), bold/italics (`\*\*`, `\*`, `__`, `_`), strikethrough (`~~`), and horizontal rules (`---`).
  5. **Markdown Lists & Tables**: Convert bullet markers (`* `, `- `, `1. `) to simple comma pauses or line breaks; strip table delimiter pipes.
  6. **Emojis & Decorative Symbols**: Strip Unicode emoji character ranges (`\p{Extended_Pictographic}`, dingbats, emoticons).
  7. **Whitespace Collapse**: Collapse multiple consecutive whitespace and newlines into single spaces or sentence breaks.
- **Speakability Evaluation**:
  - A helper `has_speakable_content(text: str) -> bool` checks if the cleaned string contains at least one alphabetic letter (`[a-zA-Z]`).
  - If no speakable text remains, the frontend hides the speaker button, and the backend rejects empty synthesis requests with HTTP 400.

### Alternatives Considered
- *Full HTML rendering and text extraction via BeautifulSoup*: Overkill, slower, and strips structure less cleanly than regex targeted at Markdown before rendering.
- *Reading code aloud token-by-token*: Rejected by explicit user requirements.

---

## 4. Audio Format & Streaming Delivery

### Context & Constraints
- The user clarified and selected Option A: 24kHz PCM WAV (`audio/wav`) packaged via `soundfile`.
- Audio must be playable across all modern desktop and mobile browsers.

### Decision
- **In-Memory Audio Buffer**: Collect the Kokoro audio chunk generator arrays into a single `numpy.ndarray`, write to an in-memory `io.BytesIO` buffer via `soundfile.write(buffer, audio_data, 24000, format='WAV', subtype='PCM_16')`.
- **Response Headers**:
  - `Content-Type: audio/wav`
  - `Content-Length: <size>`
  - `Cache-Control: private, max-age=86400`
- **Frontend Fetch & Blob URL**: Client issues `fetch('/api/tts/synthesize', ...)` receiving a `Blob`, creates an object URL with `URL.createObjectURL(blob)`, and assigns it to an `Audio` instance.

### Alternatives Considered
- *Opus / OGG compression*: Lower network payload size, but requires external encoding libraries (`opuslib` or `ffmpeg`) and extra CPU cycles on the host. Uncompressed WAV at 24kHz 16-bit is ~48 kB per second of speech; a 10-second response is ~480 kB, which transfers across local networks in milliseconds with zero CPU transcoding penalty.

---

## 5. Frontend Script Detection & State Management

### Context & Constraints
- The speaker icon must only appear for replies predominantly in Latin script (English).
- The button must be hidden for Persian/Arabic replies and while an assistant message is streaming.
- Only one reply can play at a time. Starting another stops the current one. Switching chats stops playback.
- Replaying a reply in the same session must be instant via client-side caching.

### Decision
- **Latin / English Script Detection (`app/static/js/rtl.js` or `app/static/js/tts.js`)**:
  - Count Latin characters (`[a-zA-Z]`) versus RTL characters (`[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]`).
  - If Latin count > 0 and Latin count > RTL count AND `has_speakable_content(msg.content)` is true, render the speaker button.
- **Audio Manager (`app/static/js/tts.js`)**:
  - Singleton `TTSController` holding:
    - `activeAudio`: the currently playing `Audio` instance.
    - `activeMessageId`: the ID of the message currently playing or loading.
    - `cache`: a `Map<string, string>` storing `messageId -> objectUrl`.
  - Event listeners on `store`:
    - `session:active-changed`: calls `stop()` immediately.
    - `message:updated`: if message transitions to completed, triggers speaker icon evaluation.
- **Speaker Icon Button States**:
  - **Idle**: Speaker icon SVG (`<svg viewBox="0 0 24 24">...<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>...`).
  - **Loading**: Spinning indicator or pulsating icon, button disabled.
  - **Playing**: Active sound waves animated or highlighted speaker icon.
  - **Error hint**: Returns to idle with a brief tooltip / toast hint on the button (e.g. `title="Speech synthesis unavailable"`).

---

## 6. Summary of Architectural Decisions

| Aspect | Selected Strategy | Rationale |
|---|---|---|
| **TTS Engine** | In-process Kokoro `KPipeline` (lang_code="a", voice="af_heart") | Built-in, high quality American English, offline capability |
| **Execution Model** | `asyncio.to_thread` with concurrency semaphore | Prevents event-loop blocking; protects chat SSE stream |
| **Output Format** | 24kHz PCM WAV (`audio/wav`) via `soundfile` | Instant in-memory packing, zero encoding CPU lag, universal browser support |
| **Text Cleaning** | Regex-based markdown & code block stripper | Excludes code, URL targets, markdown syntax, and emojis |
| **Script Filter** | Latin character predominance + speakable text check | Preserves visual cleanliness for Persian chats and code-only answers |
| **Client Audio** | Singleton `HTMLAudioElement` + Blob URL cache | Single active stream, zero re-synthesis overhead on replay |
| **Error Handling** | Graceful 503 if weights missing; unobtrusive UI hint | Guarantees core chat service never breaks |
