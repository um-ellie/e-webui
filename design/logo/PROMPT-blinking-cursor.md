# Prompt: blinking "_" cursor in the Ellie logo

Copy everything below the line and give it to your coding agent.
Attach (or point the agent to) the `ellie-logo-kit/` folder.

---

## Task

Use my logo in this project. The logo is a terminal-style wordmark: `> ~/.E _`
The final `_` is a terminal cursor and **must blink**. Everything else in the logo stays still.

## Source of truth

- Do **not** redraw, retrace, retype or "improve" the logo. Use the files in `ellie-logo-kit/svg/`.
- Do not change colors, proportions, spacing or the viewBox.
- Colors: rose `#AD3960` (the `>`), purple `#6A4892` (everything else), pastel background `#E6F4FB`.
  Dark-mode colors: rose `#E5779B`, purple `#B79DE0`, background `#17132A`. Tokens are in `brand-tokens.css`.

## Blink specification

1. Animate **only** the underscore element (`<rect class="logo-cursor">`). No other part moves.
2. Hard on/off like a real terminal cursor. **No fade, no ease.**
   Use `animation: logo-blink 1.06s step-end infinite` (530 ms visible, 530 ms hidden).
3. Animate `opacity`, never `display` or `visibility`, so the layout does not shift.
4. Respect `prefers-reduced-motion: reduce`: show the cursor solid, no animation.
5. The cursor must be visible in the very first frame (start at `opacity: 1`).
6. The blink must not require JavaScript.

```css
.logo-cursor { animation: logo-blink 1.06s step-end infinite; }
@keyframes logo-blink {
  0%   { opacity: 1; }
  50%  { opacity: 0; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .logo-cursor { animation: none; }
}
```

## Which file to use where

| Situation | Use |
|---|---|
| Web page, theme follows the OS (light/dark) | `svg/logo-animated.svg` via `<img>` (blink works inside `<img>`) |
| Web page with its own theme toggle, or colors controlled by CSS | Inline SVG below + `brand-tokens.css` |
| README / GitHub / docs | `svg/logo-animated.svg` (or `animated/logo-blink.gif` where SVG is not allowed) |
| Chat / Slack / Discord / places that only accept images | `animated/logo-blink.gif` (light) or `animated/logo-blink-dark.gif` |
| Email, PDF, slides, print, OG image, favicon, app icon | **Static** files only (`svg/logo.svg`, `png/`, `web/`, `social/`). Do not try to animate these. |

## Inline SVG (themeable, blinking)

Add `brand-tokens.css` to the project (or copy its variables), then:

```html
<svg viewBox="25 21 162 48" role="img" aria-label="Ellie logo" class="logo"><path d="M33 33H35.2L51 44L35.2 55H33V49.8L43 44L33 38.2Z" fill="var(--logo-rose)"/><path d="M67 45C67 38.5 71.5 36.5 75 41C78 44.8 81 44 81.2 37" fill="none" stroke="var(--logo-purple)" stroke-width="4.6"/><path d="M98 29H104.2L92.2 58.6H86Z" fill="var(--logo-purple)"/><circle cx="116" cy="52.8" r="4.1" fill="var(--logo-purple)"/><path d="M128 30H144.5V35.2H134V40H143.5V45H134V51H144.5V56H128Z" fill="var(--logo-purple)"/><rect class="logo-cursor" x="160" y="56.2" width="19" height="4.8" fill="var(--logo-purple)"/></svg>
```

React / Next.js: put the same SVG in a component, keep `class="logo-cursor"` on the `<rect>`,
and put the CSS block above in a global stylesheet or CSS module. In Tailwind projects, define the
`logo-blink` keyframes under `theme.extend.keyframes` and add an `animation` entry,
or simply paste the CSS block into the global CSS file.

## Accessibility

- Keep `role="img"` and `aria-label="Ellie logo"` on the `<svg>`.
- The blinking element is decorative; do not give it its own label.

## Sizes

- Minimum width of the full logo: 96 px on screen (24 mm in print). Below that, use the compact mark (`svg/mark.svg`, `>E_`).
- Keep clear space around the logo of at least the height of the letter `E` on every side. The SVG files already include a safe margin.
- Place the logo on `#E6F4FB` / white / `#17132A`, or on any background with enough contrast.

## Acceptance checklist

- [ ] The `_` blinks about once per second, hard on/off.
- [ ] Nothing else in the logo animates; layout does not jump.
- [ ] With "reduce motion" enabled, the cursor stays solid.
- [ ] Light and dark themes both show the correct colors.
- [ ] Logo is taken from the kit files, not redrawn.
- [ ] Static contexts (favicon, OG image, email, PDF) use the static versions.
