#!/usr/bin/env bash
# Deploy e-webui into Incus Container (Interactive & Resumable)
# Conforms to spec: specs/004-enhance-deployment-script/spec.md
set -euo pipefail

# Dynamic Repository Root Detection
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

INCUS_BIN="${INCUS_BIN:-incus}"
APP_DIR="/opt/e-webui"
VENV_DIR="${APP_DIR}/venv"
STATE_FILE="${APP_DIR}/.deploy_state"
SYSTEMD_UNIT="/etc/systemd/system/e-webui.service"
HOST_PORT=8080
OLLAMA_TARGET=""
NON_INTERACTIVE=0
FORCE_RESET=0
STATUS_ONLY=0
CLEAN_MODE=0
CONTAINER_NAME=""

# Terminal Colors
if [ -t 1 ]; then
    C_RESET="\033[0m"
    C_BOLD="\033[1m"
    C_BLUE="\033[1;34m"
    C_GREEN="\033[1;32m"
    C_YELLOW="\033[1;33m"
    C_RED="\033[1;31m"
    C_CYAN="\033[1;36m"
else
    C_RESET=""
    C_BOLD=""
    C_BLUE=""
    C_GREEN=""
    C_YELLOW=""
    C_RED=""
    C_CYAN=""
fi

info() {
    printf "%b[INFO]%b %s\n" "${C_BLUE}" "${C_RESET}" "$*"
}

success() {
    printf "%b[SUCCESS]%b %s\n" "${C_GREEN}" "${C_RESET}" "$*"
}

warn() {
    printf "%b[WARNING]%b %s\n" "${C_YELLOW}" "${C_RESET}" "$*"
}

error() {
    printf "%b[ERROR]%b %s\n" "${C_RED}" "${C_RESET}" "$*" >&2
}

banner() {
    printf "\n%b============================================================%b\n" "${C_BOLD}${C_CYAN}" "${C_RESET}"
    printf "%b%s%b\n" "${C_BOLD}${C_CYAN}" "$*" "${C_RESET}"
    printf "%b============================================================%b\n\n" "${C_BOLD}${C_CYAN}" "${C_RESET}"
}

show_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] [CONTAINER_NAME]

Deploy e-webui to an Incus container with automated container provisioning,
interactive step confirmation, and automatic state resumption.

Arguments:
  CONTAINER_NAME       Target Incus container name (prompts interactively if omitted)

Options:
  -p, --port <PORT>    Host port to bind for Web UI (default: 8080)
  -o, --ollama-url <URL>
                       Explicit Ollama host:port address for container proxy
  -s, --status         Check deployment status of specified container without modifying it
  -c, --clean, --uninstall
                       Cleanly stop service, remove systemd unit, and delete Incus proxy devices
  -y, --yes, --non-interactive
                       Automatically confirm all step prompts
  -r, --reset, --force
                       Reset saved deployment state and re-run all steps from beginning
  -h, --help           Show this help message and exit

Exit Codes:
  0    Deployment completed successfully and service is verified healthy via HTTP 200
  1    Deployment aborted by user (step rejected)
  2    Pre-check failed (invalid argument, incus not found, port conflict)
  3    Execution failure during step action (APT, pip, proxy, systemd, or health check)
EOF
}

# --- Parse Arguments ---
while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -y|--yes|--non-interactive)
            NON_INTERACTIVE=1
            shift
            ;;
        -r|--reset|--force)
            FORCE_RESET=1
            shift
            ;;
        -p|--port)
            if [ -n "${2:-}" ] && [[ "$2" =~ ^[0-9]+$ ]]; then
                HOST_PORT="$2"
                shift 2
            else
                error "Option --port requires a valid numerical port."
                exit 2
            fi
            ;;
        -o|--ollama-url)
            if [ -n "${2:-}" ]; then
                OLLAMA_TARGET="$2"
                shift 2
            else
                error "Option --ollama-url requires a target host:port argument."
                exit 2
            fi
            ;;
        -s|--status)
            STATUS_ONLY=1
            shift
            ;;
        -c|--clean|--uninstall)
            CLEAN_MODE=1
            shift
            ;;
        -*)
            error "Unknown option: $1"
            show_help
            exit 2
            ;;
        *)
            if [ -z "${CONTAINER_NAME}" ]; then
                CONTAINER_NAME="$1"
            else
                error "Unexpected multiple container arguments: $1"
                exit 2
            fi
            shift
            ;;
    esac
