#!/usr/bin/env bash
# scripts/lib/detect.sh - Environment, container presence, and deployment state detection
set -euo pipefail

DEPLOY_STATE_NOT_FOUND="NOT_FOUND"
DEPLOY_STATE_UNMANAGED="UNMANAGED"
DEPLOY_STATE_LEGACY="LEGACY"
DEPLOY_STATE_MANAGED="MANAGED"

is_legacy_deployment() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    if ! container_exists "${c_name}"; then
        return 1
    fi

    # Check for legacy .deploy_state with STEP_ markers
    if container_test_file "${c_name}" "${app_dir}/.deploy_state"; then
        if run_in_container "${c_name}" grep -q "^STEP_" "${app_dir}/.deploy_state" 2>/dev/null; then
            if ! container_test_dir "${c_name}" "${app_dir}/releases"; then
                return 0
            fi
        fi
    fi
    return 1
}

is_managed_deployment() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    if ! container_exists "${c_name}"; then
        return 1
    fi

    if container_test_dir "${c_name}" "${app_dir}/releases" && \
       container_test_file "${c_name}" "${app_dir}/.deploy_state"; then
        return 0
    fi
    return 1
}

detect_deployment_state() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    if ! container_exists "${c_name}"; then
        echo "${DEPLOY_STATE_NOT_FOUND}"
        return 0
    fi

    if is_legacy_deployment "${c_name}" "${app_dir}"; then
        echo "${DEPLOY_STATE_LEGACY}"
        return 0
    fi

    if is_managed_deployment "${c_name}" "${app_dir}"; then
        echo "${DEPLOY_STATE_MANAGED}"
        return 0
    fi

    echo "${DEPLOY_STATE_UNMANAGED}"
    return 0
}
