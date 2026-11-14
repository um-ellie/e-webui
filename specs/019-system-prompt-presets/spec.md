# Feature Specification: System Prompt Presets & Model Parameter Controls

**Feature Branch**: `019-system-prompt-presets`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "D: 019-system-prompt-presets (Presets, temperature tuning & session instructions)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - System Prompt Presets & Session Persona Selection (Priority: P1)

As a user interacting with local language models, I want to select from curated system prompt presets (such as General Assistant, Coding Specialist, Concise Editor, and Academic Explainer) or enter a custom persona prompt for the active conversation, so that the model consistently adopts the tone, depth, and constraints suited to my task.

**Why this priority**: Different tasks require drastically different model personalities, output lengths, and instruction constraints. Providing quick preset selection eliminates repetitive manual prompt typing for every conversation and ensures high-quality domain-specific outputs.

**Independent Test**: Can be verified by choosing the "Coding Specialist" preset on a new conversation, sending a programming query, and confirming the model response immediately adheres to clean code conventions without introductory chit-chat.

**Acceptance Scenarios**:

1. **Given** a user is starting a new conversation or working within an existing session, **When** the user opens the model parameters panel and selects a built-in preset (e.g. "Coding Specialist"), **Then** the system prompt is applied to the active conversation and visibly reflected in the session configuration.
2. **Given** an active conversation with a selected system prompt preset, **When** the user sends a message, **Then** the prompt request includes the active system instruction, and subsequent responses adhere to the persona directives.
3. **Given** a user wishes to craft an ad-hoc system instruction, **When** the user inputs custom text into the system prompt input area and applies it, **Then** the conversation adopts the custom instruction without requiring a pre-saved template.
4. **Given** a user switches between existing conversation sessions, **When** a session is loaded, **Then** its previously configured system prompt or preset is faithfully restored and displayed.

---

### User Story 2 - Sampling Parameter Controls & Intuitive Sliders (Priority: P2)

As a user optimizing generation behavior, I want fine-grained control over sampling parameters—specifically Temperature, Top-P, and Context Window size—with intuitive visual sliders, quick-preset shortcuts (e.g. "Deterministic / Coding", "Balanced", "Creative Exploration"), and immediate numeric readouts, so that I can calibrate the model's creativity or determinism for coding, drafting, or brainstorming.

**Why this priority**: Complex offline tasks like programming or structured JSON generation require low entropy / deterministic sampling (low temperature), while creative brainstorming demands higher variability. Providing interactive, bounded controls allows users to tune behavior directly without editing server configuration.

**Independent Test**: Can be verified by setting Temperature to 0.0 ("Deterministic") and generating code for an identical prompt twice, confirming consistent and deterministic output, then adjusting to 1.2 ("Creative") and confirming varied phrasing.

**Acceptance Scenarios**:

1. **Given** the model parameter panel is opened, **When** the user adjusts the Temperature slider between 0.0 and 2.0, **Then** the slider displays the exact numeric value in real-time alongside a descriptive behavior label (e.g. "Deterministic", "Balanced", "Creative").
2. **Given** the user selects a quick parameter shortcut (e.g. "Precise / Coding" with Temperature 0.2 and Top-P 0.8), **When** the shortcut button is clicked, **Then** the associated sliders immediately snap to the predefined recommended values.
3. **Given** the user adjusts the Context Window size control, **When** a capacity level is selected (e.g., 2048, 4096, 8192, 16384 tokens), **Then** the context parameter is saved with the active session and applied to subsequent prompts.
4. **Given** an active chat session with customized sampling parameters, **When** new turns are submitted, **Then** the model generation strictly respects the chosen temperature, top-p, and context limit parameters.

---

### User Story 3 - Custom User Presets Management (Priority: P3)

As a power user with recurring specialized workflows, I want to create, name, update, duplicate, and delete my own custom system prompt presets and parameter configurations, so that I can maintain a personalized library of agent personas that persists permanently across reloads and offline sessions.

**Why this priority**: Power users frequently iterate on specialized domain prompts (e.g. "SQL Query Optimizer", "Farsi Translator", "PR Reviewer"). Allowing them to save and manage custom presets creates persistent personal productivity assets.

**Independent Test**: Can be verified by saving a custom preset named "SQL Optimizer" with a custom prompt, refreshing the page or restarting the browser, and confirming the preset remains selectable from the preset list and can be applied or deleted.

**Acceptance Scenarios**:

1. **Given** the user has configured custom system instructions and parameter values, **When** the user clicks "Save as Preset" and provides a unique name, **Then** the custom preset is stored in persistent local offline storage and appears in the presets dropdown.
2. **Given** a saved custom preset, **When** the user edits its text or parameters and saves changes, **Then** the preset updates immediately across the interface.
3. **Given** a saved custom preset, **When** the user deletes it, **Then** the preset is permanently removed from the user preset library while leaving built-in presets untouched and immutable.
4. **Given** a user is operating in full offline isolation, **When** presets are created, modified, or deleted, **Then** all changes persist locally without requiring internet access or external authentication.

---

### User Story 4 - Visual Status Indicators & Export Transparency (Priority: P4)

As a user reviewing conversations or exporting session history, I want the active persona and sampling parameters to be clearly indicated in the chat header or composer toolbar, and included as metadata in exported conversation files (Markdown and JSON), so that I and my collaborators have complete provenance over the generation conditions of any saved chat.

**Why this priority**: Without visible indicators, users can easily lose track of which persona or temperature is active. Clear visual pills and export metadata provide transparency and reproducibility.

**Independent Test**: Can be verified by enabling a custom preset, checking that an active preset pill appears in the header or toolbar, exporting the conversation to Markdown and JSON, and verifying that the preset name and temperature are recorded in the export headers/metadata.

