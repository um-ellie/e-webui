# Phase 0 Research: Pastel Design System and Modern UI/UX Overhaul

**Feature**: `specs/024-pastel-modern-ui-enhancements`
**Date**: 2026-11-20
**Status**: Completed

## Overview
This document consolidates research and design decisions for upgrading `e-webui` with a 4-palette pastel theme system, modern frosted glassmorphism micro-interactions, and practical productivity features (hover action dock, empty canvas starter chips, collapsible reasoning card, and session pinning).

---

## Decisions & Technical Rationale

### 1. Multi-Palette Pastel Design System (`[data-palette]` & `[data-theme]`)

- **Decision**: Define a two-tier CSS attribute architecture:
  - `data-theme="light" | "dark"` determines luminance polarity (light alabaster/cream vs. dark slate/charcoal).
  - `data-palette="matcha" | "lavender" | "peach" | "ocean"` controls the color story and accent harmonies.
  - The default palette is `matcha` (retaining and enhancing the beloved Soft Sage & Warm Sand palette).
  - 4 distinct curated palettes:
    1. **Matcha (Sage & Warm Sand)**:
       - Light: Soft sage (`#5fc79b`), warm alabaster sand (`#fff9ef`), peach accent (`#ffe2cc`), rose highlight (`#ff7f9c`).
       - Dark: Deep charcoal-olive (`#1a2420`), slate panel (`#243029`), mint-sage accent (`#4ea880`).
    2. **Lavender (Lavender Breeze & Soft Periwinkle)**:
       - Light: Misty lilac canvas (`#f9f8fe`), pale lavender surfaces (`#ffffff`), soft lilac border (`#e6e1f7`), violet-lavender accent (`#8c7ae6`), periwinkle glow (`rgba(140, 122, 230, 0.2)`).
       - Dark: Velvet charcoal-violet (`#1a1924`), muted amethyst panel (`#232233`), radiant lavender accent (`#a29bfe`).
    3. **Peach (Peach Sorbet & Rose Quartz)**:
       - Light: Warm apricot cream (`#fff7f2`), soft white panel (`#ffffff`), delicate peach border (`#fcdbc8`), coral-peach accent (`#f7826a`), blush glow (`rgba(247, 130, 106, 0.2)`).
       - Dark: Deep warm obsidian (`#241b18`), roasted espresso-taupe panel (`#302522`), warm coral highlight (`#fa9d8b`).
    4. **Ocean (Ocean Mist & Aqua Twilight)**:
       - Light: Crisp sea-mist canvas (`#f2faf9`), pure panel (`#ffffff`), seafoam border (`#d2eeea`), soft teal-aqua accent (`#38ada9`), ocean glow (`rgba(56, 173, 169, 0.2)`).
       - Dark: Abyssal midnight slate (`#152026`), deep marine panel (`#1d2c34`), luminous aqua accent (`#4dd0e1`).
- **Rationale**: Clean CSS custom properties (`--bg`, `--panel`, `--line`, `--tx`, `--accent`, `--tint`, `--glow`) swap instantly with no layout redraws. Combining `data-palette` and `data-theme` allows $4 \times 2 = 8$ beautifully tuned combinations while keeping CSS compact and maintainable.
- **Alternatives Considered**:
  - *Arbitrary HSL color pickers*: High risk of broken contrast ratios and unreadable text.
  - *Separate CSS files for each theme*: Causes network latency, theme switching flash (FOUT), and build pipeline bloat.

### 2. Glassmorphism & Micro-Interactions Architecture

- **Decision**: Implement modern frosted glass panels using `backdrop-filter: blur(16px)` with solid/semi-opaque fallbacks for unsupported environments.
  - Apply to: Top header bar (`header.bar`), floating composer capsule (`#composer`), model selector popovers, and modal sheets.
  - Micro-interactions:
    - Button hover/active: `transform: scale(1.02)` and `transform: scale(0.98)` with `cubic-bezier(0.34, 1.56, 0.64, 1)` spring curves.
    - Soft ambient halo shadows: `box-shadow: 0 10px 30px var(--glow)`.
    - Accessibility: Honor `@media (prefers-reduced-motion: reduce)` by disabling transforms and transitions.
