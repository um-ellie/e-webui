#!/usr/bin/env bash
# scripts/lib/diagnostics.sh - Deployment status inspection, repair, and self-healing
set -euo pipefail

run_status_cli() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local host_port="${3:-8080}"

    banner "Deployment Status Report for '${c_name}'"

    check_incus_installed || exit 2

    if ! container_exists "${c_name}"; then
        warn "Container '${c_name}' does not exist."
        exit 0
    fi

    local status
    status=$(incus_cmd info "${c_name}" 2>/dev/null | awk '/^Status:/ {print $2}')
    echo "Container Name:          ${c_name}"
    echo "Container Runtime:       ${status}"

    if [ "${status}" != "RUNNING" ]; then
        warn "Container is currently stopped. Start it with 'incus start ${c_name}'."
        exit 0
    fi

    if ! state_exists "${c_name}" "${app_dir}"; then
        warn "No deployment state file found at ${app_dir}/.deploy_state."
        echo "Deployment Status:       Unmanaged or incomplete"
        exit 0
    fi

    local active_rel
    active_rel=$(state_get_active_release "${c_name}" "${app_dir}")
    local prev_rel
    prev_rel=$(state_get_previous_healthy_release "${c_name}" "${app_dir}")
    local venv_hash
    venv_hash=$(state_get_active_venv_hash "${c_name}" "${app_dir}")
    local active_ver
    active_ver=$(state_get_active_version "${c_name}" "${app_dir}")
    local git_commit
    git_commit=$(state_get_git_commit "${c_name}" "${app_dir}")

    echo "Active Release:          ${active_rel:-none}"
    if [ -n "${active_ver}" ]; then
        echo "Application Version:     ${active_ver}"
    fi
    if [ -n "${git_commit}" ]; then
        echo "Git Commit:              ${git_commit}"
    fi
    echo "Previous Healthy:        ${prev_rel:-none}"
    echo "Virtualenv Hash:         ${venv_hash:0:16}... (${venv_hash})"

    # Systemd Service State
    if service_is_active "${c_name}"; then
        printf "Systemd Service:         %bactive (running)%b\n" "${C_GREEN}" "${C_RESET}"
    else
        printf "Systemd Service:         %binactive / failed%b\n" "${C_RED}" "${C_RESET}"
    fi

    # HTTP Health Check
    local http_code
    http_code=$(run_in_container "${c_name}" curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${host_port}/api/health" 2>/dev/null || echo "000")
    if [ "${http_code}" = "200" ]; then
        printf "HTTP Health Endpoint:    %bOK (200) on /api/health%b\n" "${C_GREEN}" "${C_RESET}"
    else
        printf "HTTP Health Endpoint:    %bUnreachable (code: %s)%b\n" "${C_RED}" "${http_code}" "${C_RESET}"
    fi

    # Text-to-Speech (TTS) Environment Diagnostic
    echo ""
    echo "Text-to-Speech (TTS) Environment:"

    # 1. System audio packages
    if run_in_container "${c_name}" dpkg -s espeak-ng espeak-ng-data libsndfile1 >/dev/null 2>&1; then
        printf "  System Audio Packages: %bOK (espeak-ng, libsndfile1 installed)%b\n" "${C_GREEN}" "${C_RESET}"
    else
        printf "  System Audio Packages: %bMISSING (run --repair)%b\n" "${C_RED}" "${C_RESET}"
    fi

    # 2. Application Python vs OS Python
    local sys_py
    sys_py=$(run_in_container "${c_name}" python3 -V 2>/dev/null || echo "Unknown")
    local app_py="None"
    if container_test_file "${c_name}" "${app_dir}/current/venv/bin/python3"; then
        app_py=$(run_in_container "${c_name}" "${app_dir}/current/venv/bin/python3" -V 2>/dev/null || echo "Error")
    fi
    echo "  Application Python:    ${app_py}"
    echo "  System OS Python:      ${sys_py}"

    # 3. Python TTS packages (kokoro, soundfile, torch)
    if container_test_file "${c_name}" "${app_dir}/current/venv/bin/python3" && \
       run_in_container "${c_name}" "${app_dir}/current/venv/bin/python3" -c "import kokoro, soundfile, torch; assert not torch.cuda.is_available()" >/dev/null 2>&1; then
        printf "  Python TTS Packages:   %bOK (kokoro, soundfile, torch CPU importable)%b\n" "${C_GREEN}" "${C_RESET}"
    else
        printf "  Python TTS Packages:   %bINCOMPLETE / MISSING (run --repair)%b\n" "${C_YELLOW}" "${C_RESET}"
    fi

    # 4. Kokoro-82M Weights & Voices
    if [ "$(type -t kokoro_model_is_present || true)" = "function" ] && kokoro_model_is_present "${c_name}" "${app_dir}"; then
        local w_size
        w_size=$(run_in_container "${c_name}" wc -c "${app_dir}/shared/models/kokoro/kokoro-v0_19.pth" 2>/dev/null | awk '{print int($1/1000000)}' || echo "327")
        printf "  Kokoro-82M Weights:    %bPRESENT (/opt/e-webui/shared/models/kokoro/kokoro-v0_19.pth, ~%sMB)%b\n" "${C_GREEN}" "${w_size}" "${C_RESET}"
        local v_count
        v_count=$(run_in_container "${c_name}" ls -1 "${app_dir}/shared/models/kokoro/voices" 2>/dev/null | wc -l || echo "0")
        echo "  Voices Available:      ${v_count//[[:space:]]/} voice profiles loaded"
    else
        printf "  Kokoro-82M Weights:    %bMISSING (run --download-model)%b\n" "${C_YELLOW}" "${C_RESET}"
    fi

    # Proxy Devices
    echo ""
    echo "Incus Proxy Configuration:"
    incus_cmd config device show "${c_name}" 2>/dev/null | grep -E "proxy|listen|connect" | sed 's/^/  /' || true

    exit 0
}

