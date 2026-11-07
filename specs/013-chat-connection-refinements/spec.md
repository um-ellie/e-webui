# Feature Specification: Chat Connection Fix and Composer Refinements

**Feature Branch**: `013-chat-connection-refinements`

**Created**: 2026-11-07

**Status**: Ready for Planning

**Input**: User description: "Fix model replies in the chat, move model picker into the composer with upward listbox menu per chat-mock-v2.html, new Enter-style send button and disabled mic button, fix sidebar toggle layout breakage on all screen sizes, and completely remove empty-state suggestion chips."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the Model's Answer in the Chat (Priority: P1)

As a user, I want every prompt I submit to reliably produce a visible, incrementally streaming answer from the selected local Ollama model (with visible loading state, streaming cursor, reasoning blocks, and clear failure recovery), so that I can hold responsive conversations with local models without messages failing silently or appearing blank.

**Why this priority**: Chatting is the fundamental purpose of e-webui. When model replies do not appear, the application is non-functional. Fixing the connection and rendering pipeline end-to-end is the highest priority.

**Independent Test**: Can be tested by sending a prompt in an active chat session. Verified when an assistant turn appears within 100 ms with an active blinking cursor, displays a "Loading model…" status if the model cold-loads, streams tokens continuously, properly nests reasoning into a collapsible chip, formats Markdown cleanly, preserves multi-turn context on subsequent turns, and renders explicit actionable error cards with a Retry button on failure.

**Acceptance Scenarios**:

1. **Given** an active chat session and selected Ollama model, **When** the user sends a prompt, **Then** within 100 ms the user prompt is displayed and an assistant reply entry appears below it showing the blinking rose cursor `_`.
2. **Given** the model is cold-loading or the first token is delayed, **When** waiting for initial generation, **Then** the assistant message displays an active "Loading model…" status with an elapsed timer instead of a frozen or blank message.
3. **Given** the model begins emitting tokens, **When** Server-Sent Events stream from the backend, **Then** tokens append incrementally without flickering, ending in a completed state showing the model name and generation speed (tokens/sec).
4. **Given** a reasoning model (e.g. DeepSeek-R1, Qwen with thinking enabled), **When** tokens arrive, **Then** thinking content appears inside a collapsible "Thought for N seconds" block (default collapsed) and final response text appears below it. If the model returns *only* reasoning, the UI displays the reasoning block along with a clear note ("The model returned only reasoning") rather than an empty message.
5. **Given** any backend, network, or Ollama failure (session expired, service unreachable, model not found, out of memory, timeout, interrupted stream), **When** generation fails, **Then** a visible error card replaces or appends to the reply turn displaying a user-friendly explanation, an immediate **Retry** action button, and a collapsible "Details" accordion showing HTTP status and error category (strictly omitting authentication secrets).
6. **Given** generation is in progress, **When** the user clicks Stop (or presses `Esc`), **Then** generation halts immediately, all partial tokens received so far are preserved, the blinking cursor is removed, and Regenerate/Retry actions are available.
7. **Given** an existing conversation with prior message turns, **When** the user sends an additional message, **Then** prior dialogue context is sent to the backend so the model maintains coherent conversational memory.

---

### User Story 2 - Choose the Model Inside the Message Box (Priority: P1)

As a user, I want the model selector relocated from the top header into the bottom-right corner of the composer card as an elegant pill with an upward popover menu matching `chat-mock-v2.html`, so that selecting and reviewing the active model is close to the send controls.

**Why this priority**: Placing model selection directly beside the input creates a unified, ergonomic composition workflow, matching modern AI chat interfaces and freeing up header space.

**Independent Test**: Can be tested by verifying the header no longer contains a model dropdown, opening the composer model pill at the bottom right, navigating available models with keyboard (Arrows, Enter, Esc), selecting a model, verifying model details (size, quantization, reasoning capability, loaded status), and observing that the choice persists for subsequent prompts.

**Acceptance Scenarios**:

