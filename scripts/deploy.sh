#!/usr/bin/env bash
# Deploy Lightweight Ollama Web UI into Incus Container
set -euo pipefail

CONTAINER_NAME="${1:-webui}"
APP_DIR="/opt/ollama-webui"
SYSTEMD_UNIT="/etc/systemd/system/ollama-webui.service"

echo "=== Deploying Ollama Web UI to Incus Container: ${CONTAINER_NAME} ==="

# 1. Ensure container is running
if ! incus info "${CONTAINER_NAME}" &>/dev/null; then
    echo "Error: Container ${CONTAINER_NAME} not found."
    exit 1
fi

STATUS=$(incus info "${CONTAINER_NAME}" | awk '/^Status:/ {print $2}')
if [ "${STATUS}" != "RUNNING" ]; then
    echo "Starting container ${CONTAINER_NAME}..."
    incus start "${CONTAINER_NAME}"
    sleep 2
fi

# 2. Stop conflicting open-webui service if active (both bind to port 8080)
if incus exec "${CONTAINER_NAME}" -- systemctl is-active --quiet open-webui 2>/dev/null; then
    echo "Stopping conflicting open-webui.service on port 8080..."
    incus exec "${CONTAINER_NAME}" -- systemctl stop open-webui
    incus exec "${CONTAINER_NAME}" -- systemctl disable open-webui
fi

# 3. Prepare container directories and sync files
echo "Preparing ${APP_DIR} and syncing files..."
incus exec "${CONTAINER_NAME}" -- mkdir -p "${APP_DIR}"

# Push app and tests directories
incus file push -r app/ "${CONTAINER_NAME}${APP_DIR}/"
incus file push -r tests/ "${CONTAINER_NAME}${APP_DIR}/"
incus file push requirements.txt "${CONTAINER_NAME}${APP_DIR}/requirements.txt"
incus file push app/systemd/ollama-webui.service "${CONTAINER_NAME}${SYSTEMD_UNIT}"

# 4. Install / Update Systemd Service
echo "Configuring systemd service..."
incus exec "${CONTAINER_NAME}" -- systemctl daemon-reload
incus exec "${CONTAINER_NAME}" -- systemctl enable ollama-webui
incus exec "${CONTAINER_NAME}" -- systemctl restart ollama-webui

# 5. Verify service health
echo "Waiting for service to initialize..."
sleep 2

if incus exec "${CONTAINER_NAME}" -- systemctl is-active --quiet ollama-webui; then
    echo "SUCCESS: ollama-webui service is active and running!"
    incus exec "${CONTAINER_NAME}" -- systemctl status ollama-webui --no-pager
else
    echo "ERROR: ollama-webui failed to start."
    incus exec "${CONTAINER_NAME}" -- journalctl -u ollama-webui -n 20 --no-pager
    exit 1
fi

echo "=== Deployment Complete ==="
