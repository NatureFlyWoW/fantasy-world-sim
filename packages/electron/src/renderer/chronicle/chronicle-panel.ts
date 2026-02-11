import type { SerializedEvent, EntitySnapshot } from '../../shared/types.js';
import { EventStore } from './event-store.js';
import { formatEvent } from './event-formatter.js';
import { aggregateEvents, appendEvents, createAggregationState } from './event-aggregator.js';
import type { ChronicleEntry, AggregationState } from './event-aggregator.js';
import { ChronicleRenderer } from './chronicle-renderer.js';

/**
 * Chronicle panel controller.
 * Wires EventStore -> EventFormatter -> EventAggregator -> ChronicleRenderer.
 *
 * Refresh is throttled via requestAnimationFrame to avoid event-loop starvation
 * at high simulation speeds (365x). Multiple state changes within a single
 * frame are coalesced into one render pass.
 *
 * Normal tick refreshes use incremental aggregation: only newly arrived events
 * are processed and merged into the cached entry list. Mode/filter changes
 * trigger a full rebuild via `aggregateEvents()`.
 */
export class ChroniclePanel {
  private readonly store: EventStore;
  private readonly renderer: ChronicleRenderer;
  private mode: 'prose' | 'compact' = 'prose';
  private regionFilter: { x: number; y: number; radius: number } | null = null;

  /** Whether a refresh has been scheduled but not yet executed. */
  private refreshPending = false;

  /** Whether the pending refresh was triggered by a mode change (not new data). */
  private pendingModeChange = false;

  /**
   * Cached entry list from the last render pass. Passed to the renderer by
   * reference so the renderer can detect identity changes and avoid a full
   * DOM repopulation on incremental updates.
   */
  private cachedEntries: ChronicleEntry[] = [];

  /**
   * Incremental aggregation state for prose mode. Carries the group index
   * and temporal header tracking between frames so `appendEvents()` can
   * merge new events in O(k) where k = new event count.
   */
  private aggregationState: AggregationState = createAggregationState();

