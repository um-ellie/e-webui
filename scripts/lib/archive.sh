#!/usr/bin/env bash
# scripts/lib/archive.sh - Release package discovery, verification, and staging
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}"

calculate_checksum() {
    local file_path="$1"
    if [ ! -f "${file_path}" ]; then
        error "File not found for checksum calculation: ${file_path}"
        return 1
    fi
    sha256sum "${file_path}" | awk '{print $1}'
}

# Finds the latest valid release package in a distribution directory.
# Returns path to directory or .tar.gz bundle, or empty if none found.
find_latest_release_package() {
    local dist_dir="$1"
    if [ ! -d "${dist_dir}" ]; then
        return 1
    fi

    local python_finder="
import os, sys
from pathlib import Path

dist = Path('${dist_dir}')
candidates = []

for item in dist.iterdir():
    if item.is_dir() and (item / 'manifest.json').is_file():
        candidates.append((item.name, item))
    elif item.is_file() and item.name.endswith('.tar.gz') and not item.name.startswith('.'):
        candidates.append((item.name, item))

if not candidates:
    sys.exit(1)

# Sort descending by name (timestamp-based names sort naturally)
candidates.sort(key=lambda x: x[0], reverse=True)
print(str(candidates[0][1]))
sys.exit(0)
"
    python3 -c "${python_finder}" 2>/dev/null || return 1
}

