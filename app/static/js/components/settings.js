/**
 * Settings Dialog Component
 * Accessible tabbed modal: General, Appearance, Models, Shortcuts, About.
 * Handles theme, font size, language settings, focus trapping, and Esc dismissal.
 */

import { themeManager } from '../theme.js';
import { bindFeatureControl } from '../features.js';

export class SettingsDialog {
  constructor(backdropElement) {
    this.backdrop = backdropElement;
    this.closeBtn = backdropElement.querySelector('.btn-close-modal');
    this.tabButtons = backdropElement.querySelectorAll('.tab-btn');
    this.tabPanes = backdropElement.querySelectorAll('.tab-pane');

    // Controls
    this.themeSelect = backdropElement.querySelector('#setting-theme');
    this.fontSizeSelect = backdropElement.querySelector('#setting-font-size');
    this.langSelect = backdropElement.querySelector('#setting-language');

    this.previousFocusedElement = null;
    this.init();
  }

  init() {
    this.setupTabs();
    this.setupClose();
    this.setupAppearanceSettings();
    this.bindRegistryControls();
  }

  bindRegistryControls() {
    const tempInput = this.backdrop.querySelector('#setting-temperature');
    if (tempInput) {
      bindFeatureControl(tempInput, 'model.temperature_tune');
    }
    const sysPromptInput = this.backdrop.querySelector('#setting-system-prompt');
    if (sysPromptInput) {
      bindFeatureControl(sysPromptInput, 'model.system_prompt');
    }
  }

  setupTabs() {
    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        this.tabButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.tabPanes.forEach((pane) => {
          if (pane.id === `tab-${targetTab}`) {
            pane.style.display = 'block';
          } else {
            pane.style.display = 'none';
          }
        });
      });
    });
  }

  setupClose() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        e.preventDefault();
        this.close();
      }
    });
  }

  setupAppearanceSettings() {
    if (this.themeSelect) {
      this.themeSelect.value = themeManager.currentTheme;
      this.themeSelect.addEventListener('change', () => {
        themeManager.setTheme(this.themeSelect.value);
      });
    }

    if (this.fontSizeSelect) {
      this.fontSizeSelect.value = themeManager.currentFontSize;
      this.fontSizeSelect.addEventListener('change', () => {
        themeManager.setFontSize(this.fontSizeSelect.value);
      });
    }

    if (this.langSelect) {
      this.langSelect.addEventListener('change', () => {
        const lang = this.langSelect.value;
        if (lang === 'fa') {
          document.documentElement.setAttribute('dir', 'rtl');
        } else {
          document.documentElement.setAttribute('dir', 'ltr');
        }
      });
    }
  }

  isOpen() {
    return this.backdrop.classList.contains('open');
  }

  open(tabName = 'general') {
    this.previousFocusedElement = document.activeElement;
    this.backdrop.classList.add('open');
    this.backdrop.setAttribute('aria-hidden', 'false');

    // Switch to specified tab
    const tabBtn = this.backdrop.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (tabBtn) {
      tabBtn.click();
    }

    // Trap focus to close button
    if (this.closeBtn) {
      this.closeBtn.focus();
    }
  }

  close() {
    this.backdrop.classList.remove('open');
    this.backdrop.setAttribute('aria-hidden', 'true');
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      this.previousFocusedElement.focus();
    }
  }
}
