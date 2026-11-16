# Research & Technical Decisions: Modern AI Chat & Ollama Connection UI/UX Overhaul

**Feature**: `022-modern-ai-chat-ux`  
**Date**: 2026-11-16  
**Status**: Completed  

## 1. CSS Architecture & Token System (Soft Sage & Warm Sand)

### Decision
Implement the design token architecture provided by `reference-design.html` directly into `app/static/style.css` without third-party utility frameworks (Tailwind/Bootstrap). Map CSS variables to semantic tokens for both `:root` (light) and `[data-theme="dark"]`:
- **Light Tokens**: `--bg: #fff9ef`, `--panel: #fffefb`, `--side: #fdeedb`, `--line: #f1dfc5`, `--tx: #2c3a33`, `--mu: #5d6a5c`, `--sage: #5fc79b`, `--sd: #1b7552`, `--tint: #d6f3e4`, `--peach: #ffe2cc`, `--rose: #ff7f9c`, `--danger: #d2354f`, `--btn: #25996d`.
- **Dark Tokens**: `--bg: #1a2420`, `--panel: #243029`, `--side: #141c18`, `--line: #37493f`, `--tx: #eef6ef`, `--mu: #aabdb1`, `--sage: #7fd8b0`, `--sd: #9ceac6`, `--tint: #2b4a3c`, `--peach: #4b3b33`, `--rose: #ff9db5`, `--danger: #ff8d99`, `--btn: #8fe4be`.
- **Typography Tokens**: Body `--f: Inter, system-ui, "Vazirmatn", sans-serif`, Serif `--s: "Source Serif 4", Georgia, serif`, Mono `--m: "JetBrains Mono", ui-monospace, monospace`.
- **Ambient Canvas Glow**: Radial gradients in `main::before` (`var(--g1)` rose ambient top-right, `var(--g2)` sage ambient bottom-left).

### Rationale
- Pure CSS variables give instantaneous runtime theme switching with zero runtime CSS-in-JS overhead.
- All fonts are already self-hosted locally in `/static/fonts/`.
- Contrast calculations confirm WCAG AA compliance (text contrast against backgrounds > 4.5:1; interactive icons > 3:1).

### Alternatives Considered
- *Tailwind CSS CDN*: Rejected because e-webui runs in offline/airgapped container environments without external CDN access.
- *Preserving legacy `--pastel-*` token names*: Rejected; user explicitly mandated a ground-up redesign without carrying over legacy navy/purple tokens.

---

## 2. Health Telemetry & Single Source of Truth (`NormalizedHealthState`)

### Decision
Establish a dedicated client module (`app/static/js/health.js`) implementing `normalizeHealth(raw)` and `setConn(state, latencyMs)`:
- Maps backend `/api/health` response (`status: "ok"`, `ollama_connected: true/false`, `latency_ms`, `loaded_models`) into 4 canonical states:
  - `online`: `status === "ok" && ollama_connected === true && latency_ms < 500`
  - `degraded`: `status === "ok" && ollama_connected === true && latency_ms >= 500`
  - `offline`: `!ollama_connected || status === "disconnected"`
  - `checking`: In-flight probe.
- Distinct non-color signals:
  - Online: Activity waveform icon (`#act`), green dot, latency text.
  - Degraded: Warning indicator, amber dot, latency text.
  - Offline: Slashed icon, red square, "Offline" text.
  - Checking: Animated spinning ring.
- Tab visibility awareness: `document.addEventListener('visibilitychange')` pauses interval polling when hidden and fires an immediate check when visible.
- Resolves the root cause mismatch by removing the header pill completely and handling `/api/health` through this single normalizer.

### Rationale
- Prevents UI components from having independent, conflicting interpretations of backend health data.
- Ensures accessibility (WCAG AA) by coupling distinct icon shapes and labels with color states.

### Alternatives Considered
- *WebSocket heartbeat*: Rejected because backend already operates on standard REST `/api/health` with low overhead (2.6ms ping).

---

## 3. Flash-Free Theme Hydration (Pre-First-Paint Execution)

### Decision
Inject a tiny synchronous execution script directly inside `<head>` in `app/static/index.html` before any CSS renders:
```html
<script>
  (function(){
    try {
      var m = localStorage.getItem('theme') || 'system';
      var dark = m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    } catch(e) {}
  })();
</script>
```
The header segmented control (`[data-seg]`) and Settings theme selector listen to a unified `themeManager` that writes to `localStorage` and updates `document.documentElement.dataset.theme`.

