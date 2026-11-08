#!/usr/bin/env bash
# scripts/lib/rollback.sh - Automated and manual rollback engine
set -euo pipefail

execute_rollback() {
    local c_name="$1"
    local app_dir="$2"
    local target_release_id="$3"
    local host_port="$4"

    info "Restoring release pointer to '${target_release_id}'..."
    if ! container_test_dir "${c_name}" "${app_dir}/releases/${target_release_id}"; then
        error "Target release '${target_release_id}' not found in container releases directory."
        return 5
    fi

    # Verify that restored release has its venv symlink intact
    if ! container_test_file "${c_name}" "${app_dir}/releases/${target_release_id}/venv/bin/python3"; then
        warn "Restored release '${target_release_id}' has missing or broken venv symlink. Attempting link repair..."
        local prev_hash
        prev_hash=$(state_read_field "${c_name}" "active_venv_hash" "${app_dir}")
        if [ -n "${prev_hash}" ]; then
            link_release_environment "${c_name}" "${app_dir}" "${target_release_id}" "${prev_hash}"
        fi
    fi

    atomic_switch_release "${c_name}" "${app_dir}" "${target_release_id}"

    info "Restarting service after release pointer restoration..."
    restart_service "${c_name}"

    if verify_http_health "${c_name}" "${host_port}" 15 2; then
        success "Service verified healthy on restored release '${target_release_id}'."
        return 0
    else
        error "Service failed health verification on restored release '${target_release_id}'."
        return 5
    fi
}

trigger_rollback() {
    local c_name="$1"
    local app_dir="$2"
    local failed_release_id="$3"
    local host_port="$4"

    banner "AUTOMATIC ROLLBACK INITIATED"
    warn "New release '${failed_release_id}' failed verification. Attempting automatic recovery..."

    local prev_rel
    prev_rel=$(state_get_previous_healthy_release "${c_name}" "${app_dir}")

    if [ -z "${prev_rel}" ]; then
        error "Rollback aborted: No previous healthy release recorded in deployment state."
        warn "Failed release '${failed_release_id}' remains active for inspection."
        return 5
    fi

    info "Identified previous healthy release: '${prev_rel}'"

    if execute_rollback "${c_name}" "${app_dir}" "${prev_rel}" "${host_port}"; then
        state_record_rollback "${c_name}" "${app_dir}" "${failed_release_id}" "${prev_rel}"
        warn "Automatic rollback completed: restored healthy release '${prev_rel}'."
        info "Note: Failed release artifacts preserved at '${app_dir}/releases/${failed_release_id}' for post-mortem analysis."
        return 0
    else
        error "CRITICAL: Automatic rollback to '${prev_rel}' failed!"
        capture_service_logs "${c_name}" 50
        return 5
    fi
}

run_rollback_cli() {
    local c_name="$1"
    local app_dir="$2"
    local host_port="$3"

    banner "Manual Rollback Request for '${c_name}'"

    check_incus_installed || exit 2
    if ! container_is_running "${c_name}"; then
        error "Container '${c_name}' is not running. Cannot execute rollback."
        exit 2
    fi

    acquire_lock "${c_name}" "${app_dir}" || exit 2

    local current_rel
    current_rel=$(state_get_active_release "${c_name}" "${app_dir}")
    local prev_rel
    prev_rel=$(state_get_previous_healthy_release "${c_name}" "${app_dir}")

    if [ -z "${prev_rel}" ]; then
        error "No prior healthy release found in deployment state to roll back to."
        exit 2
    fi

    info "Active release is '${current_rel:-unknown}'."
    info "Rolling back to previous healthy release '${prev_rel}'..."

    if execute_rollback "${c_name}" "${app_dir}" "${prev_rel}" "${host_port}"; then
        state_record_rollback "${c_name}" "${app_dir}" "${current_rel}" "${prev_rel}"
        success "Manual rollback to '${prev_rel}' completed successfully."
        exit 0
    else
        error "Manual rollback to '${prev_rel}' failed."
        exit 5
    fi
}
