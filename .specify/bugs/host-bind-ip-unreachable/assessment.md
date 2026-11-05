# Bug Assessment: Browser Cannot Access Service via Container IP (Localhost Bind)

- **Slug**: host-bind-ip-unreachable
- **Created**: 2026-11-05T03:31:00Z
- **Source**: Pasted text from user deployment session
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

The user created a new Incus container (`images:debian/13 e-webui`) and ran `./scripts/deploy.sh`.
The deployment completed successfully and reported:
```text
Application Access URL: http://10.100.0.117:8080
Container Name:        e-webui
Service Status:        active (running)
```
Systemd logs show:
```text
Nov 04 23:56:31 e-webui python3[1629]: INFO: Uvicorn running on http://127.0.0.1:8080 (Press CTRL+C to quit)
```
User feedback:
"همه چی درسته به نظر. ولی صفحه توی مرورگر لود نمیشه" (Everything looks right, but the page doesn't load in the browser).

## Symptom

When opening `http://10.100.0.117:8080` in the host browser, the page fails to load (connection refused), despite `systemctl status e-webui` reporting that the service is active and running.

## Reproduction

1. Launch a new container: `incus launch images:debian/13 e-webui`.
2. Deploy using `./scripts/deploy.sh e-webui`.
3. After deployment reports success, attempt to navigate to the reported URL `http://<container_ip>:8080` in a browser or run `curl -I http://<container_ip>:8080` from the host.
4. Connection fails / times out.

## Suspected Code Paths

- `app/systemd/e-webui.service:10` — Hardcodes `--host 127.0.0.1`:
  `ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8080`
  `Environment="APP_HOST=127.0.0.1"`
- `app/config.py:6` — Sets default `APP_HOST = "127.0.0.1"`.
- `scripts/deploy.sh:353-356` — Prints `http://${CONTAINER_IP}:8080` as the user-facing access URL.

## Root Cause Hypothesis

Uvicorn is configured to bind strictly to loopback (`127.0.0.1`). In Linux network namespaces, `127.0.0.1` is isolated to the container's internal `lo` interface. Requests from the host browser to the container's private IP (`10.100.0.117:8080`) arrive at the container's `eth0` network interface, where no socket is listening. As a result, the connection is refused. Confidence: High.

## Proposed Remediation

**Preferred**:
1. In `app/systemd/e-webui.service`:
   Change `--host 127.0.0.1` to `--host 0.0.0.0`, and update `Environment="APP_HOST=0.0.0.0"`.
2. In `app/config.py`:
   Change default `APP_HOST` to `"0.0.0.0"`.
3. In `tests/unit/test_deploy_script.py`:
   Update unit tests to assert `--host 0.0.0.0` in the service unit definition.

**Alternatives**:
- Configure an Incus proxy device to forward host port 8080 to container `127.0.0.1:8080`.
  - *Trade-off*: Binding to `0.0.0.0` inside the container is much simpler, avoids host port collisions, and directly matches the `http://<container-ip>:8080` access URL displayed to the user. Inside Incus private bridge networks (`incusbr0`), `0.0.0.0` is still isolated from physical external networks.

**Files likely to change**:
- `app/systemd/e-webui.service`
- `app/config.py`
- `tests/unit/test_deploy_script.py`

**Tests to add or update**:
- Update `test_systemd_service_and_test_runner_python_paths` in `tests/unit/test_deploy_script.py` to verify that `e-webui.service` binds to `0.0.0.0`.

## Risks & Considerations

- None. The container network bridge (`10.100.0.0/24`) is already a private host-to-container subnet managed by Incus.

## Open Questions

- None.
