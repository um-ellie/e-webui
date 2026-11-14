/**
 * Safe Markdown Parser & Sanitizer Module
 * Integrates marked.js, DOMPurify, and offline Prism.js syntax highlighting with Claude-style code block chrome.
 */

export const LANGUAGE_ALIASES = {
  python: 'python',
  py: 'python',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  markup: 'markup',
  css: 'css',
  sql: 'sql',
  markdown: 'markdown',
  md: 'markdown'
};

// Configure marked with custom renderer if available
function getMarkedRenderer() {
  if (typeof window === 'undefined' || typeof window.marked === 'undefined' || typeof window.marked.Renderer !== 'function') {
    return null;
  }

  const renderer = new window.marked.Renderer();

  // Custom code block renderer with Prism syntax highlighting
  renderer.code = function (codeText, language) {
    const rawLang = (language || 'text').trim().toLowerCase();
    const safeLang = rawLang.replace(/[^a-z0-9_-]/g, '') || 'text';
    const prismKey = LANGUAGE_ALIASES[safeLang] || safeLang;

    let highlightedHtml = '';
    const prism = typeof window !== 'undefined' ? window.Prism : null;

    if (prism && prism.languages) {
      let grammar = prism.languages[prismKey];
      let targetLang = prismKey;

      // Fallback: typescript -> javascript if typescript grammar is missing
      if (!grammar && (safeLang === 'typescript' || safeLang === 'ts')) {
        grammar = prism.languages.javascript;
        targetLang = 'javascript';
      }

      if (grammar && typeof prism.highlight === 'function') {
        try {
          highlightedHtml = prism.highlight(codeText, grammar, targetLang);
        } catch (e) {
          console.warn(`Prism highlighting failed for ${safeLang}:`, e);
          highlightedHtml = escapeHtml(codeText);
        }
      } else {
        highlightedHtml = escapeHtml(codeText);
      }
    } else {
      highlightedHtml = escapeHtml(codeText);
    }

    return `
<div class="code-container" dir="ltr">
  <div class="code-header">
    <span class="code-lang-badge">${safeLang}</span>
    <button class="btn-code-copy" type="button" aria-label="Copy code to clipboard">
      <svg class="i icon-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
      <svg class="i icon-check" viewBox="0 0 24 24" style="display:none"><polyline points="20 6 9 17 4 12"/></svg>
      <span class="copy-label">Copy</span>
    </button>
  </div>
  <pre><code class="language-${safeLang}">${highlightedHtml}</code></pre>
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
  if (typeof window !== 'undefined' && typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') {
    const renderer = getMarkedRenderer();
    rawHtml = renderer
      ? window.marked.parse(content, { renderer, breaks: true, gfm: true })
      : window.marked.parse(content);
  } else {
    rawHtml = `<p>${escapeHtml(content)}</p>`;
  }

  // Sanitize with DOMPurify
  if (typeof window !== 'undefined' && typeof window.DOMPurify !== 'undefined' && typeof window.DOMPurify.sanitize === 'function') {
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
  if (!container) return;
  const copyButtons = container.querySelectorAll('.btn-code-copy:not([data-copy-bound]), .copy-code-btn:not([data-copy-bound])');
  copyButtons.forEach((btn) => {
    btn.setAttribute('data-copy-bound', 'true');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const codeContainer = btn.closest('.code-container') || btn.closest('.code-block-wrapper');
      if (!codeContainer) return;

      const codeElement = codeContainer.querySelector('code');
      if (!codeElement) return;

      const text = codeElement.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        const label = btn.querySelector('.copy-label');
        const iconCopy = btn.querySelector('.icon-copy');
        const iconCheck = btn.querySelector('.icon-check');

        btn.classList.add('copied');
        if (label) label.textContent = 'Copied!';
        if (iconCopy) iconCopy.style.display = 'none';
        if (iconCheck) iconCheck.style.display = 'inline-block';

        setTimeout(() => {
          btn.classList.remove('copied');
          if (label) label.textContent = 'Copy';
          if (iconCopy) iconCopy.style.display = '';
          if (iconCheck) iconCheck.style.display = 'none';
        }, 2000);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    });
  });
}
