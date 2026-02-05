import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentStore } from './component-store.js';
import type { EntityId } from './types.js';
import type { PositionComponent } from './component.js';

// Helper to create test entity IDs
function entityId(n: number): EntityId {
  return n as EntityId;
}

// Helper to create test position components
function createPosition(x: number, y: number): PositionComponent {
  return {
    type: 'Position',
    x,
    y,
    serialize(): Record<string, unknown> {
      return { type: this.type, x: this.x, y: this.y };
    },
  };
}

describe('ComponentStore', () => {
  let store: ComponentStore<PositionComponent>;

  beforeEach(() => {
    store = new ComponentStore<PositionComponent>();
  });

  describe('set', () => {
    it('should store a component for an entity', () => {
      const id = entityId(1);
      const component = createPosition(10, 20);

      store.set(id, component);

      expect(store.get(id)).toBe(component);
    });

    it('should overwrite existing component', () => {
      const id = entityId(1);
      const component1 = createPosition(10, 20);
      const component2 = createPosition(30, 40);

      store.set(id, component1);
      store.set(id, component2);

      expect(store.get(id)).toBe(component2);
      expect(store.count()).toBe(1);
    });
  });

  describe('get', () => {
    it('should return undefined for missing entity', () => {
      expect(store.get(entityId(999))).toBeUndefined();
    });

    it('should return the stored component', () => {
      const id = entityId(1);
      const component = createPosition(10, 20);
      store.set(id, component);

      const retrieved = store.get(id);
      expect(retrieved).toBe(component);
      expect(retrieved?.x).toBe(10);
      expect(retrieved?.y).toBe(20);
    });
  });

  describe('has', () => {
    it('should return false for missing entity', () => {
      expect(store.has(entityId(999))).toBe(false);
    });

    it('should return true for entity with component', () => {
      const id = entityId(1);
      store.set(id, createPosition(10, 20));

      expect(store.has(id)).toBe(true);
    });

    it('should return false after component is removed', () => {
      const id = entityId(1);
      store.set(id, createPosition(10, 20));
      store.remove(id);

      expect(store.has(id)).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove component from entity', () => {
      const id = entityId(1);
      store.set(id, createPosition(10, 20));

      store.remove(id);

      expect(store.get(id)).toBeUndefined();
      expect(store.has(id)).toBe(false);
    });

    it('should handle removing non-existent component gracefully', () => {
      expect(() => store.remove(entityId(999))).not.toThrow();
    });

    it('should not affect other entities', () => {
      const id1 = entityId(1);
      const id2 = entityId(2);
      store.set(id1, createPosition(10, 20));
      store.set(id2, createPosition(30, 40));

      store.remove(id1);

      expect(store.has(id1)).toBe(false);
      expect(store.has(id2)).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return empty iterator when store is empty', () => {
      const entries = Array.from(store.getAll());
      expect(entries).toHaveLength(0);
    });

    it('should iterate over all entity-component pairs', () => {
      store.set(entityId(1), createPosition(10, 20));
      store.set(entityId(2), createPosition(30, 40));
      store.set(entityId(3), createPosition(50, 60));

      const entries = Array.from(store.getAll());
      expect(entries).toHaveLength(3);

      const ids = entries.map(([id]) => id);
      expect(ids).toContain(entityId(1));
      expect(ids).toContain(entityId(2));
      expect(ids).toContain(entityId(3));
    });

    it('should return correct components for each entity', () => {
      const component1 = createPosition(10, 20);
      const component2 = createPosition(30, 40);
      store.set(entityId(1), component1);
      store.set(entityId(2), component2);

      const entries = Array.from(store.getAll());
      const map = new Map(entries);

      expect(map.get(entityId(1))).toBe(component1);
      expect(map.get(entityId(2))).toBe(component2);
    });
  });

  describe('count', () => {
    it('should return 0 for empty store', () => {
      expect(store.count()).toBe(0);
    });

    it('should return correct count after adding components', () => {
      store.set(entityId(1), createPosition(10, 20));
      store.set(entityId(2), createPosition(30, 40));
      store.set(entityId(3), createPosition(50, 60));

      expect(store.count()).toBe(3);
    });

    it('should decrease after removing components', () => {
      store.set(entityId(1), createPosition(10, 20));
      store.set(entityId(2), createPosition(30, 40));

      store.remove(entityId(1));

      expect(store.count()).toBe(1);
    });

    it('should not increase when overwriting component', () => {
      store.set(entityId(1), createPosition(10, 20));
      store.set(entityId(1), createPosition(30, 40));

      expect(store.count()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all components', () => {
      store.set(entityId(1), createPosition(10, 20));
      store.set(entityId(2), createPosition(30, 40));
      store.set(entityId(3), createPosition(50, 60));

      store.clear();

      expect(store.count()).toBe(0);
      expect(store.has(entityId(1))).toBe(false);
      expect(store.has(entityId(2))).toBe(false);
      expect(store.has(entityId(3))).toBe(false);
    });
  });
});
