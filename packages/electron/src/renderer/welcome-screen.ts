/**
 * Welcome screen modal shown during world generation and warmup ticks.
 * Displays animated hourglass glyph and loading message.
 */
export class WelcomeScreen {
  private backdrop: HTMLElement | null = null;
  private dotsInterval: number | null = null;
  private hourglassInterval: number | null = null;
  private hourglassFrame = 0;

  private readonly HOURGLASS_FRAMES = ['\u23F3', '\u231B', '\u23F3', '\u231B'];

  constructor() {
    this.createElements();
  }

  private createElements(): void {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.style.display = 'none';

    const modal = document.createElement('div');
    modal.className = 'modal welcome-modal';

    const header = document.createElement('div');
    header.className = 'modal__header';
    const title = document.createElement('h1');
    title.className = 'modal__title';
    title.textContent = '\u00C6ternum';
    header.appendChild(title);

    const body = document.createElement('div');
    body.className = 'modal__body';

    const hourglass = document.createElement('div');
    hourglass.className = 'welcome-hourglass';
    hourglass.textContent = this.HOURGLASS_FRAMES[0]!;

    const message = document.createElement('div');
    message.className = 'welcome-message';
    message.textContent = 'Generating world';

    const dots = document.createElement('span');
    dots.className = 'welcome-dots';
    message.appendChild(dots);

    body.appendChild(hourglass);
    body.appendChild(message);

    modal.appendChild(header);
    modal.appendChild(body);
    this.backdrop.appendChild(modal);

    document.body.appendChild(this.backdrop);
  }

  public show(): void {
    if (!this.backdrop) return;

    this.backdrop.style.display = 'flex';

    const dotsElement = this.backdrop.querySelector('.welcome-dots');
    let dotCount = 0;
    this.dotsInterval = window.setInterval(() => {
      if (dotsElement) {
        dotsElement.textContent = '.'.repeat(dotCount % 4);
        dotCount++;
      }
    }, 500);

    const hourglassElement = this.backdrop.querySelector('.welcome-hourglass');
    this.hourglassInterval = window.setInterval(() => {
      this.hourglassFrame = (this.hourglassFrame + 1) % this.HOURGLASS_FRAMES.length;
      if (hourglassElement) {
        hourglassElement.textContent = this.HOURGLASS_FRAMES[this.hourglassFrame]!;
      }
    }, 250);
  }

  public hide(): void {
    if (!this.backdrop) return;

    if (this.dotsInterval !== null) {
      clearInterval(this.dotsInterval);
      this.dotsInterval = null;
    }
    if (this.hourglassInterval !== null) {
      clearInterval(this.hourglassInterval);
      this.hourglassInterval = null;
    }

    this.backdrop.style.opacity = '0';
    setTimeout(() => {
      if (this.backdrop) {
        this.backdrop.style.display = 'none';
        this.backdrop.style.opacity = '1';
      }
    }, 150);
  }

  public destroy(): void {
    this.hide();
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
  }
}
