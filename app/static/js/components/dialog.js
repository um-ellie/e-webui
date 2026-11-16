/**
 * Accessible In-App Modal Dialog System
 * Replaces native window.alert, window.confirm, and window.prompt.
 * Complies with strict accessibility, keyboard controls (Esc, Enter),
 * focus management, and theme aesthetics.
 */

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Show an accessible in-app confirmation dialog.
 * @param {Object} options
 * @param {string} options.title - Dialog heading
 * @param {string} options.message - Descriptive text
 * @param {string} [options.confirmText='Confirm'] - Action button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {boolean} [options.danger=false] - If true, uses warning/danger styling
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
export function showConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'app-dialog-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'app-dialog-title');

    const card = document.createElement('div');
    card.className = 'app-dialog-card';

    card.innerHTML = `
      <div class="app-dialog-header">
        <h3 id="app-dialog-title" class="app-dialog-title">${escapeHtml(title)}</h3>
      </div>
      <div class="app-dialog-body">
        <p class="app-dialog-message">${escapeHtml(message)}</p>
      </div>
      <div class="app-dialog-actions">
        <button type="button" class="btn-dialog-cancel">${escapeHtml(cancelText)}</button>
        <button type="button" class="btn-dialog-confirm ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmText)}</button>
      </div>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const btnCancel = card.querySelector('.btn-dialog-cancel');
    const btnConfirm = card.querySelector('.btn-dialog-confirm');

    const close = (result) => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.classList.add('closing');
      setTimeout(() => {
        if (backdrop.parentElement) {
          backdrop.remove();
        }
      }, 150);
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        close(true);
      }
    };

    btnCancel.addEventListener('click', () => close(false));
    btnConfirm.addEventListener('click', () => close(true));

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        close(false);
      }
    });

    document.addEventListener('keydown', onKeyDown);

    // Focus cancel button or confirm button after paint
    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      if (danger) {
        btnCancel.focus();
      } else {
        btnConfirm.focus();
      }
    });
  });
}

/**
 * Show an accessible in-app prompt dialog with an input field.
 * @param {Object} options
 * @param {string} options.title - Dialog heading
 * @param {string} [options.message=''] - Optional description
 * @param {string} [options.defaultValue=''] - Initial input value
 * @param {string} [options.placeholder=''] - Input placeholder
 * @param {string} [options.confirmText='Save'] - Save button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {number} [options.maxLength=120] - Max character length
 * @returns {Promise<string | null>} Resolves to trimmed string if saved, null if cancelled
 */
export function showPromptDialog({
  title,
  message = '',
  defaultValue = '',
  placeholder = '',
  confirmText = 'Save',
  cancelText = 'Cancel',
  maxLength = 120
}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'app-dialog-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'app-dialog-title');

    const card = document.createElement('div');
    card.className = 'app-dialog-card';

    card.innerHTML = `
      <div class="app-dialog-header">
        <h3 id="app-dialog-title" class="app-dialog-title">${escapeHtml(title)}</h3>
      </div>
      <div class="app-dialog-body">
        ${message ? `<p class="app-dialog-message">${escapeHtml(message)}</p>` : ''}
        <div class="app-dialog-input-wrap">
          <input
            type="text"
            class="app-dialog-input"
            dir="auto"
            maxlength="${maxLength}"
            placeholder="${escapeHtml(placeholder)}"
            value="${escapeHtml(defaultValue)}"
          />
          <div class="app-dialog-error" style="display:none"></div>
        </div>
      </div>
      <div class="app-dialog-actions">
        <button type="button" class="btn-dialog-cancel">${escapeHtml(cancelText)}</button>
        <button type="button" class="btn-dialog-confirm btn-primary">${escapeHtml(confirmText)}</button>
      </div>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const input = card.querySelector('.app-dialog-input');
    const errorEl = card.querySelector('.app-dialog-error');
    const btnCancel = card.querySelector('.btn-dialog-cancel');
    const btnConfirm = card.querySelector('.btn-dialog-confirm');

    const close = (result) => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.classList.add('closing');
      setTimeout(() => {
        if (backdrop.parentElement) {
          backdrop.remove();
        }
      }, 150);
      resolve(result);
    };

    const submit = () => {
      const val = input.value.trim();
      if (!val) {
        errorEl.textContent = 'Name cannot be empty';
        errorEl.style.display = 'block';
        input.focus();
        return;
      }
      close(val);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    };

    btnCancel.addEventListener('click', () => close(null));
    btnConfirm.addEventListener('click', submit);

    input.addEventListener('input', () => {
      if (errorEl.style.display !== 'none') {
        errorEl.style.display = 'none';
      }
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        close(null);
      }
    });

    document.addEventListener('keydown', onKeyDown);

    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      input.focus();
      input.select();
    });
  });
}
