# Feature Specification: Streaming Render Optimization and Offline Code Syntax Polish

**Feature Branch**: `017-streaming-render-code-polish`

**Created**: 2026-11-14

**Status**: Ready for Planning

**Input**: User description: "018-streaming-render-code-polish (Zero-lag streaming + offline code syntax highlighting)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Zero-Lag Fluid Token Streaming (Priority: P1) 🎯 MVP

As a user prompting fast local LLMs or receiving long technical answers, I want the token stream to render smoothly and continuously at 60 fps without freezing the browser, stuttering when I scroll, or consuming 100% of my CPU, so that the reading experience feels effortless, responsive, and calm.

**Why this priority**: Core interaction bottleneck. Re-parsing full Markdown and re-sanitizing the entire DOM on every single incoming token causes layout thrashing and severe main-thread lag during fast local generation. Fixing the streaming render pipeline is essential for high-throughput local models.

**Independent Test**: Can be tested by generating a long response (800+ tokens) with a fast model. Verified when tokens append smoothly at 60 fps, scrolling up and down remains fluid with zero frame drops, CPU usage remains low, and the blinking rose cursor animates continuously without jumping.

**Acceptance Scenarios**:

1. **Given** an active response stream emitting tokens at high velocity (40–100 tokens/sec), **When** tokens arrive from the backend, **Then** text appends smoothly to the reading view without browser freezing, layout jumping, or dropped frames.
2. **Given** a lengthy multi-paragraph response actively streaming, **When** the user scrolls up to read earlier paragraphs or selects text, **Then** the scrolling gesture is completely smooth (60 fps) and user selection is not disrupted.
3. **Given** an in-flight stream with unclosed Markdown formatting (e.g. open code fence or list), **When** partial tokens append, **Then** the interface does not repeatedly flicker or tear down existing rendered content.
4. **Given** an active stream, **When** inspected, **Then** the blinking rose cursor element (`.stream-cursor`) persists smoothly at the text boundary without being destroyed and recreated on each chunk.

---

### User Story 2 - Offline Syntax-Highlighted Code Blocks (Priority: P1)

As a developer receiving code snippets (Python, Shell/Bash, JavaScript/TypeScript, JSON, YAML, SQL, HTML, etc.) from local models, I want code blocks to display crisp, theme-aware syntax highlighting with language badges and a 1-click copy button, so that code is easy to read, review, and extract without requiring any internet connection.

**Why this priority**: Essential developer UX. Currently, code blocks render as plain monochrome text. Syntax highlighting is the single most requested visual enhancement for local AI coding interfaces.

**Independent Test**: Can be tested by prompting the model for code in Python, Bash, and JSON. Verified when keywords, strings, comments, and numbers display distinct, readable syntax colors matching the e-webui palette in both light and dark mode, completely offline without external network requests.

**Acceptance Scenarios**:

