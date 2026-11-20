# Feature Specification: Pastel Design System and Modern UI/UX Overhaul

**Feature Branch**: `024-pastel-modern-ui-enhancements`

**Created**: 2026-11-20

**Status**: Clarified & Ready for Planning

**Input**: User description: "لطفا بهترین پشنهاد های خودتون را برای زیباتر کردن محیط UI پروژه به من ارائه بدید. زیباتر کردن. کاربردی تر کردن. مدرن تر کردن. استفاده از تم های پاستیلی زیبا و جذاب."

## Clarifications

### Session 2026-11-20
- **Q1: Pastel Theme Palette Collection** → **Option A**: 4 Curated First-Class Pastel Themes (`Matcha & Sand`, `Lavender Breeze`, `Peach Sorbet`, `Ocean Mist`), each equipped with a fully dedicated Light Mode and Dark Mode pairing (preserving pastel identity via charcoal-lavender, slate-sage, obsidian-peach, and deep marine twilight).
- **Q2: Visual Depth & Glassmorphism Styling** → **Option A**: Modern Frosted Glassmorphism featuring `backdrop-filter: blur(16px)` on floating headers and composer capsule, subtle ambient pastel glow shadows (`box-shadow: 0 10px 30px rgba(accent, 0.12)`), organic border radiuses (14px–24px), delicate 1px borders, and fluid spring micro-interactions with graceful fallback for reduced motion.
- **Q3: Chat Productivity & Interaction Scope** → **Option A**: Full Chat Productivity Suite including:
  1. Hover action dock on assistant messages (instant one-click copy with morphing checkmark, Kokoro TTS speech playback with active audio wave, message edit for user prompts, and retry/regeneration for assistant responses).
  2. Four editorial pastel quick-starter prompt cards on the empty canvas (خلاصه‌سازی، کدنویسی، ایده‌پردازی، ویرایش متن) that populate the composer upon click.
  3. Elegant collapsible thinking drawer with animated pastel gradient shimmer and live elapsed seconds timer.
  4. Pinned / Bookmarked conversations at the top of the sidebar history list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Palette Pastel Aesthetics & Live Theme Switcher (Priority: P1)

Users interacting with e-webui can choose from 4 curated, soothing pastel themes (`Matcha & Sand`, `Lavender Breeze`, `Peach Sorbet`, and `Ocean Mist`) in addition to Light/Dark/System mode switching. Each pastel theme provides a cohesive, eye-friendly color story across the entire application—including the sidebar, top header, chat canvas, message bubbles, code blocks, and floating composer. The themes maintain crisp readability and contrast compliance (WCAG AA) while delivering a premium, modern, calming feel.

**Why this priority**: Visual aesthetics, color psychology, and personal expression create the primary emotional connection with the user, transforming a standard LLM chat interface into a delightful daily workspace.

**Independent Test**: Can be tested by switching between pastel theme presets in the UI and confirming immediate, flash-free application of background, surface, text, border, and accent tokens across light and dark modes.

**Acceptance Scenarios**:

1. **Given** a user navigates to the theme configuration in Settings or header, **When** they select a pastel theme (`matcha`, `lavender`, `peach`, or `ocean`), **Then** all CSS design tokens update instantly without page reload or visual jarring.
2. **Given** any active pastel theme, **When** switching between Light and Dark mode, **Then** the application preserves the pastel color identity using appropriately adjusted muted dark tones (charcoal-lavender, slate-sage, obsidian-peach, deep marine) while maintaining minimum 4.5:1 text contrast.
3. **Given** a user selects their preferred theme and refreshes the browser, **When** the page loads, **Then** the chosen pastel theme is applied prior to first paint via `localStorage` with zero theme flicker.

---

### User Story 2 - Modern Frosted Glassmorphism & Refined Micro-Interactions (Priority: P2)

Users experience a modern, airy interface characterized by subtle frosted glass surfaces (`backdrop-filter: blur(16px)`), gentle ambient pastel glow shadows, fluid transitions, and polished micro-interactions. The floating composer capsule, sticky header, popovers, and model badges feel tactile and elevated. Interactive elements respond with smooth spring animations, subtle border glows on focus, and delightful visual feedback upon actions.

