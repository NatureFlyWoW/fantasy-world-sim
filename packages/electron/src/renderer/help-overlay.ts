export class HelpOverlay {
  private readonly el: HTMLDivElement;
  private visible = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'help-overlay';
    this.el.innerHTML = this.buildContent();
    document.body.appendChild(this.el);

    // Close on backdrop click
    this.el.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.el.querySelector('.help-overlay__backdrop')) {
        this.hide();
      }
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.classList.toggle('visible', this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  hide(): void {
    this.visible = false;
    this.el.classList.remove('visible');
  }

  private buildContent(): string {
    return `
      <div class="help-overlay__backdrop"></div>
      <div class="help-overlay__content">
        <h2>Keyboard Shortcuts</h2>
        ${this.buildSection('Global', [
          ['Space', 'Pause / Resume'],
          ['L', 'Cycle layout preset'],
          ['O', 'Cycle map overlay'],
          ['F1', 'Toggle this help'],
          ['Escape', 'Close / Deselect'],
        ])}
        ${this.buildSection('Map', [
          ['W/A/S/D', 'Pan map'],
          ['+/-', 'Zoom in/out'],
          ['Click', 'Inspect entity'],
        ])}
        ${this.buildSection('Inspector', [
          ['1-9', 'Toggle sections'],
          ['Backspace', 'Navigate back'],
          ['G', 'Center map on entity'],
        ])}
        ${this.buildSection('Chronicle', [
          ['N', 'Cycle display mode'],
          ['R', 'Toggle region filter'],
        ])}
      </div>
    `;
  }

  private buildSection(title: string, shortcuts: readonly (readonly [string, string])[]): string {
    const rows = shortcuts
      .map(([key, desc]) => `<div class="help-overlay__row"><kbd>${key}</kbd>${desc}</div>`)
      .join('');
    return `<div class="help-overlay__section"><h3>${title}</h3>${rows}</div>`;
  }
}
