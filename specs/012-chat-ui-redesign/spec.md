# Feature Specification: Claude-Style Chat Interface Redesign (Appearance Phase)

**Feature Branch**: `012-chat-ui-redesign`

**Created**: 2026-11-07

**Status**: Ready for Planning

**Input**: User description: "e-webui chat UI redesign (appearance phase): Redesign the entire chat experience to look and feel like the Claude chat interface (claude.ai): calm, modern, spacious, and polished, with custom logo, pastel colors, automatic light and dark themes, a single feature-availability registry for upcoming capabilities, and strict preservation of current backend behaviors and isolation principles."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read and Write Conversations in a Claude-Style Layout (Priority: P1)

As a user, I want the chat conversation view to provide a clean, distraction-free reading and writing experience inspired by Claude's interface, displaying assistant replies in an elegant reading typography and user queries in compact pastel bubbles, so that reviewing long dialogues and streaming responses is comfortable and natural.

**Why this priority**: Reading and reviewing chat messages is the primary purpose of e-webui. Upgrading the conversation view transforms the daily user experience immediately and establishes the core aesthetic.

**Independent Test**: Can be tested by loading an active chat session and generating a response. Verified when messages render in a centered 720 px reading column, user bubbles appear on the right, assistant responses render in serif typography with a blinking rose terminal cursor during generation, and markdown/code blocks render with syntax tags and copy buttons.

**Acceptance Scenarios**:

1. **Given** an active conversation, **When** the chat view is rendered on desktop, **Then** messages appear in a centered reading column (~720 px wide) with user messages styled as soft rounded bubbles aligned to the right and assistant responses displayed without bubbles in a high-legibility serif reading font.
2. **Given** the assistant is generating a response, **When** tokens stream in incrementally, **Then** the reply displays token-by-token without visual flickering or layout jumping, a rose-colored blinking `_` cursor animates at the insertion point, and the composer action button becomes a Stop button.
3. **Given** an active response generation, **When** the user clicks Stop, **Then** generation halts immediately, the partial response text remains intact, the blinking cursor disappears, and retry/regenerate actions become available.
4. **Given** a generated message contains Markdown, **When** it renders, **Then** headings, lists, tables, blockquotes, links, inline code, and fenced code blocks format cleanly with safe markup execution (no script execution); code blocks show a language header and a Copy button that confirms with a "Copied" feedback state.
5. **Given** an assistant model outputs reasoning or chain-of-thought tokens, **When** the message renders, **Then** reasoning content is enclosed within a collapsible "Thought for N seconds" chip component that defaults to collapsed.
6. **Given** any completed assistant message, **When** viewed, **Then** an action bar below the message provides Copy, Like, Dislike, and Regenerate actions, along with a metadata label showing the model identifier and token generation rate when available.
7. **Given** a user message bubble, **When** hovered or focused, **Then** an Edit action is surfaced (disabled with an explanatory tooltip if resending prior turns is unsupported in the current backend).
8. **Given** the user scrolls up while an assistant response is streaming, **When** new tokens arrive, **Then** viewport auto-scrolling pauses to maintain reading position, and a "Scroll to latest" button appears floating above the composer.

---

### User Story 2 - Compose Messages with the Full Claude-Style Composer (Priority: P1)

As a user, I want a spacious, versatile message composer card anchored at the bottom of the conversation view that supports multi-line input, fast keyboard execution, and visible accessory controls for future capabilities, so that writing queries feels seamless and extensible.

**Why this priority**: The composer is the primary input conduit for all user interactions. It must support ergonomic typing, keyboard submission, and visual readiness for upcoming tools and file attachments without causing unexpected errors.

**Independent Test**: Can be tested by focusing the composer, entering single and multi-line queries, verifying auto-growth up to 8 lines, submitting via Enter, inserting newlines with Shift+Enter, and clicking auxiliary buttons (Attach, Tools, Think) to observe active or disabled states.

