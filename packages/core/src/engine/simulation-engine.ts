/**
 * SimulationEngine orchestrates the simulation loop.
 * Implements the 13-step tick execution order from design doc Section 2.2.
 *
 * Tick Order:
 * 1. TIME ADVANCE — clock.advance()
 * 2. ENVIRONMENT — weather, geology, disasters, resource regen
 * 3. ECONOMY — production, trade, markets, taxes, economic events
 * 4. POLITICS — faction leaders, diplomacy, stability, law, succession
 * 5. SOCIAL — relationships, reputation, cultural norms, family events
 * 6. CHARACTER AI — perceive → evaluate → decide → execute → remember → reflect
 * 7. MAGIC — research, mana, artifacts, institutions, wild magic
 * 8. RELIGION — divine power, prayer, intervention, church politics, prophets
 * 9. MILITARY — movement, battles, sieges, recruitment, morale
 * 10. EVENT RESOLUTION — drain event queue, execute cascades, update cause-effect graph
 * 11. NARRATIVE GENERATION — generate raw log + prose for significant events
 * 12. CLEANUP & INDEXING — spatial index, archive, LoD boundaries, world fingerprint
 * 13. PLAYER NOTIFICATION — check bookmarks, alert on high-significance events
 */

import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { EventLog } from '../events/event-log.js';
import type { SystemRegistry } from './system-registry.js';
import type { WorldEvent } from '../events/types.js';

/**
 * Callback type for tick listeners.
 */
export type TickCallback = (tick: number, events: readonly WorldEvent[]) => void;

export class SimulationEngine {
  private tickCount = 0;
  private tickListeners: Set<TickCallback> = new Set();
  private pendingEvents: WorldEvent[] = [];
  private initialized = false;

  constructor(
    private readonly world: World,
    private readonly clock: WorldClock,
    private readonly eventBus: EventBus,
    private readonly eventLog: EventLog,
    private readonly systemRegistry: SystemRegistry
  ) {
    // Subscribe to all events to capture them during tick
    this.eventBus.onAny((event) => {
      this.pendingEvents.push(event);
    });
  }

  /**
   * Initialize all registered systems.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    const systems = this.systemRegistry.getOrderedSystems();
    for (const system of systems) {
      system.initialize(this.world);
    }

    this.initialized = true;
  }

  /**
   * Execute one full tick cycle following the 13-step order.
   */
  tick(): void {
    if (!this.initialized) {
      this.initialize();
    }

    // Clear pending events from previous tick
    this.pendingEvents = [];

    // Step 1: TIME ADVANCE
    this.clock.advance();

    // Steps 2-13: Execute systems in order
    // Systems are filtered by their frequency (only run if tick % frequency === 0)
    const currentTick = this.clock.currentTick;
    const systems = this.systemRegistry.getSystemsForTick(currentTick);

    for (const system of systems) {
      system.execute(this.world, this.clock, this.eventBus);
    }

    // After all systems execute, log events from this tick
    for (const event of this.pendingEvents) {
      this.eventLog.append(event);
    }

    this.tickCount++;

    // Notify tick listeners
    for (const listener of this.tickListeners) {
      listener(currentTick, this.pendingEvents);
    }
  }

  /**
   * Execute N ticks.
   */
  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      this.tick();
    }
  }

  /**
   * Run until a condition is met.
   * @returns The number of ticks elapsed
   */
  runUntil(condition: () => boolean, maxTicks = 100000): number {
    let elapsed = 0;
    while (!condition() && elapsed < maxTicks) {
      this.tick();
      elapsed++;
    }
    return elapsed;
  }

  /**
   * Get the total number of ticks executed.
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Get the current tick from the clock.
   */
  getCurrentTick(): number {
    return this.clock.currentTick;
  }

  /**
   * Register a callback to be called after each tick.
   * @returns Unsubscribe function
   */
  onTick(callback: TickCallback): () => void {
    this.tickListeners.add(callback);
    return () => {
      this.tickListeners.delete(callback);
    };
  }

  /**
   * Get events generated during the most recent tick.
   */
  getLastTickEvents(): readonly WorldEvent[] {
    return this.pendingEvents;
  }

  /**
   * Check if the engine has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup all systems.
   */
  cleanup(): void {
    const systems = this.systemRegistry.getOrderedSystems();
    for (const system of systems) {
      if (system.cleanup !== undefined) {
        system.cleanup();
      }
    }
    this.initialized = false;
  }

  /**
   * Reset the engine state (for testing).
   */
  reset(): void {
    this.cleanup();
    this.tickCount = 0;
    this.pendingEvents = [];
    this.tickListeners.clear();
  }
}
