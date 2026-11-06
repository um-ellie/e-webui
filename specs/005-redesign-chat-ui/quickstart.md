# Quickstart & Verification Guide: Pastel Chat UI & Thinking Mode

**Feature**: `005-redesign-chat-ui`  
**Date**: 2026-11-06  
**Status**: Draft

This guide describes local verification steps for validating the pastel redesign, brand logo, and thinking mode controls.

---

## 1. Prerequisites

- Python 3.11+
- Virtual environment or packages from `requirements.txt`
- (Optional for live inference) Running Ollama instance with at least one model loaded

---

## 2. Running the Application Locally

Start the local FastAPI development server:

```bash
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8080
```

Open a web browser and navigate to:
`http://127.0.0.1:8080`

---

## 3. Verification Scenarios

### Scenario A: Pastel Light Theme & Layout
1. Open `http://127.0.0.1:8080`.
2. Verify page background is soft pastel light blue (`#EBF3FA`).
3. Verify welcome card, prompt pills, and message containers show soft pastel borders and shadows.
4. Verify typography is clean, crisp, and high-contrast (WCAG AA).

### Scenario B: Brand Logo & Blinking Cursor
1. Inspect the top-left logo:
   - `>` must be pastel burgundy/muted red.
   - `~/.E` must be pastel purple/violet.
   - `_` must be pastel purple/violet.
2. Confirm the underscore `_` pulses/blinks steadily at 1-second intervals.
3. Confirm that during the blink, `~/.E` remains rock solid with zero layout shift or vertical jump.

### Scenario C: Theme Switcher (Light / Dark)
1. Click the theme switcher button (Sun / Moon) in the header.
2. Verify the page transitions smoothly to the Dark Pastel Navy theme (`#191F2D` background, pastel lavender highlights).
3. Reload the page (`F5`).
4. Verify the Dark theme persists across reload.
5. Click the theme switcher again to return to Light Pastel Blue mode.

### Scenario D: Thinking Mode Toggle
1. Locate the "Thinking" toggle button in the header toolbar.
2. Verify it displays active state by default.
3. Send a prompt to a reasoning model (or simulated SSE stream):
   - With Thinking ON: The thought process appears inside a pastel-styled collapsible accordion (`Thinking Process`) with live cursor, followed by the answer.
4. Click the "Thinking" toggle to turn it OFF.
5. Submit another prompt:
   - With Thinking OFF: Only the final answer renders; no thinking box appears.
6. Refresh the page; verify the Thinking toggle remembers its last state from `localStorage`.

### Scenario E: Mobile Viewport Verification
1. Open browser DevTools and switch to Mobile Device mode (375px width).
2. Confirm header elements wrap or resize without overflowing the viewport.
3. Confirm prompt input and send button remain fully functional and easily tappable.
