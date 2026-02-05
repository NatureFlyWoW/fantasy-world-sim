import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialIndex } from './spatial-index.js';
import { toEntityId } from '../ecs/types.js';

describe('SpatialIndex', () => {
  let index: SpatialIndex;

  beforeEach(() => {
    index = new SpatialIndex(1000, 1000);
  });

  describe('addEntity', () => {
    it('should add an entity at a position', () => {
      const id = toEntityId(1);
      index.addEntity(id, 100, 200);

      expect(index.hasEntity(id)).toBe(true);
      expect(index.getEntityCount()).toBe(1);
    });

    it('should update position if entity already exists', () => {
      const id = toEntityId(1);
      index.addEntity(id, 100, 200);
      index.addEntity(id, 300, 400);

      expect(index.getEntityCount()).toBe(1);
      const pos = index.getPosition(id);
      expect(pos).toEqual({ x: 300, y: 400 });
    });

    it('should add multiple entities', () => {
      index.addEntity(toEntityId(1), 10, 10);
      index.addEntity(toEntityId(2), 20, 20);
      index.addEntity(toEntityId(3), 30, 30);

      expect(index.getEntityCount()).toBe(3);
    });
  });

  describe('removeEntity', () => {
    it('should remove an existing entity', () => {
      const id = toEntityId(1);
      index.addEntity(id, 100, 200);
      index.removeEntity(id);

      expect(index.hasEntity(id)).toBe(false);
      expect(index.getEntityCount()).toBe(0);
    });

    it('should be a no-op for non-existent entity', () => {
      index.removeEntity(toEntityId(999));
      expect(index.getEntityCount()).toBe(0);
    });

    it('should not affect other entities', () => {
      index.addEntity(toEntityId(1), 10, 10);
      index.addEntity(toEntityId(2), 20, 20);

      index.removeEntity(toEntityId(1));

      expect(index.hasEntity(toEntityId(1))).toBe(false);
      expect(index.hasEntity(toEntityId(2))).toBe(true);
      expect(index.getEntityCount()).toBe(1);
    });
  });

  describe('moveEntity', () => {
    it('should move an entity to a new position', () => {
      const id = toEntityId(1);
      index.addEntity(id, 100, 200);
      index.moveEntity(id, 500, 600);

      const pos = index.getPosition(id);
      expect(pos).toEqual({ x: 500, y: 600 });
    });

    it('should add entity if not tracked', () => {
      const id = toEntityId(1);
      index.moveEntity(id, 100, 200);

      expect(index.hasEntity(id)).toBe(true);
      expect(index.getPosition(id)).toEqual({ x: 100, y: 200 });
    });

    it('should update spatial queries after move', () => {
      const id = toEntityId(1);
      index.addEntity(id, 10, 10);

      // Should be near origin
      let nearby = index.getEntitiesInRadius(10, 10, 5);
      expect(nearby).toContain(id);

      // Move far away
      index.moveEntity(id, 900, 900);

      // Should no longer be near origin
      nearby = index.getEntitiesInRadius(10, 10, 5);
      expect(nearby).not.toContain(id);

      // Should be near new position
      nearby = index.getEntitiesInRadius(900, 900, 5);
      expect(nearby).toContain(id);
    });
  });

  describe('getEntitiesInRadius', () => {
    it('should return entities within the radius', () => {
      index.addEntity(toEntityId(1), 50, 50);
      index.addEntity(toEntityId(2), 55, 50);
      index.addEntity(toEntityId(3), 500, 500);

      const results = index.getEntitiesInRadius(50, 50, 10);
      expect(results).toContain(toEntityId(1));
      expect(results).toContain(toEntityId(2));
      expect(results).not.toContain(toEntityId(3));
    });

    it('should return empty array when no entities nearby', () => {
      index.addEntity(toEntityId(1), 500, 500);

      const results = index.getEntitiesInRadius(10, 10, 5);
      expect(results).toHaveLength(0);
    });
  });

  describe('getEntitiesInRect', () => {
    it('should return entities within the rectangle', () => {
      index.addEntity(toEntityId(1), 10, 10);
      index.addEntity(toEntityId(2), 30, 30);
      index.addEntity(toEntityId(3), 100, 100);

      const results = index.getEntitiesInRect(0, 0, 50, 50);
      expect(results).toContain(toEntityId(1));
      expect(results).toContain(toEntityId(2));
      expect(results).not.toContain(toEntityId(3));
    });
  });

  describe('getNearestEntities', () => {
    it('should return the N nearest entities', () => {
      index.addEntity(toEntityId(1), 50, 50);
      index.addEntity(toEntityId(2), 52, 50);
      index.addEntity(toEntityId(3), 100, 100);
      index.addEntity(toEntityId(4), 900, 900);

      const results = index.getNearestEntities(50, 50, 2);
      expect(results).toHaveLength(2);
      expect(results[0]).toBe(toEntityId(1));
      expect(results[1]).toBe(toEntityId(2));
    });
  });

  describe('getPosition', () => {
    it('should return the position of a tracked entity', () => {
      index.addEntity(toEntityId(1), 42, 84);
      const pos = index.getPosition(toEntityId(1));
      expect(pos).toEqual({ x: 42, y: 84 });
    });

    it('should return undefined for untracked entity', () => {
      const pos = index.getPosition(toEntityId(999));
      expect(pos).toBeUndefined();
    });

    it('should return a copy, not a reference', () => {
      index.addEntity(toEntityId(1), 10, 20);
      const pos1 = index.getPosition(toEntityId(1));
      const pos2 = index.getPosition(toEntityId(1));

      expect(pos1).toEqual(pos2);
      expect(pos1).not.toBe(pos2);
    });
  });

  describe('getWorldSize', () => {
    it('should return the world dimensions', () => {
      const size = index.getWorldSize();
      expect(size).toEqual({ width: 1000, height: 1000 });
    });
  });

  describe('clear', () => {
    it('should remove all entities', () => {
      index.addEntity(toEntityId(1), 10, 10);
      index.addEntity(toEntityId(2), 20, 20);
      index.addEntity(toEntityId(3), 30, 30);

      index.clear();

      expect(index.getEntityCount()).toBe(0);
      expect(index.hasEntity(toEntityId(1))).toBe(false);
    });
  });

  describe('rebuild', () => {
    it('should maintain all entities after rebuild', () => {
      index.addEntity(toEntityId(1), 10, 10);
      index.addEntity(toEntityId(2), 50, 50);
      index.addEntity(toEntityId(3), 90, 90);

      index.rebuild();

      expect(index.getEntityCount()).toBe(3);
      expect(index.getPosition(toEntityId(1))).toEqual({ x: 10, y: 10 });
      expect(index.getPosition(toEntityId(2))).toEqual({ x: 50, y: 50 });
      expect(index.getPosition(toEntityId(3))).toEqual({ x: 90, y: 90 });
    });

    it('should maintain query functionality after rebuild', () => {
      index.addEntity(toEntityId(1), 10, 10);
      index.addEntity(toEntityId(2), 15, 15);
      index.addEntity(toEntityId(3), 900, 900);

      index.rebuild();

      const nearby = index.getEntitiesInRadius(10, 10, 20);
      expect(nearby).toContain(toEntityId(1));
      expect(nearby).toContain(toEntityId(2));
      expect(nearby).not.toContain(toEntityId(3));
    });
  });

  describe('performance', () => {
    it('should handle 10000 entities with queries under 10ms', () => {
      const largeIndex = new SpatialIndex(10000, 10000);

      for (let i = 0; i < 10000; i++) {
        const x = (i * 7919) % 10000;
        const y = (i * 6271) % 10000;
        largeIndex.addEntity(toEntityId(i), x, y);
      }

      expect(largeIndex.getEntityCount()).toBe(10000);

      // Warm-up
      largeIndex.getEntitiesInRadius(5000, 5000, 500);

      // Timed radius query
      const start = performance.now();
      const results = largeIndex.getEntitiesInRadius(5000, 5000, 500);
      const elapsed = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(10);
    });
  });
});
