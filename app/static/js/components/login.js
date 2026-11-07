/**
 * Login Form Controller Component
 * Manages authentication card interactions, submission loading feedback,
 * error state alerts, and credential handling.
 */

export class LoginController {
  constructor(container) {
    this.container = container;
    this.form = container ? container.querySelector('form') : null;
    this.submitBtn = container ? container.querySelector('.btn-login-submit') : null;
    this.errorAlert = container ? container.querySelector('.login-error-alert') : null;

    this.init();
  }

  init() {
    if (!this.form) return;

    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });
  }

  async handleLogin() {
    const usernameInput = this.form.querySelector('input[type="text"]');
    const passwordInput = this.form.querySelector('input[type="password"]');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
      this.showError('Please enter both username and password.');
      return;
    }

    this.setLoading(true);
    this.hideError();

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (resp.ok) {
        // Authenticated successfully; reload or hide login view
        window.location.reload();
      } else {
        const data = await resp.json().catch(() => ({}));
        this.showError(data.detail || 'Invalid username or password.');
      }
    } catch (err) {
      // If /api/login is not implemented on backend, gracefully inform user
      console.warn('Login request failed:', err);
      this.showError('Authentication service currently unavailable.');
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(loading) {
    if (!this.submitBtn) return;
    this.submitBtn.disabled = loading;
    if (loading) {
      this.submitBtn.innerHTML = '<span class="stream-cursor"></span> Signing in...';
    } else {
      this.submitBtn.textContent = 'Sign In';
    }
  }

  showError(message) {
    if (!this.errorAlert) return;
    this.errorAlert.textContent = message;
    this.errorAlert.style.display = 'block';
  }

  hideError() {
    if (!this.errorAlert) return;
    this.errorAlert.style.display = 'none';
  }
}
