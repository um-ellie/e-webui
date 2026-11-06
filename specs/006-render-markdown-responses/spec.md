# Feature Specification: Markdown Response Display and Copy Actions

**Feature Branch**: `006-render-markdown-responses`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "می خوام تغییرات در حالت نمایش پاسخ های مدل انجام بدم. می خوام پاسخ ها سازگار با Markdown باشن. و همینطور دکمه کپی در پایین هر پاسخ برای کپی کردن کل باسخ همراه با قالب بندی Markdown انجام بشه. برای اینکه منظور من رو درست متوجه بشید: در واقع می خوام شبیه به خود سایت های هوش مصنوعی مثل Gmini, ChatGPT باشد."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rich Markdown Display for Assistant Responses (Priority: P1)

As a user interacting with the AI chat interface, I want the assistant's responses to be fully rendered with rich Markdown formatting (headings, styled text, lists, tables, blockquotes, and code blocks) similar to modern AI platforms like Gemini and ChatGPT, so that technical answers, structured data, and formatted explanations are clear, legible, and visually engaging.

**Why this priority**: Core presentation experience. Without rich Markdown support, users cannot comfortably read structured guides, tabular comparisons, bullet points, or formatted code.

**Independent Test**: Can be fully tested by asking the model for a response containing headings, bold/italic text, numbered lists, a markdown table, and code blocks, and verifying that each element displays as formatted typography rather than raw markdown syntax.

**Acceptance Scenarios**:

1. **Given** the assistant generates a message containing markdown headings (`#`, `##`), bold (`**`), italics (`*`), and lists (`-`, `1.`), **When** the message is displayed, **Then** all elements render as structured HTML elements with appropriate spacing and typography without raw markdown symbols visible.
2. **Given** the assistant outputs a markdown table with headers and rows, **When** the message renders, **Then** the content is presented in an aligned tabular layout with distinct header styling and borders.
3. **Given** the assistant includes links or blockquotes (`>`), **When** displayed in the chat, **Then** blockquotes have a visual accent bar and links are styled and navigable.

---

### User Story 2 - One-Click Full Response Copy with Markdown Fidelity (Priority: P1)

As a user reading an AI-generated answer, I want an easily accessible copy button at the bottom of each assistant message that copies the entire response with its original Markdown formatting to my clipboard, accompanied by clear visual confirmation, so that I can easily paste it into notes, documentation, or code editors.

**Why this priority**: Essential parity with platforms like ChatGPT and Gemini. Copying full responses is one of the most frequent user actions when using AI chat tools.

**Independent Test**: Can be fully tested by clicking the copy button located beneath any assistant response and pasting into a text editor, verifying that the clipboard contains the full raw Markdown text and that the UI indicates success.

**Acceptance Scenarios**:

1. **Given** an assistant message is displayed in the conversation, **When** the user looks at the bottom of the response, **Then** an action toolbar is visible containing a dedicated copy button.
2. **Given** the user clicks the response copy button, **When** the clipboard write succeeds, **Then** the button icon or text changes to show visual confirmation (e.g., "Copied!" or checkmark) and the clipboard holds the exact raw Markdown content of that response.
3. **Given** the copy confirmation state is shown, **When** approximately 1.5 to 2 seconds elapse, **Then** the button reverts to its original copy icon/state.

---

### User Story 3 - Standalone Code Block Formatting and Block Copy (Priority: P2)

As a developer receiving code snippets in assistant responses, I want code blocks to have dedicated visual framing, syntax presentation, language badges, and their own dedicated copy buttons, so that I can copy individual code blocks without having to select text manually or copy the surrounding conversational text.

**Why this priority**: High user value for programming tasks. Allows copying just the executable code snippet without surrounding explanations.

**Independent Test**: Can be fully tested by generating a multi-part response with explanations and code snippets, then clicking the copy button on an individual code block and verifying only the block's code is copied.

**Acceptance Scenarios**:

1. **Given** an assistant response containing a fenced code block with a specified language, **When** rendered, **Then** the code block appears in a styled card container showing a monospaced font and a language badge in the header.
2. **Given** an individual code block, **When** the user clicks the copy button within that code block's header, **Then** only that specific code block's text is copied to the clipboard, with localized copy confirmation.

---

### User Story 4 - Progressive Rendering and Smooth Streaming (Priority: P2)

As a user watching an AI response generate in real-time, I want markdown formatting to render smoothly as chunks arrive, without layout flickering or broken visual fragments, so that reading the response feels seamless and fluid.

**Why this priority**: User experience quality. Streaming is the default mode of modern LLMs, and rendering must not cause erratic UI jumps or invalid layout states while tokens stream in.

**Independent Test**: Can be fully tested during an active streaming response, observing that text and Markdown constructs render progressively, followed by the appearance of response action buttons once complete.

