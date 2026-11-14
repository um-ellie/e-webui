# Streaming Render Pipeline & Frame-Throttling Contract

**Feature**: `017-streaming-render-code-polish`  
**Date**: 2026-11-14  

This contract governs the timing, scheduling, and DOM update guarantees of live token streaming in `ChatView`.

---

## 1. Frame Throttling Specifications

* **Sampling Clock:** `window.requestAnimationFrame()`
* **Minimum Throttle Interval:** `40 ms` (yields max ~25 DOM updates/sec, reducing CPU layout calculations by over 60% compared to per-token updates at 80 tok/s).
* **Immediate Flush Condition:** When a stream finishes (`status: 'completed'`, `'stopped'`, or `'error'`), any active RAF is canceled and an immediate final render pass executes synchronously.

---

## 2. Cursor Element Persistence Contract

* During streaming, `.stream-cursor` MUST NOT be repeatedly created as a new DOM node on each frame.
* The cursor element persists at the end of `.assistant-body`.
* Blinking animation rule: `.stream-cursor` animates via CSS `var(--blink)` step-end infinite without reset or stutter.
* Reduced Motion: Respects `@media (prefers-reduced-motion: reduce)` by disabling blinking animation.

---

## 3. Auto-Scroll Invariance Contract

* **User Intent Priority:** If `userScrolledUp === true` (distance from bottom > 80 px), the streaming pipeline MUST NOT force `scrollTop = scrollHeight`.
* **Sticky Bottom:** If `userScrolledUp === false`, each throttled frame adjusts `scrollTop` smoothly to match newly rendered content.
