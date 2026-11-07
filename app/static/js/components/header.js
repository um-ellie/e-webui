/**
 * Header Component
 * Manages active chat title editing, Share button, and overflow actions.
 */

import { store } from '../store.js';
import { bindFeatureControl } from '../features.js';

export class Header {
  constructor(container) {
    this.container = container;
    this.titleElement = container.querySelector('.header-chat-title');
    this.btnShare = container.querySelector('.btn-share');
    this.btnOverflow = container.querySelector('.btn-header-overflow');
    this.mobileToggle = container.querySelector('.mobile-menu-toggle');

    this.init();
  }

  init() {
    this.bindRegistryControls();
    this.setupTitleEditing();
    this.setupMobileToggle();
    this.setupOverflowMenu();

    // Listen to store updates
    store.on('session:active-changed', (session) => this.update(session));
    store.on('session:updated', (session) => {
      const active = store.getActiveSession();
      if (active && active.id === session.id) {
        this.update(session);
      }
    });
  }

  bindRegistryControls() {
    if (this.btnShare) {
      bindFeatureControl(this.btnShare, 'chat.share');
    }
  }

  setupMobileToggle() {
    if (this.mobileToggle) {
      this.mobileToggle.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
          sidebar.classList.toggle('open');
        }
      });
    }
  }

  setupTitleEditing() {
    if (!this.titleElement) return;

    this.titleElement.addEventListener('click', () => {
      const session = store.getActiveSession();
      if (!session) return;

      const currentTitle = session.title;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'header-chat-title editing';
      input.value = currentTitle;
      input.maxLength = 120;

      const save = () => {
        const newTitle = input.value.trim() || 'New conversation';
        store.updateSession(session.id, { title: newTitle });
        if (input.parentElement) {
          input.replaceWith(this.titleElement);
        }
        this.titleElement.textContent = newTitle;
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          save();
        } else if (e.key === 'Escape') {
          input.replaceWith(this.titleElement);
        }
      });
      input.addEventListener('blur', save);

      this.titleElement.replaceWith(input);
      input.focus();
      input.select();
    });
  }

  setupOverflowMenu() {
    if (!this.btnOverflow) return;

    this.btnOverflow.addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.querySelector('.context-menu');
      if (existing) existing.remove();

      const session = store.getActiveSession();
      if (!session) return;

      const menu = document.createElement('div');
      menu.className = 'context-menu';

      // Rename
      const optRename = document.createElement('div');
      optRename.className = 'menu-item';
      optRename.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Rename</span>';
      optRename.addEventListener('click', () => {
        menu.remove();
        const newTitle = prompt('Rename chat:', session.title);
        if (newTitle !== null) {
          store.updateSession(session.id, { title: newTitle });
        }
      });
      menu.appendChild(optRename);

      // Export (disabled per registry)
      const optExport = document.createElement('div');
      optExport.className = 'menu-item disabled';
      optExport.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg><span>Export</span>';
      bindFeatureControl(optExport, 'chat.export');
      menu.appendChild(optExport);

      // Delete
      const optDelete = document.createElement('div');
      optDelete.className = 'menu-item';
      optDelete.style.color = 'var(--danger)';
      optDelete.innerHTML = '<svg class="i" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Delete</span>';
      optDelete.addEventListener('click', () => {
        menu.remove();
        if (confirm(`Delete conversation "${session.title}"?`)) {
          store.deleteSession(session.id);
        }
      });
      menu.appendChild(optDelete);

      const rect = this.btnOverflow.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.right = `${window.innerWidth - rect.right}px`;

      document.body.appendChild(menu);

      const dismissHandler = (evt) => {
        if (!menu.contains(evt.target)) {
          menu.remove();
          document.removeEventListener('click', dismissHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', dismissHandler), 10);
    });
  }

  update(session) {
    if (!session) return;
    if (this.titleElement) {
      this.titleElement.textContent = session.title || 'New conversation';
    }
  }
}