1. **Given** the top header bar, **When** rendered, **Then** the model selector dropdown is completely removed; the header contains only the editable chat title, Share button, and overflow menu.
2. **Given** the composer card bottom row, **When** viewed from left to right, **Then** the left side hosts Attach (+), Tools, and Think controls; the right side hosts the Model picker pill, Microphone button, and Send button in exact order.
3. **Given** the model picker pill, **When** viewed, **Then** it displays a dual-tone gradient glyph (`--rose` to `--purple`), the active model name, a muted parameter size tag (e.g. `14b`), and an upward chevron.
4. **Given** the model picker pill, **When** clicked or activated via `Enter` or `Space`, **Then** an upward popover menu opens with a smooth 120–160 ms transition above the composer without clipping beyond viewport bounds.
5. **Given** the opened model menu, **When** viewed, **Then** it shows a "Models" header, a list of models reported by the backend with name, size badge, disk size, quantization level, a "Reasoning" badge for thinking models, a "Loaded" indicator for models already in memory, a checkmark on the selected model, an instant search filter if more than 8 models exist, and a disabled footer item "Manage models" marked "Not available yet".
6. **Given** keyboard navigation, **When** the menu is open, **Then** Arrow Up/Down navigates options, `Enter` selects the highlighted model and closes the menu, and `Esc` dismisses the menu returning focus to the pill; the menu follows `role="listbox"` and `role="option"` accessibility patterns.
7. **Given** a model selection, **When** changed, **Then** the selection applies to the next message and is remembered on the client device. If a previously remembered model is no longer available on Ollama, the UI falls back to the first available model and informs the user with a brief toast notification.
8. **Given** a message is actively streaming, **When** inspected, **Then** the model picker is disabled until generation completes or stops.

---

### User Story 3 - Send with an Enter-Style Button, and See the Microphone (Priority: P1)

As a user, I want the primary send button styled with the standard Enter key symbol (↵) and an adjacent disabled microphone button indicating prospective voice input, so that the controls feel intuitive and familiar.

**Why this priority**: Replaces the up-arrow glyph with the approved Enter return icon matching `chat-mock-v2.html` and visually reserves space for voice interaction without throwing errors.

**Independent Test**: Can be tested by inspecting the composer action row, verifying the send button uses the down-left return arrow icon (↵), checking that it disables when the textarea is empty, checking that the microphone button appears disabled with an informative tooltip, and verifying that pressing Enter or clicking Send dispatches the prompt.

**Acceptance Scenarios**:

1. **Given** the send button, **When** rendered, **Then** it is a 38 px round rose button featuring the Enter key return symbol (`↵`, arrow turning down and left), with accessible title and tooltip "Send (Enter)".
2. **Given** an empty composer textarea, **When** viewed, **Then** the send button is visibly disabled and non-clickable; **When** characters are typed, **Then** the button becomes enabled.
3. **Given** active response generation, **When** streaming, **Then** the send button switches to a Stop button with a square icon.
4. **Given** the microphone button located immediately to the left of Send, **When** viewed, **Then** it appears as a 38 px round outline button in disabled styling with a tooltip "Voice input is not available yet", registered as disabled in the feature registry, and clicking it causes no errors or state changes.
5. **Given** typing in the textarea, **When** pressing Enter, **Then** the prompt is sent; **When** pressing Shift+Enter, **Then** a newline is inserted.

---

### User Story 4 - Close and Open the Sidebar Without Breaking the Page (Priority: P1)

As a user, I want toggling the sidebar open or closed to transition smoothly without breaking the layout, causing content jumps, generating horizontal scrollbars, or corrupting alignment on any screen size (desktop, tablet, mobile), so that managing workspace real estate is effortless and stable.

**Why this priority**: A sidebar toggle that causes layout blowout, horizontal overflow, or misaligned reading columns degrades usability across devices.

**Independent Test**: Can be tested by clicking the sidebar toggle (or pressing `Ctrl+B`) 50 times in succession on desktop (≥1024 px), tablet (640–1023 px), and mobile (<640 px), verifying smooth CSS transitions with zero horizontal overflow, consistent 720 px reading column centering, and uninterrupted token streaming during toggles.

**Acceptance Scenarios**:

