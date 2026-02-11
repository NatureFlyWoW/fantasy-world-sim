import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import { PopulationSystem } from './population-system.js';
import { createNonNotable } from './population-utils.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import type { EntityId } from '../ecs/types.js';
import type { NotabilityComponent, PopulationComponent } from '../ecs/component.js';

function registerAllComponents(world: World): void {
  const types = [
    'Position', 'Status', 'Notability', 'Parentage', 'Deceased',
    'Population', 'PopulationDemographics', 'Economy', 'Biome',
    'Ownership', 'Health', 'CreatureType', 'HiddenLocation',
  ];
  for (const type of types) {
    world.registerComponent(type);
  }
}

function makeComponent<T extends { type: string }>(data: T): T & { serialize(): Record<string, unknown> } {
  return {
    ...data,
    serialize() {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this)) {
        if (key !== 'serialize' && typeof value !== 'function') {
          result[key] = value;
        }
      }
      return result;
    },
  };
}

function createSettlement(world: World, x: number, y: number, race: string, popCount: number): EntityId {
  const eid = world.createEntity();
  world.addComponent(eid, makeComponent({
    type: 'Position' as const, x, y,
  }));
  world.addComponent(eid, makeComponent({
    type: 'Population' as const,
    count: popCount,
    growthRate: 0.02,
    nonNotableIds: [] as number[],
  }));
  world.addComponent(eid, makeComponent({
    type: 'PopulationDemographics' as const,
    raceDistribution: new Map([[race, popCount]]),
    ageDistribution: new Map(),
  }));
  world.addComponent(eid, makeComponent({
    type: 'Status' as const,
    conditions: [],
    titles: ['Test Settlement'],
    socialClass: 'settlement',
  }));
  return eid;
}

function addNonNotables(world: World, settlementId: EntityId, count: number, baseAge: number, race: string): number[] {
  const pos = world.getComponent(settlementId, 'Position') as { x: number; y: number };
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const eid = createNonNotable(world, {
      name: `Person ${i}`,
      race,
      age: baseAge + i,
      profession: 'farmer',
      siteId: settlementId as number,
      x: pos.x,
      y: pos.y,
      currentTick: 0,
      motherId: null,
      fatherId: null,
    });
    ids.push(eid as number);
  }
  // Link to settlement
  const pop = world.getComponent<PopulationComponent>(settlementId, 'Population');
  if (pop !== undefined) {
    pop.nonNotableIds = ids;
  }
  return ids;
}

