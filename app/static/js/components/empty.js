/**
 * EmptyState Greeting Component
 * Computes time-of-day greetings ("Good evening, Ellie"), renders brand mark (>E_),
 * and handles clickable prompt suggestion chips.
 */

import { store } from '../store.js';

export class EmptyState {
  constructor(container) {
    this.container = container;
    this.greetingElement = container.querySelector('.empty-greeting');
    this.chipsContainer = container.querySelector('.suggestion-chips-grid');

    this.defaultPrompts = [
      'Explain Incus container networking',
      'Write a Python script for live Ollama streaming',
      'Compare local LLM quantization formats (Q4 vs Q8)',
      'Summarize system logs from journalctl'
    ];

    this.init();
  }

  init() {
    this.updateGreeting();
    this.renderChips();

    store.on('session:active-changed', (session) => this.updateVisibility(session));
    store.on('message:appended', () => {
      const active = store.getActiveSession();
      this.updateVisibility(active);
    });

    // Initial check
    this.updateVisibility(store.getActiveSession());
  }

  getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning, Ellie';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon, Ellie';
    } else {
      return 'Good evening, Ellie';
    }
  }

  updateGreeting() {
    if (this.greetingElement) {
      this.greetingElement.textContent = this.getTimeGreeting();
    }
  }

  renderChips() {
    if (!this.chipsContainer) return;
    this.chipsContainer.innerHTML = '';

    for (const promptText of this.defaultPrompts) {
      const chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.type = 'button';
      chip.textContent = promptText;
      chip.addEventListener('click', () => {
        store.emit('composer:set-prompt', { prompt: promptText });
      });
      this.chipsContainer.appendChild(chip);
    }
  }

  updateVisibility(session) {
    if (!session || session.messages.length === 0) {
      this.container.style.display = 'flex';
    } else {
      this.container.style.display = 'none';
    }
  }
}
