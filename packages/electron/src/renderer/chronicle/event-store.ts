import type { SerializedEvent, EntitySnapshot } from '../../shared/types.js';

export interface ChronicleFilter {
  readonly categories?: ReadonlySet<string>;
  readonly minSignificance?: number;
  readonly regionCenter?: { readonly x: number; readonly y: number };
  readonly regionRadius?: number;
}

/**
 * Accumulates SerializedEvent objects from tick deltas and provides entity name resolution.
 */
export class EventStore {
  private events: SerializedEvent[] = [];
  private entityNames = new Map<number, string>();
  private readonly MAX_EVENTS = 5000;

  /**
   * Add new events to the store. If total exceeds MAX_EVENTS, removes oldest events.
   */
  addEvents(events: readonly SerializedEvent[]): void {
    this.events.push(...events);

    if (this.events.length > this.MAX_EVENTS) {
      const excess = this.events.length - this.MAX_EVENTS;
      this.events.splice(0, excess);
    }
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
   * Clear all events and entity names.
   */
  clear(): void {
    this.events = [];
    this.entityNames.clear();
  }
}
