#!/usr/bin/env bash
# scripts/lib/incus.sh - Safe Incus CLI wrapper and container interaction helpers
set -euo pipefail

INCUS_BIN="${INCUS_BIN:-incus}"

check_incus_installed() {
    if ! command -v "${INCUS_BIN}" &>/dev/null; then
        error "Incus command '${INCUS_BIN}' not found on host. Please install Incus or set INCUS_BIN."
        return 2
    fi
    return 0
}

incus_cmd() {
    "${INCUS_BIN}" "$@"
}

container_exists() {
    local c_name="$1"
    incus_cmd info "${c_name}" &>/dev/null
}

container_is_running() {
    local c_name="$1"
    if ! container_exists "${c_name}"; then
        return 1
    fi
    local status
    status=$(incus_cmd info "${c_name}" 2>/dev/null | awk '/^Status:/ {print $2}')
    [ "${status}" = "RUNNING" ]
}

run_in_container() {
    local c_name="$1"
    shift
    incus_cmd exec "${c_name}" -- "$@"
}

run_in_container_bash() {
    local c_name="$1"
    local script_str="$2"
    incus_cmd exec "${c_name}" -- bash -c "${script_str}"
}

container_test_file() {
    local c_name="$1"
    local file_path="$2"
    run_in_container "${c_name}" test -f "${file_path}"
}

container_test_dir() {
    local c_name="$1"
    local dir_path="$2"
    run_in_container "${c_name}" test -d "${dir_path}"
}

container_push() {
    local src="$1"
    local dest="$2"
    # dest format: <container>/<path>
    if [ -d "${src}" ]; then
        incus_cmd file push -p -r "${src}" "${dest}"
    else
        incus_cmd file push -p "${src}" "${dest}"
    fi
}

container_push_dir_contents() {
    local src_dir="$1"
    local dest="$2"
    # Ensure trailing slash so incus treats dest as destination directory
    [[ "${dest}" != */ ]] && dest="${dest}/"

    local items=()
    for item in "${src_dir}"/*; do
        [ -e "${item}" ] && items+=("${item}")
    done
    if [ ${#items[@]} -gt 0 ]; then
        incus_cmd file push -p -r "${items[@]}" "${dest}"
    fi
}
