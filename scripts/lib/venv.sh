#!/usr/bin/env bash
# scripts/lib/venv.sh - Python dependency hashing, venv discovery, caching, and isolation
set -euo pipefail

STANDALONE_PYTHON_DEFAULT_URL="https://github.com/astral-sh/python-build-standalone/releases/download/20241016/cpython-3.11.10+20241016-x86_64-unknown-linux-gnu-install_only.tar.gz"

is_compatible_python_binary() {
    local c_name="$1"
    local py_bin="$2"
    local check_cmd="import sys
major, minor = sys.version_info[:2]
if (3, 10) <= (major, minor) <= (3, 12):
    sys.exit(0)
sys.exit(1)
"
    run_in_container "${c_name}" "${py_bin}" -c "${check_cmd}" 2>/dev/null
}

resolve_compatible_python() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    # 1. Check isolated standalone python-3.11 directory
    local standalone_bin="${app_dir}/interpreters/python-3.11/bin/python3"
    if container_test_file "${c_name}" "${standalone_bin}" && \
       is_compatible_python_binary "${c_name}" "${standalone_bin}"; then
        echo "${standalone_bin}"
        return 0
    fi

    # 2. Check alternative system binaries (python3.11, python3.12)
    for alt_bin in "/usr/bin/python3.11" "/usr/local/bin/python3.11" "/usr/bin/python3.12" "/usr/local/bin/python3.12"; do
        if container_test_file "${c_name}" "${alt_bin}" && \
           is_compatible_python_binary "${c_name}" "${alt_bin}"; then
            echo "${alt_bin}"
            return 0
        fi
    done

    # 3. Check default system python3 (only if 3.10-3.12)
    if is_compatible_python_binary "${c_name}" "python3"; then
        echo "python3"
        return 0
    fi

    return 1
}

ensure_compatible_python() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    local existing_bin
    if existing_bin=$(resolve_compatible_python "${c_name}" "${app_dir}"); then
        success "Compatible Python interpreter found: ${existing_bin}" >&2
        echo "${existing_bin}"
        return 0
    fi

    info "Compatible Python (3.10-3.12) not found for Kokoro TTS. Provisioning standalone Python 3.11..." >&2
    local target_dir="${app_dir}/interpreters/python-3.11"
    local staging_tar="${app_dir}/staging/python-3.11-standalone.tar.gz"
    local py_url="${PYTHON_STANDALONE_URL:-${STANDALONE_PYTHON_DEFAULT_URL}}"

    run_in_container "${c_name}" mkdir -p "${app_dir}/interpreters" "${app_dir}/staging"

    # Check for local cached archive on host first
    if [ -f "${REPO_ROOT}/dist/python-3.11-standalone.tar.gz" ]; then
        info "Transferring local cached standalone Python archive to container..." >&2
        container_push "${REPO_ROOT}/dist/python-3.11-standalone.tar.gz" "${c_name}${staging_tar}"
    else
        info "Downloading standalone Python 3.11 from ${py_url}..." >&2
        local proxy_env=""
        if [ -n "${HTTP_PROXY:-}" ]; then proxy_env="http_proxy='${HTTP_PROXY}' HTTP_PROXY='${HTTP_PROXY}' ${proxy_env}"; fi
        if [ -n "${HTTPS_PROXY:-}" ]; then proxy_env="https_proxy='${HTTPS_PROXY}' HTTPS_PROXY='${HTTPS_PROXY}' ${proxy_env}"; fi
        if [ -n "${ALL_PROXY:-}" ]; then proxy_env="all_proxy='${ALL_PROXY}' ALL_PROXY='${ALL_PROXY}' ${proxy_env}"; fi
        if [ -n "${NO_PROXY:-}" ]; then proxy_env="no_proxy='${NO_PROXY}' NO_PROXY='${NO_PROXY}' ${proxy_env}"; fi

        local curl_cmd="${proxy_env} curl -fSL --connect-timeout 20 --max-time 600 --retry 3 '${py_url}' -o '${staging_tar}.tmp'"
        if ! run_in_container "${c_name}" env sh -c "${curl_cmd}"; then
            error "Failed to download standalone Python distribution archive."
            run_in_container "${c_name}" rm -f "${staging_tar}.tmp" 2>/dev/null || true
            return 3
        fi
        run_in_container "${c_name}" mv -f "${staging_tar}.tmp" "${staging_tar}"
    fi

    info "Extracting standalone Python to ${target_dir}..." >&2
    run_in_container "${c_name}" rm -rf "${target_dir}"
    run_in_container "${c_name}" mkdir -p "${target_dir}"

    if ! run_in_container "${c_name}" tar -xzf "${staging_tar}" -C "${target_dir}" --strip-components=1; then
        error "Failed to extract standalone Python archive at ${staging_tar}."
        return 3
    fi
    run_in_container "${c_name}" rm -f "${staging_tar}" 2>/dev/null || true

    local target_bin="${target_dir}/bin/python3"
    if ! container_test_file "${c_name}" "${target_bin}" || \
       ! is_compatible_python_binary "${c_name}" "${target_bin}"; then
        error "Provisioned standalone Python at ${target_bin} failed compatibility validation."
        return 3
    fi

    success "Standalone Python 3.11 provisioned successfully at ${target_bin}." >&2
    echo "${target_bin}"
    return 0
}

