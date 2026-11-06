# Contract: Deployment Manager Release Consumer

**Component**: `scripts/deploy.sh` (`--install`, `--update`, and default auto-detect)  
**Purpose**: Formal specification for how the Deployment Manager locates, validates, and consumes Release packages.  

---

## 1. CLI Release Arguments

```bash
./deploy.sh [--install | --update | auto] [--release <PATH>] [OPTIONS] [CONTAINER_NAME]
```

### `--release <PATH>` Contract
- If `<PATH>` is provided:
  - If `<PATH>` is a file ending in `.tar.gz`: Unpack into a temporary staging directory on the host, validate manifest and checksums, and consume.
  - If `<PATH>` is a directory: Validate that `<PATH>/manifest.json` and `<PATH>/checksums.sha256` exist and consume directly.
- If `<PATH>` is omitted:
  - Inspect `${REPO_ROOT}/dist/releases/`.
  - Scan for valid release directories and release bundles.
  - Sort by release identifier / timestamp descending and select the latest valid package.
  - If no valid package exists, exit immediately with exit code 2:
    ```text
    [ERROR] No release packages found in 'dist/releases/'.
    Please build a release using './scripts/build-release.sh' or specify '--release <path>'.
    ```

---

## 2. Validation & Security Gate Contract

Before any byte is copied to the container or any symlink modified, `deploy.sh` MUST execute:

### Host Validation Gate
1. **Manifest Well-Formedness**: Parse `manifest.json` using Python JSON parser.
2. **Schema Compatibility**: Ensure `schema_version` is major version `1.x`. If `schema_version >= 2.0.0`, halt.
3. **Manager Compatibility**: Ensure `compatibility.min_deployment_manager_version <= CURRENT_MANAGER_VERSION`.
4. **Application Identity**: Ensure `application == "e-webui"`.
5. **Artifact Inventory Match**: Ensure all entries in `artifacts[]` exist under `payload/`.
6. **Host SHA-256 Check**: Run `sha256sum -c checksums.sha256`. Halt on mismatch.

### Container Validation Gate
1. **Transfer**: Push the release package into `/opt/e-webui/staging/`.
2. **Container SHA-256 Check**: Execute `sha256sum -c checksums.sha256` inside the container.
3. **Archive Security Inspection**:
   - Inspect tar member paths for `payload/app.tar.gz`.
   - Reject any member beginning with `/`.
   - Reject any member containing `../`.
   - Reject any symlink pointing to an absolute or escaping path.

---

## 3. Container Installation & Activation Contract

Inside the Incus container:

1. **Extraction Target**: `/opt/e-webui/releases/<release-id>/`
2. **Preserved Artifacts**:
   - Application code extracted into `/opt/e-webui/releases/<release-id>/app/`.
   - `requirements.txt` extracted to `/opt/e-webui/releases/<release-id>/requirements.txt`.
   - Copy of `manifest.json` saved to `/opt/e-webui/releases/<release-id>/manifest.json`.
   - Copy of `checksums.sha256` saved to `/opt/e-webui/releases/<release-id>/checksums.sha256`.
3. **Virtualenv Symlink**:
   - `req_hash=$(sha256sum /opt/e-webui/releases/<release-id>/requirements.txt | awk '{print $1}')`
   - `/opt/e-webui/releases/<release-id>/venv -> /opt/e-webui/venvs/<req_hash>`
4. **Data Symlink**:
   - `/opt/e-webui/releases/<release-id>/data -> /opt/e-webui/shared/data`
5. **Service Activation**:
   - Systemd unit updated if `payload/systemd/e-webui.service` differs from `/etc/systemd/system/e-webui.service`.
   - Atomic symlink switch: `ln -sfn releases/<release-id> current_next && mv -Tf current_next current`.
6. **State Tracking**:
   - Active release metadata recorded in `/opt/e-webui/.deploy_state`:
     ```json
     {
       "schema_version": 2,
       "active_release": "<release-id>",
       "active_version": "<version>",
       "git_commit": "<commit>",
       "active_venv_hash": "<req_hash>",
       ...
     }
     ```
