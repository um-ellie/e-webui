# Quickstart & Verification Guide: Chat Connection & Composer Refinements

**Feature**: `013-chat-connection-refinements`
**Date**: 2026-11-07
**Status**: Ready for Verification

## 1. Overview & Verification Scenarios

This guide details runnable local test steps to verify:
1. Streamed model answers appear reliably with thinking extraction and error recovery.
2. Composer model picker resides in the composer bottom-right row per `chat-mock-v2.html`.
3. The send button features the Enter symbol (↵) and the microphone button appears disabled.
4. The sidebar toggle is fully stable across desktop, tablet, and mobile viewports.
5. All empty-state suggestion chips are eliminated.

---

## 2. Automated Test Execution

Run the simulated streaming tests and UI contract suite:

```bash
# Run backend contract and stream parsing tests
python3 -m unittest tests/unit/test_ui_contracts.py tests/unit/test_validation.py tests/unit/test_markdown_security.py
```

Expected Outcome: All contract and security tests pass.

---

## 3. Interactive UI Verification Scenarios

### Scenario 1: Model Reply & Live Streaming
1. Open the application at `http://127.0.0.1:8080`.
2. Type a question in the composer: "Explain why the sky is blue."
3. Press `Enter` (or click Send).
4. Verify within 100 ms:
   - User message bubble renders on the right.
   - Assistant message placeholder appears with blinking rose cursor.
   - If model is cold, "Loading model…" status is displayed.
   - Tokens stream smoothly without layout shifts.
   - Response ends cleanly with model name and generation speed metrics.

### Scenario 2: Reasoning Model Thinking Extraction
1. Select a reasoning-capable model (or mock test stream with `<think>` tags).
2. Submit a prompt.
3. Verify reasoning text is extracted and placed inside the collapsible "Thought for N seconds" chip.
4. Verify final answer displays cleanly below the chip in Source Serif 4.
5. If the model emits *only* reasoning, verify the reasoning displays with an explicit note: "The model returned only reasoning".

### Scenario 3: Error Recovery & Retry
1. Simulate a connection failure (or specify a non-existent model).
2. Verify the assistant turn renders a clear error card detailing the failure category (e.g. "Ollama unreachable" or "Model not found").
3. Verify an immediate **Retry** button is present. Click Retry and confirm request is re-dispatched.

### Scenario 4: Composer Model Picker & Action Controls
1. Inspect the bottom-right corner of the composer card:
   - Model picker pill (`.mp`) with dual-tone gradient glyph, model name, and size tag (e.g. `14b`).
   - Round disabled microphone button (`.mic`) with tooltip "Voice input is not available yet".
   - Round rose send button (`.sendb`) with the Enter symbol (↵).
2. Click the model pill (or press Space/Enter):
   - Upward popover menu opens smoothly above the composer card.
   - List shows models with tags (Reasoning, Loaded) and checkmark on active model.
   - Press `ArrowDown` / `ArrowUp` and `Enter` to switch models.
3. Verify top header bar NO LONGER has a model dropdown.

### Scenario 5: Sidebar Toggle Stability
1. Toggle sidebar closed on desktop via `Ctrl+B` or button.
   - Verify sidebar collapses cleanly into an icon rail displaying the compact `>E_` mark.
   - Verify reading column and composer remain centered at 720 px with zero horizontal page scroll.
2. Toggle sidebar open again; confirm flawless return to 264 px width.
3. Repeat toggle during active token streaming to verify streaming continues without interruption.
4. Test on tablet (768 px) and mobile (360 px) to verify drawer overlay behavior.

### Scenario 6: Suggestion Chips Elimination Audit
1. Open a new chat session.
2. Verify empty screen renders ONLY the brand mark `>E_`, time greeting ("Good afternoon, Ellie"), and centered composer.
3. Confirm zero suggestion chips appear.
4. Run code search for `suggestion-chip` to verify zero references remain in the repository.
