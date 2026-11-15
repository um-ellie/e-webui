/**
 * Composer Controller Component
 * Manages multi-line auto-growing textarea, Enter send button, disabled mic,
 * model picker popover with search filter, Think toggle, live streaming lifecycle, and drop overlay.
 */

import { store } from '../store.js';
import { api } from '../api.js';
import { bindFeatureControl } from '../features.js';
import { presetsService } from '../presets.js';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function showToast(message, duration = 3500) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.className = 'toast-card';
  toast.style.cssText = 'background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:8px 16px;font-size:13px;box-shadow:0 8px 24px rgba(42,33,64,0.18);display:flex;align-items:center;gap:8px;pointer-events:auto;transition:opacity 0.2s ease;';
  toast.innerHTML = `<svg class="i" style="width:16px;height:16px;color:var(--rose)" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

export class ModelPicker {
  constructor(container) {
    this.container = container;
    this.pillBtn = container.querySelector('#mp');
    this.nameEl = container.querySelector('#mn');
    this.tagEl = container.querySelector('#mtg');
    this.popover = container.querySelector('#pop');
    this.searchBox = container.querySelector('#model-search-box');
    this.searchInput = container.querySelector('#model-search-input');
    this.listContainer = container.querySelector('#model-items-list');
    this.manageBtn = container.querySelector('.mf');

    this.models = [];
    this.selectedModel = '';
    this.filterQuery = '';
    this.focusedIndex = -1;

    this.init();
  }

  init() {
    this.setupListeners();
    this.loadModels();

    if (this.manageBtn) {
      bindFeatureControl(this.manageBtn, 'chat.manage_models');
    }

    store.on('session:active-changed', (session) => {
      if (session && session.model) {
        this.selectModel(session.model, false);
      }
    });
  }

  setupListeners() {
    if (this.pillBtn) {
      this.pillBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });

      this.pillBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.open();
        }
      });
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.filterQuery = e.target.value.trim();
        this.focusedIndex = -1;
        this.renderItems();
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.moveFocus(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.moveFocus(-1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.selectFocused();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
          if (this.pillBtn) this.pillBtn.focus();
        }
      });
    }

    if (this.popover) {
      this.popover.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.moveFocus(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.moveFocus(-1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.selectFocused();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
          if (this.pillBtn) this.pillBtn.focus();
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (this.popover && !this.popover.hidden) {
        if (!this.popover.contains(e.target) && (!this.pillBtn || !this.pillBtn.contains(e.target))) {
          this.close();
        }
      }
    });
  }

  open() {
    if (!this.popover) return;
    this.popover.hidden = false;
    if (this.pillBtn) this.pillBtn.setAttribute('aria-expanded', 'true');
    this.filterQuery = '';
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    this.renderItems();
    if (this.models.length > 8 && this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 20);
    } else {
      this.focusedIndex = 0;
      this.updateFocus();
    }
  }

  close() {
    if (!this.popover) return;
    this.popover.hidden = true;
    if (this.pillBtn) this.pillBtn.setAttribute('aria-expanded', 'false');
    this.focusedIndex = -1;
  }

  toggle() {
    if (this.popover && !this.popover.hidden) {
      this.close();
    } else {
      this.open();
    }
  }

  moveFocus(direction) {
    const items = this.listContainer ? this.listContainer.querySelectorAll('.mi') : [];
    if (items.length === 0) return;

    this.focusedIndex += direction;
    if (this.focusedIndex < 0) this.focusedIndex = items.length - 1;
    if (this.focusedIndex >= items.length) this.focusedIndex = 0;

    this.updateFocus();
  }

  updateFocus() {
    const items = this.listContainer ? this.listContainer.querySelectorAll('.mi') : [];
    items.forEach((item, idx) => {
      if (idx === this.focusedIndex) {
        item.classList.add('focused');
        item.focus();
      } else {
        item.classList.remove('focused');
      }
    });
  }

  selectFocused() {
    const items = this.listContainer ? this.listContainer.querySelectorAll('.mi') : [];
    if (this.focusedIndex >= 0 && this.focusedIndex < items.length) {
      items[this.focusedIndex].click();
    }
  }

  async loadModels() {
    try {
      const resp = await api.getModels();
      this.models = resp.models || [];
      const defaultName = resp.default_model || (this.models[0] ? this.models[0].name : '');
      store.setDefaultModel(defaultName);

      const remembered = localStorage.getItem('ewebui_last_model');
      if (remembered) {
        const found = this.models.some((m) => m.name === remembered);
        if (found) {
          this.selectModel(remembered, false);
        } else {
          showToast(`Remembered model "${remembered}" not found, using ${defaultName}`);
          this.selectModel(defaultName, true);
        }
      } else {
        const active = store.getActiveSession();
        const initial = (active && active.model) || defaultName;
        this.selectModel(initial, false);
      }

      if (this.searchBox) {
        this.searchBox.style.display = this.models.length > 8 ? 'block' : 'none';
      }

      this.renderItems();
    } catch (err) {
      console.warn('Failed to load models for picker:', err);
      if (this.nameEl) this.nameEl.textContent = 'Ollama offline';
    }
  }

  selectModel(modelName, persist = true) {
    if (!modelName) return;
    this.selectedModel = modelName;
    if (persist) {
      try {
        localStorage.setItem('ewebui_last_model', modelName);
      } catch (_) {}
    }

    const session = store.getActiveSession();
    if (session) {
      store.updateSession(session.id, { model: modelName });
    }

    if (this.nameEl) {
      const modelObj = this.models.find((m) => m.name === modelName);
      let displayName = modelName;
      let tagText = '';

      if (modelObj && modelObj.parameter_size) {
        tagText = modelObj.parameter_size;
      } else if (modelName.includes(':')) {
        const [base, tag] = modelName.split(':');
        displayName = base;
        tagText = tag;
      }

      this.nameEl.textContent = displayName || 'Select model';
      if (this.tagEl) {
        if (tagText) {
          this.tagEl.textContent = tagText;
          this.tagEl.style.display = 'inline-block';
        } else {
          this.tagEl.style.display = 'none';
        }
      }
    }

    this.renderItems();
  }

  renderItems() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    const query = this.filterQuery.toLowerCase();
    const filtered = this.models.filter((m) => m.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px;text-align:center;color:var(--mute);font-size:13px;';
      empty.textContent = 'No matching models';
      this.listContainer.appendChild(empty);
      return;
    }

    filtered.forEach((m, idx) => {
      const isSelected = m.name === this.selectedModel;
      const isReasoning = /deepseek-r1|qwq|think|reasoning/i.test(m.name);

      let sizeGb = '';
      if (m.size) {
        sizeGb = `${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }

      const item = document.createElement('div');
      item.className = `mi ${isSelected ? 'on' : ''}`;
      item.role = 'option';
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      item.id = `model-opt-${idx}`;
      item.tabIndex = 0;

      let subParts = [];
      if (sizeGb) subParts.push(sizeGb);
      if (m.quantization) subParts.push(m.quantization);
      if (idx === 0) subParts.push('Loaded');

      let displayName = m.name;
      let paramTag = m.parameter_size || '';
      if (!paramTag && m.name.includes(':')) {
        const parts = m.name.split(':');
        displayName = parts[0];
        paramTag = parts[1];
      }

      item.innerHTML = `
        <span class="mg"></span>
        <span class="mx">
          <span class="mt1">
            ${escapeHtml(displayName)}
            ${paramTag ? `<span class="mt">${escapeHtml(paramTag)}</span>` : ''}
            ${isReasoning ? `<span class="tag">Reasoning</span>` : ''}
          </span>
          <span class="sub">${escapeHtml(subParts.join(' · '))}</span>
        </span>
        ${isSelected ? '<svg class="i mi-check" viewBox="0 0 24 24" style="width:16px;height:16px;color:var(--purple);margin-left:auto"><path d="M5 12l5 5 9-10"/></svg>' : ''}
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectModel(m.name, true);
        this.close();
        if (this.pillBtn) this.pillBtn.focus();
      });

      this.listContainer.appendChild(item);
    });
  }
}

export class ParametersController {
  constructor(container) {
    this.container = container;
    this.toggleBtn = container.querySelector('#btn-params-toggle');
    this.popover = container.querySelector('#params-popover');
    this.closeBtn = container.querySelector('#btn-close-params');
    this.presetSelect = container.querySelector('#param-preset-select');
    this.saveBtn = container.querySelector('#btn-save-custom-preset');
    this.deleteBtn = container.querySelector('#btn-delete-custom-preset');
    this.systemPromptEl = container.querySelector('#param-system-prompt');
    this.charCountEl = container.querySelector('#param-char-count');
    this.tempSlider = container.querySelector('#param-temperature');
    this.tempVal = container.querySelector('#param-temp-val');
    this.toppSlider = container.querySelector('#param-topp');
    this.toppVal = container.querySelector('#param-topp-val');
    this.numCtxSelect = container.querySelector('#param-num-ctx');
    this.shortcutBtns = container.querySelectorAll('.btn-chip[data-style]');
    this.activeBadge = container.querySelector('#params-active-badge');
    this.labelEl = container.querySelector('#params-label');

    this.presets = [];
    this.currentPresetId = null;

    this.init();
  }

  async init() {
    this.setupListeners();
    await this.loadPresets();

    store.on('session:active-changed', (session) => {
      this.syncFromSession(session);
    });

    store.on('session:updated', (session) => {
      if (session && session.id === store.activeSessionId) {
        this.syncFromSession(session);
      }
    });

    const currentSession = store.getActiveSession();
    if (currentSession) {
      this.syncFromSession(currentSession);
    }
  }

  async loadPresets() {
    if (!this.presetSelect) return;
    this.presets = await presetsService.getAllPresets();

    const builtIns = this.presets.filter((p) => p.isBuiltIn);
    const customs = this.presets.filter((p) => !p.isBuiltIn);

    const parts = [];
    parts.push('<optgroup label="Built-in Presets">');
    for (const p of builtIns) {
      parts.push(`<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`);
    }
    parts.push('</optgroup>');

    if (customs.length > 0) {
      parts.push('<optgroup label="Custom Presets">');
      for (const p of customs) {
        parts.push(`<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`);
      }
      parts.push('</optgroup>');
    }

    parts.push('<option value="__custom__">— Custom Instructions —</option>');
    this.presetSelect.innerHTML = parts.join('');
  }

  setupListeners() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }

    document.addEventListener('click', (e) => {
      if (this.popover && !this.popover.hidden) {
        if (!this.popover.contains(e.target) && !this.toggleBtn.contains(e.target)) {
          this.close();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.popover && !this.popover.hidden) {
        e.preventDefault();
        this.close();
        if (this.toggleBtn) this.toggleBtn.focus();
      }
    });

    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', async () => {
        const selectedId = this.presetSelect.value;
        if (selectedId === '__custom__') {
          this.currentPresetId = null;
          if (this.deleteBtn) this.deleteBtn.style.display = 'none';
          const session = store.getActiveSession();
          if (session) {
            store.updateSession(session.id, { presetId: null });
          }
          this.updateActiveBadge();
          return;
        }

        const preset = this.presets.find((p) => p.id === selectedId);
        if (preset) {
          this.applyPreset(preset);
        }
      });
    }

    if (this.systemPromptEl) {
      this.systemPromptEl.addEventListener('input', () => {
        this.updateCharCount();
        const session = store.getActiveSession();
        if (session) {
          store.updateSession(session.id, { systemPrompt: this.systemPromptEl.value });
        }
        this.updateActiveBadge();
      });
    }

    if (this.tempSlider) {
      this.tempSlider.addEventListener('input', () => {
        const val = parseFloat(this.tempSlider.value);
        if (this.tempVal) this.tempVal.textContent = val.toFixed(2);
        this.updateActiveBadge();
        this.syncShortcutHighlight();
        const session = store.getActiveSession();
        if (session) {
          store.updateSession(session.id, { temperature: val });
        }
      });
    }

    if (this.toppSlider) {
      this.toppSlider.addEventListener('input', () => {
        const val = parseFloat(this.toppSlider.value);
        if (this.toppVal) this.toppVal.textContent = val.toFixed(2);
        this.syncShortcutHighlight();
        const session = store.getActiveSession();
        if (session) {
          store.updateSession(session.id, { topP: val });
        }
      });
    }

    if (this.numCtxSelect) {
      this.numCtxSelect.addEventListener('change', () => {
        const val = this.numCtxSelect.value ? parseInt(this.numCtxSelect.value, 10) : null;
        const session = store.getActiveSession();
        if (session) {
          store.updateSession(session.id, { numCtx: val });
        }
      });
    }

    this.shortcutBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-style');
        if (style === 'deterministic') {
          this.setSampling(0.2, 0.8);
        } else if (style === 'balanced') {
          this.setSampling(0.7, 0.9);
        } else if (style === 'creative') {
          this.setSampling(1.2, 0.95);
        }
      });
    });

    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', async () => {
        const defaultName = (this.systemPromptEl?.value || '').trim().slice(0, 24) || 'Custom Persona';
        const title = window.prompt('Enter a title for this preset:', defaultName);
        if (title && title.trim()) {
          try {
            const saved = await presetsService.saveCustomPreset({
              title: title.trim(),
              systemPrompt: this.systemPromptEl.value.trim() || 'You are a helpful assistant.',
              defaultTemperature: parseFloat(this.tempSlider.value),
              defaultTopP: parseFloat(this.toppSlider.value),
              defaultNumCtx: this.numCtxSelect.value ? parseInt(this.numCtxSelect.value, 10) : null
            });
            await this.loadPresets();
            this.applyPreset(saved);
            showToast(`Preset "${saved.title}" saved`);
          } catch (err) {
            showToast(err.message || 'Failed to save preset');
          }
        }
      });
    }

    if (this.deleteBtn) {
      this.deleteBtn.addEventListener('click', async () => {
        if (!this.currentPresetId) return;
        const preset = this.presets.find((p) => p.id === this.currentPresetId);
        if (!preset || preset.isBuiltIn) return;

        if (window.confirm(`Delete preset "${preset.title}"?`)) {
          try {
            await presetsService.deleteCustomPreset(preset.id);
            await this.loadPresets();
            const fallback = this.presets[0];
            if (fallback) {
              this.applyPreset(fallback);
            }
            showToast('Preset deleted');
          } catch (err) {
            showToast(err.message || 'Failed to delete preset');
          }
        }
      });
    }
  }

  setSampling(temperature, topP) {
    if (this.tempSlider) {
      this.tempSlider.value = temperature;
      if (this.tempVal) this.tempVal.textContent = temperature.toFixed(2);
    }
    if (this.toppSlider) {
      this.toppSlider.value = topP;
      if (this.toppVal) this.toppVal.textContent = topP.toFixed(2);
    }
    this.updateActiveBadge();
    this.syncShortcutHighlight();

    const session = store.getActiveSession();
    if (session) {
      store.updateSession(session.id, { temperature, topP });
    }
  }

  applyPreset(preset) {
    this.currentPresetId = preset.id;
    if (this.presetSelect) this.presetSelect.value = preset.id;
    if (this.systemPromptEl) this.systemPromptEl.value = preset.systemPrompt || '';
    this.updateCharCount();

    if (typeof preset.defaultTemperature === 'number' && this.tempSlider) {
      this.tempSlider.value = preset.defaultTemperature;
      if (this.tempVal) this.tempVal.textContent = preset.defaultTemperature.toFixed(2);
    }
    if (typeof preset.defaultTopP === 'number' && this.toppSlider) {
      this.toppSlider.value = preset.defaultTopP;
      if (this.toppVal) this.toppVal.textContent = preset.defaultTopP.toFixed(2);
    }
    if (preset.defaultNumCtx && this.numCtxSelect) {
      this.numCtxSelect.value = String(preset.defaultNumCtx);
    }

    if (this.deleteBtn) {
      this.deleteBtn.style.display = preset.isBuiltIn ? 'none' : 'inline-block';
    }

    this.updateActiveBadge();
    this.syncShortcutHighlight();

    const session = store.getActiveSession();
    if (session) {
      store.updateSession(session.id, {
        presetId: preset.id,
        systemPrompt: preset.systemPrompt,
        temperature: typeof preset.defaultTemperature === 'number' ? preset.defaultTemperature : session.temperature,
        topP: typeof preset.defaultTopP === 'number' ? preset.defaultTopP : session.topP,
        numCtx: preset.defaultNumCtx || session.numCtx
      });
    }
  }

  syncFromSession(session) {
    if (!session) return;

    if (this.tempSlider) {
      this.tempSlider.value = typeof session.temperature === 'number' ? session.temperature : 0.7;
      if (this.tempVal) this.tempVal.textContent = Number(this.tempSlider.value).toFixed(2);
    }
    if (this.toppSlider) {
      this.toppSlider.value = typeof session.topP === 'number' ? session.topP : 0.9;
      if (this.toppVal) this.toppVal.textContent = Number(this.toppSlider.value).toFixed(2);
    }
    if (this.numCtxSelect) {
      this.numCtxSelect.value = session.numCtx ? String(session.numCtx) : '';
    }
    if (this.systemPromptEl) {
      this.systemPromptEl.value = session.systemPrompt || '';
      this.updateCharCount();
    }

    if (session.presetId) {
      this.currentPresetId = session.presetId;
      if (this.presetSelect) this.presetSelect.value = session.presetId;
      const preset = this.presets.find((p) => p.id === session.presetId);
      if (this.deleteBtn) {
        this.deleteBtn.style.display = (preset && !preset.isBuiltIn) ? 'inline-block' : 'none';
      }
    } else {
      this.currentPresetId = null;
      if (this.presetSelect) this.presetSelect.value = session.systemPrompt ? '__custom__' : (this.presets[0]?.id || '');
      if (this.deleteBtn) this.deleteBtn.style.display = 'none';
    }

    this.updateActiveBadge();
    this.syncShortcutHighlight();
  }

  updateCharCount() {
    if (!this.charCountEl || !this.systemPromptEl) return;
    const len = this.systemPromptEl.value.length;
    this.charCountEl.textContent = `${len.toLocaleString()} / 10,000`;
  }

  updateActiveBadge() {
    if (this.activeBadge && this.tempSlider) {
      this.activeBadge.textContent = parseFloat(this.tempSlider.value).toFixed(1);
    }
    if (this.labelEl) {
      if (this.currentPresetId) {
        const preset = this.presets.find((p) => p.id === this.currentPresetId);
        this.labelEl.textContent = preset ? preset.title : 'Preset';
      } else if (this.systemPromptEl && this.systemPromptEl.value.trim()) {
        this.labelEl.textContent = 'Custom';
      } else {
        this.labelEl.textContent = 'Preset';
      }
    }
  }

  syncShortcutHighlight() {
    if (!this.tempSlider || !this.toppSlider) return;
    const temp = parseFloat(this.tempSlider.value);
    const topp = parseFloat(this.toppSlider.value);

    this.shortcutBtns.forEach((btn) => {
      const style = btn.getAttribute('data-style');
      let active = false;
      if (style === 'deterministic' && Math.abs(temp - 0.2) < 0.05 && Math.abs(topp - 0.8) < 0.05) {
        active = true;
      } else if (style === 'balanced' && Math.abs(temp - 0.7) < 0.05 && Math.abs(topp - 0.9) < 0.05) {
        active = true;
      } else if (style === 'creative' && Math.abs(temp - 1.2) < 0.05 && Math.abs(topp - 0.95) < 0.05) {
        active = true;
      }
      btn.classList.toggle('active', active);
    });
  }

  toggle() {
    if (this.popover) {
      if (this.popover.hidden) {
        this.open();
      } else {
        this.close();
      }
    }
  }

  open() {
    if (this.popover) {
      this.popover.hidden = false;
      if (this.toggleBtn) this.toggleBtn.setAttribute('aria-expanded', 'true');
    }
  }

  close() {
    if (this.popover) {
      this.popover.hidden = true;
      if (this.toggleBtn) this.toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }
}

export class Composer {
  constructor(container) {
    this.container = container;
    this.textarea = container.querySelector('.composer-textarea');
    this.sendBtn = container.querySelector('.btn-send');
    this.thinkBtn = container.querySelector('.pill-think');
    this.attachBtn = container.querySelector('.btn-attach');
    this.toolsBtn = container.querySelector('.pill-tools');
    this.micBtn = container.querySelector('.mic');
    this.dropOverlay = container.querySelector('.drop-overlay');

    this.modelPicker = new ModelPicker(container);
    this.parametersController = new ParametersController(container);

    this.thinkingEnabled = true;
    this.isGenerating = false;
    this.activeAssistantMsgId = null;
    this.abortController = null;

    this.init();
  }

  init() {
    this.bindRegistryControls();
    this.setupAutoGrow();
    this.setupKeyboardEvents();
    this.setupActions();
    this.setupDragAndDrop();
    this.updateSendButtonState();

    // Listen to external events
    window.addEventListener('storage:warning', (e) => {
      const msg = (e.detail && e.detail.message) ? e.detail.message : 'Storage limit reached';
      showToast(msg, 5000);
    });

    store.on('composer:set-prompt', ({ prompt }) => {
      this.setPrompt(prompt);
    });

    store.on('composer:regenerate', ({ prompt }) => {
      this.sendPrompt(prompt);
    });

    store.on('composer:retry', ({ prompt, failedMessageId }) => {
      const session = store.getActiveSession();
      if (session && failedMessageId) {
        store.deleteMessage(session.id, failedMessageId);
      }
      this.sendPrompt(prompt, true);
    });
  }

  bindRegistryControls() {
    if (this.attachBtn) {
      bindFeatureControl(this.attachBtn, 'chat.attach_file');
    }
    if (this.toolsBtn) {
      bindFeatureControl(this.toolsBtn, 'chat.tools_menu');
    }
    if (this.micBtn) {
      bindFeatureControl(this.micBtn, 'chat.mic_input');
    }
  }

  setupAutoGrow() {
    if (!this.textarea) return;

    const adjustHeight = () => {
      this.textarea.style.height = 'auto';
      const scrollHeight = this.textarea.scrollHeight;
      const maxHeight = 220; // ~9 lines
      this.textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      this.textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
      this.updateSendButtonState();
    };

    this.textarea.addEventListener('input', adjustHeight);
  }

  setupKeyboardEvents() {
    if (!this.textarea) return;

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.isGenerating) {
          this.submit();
        }
      } else if (e.key === 'Escape' && this.isGenerating) {
        e.preventDefault();
        this.stopGeneration();
      }
    });
  }

  setupActions() {
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => {
        if (this.isGenerating) {
          this.stopGeneration();
        } else {
          this.submit();
        }
      });
    }

    if (this.thinkBtn) {
      this.thinkBtn.addEventListener('click', () => {
        this.thinkingEnabled = !this.thinkingEnabled;
        this.thinkBtn.classList.toggle('on', this.thinkingEnabled);
        this.thinkBtn.setAttribute('aria-pressed', String(this.thinkingEnabled));
      });
    }
  }

  setupDragAndDrop() {
    if (!this.dropOverlay) return;

    const dragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropOverlay.style.display = 'flex';
    };

    const dragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.container.contains(e.relatedTarget)) {
        this.dropOverlay.style.display = 'none';
      }
    };

    const drop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropOverlay.style.display = 'none';
    };

    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('dragenter', dragEnter);
    this.container.addEventListener('dragleave', dragLeave);
    this.container.addEventListener('drop', drop);
  }

  setPrompt(text) {
    if (!this.textarea) return;
    this.textarea.value = text;
    this.textarea.dispatchEvent(new Event('input'));
    this.textarea.focus();
  }

  submit() {
    if (!this.textarea) return;
    const prompt = this.textarea.value.trim();
    if (!prompt) return;

    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    this.updateSendButtonState();
    this.sendPrompt(prompt);
  }

  async sendPrompt(promptText, isRetry = false) {
    if (this.isGenerating) return;

    const session = store.getActiveSession();
    if (!session) return;

    const modelToUse = session.model || store.defaultModel || (typeof localStorage !== 'undefined' ? localStorage.getItem('ewebui_last_model') : '') || '';

    if (!modelToUse) {
      showToast('No model selected. Please check that Ollama is running and has models available.');
      if (this.textarea && !this.textarea.value) {
        this.textarea.value = promptText;
        this.updateSendButtonState();
      }
      return;
    }

    let history = [];
    if (isRetry) {
      const fullHist = store.getHistory(session.id);
      history = fullHist.slice(0, -1);
    } else {
      history = store.getHistory(session.id);
      store.appendMessage(session.id, 'user', promptText);
    }

    // Prepare assistant message
    const assistantMsg = store.appendMessage(session.id, 'assistant', '', null, 'streaming');

    this.isGenerating = true;
    this.activeAssistantMsgId = assistantMsg.id;
    this.updateSendButtonState();
    this.abortController = new AbortController();

    const startTime = performance.now();
    let accumulatedContent = '';
    let accumulatedThinking = '';

    try {
      const systemPrompt = session.systemPrompt || null;
      const temperature = typeof session.temperature === 'number' ? session.temperature : 0.7;
      const topP = typeof session.topP === 'number' ? session.topP : 0.9;
      const numCtx = typeof session.numCtx === 'number' ? session.numCtx : undefined;

      await api.streamGenerate(
        {
          model: modelToUse,
          prompt: promptText,
          history,
          system: systemPrompt,
          temperature,
          top_p: topP,
          num_ctx: numCtx,
          stream: true,
          thinking: this.thinkingEnabled
        },
        {
          signal: this.abortController.signal,
          onToken: (token, liveMetrics) => {
            accumulatedContent += token;
            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent,
              status: 'streaming',
              liveMetrics
            });
          },
          onThinking: (chunk, liveMetrics) => {
            accumulatedThinking += chunk;
            store.updateMessage(session.id, assistantMsg.id, {
              reasoning: accumulatedThinking,
              status: 'streaming',
              liveMetrics
            });
          },
          onDone: (metrics) => {
            const durationSec = metrics?.durationSeconds ?? parseFloat(((performance.now() - startTime) / 1000).toFixed(1));
            const tps = metrics?.tokensPerSecond ?? null;

            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent,
              reasoning: accumulatedThinking || null,
              status: 'completed',
              liveMetrics: null,
              metrics: {
                model: modelToUse,
                durationSeconds: durationSec,
                tokensPerSecond: tps,
                timeToFirstTokenMs: metrics?.timeToFirstTokenMs ?? null,
                evalCount: metrics?.eval_count ?? null,
                evalDurationMs: metrics?.eval_duration ? Math.round(metrics.eval_duration / 1e6) : null,
                promptEvalCount: metrics?.prompt_eval_count ?? null,
                promptEvalDurationMs: metrics?.prompt_eval_duration ? Math.round(metrics.prompt_eval_duration / 1e6) : null,
                promptEvalTokensPerSecond: metrics?.prompt_eval_speed ?? null,
                loadDurationMs: metrics?.load_duration ? Math.round(metrics.load_duration / 1e6) : null
              }
            });
          },
          onError: (err) => {
            console.error('Generation error:', err);
            store.updateMessage(session.id, assistantMsg.id, {
              content: accumulatedContent,
              reasoning: accumulatedThinking || null,
              error: err.message,
              errorStatus: err.status || 500,
              status: 'error'
            });
          }
        }
      );
    } catch (err) {
      console.error('Unhandled streaming error:', err);
      store.updateMessage(session.id, assistantMsg.id, {
        content: accumulatedContent,
        reasoning: accumulatedThinking || null,
        error: err.message || 'Stream connection failed',
        errorStatus: err.status || 500,
        status: 'error'
      });
    } finally {
      this.isGenerating = false;
      this.abortController = null;
      this.activeAssistantMsgId = null;
      this.updateSendButtonState();
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
    const session = store.getActiveSession();
    if (session && this.activeAssistantMsgId) {
      const msg = session.messages.find((m) => m.id === this.activeAssistantMsgId);
      if (msg && msg.status === 'streaming') {
        store.updateMessage(session.id, msg.id, { status: 'stopped' });
      }
    }
    this.isGenerating = false;
    this.updateSendButtonState();
  }

  updateSendButtonState() {
    if (!this.sendBtn) return;
    if (this.isGenerating) {
      this.sendBtn.disabled = false;
      this.sendBtn.classList.add('btn-stop');
      this.sendBtn.title = 'Stop generation';
      this.sendBtn.setAttribute('aria-label', 'Stop generation');
      this.sendBtn.innerHTML = '<svg class="i" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
      this.sendBtn.removeAttribute('aria-disabled');
    } else {
      this.sendBtn.classList.remove('btn-stop');
      this.sendBtn.title = 'Send (Enter)';
      this.sendBtn.setAttribute('aria-label', 'Send message (Enter)');
      this.sendBtn.innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="M9 10l-5 5 5 5"/></svg>';
      const isEmpty = !this.textarea || this.textarea.value.trim() === '';
      this.sendBtn.disabled = isEmpty;
      if (isEmpty) {
        this.sendBtn.setAttribute('aria-disabled', 'true');
      } else {
        this.sendBtn.removeAttribute('aria-disabled');
      }
    }
  }
}
