/**
 * Settings Dialog Component
 * Accessible tabbed modal: General, Appearance, Models, Shortcuts, About.
 * Handles theme, font size, inference parameter settings, focus trapping, and Esc dismissal.
 */

import { themeManager } from '../theme.js';
import { bindFeatureControl } from '../features.js';
import { store } from '../store.js';

export class SettingsDialog {
  constructor(backdropElement) {
    this.backdrop = backdropElement;
    this.closeBtn = backdropElement.querySelector('.btn-close-modal');
    this.tabButtons = backdropElement.querySelectorAll('.tab-btn');
    this.tabPanes = backdropElement.querySelectorAll('.tab-pane');

    // Controls
    this.themeSelect = backdropElement.querySelector('#setting-theme');
    this.fontSizeSelect = backdropElement.querySelector('#setting-font-size');

    this.previousFocusedElement = null;
    this.init();
  }

  init() {
    this.setupTabs();
    this.setupClose();
    this.setupAppearanceSettings();
    this.setupModelsSettings();
    this.setupDataManagement();
    this.bindRegistryControls();
  }

  setupDataManagement() {
    const btnClearAll = this.backdrop.querySelector('#btn-clear-all-chats');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', async () => {
        if (confirm('Are you sure you want to permanently delete all conversations? This cannot be undone.')) {
          try {
            await store.clearAllSessions();
            this.close();
          } catch (err) {
            console.error('Failed to clear sessions:', err);
          }
        }
      });
    }
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
  }

  setupModelsSettings() {
    const tempInput = this.backdrop.querySelector('#setting-temperature');
    const toppInput = this.backdrop.querySelector('#setting-topp');
    const sysPromptInput = this.backdrop.querySelector('#setting-system-prompt');

    const syncFromActiveSession = () => {
      const active = store.getActiveSession();
      if (active) {
        if (tempInput) tempInput.value = typeof active.temperature === 'number' ? active.temperature : 0.7;
        if (toppInput) toppInput.value = typeof active.topP === 'number' ? active.topP : 0.9;
        if (sysPromptInput) sysPromptInput.value = active.systemPrompt || '';
      }
    };

    if (tempInput) {
      tempInput.addEventListener('change', () => {
        const val = parseFloat(tempInput.value);
        if (!isNaN(val)) {
          const clamped = Math.min(Math.max(val, 0.0), 2.0);
          tempInput.value = clamped;
          try {
            localStorage.setItem('ewebui_default_temperature', String(clamped));
          } catch (_) {}
          const active = store.getActiveSession();
          if (active) {
            store.updateSession(active.id, { temperature: clamped });
          }
        }
      });
    }

    if (toppInput) {
      toppInput.addEventListener('change', () => {
        const val = parseFloat(toppInput.value);
        if (!isNaN(val)) {
          const clamped = Math.min(Math.max(val, 0.0), 1.0);
          toppInput.value = clamped;
          try {
            localStorage.setItem('ewebui_default_topp', String(clamped));
          } catch (_) {}
          const active = store.getActiveSession();
          if (active) {
            store.updateSession(active.id, { topP: clamped });
          }
        }
      });
    }

    if (sysPromptInput) {
      sysPromptInput.addEventListener('change', () => {
        const promptText = sysPromptInput.value.trim();
        try {
          localStorage.setItem('ewebui_default_system_prompt', promptText);
        } catch (_) {}
        const active = store.getActiveSession();
        if (active) {
          store.updateSession(active.id, { systemPrompt: promptText });
        }
      });
    }

    store.on('session:active-changed', syncFromActiveSession);
    syncFromActiveSession();
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