**Why this priority**: Modern interface polish relies on depth, visual hierarchy, and tactile feedback. Moving away from rigid, flat rectangular boxes towards organic, soft-curved, translucent components significantly elevates perceived software quality.

**Independent Test**: Can be tested by scrolling messages beneath the floating header and composer, hovering over buttons and cards, opening popovers, and verifying smooth 60fps transitions and backdrop blur support.

**Acceptance Scenarios**:

1. **Given** a user scrolls a long conversation, **When** message bubbles pass beneath the top header or above the floating composer, **Then** background content is smoothly diffused through translucent frosted glass panels with subtle ambient edge borders.
2. **Given** a user hovers over interactive controls (model chip, action buttons, sidebar items), **When** interaction occurs, **Then** elements exhibit soft pastel scaling (1.02x) or gentle ambient halo transitions without layout jitter.
3. **Given** a user prefers reduced motion in their operating system (`prefers-reduced-motion: reduce`), **When** viewing the interface, **Then** all spring and scale animations gracefully revert to immediate or subtle opacity-only transitions.

---

### User Story 3 - Practical Chat Productivity & Editorial Canvas (Priority: P3)

Users benefit from smart, practical interaction enhancements that make chatting more productive and effortless:
- A responsive hover action dock on messages (instant one-click copy with morphing checkmark, text-to-speech audio playback with wave indicator, message edit, and regeneration).
- An empty canvas adorned with inspiring pastel quick-starter prompt chips (e.g., "خلاصه‌سازی و تحلیل", "کدنویسی پایتون", "ایده‌پردازی خلاقانه", "ویرایش و بهبود متن") that inject directly into the composer.
- An elegant collapsible "Thinking Process" card featuring an animated pastel gradient shimmer and execution duration badge.
- Pinned and organized conversation history in the sidebar for rapid access.

**Why this priority**: Beauty without practicality is hollow; modern AI interfaces (such as Claude and Perplexity) excel because their visual elegance directly serves productivity and flow.

**Independent Test**: Can be tested by clicking a prompt suggestion chip to populate the composer, triggering generation to observe the collapsible thought card, and using the message hover dock to copy and trigger TTS.

**Acceptance Scenarios**:

1. **Given** an empty conversation canvas, **When** a user clicks a pastel starter chip, **Then** the prompt text seamlessly populates the composer textarea and gains auto-focus.
2. **Given** an AI response containing reasoning/thought steps, **When** the message streams, **Then** thoughts appear inside a graceful pastel-tinted collapsible box with elapsed timing that can be toggled open or closed without shifting chat layout.
3. **Given** an AI response, **When** the user hovers over the message block, **Then** a floating micro-toolbar appears offering Copy, Audio Read-Aloud, and Retry options with immediate visual confirmation upon click.
4. **Given** an active conversation in the sidebar, **When** the user clicks "Pin conversation", **Then** the conversation moves to a dedicated "Pinned" section at the top of the history list with a pastel pin badge.

---

### Edge Cases

