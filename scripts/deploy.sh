#!/usr/bin/env bash
# Deploy e-webui into Incus Container (Interactive & Resumable)
# Conforms to spec: specs/003-interactive-container-deploy/spec.md
set -euo pipefail

INCUS_BIN="${INCUS_BIN:-incus}"
APP_DIR="/opt/e-webui"
STATE_FILE="${APP_DIR}/.deploy_state"
SYSTEMD_UNIT="/etc/systemd/system/e-webui.service"
NON_INTERACTIVE=0
FORCE_RESET=0
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

Deploy e-webui to an Incus container with interactive step confirmation
and automatic state resumption.

Arguments:
  CONTAINER_NAME       Target Incus container name (prompts interactively if omitted)

Options:
  -y, --yes, --non-interactive
                       Automatically confirm all step prompts
  -r, --reset, --force
                       Reset saved deployment state and re-run all steps from beginning
  -h, --help           Show this help message and exit

Exit Codes:
  0    Deployment completed successfully and service is verified healthy
  1    Deployment aborted by user (step rejected)
  2    Pre-check failed (invalid argument, container not found)
  3    Execution failure during step action
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

# --- Container Abstraction Helpers ---
incus_cmd() {
    "${INCUS_BIN}" "$@"
}

run_in_container() {
    incus_cmd exec "${CONTAINER_NAME}" -- "$@"
}

# --- Interactive Container Name Prompt ---
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
    exit 2
fi

banner "Deploying e-webui to Incus Container: ${CONTAINER_NAME}"

# Verify container exists
if ! incus_cmd info "${CONTAINER_NAME}" &>/dev/null; then
    error "Container '${CONTAINER_NAME}' not found in Incus."
    exit 2
fi

# --- State Management (Resumability) ---
is_step_completed() {
    local step_key="$1"
    if [ "${FORCE_RESET}" -eq 1 ]; then
        return 1
    fi
    # Check state file inside container
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
        run_in_container rm -f "${STATE_FILE}" 2>/dev/null || true
    fi
}

reset_state_if_requested

# --- Confirmation & Abort Handler ---
# Returns 0 to proceed with step.
# Halts with exit code 1 if user insists on aborting.
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
echo "  1. Container Runtime Verification & Startup"
echo "  2. Environment Prerequisites & Port Conflict Resolution"
echo "  3. Application Code Synchronization & Python Dependencies"
echo "  4. Systemd Service Configuration & Startup Registration"
echo "  5. Health Verification & Endpoint Reporting"
echo ""

# Check if all steps already completed
if is_step_completed "STEP_1_CONTAINER_VERIFIED" && \
   is_step_completed "STEP_2_PREREQUISITES_INSTALLED" && \
   is_step_completed "STEP_3_FILES_SYNCED" && \
   is_step_completed "STEP_4_SERVICE_CONFIGURED" && \
   is_step_completed "STEP_5_HEALTH_VERIFIED"; then
    success "All deployment steps have already been successfully completed for '${CONTAINER_NAME}'."
    if [ "${NON_INTERACTIVE}" -eq 0 ]; then
        printf "%bWould you like to re-verify the active service status now? [Y/n]: %b" "${C_BOLD}" "${C_RESET}"
        read -r reverify_resp || true
        case "${reverify_resp}" in
            [nN]|[nN][oO])
                info "Exiting. Use --reset to perform a full re-deployment."
                exit 0
                ;;
        esac
    else
        exit 0
    fi
fi

