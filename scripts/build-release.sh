#!/usr/bin/env bash
# scripts/build-release.sh - e-webui Release Artifact Packaging CLI
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"

source "${LIB_DIR}/common.sh"
source "${LIB_DIR}/builder.sh"

OUTPUT_DIR="${REPO_ROOT}/dist/releases"
OVERRIDE_VERSION=""
STRICT_MODE=0
ARCHIVE_ONLY=0
DIR_ONLY=0

show_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

e-webui Release Packaging Builder.
Constructs standardized, verified, and immutable release packages.

Options:
  -o, --output-dir <DIR>  Output directory for published releases (default: dist/releases)
  -v, --version <VER>     Override semantic version string (default: read from app/main.py)
  --strict                Fail if Git working tree contains uncommitted changes
  --archive-only          Only publish compressed .tar.gz bundle
  --dir-only              Only publish uncompressed release directory
  -h, --help              Show this help message and exit

Exit Codes:
  0    Success
  1    User abort / interrupted
  2    Pre-check / configuration error / dirty git tree in --strict
  3    Packaging or verification failure
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -o|--output-dir)
            if [ -n "${2:-}" ]; then
                OUTPUT_DIR="$2"
                shift 2
            else
                error "Option --output-dir requires a directory path."
                exit 2
            fi
            ;;
        -v|--version)
            if [ -n "${2:-}" ]; then
                OVERRIDE_VERSION="$2"
                shift 2
            else
                error "Option --version requires a version string."
                exit 2
            fi
            ;;
        --strict)
            STRICT_MODE=1
            shift
            ;;
        --archive-only)
            ARCHIVE_ONLY=1
            shift
            ;;
        --dir-only)
            DIR_ONLY=1
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 2
            ;;
    esac
done

main() {
    banner "Initiating e-webui Release Packaging"
    build_release_package \
        "${REPO_ROOT}" \
        "${OUTPUT_DIR}" \
        "${OVERRIDE_VERSION}" \
        "${STRICT_MODE}" \
        "${ARCHIVE_ONLY}" \
        "${DIR_ONLY}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
