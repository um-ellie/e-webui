#!/usr/bin/env bash
# scripts/lib/common.sh - Shared utilities, logging, ANSI helpers, and trap management
set -euo pipefail

# --- Color & Formatting Configuration ---
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    C_RESET="\033[0m"
    C_BOLD="\033[1m"
    C_DIM="\033[2m"
    C_ITALIC="\033[3m"
    C_UNDERLINE="\033[4m"
    C_BLUE="\033[1;34m"
    C_GREEN="\033[1;32m"
    C_YELLOW="\033[1;33m"
    C_RED="\033[1;31m"
    C_CYAN="\033[1;36m"
    C_MAGENTA="\033[1;35m"
    C_WHITE="\033[1;37m"
    C_GRAY="\033[0;90m"
    C_BG_BLUE="\033[44m"
    C_BG_DARK="\033[40m"
else
    C_RESET=""
    C_BOLD=""
    C_DIM=""
    C_ITALIC=""
    C_UNDERLINE=""
    C_BLUE=""
    C_GREEN=""
    C_YELLOW=""
    C_RED=""
    C_CYAN=""
    C_MAGENTA=""
    C_WHITE=""
    C_GRAY=""
    C_BG_BLUE=""
    C_BG_DARK=""
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

# --- Terminal UI Primitives ---
term_columns() {
    if command -v tput &>/dev/null && [ -t 1 ]; then
        tput cols 2>/dev/null || echo 80
    else
        echo "${COLUMNS:-80}"
    fi
}

term_lines() {
    if command -v tput &>/dev/null && [ -t 1 ]; then
        tput lines 2>/dev/null || echo 24
    else
        echo "${LINES:-24}"
    fi
}

cursor_hide() {
    if [ -t 1 ]; then printf "\033[?25l"; fi
}

cursor_show() {
    if [ -t 1 ]; then printf "\033[?25h"; fi
}

term_clear() {
    if [ -t 1 ]; then printf "\033[2J\033[H"; fi
}

term_clear_line() {
    if [ -t 1 ]; then printf "\033[2K\r"; fi
}

# --- Cleanup Traps ---
declare -a CLEANUP_HOOKS=()

register_cleanup() {
    local hook="$1"
    CLEANUP_HOOKS+=("${hook}")
}

run_cleanup() {
    local exit_code=$?
    cursor_show
    if [ ${#CLEANUP_HOOKS[@]} -gt 0 ]; then
        for ((i=${#CLEANUP_HOOKS[@]}-1; i>=0; i--)); do
            eval "${CLEANUP_HOOKS[i]}" || true
        done
    fi
    exit "${exit_code}"
}

trap run_cleanup EXIT INT TERM
