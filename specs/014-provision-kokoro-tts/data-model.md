# Data Model: Kokoro-82M TTS Deployment Provisioning

**Branch**: `014-provision-kokoro-tts` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

This document formalizes the runtime entities, directory hierarchy, state schemas, and lifecycle state transitions for provisioning the Kokoro-82M TTS execution environment.

---

## Entity Definitions

### 1. Deployment Environment
Represents the target container runtime environment and its persistent system boundaries.

| Field | Type | Description | Constraints |
| :--- | :--- | :--- | :--- |
| `container_name` | string | Incus instance identifier | Default: `e-webui-app` |
| `app_dir` | string | Application base directory on container filesystem | Default: `/opt/e-webui` |
| `system_python` | string | Base OS default Python path | `/usr/bin/python3` (Debian 13: 3.13.5, read-only to app) |
| `system_packages` | array[string] | Required APT packages for core app and audio phonemization | `["python3", "python3-pip", "python3-venv", "curl", "espeak-ng", "espeak-ng-data", "libsndfile1"]` |
| `proxy_devices` | map | Incus proxy devices for web UI and Ollama | `webui-proxy`, `ollama-link` |

---

### 2. Compatible Python Runtime
Represents the isolated, secondary Python interpreter provisioned specifically for applications requiring Python 3.10–3.12 without displacing the OS Python.

| Field | Type | Description | Constraints |
| :--- | :--- | :--- | :--- |
| `install_path` | string | Directory where standalone interpreter is unpacked | `/opt/e-webui/interpreters/python-3.11` |
| `binary_path` | string | Executable path of compatible Python | `/opt/e-webui/interpreters/python-3.11/bin/python3` |
| `version` | string | Detected runtime version | Must satisfy `>= 3.10.0` and `<= 3.12.99` |
| `source_url` | string | Download URL or mirror URL for standalone build | Configurable via `PYTHON_STANDALONE_URL` or mirror |
| `checksum` | string | SHA-256 hash of standalone distribution archive | Verified before unpacking |

---

### 3. Application Virtual Environment
Represents an isolated Python environment keyed to a specific interpreter version and requirements hash.

| Field | Type | Description | Constraints |
| :--- | :--- | :--- | :--- |
| `venv_dir` | string | Directory path for virtual environment | `/opt/e-webui/venvs/py{major}.{minor}-{req_hash}` |
| `python_version_tag` | string | Short version prefix | e.g., `py3.11` |
| `requirements_hash` | string | SHA-256 hash of `requirements.txt` | 64-character hex string |
| `interpreter_binary` | string | Interpreter inside venv | `${venv_dir}/bin/python3` |
| `key_packages` | map | Core installed packages and versions | `fastapi`, `uvicorn`, `torch` (CPU), `kokoro`, `soundfile` |
| `status` | enum | Health status | `VALID`, `INCOMPATIBLE_INTERPRETER`, `CORRUPTED`, `MISSING` |

#### State Transitions for Virtual Environment Discovery:
```text
[Check /opt/e-webui/venvs/py3.11-<hash>]
   │
   ├─► Exists & python -V == 3.11.x & uvicorn & kokoro importable?
   │      └─► CACHE HIT (reuse immediately)
   │
   └─► Does not exist OR python -V == 3.13.x OR missing packages:
          ├─► If older venv exists with py3.13: MARK INCOMPATIBLE
          ├─► Ensure compatible python-3.11 runtime exists
          ├─► Create venv: python3.11 -m venv /opt/e-webui/venvs/py3.11-<hash>
          ├─► Pip install CPU PyTorch & requirements.txt
          └─► CACHE WRITE (record in state)
```

---

### 4. Persistent Model Store
Represents the persistent directory storing Kokoro-82M model weights, configuration, and voice profiles across releases.

