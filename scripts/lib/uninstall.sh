#!/usr/bin/env bash
# scripts/lib/uninstall.sh - Safe service teardown, proxy cleanup, and persistent data protection
set -euo pipefail

run_uninstall_cli() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local purge_data="${3:-0}"

    banner "Initiating e-webui Deployment Teardown on '${c_name}'"

    check_incus_installed || exit 2

    if ! container_exists "${c_name}"; then
        warn "Container '${c_name}' does not exist. Nothing to uninstall."
        exit 0
    fi

    acquire_lock "${c_name}" "${app_dir}" || exit 2

    info "Stopping and removing systemd service 'e-webui'..."
    remove_service "${c_name}"

    info "Removing Incus proxy devices ('webui-proxy', 'ollama-link')..."
    incus_cmd config device remove "${c_name}" webui-proxy 2>/dev/null || true
    incus_cmd config device remove "${c_name}" ollama-link 2>/dev/null || true

    info "Removing application releases, virtual environments, and staging state..."
    run_in_container "${c_name}" rm -rf \
        "${app_dir}/current" \
        "${app_dir}/current_next" \
        "${app_dir}/releases" \
        "${app_dir}/venvs" \
        "${app_dir}/staging" \
        "${app_dir}/.deploy_state" \
        "${app_dir}/deployment.env" 2>/dev/null || true

    if [ "${purge_data}" -eq 1 ]; then
        warn "Purging persistent user data and configuration (--purge-data specified)..."
        run_in_container "${c_name}" rm -rf "${app_dir}/shared" 2>/dev/null || true
        run_in_container "${c_name}" rm -rf "${app_dir}" 2>/dev/null || true
        success "Complete teardown performed (including shared data)."
    else
        success "Teardown complete. Persistent data preserved at '${app_dir}/shared'."
        info "To remove all persistent data, re-run with --purge-data."
    fi

    release_lock "${c_name}" "${app_dir}"
    return 0
}
