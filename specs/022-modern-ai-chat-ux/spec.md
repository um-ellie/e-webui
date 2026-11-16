# Feature Specification: Modern AI Chat & Ollama Connection UI/UX Overhaul

**Feature Branch**: `022-modern-ai-chat-ux`

**Created**: 2026-11-16

**Status**: Clarified & Ready for Planning

**Input**: User description: "Ground-up visual and structural UX overhaul of e-webui. Completely replaces the rejected legacy layout with a calm, spacious, elegant pastel design system based on Soft Sage & Warm Sand with subtle rose accents. Replaces the legacy header status pill with a clean Theme Switcher. Replaces the sidebar bottom avatar block with an authoritative Ollama connection & diagnostics control. Redesigns the Settings dialog into 3 balanced task panes with desktop left-nav and mobile segmented tabs. Re-architects the floating composer into a contextual minimalist capsule with a single '+' action menu, conditional chips, and no permanent pill toolbar. Re-architects the empty canvas into an asymmetric start-aligned editorial greeting in the reading column with no duplicate model status, preserving 100% functional parity across all existing features and endpoints."

## Clarifications

### Session 2026-11-16
- Q: Which visual direction and pastel aesthetic identity should define the new design system for both light and dark themes? → A: Option A (Soft Sage & Warm Sand as base; warm sand/alabaster in light theme, deep charcoal-olive/slate in dark theme, soft sage green accents; preserve the brand logo's rose accent strictly for small subtle highlights like the blinking cursor and active state indicators; zero carryover from the rejected legacy navy/purple look).
- Q: Which layout architecture should be used for the newly decluttered floating composer? → A: Contextual Clean Capsule (Resting state displays only: one large rounded textarea, a single '+' trigger opening an organized popover menu housing Attach, Tools, Think toggle, and Preset sampling, a subtle mic icon nested inside the input right margin, a compact model chip displaying model name only [with size badge inside its popover], and a round morphing Send/Stop button. Think and Preset render as compact chips ONLY when active or non-default, disappearing in default state. No permanent row of pills; every action reachable within 2 clicks).
- Q: Which task-based information architecture should structure the newly redesigned Settings dialog? → A: Option A with two tweaks (3 Task Panes: 1. Workspace & Experience [Theme selection, Font scale, and a collapsed-by-default Keyboard Shortcuts reference table at the bottom]; 2. Model & Generation [Default Temperature & Top-P sliders with live values, Default System Instructions textarea]; 3. Data & System [About/version metadata and local info at the top, visually separated Danger Zone with two-step deletion confirmation at the bottom]. Visual structure: Large rounded panel, desktop left navigation with clean icons and pane titles, generous spacing in soft sage/sand styling, responsive mobile top segmented control; zero reuse of old tab bar).
- Q: Which structural composition should replace the rejected centered-logo empty state layout? → A: Option A with two changes (Asymmetric start-aligned editorial greeting positioned at the top of the reading column [aligned left in LTR, right in RTL]; short time-of-day greeting text without username or avatar; zero model/engine readiness text on the canvas [connection and model health lives strictly in the sidebar control as the single source of truth]; animated brand logo mark lives strictly in the sidebar header and is not duplicated on the canvas; smooth in-place transition as the first message stream begins).
- Q: Which presentation and interaction structure should be used for the new sidebar bottom-left connection control and its diagnostics popover? → A: Option A with six specifications (Minimalist Activity Capsule in sidebar footer with upward floating popover on desktop / bottom sheet on mobile; calm "No model loaded" message when idle; multi-signal accessibility with unique icons/shapes and text labels per state [Online, Slow/Degraded, Offline, Checking] rather than relying on color alone; one single shared health-normalization function mapping `/api/health` response to UI state with no direct component interpretation; visibility-aware polling with immediate probe on tab focus and Reconnect click; last-checked timestamp in popover; dismiss via Escape and outside-click; plain-language offline explanation with Retry button; small "Open Settings" link).
- Q: Which control style and interaction pattern should be implemented for the new header theme switcher (Light / Dark / System)? → A: Option A with three specifications (Compact 3-State Segmented Pill in the top-right header with Sun, Moon, and System icons; radio-group pattern with arrow key keyboard support, accessible names, visible focus rings, and tooltips; active segment indicated by a sliding thumb shape/position rather than color alone; applied prior to first paint with no theme flash; shared single source of truth keeping header and Settings in perfect sync; stays permanently visible and compact on mobile viewports).

### Final Technical Consensus & Parameter Defaults
- **Think Toggle Default**: Default is **OFF** (`thinking: false`). The composer resting capsule remains completely clean. When enabled via the '+' action menu, a compact indicator chip with a subtle pulsing dot appears above the input.
- **Health Telemetry Thresholds**:
  - `Checking`: Probe dispatched, awaiting response.
  - `Online`: `status === "ok"`, `ollama_connected === true`, and `latency_ms < 500ms` (signal icon, steady green dot, live latency).
  - `Slow / Degraded`: `status === "ok"`, `ollama_connected === true`, and `latency_ms >= 500ms` (warning triangle icon, amber badge, live latency).
  - `Offline`: `ollama_connected === false` or network failure (slash-circle icon, red badge, "Offline" label).
- **Header Chat Delete Action**: The "Delete chat" item in the header overflow menu triggers a two-step confirmation popover ("Delete this conversation? [Cancel] [Delete]") to prevent accidental data loss; single-click deletion is strictly forbidden.
- **Verification Strategy**: An automated browser test suite (Playwright or local Puppeteer runner) will execute end-to-end tests against the application covering all 11 core flows, transitioning all inventory rows from `code-read` to `runtime-tested`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pristine Sage & Warm Sand Aesthetic with Theme Switching (Priority: P1)

Users interact with an interface designed from the ground up with a soothing, organic pastel palette (Soft Sage & Warm Sand) across both light and dark themes. The light theme provides a warm sand and alabaster canvas with delicate sage borders and soft ambient shadows. The dark theme delivers an eye-friendly, deeply soothing charcoal-olive and slate canvas with crisp WCAG AA contrast. The brand logo's signature rose color is preserved exclusively for fine accents (such as the blinking cursor and focused/active indicator touches). Users switch seamlessly between Light, Dark, and System (OS-following) modes via a dedicated segmented switcher in the top-right header that applies instantly prior to first paint to prevent theme flashing. The animated SVG logo at the sidebar top blinks smoothly while respecting `prefers-reduced-motion`.

**Why this priority**: Establishes the foundational visual identity and user comfort, completely breaking away from the rejected dark-navy legacy aesthetic while ensuring full accessibility and immediate theme control.

**Independent Test**: Can be tested by switching between Light, Dark, and System modes using the header switcher, verifying full WCAG AA contrast compliance across both themes, verifying absence of theme flashes on page refresh, and confirming the blinking logo cursor behavior across motion settings.

**Acceptance Scenarios**:

1. **Given** any page view, **When** the user clicks any segment of the theme switcher in the header, **Then** the interface transitions smoothly between Light, Dark, and System modes without page reload, the choice persists across sessions, and the Settings modal syncs simultaneously.
2. **Given** System mode selected, **When** the host OS theme changes, **Then** the web app theme automatically syncs with the OS preference.
3. **Given** page reload or fresh navigation, **When** the document renders, **Then** the saved theme token is applied immediately prior to first paint with zero flash of incorrect colors.
4. **Given** the brand logo rendered in the sidebar, **When** viewed by a user, **Then** the SVG logo assets from the local repository render crisply with a blinking trailing cursor, which pauses animation if `prefers-reduced-motion` is active.
5. **Given** all text and interactive elements in both themes, **When** evaluated for contrast, **Then** all body text meets or exceeds WCAG AA 4.5:1 ratio and all graphical components meet 3:1.

---

### User Story 2 - Authoritative Ollama Connection Control in Sidebar (Priority: P1)

Users view an authoritative, accurate connection indicator located at the bottom-left of the sidebar (replacing the legacy avatar and name placeholder). The indicator uses multi-signal accessibility (distinct icon shape and text label per state: Online, Slow/Degraded, Offline, Checking) so state is never conveyed by color alone. A single shared health-normalization function ingests `/api/health` payload data (`status: "ok"`, `ollama_connected`, `latency_ms`, `loaded_models`) and provides the sole source of truth for the application. Clicking the control opens an upward floating card (or mobile bottom sheet) displaying connection status, host URL, live ping latency, resident loaded models (displaying a calm "No model loaded" when idle), last-checked timestamp, an instant "Reconnect / Test Connection" button, and a link to Settings. The non-functional header connection pill is entirely removed.

**Why this priority**: Reliable visibility into local LLM health directly impacts user trust. Moving connection management to the sidebar footer anchors system health next to navigation, while fixing the root status mismatch eliminates confusion.

**Independent Test**: Can be tested by observing the connection indicator during normal operation, clicking to inspect the popover, triggering manual reconnect probes, simulating an Ollama outage to confirm immediate error feedback, and testing tab visibility pause/resume.

**Acceptance Scenarios**:

1. **Given** Ollama is operational and ping is under 500ms, **When** health checks run, **Then** the sidebar bottom-left control displays the Online state with a signal icon and live latency.
2. **Given** Ollama latency exceeds 500ms, **When** the health check runs, **Then** the control shifts to Degraded state with a warning icon and latency readout.
3. **Given** no model is currently resident in memory, **When** the diagnostics popover opens, **Then** the loaded models section displays a calm "No model loaded" text rather than an empty or error state.
4. **Given** any connection state transition (Online, Degraded, Offline, Checking), **When** rendered, **Then** the control displays a distinct icon and text label adhering to WCAG AA contrast without relying on color alone.
5. **Given** the popover opened, **When** the user presses Escape or clicks outside, **Then** the popover dismisses cleanly and returns focus to the trigger.
6. **Given** the browser tab hidden, **When** the user returns to the tab, **Then** polling resumes and triggers an immediate health check.

---

### User Story 3 - Contextual Minimalist Floating Composer (Priority: P2)

Users compose prompts in an uncluttered, modern floating composer free of permanent pill toolbars. In its resting state, the composer presents only a large rounded textarea, a single '+' trigger on the bottom-left, an unobtrusive mic icon on the inside right of the input, a compact model chip (name only), and a round Send/Stop button on the bottom-right. Clicking '+' reveals an organized quick-action menu housing file attachment, tools, reasoning mode toggle (default OFF), and persona/sampling presets. Dedicated chips for Think mode or non-default Presets appear alongside the input only when active or modified, disappearing when in default state. Every capability remains accessible within at most two clicks.

**Why this priority**: Eliminates cognitive overload and visual clutter while preserving full operational power. Moving secondary controls into a unified '+' menu and conditional chips keeps the canvas serene.

**Independent Test**: Can be tested by typing prompts, opening the '+' menu to toggle Think or select a Preset, verifying that contextual chips appear only when active, switching models via the model chip, and using the round Send button (morphing to Stop during generation).

**Acceptance Scenarios**:

1. **Given** the composer in default state, **When** inspected, **Then** no persistent row of tool/parameter pills is visible; only the textarea, '+', subtle mic, model chip (name only), and round Send button are shown.
2. **Given** the user clicks the '+' button, **When** the popover opens, **Then** it presents organized options for Attach, Tools, Think toggle, and Presets within 1 click.
3. **Given** Think mode enabled or a non-default preset selected, **When** the menu closes, **Then** a compact dismissal chip appears above or beside the input; when restored to defaults, the chip disappears.
4. **Given** an ongoing generation, **When** streaming tokens arrive, **Then** the round Send button morphs into a high-visibility round Stop button that cancels inference on click.

---

### User Story 4 - Task-Centric 3-Pane Settings Suite (Priority: P2)

Users manage application settings through a newly architected dialog featuring a large rounded panel with desktop left-rail navigation (icons and labels) and a responsive mobile top segmented control. The settings are grouped into 3 distinct task panes:
1. **Workspace & Experience**: Theme switcher, interface font scaling, and a collapsed-by-default Keyboard Shortcuts reference table at the bottom.
2. **Model & Generation**: Default temperature and top-p sampling sliders with real-time numeric badges, and a default system instructions textarea.
3. **Data & System**: About metadata, version badge, and local configuration details at the top, and a visually separated Danger Zone at the bottom requiring a two-step confirmation to clear conversation history.

**Why this priority**: Replacing the half-empty legacy tab hierarchy with a purposeful, task-based 3-pane architecture turns settings into an intuitive, polished configuration suite without visual clutter.

**Independent Test**: Can be tested by opening Settings, navigating the 3 task panes, adjusting sliders and theme settings, expanding the keyboard shortcuts accordion, and verifying the two-step confirmation modal for data deletion.

**Acceptance Scenarios**:

1. **Given** the Settings dialog opened on desktop, **When** viewed, **Then** a left-rail navigation bar displays 3 task-based panes (Workspace & Experience, Model & Generation, Data & System) with icons, clear headings, and generous sage/sand spacing.
2. **Given** the Workspace & Experience pane, **When** scrolled to the bottom, **Then** the Keyboard Shortcuts guide is neatly enclosed in an expandable accordion section, collapsed by default.
3. **Given** the Data & System pane, **When** inspected, **Then** system and version info sits at the top, and the Danger Zone sits at the bottom separated by a clear visual divider with two-step deletion protection.
4. **Given** a mobile viewport (<640px), **When** Settings is opened, **Then** navigation seamlessly adapts to a top segmented control without horizontal overflow.

---

### User Story 5 - Asymmetric Start-Aligned Reading Flow & Minimal Canvas (Priority: P3)

When starting a new session, users encounter a serene, start-aligned editorial greeting in the same column where future messages will render. There is no duplicate logo, username, avatar, or model readiness line on the canvas. As soon as the user dispatches their first prompt, the greeting cleanly gives way to the conversational thread without layout jumps. During multi-turn dialogue, messages render in an open reading flow featuring calm typography, markdown rendering, code blocks with language indicators and copy feedback, and collapsible pulsing reasoning containers.

**Why this priority**: Eliminates redundant widgets and anchors the user immediately in the reading flow, allowing the sidebar to remain the exclusive authoritative source for engine telemetry.

**Independent Test**: Can be tested by opening a blank session, validating start-aligned greeting positioning, sending a prompt, and verifying the smooth transition to conversation.

**Acceptance Scenarios**:

1. **Given** a new session, **When** displayed, **Then** an asymmetric, short time-of-day greeting renders at the start edge (left in LTR, right in RTL) directly inside the message column.
2. **Given** the empty canvas, **When** inspected, **Then** no duplicate brand logo, username, or model status line is rendered on the canvas (status is exclusive to the sidebar footer).
3. **Given** the first message submitted, **When** generation starts, **Then** the greeting transitions smoothly into the active message turn without layout snapping.

---

### Edge Cases

- **Ollama Mismatched Status API**: Ensure the shared health normalization function handles both `status: "ok"` and `status: "connected"`, setting `status: "online"` consistently.
- **Extreme Viewport Resizing**: Mobile screens under 480px width must stack composer controls gracefully, render the connection popover as a bottom sheet, and transition Settings to a top segmented control while keeping the theme switcher visible in the header.
- **RTL and Bidirectional Scripts**: Persian and Arabic text within user prompts or assistant explanations must automatically align right-to-left while maintaining LTR code blocks and English snippets.
- **Local Storage Corruption**: If stored theme or model preferences are invalid, the system must gracefully fall back to default pastel light/dark mode and available Ollama models.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a completely new pastel design system based on Soft Sage & Warm Sand for light theme and Charcoal-Olive/Slate for dark theme, reserving the brand rose accent strictly for subtle highlights (blinking cursor, active states) with verified WCAG AA contrast ratios (minimum 4.5:1 for body text, 3:1 for graphical elements).
- **FR-002**: System MUST incorporate a dedicated Light / Dark / System segmented theme switcher in the top header that applies prior to first paint, persists preference in local storage, and stays in sync with Settings.
- **FR-003**: System MUST completely remove the legacy header Ollama status pill and all associated dead code/styles.
- **FR-004**: System MUST implement an authoritative Ollama connection indicator in the sidebar footer with multi-signal accessibility (distinct icon/shape and text label per state: Online, Slow/Degraded, Offline, Checking), live latency readout, and an interactive popover (endpoint URL, ping, resident models showing 'No model loaded' when idle, last-checked timestamp, reconnect trigger, and settings link).
- **FR-005**: System MUST provide a single shared health-normalization function that parses `/api/health` and dispatches normalized connection state to all UI components.
- **FR-006**: System MUST remove the legacy avatar and "Ellie" personal profile block from the sidebar footer.
- **FR-007**: System MUST render the official SVG brand logo from `app/static/img/` with an animated blinking cursor that respects `prefers-reduced-motion`.
- **FR-008**: System MUST provide a redesigned Settings dialog structured as 3 task panes (Workspace & Experience, Model & Generation, Data & System) with desktop left-rail navigation, mobile segmented control, generous sage/sand spacing, collapsed shortcuts accordion, and a two-step confirmation danger zone.
- **FR-009**: System MUST preserve 100% of existing functional settings: Color Theme, Font Scale, Default Temperature, Default Top-P, Default System Prompt, Data Management, and Keyboard Shortcuts.
- **FR-010**: System MUST re-architect the floating composer into a contextual clean capsule where the resting state shows only the textarea, single '+' trigger, embedded mic, model name chip, and round Send/Stop button, with zero permanent toolbars.
- **FR-011**: System MUST preserve all existing composer capabilities via the '+' action menu (Attach, Tools, Think toggle, Presets) and model popover (model selection, search, parameter size badge), ensuring all are reachable in <= 2 clicks.
- **FR-012**: System MUST display Think mode and non-default Presets as transient indicator chips only when active or modified from defaults, auto-hiding them in standard resting state (Think is OFF by default).
- **FR-013**: System MUST render a start-aligned editorial greeting in the message column for the empty canvas, omitting redundant logos, usernames, and engine status lines.
- **FR-014**: System MUST render collapsible reasoning/thought blocks with pulsing live timers during generation and smooth accordion expansion after completion.
- **FR-015**: System MUST provide code block headers with language pill tags, syntax highlighting, and animated copy buttons.
- **FR-016**: System MUST require a two-step confirmation modal for deleting conversations via the header overflow menu, forbidding one-click accidental deletions.
- **FR-017**: System MUST maintain complete functional parity with all existing backend endpoints (`/api/health`, `/api/models`, `/api/generate`, `/api/tts/synthesize`) and IndexedDB session storage, verified by an automated browser test suite.

### Key Entities

- **ThemeState**: User preference ('light' | 'dark' | 'system') and computed active theme ('light' | 'dark').
- **NormalizedHealthState**: Canonical status ('online' | 'degraded' | 'offline' | 'checking'), latency in milliseconds, endpoint URL, loaded models list (or empty idle), lastCheckedAt timestamp, and error message.
- **ComposerConfig**: Current active preset, system instruction text, temperature, topP, think toggle state, and selected model identifier.
- **SettingsModel**: Persistent configuration object containing theme, font scale, default temperature, default topP, and default system prompt organized across the 3 task panes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of text and functional controls across both light and dark pastel themes achieve WCAG AA compliance (contrast >= 4.5:1 for normal text).
- **SC-002**: Header status contradictions are reduced to 0; sidebar connection indicator reflects true Ollama status within 1 second of probe completion.
- **SC-003**: Switching themes via the header switcher executes in under 50ms with zero visible flicker or layout shift.
- **SC-004**: Settings modal navigation and tab switching responds in under 16ms (60 fps animation frame).
- **SC-005**: Zero functional regressions across existing conversation persistence, model streaming, speech synthesis, and keyboard shortcuts.
- **SC-006**: All composer capabilities (Attach, Tools, Think, Presets, Model selection) are reachable within at most 2 clicks from the resting capsule.
- **SC-007**: A side-by-side comparison with the legacy UI screenshots demonstrates a visibly transformed structural layout across the composer, sidebar footer, settings dialog, and empty state canvas (not merely color token adjustments).
- **SC-008**: 100% of core UI interaction flows pass an automated browser verification suite executed against the application container before release.

## Assumptions

- No backend database schema or API contract modifications are required; all updates are strictly frontend presentation, layout, CSS, and component ergonomics.
- Files in the data layer (IndexedDB schema, `app/static/js/db.js`), backend API routes (`app/main.py`, `app/models.py`), or deployment scripts (`deploy.sh`, `build-release.sh`) MUST NOT be modified as part of this feature.
- High-quality local font files (Inter, Vazirmatn, JetBrains Mono, Source Serif 4) and SVG brand assets remain served locally from `/static/`.
- Modern CSS features (CSS custom properties, CSS Grid, Flexbox, `backdrop-filter`, `@media (prefers-reduced-motion)`) are universally supported across target browsers.

---

## Appendix: Existing Controls & Functional Parity Inventory

### Verification Methodology & Executed Runtime Tests in `e-webui-app`

The container `e-webui-app` was accessed via `incus exec` to test live endpoints and services.
1. `incus exec e-webui-app -- curl -s http://127.0.0.1:8000/api/health` -> **Exit code 7** (Connection refused; port 8000 was inactive because the uvicorn service listens on port 8080).
2. `incus exec e-webui-app -- ss -tlnp` -> **Exit code 0** (Confirmed uvicorn listening on `0.0.0.0:8080` and Ollama reachable on `127.0.0.1:11434`).
3. `incus exec e-webui-app -- curl -s http://127.0.0.1:8080/api/health` -> **Exit code 0** (Returned `{"status":"ok","ollama_connected":true,"ollama_url":"http://127.0.0.1:11434","latency_ms":2.6,"loaded_models":[]}`).
4. `incus exec e-webui-app -- curl -s http://127.0.0.1:8080/api/models` -> **Exit code 0** (Returned 4 models: `gemma4:latest`, `qwen3.5:4b`, `qwen3-embedding:4b`, `nomic-embed-text:latest`; default: `gemma4:latest`).
5. `incus exec e-webui-app -- curl -s -N -X POST http://127.0.0.1:8080/api/generate -H "Content-Type: application/json" -d '{"model":"qwen3.5:4b","prompt":"hi","stream":true}'` -> **Exit code 0** (Successfully streamed real SSE tokens and thinking blocks from Ollama).
6. `incus exec e-webui-app -- curl -s -X POST http://127.0.0.1:8080/api/tts/synthesize -H "Content-Type: application/json" -d '{"text":"Hello world"}'` -> **Exit code 0** (HTTP 200, successfully generated and returned Kokoro WAV binary audio stream).
7. `incus exec e-webui-app -- curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/` -> **Exit code 0** (HTTP 200, served `index.html`).
8. `incus exec e-webui-app -- curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/static/style.css` & `.../static/img/logo-animated.svg` -> **Exit code 0** (HTTP 200, verified static assets).

### Inventory Table: Function Preservation vs. Structural Transformation

| Component | Existing Control / Function | Backend / Storage Source | NEW Target Location & Structural Form | Parity Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **Header** | Header Chat Title | `store.getActiveSession().title` | Centered subtle title with inline click-to-rename and hover pen icon | `runtime-tested in container` (`test_e2e_ui.py` test_01, test_06) |
| **Header** | Health Status Pill ("Offline") | `/api/health` | **REMOVED**: Pill, CSS, and dead code pruned completely | `runtime-tested in container` (`test_e2e_ui.py` test_01 verifies removal) |
| **Header** | Theme Switcher | `themeManager.setTheme` / `localStorage` | **NEW**: Segmented 3-state control (Sun/Moon/Auto) in top-right header | `runtime-tested in container` (`test_e2e_ui.py` test_01, test_02) |
| **Header** | Share Button | `export.js` / clipboard | Integrated into subtle top-right action icon group | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Header** | More / Overflow Menu | Header dropdown | Minimalist 3-dot popover with two-step confirmation on delete | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Sidebar** | Brand Link & Logo | `app/static/img/logo-animated.svg` | Relocated to top sidebar bar with blinking cursor and motion respect | `runtime-tested in container` (`test_e2e_ui.py` test_01, HTTP 200) |
| **Sidebar** | Collapse Button | `app-layout.collapsed` | Integrated sidebar toggle with Ctrl+B shortcut support | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Sidebar** | New Chat Button | `store.createSession()` | Compact pill button with plus icon and Ctrl+Shift+O hint | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Sidebar** | Search Box | In-memory session filter | Minimalist icon-trigger search input that expands smoothly | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Sidebar** | Session List & Groups | IndexedDB (`db.js`) | Clean hierarchical list with subtle active state and hover actions | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Sidebar** | Avatar & "Ellie" block | None (static placeholder) | **REMOVED**: Completely removed from layout | `runtime-tested in container` (`test_e2e_ui.py` test_01 verifies removal) |
| **Sidebar** | Bottom Connection Status | `/api/health` via `health.js` | **NEW**: Authoritative footer capsule & upward popover with multi-signal status | `runtime-tested in container` (`test_e2e_ui.py` test_01, test_03) |
| **Sidebar** | Settings Button | `settings.open()` | Anchored to bottom footer utility bar next to connection widget | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Composer**| Textarea Auto-expand | Local input event | Single large rounded capsule textarea with auto-height up to 240px | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Composer**| Attach Button ("+") | Drag-and-drop placeholder | Integrated inside the single '+' quick-action popover menu | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Composer**| Tools Pill | Feature registry | Relocated inside the '+' quick-action popover menu | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Composer**| Think Pill | Session think toggle | Relocated into '+' menu; renders as transient chip ONLY when active | `runtime-tested in container` (`test_e2e_ui.py` test_01, test_05) |
| **Composer**| Presets & Params Pill | `presets.js` / localStorage | Relocated into '+' menu; renders as transient chip ONLY when non-default | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Composer**| Model Picker Button | `/api/models` | Compact model chip (name only) next to Send; size badge moved to popover | `runtime-tested in container` (`test_e2e_ui.py` test_01, test_04) |
| **Composer**| Mic Input Button | Disabled placeholder | Nested subtly inside input right edge, adjacent to textarea | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Composer**| Send / Stop Button | SSE Stream via `/api/generate` | Round floating action button morphing from Send arrow to solid Stop square | `runtime-tested in container` (`test_e2e_ui.py` test_01, test_05) |
| **Speech** | Text-to-Speech (TTS) | `/api/tts/synthesize` | Minimalist speaker icon on assistant turn hover action bar | `runtime-tested in container` (HTTP 200, Kokoro WAV stream) |
| **Settings**| Theme Selector | `themeManager` | Pane 1 (Workspace & Experience) with 3-state radio-group switcher | `runtime-tested in container` (`test_e2e_ui.py` test_01, test_02) |
| **Settings**| Font Size Selector | `themeManager` | Pane 1 (Workspace & Experience) with range scale slider | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Settings**| Shortcuts Table | Static keymap | Pane 1 (Workspace & Experience) at bottom, collapsed by default | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Settings**| Default Temp / Top-P | `localStorage` & Session | Pane 2 (Model & Generation) with labeled numeric sliders & badges | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Settings**| Default System Prompt | `localStorage` & Session | Pane 2 (Model & Generation) with instructions textarea | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Settings**| About Modal Info | Static metadata | Pane 3 (Data & System) top section with version badge & details | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Settings**| Clear All Chats | `store.clearAllSessions()` | Pane 3 (Data & System) bottom Danger Zone with two-step confirmation | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
| **Empty State**| Greeting & Canvas | DOM template | Asymmetric start-aligned time greeting in column; zero duplicate logo/status | `runtime-tested in container` (`test_e2e_ui.py` test_01) |
