/**
 * Context menu — right-click menus for map and chronicle.
 */

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  divider?: boolean;
  disabled?: boolean;
}

export class ContextMenu {
  private container: HTMLElement | null = null;
  private isVisible = false;

  constructor() {
    this.createContainer();
    this.attachListeners();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.className = 'context-menu';
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
  }

  private attachListeners(): void {
    document.addEventListener('click', (e) => {
      if (this.isVisible && this.container && !this.container.contains(e.target as Node)) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  public show(x: number, y: number, items: ContextMenuItem[]): void {
    if (!this.container) return;

    this.container.innerHTML = '';

    items.forEach((item) => {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'context-menu__divider';
        this.container!.appendChild(divider);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu__item';
        if (item.disabled) {
          menuItem.classList.add('context-menu__item--disabled');
        }
        menuItem.textContent = item.label;

        if (!item.disabled) {
          menuItem.addEventListener('click', () => {
            item.onClick();
            this.hide();
          });
        }

        this.container!.appendChild(menuItem);
      }
    });

    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.container.style.display = 'block';

    const rect = this.container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth - 8) {
      this.container.style.left = `${x - rect.width}px`;
    }

    if (rect.bottom > viewportHeight - 8) {
      this.container.style.top = `${y - rect.height}px`;
    }

    this.isVisible = true;
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this.isVisible = false;
    }
  }

  public destroy(): void {
    this.hide();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
