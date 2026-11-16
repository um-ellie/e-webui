/**
 * Application Bootstrap Entrypoint
 * Soft Sage & Warm Sand Design System
 * Initializes modular components, event listeners, and keyboard shortcuts.
 */

import { store } from './store.js';
import { themeManager } from './theme.js';
import { Sidebar } from './components/sidebar.js';
import { Header } from './components/header.js';
import { ChatView } from './components/chat.js';
import { Composer } from './components/composer.js';
import { EmptyState } from './components/empty.js';
import { SettingsDialog } from './components/settings.js';
import { setupKeyboardShortcuts } from './shortcuts.js';
import { ttsController } from './tts.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Initialize persistent storage and hydrate store
  try {
    await store.init();
  } catch (err) {
    console.error('Store initialization error:', err);
  }

  // 1. Initialize Settings Dialog
  const settingsBackdrop = document.getElementById('ov') || document.getElementById('settings-modal');
  const settingsDialog = settingsBackdrop ? new SettingsDialog(settingsBackdrop) : null;

  // 2. Initialize Sidebar
  const sidebarContainer = document.getElementById('sidebar') || document.querySelector('aside') || document.querySelector('.sidebar');
  const sidebar = sidebarContainer ? new Sidebar(sidebarContainer) : null;

  // 3. Initialize Header
  const headerContainer = document.querySelector('header') || document.querySelector('.top-header');
  const header = headerContainer ? new Header(headerContainer) : null;

  // 4. Initialize Chat View
  const chatContainer = document.getElementById('messages-list') || document.querySelector('.messages-list');
  const chatView = chatContainer ? new ChatView(chatContainer) : null;

  // 5. Initialize Composer
  const composerContainer = document.querySelector('.cap') || document.querySelector('.composer-box');
  const composer = composerContainer ? new Composer(composerContainer) : null;

  // 6. Initialize Empty State
  const emptyStateContainer = document.getElementById('empty-state') || document.querySelector('.empty-state');
  const emptyState = emptyStateContainer ? new EmptyState(emptyStateContainer) : null;

  // 7. Wire all settings buttons to open modal
  document.querySelectorAll('[data-open="settings"], .btn-open-settings').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (settingsDialog) {
        settingsDialog.open('p1');
      }
    });
  });

  // 8. Register global keyboard shortcuts
  setupKeyboardShortcuts(settingsDialog);

  // 9. Create initial session if none exists
  if (store.listSessions().length === 0) {
    store.createSession();
  }

  // 10. Stop speech playback on session change or deletion
  store.on('session:active-changed', () => {
    ttsController.stop();
  });
  store.on('session:deleted', () => {
    ttsController.stop();
  });
});
