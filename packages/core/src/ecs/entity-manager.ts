/**
 * EntityManager handles entity lifecycle.
 * Entities are just IDs - all data lives in components.
 */

import type { EntityId } from './types.js';

export class EntityManager {
  private nextId = 0;
  private alive: Set<EntityId> = new Set();

  /**
   * Create a new entity with a unique ID.
   * IDs are monotonically increasing and never recycled.
   */
  createEntity(): EntityId {
    const id = this.nextId++ as EntityId;
    this.alive.add(id);
    return id;
  }

  /**
   * Mark an entity as destroyed.
   * The ID is not recycled to prevent stale reference bugs.
   */
  destroyEntity(id: EntityId): void {
    this.alive.delete(id);
  }

  /**
   * Check if an entity is still alive.
   */
  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  /**
   * Get all living entity IDs.
   */
  getAll(): EntityId[] {
    return Array.from(this.alive);
  }

  /**
   * Get the count of living entities.
   */
  count(): number {
    return this.alive.size;
  }

  /**
   * Reset the manager (for testing).
   */
  reset(): void {
    this.nextId = 0;
    this.alive.clear();
  }
}
