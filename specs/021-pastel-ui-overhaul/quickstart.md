# Quickstart: Pastel Design System and UI/UX Overhaul Validation Guide

**Feature**: `021-pastel-ui-overhaul`  
**Purpose**: Step-by-step validation guide to verify the UI/UX redesign and cleanup end-to-end.  

## Prerequisites

1. Local workspace setup:
   - Modern browser (Chromium, Firefox, or Safari) with DevTools.
   - Python 3 for running unit tests.
2. Verify existing unit test baseline passes:
   ```bash
   python3 -m unittest discover tests/unit
   ```

---

## Validation Scenario 1: Soft Pastel Theme Switching & WCAG Contrast

1. Open the application in your browser (`http://localhost:8000` or local test server).
2. Open Settings via the gear icon or shortcut.
3. In the **Appearance** tab:
   - Select **Dark Mode**. Verify:
     - Backgrounds transition to deep muted slate/charcoal-lavender (`#14121E` canvas, `#201C31` cards).
     - Accent elements (links, active tabs, buttons) display soft lavender, mint, and periwinkle tints.
     - Text readability is crisp and clear with no harsh neon saturation.
   - Select **Light Mode**. Verify:
     - Backgrounds transition to warm alabaster/cream (`#FAF8F5` canvas, `#FFFFFF` cards, `#F3EFEA` sidebar).
     - Subtle pastel borders and gentle shadows are visible.
4. Using browser accessibility tools or DevTools Lighthouse/Contrast inspector, verify text contrast ratios:
   - Body text against surface exceeds 4.5:1.
   - Secondary text (`--mute`) against surface exceeds 4.5:1.

---

## Validation Scenario 2: Absence of "Interface Language" & Preserved Per-Message RTL

1. Open the Settings modal.
2. Inspect the **General** and **Appearance** tabs.
   - Confirm **Interface Language** dropdown is completely absent.
   - Confirm no dead or empty selector blocks remain.
3. Send a message in English:
   - `"Explain the theory of relativity briefly."`
   - Confirm the message bubble aligns left (LTR).
4. Send a message containing Persian or Arabic text:
   - `"سلام! یک برنامه ساده پایتون برای من بنویس."`
   - Confirm the message bubble automatically detects RTL, applies right alignment and `font-fa`, while sidebar and header navigation remain in normal interface direction.

---

## Validation Scenario 3: Responsive Composer & Model Selector on Mobile Viewports

1. Open browser DevTools and switch to responsive device mode (set viewport width to 360px).
2. In the composer area:
   - Tap the Model Picker button (`#mp`).
   - Confirm the dropdown popover opens cleanly, does not clip off the right edge of the screen, and fits within the 360px viewport width.
   - Search for a model in the filter input and select a model.
   - Verify selection updates the active model label and closes cleanly.
3. Test composer auto-growth:
   - Paste a 6-line prompt into the textarea.
   - Confirm the composer expands upward smoothly without jitter or hiding the Send button.

---

## Validation Scenario 4: Reasoning Thought Accordion & Code Block Copy Feedback

1. Submit a prompt to a reasoning model (or simulated response containing `<think>...</think>`).
2. When the reasoning block renders:
   - Click the thought chip to toggle open/closed.
   - Observe the smooth height transition powered by `grid-template-rows`.
   - Toggle operating system / browser "prefers-reduced-motion" simulation in DevTools and confirm accordion transitions instantly without animation.
3. In a code block response:
   - Confirm distinct pastel header chrome and language badge.
   - Click the Copy button in the code header.
   - Confirm button displays an immediate positive state ("Copied!" with check icon) and reverts back after 2 seconds.

---

## Validation Scenario 5: Settings Functional Parameter Persistence

1. Open Settings and navigate to the **Models** tab.
2. Adjust:
   - Temperature slider/input to `0.4`.
   - Top-P slider/input to `0.85`.
   - Default System Instructions to `"You are a concise expert."`.
3. Close the modal, reload the browser tab, and reopen Settings.
4. Confirm values persist at `0.4`, `0.85`, and `"You are a concise expert."`.
5. Run automated contract validation:
   ```bash
   python3 -m unittest tests/unit/test_ui_contracts.py
   ```
