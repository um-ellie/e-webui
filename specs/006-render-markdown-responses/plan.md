# Implementation Plan: Markdown Response Display and Copy Actions

**Branch**: `006-render-markdown-responses` | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-render-markdown-responses/spec.md`

## Summary

Enhance the assistant message presentation in `app/static/` (`index.html`, `style.css`, `app.js`) to provide full Markdown rendering compatibility (headings, tables, blockquotes, styled lists, code blocks) on par with modern AI platforms like Gemini and ChatGPT. Introduce a dedicated action toolbar beneath each assistant message containing a full-response copy button that copies the clean, original unrendered Markdown text to the user's clipboard with instant visual confirmation ("Copied!"), alongside individual code block copy buttons and smooth streaming display.

## Technical Context

**Language/Version**: Modern HTML5, CSS3, Vanilla ES6+ JavaScript  
**Primary Dependencies**: Vendored lightweight client-side Markdown parser in `app/static/vendor/` (zero npm/bundler build pipeline, zero runtime CDN reliance)  
**Storage**: In-memory DOM attributes (`dataset.rawMarkdown`) and existing browser `localStorage`  
**Testing**: Manual end-to-end browser scenarios (`quickstart.md`), static asset inspection, mock-based unit tests  
**Target Platform**: Modern desktop and mobile web browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Single-Page Web Application frontend assets & FastAPI static file serving  
**Performance Goals**: Markdown parse time < 15ms per chunk update; clipboard write & feedback transition < 100ms; zero layout shift/flickering during token streaming  
**Constraints**: Constitution Principle I (Infrastructure Isolation): Zero interaction with Incus containers; all modifications remain strictly within workspace repository files (`app/static/`)  
**Scale/Scope**: Frontend static assets (`app/static/index.html`, `app/static/style.css`, `app/static/app.js`, vendored script in `app/static/vendor/`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Plan Compliance Status | Notes |
|---|---|---|---|
| **Principle I: Infrastructure Isolation** | No interaction with Incus containers, profiles, devices, or incus CLI. | **PASSED** | Feature strictly affects frontend web assets (`app/static/`). Zero container commands will be run. |
| **Principle II: Workspace-Only Scope Boundary** | All modifications confined to workspace directory. | **PASSED** | Only files in `app/static/` and `specs/` are modified. |
| **Principle III: Transparent Delegation & Manual Hand-offs** | Document manual verification instructions for user. | **PASSED** | `quickstart.md` provides explicit browser-based validation scenarios. |

*GATE STATUS: PASSED*

## Project Structure

### Documentation (this feature)

```text
specs/006-render-markdown-responses/
├── spec.md                  # Feature specification
├── plan.md                  # Implementation plan (this file)
├── research.md              # Phase 0 output: markdown parser & copy action decisions
├── data-model.md            # Phase 1 output: DOM entities, toolbar states & structures
├── quickstart.md            # Phase 1 output: manual validation scenarios
├── checklists/
│   └── requirements.md      # Specification quality checklist
└── contracts/
    └── ui-contracts.md      # Phase 1 output: DOM hierarchy, JS signatures & styling tokens
```

### Source Code (repository root)

```text
app/
├── config.py
├── main.py
├── models.py
├── services/
│   └── ollama_client.py
└── static/
    ├── index.html            # Include vendor markdown script & updated layout hooks
    ├── style.css             # Markdown typography, tables, blockquotes, action toolbar styles
    ├── app.js                # Integrated markdown parser, response copy handler, streaming
    └── vendor/
        └── marked.min.js     # Lightweight, offline CommonMark/GFM parser script
```

**Structure Decision**: Single web application layout modifying frontend assets in `app/static/` with a self-contained offline vendored Markdown parser in `app/static/vendor/marked.min.js`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | Retains vanilla JS architecture; vendoring a single script eliminates fragile custom regexes while preserving zero-build and offline isolation |
