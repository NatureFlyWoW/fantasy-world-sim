export type ToastCategory = 'info' | 'warning' | 'event';

export class NotificationManager {
  private readonly containerEl: HTMLDivElement;

  constructor() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'toast-container';
    document.body.appendChild(this.containerEl);
  }

  show(message: string, category: ToastCategory = 'info', duration = 4000): void {
    const toast = document.createElement('div');
    toast.className = `toast toast--${category}`;
    toast.textContent = message;
    this.containerEl.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      }, { once: true });
    }, duration);
  }

  showEvent(eventType: string, description: string, duration = 5000): void {
    const toast = document.createElement('div');
    toast.className = 'toast toast--event';
    toast.innerHTML = `<strong>${eventType}</strong><br>${description}`;
    this.containerEl.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      }, { once: true });
    }, duration);
  }
}
