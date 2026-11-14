# Phase 0 Research: System Prompt Presets & Model Parameter Controls

**Feature**: `019-system-prompt-presets`  
**Date**: 2026-11-15  
**Status**: Completed  

## 1. Built-in System Prompt Presets & Schema

### Decision
Define a curated set of 4 built-in system prompt personas along with an extensible schema for user-created presets:
1. **Helpful Assistant (Default)**:
   - *Prompt*: "You are a helpful, respectful, and thoughtful AI assistant. Provide accurate, clear, and structured answers."
   - *Default Temperature*: `0.7` | *Default Top-P*: `0.9` | *Context Window*: `4096`
2. **Coding Specialist**:
   - *Prompt*: "You are an expert senior software engineer. Provide concise, production-ready, clean, and idiomatic code solutions. Avoid unprompted conversational filler. Format code cleanly with appropriate language identifiers. Include comments only where non-obvious."
   - *Default Temperature*: `0.2` | *Default Top-P*: `0.8` | *Context Window*: `8192`
3. **Concise Editor**:
   - *Prompt*: "You are a terse and direct editor. Answer in the fewest words possible. Use bullet points and bold highlights. Never repeat the question or offer polite preamble."
   - *Default Temperature*: `0.3` | *Default Top-P*: `0.8` | *Context Window*: `4096`
4. **Academic Explainer**:
   - *Prompt*: "You are a rigorous academic scholar. Explain concepts deeply from first principles, providing historical context, formal definitions, and balanced trade-offs. Cite logical proofs and mathematical relationships where appropriate."
   - *Default Temperature*: `0.6` | *Default Top-P*: `0.9` | *Context Window*: `8192`

### Schema Structure
```typescript
interface SystemPromptPreset {
  id: string;               // e.g. "builtin-coding-specialist" or UUID for custom
  title: string;            // Display title, e.g. "Coding Specialist"
  description: string;      // Short summary of behavior
  systemPrompt: string;     // The exact prompt injected into Ollama
  isBuiltIn: boolean;       // Immutable if true; user can edit/delete if false
  defaultTemperature?: number; // Recommended temperature (0.0 - 2.0)
  defaultTopP?: number;        // Recommended top_p (0.0 - 1.0)
  defaultNumCtx?: number;      // Recommended context window
  createdAt: number;        // Timestamp
  updatedAt: number;        // Timestamp
}
```

### Rationale
Built-in presets provide immediate value for common local LLM use cases (especially code generation and concise summaries) without requiring manual prompt drafting. Marking built-ins with `isBuiltIn: true` protects them from accidental deletion while allowing users to clone them into customizable variants.

---

## 2. Parameter Constraints & Ollama API Mapping

### Decision
Map frontend sampling parameters to Ollama `/api/generate` options:
- **Temperature** (`temperature`): Float from `0.0` to `2.0`, step `0.05`, default `0.7`. Ollama default is typically 0.8; 0.7 offers balanced coherence for general models.
- **Top-P** (`top_p`): Float from `0.0` to `1.0`, step `0.05`, default `0.9`. Nucleus sampling boundary.
- **Context Window** (`num_ctx`): Integer token limit (`2048`, `4096`, `8192`, `16384`, `32768`, or `null` for model native).
- **Backend Model (`app/models.py`)**:
  - Extend `PromptRequest` with `top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0)`
  - Extend `PromptRequest` with `num_ctx: Optional[int] = Field(default=None, ge=512, le=131072)`
- **Proxy Translation (`app/services/ollama_client.py`)**:
  - Pass `options: {"temperature": req.temperature, "top_p": req.top_p}` into Ollama POST payload.
  - If `req.num_ctx` is specified, add `"num_ctx": req.num_ctx` to `options`.
  - Pass `system: req.system` at root of payload if non-empty.

### Rationale
Ollama's `/api/generate` natively accepts `"system"` and an `"options"` dictionary containing `"temperature"`, `"top_p"`, and `"num_ctx"`. Adding these fields to `PromptRequest` with standard Pydantic range validation preserves backwards compatibility while giving full control to the frontend.

---

## 3. Offline Persistence Strategy

### Decision
Store custom user presets in the existing client storage cascade:
1. **Primary**: IndexedDB `preferences` store (already initialized in `db.js` under key `'custom_presets'`).
2. **Fallback**: `localStorage` under key `'ewebui_custom_presets_v1'`.
3. **Session Binding**: Each conversation session object in `store.js` and IndexedDB `sessions` store stores:
   - `systemPrompt`: `string | null`
   - `presetId`: `string | null`
   - `temperature`: `number` (defaults to 0.7 or preset default)
   - `topP`: `number` (defaults to 0.9 or preset default)
   - `numCtx`: `number | null` (defaults to null or preset default)

### Rationale
Leveraging the existing IndexedDB `preferences` store avoids database migrations or breaking schema version changes while providing permanent, 100% offline persistence.

---

## 4. UI/UX Interaction & Controls

### Decision
Provide two complementary touchpoints:
1. **Quick Parameters Pill & Popover (Composer Toolbar)**:
   - Add a parameter tuning button (`.pill-params`) next to `pill-think` and the model selector in the composer toolbar:
     `[ ⚙️ 0.7 · Coding ]`
   - Clicking opens an accessible popover containing:
     - Preset selector dropdown (Built-in + Custom presets)
     - Quick shortcut buttons:
       - **Deterministic / Code**: Temp `0.2`, Top-P `0.8`
       - **Balanced**: Temp `0.7`, Top-P `0.9`
       - **Creative**: Temp `1.2`, Top-P `0.95`
     - Temperature slider ($0.0 - 2.0$) with real-time numeric badge
     - Top-P slider ($0.0 - 1.0$) with real-time numeric badge
     - Context window selector dropdown (`Default`, `2048`, `4096`, `8192`, `16384`)
     - Expandable custom system prompt textarea
     - "Save as Preset" button to save current settings as a new custom persona
2. **Settings Modal -> Models Tab**:
   - Unlock the previously disabled `tab-models` in the Settings dialog (`app/static/index.html`).
   - Enable full global default parameter configuration and custom preset management (edit, rename, delete custom presets).
3. **Chat Header / Status Indicator**:
   - When a session has a custom system prompt or non-default preset, show a subtle persona badge in the header or composer (e.g. `<span class="persona-tag">Coding Specialist</span>`).

### Rationale
Placing quick tuning directly in the composer toolbar keeps it within the user's primary line of sight when drafting a prompt, while the Settings modal provides deep management of the preset library.

---

## 5. Export Provenance Format

### Decision
- **Markdown Export (`export.js`)**:
  Include preset and sampling parameters in the document frontmatter:
  ```yaml
  ---
  title: Python Async Streaming
  model: qwen3.5:4b
  preset: Coding Specialist
  temperature: 0.2
  top_p: 0.8
  context_window: 8192
  date: 2026-11-15 00:45
  ---
  ```
- **JSON Export (`export.js`)**:
  Include `session_parameters` block inside conversation export object:
  ```json
  "parameters": {
    "presetId": "builtin-coding-specialist",
    "presetTitle": "Coding Specialist",
    "systemPrompt": "You are an expert senior software engineer...",
    "temperature": 0.2,
    "topP": 0.8,
    "numCtx": 8192
  }
  ```

---

## Constitution Re-evaluation
- **Principle I: Infrastructure Isolation**: PASS. Zero host commands, zero container modifications.
- **Principle II: Workspace-Only Scope**: PASS. All changes in `app/`, `app/static/`, `tests/`, `specs/`.
- **Principle III: Transparent Delegation**: PASS. Unit tests use mock HTTP responses.
