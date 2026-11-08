#!/usr/bin/env bash
# scripts/lib/release.sh - Release extraction, symlink creation, and atomic switching
set -euo pipefail

generate_release_id() {
    date -u +"%Y%m%d-%H%M%S"
}

prepare_release_staging() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    run_in_container "${c_name}" mkdir -p "${app_dir}/staging" "${app_dir}/releases" "${app_dir}/venvs" "${app_dir}/shared/data"
}

extract_release_in_container() {
    local c_name="$1"
    local app_dir="$2"
    local release_id="$3"
    local container_staged_item="$4"

    local release_dir="${app_dir}/releases/${release_id}"
    run_in_container "${c_name}" mkdir -p "${release_dir}"

    info "Extracting release into ${release_dir}..."

    # Check if container_staged_item is a release package directory containing payload
    if container_test_file "${c_name}" "${container_staged_item}/manifest.json"; then
        local ext_cmd="tar -xzf '${container_staged_item}/payload/app.tar.gz' -C '${release_dir}' && cp '${container_staged_item}/payload/requirements.txt' '${release_dir}/requirements.txt' && cp '${container_staged_item}/manifest.json' '${release_dir}/manifest.json' && cp '${container_staged_item}/checksums.sha256' '${release_dir}/checksums.sha256'"
        if container_test_file "${c_name}" "${container_staged_item}/payload/systemd/e-webui.service"; then
            ext_cmd="${ext_cmd} && mkdir -p '${release_dir}/systemd' && cp '${container_staged_item}/payload/systemd/e-webui.service' '${release_dir}/systemd/e-webui.service'"
        fi
        if ! run_in_container_bash "${c_name}" "${ext_cmd}"; then
            error "Failed to extract deployment package in container."
            return 3
        fi
        run_in_container "${c_name}" rm -rf "${container_staged_item}"
    else
        # Direct archive fallback
        if ! run_in_container "${c_name}" tar -xzf "${container_staged_item}" -C "${release_dir}"; then
            error "Failed to extract deployment archive in container."
            return 3
        fi
        run_in_container "${c_name}" rm -f "${container_staged_item}"
    fi

    return 0
}

link_release_environment() {
    local c_name="$1"
    local app_dir="$2"
    local release_id="$3"
    local venv_hash="$4"

    local release_dir="${app_dir}/releases/${release_id}"
    local target_venv
    if [ "$(type -t venv_dir_for_hash || true)" = "function" ]; then
        target_venv="$(venv_dir_for_hash "${app_dir}" "${venv_hash}")"
        if ! container_test_dir "${c_name}" "${target_venv}" && container_test_dir "${c_name}" "${app_dir}/venvs/${venv_hash}"; then
            target_venv="${app_dir}/venvs/${venv_hash}"
        fi
    else
        target_venv="${app_dir}/venvs/${venv_hash}"
    fi
    local target_data="${app_dir}/shared/data"

    # Symlink venv
    run_in_container_bash "${c_name}" "ln -sfn '${target_venv}' '${release_dir}/venv'"
    # Symlink shared data
    run_in_container_bash "${c_name}" "ln -sfn '${target_data}' '${release_dir}/data'"
}

atomic_switch_release() {
    local c_name="$1"
    local app_dir="$2"
    local release_id="$3"

    info "Atomically activating release '${release_id}'..."
    local switch_cmd="cd '${app_dir}' && ln -sfn 'releases/${release_id}' current_next && mv -Tf current_next current"
    if ! run_in_container_bash "${c_name}" "${switch_cmd}"; then
        error "Atomic symlink switch failed for release '${release_id}'."
        return 3
    fi
    success "Active pointer successfully switched to release '${release_id}'."
    return 0
}

atomic_switch_release_local() {
    local app_dir="$1"
    local release_id="$2"
    (
        cd "${app_dir}"
        ln -sfn "releases/${release_id}" current_next
        mv -Tf current_next current
    )
}

prune_old_releases() {
    local c_name="$1"
    local app_dir="$2"
    local keep_count="${3:-3}"

    local active_rel
    active_rel=$(state_get_active_release "${c_name}" "${app_dir}")
    local prev_rel
    prev_rel=$(state_get_previous_healthy_release "${c_name}" "${app_dir}")

    local py_prune="import os, shutil
app_dir = '${app_dir}'
releases_dir = os.path.join(app_dir, 'releases')
active_rel = '${active_rel}'
prev_rel = '${prev_rel}'
keep_count = int('${keep_count}')

if os.path.exists(releases_dir):
    all_releases = sorted([d for d in os.listdir(releases_dir) if os.path.isdir(os.path.join(releases_dir, d))])
    # Keep active and previous no matter what
    protected = {active_rel, prev_rel}
    to_consider = [r for r in all_releases if r not in protected]
    # Keep the most recent keep_count from remainder
    to_delete = to_consider[:-keep_count] if len(to_consider) > keep_count else []
    for r in to_delete:
        target = os.path.join(releases_dir, r)
        try:
            shutil.rmtree(target)
            print(f'Pruned old release: {r}')
        except Exception:
            pass
"
    run_in_container "${c_name}" python3 -c "${py_prune}" 2>/dev/null || true
}
