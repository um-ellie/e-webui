# Data Model: Pastel Design System and UI/UX Overhaul

**Feature**: `021-pastel-ui-overhaul`  
**Status**: Draft  
**Date**: 2026-11-15  

## 1. Theme Configuration & Design Tokens

### Entity: `ThemeTokens`
Represents the CSS Custom Properties applied to `:root` based on the active color theme (`light`, `dark`, or system preference).

| Token | Dark Mode Value | Light Mode Value | Description |
| :--- | :--- | :--- | :--- |
| `--bg` | `#14121E` | `#FAF8F5` | Main application canvas surface |
| `--side` | `#181524` | `#F3EFEA` | Navigation sidebar background |
| `--card` | `#201C31` | `#FFFFFF` | Message bubble (assistant) and elevated dialogs |
| `--user` | `#2A233F` | `#F0EAE1` | User message bubble surface |
| `--active` | `#2B2542` | `#EFE9E2` | Selected session, hover background |
| `--line` | `#342D4E` | `#E5DDD4` | Card outlines, dividers, subtle borders |
| `--ink` | `#F2EFF9` | `#282333` | Primary body typography (WCAG AA compliant) |
| `--mute` | `#ADA5C3` | `#6D667D` | Secondary labels, timestamps, placeholders |
| `--codebg` | `#191627` | `#F4EFEA` | Code block body surface |
| `--codehead`| `#231F35` | `#ECE5DD` | Code block header chrome surface |
| `--pastel-lavender` | `#C4B5FD` | `#7C5CBF` | Primary interactive accents & active states |
| `--pastel-mint` | `#86EFAC` | `#15803D` | Success badges, online indicators, copy check |
| `--pastel-peach` | `#FDBA74` | `#C2410C` | Warning notes, parameter indicators |
| `--pastel-periwinkle` | `#93C5FD` | `#2563EB` | Model tag badges and auxiliary pills |
| `--danger` | `#F87171` | `#DC2626` | Destructive action confirmation |

---

## 2. User Settings State

### Entity: `UserSettings`
Persisted client configuration stored across browser sessions in local storage.

| Field | Type | Default | Validation / Domain | Description |
| :--- | :--- | :--- | :--- | :--- |
| `theme` | `string` | `'system'` | `'system' \| 'light' \| 'dark'` | Global visual theme preference |
| `fontSize` | `string` | `'medium'` | `'small' \| 'medium' \| 'large'` | UI font scale (13.5px, 15px, 16.5px) |
| `defaultTemperature` | `number` | `0.7` | `0.0 <= val <= 2.0` | Default inference randomness |
| `defaultTopP` | `number` | `0.9` | `0.0 <= val <= 1.0` | Default nucleus sampling threshold |
| `defaultSystemPrompt`| `string` | `""` | `maxLength: 4000` | Default system instructions for new chats |

> **Explicit Removal**: The obsolete `language` property (`'en' | 'fa'`) is removed from `UserSettings`. Interface chrome defaults strictly to standard UI text while message bubbles detect script direction dynamically.

---

## 3. Message Presentation State

### Entity: `MessagePresentation`
Runtime state governing the visual rendering of each conversational turn in the chat view.

| Field | Type | Values | Description |
| :--- | :--- | :--- | :--- |
| `direction` | `string` | `'ltr' \| 'rtl'` | Automatically detected based on first strong unicode character in text |
| `fontClass` | `string` | `'' \| 'font-fa'` | Applied when Persian/Arabic script is detected |
| `thoughtState` | `string` | `'collapsed' \| 'expanded'` | Accordion expansion state for `<think>` reasoning block |
| `thoughtDuration` | `string` | e.g. `'2s'`, `''` | Computed streaming or recorded thinking duration |
| `copyState` | `string` | `'idle' \| 'copied'` | State of code block copy button (resets after 2000ms) |

---

## 4. Popover Geometry State

### Entity: `PopoverPosition`
State controlling the responsive boundary constraints for the Model Picker and Parameters Popovers.

| Field | Type | Values | Description |
| :--- | :--- | :--- | :--- |
| `isOpen` | `boolean` | `true \| false` | Visibility of popover |
| `maxWidth` | `string` | `calc(100vw - 32px)` | Maximum allowable width to prevent edge clipping |
| `placement` | `string` | `'bottom-right' \| 'bottom-center' \| 'top-sheet'` | Viewport-dependent position |
| `activeFocusIndex` | `number` | `-1 <= n < count` | Keyboard navigation highlight index |