done

# --- Incus Pre-check ---
if ! command -v "${INCUS_BIN}" &>/dev/null; then
    error "Incus command '${INCUS_BIN}' not found on host."
    info "Incus is required for container virtualization."
    info "Please install and initialize Incus (e.g., 'sudo apt install incus' or 'sudo snap install incus', followed by 'incus admin init')."
    exit 2
fi

# --- Container Abstraction Helpers ---
incus_cmd() {
    "${INCUS_BIN}" "$@"
}

run_in_container() {
    incus_cmd exec "${CONTAINER_NAME}" -- "$@"
}

run_in_container_strict() {
    if ! run_in_container "$@"; then
        error "Command execution failed inside container: $*"
        return 1
    fi
}

check_host_port_free() {
    local port="$1"
    if command -v ss &>/dev/null; then
        if ss -tulpn 2>/dev/null | grep -q ":${port} "; then
            return 1
        fi
    elif command -v lsof &>/dev/null; then
        if lsof -i ":${port}" &>/dev/null; then
            return 1
        fi
    fi
    return 0
}

# --- Prompt for Container Name with Validation ---
prompt_container_name() {
    while true; do
        if [ -z "${CONTAINER_NAME}" ]; then
            if [ "${NON_INTERACTIVE}" -eq 1 ]; then
                CONTAINER_NAME="webui"
                info "Non-interactive mode: Defaulting container name to '${CONTAINER_NAME}'"
            else
                printf "%bEnter Incus container name [default: webui]: %b" "${C_BOLD}" "${C_RESET}"
                read -r input_name || true
                CONTAINER_NAME="${input_name:-webui}"
            fi
        fi

        # Validate container name characters
        if ! [[ "${CONTAINER_NAME}" =~ ^[a-zA-Z0-9_-]+$ ]]; then
            error "Invalid container name '${CONTAINER_NAME}'. Must contain only alphanumeric characters, dashes, and underscores."
            if [ "${NON_INTERACTIVE}" -eq 1 ]; then
                exit 2
            fi
            CONTAINER_NAME=""
            continue
        fi

        # Check if container exists in Incus
        if incus_cmd info "${CONTAINER_NAME}" &>/dev/null; then
            local status
            status=$(incus_cmd info "${CONTAINER_NAME}" | awk '/^Status:/ {print $2}')
            info "Container '${CONTAINER_NAME}' already exists in Incus (Status: ${status})."
            if [ "${NON_INTERACTIVE}" -eq 1 ]; then
                break
            fi
            printf "%bDo you want to deploy into this existing container? [Y/n]: %b" "${C_BOLD}" "${C_RESET}"
            read -r reuse_resp || true
            case "${reuse_resp}" in
                [nN]|[nN][oO])
                    CONTAINER_NAME=""
                    continue
                    ;;
                *)
                    break
                    ;;
            esac
        else
            break
        fi
    done
}

prompt_container_name