**Acceptance Scenarios**:

1. **Given** the composer card, **When** the user types multiple lines of text, **Then** the textarea smoothly auto-grows up to approximately 8 lines before enabling internal vertical scrolling.
2. **Given** text in the composer, **When** the user presses Enter (without Shift), **Then** the message is submitted; **When** the user presses Shift+Enter, **Then** a newline is inserted without sending.
3. **Given** an empty composer input, **When** the user attempts to send via keyboard or click, **Then** no message is sent and the send button remains inactive.
4. **Given** the composer action bar, **When** viewed, **Then** it presents an Attach (+) menu, a Tools menu, a Think toggle, a current model chip indicator, and the primary Send/Stop action button.
5. **Given** controls for capabilities not yet supported by the backend (e.g., Attach file, Tools menu), **When** clicked or hovered, **Then** each displays in a disabled styling with a "Not available yet" tooltip and does not throw an error or perform unexpected actions.
6. **Given** the Think toggle, **When** clicked, **Then** it toggles an active thinking state if the selected model supports reasoning; otherwise, it presents a disabled state indicating lack of model support.
7. **Given** files dragged onto the browser window or composer area, **When** dropped, **Then** a clean drop overlay appears explaining "File upload is not available yet" without crashing or navigating away.
8. **Given** the area beneath the composer, **When** rendered, **Then** a subtle centered disclaimer reads: "Local models can make mistakes. Check important info."

---

### User Story 3 - Navigate and Manage Sessions with the Collapsible Sidebar (Priority: P1)

As a user, I want a left navigation sidebar displaying the brand logo with an animated blinking cursor, quick actions for creating or searching chats, organized recents, and an active backend connection status indicator, so that I can easily switch and organize active conversations.

**Why this priority**: Organizing multiple conversation threads and monitoring Ollama connectivity is essential for managing local model sessions.

**Independent Test**: Can be tested by clicking "New chat", filtering conversation titles in real time using the search box, opening context menus on session items (Rename, Pin, Delete), collapsing the sidebar to an icon rail, and observing the persistent sidebar state.

**Acceptance Scenarios**:

1. **Given** the sidebar header, **When** rendered, **Then** it displays the official brand wordmark (`> ~/.E _`) featuring the hard-blink rose terminal cursor on the final underscore, alongside a collapse toggle button.
2. **Given** the sidebar primary navigation, **When** viewed, **Then** it includes a prominent "New chat" action, a "Search chats" filter input, and navigation links for Chats, Library, and Tools (with Library and Tools disabled per the availability rule).
3. **Given** conversation history, **When** listed in the sidebar, **Then** chats are grouped by relative date ("Today", "Yesterday", "Previous 7 days", "Older"), highlighting the currently selected chat.
4. **Given** a chat list item, **When** hovered or focused, **Then** a context action menu is accessible containing Rename, Pin, and Delete; Rename and Delete operate on the in-memory chat session list, while Pin displays a disabled "Not available yet" status.
5. **Given** input in the "Search chats" field, **When** characters are typed, **Then** the visible conversation list filters instantly against chat titles with zero perceptible delay.
6. **Given** the sidebar footer, **When** viewed, **Then** it displays the user avatar, username/greeting ("Ellie"), an Ollama connection status indicator (green dot when reachable, warning dot when unreachable), and a Settings entry button.
7. **Given** the sidebar collapse button, **When** toggled, **Then** the sidebar collapses into a compact icon rail (or expands back), and this collapsed/expanded preference is saved in the browser for future visits.
8. **Given** that conversation persistence is scoped to in-memory state for this phase, **When** sessions are created or modified, **Then** all state changes flow through a unified frontend session store without misleading claims of permanent cloud/database synchronization.

---

### User Story 4 - Select Models and Manage Settings from Header (Priority: P1)

As a user, I want the top header bar to display the editable active chat title, a model selector dropdown, a Share action, and a comprehensive Settings dialog, so that I can configure my preferences and manage conversation parameters.

