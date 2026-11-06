# Research & Technical Decisions: Markdown Response Display and Copy Actions

**Feature**: Markdown Response Display and Copy Actions (`006-render-markdown-responses`)  
**Date**: 2026-11-06  
**Status**: Completed  

---

## 1. Markdown Parsing & Rendering Engine

### Context & Problem
Currently, `app/static/app.js` relies on a rudimentary regex-based `renderMarkdown` function that only handles simple bold, italic, code blocks, and basic unordered lists. It fails on tables, nested lists, blockquotes, headings (`#`), horizontal rules, task lists, and links. To achieve a presentation quality on par with ChatGPT and Gemini, a complete, robust CommonMark/GFM-compliant parsing solution is required.

### Options Considered
- **Option A: Expand custom regex parser**: Handcraft regexes for tables, headers, blockquotes, and ordered lists.
  - *Drawback*: Regex cannot reliably parse nested Markdown structures, multi-line tables, or mixed formatting. It quickly becomes brittle and prone to rendering bugs.
- **Option B: Use an external CDN script at runtime (e.g. cdnjs / unpkg)**:
  - *Drawback*: Violates self-contained isolation requirements; will fail in air-gapped, offline, or private Incus container environments.
- **Option C: Vendored standalone client-side Markdown library (`marked.min.js`) served locally**:
  - *Benefits*: Standard in modern web applications; zero backend dependencies; zero npm/bundler build step required; CommonMark/GFM compliant (tables, headings, blockquotes, lists); runs locally from `/static/vendor/` with zero telemetry and 100% offline reliability.
  - *Security*: Can be paired with DOM sanitization / escaping to prevent XSS.

### Decision
**Adopt Option C**: Vendor a self-contained, lightweight, battle-tested Markdown parser (`marked.min.js` or standalone GFM module) placed directly into `app/static/vendor/` and loaded via `<script src="/static/vendor/marked.min.js">`. Configure it for GFM (GitHub Flavored Markdown) with tables, line breaks, and sanitized output.

---

## 2. Full-Response Copy Action Architecture

### Context & Problem
Users requested a copy button located at the bottom of each assistant message that copies the entire response preserving its exact original Markdown formatting, similar to ChatGPT and Gemini.

### Options Considered
- **Option A: Extract text from rendered HTML DOM (`bubble.innerText`)**:
  - *Drawback*: Destroys the original Markdown formatting (headings lose `#`, code fences lose ` ``` `, tables lose markdown pipes).
- **Option B: Cache the raw Markdown response string on the message element**:
  - *Benefits*: Preserves 100% faithful Markdown syntax identical to what the model generated. Fast, memory-light, and guarantees exact reproduction when pasted elsewhere.
  - *Storage*: Store raw markdown in a data attribute (e.g., `msgItem.dataset.rawMarkdown = rawText`) or in an in-memory message object map keyed by message ID.

### Decision
**Adopt Option B**: Store the unrendered raw Markdown stream in `msgItem.dataset.rawMarkdown`. Below the message bubble, render a `.message-actions` toolbar containing a dedicated "Copy response" action button. When clicked:
1. Access `msgItem.dataset.rawMarkdown`.
2. Write to clipboard using `navigator.clipboard.writeText()` with legacy `textarea` + `execCommand('copy')` fallback for restricted browser contexts.
3. Provide immediate visual feedback: the copy icon transitions into a checkmark icon + "Copied" text/tooltip for 1.8 seconds, then transitions back smoothly.

---

## 3. Separation of "Thinking Process" vs "Final Response" in Copy Action

### Context & Problem
When "Thinking Mode" is enabled, responses include both internal thought chains (`<think>...</think>` or `thinkingText`) and the final response (`responseText`). What should the full-response copy button copy?

### Options Considered
- **Option A: Copy everything combined including raw `<think>` tags**:
  - *Drawback*: Most users pasting into chat, docs, or code editors want the actual answer, not the scratchpad thought process.
- **Option B: Copy exclusively the final answer Markdown**:
  - *Benefits*: Matches Gemini and ChatGPT UX where copying the response copies the final structured output. The thinking box can have its own independent view/toggle.
- **Option C: Configurable copy button**:
  - *Drawback*: Adds unnecessary UI clutter for a standard action.

### Decision
**Adopt Option B**: The full-response copy action button at the bottom of the assistant message copies the clean, final Markdown response text (`responseText`).

---

## 4. Code Block Presentation & Independent Copying

### Context & Problem
Assistant messages often contain code snippets (Python, Bash, JavaScript, JSON, YAML). Users need syntax-styled code containers with language labels and an individual code block copy button.

### Decision
Custom renderer extension for code blocks in the Markdown pipeline:
- Code blocks are rendered inside a `.code-block-wrapper` featuring:
  - Header with language identifier badge (e.g. `python`, `bash`, `text`).
  - Discrete "Copy" button with a clipboard icon and localized confirmation feedback.
  - Monospaced `<pre><code>` block with horizontal scroll preservation.
- Code block copy copies *only* the contents of that specific code block without language labels or message prose.

---

## 5. Bidirectional (RTL/LTR) Typography & Theme Alignment

### Context & Problem
The application supports Persian and English text. Persian text is right-to-left (RTL), while Markdown headings, bullet points, tables, and code snippets must respect proper alignment without breaking layout.

### Decision
- The message bubble uses dynamic directionality (`dir="auto"`), allowing natural RTL alignment for Persian sentences and LTR for English.
- Code blocks, inline `<code>`, preformatted tags, tables, and numeric lists maintain strict `direction: ltr; text-align: left;` to ensure syntax, indentation, and table pipes render correctly.
- Styles harmoniously align with both the default **Pastel Light Blue** (`#EBF3FA`) theme and the **Pastel Dark Navy** (`#191F2D`) theme, featuring subtle borders, accessible contrast, and rounded card styling.