- **Rationale**: Frosted glass provides visual layering and spatial context as chat messages scroll under the header and composer without obstructing awareness.
- **Alternatives Considered**:
  - *Heavy 3D neumorphism*: Poor contrast and dated look.
  - *Completely flat opaque containers*: Lacks modern elegance and visual hierarchy.

### 3. Message Hover Action Dock & Interaction Flow

- **Decision**: Inject a lightweight action toolbar container (`.msg-dock`) into assistant and user message rows.
  - **Assistant message dock items**:
    1. **Copy**: Reads clean markdown/text and copies to navigator.clipboard; icon morphs smoothly from clipboard to checkmark for 1.8s.
    2. **Read Aloud (TTS)**: Triggers existing Kokoro TTS playback with dynamic sound wave indicator (`.audio-wave-anim`).
    3. **Regenerate / Retry**: Re-submits the conversation up to the preceding user prompt.
  - **User message dock items**:
    1. **Edit Prompt**: Copies message text back into the composer capsule and focuses the textarea.
    2. **Copy Text**: Quick one-click copy.
  - Mobile behavior: On touch viewports, dock buttons render cleanly below the message bubble with accessible 44px tap targets.
- **Rationale**: Users constantly want to copy responses, listen to audio, or retry without hunting through menus.
- **Alternatives Considered**:
  - *Right-click context menu*: Hidden discoverability, hostile on mobile devices.
  - *Permanent button row*: Clutters the reading column.

### 4. Empty-State Editorial Canvas & Pastel Prompt Starters

- **Decision**: On an empty canvas (no messages loaded), render 4 editorial starter cards with pastel tints:
  1. **خلاصه‌سازی و تحلیل** (Summarization & Analysis): "نکات کلیدی و چکیده متن زیر را با فرمت بالت پوینت استخراج کن:"
  2. **کدنویسی و حل مسئله** (Coding & Problem Solving): "یک تابع پایتون تمیز، تایپ‌شده و دارای تست بنویس برای:"
  3. **ایده‌پردازی و استراتژی** (Ideation & Brainstorming): "۵ ایده خلاقانه و نوآورانه برای موضوع زیر پیشنهاد بده:"
  4. **ویرایش و بهبود نگارش** (Editing & Writing): "متن زیر را از نظر لحن، گرامر و شیوایی ویراستاری کن:"
  - Clicking any card populates the composer, adjusts textarea height, and focuses the cursor.
- **Rationale**: Eliminates "blank screen anxiety" and guides users directly into high-value interactions.

### 5. Collapsible Reasoning & Thinking Card

- **Decision**: Enhance reasoning/thought tokens (e.g. from DeepSeek R1 or reasoning models) inside an elegant collapsible card (`.thought-box`):
  - Collapsed by default when finished; expanded with live pulse while streaming.
  - Shows an animated pastel gradient shimmer border and live execution timer (`زمان تفکر: ۲.۴ ثانیه`).
  - Toggle button with smooth accordion height transition.
- **Rationale**: Keeps the reading column clean while keeping thought process accessible for inspection.

### 6. Pinned Conversations in IndexedDB

- **Decision**: Extend session storage schema (`db.js`) with an optional `pinned: boolean` property (defaulting to `false`).
  - Add a "Pin/Unpin" toggle in the conversation dropdown menu and hover action.
  - Sidebar renders two groups: "سنجاق‌شده‌ها (Pinned)" and "مکالمات اخیر (Recent)".
  - Backwards-compatible: existing stored chats without `pinned` property treat it as `false`.
- **Rationale**: Solves the frequent frustration of losing important conversations as history grows.
