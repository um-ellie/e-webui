# Quickstart & Verification Guide: Streaming Render Optimization & Code Polish

**Feature**: `017-streaming-render-code-polish`  
**Date**: 2026-11-14  
**Spec**: [spec.md](spec.md)  
**Data Model**: [data-model.md](data-model.md)  
**Contracts**: [contracts/code-syntax-contract.md](contracts/code-syntax-contract.md), [contracts/render-pipeline-contract.md](contracts/render-pipeline-contract.md)  

This guide provides procedures for validating zero-lag streaming performance, offline code syntax highlighting, smooth reasoning accordions, and dark mode contrast.

---

## 1. Local Workspace Verification (Automated Unit Tests)

Run automated unit tests validating Markdown parsing, syntax highlighting token generation, language alias normalization, and directional isolation:

```bash
python3 -m unittest tests/unit/test_markdown_security.py tests/unit/test_ui_contracts.py -v
```

### Key Automated Checkpoints:
1. **Prism Grammar Resolution:** Validates that `python`, `javascript`, `bash`, `json`, `yaml`, `html`, `css`, `sql` produce distinct token spans (`.token.keyword`, `.token.string`, etc.).
2. **Escaping & Security:** Validates that `<script>` and malicious HTML injected in code fences remain safely escaped and sanitized by DOMPurify.
3. **LTR Isolation:** Verifies that all code containers carry `dir="ltr"` and `unicode-bidi: isolate`.

---

## 2. Interactive Browser Validation Scenarios

Start the local application server:
```bash
python3 app/main.py
```

### Scenario 1: Zero-Lag Streaming Performance & 60 FPS Scroll
1. Open `http://127.0.0.1:8080`.
2. Select a local model and send a prompt that produces a long answer:
   *"Write a comprehensive guide on building REST APIs with Python and FastAPI, including 4 code examples."*
3. While the model is actively streaming tokens at high speed:
   * Grab the scrollbar or use the mouse wheel / trackpad to scroll up and down through earlier paragraphs.
   * Verify that scrolling is fluid and responsive (no hitching, freezing, or locked cursor).
   * Verify that the rose cursor `_` blinks continuously at the end of the text without jumping or disappearing.

### Scenario 2: Offline Code Syntax Highlighting
1. Request code in Python, Bash, and JSON.
2. Inspect the rendered code blocks:
   * Verify that Python keywords (`def`, `return`, `import`) render in rose/purple accent.
   * Verify that strings render in green (`--ok`).
   * Verify that comments render in subtle italic muted text (`--mute`).
   * Verify the top header displays the language badge (e.g. `python`).
3. Click the **"Copy"** button on the code block:
   * Verify the button updates to **"Copied!"** with a checkmark for 2 seconds.
   * Paste into an external editor and verify clean, raw unescaped code.

### Scenario 3: Theme Adaptability (Light & Dark Mode)
1. In the Settings modal under **Appearance**, toggle between **Light Mode** and **Dark Mode**.
2. Observe the code blocks in Dark Mode:
   * Verify that the code container background (`--codebg`) and border (`--line`) stand out clearly against the message card background.
   * Verify that syntax colors adjust to high-contrast tones (bright gold numbers, soft green strings, vibrant rose keywords).

### Scenario 4: Smooth Reasoning Accordion
1. Select a reasoning model (or enable the **Think** toggle) and send a reasoning query.
2. When the response finishes, click the **"Thought for N seconds"** chip:
   * Verify the reasoning block expands and collapses with a smooth, fluid height transition (no instantaneous snap).
