/**
 * Backend API Client & SSE Stream Consumer
 * Contract: specs/012-chat-ui-redesign/contracts/backend-api.yaml
 */

export class ApiClient {
  /**
   * Health and connection check with round-trip latency measurement
   * @returns {Promise<{ status: string, ollama_connected: boolean, ollama_url: string, latency_ms: number, loaded_models: string[], error: string | null }>}
   */
  async getHealth() {
    const start = performance.now();
    try {
      const resp = await fetch('/api/health');
      const latencyMs = Math.round(performance.now() - start);
      if (!resp.ok) {
        return {
          status: 'degraded',
          ollama_connected: false,
          ollama_url: '',
          latency_ms: latencyMs,
          loaded_models: [],
          error: `HTTP ${resp.status}`
        };
      }
      const data = await resp.json();
      return {
        status: data.status || 'ok',
        ollama_connected: Boolean(data.ollama_connected),
        ollama_url: data.ollama_url || '',
        latency_ms: data.latency_ms ?? latencyMs,
        loaded_models: data.loaded_models || [],
        error: null
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        status: 'disconnected',
        ollama_connected: false,
        ollama_url: '',
        latency_ms: latencyMs,
        loaded_models: [],
        error: err.message || 'Cannot reach proxy server'
      };
    }
  }

  /**
   * Alias for getHealth() for contract parity
   */
  async checkHealth() {
    return this.getHealth();
  }