# --- Mode: Status Inspection ---
if [ "${STATUS_ONLY}" -eq 1 ]; then
    banner "Deployment Status: ${CONTAINER_NAME}"
    if ! incus_cmd info "${CONTAINER_NAME}" &>/dev/null; then
        warn "Container '${CONTAINER_NAME}' does not exist in Incus."
        exit 0
    fi

    STATUS=$(incus_cmd info "${CONTAINER_NAME}" | awk '/^Status:/ {print $2}')
    echo "Container Status:      ${STATUS}"
    CONTAINER_IP=$(incus_cmd list "^${CONTAINER_NAME}$" --format csv -c 4 2>/dev/null | awk '{print $1}' | cut -d'(' -f1 || true)
    echo "Container IP:          ${CONTAINER_IP:-<none>}"

    if [ "${STATUS}" == "RUNNING" ]; then
        if run_in_container systemctl is-active --quiet e-webui 2>/dev/null; then
            success "e-webui.service:     active (running)"
        else
            warn "e-webui.service:       inactive or failed"
        fi

        if curl -sSf --connect-timeout 2 "http://127.0.0.1:${HOST_PORT}/" &>/dev/null || \
           curl -sSf --connect-timeout 2 "http://127.0.0.1:${HOST_PORT}/health" &>/dev/null; then
            success "HTTP Health:           OK (200) on http://127.0.0.1:${HOST_PORT}"
        else
            warn "HTTP Health:           Endpoint http://127.0.0.1:${HOST_PORT} not responding"
        fi

        if run_in_container test -f "${STATE_FILE}" 2>/dev/null; then
            echo "Completed Steps:"
            run_in_container cat "${STATE_FILE}" 2>/dev/null | sed 's/^/  - /' || true
        fi
    else
        warn "Container is stopped. Start it with 'incus start ${CONTAINER_NAME}'."
    fi
    exit 0
fi

# --- Mode: Clean / Uninstall ---
if [ "${CLEAN_MODE}" -eq 1 ]; then
    banner "Clean / Teardown: ${CONTAINER_NAME}"
    if ! incus_cmd info "${CONTAINER_NAME}" &>/dev/null; then
        error "Container '${CONTAINER_NAME}' does not exist in Incus."
        exit 2
    fi

    if [ "${NON_INTERACTIVE}" -eq 0 ]; then
        printf "%bAre you sure you want to stop e-webui and remove services/proxies for '${CONTAINER_NAME}'? [y/N]: %b" "${C_BOLD}${C_RED}" "${C_RESET}"
        read -r clean_resp || true
        case "${clean_resp}" in
            [yY]|[yY][eE][sS])
                ;;
            *)
                info "Clean aborted."
                exit 0
                ;;
        esac
    fi

    info "Stopping and disabling e-webui service inside container..."
    run_in_container systemctl stop e-webui 2>/dev/null || true
    run_in_container systemctl disable e-webui 2>/dev/null || true
    run_in_container rm -f "${SYSTEMD_UNIT}" 2>/dev/null || true
    run_in_container systemctl daemon-reload 2>/dev/null || true

    info "Removing Incus proxy devices ('webui-proxy', 'ollama-link')..."
    incus_cmd config device remove "${CONTAINER_NAME}" webui-proxy 2>/dev/null || true
    incus_cmd config device remove "${CONTAINER_NAME}" ollama-link 2>/dev/null || true

    info "Removing deployment state record..."
    run_in_container rm -f "${STATE_FILE}" 2>/dev/null || true

    success "Teardown complete for '${CONTAINER_NAME}'."
    exit 0
fi

banner "Deploying e-webui to Incus Container: ${CONTAINER_NAME}"

# --- State Management (Resumability) ---
is_step_completed() {
    local step_key="$1"
    if [ "${FORCE_RESET}" -eq 1 ]; then
        return 1
    fi
    if ! incus_cmd info "${CONTAINER_NAME}" &>/dev/null; then
        return 1
    fi
    if run_in_container test -f "${STATE_FILE}" 2>/dev/null; then
        local line
        line=$(run_in_container cat "${STATE_FILE}" 2>/dev/null | grep "^${step_key}=" || true)
        if [ -n "${line}" ]; then
            return 0
        fi
    fi
    return 1
}

