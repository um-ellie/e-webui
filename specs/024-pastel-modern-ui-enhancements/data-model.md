# Phase 1 Data Model: Pastel Design System and Modern UI/UX

**Feature**: `specs/024-pastel-modern-ui-enhancements`
**Date**: 2026-11-20

## Entities & Interfaces

### 1. PastelPalette
Represents a predefined pastel color palette configuration.

```typescript
type PastelPaletteId = 'matcha' | 'lavender' | 'peach' | 'ocean';
type ThemeMode = 'light' | 'dark' | 'system';

interface PastelPaletteDefinition {
  id: PastelPaletteId;
  name: string;           // Display name (e.g. "Matcha & Sand", "Lavender Breeze")
  nameFa: string;         // Persian name (e.g. "ماتچا و ماسه گرم", "اسطوخودوس و مه")
  light: PaletteTokens;
  dark: PaletteTokens;
}

interface PaletteTokens {
  bg: string;             // Main page background
  panel: string;          // Cards, dialogs, composer surface
  side: string;           // Sidebar surface
  line: string;           // Subtle border color
  tx: string;             // Primary text color (high contrast)
  mu: string;             // Muted/secondary text color
  accent: string;         // Primary pastel accent
  accentDark: string;     // Deep variant for text/buttons
  tint: string;           // Ultra-soft tinted background (10-15% opacity)
  peach: string;          // Complementary pastel tone
  rose: string;           // Fine detail / badge accent
  glow: string;           // Diffuse rgba ambient shadow color
}
```

### 2. PromptStarter
Represents a clickable suggestion card rendered on the empty canvas.

```typescript
interface PromptStarter {
  id: string;             // Unique identifier e.g. "summarize"
  category: string;       // e.g. "تحلیل و خلاصه", "کدنویسی"
  title: string;          // Card heading e.g. "خلاصه‌سازی متن"
  description: string;    // Brief hint e.g. "استخراج نکات کلیدی و چکیده"
  icon: string;           // SVG symbol ID e.g. "clip", "tool", "bulb", "pen"
  prompt: string;         // Text injected into composer upon click
  tagColor: string;       // Pastel badge color class
}
```

### 3. MessageActionDockState
Represents the transient UI and interaction state for message action buttons.

```typescript
interface MessageActionDockState {
  messageId: string;
  isCopied: boolean;      // Temporarily true when copy animation runs (1.8s)
  isTtsPlaying: boolean;  // True when audio synthesis/playback is streaming
  isExpandedThought: boolean; // Reasoning drawer toggle state
}
```

### 4. ChatSession Metadata Extension (IndexedDB)
Extension of the existing chat session stored in IndexedDB (`ewebui_chats`).

```typescript
interface ChatSession {
  id: string;             // UUID or timestamp-based key
  title: string;          // Conversation title
  model: string;          // Selected Ollama model
  createdAt: number;      // Epoch ms
  updatedAt: number;      // Epoch ms
  pinned?: boolean;       // NEW: true if pinned to top of sidebar
  messages: Array<ChatMessage>;
}
```

## State Transitions

### Theme & Palette State Transitions
```
User Selection / OS Trigger
       │
       ▼
ThemeManager.setPalette(paletteId) / setTheme(mode)
       │
       ├─► Update document.documentElement.dataset.palette = paletteId
       ├─► Update document.documentElement.dataset.theme = effectiveMode ("light" | "dark")
       ├─► Persist to localStorage ('ewebui_palette', 'ewebui_theme')
       ├─► Update <meta name="theme-color"> with active palette --bg
       └─► Notify active subscribers / update segmented controls
```

### Session Pinning State Transitions
```
Unpinned Session  ──(Click "Pin Chat")──►  pinned: true  ──► Render in "سنجاق‌شده‌ها" top group
       ▲                                         │
       └──────────(Click "Unpin Chat")───────────┘
```
