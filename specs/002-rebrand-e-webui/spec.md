# Feature Specification: Rebrand to e-webui and Brand Logo Integration

**Feature Branch**: `002-rebrand-e-webui`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Rebrand the application to \"e-webui\" and add the \"> ~/.E _\" brand logo to the chat page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Brand Identity & Animated Logo in Chat Header (Priority: P1)

As a user interacting with the chat application, I want to see the brand logo `> ~/.E _` prominently positioned at the top left of the chat page with an animated terminal cursor, so that I experience a clear, modern, terminal-inspired visual brand identity.

**Why this priority**: The brand logo is the central visual signature of the new identity on the primary user-facing page. Delivering this creates immediate visual recognition and satisfies core branding goals.

**Independent Test**: Can be tested independently by loading the chat interface in a browser and verifying that `> ~/.E _` renders in the header left section with distinct styling, responsive sizing, and an active blinking cursor.

**Acceptance Scenarios**:

1. **Given** the chat page is loaded on a desktop viewport, **When** the user views the header, **Then** the brand logo `> ~/.E _` is displayed at approximately 34px font size with prompt and text styled via brand color tokens.
2. **Given** the chat page is loaded on a mobile viewport (<640px), **When** the user views the header, **Then** the brand logo scales down to approximately 28px font size while maintaining layout integrity.
3. **Given** the user has enabled reduced motion preferences (`prefers-reduced-motion: reduce`), **When** viewing the brand logo, **Then** the cursor animation pauses and remains statically visible without blinking.
4. **Given** a screen reader user navigates to the header, **When** focusing on the brand logo, **Then** the screen reader announces the accessible name "e-webui" and ignores the decorative trailing cursor character.
5. **Given** a right-to-left (RTL) language or chat direction, **When** the brand logo renders, **Then** the logo text strictly maintains its left-to-right (`> ~/.E _`) ordering with isolated bidirectional flow.

---

### User Story 2 - Comprehensive Application Rebranding (Priority: P1)

As an application user and maintainer, I want all occurrences of legacy names (`ellie-ollama-webui`, `Ollama Web UI`, `Web UI`, `webui`) throughout user interface elements, titles, documentation, and configuration replaced with `e-webui`, so that the product identity is completely unified and unambiguous.

**Why this priority**: Consistent naming across page titles, UI labels, documentation, and workspace files is essential to establish the new canonical brand and eliminate legacy confusion.

**Independent Test**: Can be tested independently by inspecting page titles, headings, documentation, and repository files to confirm that legacy names are replaced with `e-webui` while third-party service references remain intact.

**Acceptance Scenarios**:

1. **Given** the chat interface is open in a browser, **When** inspecting the browser tab title and document header, **Then** the title displays `e-webui` rather than legacy variants.
2. **Given** workspace documentation, README, and configuration files, **When** searched for legacy application names, **Then** all valid project references reflect `e-webui` without broken compounded names.
3. **Given** references to third-party services or APIs (such as the Ollama server, Ollama API endpoints, or external tools), **When** reviewing the updated codebase, **Then** those third-party references remain unaltered.

---

### User Story 3 - Operational & Configuration Consistency (Priority: P2)

As a system operator or developer managing the workspace, I want package configuration, service definitions, and environment variables updated to the `e-webui` standard without breaking existing application startup or local execution workflows.

**Why this priority**: Operational files and configuration must align with the new name to ensure maintainability and clean dev/test workflows, but depend on the core naming and UI updates.

**Independent Test**: Can be tested independently by running application unit and integration tests, checking service definitions, and confirming that the application launches smoothly under the new name.

**Acceptance Scenarios**:

1. **Given** workspace service configuration files and script templates, **When** inspected, **Then** internal service naming and descriptions use `e-webui`.
2. **Given** container or Incus infrastructure references outside the workspace scope, **When** the rebranding is processed, **Then** the agent leaves infrastructure configurations untouched and reports any external references to the operator for manual execution.
3. **Given** the rebranded application, **When** running automated test suites, **Then** all tests pass without errors stemming from unresolved file paths or broken imports.

---

### Edge Cases

