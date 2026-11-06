# Contract: Release Builder CLI

**Component**: `scripts/build-release.sh`  
**Purpose**: Standardized CLI tool to package, audit, and publish `e-webui` release artifacts.  

---

## 1. Command Syntax

```bash
./scripts/build-release.sh [OPTIONS]
```

### Options

| Option | Flag | Description | Default |
|--------|------|-------------|---------|
| `--output-dir` | `-o <DIR>` | Directory to write final published release artifacts | `${REPO_ROOT}/dist/releases` |
| `--version` | `-v <VERSION>` | Override application semantic version | Read from `app/main.py` |
| `--strict` | | Fail if Git working tree is dirty or untracked files exist | Disabled (allows dirty with flag) |
| `--archive-only` | | Only emit the `.tar.gz` bundle, not uncompressed directory | False (emits both) |
| `--dir-only` | | Only emit uncompressed release directory, not `.tar.gz` | False (emits both) |
| `--help` | `-h` | Display help message and exit | |

---

## 2. Exit Codes

| Code | Meaning | Condition |
|------|---------|-----------|
| `0` | Success | Release package built, verified, and published cleanly. |
| `1` | User Abort / Interrupted | Process was cancelled or killed by signal. |
| `2` | Configuration / Pre-check Error | Missing mandatory source file (`app/` or `requirements.txt`), invalid SemVer, or dirty git tree with `--strict`. |
| `3` | Packaging Failure | Tar creation failure, permissions failure, or staging error. |
| `4` | Self-Verification Failure | Checksum mismatch or schema validation failure on generated artifacts. |

---

## 3. Standard Output & Logging

The builder produces structured, ANSI-colored output matching project conventions:

```text
============================================================
   e-webui Release Packaging Builder
============================================================
[INFO] Resolving release version: 1.0.0
[INFO] Git commit: a1b2c3d4 (dirty: false)
[INFO] Generated release ID: 20261106-213000-a1b2c3d4
[INFO] Creating build staging at /tmp/e-webui-build.xyz123...
[INFO] Packaging application code into payload/app.tar.gz...
[INFO] Staging requirements.txt and e-webui.service...
[INFO] Generating manifest.json and calculating SHA-256 digests...
[INFO] Running pre-publication self-verification...
[SUCCESS] Manifest schema validation passed.
[SUCCESS] SHA-256 checksums verified (4/4 items).
[INFO] Publishing release artifacts to /path/to/dist/releases...
[SUCCESS] Published directory: dist/releases/20261106-213000-a1b2c3d4/
[SUCCESS] Published bundle:    dist/releases/e-webui-1.0.0-20261106-213000-a1b2c3d4.tar.gz
```
