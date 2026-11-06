# Research & Architectural Decisions: README & .gitignore Modernization

**Feature**: `010-update-readme-gitignore`
**Date**: 2026-11-07

---

## 1. Documentation Structure & Language Precedence

### Decision
Structure `README.md` as a unified bilingual document with an initial language anchor selector (`## Languages / زبان‌ها`), immediately followed by the complete **English** guide, and then the complete **Persian** (`فارسی`) guide.

### Rationale
- Placing the English section first provides immediate clarity to international readers, package indexers, and GitHub repository overview screens.
- Retaining the complete Persian guide below ensures native Persian speakers have access to an identical, fluent, and comprehensive walkthrough.
- A single `README.md` file avoids fractured repository maintenance (compared to separate `README_FA.md` files) while bidirectional anchor links (`#english` and `#فارسی-persian`) provide instant one-click switching.

### Alternatives Considered
- *Separate `README_FA.md` and `README.md`*: Evaluated and rejected because users often miss secondary language files, and maintaining two separate files increases risk of documentation drift.
- *Persian First, English Second (Previous State)*: Rejected because the user explicitly requested that English appear first.

---

## 2. No-Emoji Policy & Visual Aesthetics

### Decision
Enforce a strict zero-emoji policy across all headings, body text, tables, and badge descriptions in `README.md`. Technical box-drawing characters (`│`, `─`, `┌`, `└`, `▼`) are permitted exclusively within fenced code blocks for the architecture schematic.

### Rationale
- Eliminating emojis produces a clean, professional, distraction-free document that renders predictably across all terminal markdown viewers, headless environments, and assistive screen readers.
- Plain text styling with bold callouts, tables, and standard markdown blockquotes (`>`) delivers higher technical readability without relying on decorative pictographs.

### Verification Strategy
Automated verification via Python character inspection scanning the file for non-ASCII characters outside standard Persian/Arabic unicode code points (`0x0600`–`0x06FF`):
```python
emojis = [c for c in text if ord(c) > 0x2300 and not (0x0600 <= ord(c) <= 0x06FF) and c not in {'│', '▼', '─', '└', '├', '┌', '┐', '┘', '┴', '┬', '┼'}]
```
Any matches will trigger a test failure.

---

## 3. App Capability Synchronization & Step Sequencing

### Decision
Synchronize the onboarding and operational guide with the current application state (derived from specifications 001 through 009), fixing the historical numbering discontinuity (where Step 3 was skipped) into a cohesive 5-step sequence:
1. **Step 1: Prerequisites Check** (`Incus` + `ollama` container + model list)
2. **Step 2: Deployment** (`./deploy.sh` interactive provisioning)
3. **Step 3: Web UI Usage & Feature Exploration** (model selection, thinking toggle, theme toggle, markdown rendering, copy buttons, stop & clear controls)
4. **Step 4: Lifecycle & Release Management** (`--status`, `--update`, `--rollback`, `--repair`, `--uninstall`, `./build-release.sh`)
5. **Step 5: Resource Management** (`incus stop webui`, `incus start webui`)

### Rationale
- The application previously gained features (such as Dark/Light theme toggle, Thinking mode toggle, Markdown rendering, and code copy buttons in `specs/005` and `specs/006`, and release packaging in `specs/009`) that were either omitted or partially documented.
- Contiguous step numbering avoids user confusion and provides a logical onboarding journey.

---

## 4. Git Ignore Coverage & Repository Cleanliness

### Decision
Consolidate `.gitignore` into clearly labeled functional sections:
- Python Bytecode & Cache (`__pycache__/`, `*.py[cod]`, `.cache/`, `*.so`)
- Virtual Environments (`.venv/`, `venv/`, `env/`, `ENV/`)
- Packaging & Distribution (`dist/`, `build/`, `*.egg-info/`, `*.tar.gz`, `*.tar`, `*.tgz`, `*.zip`)
- Testing & Code Quality (`.pytest_cache/`, `.coverage`, `.coverage.*`, `htmlcov/`, `coverage.xml`)
- Runtime & Deployment State (`.deploy_state`, `*.pid`, `*.seed`, `checksums.sha256`, `manifest.json`)
- Environment Secrets (`.env`, `.env.*`, with negation for `!.env.example`)
- Logs & Diagnostics (`*.log`, `logs/`, `*.log.*`)
- Editors & IDEs (`.vscode/`, `.idea/`, `*.swp`, `*~`)
- OS Artifacts (`.DS_Store`, `Thumbs.db`, `desktop.ini`)
- Temporary Directories (`scratch/`, `tmp/`, `temp/`)

### Rationale
- Prevents accidental commits of release tarballs, temporary manifest/checksum dumps, test coverage databases, or local editor settings.
- Explicitly protects `.env.example` as a tracked template while excluding active local secrets.
