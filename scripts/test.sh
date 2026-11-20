#!/usr/bin/env bash
# scripts/test.sh - Automated test runner for e-webui (host-local and container execution)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

RUN_LOCAL=0
TEST_TARGET="tests/unit"
CONTAINER_NAME="e-webui-app"
APP_DIR="/opt/e-webui"
VERBOSE=""

show_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] [CONTAINER_NAME]

Automated test runner for e-webui.

Options:
  -l, --local          Run unit tests locally on host machine using mock harnesses (No Incus required)
  -u, --unit           Target unit tests only (default for local)
  -i, --integration    Target integration tests
  -a, --all            Run all tests (unit and integration)
  -v, --verbose        Enable verbose output
  -h, --help           Show this help message and exit
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -l|--local)
            RUN_LOCAL=1
            shift
            ;;
        -u|--unit)
            TEST_TARGET="tests/unit"
            shift
            ;;
        -i|--integration)
            TEST_TARGET="tests/integration"
            shift
            ;;
        -a|--all)
            TEST_TARGET="tests"
            shift
            ;;
        -v|--verbose)
            VERBOSE="-v"
            shift
            ;;
        -*)
            echo "Unknown option: $1" >&2
            show_help
            exit 2
            ;;
        *)
            CONTAINER_NAME="$1"
            shift
            ;;
    esac
done

if [ "${RUN_LOCAL}" -eq 1 ] || ! command -v incus &>/dev/null; then
    echo "=== Running e-webui Test Suite locally on Host (${TEST_TARGET}) ==="
    cd "${REPO_ROOT}"
    
    # Try pytest in venv or host, fallback to unittest
    if [ -f ".venv/bin/pytest" ]; then
        .venv/bin/pytest "${TEST_TARGET}" ${VERBOSE}
    elif command -v pytest &>/dev/null; then
        pytest "${TEST_TARGET}" ${VERBOSE}
    else
        python3 -m unittest discover "${TEST_TARGET}" ${VERBOSE}
    fi
    echo "=== Local Tests Completed Successfully! ==="
    exit 0
fi

echo "=== Running e-webui Test Suite inside Container (${CONTAINER_NAME}) ==="
PYTHON_BIN="${APP_DIR}/current/venv/bin/python3"
# Fallback to system python if venv not active
incus exec "${CONTAINER_NAME}" -- bash -c "
if [ -f '${PYTHON_BIN}' ]; then
    PY='${PYTHON_BIN}'
else
    PY='python3'
fi
env PYTHONPATH='${APP_DIR}' \"\${PY}\" -m pytest '${APP_DIR}/${TEST_TARGET}' -v --tb=short 2>/dev/null || \
env PYTHONPATH='${APP_DIR}' \"\${PY}\" -m unittest discover '${APP_DIR}/${TEST_TARGET}'
"

echo "=== All Container Tests Completed Successfully! ==="
