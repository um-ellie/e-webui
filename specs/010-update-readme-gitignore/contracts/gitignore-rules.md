# Contract: Git Ignore Rules & Exclusions Specification

**Contract Identifier**: `CTR-IGN-001`
**Target File**: `.gitignore`

---

## 1. Mandatory Exclusion Patterns

The `.gitignore` file MUST include exclusion rules for the following categories:

### Python & Bytecode
- `__pycache__/`
- `*.py[cod]`
- `*$py.class`
- `*.so`
- `.Python`
- `*.pyo`
- `*.pyd`
- `.cache/`

### Virtual Environments
- `.venv/`
- `venv/`
- `env/`
- `ENV/`
- `env.bak/`
- `venv.bak/`

### Packaging & Release Distribution
- `build/`
- `dist/`
- `downloads/`
- `eggs/`
- `.eggs/`
- `parts/`
- `sdist/`
- `var/`
- `wheels/`
- `*.egg-info/`
- `*.egg`
- `MANIFEST`
- `*.tar.gz`
- `*.tar`
- `*.tgz`
- `*.zip`

### Testing & Code Quality
- `.pytest_cache/`
- `.coverage`
- `.coverage.*`
- `htmlcov/`
- `nosetests.xml`
- `coverage.xml`
- `*.cover`
- `.hypothesis/`
- `.mypy_cache/`
- `.ruff_cache/`

### Deployment & Runtime State
- `.deploy_state`
- `*.pid`
- `*.seed`
- `checksums.sha256`
- `manifest.json`

### Secrets & Environment
- `.env`
- `.env.*`
- `!.env.example` (Must be explicitly excepted from exclusion)

### Logs
- `*.log`
- `logs/`
- `*.log.*`

### IDEs & Editors
- `.vscode/`
- `.idea/`
- `*.sublime-project`
- `*.sublime-workspace`
- `*.swp`
- `*.swo`
- `*~`
- `*.bak`
- `*.tmp`

### OS Artifacts
- `.DS_Store`
- `.DS_Store?`
- `._*`
- `.Spotlight-V100`
- `.Trashes`
- `ehthumbs.db`
- `Thumbs.db`
- `desktop.ini`

### Scratch & Temp Directories
- `scratch/`
- `tmp/`
- `temp/`

---

## 2. Invariants

1. **Deterministic Glob Evaluation**: All path patterns must target standard glob patterns without unintended side effects on tracked repository directories (`app/`, `tests/`, `specs/`, `scripts/`, `.agents/`).
2. **Template Preservation**: `.env.example` must remain explicitly whitelisted to serve as an onboarding template for operators.