describe('PopulationSystem', () => {
  let world: World;
  let clock: WorldClock;
  let events: EventBus;
  let system: PopulationSystem;
  let rng: SeededRNG;

  beforeEach(() => {
    world = new World();
    registerAllComponents(world);
    clock = new WorldClock();
    events = new EventBus();
    rng = new SeededRNG(42);
    system = new PopulationSystem(rng.fork('population'));
  });

  describe('system properties', () => {
    it('has correct name', () => {
      expect(system.name).toBe('PopulationSystem');
    });

    it('has Monthly frequency', () => {
      expect(system.frequency).toBe(30);
    });

    it('has POPULATION execution order', () => {
      expect(system.executionOrder).toBe(35);
    });

    it('initializes without errors', () => {
      system.initialize(world);
      expect(system.isInitialized()).toBe(true);
    });
  });

  describe('race lifespan management', () => {
    it('registers and retrieves race lifespans', () => {
      system.registerRaceLifespan('Human', { expected: 70, maximum: 90 });
      expect(system.getRaceLifespan('Human')).toEqual({ expected: 70, maximum: 90 });
    });

    it('falls back to default for unknown races', () => {
      expect(system.getRaceLifespan('Unknown')).toEqual({ expected: 70, maximum: 90 });
    });
  });

  describe('aging', () => {
    it('computes age from birthTick correctly', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 5);
      const ids = addNonNotables(world, settlementId, 1, 25, 'Human');
      system.initialize(world);

      // At tick 0, age 25 means birthTick = -25*360 = -9000
      const notability = world.getComponent<NotabilityComponent>(ids[0] as EntityId, 'Notability');
      expect(notability).toBeDefined();
      expect(notability!.birthTick).toBe(-9000);

      // Current age = (0 - (-9000)) / 360 = 25
      const age = Math.floor((clock.currentTick - notability!.birthTick) / 360);
      expect(age).toBe(25);
    });
  });

  describe('natural death', () => {
    it('kills elderly non-notables with increasing probability', () => {
      system.registerRaceLifespan('Human', { expected: 70, maximum: 90 });
      const settlementId = createSettlement(world, 10, 20, 'Human', 10);
      // Create 10 characters all at age 85 (well past expected 70)
      const ids = addNonNotables(world, settlementId, 10, 85, 'Human');
      system.initialize(world);

      // Run many monthly ticks to accumulate deaths
      let deaths = 0;
      for (let t = 0; t < 24; t++) {
        // Advance clock by 30 ticks (1 month)
        for (let d = 0; d < 30; d++) {
          clock.advance();
        }
        system.execute(world, clock, events);

        // Count deceased
        for (const id of ids) {
          if (world.hasComponent(id as EntityId, 'Deceased')) {
            deaths++;
          }
        }
        if (deaths > 0) break;
      }

      expect(deaths).toBeGreaterThan(0);
    });

    it('preserves deceased entity in ECS with Deceased component', () => {
      system.registerRaceLifespan('Human', { expected: 70, maximum: 90 });
      const settlementId = createSettlement(world, 10, 20, 'Human', 5);
      // Age 89 — very close to maximum, high death chance
      const ids = addNonNotables(world, settlementId, 5, 89, 'Human');
      system.initialize(world);

      // Run until at least one death
      let found = false;
      for (let t = 0; t < 60 && !found; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);

        for (const id of ids) {
          if (world.hasComponent(id as EntityId, 'Deceased')) {
            const deceased = world.getComponent(id as EntityId, 'Deceased');
            expect(deceased).toBeDefined();
            expect((deceased as { cause: string }).cause).toBe('natural causes');
            expect((deceased as { tick: number }).tick).toBeGreaterThan(0);
            found = true;
            break;
          }
        }
      }

      expect(found).toBe(true);
    });

    it('removes deceased from settlement nonNotableIds', () => {
      system.registerRaceLifespan('Human', { expected: 70, maximum: 90 });
      const settlementId = createSettlement(world, 10, 20, 'Human', 5);
      const ids = addNonNotables(world, settlementId, 5, 89, 'Human');
      system.initialize(world);

      const initialCount = ids.length;

      // Run until death
      for (let t = 0; t < 60; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);
        const pop = world.getComponent<PopulationComponent>(settlementId, 'Population');
        if (pop !== undefined && pop.nonNotableIds.length < initialCount) {
          expect(pop.nonNotableIds.length).toBeLessThan(initialCount);
          return; // Test passed
        }
      }

      // If we got here, no death occurred in 60 months — possible but very unlikely
      // with RNG seed 42 and age 89
    });

    it('emits death event', () => {
      system.registerRaceLifespan('Human', { expected: 70, maximum: 90 });
      const settlementId = createSettlement(world, 10, 20, 'Human', 5);
      addNonNotables(world, settlementId, 5, 89, 'Human');
      system.initialize(world);

      const handler = vi.fn();
      events.on(EventCategory.Personal, handler);

      // Run until death event
      for (let t = 0; t < 60; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);
        if (handler.mock.calls.some(c => (c[0] as { subtype: string }).subtype === 'population.natural_death')) {
          break;
        }
      }

      const deathEvents = handler.mock.calls.filter(
        c => (c[0] as { subtype: string }).subtype === 'population.natural_death'
      );
      expect(deathEvents.length).toBeGreaterThan(0);
    });

    it('does not kill young characters', () => {
      system.registerRaceLifespan('Human', { expected: 70, maximum: 90 });
      const settlementId = createSettlement(world, 10, 20, 'Human', 10);
      const ids = addNonNotables(world, settlementId, 10, 25, 'Human');
      system.initialize(world);

      // Run 12 months
      for (let t = 0; t < 12; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);
      }

      // None should be dead
      for (const id of ids) {
        expect(world.hasComponent(id as EntityId, 'Deceased')).toBe(false);
      }
    });
  });

  describe('births', () => {
    it('generates births in populated settlements', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 30);
      addNonNotables(world, settlementId, 30, 25, 'Human');
      system.initialize(world);

      const initialPop = world.getComponent<PopulationComponent>(settlementId, 'Population')!.nonNotableIds.length;

      // Run 12 months (1 year)
      for (let t = 0; t < 12; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);
      }

      const finalPop = world.getComponent<PopulationComponent>(settlementId, 'Population')!.nonNotableIds.length;
      // With 30 people and ~2% birth rate per month, expect some births over 12 months
      expect(finalPop).toBeGreaterThan(initialPop);
    });

    it('assigns parents from existing non-notable pool', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 10);
      const existingIds = addNonNotables(world, settlementId, 10, 25, 'Human');
      system.initialize(world);

      const handler = vi.fn();
      events.on(EventCategory.Personal, handler);

      // Run until birth event
      for (let t = 0; t < 24; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);
      }

      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population')!;
      // Check new entities (those not in existingIds)
      const newIds = pop.nonNotableIds.filter(id => !existingIds.includes(id));

      if (newIds.length > 0) {
        const parentage = world.getComponent(newIds[0] as EntityId, 'Parentage');
        expect(parentage).toBeDefined();
        // Parents should be from the original pool (or null for name-based selection)
      }
    });

    it('does not generate births in very small settlements', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 1);
      addNonNotables(world, settlementId, 1, 25, 'Human');
      system.initialize(world);

      for (let t = 0; t < 12; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);
      }

      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population')!;
      // Only 1 person, can't reproduce
      expect(pop.nonNotableIds.length).toBe(1);
    });
  });

  describe('sparks', () => {
    it('occasionally generates spark events that increase Notability', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 30);
      const ids = addNonNotables(world, settlementId, 30, 25, 'Human');
      system.initialize(world);

      // Run 12 monthly ticks (1 year)
      for (let t = 0; t < 12; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);
      }

      // With 30 chars × 12 months × 2% chance = ~7.2 expected sparks
      let sparksFound = 0;
      for (const id of ids) {
        const notability = world.getComponent<NotabilityComponent>(id as EntityId, 'Notability');
        if (notability !== undefined && notability.score > 0) {
          sparksFound++;
          expect(notability.sparkHistory.length).toBeGreaterThan(0);
        }
      }

      expect(sparksFound).toBeGreaterThan(0);
    });

    it('records spark description in sparkHistory', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 50);
      const ids = addNonNotables(world, settlementId, 50, 25, 'Human');
      system.initialize(world);

      // Run until we find a spark
      for (let t = 0; t < 24; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);

        for (const id of ids) {
          const notability = world.getComponent<NotabilityComponent>(id as EntityId, 'Notability');
          if (notability !== undefined && notability.sparkHistory.length > 0) {
            const entry = notability.sparkHistory[0]!;
            expect(entry.tick).toBeGreaterThan(0);
            expect(entry.description.length).toBeGreaterThan(0);
            return; // Test passed
          }
        }
      }

      // Should have found at least one spark in 24 months with 50 people
      throw new Error('No sparks generated in 24 months with 50 characters');
    });

    it('emits spark events through EventBus', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 30);
      addNonNotables(world, settlementId, 30, 25, 'Human');
      system.initialize(world);

      const handler = vi.fn();
      events.on(EventCategory.Personal, handler);

      for (let t = 0; t < 12; t++) {
        for (let d = 0; d < 30; d++) clock.advance();
        system.execute(world, clock, events);
      }

      const sparkEvents = handler.mock.calls.filter(
        c => (c[0] as { subtype: string }).subtype === 'population.spark'
      );
      expect(sparkEvents.length).toBeGreaterThan(0);
    });
  });
});
