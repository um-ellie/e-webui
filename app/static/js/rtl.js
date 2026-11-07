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

/**
 * Checks if the text has speakable content after stripping code blocks, URLs, markdown, and emojis.
 * @param {string} text
 * @returns {boolean}
 */
export function hasSpeakableContent(text) {
  if (!text) return false;
  // Remove fenced code blocks
  const withoutCode = text.replace(/```[\w\-]*\s*[\s\S]*?(?:```|$)/g, ' ');
  // Remove markdown links & URLs
  const withoutLinks = withoutCode.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/https?:\/\/\S+/g, ' ');
  // Remove inline code backticks
  const withoutInline = withoutLinks.replace(/`([^`]+)`/g, '$1');
  // Remove emojis and pictographs
  const withoutEmojis = withoutInline.replace(/[\u{10000}-\u{10FFFF}]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\uFE00-\uFE0F]|\u200D/gu, ' ');
  // Check if at least one Latin letter exists
  return /[a-zA-Z]/.test(withoutEmojis);
}

/**
 * Evaluates whether text is predominantly English (Latin script) vs RTL / non-English.
 * @param {string} text
 * @returns {boolean}
 */
export function isPredominantlyEnglish(text) {
  if (!text) return false;
  // Strip code blocks first so code doesn't falsely skew script count
  const prose = text.replace(/```[\w\-]*\s*[\s\S]*?(?:```|$)/g, ' ');
  const latinMatches = prose.match(/[a-zA-Z]/g);
  const rtlMatches = prose.match(new RegExp(RTL_REGEX.source, 'g'));

  const latinCount = latinMatches ? latinMatches.length : 0;
  const rtlCount = rtlMatches ? rtlMatches.length : 0;

  // Must have Latin letters and have strictly more Latin letters than RTL letters
  return latinCount > 0 && latinCount > rtlCount && hasSpeakableContent(prose);
}
