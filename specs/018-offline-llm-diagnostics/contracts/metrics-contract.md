# Live Inference Metrics & Turn Diagnostics Contract

**Feature**: `018-offline-llm-diagnostics`  
**Date**: 2026-11-14  

This contract governs the measurement, streaming calculation, and DOM representation of inference timing, throughput (tokens/sec), and Time to First Token (TTFT).

---

## 1. Timing & Metrics Definitions

| Metric Name | Computation Formula | Units | Emitted When |
|---|---|---|---|
| **Time to First Token (TTFT)** | `firstTokenReceivedAt - requestDispatchedAt` | Milliseconds (`ms`) or Seconds (`s` if $\ge 1.0$) | First chunk received |
| **Instantaneous Generation Speed** | $\frac{\text{tokens in rolling window}}{\text{elapsed window seconds}}$ | `tok/s` (1 decimal place) | Each throttled streaming frame |
| **Final Evaluated Speed** | $\frac{\text{eval\_count}}{\text{eval\_duration} \div 10^9}$ | `tok/s` (1 decimal place) | Turn completion (`done: true`) |
| **Prompt Evaluation Speed** | $\frac{\text{prompt\_eval\_count}}{\text{prompt\_eval\_duration} \div 10^9}$ | `tok/s` (1 decimal place) | Turn completion (if available) |
| **Model Load Duration** | $\frac{\text{load\_duration}}{10^6}$ | Milliseconds (`ms`) | Turn completion (if available) |
| **Total Duration** | `(turnCompletedAt - requestDispatchedAt) / 1000` | Seconds (`s`, 1 decimal place) | Turn completion |

---

## 2. In-Flight Streaming Metrics Display

During active generation, the streaming message row displays an in-flight status badge adjacent to or above the blinking cursor:

```html
<div class="streaming-metrics-badge" dir="ltr">
  <span class="metric-item"><span class="metric-icon">⚡</span> <span class="metric-value">{liveSpeed}</span> tok/s</span>
  <span class="metric-separator">·</span>
  <span class="metric-item">TTFT <span class="metric-value">{ttftFormatted}</span></span>
</div>
```

* Throttling: Updates occur strictly on animation frame boundaries ($\ge 40\text{ ms}$ interval clamp).
* Fallback: If `ttft` is not yet available (waiting for initial response), the existing model loading timer (`Loading model… 3s`) is displayed.

---

## 3. Completed Turn Metadata Badge & Popover

Upon turn completion, the message action bar renders a clickable metadata summary pill:

```html
<button class="btn-meta-pill" type="button" aria-label="View detailed turn performance diagnostics" dir="ltr">
  <span class="meta-model">{modelName}</span>
  <span class="meta-sep">·</span>
  <span class="meta-speed">{tokensPerSecond} tok/s</span>
  <span class="meta-sep">·</span>
  <span class="meta-ttft">TTFT {ttftFormatted}</span>
  <span class="meta-sep">·</span>
  <span class="meta-duration">{durationSeconds}s</span>
</button>
```

### Turn Diagnostics Popover Details Table
Clicking `.btn-meta-pill` toggles a diagnostics modal or popover containing:

| Field | Description | Example |
|---|---|---|
| **Model** | Identified model name | `qwen2.5:7b` |
| **Time to First Token** | Initial latency before generation | `840 ms` |
| **Prompt Evaluation** | Tokens ingested and evaluation throughput | `124 tokens · 310.5 tok/s` |
| **Response Generation** | Completion tokens and generation rate | `412 tokens · 42.8 tok/s` |
| **Model Load Time** | Memory weight preparation duration | `0 ms (warm)` or `4.2s (cold)` |
| **Total Turn Time** | End-to-end turnaround time | `10.4 s` |

---

## 4. Directional & Monospace Rules

1. All metrics badges, pills, and numerical popover tables MUST enforce `dir="ltr"` and `unicode-bidi: isolate`.
2. Numbers, units (`tok/s`, `ms`, `s`), and decimal points MUST use `var(--font-mono)`.
