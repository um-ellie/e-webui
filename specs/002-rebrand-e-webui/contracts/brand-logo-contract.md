# Interface Contract: Brand Logo & UI Structure

**Feature**: Rebrand to `e-webui` and Brand Logo Integration  
**Date**: 2026-11-05  
**Spec**: [spec.md](../spec.md)

## 1. DOM Markup Contract

The chat interface (`app/static/index.html`) MUST render the brand logo inside `.header-left` matching this contract:

```html
<span
  class="brand-logo"
  role="img"
  aria-label="e-webui"
  dir="ltr"
  style="unicode-bidi: isolate;"
>
  <span class="logo-prompt">&gt;</span>
  <span class="logo-text">~/.E</span>
  <span class="logo-cursor animate-logo-cursor-blink" aria-hidden="true">_</span>
</span>
```

### Hierarchy & Element Specifications:
1. **Root element (`.brand-logo`)**:
   - Tag: `<span>`
   - Attributes:
     - `class="brand-logo"`
     - `role="img"`
     - `aria-label="e-webui"`
     - `dir="ltr"`
     - `style="unicode-bidi: isolate;"`
2. **Prompt element (`.logo-prompt`)**:
   - Tag: `<span>`
   - Content: `&gt;`
   - Styling: Colored via `var(--logo-prompt)`
3. **Brand name element (`.logo-text`)**:
   - Tag: `<span>`
   - Content: `~/.E`
   - Styling: Colored via `var(--logo-text)`, horizontal margin `0 0.5rem` (`mx-2`)
4. **Cursor element (`.logo-cursor`)**:
   - Tag: `<span>`
   - Content: `_`
   - Attributes: `aria-hidden="true"`
   - Classes: `logo-cursor animate-logo-cursor-blink`
   - Styling: Colored via `var(--logo-text)`

---

## 2. CSS Stylesheet Contract

The application stylesheet (`app/static/style.css`) MUST satisfy the following CSS declarations and media queries:

```css
/* Color Tokens */
:root {
  --logo-prompt: #3b82f6;
  --logo-text: #f8fafc;
}

/* Brand Logo Layout and Typography */
.brand-logo {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.05em;
  display: inline-flex;
  align-items: center;
  user-select: none;
  line-height: 1;
}

@media (min-width: 640px) {
  .brand-logo {
    font-size: 34px;
  }
}

.brand-logo .logo-prompt {
  color: var(--logo-prompt);
}

.brand-logo .logo-text {
  color: var(--logo-text);
  margin-left: 0.5rem;
  margin-right: 0.5rem;
}

.brand-logo .logo-cursor {
  color: var(--logo-text);
  display: inline-block;
}

/* Blinking Animation */
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

/* Reduced Motion Override */
@media (prefers-reduced-motion: reduce) {
  .animate-logo-cursor-blink {
    animation: none !important;
    opacity: 1 !important;
  }
}
```

---

## 3. Accessibility Tree Expectations

| Node | Role | Accessible Name | Children Exposed |
|---|---|---|---|
| `.brand-logo` | `img` / `graphics-document` | `"e-webui"` | No (treated as single atomic visual graphic) |
| `.logo-cursor` | generic | (none) | Ignored / hidden via `aria-hidden="true"` |

Screen readers MUST announce the entity as "e-webui, image" (or equivalent) without reading individual punctuation characters or the blinking cursor.

---

## 4. Renaming & Service Unit Contract

1. **Systemd Service Unit**:
   - Source path in workspace: `app/systemd/e-webui.service`
   - Service description: `e-webui`
2. **FastAPI Application Definition**:
   - `FastAPI(title="e-webui", description="...", version="1.0.0")`
   - Logger: `logging.getLogger("e-webui")`
3. **HTML Title**:
   - `<title>e-webui</title>`
