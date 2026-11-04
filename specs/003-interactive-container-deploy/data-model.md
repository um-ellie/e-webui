# Data Model: Interactive and Resumable Container Deployment

**Feature Branch**: `003-interactive-container-deploy`
**Date**: 2026-11-05
**Status**: Draft

## Conceptual Model & Entities

```
+--------------------------+           1..* +----------------------+
| DeploymentSession        |--------------->| DeploymentStep       |
+--------------------------+                +----------------------+
| - container_name: string |                | - step_number: int   |
| - mode: string           |                | - id: string         |
| - start_time: timestamp  |                | - title: string      |
+--------------------------+                | - description: text  |
             | 1                            | - required: bool     |
             |                              +----------------------+
             v 1                                       | 1
+--------------------------+                           |
| DeploymentStateRecord    |                           | records
+--------------------------+                           v 0..*
| - container: string      |<--------------------------+
| - completed_steps: list  |
| - current_step: string   |
| - last_updated: timestamp|
+--------------------------+
```

---

## Entity Definitions

### 1. DeploymentSession
Represents an invocation of `scripts/deploy.sh`.

- **Attributes**:
  - `container_name` (*string*, required): Name of the target Incus container (e.g. `webui`).
  - `mode` (*enum*: `INTERACTIVE`, `NON_INTERACTIVE`, `FORCE_RESET`): Operational mode. Default is `INTERACTIVE`.
  - `start_time` (*timestamp*): Execution initiation time.
- **Validation Rules**:
  - `container_name` must be a valid alphanumeric hostname/identifier matching `^[a-zA-Z0-9_-]+$`.
  - Cannot be empty.

### 2. DeploymentStep
Defines each atomic deployment action.

- **Attributes**:
  - `step_number` (*integer*, 1 to 5): Ordering sequence in the deployment pipeline.
  - `id` (*string*): Unique token identifier (e.g., `step_check_container`, `step_install_deps`, `step_sync_files`, `step_configure_service`, `step_verify_health`).
  - `title` (*string*): Short display title.
  - `description` (*string*): Explanatory text detailing changes made during this step.
  - `required` (*boolean*): Indicates whether the step is strictly necessary for deployment success (all 5 steps are required).

### 3. DeploymentStateRecord
The persistent artifact tracking progress across runs.

- **Storage Location**: Inside target container at `/opt/e-webui/.deploy_state` (or local fallback during Step 1).
- **Format**: Flat text or JSON file.
- **Attributes**:
  - `container` (*string*): Container identifier.
  - `completed_steps` (*list of strings*): List of `step_id` strings that successfully ran to completion.
  - `last_step` (*string*): The most recent step completed.
  - `last_updated` (*ISO 8601 string*): Timestamp of last state change.
- **State Transitions**:
  ```
  [UNINITIALIZED] 
         │ (Script starts, container prompted/validated)
         ▼
  [STEP_1_CONTAINER_VERIFIED]
         │ (Packages & environment installed)
         ▼
  [STEP_2_PREREQUISITES_INSTALLED]
         │ (Files synced & requirements installed)
         ▼
  [STEP_3_FILES_SYNCED]
         │ (Systemd enabled & started)
         ▼
  [STEP_4_SERVICE_CONFIGURED]
         │ (Health validated, port reachable)
         ▼
  [DEPLOYMENT_COMPLETE]
  ```

### 4. StepConfirmationResponse
The result of an interactive user prompt before each step.

- **Values**:
  - `CONFIRMED`: User accepted (`y` / `Y`). Script proceeds to execute step.
  - `ABORT_CONFIRMED`: User declined step and confirmed abort (`Y`). Script halts with status 1.
  - `RETRY_CONFIRMATION`: User declined step but chose not to abort (`n`). Script re-prompts the step.
