# Quickstart & Verification Guide: Chat History Persistence and Markdown Export

**Feature**: `016-chat-history-persistence`  
**Date**: 2026-11-14  
**Spec**: [spec.md](spec.md)  
**Data Model**: [data-model.md](data-model.md)  
**Contracts**: [contracts/storage-contract.md](contracts/storage-contract.md), [contracts/ui-features.json](contracts/ui-features.json)  

This guide provides step-by-step procedures to validate chat history persistence and client-side conversation exports both locally in unit test harnesses and manually in a browser.

---

## 1. Local Workspace Verification (Automated UI & Contract Tests)

All automated tests adhere strictly to Constitution Principle I (Workspace-Only Isolation, Mock-Based Verification).

### Prerequisites
* Python 3.11+ virtual environment with `pytest` and `httpx`.
* Modern web browser supporting ES6 modules and IndexedDB.

### Running Test Harness
Validate data model schemas, export formatting logic, and UI contracts:

```bash
# Run unit tests validating export formatting and feature availability
python3 -m unittest discover -s tests/unit -p "test_*.py" -v
```

### Key Automated Scenarios
1. **Markdown Formatting Verification**: Tests markdown serialization for user/assistant messages, multi-line code blocks, and collapsible reasoning tags.
2. **JSON Export Contract Compliance**: Validates generated export objects against `contracts/export-schema.json`.
3. **Feature Registry State**: Verifies that `chat.export` and `session.clear_all` evaluate as `enabled` in `ui-features.json`.

---

## 2. Interactive Browser Validation Scenarios

Run the local development server (or access the deployed application at `http://127.0.0.1:8080`):

```bash
# Start local mock server or app instance
python3 app/main.py
```

### Scenario 1: Multi-Turn Conversation Persistence Across Reload
1. Open `http://127.0.0.1:8080` in your browser.
2. Select an available model and send a prompt: *"Explain how IndexedDB works in 3 bullet points."*
3. Wait for the model response to finish streaming (`status: 'completed'`).
4. Note the conversation title in the header and sidebar.
5. Send a follow-up turn: *"Give a 2-line code example."*
6. Refresh the browser page (`Ctrl+R` / `F5`).
7. **Expected Result**: 
   - Within 200 ms, the page loads with the active session restored.
   - Both user messages and assistant responses appear intact.
   - Code blocks and styling render identically to before the refresh.

### Scenario 2: Multi-Session Navigation & Date Grouping
1. Click the **"New chat"** button in the sidebar.
2. Send a prompt with a new topic (e.g. *"Write a Python script"*).
3. Verify that two separate sessions now exist in the sidebar under "Today".
4. Switch back and forth between Session 1 and Session 2.
5. **Expected Result**: Switching sessions renders the corresponding conversation history instantly without flickering or reload.

### Scenario 3: Export to Formatted Markdown (`.md`)
1. Open a conversation with multiple turns and code blocks.
2. Click the header overflow menu (`···`) or right-click / hover context menu on the session item in the sidebar.
3. Click **"Export"** and choose **"Markdown (.md)"**.
4. **Expected Result**:
   - The browser automatically initiates a download of a file named `[sanitized-title]-YYYY-MM-DD.md`.
   - Open the downloaded `.md` file in a Markdown viewer.
   - Verify header metadata (Date, Model, Title), clean `### User` / `### Assistant` sections, preserved code fences, and any reasoning traces inside `<details><summary>Reasoning</summary>...</details>`.

### Scenario 4: Export to JSON (`.json`)
1. In the same menu, choose **"Export as JSON"**.
2. **Expected Result**:
   - Downloads a `.json` file containing the structured conversation object matching `contracts/export-schema.json`.

### Scenario 5: Clear All Chats (Workspace Reset)
1. Click the **Settings** gear icon in the sidebar footer.
2. On the **General** tab, scroll to the **Data Management** section.
3. Click **"Clear all conversations"**.
4. Confirm the warning dialog.
5. **Expected Result**:
   - All stored sessions are purged from client storage.
   - The UI resets to a clean empty state with a single fresh conversation.
   - Refreshing the page confirms that historical sessions remain cleared.
