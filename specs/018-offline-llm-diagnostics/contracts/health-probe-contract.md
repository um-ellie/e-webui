# Container & Ollama Health Probe Contract

**Feature**: `018-offline-llm-diagnostics`  
**Date**: 2026-11-14  

This contract defines the endpoint specification, polling behavior, threshold classification, and DOM structure for the container health indicator.

---

## 1. Health Probe Endpoint (`GET /api/health`)

### Request
`GET /api/health`

### Response Payload Schema
```json
{
  "status": "ok",
  "ollama_connected": true,
  "ollama_url": "http://127.0.0.1:11434",
  "latency_ms": 14.2,
  "loaded_models": ["qwen2.5:7b"]
}
```

* Status Codes:
  * `200 OK`: Proxy is reachable. `ollama_connected: true` denotes upstream Ollama responded successfully.
  * `200 OK` (Degraded): Proxy is reachable, but `ollama_connected: false` and `status: "degraded"` indicates Ollama did not respond.
  * `502 / 503 / NetworkError`: Backend proxy server itself is offline.

---

## 2. Health Threshold Classification Rules

| Status | Dot Class | Condition | Tooltip / Description |
|---|---|---|---|
| **Operational** | `.status-connected` | `ollama_connected === true && latencyMs < 500` | "Ollama connected (14ms)" |
| **High Latency** | `.status-degraded` | `ollama_connected === true && latencyMs >= 500` | "High latency (620ms)" |
| **Degraded** | `.status-degraded` | `ollama_connected === false` | "Ollama service unreachable" |
| **Offline** | `.status-disconnected` | Fetch failed / network error | "e-webui proxy offline" |

---

## 3. Polling Lifecycle & Inactivity Throttling

1. **Initial Probe:** Executed immediately upon DOM ready (`DOMContentLoaded`).
2. **Periodic Interval:** Repeated every 30 seconds while the page remains active.
3. **Visibility Optimization:**
   - When `document.visibilityState === 'hidden'`, periodic polling is paused.
   - When `document.visibilityState === 'visible'`, an immediate check executes and the 30-second interval resumes.
4. **Manual Trigger:** Clicking the "Check Now" button inside the diagnostics popover immediately initiates an out-of-band probe.

---

## 4. Header Health Indicator & Diagnostics Popover DOM Structure

```html
<div class="health-indicator-container">
  <button class="health-indicator-btn" type="button" aria-label="Connection Diagnostics" aria-expanded="false" dir="ltr">
    <span class="health-dot status-connected"></span>
    <span class="health-label">Connected</span>
  </button>

  <div class="health-popover" role="dialog" aria-label="System Diagnostics" style="display: none;">
    <div class="popover-header">
      <h4>System Diagnostics</h4>
      <span class="popover-timestamp">Checked just now</span>
    </div>
    <div class="popover-body">
      <div class="diag-row">
        <span class="diag-label">Ollama Container</span>
        <span class="diag-value diag-status-badge status-connected">Operational</span>
      </div>
      <div class="diag-row">
        <span class="diag-label">Round-Trip Latency</span>
        <span class="diag-value diag-latency">14.2 ms</span>
      </div>
      <div class="diag-row">
        <span class="diag-label">Loaded in Memory</span>
        <span class="diag-value diag-models">qwen2.5:7b</span>
      </div>
    </div>
    <div class="popover-footer">
      <button class="btn-diag-refresh" type="button">
        <svg class="i" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5"/></svg>
        <span>Check Now</span>
      </button>
    </div>
  </div>
</div>
```
