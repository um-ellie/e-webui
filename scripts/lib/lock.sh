#!/usr/bin/env bash
# scripts/lib/lock.sh - Exclusive container deployment concurrency lock
set -euo pipefail

LOCK_DIR="/opt/e-webui/.deploy.lock"

acquire_lock() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local lock_path="${app_dir}/.deploy.lock"

    if ! container_is_running "${c_name}"; then
        # Container not running yet; cannot acquire container lock
        return 0
    fi

    # Ensure parent directory exists
    run_in_container "${c_name}" mkdir -p "${app_dir}" 2>/dev/null || true

    # Attempt atomic directory creation
    if ! run_in_container "${c_name}" mkdir "${lock_path}" 2>/dev/null; then
        error "Exclusive lock failed: Another deployment operation is currently in progress on container '${c_name}' (${lock_path})."
        return 2
    fi

    # Write lock metadata safely using positional arguments
    local safe_user="${USER:-unknown}"
    safe_user="${safe_user//\'/}"
    local lock_info="pid=$$;time=$(date -u +"%Y-%m-%dT%H:%M:%SZ");user=${safe_user}"
    run_in_container_bash "${c_name}" "printf '%s\n' '${lock_info}' > '${lock_path}/info'" 2>/dev/null || true

    # Register automatic release trap
    register_cleanup "release_lock '${c_name}' '${app_dir}'"
    return 0
}

release_lock() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local lock_path="${app_dir}/.deploy.lock"

    if container_is_running "${c_name}"; then
        run_in_container "${c_name}" rm -rf "${lock_path}" 2>/dev/null || true
    fi
}