  /**
   * List available Ollama models
   * @returns {Promise<{ models: Array<{ name: string, size: number, parameter_size?: string }>, default_model?: string }>}
   */
  async getModels() {
    const resp = await fetch('/api/models');
    if (!resp.ok) {
      throw new Error(`Failed to load models: HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  /**
   * Alias for getModels() for contract compatibility
   */
  async listModels() {
    return this.getModels();
  }

  /**
   * Dispatches model inference and reads SSE response stream
   * @param {{ model: string, prompt: string, history?: Array<{role: string, content: string}>, system?: string, stream?: boolean, thinking?: boolean, temperature?: number }} payload
   * @param {{
   *   onToken: (token: string, liveMetrics?: { ttftMs: number | null, speed: number | null }) => void,
   *   onThinking: (chunk: string, liveMetrics?: { ttftMs: number | null }) => void,
   *   onDone: (metrics?: any) => void,
   *   onError: (error: Error) => void,
   *   signal?: AbortSignal
   * }} callbacks
   */
  async streamGenerate(payload, callbacks) {
    const { onToken, onThinking, onDone, onError, signal } = callbacks;
    const requestDispatchedAt = performance.now();
    let firstTokenReceivedAt = null;
    let timeToFirstTokenMs = null;
    let tokenCount = 0;
    const rollingSamples = [];

    const calculateLiveSpeed = () => {
      const now = performance.now();
      rollingSamples.push({ time: now, count: 1 });
      while (rollingSamples.length > 0 && now - rollingSamples[0].time > 1500) {
        rollingSamples.shift();
      }
      if (rollingSamples.length >= 2) {
        const windowSec = (rollingSamples[rollingSamples.length - 1].time - rollingSamples[0].time) / 1000;
        if (windowSec > 0) {
          return parseFloat((rollingSamples.length / windowSec).toFixed(1));
        }
      } else if (firstTokenReceivedAt) {
        const elapsed = (now - firstTokenReceivedAt) / 1000;
        if (elapsed > 0.3) {
          return parseFloat((tokenCount / elapsed).toFixed(1));
        }
      }
      return null;
    };

    const buildFinalMetrics = (data = {}) => {
      const totalDurationSec = parseFloat(((performance.now() - requestDispatchedAt) / 1000).toFixed(1));
      let finalSpeed = null;
      if (data.eval_count && data.eval_duration) {
        const evalSec = data.eval_duration / 1e9;
        finalSpeed = evalSec > 0 ? parseFloat((data.eval_count / evalSec).toFixed(1)) : null;
      } else if (data.eval_count && data.total_duration) {
        const durSec = data.total_duration / 1e9;
        finalSpeed = durSec > 0 ? parseFloat((data.eval_count / durSec).toFixed(1)) : null;
      } else if (firstTokenReceivedAt && tokenCount > 0) {
        const durSec = (performance.now() - firstTokenReceivedAt) / 1000;
        finalSpeed = durSec > 0 ? parseFloat((tokenCount / durSec).toFixed(1)) : null;
      }

      let promptEvalSpeed = null;
      if (data.prompt_eval_count && data.prompt_eval_duration) {
        const pSec = data.prompt_eval_duration / 1e9;
        promptEvalSpeed = pSec > 0 ? parseFloat((data.prompt_eval_count / pSec).toFixed(1)) : null;
      }

      return {
        model: payload.model,
        eval_count: data.eval_count ?? tokenCount,
        eval_duration: data.eval_duration ?? null,
        prompt_eval_count: data.prompt_eval_count ?? null,
        prompt_eval_duration: data.prompt_eval_duration ?? null,
        prompt_eval_speed: promptEvalSpeed,
        load_duration: data.load_duration ?? null,
        total_duration: data.total_duration ?? null,
        timeToFirstTokenMs: timeToFirstTokenMs,
        durationSeconds: totalDurationSec,
        tokensPerSecond: finalSpeed
      };
    };

    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: payload.model,
          prompt: payload.prompt,
          history: payload.history || [],
          system: payload.system || null,
          stream: payload.stream !== false,
          thinking: payload.thinking !== false,
          temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.7,
          top_p: typeof payload.top_p === 'number' ? payload.top_p : (typeof payload.topP === 'number' ? payload.topP : undefined),
          num_ctx: typeof payload.num_ctx === 'number' ? payload.num_ctx : (typeof payload.numCtx === 'number' ? payload.numCtx : undefined)
        }),
        signal
      });

      if (!resp.ok) {
        let errorDetail = '';
        try {
          const errJson = await resp.json();
          errorDetail = errJson.detail || JSON.stringify(errJson);
        } catch (_) {
          try {
            errorDetail = await resp.text();
          } catch (_) {}
        }
        const errorMsg = errorDetail
          ? `HTTP ${resp.status} ${resp.statusText}: ${errorDetail}`
          : `HTTP ${resp.status} ${resp.statusText}`;
        const err = new Error(errorMsg);
        err.status = resp.status;
        err.statusText = resp.statusText;
        throw err;
      }

      if (!resp.body) {
        throw new Error('ReadableStream not supported by browser or empty response');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          let data;
          try {
            data = JSON.parse(jsonStr);
          } catch (jsonErr) {
            console.warn('Failed to parse SSE line:', jsonStr, jsonErr);
            continue;
          }

          if (data.error) {
            const streamErr = new Error(data.error);
            streamErr.status = 500;
            if (onError) onError(streamErr);
            return;
          }

          if (data.thinking) {
            if (firstTokenReceivedAt === null) {
              firstTokenReceivedAt = performance.now();
              timeToFirstTokenMs = Math.round(firstTokenReceivedAt - requestDispatchedAt);
            }
            if (onThinking) {
              onThinking(data.thinking, { ttftMs: timeToFirstTokenMs });
            }
          }

          if (data.token) {
            tokenCount++;
            if (firstTokenReceivedAt === null) {
              firstTokenReceivedAt = performance.now();
              timeToFirstTokenMs = Math.round(firstTokenReceivedAt - requestDispatchedAt);
            }
            const liveSpeed = calculateLiveSpeed();
            if (onToken) {
              onToken(data.token, { ttftMs: timeToFirstTokenMs, speed: liveSpeed });
            }
          }

          if (data.done) {
            if (onDone) {
              onDone(buildFinalMetrics(data));
            }
            return;
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.trim().startsWith('data:')) {
        const jsonStr = buffer.trim().slice(5).trim();
        if (jsonStr) {
          try {
            const data = JSON.parse(jsonStr);
            if (data.error) {
              const streamErr = new Error(data.error);
              streamErr.status = 500;
              if (onError) onError(streamErr);
              return;
            }
            if (data.thinking && onThinking) onThinking(data.thinking, { ttftMs: timeToFirstTokenMs });
            if (data.token) {
              tokenCount++;
              if (onToken) onToken(data.token, { ttftMs: timeToFirstTokenMs, speed: calculateLiveSpeed() });
            }
            if (data.done && onDone) {
              onDone(buildFinalMetrics(data));
              return;
            }
          } catch (_) {}
        }
      }

      if (onDone) onDone(buildFinalMetrics({}));
    } catch (err) {
      if (err.name === 'AbortError') {
        // Generation halted by user stop action
        if (onDone) onDone(buildFinalMetrics({}));
      } else {
        if (onError) onError(err);
      }
    }
  }
}

export const api = new ApiClient();
