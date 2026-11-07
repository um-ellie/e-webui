#!/usr/bin/env bash
# scripts/lib/state.sh - Persistent deployment state manager conforming to deploy-state-schema.json
set -euo pipefail

STATE_FILE_NAME=".deploy_state"

state_file_path() {
    local app_dir="${1:-/opt/e-webui}"
    echo "${app_dir}/${STATE_FILE_NAME}"
}

state_exists() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    container_test_file "${c_name}" "$(state_file_path "${app_dir}")"
}

state_read_field() {
    local c_name="$1"
    local field="$2"
    local app_dir="${3:-/opt/e-webui}"
    local path
    path="$(state_file_path "${app_dir}")"

    if ! state_exists "${c_name}" "${app_dir}"; then
        return 1
    fi

    local py_cmd="import json, sys
try:
    with open('${path}', 'r') as f:
        data = json.load(f)
    val = data.get('${field}', '')
    print(val if val is not None else '')
except Exception:
    sys.exit(1)
"
    run_in_container "${c_name}" python3 -c "${py_cmd}" 2>/dev/null || true
}

state_get_active_release() {
    state_read_field "$1" "active_release" "${2:-/opt/e-webui}"
}

state_get_previous_healthy_release() {
    state_read_field "$1" "previous_healthy_release" "${2:-/opt/e-webui}"
}

state_get_active_venv_hash() {
    state_read_field "$1" "active_venv_hash" "${2:-/opt/e-webui}"
}

state_get_active_version() {
    state_read_field "$1" "active_version" "${2:-/opt/e-webui}"
}

state_get_git_commit() {
    state_read_field "$1" "git_commit" "${2:-/opt/e-webui}"
}

state_get_tts_python_version() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local path
    path="$(state_file_path "${app_dir}")"
    local py_cmd="import json, sys
try:
    with open('${path}', 'r') as f:
        data = json.load(f)
    print(data.get('tts_environment', {}).get('python_version', ''))
except Exception:
    sys.exit(0)
"
    run_in_container "${c_name}" python3 -c "${py_cmd}" 2>/dev/null || true
}

state_get_tts_model_present() {
    local c_name="$1"
    local app_dir="${2:-/opt/e-webui}"
    local path
    path="$(state_file_path "${app_dir}")"
    local py_cmd="import json, sys
try:
    with open('${path}', 'r') as f:
        data = json.load(f)
    print(data.get('tts_environment', {}).get('model_present', False))
except Exception:
    sys.exit(0)
"
    run_in_container "${c_name}" python3 -c "${py_cmd}" 2>/dev/null || true
}

state_update_tts_environment() {
    local c_name="$1"
    local app_dir="$2"
    local py_ver="$3"
    local deps_ready="$4"
    local model_present="$5"
    local model_dir="$6"
    local path
    path="$(state_file_path "${app_dir}")"

    local py_script="import json, os
path = '${path}'
if os.path.exists(path):
    try:
        with open(path, 'r') as f:
            data = json.load(f)
    except Exception:
        data = {}
else:
    data = {}

data['tts_environment'] = {
    'python_version': '${py_ver}',
    'dependencies_ready': str('${deps_ready}').lower() in ['true', '1', 'yes'],
    'model_present': str('${model_present}').lower() in ['true', '1', 'yes'],
    'model_dir': '${model_dir}'
}

with open(path + '.tmp', 'w') as f:
    json.dump(data, f, indent=2)
os.replace(path + '.tmp', path)
"
    run_in_container "${c_name}" python3 -c "${py_script}" 2>/dev/null || true
}

state_commit_release() {
    local c_name="$1"
    local app_dir="$2"
    local release_id="$3"
    local venv_hash="$4"
    local host_port="$5"
    local ollama_target="$6"
    local app_version="${7:-}"
    local git_commit="${8:-}"
    local path
    path="$(state_file_path "${app_dir}")"

    # Sanitize inputs to prevent string breakout in embedded python script
    local safe_app_version="${app_version//\'/}"
    local safe_git_commit="${git_commit//\'/}"
    local safe_c_name="${c_name//\'/}"
    local safe_release_id="${release_id//\'/}"
    local safe_venv_hash="${venv_hash//\'/}"
    local safe_ollama_target="${ollama_target//\'/}"

    local py_script="import json, os, datetime
path = '${path}'
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
if os.path.exists(path):
    try:
        with open(path, 'r') as f:
            data = json.load(f)
    except Exception:
        data = {}
else:
    data = {}

data['schema_version'] = 2
data['container_name'] = '${safe_c_name}'
old_active = data.get('active_release')
if old_active and old_active != '${safe_release_id}':
    data['previous_healthy_release'] = old_active

data['active_release'] = '${safe_release_id}'
data['active_venv_hash'] = '${safe_venv_hash}'
if '${safe_app_version}':
    data['active_version'] = '${safe_app_version}'
if '${safe_git_commit}':
    data['git_commit'] = '${safe_git_commit}'
data['host_port'] = int('${host_port}')
data['ollama_target'] = '${safe_ollama_target}'
if 'installed_at' not in data:
    data['installed_at'] = now
data['last_updated_at'] = now

history = data.get('history', [])
history_entry = {
    'release_id': '${safe_release_id}',
    'deployed_at': now,
    'requirements_hash': '${safe_venv_hash}',
    'status': 'healthy'
}
if '${safe_app_version}':
    history_entry['version'] = '${safe_app_version}'
if '${safe_git_commit}':
    history_entry['git_commit'] = '${safe_git_commit}'
history.append(history_entry)
data['history'] = history

with open(path + '.tmp', 'w') as f:
    json.dump(data, f, indent=2)
os.replace(path + '.tmp', path)
"
    run_in_container "${c_name}" python3 -c "${py_script}"
}

state_record_rollback() {
    local c_name="$1"
    local app_dir="$2"
    local failed_release_id="$3"
    local restored_release_id="$4"
    local path
    path="$(state_file_path "${app_dir}")"

    local py_script="import json, os, datetime
path = '${path}'
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
if os.path.exists(path):
    with open(path, 'r') as f:
        data = json.load(f)
    data['active_release'] = '${restored_release_id}'
    data['last_updated_at'] = now
    restored_manifest = os.path.join('${app_dir}', 'releases', '${restored_release_id}', 'manifest.json')
    if os.path.exists(restored_manifest):
        try:
            with open(restored_manifest, 'r') as mf:
                mdata = json.load(mf)
            if 'version' in mdata:
                data['active_version'] = mdata['version']
            if 'git' in mdata and isinstance(mdata['git'], dict) and 'commit' in mdata['git']:
                data['git_commit'] = mdata['git']['commit']
        except Exception:
            pass
    history = data.get('history', [])
    history.append({
        'release_id': '${failed_release_id}',
        'deployed_at': now,
        'status': 'failed'
    })
    history.append({
        'release_id': '${restored_release_id}',
        'deployed_at': now,
        'status': 'rolled_back'
    })
    data['history'] = history
    with open(path + '.tmp', 'w') as f:
        json.dump(data, f, indent=2)
    os.replace(path + '.tmp', path)
"
    run_in_container "${c_name}" python3 -c "${py_script}" 2>/dev/null || true
}
