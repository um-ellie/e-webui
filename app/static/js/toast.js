/**
 * Reusable Toast Notification System
 * Soft Sage & Warm Sand Design System
 * Displays non-intrusive stacked notifications at the bottom of the viewport.
 */

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

/**
 * Show a toast notification
 * @param {string} message - Text message to display
 * @param {'info' | 'success' | 'error' | 'warning'} [type='info'] - Visual sentiment
 * @param {number} [duration=3500] - Duration in ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast-card toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  let iconName = '#act';
  if (type === 'success') iconName = '#ok';
  else if (type === 'error') iconName = '#x';
  else if (type === 'warning') iconName = '#bulb';

  toast.innerHTML = `
    <span class="toast-icon">
      <svg class="i"><use href="${iconName}"/></svg>
    </span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger entrance transition in next paint frame
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  const dismiss = () => {
    toast.classList.remove('visible');
    toast.classList.add('dismissed');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 250);
  };

  const timer = setTimeout(dismiss, duration);

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });

  return { dismiss };
}