**Why this priority**: Switching between available Ollama models and adjusting visual settings (themes, typography size) are core operational controls.

**Independent Test**: Can be tested by clicking the title to rename it inline, selecting a model from the header dropdown, opening the Settings dialog, toggling themes between Light, Dark, and System, and verifying that unsupported settings cleanly display as disabled.

**Acceptance Scenarios**:

1. **Given** the header bar, **When** viewed during an active chat, **Then** it shows the chat title (which can be clicked to edit in place), a model selector dropdown, a Share button, and an overflow menu (containing Rename, Delete, Export).
2. **Given** the model selector dropdown, **When** opened, **Then** it populates with all models currently reported by the backend API; if the backend exposes only a single model or cannot list models, the single model name is displayed and the dropdown remains disabled.
3. **Given** menu items for unsupported features (Share, Export), **When** inspected, **Then** they display in a disabled state with "Not available yet" tooltips without causing errors.
4. **Given** the user triggers the Settings dialog (via sidebar footer or header), **When** opened, **Then** an accessible modal appears with tabbed navigation: General, Appearance, Models, Shortcuts, and About.
5. **Given** the Appearance settings section, **When** the user changes the theme (System / Light / Dark) or interface font size, **Then** the application styling updates immediately without page reload, and the preference persists on the client device.
6. **Given** the Models settings section, **When** parameters such as temperature, system prompt, or context window are displayed, **Then** they are presented in a clean disabled state reflecting that backend configuration overrides are planned for a subsequent specification.

---

### User Story 5 - Greet and Prompt from an Empty Chat State (Priority: P2)

As a user, I want an empty chat screen to greet me warmly with a time-aware greeting and the brand mark, accompanied by suggested starter prompts, so that starting a new session feels inviting and rapid.

**Why this priority**: A well-crafted empty state sets a calm, friendly tone and helps initiate new queries with a single click.

**Independent Test**: Can be tested by navigating to a new conversation and verifying the presence of the time-of-day greeting ("Good evening, Ellie"), the central brand mark, a centered composer card, and 3-4 clickable suggestion chips that populate the input.

**Acceptance Scenarios**:

1. **Given** a new or empty chat session, **When** displayed, **Then** a centered header shows the brand mark (`>E_`), a time-sensitive greeting ("Good morning / afternoon / evening, Ellie") in the serif font, and a centered composer card.
2. **Given** prompt suggestion chips displayed beneath the greeting, **When** the user clicks any suggestion chip, **Then** its prompt text immediately populates the composer textarea and sets keyboard focus into the input.

---

### User Story 6 - Log In with Brand Design System (Priority: P2)

As a user, I want the authentication screen to match the pastel, calm design system of the main application, displaying clear error and loading states while preserving the existing secure authentication contract.

**Why this priority**: Consistency across entry points establishes trust and visual coherence before entering the conversation.

**Independent Test**: Can be tested by opening an unauthenticated session, verifying the redesigned centered card, pastel background, official logo, and submitting valid or invalid credentials to observe responsive loading and error feedback.

**Acceptance Scenarios**:

1. **Given** an unauthenticated session, **When** the login view loads, **Then** it displays a centered authentication card using design tokens (`--card`, `--line`, `--ink`), pastel background, and the official wordmark with the blinking terminal cursor.
2. **Given** credential submission, **When** authentication is in progress, **Then** the submit button displays a clean loading state; **When** authentication fails, **Then** an inline alert describes the error clearly; **When** successful, **Then** the user transitions directly to the chat interface while maintaining existing HttpOnly session cookie handling.

---

### User Story 7 - Read Mixed Persian and English Content Seamlessly (Priority: P2)

As a user, I want messages containing Persian (or Arabic) text to format automatically in right-to-left (RTL) reading direction with the Vazirmatn font, while keeping code blocks and English content left-to-right (LTR), so that bilingual conversations read naturally.

