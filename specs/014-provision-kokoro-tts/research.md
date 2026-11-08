# Research: Kokoro-82M TTS Deployment Provisioning

**Branch**: `014-provision-kokoro-tts` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

This document records the research findings and architecture decisions for upgrading the `e-webui` deployment lifecycle manager (`scripts/deploy.sh` and `scripts/lib/*.sh`) to provision a complete, isolated Kokoro-82M TTS execution environment inside Debian 13 Incus containers.

---

## Decision 1: Provisioning Compatible Python (3.10–3.12) on Debian 13

### Problem Statement
The container environment runs Debian 13 (Trixie), where `/usr/bin/python3` is Python 3.13.5. The `kokoro` Python package depends on libraries that fail or lack wheels on Python 3.13 (supporting only Python 3.10 through 3.12). The host base system Python 3.13 must not be replaced or broken, as core Debian system packages and utilities (such as APT) rely on it.

### Decision
Deploy a prebuilt, standalone portable Python runtime (Python 3.11 from `python-build-standalone`, astral-sh/indygreg distribution) installed into `/opt/e-webui/interpreters/python-3.11/`, or detect an existing compatible Python (3.10–3.12) if already provisioned.

### Rationale
1. **Zero OS Disruption**: Unpacks entirely in user-space under `/opt/e-webui/interpreters/`, completely independent of `/usr/bin/python3` and `/usr/lib/python3.13`.
2. **Speed**: Downloading and unpacking a compressed standalone tarball (~25–30 MB) takes 2–5 seconds, compared to 5–10 minutes of heavy 100% CPU compilation from source.
3. **Reproducibility**: Static/glibc-linked standalone Python includes standard library modules (`venv`, `ssl`, `sqlite3`, `zlib`) without missing build header dependencies.
4. **Mirror and Offline Support**: Can be mirrored locally or fetched via proxy, and can be pre-cached into the release package or shared staging directory.
5. **Debian 13 Compatibility**: Debian 13 lacks official 3.11/3.12 APT packages; deadsnakes PPA is Ubuntu-only and breaks APT on Debian.

### Alternatives Considered
- **Compiling via `pyenv` / `python-build`**: Requires `build-essential`, `libssl-dev`, `zlib1g-dev`, etc. Takes 5+ minutes of intensive compilation, prone to missing header errors on lean containers.
- **Debian Bookworm (12) APT Pinning**: Mixing repositories causes libc6 / libssl dependency mismatches and package manager breakage.
- **Replacing `/usr/bin/python3`**: Catastrophically breaks Debian 13 system tools like APT and python3-apt.
- **Separate container**: Explicitly forbidden by project requirements.

---

## Decision 2: Dependency Specification and CPU-Only PyTorch

### Problem Statement
Standard `pip install torch` from PyPI downloads over 2 GB of packages because default wheels bundle CUDA 12 and cuDNN shared libraries. The container runs Kokoro strictly on CPU, and network bandwidth in Iran is constrained.

### Decision
1. Explicitly configure pip to install CPU-only PyTorch wheels from PyTorch's official wheel repository (`https://download.pytorch.org/whl/cpu`).
2. Pin and install speech processing dependencies:
   - `torch>=2.2.0,<=2.6.0` (CPU-only build, ~150 MB)
   - `kokoro>=0.8.4`
   - `soundfile>=0.12.1`
   - `numpy<2` (or matching Kokoro wheel constraint)
3. Ensure dependency installation respects environment proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`, `PIP_INDEX_URL`, `PIP_EXTRA_INDEX_URL`).

### Rationale
- CPU-only PyTorch is ~150 MB download (~500 MB installed) compared to 2.2 GB download (~4.5 GB installed) for CUDA wheels. This represents a 93% bandwidth saving, essential for slow connections.
- Matches the requirement: "Kokoro runs entirely on CPU inside the application's own process."

### Alternatives Considered
- **Default PyPI `torch`**: High failure rate on slow links, wastes several gigabytes of container disk.
- **`onnxruntime` instead of PyTorch**: While `kokoro-onnx` exists, the specification requires full Kokoro library compatibility and potential voice training/customization support.

---

## Decision 3: System-Level Audio Prerequisites

### Problem Statement
Kokoro performs text-to-phoneme conversion using `espeak-ng` and uses `libsndfile` for WAV audio serialization. If these shared C libraries are missing, importing or synthesizing audio crashes with `OSError`.

### Decision
Extend `install_system_prerequisites` in `scripts/lib/provision.sh` (and verify in `scripts/lib/tts.sh`) to ensure the following APT packages are installed:
- `espeak-ng`
- `espeak-ng-data`
- `libsndfile1`

### Rationale
- These are standard Debian 13 packages available in the default Debian repositories.
- Idempotent verification: check if packages are already installed before invoking `apt-get install`.

### Alternatives Considered
- Compiling `espeak-ng` from source: Unnecessary complexity and maintenance overhead when native Debian packages exist.

---

## Decision 4: Persistent Shared Model Storage & Resilient Download Architecture

### Problem Statement
The Kokoro-82M model weights (`kokoro-v0_19.pth`, ~327 MB) and voice definition files must not be re-downloaded every time a new application release is deployed, nor should rolling back delete them. Furthermore, in Iran, connections to Hugging Face (`huggingface.co`) or GitHub may be blocked or throttled.

### Decision
1. **Storage Location**: Store model files in `/opt/e-webui/shared/models/kokoro/` within the persistent `/opt/e-webui/shared/` directory tree (which is already shared across all releases and preserved across updates and rollbacks).
2. **Dedicated Helper**: Create `scripts/lib/tts.sh` containing:
   - `ensure_kokoro_model`: Checks if model weights and voices exist; if missing, downloads them.
   - `download_kokoro_file`: Downloads with `curl -fSL -C -` (resuming partial downloads), connection timeouts (`--connect-timeout 15 --max-time 600`), and proxy support.
   - Atomic download: Downloads to `.tmp` file and renames upon completion.
   - Checksum/size verification: Verifies file size and existence before marking complete.
3. **Resilient Failure Handling**:
   - If model download fails, log a prominent warning: `[WARN] Kokoro model download failed due to network unavailability.`
   - Print clear retry instructions: `Run './scripts/deploy.sh --download-model' once network is available.`
   - Return 0 (non-fatal) during `--install` and `--update` so that core chat deployment succeeds and passes health checks.
4. **Mirror & Proxy Support**:
   - Honor `HF_ENDPOINT` (e.g., `https://hf-mirror.com`).
   - Honor `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`.
   - Provide CLI option `--skip-model-download` to skip model downloading completely.