1. **Given** an assistant message containing a fenced code block with a language tag (e.g. ```` ```python ````), **When** the code block renders, **Then** keywords, strings, function names, numbers, and comments display distinct, theme-harmonized syntax colors.
2. **Given** a code block in dark mode or light mode, **When** the theme is toggled, **Then** syntax colors immediately adapt to ensure high contrast and zero eye strain.
3. **Given** any code block, **When** viewed, **Then** a clean header shows the language name (e.g. `python`, `bash`, `json`) and an accessible "Copy" button.
4. **Given** the user clicks "Copy", **When** activated, **Then** the exact unformatted code text is copied to the clipboard, the button icon transforms into a checkmark with label "Copied!", and returns to idle after 2 seconds.
5. **Given** long horizontal code lines, **When** rendered, **Then** the code block provides smooth horizontal scrolling with preserved monospace font formatting and zero layout distortion.
6. **Given** a code block inside a Persian or RTL response, **When** rendered, **Then** the code block remains strictly LTR (`dir="ltr"`) with isolated bidi layout.

---

### User Story 3 - Visual Polish, Smooth Accordions, and Dark Mode Contrast (Priority: P2)

As a user spending extended sessions in the chat interface, I want reasoning traces to expand and collapse with a smooth animated transition, code blocks in dark mode to stand out with clear visual bounding, and scrollbars to be thin and subtle, so that the overall visual environment feels modern, polished, and distraction-free.

**Why this priority**: Visual craft and aesthetic delight. Replacing abrupt UI snaps with silky transitions and improving dark mode code contrast significantly elevates the everyday experience.

**Independent Test**: Can be tested by clicking reasoning chips to observe the smooth accordion transition, switching to dark mode to verify code container border definition, and scrolling long views to check thin custom scrollbars.

**Acceptance Scenarios**:

1. **Given** an assistant response with reasoning ("Thought for N seconds"), **When** the user clicks the reasoning chip, **Then** the content smoothly animates open or closed with a fluid height transition (180–220 ms) rather than an abrupt jump.
2. **Given** dark mode, **When** viewing code containers, **Then** the code background (`--codebg`) and border (`--line`) provide a distinct, clearly bounded contrast (at least 3:1 contrast ratio) against the message card background (`--card`).
3. **Given** scrollable reading columns or code blocks, **When** viewed across modern browsers, **Then** scrollbars display as thin, elegant tracks styled with theme tokens (`--line` and transparent track).

---

### Edge Cases

- **Code Blocks Without Specified Language**: What happens when a model outputs a fenced code block without a language identifier (e.g. ```` ``` ````)? The system displays a generic `code` label and renders clean monospace text without syntax highlighting errors.
- **In-Flight Incomplete Code Fences**: What happens while a 300-line code block is streaming before the closing ```` ``` ```` arrives? The streaming parser formats the active block cleanly in-progress without breaking outer chat layout.
- **Extreme High-Volume Streams**: What happens if a model outputs 120+ tokens/second? The RAF throttle batches updates to 16–50 ms intervals, completely buffering excess chunks without memory leakage or thread lock.
- **Rapid Theme Switching**: What happens if the user switches themes while a response is streaming? Syntax highlighting colors and code containers update dynamically via CSS variables without requiring a re-render.
- **Strict Offline Operation**: What happens if the container or host has zero internet access? 100% of syntax highlighting tokens, grammars, and stylesheets are self-hosted locally within the workspace with zero CDN calls.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST throttle Markdown parsing and DOM sanitization during active token streaming to animation frame boundaries (~16–50 ms intervals), decoupling network packet ingestion from DOM layout.
- **FR-002**: System MUST preserve an unbroken 60 fps interface responsiveness (smooth scrolling, typing, and window resizing) during active token generation.
- **FR-003**: System MUST maintain a persistent blinking rose cursor element (`.stream-cursor`) during active generation, avoiding element destruction and re-creation on every token.
- **FR-004**: System MUST provide syntax highlighting for common languages (Python, JavaScript, TypeScript, Bash/Shell, JSON, YAML, HTML, CSS, SQL, Markdown) completely offline using self-hosted local assets.
- **FR-005**: Syntax highlighting MUST adapt dynamically to both Light and Dark color themes using the application's CSS design tokens.
- **FR-006**: Code containers MUST include a header displaying the normalized language badge and a 1-click clipboard copy button with visual checkmark feedback.
- **FR-007**: Code containers MUST enforce strict left-to-right (`dir="ltr"`) text direction and bidirectional isolation (`unicode-bidi: isolate`) regardless of the document's directionality.
- **FR-008**: Reasoning thought chips MUST expand and collapse with a smooth animated height transition (180–220 ms).
- **FR-009**: In dark mode, code container backgrounds and borders MUST provide clear visual separation (minimum 3:1 contrast ratio) against message card backgrounds.
- **FR-010**: System MUST apply subtle, theme-aware custom scrollbar styling across all scrollable containers.

---

### Key Entities

- **StreamingBuffer**: In-memory transient buffer holding unrendered token chunks and scheduling throttled animation-frame DOM commits.
- **CodeBlockDescriptor**: Represents a parsed code fence containing raw code text, normalized language tag, syntax highlighting tokens, and copy state.
- **SyntaxTheme**: Color token mapping associating syntax grammar classes (keyword, string, comment, function, number, operator) with the application's light and dark palette variables.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During active streaming at 50+ tokens/sec, main-thread CPU time dedicated to Markdown parsing and DOM layout is reduced by at least 60% compared to per-token DOM rebuilds.
- **SC-002**: Zero dropped frames (solid 60 fps) when scrolling the chat reading view during continuous token generation.
- **SC-003**: 100% of code blocks with supported language tags render syntax highlighting in under 50 ms upon block arrival.
- **SC-004**: Zero external network or CDN requests dispatched for syntax highlighting or streaming rendering.
- **SC-005**: 100% of code blocks maintain strict LTR orientation and clean monospace alignment across all supported viewports.

---

## Assumptions

- Modern evergreen browsers (Chrome, Firefox, Safari, Edge) supporting standard `requestAnimationFrame` and CSS transitions.
- Offline deployment: All syntax highlighter grammars and styles are vendored directly in `app/static/vendor/` and `app/static/style.css` without external dependencies.
- Zero server-side alterations required: All streaming render optimization and syntax highlighting occur client-side in the browser.
