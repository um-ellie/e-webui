/**
 * Canonical Health Telemetry Normalizer
 * Single source of truth for Ollama connection state.
 * Maps /api/health response to normalized UI state with multi-signal accessibility.
 */

import { api } from './api.js';

/**
 * @typedef {'online' | 'degraded' | 'offline' | 'checking'} HealthStatus
 *
 * @typedef {Object} NormalizedHealth
 * @property {HealthStatus} status
 * @property {number|null} latencyMs
 * @property {string} endpointUrl
 * @property {string[]} loadedModels
 * @property {number} checkedAt
 * @property {string|null} errorMessage
 */

class HealthManager {
  constructor() {
    /** @type {NormalizedHealth} */
    this.current = {
      status: 'checking',
      latencyMs: null,
      endpointUrl: 'http://127.0.0.1:11434',
      loadedModels: [],
      checkedAt: Date.now(),
      errorMessage: null,
    };

    /** @type {Set<(health: NormalizedHealth) => void>} */
    this.listeners = new Set();
    this.pollInterval = 30000;
    this.timer = null;
    this.isPolling = false;

    this.setupVisibilityListener();
  }

  /**
   * Normalizes raw /api/health response payload into canonical NormalizedHealth
   * @param {Object|null} raw - Raw API response
   * @param {number|null} measuredLatency - Performance measurement latency
   * @param {string|null} error - Error string if request failed
   * @returns {NormalizedHealth}
   */
  normalize(raw, measuredLatency = null, error = null) {
    const now = Date.now();
    const endpointUrl = (raw && raw.ollama_url) ? raw.ollama_url : 'http://127.0.0.1:11434';
    const loadedModels = (raw && Array.isArray(raw.loaded_models)) ? raw.loaded_models : [];

    if (error || !raw || !raw.ollama_connected) {
      return {
        status: 'offline',
        latencyMs: null,
        endpointUrl,
        loadedModels: [],
        checkedAt: now,
        errorMessage: error || (raw && raw.error) || 'Ollama instance unreachable',
      };
    }

    const latency = (raw && typeof raw.latency_ms === 'number')
      ? raw.latency_ms
      : (measuredLatency ?? 0);

    // Latency threshold: >= 500ms is Degraded/Slow
    const status = latency >= 500 ? 'degraded' : 'online';

    return {
      status,
      latencyMs: Math.round(latency * 10) / 10,
      endpointUrl,
      loadedModels,
      checkedAt: now,
      errorMessage: null,
    };
  }

  /**
   * Subscribe to health state updates
   * @param {(health: NormalizedHealth) => void} fn
   * @returns {() => void} Unsubscribe function
   */
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.current);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try {
        fn(this.current);
      } catch (e) {
        console.error('Health listener error:', e);
      }
    }
  }

  /**
   * Triggers an immediate probe against /api/health
   * @returns {Promise<NormalizedHealth>}
   */
  async probe() {
    this.current = { ...this.current, status: 'checking', checkedAt: Date.now() };
    this.notify();

    const start = performance.now();
    try {
      const resp = await api.getHealth();
      const measured = Math.round(performance.now() - start);
      if (resp.error) {
        this.current = this.normalize(null, measured, resp.error);
      } else {
        this.current = this.normalize(resp, measured, null);
      }
    } catch (err) {
      this.current = this.normalize(null, null, err.message || 'Connection failed');
    }

    this.notify();
    return this.current;
  }

  startPolling(intervalMs = 30000) {
    this.pollInterval = intervalMs;
    this.stopPolling();
    this.isPolling = true;
    this.probe();
    this.timer = setInterval(() => this.probe(), this.pollInterval);
  }

  stopPolling() {
    this.isPolling = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setupVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
          }
        } else if (this.isPolling) {
          this.probe();
          if (!this.timer) {
            this.timer = setInterval(() => this.probe(), this.pollInterval);
          }
        }
      });
    }
  }
}

export const healthManager = new HealthManager();