### Rationale
- Completely eliminates "flash of wrong theme" (FOWT) on page reloads.
- Seamlessly respects OS theme updates via `matchMedia.addEventListener('change')` when set to `system`.

### Alternatives Considered
- *Cookie-based SSR theme*: Rejected because e-webui serves a static `index.html` with client-side JavaScript.

---

## 4. Contextual Clean Capsule Composer Architecture

### Decision
Refactor `app/static/js/components/composer.js` into a state-driven contextual capsule:
- **Resting State**: Large rounded `.cap` with textarea (auto-growing up to 200px), single circular `+` button (`#plus`), subtle embedded mic (`#mic`), model chip (`#mc` with model name and chevron), and circular Send button (`.go#go`).
- **Quick-Action Menu (`#ppop`)**: Clicking `+` opens an upward popover containing:
  - Attach file trigger
  - Tools menu toggle
  - Think toggle switch (`#thinkbtn`)
  - Persona/Sampling Presets (`Balanced · 0.7`, `Precise · 0.3`, `Creative · 1.0`)
- **Transient Dismissal Chips (`#chips`)**:
  - `Think` chip appears above the textarea ONLY when Think is ON. Clicking its `x` turns Think OFF.
  - `Preset` chip appears ONLY when a non-default preset is selected. Clicking its `x` resets to Balanced.
  - Disappears completely in default resting state.
- **Button Morphing**: `.go` dynamically swaps between `#send` (up-arrow) and `#stop` (square stop icon) based on `store.isStreaming`.

### Rationale
- Declutters the reading stage while keeping every action accessible in at most 2 clicks.
- Guarantees complete functional parity with the existing prompt parameter and tool options.

---

## 5. Task-Centric 3-Pane Settings Dialog

### Decision
Refactor `app/static/js/components/settings.js` to match the 3-pane architecture:
- Modal overlay `#ov` with large rounded dialog `.dlg` (desktop left-rail `#nav`, mobile top segmented tabs).
- **Pane 1: Workspace (`#p1`)**:
  - Theme segmented control (`Light`, `Dark`, `System`)
  - Interface font size slider (`#fsr`, 90% - 120%)
  - Keyboard shortcuts accordion (`details.sc`), collapsed by default.
- **Pane 2: Model (`#p2`)**:
  - Default Temperature slider (`#tr`, 0.0 - 2.0) with live badge (`#tv`)
  - Default Top-P slider (`#pr`, 0.0 - 1.0) with live badge (`#pv`)
  - Default system instructions textarea
- **Pane 3: Data & System (`#p3`)**:
  - System metadata (Version, Storage engine, Ollama backend)
  - Visual divider and Danger Zone (`.dz`) with two-step confirmation button (`#del`: "Delete all conversations" -> "Yes, delete everything" within 4s timeout).

### Rationale
- Eliminates the half-empty legacy tabs and structures settings into intuitive tasks.
- Prevents accidental chat deletions with a bulletproof two-step state check.

---

## 6. End-to-End Automated Browser Testing Strategy

### Decision
Author an automated Node.js browser verification script (`tests/e2e-ui-validation.js` using Puppeteer / Playwright) runnable inside the workspace or targeting the container `http://127.0.0.1:8080`:
- **Scenario 1**: Theme switching (Light, Dark, System) and `localStorage` persistence.
- **Scenario 2**: Asymmetric empty state rendering and transition on first message.
- **Scenario 3**: Connection capsule footer status, upward diagnostics popover, and Reconnect click.
- **Scenario 4**: Contextual composer `+` menu open/close, Think chip toggle, and Preset selection.
- **Scenario 5**: Real inference streaming (SSE tokens from Ollama `qwen3.5:4b`) and Send/Stop button morphing.
- **Scenario 6**: Code block syntax rendering and clipboard copy confirmation checkmark.
- **Scenario 7**: Settings modal 3-pane navigation, slider adjustments, and two-step clear chats cancel/confirm.
- **Scenario 8**: Speech synthesis trigger on assistant message.

### Rationale
- Satisfies requirement SC-008 and ensures every inventory item is marked `runtime-tested`.
