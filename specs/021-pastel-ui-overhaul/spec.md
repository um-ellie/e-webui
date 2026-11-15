# Feature Specification: Pastel Design System and UI/UX Overhaul

**Feature Branch**: `021-pastel-ui-overhaul`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Complete UI/UX overhaul of e-webui: Aesthetic Direction & Pastel Design System (soft pastel palette for dark and light modes, typography, micro-interactions, smooth thought transitions), completely remove Interface Language setting and dead code, fix & redesign broken/incomplete UI sections (settings modal, composer & model picker popover positioning, code blocks with pastel headers, unified sidebar and status indicators)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cohesive Pastel Theming & Reading Experience (Priority: P1)

Users interacting with the application in both light and dark environments receive a visually calming, distraction-free interface with a cohesive soft pastel color palette. The dark theme delivers a cozy muted slate/charcoal-lavender environment accented with soft lavender, mint, peach, and periwinkle highlights that preserve crisp readability. The light theme provides warm alabaster/cream surfaces with delicate borders, soft pill badges, and gentle elevation shadows.

**Why this priority**: Visual aesthetics, readability, and eye comfort directly impact every second the user spends in the application.

**Independent Test**: Can be tested by switching between Light Mode, Dark Mode, and System Theme, verifying that every interface surface, text level, badge, and border adopts the cohesive pastel palette while maintaining WCAG AA contrast compliance.

**Acceptance Scenarios**:

1. **Given** the user selects Dark Mode, **When** the interface updates, **Then** all background surfaces render in muted slate/charcoal-lavender tones with soft pastel accents (lavender, mint, peach, periwinkle) and no harsh neon saturation.
2. **Given** the user selects Light Mode, **When** the interface updates, **Then** all surfaces render in warm alabaster/cream tones with delicate pastel borders, subtle pill badges, and gentle elevation shadows.
3. **Given** any text element or control in either theme, **When** tested with standard contrast evaluation, **Then** normal text achieves at least 4.5:1 contrast against its background and large text/icons achieve at least 3:1.

---

### User Story 2 - Streamlined Settings Without Dead Language Controls (Priority: P1)

Users open the Settings dialog to configure application behavior and find a streamlined, functional interface. All dead or non-functional placeholder options—specifically the obsolete "Interface Language" dropdown and any non-functional toggles—are completely removed. Functional parameters such as temperature and default system instructions are clearly presented, editable, and take immediate effect.

**Why this priority**: Dead, non-working, or confusing configuration controls erode user trust and clutter the user experience. Removing obsolete options eliminates confusion while preserving automatic per-message script direction detection.

**Independent Test**: Can be tested by opening the Settings dialog, navigating all tabs, verifying the absence of any Interface Language controls, adjusting functional parameters (e.g., temperature), and confirming persistence and application.

**Acceptance Scenarios**:

1. **Given** a user opens the Settings modal, **When** viewing the General or Appearance tabs, **Then** no "Interface Language" dropdown or related dead UI is present.
2. **Given** a user receives or writes a message containing right-to-left script (e.g., Persian/Arabic), **When** the message renders, **Then** it automatically formats with right-to-left alignment while the rest of the application chrome remains in standard interface direction.
3. **Given** a user updates a functional setting (such as Temperature or System Prompt), **When** saving and continuing a session, **Then** the updated values are preserved and applied to subsequent interactions.

---

### User Story 3 - Responsive Composer and Fluid Model Selection (Priority: P2)

Users compose prompts and select models across diverse viewport sizes, including mobile phones and small split-screen windows. The model picker popover adapts smoothly to viewport constraints without being clipped or overflowing off-screen. The composer provides responsive auto-resizing, clear Send and Stop generation button states, and smooth focus handling.

**Why this priority**: The composer and model picker represent the primary interaction hub of the application. Popover clipping or clunky button transitions directly break the core chat loop.

**Independent Test**: Can be tested on both mobile viewports (e.g., 360px wide) and desktop viewports by opening the model picker, selecting models, submitting queries, observing the Stop state, and stopping generation.

