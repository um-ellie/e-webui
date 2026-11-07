/**
 * RTL & Persian Direction Detection Module
 * Evaluates Unicode character ranges and enforces RTL/LTR isolation.
 */

// Regex covering Persian, Arabic, and related RTL scripts
const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Detects whether the predominant text flow should be RTL or LTR
 * @param {string} text
 * @returns {'rtl' | 'ltr'}
 */
export function detectDirection(text) {
  if (!text) return 'ltr';

  // Check the first strong directional character
  const words = text.trim().split(/\s+/);
  for (const word of words) {
    // Strip leading punctuation/symbols
    const clean = word.replace(/^[^\p{L}]+/u, '');
    if (clean.length > 0) {
      return RTL_REGEX.test(clean[0]) ? 'rtl' : 'ltr';
    }
  }

  return 'ltr';
}

/**
 * Applies directional attributes to a message container
 * @param {HTMLElement} element
 * @param {string} text
 */
export function applyDirectionToElement(element, text) {
  const dir = detectDirection(text);
  element.setAttribute('dir', dir);
  if (dir === 'rtl') {
    element.classList.add('font-fa');
  } else {
    element.classList.remove('font-fa');
  }

  // Ensure code blocks inside remain strictly LTR
  isolateLtrContent(element);
}

/**
 * Enforces LTR and monospace styles on all embedded code blocks
 * @param {HTMLElement} container
 */
export function isolateLtrContent(container) {
  const codeBlocks = container.querySelectorAll('.code-container, pre, code');
  codeBlocks.forEach((el) => {
    el.setAttribute('dir', 'ltr');
    el.style.unicodeBidi = 'isolate';
  });
}
