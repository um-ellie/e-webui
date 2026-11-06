# Bug Assessment: Incomplete English Documentation for Test Runner and Container Name

- **Slug**: readme-sync-english-tests
- **Created**: 2026-11-07
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: low

## Report (verbatim or summarized)

> "ظاهرا تغییرات نام کانتینر و اصلاحات مربوط به تست ها فقط در قسمت فارسی README.md اضافه شده. لطفا یک بار دیگه فایل README.md را چک کنید."
> (Apparently the container name changes and fixes related to tests were only added to the Persian section of README.md. Please check the README.md file once more.)

## Symptom

When reviewing `README.md`, the English section under `### Automated Testing` still references the obsolete container name `webui` and omits the local mock-based testing instructions with `requirements-dev.txt`. These updates were only applied to the Persian section (`# فارسی (Persian)`), leading to bilingual documentation drift.

## Reproduction

1. Open `README.md` in repository root.
2. Inspect the English section under `### Automated Testing` (around lines 160–171). Notice it only contains:
   ```bash
   # Run pytest inside the default container (webui)
   ./scripts/test.sh
   # Or specify a custom container name
   ./scripts/test.sh webui
   ```
3. Inspect the Persian section under `### اجرای تست‌های خودکار` (around lines 360–385). Notice it includes instructions for `requirements-dev.txt`, virtual environment setup, local mock testing via `python3 -m unittest discover tests`, and uses `e-webui-app` as the container name.

## Suspected Code Paths

- `README.md:160-171`: English `### Automated Testing` section lacks local venv / `requirements-dev.txt` instructions and still references `webui`.
- `README.md:176-203`: English `### Project Structure` tree omits `requirements.txt` and `requirements-dev.txt`.
- `README.md:150-157`: Service commands table in English uses `webui` instead of `e-webui-app`.

## Root Cause Hypothesis

During the execution of task `T017` in feature `011-security-and-code-optimization`, the edits were applied strictly to the bottom of `README.md` within the Persian localization block (`# فارسی (Persian)`), leaving the corresponding English sections un-synchronized.
Confidence: high.

## Proposed Remediation

**Preferred**:
Synchronize the English section of `README.md`:
1. Under `### Automated Testing`, add the local testing subsection with virtual environment creation, `requirements-dev.txt` installation, and local mock testing via `python3 -m unittest discover tests`.
2. Update the container test runner commands to reference the updated default container `e-webui-app`.
3. Add `requirements.txt` and `requirements-dev.txt` to the English project structure tree.
4. Harmonize container name references across both language sections where applicable.

**Files likely to change**:
- `README.md`

**Tests to add or update**:
- Verify markdown rendering and bilingual section consistency.

## Risks & Considerations

- Low risk. Pure documentation update; no runtime behavior or dependency contracts are modified.

## Open Questions

- None. Scope and required changes are completely clear.
