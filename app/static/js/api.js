/**
 * Backend API Client & SSE Stream Consumer
 * Contract: specs/012-chat-ui-redesign/contracts/backend-api.yaml
 */

export class ApiClient {
  /**
   * Health and connection check
   * @returns {Promise<{ status: string, ollama_connected: boolean, ollama_url: string }>}
   */
  async getHealth() {
    try {
      const resp = await fetch('/api/health');
      if (!resp.ok) {
        return { status: 'degraded', ollama_connected: false, ollama_url: '' };
      }
      return await resp.json();
    } catch (err) {
      return { status: 'degraded', ollama_connected: false, ollama_url: '' };
    }
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
   * Dispatches model inference and reads SSE response stream
   * @param {{ model: string, prompt: string, history?: Array<{role: string, content: string}>, system?: string, stream?: boolean, thinking?: boolean, temperature?: number }} payload
   * @param {{
   *   onToken: (token: string) => void,
   *   onThinking: (chunk: string) => void,
   *   onDone: (metrics?: { eval_count?: number, total_duration?: number }) => void,
   *   onError: (error: Error) => void,
   *   signal?: AbortSignal
   * }} callbacks
   */
  async streamGenerate(payload, callbacks) {
    const { onToken, onThinking, onDone, onError, signal } = callbacks;

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
          temperature: payload.temperature ?? 0.7
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

          if (data.thinking && onThinking) {
            onThinking(data.thinking);
          }

          if (data.token && onToken) {
            onToken(data.token);
          }

          if (data.done) {
            if (onDone) {
              onDone({
                eval_count: data.eval_count,
                total_duration: data.total_duration
              });
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
            if (data.thinking && onThinking) onThinking(data.thinking);
            if (data.token && onToken) onToken(data.token);
            if (data.done && onDone) {
              onDone({ eval_count: data.eval_count, total_duration: data.total_duration });
              return;
            }
          } catch (_) {}
        }
      }

      if (onDone) onDone();
    } catch (err) {
      if (err.name === 'AbortError') {
        // Generation halted by user stop action
        if (onDone) onDone();
      } else {
        if (onError) onError(err);
      }
    }
  }
}

export const api = new ApiClient();
