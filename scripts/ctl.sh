#!/usr/bin/env bash
# scripts/ctl.sh - Interactive Terminal Control Center for e-webui
set -euo pipefail

CTL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${CTL_DIR}/.." && pwd)"
LIB_DIR="${CTL_DIR}/lib"

source "${LIB_DIR}/common.sh"
source "${LIB_DIR}/incus.sh"
source "${LIB_DIR}/state.sh"
source "${LIB_DIR}/service.sh"
source "${LIB_DIR}/health.sh"
source "${LIB_DIR}/tui.sh"
source "${LIB_DIR}/detect.sh"

CONTAINER_NAME="${1:-e-webui-app}"
APP_DIR="/opt/e-webui"
DEPLOY_SCRIPT="${CTL_DIR}/deploy.sh"

get_container_memory_rss() {
    local c_name="$1"
    if ! container_is_running "${c_name}"; then
        echo "0 MB"
        return
    fi
    local mem_kb
    mem_kb=$(run_in_container "${c_name}" ps -o rss= -C uvicorn 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
    if [ -n "${mem_kb}" ] && [ "${mem_kb}" -gt 0 ]; then
        local mem_mb=$((mem_kb / 1024))
        echo "${mem_mb} MB"
    else
        echo "Under 50 MB"
    fi
}

get_ollama_status() {
    local c_name="$1"
    local port="${2:-8080}"
    if ! container_is_running "${c_name}"; then
        echo "OFFLINE"
        return
    fi
    local body
    body=$(run_in_container "${c_name}" curl -s -m 2 "http://127.0.0.1:${port}/api/health" 2>/dev/null || true)
    if [ -z "${body}" ]; then
        echo "UNREACHABLE"
    elif echo "${body}" | grep -q '"ollama_connected":true'; then
        local m_count
        m_count=$(run_in_container "${c_name}" curl -s -m 2 "http://127.0.0.1:${port}/api/models" 2>/dev/null | grep -o '"name":' | wc -l || echo "0")
        echo "ONLINE (${m_count} models)"
    else
        echo "DISCONNECTED"
    fi
}

action_stream_logs() {
    term_clear
    banner "Live Streaming Journal Logs: e-webui.service"
    info "Press Ctrl+C at any time to return to the Control Center menu."
    printf "\n"

    # Trap SIGINT to return cleanly to menu loop rather than exiting script
    trap 'printf "\n%b[INFO] Stopped log streaming.%b\n" "${C_BLUE}" "${C_RESET}"' INT
    run_in_container "${CONTAINER_NAME}" journalctl -u e-webui -f -n 50 --no-tail || true
    trap run_cleanup EXIT INT TERM
    tui_pause
}

action_service_control() {
    while true; do
        term_clear
        tui_header "Service Control: ${CONTAINER_NAME}"
        local s_status="inactive"
        if service_is_active "${CONTAINER_NAME}"; then s_status="active"; fi
        printf " Current Service State: %s\n\n" "$(tui_badge "${s_status}" "${s_status}")"
        printf "  [1] Restart Service (instant restart)\n"
        printf "  [2] Stop Service\n"
        printf "  [3] Start Service\n"
        printf "  [b] Back to Main Menu\n\n"
        printf "%bSelect action [1-3, b]: %b" "${C_BOLD}" "${C_RESET}"
        read -r s_choice || true
        case "${s_choice}" in
            1)
                info "Restarting e-webui service..."
                restart_service "${CONTAINER_NAME}"
                sleep 1
                success "Service restarted."
                tui_pause
                ;;
            2)
                info "Stopping e-webui service..."
                stop_service "${CONTAINER_NAME}"
                success "Service stopped."
                tui_pause
                ;;
            3)
                info "Starting e-webui service..."
                restart_service "${CONTAINER_NAME}"
                sleep 1
                success "Service started."
                tui_pause
                ;;
            b|B|0)
                break
                ;;
            *)
                warn "Invalid selection."
                sleep 1
                ;;
        esac
    done
}

