#!/usr/bin/env bash
# Automated test runner for e-webui
set -euo pipefail

CONTAINER_NAME="${1:-e-webui-app}"
APP_DIR="/opt/e-webui"
PYTHON_BIN="/usr/bin/python3"

echo "=== Running e-webui Test Suite inside Container (${CONTAINER_NAME}) ==="

incus exec "${CONTAINER_NAME}" -- env PYTHONPATH="${APP_DIR}" "${PYTHON_BIN}" -m pytest "${APP_DIR}/tests" -v --tb=short

echo "=== All Tests Passed Successfully! ==="
