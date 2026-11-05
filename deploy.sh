#!/usr/bin/env bash
# Root wrapper for e-webui deployment
# Conforms to spec: specs/004-enhance-deployment-script/spec.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/scripts/deploy.sh"

if [ ! -f "${TARGET_SCRIPT}" ]; then
    printf "\033[1;31m[ERROR]\033[0m Target deployment script not found at %s\n" "${TARGET_SCRIPT}" >&2
    exit 2
fi

exec "${TARGET_SCRIPT}" "$@"
