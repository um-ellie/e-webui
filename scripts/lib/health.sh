#!/usr/bin/env bash
# scripts/lib/health.sh - Service active-state checks, HTTP readiness polling, and journal diagnostics
set -euo pipefail

capture_service_logs() {
    local c_name="$1"
    local lines="${2:-30}"

    warn "--- Recent systemd journal logs for e-webui (${lines} lines) ---" >&2
    run_in_container "${c_name}" journalctl -u e-webui -n "${lines}" --no-pager 2>/dev/null >&2 || true
    warn "------------------------------------------------------------------" >&2
}

verify_http_health() {
    local c_name="$1"
    local port="${2:-8080}"
    local max_attempts="${3:-15}"
    local interval="${4:-2}"

    info "Verifying application service and HTTP health (up to $((max_attempts * interval))s)..."

    local attempt=1
    while [ "${attempt}" -le "${max_attempts}" ]; do
        # 1. First check if systemd service is active
        if ! service_is_active "${c_name}"; then
            warn "Attempt ${attempt}/${max_attempts}: Service is not active yet..."
            sleep "${interval}"
            attempt=$((attempt + 1))
            continue
        fi

        # 2. Query HTTP health endpoint inside container
        local http_code
        http_code=$(run_in_container "${c_name}" curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}/api/health" 2>/dev/null || echo "000")

        if [ "${http_code}" = "200" ]; then
            success "HTTP Health Check: Service is ready (HTTP 200 on /api/health)."
            # Optional check of Ollama connection status
            local body
            body=$(run_in_container "${c_name}" curl -s "http://127.0.0.1:${port}/api/health" 2>/dev/null || true)
            if echo "${body}" | grep -q '"ollama_connected":false'; then
                warn "Application is healthy, but upstream Ollama backend is reported as disconnected (status: degraded)."
            fi
            return 0
        fi

        sleep "${interval}"
        attempt=$((attempt + 1))
    done

    error "HTTP health check failed: Service did not respond with HTTP 200 within timeout."
    capture_service_logs "${c_name}" 30
    return 4
}
