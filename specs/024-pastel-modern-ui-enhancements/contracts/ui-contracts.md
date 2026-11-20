# UI & Styling Contracts: Pastel Design System and Modern UI/UX

**Feature**: `specs/024-pastel-modern-ui-enhancements`
**Date**: 2026-11-20

## 1. CSS Custom Properties Contract

Every pastel theme MUST define the following complete set of CSS variables on `[data-palette="..."][data-theme="..."]`:

| Variable | Description | Contrast / Accessibility Rule |
|----------|-------------|-------------------------------|
| `--bg` | Root background color | Canvas baseline |
| `--panel` | Elevated card/modal/bubble background | Distinct from `--bg` |
| `--side` | Sidebar background | Subtle distinction from canvas |
| `--line` | Border color for cards & inputs | Minimum 1.5:1 against adjacent surface |
| `--tx` | Primary text | Minimum 4.5:1 against `--bg` and `--panel` |
| `--mu` | Muted secondary text | Minimum 3.0:1 against surfaces |
| `--sage` / `--accent` | Primary theme accent color | Distinct identifiable pastel color |
| `--sd` / `--accent-dark` | Deep tone for accent text/solid buttons | Minimum 4.5:1 on light tints |
| `--tint` | 10–15% soft background wash | Subtle tint for active chips & tags |
| `--peach` | Warm secondary pastel tone | Used for user message bubbles / warnings |
| `--rose` | Vibrant pink/coral micro-accent | Used for badges, cursor, live pins |
| `--glow` | RGBA color string for ambient shadows | Diffuse ambient elevation (opacity 0.10–0.18) |
| `--blur-glass` | Blur radius for frosted elements | Default: `16px` |

### Palette Token Matrix

```css
/* Matcha (Default) */
[data-palette="matcha"][data-theme="light"] {
  --bg: #fff9ef; --panel: #fffefb; --side: #fdeedb; --line: #f1dfc5;
  --tx: #2c3a33; --mu: #5d6a5c; --sage: #5fc79b; --sd: #1b7552;
  --tint: #d6f3e4; --peach: #ffe2cc; --rose: #ff7f9c;
  --glow: rgba(95, 199, 155, 0.16);
}
[data-palette="matcha"][data-theme="dark"] {
  --bg: #1a2420; --panel: #243029; --side: #161f1c; --line: #2e3e35;
  --tx: #e7efe9; --mu: #96a99d; --sage: #4ea880; --sd: #6ee7b7;
  --tint: #1c382b; --peach: #362923; --rose: #ff7f9c;
  --glow: rgba(78, 168, 128, 0.22);
}

/* Lavender */
[data-palette="lavender"][data-theme="light"] {
  --bg: #f9f8fe; --panel: #ffffff; --side: #f2effc; --line: #e4ddfa;
  --tx: #2e2842; --mu: #655d7e; --sage: #8c7ae6; --sd: #574b90;
  --tint: #ece8fc; --peach: #fedfe8; --rose: #f368e0;
  --glow: rgba(140, 122, 230, 0.16);
}
[data-palette="lavender"][data-theme="dark"] {
  --bg: #1a1924; --panel: #242233; --side: #15141f; --line: #322f47;
  --tx: #f0eef8; --mu: #9e96b8; --sage: #a29bfe; --sd: #c8c4ff;
  --tint: #2d2945; --peach: #3b2735; --rose: #f368e0;
  --glow: rgba(162, 155, 254, 0.22);
}

/* Peach */
[data-palette="peach"][data-theme="light"] {
  --bg: #fff8f4; --panel: #ffffff; --side: #fef0e7; --line: #fcdbc8;
  --tx: #3c2923; --mu: #7c5f55; --sage: #f7826a; --sd: #c04e37;
  --tint: #ffeae2; --peach: #fed8c7; --rose: #ff5252;
  --glow: rgba(247, 130, 106, 0.16);
}
[data-palette="peach"][data-theme="dark"] {
  --bg: #241b18; --panel: #302522; --side: #1c1513; --line: #42322e;
  --tx: #f8eee9; --mu: #b39a91; --sage: #fa9d8b; --sd: #fec0b3;
  --tint: #402720; --peach: #3b2823; --rose: #ff6b6b;
  --glow: rgba(250, 157, 139, 0.22);
}

/* Ocean */
[data-palette="ocean"][data-theme="light"] {
  --bg: #f2faf9; --panel: #ffffff; --side: #e6f6f4; --line: #d0eeeb;
  --tx: #1e3332; --mu: #507170; --sage: #38ada9; --sd: #079992;
  --tint: #e0f5f3; --peach: #fedac9; --rose: #e55039;
  --glow: rgba(56, 173, 169, 0.16);
}
[data-palette="ocean"][data-theme="dark"] {
  --bg: #152026; --panel: #1d2c34; --side: #111a1f; --line: #283c47;
  --tx: #e7f2f4; --mu: #89a8af; --sage: #4dd0e1; --sd: #80deea;
  --tint: #1b3842; --peach: #3a2a22; --rose: #ff7675;
  --glow: rgba(77, 208, 225, 0.22);
}
```

## 2. Storage Contract

| Key | Storage Type | Allowed Values | Default | Purpose |
|-----|--------------|----------------|---------|---------|
| `ewebui_palette` | `localStorage` | `'matcha' \| 'lavender' \| 'peach' \| 'ocean'` | `'matcha'` | Active pastel color palette |
| `ewebui_theme` | `localStorage` | `'system' \| 'light' \| 'dark'` | `'system'` | Active luminance theme |
| `ewebui_font_scale` | `localStorage` | `90..120` | `100` | Base typography scaling (%) |
| `ewebui_chats` | `IndexedDB` (v2) | Store of `ChatSession` objects | `[]` | Chat persistence including `pinned` flag |

## 3. DOM & Component Contract

### Frosted Glass Surfaces
```html
<!-- Floating Header -->
<header class="bar" style="backdrop-filter: blur(var(--blur-glass)); -webkit-backdrop-filter: blur(var(--blur-glass));">
  ...
</header>

<!-- Floating Composer Capsule -->
<form id="composer" class="composer-capsule" style="backdrop-filter: blur(var(--blur-glass));">
  ...
</form>
```

### Message Action Toolbar (`.msg-dock`)
```html
<div class="msg-dock" role="toolbar" aria-label="Message Actions">
  <button type="button" class="dock-btn" data-action="copy" title="Copy message">
    <svg class="icon"><use href="#clip"/></svg>
  </button>
  <button type="button" class="dock-btn" data-action="tts" title="Read aloud">
    <svg class="icon"><use href="#mic"/></svg>
  </button>
  <button type="button" class="dock-btn" data-action="retry" title="Regenerate response">
    <svg class="icon"><use href="#act"/></svg>
  </button>
</div>
```

### Collapsible Thinking Process Box (`.thought-box`)
```html
<details class="thought-box" open>
  <summary class="thought-summary">
    <span class="thought-badge">
      <span class="pulse-dot"></span>
      <span class="thought-label">Thinking Process</span>
      <span class="thought-time">2.4s</span>
    </span>
    <svg class="icon chev"><use href="#chev"/></svg>
  </summary>
  <div class="thought-content">
    ... reasoning stream ...
  </div>
</details>
```