1. **Given** desktop viewport (≥1024 px) with sidebar expanded, **When** the user collapses the sidebar, **Then** the sidebar smoothly collapses to an icon rail (or hides), the main reading column and composer remain perfectly centered, no horizontal scrollbar appears on the window, and no text wrapping glitches occur.
2. **Given** desktop viewport with sidebar collapsed, **When** expanded again, **Then** the layout returns exactly to its initial 264 px sidebar configuration without layout distortion.
3. **Given** tablet (640–1023 px) or mobile (<640 px), **When** toggled, **Then** the sidebar opens as a drawer/overlay with a dim backdrop that closes on outside tap or `Esc` without affecting the underlying chat reading position.
4. **Given** tokens are actively streaming, **When** the sidebar is toggled or the browser window is resized, **Then** streaming continues uninterrupted, auto-scroll maintains proper position, and layout integrity is preserved.
5. **Given** the toggle control, **When** inspected, **Then** it maintains `aria-expanded` attributes, has a visible focus ring, and client state is remembered on this device.

---

### User Story 5 - Remove the Suggestion Chips (Priority: P2)

As a user, I want the empty chat screen simplified to display only the brand mark, time-of-day greeting, and centered composer, removing all suggested prompt chips from the UI and codebase, so that the opening screen is calm, minimal, and uncluttered.

**Why this priority**: Eliminates visual clutter in the empty state per user design feedback and removes dead code from the project.

**Independent Test**: Can be tested by opening a new chat session and searching the codebase. Verified when the empty screen renders solely the brand mark, greeting, and composer card with zero prompt chips, and a project-wide search confirms no leftover suggestion-chip markup, classes, scripts, or strings.

**Acceptance Scenarios**:

1. **Given** a new or empty chat screen, **When** viewed, **Then** it displays only the brand mark (`>E_`), the time-aware serif greeting (e.g. "Good afternoon, Ellie"), and the centered composer card.
2. **Given** the codebase (HTML, CSS, JS, translations), **When** audited, **Then** all suggestion chip markup, CSS selectors (`.suggestion-chip`, `.suggestion-chips-grid`), component logic, and strings are completely removed.

---

### Edge Cases

- **Cold Model Loading**: When a model takes 10–60 seconds to load into memory on the first request, the UI must show an animated "Loading model…" status with elapsed seconds, never a blank, frozen, or timed-out message.
- **Reasoning-Only Output**: If a model produces only chain-of-thought tokens without standard output, the reasoning block must render alongside an explicit note ("The model returned only reasoning"), never an empty bubble.
- **Large Model List (>8 models)**: The upward model popover must render an instant search filter input and scroll internally, ensuring the menu never clips outside the top of the viewport.
- **Narrow Viewports (360 px width)**: The composer bottom row must flex gracefully without overflow. The model picker truncates long names and preserves the glyph and size badge; Tools and Think labels collapse to icon buttons if necessary.
- **Model Disappears from Backend**: If the remembered active model was deleted or unloaded in Ollama, the UI falls back to the first available model and presents a subtle toast notification explaining the fallback.
- **Multi-Byte / Persian Character Stream Splitting**: Backend and frontend stream decoders must not split UTF-8 byte sequences or corrupt Persian characters during streaming.
- **Network Drop / Timeout Mid-Stream**: If connection is severed during streaming, the received partial text is preserved, an error card with Retry is displayed, and the composer returns to an enabled state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The root cause of missing model replies MUST be diagnosed and documented in the feature's research notes (`research.md`), covering model payload parameters, SSE stream handling, and DOM rendering lifecycle.
- **FR-002**: The test harness MUST include reproducible automated tests covering the full reply flow with a simulated Ollama streaming endpoint: normal reply, reasoning + answer, reasoning-only, empty reply, error before first token, mid-stream error, and slow first token.
- **FR-003**: The streaming pipeline between Ollama, the FastAPI backend, and the browser MUST process chunk boundaries cleanly without line truncation, UTF-8 character splitting, or proxy/response buffering.
- **FR-004**: All error paths MUST render visible in-chat failure notices with plain-language explanations, a Retry action, and a collapsible Details panel; silent console-only failures are strictly prohibited.
- **FR-005**: The backend MUST log the lifecycle of each chat request (start, first token timestamp, completion, error, duration) with an associated request ID, without logging sensitive message text or tokens.
- **FR-006**: Available models MUST be queried dynamically from the backend (`/api/models`); the selected model identifier MUST be transmitted with every generation request and reflected in the reply turn.
- **FR-007**: The model picker, microphone button, Enter-style send button, stop button, and sidebar toggle MUST be registered in the central feature registry (`features.js`) with accurate `enabled` or `disabled` states and tooltips.
- **FR-008**: The top header MUST NOT contain a model selector; the header is reserved for chat title, Share, and the overflow menu.
- **FR-009**: The model selector MUST reside in the composer bottom-right row, featuring an upward popover menu matching `design/reference/chat-mock-v2.html`.
- **FR-010**: The send button MUST feature the Enter key symbol (`↵`, down-left arrow) and switch to a square Stop icon during generation; an adjacent disabled microphone button MUST display a "Voice input is not available yet" tooltip.
- **FR-011**: Toggling the sidebar MUST NOT cause horizontal scrolling, layout shifts, or responsive breakage on any screen width (desktop, tablet, mobile), and MUST operate seamlessly while tokens are streaming.
- **FR-012**: All suggestion chips, styles, markup, and strings MUST be completely removed from the project.
- **FR-013**: Multi-turn conversation context MUST be sent with prompts so the model retains awareness of prior dialogue turns in the active session.
- **FR-014**: All user-visible strings MUST be stored in the central i18n dictionary; colors and radii MUST adhere strictly to `design-tokens.css`.
- **FR-015**: Existing capabilities MUST NOT regress: authentication, logout, theme switching, Markdown formatting, code block copy, generation cancellation, and retry.

