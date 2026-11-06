#!/usr/bin/env bash
# Root wrapper for e-webui release packaging
# Conforms to spec: specs/009-release-artifact-packaging/spec.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/scripts/build-release.sh"

if [ ! -f "${TARGET_SCRIPT}" ]; then
    printf "\033[1;31m[ERROR]\033[0m Target release build script not found at %s\n" "${TARGET_SCRIPT}" >&2
    exit 2
fi

exec "${TARGET_SCRIPT}" "$@"