# ============================================================
# STEP 1: Container Runtime Verification & Proxy Devices
# ============================================================
STEP_KEY="STEP_1_CONTAINER_VERIFIED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 1: Container runtime and proxy devices verified."
else
    confirm_step 1 5 "${STEP_KEY}" \
        "Container Runtime & Incus Proxy Devices" \
        "  - Check container status in Incus\n  - Start the container if it is currently stopped\n  - Ensure Incus proxy devices ('webui-proxy' on 8080 and 'ollama-link' on 11434) are configured"

    info "Inspecting container status for '${CONTAINER_NAME}'..."
    STATUS=$(incus_cmd info "${CONTAINER_NAME}" | awk '/^Status:/ {print $2}')
    if [ "${STATUS}" != "RUNNING" ]; then
        info "Container '${CONTAINER_NAME}' is currently ${STATUS}. Starting container..."
        incus_cmd start "${CONTAINER_NAME}"
        sleep 2
    else
        success "Container '${CONTAINER_NAME}' is active and running."
    fi

    # 1. Configure webui-proxy (Host 127.0.0.1:8080 -> Container 8080)
    info "Verifying 'webui-proxy' device on '${CONTAINER_NAME}'..."
    if ! incus_cmd config device show "${CONTAINER_NAME}" 2>/dev/null | grep -q "webui-proxy"; then
        info "Adding 'webui-proxy' proxy device (127.0.0.1:8080 -> container:8080)..."
        incus_cmd config device add "${CONTAINER_NAME}" webui-proxy proxy listen=tcp:127.0.0.1:8080 connect=tcp:127.0.0.1:8080 || true
        success "'webui-proxy' device added."
    else
        success "'webui-proxy' device already configured."
    fi

    # 2. Configure ollama-link (Container 127.0.0.1:11434 -> Ollama)
    info "Verifying 'ollama-link' device on '${CONTAINER_NAME}'..."
    if ! incus_cmd config device show "${CONTAINER_NAME}" 2>/dev/null | grep -q "ollama-link"; then
        OLLAMA_TARGET="127.0.0.1:11434"
        if incus_cmd info ollama &>/dev/null; then
            OLLAMA_IP=$(incus_cmd list "^ollama$" --format csv -c 4 2>/dev/null | awk '{print $1}' | cut -d'(' -f1 || true)
            if [ -n "${OLLAMA_IP}" ]; then
                if curl -s --connect-timeout 1 "http://${OLLAMA_IP}:11434/api/tags" &>/dev/null; then
                    OLLAMA_TARGET="${OLLAMA_IP}:11434"
                elif curl -s --connect-timeout 1 "http://127.0.0.1:11434/api/tags" &>/dev/null; then
                    OLLAMA_TARGET="127.0.0.1:11434"
                else
                    OLLAMA_TARGET="${OLLAMA_IP}:11434"
                fi
            fi
        fi
        info "Adding 'ollama-link' proxy device (connecting to ${OLLAMA_TARGET})..."
        incus_cmd config device add "${CONTAINER_NAME}" ollama-link proxy bind=instance listen=tcp:127.0.0.1:11434 connect="tcp:${OLLAMA_TARGET}" || true
        success "'ollama-link' device added."
    else
        success "'ollama-link' device already configured."
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
        "  - Check for conflicting open-webui service on port 8080 (stop/disable if active)\n  - Verify python3 and pip are available inside container"

    # Stop conflicting open-webui service if active (both bind to port 8080)
    if run_in_container systemctl is-active --quiet open-webui 2>/dev/null; then
        info "Stopping conflicting open-webui.service on port 8080..."
        run_in_container systemctl stop open-webui || true
        run_in_container systemctl disable open-webui || true
    fi

    # Check for python3
    if ! run_in_container which python3 &>/dev/null; then
        info "Installing python3 and required packages inside container..."
        run_in_container apt-get update -qq || true
        run_in_container apt-get install -y -qq python3 python3-pip python3-venv || true
    fi

    save_step_state "${STEP_KEY}"
    success "Step 2 complete."
fi

