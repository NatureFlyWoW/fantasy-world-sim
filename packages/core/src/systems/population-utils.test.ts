import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import {
  createNonNotable,
  DEFAULT_RACE_LIFESPANS,
  FALLBACK_LIFESPAN,
  PROFESSIONS,
  type NonNotableConfig,
} from './population-utils.js';

describe('population-utils', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.registerComponent('Position');
    world.registerComponent('Status');
    world.registerComponent('Notability');
    world.registerComponent('Parentage');
  });

  describe('createNonNotable', () => {
    const baseConfig: NonNotableConfig = {
      name: 'Ada Smith',
      race: 'Human',
      age: 25,
      profession: 'blacksmith',
      siteId: 1,
      x: 10,
      y: 20,
      currentTick: 0,
      motherId: null,
      fatherId: null,
    };

    it('creates entity with Position component', () => {
      const entityId = createNonNotable(world, baseConfig);
      const pos = world.getComponent(entityId, 'Position');
      expect(pos).toBeDefined();
      expect(pos!.x).toBe(10);
      expect(pos!.y).toBe(20);
    });

    it('creates entity with Status component using name in titles', () => {
      const entityId = createNonNotable(world, baseConfig);
      const status = world.getComponent(entityId, 'Status');
      expect(status).toBeDefined();
      expect(status!.titles).toEqual(['Ada Smith']);
      expect(status!.socialClass).toBe('blacksmith');
      expect(status!.conditions).toEqual([]);
    });

    it('creates entity with Notability at score 0', () => {
      const entityId = createNonNotable(world, baseConfig);
      const notability = world.getComponent(entityId, 'Notability');
      expect(notability).toBeDefined();
      expect(notability!.score).toBe(0);
      expect(notability!.sparkHistory).toEqual([]);
    });

    it('computes birthTick from age and currentTick', () => {
      const config = { ...baseConfig, age: 25, currentTick: 1000 };
      const entityId = createNonNotable(world, config);
      const notability = world.getComponent(entityId, 'Notability');
      // birthTick = currentTick - age * 360 = 1000 - 25*360 = 1000 - 9000 = -8000
      expect(notability!.birthTick).toBe(-8000);
    });

    it('creates entity with Parentage component', () => {
      const config = { ...baseConfig, motherId: 42, fatherId: 43 };
      const entityId = createNonNotable(world, config);
      const parentage = world.getComponent(entityId, 'Parentage');
      expect(parentage).toBeDefined();
      expect(parentage!.motherId).toBe(42);
      expect(parentage!.fatherId).toBe(43);
    });

    it('handles null parents for first-generation characters', () => {
      const entityId = createNonNotable(world, baseConfig);
      const parentage = world.getComponent(entityId, 'Parentage');
      expect(parentage!.motherId).toBeNull();
      expect(parentage!.fatherId).toBeNull();
    });

    it('creates unique entity IDs for each call', () => {
      const id1 = createNonNotable(world, baseConfig);
      const id2 = createNonNotable(world, { ...baseConfig, name: 'Bob Jones' });
      expect(id1).not.toBe(id2);
    });

    it('components have serialize method', () => {
      const entityId = createNonNotable(world, baseConfig);
      const status = world.getComponent(entityId, 'Status');
      expect(typeof status!.serialize).toBe('function');
      const serialized = status!.serialize();
      expect(serialized.type).toBe('Status');
      expect(serialized.titles).toEqual(['Ada Smith']);
    });
  });

  describe('DEFAULT_RACE_LIFESPANS', () => {
    it('has 4 lifespan tiers', () => {
      expect(Object.keys(DEFAULT_RACE_LIFESPANS)).toHaveLength(4);
    });

    it('has expected and maximum for each tier', () => {
      for (const lifespan of Object.values(DEFAULT_RACE_LIFESPANS)) {
        expect(lifespan.expected).toBeGreaterThan(0);
        expect(lifespan.maximum).toBeGreaterThan(lifespan.expected);
      }
    });

    it('baseline matches human-like lifespan', () => {
      expect(DEFAULT_RACE_LIFESPANS['baseline']!.expected).toBe(70);
      expect(DEFAULT_RACE_LIFESPANS['baseline']!.maximum).toBe(90);
    });
  });

  describe('FALLBACK_LIFESPAN', () => {
    it('defaults to baseline human lifespan', () => {
      expect(FALLBACK_LIFESPAN.expected).toBe(70);
      expect(FALLBACK_LIFESPAN.maximum).toBe(90);
    });
  });

  describe('PROFESSIONS', () => {
    it('has at least 10 profession types', () => {
      expect(PROFESSIONS.length).toBeGreaterThanOrEqual(10);
    });

    it('contains common medieval professions', () => {
      expect(PROFESSIONS).toContain('farmer');
      expect(PROFESSIONS).toContain('smith');
      expect(PROFESSIONS).toContain('merchant');
      expect(PROFESSIONS).toContain('soldier');
    });
  });
});
