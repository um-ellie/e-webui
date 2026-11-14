# Technical Research & Decisions: Streaming Render Optimization & Code Polish

**Feature**: `017-streaming-render-code-polish`  
**Date**: 2026-11-14  
**Status**: Completed  

---

## 1. Streaming Render Pipeline: Frame-Throttling & DOM Stability

### Root Cause Analysis of Streaming Lag
Profiling the current implementation in `components/chat.js` reveals that on every SSE chunk received from the Ollama proxy:
1. `store.updateMessage()` fires synchronous `'message:updated'` event.
2. `updateMessageDOM()` immediately invokes:
   ```javascript
   body.innerHTML = renderMarkdown(msg.content);
   applyDirectionToElement(body, msg.content);
   const cursor = document.createElement('span');
   cursor.className = 'stream-cursor';
   body.appendChild(cursor);
   this.scrollToBottom();
   ```
3. `renderMarkdown()` runs full AST parsing (`marked.parse()`) and DOM tree sanitization (`DOMPurify.sanitize()`) on the entire cumulative string from character 0 to N.
4. For high-speed models (40–100 tokens/sec), the DOM is completely torn down and rebuilt 40–100 times per second. This causes:
   * Severe main-thread CPU spikes (100% core saturation).
   * Forced synchronous layout recalculation and garbage collection thrashing.
   * Dropped animation frames (stuttering when user attempts to scroll or type).
   * Blinking cursor element destruction and re-creation jitter.

### Technical Decision: RequestAnimationFrame Throttled Render Pipeline
* **Decoupling Network Ingestion from DOM Layout**:
  * Chunks received over SSE update the in-memory message object immediately (`msg.content += token`).
  * DOM updates are scheduled via a `requestAnimationFrame` (RAF) throttle loop with a 35–45ms minimum interval clamp.
  * If multiple chunks arrive within a single frame interval (~16ms), they are coalesced into a single DOM layout pass.
* **Persistent Cursor Element**:
  * Instead of appending and removing `.stream-cursor` inside the dynamic markdown body, maintain `.stream-cursor` as a stable trailing element or attach it once, preventing element churn.
* **Smart Auto-Scroll**:
  * Wrap auto-scroll in the RAF pass, executing `scrollToBottom()` only when the user has not scrolled up (`!this.userScrolledUp`).

---

## 2. Offline Syntax Highlighting Strategy

### Options Evaluated
1. **Highlight.js (Full bundle)**:
   * *Cons*: Large bundle size (100KB+), heavy parsing engine, auto-detection can misidentify short code snippets.
2. **Dynamic CDN (CDNJS / unpkg)**:
   * *Cons*: Violates strict offline deployment and Incus container isolation principles. Forbidden by Constitution.
3. **Vendored Prism.js Compact Bundle (Chosen)**:
   * *Pros*: Lightweight (~22 KB total for core + common languages), zero dependencies, fast regex-based tokenizer.
   * *Clean marked.js Integration*: Works cleanly with `marked.Renderer.code`:
     ```javascript
     renderer.code = function(codeText, language) {
       const lang = (language || 'text').toLowerCase();
       const grammar = window.Prism && window.Prism.languages[lang];
       const highlighted = grammar ? window.Prism.highlight(codeText, grammar, lang) : escapeHtml(codeText);
       return `<div class="code-container" dir="ltr">...<pre><code class="language-${lang}">${highlighted}</code></pre></div>`;
     };
     ```
   * *Supported Languages*: Python, JavaScript, TypeScript, Bash/Shell, JSON, YAML, SQL, HTML/Markup, CSS, Markdown.
   * *Fallback*: If language is unknown or omitted, falls back safely to escaped plain text without errors.

---

## 3. Theme-Aware Token Palette for Code Syntax

To preserve e-webui's aesthetic, syntax tokens use CSS custom properties mapped to the light and dark palettes:

| Syntax Element | Light Theme Token | Dark Theme Token | Visual Impression |
|---|---|---|---|
| Keywords, Operators | `--rose` (`#AD3960`) | `--rose` (`#E5779B`) | Warm accent |
| Strings, Attributes | `#1B5E20` (Forest Green) | `#58B88A` (`--ok`) | Calm legible green |
| Functions, Classes | `--purple` (`#6A4892`) | `--purple` (`#B79DE0`) | Deep lavender |
| Comments, Metadata | `--mute` (`#625B7E`) | `--mute` (`#A59DC0`) | Subtle italicized |
| Numbers, Booleans | `#C25E00` (Amber) | `#F59E0B` (Gold) | High-contrast warm |
| Punctuation, Brackets | `--ink` (`#2A2140`) | `--ink` (`#ECE7F7`) | High legibility |

---

## 4. UI Polish: Smooth Accordion & Contrast Refinement

### Smooth Reasoning Accordion
* Traditional `display: none` / `block` causes an instantaneous visual snap.
* Solution: CSS Grid transition technique:
  ```css
  .thought-content {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .thought-content.open {
    grid-template-rows: 1fr;
  }
  .thought-content-inner {
    min-height: 0;
    overflow: hidden;
  }
  ```
  Provides a native-feeling, GPU-accelerated smooth accordion animation without measuring scroll heights with JavaScript.

### Dark Mode Code Block Contrast
* Elevate dark mode variables:
  * `--codebg: #151128;` (deep rich background)
  * `--codehead: #1F193C;` (subtle distinct header)
  * `--line: #352C58;` (clear boundary)
* Add subtle 1px border around code containers, ensuring minimum 3:1 contrast against `--card` (#1E1936).

### Custom Subtle Scrollbars
* Add cross-browser thin scrollbar rules (`scrollbar-width: thin; scrollbar-color: var(--line) transparent;`) with styled WebKit scrollbar pseudo-elements for clean dark/light integration.