- **User Preference for Reduced Motion**: When `prefers-reduced-motion: reduce` is active, the cursor must not flicker or disappear; it must pause animation in a visible, static state.
- **RTL Language / Bidi Text Flow**: If page content or user prompt direction switches to RTL, the logo wrapper must enforce `dir="ltr"` with isolated Unicode bidirectional formatting so characters do not reorder or flip.
- **Sub-string Collisions & Replacement Precedence**: When replacing legacy names, longer matches (`ellie-ollama-webui` → `Ollama Web UI` → `Web UI` → `webui`) must be replaced in order of decreasing length to prevent partial replacements (e.g. `ellie-ollama-e-webui`).
- **Third-Party & External API Exclusions**: Occurrences of "Ollama" referring to the Ollama server runtime, API endpoints, hostnames, or model tags, and external products like "Open WebUI", must not be renamed.
- **Infrastructure Isolation Boundary**: Any occurrences of legacy names within Incus container profiles, device names, or external orchestration settings must remain untouched and documented for user action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST establish `e-webui` as the canonical application name, formatted strictly in lowercase with a hyphen.
- **FR-002**: The chat interface MUST display the brand logo `> ~/.E _` at the top of the left column / header.
- **FR-003**: The brand logo MUST visually isolate the prompt symbol (`>`) using `--logo-prompt` and the brand path/cursor (`~/.E _`) using `--logo-text`.
- **FR-004**: The brand logo cursor character (`_`) MUST exhibit a periodic blinking animation during standard operation.
- **FR-005**: The brand logo cursor animation MUST pause and remain statically visible when the user agent specifies `prefers-reduced-motion: reduce`.
- **FR-006**: The brand logo MUST enforce left-to-right (`dir="ltr"`) text direction and bidirectional isolation (`unicode-bidi: isolate`) regardless of the surrounding document direction.
- **FR-007**: The brand logo MUST expose an accessible name ("e-webui") to assistive technologies on its root wrapper and hide the decorative cursor character from screen readers (`aria-hidden="true"`).
- **FR-008**: The brand logo MUST provide responsive typography, sizing at approximately 28px font size on mobile viewports and scaling to approximately 34px font size on desktop viewports (from standard small breakpoint upwards).
- **FR-009**: The system MUST replace all occurrences of `ellie-ollama-webui`, `Ollama Web UI`, `Web UI`, and `webui` with `e-webui` across workspace files, UI text, page titles, documentation, configuration, and code identifiers.
- **FR-010**: Name replacements MUST be processed in order of decreasing length (`ellie-ollama-webui` first, followed by `Ollama Web UI`, then `Web UI`, then `webui`) to avoid corrupting compound phrases.
- **FR-011**: References to third-party products (e.g., Open WebUI) and Ollama service components (server endpoints, hostnames, and model names) MUST NOT be altered.
- **FR-012**: External infrastructure elements, including Incus container configurations, profiles, and proxy devices, MUST NOT be modified, with any relevant external naming surfaced transparently to the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user interface headings, browser tab titles, and workspace documentation accurately reference `e-webui` without legacy naming remnants.
- **SC-002**: The brand logo `> ~/.E _` renders in the chat header with exact responsive font scaling (~28px mobile, ~34px desktop) and correct color token mapping.
- **SC-003**: In accessibility audits, the brand logo wrapper announces as "e-webui" while the cursor symbol is ignored by assistive screen readers.
- **SC-004**: In motion-preference testing, enabling `prefers-reduced-motion: reduce` completely pauses the cursor blink while preserving visibility.
- **SC-005**: Full repository audit verifies zero legacy naming instances in workspace code, tests, and configuration files, excluding explicit third-party exceptions.
- **SC-006**: 100% compliance with Infrastructure Isolation: zero changes made to Incus containers or external infrastructure configs.

## Assumptions

- The application uses standard browser capabilities (CSS variables and keyframe animations) to handle theming and animations without requiring extra runtime dependencies.
- The default styling and color tokens (`--logo-prompt` and `--logo-text`) will be defined in the application's existing stylesheet so they function seamlessly in both light and dark themes.
- Third-party endpoints pointing to the local or remote Ollama API will retain standard `/api/...` paths and terminology.
- Infrastructure operations (e.g., container renaming or service reloading on the host) are performed manually by the user as per Principle I and Principle III of the constitution.
