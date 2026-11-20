# Bug Assessment: Container Update Stale Artifacts and Unapplied UI

- **Slug**: container-update-stale-artifacts
- **Created**: 2026-11-20T05:16:15Z
- **Source**: Pasted text from user
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

The user reported:
> "مشکل اینجاست که من هر وقت کانتینر رو با نسخه جدید app آپدیت می کنم. ظاهرا این آپدیت به صورت درست در داخل کانتینر قرار نمی گیرد. یا شاید قسمت های از نسخه قبلی باقی می ماند که باعث خرابی و یا اعمال نشدن UI جدید در کانتینر می شود."
> *(Whenever I update the container with the new version of app, apparently this update is not properly placed inside the container. Or maybe parts of the previous version remain, which causes breakage or prevents the new UI from taking effect in the container.)*

## Symptom

When deploying an updated version of `e-webui` to the Incus container (`e-webui-app`) via `./deploy.sh --update`, `./deploy.sh --dev-sync`, or `./ctl`:
1. Updated frontend assets (`app/static/index.html`, `style.css`, and modular JS in `app/static/js/`) either do not reflect in the browser or show a broken/mixed state where elements of the previous release conflict with the new release.
2. If files or modules were removed, renamed, or refactored between releases, stale files from earlier deployments persist inside the container target directory.
3. Browsers retain aggressively cached versions of `/` and `/static/style.css` because FastAPI serves them with no `Cache-Control` directive (`Cache-Control: no-cache, must-revalidate` is missing), preventing the browser from querying the container for updated CSS/JS assets.

## Reproduction

1. Make changes to `app/static/style.css` and `app/static/index.html` in the workspace.
2. Run `./deploy.sh --update` or select Option 1 ("Smart Update") in `./ctl`.
3. Open the web interface at `http://localhost:8080` in Chrome/Firefox.
4. Observe that the browser serves cached CSS or HTML from disk, or observe that leftover `.pyc` and old static files remain in the container directory, causing broken styles, missing classes, or partial JavaScript execution.

## Suspected Code Paths

1. **`app/main.py:73-95` — Missing `Cache-Control` Headers for Static Assets & HTML Index**:
   - `serve_index()` returns `FileResponse(index_file)` without setting `headers={"Cache-Control": "no-cache, must-revalidate"}`.
   - `app.mount("/static", StaticFiles(...))` does not attach `no-cache` or max-age control headers, leading modern browsers to cache `style.css` and `app.js` indefinitely until forced with a hard refresh (`Ctrl+F5`).
2. **`scripts/lib/release.sh:22-35` (`extract_release_in_container`) — Non-Empty Target Extraction**:
   - `extract_release_in_container` executes `run_in_container "${c_name}" mkdir -p "${release_dir}"` and extracts `app.tar.gz` over it using `tar -xzf`.
   - If `${release_dir}` already existed (e.g. during iterative dev updates or repeated dirty builds sharing the same release ID), `tar -xzf` will overwrite matching filenames but **will NOT remove deleted or renamed files**, leaving orphaned obsolete assets and bytecode.
3. **`scripts/lib/builder.sh:72-90` (`auto_package_if_needed`) & `workspace_has_changes`**:
   - `auto_package_if_needed` relies on `workspace_has_changes`, which compares file modification timestamps against the latest package in `dist/releases`.
   - If untracked files exist, or if git commit/checkout occurred without updating mtimes, or if an older package in `dist/releases` has a newer timestamp (e.g. generated during test execution), `auto_package_if_needed` re-uses the stale package instead of building a fresh one.
4. **`scripts/ctl.sh:105-130` & `scripts/deploy.sh:670-685` (`action_fast_dev_sync` / `--dev-sync`) — Incomplete In-Place Syncing**:
   - Dev-sync pushes workspace `app/` over `/opt/e-webui/current/app/` using `incus file push -r`.
   - `incus file push` does not prune removed files in the container, and does not clear `__pycache__` bytecode directories, leading to mismatched `.pyc` artifacts between Python 3.11 and 3.13.

## Root Cause Hypothesis

The issue stems from a combination of three factors:
1. **HTTP Caching**: Neither `app/main.py` nor `StaticFiles` emits `Cache-Control: no-cache, must-revalidate` headers. Browsers store `style.css` and JavaScript bundles in local disk cache, so when the container is updated, the user's browser continues rendering the old CSS/JS with the new HTML, creating visual breakage.
2. **Container Release Directory Cleanliness**: In `scripts/lib/release.sh`, `extract_release_in_container` uses `mkdir -p` without purging any pre-existing release directory of the same ID, causing residual files from prior builds to linger.
3. **Stale Auto-Packaging Reuse**: In `scripts/lib/builder.sh`, `workspace_has_changes` can fail to detect changes when git status or mtime comparisons diverge from artifacts in `dist/releases`, deploying a previously built tarball instead of fresh workspace code.
Confidence: **High**.

## Proposed Remediation

**Preferred**:
1. **Add Cache-Control Headers in `app/main.py`**:
   - In `serve_index()`: Add `headers={"Cache-Control": "no-cache, must-revalidate"}` to the `FileResponse`.
   - In the `@app.middleware("http")` or custom static handler: Ensure responses for `/static/` include `Cache-Control: no-cache, must-revalidate` (or short max-age) so browsers always validate ETags and fetch new styles and scripts immediately upon container restart.
   - Add cache-busting version query string or ETag hint in `index.html` references if helpful.
2. **Enforce Clean Extraction in `scripts/lib/release.sh`**:
   - In `extract_release_in_container`: Execute `run_in_container "${c_name}" rm -rf "${release_dir}" && run_in_container "${c_name}" mkdir -p "${release_dir}"` to ensure a 100% clean, unpolluted target directory before extracting `app.tar.gz`.
   - Remove stale bytecode `find "${release_dir}" -name "__pycache__" -exec rm -rf {} +` post-extraction.
3. **Clean Dev-Sync in `scripts/deploy.sh` and `scripts/ctl.sh`**:
   - Before syncing `app/` into `/opt/e-webui/current/app/`, clean existing `.pyc` and remove stale files so the container mirrors workspace `app/` exactly.
4. **Force Fresh Packaging on Explicit Update**:
   - In `scripts/deploy.sh`: When the user explicitly requests `--update` or selects "Smart Update" in `./ctl`, pass `force_build=1` to `auto_package_if_needed` (or ensure `workspace_has_changes` includes untracked workspace files) so fresh code is always packaged.

**Files likely to change**:
- `app/main.py`
- `scripts/lib/release.sh`
- `scripts/lib/builder.sh`
- `scripts/deploy.sh`
- `scripts/ctl.sh`
- `tests/unit/test_api_server.py`
- `tests/test_deploy_lifecycle.py`

**Tests to add or update**:
- Test in `tests/unit/test_api_server.py` verifying that `/` and `/static/style.css` return `Cache-Control: no-cache, must-revalidate`.
- Test in `tests/test_deploy_lifecycle.py` verifying that release extraction wipes pre-existing directories cleanly and does not retain orphaned files.

## Risks & Considerations

- Low risk: Setting `Cache-Control: no-cache, must-revalidate` still allows browser caching via `ETag` (HTTP 304 Not Modified), so bandwidth is preserved while ensuring instant UI updates when assets change.
- Preserves offline runtime capabilities and does not touch container virtualization parameters.

## Open Questions

None. The behavior is directly reproducible and observable from HTTP response headers and shell extraction scripts.