calculate_requirements_hash() {
    local req_file="$1"
    if [ ! -f "${req_file}" ]; then
        error "Requirements file not found: ${req_file}"
        return 1
    fi
    sha256sum "${req_file}" | awk '{print $1}'
}

venv_dir_for_hash() {
    local app_dir="${1:-/opt/e-webui}"
    local hash_val="$2"
    # Tag with py3.11 prefix to ensure isolation from Python 3.13 venvs
    echo "${app_dir}/venvs/py3.11-${hash_val}"
}

venv_exists_in_container() {
    local c_name="$1"
    local app_dir="$2"
    local hash_val="$3"
    local venv_dir
    venv_dir="$(venv_dir_for_hash "${app_dir}" "${hash_val}")"
    container_test_file "${c_name}" "${venv_dir}/bin/python3" && \
    container_test_file "${c_name}" "${venv_dir}/bin/uvicorn" && \
    is_compatible_python_binary "${c_name}" "${venv_dir}/bin/python3"
}

ensure_venv_in_container() {
    local c_name="$1"
    local app_dir="$2"
    local req_container_path="$3"
    local hash_val="$4"
    local venv_dir
    venv_dir="$(venv_dir_for_hash "${app_dir}" "${hash_val}")"

    if venv_exists_in_container "${c_name}" "${app_dir}" "${hash_val}"; then
        success "Dependency Cache Hit: Reusing existing compatible Python environment (${hash_val:0:12})."
        return 0
    fi

    local py_bin
    py_bin=$(ensure_compatible_python "${c_name}" "${app_dir}")

    info "Dependency Cache Miss: Provisioning new Python virtual environment at ${venv_dir} using ${py_bin}..."
    run_in_container "${c_name}" mkdir -p "${app_dir}/venvs"

    if ! run_in_container "${c_name}" "${py_bin}" -m venv "${venv_dir}"; then
        error "Failed to create Python virtual environment at ${venv_dir}."
        return 3
    fi

    info "Installing dependencies from ${req_container_path} into virtual environment..."
    run_in_container "${c_name}" "${venv_dir}/bin/pip" install --upgrade pip -q 2>/dev/null || true

    local pip_flags=""
    if [ -n "${PIP_INDEX_URL:-}" ]; then
        pip_flags="${pip_flags} --index-url '${PIP_INDEX_URL}'"
    fi
    local extra_idx="${PIP_EXTRA_INDEX_URL:-https://download.pytorch.org/whl/cpu}"
    pip_flags="${pip_flags} --extra-index-url '${extra_idx}'"

    info "Installing CPU-only PyTorch and Kokoro TTS dependencies..."
    local speech_deps_cmd="${venv_dir}/bin/pip install ${pip_flags} 'torch>=2.2.0,<=2.6.0' 'kokoro>=0.8.4' 'soundfile>=0.12.1'"
    if ! run_in_container "${c_name}" env sh -c "${speech_deps_cmd}"; then
        warn "Direct installation of speech dependencies returned non-zero status. Falling back to default index..."
        run_in_container "${c_name}" "${venv_dir}/bin/pip" install 'torch' 'kokoro' 'soundfile' || true
    fi

    if container_test_file "${c_name}" "${req_container_path}"; then
        info "Installing release requirements from ${req_container_path}..."
        if ! run_in_container "${c_name}" env sh -c "${venv_dir}/bin/pip install ${pip_flags} -r '${req_container_path}'"; then
            error "pip install failed for requirements at ${req_container_path}."
            return 3
        fi
    fi

    if ! container_test_file "${c_name}" "${venv_dir}/bin/uvicorn"; then
        error "uvicorn binary missing in newly created virtual environment ${venv_dir}."
        return 3
    fi

    success "Python virtual environment successfully provisioned (${hash_val:0:12})."
    return 0
}
