# Feature Specification: Offline LLM Diagnostics & Live Inference Metrics

**Feature Branch**: `018-offline-llm-diagnostics`  
**Created**: 2026-11-14  
**Status**: Draft  
**Input**: User description: "C: 017-offline-llm-diagnostics-metrics (Live tok/s, TTFT metrics & container health popover)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time Inference Speed & Time to First Token (Priority: P1) 🎯 MVP

When running local models in an offline container environment, users frequently experience initial latency while the host loads model weights into memory or ingests large prompt contexts. As a user chatting with local models, I want to see real-time generation speed (tokens per second) and Time to First Token (TTFT) so that I know immediately whether the model is still loading weights, calculating prompt embeddings, or actively generating text.

**Why this priority**: Local offline LLM users need transparency into generation responsiveness. Without TTFT and live speed indicators, long pauses appear as frozen interfaces, leading users to prematurely cancel prompts or assume the backend is broken.

**Independent Test**: Send a prompt to any local model; verify that elapsed time until first token is measured and displayed, streaming speed updates dynamically in real-time, and final tokens/sec summary is recorded upon turn completion.

**Acceptance Scenarios**:

1. **Given** a prompt is submitted, **When** waiting for generation to commence, **Then** the interface displays an active elapsed timer indicating time spent preparing the response.
2. **Given** the first response token arrives, **When** generation starts streaming, **Then** the system captures and displays Time to First Token (TTFT) in milliseconds or seconds.
3. **Given** tokens are actively streaming, **When** each chunk is received, **Then** the interface calculates and dynamically updates the instantaneous generation rate in tokens per second.
4. **Given** generation reaches completion, **When** the final summary arrives, **Then** the assistant message actions bar displays the final evaluated generation speed, Time to First Token, and total generation time.

---

### User Story 2 - Container & Ollama Health Indicator and Diagnostics Popover (Priority: P2)

In an isolated dual-container topology (`e-webui-app` proxying to an `ollama` container), connectivity can be interrupted by container restarts, proxy misconfiguration, or heavy GPU memory lockups. As a system operator or user, I want an unobtrusive status pill in the top navigation bar with a diagnostics popover showing container reachability, ping latency, and active loaded models, so that I can immediately determine health status without opening terminal sessions.

**Why this priority**: Immediate visual health feedback eliminates uncertainty about container status, reducing troubleshooting time when services restart or models are swapped.

**Independent Test**: View the header status indicator to observe healthy green state; click the indicator to open the diagnostics popover; verify latency in milliseconds, container state, and loaded models are displayed with a manual "Refresh" trigger.

**Acceptance Scenarios**:

1. **Given** the application is open, **When** viewing the header bar, **Then** a compact connection health indicator shows current connectivity status (Operational / Degraded / Offline) with an identifiable color badge.
2. **Given** the health indicator is clicked, **When** the popover opens, **Then** it presents connection round-trip latency (ms), upstream container availability, active running model name, and a "Check Now" refresh action.
3. **Given** the upstream container becomes unreachable or returns server errors, **When** the health check detects failure, **Then** the indicator transitions to an amber/red warning state, and the popover explains the connection issue with diagnostic guidance.
4. **Given** the popover is open, **When** clicking outside or pressing Escape, **Then** the popover dismisses cleanly without altering chat state.

---

### User Story 3 - Comprehensive Turn Performance Diagnostics Modal (Priority: P3)

Power users, model evaluators, and developers benchmarking different models or quantization levels need deep visibility into prompt evaluation vs. token generation performance. As a developer evaluating local model performance, I want to click the turn metadata badge to view an expanded diagnostics breakdown (prompt tokens, response tokens, prompt evaluation rate, generation rate, and total duration) so that I can accurately compare inference characteristics across models.

**Why this priority**: Provides quantitative benchmarking data for optimizing prompt length, context windows, and quantization parameters without cluttering the primary conversation view.

**Independent Test**: Complete a generation turn, click the metadata summary badge in the message actions bar; verify that a detailed breakdown modal/popover displays prompt token count, completion token count, prompt eval speed, and total latency.

**Acceptance Scenarios**:

1. **Given** a completed assistant response with metadata, **When** clicking the metrics info pill, **Then** a detailed performance summary reveals separate breakdowns for prompt evaluation time, generation time, and token counts.
2. **Given** models that report prompt evaluation details, **When** viewing the turn diagnostics, **Then** prompt evaluation speed (tokens/sec) is presented alongside text generation speed.
3. **Given** a user copies or exports the conversation, **When** export occurs, **Then** the turn performance metrics are preserved in metadata headers where applicable.

---

### Edge Cases

