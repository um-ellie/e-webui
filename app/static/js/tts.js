/**
 * TTSController Module
 * Manages audio playback, browser session caching of audio blobs,
 * single-stream playback enforcement, and UI state notifications.
 */

export class TTSController {
  constructor() {
    this.audio = new Audio();
    this.activeMessageId = null;
    this.playbackState = 'idle'; // 'idle' | 'loading' | 'playing'
    this.cache = new Map(); // messageId -> objectUrl
    this.subscribers = new Set();

    this.audio.addEventListener('ended', () => {
      const prevId = this.activeMessageId;
      this.playbackState = 'idle';
      this.activeMessageId = null;
      if (prevId) {
        this.emitState(prevId, 'idle');
      }
    });

    this.audio.addEventListener('error', (err) => {
      console.warn('Audio playback encountered error:', err);
      const prevId = this.activeMessageId;
      this.playbackState = 'idle';
      this.activeMessageId = null;
      if (prevId) {
        this.emitState(prevId, 'idle', 'Audio playback failed');
      }
    });
  }

  /**
   * Subscribes a listener to audio state changes: (messageId, state, errorHint) => void
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  emitState(messageId, state, error = null) {
    for (const sub of this.subscribers) {
      try {
        sub(messageId, state, error);
      } catch (e) {
        console.error('Error in TTS state subscriber:', e);
      }
    }
  }

  /**
   * Plays speech audio for a message, fetching from cache or requesting from backend.
   * If already playing the same message, toggles playback to stop.
   * @param {string} messageId
   * @param {string} text
   */
  async play(messageId, text) {
    if (!messageId || !text) return;

    // Toggle stop if already playing or loading the same message
    if (this.activeMessageId === messageId) {
      if (this.playbackState === 'playing' || this.playbackState === 'loading') {
        this.stop();
        return;
      }
    }

    // Stop any existing playing message before starting a new one
    this.stop();

    this.activeMessageId = messageId;

    // Check session cache for instantaneous replay
    if (this.cache.has(messageId)) {
      const cachedUrl = this.cache.get(messageId);
      this._playBlobUrl(messageId, cachedUrl);
      return;
    }

    // Fetch from backend
    this.playbackState = 'loading';
    this.emitState(messageId, 'loading');

    try {
      const resp = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, message_id: messageId })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData.detail || 'Speech synthesis unavailable';
        this.playbackState = 'idle';
        this.emitState(messageId, 'idle', errMsg);
        this.activeMessageId = null;
        return;
      }

      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.cache.set(messageId, objectUrl);

      // Verify the user hasn't switched or stopped while awaiting the request
      if (this.activeMessageId === messageId) {
        this._playBlobUrl(messageId, objectUrl);
      }
    } catch (networkErr) {
      console.error('Failed to request speech synthesis:', networkErr);
      this.playbackState = 'idle';
      this.emitState(messageId, 'idle', 'Connection error');
      this.activeMessageId = null;
    }
  }

  _playBlobUrl(messageId, url) {
    this.audio.src = url;
    this.playbackState = 'playing';
    this.emitState(messageId, 'playing');

    this.audio.play().catch((playErr) => {
      console.warn('Playback error:', playErr);
      this.playbackState = 'idle';
      this.emitState(messageId, 'idle', 'Autoplay blocked or playback error');
      this.activeMessageId = null;
    });
  }

  /**
   * Stops any currently playing or loading audio stream immediately.
   */
  stop() {
    const prevId = this.activeMessageId;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.playbackState = 'idle';
    this.activeMessageId = null;

    if (prevId) {
      this.emitState(prevId, 'idle');
    }
  }

  /**
   * Returns current state for a message
   * @param {string} messageId
   * @returns {'idle' | 'loading' | 'playing'}
   */
  getState(messageId) {
    return this.activeMessageId === messageId ? this.playbackState : 'idle';
  }
}

export const ttsController = new TTSController();
