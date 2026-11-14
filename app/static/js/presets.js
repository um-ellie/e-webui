/**
 * System Prompt Presets & Sampling Parameter Registry
 * Contract: specs/019-system-prompt-presets/contracts/parameters-contract.md
 */

import { storageService } from './storage.js';

/**
 * @typedef {Object} SystemPromptPreset
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} systemPrompt
 * @property {boolean} isBuiltIn
 * @property {number} [defaultTemperature]
 * @property {number} [defaultTopP]
 * @property {number} [defaultNumCtx]
 * @property {number} createdAt
 * @property {number} updatedAt
 */

export const BUILT_IN_PRESETS = Object.freeze([
  {
    id: 'builtin-helpful-assistant',
    title: 'Helpful Assistant',
    description: 'Balanced, respectful, and structured answers for general inquiries.',
    systemPrompt: 'You are a helpful, respectful, and thoughtful AI assistant. Provide accurate, clear, and structured answers.',
    isBuiltIn: true,
    defaultTemperature: 0.7,
    defaultTopP: 0.9,
    defaultNumCtx: 4096,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  },
  {
    id: 'builtin-coding-specialist',
    title: 'Coding Specialist',
    description: 'Concise, production-ready, clean, and idiomatic code without filler.',
    systemPrompt: 'You are an expert senior software engineer. Provide concise, production-ready, clean, and idiomatic code solutions. Avoid unprompted conversational filler. Format code cleanly with appropriate language identifiers. Include comments only where non-obvious.',
    isBuiltIn: true,
    defaultTemperature: 0.2,
    defaultTopP: 0.8,
    defaultNumCtx: 8192,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  },
  {
    id: 'builtin-concise-editor',
    title: 'Concise Editor',
    description: 'Terse, bulleted summaries with maximum density and zero preamble.',
    systemPrompt: 'You are a terse and direct editor. Answer in the fewest words possible. Use bullet points and bold highlights. Never repeat the question or offer polite preamble.',
    isBuiltIn: true,
    defaultTemperature: 0.3,
    defaultTopP: 0.8,
    defaultNumCtx: 4096,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  },
  {
    id: 'builtin-academic-explainer',
    title: 'Academic Explainer',
    description: 'Deep first-principles explanations, formal definitions, and rigorous logic.',
    systemPrompt: 'You are a rigorous academic scholar. Explain concepts deeply from first principles, providing historical context, formal definitions, and balanced trade-offs. Cite logical proofs and mathematical relationships where appropriate.',
    isBuiltIn: true,
    defaultTemperature: 0.6,
    defaultTopP: 0.9,
    defaultNumCtx: 8192,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  }
]);

export class PresetsService {
  /**
   * Returns immutable built-in presets
   * @returns {SystemPromptPreset[]}
   */
  getBuiltInPresets() {
    return BUILT_IN_PRESETS;
  }

  /**
   * Retrieves all available presets (built-in + saved custom)
   * @returns {Promise<SystemPromptPreset[]>}
   */
  async getAllPresets() {
    try {
      const customPresets = await storageService.loadCustomPresets();
      return [...BUILT_IN_PRESETS, ...(customPresets || [])];
    } catch (err) {
      console.warn('Failed to load custom presets from storage, returning built-ins only:', err);
      return [...BUILT_IN_PRESETS];
    }
  }

  /**
   * Finds a preset by ID
   * @param {string} id
   * @returns {Promise<SystemPromptPreset|null>}
   */
  async getPresetById(id) {
    if (!id) return null;
    const builtIn = BUILT_IN_PRESETS.find((p) => p.id === id);
    if (builtIn) return builtIn;

    const all = await this.getAllPresets();
    return all.find((p) => p.id === id) || null;
  }

  /**
   * Saves or updates a custom user preset
   * @param {Partial<SystemPromptPreset> & { title: string, systemPrompt: string }} data
   * @returns {Promise<SystemPromptPreset>}
   */
  async saveCustomPreset(data) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Preset title is required');
    }
    if (!data.systemPrompt || !data.systemPrompt.trim()) {
      throw new Error('System prompt instruction text is required');
    }

    const now = Date.now();
    const id = data.id || `custom-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)}`;

    // Ensure user cannot overwrite a built-in ID
    if (BUILT_IN_PRESETS.some((p) => p.id === id)) {
      throw new Error('Cannot overwrite a built-in preset');
    }

    /** @type {SystemPromptPreset} */
    const preset = {
      id,
      title: data.title.trim().slice(0, 60),
      description: (data.description || '').trim().slice(0, 200),
      systemPrompt: data.systemPrompt.trim().slice(0, 10000),
      isBuiltIn: false,
      defaultTemperature: typeof data.defaultTemperature === 'number' ? Math.min(Math.max(data.defaultTemperature, 0.0), 2.0) : 0.7,
      defaultTopP: typeof data.defaultTopP === 'number' ? Math.min(Math.max(data.defaultTopP, 0.0), 1.0) : 0.9,
      defaultNumCtx: typeof data.defaultNumCtx === 'number' ? Math.min(Math.max(data.defaultNumCtx, 512), 131072) : null,
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    await storageService.saveCustomPreset(preset);
    return preset;
  }

  /**
   * Deletes a custom user preset
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteCustomPreset(id) {
    if (BUILT_IN_PRESETS.some((p) => p.id === id)) {
      throw new Error('Cannot delete a built-in immutable preset');
    }
    return await storageService.deleteCustomPreset(id);
  }
}

export const presetsService = new PresetsService();
