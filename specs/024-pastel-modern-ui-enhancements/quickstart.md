# Quickstart & Verification Guide: Pastel Design System & Modern UI/UX

**Feature**: `specs/024-pastel-modern-ui-enhancements`
**Date**: 2026-11-20

## Overview
This guide provides step-by-step instructions for testing and validating the 4-palette pastel theme system, modern glassmorphism styling, and productivity interactions locally in the workspace.

---

## 1. Prerequisites
- Python 3.11+ installed.
- Modern browser (Chrome / Edge / Firefox / Safari).
- Workspace dependencies installed (`pip install -r requirements.txt`).

---

## 2. Launch Local Development Server

Run the local development server on port 8000:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open your browser to: `http://127.0.0.1:8000`

---

## 3. End-to-End Validation Scenarios

### Scenario 1: Multi-Palette Switching & Persistence
1. Open the application in browser.
2. Open Settings (`Ctrl+,` or click gear icon).
3. Under the **Appearance / Workspace** tab, view the new "Pastel Palette" selector:
   - Select **Lavender Breeze**. Observe that all surfaces immediately transition to soft lavender, misty violet borders, and periwinkle glow.
   - Select **Peach Sorbet**. Observe immediate transition to warm apricot cream, delicate peach lines, and rose quartz glow.
   - Select **Ocean Mist**. Observe immediate transition to crisp seafoam, teal accents, and aqua glow.
   - Select **Matcha & Sand**. Return to organic sage & sand.
4. Toggle between **Light Mode** and **Dark Mode** on each palette:
   - Verify dark mode preserves the palette's hue family (charcoal-lavender, warm obsidian-peach, deep marine, charcoal-olive).
   - Check contrast of body text using browser inspector (must be ≥ 4.5:1).
5. Refresh the page (`F5` or `Ctrl+R`):
   - Confirm the selected palette and mode are applied instantly before first paint with **zero flicker (no FOUT)**.

### Scenario 2: Frosted Glassmorphism & Scrolling
1. Send 5–10 messages or generate a long response to create a scrollable chat thread.
2. Scroll up and down:
   - Observe message cards gliding smoothly beneath the top header (`header.bar`) and above the composer capsule (`#composer`).
   - Verify translucent blur effect (`backdrop-filter: blur(16px)`).
   - Check FPS using Chrome DevTools Rendering panel (target: 60fps).

### Scenario 3: Empty-State Editorial Prompt Starters
1. Click the "New Chat" button (`+` in sidebar or `Ctrl+Shift+O`).
2. Observe the empty canvas:
   - Verify 4 pastel starter cards appear with category tags and icons:
     1. خلاصه‌سازی و تحلیل
     2. کدنویسی پایتون
     3. ایده‌پردازی خلاقانه
     4. ویرایش و بهبود متن
3. Click any starter card:
   - Confirm prompt text immediately populates the composer textarea.
   - Confirm textarea height expands automatically and cursor focuses at the end of the text.

### Scenario 4: Message Action Dock (Copy, TTS, Retry)
1. Send a message to receive an AI response.
2. Hover over the assistant response bubble:
   - Verify the floating action dock appears with Copy, Read Aloud, and Retry buttons.
3. Click **Copy**:
   - Verify icon morphs to a checkmark for ~1.8 seconds.
   - Paste clipboard into an editor to confirm clean plain text/markdown is copied.
4. Click **Read Aloud**:
   - Verify speech synthesis triggers with audio-wave indicator.
5. Click **Retry**:
   - Confirm message re-generation starts.

### Scenario 5: Collapsible Thinking Process Card
1. When receiving a model response with `<think>` reasoning tokens:
   - Observe the `.thought-box` with soft pastel gradient border and elapsed seconds counter.
   - Click the header to collapse/expand smoothly.

### Scenario 6: Session Pinning in Sidebar
1. Hover over a conversation session in the sidebar.
2. Click the "Pin" icon / option:
   - Verify the session moves to a dedicated "سنجاق‌شده‌ها (Pinned)" group at the top.
   - Verify the pin state persists after browser reload.

---

## 4. Automated & Static Quality Checks

Run test suites and syntax validations:
```bash
# Run backend pytest suite
pytest -v

# Run static linting / formatting checks
python -m flake8 app tests --max-line-length=120 2>/dev/null || true
```
