#!/usr/bin/env bash
# scripts/deploy.sh - e-webui Deployment Lifecycle Manager for Incus Containers
# Conforms to spec: specs/008-deployment-lifecycle-manager/spec.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"

# Load modules
source "${LIB_DIR}/common.sh"
source "${LIB_DIR}/incus.sh"
source "${LIB_DIR}/lock.sh"
source "${LIB_DIR}/state.sh"
source "${LIB_DIR}/service.sh"
source "${LIB_DIR}/health.sh"
source "${LIB_DIR}/archive.sh"
source "${LIB_DIR}/venv.sh"
source "${LIB_DIR}/release.sh"
if [ -f "${LIB_DIR}/rollback.sh" ]; then source "${LIB_DIR}/rollback.sh"; fi
if [ -f "${LIB_DIR}/detect.sh" ]; then source "${LIB_DIR}/detect.sh"; fi
if [ -f "${LIB_DIR}/provision.sh" ]; then source "${LIB_DIR}/provision.sh"; fi
if [ -f "${LIB_DIR}/migrate.sh" ]; then source "${LIB_DIR}/migrate.sh"; fi
if [ -f "${LIB_DIR}/uninstall.sh" ]; then source "${LIB_DIR}/uninstall.sh"; fi
if [ -f "${LIB_DIR}/diagnostics.sh" ]; then source "${LIB_DIR}/diagnostics.sh"; fi

# Defaults
APP_DIR="/opt/e-webui"
CONTAINER_NAME="e-webui-app"
HOST_PORT=8080
OLLAMA_TARGET="127.0.0.1:11434"
NON_INTERACTIVE=0
FORCE_RESET=0
RETENTION_COUNT=3
PURGE_DATA=0
OPERATION="auto"
RELEASE_PATH=""

show_help() {
    cat <<EOF
Usage: $(basename "$0") [OPERATION] [OPTIONS] [CONTAINER_NAME]

e-webui Deployment Lifecycle Manager for Incus Containers.

Operations:
  (no operation)       Automatically detect whether to install or update
  --install            Perform initial container provisioning and installation
  --update             Update existing deployment using zero-rebuild release switch
  --rollback           Restore previous healthy release
  --status             Display container, release, service, and health status
  --repair             Audit and repair broken symlinks, venvs, and service units
  --uninstall          Remove services and configuration (preserves shared data by default)
  -h, --help           Show this help message and exit

Options:
  --release <PATH>     Path to release package directory or .tar.gz bundle (default: latest in dist/releases)
  -p, --port <PORT>    Host port to bind for Web UI proxy (default: 8080)
  -o, --ollama-url <URL>
                       Explicit Ollama host address for proxy (default: 127.0.0.1:11434)
  -y, --yes, --non-interactive
                       Automatically confirm all step prompts
  -r, --reset          Reset saved deployment state and re-provision from scratch
  --purge-data         Used with --uninstall to remove persistent application data
  --retention <COUNT>  Number of past healthy releases to retain (default: 3)

Exit Codes:
  0    Success
  1    User abort
  2    Pre-check / configuration error / lock contention
  3    Execution failure
  4    Health check failure (automatic rollback triggered)
  5    Rollback failure
EOF
}

# Parse CLI arguments
while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        --release)
            if [ -n "${2:-}" ]; then
                RELEASE_PATH="$2"
                shift 2
            else
                error "Option --release requires a package directory or .tar.gz bundle path."
                exit 2
            fi
            ;;
        --install)
            OPERATION="install"
            shift
            ;;
        --update)
            OPERATION="update"
            shift
            ;;
        --rollback)
            OPERATION="rollback"
            shift
            ;;
        --status)
            OPERATION="status"
            shift
            ;;
        --repair)
            OPERATION="repair"
            shift
            ;;
        --uninstall)
            OPERATION="uninstall"
            shift
            ;;
        -y|--yes|--non-interactive)
            NON_INTERACTIVE=1
            shift
            ;;
        -r|--reset)
            FORCE_RESET=1
            shift
            ;;
        --purge-data)
            PURGE_DATA=1
            shift
            ;;
        -p|--port)
            if [ -n "${2:-}" ] && [[ "$2" =~ ^[0-9]+$ ]]; then
                HOST_PORT="$2"
                shift 2
            else
                error "Option --port requires a numerical port."
                exit 2
            fi
            ;;
        -o|--ollama-url)
            if [ -n "${2:-}" ]; then
                OLLAMA_TARGET="$2"
                shift 2
            else
                error "Option --ollama-url requires a target URL/address."
                exit 2
            fi
            ;;
        --retention)
            if [ -n "${2:-}" ] && [[ "$2" =~ ^[0-9]+$ ]]; then
                RETENTION_COUNT="$2"
                shift 2
            else
                error "Option --retention requires an integer count."
                exit 2
            fi
            ;;
        -*)
            error "Unknown option: $1"
            show_help
            exit 2
            ;;
        *)
            CONTAINER_NAME="$1"
            shift
            ;;
    esac
