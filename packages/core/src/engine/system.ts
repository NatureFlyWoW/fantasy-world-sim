/**
 * System interface for simulation systems.
 * Systems process entities with specific components and produce events.
 */

import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { TickFrequency } from '../time/types.js';

/**
 * Execution order constants matching the 13-step tick order from design doc Section 2.2.
 */
export const ExecutionOrder = {
  TIME_ADVANCE: 10,
  ENVIRONMENT: 20,
  ECONOMY: 30,
  POPULATION: 35,
  POLITICS: 40,
  SETTLEMENT_LIFECYCLE: 45,
  SOCIAL: 50,
  CHARACTER_AI: 60,
  EXPLORATION: 65,
  MAGIC: 70,
  RELIGION: 80,
  MILITARY: 90,
  EVENT_RESOLUTION: 100,
  NARRATIVE_GENERATION: 110,
  CLEANUP_INDEXING: 120,
  PLAYER_NOTIFICATION: 130,
} as const;

export type ExecutionOrderValue = (typeof ExecutionOrder)[keyof typeof ExecutionOrder];

/**
 * System interface that all simulation systems must implement.
 */
export interface System {
  /** Unique name identifying this system */
  readonly name: string;

  /** How often this system runs (Daily, Weekly, etc.) */
  readonly frequency: TickFrequency;

  /** Execution order within a tick (1-13, matching the tick order) */
  readonly executionOrder: ExecutionOrderValue;

  /**
   * Initialize the system with the world state.
   * Called once when the simulation starts.
   */
  initialize(world: World): void;

  /**
   * Execute the system's logic for this tick.
   * @param world The ECS world
   * @param clock The world clock for current time
   * @param events The event bus for emitting events
   */
  execute(world: World, clock: WorldClock, events: EventBus): void;

  /**
   * Optional cleanup when simulation stops.
   */
  cleanup?(): void;
}

/**
 * Abstract base class for systems that provides common functionality.
 */
export abstract class BaseSystem implements System {
  abstract readonly name: string;
  abstract readonly frequency: TickFrequency;
  abstract readonly executionOrder: ExecutionOrderValue;

  private initialized = false;

  initialize(_world: World): void {
    this.initialized = true;
  }

  abstract execute(world: World, clock: WorldClock, events: EventBus): void;

  cleanup(): void {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
