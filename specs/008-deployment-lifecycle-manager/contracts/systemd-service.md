# Contract: `e-webui.service` Unit Specification

**Location**: `/etc/systemd/system/e-webui.service` inside the target Incus container.

---

## 1. Unit Template

```ini
[Unit]
Description=e-webui Application Service
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/e-webui/current
ExecStart=/opt/e-webui/current/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=3

# Persistent and Deployment Environment Configuration
EnvironmentFile=-/opt/e-webui/deployment.env
EnvironmentFile=-/opt/e-webui/shared/.env

# Default Fallback Environment
Environment="PYTHONPATH=/opt/e-webui/current"
Environment="APP_HOST=0.0.0.0"
Environment="APP_PORT=8080"
Environment="OLLAMA_HOST=http://127.0.0.1:11434"

# Security Hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

---

## 2. Stability Invariant

- `WorkingDirectory` ALWAYS references `/opt/e-webui/current`.
- `ExecStart` ALWAYS references `/opt/e-webui/current/venv/bin/uvicorn`.
- The systemd unit file is completely static across application updates. It is only modified if environment files, security settings, or service parameters are intentionally updated by `--repair` or initial installation.
- Reloading the systemd daemon (`systemctl daemon-reload`) is NOT required during routine application updates.
