# Quickstart & Validation Guide: Markdown Response Display and Copy Actions

**Feature**: Markdown Response Display and Copy Actions (`006-render-markdown-responses`)  
**Date**: 2026-11-06  
**Status**: Ready for Verification  

---

## 1. Prerequisites & Environment

This feature operates entirely within the workspace frontend assets. In compliance with **Constitution Principle I (Infrastructure Isolation)**, no container commands or `incus` operations are permitted or needed.

Local testing uses the Python/FastAPI backend running locally or mock responses.

---

## 2. Running the Local Development Server

Run the local web server from the repository root:

```bash
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser at: `http://127.0.0.1:8000`

---

## 3. End-to-End Manual Verification Scenarios

### Scenario 1: Comprehensive Markdown Formatting Test
1. Send the following prompt to the model:
   ```text
   Please demonstrate markdown with:
   1. A heading level 2 and level 3
   2. Bold, italic, and strikethrough text
   3. A bulleted list and numbered list
   4. A markdown table with 3 columns and 2 rows
   5. A blockquote
   6. A Python code block with def hello(): print("world")
   ```
2. **Verify**:
   - Headings render as styled headings, not `#` or `##`.
   - Table renders with cleanly styled borders, header background, and tabular alignment.
   - Code block appears with a top header showing `python` and a "Copy" button.
   - Blockquote renders with an accent border on the side.
   - Lists have bullet points and sequential numbers.

### Scenario 2: Full-Response Copy Button Test
1. Locate the action toolbar at the bottom of the assistant message.
2. Click the **Copy** button.
3. **Verify**:
   - The button icon changes to a checkmark and the label changes to "Copied!".
   - After ~1.8 seconds, the button smoothly resets to the initial "Copy" state.
   - Open a text editor and paste (Ctrl+V or Cmd+V).
   - Verify that the pasted text is the exact, unrendered Markdown source (including `#`, table `|`, and code block ` ``` `).

### Scenario 3: Individual Code Block Copy Test
1. In the same response, find the Python code block.
2. Click the **Copy** button inside the code block's header.
3. **Verify**:
   - Button displays "Copied!" for 1.5 seconds.
   - Paste clipboard into a text editor.
   - Verify that ONLY the Python code (`def hello(): ...`) was copied, without surrounding prose or the full response.

### Scenario 4: Streaming & Responsive Layout Test
1. Send a long prompt (e.g. "Write an essay about distributed computing with 3 code examples and a table").
2. **Verify**:
   - As tokens stream in, the markdown updates progressively without screen flickering.
   - Once the stream finishes, the action toolbar with the full-response copy button appears at the bottom.
3. Test in light mode and dark mode to verify contrast and readability.
4. Test with mixed Persian (RTL) and English code (LTR) to ensure code blocks and tables maintain proper LTR formatting.
