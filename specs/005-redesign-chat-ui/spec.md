# Feature Specification: Chat UI Redesign & Thinking Toggle with Pastel Developer Aesthetic

**Feature Branch**: `005-redesign-chat-ui`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "می خوام که کل صفحه chat با مدل هوش مصنوعی رو دوباره بازطراحی کنم. در واقع بخشی که در دایرکتوری static قرار داره. از شما می خوام که بهترین پیشنهاد خودتون رو برای بازطراحی و بهتر و زیبا تر کردن این بخش به من ارائه بدید. ضمنا می خوام که قابلیت خاموش و یا روشن کردن حالت Thinking هم اضافه بشه. همینطوری برای طراحی از رنگ های پاستیلی استفاده بشه. طراحی شیک و زیبا باشد. لوگوی سایت هم باید بر طبق حالت زیر باشد: A minimal, modern developer-style logo based on terminal or code command syntax, featuring the exact text sequence: '> ~/.E_' over a soft, light pastel blue background (or transparent if supported)..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pastel Developer UI & Modern Aesthetic Redesign (Priority: P1)

As a developer or AI chat user, I want an aesthetically pleasing, modern chat interface with a harmonious pastel color scheme, clean layout, and smooth typography so that chatting with local models is visually delightful and distraction-free.

**Why this priority**: Core visual redesign is the primary objective of this feature. It transforms the current dark slate look into a refined, high-craft developer interface with pastel tones (light pastel blue background, pastel purple/violet text, muted pastel burgundy accents).

**Independent Test**: Load the web interface in a browser. Verify that the new pastel color palette, sleek header, modern chat bubbles, and clean prompt composer render immediately with no layout glitches.

**Acceptance Scenarios**:

1. **Given** a user navigates to the application, **When** the page loads, **Then** they see a soft pastel palette with modern card borders, smooth rounded corners, clean baseline typography, and responsive chat container.
2. **Given** an empty chat state, **When** no messages have been sent, **Then** a stylish developer-oriented welcome screen with pastel quick-prompt pills is displayed.
3. **Given** a user sends a prompt and receives a response containing markdown and code, **When** the assistant streams the response, **Then** the message bubble renders with pastel code blocks, clear syntax contrast, and a one-click copy button.

---

### User Story 2 - Blinking Terminal Logo Implementation (Priority: P1)

As a user, I want to see the authentic developer brand logo `> ~/.E_` with precise color separation and a blinking underscore cursor so that the web interface has a distinctive and polished identity.

**Why this priority**: Essential requirement specified by the user with exact visual reference and styling guidelines matching the provided design sheet.

**Independent Test**: Inspect the brand logo in the top navigation bar. Verify that `>` is pastel burgundy/muted red, `~/.E` is pastel purple/violet, and `_` blinks rhythmically and steadily without shaking or causing layout shift.

**Acceptance Scenarios**:

1. **Given** the application header, **When** viewed on any supported viewport, **Then** the logo text strictly reads `> ~/.E_` with geometric monospace developer font alignment.
2. **Given** the rendered logo, **When** rendered, **Then** `>` has pastel burgundy/muted red color (`#BA4659`), `~/.E` has pastel purple/violet color (`#7A5EA7`), and `_` has matching pastel purple color.
3. **Given** the underscore `_`, **When** the page is active, **Then** it animates with a smooth, seamless blinking/pulsing cursor effect while `> ~/.E` stays perfectly static.

---

### User Story 3 - Thinking Mode Toggle (Priority: P2)

As a user interacting with reasoning models (e.g., DeepSeek R1, Qwen reasoning models), I want to easily toggle "Thinking Mode" on or off so that I can choose whether to inspect detailed internal thought traces or see only direct final answers.

**Why this priority**: Direct functional requirement requested by the user. Reasoning models generate detailed thought chains that users sometimes want to inspect and other times want collapsed or omitted to keep the conversation concise.

**Independent Test**: Toggle the Thinking Mode control in the header/toolbar. Submit a query to a model that outputs `<think>` tokens. Verify that when toggled OFF, thinking is hidden/collapsed according to the selected mode, and when toggled ON, thinking accordion blocks are clearly accessible.

**Acceptance Scenarios**:

1. **Given** a user is on the chat page, **When** they view the header/controls area, **Then** they see a clear, styled toggle switch or button for "Thinking Mode" with visible active/inactive states.
2. **Given** Thinking Mode is toggled OFF, **When** a model streams reasoning tokens, **Then** the reasoning thoughts are cleanly suppressed or hidden from the immediate view according to user preference.
3. **Given** Thinking Mode is toggled ON, **When** a model streams reasoning tokens, **Then** the thoughts appear in a sleek, pastel-styled collapsible accordion (`Thinking Process`) with live streaming indicator.
4. **Given** a user changes their Thinking Mode setting, **When** they reload or revisit the page, **Then** their preference is remembered (persisted in `localStorage`).

---

### User Story 4 - Theme Adaptation / Palette Controls (Priority: P3)

As a user, I want the pastel design to feel comfortable across lighting conditions, supporting both the soft light pastel blue theme and dark pastel navy theme shown in the reference design.

