#!/usr/bin/env bash
# scripts/lib/lock.sh - Exclusive container deployment concurrency lock with self-healing lease expiration
set -euo pipefail

LOCK_DIR="/opt/e-webui/.deploy.lock"
LOCK_STALE_TIMEOUT_SECONDS=600 # 10 minutes

is_lock_stale() {
    local c_name="$1"
    local lock_path="$2"

    if ! container_test_file "${c_name}" "${lock_path}/info"; then
        return 0
    fi

    local info_str
    info_str=$(run_in_container "${c_name}" cat "${lock_path}/info" 2>/dev/null || echo "")

    local py_check="import os, datetime, sys
info = '''${info_str}'''
d = {}
for part in info.strip().split(';'):
    if '=' in part:
        k, v = part.split('=', 1)
        d[k.strip()] = v.strip()

t_str = d.get('time', '')
pid_str = d.get('pid', '')
if not t_str:
    sys.exit(0) # Stale if no time

try:
    lock_time = datetime.datetime.fromisoformat(t_str.replace('Z', '+00:00'))
    now = datetime.datetime.now(datetime.timezone.utc)
    diff = (now - lock_time).total_seconds()
    if diff > ${LOCK_STALE_TIMEOUT_SECONDS}:
        sys.exit(0) # Expired / stale
except Exception:
    sys.exit(0)

# Check if PID is alive on current host
if pid_str and pid_str.isdigit():
    pid = int(pid_str)
    try:
        os.kill(pid, 0)
    except OSError:
        sys.exit(0) # PID not running -> stale

sys.exit(1) # Active
"
    python3 -c "${py_check}" 2>/dev/null
}

acquire_lock() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local lock_path="${app_dir}/.deploy.lock"

    if ! container_is_running "${c_name}"; then
        return 0
    fi

    run_in_container "${c_name}" mkdir -p "${app_dir}" 2>/dev/null || true

    # Check if lock exists and can be healed or reset
    if container_test_dir "${c_name}" "${lock_path}"; then
        local do_reclaim=0
        if [ "${FORCE_RESET:-0}" -eq 1 ]; then
            do_reclaim=1
        elif is_lock_stale "${c_name}" "${lock_path}"; then
            if [ -t 0 ] && [ "${NON_INTERACTIVE:-0}" -eq 0 ]; then
                warn "A stale deployment lock was detected on container '${c_name}'."
                printf "%bReclaim expired lock and proceed? [Y/n]: %b" "${C_BOLD}" "${C_RESET}"
                read -r resp || true
                case "${resp}" in
                    [nN]|[nN][oO])
                        error "Deployment aborted due to active lock."
                        return 2
                        ;;
                    *)
                        do_reclaim=1
                        ;;
                esac
            else
                warn "Auto-reclaiming expired or stale deployment lock (>10m or inactive PID)."
                do_reclaim=1
            fi
        fi

        if [ "${do_reclaim}" -eq 1 ]; then
            warn "Cleared stale or overridden lock at ${lock_path}."
            run_in_container "${c_name}" rm -rf "${lock_path}" 2>/dev/null || true
        fi
    fi

    # Attempt atomic directory creation
    if ! run_in_container "${c_name}" mkdir "${lock_path}" 2>/dev/null; then
        error "Exclusive lock failed: Another deployment operation is currently in progress on container '${c_name}' (${lock_path})."
        info "Use -r or --reset to clear stale locks."
        return 2
    fi

    # Write lock metadata
    local safe_user="${USER:-unknown}"
    safe_user="${safe_user//\'/}"
    local lock_info="pid=$$;time=$(date -u +"%Y-%m-%dT%H:%M:%SZ");user=${safe_user}"
    run_in_container_bash "${c_name}" "printf '%s\n' '${lock_info}' > '${lock_path}/info'" 2>/dev/null || true

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