done

resolve_and_prepare_release() {
    local requested_path="$1"
    local dist_dir="$2"
    local release_pkg="${requested_path}"

    if [ -n "${release_pkg}" ]; then
        if [ ! -e "${release_pkg}" ]; then
            error "Specified release path does not exist: ${release_pkg}"
            return 2
        fi
    else
        release_pkg=$(find_latest_release_package "${dist_dir}") || true
    fi

    if [ -z "${release_pkg}" ] || [ ! -e "${release_pkg}" ]; then
        error "No release package found."
        info "Please build a release using './build-release.sh' or specify '--release <path>'."
        return 2
    fi

    echo "${release_pkg}"
    return 0
}

# --- Core Workflow: run_update ---
run_update() {
    banner "Initiating e-webui Application Update on '${CONTAINER_NAME}'"

    check_incus_installed || exit 2

    if ! container_exists "${CONTAINER_NAME}"; then
        error "Target container '${CONTAINER_NAME}' does not exist. Cannot update."
        info "Use --install to provision a new container."
        exit 2
    fi

    if ! container_is_running "${CONTAINER_NAME}"; then
        info "Container '${CONTAINER_NAME}' is stopped. Starting container..."
        if ! incus_cmd start "${CONTAINER_NAME}"; then
            error "Failed to start container '${CONTAINER_NAME}'."
            exit 3
        fi
        sleep 2
    fi

    acquire_lock "${CONTAINER_NAME}" "${APP_DIR}" || exit 2

    local release_pkg
    release_pkg=$(resolve_and_prepare_release "${RELEASE_PATH}" "${REPO_ROOT}/dist/releases") || exit 2
    info "Consuming release package: ${release_pkg}"

    local host_staging
    host_staging=$(mktemp -d "/tmp/e-webui-deploy-stage.XXXXXX")
    register_cleanup "rm -rf '${host_staging}'"

    local release_dir
    release_dir=$(prepare_release_package_on_host "${release_pkg}" "${host_staging}")

    # Host Pre-flight Verification
    info "Running host pre-flight verification on release package..."
    verify_release_package_on_host "${release_dir}" || exit 2

    local release_id
    release_id=$(get_manifest_field "${release_dir}/manifest.json" "release_id")
    local app_version
    app_version=$(get_manifest_field "${release_dir}/manifest.json" "version")
    local git_commit
    git_commit=$(get_manifest_field "${release_dir}/manifest.json" "git.commit")

    info "Deploying release: ${release_id} (v${app_version}, git: ${git_commit:-none})"

    local req_hash
    req_hash=$(calculate_requirements_hash "${release_dir}/payload/requirements.txt")
    info "Requirements hash: ${req_hash:0:16}..."

    # Check if currently active release already has identical code
    local active_rel
    active_rel=$(state_get_active_release "${CONTAINER_NAME}" "${APP_DIR}")
    info "Currently active release: ${active_rel:-none}"

    # Transfer release to container staging
    prepare_release_staging "${CONTAINER_NAME}" "${APP_DIR}"
    local container_staging="${APP_DIR}/staging/release-${release_id}"
    run_in_container "${CONTAINER_NAME}" rm -rf "${container_staging}"
    run_in_container "${CONTAINER_NAME}" mkdir -p "${container_staging}"

    info "Transferring release package to container staging..."
    container_push_dir_contents "${release_dir}" "${CONTAINER_NAME}${container_staging}/"

    # Container Pre-extraction Verification
    verify_release_in_container "${CONTAINER_NAME}" "${container_staging}" || exit 3

    # Extract release in container
    extract_release_in_container "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}" "${container_staging}"

    # Ensure virtual environment
    local req_container="${APP_DIR}/releases/${release_id}/requirements.txt"
    ensure_venv_in_container "${CONTAINER_NAME}" "${APP_DIR}" "${req_container}" "${req_hash}"

    # Link dependencies and data
    link_release_environment "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}" "${req_hash}"

    # Atomically switch current release pointer
    atomic_switch_release "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}"

    # Restart service
    info "Restarting systemd service 'e-webui'..."
    restart_service "${CONTAINER_NAME}"

    # Health check
    if verify_http_health "${CONTAINER_NAME}" "${HOST_PORT}" 15 2; then
        state_commit_release "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}" "${req_hash}" "${HOST_PORT}" "${OLLAMA_TARGET}" "${app_version}" "${git_commit}"
        prune_old_releases "${CONTAINER_NAME}" "${APP_DIR}" "${RETENTION_COUNT}"
        success "Release '${release_id}' (v${app_version}) successfully deployed and verified healthy!"
        return 0
    else
        error "Health check failed after activating release '${release_id}'."
        if [ "$(type -t trigger_rollback || true)" = "function" ]; then
            trigger_rollback "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}" "${HOST_PORT}"
            exit 4
        else
            error "Rollback helper not loaded. Aborting."
            exit 4
        fi
    fi
}

