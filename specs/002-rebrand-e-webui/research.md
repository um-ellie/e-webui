# Phase 0 Research: Rebranding to e-webui & Brand Logo Architecture

**Feature**: Rebrand to `e-webui` and Brand Logo Integration  
**Date**: 2026-11-05  
**Spec**: [spec.md](./spec.md)

## Summary of Decisions

1. **Rebranding Replacement Strategy**: Longest-first multi-pass case-insensitive replacement with boundary protections for third-party entities and container infrastructure.
2. **Brand Logo Visual & Responsive Architecture**: Vanilla CSS implementation reproducing the reference React/Tailwind visual contract with `--logo-prompt` and `--logo-text`, responsive typography (28px mobile, 34px desktop), and `@media (prefers-reduced-motion: reduce)` pause semantics.
3. **Accessibility & Bidirectional Flow**: Screen reader accessible name `aria-label="e-webui"` with `aria-hidden="true"` on cursor `_`, plus `dir="ltr"` and `unicode-bidi: isolate`.
4. **Infrastructure Isolation Compliance**: Strict segregation of workspace application files vs. container runtime infrastructure.

---

## Decision 1: Application-Wide Rename Pipeline & Exclusions

### Context
The application is being renamed from legacy names (`ellie-ollama-webui`, `Ollama Web UI`, `Web UI`, `webui`) to `e-webui`. A naive replacement can break compound names (e.g. replacing `webui` before `ellie-ollama-webui` produces `ellie-ollama-e-webui`) or corrupt third-party dependencies (like `Open-WebUI` or Ollama API endpoints). Furthermore, Incus container infrastructure names (e.g. container name `webui`, device `webui-proxy`) must not be modified by the agent under Constitution Principle I.

### Decision
Implement the rename using a strictly ordered descending-length replacement sequence across all workspace files:
1. `ellie-ollama-webui` (and separator variants `ellie_ollama_webui`, `ellie ollama webui`) → `e-webui`
2. `Ollama Web UI` (and variants `ollama-webui`, `ollama_webui`, `ollama webui`) → `e-webui`
3. `Web UI` (and variants `web-ui`, `web_ui`) → `e-webui`
4. `webui` (isolated case-insensitive matches) → `e-webui`

### Protection Boundaries (DO NOT RENAME)
- **Third-Party Services**: References to `Open-WebUI` / `open-webui` (e.g., python venv paths or service conflict checks in deploy scripts).
- **Ollama Server & Protocol**: Hostnames, endpoints (`/api/tags`, `/api/generate`), model names, and references to "Ollama" referring specifically to the Ollama backend runtime.
- **Incus Container Infrastructure**: Container name `webui`, proxy devices `webui-proxy`, `ollama-link`, and Incus CLI calls. These are left intact and documented for the user in the hand-off report.

### Service File Renaming
- The workspace systemd template file `app/systemd/ollama-webui.service` is renamed to `app/systemd/e-webui.service`.
- Internal descriptions and identifiers within workspace files are updated to `e-webui`.

---

## Decision 2: Brand Logo Markup & CSS Token Implementation

### Context
The user reference design is from React/Tailwind:
```html
<span className="font-mono text-[28px] sm:text-[34px] font-bold tracking-tight inline-flex items-center select-none" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
  <span style={{ color: 'var(--logo-prompt)' }}>&gt;</span>
  <span className="mx-2" style={{ color: 'var(--logo-text)' }}>~/.E</span>
  <span className="animate-logo-cursor-blink inline-block" style={{ color: 'var(--logo-text)' }} aria-hidden="true">_</span>
</span>
```
The target project uses vanilla HTML5 and CSS3 (no React or Tailwind runtime dependencies).

### Decision
Reproduce identical rendering, metrics, and behavior directly in `app/static/style.css` and `app/static/index.html`:

#### 1. Color Tokens (`:root`)
```css
:root {
  /* Brand Logo Tokens */
  --logo-prompt: #3b82f6; /* Terminal prompt blue */
  --logo-text: #f8fafc;   /* Crisp white/light slate */
}
```
If light mode is introduced in the future, `--logo-prompt` remains `#2563eb` and `--logo-text` becomes `#0f172a`. In the current dark theme, `#3b82f6` and `#f8fafc` ensure high contrast.

#### 2. Typography & Responsive Sizing
- Base font size: `28px` (mobile viewport < 640px).
- Small breakpoint and above (`@media (min-width: 640px)`): `34px`.
- Font stack: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`.
- Spacing: Margin of `0 0.5rem` (`8px`) between `>` and `~/.E`, matching `mx-2`.

#### 3. Cursor Animation & Reduced Motion
```css
@keyframes logo-cursor-blink {
  0%, 49% {
    opacity: 1;
  }
  50%, 100% {
    opacity: 0;
  }
}

.animate-logo-cursor-blink {
  animation: logo-cursor-blink 1s steps(1) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-logo-cursor-blink {
    animation: none !important;
    opacity: 1 !important;
  }
}
```
This guarantees that when reduced motion is preferred, the cursor does not disappear or flicker, but remains statically rendered.

---

## Decision 3: Accessibility & Internationalization (Bidi Isolation)

### Context
The logo text contains punctuation and symbols (`>`, `~`, `.`, `_`) which can flip or render out of order in RTL (Right-to-Left) reading contexts. Furthermore, screen readers reading `_` literally pronounce "underscore", causing noise.

### Decision
1. **Directional Isolation**:
   - `dir="ltr"` attribute explicitly set on the wrapper.
   - `unicode-bidi: isolate;` inline style / CSS rule applied to prevent character reordering in any text direction context.
2. **Assistive Tech Labels**:
   - The root wrapper has `aria-label="e-webui"` and `role="img"`.
   - The blinking cursor span has `aria-hidden="true"` so screen readers ignore the decorative underscore.
3. **Selection**:
   - `user-select: none;` (`select-none`) applied to the logo wrapper to preserve button-like UI chrome ergonomics.

---

## Decision 4: Infrastructure Isolation Hand-off Plan

### Context
Principle I of the Constitution strictly prohibits the agent from executing Incus commands or changing container configurations. The container is named `webui` and proxy device is named `webui-proxy`.

### Decision
1. In workspace files (`scripts/deploy.sh`, `README.md`), distinguish clearly between the application name (`e-webui`) and the Incus container runtime names (`webui`).
2. Provide a dedicated section in documentation instructing the user on how they can manually rename the container or proxy devices if they wish, while keeping scripts functional with defaults.
3. The automated test runner in workspace testing will focus on local Python test suites without requiring container commands.
