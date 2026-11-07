# Quickstart & Verification Guide: Claude-Style Chat UI Redesign

**Feature**: `012-chat-ui-redesign`
**Date**: 2026-11-07
**Status**: Ready for Verification

## 1. Overview & Prerequisites

This guide outlines runnable local verification scenarios to validate that the Claude-style chat redesign fulfills all functional requirements and visual criteria without violating project constitution boundaries.

### Prerequisites
- Python 3.11+ virtual environment (`venv`) with dependencies installed (`fastapi`, `uvicorn`, `httpx`, `pytest`).
- Local web browser (Chrome, Firefox, Safari, or Edge).
- Note: In strict compliance with Constitution Principle I, all automated tests use mock harnesses; no connection to real Incus containers is required for verification.

---

## 2. Local Test Execution

Run the existing and extended unit/contract test suites:

```bash
# Run backend contract and security tests
pytest tests/unit/test_markdown_security.py tests/unit/test_validation.py -v
```

Expected Outcome: All security sanitization and contract tests pass with 0 failures.

---

## 3. End-to-End Visual & Interaction Verification Scenarios

### Scenario 1: Visual Comparison Against Reference Mock
1. Open [`design/reference/chat-mock.html`](file:///home/ellie/Documents/Projects/e-webui/design/reference/chat-mock.html) in one browser tab.
2. Start the local development server (or open the rewritten application) in another tab at 1280×800 viewport.
3. Compare layout:
   - Sidebar width (264 px) with brand wordmark `> ~/.E _` featuring the blinking terminal cursor (1.06s cycle).
   - Centered reading column (720 px).
   - User messages formatted as soft rounded bubbles aligned to right (`--user` pastel purple).
   - Assistant replies formatted in Source Serif 4 with zero bubble background.
   - Composer card with 24 px radius, soft shadow, and accessory action row.
4. Toggle dark mode:
   - Verify dark tokens (`--bg: #110E20`, `--card: #1E1936`, `--rose: #E5779B`, `--purple: #B79DE0`).

### Scenario 2: Token Streaming & Stop Generation
1. Type a multi-line query in the composer. Notice smooth expansion up to 8 lines.
2. Press `Enter` to send.
3. Verify assistant reply displays token by token with the blinking rose cursor `_` at the leading edge.
4. Verify the Send button transforms into an active Stop button.
5. Click `Stop` (or press `Esc`). Verify generation halts immediately and the partial response is preserved with Regenerate options.

### Scenario 3: Markdown, Code Blocks & Copy Interaction
1. Provide a prompt that outputs Markdown headings, bullet lists, and a fenced Python/Bash code block.
2. Verify code block displays language label header and a Copy button.
3. Click `Copy` button. Verify visual confirmation ("Copied") and clipboard contents match exact code snippet.
4. Test malicious prompt output containing `<script>alert('xss')</script>`. Verify DOMPurify sanitizes the payload without script execution.

### Scenario 4: Centralized Feature Registry & Future Controls
1. Click the `Attach (+)` button on the composer. Verify tooltip: `"File upload is not available yet"`.
2. Click `Tools` menu. Verify tooltip: `"Tools are not available yet"`.
3. In the sidebar, click `Library` and `Tools`. Verify disabled styling and informative tooltip.
4. Verify zero JavaScript runtime exceptions are thrown in browser console when clicking disabled controls.

### Scenario 5: Persian & Mixed-Language RTL Rendering
1. Submit a Persian query: `سلام، لطفاً یک قطعه کد پایتون بنویسید.`
2. Verify Persian text auto-detects `dir="rtl"` and renders with the local Vazirmatn font.
3. Verify code block embedded in the reply remains strictly `dir="ltr"` with JetBrains Mono.

### Scenario 6: Responsive Layout & Mobile Drawers
1. Resize browser viewport to 360 px width.
2. Verify sidebar transforms into a slide-over mobile drawer opened via header hamburger.
3. Verify zero horizontal scrolling occurs across the whole page.
4. Verify all touch targets measure at least 44×44 px.

### Scenario 7: Keyboard Accessibility
1. Press `Ctrl+K` (or `Cmd+K`): Chat title search input receives focus.
2. Press `Ctrl+Shift+O`: New chat session is created.
3. Press `Ctrl+B`: Sidebar collapses / expands.
4. Press `/`: Focus jumps into the composer textarea.
5. Press `?`: Keyboard shortcuts modal dialog opens.
6. Press `Esc`: Modal dialog closes and focus returns to previously active element.