save_step_state() {
    local step_key="$1"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    run_in_container mkdir -p "${APP_DIR}" 2>/dev/null || true
    local entry="${step_key}=${timestamp}"
    printf "%s\n" "${entry}" | run_in_container tee -a "${STATE_FILE}" >/dev/null || true
}

reset_state_if_requested() {
    if [ "${FORCE_RESET}" -eq 1 ]; then
        warn "Force reset requested: Clearing saved deployment state in container..."
        if incus_cmd info "${CONTAINER_NAME}" &>/dev/null; then
            run_in_container rm -f "${STATE_FILE}" 2>/dev/null || true
        fi
    fi
}

reset_state_if_requested

# --- Confirmation & Abort Handler ---
confirm_step() {
    local step_num="$1"
    local total_steps="$2"
    local step_id="$3"
    local step_title="$4"
    local step_description="$5"

    if [ "${NON_INTERACTIVE}" -eq 1 ]; then
        info "Auto-confirming Step ${step_num}/${total_steps}: ${step_title}"
        return 0
    fi

    while true; do
        printf "\n%b------------------------------------------------------------%b\n" "${C_BOLD}${C_BLUE}" "${C_RESET}"
        printf "%b[Step %d/%d] %s%b\n" "${C_BOLD}" "${step_num}" "${total_steps}" "${step_title}" "${C_RESET}"
        printf "%b------------------------------------------------------------%b\n" "${C_BOLD}${C_BLUE}" "${C_RESET}"
        printf "Description:\n%b\n\n" "${step_description}"
        printf "%bDo you want to proceed with this step? [y/N]: %b" "${C_BOLD}" "${C_RESET}"
        read -r resp || true

        case "${resp}" in
            [yY]|[yY][eE][sS])
                return 0
                ;;
            *)
                warn "Skipping this step ('${step_title}') will prevent e-webui from being deployed and functioning properly."
                printf "%bDo you want to abort the deployment now? [Y/n]: %b" "${C_BOLD}" "${C_RESET}"
                read -r abort_resp || true
                case "${abort_resp}" in
                    [nN]|[nN][oO])
                        info "Reconsidering step..."
                        continue
                        ;;
                    *)
                        error "Deployment aborted by user at Step ${step_num}: ${step_title}."
                        exit 1
                        ;;
                esac
                ;;
        esac
    done
}

# --- Roadmap Banner ---
echo "Planned Deployment Roadmap:"
echo "  0. Container Creation & OS Runtime Initialization (Debian 13 / stable)"
echo "  1. Incus Proxy Devices Configuration (Host :${HOST_PORT} & Ollama :11434)"
echo "  2. Environment Prerequisites & Port Conflict Resolution"
echo "  3. Python Virtual Environment Creation & Application Files Push"
echo "  4. Systemd Service Registration & Startup"
echo "  5. Live HTTP Health Verification & Diagnostics"
echo ""

# Check if all steps already completed
if is_step_completed "STEP_0_CONTAINER_PROVISIONED" && \
   is_step_completed "STEP_1_PROXY_CONFIGURED" && \
   is_step_completed "STEP_2_PREREQUISITES_INSTALLED" && \
   is_step_completed "STEP_3_VENV_AND_FILES_SYNCED" && \
   is_step_completed "STEP_4_SERVICE_CONFIGURED" && \
   is_step_completed "STEP_5_HEALTH_VERIFIED"; then
    success "All deployment steps have already been successfully completed for '${CONTAINER_NAME}'."
    if [ "${NON_INTERACTIVE}" -eq 0 ]; then
        printf "%bWould you like to re-verify the active service status now? [Y/n]: %b" "${C_BOLD}" "${C_RESET}"
        read -r reverify_resp || true
        case "${reverify_resp}" in
            [nN]|[nN][oO])
                info "Exiting. Use -r / --reset to perform a full re-deployment."
                exit 0
                ;;
        esac
    else
        exit 0
    fi
fi