- **Contrast in Sunlight / Bright Ambient Light**: What happens when a user views a very soft pastel theme under high glare? The system ensures dark and light pastel tones maintain strict WCAG AA contrast (≥ 4.5:1 for body copy and ≥ 3:1 for large headers and icons) rather than using washed-out low-contrast pastels.
- **Backdrop-Filter Unsupported Browsers**: How does the interface render on older browsers without `backdrop-filter`? The CSS provides solid fallback background colors with safe opacity layers.
- **RTL / Farsi Typography Layout**: How do pastel chips, floating toolbars, and icons align when Persian/Arabic text is entered? Message bubbles and floating docks automatically align according to detected script direction (start/end) without breaking margin balance.
- **Dense Mobile Viewports**: How do pastel starter chips and the composer behave on narrow screens (< 480px)? Starter chips wrap smoothly into a horizontally swipeable or compact 2-column grid, and floating docks adapt to permanent accessible touch tap targets.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a theme configuration interface allowing users to select their preferred pastel color palette from 4 curated presets (`matcha` [Sage & Sand], `lavender` [Lavender Breeze], `peach` [Peach Sorbet & Rose], `ocean` [Ocean Mist & Mint]).
- **FR-002**: System MUST persist the selected pastel palette (`ewebui_palette`) and theme mode (`ewebui_theme`) in browser `localStorage` and apply them synchronously in `<head>` before first paint to prevent Flash of Unstyled Theme (FOUT).
- **FR-003**: System MUST provide both Light and Dark mode variations for every pastel theme, ensuring dark mode leverages deep cozy charcoal/slate tones tinted with corresponding pastel accents.
- **FR-004**: System MUST apply modern frosted glassmorphism styling (`backdrop-filter: blur(16px)`, translucent pastel surfaces, refined border radiuses of 14px–24px, and soft diffuse ambient shadows) across headers, composer capsules, and modal sheets.
- **FR-005**: System MUST provide a refined message action toolbar (hover dock on desktop, touch tap-target on mobile) supporting one-click copy with animated feedback, TTS audio playback, user message edit, and assistant retry/regeneration.
- **FR-006**: System MUST present practical empty-state starter prompt pills on the chat canvas with pastel color-coding and icons (Summarization, Coding, Creative, Editing) that populate the composer upon click.
- **FR-007**: System MUST render model thinking/reasoning blocks inside an aesthetically pleasing collapsible pastel enclosure featuring execution duration timer and gentle status shimmer pulse.
- **FR-008**: System MUST provide a conversation pinning capability in the sidebar, sorting pinned sessions into an elevated top section with distinct pastel pin indicators.
- **FR-009**: System MUST maintain full responsiveness, keyboard accessibility (Tab, Enter, Space, Escape navigation), visible focus rings, and WCAG AA contrast standards across all pastel combinations.
- **FR-010**: System MUST preserve all existing functionalities including Ollama connection telemetry, model switching, settings configuration, TTS synthesis, and markdown formatting.

### Key Entities *(include if feature involves data)*

- **PastelThemePreset**: Represents a themed visual token bundle (`matcha`, `lavender`, `peach`, `ocean`) comprising primary pastel background, panel/card surface, border tint, primary accent, secondary soft highlight, text ink, muted typography, and dark-mode counterpart tokens.
- **PromptSuggestion**: Represents an editorial starter prompt entity containing an id, title, description, category icon, pastel category tag, and full prompt payload.
- **MessageActionState**: Represents the ephemeral UI state of a message block (hover state, copy confirmation status, TTS playing status, thought drawer collapsed/expanded state).
- **SessionPinState**: Represents the persistent pin flag (`pinned: boolean`) on conversation session metadata stored in IndexedDB.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between pastel theme presets in under 1 second with 0ms visual flash or layout shift.
- **SC-002**: 100% of text and functional interactive elements across all pastel themes meet or exceed WCAG AA contrast ratio (≥ 4.5:1 for standard text, ≥ 3:1 for large text and icons).
- **SC-003**: Message actions (copying, thought toggling, audio playback) are reachable in a single click with immediate visual feedback (< 100ms response).
- **SC-004**: Scrolling performance maintains 60fps on modern mobile and desktop devices with frosted glass surfaces active.
- **SC-005**: First-time users can initiate their first AI prompt via starter chips in under 3 seconds from initial page load.

## Assumptions

- The existing CSS token structure (`--bg`, `--panel`, `--line`, `--tx`, `--sage`, `--peach`, `--rose`, etc.) in `app/static/style.css` will be extended with clean semantic data attributes (e.g. `[data-palette="..."]` on `<html>`) allowing instant live switching.
- Modern browsers (Chrome, Edge, Safari, Firefox) support CSS backdrop-filter and CSS custom properties; solid fallback background colors are provided for legacy/unsupported renderers.
- The project's Constitution (Principle IV) grants unrestricted UI/UX innovation, allowing aesthetic redesigns and enhanced component layouts without rigid legacy constraints.
- Persian typography will continue to use the embedded Vazirmatn font with optimal line-height and letter-spacing for pastel readability.
