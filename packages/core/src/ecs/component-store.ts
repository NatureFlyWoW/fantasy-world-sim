/**
 * ComponentStore provides O(1) component lookup by entity ID.
 * Each component type has its own store.
 */

import type { EntityId } from './types.js';
import type { Component } from './component.js';

export class ComponentStore<T extends Component> {
  private components: Map<EntityId, T> = new Map();

  /**
   * Set a component for an entity.
   * Overwrites any existing component.
   */
  set(entityId: EntityId, component: T): void {
    this.components.set(entityId, component);
  }

  /**
   * Get a component for an entity.
   * Returns undefined if the entity doesn't have this component.
   */
  get(entityId: EntityId): T | undefined {
    return this.components.get(entityId);
  }

  /**
   * Check if an entity has this component.
   */
  has(entityId: EntityId): boolean {
    return this.components.has(entityId);
  }

  /**
   * Remove a component from an entity.
   */
  remove(entityId: EntityId): void {
    this.components.delete(entityId);
  }

  /**
   * Iterate over all entity-component pairs.
   */
  getAll(): IterableIterator<[EntityId, T]> {
    return this.components.entries();
  }

  /**
   * Get the number of entities with this component.
   */
  count(): number {
    return this.components.size;
  }

  /**
   * Clear all components (for testing).
   */
  clear(): void {
    this.components.clear();
  }
}