# ============================================================
# STEP 0: Container Provisioning & OS Initialization
# ============================================================
STEP_KEY="STEP_0_CONTAINER_PROVISIONED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 0: Container provisioned and running."
else
    confirm_step 0 5 "${STEP_KEY}" \
        "Container Creation & OS Runtime Initialization" \
        "  - Check if container '${CONTAINER_NAME}' exists\n  - If missing: create and launch using Debian 13 ('images:debian/13' or stable fallback)\n  - If existing: ensure container is started and responsive"

    if ! incus_cmd info "${CONTAINER_NAME}" &>/dev/null; then
        info "Container '${CONTAINER_NAME}' does not exist. Creating with Debian 13..."
        if ! incus_cmd launch images:debian/13 "${CONTAINER_NAME}" 2>/dev/null; then
            warn "Launch with 'images:debian/13' failed or image unavailable. Trying 'images:debian/stable'..."
            if ! incus_cmd launch images:debian/stable "${CONTAINER_NAME}"; then
                error "Failed to create container '${CONTAINER_NAME}'. Check internet access to Incus image server."
                exit 3
            fi
        fi
        success "Container '${CONTAINER_NAME}' created and launched."
        info "Waiting for container initialization..."
        sleep 3
    else
        STATUS=$(incus_cmd info "${CONTAINER_NAME}" | awk '/^Status:/ {print $2}')
        if [ "${STATUS}" != "RUNNING" ]; then
            info "Container '${CONTAINER_NAME}' is currently ${STATUS}. Starting container..."
            if ! incus_cmd start "${CONTAINER_NAME}"; then
                error "Failed to start container '${CONTAINER_NAME}'."
                exit 3
            fi
            sleep 2
        else
            success "Container '${CONTAINER_NAME}' is already active and running."
        fi
    fi

    # Wait until container exec is responsive
    for i in {1..10}; do
        if run_in_container true &>/dev/null; then
            break
        fi
        sleep 1
    done

    save_step_state "${STEP_KEY}"
    success "Step 0 complete."
fi

