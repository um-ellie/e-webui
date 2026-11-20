#!/usr/bin/env bash
# ctl - Interactive Control Center entrypoint for e-webui
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/scripts/ctl.sh"

if [ ! -f "${TARGET_SCRIPT}" ]; then
    printf "\033[1;31m[ERROR]\033[0m Target control script not found at %s\n" "${TARGET_SCRIPT}" >&2
    exit 2
fi

exec "${TARGET_SCRIPT}" "$@"
