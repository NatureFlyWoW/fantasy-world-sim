/**
 * SpatialIndex provides a high-level facade over the Quadtree
 * for entity position management and spatial queries.
 */

import type { EntityId } from '../ecs/types.js';
import { Quadtree } from './quadtree.js';

/**
 * Position stored for each entity.
 */
interface EntityPosition {
  x: number;
  y: number;
}

export class SpatialIndex {
  private quadtree: Quadtree<EntityId>;
  private positions: Map<EntityId, EntityPosition> = new Map();
  private worldWidth: number;
  private worldHeight: number;

  constructor(worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.quadtree = new Quadtree<EntityId>(
      { x: 0, y: 0, width: worldWidth, height: worldHeight },
      16,
      10
    );
  }

  /**
   * Add an entity at a position.
   */
  addEntity(entityId: EntityId, x: number, y: number): void {
    // Remove if already exists
    if (this.positions.has(entityId)) {
      this.removeEntity(entityId);
    }

    this.positions.set(entityId, { x, y });
    this.quadtree.insert(x, y, entityId);
  }

  /**
   * Remove an entity from the spatial index.
   */
  removeEntity(entityId: EntityId): void {
    const pos = this.positions.get(entityId);
    if (pos === undefined) return;

    this.quadtree.remove(pos.x, pos.y, entityId);
    this.positions.delete(entityId);
  }

  /**
   * Move an entity to a new position.
   */
  moveEntity(entityId: EntityId, newX: number, newY: number): void {
    const pos = this.positions.get(entityId);
    if (pos === undefined) {
      // Entity not tracked, add it
      this.addEntity(entityId, newX, newY);
      return;
    }

    // Remove from old position
    this.quadtree.remove(pos.x, pos.y, entityId);

    // Update position
    pos.x = newX;
    pos.y = newY;

    // Insert at new position
    this.quadtree.insert(newX, newY, entityId);
  }

  /**
   * Get all entities within a radius of a point.
   */
  getEntitiesInRadius(x: number, y: number, radius: number): EntityId[] {
    return this.quadtree.queryRadius(x, y, radius);
  }

  /**
   * Get all entities within a rectangular region.
   */
  getEntitiesInRect(x: number, y: number, width: number, height: number): EntityId[] {
    return this.quadtree.queryRect(x, y, width, height);
  }

  /**
   * Get the N nearest entities to a point.
   */
  getNearestEntities(x: number, y: number, count: number): EntityId[] {
    return this.quadtree.queryNearest(x, y, count);
  }

  /**
   * Get the position of an entity.
   */
  getPosition(entityId: EntityId): { x: number; y: number } | undefined {
    const pos = this.positions.get(entityId);
    if (pos === undefined) return undefined;
    return { x: pos.x, y: pos.y };
  }

  /**
   * Check if an entity is tracked in the spatial index.
   */
  hasEntity(entityId: EntityId): boolean {
    return this.positions.has(entityId);
  }

  /**
   * Get the total number of tracked entities.
   */
  getEntityCount(): number {
    return this.positions.size;
  }

  /**
   * Get the world dimensions.
   */
  getWorldSize(): { width: number; height: number } {
    return { width: this.worldWidth, height: this.worldHeight };
  }

  /**
   * Clear all entities and rebuild the quadtree.
   */
  clear(): void {
    this.positions.clear();
    this.quadtree.clear();
  }

  /**
   * Rebuild the quadtree from the current positions.
   * Call after many insertions/removals for better performance.
   */
  rebuild(): void {
    this.quadtree.clear();
    for (const [entityId, pos] of this.positions) {
      this.quadtree.insert(pos.x, pos.y, entityId);
    }
  }
}
