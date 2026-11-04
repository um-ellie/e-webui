# Data Model & Configuration Specifications: e-webui

**Feature**: Rebrand to `e-webui` and Brand Logo Integration  
**Date**: 2026-11-05  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document outlines the data structures, configuration models, and presentation attributes associated with the rebranding to `e-webui` and the `> ~/.E _` brand logo.

---

## 1. Application Identity Configuration

Represents the core application metadata exposed across UI, API documents, and system configuration.

| Field | Type | Default Value | Description |
|---|---|---|---|
| `canonical_name` | string | `"e-webui"` | The official canonical application identifier (lowercase, hyphenated). |
| `display_title` | string | `"e-webui"` | Display title used for browser page tabs and header labels. |
| `app_version` | string | `"1.0.0"` | Current application semantic release version. |
| `service_name` | string | `"e-webui.service"` | Standard Linux systemd service unit name. |
| `logger_name` | string | `"e-webui"` | Python logger name used in server log output. |

### Validation Rules
- `canonical_name` MUST strictly equal `"e-webui"`.
- Must never be compounded into broken names (e.g., `ellie-ollama-e-webui`).

---

## 2. Brand Logo UI Entity

Represents the visual and accessibility properties of the brand logo header component.

```text
+-------------------------------------------------------------+
|                       BrandLogoComponent                    |
+-------------------------------------------------------------+
| - ariaLabel: "e-webui"                                      |
| - role: "img"                                               |
| - dir: "ltr"                                                |
| - unicodeBidi: "isolate"                                    |
| - promptColor: var(--logo-prompt)                           |
| - textColor: var(--logo-text)                               |
| - mobileFontSize: 28px                                      |
| - desktopFontSize: 34px                                     |
| - animationState: "blinking" | "paused"                     |
+-------------------------------------------------------------+
```

### Component Attributes

| Attribute | Value / Format | Purpose |
|---|---|---|
| `aria-label` | `"e-webui"` | Provides the vocalized name for assistive technology. |
| `role` | `"img"` | Identifies the element group as a graphical logo entity. |
| `dir` | `"ltr"` | Forces left-to-right character rendering regardless of page bidi. |
| `unicode-bidi` | `"isolate"` | Prevents bidirectional spillover to/from adjacent elements. |
| `user-select` | `"none"` | Prevents accidental text selection of chrome elements. |

### Color Tokens

| Token | Theme (Dark) | Theme (Light) | Purpose |
|---|---|---|---|
| `--logo-prompt` | `#3b82f6` | `#2563eb` | Terminal prompt symbol (`>`) |
| `--logo-text` | `#f8fafc` | `#0f172a` | Terminal directory and cursor text (`~/.E _`) |

---

## 3. Motion Preference State

Determines cursor animation behavior in compliance with accessibility standards.

| User Preference | CSS Media Query | Animation Class | Cursor State |
|---|---|---|---|
| Default / Standard | `(prefers-reduced-motion: no-preference)` | `.animate-logo-cursor-blink` | Continuously blinking (1s steps) |
| Reduced Motion | `(prefers-reduced-motion: reduce)` | `.animate-logo-cursor-blink` | Paused (`animation: none`), visible (`opacity: 1`) |

---

## 4. Renaming Mapping Table

Mapping rules applied across workspace files during the rename pass:

| Old Pattern (Case-Insensitive) | Replacement Target | Exceptions / Protected Contexts |
|---|---|---|
| `ellie-ollama-webui` | `e-webui` | None in workspace |
| `Ollama Web UI` | `e-webui` | None in workspace |
| `Web UI` | `e-webui` | Third-party strings (e.g. `Open WebUI`) |
| `webui` | `e-webui` | Container name `webui`, Incus proxy `webui-proxy`, third-party packages |
| `ollama-webui.service` | `e-webui.service` | Container-specific deployment commands handled via manual hand-off |
