/**
 * SystemRegistry manages the collection of simulation systems.
 * Provides methods for registering, ordering, and filtering systems by frequency.
 */

import type { System } from './system.js';
import type { TickFrequency } from '../time/types.js';

export class SystemRegistry {
  private systems: Map<string, System> = new Map();

  /**
   * Register a system.
   * @throws Error if a system with the same name is already registered
   */
  register(system: System): void {
    if (this.systems.has(system.name)) {
      throw new Error(`System '${system.name}' is already registered`);
    }
    this.systems.set(system.name, system);
  }

  /**
   * Unregister a system by name.
   */
  unregister(name: string): void {
    this.systems.delete(name);
  }

  /**
   * Get a system by name.
   */
  get(name: string): System | undefined {
    return this.systems.get(name);
  }

  /**
   * Check if a system is registered.
   */
  has(name: string): boolean {
    return this.systems.has(name);
  }

  /**
   * Get all systems sorted by execution order.
   */
  getOrderedSystems(): System[] {
    const systems = Array.from(this.systems.values());
    return systems.sort((a, b) => a.executionOrder - b.executionOrder);
  }

  /**
   * Get systems that should run on the given tick, sorted by execution order.
   * Systems run when: tick % frequency === 0
   */
  getSystemsForTick(tick: number): System[] {
    const systems = Array.from(this.systems.values()).filter((system) => {
      return tick % system.frequency === 0;
    });
    return systems.sort((a, b) => a.executionOrder - b.executionOrder);
  }

  /**
   * Get all systems with a specific frequency.
   */
  getSystemsByFrequency(frequency: TickFrequency): System[] {
    return Array.from(this.systems.values()).filter(
      (system) => system.frequency === frequency
    );
  }

  /**
   * Get all systems with a specific execution order.
   */
  getSystemsByOrder(order: number): System[] {
    return Array.from(this.systems.values()).filter(
      (system) => system.executionOrder === order
    );
  }

  /**
   * Get the total count of registered systems.
   */
  count(): number {
    return this.systems.size;
  }

  /**
   * Get all system names.
   */
  getNames(): string[] {
    return Array.from(this.systems.keys());
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.systems.clear();
  }
}
