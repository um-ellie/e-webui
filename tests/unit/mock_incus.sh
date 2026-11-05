#!/usr/bin/env bash
# Mock incus executable for offline testing of scripts/deploy.sh
# Controlled via environment variables:
#   MOCK_INCUS_STATE_DIR: directory representing container filesystem
#   MOCK_CONTAINER_STATUS: RUNNING | STOPPED | NOT_FOUND (default: RUNNING)
#   MOCK_SERVICE_STATUS: active | inactive (default: active)
#   MOCK_FAIL_COMMAND: regex or substring of command to fail

set -eo pipefail

STATE_DIR="${MOCK_INCUS_STATE_DIR:-/tmp/mock_incus_$$}"
CONTAINER_STATUS="${MOCK_CONTAINER_STATUS:-RUNNING}"
SERVICE_STATUS="${MOCK_SERVICE_STATUS:-active}"

mkdir -p "${STATE_DIR}/opt/e-webui"
mkdir -p "${STATE_DIR}/etc/systemd/system"

subcommand="${1:-}"
shift || true

case "${subcommand}" in
    info)
        container="${1:-}"
        if [ "${CONTAINER_STATUS}" = "NOT_FOUND" ] || [ "${container}" = "nonexistent" ]; then
            echo "Error: Not found" >&2
            exit 1
        fi
        echo "Name: ${container}"
        echo "Status: ${CONTAINER_STATUS}"
        echo "Type: container"
        echo "Architecture: x86_64"
        echo "Ips:"
        echo "  eth0: inet 10.0.100.50"
        exit 0
        ;;
    start)
        container="${1:-}"
        CONTAINER_STATUS="RUNNING"
        echo "Container ${container} started."
        exit 0
        ;;
    config)
        action="${1:-}"
        shift || true
        sub_action="${1:-}"
        shift || true
        container="${1:-}"
        shift || true
        device_file="${STATE_DIR}/devices_${container}.conf"
        case "${sub_action}" in
            show)
                if [ -f "${device_file}" ]; then
                    cat "${device_file}"
                fi
                exit 0
                ;;
            add)
                dev_name="${1:-}"
                echo "${dev_name}:" >> "${device_file}"
                echo "  type: proxy" >> "${device_file}"
                exit 0
                ;;
            *)
                exit 0
                ;;
        esac
        exit 0
        ;;
    list)
        all_args="$*"
        if echo "${all_args}" | grep -q "csv"; then
            echo "10.0.100.50 (eth0)"
        else
            echo "+-------+---------+----------------------+"
            echo "| NAME  |  STATE  |         IPV4         |"
            echo "+-------+---------+----------------------+"
            echo "| webui | RUNNING | 10.0.100.50 (eth0)   |"
            echo "+-------+---------+----------------------+"
        fi
        exit 0
        ;;
    file)
        action="${1:-}"
        shift || true
        if [ "${action}" = "push" ]; then
            # Format: incus file push [-r] src dest
            is_recursive=0
            if [ "${1:-}" = "-r" ]; then
                is_recursive=1
                shift
            fi
            src="${1:-}"
            dest="${2:-}"
            target_rel=$(echo "${dest}" | sed -E 's|^[^/]+(/.*)$|\1|')
            target_full="${STATE_DIR}${target_rel}"
            mkdir -p "$(dirname "${target_full}")"
            if [ -d "${src}" ]; then
                cp -r "${src}" "${target_full}"
            else
                cp "${src}" "${target_full}"
            fi
            exit 0
        fi
        exit 0
        ;;
    exec)
        container="${1:-}"
        shift || true
        # Skip -- if present
        if [ "${1:-}" = "--" ]; then
            shift
        fi
        cmd="$*"

        if [ -n "${MOCK_FAIL_COMMAND:-}" ] && echo "${cmd}" | grep -q "${MOCK_FAIL_COMMAND}"; then
            echo "Mock execution failure for: ${cmd}" >&2
            exit 1
        fi

        case "${1:-}" in
            mkdir)
                shift
                dir="${1:-}"
                if [ "${dir}" = "-p" ]; then
                    shift
                    dir="${1:-}"
                fi
                mkdir -p "${STATE_DIR}${dir}"
                exit 0
                ;;
            test)
                shift
                flag="${1:-}"
                target="${2:-}"
                if [ "${flag}" = "-f" ]; then
                    [ -f "${STATE_DIR}${target}" ] && exit 0 || exit 1
                elif [ "${flag}" = "-d" ]; then
                    [ -d "${STATE_DIR}${target}" ] && exit 0 || exit 1
                fi
                exit 0
                ;;
            cat)
                shift
                target="${1:-}"
                if [ -f "${STATE_DIR}${target}" ]; then
                    cat "${STATE_DIR}${target}"
                    exit 0
                fi
                exit 1
                ;;
            tee)
                shift
                is_append=0
                if [ "${1:-}" = "-a" ]; then
                    is_append=1
                    shift
                fi
                target="${1:-}"
                mkdir -p "$(dirname "${STATE_DIR}${target}")"
                if [ "${is_append}" -eq 1 ]; then
                    cat >> "${STATE_DIR}${target}"
                else
                    cat > "${STATE_DIR}${target}"
                fi
                exit 0
                ;;
            systemctl)
                shift
                action="${1:-}"
                case "${action}" in
                    is-active)
                        svc="${3:-${2:-}}"
                        if [ "${svc}" = "open-webui" ]; then
                            exit 1
                        fi
                        if [ "${svc}" = "e-webui" ]; then
                            if [ "${SERVICE_STATUS}" = "active" ]; then
                                exit 0
                            else
                                exit 1
                            fi
                        fi
                        exit 0
                        ;;
                    status)
                        echo "● e-webui.service - e-webui service"
                        echo "   Active: active (running)"
                        exit 0
                        ;;
                    daemon-reload|enable|disable|stop|restart|start)
                        exit 0
                        ;;
                esac
                exit 0
                ;;
            apt-get|python3|pip|pip3|which)
                exit 0
                ;;
            rm)
                shift
                if [ "${1:-}" = "-f" ]; then
                    shift
                fi
                rm -f "${STATE_DIR}${1:-}"
                exit 0
                ;;
            bash)
                shift
                if [ "${1:-}" = "-c" ]; then
                    shift
                    eval "$*"
                fi
                exit 0
                ;;
            *)
                exit 0
                ;;
        esac
        exit 0
        ;;
    *)
        echo "Unknown mock command: ${subcommand} $*"
        exit 0
        ;;
esac
