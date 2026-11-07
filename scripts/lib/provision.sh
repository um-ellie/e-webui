#!/usr/bin/env bash
# scripts/lib/provision.sh - Container creation, proxy configuration, and OS prerequisite installation
set -euo pipefail

provision_container() {
    local c_name="$1"

    if container_exists "${c_name}"; then
        if ! container_is_running "${c_name}"; then
            info "Starting stopped container '${c_name}'..."
            incus_cmd start "${c_name}"
            sleep 2
        fi
        success "Container '${c_name}' is running."
        return 0
    fi

    info "Launching container '${c_name}' with Debian 13..."
    if ! incus_cmd launch images:debian/13 "${c_name}" 2>/dev/null; then
        warn "Launch with 'images:debian/13' failed. Retrying with 'images:debian/stable'..."
        if ! incus_cmd launch images:debian/stable "${c_name}"; then
            error "Failed to create Incus container '${c_name}'."
            return 3
        fi
    fi

    info "Waiting for container '${c_name}' to become responsive..."
    for i in {1..15}; do
        if run_in_container "${c_name}" true 2>/dev/null; then
            break
        fi
        sleep 1
    done

    success "Container '${c_name}' initialized successfully."
    return 0
}

configure_proxy_devices() {
    local c_name="$1"
    local host_port="${2:-8080}"
    local ollama_target="${3:-127.0.0.1:11434}"

    info "Configuring Incus proxy devices for '${c_name}'..."

    # 1. Web UI Proxy (Host :host_port -> Container :8080)
    if ! incus_cmd config device show "${c_name}" 2>/dev/null | grep -q "webui-proxy"; then
        info "Adding 'webui-proxy' (Host 127.0.0.1:${host_port} -> Container 127.0.0.1:8080)..."
        if ! incus_cmd config device add "${c_name}" webui-proxy proxy listen=tcp:127.0.0.1:${host_port} connect=tcp:127.0.0.1:8080; then
            error "Failed to add 'webui-proxy' device on container '${c_name}'."
            return 3
        fi
        success "'webui-proxy' device configured on port ${host_port}."
    else
        success "'webui-proxy' device already configured."
    fi

    # 2. Ollama Link Proxy
    if ! incus_cmd config device show "${c_name}" 2>/dev/null | grep -q "ollama-link"; then
        info "Adding 'ollama-link' (Container 127.0.0.1:11434 -> Target ${ollama_target})..."
        if ! incus_cmd config device add "${c_name}" ollama-link proxy bind=instance listen=tcp:127.0.0.1:11434 connect="tcp:${ollama_target}"; then
            warn "Could not add 'ollama-link' proxy device automatically. Continuing..."
        else
            success "'ollama-link' proxy device configured."
        fi
    else
        success "'ollama-link' proxy device already configured."
    fi

    return 0
}

install_system_prerequisites() {
    local c_name="$1"

    info "Checking operating system prerequisites inside container '${c_name}'..."
    local missing_pkgs=()

    if ! run_in_container "${c_name}" which python3 curl >/dev/null 2>&1 || \
       ! run_in_container "${c_name}" python3 -c "import venv" >/dev/null 2>&1; then
        missing_pkgs+=("python3" "python3-pip" "python3-venv" "curl")
    fi

    if ! run_in_container "${c_name}" dpkg -s espeak-ng espeak-ng-data libsndfile1 >/dev/null 2>&1; then
        missing_pkgs+=("espeak-ng" "espeak-ng-data" "libsndfile1")
    fi

    if [ ${#missing_pkgs[@]} -eq 0 ]; then
        success "System prerequisites (python3, venv, curl, espeak-ng, libsndfile1) are already satisfied."
        return 0
    fi

    info "Installing system packages (${missing_pkgs[*]})..."
    run_in_container "${c_name}" apt-get update -qq || true
    if ! run_in_container "${c_name}" apt-get install -y -qq "${missing_pkgs[@]}"; then
        error "Failed to install required system packages inside container."
        return 3
    fi

    success "Operating system prerequisites installed."
    return 0
}

setup_deployment_directories() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    run_in_container "${c_name}" mkdir -p \
        "${app_dir}/releases" \
        "${app_dir}/venvs" \
        "${app_dir}/interpreters" \
        "${app_dir}/shared/data" \
        "${app_dir}/shared/models/kokoro/voices" \
        "${app_dir}/staging"
}