action_fast_dev_sync() {
    term_clear
    banner "Fast Dev-Sync: Workspace -> ${CONTAINER_NAME}"
    info "Syncing 'app/' directory directly into active container for rapid hot-reload..."

    if ! container_is_running "${CONTAINER_NAME}"; then
        error "Container '${CONTAINER_NAME}' is not running."
        tui_pause
        return
    fi

    # Push app directory
    container_push_dir_contents "${REPO_ROOT}/app" "${CONTAINER_NAME}${APP_DIR}/current/app/"
    success "Source files synchronized into ${APP_DIR}/current/app/."

    info "Signaling service reload..."
    restart_service "${CONTAINER_NAME}"
    sleep 1

    if verify_http_health "${CONTAINER_NAME}" 8080 5 1; then
        success "Fast Dev-Sync successfully applied and verified healthy!"
    else
        warn "Service reloaded but health check returned non-200. Inspect logs for errors."
    fi
    tui_pause
}

action_change_port() {
    term_clear
    banner "Configure Host Listen Port"
    local cur_port
    cur_port=$(state_read_field "${CONTAINER_NAME}" "host_port" "${APP_DIR}")
    cur_port="${cur_port:-8080}"
    printf " Current Host Listen Port: %b%s%b\n\n" "${C_BOLD}${C_CYAN}" "${cur_port}" "${C_RESET}"
    printf "%bEnter new host port (1024-65535, or empty to cancel): %b" "${C_BOLD}" "${C_RESET}"
    read -r new_p || true
    if [ -n "${new_p}" ] && [[ "${new_p}" =~ ^[0-9]+$ ]] && [ "${new_p}" -ge 1024 ] && [ "${new_p}" -le 65535 ]; then
        info "Updating host proxy device to port ${new_p}..."
        configure_proxy_devices "${CONTAINER_NAME}" "${new_p}" "127.0.0.1:11434"
        run_in_container_bash "${CONTAINER_NAME}" "sed -i 's/\"host_port\": .*/\"host_port\": ${new_p},/' '${APP_DIR}/.deploy_state' 2>/dev/null || true"
        success "Host proxy listen port updated to ${new_p}. Access UI at http://127.0.0.1:${new_p}"
    else
        warn "Port change cancelled."
    fi
    tui_pause
}

action_manage_profiles() {
    while true; do
        term_clear
        tui_header "Modular Deployment Profiles"
        local cur_prof
        cur_prof=$(state_get_profile "${CONTAINER_NAME}" "${APP_DIR}")
        printf " Active Profile: %b%s%b\n\n" "${C_BOLD}${C_CYAN}" "${cur_prof}" "${C_RESET}"
        printf "  [1] Core Profile (<50MB RAM, zero PyTorch, ultra-fast chat)\n"
        printf "  [2] TTS Profile (Speech synthesis & Kokoro-82M model)\n"
        printf "  [b] Back to Main Menu\n\n"
        printf "%bSelect profile [1-2, b]: %b" "${C_BOLD}" "${C_RESET}"
        read -r p_choice || true
        case "${p_choice}" in
            1)
                info "Setting active profile to Core..."
                run_in_container_bash "${CONTAINER_NAME}" "sed -i 's/\"profile\": .*/\"profile\": \"core\",/' '${APP_DIR}/.deploy_state' 2>/dev/null || true"
                success "Core profile selected. Core uses <50MB RAM."
                tui_pause
                break
                ;;
            2)
                info "Acquiring Kokoro TTS model assets..."
                "${DEPLOY_SCRIPT}" --download-model "${CONTAINER_NAME}" || true
                tui_pause
                break
                ;;
            b|B|0)
                break
                ;;
            *)
                warn "Invalid selection."
                sleep 1
                ;;
        esac
    done
}

