# Quickstart Validation Guide: Modern AI Chat & Ollama Connection UI/UX Overhaul

**Feature**: `022-modern-ai-chat-ux`  
**Date**: 2026-11-16  
**Status**: Ready  

## 1. Prerequisites & Environment

1. Ensure Incus container `e-webui-app` is running and accessible:
   ```bash
   incus list e-webui-app
   ```
2. Confirm the uvicorn web service is active on port 8080:
   ```bash
   incus exec e-webui-app -- ss -tlnp | grep 8080
   ```
3. Confirm Ollama service is reachable on container loopback:
   ```bash
   incus exec e-webui-app -- curl -s http://127.0.0.1:8080/api/health
   # Expected: {"status":"ok","ollama_connected":true,"ollama_url":"http://127.0.0.1:11434","latency_ms":...,"loaded_models":[]}
   ```

---

## 2. Interactive Manual Verification Scenarios

### Scenario A: Theme Switcher & Flash-Free Reload
1. Open `http://<container-ip>:8080/` in a desktop browser.
2. Observe the top-right header segmented control (Sun, Moon, Monitor).
3. Click the Moon icon.
   - **Expected**: Canvas instantly transitions to charcoal-olive/slate dark pastel theme (`[data-theme="dark"]`).
4. Hard-refresh the browser (`Ctrl+F5`).
   - **Expected**: Page renders directly in dark mode with zero white/light flash before paint.
5. Click the Sun icon.
   - **Expected**: Transitions immediately to warm sand/alabaster light theme.

### Scenario B: Sidebar Connection Capsule & Diagnostics Popover
1. Inspect the bottom-left sidebar footer.
   - **Expected**: Displays an activity waveform icon, green status dot, "Online" label, and live latency (e.g., `2.6 ms`).
2. Click the connection capsule.
   - **Expected**: Floating card opens upward displaying:
     - Status: `Operational`
     - Endpoint: `127.0.0.1:11434`
     - Latency: live ping in ms
     - In memory: `No model loaded` (when idle)
     - Checked: `just now`
     - Action: `Reconnect and test`
3. Click "Reconnect and test".
   - **Expected**: Dot spins momentarily (`Checking`), re-probes `/api/health`, and returns to `Operational` with updated timestamp.
4. Press `Escape` or click outside.
   - **Expected**: Popover dismisses cleanly.

### Scenario C: Contextual Clean Capsule Composer & Inference
1. Observe the floating composer at the bottom.
   - **Expected**: Clean capsule containing textarea, `+` button, subtle mic icon, model chip (`gemma4:latest`), and round Send button. Zero permanent pill rows.
2. Click the `+` button.
   - **Expected**: Upward menu opens showing Attach file, Tools, Think switch, and Presets.
3. Toggle "Think" switch to ON.
   - **Expected**: Menu closes; a compact `Think` chip appears above the textarea.
4. Type `hello` and click the Send button (or press `Enter`).
   - **Expected**:
     - Empty state greeting smoothly transitions into message turn.
     - Send button morphs into round Stop button.
     - Assistant emits streaming tokens and reasoning block with live elapsed timer.
     - Send button returns to arrow upon completion.
5. Click the `x` on the `Think` chip.
   - **Expected**: Chip disappears; composer returns to default clean capsule.

### Scenario D: 3-Pane Settings Dialog & Danger Zone Protection
1. Click the gear icon in the sidebar footer or press `Ctrl+,`.
   - **Expected**: Large rounded modal opens with left-rail navigation (Workspace, Model, Data & system).
2. On Pane 1 (Workspace), observe Theme segmented control, font scaling slider, and collapsed "Keyboard shortcuts" accordion. Expand accordion to see keys.
3. Switch to Pane 2 (Model), drag the temperature slider to `1.2`.
   - **Expected**: Live numeric badge updates to `1.2`.
4. Switch to Pane 3 (Data & system), locate the Danger Zone at the bottom.
5. Click "Delete all conversations" once.
   - **Expected**: Button styles red with label "Yes, delete everything".
6. Wait 5 seconds without clicking.
   - **Expected**: Button resets safely to "Delete all conversations".

---

## 3. Automated Browser Test Execution

Run the automated UI validation suite:
```bash
node tests/e2e-ui-validation.mjs
```
Expected output:
```text
✔ Header Theme Switcher: Light/Dark/System transitions verified without FOWT
✔ Empty Canvas: Asymmetric start-aligned greeting verified in column
✔ Sidebar Connection Capsule: Online state and upward diagnostics popover verified
✔ Contextual Composer: '+' menu, Think chip appearance, and Send/Stop morphing verified
✔ SSE Stream: Live token generation and reasoning duration verified
✔ Code Block: Language headers and copy-to-clipboard checkmark verified
✔ Settings Modal: 3 task panes, shortcuts accordion, and two-step danger zone verified
ALL E2E CHECKS PASSED (100% Functional Parity Verified)
```