# Unpacks or stages a release package into a directory on host
prepare_release_package_on_host() {
    local pkg_path="$1"
    local stage_dir="$2"

    if [ ! -e "${pkg_path}" ]; then
        error "Specified release path does not exist: ${pkg_path}"
        return 2
    fi

    if [ -d "${pkg_path}" ]; then
        if [ ! -f "${pkg_path}/manifest.json" ]; then
            error "Release directory '${pkg_path}' is missing manifest.json."
            return 2
        fi
        echo "${pkg_path}"
        return 0
    elif [ -f "${pkg_path}" ] && [[ "${pkg_path}" =~ \.tar\.gz$ ]]; then
        mkdir -p "${stage_dir}"
        # Validate outer bundle before extracting
        local manifest_tool="${LIB_DIR}/manifest_tool.py"
        local verify_out
        if ! verify_out=$(python3 "${manifest_tool}" verify-archive "${pkg_path}" 2>&1); then
            error "Release bundle '${pkg_path}' failed safety verification (unsafe paths detected):\n${verify_out}"
            return 2
        fi
        tar -xzf "${pkg_path}" -C "${stage_dir}"
        # If the tarball unpacked a single top-level directory, descend into it if it has manifest.json
        if [ ! -f "${stage_dir}/manifest.json" ]; then
            local sub
            sub=$(find "${stage_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)
            if [ -n "${sub}" ] && [ -f "${sub}/manifest.json" ]; then
                echo "${sub}"
                return 0
            fi
            error "Extracted release bundle does not contain manifest.json at root."
            return 2
        fi
        echo "${stage_dir}"
        return 0
    else
        error "Unsupported release format for '${pkg_path}'. Must be a directory or .tar.gz bundle."
        return 2
    fi
}

verify_release_package_on_host() {
    local release_dir="$1"
    local manifest_tool="${LIB_DIR}/manifest_tool.py"

    if [ ! -f "${manifest_tool}" ]; then
        error "Manifest verification tool not found at ${manifest_tool}"
        return 2
    fi

    local manifest_file="${release_dir}/manifest.json"
    local checksums_file="${release_dir}/checksums.sha256"
    local app_tar="${release_dir}/payload/app.tar.gz"

    if [ ! -f "${manifest_file}" ]; then
        error "Release package missing 'manifest.json' in ${release_dir}"
        return 2
    fi
    if [ ! -f "${checksums_file}" ]; then
        error "Release package missing 'checksums.sha256' in ${release_dir}"
        return 2
    fi
    if [ ! -f "${app_tar}" ]; then
        error "Release package missing 'payload/app.tar.gz' in ${release_dir}"
        return 2
    fi

    # 1. Validate manifest schema and artifact attributes
    if ! python3 "${manifest_tool}" validate-manifest "${manifest_file}"; then
        error "Host Pre-flight Gate Failed: Manifest schema or artifact validation error."
        return 2
    fi

    # 2. Verify all checksums against disk files
    if ! python3 "${manifest_tool}" verify-checksums "${checksums_file}"; then
        error "Host Pre-flight Gate Failed: SHA-256 checksum verification error."
        return 2
    fi

    # 3. Audit payload app.tar.gz for path traversal / unsafe members
    if ! python3 "${manifest_tool}" verify-archive "${app_tar}"; then
        error "Host Pre-flight Gate Failed: Payload archive contains unsafe path members."
        return 2
    fi

    success "Host pre-flight validation passed for release package."
    return 0
}

get_manifest_field() {
    local manifest_file="$1"
    local field="$2"
    local manifest_tool="${LIB_DIR}/manifest_tool.py"
    python3 "${manifest_tool}" read-field "${manifest_file}" "${field}" 2>/dev/null || echo ""
}

verify_release_in_container() {
    local c_name="$1"
    local container_staging_dir="$2"

    # If artifacts were pushed inside a nested directory, flatten them to container_staging_dir
    local flatten_cmd="if [ ! -f '${container_staging_dir}/checksums.sha256' ]; then sub=\$(find '${container_staging_dir}' -mindepth 1 -maxdepth 1 -type d | head -n 1); if [ -n \"\${sub}\" ] && [ -f \"\${sub}/checksums.sha256\" ]; then mv \"\${sub}\"/* '${container_staging_dir}/' && rm -rf \"\${sub}\"; fi; fi"
    run_in_container_bash "${c_name}" "${flatten_cmd}" 2>/dev/null || true

    info "Verifying SHA-256 checksums inside container staging..."
    local chk_cmd="cd '${container_staging_dir}' && sha256sum -c checksums.sha256"
    if ! run_in_container_bash "${c_name}" "${chk_cmd}" 2>/dev/null; then
        error "Container Pre-extraction Gate Failed: SHA-256 checksum mismatch in container staging."
        return 3
    fi

    info "Auditing payload archive paths inside container..."
    local audit_cmd="cd '${container_staging_dir}' && tar -tzf payload/app.tar.gz | grep -E '^/|\\.\\./'"
    local bad_paths
    bad_paths=$(run_in_container_bash "${c_name}" "${audit_cmd}" 2>/dev/null || true)
    if [ -n "${bad_paths}" ]; then
        error "Container Pre-extraction Gate Failed: Payload archive contains unsafe paths:\n${bad_paths}"
        return 3
    fi

    success "Container pre-extraction verification passed."
    return 0
}

verify_archive_in_container() {
    local c_name="$1"
    local container_archive_path="$2"
    local expected_hash="$3"

    info "Verifying SHA-256 integrity of deployment archive in container..."
    local actual_hash
    actual_hash=$(run_in_container "${c_name}" sha256sum "${container_archive_path}" 2>/dev/null | awk '{print $1}' || true)

    if [ "${actual_hash}" != "${expected_hash}" ]; then
        error "Archive checksum mismatch! Expected: ${expected_hash}, Actual: ${actual_hash}"
        return 3
    fi
    success "Archive integrity verified (${expected_hash:0:12}...)."
    return 0
}

# Retained for backwards compatibility with test harnesses and legacy callers
build_release_archive() {
    local src_dir="$1"
    local dest_archive="$2"

    if [ ! -d "${src_dir}/app" ] || [ ! -f "${src_dir}/requirements.txt" ]; then
        error "Source directory '${src_dir}' is missing required 'app/' directory or 'requirements.txt'."
        return 1
    fi

    mkdir -p "$(dirname "${dest_archive}")"
    tar -czf "${dest_archive}" \
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
        --exclude="shared" \
        --exclude="models" \
        --exclude="interpreters" \
        --exclude="*.pth" \
        --exclude="*.pt" \
        -C "${src_dir}" \
        app requirements.txt
}