### Key Entities *(include if feature involves data)*

- **Model**: Represents an Ollama model entity with fields: `name` (string), `sizeTag` (string, e.g. "14b"), `diskSize` (number/string, e.g. "9.3 GB"), `quantization` (string, e.g. "Q4_K_M"), `isReasoning` (boolean), `isLoaded` (boolean).
- **Assistant Message Turn**: Represents the assistant reply state: `status` (`"pending"`, `"loading_model"`, `"streaming"`, `"completed"`, `"stopped"`, `"error"`), `content` (string), `reasoning` (string or null), `metrics` (object with model name, tokens per second, duration), `errorDetails` (object with failure class, status code, error text).
- **Feature Flag Entry**: Represents a registered control with fields: `controlId` (string), `status` (`"enabled"` or `"disabled"`), `reason` (string), `shortcut` (optional string).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated tests with simulated Ollama streams and manual testing with the live Ollama instance, 100% of sent messages culminate in either a visible answer or an actionable in-chat error card with Retry; zero blank assistant turns occur.
- **SC-002**: The first token of a streaming response appears in the UI within 300 ms of arriving at the backend endpoint, and tokens stream smoothly without visual jitter.
- **SC-003**: A dedicated root cause analysis is documented in `research.md`, accompanied by an automated regression test that fails before the fix and passes after.
- **SC-004**: The composer visual layout precisely matches `design/reference/chat-mock-v2.html` at 1280×800 in both light and dark themes, with zero element clipping or overflow from 360 px up to 1920 px viewport widths.
- **SC-005**: The sidebar can be toggled 50 consecutive times on desktop, tablet, and mobile viewports—both while idle and during active streaming—with zero layout breakage or horizontal window scrollbars.
- **SC-006**: A repository-wide text search confirms zero remaining occurrences of suggestion-chip selectors, classes, markup, or translation keys.
- **SC-007**: Automated accessibility audits report zero critical or serious issues on the chat view, and the composer model picker is 100% operable via keyboard (`Enter`, `Space`, `ArrowUp`, `ArrowDown`, `Esc`).
- **SC-008**: 100% of existing baseline behaviors (login, theme switching, Markdown rendering, code copy, prompt halt, model loading) continue functioning without regression.

## Assumptions

- **Architecture & Infrastructure**: Frontend remains plain HTML, CSS, and modern vanilla JavaScript ES modules without bundlers or frameworks. Backend remains FastAPI.
- **Container Isolation (Constitution Principle I)**: In strict conformance with Principle I, all automated testing is performed locally in the workspace using mock/simulated servers; no `incus` commands or container modifications are executed by the agent.
- **Authentication**: Authentication continues using the existing HttpOnly cookie mechanism; no auth tokens are exposed to client JavaScript.
- **Multi-Turn Context**: Prior messages in the active in-memory session are supplied to the backend inference payload in chronological order.
