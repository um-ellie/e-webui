# Interface Contract: Model Parameters & System Prompt Presets

**Feature**: `019-system-prompt-presets`  
**Date**: 2026-11-15  
**Version**: 1.0.0  

## 1. Backend Inference Request Schema (`POST /api/generate`)

```json
{
  "model": "qwen3.5:4b",
  "prompt": "Write a fast fibonacci in Rust",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help you today?" }
  ],
  "system": "You are an expert senior software engineer. Provide concise, production-ready code.",
  "stream": true,
  "thinking": true,
  "temperature": 0.2,
  "top_p": 0.8,
  "num_ctx": 8192
}
```

### Constraints & Types
- `system`: `string | null` (optional, max length 100,000 chars)
- `temperature`: `float` (range: `0.0` to `2.0`, default `0.7`)
- `top_p`: `float | null` (optional, range: `0.0` to `1.0`, default `0.9`)
- `num_ctx`: `integer | null` (optional, range: `512` to `131072`, default `null`)

---

## 2. Feature Registry Contract Update (`app/static/js/features.js`)

Transition previously disabled controls to `enabled`:

```javascript
// Model settings
'model.temperature_tune': {
  status: 'enabled',
  description: 'Adjust inference temperature, top-p, and context window'
},
'model.system_prompt': {
  status: 'enabled',
  description: 'Configure active persona and system instruction presets'
}
```

---

## 3. Presets Service Contract (`app/static/js/presets.js`)

```javascript
export interface PresetsService {
  // Built-in immutable presets
  getBuiltInPresets(): SystemPromptPreset[];

  // Retrieve all presets (built-in + saved custom)
  getAllPresets(): Promise<SystemPromptPreset[]>;

  // Save or update custom preset
  saveCustomPreset(preset: Omit<SystemPromptPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<SystemPromptPreset>;

  // Delete custom preset by ID
  deleteCustomPreset(id: string): Promise<boolean>;

  // Export all custom presets
  exportCustomPresets(): Promise<string>;

  // Import custom presets
  importCustomPresets(jsonString: string): Promise<number>;
}
```

---

## 4. Conversation Export Contract (`export.js`)

### Markdown Format
```markdown
---
title: Rust Optimization
model: qwen3.5:4b
preset: Coding Specialist
temperature: 0.2
top_p: 0.8
context_window: 8192
date: 2026-11-15 00:50:00
---

> **System**: You are an expert senior software engineer...

### User
Write a fast fibonacci in Rust

### Assistant
...
```

### JSON Format
```json
{
  "id": "conv-uuid",
  "title": "Rust Optimization",
  "model": "qwen3.5:4b",
  "parameters": {
    "presetId": "builtin-coding-specialist",
    "presetTitle": "Coding Specialist",
    "systemPrompt": "You are an expert senior software engineer...",
    "temperature": 0.2,
    "topP": 0.8,
    "numCtx": 8192
  },
  "messages": [...]
}
```
