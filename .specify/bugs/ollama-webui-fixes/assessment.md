# Bug Assessment: Ollama WebUI UI & UX Defects

- **Slug**: ollama-webui-fixes
- **Created**: 2026-11-17T01:52:00Z
- **Source**: Pasted text
- **Verdict**: valid
- **Severity**: high

## Report (Summarized)

Five distinct defects and deficiencies in the Ollama WebUI chat application:
1. Model selector dropdown does not open when clicking on the model selector chip in the composer.
2. "Reconnect and test" button in the sidebar diagnostics popover exhibits no reaction upon click.
3. "Delete this chat" does not use an in-app confirmation dialog and lacks a reusable toast feedback mechanism.
4. Left sidebar collapse/expand behavior hides the entire sidebar off-screen instead of collapsing into a clean rail with visible logo and status dot.
5. Top-right options:
   - Share button is disabled and does not export the conversation to Markdown.
   - Rename chat invokes the native browser `prompt()` dialog rather than an in-app modal.

## Symptom

- Model picker chip cannot open model selection list.
- Telemetry retest button fails silently.
- Chat deletion lacks confirmation modal and toast notification.
- Sidebar collapses completely off-screen, hiding the logo and status indicator.
- Share button is inactive; rename chat uses browser-native `prompt()`.

## Reproduction

1. **Issue 1**: Click `#mc` ("Loading..." or model chip) in composer. Result: popover `#mpop` does not open or renders empty box.
2. **Issue 2**: Click connection telemetry `#conn`, then click `#retest` ("Reconnect and test"). Result: nothing happens, console shows uncaught error.
3. **Issue 3**: Click three dots `#more` -> "Delete this chat". Result: inline text changes without confirmation modal, no toast.
4. **Issue 4**: Click `#sbtoggle` (Collapse sidebar). Result: sidebar slides off screen completely (`margin-left: -264px; visibility: hidden`), logo disappears.
5. **Issue 5a**: Click Share icon in header. Result: button is disabled, nothing downloaded.
6. **Issue 5b**: Click three dots `#more` -> "Rename chat". Result: native browser `prompt()` appears.

## Suspected Code Paths

- `app/static/js/components/composer.js:96` — calls `api.listModels()` which does not exist in `ApiClient`.
- `app/static/js/components/sidebar.js:151` — calls `healthManager.checkNow()` which does not exist in `HealthManager`.
- `app/static/js/components/header.js:202` — calls native `prompt()` for chat renaming.
- `app/static/js/components/header.js:209-238` — implements inline 2-click timeout for chat deletion without modal dialog or toast.
- `app/static/js/features.js:23` — marks `chat.share` as disabled.
- `app/static/js/export.js:16-24` — `sanitizeFilename` strips all Unicode / Persian letters.
- `app/static/style.css:448-451` — hides sidebar completely on collapse instead of showing a collapsed rail.

## Root Cause Hypothesis

- **Issue 1 (High Confidence)**: Method name mismatch (`api.listModels()` vs `api.getModels()`) throws `TypeError` on load, leaving `models` array empty and preventing list items from rendering.
- **Issue 2 (High Confidence)**: Method name mismatch (`healthManager.checkNow()` vs `healthManager.probe()`) throws `TypeError` on click, silently aborting probe and telemetry update.
- **Issue 3 (High Confidence)**: Chat deletion lacked an accessible modal dialog component and had no reusable toast notification system.
- **Issue 4 (High Confidence)**: CSS rules for `.collapsed` set `margin-left: -264px` and `visibility: hidden` instead of a persistent collapsed rail retaining logo, toggle button, and status indicator.
- **Issue 5 (High Confidence)**: `chat.share` is disabled in `FEATURE_REGISTRY`, lacking click handler; `rename` directly calls `window.prompt()`; and filename sanitizer strips non-ASCII Persian characters.

## Proposed Remediation

**Preferred**:
1. Fix `api.getModels()` call and add method alias `listModels()` in `ApiClient`. Ensure empty ("No models found") and offline ("Ollama is offline") states are rendered.
2. Fix `healthManager.probe()` call and add `checkNow()` alias. Add loading state, toast notifications for success/failure, and reload model list on reconnect.
3. Create a lightweight, reusable toast notification module (`app/static/js/toast.js`) and in-app modal confirmation dialog for chat deletion with Esc/backdrop/focus handling.
4. Refactor sidebar collapsed CSS and HTML to retain a 64px rail with the logo/mark, toggle button, and single circular status indicator dot.
5. Enable `chat.share`, wire download to Markdown using `Blob` with Persian/UTF-8 support, and implement an in-app Rename Dialog with validation, RTL/LTR support, and keyboard controls.

**Files likely to change**:
- `app/static/js/api.js`
- `app/static/js/health.js`
- `app/static/js/features.js`
- `app/static/js/export.js`
- `app/static/js/toast.js` (new)
- `app/static/js/components/modal.js` (new)
- `app/static/js/components/composer.js`
- `app/static/js/components/sidebar.js`
- `app/static/js/components/header.js`
- `app/static/index.html`
- `app/static/style.css`

## Risks & Considerations

- Ensure theme toggle and connection indicator functionality remain completely intact.
- Verify RTL / Persian text rendering for filenames and dialog inputs.
- Ensure no native browser alerts, confirms, or prompts are used anywhere.