**Acceptance Scenarios**:

1. **Given** a response is actively streaming, **When** new tokens stream in, **Then** paragraphs and formatted segments render progressively with an active streaming indicator.
2. **Given** a streaming response completes, **When** generation stops, **Then** the full Markdown rendering finalizes and the response action toolbar (including the full copy button) is active and accessible.

---

### Edge Cases

- **Incomplete or unclosed Markdown during streaming**: Unclosed code fences (```` ``` ```` without closing ticks) or unclosed bold/italic tags while text is arriving MUST NOT break page layout or cause text to disappear.
- **Bi-directional (RTL/LTR) text**: When responses contain Persian/Arabic text mixed with English sentences or code blocks, code blocks and technical identifiers MUST remain strictly LTR with proper alignment, while RTL text reads naturally from right to left.
- **HTML tags in model output**: If the model outputs raw HTML tags (e.g. `<script>`, `<div>`, `<style>`), the renderer MUST sanitize or escape them to prevent cross-site scripting (XSS) while preserving intended Markdown tags.
- **Clipboard permission denied or unavailable**: If browser security blocks clipboard access (e.g. non-secure context or user denied permissions), the UI MUST gracefully show an informative message without crashing.
- **Responses with thinking process**: When "Thinking Process" is enabled and displayed in an expandable accordion, the full response copy button at the bottom of the message MUST copy the primary answer content, keeping thinking thoughts cleanly separated.
- **Empty or whitespace-only response**: The action toolbar copy button should be disabled or hidden if there is no response content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render assistant responses as rich formatted Markdown, including headings (levels 1-6), bold, italic, strikethrough, ordered lists, unordered lists, blockquotes, horizontal rules, and tables.
- **FR-002**: System MUST render markdown tables with clear column headers, row borders, and responsive scrollability for wide datasets.
- **FR-003**: System MUST format fenced code blocks in distinct containers with monospaced typography, language identification badges, and scroll handling for long code lines.
- **FR-004**: System MUST provide an individual copy button in each code block header to copy exclusively that code block's contents.
- **FR-005**: System MUST provide a response action toolbar at the bottom of every assistant message containing a full-response copy action.
- **FR-006**: When the full-response copy button is triggered, the system MUST copy the raw unrendered Markdown source text of the assistant's answer to the system clipboard.
- **FR-007**: System MUST provide immediate visual feedback (e.g. icon state change, tooltip, or "Copied!" notification) upon successful clipboard write, automatically reverting to the default state after a 1.5–2 second duration.
- **FR-008**: System MUST sanitize all rendered content to prevent script injection or unsafe markup while rendering legitimate Markdown formatting.
- **FR-009**: System MUST support progressive streaming updates so that incoming response chunks render without UI jitter, layout breakage, or missing text.
- **FR-010**: System MUST handle bidirectional text appropriately, preserving left-to-right (LTR) directionality and alignment for code blocks, inline code, and URLs, while maintaining proper alignment for right-to-left (RTL) prose.
- **FR-011**: System MUST ensure response copy action operates reliably on both desktop and mobile viewports with accessible touch targets.

### Key Entities

- **Assistant Message**: Represents an AI-generated turn in the conversation; contains the raw Markdown text, the rendered HTML representation, timestamp, and metadata.
- **Response Action Toolbar**: A container situated at the base of an assistant message providing interactive message-level operations (such as copying the full response).
- **Code Block Component**: A structured UI slice within a message containing syntax-styled code text, language label, and an independent clipboard action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of standard Markdown constructs (headings, lists, bold/italic, tables, blockquotes, code blocks) render with appropriate visual hierarchy, with 0 instances of unparsed syntax symbols displayed in finished responses.
- **SC-002**: Clicking the full-response copy button copies the complete response text with Markdown formatting in under 200 milliseconds.
- **SC-003**: Pasting a copied response into any standard Markdown editor produces exact match with the AI's generated source markdown, without lost characters or stray HTML tags.
- **SC-004**: Visual copy feedback displays within 100 milliseconds of user click and auto-reverts to default state within 1.5 to 2.0 seconds.
- **SC-005**: Code blocks of any length are copyable via their dedicated header button without including surrounding message text.
- **SC-006**: 0 layout breakage or browser console security errors when rendering responses containing HTML tags, unclosed fences, or RTL/LTR mixed text.

## Assumptions

- Modern web browsers supporting standard Clipboard API (`navigator.clipboard.writeText`) are the target environment, with fallback handling if permissions are restricted.
- The full response copy action is primarily located on assistant messages, matching the UX patterns of ChatGPT and Gemini.
- When thinking process mode is active, the main response copy button copies the assistant's answer; thinking process sections retain their own internal visibility without polluting the copied response.
- Rendering changes remain strictly within the frontend client presentation layer without requiring backend Ollama API changes.