### Rationale
- Preserves the primary chat functionality regardless of model download status.
- Prevents re-downloading 330+ MB on every release update.

### Alternatives Considered
- Failing deployment on model download failure: Rejected per requirement 5 (chat app must stay operational).
- Downloading inside release folder: Rejected because it causes massive bloat and re-downloading on every release.

---

## Decision 5: Offline Runtime Enforcement in Systemd Service

### Problem Statement
At runtime, the Python process running under systemd must not attempt to connect to Hugging Face Hub or GitHub when initializing Kokoro, avoiding startup delays or runtime exceptions when offline.

### Decision
Inject the following environment variables into `/etc/systemd/system/e-webui.service` and `/opt/e-webui/deployment.env`:
- `HF_HUB_OFFLINE=1`
- `TRANSFORMERS_OFFLINE=1`
- `KOKORO_MODEL_DIR=/opt/e-webui/shared/models/kokoro`

### Rationale
- Hugging Face and PyTorch libraries natively recognize `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`, forcing them to load cached/local files without attempting network calls.
- `KOKORO_MODEL_DIR` gives the application a standard, unambiguous path to local weights.

---

## Decision 6: Virtual Environment Incompatibility Detection and Migration

### Problem Statement
Existing deployments running spec 008 use virtual environments located at `/opt/e-webui/venvs/<requirements_hash>`. If an existing deployment is running under Python 3.13, upgrading to a release with Kokoro requires rebuilding the virtual environment with the compatible Python 3.11 interpreter. If the hash only reflects `requirements.txt`, an existing incompatible venv could be mistakenly reused.

### Decision
1. **Composite Venv Identifier**: Key the virtual environment path by both Python interpreter version and requirements hash:
   `/opt/e-webui/venvs/py${PY_VERSION_SHORT}-${REQ_HASH}` (e.g., `/opt/e-webui/venvs/py3.11-a1b2c3d4...`).
2. **Incompatible Interpreter Inspection**:
   In `ensure_venv_in_container`: inspect the interpreter of the target venv. If `/bin/python3` in the venv reports Python `>= 3.13` or `< 3.10`, treat it as obsolete/invalid.
3. **Automated Migration on `--update`**:
   `deploy.sh --update` verifies whether the active deployment is using Python 3.13. If so, it logs an informative notice, provisions the compatible Python runtime, provisions the new virtual environment using the compatible runtime, and relinks `current/venv`.

### Rationale
- Guarantees seamless, zero-downtime automated migration without operator intervention.
- Preserves past virtual environments for rollback safety.

---

## Decision 7: CLI Interface & Diagnostics Extensions

### Problem Statement
The operator needs visibility into TTS readiness and explicit control over model downloading.

### Decision
Extend CLI options in `scripts/deploy.sh` and diagnostics in `scripts/lib/diagnostics.sh`:
- `--skip-model-download`: Bypasses model weight acquisition during install/update.
- `--download-model`: Standalone operation that downloads or verifies model weights into persistent storage without modifying application code or restarting service.
- `--status`: Adds TTS diagnostics:
  - Python runtime: `/usr/bin/python3` (3.13.5) vs Application venv Python (`3.11.x`).
  - TTS dependencies import verification (`kokoro`, `soundfile`, `torch`).
  - Model weights presence (`kokoro-v0_19.pth`, voices).
- `--repair`: Automatically repairs missing system packages (`espeak-ng`, `libsndfile1`), verifies/repairs the compatible Python venv, and downloads missing model weights.

### Rationale
- Completely fulfills requirements 6, 7, and 10.
