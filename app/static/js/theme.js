/**
 * Theme & Appearance Manager
 * Supports: 'system', 'light', 'dark'
 * Handles OS color scheme changes and localStorage persistence.
 */

const THEME_STORAGE_KEY = 'ewebui_theme';
const FONT_SIZE_STORAGE_KEY = 'ewebui_font_size';

export class ThemeManager {
  constructor() {
    this.mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    this.currentTheme = this.getSavedTheme();
    this.currentFontSize = this.getSavedFontSize();

    this.init();
  }

  getSavedTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  }

  getSavedFontSize() {
    try {
      return localStorage.getItem(FONT_SIZE_STORAGE_KEY) || 'medium';
    } catch {
      return 'medium';
    }
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.applyFontSize(this.currentFontSize);

    if (this.mediaQuery) {
      this.mediaQuery.addEventListener('change', () => {
        if (this.currentTheme === 'system') {
          this.applyTheme('system');
        }
      });
    }
  }

  /**
   * Set theme override
   * @param {'system' | 'light' | 'dark'} theme
   */
  setTheme(theme) {
    this.currentTheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.warn('Failed to persist theme:', e);
    }
    this.applyTheme(theme);
  }

  /**
   * Apply theme attribute to document
   * @param {'system' | 'light' | 'dark'} theme
   */
  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    // Update theme-color meta tag
    this.updateThemeMeta();
  }

  /**
   * Set font size preference
   * @param {'small' | 'medium' | 'large'} size
   */
  setFontSize(size) {
    this.currentFontSize = size;
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    } catch (e) {
      console.warn('Failed to persist font size:', e);
    }
    this.applyFontSize(size);
  }

  applyFontSize(size) {
    document.documentElement.setAttribute('data-font-size', size);
  }

  updateThemeMeta() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && this.mediaQuery && this.mediaQuery.matches);

    meta.content = isDark ? '#110E20' : '#F6FBFE';
  }
}

export const themeManager = new ThemeManager();
