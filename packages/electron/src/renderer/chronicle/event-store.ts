import type { SerializedEvent, EntitySnapshot } from '../../shared/types.js';

export interface ChronicleFilter {
  readonly categories?: ReadonlySet<string>;
  readonly minSignificance?: number;
  readonly regionCenter?: { readonly x: number; readonly y: number };
  readonly regionRadius?: number;
}

/**
 * Accumulates SerializedEvent objects from tick deltas and provides entity name resolution.
 *
 * Supports incremental retrieval via `getNewEvents()` so that downstream consumers
 * (aggregator, renderer) can process only the events added since their last call
 * instead of re-processing the entire store every frame.
 */
export class EventStore {
  private events: SerializedEvent[] = [];
  private entityNames = new Map<number, string>();
  private readonly MAX_EVENTS = 5000;

  /**
   * Index into `events` up to which `getNewEvents()` has already returned.
   * Adjusted when oldest events are trimmed by `addEvents()`.
   */
  private lastProcessedIndex = 0;

  /**
   * Add new events to the store. If total exceeds MAX_EVENTS, removes oldest events.
   */
  addEvents(events: readonly SerializedEvent[]): void {
    this.events.push(...events);

    if (this.events.length > this.MAX_EVENTS) {
      const excess = this.events.length - this.MAX_EVENTS;
      this.events.splice(0, excess);
      // Adjust the processed cursor so it stays valid after trimming.
      this.lastProcessedIndex = Math.max(0, this.lastProcessedIndex - excess);
    }
  }

  /**
   * Return events added since the last call to `getNewEvents()`.
   * Updates the internal cursor so subsequent calls only return truly new events.
   */
  getNewEvents(): readonly SerializedEvent[] {
    const start = this.lastProcessedIndex;
    this.lastProcessedIndex = this.events.length;
    if (start >= this.events.length) return [];
    return this.events.slice(start);
  }

  /**
   * Return all events starting from `startIndex`.
   * Does NOT advance the internal cursor — useful for one-off reads.
   */
  getAllFromIndex(startIndex: number): readonly SerializedEvent[] {
    if (startIndex >= this.events.length) return [];
    return this.events.slice(startIndex);
  }

  /**
   * Update entity names from entity snapshots.
   */
  updateEntityNames(entities: readonly EntitySnapshot[]): void {
    for (const entity of entities) {
      this.entityNames.set(entity.id, entity.name);
    }
  }

  /**
   * Register a single entity name directly (e.g. for factions that lack Position components).
   */
  setEntityName(id: number, name: string): void {
    this.entityNames.set(id, name);
  }

  /**
   * Resolve entity ID to name with fallback.
   */
  getEntityName(id: number): string {
    return this.entityNames.get(id) ?? `Entity #${id}`;
  }

  /**
   * Get all events without filtering.
   */
  getAll(): readonly SerializedEvent[] {
    return this.events;
  }

  /**
   * Get events matching the provided filter criteria.
   */
  getFiltered(filter: ChronicleFilter): readonly SerializedEvent[] {
    return this.events.filter(event => {
      // Category filter
      if (filter.categories !== undefined && filter.categories.size > 0) {
        if (!filter.categories.has(event.category)) {
          return false;
        }
      }

      // Significance filter
      if (filter.minSignificance !== undefined) {
        if (event.significance < filter.minSignificance) {
          return false;
        }
      }

      // Region filter - not implemented yet (needs entity position data)
      // Will be enhanced when we have spatial data per event
      if (filter.regionCenter !== undefined && filter.regionRadius !== undefined) {
        // Pass through for now - spatial filtering will be added later
        // when we have entity positions included in tick deltas
      }

      return true;
    });
  }

  /**
   * Get the entity names map for linkification.
   */
  getEntityNames(): ReadonlyMap<number, string> {
    return this.entityNames;
  }

  /**
   * Reset the incremental cursor so the next `getNewEvents()` replays everything.
   * Called on mode/filter change that requires a full rebuild.
   */
  resetProcessedIndex(): void {
    this.lastProcessedIndex = 0;
  }

  /**
   * Clear all events and entity names.
   */
  clear(): void {
    this.events = [];
    this.entityNames.clear();
    this.lastProcessedIndex = 0;
  }
}
