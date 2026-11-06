# Research: Chat UI Redesign, Pastel Theme, & Thinking Mode Control

**Feature**: `005-redesign-chat-ui`  
**Date**: 2026-11-06  
**Status**: Completed

## 1. Pastel Theme System & Modern Developer Aesthetic

### Decision
Implement a pure CSS variable-driven design token system rooted in the provided brand visual guide:
- **Light Pastel Blue Palette (Primary Default)**:
  - Base Background: Soft light pastel blue (`#EBF3FA` / `#E5EFF9`)
  - Container / Message Cards: Crisp off-white (`#FFFFFF` / `#F8FAFC`) with subtle pastel borders (`#D6E4F0`) and soft elevation shadow
  - User Message Bubble: Soft pastel violet / lilac (`#E8E0F2` or gradient/solid `#7A5EA7` text or inverted `#6F599C` with high-contrast text `#FFFFFF`)
  - Assistant Message Bubble: Pure white card with delicate pastel border (`#D8E3EE`)
  - Brand Red / Accent: Pastel burgundy/muted red (`#BA4659`)
  - Brand Purple: Pastel purple/violet (`#7A5EA7`)
  - Text Primary: Deep charcoal/slate (`#1E293B`) to ensure strict WCAG AA contrast (ratio > 7:1 against light pastel blue)
- **Dark Pastel Navy Palette (Theme Switcher Option)**:
  - Base Background: Deep navy slate (`#191F2D` / `#1E2536`)
  - Cards / Message Surfaces: Soft dark slate (`#242C3F`)
  - Brand Red: Pastel muted red (`#D25D70`)
  - Brand Purple: Pastel lavender (`#9F8EC7`)
  - Text Primary: Soft pastel white/gray (`#F1F5F9`)
  - Text Secondary: Muted slate (`#94A3B8`)

### Rationale
- Pure CSS custom properties (`:root` and `[data-theme="dark"]`) enable instant, flicker-free switching and zero additional bundle overhead.
- WCAG AA accessibility requires a minimum 4.5:1 contrast for regular text; using deep slate on light pastel backgrounds guarantees readability while retaining the soft pastel aesthetic.

### Alternatives Considered
- *Single Fixed Light Theme*: Rejected because the user selected Option A in Question 2 to provide dual light and dark pastel modes, matching all quadrants of the provided design reference.
- *External CSS Frameworks (Tailwind, Bootstrap)*: Rejected to honor the lightweight, dependency-free vanilla architecture of `e-webui` and keep deployment fast and isolated.

---

## 2. Terminal Brand Logo Implementation (`> ~/.E_`)

### Decision
Implement the brand logo using semantic HTML and precise CSS styling:
```html
<span class="brand-logo" role="img" aria-label="e-webui" dir="ltr">
  <span class="logo-prompt">&gt;</span>
  <span class="logo-text">~/.E</span>
  <span class="logo-cursor" aria-hidden="true">_</span>
</span>
```
- **Styling**:
  - Font: Geometric, clean developer monospace stack (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`).
  - Font size: ~26px–30px mobile, ~32px–34px desktop with baseline alignment (`display: inline-flex; align-items: baseline;`).
  - Colors:
    - Prompt (`>`): `var(--logo-prompt)` (`#BA4659` muted red/burgundy).
    - Path (`~/.E`): `var(--logo-text)` (`#7A5EA7` in light mode, `#9F8EC7` in dark mode).
    - Cursor (`_`): same as `--logo-text`, with CSS keyframe animation `logo-cursor-blink` running steadily (`1s steps(2, start) infinite;` or smooth opacity pulse `1s ease-in-out infinite;`).
  - Accessibility: `prefers-reduced-motion: reduce` stops animation; `aria-label="e-webui"` ensures screen-reader comprehension.

### Rationale
Matches the exact specification and uploaded visual reference down to character tokens, spacing, and non-shifting cursor animation.

### Alternatives Considered
- *Inline SVG or Raster Image*: SVG/raster images are less flexible for responsive typography and theme token switching; semantic HTML with CSS variables offers instant color switching, crisp rendering at all display pixel densities, and zero asset download.

---

## 3. Thinking Mode Dual-Action Architecture

### Decision
Implement a synchronized client-side and backend parameter architecture:
1. **Frontend UI Switch**:
   - A modern toggle switch / button placed in the header toolbar with a distinctive brain/reasoning icon (`💭` or SVG icon) and "Thinking" label.
   - When toggled **ON**:
     - Generation payload sends `"thinking": true`.
     - Streaming SSE chunks with `thinking` content are captured and rendered in a pastel-themed `<details class="thinking-container" open>` accordion.
   - When toggled **OFF**:
     - Generation payload sends `"thinking": false`.
     - Streaming SSE handler suppresses display of thinking blocks (or collapses them completely).
     - Backend forwards `"think": False` to Ollama API for models that support explicit reasoning control (such as Qwen 2.5 / DeepSeek-R1 / Ollama 0.5+ parameters).
     - If the model still returns `<think>` or thinking chunks, `ollama_client` suppresses or filters thinking tokens so that only final response text is returned to the user, saving visual space and token processing.
2. **Persistence**:
   - Both `thinking_enabled` (boolean) and `theme_mode` (`"light"` | `"dark"`) are saved to `localStorage` under `ewebui_prefs`.

### Rationale
Fulfills user preference (Option B from Question 1): users get fast, clean direct answers when thinking is turned off, while preserving deep reasoning inspectability when turned on.

### Alternatives Considered
- *Client-side Only Display Toggle*: Rejected per user decision Q1:B because passing the parameter to the backend allows reasoning models to bypass internal reasoning generation where supported.

---

## 4. Constitution Compliance Review

### Assessment against Constitution Principles
1. **Principle I: Infrastructure Isolation (NON-NEGOTIABLE)**:
   - Does this plan touch Incus containers, profiles, networks, or container commands? **NO.**
   - All code changes are strictly confined to `app/static/` (HTML, CSS, JS), `app/models.py`, `app/services/ollama_client.py`, and `specs/`.
2. **Principle II: Workspace-Only Scope Boundary**:
   - All changes stay within `/home/ellie/Documents/Projects/e-webui`.
3. **Principle III: Transparent Delegation & Manual Execution Hand-offs**:
   - No container restart or deployment is executed automatically. Manual instructions are documented in `quickstart.md`.