# --- Core Workflow: run_install ---
run_install() {
    banner "Initiating e-webui Initial Installation on '${CONTAINER_NAME}'"

    check_incus_installed || exit 2

    # Step 1: Provision Container
    provision_container "${CONTAINER_NAME}"

    # Acquire lock
    acquire_lock "${CONTAINER_NAME}" "${APP_DIR}" || exit 2

    # Step 2: Configure Incus Proxy Devices
    configure_proxy_devices "${CONTAINER_NAME}" "${HOST_PORT}" "${OLLAMA_TARGET}"

    # Step 3: Install OS Prerequisites
    install_system_prerequisites "${CONTAINER_NAME}"

    # Step 4: Setup Release Directory Structure
    setup_deployment_directories "${CONTAINER_NAME}" "${APP_DIR}"

    # Step 5: Resolve, Stage, and Verify Initial Release Package
    local release_pkg
    release_pkg=$(resolve_and_prepare_release "${RELEASE_PATH}" "${REPO_ROOT}/dist/releases") || exit 2
    info "Consuming initial release package: ${release_pkg}"

    local host_staging
    host_staging=$(mktemp -d "/tmp/e-webui-deploy-stage.XXXXXX")
    register_cleanup "rm -rf '${host_staging}'"

    local release_dir
    release_dir=$(prepare_release_package_on_host "${release_pkg}" "${host_staging}")

    # Host Pre-flight Verification
    info "Running host pre-flight verification on release package..."
    verify_release_package_on_host "${release_dir}" || exit 2

    local release_id
    release_id=$(get_manifest_field "${release_dir}/manifest.json" "release_id")
    local app_version
    app_version=$(get_manifest_field "${release_dir}/manifest.json" "version")
    local git_commit
    git_commit=$(get_manifest_field "${release_dir}/manifest.json" "git.commit")

    info "Preparing initial release: ${release_id} (v${app_version})"

    local req_hash
    req_hash=$(calculate_requirements_hash "${release_dir}/payload/requirements.txt")

    prepare_release_staging "${CONTAINER_NAME}" "${APP_DIR}"
    local container_staging="${APP_DIR}/staging/release-${release_id}"
    run_in_container "${CONTAINER_NAME}" rm -rf "${container_staging}"
    run_in_container "${CONTAINER_NAME}" mkdir -p "${container_staging}"

    info "Transferring initial release package to container staging..."
    container_push_dir_contents "${release_dir}" "${CONTAINER_NAME}${container_staging}/"

    verify_release_in_container "${CONTAINER_NAME}" "${container_staging}" || exit 3
    extract_release_in_container "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}" "${container_staging}"

    # Step 6: Create Virtual Environment and Install Dependencies
    local req_container="${APP_DIR}/releases/${release_id}/requirements.txt"
    ensure_venv_in_container "${CONTAINER_NAME}" "${APP_DIR}" "${req_container}" "${req_hash}"

    # Step 7: Link Dependencies & Data
    link_release_environment "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}" "${req_hash}"

    # Step 8: Configure and Install Systemd Service
    install_service_unit "${CONTAINER_NAME}" "${APP_DIR}" "${HOST_PORT}" "http://${OLLAMA_TARGET}"

    # Step 9: Atomically Set Initial Active Release
    atomic_switch_release "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}"

    # Step 10: Start Service & Verify Health
    info "Starting systemd service 'e-webui'..."
    restart_service "${CONTAINER_NAME}"

    if verify_http_health "${CONTAINER_NAME}" "${HOST_PORT}" 15 2; then
        state_commit_release "${CONTAINER_NAME}" "${APP_DIR}" "${release_id}" "${req_hash}" "${HOST_PORT}" "${OLLAMA_TARGET}" "${app_version}" "${git_commit}"
        success "Initial installation completed successfully! Release '${release_id}' (v${app_version}) is active."
        return 0
    else
        error "Health check failed during initial installation."
        exit 4
    fi
}

