#!/usr/bin/env bash
# scripts/lib/builder.sh - Release packaging orchestration, staging, and publication
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

source "${LIB_DIR}/common.sh"

get_git_commit() {
    if git rev-parse --git-dir >/dev/null 2>&1; then
        git rev-parse HEAD 2>/dev/null || echo ""
    else
        echo ""
    fi
}

get_git_branch() {
    if git rev-parse --git-dir >/dev/null 2>&1; then
        git rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""
    else
        echo ""
    fi
}

is_git_dirty() {
    if git rev-parse --git-dir >/dev/null 2>&1; then
        if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
            return 0
        fi
    fi
    return 1
}

detect_app_version() {
    local src_dir="$1"
    local main_py="${src_dir}/app/main.py"
    if [ -f "${main_py}" ]; then
        local ver
        ver=$(python3 -c "
import re
with open('${main_py}', 'r') as f:
    m = re.search(r'version=[\"\\\']([^\"\\\']+)[\"\\\']', f.read())
    print(m.group(1) if m else '1.0.0')
" 2>/dev/null || echo "1.0.0")
        echo "${ver}"
    else
        echo "1.0.0"
    fi
}

build_release_package() {
    local src_dir="$1"
    local output_base_dir="$2"
    local app_version="${3:-}"
    local strict_mode="${4:-0}"
    local archive_only="${5:-0}"
    local dir_only="${6:-0}"

    if [ ! -d "${src_dir}/app" ] || [ ! -f "${src_dir}/requirements.txt" ]; then
        error "Source directory '${src_dir}' is missing required 'app/' directory or 'requirements.txt'."
        return 2
    fi

    if [ -z "${app_version}" ]; then
        app_version=$(detect_app_version "${src_dir}")
    fi

    local commit
    commit=$(get_git_commit)
    local branch
    branch=$(get_git_branch)
    local dirty_flag=0

    if is_git_dirty; then
        dirty_flag=1
        if [ "${strict_mode}" -eq 1 ]; then
            error "Git working tree contains uncommitted changes and --strict mode is enabled."
            return 2
        else
            warn "Git working tree contains uncommitted changes. Marking release as dirty."
        fi
    fi

    local short_commit="00000000"
    if [ -n "${commit}" ]; then
        short_commit="${commit:0:8}"
    fi

    local timestamp
    timestamp=$(date -u +"%Y%m%d-%H%M%S")
    local release_id="${timestamp}-${short_commit}"
    if [ "${dirty_flag}" -eq 1 ]; then
        release_id="${release_id}-dirty"
    fi

    info "Building release ID: ${release_id} (Version: ${app_version})"

    # Create isolated build staging
    local staging_dir
    staging_dir=$(mktemp -d "/tmp/e-webui-build-${release_id}.XXXXXX")
    register_cleanup "rm -rf '${staging_dir}'"

    local payload_dir="${staging_dir}/payload"
    mkdir -p "${payload_dir}/systemd"

    # Package app code into payload/app.tar.gz with normalized permissions
    local app_tar="${payload_dir}/app.tar.gz"
    info "Packaging application code into payload/app.tar.gz..."

    tar -czf "${app_tar}" \
        --owner=0 --group=0 \
        --mode="g-w,o-w" \
        --exclude=".git" \
        --exclude=".gitignore" \
        --exclude=".env" \
        --exclude=".env.*" \
        --exclude="venv" \
        --exclude=".venv" \
        --exclude="__pycache__" \
        --exclude="*.pyc" \
        --exclude="*.pyo" \
        --exclude="specs" \
        --exclude=".specify" \
        --exclude="tests" \
        --exclude=".pytest_cache" \
        --exclude=".coverage" \
        --exclude="htmlcov" \
        -C "${src_dir}" \
        app

    # Stage requirements.txt
    cp "${src_dir}/requirements.txt" "${payload_dir}/requirements.txt"

    # Stage systemd service unit
    if [ -f "${src_dir}/app/systemd/e-webui.service" ]; then
        cp "${src_dir}/app/systemd/e-webui.service" "${payload_dir}/systemd/e-webui.service"
    elif [ -f "${LIB_DIR}/service.sh" ]; then
        source "${LIB_DIR}/service.sh"
        render_service_unit "/opt/e-webui" "8080" "http://127.0.0.1:11434" > "${payload_dir}/systemd/e-webui.service"
    fi

    # Generate manifest.json and checksums.sha256
    info "Generating manifest.json and calculating checksums..."
    local manifest_tool="${LIB_DIR}/manifest_tool.py"
    local create_cmd=(
        python3 "${manifest_tool}" create-manifest
        --release-dir "${staging_dir}"
        --version "${app_version}"
        --release-id "${release_id}"
        --min-manager-version "1.0.0"
        --python-version ">=3.11"
        --target-os "debian-12"
    )

    if [ -n "${commit}" ]; then
        create_cmd+=(--git-commit "${commit}")
    fi
    if [ -n "${branch}" ]; then
        create_cmd+=(--git-branch "${branch}")
    fi
    if [ "${dirty_flag}" -eq 1 ]; then
        create_cmd+=(--git-dirty)
    fi

    "${create_cmd[@]}"

    # Self-verification
    info "Running pre-publication self-test..."
    python3 "${manifest_tool}" validate-manifest "${staging_dir}/manifest.json"
    python3 "${manifest_tool}" verify-checksums "${staging_dir}/checksums.sha256"
    python3 "${manifest_tool}" verify-archive "${staging_dir}/payload/app.tar.gz"

    # Publication
    mkdir -p "${output_base_dir}"

    local final_dir="${output_base_dir}/${release_id}"
    local final_archive="${output_base_dir}/e-webui-${app_version}-${release_id}.tar.gz"

    if [ "${archive_only}" -ne 1 ]; then
        info "Publishing uncompressed release directory to ${final_dir}..."
        rm -rf "${final_dir}"
        cp -a "${staging_dir}" "${final_dir}"
    fi

    if [ "${dir_only}" -ne 1 ]; then
        info "Publishing release archive bundle to ${final_archive}..."
        tar -czf "${final_archive}" -C "${staging_dir}" .
    fi

    rm -rf "${staging_dir}"
    success "Release '${release_id}' successfully packaged and published!"
    return 0
}