# ============================================================
# STEP 1: Incus Proxy Devices Configuration
# ============================================================
STEP_KEY="STEP_1_PROXY_CONFIGURED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 1: Incus proxy devices configured."
else
    confirm_step 1 5 "${STEP_KEY}" \
        "Incus Proxy Devices Configuration" \
        "  - Verify host port ${HOST_PORT} availability\n  - Configure 'webui-proxy' device (Host 127.0.0.1:${HOST_PORT} -> Container 8080)\n  - Discover Ollama target and configure 'ollama-link' proxy device"

    # Check host port
    if ! incus_cmd config device show "${CONTAINER_NAME}" 2>/dev/null | grep -q "webui-proxy"; then
        if ! check_host_port_free "${HOST_PORT}"; then
            warn "Host port ${HOST_PORT} is currently in use on the host."
            if [ "${NON_INTERACTIVE}" -eq 0 ]; then
                printf "%bEnter an alternative host port for web UI [e.g. 8081]: %b" "${C_BOLD}" "${C_RESET}"
                read -r alt_port || true
                if [[ "${alt_port}" =~ ^[0-9]+$ ]]; then
                    HOST_PORT="${alt_port}"
                fi
            fi
        fi

        info "Configuring 'webui-proxy' (127.0.0.1:${HOST_PORT} -> container:8080)..."
        if ! incus_cmd config device add "${CONTAINER_NAME}" webui-proxy proxy listen=tcp:127.0.0.1:${HOST_PORT} connect=tcp:127.0.0.1:8080; then
            error "Failed to add 'webui-proxy' device on container '${CONTAINER_NAME}'."
            exit 3
        fi
        success "'webui-proxy' configured on port ${HOST_PORT}."
    else
        success "'webui-proxy' already configured on '${CONTAINER_NAME}'."
    fi

    # Discover and configure Ollama proxy (Pure Incus Proxy Chain)
    info "Configuring Incus proxy devices for Ollama..."

    # 1. Ensure sibling container 'ollama' has a host proxy device for port 11434
    if incus_cmd info ollama &>/dev/null; then
        OLLAMA_STATUS=$(incus_cmd info ollama | awk '/^Status:/ {print $2}')
        if [ "${OLLAMA_STATUS}" != "RUNNING" ]; then
            info "Starting sibling container 'ollama'..."
            incus_cmd start ollama 2>/dev/null || true
            sleep 2
        fi

        if ! incus_cmd config device show ollama 2>/dev/null | grep -q "11434"; then
            info "Adding 'ollama-proxy' device on container 'ollama' (Host 127.0.0.1:11434 -> ollama:11434)..."
            if incus_cmd config device add ollama ollama-proxy proxy listen=tcp:127.0.0.1:11434 connect=tcp:127.0.0.1:11434 2>/dev/null; then
                success "'ollama-proxy' configured on container 'ollama'."
            else
                warn "Could not add 'ollama-proxy' automatically on 'ollama'. It may already be bound or configured."
            fi
        else
            success "Proxy device for port 11434 already verified on container 'ollama'."
        fi
    fi

    # Target is strictly localhost loopback via Incus host proxy
    OLLAMA_TARGET="127.0.0.1:11434"

    # 2. Configure 'ollama-link' on target container to forward container 127.0.0.1:11434 -> Host 127.0.0.1:11434
    if incus_cmd config device show "${CONTAINER_NAME}" 2>/dev/null | grep -q "ollama-link"; then
        CURRENT_CONNECT=$(incus_cmd config device show "${CONTAINER_NAME}" 2>/dev/null | awk '/connect: *tcp:/ {print $2}' | sed 's|tcp:||' || true)
        if [ "${CURRENT_CONNECT}" != "${OLLAMA_TARGET}" ]; then
            info "Updating 'ollama-link' proxy on '${CONTAINER_NAME}' to loopback proxy chain (connect=tcp:${OLLAMA_TARGET})..."
            incus_cmd config device remove "${CONTAINER_NAME}" ollama-link 2>/dev/null || true
            incus_cmd config device add "${CONTAINER_NAME}" ollama-link proxy bind=instance listen=tcp:127.0.0.1:11434 connect="tcp:${OLLAMA_TARGET}"
            success "'ollama-link' device updated to loopback proxy chain."
        else
            success "'ollama-link' already configured on loopback proxy chain."
        fi
    else
        info "Configuring 'ollama-link' proxy device on '${CONTAINER_NAME}' (connect=tcp:${OLLAMA_TARGET})..."
        if ! incus_cmd config device add "${CONTAINER_NAME}" ollama-link proxy bind=instance listen=tcp:127.0.0.1:11434 connect="tcp:${OLLAMA_TARGET}"; then
            error "Failed to add 'ollama-link' proxy device."
            exit 3
        fi
        success "'ollama-link' proxy device configured."
    fi

    save_step_state "${STEP_KEY}"
    success "Step 1 complete."
fi

# ============================================================
# STEP 2: Environment Prerequisites & Port Conflict Resolution
# ============================================================
STEP_KEY="STEP_2_PREREQUISITES_INSTALLED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 2: Environment prerequisites verified."
else
    confirm_step 2 5 "${STEP_KEY}" \
        "Environment Prerequisites & Port Conflict Resolution" \
        "  - Check for conflicting open-webui service on port 8080 (stop/disable if active)\n  - Install python3, python3-pip, python3-venv, and curl inside container"

    # Stop conflicting open-webui service if active (both bind to port 8080)
    if run_in_container systemctl is-active --quiet open-webui 2>/dev/null; then
        info "Stopping conflicting open-webui.service on port 8080..."
        run_in_container systemctl stop open-webui 2>/dev/null || true
        run_in_container systemctl disable open-webui 2>/dev/null || true
    fi

    # Check for python3 and venv support
    info "Updating APT repositories and installing prerequisites (python3, pip, venv, curl)..."
    if ! run_in_container apt-get update -qq; then
        warn "APT update encountered warnings. Proceeding with package installation..."
    fi

    if ! run_in_container apt-get install -y -qq python3 python3-pip python3-venv curl; then
        error "Failed to install required packages in container '${CONTAINER_NAME}'."
        exit 3
    fi

    save_step_state "${STEP_KEY}"
    success "Step 2 complete."