| Field | Type | Description | Constraints |
| :--- | :--- | :--- | :--- |
| `store_path` | string | Root directory of persistent model storage | `/opt/e-webui/shared/models/kokoro` |
| `model_file` | string | Path to model weights file | `/opt/e-webui/shared/models/kokoro/kokoro-v0_19.pth` |
| `model_size_bytes` | integer | Expected size range of model weights | ~327,000,000 bytes (tolerance ±5%) |
| `voices_dir` | string | Directory containing voice tensor profiles | `/opt/e-webui/shared/models/kokoro/voices` |
| `voices_count` | integer | Number of voice definition files | Default set: 10+ core voices |
| `status` | enum | Model availability status | `PRESENT`, `MISSING`, `DOWNLOADING`, `CORRUPTED` |

#### State Transitions for Model Acquisition:
```text
[deploy.sh --install / --update]
   │
   ├─► Flag --skip-model-download passed?
   │      └─► SKIP (log info, continue deploy)
   │
   ├─► Check /opt/e-webui/shared/models/kokoro/kokoro-v0_19.pth exists and valid size?
   │      └─► REUSE (log hit, no download)
   │
   └─► Missing or corrupted:
          ├─► Attempt download with proxy/mirror & resume support to .tmp
          ├─► Check download exit code:
          │      ├─► SUCCESS: Rename .tmp to final path -> PRESENT
          │      └─► FAILED / TIMEOUT:
          │             ├─► Clean up partial temp file
          │             ├─► Log visible WARNING with retry instructions
          │             └─► Return 0 (non-blocking) -> MISSING
```

---

### 5. Deployment State Extension Schema
Extends `/opt/e-webui/.deploy_state` managed by `scripts/lib/state.sh`.

```json
{
  "active_release": "20261107-194500",
  "previous_healthy_release": "20261106-180000",
  "active_venv_hash": "py3.11-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "app_version": "0.14.0",
  "git_commit": "abcdef123456",
  "deployed_at": "2026-11-07T19:45:00Z",
  "host_port": 8080,
  "ollama_target": "127.0.0.1:11434",
  "tts_environment": {
    "python_runtime": "/opt/e-webui/interpreters/python-3.11/bin/python3",
    "python_version": "3.11.9",
    "dependencies_ready": true,
    "model_present": true,
    "model_dir": "/opt/e-webui/shared/models/kokoro"
  }
}
```

---

## Directory Hierarchy Specification

```text
/opt/e-webui/
├── .deploy_state                    # Deployment tracking state file
├── .deploy.lock                     # Execution concurrency lock
├── deployment.env                   # Exported systemd environment variables
├── current -> releases/20261107-19  # Atomic symlink to active release
├── interpreters/                    # Compatible Python standalone runtimes
│   └── python-3.11/
│       ├── bin/python3              # Python 3.11 interpreter
│       └── lib/python3.11/
├── venvs/                           # Cached virtual environments
│   ├── py3.11-a1b2c3d4e5f6.../      # Current release venv (Python 3.11)
│   │   ├── bin/uvicorn
│   │   ├── bin/python3
│   │   └── lib/python3.11/site-packages/ (kokoro, torch, soundfile)
│   └── 9876543210.../               # Legacy/previous venvs (preserved for rollback)
├── releases/                        # Application releases
│   ├── 20261107-194500/
│   │   ├── app/                     # Application source
│   │   ├── manifest.json
│   │   ├── requirements.txt
│   │   ├── venv -> ../../venvs/py3.11-a1b2...  # Symlink to active venv
│   │   └── data -> ../../shared/data          # Symlink to shared data
├── shared/                          # Persistent storage across all releases
│   ├── data/                        # Application database/storage
│   └── models/                      # Persistent machine learning models
│       └── kokoro/                  # Kokoro-82M persistent storage
│           ├── kokoro-v0_19.pth     # Model weights (~327 MB)
│           ├── config.json          # Architecture config
│           └── voices/              # Voice definition profiles (*.pt)
│               ├── af_heart.pt
│               ├── af_bella.pt
│               └── ...
└── staging/                         # Temporary unpack area for transfers
```
