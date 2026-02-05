/**
 * EventFactory provides helpers for creating WorldEvents.
 * Handles auto-generation of EventIds and default values.
 */

import type { EntityId, EventId, SiteId } from '../ecs/types.js';
import type { EventCategory, WorldEvent, WorldTime, ConsequenceRule } from './types.js';

let nextEventId = 0;

/**
 * Generate the next EventId.
 */
function generateEventId(): EventId {
  return nextEventId++ as EventId;
}

/**
 * Reset the EventId counter (for testing).
 */
export function resetEventIdCounter(): void {
  nextEventId = 0;
}

/**
 * Options for creating an event.
 */
export interface CreateEventOptions {
  /** High-level category */
  category: EventCategory;
  /** Specific event type (e.g., "character.death") */
  subtype: string;
  /** When the event occurred */
  timestamp: WorldTime;
  /** All entities involved */
  participants: EntityId[];
  /** Importance rating 0-100 */
  significance: number;
  /** Event-specific data */
  data?: Record<string, unknown>;
  /** Where it happened (optional) */
  location?: SiteId;
  /** Events that caused this one */
  causes?: EventId[];
  /** Possible follow-on events */
  consequencePotential?: ConsequenceRule[];
  /** Delay before consequences fire */
  temporalOffset?: number;
}

/**
 * Create a new WorldEvent with auto-generated ID.
 */
export function createEvent(options: CreateEventOptions): WorldEvent {
  const event: WorldEvent = {
    id: generateEventId(),
    category: options.category,
    subtype: options.subtype,
    timestamp: options.timestamp,
    participants: [...options.participants],
    causes: options.causes !== undefined ? [...options.causes] : [],
    consequences: [],
    data: options.data !== undefined ? { ...options.data } : {},
    significance: options.significance,
    consequencePotential:
      options.consequencePotential !== undefined ? [...options.consequencePotential] : [],
  };

  // Only add optional properties if they're defined
  if (options.location !== undefined) {
    (event as { location: SiteId }).location = options.location;
  }
  if (options.temporalOffset !== undefined) {
    (event as { temporalOffset: number }).temporalOffset = options.temporalOffset;
  }

  return event;
}

/**
 * Create a simple event with minimal required fields.
 * Convenience function for common cases.
 */
export function createSimpleEvent(
  category: EventCategory,
  subtype: string,
  participants: EntityId[],
  significance: number,
  data?: Record<string, unknown>
): WorldEvent {
  const options: CreateEventOptions = {
    category,
    subtype,
    timestamp: 0, // Default to tick 0, caller should override
    participants,
    significance,
  };

  if (data !== undefined) {
    options.data = data;
  }

  return createEvent(options);
}

/**
 * Create a consequence event that references its cause.
 */
export function createConsequenceEvent(
  cause: WorldEvent,
  options: Omit<CreateEventOptions, 'causes'>
): WorldEvent {
  return createEvent({
    ...options,
    causes: [cause.id],
  });
}

/**
 * Link an event as a consequence of another.
 * Mutates the cause event's consequences array.
 */
export function linkConsequence(cause: WorldEvent, consequence: WorldEvent): void {
  cause.consequences.push(consequence.id);
}