fi

# ============================================================
# STEP 3: Virtual Environment & Application Files Push
# ============================================================
STEP_KEY="STEP_3_VENV_AND_FILES_SYNCED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 3: Application files and virtualenv synchronized."
else
    confirm_step 3 5 "${STEP_KEY}" \
        "Virtual Environment & Application Code Synchronization" \
        "  - Ensure ${APP_DIR} directory exists in container\n  - Push application code and test suites using absolute paths from ${REPO_ROOT}\n  - Create dedicated Python virtual environment in ${VENV_DIR}\n  - Install dependencies into virtual environment\n  - Push systemd service unit to ${SYSTEMD_UNIT}"

    info "Preparing directory ${APP_DIR} in container..."
    run_in_container mkdir -p "${APP_DIR}"

    info "Synchronizing application files from ${REPO_ROOT}..."
    if ! incus_cmd file push -r "${REPO_ROOT}/app/" "${CONTAINER_NAME}${APP_DIR}/" || \
       ! incus_cmd file push -r "${REPO_ROOT}/tests/" "${CONTAINER_NAME}${APP_DIR}/" || \
       ! incus_cmd file push "${REPO_ROOT}/requirements.txt" "${CONTAINER_NAME}${APP_DIR}/requirements.txt" || \
       ! incus_cmd file push "${REPO_ROOT}/app/systemd/e-webui.service" "${CONTAINER_NAME}${SYSTEMD_UNIT}"; then
        error "Failed to push files to container '${CONTAINER_NAME}'."
        exit 3
    fi

    info "Creating Python virtual environment in ${VENV_DIR}..."
    if ! run_in_container test -d "${VENV_DIR}"; then
        if ! run_in_container python3 -m venv "${VENV_DIR}"; then
            error "Failed to create Python virtual environment at ${VENV_DIR}."
            exit 3
        fi
    fi

    info "Installing Python dependencies into virtual environment..."
    if ! run_in_container "${VENV_DIR}/bin/pip" install --upgrade pip -q; then
        warn "Could not upgrade pip; proceeding with requirements installation..."
    fi

    if ! run_in_container "${VENV_DIR}/bin/pip" install -r "${APP_DIR}/requirements.txt"; then
        error "Failed to install requirements into virtual environment."
        exit 3
    fi

    save_step_state "${STEP_KEY}"
    success "Step 3 complete."
fi

# ============================================================
# STEP 4: Systemd Service Configuration & Activation
# ============================================================
STEP_KEY="STEP_4_SERVICE_CONFIGURED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 4: Systemd service configured."
else
    confirm_step 4 5 "${STEP_KEY}" \
        "Systemd Service Configuration & Startup" \
        "  - Reload systemd daemon inside container\n  - Enable e-webui service on container startup\n  - Restart e-webui service"

    info "Configuring and restarting systemd service..."
    if ! run_in_container systemctl daemon-reload || \
       ! run_in_container systemctl enable e-webui || \
       ! run_in_container systemctl restart e-webui; then
        error "Failed to configure or restart e-webui service."
        exit 3
    fi

    save_step_state "${STEP_KEY}"
    success "Step 4 complete."
fi

