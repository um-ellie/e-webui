# Bug Assessment: Container Staging Directory Nested by incus file push

- **Slug**: container-staging-push-nesting
- **Created**: 2026-11-06T22:48:00Z
- **Source**: Pasted text from user deployment session
- **Verdict**: valid
- **Severity**: critical

## Report (verbatim or summarized)

The user ran `./deploy.sh` to install `e-webui` on a clean container (`e-webui-app`).
Host pre-flight verification passed successfully:
```text
[INFO] Consuming initial release package: /home/ellie/Documents/Projects/e-webui/dist/releases/e-webui-1.0.0-20261106-191045-e784c0dd-dirty.tar.gz
[INFO] Running host pre-flight verification on release package...
[VALID] Manifest 'manifest.json' conforms to schema v1.0.0 and all artifacts match.
[VALID] All checksums verified (4/4 files).
[VALID] Archive 'app.tar.gz' is verified safe for extraction.
[SUCCESS] Host pre-flight validation passed for release package.
[INFO] Preparing initial release: 20261106-191045-e784c0dd-dirty (v1.0.0)
[INFO] Transferring initial release package to container staging...
[INFO] Verifying SHA-256 checksums inside container staging...                                                                                                                                                       
sha256sum: checksums.sha256: No such file or directory
[ERROR] Container Pre-extraction Gate Failed: SHA-256 checksum mismatch in container staging.
```

## Symptom

When `./deploy.sh` transfers an unpacked release package to the container staging directory (`/opt/e-webui/staging/release-<release_id>`), the container pre-extraction verification gate fails immediately with `sha256sum: checksums.sha256: No such file or directory`. The deployment aborts with exit code 3 before release extraction or service activation.

## Reproduction

1. Build a valid release archive: `./build-release.sh`.
2. Run `./deploy.sh` targeting an Incus container.
3. Host pre-flight checks pass.
4. During container staging verification, observe the fatal error:
   `sha256sum: checksums.sha256: No such file or directory`
   `[ERROR] Container Pre-extraction Gate Failed: SHA-256 checksum mismatch in container staging.`

## Suspected Code Paths

- `scripts/deploy.sh:250-254` (update flow) and `scripts/deploy.sh:345-349` (install flow) — Creates `${container_staging}` with `mkdir -p` and then executes `container_push "${release_dir}" "${CONTAINER_NAME}${container_staging}"`.
- `scripts/lib/incus.sh:58-63` — `container_push` executes `incus_cmd file push -r "${src}" "${dest}"`. In Incus CLI semantics, pushing a directory `src` (e.g. `/tmp/e-webui-deploy-stage.XXXXXX`) to an existing container directory `dest` copies the directory *itself* inside `dest`, resulting in `${container_staging}/e-webui-deploy-stage.XXXXXX/checksums.sha256` rather than placing `checksums.sha256` directly in `${container_staging}`.
- `scripts/lib/archive.sh:154-159` — `verify_release_in_container` runs `cd '${container_staging_dir}' && sha256sum -c checksums.sha256`, which fails because `checksums.sha256` is nested one directory deeper.
- `tests/mock_incus.py:205-211` — The mock implementation unpacked directory items directly into destination root (`for item in src.iterdir(): copy to dest_full / item.name`), masking this behavioral difference between mock tests and real Incus environments.

## Root Cause Hypothesis

`scripts/deploy.sh` creates the container staging folder (`mkdir -p ${container_staging}`) and calls `container_push "${release_dir}" "${CONTAINER_NAME}${container_staging}"`. Because `${container_staging}` already exists as a directory in the container, `incus file push -r <dir> <container>/<existing_dir>` copies the host directory by its basename into the target folder, producing `${container_staging}/<stage_basename>/checksums.sha256`. When `verify_release_in_container` executes `cd '${container_staging}' && sha256sum -c checksums.sha256`, `checksums.sha256` cannot be found in the current working directory. Confidence: High.

## Proposed Remediation

**Preferred**:
1. In `scripts/lib/incus.sh`, introduce a dedicated `container_push_dir_contents` function (or enhance `container_push`) that pushes all contents of `src_dir` directly into `dest_dir/` (e.g. using `incus file push -r "${src_dir}"/* "${dest_container_path}/"` or tar streaming `tar -C "${src_dir}" -cf - . | incus exec "${c_name}" -- tar -C "${dest_path}" -xf -`).
   - Using a tar pipe stream (`tar -C "${src_dir}" -czf - . | run_in_container_bash "${c_name}" "tar -xzf - -C '${dest_dir}'"`) or pushing directory contents `"${src_dir}/."` / `"${src_dir}"/*` guarantees exact in-place transfer into `${container_staging}` without unwanted intermediate directory nesting, preserving permissions and file timestamps cleanly.
2. In `scripts/lib/archive.sh`, also add fallback detection in `verify_release_in_container` and `extract_release_in_container`: if `${container_staging}/checksums.sha256` is not found, check if a single nested subdirectory exists containing `checksums.sha256` and adjust `container_staging_dir` accordingly, providing defense-in-depth.
3. Update `tests/mock_incus.py` to faithfully replicate Incus `file push -r` behavior or test the transfer function to prevent divergence.
4. Add automated test coverage verifying that after transfer, `${container_staging}/checksums.sha256` and `${container_staging}/manifest.json` are immediately accessible and valid.

**Alternatives**:
- In `scripts/deploy.sh`, do not create `${container_staging}` with `mkdir -p` beforehand, but let `container_push` push the directory with the intended target name. However, Incus requires the parent directory to exist and can still nest depending on version nuances; pushing contents or using a tar stream is significantly more robust and portable.

**Files likely to change**:
- `scripts/lib/incus.sh`
- `scripts/deploy.sh`
- `scripts/lib/archive.sh`
- `scripts/lib/release.sh`
- `tests/mock_incus.py`
- `tests/test_deploy_lifecycle.py`

**Tests to add or update**:
- Lifecycle test checking that `container_staging` contains release artifacts at its root without any nested staging folder.
- Validation that `verify_release_in_container` passes on real-world directory transfer shapes.

## Risks & Considerations

- Low risk: restricted to container staging transfer and verification logic.
- Atomic activation in `/opt/e-webui/releases/<release-id>` is untouched.
- Clean container staging ensures host isolation is strictly preserved.

## Open Questions

None. The error output `sha256sum: checksums.sha256: No such file or directory` immediately confirms directory nesting inside container staging.
