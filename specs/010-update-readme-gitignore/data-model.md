# Data Model: Documentation & Ignore Rule Entities

**Feature**: `010-update-readme-gitignore`
**Date**: 2026-11-07

---

## 1. Documentation Entity (`ReadmeDocument`)

The `ReadmeDocument` models the structural elements of `README.md`, ensuring completeness, linguistic symmetry, and formatting compliance.

### Attributes

| Attribute | Type | Description | Validation Rule |
| :--- | :--- | :--- | :--- |
| `title` | String | Top-level project identifier (`# e-webui`) | Must match `# e-webui` without emojis |
| `badges` | Array[Badge] | Status and tech stack indicator badges | Zero emojis permitted in badge alt-texts |
| `language_nav` | List[NavAnchor] | Bidirectional section switch anchors | Must contain links to `#english` and `#فارسی-persian` |
| `english_section` | LanguageSection | Primary documentation guide | Positioned immediately following language nav |
| `persian_section` | LanguageSection | Secondary documentation guide | Positioned immediately following English section |

### Nested Entity: `LanguageSection`

| Attribute | Type | Description |
| :--- | :--- | :--- |
| `heading` | String | Language section anchor (`# English` or `# فارسی (Persian)`) |
| `description` | Text | High-level architectural purpose and RAM consumption notice |
| `key_features` | List[String] | Comprehensive list of application capabilities |
| `architecture_diagram` | CodeBlock | ASCII / box-drawing network schematic |
| `step_guide` | List[GuideStep] | Sequential onboarding steps (Steps 1 through 5) |
| `lifecycle_commands` | CodeBlock | Essential CLI commands for `./deploy.sh` and `./build-release.sh` |
| `service_admin_table` | Table | Systemctl inspection and journalctl log commands |
| `automated_test_guide` | CodeBlock | Container-executed pytest runner usage (`./scripts/test.sh`) |
| `project_structure` | CodeBlock | Repository directory tree layout (English section) |
| `env_variables_table` | Table | Configuration table for `OLLAMA_HOST`, `APP_HOST`, `APP_PORT` |

### Nested Entity: `GuideStep`

| Attribute | Type | Description |
| :--- | :--- | :--- |
| `step_number` | Integer | Sequential step identifier (1, 2, 3, 4, 5) |
| `title` | String | Clear action-oriented summary |
| `commands` | Array[String] | Runnable terminal commands |
| `explanation` | Text | Explanatory context without unnecessary jargon |

---

## 2. Ignore Rule Set Entity (`GitignoreRuleSet`)

The `GitignoreRuleSet` models the exclusion patterns defined in `.gitignore`.

### Pattern Categories

| Category | Target Files & Directories | Purpose |
| :--- | :--- | :--- |
| `python_cache` | `__pycache__/`, `*.py[cod]`, `*.so`, `.cache/` | Exclude compiled bytecode and runtime cache |
| `virtualenv` | `.venv/`, `venv/`, `env/`, `ENV/` | Exclude local virtual environments |
| `packaging` | `dist/`, `build/`, `*.egg-info/`, `*.tar.gz`, `*.tar`, `*.tgz`, `*.zip` | Exclude distribution packages and release archives |
| `testing` | `.pytest_cache/`, `.coverage`, `htmlcov/`, `coverage.xml` | Exclude test runners and coverage databases |
| `runtime_state` | `.deploy_state`, `*.pid`, `*.seed`, `checksums.sha256`, `manifest.json` | Exclude transient deploy state and root manifest artifacts |
| `secrets` | `.env`, `.env.*` | Exclude local secrets while preserving `!.env.example` |
| `logs` | `*.log`, `logs/`, `*.log.*` | Exclude application and test log dumps |
| `editors` | `.vscode/`, `.idea/`, `*.swp`, `*~`, `*.bak` | Exclude IDE and text editor project files |
| `os_artifacts` | `.DS_Store`, `Thumbs.db`, `desktop.ini` | Exclude desktop metadata files |
| `scratch` | `scratch/`, `tmp/`, `temp/` | Exclude temporary workspaces and unpacking buffers |

---

## 3. Entity Relationships

```text
ReadmeDocument
  ├── LanguageNav
  ├── EnglishSection (LanguageSection)
  │     ├── KeyFeatures
  │     ├── ArchitectureDiagram
  │     ├── GuideSteps [1..5]
  │     └── ReferenceTables
  └── PersianSection (LanguageSection)
        ├── KeyFeatures (Mirrored)
        ├── ArchitectureDiagram (Mirrored)
        ├── GuideSteps [1..5] (Mirrored)
        └── ReferenceTables (Mirrored)

GitignoreRuleSet
  └── Categories [10 Functional Groups]
        └── ExclusionRules [Deterministic glob patterns]
```
