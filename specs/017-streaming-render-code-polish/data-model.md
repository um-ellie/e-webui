# Data Model: Streaming Render Optimization & Code Syntax Polish

**Feature**: `017-streaming-render-code-polish`  
**Date**: 2026-11-14  
**Status**: Ready for Implementation  

---

## 1. Domain Entities & State Structures

### 1.1 RenderThrottleState
Represents the client-side frame-throttling controller governing live token streams.

```typescript
interface RenderThrottleState {
  /** Active animation frame request ID (from requestAnimationFrame) */
  rafId: number | null;
  
  /** Timestamp (performance.now()) of the last executed DOM render pass */
  lastRenderTime: number;
  
  /** Minimum interval in milliseconds between full Markdown/DOM layout updates (default: 40 ms) */
  throttleInterval: number;
  
  /** Flag indicating pending unrendered tokens exist in the accumulator */
  isDirty: boolean;
  
  /** Identifier of the message currently undergoing streaming rendering */
  activeMessageId: string | null;
}
```

---

### 1.2 CodeBlockDescriptor
Represents a parsed Markdown fenced code block rendered within an assistant message.

```typescript
interface CodeBlockDescriptor {
  /** Normalized lowercase language identifier (e.g., "python", "javascript", "bash", "json") */
  language: string;
  
  /** Raw unformatted code text content (used for clipboard copy) */
  rawCode: string;
  
  /** Syntax-highlighted HTML string generated via Prism.js tokenizer */
  highlightedHtml: string;
  
  /** Text directionality constraint (must always be 'ltr') */
  direction: 'ltr';
  
  /** Copy button UI state */
  copyState: 'idle' | 'copied' | 'error';
}
```

---

### 1.3 SyntaxThemeMapping
Defines CSS class names produced by the offline Prism tokenizer and their associated theme custom properties.

```typescript
interface SyntaxThemeMapping {
  /** Language keywords, conditionals, control structures (class: .token.keyword) -> var(--rose) */
  keyword: string;
  
  /** Strings, template literals, attribute values (class: .token.string) -> var(--ok) / green */
  string: string;
  
  /** Function names, class names, method declarations (class: .token.function) -> var(--purple) */
  function: string;
  
  /** Code comments, docstrings (class: .token.comment) -> var(--mute) */
  comment: string;
  
  /** Numerical literals, booleans, constants (class: .token.number, .token.boolean) -> #D97706 / #F59E0B */
  number: string;
  
  /** Operators, delimiters, brackets (class: .token.operator, .token.punctuation) -> var(--ink) */
  operator: string;
}
```

---

## 2. Component State Transitions

### Streaming Render State Lifecycle
```
[SSE Token Chunk Arrives]
          │
          ▼
┌─────────────────────────┐
│ Append to msg.content   │
│ Mark isDirty = true     │
└─────────┬───────────────┘
          │
          ├──(rafId exists?)──► [Wait for scheduled frame]
          │
          └──(No rafId active)──► ┌─────────────────────────────────┐
                                  │ Schedule requestAnimationFrame   │
                                  └───────────────┬─────────────────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────────┐
                                    │ Check throttle interval     │
                                    │ If >= 40ms:                 │
                                    │   renderMarkdown()          │
                                    │   scrollToBottom()          │
                                    │   isDirty = false           │
                                    └─────────────────────────────┘
                                                  │
[Stream Finishes / done: true] ───────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ Cancel pending RAF              │
│ Final synchronous render pass   │
│ Attach code block copy handlers │
│ Finalize persistent cursor      │
└─────────────────────────────────┘
```