**Acceptance Scenarios**:

1. **Given** a narrow viewport (such as a mobile display or narrow split window), **When** the user opens the model selector popover, **Then** the menu fits entirely within the visible viewport bounds without horizontal scrolling or edge clipping.
2. **Given** a prompt is generating an active response, **When** observing the composer action button, **Then** it clearly indicates the Stop state and allows one-click generation cancellation.
3. **Given** a user enters multi-line text into the prompt field, **When** typing expands beyond a single line, **Then** the input area expands fluidly up to its maximum height with smooth scrolling.

---

### User Story 4 - Polished Markdown, Syntax Highlighting & Collapsible Thought Blocks (Priority: P2)

Users reading complex assistant responses containing reasoning thoughts and code blocks enjoy an organized, legible presentation. Reasoning thought blocks expand and collapse with fluid height transitions. Code snippets feature pastel-tinted header chrome, language badges, distinct copy button feedback, and clear visual separation from standard prose.

**Why this priority**: Code inspection and reasoning review are core activities for users of local LLMs. High-quality code blocks and smooth accordion animations make reading and copying effortless.

**Independent Test**: Can be tested by generating or viewing a message containing reasoning thoughts and multiple code snippets (Python, JavaScript, Markdown), toggling the thought block, and clicking the copy button on code headers.

**Acceptance Scenarios**:

1. **Given** a message with reasoning thoughts, **When** the user clicks the thought chip, **Then** the reasoning content expands or collapses with a smooth transition without layout popping.
2. **Given** a code block in an assistant response, **When** rendered on screen, **Then** it displays a dedicated pastel-tinted header with a language badge and copy action button.
3. **Given** the user clicks the copy button on a code block, **When** the content is copied, **Then** the button displays immediate positive confirmation (e.g., "Copied!") for at least 1.5 seconds before returning to default state.

---

### User Story 5 - Unified Sidebar Navigation & Real-Time Engine Status (Priority: P3)

Users organize their ongoing conversations using a clean sidebar with intuitive date grouping, responsive session item hover actions (rename, export, delete), and an integrated local engine connection indicator that communicates health status at a glance.

**Why this priority**: Smooth navigation and session management help users maintain an organized workspace without feeling cluttered.

**Independent Test**: Can be tested by creating sessions across timeframes, triggering rename, export, and delete actions, and checking the connection status pill under online and offline engine conditions.

**Acceptance Scenarios**:

1. **Given** multiple chat sessions, **When** browsing the sidebar, **Then** sessions are cleanly grouped by date with active indicators and accessible quick-action menus.
2. **Given** the local engine is online and responsive, **When** viewing the connection indicator, **Then** it displays a calm, pastel-tinted connected status with access to engine health details.
3. **Given** the local engine becomes unreachable, **When** health checks fail, **Then** the indicator clearly transitions to an offline warning state without freezing or disrupting offline conversation browsing.

---

### Edge Cases