**Acceptance Scenarios**:

1. **Given** a session with a non-default system prompt or customized temperature, **When** the user views the chat screen, **Then** a subtle indicator pill displays the active preset name or customized status.
2. **Given** an active session with customized parameters, **When** the user exports the conversation to Markdown, **Then** the Markdown frontmatter/metadata section includes the system prompt text, preset name, and sampling parameters.
3. **Given** an active session with customized parameters, **When** the user exports the conversation to JSON, **Then** the exported JSON document encapsulates the system instruction and parameter configuration object.

---

### Edge Cases

- **Empty System Prompt**: If a user clears the custom system prompt field, the system must cleanly omit the system prompt from the request rather than sending blank whitespace.
- **Extreme Parameter Bounds**: If a user enters extreme or boundary values (e.g. Temperature 0.0 or 2.0, Top-P 0.0 or 1.0), the system must validate the input within supported safe ranges and prevent generation failures.
- **Session Switching with Custom Unsaved Prompt**: If a user types a custom system prompt into a session and switches to another session before sending a message, the draft instruction must remain associated with that specific session.
- **Large System Instructions**: If a user pastes an extensive multi-paragraph system prompt (e.g. 5,000 characters), the input area must expand gracefully with a scrollbar and character counter, and avoid truncating during generation or persistence.
- **Offline Storage Quota or Reset**: If a user clears browser cache or storage, the application must gracefully fall back to the built-in system prompt presets without crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a set of built-in system prompt presets (including at minimum: "Helpful Assistant", "Coding Specialist", "Concise Editor", and "Academic Explainer").
- **FR-002**: Built-in system prompt presets MUST be immutable and protected against accidental overwriting or deletion.
- **FR-003**: System MUST allow users to author, save, edit, duplicate, and delete custom user-defined presets with custom titles, instructions, and optional default sampling parameters.
- **FR-004**: System MUST persist custom user presets in offline-capable local client storage so they survive page reloads and browser restarts without internet connectivity.
- **FR-005**: System MUST allow users to apply a system prompt preset or freeform custom system instruction to any individual conversation session.
- **FR-006**: System MUST provide interactive slider and numeric controls for sampling Temperature ranging from 0.0 to 2.0 with a default of 0.7 and step resolution of at least 0.05.
- **FR-007**: System MUST provide quick-select temperature shortcut buttons for common generation styles (e.g., "Deterministic / Code" at 0.2, "Balanced" at 0.7, and "Creative" at 1.2).
- **FR-008**: System MUST provide interactive controls for Top-P sampling (ranging from 0.0 to 1.0 with a default of 0.9) and Context Window size selection (supporting choices such as 2048, 4096, 8192, 16384, or model default).
- **FR-009**: System MUST attach the active session's system instruction and sampling parameters (`temperature`, `top_p`, `num_ctx`) to model inference requests.
- **FR-010**: System MUST display an accessible visual badge or indicator in the chat view when an active session uses a custom system prompt or non-standard sampling parameters.
- **FR-011**: System MUST update the feature registry to reflect that system prompt configuration (`model.system_prompt`) and parameter tuning (`model.temperature_tune`) are enabled and functional.
- **FR-012**: System MUST include the active system prompt and sampling parameters in conversation export files (both Markdown and JSON formats) for full provenance and auditability.
- **FR-013**: System MUST gracefully restore session-specific system prompts and parameter configurations when switching between historical conversations.

### Key Entities *(include if feature involves data)*

- **SystemPromptPreset**: Represents a reusable persona template. Attributes include `id` (unique identifier), `title` (human-readable display name), `description` (short summary of behavior), `systemPrompt` (instruction text passed to the model), `isBuiltIn` (boolean flag distinguishing system defaults from user creations), `defaultTemperature` (optional recommended temperature), and `createdAt` (timestamp).
- **SessionParameters**: Represents the generation tuning configuration bound to a conversation session. Attributes include `systemPrompt` (active system text), `presetId` (reference to originating preset, if applicable), `temperature` (sampling entropy, 0.0 - 2.0), `topP` (nucleus sampling threshold, 0.0 - 1.0), and `numCtx` (context token window size).
- **ExportProvenanceMetadata**: Metadata captured in exported conversation documents, recording `presetTitle`, `systemPrompt`, `temperature`, `topP`, `contextWindow`, and `modelName`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between system prompt presets and observe the active persona change in under 2 seconds.
- **SC-002**: Creating, saving, and applying a new custom user preset can be completed in under 15 seconds without leaving the chat interface.
- **SC-003**: 100% of custom presets and session parameter overrides persist across browser reloads and offline sessions without external server dependencies.
- **SC-004**: Generation requests with low temperature (0.0 - 0.2) yield consistent and deterministic outputs for repeatable engineering queries.
- **SC-005**: 100% of exported conversation files (Markdown and JSON) accurately capture the active system prompt and sampling parameters used during the session.
- **SC-006**: Feature activation maintains zero external network dependencies, operating completely self-hosted and offline.

## Assumptions

- Target environment is an offline local deployment interfacing with local model containers via the existing proxy.
- Users have local browser storage (IndexedDB / localStorage) enabled with sufficient capacity for hundreds of text presets.
- The underlying inference engine supports standard sampling options (`temperature`, `top_p`, `num_ctx`) and standard `system` instruction parameter injection.
- Presets are stored per browser profile; multi-user profile synchronization across disparate devices is out of scope for this offline-first application.
- Advanced hyper-parameters (such as repetition penalty, frequency penalty, Mirostat) may be added in future iterations if required, while keeping the core modal clean and uncluttered.
