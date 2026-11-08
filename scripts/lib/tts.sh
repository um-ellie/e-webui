#!/usr/bin/env bash
# scripts/lib/tts.sh - Kokoro-82M text-to-speech provisioning, weights acquisition, and verification
set -euo pipefail

KOKORO_MODEL_REL_PATH="shared/models/kokoro"
KOKORO_WEIGHTS_FILE="kokoro-v1_0.pth"
KOKORO_CONFIG_FILE="config.json"
KOKORO_MIN_WEIGHTS_SIZE=300000000 # ~300 MB minimum threshold

# Core English voices bundled with Kokoro-82M
DEFAULT_KOKORO_VOICES=(
    "af_heart.pt"
    "af_bella.pt"
    "af_sarah.pt"
    "af_nicole.pt"
    "am_adam.pt"
    "am_michael.pt"
    "bf_emma.pt"
    "bf_isabella.pt"
    "bm_george.pt"
    "bm_lewis.pt"
)

tts_model_dir() {
    local app_dir="${1:-/opt/e-webui}"
    echo "${app_dir}/${KOKORO_MODEL_REL_PATH}"
}

tts_voices_dir() {
    local app_dir="${1:-/opt/e-webui}"
    echo "$(tts_model_dir "${app_dir}")/voices"
}

tts_weights_path() {
    local app_dir="${1:-/opt/e-webui}"
    echo "$(tts_model_dir "${app_dir}")/${KOKORO_WEIGHTS_FILE}"
}

tts_config_path() {
    local app_dir="${1:-/opt/e-webui}"
    echo "$(tts_model_dir "${app_dir}")/${KOKORO_CONFIG_FILE}"
}

kokoro_model_is_present() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local model_dir
    model_dir="$(tts_model_dir "${app_dir}")"
    local voices_dir
    voices_dir="$(tts_voices_dir "${app_dir}")"

    local weights_file=""
    if container_test_file "${c_name}" "${model_dir}/kokoro-v1_0.pth"; then
        weights_file="${model_dir}/kokoro-v1_0.pth"
    elif container_test_file "${c_name}" "${model_dir}/kokoro-v0_19.pth"; then
        weights_file="${model_dir}/kokoro-v0_19.pth"
    else
        return 1
    fi

    # Check minimum file size to guard against corrupted or partial downloads
    local file_size
    file_size=$(run_in_container "${c_name}" wc -c "${weights_file}" 2>/dev/null | awk '{print $1}' || echo "0")
    file_size="${file_size//[[:space:]]/}"
    if [ -z "${file_size}" ] || [ "${file_size}" -lt "${KOKORO_MIN_WEIGHTS_SIZE}" ]; then
        return 1
    fi

    if ! container_test_dir "${c_name}" "${voices_dir}"; then
        return 1
    fi

    # Check architecture config presence
    local config_file
    config_file="$(tts_config_path "${app_dir}")"
    if ! container_test_file "${c_name}" "${config_file}"; then
        return 1
    fi

    return 0
}

verify_kokoro_model() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    kokoro_model_is_present "${c_name}" "${app_dir}"
}

