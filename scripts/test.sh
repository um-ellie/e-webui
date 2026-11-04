#!/usr/bin/env bash
# Automated test runner for Ollama Web UI
set -euo pipefail

CONTAINER_NAME="${1:-webui}"
APP_DIR="/opt/ollama-webui"
PYTHON_BIN="/opt/open-webui/.local/share/uv/tools/open-webui/bin/python"

echo "=== Running Ollama Web UI Test Suite inside Container (${CONTAINER_NAME}) ==="

incus exec "${CONTAINER_NAME}" -- env PYTHONPATH="${APP_DIR}" "${PYTHON_BIN}" -m pytest "${APP_DIR}/tests" -v --tb=short

echo "=== All Tests Passed Successfully! ==="
