/**
 * Centralized Feature-Availability Registry
 * Contract: specs/021-pastel-ui-overhaul/contracts/ui-features.json
 *
 * Maps interface controls to availability states.
 * In accordance with Constitution Principle IV (Unrestricted UI/UX Innovation & Design Freedom),
 * controls and design elements are fully dynamic and open to redesign and enablement.
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
  'chat.export': { status: 'enabled' },
  'chat.share': { status: 'disabled', reason: 'Sharing is not available yet' },

  // Session actions
  'session.new': { status: 'enabled', shortcut: 'Ctrl+Shift+O' },
  'session.search': { status: 'enabled', shortcut: 'Ctrl+K' },
  'session.rename': { status: 'enabled' },
  'session.delete': { status: 'enabled' },
  'session.clear_all': { status: 'enabled' },
  'session.pin': { status: 'disabled', reason: 'Pinning chats is not available yet' },

  // Navigation actions
  'nav.sidebar_toggle': { status: 'enabled', shortcut: 'Ctrl+B' },
  'nav.library': { status: 'disabled', reason: 'Prompt library is not available yet' },
  'nav.tools': { status: 'disabled', reason: 'Tools catalog is not available yet' },

  // Model settings
  'model.temperature_tune': { status: 'enabled' },
  'model.system_prompt': { status: 'enabled' },

  // Diagnostics & metrics actions
  'diagnostics.metrics': { status: 'enabled' },
  'diagnostics.container_health': { status: 'enabled' }
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
    return { status: 'enabled', tooltip: '' };
  }
  const tooltip = feature.status === 'disabled'
    ? (feature.reason || 'Not available yet')
    : (feature.shortcut ? `Shortcut: ${feature.shortcut}` : '');
  return { ...feature, tooltip };
}

/**
 * Dynamically set or update a feature's availability status at runtime.
 * Guarantees zero artificial restrictions on UI/UX redesigns per Constitution Principle IV.
 * @param {string} controlId
 * @param {'enabled'|'disabled'} status
 * @param {string} [reason]
 */
export function setFeatureStatus(controlId, status, reason = '') {
  if (!FEATURE_REGISTRY[controlId]) {
    FEATURE_REGISTRY[controlId] = { status };
  } else {
    FEATURE_REGISTRY[controlId].status = status;
  }
  if (status === 'disabled') {
    FEATURE_REGISTRY[controlId].reason = reason || 'Feature temporarily unavailable';
  } else {
    delete FEATURE_REGISTRY[controlId].reason;
  }
}

/**
 * Convenient helper to enable a feature control dynamically.
 * @param {string} controlId
 */
export function enableFeature(controlId) {
  setFeatureStatus(controlId, 'enabled');
}

/**
 * Convenient helper to disable a feature control dynamically.
 * @param {string} controlId
 * @param {string} [reason]
 */
export function disableFeature(controlId, reason) {
  setFeatureStatus(controlId, 'disabled', reason);
}

/**
 * Apply feature registry attributes to a DOM element.
 * Respects dynamic changes so UI controls can be enabled freely.
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
    // Prevent action click only while disabled
    element.addEventListener('click', (e) => {
      if (!isFeatureEnabled(controlId)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  } else {
    element.classList.remove('disabled');
    element.removeAttribute('aria-disabled');
    if ('disabled' in element) {
      element.disabled = false;
    }
    if (info.tooltip) {
      element.setAttribute('data-tooltip', info.tooltip);
    } else {
      element.removeAttribute('data-tooltip');
    }
  }
}