run_repair_cli() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local host_port="${3:-8080}"
    local ollama_target="${4:-127.0.0.1:11434}"

    banner "Diagnosing and Repairing Deployment on '${c_name}'"

    check_incus_installed || exit 2
    if ! container_is_running "${c_name}"; then
        info "Starting stopped container '${c_name}'..."
        incus_cmd start "${c_name}"
        sleep 2
    fi

    acquire_lock "${c_name}" "${app_dir}" || exit 2

    info "1. Verifying directory structure and system prerequisites..."
    setup_deployment_directories "${c_name}" "${app_dir}"
    if [ "$(type -t install_system_prerequisites || true)" = "function" ]; then
        install_system_prerequisites "${c_name}"
    fi

    info "2. Inspecting active release pointer..."
    local active_rel
    active_rel=$(state_get_active_release "${c_name}" "${app_dir}")

    if [ -z "${active_rel}" ] || ! container_test_dir "${c_name}" "${app_dir}/releases/${active_rel}"; then
        warn "Active release missing from state or directory missing. Finding latest available release..."
        active_rel=$(run_in_container "${c_name}" ls -1 "${app_dir}/releases" 2>/dev/null | sort | tail -n 1 || true)
    fi

    if [ -z "${active_rel}" ]; then
        error "Repair failed: No releases found in '${app_dir}/releases'. Please run --install."
        exit 3
    fi

    info "Target active release: '${active_rel}'"

    info "3. Verifying and repairing Python runtime and virtual environment..."
    if [ "$(type -t ensure_compatible_python || true)" = "function" ]; then
        ensure_compatible_python "${c_name}" "${app_dir}" >/dev/null 2>&1 || true
    fi

    local venv_hash
    venv_hash=$(state_get_active_venv_hash "${c_name}" "${app_dir}")
    local req_file="${app_dir}/releases/${active_rel}/requirements.txt"
    if [ -n "${venv_hash}" ] && [ "$(type -t ensure_venv_in_container || true)" = "function" ]; then
        ensure_venv_in_container "${c_name}" "${app_dir}" "${req_file}" "${venv_hash}"
    fi

    if [ -n "${venv_hash}" ]; then
        link_release_environment "${c_name}" "${app_dir}" "${active_rel}" "${venv_hash}"
    fi

    info "3b. Verifying Kokoro TTS model weights..."
    if [ "$(type -t ensure_kokoro_model || true)" = "function" ]; then
        ensure_kokoro_model "${c_name}" "${app_dir}" 1
    fi

    info "4. Re-establishing atomic 'current' symlink..."
    atomic_switch_release "${c_name}" "${app_dir}" "${active_rel}"

    info "5. Reinstalling systemd unit and reloading daemon..."
    install_service_unit "${c_name}" "${app_dir}" "${host_port}" "http://${ollama_target}"

    info "6. Restarting service and verifying health..."
    restart_service "${c_name}"

    if verify_http_health "${c_name}" "${host_port}" 15 2; then
        local tts_present=false
        if [ "$(type -t kokoro_model_is_present || true)" = "function" ] && kokoro_model_is_present "${c_name}" "${app_dir}"; then
            tts_present=true
        fi
        if [ "$(type -t state_update_tts_environment || true)" = "function" ]; then
            state_update_tts_environment "${c_name}" "${app_dir}" "3.11" "true" "${tts_present}" "${app_dir}/shared/models/kokoro"
        fi
        success "Deployment repair succeeded! Service is running healthy on release '${active_rel}'."
        exit 0
    else
        error "Repair finished but service health check failed."
        capture_service_logs "${c_name}" 30
        exit 4
    fi
}
