#!/usr/bin/env bash
# scripts/lib/tui.sh - Terminal User Interface components, dashboard cards, and interactive prompts
set -euo pipefail

TUI_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${TUI_LIB_DIR}/common.sh"

tui_badge() {
    local text="$1"
    local variant="${2:-info}"

    case "${variant}" in
        success|ok|running|active|healthy)
            printf "%b● %s%b" "${C_GREEN}" "${text}" "${C_RESET}"
            ;;
        error|failed|stopped|unreachable|inactive)
            printf "%b● %s%b" "${C_RED}" "${text}" "${C_RESET}"
            ;;
        warning|degraded|offline|missing)
            printf "%b▲ %s%b" "${C_YELLOW}" "${text}" "${C_RESET}"
            ;;
        *)
            printf "%b○ %s%b" "${C_CYAN}" "${text}" "${C_RESET}"
            ;;
    esac
}

tui_rule() {
    local char="${1:-─}"
    local width
    width=$(term_columns)
    if [ "${width}" -gt 80 ]; then width=80; fi
    printf "%b" "${C_GRAY}"
    printf "%*s\n" "${width}" "" | tr " " "${char}"
    printf "%b" "${C_RESET}"
}

tui_header() {
    local title="${1:-e-webui Control Center}"
    local width
    width=$(term_columns)
    if [ "${width}" -gt 80 ]; then width=80; fi

    printf "\n%b" "${C_BOLD}${C_CYAN}"
    printf "┌"
    printf "%*s" $((width - 2)) "" | tr " " "─"
    printf "┐\n"

    # Centered title
    local title_len=${#title}
    local pad_left=$(( (width - 2 - title_len) / 2 ))
    local pad_right=$(( width - 2 - title_len - pad_left ))
    printf "│%*s%s%*s│\n" "${pad_left}" "" "${title}" "${pad_right}" ""

    printf "└"
    printf "%*s" $((width - 2)) "" | tr " " "─"
    printf "┘\n%b" "${C_RESET}"
}

tui_render_dashboard() {
    local c_name="$1"
    local c_status="$2"
    local s_status="$3"
    local http_code="$4"
    local ollama_status="$5"
    local active_rel="$6"
    local active_ver="$7"
    local profile="$8"
    local host_port="$9"
    local mem_rss="${10:-Unknown}"

    local width=78

    printf "%b┌────────────────────────────────────────────────────────────────────────────┐%b\n" "${C_CYAN}" "${C_RESET}"
    printf "%b│%b  %bContainer:%b   %-25s %bHost Proxy:%b  http://127.0.0.1:%-10s%b│%b\n" \
        "${C_CYAN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}" "$(tui_badge "${c_name} (${c_status})" "${c_status,,}")" \
        "${C_BOLD}" "${C_RESET}" "${host_port}" "${C_CYAN}" "${C_RESET}"

    local s_variant="failed"
    if [ "${s_status}" = "active (running)" ] || [ "${s_status}" = "active" ]; then s_variant="healthy"; fi
    printf "%b│%b  %bService:%b     %-25s %bHealth Check:%b%-16s%b│%b\n" \
        "${C_CYAN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}" "$(tui_badge "${s_status}" "${s_variant}")" \
        "${C_BOLD}" "${C_RESET}" " $([ "${http_code}" = "200" ] && tui_badge "HTTP 200 OK" "healthy" || tui_badge "Code: ${http_code}" "failed")" "${C_CYAN}" "${C_RESET}"

    local o_variant="healthy"
    if [[ "${ollama_status}" =~ (OFFLINE|ERROR|DISCONNECTED) ]]; then o_variant="offline"; fi
    printf "%b│%b  %bOllama:%b      %-25s %bActive Rel:%b  %-18s%b│%b\n" \
        "${C_CYAN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}" "$(tui_badge "${ollama_status}" "${o_variant}")" \
        "${C_BOLD}" "${C_RESET}" "${active_rel:0:18}" "${C_CYAN}" "${C_RESET}"

    printf "%b│%b  %bProfile:%b     %-25s %bVersion:%b     %-18s%b│%b\n" \
        "${C_CYAN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}" "${profile:-core}" \
        "${C_BOLD}" "${C_RESET}" "${active_ver:-1.0.0}" "${C_CYAN}" "${C_RESET}"

    if [ -n "${mem_rss}" ] && [ "${mem_rss}" != "Unknown" ]; then
        printf "%b│%b  %bMemory RSS:%b  %-59s%b│%b\n" \
            "${C_CYAN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}" "${mem_rss}" "${C_CYAN}" "${C_RESET}"
    fi

    printf "%b└────────────────────────────────────────────────────────────────────────────┘%b\n" "${C_CYAN}" "${C_RESET}"
}

tui_render_menu() {
    printf "\n%bAvailable Actions:%b\n" "${C_BOLD}" "${C_RESET}"
    printf "  %b[1]%b %bSmart Update%b        - Auto-package workspace changes & hot-switch\n" "${C_GREEN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[2]%b %bFast Dev-Sync%b       - Rapid code synchronization (hot-reload)\n" "${C_CYAN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[3]%b %bService Control%b     - Restart, stop, or start e-webui service\n" "${C_BLUE}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[4]%b %bLive Logs%b           - Stream journalctl logs in real-time\n" "${C_YELLOW}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[5]%b %bRollback%b            - Restore previous healthy release\n" "${C_MAGENTA}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[6]%b %bDiagnostics & Repair%b- Audit symlinks, venvs, and auto-heal\n" "${C_CYAN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[7]%b %bModular Profiles%b    - Configure Core (<50MB) vs Kokoro TTS profile\n" "${C_BLUE}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[8]%b %bChange Host Port%b    - Bind host proxy to a custom port\n" "${C_MAGENTA}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[9]%b %bRun Test Suite%b      - Execute unit & integration test runner\n" "${C_GREEN}" "${C_RESET}" "${C_BOLD}" "${C_RESET}"
    printf "  %b[0]%b Exit\n\n" "${C_GRAY}" "${C_RESET}"
}

tui_pause() {
    local prompt="${1:-Press Enter to return to menu...}"
    printf "\n%b%s%b" "${C_DIM}" "${prompt}" "${C_RESET}"
    read -r _ || true
}
