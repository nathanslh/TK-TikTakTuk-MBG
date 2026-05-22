/**
 * Toast Notification Utility
 * Display success or error messages using toast notifications
 */

function showToast(message, type = 'success', duration = 3000) {
  const toastRoot = document.getElementById('toast-root');
  
  if (!toastRoot) {
    console.error('Toast root not found');
    return;
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
  toast.textContent = message;

  toastRoot.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

function showSuccessToast(message, duration = 3000) {
  showToast(message, 'success', duration);
}

function showErrorToast(message, duration = 5000) {
  showToast(message, 'error', duration);
}
