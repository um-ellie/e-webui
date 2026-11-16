/**
 * Header Component
 * Manages active chat title editing, 3-state Theme Switcher, Share button, and overflow actions.
 */

import { store } from '../store.js';
import { themeManager } from '../theme.js';
import { bindFeatureControl } from '../features.js';
import { exportSession } from '../export.js';
import { showToast } from '../toast.js';
import { showConfirmDialog, showPromptDialog } from './dialog.js';

export class Header {
  constructor(container) {
    this.container = container;
    this.titleElement = container.querySelector('.header-chat-title') || container.querySelector('#ttl');
    this.titleTextElement = container.querySelector('#ttl-text') || this.titleElement;
    this.btnShare = container.querySelector('.btn-share') || container.querySelector('#btn-share');
    this.btnOverflow = container.querySelector('.btn-header-overflow') || container.querySelector('#more');
    this.morePopover = container.querySelector('#morepop');
    this.mobileToggle = container.querySelector('.mobile-menu-toggle') || container.querySelector('#opensb');
    this.themeSegments = container.querySelector('[data-seg]');

    this.init();
  }

  init() {
    this.setupShareButton();
    this.setupTitleEditing();
    this.setupMobileToggle();
    this.setupThemeSwitcher();
    this.setupOverflowMenu();

    // Listen to store updates
    store.on('session:active-changed', (session) => this.update(session));
    store.on('session:updated', (session) => {
      const active = store.getActiveSession();
      if (active && active.id === session.id) {
        this.update(session);
      }
    });

    // Initial title
    this.update(store.getActiveSession());
  }

  setupShareButton() {
    if (!this.btnShare) return;
    this.btnShare.disabled = false;
    this.btnShare.classList.remove('disabled');
    this.btnShare.removeAttribute('aria-disabled');
    this.btnShare.setAttribute('title', 'Export conversation as Markdown');

    this.btnShare.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const session = store.getActiveSession();
      if (session) {
        exportSession(session, 'markdown');
      } else {
        showToast('No active conversation to export', 'warning');
      }
    });
  }

  setupMobileToggle() {
    if (this.mobileToggle) {
      this.mobileToggle.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar') || document.querySelector('aside');
        if (sidebar) {
          sidebar.classList.toggle('open');
          sidebar.classList.toggle('collapsed');
        }
      });
    }
  }

  setupThemeSwitcher() {
    if (!this.themeSegments) return;

    const buttons = Array.from(this.themeSegments.querySelectorAll('button[data-m]'));

    const updateButtons = (mode) => {
      buttons.forEach((btn, idx) => {
        const isSelected = btn.dataset.m === mode;
        btn.setAttribute('aria-checked', String(isSelected));
        btn.tabIndex = isSelected ? 0 : -1;
        if (isSelected) {
          this.themeSegments.style.setProperty('--i', String(idx));
        }
      });
    };

    // Initialize state
    updateButtons(themeManager.getSavedTheme());

    // Listen for global theme changes
    themeManager.subscribe((mode) => {
      updateButtons(mode);
    });

    buttons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        themeManager.setTheme(btn.dataset.m);
      });

      btn.addEventListener('keydown', (e) => {
        let targetIndex = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          targetIndex = (index + 1) % buttons.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          targetIndex = (index - 1 + buttons.length) % buttons.length;
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          themeManager.setTheme(btn.dataset.m);
          return;
        }

        if (targetIndex !== -1) {
          e.preventDefault();
          buttons[targetIndex].focus();
          themeManager.setTheme(buttons[targetIndex].dataset.m);
        }
      });
    });
  }

  setupTitleEditing() {
    if (!this.titleElement) return;

    this.titleElement.addEventListener('click', async () => {
      const session = store.getActiveSession();
      if (!session) return;

      const currentTitle = session.title || 'New conversation';
      const newTitle = await showPromptDialog({
        title: 'Rename conversation',
        message: 'Enter a new title for this conversation:',
        defaultValue: currentTitle,
        placeholder: 'Conversation title',
        confirmText: 'Save',
        cancelText: 'Cancel',
        maxLength: 120
      });

      if (newTitle !== null && newTitle.trim()) {
        store.updateSession(session.id, { title: newTitle.trim() });
        showToast('Chat renamed', 'success');
      }
    });
  }

  setupOverflowMenu() {
    if (!this.btnOverflow) return;

    const popover = this.morePopover;
    if (!popover) return;

    const toggle = (show) => {
      const isExpanded = show !== undefined ? show : !popover.classList.contains('on');
      popover.classList.toggle('on', isExpanded);
      this.btnOverflow.setAttribute('aria-expanded', String(isExpanded));
    };

    this.btnOverflow.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    document.addEventListener('click', (e) => {
      if (popover.classList.contains('on') && !popover.contains(e.target) && !this.btnOverflow.contains(e.target)) {
        toggle(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popover.classList.contains('on')) {
        toggle(false);
        this.btnOverflow.focus();
      }
    });

    // Wire options
    const btnExport = popover.querySelector('#more-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        toggle(false);
        const session = store.getActiveSession();
        if (session) exportSession(session, 'markdown');
      });
    }

    const btnRename = popover.querySelector('#more-rename');
    if (btnRename) {
      btnRename.addEventListener('click', async () => {
        toggle(false);
        const session = store.getActiveSession();
        if (!session) return;

        const currentTitle = session.title || 'New conversation';
        const newTitle = await showPromptDialog({
          title: 'Rename conversation',
          message: 'Enter a new title for this conversation:',
          defaultValue: currentTitle,
          placeholder: 'Conversation title',
          confirmText: 'Save',
          cancelText: 'Cancel',
          maxLength: 120
        });

        if (newTitle !== null && newTitle.trim()) {
          store.updateSession(session.id, { title: newTitle.trim() });
          showToast('Chat renamed', 'success');
        }
      });
    }

    const btnDelete = popover.querySelector('#delchat');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        toggle(false);
        const session = store.getActiveSession();
        if (!session) return;

        const sessionTitle = session.title || 'New conversation';
        const confirmed = await showConfirmDialog({
          title: 'Delete this chat?',
          message: `Are you sure you want to delete "${sessionTitle}"? This action cannot be undone.`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          danger: true
        });

        if (confirmed) {
          store.deleteSession(session.id);
          showToast('Chat deleted', 'info');
        }
      });
    }
  }

  update(session) {
    const title = (session && session.title) ? session.title : 'New conversation';
    if (this.titleTextElement) {
      this.titleTextElement.textContent = title;
    } else if (this.titleElement) {
      this.titleElement.textContent = title;
    }
  }
}
