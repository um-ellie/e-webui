# Interface Contracts: Modern AI Chat & Ollama Connection UI/UX Overhaul

**Feature**: `022-modern-ai-chat-ux`  
**Date**: 2026-11-16  
**Status**: Completed  

## 1. Header Theme Switcher Contract (`[data-seg]`)

### Markup Interface
```html
<div class="seg" role="radiogroup" aria-label="Theme" data-seg style="--i: 0;">
  <button role="radio" data-m="light" aria-checked="false" aria-label="Light" title="Light">
    <svg class="i"><use href="#sun"/></svg>
  </button>
  <button role="radio" data-m="dark" aria-checked="false" aria-label="Dark" title="Dark">
    <svg class="i"><use href="#moon"/></svg>
  </button>
  <button role="radio" data-m="system" aria-checked="true" aria-label="System" title="System">
    <svg class="i"><use href="#mon"/></svg>
  </button>
</div>
```

### Event Contract
- **Keyboard Navigation**:
  - `ArrowLeft` / `ArrowUp`: Selects previous segment in cyclic order.
  - `ArrowRight` / `ArrowDown`: Selects next segment in cyclic order.
  - `Space` / `Enter`: Activates focused segment.
- **State Dispatch**: Updates `document.documentElement.dataset.theme`, persists `localStorage.setItem('theme', mode)`, sets `--i` index variable (`0`, `1`, `2`) for CSS sliding thumb transition.

---

## 2. Sidebar Health & Connection Telemetry Contract

### Footer Capsule Markup
```html
<div class="foot">
  <!-- Diagnostics Popover (Upward) -->
  <div class="pop up" id="cpop" role="dialog" aria-label="Ollama Connection Diagnostics" style="left:0;right:0">
    <div class="kv">
      <span>Status</span><b id="cstate">Operational</b>
      <span>Endpoint</span><b id="cend">127.0.0.1:11434</b>
      <span>Latency</span><b id="clat">2.6 ms</b>
      <span>In memory</span><b id="cmodels">No model loaded</b>
      <span>Checked</span><b id="cts">just now</b>
    </div>
    <hr>
    <button class="it" id="retest"><svg class="i"><use href="#rl"/></svg>Reconnect and test</button>
    <button class="it" data-open="settings"><svg class="i"><use href="#gear"/></svg>Open settings</button>
  </div>

  <!-- Trigger Capsule -->
  <button class="conn st-on" id="conn" aria-haspopup="dialog" aria-expanded="false">
    <span class="dot"></span>
    <svg class="i"><use href="#act"/></svg>
    <span id="clabel">Online</span>
    <small id="cms">2.6 ms</small>
  </button>
  <button class="ic" data-open="settings" aria-label="Settings"><svg class="i"><use href="#gear"/></svg></button>
</div>
```

### State Mapping Contract
| State Enum | Capsule Class | Dot Style | Icon ID | Label Text | Sub-text |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `online` | `.st-on` | Solid green circle | `#act` | `Online` | `{latency} ms` |
| `degraded`| `.st-slow` | Amber pulse circle | `#act` | `Slow` | `{latency} ms` |
| `offline` | `.st-off` | Red square | `#act` | `Offline` | `Unreachable` |
| `checking`| `.st-chk` | Hollow spinning arc | `#act` | `Checking` | `...` |

---

## 3. Contextual Clean Capsule Composer Contract

### Markup Interface
```html
<div class="cwrap">
  <div class="cap">
    <!-- Transient Indicator Chips -->
    <div class="chips" id="chips"></div>

    <!-- Multi-line Textarea -->
    <textarea id="ta" rows="1" placeholder="Message your local model" aria-label="Message"></textarea>
    
    <!-- Embedded Mic Indicator -->
    <button class="mic ic" aria-label="Voice input (coming later)"><svg class="i"><use href="#mic"/></svg></button>

    <!-- Bottom Actions Row -->
    <div class="row">
      <!-- Quick Action '+' Menu -->
      <div style="position:relative">
        <button class="ic" id="plus" aria-label="Add" aria-haspopup="true" aria-expanded="false" style="border:1px solid var(--line);border-radius:50%">
          <svg class="i"><use href="#plus"/></svg>
        </button>
        <div class="pop up" id="ppop" style="left:0">
          <button class="it"><svg class="i"><use href="#clip"/></svg>Attach file</button>
          <button class="it"><svg class="i"><use href="#tool"/></svg>Tools<em>none enabled</em></button>
          <button class="it" id="thinkbtn" aria-pressed="false"><svg class="i"><use href="#bulb"/></svg>Think<span class="sw"></span></button>
          <hr>
          <button class="it" data-preset="Balanced · 0.7"><svg class="i"><use href="#sld"/></svg>Balanced<em>0.7</em></button>
          <button class="it" data-preset="Precise · 0.3"><svg class="i"><use href="#sld"/></svg>Precise<em>0.3</em></button>
          <button class="it" data-preset="Creative · 1.0"><svg class="i"><use href="#sld"/></svg>Creative<em>1.0</em></button>
        </div>
      </div>

      <!-- Model Selector Chip -->
      <div style="position:relative;margin-inline-start:auto">
        <button class="mc" id="mc" aria-haspopup="listbox" aria-expanded="false">
          <span class="mc-name">gemma4:latest</span>
          <svg class="i"><use href="#chev"/></svg>
        </button>
        <div class="pop up" id="mpop" style="right:0">
          <!-- Populated dynamically with model name + size badges -->
        </div>
      </div>

      <!-- Round Morphing Send / Stop Button -->
      <button class="go" id="go" aria-label="Send">
        <svg class="i"><use href="#send"/></svg>
      </button>
    </div>
  </div>
</div>
```

---

## 4. Settings Dialog 3-Pane Contract

### Navigation & Panes
- Tab navigation `button[data-pane="p1|p2|p3"]` sets `aria-selected="true"`.
- Content panes `section[id="p1|p2|p3"]` toggle `hidden` attribute.
- Danger zone button `#del`:
  - 1st click: sets `sure = true`, adds class `.sure`, changes label to `"Yes, delete everything"`.
  - Timeout: resets after 4 seconds to `"Delete all conversations"`.
  - 2nd click: invokes `store.clearAllSessions()`, closes dialog, and transitions canvas to empty state.

---

## 5. Backend HTTP/SSE Contract Parity

All requests continue strictly through the existing backend contract:
- `GET /api/health` -> `HealthResponse` (`status`, `ollama_connected`, `ollama_url`, `latency_ms`, `loaded_models`)
- `GET /api/models` -> `ModelListResponse` (`models: [{name, size, parameter_size, quantization}]`)
- `POST /api/generate` -> `SSE Stream of StreamChunk` (`token`, `thinking`, `status`, `done`, metrics)
- `POST /api/tts/synthesize` -> `audio/wav` binary stream