# ============================================================
# STEP 3: Application Code & Service File Push
# ============================================================
STEP_KEY="STEP_3_FILES_SYNCED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 3: Application files and dependencies synchronized."
else
    confirm_step 3 5 "${STEP_KEY}" \
        "Application Files Synchronization & Dependencies" \
        "  - Ensure ${APP_DIR} directory exists in container\n  - Push app/ and tests/ directories from host to container\n  - Push requirements.txt and install Python dependencies\n  - Push e-webui.service to ${SYSTEMD_UNIT}"

    info "Preparing ${APP_DIR} in container..."
    run_in_container mkdir -p "${APP_DIR}"

    info "Pushing application files to container..."
    incus_cmd file push -r app/ "${CONTAINER_NAME}${APP_DIR}/"
    incus_cmd file push -r tests/ "${CONTAINER_NAME}${APP_DIR}/"
    incus_cmd file push requirements.txt "${CONTAINER_NAME}${APP_DIR}/requirements.txt"
    incus_cmd file push app/systemd/e-webui.service "${CONTAINER_NAME}${SYSTEMD_UNIT}"

    # Install requirements via pip inside container if pip is present
    if run_in_container which pip &>/dev/null || run_in_container which pip3 &>/dev/null; then
        info "Installing Python dependencies from requirements.txt..."
        run_in_container pip3 install -r "${APP_DIR}/requirements.txt" --break-system-packages 2>/dev/null || \
        run_in_container pip install -r "${APP_DIR}/requirements.txt" 2>/dev/null || true
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
        "  - Reload systemd daemon\n  - Enable e-webui service to start automatically on container boot\n  - Restart e-webui service"

    info "Configuring systemd service inside container..."
    run_in_container systemctl daemon-reload
    run_in_container systemctl enable e-webui
    run_in_container systemctl restart e-webui

    save_step_state "${STEP_KEY}"
    success "Step 4 complete."
fi

# ============================================================
# STEP 5: Health Verification & Endpoint Reporting
# ============================================================
STEP_KEY="STEP_5_HEALTH_VERIFIED"
if is_step_completed "${STEP_KEY}"; then
    info "[SKIPPED: Already Completed] Step 5: Service health already verified."
else
    confirm_step 5 5 "${STEP_KEY}" \
        "Health Verification & Status Reporting" \
        "  - Verify e-webui systemd service is active and running\n  - Retrieve container IP address\n  - Output application access endpoint"

    info "Waiting for service to initialize..."
    sleep 2

    if run_in_container systemctl is-active --quiet e-webui 2>/dev/null; then
        success "e-webui service is active and running!"
        run_in_container systemctl status e-webui --no-pager 2>/dev/null || true
    else
        error "e-webui service failed to start."
        run_in_container journalctl -u e-webui -n 20 --no-pager 2>/dev/null || true
        exit 3
    fi

    # Query container IP
    CONTAINER_IP=$(incus_cmd list "${CONTAINER_NAME}" --format csv -c 4 2>/dev/null | awk '{print $1}' | cut -d'(' -f1 || true)
    if [ -z "${CONTAINER_IP}" ] || [[ "${CONTAINER_IP}" == *"|"* ]]; then
        CONTAINER_IP=$(incus_cmd info "${CONTAINER_NAME}" 2>/dev/null | awk '/inet / {print $3}' | head -n1 || true)
    fi
    if [ -z "${CONTAINER_IP}" ]; then
        CONTAINER_IP="<container-ip>"
    fi

    # Check Ollama reachability inside container
    if run_in_container which curl &>/dev/null && run_in_container curl -s --connect-timeout 2 "http://127.0.0.1:11434/api/tags" &>/dev/null; then
        success "Ollama connection verified inside container (http://127.0.0.1:11434 is responding)!"
    else
        warn "Ollama is not yet responding on http://127.0.0.1:11434 inside the container."
        warn "Ensure the 'ollama' container is started ('incus start ollama')."
    fi

    save_step_state "${STEP_KEY}"
    save_step_state "STATUS_COMPLETED"

    banner "Deployment Successfully Completed!"
    echo "Application Access URL: http://127.0.0.1:8080 (via Incus Host Proxy)"
    echo "Direct Container URL:   http://${CONTAINER_IP}:8080"
    echo "Container Name:         ${CONTAINER_NAME}"
    echo "Service Status:         active (running)"
    echo "Service Unit:           ${SYSTEMD_UNIT}"
fi

exit 0
