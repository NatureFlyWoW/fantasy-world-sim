import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
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
    'Personality', 'Goal', 'Memory',
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
  world.addComponent(eid, makeComponent({ type: 'Position' as const, x, y }));
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

function addNonNotables(world: World, settlementId: EntityId, count: number, age: number, race: string): number[] {
  const pos = world.getComponent(settlementId, 'Position') as { x: number; y: number };
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const eid = createNonNotable(world, {
      name: `Person ${i}`,
      race,
      age,
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
  const pop = world.getComponent<PopulationComponent>(settlementId, 'Population');
  if (pop !== undefined) {
    pop.nonNotableIds = ids;
  }
  return ids;
}

describe('Demographic Signals', () => {
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

  describe('war casualties reduce settlement population', () => {
    it('applies civilian casualties from battle events', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 20);
      addNonNotables(world, settlementId, 20, 25, 'Human');
      system.initialize(world);

      // First execute subscribes to events
      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      const popBefore = world.getComponent<PopulationComponent>(settlementId, 'Population')!.nonNotableIds.length;

      // Emit a battle casualties event
      events.emit(createEvent({
        category: EventCategory.Military,
        subtype: 'battle.resolved',
        timestamp: clock.currentTick,
        participants: [],
        significance: 60,
        data: {
          civilianCasualties: 5,
          affectedSiteId: settlementId as number,
        },
      }));

      // Next execution processes the signal
      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      const popAfter = world.getComponent<PopulationComponent>(settlementId, 'Population')!.nonNotableIds.length;
      expect(popAfter).toBeLessThan(popBefore);
      expect(popBefore - popAfter).toBeLessThanOrEqual(5);
    });

    it('marks killed non-notables with Deceased component', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 10);
      const ids = addNonNotables(world, settlementId, 10, 25, 'Human');
      system.initialize(world);

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      events.emit(createEvent({
        category: EventCategory.Military,
        subtype: 'battle.resolved',
        timestamp: clock.currentTick,
        participants: [],
        significance: 60,
        data: { civilianCasualties: 3, affectedSiteId: settlementId as number },
      }));

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      let deceasedCount = 0;
      for (const id of ids) {
        if (world.hasComponent(id as EntityId, 'Deceased')) {
          const deceased = world.getComponent(id as EntityId, 'Deceased') as { cause: string };
          expect(deceased.cause).toBe('war casualties');
          deceasedCount++;
        }
      }
      expect(deceasedCount).toBeGreaterThan(0);
      expect(deceasedCount).toBeLessThanOrEqual(3);
    });
  });

  describe('ecological disaster casualties', () => {
    it('applies casualties from disaster events', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 15);
      addNonNotables(world, settlementId, 15, 30, 'Human');
      system.initialize(world);

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      events.emit(createEvent({
        category: EventCategory.Disaster,
        subtype: 'ecology.drought',
        timestamp: clock.currentTick,
        participants: [],
        significance: 50,
        data: { estimatedCasualties: 4, regionId: 1 },
      }));

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population')!;
      expect(pop.nonNotableIds.length).toBeLessThan(15);
    });
  });

  describe('magic catastrophe casualties', () => {
    it('applies casualties from magic catastrophe events', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 15);
      addNonNotables(world, settlementId, 15, 30, 'Human');
      system.initialize(world);

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      events.emit(createEvent({
        category: EventCategory.Magical,
        subtype: 'magic.catastrophe.manastorm',
        timestamp: clock.currentTick,
        participants: [],
        significance: 70,
        data: { magicCasualties: 3 },
      }));

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population')!;
      expect(pop.nonNotableIds.length).toBeLessThan(15);
    });
  });

  describe('surviving trauma boosts Notability (Task 15)', () => {
    it('survivors of casualties gain Notability boost', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 10);
      addNonNotables(world, settlementId, 10, 25, 'Human');
      system.initialize(world);

      // Record initial scores
      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population')!;
      const initialScores = new Map<number, number>();
      for (const id of pop.nonNotableIds) {
        const not = world.getComponent<NotabilityComponent>(id as EntityId, 'Notability');
        if (not !== undefined) initialScores.set(id, not.score);
      }

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      // Emit casualties event (kill some)
      events.emit(createEvent({
        category: EventCategory.Military,
        subtype: 'battle.resolved',
        timestamp: clock.currentTick,
        participants: [],
        significance: 60,
        data: { civilianCasualties: 3, affectedSiteId: settlementId as number },
      }));

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      // Survivors should have boosted scores
      const survivingPop = world.getComponent<PopulationComponent>(settlementId, 'Population')!;
      let boostedCount = 0;
      for (const id of survivingPop.nonNotableIds) {
        const not = world.getComponent<NotabilityComponent>(id as EntityId, 'Notability');
        const initial = initialScores.get(id) ?? 0;
        if (not !== undefined && not.score > initial) {
          boostedCount++;
          expect(not.score - initial).toBeGreaterThanOrEqual(20);
          expect(not.score - initial).toBeLessThanOrEqual(40);
        }
      }
      expect(boostedCount).toBeGreaterThan(0);
    });

    it('records trauma in sparkHistory', () => {
      const settlementId = createSettlement(world, 10, 20, 'Human', 10);
      addNonNotables(world, settlementId, 10, 25, 'Human');
      system.initialize(world);

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      events.emit(createEvent({
        category: EventCategory.Military,
        subtype: 'battle.resolved',
        timestamp: clock.currentTick,
        participants: [],
        significance: 60,
        data: { civilianCasualties: 2, affectedSiteId: settlementId as number },
      }));

      for (let d = 0; d < 30; d++) clock.advance();
      system.execute(world, clock, events);

      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population')!;
      let foundTraumaSpark = false;
      for (const id of pop.nonNotableIds) {
        const not = world.getComponent<NotabilityComponent>(id as EntityId, 'Notability');
        if (not !== undefined) {
          const traumaSpark = not.sparkHistory.find(s => s.description.includes('survived'));
          if (traumaSpark !== undefined) {
            foundTraumaSpark = true;
            break;
          }
        }
      }
      expect(foundTraumaSpark).toBe(true);
    });
  });
});
