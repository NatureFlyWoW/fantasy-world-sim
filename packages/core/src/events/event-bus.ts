/**
 * EventBus provides pub/sub messaging for the event system.
 * Systems subscribe to events by category or subtype and receive notifications.
 */

import type { EventCategory, WorldEvent, EventHandler, Unsubscribe } from './types.js';

export class EventBus {
  private categoryHandlers: Map<EventCategory, Set<EventHandler>> = new Map();
  private subtypeHandlers: Map<string, Set<EventHandler>> = new Map();
  private anyHandlers: Set<EventHandler> = new Set();

  /**
   * Subscribe to all events of a specific category.
   * @returns Unsubscribe function
   */
  on(category: EventCategory, handler: EventHandler): Unsubscribe {
    let handlers = this.categoryHandlers.get(category);
    if (handlers === undefined) {
      handlers = new Set();
      this.categoryHandlers.set(category, handlers);
    }
    handlers.add(handler);

    return (): void => {
      handlers.delete(handler);
    };
  }

  /**
   * Subscribe to events of a specific subtype (e.g., "character.death").
   * @returns Unsubscribe function
   */
  onSubtype(subtype: string, handler: EventHandler): Unsubscribe {
    let handlers = this.subtypeHandlers.get(subtype);
    if (handlers === undefined) {
      handlers = new Set();
      this.subtypeHandlers.set(subtype, handlers);
    }
    handlers.add(handler);

    return (): void => {
      handlers.delete(handler);
    };
  }

  /**
   * Subscribe to all events regardless of category or subtype.
   * @returns Unsubscribe function
   */
  onAny(handler: EventHandler): Unsubscribe {
    this.anyHandlers.add(handler);

    return (): void => {
      this.anyHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all relevant handlers.
   * Order: subtype handlers → category handlers → any handlers
   */
  emit(event: WorldEvent): void {
    // First, call subtype-specific handlers
    const subtypeHandlers = this.subtypeHandlers.get(event.subtype);
    if (subtypeHandlers !== undefined) {
      for (const handler of subtypeHandlers) {
        handler(event);
      }
    }

    // Then, call category handlers
    const categoryHandlers = this.categoryHandlers.get(event.category);
    if (categoryHandlers !== undefined) {
      for (const handler of categoryHandlers) {
        handler(event);
      }
    }

    // Finally, call any-event handlers
    for (const handler of this.anyHandlers) {
      handler(event);
    }
  }

  /**
   * Get the number of handlers registered for a category.
   */
  categoryHandlerCount(category: EventCategory): number {
    return this.categoryHandlers.get(category)?.size ?? 0;
  }

  /**
   * Get the number of handlers registered for a subtype.
   */
  subtypeHandlerCount(subtype: string): number {
    return this.subtypeHandlers.get(subtype)?.size ?? 0;
  }

  /**
   * Get the number of any-event handlers.
   */
  anyHandlerCount(): number {
    return this.anyHandlers.size;
  }

  /**
   * Clear all handlers (for testing).
   */
  clear(): void {
    this.categoryHandlers.clear();
    this.subtypeHandlers.clear();
    this.anyHandlers.clear();
  }
}
