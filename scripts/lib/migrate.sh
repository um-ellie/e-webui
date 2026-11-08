#!/usr/bin/env bash
# scripts/lib/migrate.sh - Automated, non-destructive migration for legacy flat deployments
set -euo pipefail

migrate_legacy_deployment() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local host_port="${3:-8080}"
    local ollama_target="${4:-127.0.0.1:11434}"

    banner "MIGRATING LEGACY DEPLOYMENT TO RELEASE ARCHITECTURE"
    info "Target container: '${c_name}'"

    # Stop service before moving directories
    info "Stopping running e-webui service..."
    stop_service "${c_name}"

    # Setup target directories
    info "Creating versioned deployment hierarchy in '${app_dir}'..."
    setup_deployment_directories "${c_name}" "${app_dir}"

    # Calculate requirements hash
    local venv_hash
    if container_test_file "${c_name}" "${app_dir}/requirements.txt"; then
        venv_hash=$(run_in_container "${c_name}" sha256sum "${app_dir}/requirements.txt" | awk '{print $1}')
    else
        venv_hash="legacy-venv-$(date +%s)"
    fi

    # Move existing venv to venvs/<hash>
    local target_venv="${app_dir}/venvs/${venv_hash}"
    if container_test_dir "${c_name}" "${app_dir}/venv"; then
        info "Preserving existing Python virtual environment -> ${target_venv}..."
        run_in_container "${c_name}" mv "${app_dir}/venv" "${target_venv}"
    fi

    # Create legacy-initial release
    local legacy_rel="legacy-initial"
    local release_dir="${app_dir}/releases/${legacy_rel}"
    run_in_container "${c_name}" mkdir -p "${release_dir}"

    # Move existing application code
    if container_test_dir "${c_name}" "${app_dir}/app"; then
        info "Moving existing application code -> ${release_dir}/app..."
        run_in_container "${c_name}" mv "${app_dir}/app" "${release_dir}/app"
    fi

    if container_test_file "${c_name}" "${app_dir}/requirements.txt"; then
        run_in_container "${c_name}" mv "${app_dir}/requirements.txt" "${release_dir}/requirements.txt"
    fi

    # Move .env if present
    if container_test_file "${c_name}" "${app_dir}/.env"; then
        info "Moving persistent configuration -> ${app_dir}/shared/.env..."
        run_in_container "${c_name}" mv "${app_dir}/.env" "${app_dir}/shared/.env"
    fi

    # Link environment and data
    link_release_environment "${c_name}" "${app_dir}" "${legacy_rel}" "${venv_hash}"

    # Establish atomic current pointer
    atomic_switch_release "${c_name}" "${app_dir}" "${legacy_rel}"

    # Update systemd service unit to point to stable current
    info "Updating systemd unit file with release-based paths..."
    install_service_unit "${c_name}" "${app_dir}" "${host_port}" "http://${ollama_target}"

    # Restart service & verify health
    info "Starting migrated service..."
    restart_service "${c_name}"

    if verify_http_health "${c_name}" "${host_port}" 15 2; then
        state_commit_release "${c_name}" "${app_dir}" "${legacy_rel}" "${venv_hash}" "${host_port}" "${ollama_target}"
        success "Legacy deployment successfully migrated to release-based lifecycle manager!"
        return 0
    else
        error "Health check failed after migration."
        return 4
    fi
}

run_migrate() {
    acquire_lock "${CONTAINER_NAME}" "${APP_DIR}" || exit 2
    migrate_legacy_deployment "${CONTAINER_NAME}" "${APP_DIR}" "${HOST_PORT}" "${OLLAMA_TARGET}"
    release_lock "${CONTAINER_NAME}" "${APP_DIR}"
}
