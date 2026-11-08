# API Contract: Speech Synthesis (`/api/tts/synthesize`)

**Branch**: `015-read-aloud` | **Date**: 2026-11-07 | **Spec**: [spec.md](../spec.md)

This contract defines the HTTP interface between the e-webui client interface and the in-process text-to-speech backend service.

---

## Endpoint Details

- **Method**: `POST`
- **Path**: `/api/tts/synthesize`
- **Authentication**: Session / Standard HTTP (shares application security middleware and CORS)
- **Content-Type**: `application/json`
- **Accept**: `audio/wav`

---

## 1. Request Schema

### Request Body (`application/json`)

```json
{
  "text": "Hello! I can explain how the algorithm works.",
  "message_id": "msg-123e4567-e89b-12d3-a456-426614174000"
}
```

### Parameters

| Name | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `text` | string | Yes | 1 ≤ length ≤ 3000 chars | Raw assistant response text to be synthesized. |
| `message_id` | string | No | Max 64 chars | Client message ID used for logging and correlation. |

---

## 2. Response Specifications

### Success Response (`200 OK`)

Returned when text is successfully normalized and synthesized into audio.

- **Content-Type**: `audio/wav`
- **Headers**:
  - `Content-Type: audio/wav`
  - `Content-Disposition: inline; filename="speech.wav"`
  - `Cache-Control: private, max-age=86400`
  - `X-Synthesis-Duration-Ms: <integer>`
- **Body**: Binary 24kHz 16-bit PCM WAV stream.

---

### Error Responses

#### `400 Bad Request`
Returned when the incoming text contains no speakable content after stripping code blocks, formatting, and emojis (e.g., code-only or symbol-only text), or if text is purely whitespace.

```json
{
  "detail": "No speakable English prose found in the provided text."
}
```

#### `413 Payload Too Large`
Returned when the input string exceeds the 3,000 character limit.

```json
{
  "detail": "Text length exceeds the maximum limit of 3,000 characters."
}
```

#### `429 Too Many Requests`
Returned when a client rapidly spams synthesis requests beyond the concurrency or rate limit.

```json
{
  "detail": "Synthesis worker is currently busy. Please wait a moment."
}
```

#### `503 Service Unavailable`
Returned when Kokoro model weights (`kokoro-v1_0.pth` or `kokoro-v0_19.pth`), voice files, or TTS dependencies are missing from the container environment.

```json
{
  "detail": "TTS service is unavailable: Kokoro dependencies or model weights are missing."
}
```

#### `500 Internal Server Error`
Returned if an unexpected exception occurs during audio rendering.

```json
{
  "detail": "Failed to synthesize audio."
}
```

---

## 3. Client Interaction Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant ChatView as ChatView (Frontend)
    participant TTSCtrl as TTSController (Browser)
    participant Backend as FastAPI /api/tts/synthesize
    participant Kokoro as Kokoro KPipeline (Worker Thread)

    User->>ChatView: Clicks speaker icon on completed reply
    ChatView->>TTSCtrl: play(messageId, text)
    alt Audio is already in Cache
        TTSCtrl->>TTSCtrl: audio.play() from cache blob URL
        TTSCtrl-->>ChatView: Transition button state to 'playing'
    else Audio not in Cache
        TTSCtrl-->>ChatView: Transition button state to 'loading'
        TTSCtrl->>Backend: POST /api/tts/synthesize { text, message_id }
        Backend->>Backend: Clean text (strip code blocks, markdown, emojis)
        Backend->>Kokoro: asyncio.to_thread(generate_audio)
        Kokoro-->>Backend: 24kHz audio numpy array
        Backend-->>TTSCtrl: 200 OK (audio/wav binary)
        TTSCtrl->>TTSCtrl: URL.createObjectURL(blob), save to cache
        TTSCtrl->>TTSCtrl: audio.play()
        TTSCtrl-->>ChatView: Transition button state to 'playing'
    end
    User->>ChatView: Clicks active speaker icon (or switches chat)
    ChatView->>TTSCtrl: stop()
    TTSCtrl->>TTSCtrl: audio.pause(); audio.currentTime = 0;
    TTSCtrl-->>ChatView: Transition button state to 'idle'
```
