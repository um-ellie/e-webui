/**
 * Safe Markdown Parser & Sanitizer Module
 * Integrates marked.js and DOMPurify with Claude-style code block chrome.
 */

// Configure marked with custom renderer if available
function getMarkedRenderer() {
  if (typeof window.marked === 'undefined') {
    return null;
  }

  const renderer = new window.marked.Renderer();

  // Custom code block renderer
  renderer.code = function (codeText, language) {
    const lang = (language || 'text').toLowerCase();
    const safeLang = lang.replace(/[^a-z0-9_-]/g, '');

    return `
<div class="code-container" dir="ltr">
  <div class="code-header">
    <span>${safeLang}</span>
    <button class="btn-code-copy" type="button" aria-label="Copy code to clipboard">
      <svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
      <span class="copy-label">Copy</span>
    </button>
  </div>
  <pre><code>${escapeHtml(codeText)}</code></pre>
</div>`;
  };

  return renderer;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extracts <think>...</think> content if embedded in raw markdown text
 * @param {string} text
 * @returns {{ thinking: string | null, content: string }}
 */
export function extractThinking(text) {
  if (!text) return { thinking: null, content: '' };

  if (text.includes('<think>')) {
    const parts = text.split('<think>');
    const before = parts[0];
    const after = parts.slice(1).join('<think>');
    if (after.includes('</think>')) {
      const [thinkContent, ...rest] = after.split('</think>');
      const remainingContent = (before + rest.join('</think>')).trim();
      return {
        thinking: thinkContent.trim(),
        content: remainingContent
      };
    } else {
      // Unclosed <think> (in-flight stream)
      return {
        thinking: after.trim(),
        content: before.trim()
      };
    }
  }
  return { thinking: null, content: text };
}

/**
 * Parses markdown to safe sanitized HTML
 * @param {string} text
 * @returns {string}
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // Extract any raw <think> tags if passed into markdown directly
  const { content } = extractThinking(text);
  if (!content) return '';

  let rawHtml = '';
  if (typeof window.marked !== 'undefined') {
    const renderer = getMarkedRenderer();
    rawHtml = window.marked.parse(content, { renderer, breaks: true, gfm: true });
  } else {
    rawHtml = `<p>${escapeHtml(content)}</p>`;
  }

  // Sanitize with DOMPurify
  if (typeof window.DOMPurify !== 'undefined') {
    return window.DOMPurify.sanitize(rawHtml, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    });
  }

  return rawHtml;
}

/**
 * Attaches copy event listeners to code blocks within a container element
 * @param {HTMLElement} container
 */
export function attachCodeCopyHandlers(container) {
  const copyButtons = container.querySelectorAll('.btn-code-copy:not([data-copy-bound])');
  copyButtons.forEach((btn) => {
    btn.setAttribute('data-copy-bound', 'true');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const codeContainer = btn.closest('.code-container');
      if (!codeContainer) return;

      const codeElement = codeContainer.querySelector('code');
      if (!codeElement) return;

      const text = codeElement.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        const label = btn.querySelector('.copy-label');
        if (label) {
          const original = label.textContent;
          label.textContent = 'Copied!';
          setTimeout(() => {
            label.textContent = original;
          }, 2000);
        }
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    });
  });
}