- **Extreme Viewport Constraints**: How does the composer, model picker, and settings modal behave on screens as narrow as 320px? Popovers must adapt to available horizontal space or modal bottom-sheet positioning, avoiding clipping.
- **Mixed Bidirectional Content**: How do code blocks and bulleted lists behave inside right-to-left user messages? Code blocks must consistently maintain left-to-right code presentation while message prose respects detected script direction.
- **Very Large Thought or Code Blocks**: What happens when an assistant produces thousands of tokens of reasoning or code? Accordions and code containers must maintain bounded scrollable areas with preserved scroll position.
- **High-Contrast and Reduced Motion Accessibility**: What happens when users have operating system settings requesting reduced motion? Transitions (including collapsible thought animations) must immediately resolve without delay.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a unified pastel color palette for Dark Mode featuring slate/charcoal-lavender surfaces, pastel accents (lavender, mint, peach, periwinkle), and high-contrast text.
- **FR-002**: System MUST provide a unified pastel color palette for Light Mode featuring warm alabaster/cream surfaces, delicate borders, and soft elevation shadows.
- **FR-003**: System MUST guarantee that all text and interactive control color combinations in both themes comply with WCAG 2.1 AA contrast requirements.
- **FR-004**: System MUST completely remove the "Interface Language" dropdown and associated selector controls from the Settings modal.
- **FR-005**: System MUST completely remove all dead code, unused dictionaries, event listeners, and state properties solely dedicated to the interface language dropdown.
- **FR-006**: System MUST preserve automatic per-message script direction detection (RTL/LTR) for chat messages, independent of application interface chrome.
- **FR-007**: System MUST provide functional controls in the Settings dialog for valid configuration properties (including theme, font size, inference temperature, top-p, default system prompt, and data management).
- **FR-008**: System MUST cleanly eliminate any non-functional placeholder toggles in Settings so no misleading or dead interactive elements remain.
- **FR-009**: System MUST position the model selector popover within viewport boundaries across all screen sizes (down to 320px width), preventing off-screen clipping.
- **FR-010**: System MUST provide an auto-resizing composer textarea that accommodates single-line and multi-line inputs with smooth growth up to a defined maximum height.
- **FR-011**: System MUST provide distinct, accessible visual states for composer Send and Stop buttons with appropriate tooltips and keyboard shortcuts.
- **FR-012**: System MUST render code blocks with dedicated pastel-tinted header chrome containing a language badge and a one-click copy button.
- **FR-013**: System MUST provide visual affirmative confirmation on the code copy button upon successful clipboard copy.
- **FR-014**: System MUST animate collapsible reasoning thought blocks using smooth height transitions without abrupt layout shifts.
- **FR-015**: System MUST honor `prefers-reduced-motion` user preferences by disabling or zeroing animation durations on collapsible blocks and transitions.
- **FR-016**: System MUST present sidebar chat sessions with unified hover/focus actions for rename, export, and delete.
- **FR-017**: System MUST display an integrated local engine status indicator reflecting connection state (connected, degraded, offline) with access to diagnostic details.
- **FR-018**: System MUST apply subtle glassmorphism elevation styling to floating header and composer bars without impairing readability.

### Key Entities *(include if feature involves data)*

- **Visual Theme Configuration**: Defines active color tokens, surface tints, border opacities, and contrast definitions for Dark and Light pastel palettes.
- **Session Settings**: User-configured default preferences including theme, font scale, model temperature, top-p, and system instruction presets.
- **Message Presentation Model**: Represents a rendered conversational turn, including text direction, reasoning thought state (collapsed/expanded), and formatted code blocks.
- **Engine Status State**: Real-time connection and diagnostic health information for the local Ollama backend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user interface text elements in both Light and Dark pastel themes achieve a contrast ratio of at least 4.5:1 against their adjacent background (3:1 for large typography and icons).
- **SC-002**: 0 non-functional placeholder options, dead selectors, or unhandled controls remain in the Settings modal.
- **SC-003**: The model picker popover maintains 100% visibility within viewport boundaries without horizontal document scrolling or clipping on screens down to 320px width.
- **SC-004**: Code block copy action provides visible affirmative confirmation within 100 milliseconds of user click or tap.
- **SC-005**: Collapsible reasoning thought blocks expand and collapse with fluid height transitions without layout snapping or frame stuttering.
- **SC-006**: 100% of message bubbles display correct text alignment and direction automatically based on message content script, without user intervention.
- **SC-007**: Switching themes between Light, Dark, and System takes effect instantly across all open application views without page reload.

## Assumptions

- Target screen sizes range from 320px (compact mobile) up to 4K desktop displays.
- Users value a calm, modern pastel palette with high legibility over harsh neon or low-contrast muted grays.
- Automated per-message script direction detection provides superior user experience compared to a manual global interface language toggle.
- Inference parameter inputs (temperature, top-p, system prompt) persist within local session state and storage.
- Existing core capabilities (chat history persistence, streaming, local Ollama integration) remain fully operational and unaltered in backend contract.