**Why this priority**: Ensuring native typographic hierarchy for Persian text prevents illegible, reversed punctuation and broken mixed-language code blocks.

**Independent Test**: Can be tested by submitting a Persian prompt and inspecting a response containing Persian prose interspersed with English code blocks, verifying that paragraphs inherit RTL alignment with Vazirmatn while code blocks remain strictly LTR.

**Acceptance Scenarios**:

1. **Given** any message containing Persian/Arabic characters, **When** rendered, **Then** text direction is automatically detected per block/message, applying `dir="rtl"` and styling with the bundled Vazirmatn font.
2. **Given** an RTL assistant reply containing inline code or fenced code blocks, **When** rendered, **Then** all code snippets and blocks remain strictly `dir="ltr"` with JetBrains Mono font and standard code alignment.
3. **Given** the user selects Persian as the interface language in Settings (prepared foundation), **When** toggled, **Then** the application layout mirrors correctly with appropriate RTL padding, margins, and directional icons.

---

### User Story 8 - Responsive Multi-Device Layout and Keyboard Accessibility (Priority: P2)

As a user, I want the chat interface to adapt smoothly across desktop, tablet, and mobile screens and be fully controllable via standard keyboard shortcuts, so that I can use e-webui efficiently on any device.

**Why this priority**: Mobile access and keyboard shortcuts guarantee accessibility and convenience across diverse viewing environments.

**Independent Test**: Can be tested by resizing the viewport from 360 px up to 1920 px, verifying drawer transformations on mobile/tablet, testing shortcut keys (`Ctrl+K`, `Ctrl+Shift+O`, `Ctrl+B`, `/`, `Esc`, `?`), and verifying full tab navigation with visible focus rings.

**Acceptance Scenarios**:

1. **Given** a desktop viewport (≥1024 px), **When** viewed, **Then** the sidebar remains pinned at 264 px alongside the 720 px reading column.
2. **Given** a tablet viewport (640–1023 px), **When** viewed, **Then** the sidebar collapses into an overlay panel that slides in when triggered and closes on outside click or Esc.
3. **Given** a mobile viewport (<640 px down to 360 px), **When** viewed, **Then** the sidebar behaves as a full-height drawer, touch targets meet or exceed 44×44 px, the composer remains fixed above the virtual keyboard respecting safe area insets, and no unintended horizontal scrollbars appear.
4. **Given** any screen, **When** keyboard shortcuts are pressed:
   - `Ctrl/Cmd + K`: focuses the chat search input;
   - `Ctrl/Cmd + Shift + O`: initiates a new chat;
   - `Ctrl/Cmd + B`: toggles the sidebar;
   - `/`: focuses the composer input when not already typing;
   - `Esc`: stops active generation or closes the open dialog/menu;
   - `?`: opens the keyboard shortcuts reference sheet.
5. **Given** modal dialogs or dropdown menus, **When** opened, **Then** focus is trapped within the component, pressing `Esc` dismisses the view, and focus is returned to the triggering control.
6. **Given** keyboard navigation via `Tab`, **When** cycling through interactive elements, **Then** a visible, accessible focus ring appears on every control following a logical sequence.

---

### Edge Cases

