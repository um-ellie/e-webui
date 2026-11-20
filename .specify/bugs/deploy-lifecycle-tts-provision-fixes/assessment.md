# Bug Assessment: Deployment Lifecycle, Initial Install, and Kokoro TTS Provisioning Failures

- **Slug**: deploy-lifecycle-tts-provision-fixes
- **Created**: 2026-11-20T05:40:00Z
- **Source**: Pasted text from user
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

The user reported:
> "سیستم deploy , build , ctl کلا بهم ریخته به شکلی که وقتی از اول مراحله نصب رو میرم. اصلا مدل صوتی برای تلفظ را نصب نمی کنه و انگار خیلی چیزها رو ناقص نصب می کنه. کل این سیستم ها رو بررسی کن و خطاها رو پیدا کن"
> *(The deploy, build, and ctl systems are completely messed up such that when I go through the installation steps from scratch, it doesn't install the voice model for pronunciation at all and it feels like many things are installed incompletely. Check all these systems and find the bugs.)*

## Symptom

1. During a clean/fresh installation (`./deploy.sh --install <container>` or initial setup through `./ctl`), the Kokoro TTS model weights (`kokoro-v1_0.pth` and `kokoro-v0_19.pth`) and voice assets are completely omitted.
2. The Python 3.11 standalone interpreter (`interpreters/python-3.11`) and PyTorch/Kokoro dependencies are skipped; the container falls back to system Python (e.g., Python 3.13 on Ubuntu Noble), rendering Kokoro TTS inoperable due to dependency/wheel incompatibility.
3. The deployment records `"profile": "core"` in `.deploy_state`. On subsequent updates (`./deploy.sh --update`), the system permanently stays locked into the `core` profile because neither the model weights exist nor does `.deploy_state` indicate `tts`.
4. The control center interactive loop (`./ctl`) triggers initial installation without offering profile selection or defaulting to TTS capabilities.
5. In `tests/test_deploy_lifecycle.py`, 5 integration tests fail with assertion errors:
   - `test_fresh_install_tts_provisioning`: missing Python 3.11 standalone interpreter and missing Kokoro model weights.
   - `test_update_migrates_py313_venv`: legacy venv update does not migrate to Python 3.11 because profile falls back to `core`.
   - `test_model_download_failure_resilience`: expected `"download failed"` output never triggers because model acquisition is bypassed under `core`.
   - `test_skip_model_download_and_standalone_download_model`: expected `"skipping kokoro model weights download"` fails because `deploy.sh` prints `"core profile active: skipping kokoro tts model acquisition."` instead.
   - `test_model_download_fallback_to_v019`: fallback logic is unreachable because `core` profile skips model acquisition completely.

## Reproduction

1. In the test suite, run:
   ```bash
   /usr/bin/python3 -m unittest tests/test_deploy_lifecycle.py
   ```
2. Observe 5 failures caused by `[info] deployment profile resolved to: core`.
3. In a real environment, run `./scripts/deploy.sh --install e-webui-app` without manually providing `--profile tts`.
4. Inspect the resulting deployment:
   - `/opt/e-webui/shared/models/kokoro/` is empty.
   - `/opt/e-webui/interpreters/python-3.11/` does not exist.
   - `.deploy_state` has `"profile": "core"`.
   - The Web UI loads, but voice pronunciation features fail because Kokoro models and runtime dependencies were never provisioned.

## Suspected Code Paths

1. **`scripts/deploy.sh:44-69` (`resolve_deployment_profile`)**:
   - `resolve_deployment_profile()` checks if `kokoro_model_is_present` returns true, or if `state_get_profile` returns non-core.
   - On a fresh installation, neither condition is true. The function defaults to `"core"`.
   - Because `e-webui` is a full voice-enabled web interface by default, defaulting to `core` on initial install or when upgrading unprofiled state breaks the primary user feature (TTS). The default profile for new installations must be `tts` unless explicitly passed as `--profile core`.

2. **`scripts/lib/state.sh:92-96` (`state_get_profile`)**:
   - When no profile is present in `.deploy_state`, `state_get_profile` defaults to `"core"`. When migrating legacy states that lacked an explicit profile tag, it forces the container into `core` rather than detecting or migrating TTS environments.

3. **`scripts/deploy.sh:418-422` & `scripts/deploy.sh:529-533` (Model Acquisition Logging & Branching)**:
   - When `DEPLOY_PROFILE="tts"` and `SKIP_MODEL_DOWNLOAD=1` is passed, the `else` branch executes:
     `info "Core profile active: skipping Kokoro TTS model acquisition."`
   - This message is inaccurate and causes test failures (`test_skip_model_download_and_standalone_download_model`). When `SKIP_MODEL_DOWNLOAD=1` under the TTS profile, it should explicitly log: `"Skipping Kokoro model weights download (--skip-model-download passed)."`

4. **`scripts/ctl.sh:230-244` (Initial Install Hook)**:
   - When `./ctl` discovers that the target container does not exist, it runs `"${DEPLOY_SCRIPT}" --install "${CONTAINER_NAME}"` without specifying a profile or prompting the user. With the current defaulting logic, this installs a `core`-only system with no voice support.

5. **`scripts/lib/provision.sh` & `scripts/lib/venv.sh`**:
   - In `ensure_venv_in_container`, python 3.11 standalone installation is conditioned on `[ "${profile}" = "tts" ]`. Because profile resolution collapsed to `core`, Python 3.11 was never provisioned.

## Root Cause Hypothesis

The deployment lifecycle contains a Catch-22 default resolution bug in `scripts/deploy.sh`:
1. `resolve_deployment_profile` queries whether Kokoro model files exist on disk before deciding the profile. On a new install, they do not exist yet.
2. The function then queries `.deploy_state`. On a new install or legacy migration, `.deploy_state` has no profile record.
3. As a result, `resolve_deployment_profile` falls back to `core`.
4. The deployment pipeline treats `core` as an intentional choice to disable PyTorch, disable standalone Python 3.11, and skip Kokoro model weights download.
5. The resulting state is written with `"profile": "core"`, permanently sealing the container into the stripped-down core mode across all future runs.
6. When flags like `--skip-model-download` are provided under `tts`, the `if/else` construct groups `core` and `SKIP_MODEL_DOWNLOAD` into a single `else` branch, outputting misleading log messages that also break lifecycle assertions.

Confidence: **High**.

## Proposed Remediation

1. **Fix `resolve_deployment_profile` in `scripts/deploy.sh`**:
   - Priority order:
     a. If `--profile <prof>` or `--with-tts` was passed via CLI (`CLI_DEPLOY_PROFILE`), use it.
     b. If `.deploy_state` specifies a profile, respect that existing setting.
     c. If Kokoro model weights are already present on disk, resolve to `tts`.
     d. For fresh installations or legacy environments without an explicit profile record, default to `tts` (the full-featured application profile) rather than `core`. Explicitly reserve `core` for when the user specifies `--profile core`.
2. **Refine Kokoro Model Logging in `scripts/deploy.sh`**:
   - In both `run_update` (lines 418-422) and `run_install` (lines 529-533), separate the check:
     ```bash
     if [ "${DEPLOY_PROFILE}" = "tts" ]; then
         if [ "${SKIP_MODEL_DOWNLOAD:-0}" -eq 1 ]; then
             info "Skipping Kokoro model weights download (--skip-model-download passed)."
         else
             ensure_kokoro_model "${CONTAINER_NAME}" "${APP_DIR}" 1
         fi
     else
         info "Core profile active: skipping Kokoro TTS model acquisition."
     fi
     ```
3. **Enhance `scripts/ctl.sh` Initial Installation & Profile Management**:
   - When prompting for initial installation in `scripts/ctl.sh`, inform the user about the installation profile (defaulting to Full TTS) or pass `--profile tts`.
4. **Verify Lifecycle Test Suite**:
   - Run `/usr/bin/python3 -m unittest tests/test_deploy_lifecycle.py` and ensure all 26 lifecycle tests pass.
   - Run unit tests `/usr/bin/python3 -m unittest discover -s tests/unit -p "test_*.py"` to ensure no regressions.

## Risks & Considerations

- Low risk: Defaulting fresh installations to `tts` restores the documented and expected product behavior (full voice model availability out-of-the-box). Users who need low RAM footprints (<50MB) can still pass `--profile core` or switch profiles interactively via `./ctl`.
- Preserves offline runtime capabilities and air-gapped fallbacks.

## Open Questions

None. The test failures and code logic directly pinpoint the root cause.
