/**
 * Application Bootstrap Entrypoint
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

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Settings Dialog
  const settingsBackdrop = document.getElementById('settings-modal');
  const settingsDialog = settingsBackdrop ? new SettingsDialog(settingsBackdrop) : null;

  // 2. Initialize Sidebar
  const sidebarContainer = document.querySelector('.sidebar');
  const sidebar = sidebarContainer ? new Sidebar(sidebarContainer) : null;

  // 3. Initialize Header
  const headerContainer = document.querySelector('.top-header');
  const header = headerContainer ? new Header(headerContainer) : null;

  // 4. Initialize Chat View
  const chatContainer = document.querySelector('.reading-column .messages-list');
  const chatView = chatContainer ? new ChatView(chatContainer) : null;

  // 5. Initialize Composer
  const composerContainer = document.querySelector('.composer-box');
  const composer = composerContainer ? new Composer(composerContainer) : null;

  // 6. Initialize Empty State
  const emptyStateContainer = document.querySelector('.empty-state');
  const emptyState = emptyStateContainer ? new EmptyState(emptyStateContainer) : null;

  // 7. Wire sidebar settings button to modal
  const btnOpenSettings = document.querySelector('.btn-open-settings');
  if (btnOpenSettings && settingsDialog) {
    btnOpenSettings.addEventListener('click', () => {
      settingsDialog.open('general');
    });
  }

  // 8. Register global keyboard shortcuts
  setupKeyboardShortcuts(settingsDialog);

  // 9. Create initial session if none exists
  if (store.listSessions().length === 0) {
    store.createSession();
  }
});
