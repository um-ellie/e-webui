# Quickstart & Verification Guide: Interactive and Resumable Container Deployment

**Feature Branch**: `003-interactive-container-deploy`
**Date**: 2026-11-05
**Status**: Draft

This document outlines how an administrator can run, verify, and test the interactive deployment workflow.

## Prerequisites

- Linux Host machine with `incus` installed and permissions to execute `incus` commands (`incus list`, `incus exec`, `incus file push`).
- Existing Incus container (e.g. `webui` based on Ubuntu or Debian).
- Cloned repository `ellie-ollama-webui`.

> **Note on Constitution Principle I**: The AI agent will NEVER execute these container commands directly. The human administrator runs the script manually on their host machine.

---

## Scenario 1: Standard Interactive Deployment

1. Run the deployment script from the project root on the host machine:
   ```bash
   ./scripts/deploy.sh
   ```
2. When prompted:
   ```text
   Enter Incus container name [default: webui]:
   ```
   Press Enter (or type your container name, e.g. `webui`).
3. Observe the roadmap of all 5 steps printed to the console.
4. For each step:
   - Review the explanation.
   - Type `y` and press Enter.
5. Upon completion of Step 5, verify the success message and endpoint:
   ```text
   SUCCESS: e-webui service is active and running!
   Application URL: http://<container-ip>:8080
   ```

---

## Scenario 2: Declining a Step (Abort Flow)

1. Run the deployment script:
   ```bash
   ./scripts/deploy.sh webui
   ```
2. Confirm Step 1 (`y`).
3. At Step 2, decline by typing `n`:
   ```text
   Do you want to proceed with this step? [y/N]: n
   ```
4. Verify the warning appears:
   ```text
   ⚠️  Warning: Skipping this step will prevent e-webui from being deployed.
   Do you want to abort the deployment now? [Y/n]:
   ```
5. Press Enter to confirm abort.
6. Verify that the script exits immediately with exit code `1` and no further steps are executed.

---

## Scenario 3: Resuming an Interrupted Deployment

1. After aborting or interrupting at Step 2 or 3 in Scenario 2, run the deployment script again:
   ```bash
   ./scripts/deploy.sh webui
   ```
2. Verify that the script:
   - Identifies previously completed steps.
   - Prints: `[SKIPPED: Already Completed]` for Step 1.
   - Resumes directly at the pending Step 2.
3. Confirm the remaining steps (`y`) until Step 5 completes.

---

## Scenario 4: Automated Offline Unit Testing (Mocked CLI)

To test the script's logic, parsing, and state management in an automated environment without touching live containers:

1. Execute the automated test suite:
   ```bash
   pytest tests/unit/test_deploy_script.py -v
   ```
2. The tests verify:
   - Interactive prompt handling when no argument is supplied.
   - Rejection warnings and exit code logic.
   - State reading, writing, and step resumption.
   - `--help` and `--reset` flag operations.
