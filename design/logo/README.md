# Ellie Logo Kit

Logo: `> ~/.E _`  (the final `_` is a terminal cursor that blinks on the web)

Everything here was rebuilt as clean vector shapes (no fonts needed) from your original logo, so it
looks the same on every machine and scales to any size.

## Folder map

| Folder / file | What is inside | Use it for |
|---|---|---|
| `svg/logo.svg` | Master logo, transparent, for light backgrounds | Anything on light backgrounds; the file to give to designers |
| `svg/logo-dark.svg` | Master logo, lighter pastel colors, transparent | Dark backgrounds |
| `svg/logo-on-light.svg`, `logo-on-dark.svg` | Logo with its background included | When transparency is not supported |
| `svg/logo-mono-black.svg`, `logo-mono-white.svg` | One-color versions | Print, stamps, embroidery, fax, single-color placements |
| `svg/logo-animated*.svg` | Blinking-cursor versions (`logo-animated.svg` switches light/dark automatically) | Web, README |
| `svg/mark*.svg` | Compact mark `>E_` (transparent) | Small spaces, narrow headers, icons inside UI |
| `svg/icon-app*.svg` | Square app icon with rounded corners | App stores, desktop app icons, docs |
| `png/` | The same logos as PNG: 256 / 512 / 1024 / 2048 px wide | Tools that do not accept SVG (Word, Slides, Notion...) |
| `web/` | `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png`, `site.webmanifest`, `head-snippet.html` | Websites and PWAs |
| `social/` | OG image 1200x630, GitHub social 1280x640, header 1500x500, avatars 400/1024 | Link previews and profiles |
| `animated/` | `logo-blink.gif`, `.webp` (light and dark) | Places that accept only images |
| `brand-tokens.css` | Color variables with automatic dark mode | Websites and apps |
| `PROMPT-blinking-cursor.md` | Ready-to-paste agent prompt for the blinking `_` | Giving instructions to a coding agent |

## Colors

| Name | Light mode | Dark mode |
|---|---|---|
| Rose (`>`) | `#AD3960` | `#E5779B` |
| Purple (`~/.E_`) | `#6A4892` | `#B79DE0` |
| Background | `#E6F4FB` | `#17132A` |
| Mono ink | `#14101F` | `#FFFFFF` |

## Rules of thumb

- Prefer **SVG** whenever the app accepts it. Use **PNG** only when it does not.
- PNG files are transparent except `*-on-light`, `*-on-dark`, app icons, avatars and social images.
- Minimum size of the full logo: 96 px wide on screen. Smaller than that, use the `>E_` mark.
- Clear space: at least the height of the letter `E` around the logo (the SVGs already include a margin).
- Do not stretch, rotate, recolor, add shadows, or put the light-mode logo on a dark background (use `logo-dark`).
- `apple-touch-icon.png` is intentionally square with no rounded corners; iOS rounds it itself.
- `icon-maskable-512.png` keeps the mark inside the safe zone so Android can crop it into any shape.
- The 16 px favicon is tiny by nature. If it ever looks too small, ask the agent to make a favicon with only `>_`.

## Blinking cursor

- On the web: use `svg/logo-animated.svg` or follow `PROMPT-blinking-cursor.md`.
- When an SVG is loaded through `<img>`, light/dark follows the operating system, not your site's toggle.
  If you have your own theme toggle, inline the SVG and use `brand-tokens.css`.
