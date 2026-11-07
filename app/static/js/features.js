/**
 * Centralized Feature-Availability Registry
 * Contract: specs/012-chat-ui-redesign/contracts/ui-features.json
 *
 * Maps every interface control to either:
 * - 'enabled': Backed by backend capability
 * - 'disabled': Shown with disabled styling and explanatory tooltip
 */

export const FEATURE_REGISTRY = {
  // Chat actions
  'chat.send': { status: 'enabled', shortcut: 'Enter' },
  'chat.stop': { status: 'enabled', shortcut: 'Esc' },
  'chat.model_select': { status: 'enabled' },
  'chat.mic_input': { status: 'disabled', reason: 'Voice input is not available yet' },
  'chat.manage_models': { status: 'disabled', reason: 'Manage models is not available yet' },
  'chat.theme_toggle': { status: 'enabled' },
  'chat.font_size': { status: 'enabled' },
  'chat.think_toggle': { status: 'enabled' },
  'chat.attach_file': { status: 'disabled', reason: 'File upload is not available yet' },
  'chat.tools_menu': { status: 'disabled', reason: 'Tools are not available yet' },
  'chat.export': { status: 'disabled', reason: 'Export is not available yet' },
  'chat.share': { status: 'disabled', reason: 'Sharing is not available yet' },

  // Session actions
  'session.new': { status: 'enabled', shortcut: 'Ctrl+Shift+O' },
  'session.search': { status: 'enabled', shortcut: 'Ctrl+K' },
  'session.rename': { status: 'enabled' },
  'session.delete': { status: 'enabled' },
  'session.pin': { status: 'disabled', reason: 'Pinning chats is not available yet' },

  // Navigation actions
  'nav.sidebar_toggle': { status: 'enabled', shortcut: 'Ctrl+B' },
  'nav.library': { status: 'disabled', reason: 'Prompt library is not available yet' },
  'nav.tools': { status: 'disabled', reason: 'Tools catalog is not available yet' },

  // Model settings
  'model.temperature_tune': { status: 'disabled', reason: 'Custom parameters are not available yet' },
  'model.system_prompt': { status: 'disabled', reason: 'System prompt configuration is not available yet' }
};

/**
 * Check if a feature is enabled
 * @param {string} controlId
 * @returns {boolean}
 */
export function isFeatureEnabled(controlId) {
  const feature = FEATURE_REGISTRY[controlId];
  return feature ? feature.status === 'enabled' : false;
}

/**
 * Get feature metadata including disabled reason and tooltip
 * @param {string} controlId
 * @returns {{ status: string, reason?: string, tooltip: string }}
 */
export function getFeatureInfo(controlId) {
  const feature = FEATURE_REGISTRY[controlId];
  if (!feature) {
    return { status: 'disabled', tooltip: 'Not available yet' };
  }
  const tooltip = feature.status === 'disabled'
    ? (feature.reason || 'Not available yet')
    : (feature.shortcut ? `Shortcut: ${feature.shortcut}` : '');
  return { ...feature, tooltip };
}

/**
 * Apply feature registry attributes to a DOM element
 * @param {HTMLElement} element
 * @param {string} controlId
 */
export function bindFeatureControl(element, controlId) {
  const info = getFeatureInfo(controlId);
  element.setAttribute('data-control-id', controlId);

  if (info.status === 'disabled') {
    element.classList.add('disabled');
    element.setAttribute('aria-disabled', 'true');
    element.setAttribute('data-tooltip', info.tooltip);
    if ('disabled' in element) {
      element.disabled = true;
    }
    // Prevent action click
    element.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  } else if (info.tooltip) {
    element.setAttribute('data-tooltip', info.tooltip);
  }
}
