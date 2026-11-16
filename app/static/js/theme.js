/**
 * Theme & Appearance Manager
 * Soft Sage & Warm Sand Design System
 * Supports: 'system', 'light', 'dark'
 * Handles OS color scheme changes, multi-segment radio-groups, and localStorage persistence.
 */

const THEME_STORAGE_KEY = 'ewebui_theme';
const FONT_SCALE_KEY = 'ewebui_font_scale';

export class ThemeManager {
  constructor() {
    this.mediaQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    this.currentTheme = this.getSavedTheme();
    this.currentFontScale = this.getSavedFontScale();

    /** @type {Set<(theme: string, effectiveTheme: string) => void>} */
    this.listeners = new Set();

    this.init();
  }

  getSavedTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('theme') || 'system';
    } catch {
      return 'system';
    }
  }

  getSavedFontScale() {
    try {
      return parseInt(localStorage.getItem(FONT_SCALE_KEY) || '100', 10);
    } catch {
      return 100;
    }
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.applyFontScale(this.currentFontScale);

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
   * @param {'system' | 'light' | 'dark'} mode
   */
  setTheme(mode) {
    this.currentTheme = mode;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
      localStorage.setItem('theme', mode);
    } catch (e) {
      console.warn('Failed to persist theme:', e);
    }
    this.applyTheme(mode);
  }

  /**
   * Apply theme attribute and update segmented controls
   * @param {'system' | 'light' | 'dark'} mode
   */
  applyTheme(mode) {
    const isDark = (mode === 'dark') || (mode === 'system' && this.mediaQuery && this.mediaQuery.matches);
    const effective = isDark ? 'dark' : 'light';

    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = effective;

      // Sync all segmented theme controls [data-seg]
      const segments = document.querySelectorAll('[data-seg]');
      segments.forEach((seg) => {
        const buttons = Array.from(seg.querySelectorAll('button[data-m]'));
        buttons.forEach((btn) => {
          const isSelected = btn.dataset.m === mode;
          btn.setAttribute('aria-checked', String(isSelected));
          btn.tabIndex = isSelected ? 0 : -1;
        });
        const activeIdx = buttons.findIndex((btn) => btn.dataset.m === mode);
        if (activeIdx !== -1) {
          seg.style.setProperty('--i', String(activeIdx));
        }
      });

      this.updateThemeMeta(effective);
    }

    for (const fn of this.listeners) {
      try {
        fn(mode, effective);
      } catch (e) {
        console.error('Theme listener error:', e);
      }
    }
  }

  /**
   * Set font scale percentage (90 to 120)
   * @param {number} scale
   */
  setFontScale(scale) {
    this.currentFontScale = Math.min(Math.max(scale, 90), 120);
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(this.currentFontScale));
    } catch (e) {
      console.warn('Failed to persist font scale:', e);
    }
    this.applyFontScale(this.currentFontScale);
  }

  applyFontScale(scale) {
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = `${scale}%`;
      const scaleDisplay = document.getElementById('fs');
      if (scaleDisplay) {
        scaleDisplay.textContent = `${scale}%`;
      }
      const scaleRange = document.getElementById('fsr');
      if (scaleRange && parseInt(scaleRange.value, 10) !== scale) {
        scaleRange.value = String(scale);
      }
    }
  }

  updateThemeMeta(effectiveTheme) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = effectiveTheme === 'dark' ? '#1a2420' : '#fff9ef';
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const themeManager = new ThemeManager();