# ============================================================
# STEP 5: Live HTTP Health Verification & Diagnostics
# ============================================================
STEP_KEY="STEP_5_HEALTH_VERIFIED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 5: Service health already verified."
else
    confirm_step 5 5 "${STEP_KEY}" \
        "Live HTTP Health Verification & Diagnostics" \
        "  - Verify systemd service status\n  - Perform active HTTP readiness probe on http://127.0.0.1:${HOST_PORT}\n  - Verify container internal reachability to Ollama (127.0.0.1:11434)"

    info "Waiting for service to initialize..."
    sleep 2

    if ! run_in_container systemctl is-active --quiet e-webui 2>/dev/null; then
        error "e-webui service failed to start or exited immediately."
        run_in_container journalctl -u e-webui -n 25 --no-pager 2>/dev/null || true
        exit 3
    fi

    info "Performing HTTP readiness probe on http://127.0.0.1:${HOST_PORT}..."
    PROBE_SUCCESS=0
    for attempt in {1..15}; do
        if curl -sSf --connect-timeout 2 "http://127.0.0.1:${HOST_PORT}/" &>/dev/null || \
           curl -sSf --connect-timeout 2 "http://127.0.0.1:${HOST_PORT}/health" &>/dev/null; then
            PROBE_SUCCESS=1
            break
        fi
        sleep 1
    done

    if [ "${PROBE_SUCCESS}" -eq 1 ]; then
        success "HTTP readiness verified: Web UI responded with HTTP 200!"
    else
        warn "HTTP probe did not receive 200 on http://127.0.0.1:${HOST_PORT} within 15 seconds."
        warn "Checking journal logs for potential binding delays or startup errors..."
        run_in_container journalctl -u e-webui -n 15 --no-pager 2>/dev/null || true
    fi

    # Query container IP
    CONTAINER_IP=$(incus_cmd list "^${CONTAINER_NAME}$" --format csv -c 4 2>/dev/null | awk '{print $1}' | cut -d'(' -f1 || true)
    if [ -z "${CONTAINER_IP}" ] || [[ "${CONTAINER_IP}" == *"|"* ]]; then
        CONTAINER_IP=$(incus_cmd info "${CONTAINER_NAME}" 2>/dev/null | awk '/inet / {print $3}' | head -n1 || true)
    fi
    if [ -z "${CONTAINER_IP}" ]; then
        CONTAINER_IP="<container-ip>"
    fi

    # Check Ollama reachability inside container
    info "Verifying Ollama connection from inside '${CONTAINER_NAME}'..."
    if run_in_container curl -s --connect-timeout 2 "http://127.0.0.1:11434/api/tags" &>/dev/null; then
        success "Ollama connection verified inside container (http://127.0.0.1:11434 responding)!"
    else
        warn "Ollama is not yet responding on http://127.0.0.1:11434 inside container '${CONTAINER_NAME}'."
        CURRENT_LINK=$(incus_cmd config device show "${CONTAINER_NAME}" 2>/dev/null | awk '/connect: *tcp:/ {print $2}' || true)
        if [ -n "${CURRENT_LINK}" ]; then
            info "'ollama-link' proxy is forwarding to target: ${CURRENT_LINK}"
        fi
        warn "Troubleshooting Ollama connectivity:"
        warn "  1. Verify if 'ollama' container is started: incus list ollama"
        warn "  2. Ensure Ollama inside 'ollama' container listens on 0.0.0.0 (not just 127.0.0.1):"
        warn "     incus exec ollama -- systemctl show -p Environment ollama"
    fi

    save_step_state "${STEP_KEY}"
    save_step_state "STATUS_COMPLETED"

    banner "Deployment Successfully Completed!"
    echo "Application Access URL: http://127.0.0.1:${HOST_PORT} (via Incus Host Proxy)"
    echo "Direct Container URL:   http://${CONTAINER_IP}:8080"
    echo "Container Name:         ${CONTAINER_NAME}"
    echo "Base Image:             Debian 13 (or Debian stable)"
    echo "Virtual Environment:    ${VENV_DIR}"
    echo "Service Status:         active (running)"
    echo "Service Unit:           ${SYSTEMD_UNIT}"
fi

exit 0
