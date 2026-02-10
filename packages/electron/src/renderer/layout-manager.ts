export type LayoutPreset = 'default' | 'narrative' | 'map-focus' | 'log-focus' | 'split';

const PRESET_CYCLE: readonly LayoutPreset[] = ['default', 'narrative', 'map-focus', 'log-focus', 'split'] as const;

export class LayoutManager {
  private current: LayoutPreset = 'default';
  private readonly appEl: HTMLElement;

  constructor() {
    const el = document.getElementById('app');
    if (el === null) throw new Error('#app element not found');
    this.appEl = el;
  }

  cycle(): LayoutPreset {
    const idx = PRESET_CYCLE.indexOf(this.current);
    this.current = PRESET_CYCLE[(idx + 1) % PRESET_CYCLE.length]!;
    this.apply();
    return this.current;
  }

  setCurrent(preset: LayoutPreset): void {
    this.current = preset;
    this.apply();
  }

  getCurrent(): LayoutPreset {
    return this.current;
  }

  private apply(): void {
    for (const p of PRESET_CYCLE) {
      this.appEl.classList.remove(`layout--${p}`);
    }
    if (this.current !== 'default') {
      this.appEl.classList.add(`layout--${this.current}`);
    }

    // Defer canvas resize until CSS transition completes (200ms + buffer)
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 220);
  }
}
