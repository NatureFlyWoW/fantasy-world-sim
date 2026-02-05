import { describe, it, expect, beforeEach } from 'vitest';
import { World } from './world.js';
import type { PositionComponent, HealthComponent, AttributeComponent } from './component.js';

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

// Helper to create test health components
function createHealth(current: number, maximum: number): HealthComponent {
  return {
    type: 'Health',
    current,
    maximum,
    injuries: [],
    diseases: [],
    serialize(): Record<string, unknown> {
      return { type: this.type, current: this.current, maximum: this.maximum };
    },
  };
}

// Helper to create test attribute components
function createAttribute(): AttributeComponent {
  return {
    type: 'Attribute',
    strength: 10,
    agility: 10,
    endurance: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    serialize(): Record<string, unknown> {
      return { type: this.type };
    },
  };
}

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('registerComponent', () => {
    it('should create a new store for a component type', () => {
      const store = world.registerComponent<PositionComponent>('Position');
      expect(store).toBeDefined();
      expect(world.hasStore('Position')).toBe(true);
    });

    it('should return existing store if already registered', () => {
      const store1 = world.registerComponent<PositionComponent>('Position');
      const store2 = world.registerComponent<PositionComponent>('Position');
      expect(store1).toBe(store2);
    });
  });

  describe('getStore', () => {
    it('should return registered store', () => {
      const registered = world.registerComponent<PositionComponent>('Position');
      const retrieved = world.getStore<PositionComponent>('Position');
      expect(retrieved).toBe(registered);
    });

    it('should throw for unregistered component type', () => {
      expect(() => world.getStore('Position')).toThrow("Component type 'Position' is not registered");
    });
  });

  describe('entity lifecycle', () => {
    it('should create entities with unique IDs', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();
      expect(id1).not.toBe(id2);
    });

    it('should track entity alive status', () => {
      const id = world.createEntity();
      expect(world.isAlive(id)).toBe(true);

      world.destroyEntity(id);
      expect(world.isAlive(id)).toBe(false);
    });

    it('should return all living entities', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();
      const id3 = world.createEntity();

      world.destroyEntity(id2);

      const all = world.getAllEntities();
      expect(all).toHaveLength(2);
      expect(all).toContain(id1);
      expect(all).not.toContain(id2);
      expect(all).toContain(id3);
    });

    it('should count living entities', () => {
      world.createEntity();
      world.createEntity();
      const id3 = world.createEntity();

      expect(world.entityCount()).toBe(3);

      world.destroyEntity(id3);
      expect(world.entityCount()).toBe(2);
    });
  });

  describe('component management', () => {
    beforeEach(() => {
      world.registerComponent<PositionComponent>('Position');
      world.registerComponent<HealthComponent>('Health');
    });

    it('should add and retrieve components', () => {
      const entity = world.createEntity();
      const position = createPosition(10, 20);

      world.addComponent(entity, position);

      const retrieved = world.getComponent<PositionComponent>(entity, 'Position');
      expect(retrieved).toBe(position);
    });

    it('should return undefined for missing component', () => {
      const entity = world.createEntity();
      expect(world.getComponent<PositionComponent>(entity, 'Position')).toBeUndefined();
    });

    it('should return undefined for unregistered component type', () => {
      const entity = world.createEntity();
      expect(world.getComponent(entity, 'Biome')).toBeUndefined();
    });

    it('should check if entity has component', () => {
      const entity = world.createEntity();
      expect(world.hasComponent(entity, 'Position')).toBe(false);

      world.addComponent(entity, createPosition(10, 20));
      expect(world.hasComponent(entity, 'Position')).toBe(true);
    });

    it('should remove component from entity', () => {
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(10, 20));

      world.removeComponent(entity, 'Position');

      expect(world.hasComponent(entity, 'Position')).toBe(false);
    });

    it('should remove all components when entity is destroyed', () => {
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(10, 20));
      world.addComponent(entity, createHealth(100, 100));

      world.destroyEntity(entity);

      // Components should be removed (stores should not have the entity)
      const positionStore = world.getStore<PositionComponent>('Position');
      const healthStore = world.getStore<HealthComponent>('Health');
      expect(positionStore.has(entity)).toBe(false);
      expect(healthStore.has(entity)).toBe(false);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      world.registerComponent<PositionComponent>('Position');
      world.registerComponent<HealthComponent>('Health');
      world.registerComponent<AttributeComponent>('Attribute');
    });

    it('should return all entities when no component types specified', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();
      const id3 = world.createEntity();

      const result = world.query();
      expect(result).toHaveLength(3);
      expect(result).toContain(id1);
      expect(result).toContain(id2);
      expect(result).toContain(id3);
    });

    it('should return entities with single component', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();
      const id3 = world.createEntity();

      world.addComponent(id1, createPosition(10, 20));
      world.addComponent(id2, createPosition(30, 40));
      // id3 has no position

      const result = world.query('Position');
      expect(result).toHaveLength(2);
      expect(result).toContain(id1);
      expect(result).toContain(id2);
      expect(result).not.toContain(id3);
    });

    it('should return entities with ALL specified components', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();
      const id3 = world.createEntity();

      // id1 has both Position and Health
      world.addComponent(id1, createPosition(10, 20));
      world.addComponent(id1, createHealth(100, 100));

      // id2 has only Position
      world.addComponent(id2, createPosition(30, 40));

      // id3 has only Health
      world.addComponent(id3, createHealth(50, 100));

      const result = world.query('Position', 'Health');
      expect(result).toHaveLength(1);
      expect(result).toContain(id1);
    });

    it('should return empty array for unregistered component type', () => {
      world.createEntity();
      const result = world.query('Biome');
      expect(result).toEqual([]);
    });

    it('should not include destroyed entities', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();

      world.addComponent(id1, createPosition(10, 20));
      world.addComponent(id2, createPosition(30, 40));

      world.destroyEntity(id1);

      const result = world.query('Position');
      expect(result).toHaveLength(1);
      expect(result).toContain(id2);
      expect(result).not.toContain(id1);
    });

    it('should handle three-component query', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();

      // id1 has all three
      world.addComponent(id1, createPosition(10, 20));
      world.addComponent(id1, createHealth(100, 100));
      world.addComponent(id1, createAttribute());

      // id2 has only two
      world.addComponent(id2, createPosition(30, 40));
      world.addComponent(id2, createHealth(50, 100));

      const result = world.query('Position', 'Health', 'Attribute');
      expect(result).toHaveLength(1);
      expect(result).toContain(id1);
    });
  });

  describe('queryWith', () => {
    beforeEach(() => {
      world.registerComponent<PositionComponent>('Position');
      world.registerComponent<HealthComponent>('Health');
    });

    it('should return empty array for unregistered component', () => {
      const result = world.queryWith('Biome');
      expect(result).toEqual([]);
    });

    it('should return entity-component pairs', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();
      const pos1 = createPosition(10, 20);
      const pos2 = createPosition(30, 40);

      world.addComponent(id1, pos1);
      world.addComponent(id2, pos2);

      const result = world.queryWith<PositionComponent>('Position');
      expect(result).toHaveLength(2);

      const entities = result.map((r) => r.entity);
      expect(entities).toContain(id1);
      expect(entities).toContain(id2);

      const e1Result = result.find((r) => r.entity === id1);
      expect(e1Result?.component).toBe(pos1);

      const e2Result = result.find((r) => r.entity === id2);
      expect(e2Result?.component).toBe(pos2);
    });

    it('should not include destroyed entities', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();

      world.addComponent(id1, createPosition(10, 20));
      world.addComponent(id2, createPosition(30, 40));

      world.destroyEntity(id1);

      const result = world.queryWith<PositionComponent>('Position');
      expect(result).toHaveLength(1);
      expect(result[0]?.entity).toBe(id2);
    });
  });

  describe('reset', () => {
    it('should clear all entities and components', () => {
      world.registerComponent<PositionComponent>('Position');

      const id1 = world.createEntity();
      const id2 = world.createEntity();
      world.addComponent(id1, createPosition(10, 20));
      world.addComponent(id2, createPosition(30, 40));

      world.reset();

      expect(world.entityCount()).toBe(0);
      expect(world.getStore<PositionComponent>('Position').count()).toBe(0);
    });
  });
});
