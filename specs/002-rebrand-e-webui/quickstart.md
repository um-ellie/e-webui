# Quickstart & Verification Guide: e-webui

**Feature**: Rebrand to `e-webui` and Brand Logo Integration  
**Date**: 2026-11-05  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1. Prerequisites

- Python 3.11+
- Web browser (Chrome, Firefox, or Edge)
- Standard Unix utilities (`grep`, `curl`)

---

## 2. Local Verification Scenarios

### Scenario 1: Verify Renaming Completeness Across Workspace

Confirm that all legacy names (`ellie-ollama-webui`, `Ollama Web UI`, `Web UI`, `webui`) have been replaced with `e-webui`, except for explicit third-party strings and container infrastructure references.

Run the repository audit script:

```bash
# Check for remaining legacy application names
grep -rni --exclude-dir={.git,node_modules} "ellie-ollama-webui" .
grep -rni --exclude-dir={.git,node_modules} "ollama web ui" .
```

**Expected Outcome**: Zero matches in workspace code, documentation, and configuration files (other than historical specs).

To audit remaining `webui` references to verify they are exclusively container infrastructure or third-party packages:

```bash
grep -rni --exclude-dir={.git,node_modules} "webui" . | grep -v -E "(e-webui|open-webui|CONTAINER_NAME|incus|webui-proxy)"
```

**Expected Outcome**: Zero stray matches.

---

### Scenario 2: Brand Logo UI Visual & Accessibility Inspection

1. Start the local development server (without container interactions):
   ```bash
   python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8080
   ```
2. Navigate to `http://127.0.0.1:8080` in a browser.
3. Inspect the top-left section of the header:
   - **Rendered Output**: Confirm the logo displays `> ~/.E _`.
   - **Colors**: The prompt `>` is colored blue (`--logo-prompt`), and `~/.E _` is colored bright text (`--logo-text`).
   - **Blinking Cursor**: Confirm that the underscore `_` blinks continuously at 1-second intervals.
   - **Accessibility**: In DevTools Accessibility pane, confirm `.brand-logo` exposes the accessible name `"e-webui"` with role `img`, and the cursor span has `aria-hidden="true"`.

---

### Scenario 3: Responsive Typography & Breakpoint Check

1. In browser DevTools, toggle Device Toolbar.
2. Set viewport width to `400px` (mobile):
   - Measure computed font size of `.brand-logo`: Expected `28px`.
3. Set viewport width to `768px` (desktop / tablet):
   - Measure computed font size of `.brand-logo`: Expected `34px`.

---

### Scenario 4: Reduced Motion Preference Verification

1. In DevTools, open the **Rendering** tab (in Chrome: More Tools > Rendering).
2. Set **Emulate CSS media feature prefers-reduced-motion** to `prefers-reduced-motion: reduce`.
3. Inspect the brand logo cursor:
   - **Expected Outcome**: Cursor animation immediately halts; cursor remains statically visible without blinking.

---

### Scenario 5: Bidirectional Text Isolation

1. Open DevTools Console and execute:
   ```javascript
   document.documentElement.setAttribute('dir', 'rtl');
   ```
2. Inspect the logo:
   - **Expected Outcome**: The logo continues to display left-to-right as `> ~/.E _` without character reversal or dislocation.

---

## 3. Host & Container Operator Hand-off (Principle I Compliance)

Because the agent cannot interact with Incus containers, if the operator wishes to align their container environment with the new name, they can run the following manual commands:

```bash
# Optional manual container rename by host administrator
incus rename webui e-webui

# Optional manual deploy script invocation by host administrator
./scripts/deploy.sh e-webui
```