download_file_to_container() {
    local c_name="$1"
    local url="$2"
    local dest_path="$3"
    local min_size="${4:-0}"

    local dest_dir
    dest_dir="$(dirname "${dest_path}")"
    run_in_container "${c_name}" mkdir -p "${dest_dir}"

    local tmp_dest="${dest_path}.tmp"
    local proxy_env=""

    if [ -n "${HTTP_PROXY:-}" ]; then
        proxy_env="http_proxy='${HTTP_PROXY}' HTTP_PROXY='${HTTP_PROXY}' ${proxy_env}"
    fi
    if [ -n "${HTTPS_PROXY:-}" ]; then
        proxy_env="https_proxy='${HTTPS_PROXY}' HTTPS_PROXY='${HTTPS_PROXY}' ${proxy_env}"
    fi
    if [ -n "${ALL_PROXY:-}" ]; then
        proxy_env="all_proxy='${ALL_PROXY}' ALL_PROXY='${ALL_PROXY}' ${proxy_env}"
    fi
    if [ -n "${NO_PROXY:-}" ]; then
        proxy_env="no_proxy='${NO_PROXY}' NO_PROXY='${NO_PROXY}' ${proxy_env}"
    fi

    local curl_cmd="${proxy_env} curl -fSL -C - --connect-timeout 20 --max-time 1800 --retry 3 --retry-delay 2 '${url}' -o '${tmp_dest}'"

    if ! run_in_container "${c_name}" env sh -c "${curl_cmd}"; then
        run_in_container "${c_name}" rm -f "${tmp_dest}" 2>/dev/null || true
        return 1
    fi

    if [ "${min_size}" -gt 0 ]; then
        local actual_size
        actual_size=$(run_in_container "${c_name}" wc -c "${tmp_dest}" 2>/dev/null | awk '{print $1}' || echo "0")
        actual_size="${actual_size//[[:space:]]/}"
        if [ "${actual_size}" -lt "${min_size}" ]; then
            warn "Downloaded file ${tmp_dest} size (${actual_size}) is smaller than expected (${min_size})."
            run_in_container "${c_name}" rm -f "${tmp_dest}" 2>/dev/null || true
            return 1
        fi
    fi

    run_in_container "${c_name}" mv -f "${tmp_dest}" "${dest_path}"
    return 0
}

download_kokoro_model() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"

    local model_dir
    model_dir="$(tts_model_dir "${app_dir}")"
    local voices_dir
    voices_dir="$(tts_voices_dir "${app_dir}")"
    local v1_weights="${model_dir}/kokoro-v1_0.pth"
    local v019_weights="${model_dir}/kokoro-v0_19.pth"
    local config_file
    config_file="$(tts_config_path "${app_dir}")"

    local hf_base="${HF_ENDPOINT:-https://huggingface.co}"
    # Strip trailing slash if present
    hf_base="${hf_base%/}"
    local repo_url="${hf_base}/hexgrad/Kokoro-82M/resolve/main"

    info "Setting up Kokoro-82M persistent storage at ${model_dir}..."
    run_in_container "${c_name}" mkdir -p "${model_dir}" "${voices_dir}"

    info "1/3 Checking/Downloading Kokoro-82M model weights (kokoro-v1_0.pth)..."
    local weights_url="${repo_url}/kokoro-v1_0.pth"
    local download_success=0

    local current_weights=""
    if container_test_file "${c_name}" "${v1_weights}"; then
        current_weights="${v1_weights}"
    elif container_test_file "${c_name}" "${v019_weights}"; then
        current_weights="${v019_weights}"
    fi

    if [ -n "${current_weights}" ]; then
        local cur_size
        cur_size=$(run_in_container "${c_name}" wc -c "${current_weights}" 2>/dev/null | awk '{print $1}' || echo "0")
        cur_size="${cur_size//[[:space:]]/}"
        if [ -n "${cur_size}" ] && [ "${cur_size}" -ge "${KOKORO_MIN_WEIGHTS_SIZE}" ]; then
            info "Kokoro-82M model weights already present and verified in ${current_weights} (${cur_size} bytes)."
            download_success=1
        fi
    fi

    if [ "${download_success}" -ne 1 ]; then
        if download_file_to_container "${c_name}" "${weights_url}" "${v1_weights}" "${KOKORO_MIN_WEIGHTS_SIZE}"; then
            download_success=1
            # Maintain backward compatibility for tools/references expecting kokoro-v0_19.pth
            run_in_container "${c_name}" ln -sfn kokoro-v1_0.pth "${v019_weights}" || true
        else
            warn "Direct download of kokoro-v1_0.pth failed. Attempting fallback to v0.19 release..."
            local fallback_url="${hf_base}/hexgrad/Kokoro-82M/resolve/v0.19/kokoro-v0_19.pth"
            if download_file_to_container "${c_name}" "${fallback_url}" "${v019_weights}" "${KOKORO_MIN_WEIGHTS_SIZE}"; then
                download_success=1
                # Maintain forward compatibility symlink for kokoro-v1_0.pth
                run_in_container "${c_name}" ln -sfn kokoro-v0_19.pth "${v1_weights}" || true
            fi
        fi
    fi

    if [ "${download_success}" -ne 1 ]; then
        error "Failed to download model weights from ${weights_url} and fallback ${hf_base}/hexgrad/Kokoro-82M/resolve/v0.19/kokoro-v0_19.pth."
        return 1
    fi

    info "2/3 Checking/Provisioning Kokoro-82M architecture config (${KOKORO_CONFIG_FILE})..."
    if ! container_test_file "${c_name}" "${config_file}"; then
        local repo_bundled="${REPO_ROOT:-}/app/resources/kokoro/config.json"
        local container_bundled="${app_dir}/current/app/resources/kokoro/config.json"

        if container_test_file "${c_name}" "${container_bundled}"; then
            info "Copying bundled Kokoro architecture config from current container release..."
            run_in_container "${c_name}" cp -f "${container_bundled}" "${config_file}" || true
        elif [ -n "${REPO_ROOT:-}" ] && [ -f "${repo_bundled}" ]; then
            info "Pushing bundled Kokoro architecture config from host workspace..."
            container_push "${repo_bundled}" "${c_name}${config_file}" || true
        else
            local config_url="${repo_url}/${KOKORO_CONFIG_FILE}"
            download_file_to_container "${c_name}" "${config_url}" "${config_file}" 0 || true
        fi
    fi

    info "3/3 Downloading voice profile embeddings..."
    for voice in "${DEFAULT_KOKORO_VOICES[@]}"; do
        local voice_dest="${voices_dir}/${voice}"
        if ! container_test_file "${c_name}" "${voice_dest}"; then
            local voice_url="${repo_url}/voices/${voice}"
            download_file_to_container "${c_name}" "${voice_url}" "${voice_dest}" 0 || warn "Failed to download voice '${voice}', continuing..."
        fi
    done

    # Ensure af_heart.pt exists or alias to an available American voice (e.g. af_sarah.pt)
    local heart_voice="${voices_dir}/af_heart.pt"
    if ! container_test_file "${c_name}" "${heart_voice}"; then
        for fallback_voice in "af_sarah.pt" "af_nicole.pt" "af_bella.pt"; do
            if container_test_file "${c_name}" "${voices_dir}/${fallback_voice}"; then
                info "Creating fallback voice symlink af_heart.pt -> ${fallback_voice}..."
                run_in_container "${c_name}" ln -sfn "${fallback_voice}" "${heart_voice}" || true
                break
            fi
        done
    fi

    success "Kokoro-82M model weights and voice assets successfully placed in persistent storage."
    return 0
}

