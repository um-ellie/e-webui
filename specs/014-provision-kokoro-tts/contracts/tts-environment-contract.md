# Runtime Environment Contract: Kokoro-82M TTS Provisioning

**Feature**: `014-provision-kokoro-tts` | **Date**: 2026-11-07 | **Spec**: [spec.md](../spec.md)

This contract defines the internal filesystem locations, packages, model layout, and offline verification contracts inside the container.

---

## 1. Operating System Prerequisites

The container must have the following Debian 13 APT packages installed:

```bash
apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    ca-certificates \
    espeak-ng \
    espeak-ng-data \
    libsndfile1
```

### Verification Command:
```bash
dpkg -s espeak-ng espeak-ng-data libsndfile1 >/dev/null 2>&1 && which espeak-ng >/dev/null
```

---

## 2. Compatible Python Runtime Contract

- **Directory**: `/opt/e-webui/interpreters/python-3.11/`
- **Binary**: `/opt/e-webui/interpreters/python-3.11/bin/python3`
- **Version Constraint**: Must report `3.11.x` (or `3.10.x` / `3.12.x`) upon `python3 -V`.
- **System Isolation**: `/usr/bin/python3` must remain strictly untouched and report Python 3.13.x.

### Verification Command:
```bash
/opt/e-webui/interpreters/python-3.11/bin/python3 -c "import sys; assert (3, 10) <= sys.version_info[:2] <= (3, 12), 'Incompatible Python'"
```

---

## 3. Application Virtual Environment Contract

- **Venv Base Directory**: `/opt/e-webui/venvs/py3.11-${REQ_HASH}/`
- **Release Symlink**: `/opt/e-webui/releases/${RELEASE_ID}/venv -> ../../venvs/py3.11-${REQ_HASH}`
- **Active Symlink**: `/opt/e-webui/current/venv -> /opt/e-webui/releases/${RELEASE_ID}/venv`

### Required Installed Packages:
- `fastapi`
- `uvicorn`
- `torch` (CPU wheel from `https://download.pytorch.org/whl/cpu`)
- `kokoro>=0.8.4`
- `soundfile>=0.12.1`

### Verification Command:
```bash
/opt/e-webui/current/venv/bin/python3 -c "import kokoro, soundfile, torch; assert not torch.cuda.is_available(); print('TTS dependencies verified on CPU')"
```

---

## 4. Persistent Model Storage Layout

Root Directory: `/opt/e-webui/shared/models/kokoro/`

```text
/opt/e-webui/shared/models/kokoro/
├── kokoro-v0_19.pth     # Model weights file (~327 MB)
├── config.json          # Model hyperparameters / architecture configuration
└── voices/              # Voice embedding tensors
    ├── af_heart.pt
    ├── af_bella.pt
    ├── af_nicole.pt
    ├── af_sarah.pt
    ├── am_adam.pt
    ├── am_michael.pt
    ├── bf_emma.pt
    ├── bf_isabella.pt
    ├── bm_george.pt
    └── bm_lewis.pt
```

### Verification Command:
```bash
test -f /opt/e-webui/shared/models/kokoro/kokoro-v0_19.pth && \
[ $(wc -c < /opt/e-webui/shared/models/kokoro/kokoro-v0_19.pth) -gt 300000000 ] && \
test -d /opt/e-webui/shared/models/kokoro/voices
```

---

## 5. Offline Inference Verification

When model files are present, the following script executed inside the virtual environment must synthesize 1 second of audio completely offline without any internet connection:

```python
import os
import soundfile as sf
from kokoro import KModel, KPipeline

# Ensure offline environment
assert os.environ.get("HF_HUB_OFFLINE") == "1"
assert os.environ.get("TRANSFORMERS_OFFLINE") == "1"

model_dir = os.environ.get("KOKORO_MODEL_DIR", "/opt/e-webui/shared/models/kokoro")
model_path = os.path.join(model_dir, "kokoro-v0_19.pth")

pipeline = KPipeline(lang_code="a", model_path=model_path)
generator = pipeline("Hello, speech synthesis is ready.", voice="af_heart", speed=1)
for _, _, audio in generator:
    sf.write("/tmp/test_speech.wav", audio, 24000)
    break
print("Offline synthesis test PASSED.")
```
