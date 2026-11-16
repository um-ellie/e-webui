/**
 * EmptyState Greeting Component
 * Renders asymmetric, start-aligned editorial time-of-day greeting
 * ("Good morning", "Good afternoon", "Good evening") in the reading column.
 * Zero duplicate logos, zero engine status text, zero username.
 */

import { store } from '../store.js';

export class EmptyState {
  constructor(container) {
    this.container = container;
    this.greetingElement = container.querySelector('#empty-greeting') || container.querySelector('.empty-greeting');

    this.init();
  }

  init() {
    this.updateGreeting();

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
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  }

  updateGreeting() {
    if (this.greetingElement) {
      this.greetingElement.textContent = this.getTimeGreeting();
    }
  }

  updateVisibility(session) {
    if (!session || !session.messages || session.messages.length === 0) {
      this.container.style.display = 'flex';
    } else {
      this.container.style.display = 'none';
    }
  }
}
