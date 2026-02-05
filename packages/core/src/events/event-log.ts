/**
 * EventLog is an append-only historical record of all events.
 * Provides efficient querying by various criteria using multiple indexes.
 */

import type { EntityId, EventId } from '../ecs/types.js';
import type { EventCategory, WorldEvent, WorldTime } from './types.js';

export class EventLog {
  /** Primary storage: id → event */
  private byId: Map<EventId, WorldEvent> = new Map();

  /** Index: entityId → eventIds where entity participated */
  private byEntity: Map<EntityId, EventId[]> = new Map();

  /** Index: category → eventIds */
  private byCategory: Map<EventCategory, EventId[]> = new Map();

  /** Sorted array of events by timestamp for range queries */
  private byTime: WorldEvent[] = [];

  /**
   * Append an event to the log.
   * Automatically indexes by id, entity, category, and time.
   */
  append(event: WorldEvent): void {
    // Store in primary index
    this.byId.set(event.id, event);

    // Index by each participant entity
    for (const entityId of event.participants) {
      let entityEvents = this.byEntity.get(entityId);
      if (entityEvents === undefined) {
        entityEvents = [];
        this.byEntity.set(entityId, entityEvents);
      }
      entityEvents.push(event.id);
    }

    // Index by category
    let categoryEvents = this.byCategory.get(event.category);
    if (categoryEvents === undefined) {
      categoryEvents = [];
      this.byCategory.set(event.category, categoryEvents);
    }
    categoryEvents.push(event.id);

    // Insert into time-sorted array (maintain sorted order)
    this.insertByTime(event);
  }

  /**
   * Get an event by its ID.
   */
  getById(id: EventId): WorldEvent | undefined {
    return this.byId.get(id);
  }

  /**
   * Get all events within a time range (inclusive).
   */
  getByTimeRange(start: WorldTime, end: WorldTime): WorldEvent[] {
    // Binary search for start index
    const startIndex = this.findFirstIndexAtOrAfter(start);
    if (startIndex === -1) {
      return [];
    }

    // Collect events until we exceed end time
    const result: WorldEvent[] = [];
    for (let i = startIndex; i < this.byTime.length; i++) {
      const event = this.byTime[i];
      if (event === undefined || event.timestamp > end) {
        break;
      }
      result.push(event);
    }

    return result;
  }

  /**
   * Get all events involving a specific entity.
   */
  getByEntity(entityId: EntityId): WorldEvent[] {
    const eventIds = this.byEntity.get(entityId);
    if (eventIds === undefined) {
      return [];
    }

    const result: WorldEvent[] = [];
    for (const id of eventIds) {
      const event = this.byId.get(id);
      if (event !== undefined) {
        result.push(event);
      }
    }

    return result;
  }

  /**
   * Get all events of a specific category.
   */
  getByCategory(category: EventCategory): WorldEvent[] {
    const eventIds = this.byCategory.get(category);
    if (eventIds === undefined) {
      return [];
    }

    const result: WorldEvent[] = [];
    for (const id of eventIds) {
      const event = this.byId.get(id);
      if (event !== undefined) {
        result.push(event);
      }
    }

    return result;
  }

  /**
   * Get all events with significance above a threshold.
   */
  getBySignificanceAbove(threshold: number): WorldEvent[] {
    const result: WorldEvent[] = [];
    for (const event of this.byId.values()) {
      if (event.significance > threshold) {
        result.push(event);
      }
    }
    return result;
  }

  /**
   * Walk the causal chain backward from an event.
   * Returns all events that directly or indirectly caused this event.
   */
  getChain(eventId: EventId): WorldEvent[] {
    const result: WorldEvent[] = [];
    const visited = new Set<EventId>();
    const queue: EventId[] = [eventId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === undefined || visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const event = this.byId.get(currentId);
      if (event === undefined) {
        continue;
      }

      // Don't include the starting event itself
      if (currentId !== eventId) {
        result.push(event);
      }

      // Add all causes to the queue
      for (const causeId of event.causes) {
        if (!visited.has(causeId)) {
          queue.push(causeId);
        }
      }
    }

    return result;
  }

  /**
   * Walk the consequence cascade forward from an event.
   * Returns all events that were directly or indirectly caused by this event.
   */
  getCascade(eventId: EventId): WorldEvent[] {
    const result: WorldEvent[] = [];
    const visited = new Set<EventId>();
    const queue: EventId[] = [eventId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === undefined || visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const event = this.byId.get(currentId);
      if (event === undefined) {
        continue;
      }

      // Don't include the starting event itself
      if (currentId !== eventId) {
        result.push(event);
      }

      // Add all consequences to the queue
      for (const consequenceId of event.consequences) {
        if (!visited.has(consequenceId)) {
          queue.push(consequenceId);
        }
      }
    }

    return result;
  }

  /**
   * Get the total number of events in the log.
   */
  getCount(): number {
    return this.byId.size;
  }

  /**
   * Get all events in chronological order.
   */
  getAll(): WorldEvent[] {
    return [...this.byTime];
  }

  /**
   * Clear all events (for testing).
   */
  clear(): void {
    this.byId.clear();
    this.byEntity.clear();
    this.byCategory.clear();
    this.byTime = [];
  }

  /**
   * Insert an event into the time-sorted array, maintaining order.
   */
  private insertByTime(event: WorldEvent): void {
    // Binary search to find insertion point
    let left = 0;
    let right = this.byTime.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midEvent = this.byTime[mid];
      if (midEvent !== undefined && midEvent.timestamp <= event.timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Insert at the found position
    this.byTime.splice(left, 0, event);
  }

  /**
   * Binary search to find the first event at or after a given time.
   * Returns -1 if no such event exists.
   */
  private findFirstIndexAtOrAfter(time: WorldTime): number {
    let left = 0;
    let right = this.byTime.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midEvent = this.byTime[mid];
      if (midEvent !== undefined && midEvent.timestamp < time) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left < this.byTime.length ? left : -1;
  }
}
