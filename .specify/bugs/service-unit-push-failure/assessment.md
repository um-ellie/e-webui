# Bug Assessment: Systemd Service Unit Push Fails with "Error: file does not exist"

- **Slug**: service-unit-push-failure
- **Created**: 2026-11-06T23:08:00Z
- **Source**: Pasted text from user deployment session
- **Verdict**: valid
- **Severity**: critical

## Report (verbatim or summarized)

The user ran `./deploy.sh` to install `e-webui` on container `e-webui-app`.
Container staging, checksum verification, payload extraction, and virtual environment provisioning all passed successfully:
```text
[INFO] Transferring initial release package to container staging...
[INFO] Verifying SHA-256 checksums inside container staging...                                                                                                                     
payload/app.tar.gz: OK
payload/requirements.txt: OK
payload/systemd/e-webui.service: OK
manifest.json: OK
[INFO] Auditing payload archive paths inside container...
[SUCCESS] Container pre-extraction verification passed.
[INFO] Extracting release into /opt/e-webui/releases/20261106-192521-03b6c44f...
[SUCCESS] Dependency Cache Hit: Reusing existing compatible Python environment (2fe8ef055073).
Error: file does not exist

e-webui on  main via  v3.13.5 took 15s 
```

## Symptom

Immediately after virtual environment configuration and environment symlink creation, `./deploy.sh` invokes `install_service_unit` to push the systemd unit file (`/etc/systemd/system/e-webui.service`). The Incus CLI immediately aborts with:
`Error: file does not exist`
and terminates the deployment with non-zero exit code before activating the release or running health checks.

## Reproduction

1. Launch a clean container (or run `./deploy.sh` with a valid release).
2. Allow pre-flight, staging transfer, extraction, and virtualenv provisioning to complete.
3. Observe execution halt immediately after `Dependency Cache Hit / Provisioning` with:
   `Error: file does not exist`

## Suspected Code Paths

- `scripts/lib/incus.sh:58-63` — `container_push` executes `incus_cmd file push -r "${src}" "${dest}"`. It unconditionally passes `-r` (recursive) even for regular files and omits `-p` (`--create-dirs`). When `-r` is passed to `incus file push` targeting a non-existent file path, Incus treats the target as a missing directory.
- `scripts/lib/service.sh:58` — `install_service_unit` invokes `container_push "${tmp_unit}" "${c_name}${SYSTEMD_UNIT_PATH}"` without ensuring that the target directory (`/etc/systemd/system`) exists in the container or passing `--create-dirs` (`-p`).
- `tests/mock_incus.py:202-215` — The mock implementation automatically executed `mkdir -p` on the destination directory, obscuring the missing `-p` requirement of real Incus CLI in tests.

## Root Cause Hypothesis

In `scripts/lib/service.sh:58`, `install_service_unit` pushes a temporary rendered service unit to `${c_name}/etc/systemd/system/e-webui.service` using `container_push`. In `scripts/lib/incus.sh:58-63`, `container_push` executes `incus file push -r "${src}" "${dest}"`. In Incus CLI semantics:
1. Pushing a file with `-r` causes Incus to treat the target as a directory; when the destination does not already exist as a directory, Incus aborts with `Error: file does not exist`.
2. Omitting `-p` (`--create-dirs`) prevents Incus from creating parent directories (e.g. if `/etc/systemd/system` is missing or uninitialized in a minimal container image), likewise resulting in `Error: file does not exist`.
Confidence: High.

## Proposed Remediation

**Preferred**:
1. In `scripts/lib/incus.sh`, update `container_push` to distinguish between files and directories, and pass `-p` (`--create-dirs`):
   ```bash
   container_push() {
       local src="$1"
       local dest="$2"
       # dest format: <container>/<path>
       if [ -d "${src}" ]; then
           incus_cmd file push -p -r "${src}" "${dest}"
       else
           incus_cmd file push -p "${src}" "${dest}"
       fi
   }
   ```
2. In `scripts/lib/service.sh`, explicitly ensure the destination directory `/etc/systemd/system` exists before pushing the unit:
   ```bash
   run_in_container "${c_name}" mkdir -p "$(dirname "${SYSTEMD_UNIT_PATH}")"
   container_push "${tmp_unit}" "${c_name}${SYSTEMD_UNIT_PATH}"
   ```
3. Update `tests/mock_incus.py` to match real Incus CLI file pushing behavior.
4. Add automated test coverage in `tests/test_deploy_lifecycle.py` verifying `install_service_unit` pushes service units without failure even in clean environments.

**Files likely to change**:
- `scripts/lib/incus.sh`
- `scripts/lib/service.sh`
- `tests/test_deploy_lifecycle.py`
- `tests/mock_incus.py`

**Tests to add or update**:
- Test in `tests/test_deploy_lifecycle.py` testing `install_service_unit` with uninitialized `/etc/systemd/system`.

## Risks & Considerations

- Low risk: restricted to systemd unit file transfer helper.
- Passing `-p` and removing `-r` for single files directly aligns with Incus CLI documentation and standard practices.

## Open Questions

None. The Incus CLI error `Error: file does not exist` is the documented signature of `incus file push` without `-p` / with inappropriate `-r` on a non-existent file path.