main_interactive_loop() {
    check_incus_installed || exit 2

    # Check deployment state
    local dep_state
    dep_state=$(detect_deployment_state "${CONTAINER_NAME}" "${APP_DIR}")
    if [ "${dep_state}" = "${DEPLOY_STATE_NOT_FOUND}" ]; then
        warn "Container '${CONTAINER_NAME}' does not exist."
        printf "%bWould you like to perform initial installation? [y/N]: %b" "${C_BOLD}" "${C_RESET}"
        read -r init_resp || true
        case "${init_resp}" in
            [yY]|[yY][eE][sS])
                "${DEPLOY_SCRIPT}" --install "${CONTAINER_NAME}"
                ;;
            *)
                error "Exiting. Cannot manage non-existent container."
                exit 0
                ;;
        esac
    fi

    while true; do
        term_clear
        tui_header "e-webui Control Center v1.1.0"

        # Inspect metrics
        local c_status="STOPPED"
        if container_is_running "${CONTAINER_NAME}"; then c_status="RUNNING"; fi

        local s_status="inactive"
        if [ "${c_status}" = "RUNNING" ] && service_is_active "${CONTAINER_NAME}"; then
            s_status="active"
        fi

        local active_rel="none"
        local active_ver="1.0.0"
        local host_port=8080
        local profile="core"

        if [ "${c_status}" = "RUNNING" ] && state_exists "${CONTAINER_NAME}" "${APP_DIR}"; then
            active_rel=$(state_get_active_release "${CONTAINER_NAME}" "${APP_DIR}")
            active_ver=$(state_get_active_version "${CONTAINER_NAME}" "${APP_DIR}")
            profile=$(state_get_profile "${CONTAINER_NAME}" "${APP_DIR}")
            host_port=$(state_read_field "${CONTAINER_NAME}" "host_port" "${APP_DIR}")
            host_port="${host_port:-8080}"
        fi

        local http_code="000"
        if [ "${c_status}" = "RUNNING" ]; then
            http_code=$(run_in_container "${CONTAINER_NAME}" curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8080/api/health" 2>/dev/null || echo "000")
        fi

        local ollama_stat="OFFLINE"
        if [ "${c_status}" = "RUNNING" ]; then
            ollama_stat=$(get_ollama_status "${CONTAINER_NAME}" 8080)
        fi

        local mem_rss
        mem_rss=$(get_container_memory_rss "${CONTAINER_NAME}")

        tui_render_dashboard \
            "${CONTAINER_NAME}" \
            "${c_status}" \
            "${s_status}" \
            "${http_code}" \
            "${ollama_stat}" \
            "${active_rel}" \
            "${active_ver}" \
            "${profile}" \
            "${host_port}" \
            "${mem_rss}"

        tui_render_menu
        printf "%bSelect option [0-8]: %b" "${C_BOLD}" "${C_RESET}"
        read -r choice || true

        case "${choice}" in
            1)
                term_clear
                info "Triggering Smart Update..."
                "${DEPLOY_SCRIPT}" --update "${CONTAINER_NAME}" || true
                tui_pause
                ;;
            2)
                action_fast_dev_sync
                ;;
            3)
                action_service_control
                ;;
            4)
                action_stream_logs
                ;;
            5)
                term_clear
                info "Initiating Rollback..."
                "${DEPLOY_SCRIPT}" --rollback "${CONTAINER_NAME}" || true
                tui_pause
                ;;
            6)
                term_clear
                info "Running Diagnostics and Auto-Repair..."
                "${DEPLOY_SCRIPT}" --repair "${CONTAINER_NAME}" || true
                tui_pause
                ;;
            7)
                action_manage_profiles
                ;;
            8)
                action_change_port
                ;;
            9)
                term_clear
                info "Executing Test Suite..."
                "${REPO_ROOT}/scripts/test.sh" --local || true
                tui_pause
                ;;
            0|q|Q|exit)
                term_clear
                info "Exiting e-webui Control Center."
                exit 0
                ;;
            *)
                warn "Unknown option '${choice}'. Please select a valid number."
                sleep 1
                ;;
        esac
    done
}

# Allow CLI flags if passed directly to ctl (e.g. ./ctl --status)
if [ $# -gt 0 ] && [[ "$1" == --* ]]; then
    exec "${DEPLOY_SCRIPT}" "$@"
else
    main_interactive_loop "$@"
fi
