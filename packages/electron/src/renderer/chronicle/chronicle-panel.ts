import type { SerializedEvent, EntitySnapshot } from '../../shared/types.js';
import { EventStore } from './event-store.js';
import { formatEvent } from './event-formatter.js';
import { aggregateEvents } from './event-aggregator.js';
import type { ChronicleEntry } from './event-aggregator.js';
import { ChronicleRenderer } from './chronicle-renderer.js';

/**
 * Chronicle panel controller.
 * Wires EventStore → EventFormatter → EventAggregator → ChronicleRenderer.
 */
export class ChroniclePanel {
  private readonly store: EventStore;
  private readonly renderer: ChronicleRenderer;
  private mode: 'prose' | 'compact' = 'prose';
  private regionFilter: { x: number; y: number; radius: number } | null = null;

  public onEntityClick: ((entityId: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.store = new EventStore();

    const contentDiv = container.querySelector('#chronicle-content');
    if (!(contentDiv instanceof HTMLElement)) {
      throw new Error('Chronicle panel requires #chronicle-content element');
    }

    this.renderer = new ChronicleRenderer(contentDiv);
    this.renderer.onEntityClick = (id) => this.onEntityClick?.(id);

    // Wire mode tab buttons
    const tabs = container.querySelectorAll('.chronicle-mode-tab');
    tabs.forEach((tab) => {
      if (!(tab instanceof HTMLElement)) return;
      tab.addEventListener('click', () => {
        const modeAttr = tab.getAttribute('data-mode');
        if (modeAttr === 'prose' || modeAttr === 'compact') {
          this.setMode(modeAttr);
        }
      });
    });
  }

  public addEvents(events: readonly SerializedEvent[]): void {
    this.store.addEvents(events);
    this.refresh();
  }

  public updateEntityNames(entities: readonly EntitySnapshot[]): void {
    this.store.updateEntityNames(entities);
    this.refresh();
  }

  public setMode(mode: 'prose' | 'compact'): void {
    this.mode = mode;
    this.updateTabStates();
    this.refresh();
  }

  public cycleMode(): void {
    this.setMode(this.mode === 'prose' ? 'compact' : 'prose');
  }

  public setRegionFilter(center: { x: number; y: number } | null): void {
    this.regionFilter = center ? { ...center, radius: 20 } : null;
    this.refresh();
  }

  public toggleRegionFilter(viewportCenter: { x: number; y: number }): void {
    if (this.regionFilter) {
      this.setRegionFilter(null);
    } else {
      this.setRegionFilter(viewportCenter);
    }
  }

  public destroy(): void {
    this.renderer.destroy();
    this.store.clear();
  }

  private updateTabStates(): void {
    const tabs = document.querySelectorAll('.chronicle-mode-tab');
    tabs.forEach((tab) => {
      if (!(tab instanceof HTMLElement)) return;
      const modeAttr = tab.getAttribute('data-mode');
      if (modeAttr === this.mode) {
        tab.classList.add('chronicle-mode-tab--active');
      } else {
        tab.classList.remove('chronicle-mode-tab--active');
      }
    });
  }

  private refresh(): void {
    const filteredEvents = this.regionFilter
      ? this.store.getFiltered({
          regionCenter: { x: this.regionFilter.x, y: this.regionFilter.y },
          regionRadius: this.regionFilter.radius,
        })
      : this.store.getAll();

    const entries = this.mode === 'prose'
      ? aggregateEvents(filteredEvents, (id) => this.store.getEntityName(id))
      : this.buildCompactEntries(filteredEvents);

    this.renderer.render(entries, this.mode, this.store.getEntityNames());
  }

  private buildCompactEntries(events: readonly SerializedEvent[]): ChronicleEntry[] {
    const sorted = [...events].sort((a, b) => a.tick - b.tick);
    const entries: ChronicleEntry[] = [];

    let lastYear = -1;
    let lastMonth = -1;

    for (const event of sorted) {
      const year = Math.floor(event.tick / 360);
      const month = Math.floor((event.tick % 360) / 30);

      // Add year header if changed
      if (year !== lastYear) {
        entries.push({
          kind: 'header',
          text: `--- Year ${year + 1} ---`,
          tick: event.tick,
        });
        lastYear = year;
        lastMonth = -1;
      }

      // Add month header if changed
      if (month !== lastMonth) {
        const displayMonth = month + 1;
        const season =
          displayMonth <= 3 ? 'Winter' : displayMonth <= 6 ? 'Spring' : displayMonth <= 9 ? 'Summer' : 'Autumn';
        entries.push({
          kind: 'header',
          text: `${season}, Month ${displayMonth}`,
          tick: event.tick,
        });
        lastMonth = month;
      }

      // Add formatted event
      const formatted = formatEvent(event, (id) => this.store.getEntityName(id));
      entries.push({
        kind: 'event',
        event,
        formatted,
      });
    }

    return entries;
  }
}