- **Massive Messages and Continuous Streams**: When messages contain tens of thousands of characters or hundreds of code lines, the container must maintain horizontal scrollability on code blocks without breaking the 720 px reading container or causing layout blowout.
- **Large Chat Histories**: In conversations with 500+ messages, rendering and typing responsiveness must remain fluid without input latency or cumulative memory degradation.
- **Truncated Titles and Long Filenames**: Sessions with very long generated titles or lengthy code filenames must display clean text truncation with an ellipsis (`...`) and reveal the full text via native/accessible tooltips on hover or focus.
- **Backend and Network Dropouts**: If Ollama becomes unreachable mid-stream or the network disconnects, the partial reply received so far MUST be preserved with a visible connection warning and a "Retry / Regenerate" button.
- **Zero Models Available**: If the backend reports an empty model list, the model selector must clearly indicate "No models found", disable submission, and display a troubleshooting tooltip.
- **Rapid Successive Submissions**: Rapidly pressing Enter or clicking Send must not trigger duplicate API requests while a generation is initializing or streaming.
- **Theme and Layout Switching During Streaming**: If the user toggles the light/dark theme or collapses the sidebar while tokens are actively streaming, the stream must proceed uninterrupted and all colors must update seamlessly.
- **Reduced Motion Preference**: When the operating system has `prefers-reduced-motion` enabled, all smooth transitions are disabled and the blinking logo cursor remains static and solid (`opacity: 1`).
- **Absence of OS Scheme Support**: If a browser lacks support for `prefers-color-scheme`, the application must gracefully default to the Light theme.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST replace all existing application interface styling across every screen (login, active chat, empty chat, settings, dialogs, toasts, error screens) with the unified Claude-style design system.
- **FR-002**: The interface MUST strictly utilize the defined design tokens (colors, fonts, radii, borders, shadows) from `design-tokens.css` with zero hard-coded ad-hoc color values in component markup.
- **FR-003**: Theme selection MUST support automatic matching of the operating system preference (`prefers-color-scheme`) with an explicit manual override (System / Light / Dark) that is stored on the client device and rendered without flash of incorrect theme on initial page load.
- **FR-004**: The color system MUST apply the pastel blue/purple palette (`--bg: #F6FBFE`, `--side: #E6F4FB`, `--user: #E8E0F4`, `--rose: #AD3960`, `--purple: #6A4892`) in light mode, and deep violet palette (`--bg: #110E20`, `--side: #17132A`, `--user: #2A2248`, `--rose: #E5779B`, `--purple: #B79DE0`) in dark mode.
- **FR-005**: The brand logo MUST use the exact vector assets provided in `design/logo/` without redrawing, recoloring, or geometric distortion. The wordmark (`> ~/.E _`) MUST feature a blinking terminal cursor on the final underscore animated at 1.06 s hard on/off interval.
- **FR-006**: The application favicon, touch icons, web manifest icons, and browser theme meta color MUST reference the official logo kit assets.
- **FR-007**: Streaming assistant responses MUST render incrementally token-by-token with zero layout jumping, maintaining a blinking terminal cursor at the leading edge until generation is finished or aborted.
- **FR-008**: Markdown output from the model MUST be parsed and sanitized safely, strictly preventing execution of raw HTML tags, inline scripts, event attributes, or `javascript:` URI schemes.
- **FR-009**: Code blocks in assistant messages MUST display a language identifier tag, horizontal scrolling for long lines, and an accessible Copy button that provides immediate visual confirmation.
- **FR-010**: The interface MUST implement a centralized feature-availability registry mapping every control to either `enabled` (backed by working backend capabilities) or `disabled` (displaying a distinct disabled style with a "Not available yet" tooltip and no error triggers).
- **FR-011**: All user-visible strings MUST be centralized in a dedicated dictionary to support localization without editing component code.
- **FR-012**: The application MUST provide dedicated visual empty, loading, error, offline, and "Ollama unreachable" states with actionable Retry actions where applicable.
- **FR-013**: Interrupted, stopped, or failed generations MUST retain all accumulated partial text and present clear Retry or Regenerate actions.
- **FR-014**: All dialogs, dropdowns, and flyout menus MUST implement accessible modal behaviors, including keyboard focus trapping, `Esc` key dismissal, and returning focus to the triggering element upon closure.
- **FR-015**: The interface MUST respect the user's `prefers-reduced-motion` operating system setting by disabling animations and displaying cursors as solid unmoving elements.
- **FR-016**: Foreground and background text contrast MUST meet or exceed WCAG 2.2 AA standards in both light and dark themes; touch targets on mobile viewports MUST be at least 44×44 px.
- **FR-017**: All existing application behaviors MUST be preserved without functional regressions, including user authentication, session cookies, prompt dispatch, token streaming, stop execution, model loading, and logout.

