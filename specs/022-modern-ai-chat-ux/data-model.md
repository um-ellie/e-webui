# Data Model: Modern AI Chat & Ollama Connection UI/UX Overhaul

**Feature**: `022-modern-ai-chat-ux`  
**Date**: 2026-11-16  
**Status**: Completed  

## Entity Definitions

### 1. `ThemeState`
Represents user theme configuration and runtime appearance tokens.

| Field | Type | Allowed Values | Default | Persistence | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mode` | `string` | `'light'`, `'dark'`, `'system'` | `'system'` | `localStorage['theme']` | Explicit user selection. |
| `effectiveTheme` | `string` | `'light'`, `'dark'` | Dynamic | Computed | Active theme applied to `document.documentElement.dataset.theme`. |
| `fontSizeScale` | `number` | `90` to `120` | `100` | `localStorage['font_scale']` | CSS interface font scaling percentage. |

**State Transitions**:
```
[User Clicks Sun/Moon/System] ──> Update mode ──> Compute effectiveTheme ──> Write dataset.theme ──> Update UI Thumb position (--i)
                                         └──> If 'system': Listen to matchMedia('prefers-color-scheme: dark')
```

---

### 2. `NormalizedHealthState`
Canonical telemetry representation ingested from `/api/health` and dispatched to UI components.

| Field | Type | Allowed Values | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `status` | `string` | `'online'`, `'degraded'`, `'offline'`, `'checking'` | `'checking'` | Health categorization. |
| `latencyMs` | `number \| null` | `>= 0` | `null` | Round-trip ping time to Ollama in ms. |
| `endpointUrl` | `string` | Valid URL | `'http://127.0.0.1:11434'` | Target Ollama instance address. |
| `loadedModels` | `string[]` | Array of strings | `[]` | List of models currently resident in VRAM. |
| `checkedAt` | `number` | Unix timestamp | `Date.now()` | Epoch ms when the last probe completed. |
| `errorMessage` | `string \| null` | String or null | `null` | Technical failure description if offline. |

**Classification Logic**:
```typescript
function classifyHealth(payload, latencyMs): 'online' | 'degraded' | 'offline' {
  if (!payload || !payload.ollama_connected) return 'offline';
  if (latencyMs !== null && latencyMs >= 500) return 'degraded';
  return 'online';
}
```

---

### 3. `ComposerState`
Tracks input text, contextual accessories, and generation status.

| Field | Type | Allowed Values | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | `string` | Max 100,000 chars | `""` | Current textarea content. |
| `isThinking` | `boolean` | `true`, `false` | `false` | When true, passes `thinking: true` to `/api/generate` and renders Think chip. |
| `activePreset` | `string \| null` | `null`, `'Precise · 0.3'`, `'Creative · 1.0'`, etc. | `null` | Active preset label; renders chip if non-default. |
| `temperature` | `number` | `0.0` - `2.0` | `0.7` | Active temperature sampling parameter. |
| `topP` | `number` | `0.0` - `1.0` | `0.9` | Active Top-P sampling parameter. |
| `selectedModel` | `string` | Valid model name | `'gemma4:latest'` | Target inference model identifier. |
| `status` | `string` | `'idle'`, `'streaming'`, `'stopping'` | `'idle'` | Controls Send/Stop button morphing. |

**Conditional Chip Visibility Matrix**:
- `Think Chip`: Visible **iff** `isThinking === true`.
- `Preset Chip`: Visible **iff` `activePreset !== null && activePreset !== 'Balanced · 0.7'`.

---

### 4. `SettingsModel`
Persistent user configuration preferences.

| Field | Type | Default | Storage Key | Task Pane |
| :--- | :--- | :--- | :--- | :--- |
| `theme` | `string` | `'system'` | `localStorage['theme']` | Pane 1 (Workspace) |
| `fontSize` | `string` | `'100'` | `localStorage['font_scale']` | Pane 1 (Workspace) |
| `defaultTemperature` | `number` | `0.7` | `localStorage['ewebui_default_temperature']` | Pane 2 (Model) |
| `defaultTopP` | `number` | `0.9` | `localStorage['ewebui_default_topp']` | Pane 2 (Model) |
| `defaultSystemPrompt`| `string` | `""` | `localStorage['ewebui_default_system_prompt']` | Pane 2 (Model) |

---

### 5. `ChatMessage` & `ChatSession` (Preserved Data Layer)
Existing IndexedDB schema remains strictly untouched:
- `ChatMessage`: `{ id, role, content, reasoning, metrics, status, createdAt }`
- `ChatSession`: `{ id, title, model, createdAt, updatedAt, temperature, topP, systemPrompt }`
