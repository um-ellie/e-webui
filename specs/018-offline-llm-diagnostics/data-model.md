# Data Model: Offline LLM Diagnostics & Live Inference Metrics

**Feature**: `018-offline-llm-diagnostics`  
**Date**: 2026-11-14  
**Status**: Ready for Implementation  

---

## 1. Domain Entities & Interfaces

### 1.1 TurnPerformanceMetrics
Represents the detailed temporal, throughput, and volumetric measurements recorded for a completed assistant generation turn.

```typescript
interface TurnPerformanceMetrics {
  /** Name of the Ollama model used for inference (e.g. "qwen2.5:7b") */
  model: string;

  /** Time to First Token in milliseconds (elapsed time from dispatch to first chunk) */
  timeToFirstTokenMs: number;

  /** Total elapsed time of turn from request dispatch to stream completion in seconds */
  durationSeconds: number;

  /** Number of generated completion tokens */
  evalCount: number | null;

  /** Duration spent generating tokens in milliseconds */
  evalDurationMs: number | null;

  /** Computed completion generation speed in tokens per second */
  tokensPerSecond: number | null;

  /** Number of tokens evaluated in the input prompt context */
  promptEvalCount: number | null;

  /** Duration spent evaluating prompt tokens in milliseconds */
  promptEvalDurationMs: number | null;

  /** Computed prompt evaluation throughput in tokens per second */
  promptEvalTokensPerSecond: number | null;

  /** Duration spent loading the model into memory in milliseconds (cold start) */
  loadDurationMs: number | null;
}
```

---

### 1.2 StreamingDiagnosticsState
Represents transient in-flight metrics tracked in memory during active token generation.

```typescript
interface StreamingDiagnosticsState {
  /** Timestamp (performance.now()) when the user dispatched the prompt request */
  requestDispatchedAt: number;

  /** Timestamp (performance.now()) when the first chunk (text or thinking) was received */
  firstTokenReceivedAt: number | null;

  /** Time to First Token in milliseconds */
  timeToFirstTokenMs: number | null;

  /** Cumulative count of tokens received so far during this stream */
  accumulatedTokens: number;

  /** Rolling window samples: array of { timestamp: number, tokenCount: number } for live rate calculation */
  rollingSamples: Array<{ timestamp: number; count: number }>;

  /** Current instantaneous generation speed (tokens/sec) */
  currentTokensPerSecond: number;
}
```

---

### 1.3 ConnectionHealthSnapshot
Represents the availability, latency, and operational health of the upstream Ollama container probed by the proxy.

```typescript
interface ConnectionHealthSnapshot {
  /** Health status category */
  status: 'connected' | 'degraded' | 'disconnected';

  /** Round-trip ping time to Ollama container in milliseconds */
  latencyMs: number | null;

  /** Configured base URL of the upstream Ollama instance */
  ollamaUrl: string;

  /** Timestamp of the most recent probe execution */
  checkedAt: number;

  /** List of currently loaded models resident in memory (reported by /api/ps) */
  loadedModels: string[];

  /** Error message details if status is degraded or disconnected */
  errorMessage: string | null;
}
```

---

## 2. API Schema Extensions

### 2.1 HealthResponse (Backend Schema)
Extended in `app/models.py`:

```python
class HealthResponse(BaseModel):
    """Liveness probe response with latency and container diagnostics."""
    status: str = "ok"                      # "ok" | "degraded" | "error"
    ollama_connected: bool = False
    ollama_url: str
    latency_ms: Optional[float] = None       # Measured round-trip ping time in ms
    loaded_models: List[str] = Field(default_factory=list) # Models resident in memory
```

### 2.2 StreamChunk (Backend Schema)
Extended in `app/models.py`:

```python
class StreamChunk(BaseModel):
    """Incremental response chunk emitted via SSE."""
    token: str = Field(default="")
    thinking: Optional[str] = None
    done: bool = Field(default=False)
    status: Optional[str] = None
    eval_count: Optional[int] = None
    eval_duration: Optional[int] = None          # Duration in nanoseconds
    prompt_eval_count: Optional[int] = None      # Prompt context token count
    prompt_eval_duration: Optional[int] = None   # Duration in nanoseconds
    load_duration: Optional[int] = None         # Model load duration in nanoseconds
    total_duration: Optional[int] = None         # Total duration in nanoseconds
    error: Optional[str] = None
```

---

## 3. Storage Persistence

The `TurnPerformanceMetrics` object is persisted directly on `ChatMessage.metrics` within `ewebui_db` IndexedDB (`messages` store), ensuring that all historical speed, TTFT, and prompt evaluation statistics are preserved across page reloads and exports.
