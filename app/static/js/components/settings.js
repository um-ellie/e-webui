/**
 * Settings Dialog Component
 * 3-Pane Task-Centric Architecture: Workspace, Model, Data & System
 * Handles theme switching, text font scaling, model inference parameters,
 * and two-step Danger Zone conversation wiping.
 */

import { themeManager } from '../theme.js';
import { bindFeatureControl } from '../features.js';
import { store } from '../store.js';

export class SettingsDialog {
  constructor(backdropElement) {
    this.backdrop = backdropElement;
    this.closeBtn = backdropElement.querySelector('#closeset') || backdropElement.querySelector('.btn-close-modal');
    this.paneButtons = backdropElement.querySelectorAll('button[data-pane]');
    this.panes = backdropElement.querySelectorAll('.pane');

    // Controls
    this.fontScaleRange = backdropElement.querySelector('#fsr');
    this.fontScaleVal = backdropElement.querySelector('#fs');
    this.tempRange = backdropElement.querySelector('#tr');
    this.tempVal = backdropElement.querySelector('#tv');
    this.topPRange = backdropElement.querySelector('#pr');
    this.topPVal = backdropElement.querySelector('#pv');
    this.sysPromptInput = backdropElement.querySelector('#ta-sys');
    this.btnDeleteAll = backdropElement.querySelector('#del');

    this.deleteConfirmState = false;
    this.deleteTimeout = null;
    this.previousFocusedElement = null;

    this.init();
  }

  init() {
    this.setupPanes();
    this.setupClose();
    this.setupWorkspaceSettings();
    this.setupModelSettings();
    this.setupDataManagement();
    this.bindRegistryControls();
  }

  setupPanes() {
    this.paneButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.pane;
        this.switchPane(targetId);
      });
    });
  }

  switchPane(targetId) {
    this.paneButtons.forEach((b) => {
      const isTarget = b.dataset.pane === targetId;
      b.setAttribute('aria-selected', String(isTarget));
      b.classList.toggle('active', isTarget);
    });

    this.panes.forEach((pane) => {
      if (pane.id === targetId) {
        pane.hidden = false;
        pane.style.display = 'block';
      } else {
        pane.hidden = true;
        pane.style.display = 'none';
      }
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

  setupWorkspaceSettings() {
    // Font scale slider
    if (this.fontScaleRange) {
      const currentScale = themeManager.getSavedFontScale();
      this.fontScaleRange.value = String(currentScale);
      if (this.fontScaleVal) this.fontScaleVal.textContent = `${currentScale}%`;

      this.fontScaleRange.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        themeManager.setFontScale(val);
        if (this.fontScaleVal) this.fontScaleVal.textContent = `${val}%`;
      });
    }
  }

  setupModelSettings() {
    // Temperature slider
    if (this.tempRange) {
      const savedTemp = store.defaultTemperature ?? 0.7;
      this.tempRange.value = String(savedTemp);
      if (this.tempVal) this.tempVal.textContent = parseFloat(savedTemp).toFixed(2);

      this.tempRange.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        store.defaultTemperature = val;
        try {
          localStorage.setItem('ewebui_default_temp', String(val));
        } catch (_) {}
        if (this.tempVal) this.tempVal.textContent = val.toFixed(2);
      });
    }

    // Top-P slider
    if (this.topPRange) {
      const savedTopP = store.defaultTopP ?? 0.9;
      this.topPRange.value = String(savedTopP);
      if (this.topPVal) this.topPVal.textContent = parseFloat(savedTopP).toFixed(2);

      this.topPRange.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        store.defaultTopP = val;
        try {
          localStorage.setItem('ewebui_default_topp', String(val));
        } catch (_) {}
        if (this.topPVal) this.topPVal.textContent = val.toFixed(2);
      });
    }

    // System prompt textarea
    if (this.sysPromptInput) {
      this.sysPromptInput.value = store.defaultSystemPrompt || '';
      this.sysPromptInput.addEventListener('input', (e) => {
        store.defaultSystemPrompt = e.target.value;
        try {
          localStorage.setItem('ewebui_default_sysprompt', e.target.value);
        } catch (_) {}
      });
    }
  }

  setupDataManagement() {
    if (!this.btnDeleteAll) return;

    this.btnDeleteAll.addEventListener('click', async () => {
      if (!this.deleteConfirmState) {
        this.deleteConfirmState = true;
        this.btnDeleteAll.classList.add('sure');
        this.btnDeleteAll.textContent = 'Yes, delete everything';

        this.deleteTimeout = setTimeout(() => {
          this.resetDeleteButton();
        }, 4000);
        return;
      }

      // Second click: execute wipe
      clearTimeout(this.deleteTimeout);
      this.resetDeleteButton();

      try {
        await store.clearAllSessions();
        this.close();
      } catch (err) {
        console.error('Failed to clear conversations:', err);
      }
    });
  }

  resetDeleteButton() {
    this.deleteConfirmState = false;
    if (this.btnDeleteAll) {
      this.btnDeleteAll.classList.remove('sure');
      this.btnDeleteAll.textContent = 'Delete all conversations';
    }
  }

  bindRegistryControls() {
    if (this.tempRange) {
      bindFeatureControl(this.tempRange, 'model.temperature_tune');
    }
    if (this.sysPromptInput) {
      bindFeatureControl(this.sysPromptInput, 'model.system_prompt');
    }
  }

  isOpen() {
    return this.backdrop.classList.contains('on') || this.backdrop.getAttribute('aria-hidden') === 'false';
  }

  open(paneId = 'p1') {
    this.previousFocusedElement = document.activeElement;
    this.backdrop.classList.add('on');
    this.backdrop.setAttribute('aria-hidden', 'false');
    this.resetDeleteButton();

    const normalizedPane = paneId === 'workspace' || paneId === 'general' ? 'p1'
      : (paneId === 'model' || paneId === 'models' ? 'p2'
      : (paneId === 'data' || paneId === 'about' ? 'p3' : paneId));

    this.switchPane(normalizedPane);

    // Focus close button
    if (this.closeBtn) {
      this.closeBtn.focus();
    }
  }

  close() {
    this.resetDeleteButton();
    this.backdrop.classList.remove('on');
    this.backdrop.setAttribute('aria-hidden', 'true');
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      this.previousFocusedElement.focus();
    }
  }
}
