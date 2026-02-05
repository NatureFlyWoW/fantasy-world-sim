import { describe, it, expect, beforeEach } from 'vitest';
import { EntityManager } from './entity-manager.js';

describe('EntityManager', () => {
  let manager: EntityManager;

  beforeEach(() => {
    manager = new EntityManager();
  });

  describe('createEntity', () => {
    it('should create entities with unique IDs', () => {
      const id1 = manager.createEntity();
      const id2 = manager.createEntity();
      const id3 = manager.createEntity();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should create entities with monotonically increasing IDs', () => {
      const id1 = manager.createEntity();
      const id2 = manager.createEntity();
      const id3 = manager.createEntity();

      expect(id2).toBeGreaterThan(id1);
      expect(id3).toBeGreaterThan(id2);
    });

    it('should mark new entities as alive', () => {
      const id = manager.createEntity();
      expect(manager.isAlive(id)).toBe(true);
    });
  });

  describe('destroyEntity', () => {
    it('should mark entity as not alive after destruction', () => {
      const id = manager.createEntity();
      expect(manager.isAlive(id)).toBe(true);

      manager.destroyEntity(id);
      expect(manager.isAlive(id)).toBe(false);
    });

    it('should not affect other entities when one is destroyed', () => {
      const id1 = manager.createEntity();
      const id2 = manager.createEntity();
      const id3 = manager.createEntity();

      manager.destroyEntity(id2);

      expect(manager.isAlive(id1)).toBe(true);
      expect(manager.isAlive(id2)).toBe(false);
      expect(manager.isAlive(id3)).toBe(true);
    });

    it('should handle destroying non-existent entity gracefully', () => {
      const id = manager.createEntity();
      manager.destroyEntity(id);
      // Destroying again should not throw
      expect(() => manager.destroyEntity(id)).not.toThrow();
    });
  });

  describe('isAlive', () => {
    it('should return false for never-created IDs', () => {
      // Cast to EntityId for testing
      expect(manager.isAlive(999 as never)).toBe(false);
    });

    it('should return true for living entities', () => {
      const id = manager.createEntity();
      expect(manager.isAlive(id)).toBe(true);
    });

    it('should return false for destroyed entities', () => {
      const id = manager.createEntity();
      manager.destroyEntity(id);
      expect(manager.isAlive(id)).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no entities exist', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('should return all living entities', () => {
      const id1 = manager.createEntity();
      const id2 = manager.createEntity();
      const id3 = manager.createEntity();

      const all = manager.getAll();
      expect(all).toHaveLength(3);
      expect(all).toContain(id1);
      expect(all).toContain(id2);
      expect(all).toContain(id3);
    });

    it('should not include destroyed entities', () => {
      const id1 = manager.createEntity();
      const id2 = manager.createEntity();
      const id3 = manager.createEntity();

      manager.destroyEntity(id2);

      const all = manager.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(id1);
      expect(all).not.toContain(id2);
      expect(all).toContain(id3);
    });
  });

  describe('count', () => {
    it('should return 0 when no entities exist', () => {
      expect(manager.count()).toBe(0);
    });

    it('should return correct count of living entities', () => {
      manager.createEntity();
      manager.createEntity();
      manager.createEntity();

      expect(manager.count()).toBe(3);
    });

    it('should decrease count when entities are destroyed', () => {
      const id1 = manager.createEntity();
      manager.createEntity();
      manager.createEntity();

      expect(manager.count()).toBe(3);

      manager.destroyEntity(id1);
      expect(manager.count()).toBe(2);
    });
  });

  describe('reset', () => {
    it('should clear all entities', () => {
      manager.createEntity();
      manager.createEntity();
      manager.createEntity();

      manager.reset();

      expect(manager.count()).toBe(0);
      expect(manager.getAll()).toEqual([]);
    });

    it('should reset ID counter', () => {
      manager.createEntity();
      manager.createEntity();
      manager.reset();

      const newId = manager.createEntity();
      // After reset, IDs start from 0 again
      expect(newId).toBe(0);
    });
  });
});