# --- Core Workflow: run_auto ---
run_auto() {
    check_incus_installed || exit 2

    local state
    state=$(detect_deployment_state "${CONTAINER_NAME}" "${APP_DIR}")
    info "Detected deployment state for '${CONTAINER_NAME}': ${state}"

    case "${state}" in
        "${DEPLOY_STATE_NOT_FOUND}")
            info "Container '${CONTAINER_NAME}' does not exist. Initiating installation workflow..."
            run_install
            ;;
        "${DEPLOY_STATE_MANAGED}")
            info "Managed deployment detected. Initiating update workflow..."
            run_update
            ;;
        "${DEPLOY_STATE_LEGACY}")
            warn "Legacy e-webui deployment detected on '${CONTAINER_NAME}'."
            if [ "$(type -t run_migrate || true)" = "function" ]; then
                run_migrate
            else
                info "Migrating legacy deployment..."
                run_install
            fi
            ;;
        "${DEPLOY_STATE_UNMANAGED}")
            warn "Container '${CONTAINER_NAME}' exists but is NOT managed by e-webui deployment tool."
            if [ "${NON_INTERACTIVE}" -eq 1 ]; then
                error "Aborting: Non-interactive mode will not automatically modify an unmanaged container without --install."
                exit 2
            else
                printf "%bDo you want to install e-webui into this existing container? [y/N]: %b" "${C_BOLD}" "${C_RESET}"
                read -r resp || true
                case "${resp}" in
                    [yY]|[yY][eE][sS])
                        run_install
                        ;;
                    *)
                        error "Installation aborted by user."
                        exit 1
                        ;;
                esac
            fi
            ;;
        *)
            error "Unknown deployment state: ${state}"
            exit 2
            ;;
    esac
}

# --- Main Dispatcher ---
main() {
    case "${OPERATION}" in
        auto)
            run_auto
            ;;
        install)
            run_install
            ;;
        update)
            run_update
            ;;
        rollback)
            if [ "$(type -t run_rollback_cli || true)" = "function" ]; then
                run_rollback_cli "${CONTAINER_NAME}" "${APP_DIR}" "${HOST_PORT}"
            else
                error "Rollback module not loaded."
                exit 2
            fi
            ;;
        status)
            if [ "$(type -t run_status_cli || true)" = "function" ]; then
                run_status_cli "${CONTAINER_NAME}" "${APP_DIR}" "${HOST_PORT}"
            else
                error "Status module not loaded."
                exit 2
            fi
            ;;
        repair)
            if [ "$(type -t run_repair_cli || true)" = "function" ]; then
                run_repair_cli "${CONTAINER_NAME}" "${APP_DIR}" "${HOST_PORT}" "${OLLAMA_TARGET}"
            else
                error "Repair module not loaded."
                exit 2
            fi
            ;;
        uninstall)
            if [ "$(type -t run_uninstall_cli || true)" = "function" ]; then
                run_uninstall_cli "${CONTAINER_NAME}" "${APP_DIR}" "${PURGE_DATA}"
            else
                error "Uninstall module not loaded."
                exit 2
            fi
            ;;
        *)
            error "Unsupported operation: ${OPERATION}"
            exit 2
            ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