**Why this priority**: The provided design reference illustrates both "ORIGINAL / LIGHT MODE" (pastel blue background) and "DARK MODE" (pastel navy background). Supporting theme switching provides flexibility while maintaining pastel styling.

**Independent Test**: Toggle between light and dark pastel modes. Verify that all components (background, cards, bubbles, logo, borders, input area) seamlessly adapt their pastel palette tokens without contrast degradation.

**Acceptance Scenarios**:

1. **Given** the default application state, **When** loaded, **Then** it presents the soft pastel light blue theme matching the design image.
2. **Given** a theme toggle control, **When** the user clicks it, **Then** the palette transitions smoothly to the dark pastel navy mode with matching pastel lavender and muted red logo tokens.
3. **Given** the user's preference, **When** the page is refreshed, **Then** the chosen theme persists.

---

### Edge Cases

- **Mobile Viewports (<480px)**: The header controls (brand logo, model selector, thinking toggle, theme toggle, clear button) must stack or scale gracefully without horizontal scrollbars or clipping.
- **Models Without Thinking**: When interacting with models that do not output reasoning tokens (standard models without `<think>` tags), the UI must behave seamlessly without displaying empty thinking boxes or error states regardless of the toggle position.
- **Long Code Blocks**: Horizontal scroll within code blocks must not break message bubble borders or overflow the screen width.
- **Rapid Toggle Changes**: Toggling Thinking Mode mid-stream should update the visibility of active reasoning blocks immediately without aborting the ongoing token stream.
- **Offline / Disconnected Ollama**: Status pill must display soft pastel warning/error badges without disrupting the overall interface palette.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST redesign the frontend assets in `app/static/` (`index.html`, `style.css`, `app.js`) to provide a clean, modern pastel interface.
- **FR-002**: System MUST implement the brand logo sequence `> ~/.E_` where `>` is pastel burgundy/muted red (`#BA4659`), `~/.E` is pastel purple/violet (`#7A5EA7`), and `_` is an animated pulsing/blinking cursor in pastel purple.
- **FR-003**: System MUST align the brand logo horizontally on a baseline using a geometric, clean monospace font with zero vertical layout shifting during cursor blink animation.
- **FR-004**: System MUST provide an interactive "Thinking Mode" control allowing users to switch reasoning visibility on and off.
- **FR-005**: System MUST persist the user's Thinking Mode state in browser storage (`localStorage`) so that preferences are maintained across page reloads.
- **FR-006**: System MUST implement a dual-action Thinking Mode toggle: when toggled OFF, it hides reasoning thinking blocks in the UI and passes a parameter (`think: false`) in generation requests to disable thinking token generation where supported by the backend model; when toggled ON, it displays thinking traces in a refined pastel accordion.
- **FR-007**: System MUST provide a theme switcher allowing users to toggle between Light Pastel Blue (soft light pastel blue background `#EBF3FA`, clean white/pastel message cards) and Dark Pastel Navy (deep navy background `#191F2D`, pastel lavender message highlights), persisting the chosen theme in browser storage (`localStorage`).
- **FR-008**: System MUST style user message bubbles, assistant message bubbles, system prompts, and status badges using complementary pastel hues with adequate contrast for readability (WCAG AA compliant for text).
- **FR-009**: System MUST preserve all existing core capabilities: model dropdown selection, live SSE token streaming, generation abort/stop button, clear chat history, and copy-to-clipboard on code blocks.
- **FR-010**: System MUST render empty state quick-prompt buttons with rounded pastel pill styling and hover micro-interactions.

### Key Entities

- **UI Theme Configuration**: Stores theme variables (`--bg-primary`, `--bg-secondary`, `--logo-prompt`, `--logo-text`, `--accent`, `--border-color`).
- **User Interface Preferences**: Client-side object containing `thinking_enabled` (boolean) and `theme_mode` (`light` | `dark`), stored in `localStorage`.
- **Chat Message Item**: Visual message node representing `user` or `assistant` message, containing markdown body, optional thinking details disclosure element, and copy/action elements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can toggle Thinking Mode on or off with a single click, taking effect immediately in under 100 milliseconds.
- **SC-002**: Logo cursor blink animation maintains 60 FPS smoothly without triggering layout reflows or parent container repaints.
- **SC-003**: The entire interface complies with WCAG AA contrast standards (minimum 4.5:1 for body text against pastel backgrounds).
- **SC-004**: First contentful paint of the redesigned UI loads in under 300ms on standard local connections with zero external font/CSS CDN dependencies.
- **SC-005**: 100% of existing chat interactions (send, stream, stop, clear, model switch, copy code) continue functioning flawlessly without regression.

## Assumptions

- Frontend code remains pure vanilla HTML, modern CSS, and vanilla JavaScript without introducing heavy framework dependencies (React, Vue) to keep the application lightweight, fast, and easy to deploy.
- Standard modern system monospace fonts (e.g., `SFMono-Regular`, `Consolas`, `ui-monospace`, `Menlo`, `monospace`) provide geometric, clean developer typography without requiring heavy web font downloads.
- Thinking traces are identified via existing SSE `parsed.thinking` streaming protocol and `<think>` token patterns.
- Backend Python API routes remain backward-compatible while supporting any optional query parameters if needed for backend thinking suppression.
