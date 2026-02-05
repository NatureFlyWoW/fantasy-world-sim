/**
 * Event system types for the simulation.
 * Events are the primary communication mechanism between systems.
 */

import type { EntityId, EventId, SiteId } from '../ecs/types.js';

/**
 * Event categories from the design doc (Section 2.4).
 * Each category represents a domain of world simulation.
 */
export enum EventCategory {
  Political = 'Political',
  Magical = 'Magical',
  Cultural = 'Cultural',
  Religious = 'Religious',
  Scientific = 'Scientific',
  Personal = 'Personal',
  Exploratory = 'Exploratory',
  Economic = 'Economic',
  Disaster = 'Disaster',
  Military = 'Military',
}

/**
 * WorldTime type - will be replaced with proper time module type later.
 * For now, represents the tick number.
 */
export type WorldTime = number;

/**
 * Consequence rule defines a possible follow-on event.
 * Used by the event cascade system to determine what events an event might trigger.
 */
export interface ConsequenceRule {
  /** What kind of event this might produce (e.g., "faction.reputation_change") */
  eventSubtype: string;
  /** Base probability (0-1) of this consequence occurring */
  baseProbability: number;
  /** Which domain the consequence belongs to */
  category: EventCategory;
  /** How many ticks before this consequence fires */
  delayTicks: number;
  /** Probability reduction multiplier for each level of chain depth (0-1) */
  dampening: number;
  /** Optional name of a function that modifies probability based on world state */
  evaluator?: string;
}

/**
 * WorldEvent is the core event type used throughout the simulation.
 * Events are immutable records of things that happened in the world.
 */
export interface WorldEvent {
  /** Unique identifier for this event */
  readonly id: EventId;
  /** High-level category for routing to appropriate systems */
  readonly category: EventCategory;
  /** Specific event type (e.g., "character.death", "battle.resolved") */
  readonly subtype: string;
  /** When this event occurred (tick number) */
  readonly timestamp: WorldTime;
  /** All entities involved in this event */
  readonly participants: readonly EntityId[];
  /** Where the event happened (optional for abstract events) */
  readonly location?: SiteId;
  /** Events that caused this event (for causal chain tracking) */
  readonly causes: readonly EventId[];
  /** Events triggered by this event (filled as cascade resolves) */
  consequences: EventId[];
  /** Event-specific payload data */
  readonly data: Readonly<Record<string, unknown>>;
  /** Importance rating 0-100, determines narrative treatment */
  readonly significance: number;
  /** Possible follow-on events that might be triggered */
  readonly consequencePotential: readonly ConsequenceRule[];
  /** Optional delay in ticks before consequences fire */
  readonly temporalOffset?: number;
}

/**
 * Handler function type for event subscriptions.
 */
export type EventHandler = (event: WorldEvent) => void;

/**
 * Unsubscribe function returned by subscription methods.
 */
export type Unsubscribe = () => void;
