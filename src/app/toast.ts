export function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  // role="alert"/"status" carry their own implicit aria-live (assertive/
  // polite respectively), so an error toast interrupts immediately while a
  // success toast waits its turn — independent of the region's own
  // aria-live="polite" default (index.html #toast-region).
  notification.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const region = document.getElementById('toast-region');
  (region ?? document.body).appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}
