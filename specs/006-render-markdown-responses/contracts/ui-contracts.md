# UI Contracts & Interfaces: Markdown Response Display and Copy Actions

**Feature**: Markdown Response Display and Copy Actions (`006-render-markdown-responses`)  
**Date**: 2026-11-06  
**Status**: Completed  

---

## 1. DOM Hierarchy Contract

For each assistant message rendered in `#messages-list`:

```html
<div class="message-item assistant" data-raw-markdown="[Unrendered Markdown String]">
  <div class="message-header">
    <span class="message-author">[Model Name]</span>
  </div>

  <div class="message-bubble" dir="auto">
    <!-- Optional Thinking Accordion if thinking text is present -->
    <details class="thinking-container">
      <summary class="thinking-header">
        <span>💭 Thinking Process</span>
        <span class="thinking-status">thought process</span>
      </summary>
      <div class="thinking-body">[Rendered HTML of thought process]</div>
    </details>

    <!-- Rendered Markdown Content Container -->
    <div class="markdown-body">
      <!-- Headings, paragraphs, lists, tables, code blocks -->
      <p>Here is an explanation and an example:</p>
      
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang">python</span>
          <button class="copy-code-btn" type="button" aria-label="Copy code snippet">
            <svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="btn-label">Copy</span>
          </button>
        </div>
        <pre><code class="language-python">def hello():
    print("Hello world")</code></pre>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>Header 1</th><th>Header 2</th></tr>
          </thead>
          <tbody>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Response Actions Toolbar (ChatGPT / Gemini style) -->
  <div class="message-actions">
    <button class="action-btn copy-response-btn" type="button" title="Copy response" aria-label="Copy full response">
      <svg class="action-icon copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <svg class="action-icon check-icon hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span class="action-label">Copy</span>
    </button>
  </div>
</div>
```

---

## 2. JavaScript Interface Contract

### 2.1 Markdown Rendering Module

```javascript
/**
 * Renders raw Markdown into sanitized, formatted HTML string.
 * Supports headings, bold, italic, code blocks, tables, blockquotes, lists.
 * @param {string} markdownText - Raw markdown string from Ollama stream
 * @returns {string} Sanitized HTML string ready for injection
 */
function renderMarkdown(markdownText)
```

### 2.2 Response Copy Handler

```javascript
/**
 * Copies the raw markdown string of an assistant message to system clipboard.
 * Updates the action button UI to visual confirmation state for 1.8 seconds.
 * @param {HTMLElement} messageItem - The .message-item.assistant element
 * @param {HTMLButtonElement} copyBtn - The triggered copy button
 * @returns {Promise<boolean>} Success or failure
 */
async function copyMessageResponse(messageItem, copyBtn)
```

### 2.3 Code Block Copy Handler

```javascript
/**
 * Copies code block content to clipboard and displays temporary "Copied!" text.
 * @param {HTMLButtonElement} button - The clicked .copy-code-btn element
 */
async function copyCodeBlock(button)
```

---

## 3. CSS Styling Tokens & Layout Contract

- **Tables**:
  - Border: `1px solid var(--border)`
  - Header background: `var(--bg-card)`
  - Padding: `8px 12px` per cell
  - Wrapper: `overflow-x: auto; margin: 12px 0; border-radius: 8px;`
- **Blockquotes**:
  - Border-left: `3px solid var(--accent-burgundy)` (or `var(--accent-violet)`)
  - Background: `rgba(186, 70, 89, 0.05)` (light) / `rgba(186, 70, 89, 0.15)` (dark)
  - Margin: `12px 0; padding: 8px 16px; border-radius: 0 8px 8px 0;`
- **Headings**:
  - H1-H3: Distinct font weights (`600`), appropriate margins (`16px 0 8px 0`), color `var(--text-main)`
- **Response Actions Toolbar**:
  - Margin-top: `6px`
  - Display: `flex; align-items: center; gap: 8px;`
  - Action buttons: Subtle ghost button (`opacity: 0.8`), transitioning to full opacity on hover, with rounded pill/compact padding.