ensure_kokoro_model() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local non_blocking="${3:-1}" # 1 = warning only (for deploy/update), 0 = error exit (for --download-model)

    if kokoro_model_is_present "${c_name}" "${app_dir}"; then
        success "Kokoro-82M model weights are already present and verified in shared storage."
        return 0
    fi

    info "Kokoro-82M model weights not found in ${app_dir}/shared/models/kokoro. Downloading..."
    if download_kokoro_model "${c_name}" "${app_dir}"; then
        return 0
    fi

    if [ "${non_blocking}" -eq 1 ]; then
        warn "Kokoro model weights download failed due to network unavailability."
        warn "The core chat application has been deployed and will continue running normally."
        info "You can download/retry the model weights at any time with:"
        info "  ./scripts/deploy.sh --download-model ${c_name}"
        return 0
    else
        error "Failed to download Kokoro-82M model weights."
        info "Please check your network connection, proxy, or HF_ENDPOINT mirror settings."
        return 3
    fi
}

verify_tts_dependencies() {
    local c_name="$1"
    local venv_dir="$2"

    local test_code="import sys
try:
    import kokoro
    import soundfile
    import torch
    assert not torch.cuda.is_available(), 'PyTorch must run on CPU'
    sys.exit(0)
except Exception as e:
    sys.stderr.write(f'TTS import error: {e}\\n')
    sys.exit(1)
"
    run_in_container "${c_name}" "${venv_dir}/bin/python3" -c "${test_code}" 2>/dev/null
}