- **Container Unreachable During Active Stream**: If connectivity drops mid-generation, the live speed indicator stops smoothly, and the status indicator immediately updates to Offline with an actionable error banner.
- **Zero-Token or Thinking-Only Output**: When a model returns only reasoning chunks or errors out before generating text tokens, TTFT reflects the time to the first reasoning token, and zero-token generation is handled gracefully without division-by-zero crashes.
- **Extreme Latency / Cold Model Swapping**: When a heavy model takes over 30 seconds to load into VRAM, the loading timer continues counting steadily without prematurely timing out the UI health check.
- **Background Tab Throttling**: When the browser tab is hidden or minimized, health check polling automatically throttles down or pauses to conserve CPU cycles, resuming immediately upon tab refocus.
- **RTL / Bidirectional Text Alignment**: Diagnostics badges and popovers remain strictly LTR-isolated and legible even when the active conversation or prompt is in Persian or Arabic.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record the exact timestamp when a user prompt request is dispatched and calculate Time to First Token (TTFT) upon arrival of the first streaming chunk.
- **FR-002**: System MUST compute real-time tokens per second during live streaming using a rolling window of recent token arrival times.
- **FR-003**: System MUST record and format turn completion metrics, including total generation time, total output tokens, and final generation tokens per second.
- **FR-004**: System MUST display generation metrics in the assistant message footer once generation begins, formatted clearly (e.g., `model · 42.5 tok/s · TTFT 1.2s · 3.4s`).
- **FR-005**: System MUST provide a persistent connection health indicator in the application header indicating current container connectivity (Connected, Latency Warning, Disconnected).
- **FR-006**: System MUST perform non-blocking connection health probes to verify upstream proxy and container availability at regular intervals and upon manual request.
- **FR-007**: System MUST provide an interactive diagnostics popover accessible from the header health pill that displays upstream container status, round-trip latency in milliseconds, loaded models, and a manual "Refresh" button.
- **FR-008**: System MUST gracefully handle connection failures or timeouts without interrupting existing conversations or blocking user input.
- **FR-009**: System MUST support clicking or expanding turn metadata to display detailed performance metrics (prompt tokens, eval time, generation tokens, total time).
- **FR-010**: All metrics badges, popovers, and numeric readouts MUST enforce strict LTR directionality and monospace numeric alignment regardless of global text direction.
- **FR-011**: Connection probing MUST automatically pause when the browser window or tab is not visible and resume when restored.

---

### Key Entities *(include if feature involves data)*

- **TurnPerformanceMetrics**: Captures the temporal and volumetric performance data for a single assistant turn. Key attributes:
  - `modelName`: Name of the model executing inference.
  - `timeToFirstTokenMs`: Elapsed time in milliseconds from request dispatch to receipt of the first chunk.
  - `totalDurationSeconds`: Total duration of the turn from start to completion.
  - `evalCount`: Number of generated completion tokens.
  - `evalDurationMs`: Duration spent generating completion tokens.
  - `tokensPerSecond`: Computed generation speed in tokens per second.
  - `promptEvalCount`: Number of tokens in the input prompt context.
  - `promptEvalDurationMs`: Time spent ingesting and evaluating the prompt.
  - `promptEvalTokensPerSecond`: Computed prompt evaluation throughput.

- **ConnectionHealthSnapshot**: Represents the current availability and latency state of the upstream container environment. Key attributes:
  - `status`: Categorical state (`connected`, `degraded`, `disconnected`).
  - `latencyMs`: Round-trip probe duration in milliseconds.
  - `checkedAt`: Timestamp of the most recent probe.
  - `loadedModels`: List of currently loaded models reported by the backend.
  - `errorMessage`: Diagnostic error description if unreachable.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can observe Time to First Token and real-time generation speed within 100 milliseconds of the first token arriving on screen.
- **SC-002**: Turn metrics display accurately reflects final backend evaluation metrics within 1% of server-reported duration and token counts.
- **SC-003**: Connection health probes execute in the background with zero noticeable UI latency or dropped animation frames (< 5ms main thread execution time).
- **SC-004**: Users can determine container connectivity status at a single glance from anywhere in the application interface via the header status badge.
- **SC-005**: Clicking the health badge opens the diagnostics popover in under 100 milliseconds, displaying actionable status, latency, and loaded models.
- **SC-006**: Offline operation is 100% preserved with zero external network requests or telemetry dispatched.

---

## Assumptions

- The backend proxy running in `e-webui-app` provides an endpoint (such as `/api/health` or `/api/tags` or equivalent) that can be pinged to verify communication with the Ollama container without modifying host infrastructure.
- In-flight generation streaming already provides token chunks through Server-Sent Events (SSE) where client-side arrival timestamps can be captured.
- Final streaming metrics (`eval_count`, `eval_duration`, `prompt_eval_count`, `total_duration`) provided by the Ollama API upon turn completion are forwarded through the existing proxy stream.
- The health probe runs periodically (default every 30 seconds) while the page is active and visible, and immediately on page load.
- Diagnostic metrics are stored locally within the session message data and persist across reloads alongside conversation history.
