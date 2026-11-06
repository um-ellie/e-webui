# Contract: README Document Structure & Content Specification

**Contract Identifier**: `CTR-DOC-001`
**Target File**: `README.md`

---

## 1. Top-Level Structural Invariants

1. **Header & Badges**:
   - Level-1 header must be exactly `# e-webui`.
   - Badges must include FastAPI, Python, Incus, and License.
   - Zero emojis permitted in badges or descriptions.

2. **Language Navigation Bar**:
   - Must appear immediately after the header block.
   - Must contain Markdown anchors to `[English](#english)` and `[فارسی (Persian)](#فارسی-persian)`.

3. **Language Ordering**:
   - The `# English` section MUST precede the `# فارسی (Persian)` section.
   - Persian section must follow a horizontal divider `---`.

---

## 2. Language Section Content Contract

Each language section (English and Persian) must contain the following subsections in identical order:

1. **Title & Summary**:
   - Short description highlighting ~40 MB RAM consumption, Incus container isolation, and systemd auto-start.

2. **Key Features**:
   - Memory efficiency (<50 MB).
   - Systemd integration (`e-webui.service`).
   - Host proxy security (`127.0.0.1:8080`).
   - Internal Ollama communication (`127.0.0.1:11434`).
   - Real-time SSE streaming.
   - Thinking Mode toggle and reasoning blocks.
   - Light and Dark theme toggle.
   - Markdown formatting with response and code-block copy buttons.
   - 100% offline static assets (no external CDNs).
   - Resumable deployment manager and release packager.

3. **Architecture Diagram**:
   - Fenced text block (`text`) detailing host browser -> Incus proxy -> WebUI container -> Ollama container.

4. **Step-by-Step Onboarding Guide**:
   - Must have 5 numbered steps without gaps:
     - **Step 1**: Prerequisites (`incus version`, `ollama list`).
     - **Step 2**: Application Deployment (`./deploy.sh`).
     - **Step 3**: Access and Web UI Features (`http://127.0.0.1:8080`, model selection, thinking toggle, theme toggle, copy buttons).
     - **Step 4**: Common Management Commands (`--status`, `--update`, `--rollback`, `--repair`, `--uninstall`, `./build-release.sh`).
     - **Step 5**: Stopping and Starting Containers (`incus stop webui`, `incus start webui`).

5. **Service Administration Table**:
   - Commands for `systemctl status`, `journalctl -u e-webui -f`, `systemctl restart`, `systemctl stop`.

6. **Automated Testing**:
   - Container-executed test runner invocation (`./scripts/test.sh`).

7. **Environment Variables**:
   - Configuration table for `OLLAMA_HOST`, `APP_HOST`, `APP_PORT`.

---

## 3. Emoji Restriction Invariant

- No unicode characters belonging to emoji blocks (`0x1F300`–`0x1FAFF`, `0x2600`–`0x27BF`, etc.) are permitted.
- Box-drawing characters (`│`, `─`, `┌`, `└`, `▼`) are permitted only in architecture diagrams.
