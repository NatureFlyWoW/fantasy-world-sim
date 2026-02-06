/**
 * World is the top-level container for the ECS.
 * It manages entities, component stores, and provides query methods.
 */

import type { EntityId } from './types.js';
import type { Component, ComponentType } from './component.js';
import { EntityManager } from './entity-manager.js';
import { ComponentStore } from './component-store.js';

export class World {
  private entityManager: EntityManager = new EntityManager();
  private stores: Map<ComponentType, ComponentStore<Component>> = new Map();

  /**
   * Register a component type and create its store.
   * Must be called before using the component type.
   */
  registerComponent<T extends Component>(type: ComponentType): ComponentStore<T> {
    if (this.stores.has(type)) {
      return this.stores.get(type) as ComponentStore<T>;
    }
    const store = new ComponentStore<T>();
    this.stores.set(type, store as ComponentStore<Component>);
    return store;
  }

  /**
   * Get the store for a component type.
   * Throws if the component type is not registered.
   */
  getStore<T extends Component>(type: ComponentType): ComponentStore<T> {
    const store = this.stores.get(type);
    if (store === undefined) {
      throw new Error(`Component type '${type}' is not registered`);
    }
    return store as ComponentStore<T>;
  }

  /**
   * Check if a component type is registered.
   */
  hasStore(type: ComponentType): boolean {
    return this.stores.has(type);
  }

  /**
   * Get all registered component types.
   */
  getRegisteredComponentTypes(): ComponentType[] {
    return Array.from(this.stores.keys());
  }

  /**
   * Create a new entity.
   */
  createEntity(): EntityId {
    return this.entityManager.createEntity();
  }

  /**
   * Destroy an entity and remove all its components.
   */
  destroyEntity(id: EntityId): void {
    // Remove from all component stores
    for (const store of this.stores.values()) {
      store.remove(id);
    }
    this.entityManager.destroyEntity(id);
  }

  /**
   * Check if an entity is alive.
   */
  isAlive(id: EntityId): boolean {
    return this.entityManager.isAlive(id);
  }

  /**
   * Get all living entities.
   */
  getAllEntities(): EntityId[] {
    return this.entityManager.getAll();
  }

  /**
   * Get the count of living entities.
   */
  entityCount(): number {
    return this.entityManager.count();
  }

  /**
   * Add a component to an entity.
   */
  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const store = this.getStore<T>(component.type as ComponentType);
    store.set(entityId, component);
  }

  /**
   * Get a component from an entity.
   */
  getComponent<T extends Component>(entityId: EntityId, type: ComponentType): T | undefined {
    if (!this.hasStore(type)) {
      return undefined;
    }
    return this.getStore<T>(type).get(entityId);
  }

  /**
   * Check if an entity has a component.
   */
  hasComponent(entityId: EntityId, type: ComponentType): boolean {
    if (!this.hasStore(type)) {
      return false;
    }
    return this.getStore(type).has(entityId);
  }

  /**
   * Remove a component from an entity.
   */
  removeComponent(entityId: EntityId, type: ComponentType): void {
    if (this.hasStore(type)) {
      this.getStore(type).remove(entityId);
    }
  }

  /**
   * Query for entities that have ALL the specified components.
   */
  query(...componentTypes: ComponentType[]): EntityId[] {
    if (componentTypes.length === 0) {
      return this.entityManager.getAll();
    }

    // Start with the smallest store for efficiency
    const stores = componentTypes
      .filter((type) => this.hasStore(type))
      .map((type) => this.getStore(type));

    if (stores.length !== componentTypes.length) {
      // At least one component type doesn't exist, no entities can match
      return [];
    }

    // Sort by size to iterate over smallest first
    stores.sort((a, b) => a.count() - b.count());

    const result: EntityId[] = [];
    const smallestStore = stores[0];
    if (smallestStore === undefined) {
      return [];
    }

    for (const [entityId] of smallestStore.getAll()) {
      // Check if entity has all other components
      let hasAll = true;
      for (let i = 1; i < stores.length; i++) {
        const store = stores[i];
        if (store !== undefined && !store.has(entityId)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll && this.entityManager.isAlive(entityId)) {
        result.push(entityId);
      }
    }

    return result;
  }

  /**
   * Query for entities with a specific component, returning entity-component pairs.
   * Useful for iterating over entities with their component data.
   */
  queryWith<T extends Component>(
    type: ComponentType
  ): Array<{ entity: EntityId; component: T }> {
    if (!this.hasStore(type)) {
      return [];
    }

    const store = this.getStore<T>(type);
    const result: Array<{ entity: EntityId; component: T }> = [];

    for (const [entityId, component] of store.getAll()) {
      if (this.entityManager.isAlive(entityId)) {
        result.push({ entity: entityId, component });
      }
    }

    return result;
  }

  /**
   * Reset the world (for testing).
   */
  reset(): void {
    this.entityManager.reset();
    for (const store of this.stores.values()) {
      store.clear();
    }
  }
}