### Key Entities *(include if feature involves data)*

- **Chat Session**: Represents a conversation instance with attributes: `id` (string/UUID), `title` (string, user-editable), `createdAt` (timestamp), `updatedAt` (timestamp), `model` (selected model string), `messages` (ordered list of Message entities).
- **Chat Message**: Represents an individual query or reply turn with attributes: `id` (string), `role` (`"user"` or `"assistant"`), `content` (string text), `reasoning` (optional string containing thinking tokens), `status` (`"streaming"`, `"completed"`, `"stopped"`, `"error"`), `metrics` (object containing `model`, `tokensPerSecond`, `durationSeconds`).
- **Feature Flag Entry**: Represents a registered interface control with attributes: `controlId` (unique string key), `status` (`"enabled"` or `"disabled"`), `reason` (string explanation, e.g., "Not available yet"), `tooltip` (string text).
- **User Preference**: Represents client-persisted non-sensitive visual choices with attributes: `theme` (`"system"`, `"light"`, `"dark"`), `fontSize` (`"small"`, `"medium"`, `"large"`), `sidebarCollapsed` (boolean), `interfaceLanguage` (`"en"`, `"fa"`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A side-by-side visual comparison between the rendered application and `design/reference/chat-mock.html` at 1280×800 in both light and dark modes exhibits no unintended discrepancies in layout, spacing, radii, typography, or color tokens.
- **SC-002**: 100% of the controls specified in User Stories 1 through 4 are visible on screen, correctly mapped in the feature registry as either functional or disabled with a "Not available yet" indicator, and zero controls trigger runtime exceptions when clicked.
- **SC-003**: 100% of existing core capabilities (login, prompt dispatch, token streaming, cancellation, model switching, logout) function without regression against the backend API.
- **SC-004**: Automated accessibility audits (Lighthouse / axe-core) report zero critical or serious contrast or structural violations in both light and dark modes, and all interactive features are navigable using only the keyboard.
- **SC-005**: First Contentful Paint is achieved in under 1.0 second on local network access, and typing/scrolling in a thread containing 500 messages exhibits zero noticeable frame drops or input stutter.
- **SC-006**: The client makes zero external CDN or network requests to external third-party servers; all fonts, icons, styles, and scripts are served strictly from the local web server.
- **SC-007**: 100% of malicious script injection payloads (`<script>`, `onerror=`, `javascript:`) embedded in model replies are sanitized and rendered inert as harmless text.
- **SC-008**: The entire layout renders without any horizontal page scrolling across all viewport widths from 360 px up to 4K resolutions.

## Assumptions

- **Existing Backend Contract Unchanged**: The FastAPI backend API endpoints, authentication flows, and streaming mechanisms remain unaltered; the frontend adapts to the current contract.
- **Frontend Architecture**: The application remains plain HTML, CSS, and modern vanilla JavaScript (ES modules) with no compile-time build step, bundler, or heavy framework.
- **Local Asset Hosting**: All fonts (Inter, Source Serif 4, JetBrains Mono, Vazirmatn) and icons are hosted locally within the application package to guarantee offline and isolated operation.
- **In-Memory Conversation Store**: For this appearance phase, multi-chat session navigation is managed via an in-memory client-side store designed with a clean abstraction interface to allow seamless plug-in of future database persistence.
- **Authentication & Security**: Authentication continues using the existing HttpOnly session cookie. No sensitive tokens or session secrets are stored in browser `localStorage`.
- **Infrastructure & Container Isolation**: In strict compliance with Principle I and Principle II of the Project Constitution, no development, testing, or execution steps will invoke `incus` commands, manipulate containers, or touch host configurations. All testing relies strictly on local static inspection, unit mocks, and sandboxed browser verification.
