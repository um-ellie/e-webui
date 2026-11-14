# Technical Research & Decisions: Offline LLM Diagnostics & Live Inference Metrics

**Feature**: `018-offline-llm-diagnostics`  
**Date**: 2026-11-14  
**Status**: Completed  

---

## 1. Metric Capture & Time to First Token (TTFT)

### Decision
Calculate TTFT client-side in `api.js` and `composer.js` by recording `performance.now()` when the HTTP request is initiated (`requestDispatchedAt`) and capturing the delta timestamp when either the first text token or reasoning token chunk is received. Forward server-side telemetry (`eval_count`, `eval_duration`, `prompt_eval_count`, `prompt_eval_duration`, `load_duration`) through SSE completion chunk.

### Rationale
* Client-side measurement reflects actual end-to-end user perceived latency, encompassing network travel between container proxy and client, prompt ingestion, model loading, and context evaluation.
* Capturing the first token arrival timestamp client-side requires zero changes to the underlying model inference engine or host container.
* By extending `StreamChunk` in `app/models.py` and `app/services/ollama_client.py` with `eval_duration`, `prompt_eval_count`, `prompt_eval_duration`, and `load_duration`, the frontend receives exact nanosecond-precision execution metrics directly from Ollama's final response line without extra API overhead.

### Alternatives Considered
* **Server-only logging**: `app/main.py` already logs TTFT to server console (`logger.info(f"[{req_id}] First token emitted after {ttft:.1f}ms")`), but this metric was discarded and never delivered to the web UI. Sending it to the client makes it visible and actionable for the user.
* **Polling Ollama `/api/show` during generation**: Rejected because polling during active generation creates resource contention and introduces network jitter on the proxy.

---

## 2. Real-Time Streaming Speed (Tokens Per Second)

### Decision
Calculate instantaneous generation rate during active streaming using a rolling window of recent token arrival times (e.g. past 1.5 seconds or elapsed generation time after first token), rendering the live speed indicator on the throttled animation frame boundary. Upon stream conclusion, display the exact evaluated speed computed from Ollama's `eval_count / (eval_duration / 1e9)`.

### Rationale
* Using a rolling window during streaming prevents erratic speed spikes when tokens arrive in multi-character clusters while providing immediate feedback on whether generation is accelerating or throttling.
* Binding the live speed calculation to the existing 40ms `requestAnimationFrame` throttle in `chat.js` ensures zero additional DOM churn or main-thread blocking.
* Final generation speed calculated from `eval_count` and `eval_duration` provides mathematically exact benchmark metrics identical to Ollama CLI outputs.

### Alternatives Considered
* **Average speed from request start**: Dividing total tokens by elapsed time from request dispatch produces artificially depressed speed figures because it includes model load time (cold start) and prompt ingestion time. Splitting prompt ingestion (TTFT) from generation speed provides accurate diagnostic clarity.

---

## 3. Container & Ollama Health Probe Architecture

### Decision
Extend `GET /api/health` in `app/main.py` to measure round-trip latency (`latency_ms`) to the Ollama container and query `/api/ps` (or `/api/tags`) to discover active loaded models. The client polls `GET /api/health` every 30 seconds when the tab is visible, pausing when `document.hidden === true`, and provides an immediate manual "Check Now" trigger in the diagnostics popover.

### Rationale
* `GET /api/health` runs strictly through the existing backend proxy, preserving complete container isolation and network boundary containment (Principle I & II).
* Measuring round-trip time in `OllamaClient.check_health()` using `time.monotonic()` incurs minimal overhead (< 2ms on local container bridges).
* Ollama's `/api/ps` endpoint exposes currently loaded models in VRAM/RAM; querying it during health checks allows users to see what models are currently resident in memory.
* Pausing polling when the browser tab is hidden respects host battery and CPU resources.

### Alternatives Considered
* **Continuous WebSocket heartbeat**: Overly complex for a local offline container; adds persistent socket state without meaningful latency advantage over lightweight periodic HTTP probes.
* **Direct browser ping to Ollama host port**: Violates container proxy security architecture and fails Cross-Origin Resource Sharing (CORS) rules. Probing must always pass through the backend proxy `/api/health`.

---

## 4. UI Diagnostics Presentation: Status Pill & Turn Details Popover

### Decision
1. **Header Health Pill**: Add a compact status pill to `app/static/js/components/header.js` alongside the model selector, showing a color-coded status dot (green = operational, amber = high latency > 500ms or degraded, red = unreachable) and short label ("Connected"). Clicking toggles an accessible popover.
2. **Turn Diagnostics Popover**: Enhance the message actions metadata pill (`qwen2.5:7b · 42.5 tok/s · TTFT 0.8s · 3.4s`) in `app/static/js/components/chat.js` to be clickable, revealing a detailed turn performance breakdown table (Prompt Eval tokens & speed, Generation tokens & speed, Model load duration, Total duration).
3. **Directional Isolation**: Enforce `dir="ltr"` and `font-family: var(--font-mono)` on all numeric and latency figures to ensure proper alignment in both English and RTL (Persian/Arabic) conversation modes.

### Rationale
* The header health pill provides ambient awareness without obstructing conversations.
* The turn diagnostics popover allows power users and benchmarks to inspect granular details without cluttering the main conversation stream for casual users.
* Monospace LTR isolation prevents numbers, decimal points, and units (`tok/s`, `ms`, `s`) from flipping or misaligning in RTL reading mode.