  public onEntityClick: ((entityId: number) => void) | null = null;
  public onEventClick: ((eventId: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.store = new EventStore();

    const contentDiv = container.querySelector('#chronicle-content');
    if (!(contentDiv instanceof HTMLElement)) {
      throw new Error('Chronicle panel requires #chronicle-content element');
    }

    this.renderer = new ChronicleRenderer(contentDiv);
    this.renderer.onEntityClick = (id) => this.onEntityClick?.(id);
    this.renderer.onEventClick = (id) => this.onEventClick?.(id);

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
    this.scheduleRefresh(false);
  }

  public updateEntityNames(entities: readonly EntitySnapshot[]): void {
    this.store.updateEntityNames(entities);
    // Don't schedule a separate refresh — addEvents in the same tick already
    // scheduled one, and entity name updates only affect display strings that
    // will be picked up by the next coalesced render.
    this.scheduleRefresh(false);
  }

  /**
   * Register a single entity name directly.
   * Used for entities that lack Position components (e.g. factions) and therefore
   * never appear in EntitySnapshot arrays, but are still referenced by events.
   */
  public registerEntityName(id: number, name: string): void {
    this.store.setEntityName(id, name);
  }

  public setMode(mode: 'prose' | 'compact'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.updateTabStates();
    this.scheduleRefresh(true);
  }

  public cycleMode(): void {
    this.setMode(this.mode === 'prose' ? 'compact' : 'prose');
  }

  public setRegionFilter(center: { x: number; y: number } | null): void {
    this.regionFilter = center ? { ...center, radius: 20 } : null;
    this.scheduleRefresh(true);
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

  /**
   * Schedule a refresh on the next animation frame. Multiple calls within
   * the same frame are coalesced — only one render pass runs.
   *
   * @param isModeChange - true if this refresh is triggered by a mode/filter
   *   change (not new data). Prevents the "New events" indicator from
   *   appearing when no events were actually added.
   */
  private scheduleRefresh(isModeChange: boolean): void {
    if (isModeChange) {
      this.pendingModeChange = true;
    }

    if (this.refreshPending) return;
    this.refreshPending = true;

    requestAnimationFrame(() => {
      this.refreshPending = false;
      const modeChange = this.pendingModeChange;
      this.pendingModeChange = false;
      this.executeRefresh(modeChange);
    });
  }

  /**
   * Build entries and hand them to the renderer.
   *
   * For normal tick refreshes (`isModeChange === false`) in prose mode, uses
   * incremental aggregation: only events added since the last refresh are
   * processed, and the cached entry list is updated in place. This reduces
   * per-frame work from O(n log n) to O(k) where k = new events.
   *
   * For mode/filter changes, performs a full rebuild via `aggregateEvents()`
   * because entry heights change and the full entry list must be recomputed.
   */
  private executeRefresh(isModeChange: boolean): void {
    if (isModeChange) {
      // ── Full rebuild ──
      // Reset incremental state so the next normal refresh starts fresh.
      this.store.resetProcessedIndex();
      this.aggregationState = createAggregationState();

      const filteredEvents = this.regionFilter
        ? this.store.getFiltered({
            regionCenter: { x: this.regionFilter.x, y: this.regionFilter.y },
            regionRadius: this.regionFilter.radius,
          })
        : this.store.getAll();

      if (this.mode === 'prose') {
        const entries = aggregateEvents(filteredEvents, (id) => this.store.getEntityName(id));
        // Re-seed incremental state from the full rebuild.
        this.aggregationState = createAggregationState();
        // Copy entries into the state so subsequent incremental appends work.
        this.aggregationState.entries = [...entries];
        // Rebuild the group index from existing aggregates/singletons.
        this.rebuildGroupIndex(this.aggregationState);
        // Track last temporal position from the entries.
        this.rebuildTemporalState(this.aggregationState);
        this.cachedEntries = this.aggregationState.entries;
        // Mark all current events as processed so getNewEvents only returns future ones.
        this.store.getNewEvents();
      } else {
        this.cachedEntries = this.buildCompactEntries(filteredEvents);
        // Mark all current events as processed.
        this.store.getNewEvents();
      }

      this.renderer.render(this.cachedEntries, this.mode, this.store.getEntityNames(), true);
      return;
    }

    // ── Incremental refresh (normal tick) ──
    if (this.regionFilter) {
      // Region filter requires checking all events — fall back to full rebuild
      // when filter is active. This is a rare path (user explicitly enabled it).
      const filteredEvents = this.store.getFiltered({
        regionCenter: { x: this.regionFilter.x, y: this.regionFilter.y },
        regionRadius: this.regionFilter.radius,
      });
      if (this.mode === 'prose') {
        const entries = aggregateEvents(filteredEvents, (id) => this.store.getEntityName(id));
        this.cachedEntries = [...entries];
      } else {
        this.cachedEntries = this.buildCompactEntries(filteredEvents);
      }
      this.store.getNewEvents(); // consume cursor
      this.renderer.render(this.cachedEntries, this.mode, this.store.getEntityNames(), false);
      return;
    }

    const newEvents = this.store.getNewEvents();
    if (newEvents.length === 0) {
      // Entity names may have updated — re-render with same entries.
      this.renderer.render(this.cachedEntries, this.mode, this.store.getEntityNames(), false);
      return;
    }

    if (this.mode === 'prose') {
      // Incremental prose aggregation
      appendEvents(
        this.aggregationState,
        newEvents,
        (id) => this.store.getEntityName(id),
      );
      // cachedEntries is the same reference as aggregationState.entries
      this.cachedEntries = this.aggregationState.entries;
    } else {
      // Compact mode: append new events in order (they arrive chronologically)
      this.appendCompactEntries(newEvents);
    }

    this.renderer.render(this.cachedEntries, this.mode, this.store.getEntityNames(), false);
  }

  /**
   * Rebuild the group index from existing entries after a full aggregateEvents()
   * call, so that subsequent incremental appends can find existing groups.
   */
  private rebuildGroupIndex(state: AggregationState): void {
    state.groupIndex.clear();
    for (let i = 0; i < state.entries.length; i++) {
      const entry = state.entries[i];
      if (entry === undefined) continue;
      if (entry.kind === 'aggregate') {
        // Reconstruct the key from the aggregate's fields.
        // The key format is: category|primaryParticipant|timeWindow
        // primaryParticipant is the first event's participant (stored in eventIds).
        // timeWindow = Math.floor(tick / 30)
        const firstEventId = entry.eventIds[0];
        if (firstEventId !== undefined) {
          // We don't have participant info directly on aggregates,
          // so we use the tick window and category. For a singleton
          // promoted to aggregate, the key was set at append time.
          // After a full rebuild, we approximate.
          const window = Math.floor(entry.tick / 30);
          // We can't recover the exact participant from the aggregate alone,
          // but the key just needs to be consistent. Use 'none' as fallback.
          const key = `${entry.category}|none|${window}`;
          state.groupIndex.set(key, i);
        }
      } else if (entry.kind === 'event' && entry.event.significance < 60) {
        const ev = entry.event;
        const primaryParticipant = ev.participants[0] ?? 'none';
        const window = Math.floor(ev.tick / 30);
        const key = `${ev.category}|${primaryParticipant}|${window}`;
        state.groupIndex.set(key, i);
      }
    }
  }

  /**
   * Rebuild temporal header tracking (lastYear, lastMonth) from existing entries
   * so that subsequent incremental appends know which headers already exist.
   */
  private rebuildTemporalState(state: AggregationState): void {
    // Walk entries in reverse to find the last temporal position.
    for (let i = state.entries.length - 1; i >= 0; i--) {
      const entry = state.entries[i];
      if (entry === undefined) continue;
      const tick = entry.kind === 'event' ? entry.event.tick : entry.tick;
      state.lastYear = Math.floor(tick / 360) + 1;
      state.lastMonth = Math.floor((tick % 360) / 30) + 1;
      break;
    }
  }

  /**
   * Build compact entries from scratch (full rebuild).
   */
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

    // Track compact-mode temporal state for incremental appends.
    this.compactLastYear = lastYear;
    this.compactLastMonth = lastMonth;

    return entries;
  }

  // ── Compact mode incremental append state ──

  private compactLastYear = -1;
  private compactLastMonth = -1;

  /**
   * Incrementally append new events to the cached compact entries list.
   * Events from ticks arrive in chronological order, so no sorting is needed.
   */
  private appendCompactEntries(newEvents: readonly SerializedEvent[]): void {
    for (const event of newEvents) {
      const year = Math.floor(event.tick / 360);
      const month = Math.floor((event.tick % 360) / 30);

      if (year !== this.compactLastYear) {
        this.cachedEntries.push({
          kind: 'header',
          text: `--- Year ${year + 1} ---`,
          tick: event.tick,
        });
        this.compactLastYear = year;
        this.compactLastMonth = -1;
      }

      if (month !== this.compactLastMonth) {
        const displayMonth = month + 1;
        const season =
          displayMonth <= 3 ? 'Winter' : displayMonth <= 6 ? 'Spring' : displayMonth <= 9 ? 'Summer' : 'Autumn';
        this.cachedEntries.push({
          kind: 'header',
          text: `${season}, Month ${displayMonth}`,
          tick: event.tick,
        });
        this.compactLastMonth = month;
      }

      const formatted = formatEvent(event, (id) => this.store.getEntityName(id));
      this.cachedEntries.push({
        kind: 'event',
        event,
        formatted,
      });
    }
  }
}
