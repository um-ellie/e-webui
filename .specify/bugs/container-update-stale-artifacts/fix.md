# Bug Fix: Container Update Stale Artifacts and Unapplied UI

- **Slug**: container-update-stale-artifacts
- **Fixed**: 2026-11-20T05:22:00Z
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Eliminated UI update failures and residual stale container artifacts by adding `Cache-Control: no-cache, must-revalidate` HTTP headers to FastAPI responses for HTML and static assets, enforcing a clean target directory purge prior to release extraction in `extract_release_in_container`, cleaning stale `.pyc` bytecode during dev-sync, and expanding workspace change detection to include untracked source files.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `app/main.py` | modified | Added `Cache-Control: no-cache, must-revalidate` to `serve_index()` and static asset middleware |
| `scripts/lib/release.sh` | modified | Enforced `rm -rf` on `${release_dir}` before extraction, and added post-extraction `__pycache__` purge |
| `scripts/lib/builder.sh` | modified | Added `-uall` flag to `git status --porcelain` in `workspace_has_changes()` to catch untracked files |
| `scripts/ctl.sh` | modified | Added stale bytecode purge before transferring files in `action_fast_dev_sync` |
| `scripts/deploy.sh` | modified | Added stale bytecode purge in `dev-sync` command branch |
| `tests/unit/test_api_server.py` | added | Unit tests verifying `Cache-Control: no-cache, must-revalidate` on `/` and `/static/` |

## Diff Highlights

### `app/main.py`
```python
    # Ensure UI templates and static assets revalidate immediately upon container updates
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response

@app.get("/", response_class=FileResponse)
async def serve_index():
    ...
    return FileResponse(
        index_file,
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )
```

### `scripts/lib/release.sh`
```bash
    # Purge any pre-existing release directory to ensure 100% clean, non-polluted extraction
    run_in_container "${c_name}" rm -rf "${release_dir}"
    run_in_container "${c_name}" mkdir -p "${release_dir}"
...
    # Clean any stale bytecode files that might conflict between Python versions
    run_in_container_bash "${c_name}" "find '${release_dir}' -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true"
```

## Tests Added or Updated

- `tests/unit/test_api_server.py::test_root_index_cache_control` — Asserts that `serve_index` returns `Cache-Control: no-cache, must-revalidate`.
- `tests/unit/test_api_server.py::test_static_asset_cache_control` — Asserts that the HTTP middleware attaches `Cache-Control: no-cache, must-revalidate` to static assets.
- `tests/unit/test_api_server.py::test_security_headers_present` — Asserts security headers remain intact.

## Local Verification

- Commands run:
  - `python3 -m unittest tests/unit/test_api_server.py` → `Ran 3 tests in 0.001s: OK`
  - `python3 -m unittest discover -s tests/unit` → `Ran 110 tests in 5.436s: OK (skipped=12)`
  - `python3 -m unittest tests/test_ui_contracts.py` → `Ran 9 tests in 0.002s: OK`

## Deviations from Assessment

None. All remediation steps identified in the assessment contract were applied cleanly.

## Follow-ups

- When deploying to the live container via `./ctl` (Option 1 or Option 2) or `./deploy.sh --update`, a normal browser refresh will now immediately query the container and display the latest UI without needing manual cache clearing (`Ctrl+F5`).
