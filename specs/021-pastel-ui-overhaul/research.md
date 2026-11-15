# Research & Technical Decisions: Pastel Design System and UI/UX Overhaul

**Feature**: `021-pastel-ui-overhaul`  
**Status**: Completed  
**Date**: 2026-11-15  

## 1. Soft Pastel Color System & Token Architecture

### Context & Problem
The current UI uses high-contrast purple/rose tokens (`--rose: #AD3960`, `--purple: #6A4892` in light mode; `--rose: #E5779B`, `--purple: #B79DE0` in dark mode) paired with cold bluish-gray backgrounds (`#F6FBFE` light, `#110E20` dark). The user requested a modern, minimalist, distraction-free aesthetic with a cohesive **soft pastel color palette** for both Dark Mode and Light Mode:
- **Dark Mode**: Cozy muted slate/charcoal-lavender backgrounds paired with soft pastel accents (lavender, mint, peach, periwinkle) maintaining WCAG 2.1 AA contrast without harsh neon saturation.
- **Light Mode**: Warm alabaster/cream surfaces with delicate pastel borders, soft pill badges, and gentle elevation shadows.

### Research & Decisions

#### Decision 1: Dark Mode Palette
- **Backgrounds**:
  - Base canvas (`--bg`): `#14121E` (deep cozy muted charcoal-lavender)
  - Sidebar rail (`--side`): `#181524` (subtly shifted slate-lavender)
  - Surface/Card (`--card`): `#201C31` (calm elevated charcoal surface)
  - Interactive/Hover (`--active`): `#2B2542` (soft pastel tint hover)
  - Border/Divider (`--line`): `#342D4E` (delicate translucent lavender-gray)
- **Typography**:
  - Primary text (`--ink`): `#F2EFF9` (warm crisp off-white, contrast ratio > 12:1 against canvas)
  - Muted secondary text (`--mute`): `#ADA5C3` (soft lavender-gray, contrast ratio > 5.2:1 against canvas, WCAG AA compliant)
- **Soft Pastel Accents**:
  - Lavender Accent (`--pastel-lavender`): `#C4B5FD` (soft wisteria lavender for primary focus, highlights, and icons)
  - Mint Accent (`--pastel-mint`): `#86EFAC` (soft sage-mint for success, online indicators, and copy confirmation)
  - Peach Accent (`--pastel-peach`): `#FCA5A5` / `#FDBA74` (soft warm peach for warnings, badges, and user bubble tints)
  - Periwinkle Accent (`--pastel-periwinkle`): `#93C5FD` (soft periwinkle for model tags and tooltips)
  - Danger/Error (`--danger`): `#F87171` (pastel coral-red, high legibility without neon harshness)

#### Decision 2: Light Mode Palette
- **Backgrounds**:
  - Base canvas (`--bg`): `#FAF8F5` (warm alabaster/cream)
  - Sidebar rail (`--side`): `#F3EFEA` (soft warm linen/cream)
  - Surface/Card (`--card`): `#FFFFFF` (pure crisp card surface)
  - Interactive/Hover (`--active`): `#EFE9E2` (subtle cream-tinted hover)
  - User bubble (`--user`): `#F0EAE1` (soft warm sand-cream)
  - Border/Divider (`--line`): `#E5DDD4` (delicate warm border)
- **Typography**:
  - Primary text (`--ink`): `#282333` (deep slate-plum, contrast ratio > 13:1 against alabaster)
  - Muted secondary text (`--mute`): `#6D667D` (balanced slate-mauve, contrast ratio > 5.5:1 against alabaster)
- **Soft Pastel Accents**:
  - Lavender Accent (`--pastel-lavender`): `#7C5CBF` / `#8B5CF6` (refined pastel amethyst for interactive elements)
  - Mint Accent (`--pastel-mint`): `#15803D` text on `#DCFCE7` pill surface
  - Peach Accent (`--pastel-peach`): `#C2410C` text on `#FFEDD5` pill surface
  - Periwinkle Accent (`--pastel-periwinkle`): `#2563EB` text on `#DBEAFE` pill surface

#### Decision 3: Elevation & Glassmorphism
- Subtle backdrop filters (`backdrop-filter: blur(12px) saturate(180%); -webkit-backdrop-filter: blur(12px);`) applied to floating headers and composers.
- Gentle box shadows: `0 4px 20px -2px rgba(24, 18, 43, 0.06)` in light mode; `0 6px 24px -2px rgba(0, 0, 0, 0.4)` in dark mode.

---

## 2. Interface Language Removal & RTL Isolation

### Context & Problem
The user explicitly requested:
- Locate the **Interface Language** setting in the Settings modal (`index.html`, `settings.js`, `store.js`, `features.js`, and any related CSS or state logic).
- **Completely remove** this UI section along with all dead code, event listeners, state properties, and references it introduced.
- Preserve automatic RTL/LTR text-direction detection per message, as that is separate from the UI language selector.

