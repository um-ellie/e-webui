/**
 * Global Keyboard Shortcut Manager
 * Handles:
 * - Ctrl/Cmd + K: Focus chat search
 * - Ctrl/Cmd + Shift + O: New chat session
 * - Ctrl/Cmd + B: Toggle sidebar collapse
 * - /: Focus message composer
 * - Esc: Halt streaming or close active modal/menu
 * - ?: Open keyboard shortcuts reference sheet
 */

import { store } from './store.js';

export function setupKeyboardShortcuts(settingsDialog) {
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

    // Ctrl/Cmd + K -> Search chats
    if (modifier && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      const searchInput = document.querySelector('.search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Ctrl/Cmd + Shift + O -> New chat
    if (modifier && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      store.createSession();
      const textarea = document.querySelector('.composer-textarea');
      if (textarea) textarea.focus();
      return;
    }

    // Ctrl/Cmd + B -> Toggle sidebar
    if (modifier && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      const btnCollapse = document.querySelector('.btn-collapse-sidebar');
      if (btnCollapse) btnCollapse.click();
      return;
    }

    // Esc -> Handled by settings dialog or active composer stop
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-backdrop.open');
      if (openModal && settingsDialog) {
        settingsDialog.close();
      }
      return;
    }

    // Keys that only trigger when NOT typing in an input
    if (!isTyping) {
      // / -> Focus composer
      if (e.key === '/') {
        e.preventDefault();
        const textarea = document.querySelector('.composer-textarea');
        if (textarea) textarea.focus();
        return;
      }

      // ? -> Open shortcuts reference dialog
      if (e.key === '?') {
        e.preventDefault();
        if (settingsDialog) {
          settingsDialog.open('shortcuts');
        }
        return;
      }
    }
  });
}
