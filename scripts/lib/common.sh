#!/usr/bin/env bash
# scripts/lib/common.sh - Shared utilities, logging, and trap management
set -euo pipefail

# --- Color Configuration ---
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    C_RESET="\033[0m"
    C_BOLD="\033[1m"
    C_BLUE="\033[1;34m"
    C_GREEN="\033[1;32m"
    C_YELLOW="\033[1;33m"
    C_RED="\033[1;31m"
    C_CYAN="\033[1;36m"
else
    C_RESET=""
    C_BOLD=""
    C_BLUE=""
    C_GREEN=""
    C_YELLOW=""
    C_RED=""
    C_CYAN=""
fi

# --- Logging Helpers ---
info() {
    printf "%b[INFO]%b %s\n" "${C_BLUE}" "${C_RESET}" "$*"
}

success() {
    printf "%b[SUCCESS]%b %s\n" "${C_GREEN}" "${C_RESET}" "$*"
}

warn() {
    printf "%b[WARNING]%b %s\n" "${C_YELLOW}" "${C_RESET}" "$*"
}

error() {
    printf "%b[ERROR]%b %s\n" "${C_RED}" "${C_RESET}" "$*" >&2
}

banner() {
    printf "\n%b============================================================%b\n" "${C_BOLD}${C_CYAN}" "${C_RESET}"
    printf "%b%s%b\n" "${C_BOLD}${C_CYAN}" "$*" "${C_RESET}"
    printf "%b============================================================%b\n\n" "${C_BOLD}${C_CYAN}" "${C_RESET}"
}

# --- Cleanup Traps ---
declare -a CLEANUP_HOOKS=()

register_cleanup() {
    local hook="$1"
    CLEANUP_HOOKS+=("${hook}")
}

run_cleanup() {
    local exit_code=$?
    if [ ${#CLEANUP_HOOKS[@]} -gt 0 ]; then
        for ((i=${#CLEANUP_HOOKS[@]}-1; i>=0; i--)); do
            eval "${CLEANUP_HOOKS[i]}" || true
        done
    fi
    exit "${exit_code}"
}

trap run_cleanup EXIT INT TERM