### Audit Findings
1. `app/static/index.html`: Contains `<div class="settings-group"><label for="setting-language">Interface Language</label><select id="setting-language">...</div>`.
2. `app/static/js/components/settings.js`: Contains `this.langSelect = backdropElement.querySelector('#setting-language');` and an event listener that set `document.documentElement.setAttribute('dir', ...);`.
3. `app/static/js/i18n.js`: Was created as an unimported dictionary containing English and Persian strings. It is completely unused by the active app components.
4. `app/static/js/rtl.js`: Contains `applyDirectionToElement(element, text)` which scans the first strong directional character of individual message text, assigns `dir="rtl"` or `dir="ltr"` and toggles `.font-fa` locally on the message bubble.
5. `app/static/js/components/chat.js`: Uses `applyDirectionToElement()` locally on user/assistant messages.

### Decision
- Remove the `#setting-language` DOM group from `index.html`.
- Remove `this.langSelect` and its event handler from `settings.js`.
- Remove dead `i18n.js` module or remove unused language exports so no dead weight remains.
- Verify `rtl.js` functions identically for individual chat messages without needing any global interface language attribute.

---

## 3. Viewport-Adaptive Popovers & Mobile Composer Fluidity

### Context & Problem
On viewports under 600px (e.g. mobile phones at 360px-390px width or narrow side-by-side windows), the model picker popover (`#pop`) and inference parameters popover (`#params-popover`) have fixed widths (340px-400px) and absolute positioning (`right: 0`), causing right-edge clipping or page overflowing.

### Decision
- In CSS, replace rigid pixel widths with responsive bounds:
  ```css
  .pop, .params-popover {
    width: min(340px, calc(100vw - 32px));
    max-width: calc(100vw - 32px);
    right: 0;
  }
  @media (max-width: 640px) {
    .pop, .params-popover {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      bottom: calc(100% + 12px);
      width: calc(100vw - 24px);
    }
  }
  ```
- Ensure z-index layering (`z-index: 100`) and safe-area margins.
- Auto-expanding textarea: Ensure `composer-input` uses `max-height: 220px`, `resize: none`, and dynamic `scrollHeight` calculation with smooth scrolling behavior.

---

## 4. Smooth Collapsible Thought Accordions

### Context & Problem
Collapsible reasoning thought blocks currently toggle `.thought-content.open`. While `grid-template-rows: 0fr -> 1fr` is used in CSS, transitions can feel jumpy if margins, paddings, or opacity are out of sync with the height interpolation.

### Decision
- Structure the thought accordion using a rigid 2-element pattern:
  - Outer container: `display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.24s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease; opacity: 0;`
  - Inner wrapper: `overflow: hidden; padding-top: ...; padding-bottom: ...;`
  - When `.open`: `grid-template-rows: 1fr; opacity: 1;`
- Honor `@media (prefers-reduced-motion: reduce)`: set `transition: none !important; grid-template-rows: 1fr; opacity: 1;`.

---

## 5. Code Block Chrome & Syntax Highlighting

### Context & Problem
Code blocks need distinct pastel-tinted headers, clear language badges, copy feedback ("Copied!" with check icon), and clean borders distinguishing the code surface from message bubbles.

### Decision
- **Header**: Pastel tinted (`--codehead`), subtle border separator (`--line`).
- **Badge**: Monospace, uppercase/lowercase pill badge with soft lavender/mint tone.
- **Copy Button**: Micro-interaction that transforms to green/mint state with a checkmark SVG and text "Copied!" for 2000ms.
- **Prism Syntax Highlighting**: Soft pastel tokens for keywords (`--token-keyword: #F472B6` / `#C084FC`), strings (`--token-string: #86EFAC` / `#15803D`), functions (`--token-function: #93C5FD` / `#6366F1`), and comments (`--token-comment: #948BAE`).

---

## 6. Settings Modal Cleanup & Functional Wiring

### Context & Problem
The Settings modal had:
- Obsolete Interface Language dropdown in the General tab.
- Disconnected or partially bound controls.

### Decision
- **General Tab**:
  - Focus cleanly on Data Management (Clear all conversations, reset storage).
  - Add quick app preferences if needed or keep clean and focused.
- **Appearance Tab**:
  - Color Theme selector: System, Light, Dark.
  - Font Size selector: Compact, Default, Spacious.
- **Models Tab**:
  - Temperature slider/number input (0.0 to 2.0).
  - Top-P slider/number input (0.0 to 1.0).
  - Default System Prompt textarea.
  - Ensure immediate synchronization with `store` active session and persistent settings.
- Remove all non-functional placeholder toggles.
