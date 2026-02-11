import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import { scoreMigrationTargets, executeMigration } from './migration.js';
import type { EntityId } from '../ecs/types.js';
import type {
  PositionComponent,
  PopulationComponent,
  PopulationDemographicsComponent,
  EconomyComponent,
  StatusComponent,
  OwnershipComponent,
} from '../ecs/component.js';
import type { WorldEvent } from '../events/types.js';

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

function createSettlement(
  world: World,
  x: number,
  y: number,
  race: string,
  popCount: number,
  options?: { conditions?: string[]; wealth?: number; ownerId?: number | null },
): EntityId {
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
    conditions: options?.conditions ?? [],
    titles: ['Settlement'],
    socialClass: 'settlement',
  }));
  world.addComponent(eid, makeComponent({
    type: 'Economy' as const,
    wealth: options?.wealth ?? 50,
    tradeVolume: 10,
    industries: ['farming'],
  }));
  world.addComponent(eid, makeComponent({
    type: 'Ownership' as const,
    ownerId: options?.ownerId !== undefined ? options.ownerId : null,
    claimStrength: 1,
  }));
  return eid;
}

function createMigrantEntity(world: World, x: number, y: number): EntityId {
  const eid = world.createEntity();
  world.addComponent(eid, makeComponent({ type: 'Position' as const, x, y }));
  return eid;
}

describe('Migration', () => {
  let world: World;
  let clock: WorldClock;
  let events: EventBus;

  beforeEach(() => {
    world = new World();
    registerAllComponents(world);
    clock = new WorldClock();
    events = new EventBus();
  });

  describe('scoreMigrationTargets', () => {
    it('scores destinations by distance, safety, prosperity, and cultural affinity', () => {
      // Source settlement at (0, 0), Human, faction 1
      const source = createSettlement(world, 0, 0, 'Human', 100, { ownerId: 1 });

      // Target A: close, safe, wealthy, same race+faction => highest score
      const targetA = createSettlement(world, 2, 2, 'Human', 50, {
        wealth: 80,
        ownerId: 1,
      });

      // Target B: medium distance, safe, moderate wealth, different race
      const targetB = createSettlement(world, 10, 10, 'Elf', 40, {
        wealth: 40,
        ownerId: 2,
      });

      // Target C: close but at war, poor, different faction
      const targetC = createSettlement(world, 3, 3, 'Human', 30, {
        conditions: ['at war with Faction X'],
        wealth: 10,
        ownerId: 3,
      });

      const scores = scoreMigrationTargets(
        source as number,
        world,
        1.0,
        'Human',
        1,
      );

      expect(scores.length).toBe(3);

      // Target A should be first (close + safe + wealthy + same race + same faction)
      expect(scores[0]!.targetSiteId).toBe(targetA as number);
      // Target B or C next - B is safer but farther; C is close but at war
      // B has safety(+20) + wealth(12) but lower distance score
      // C has no safety, wealth(3), but better distance score + same race(+20)
      // Let's verify A is clearly the best
      expect(scores[0]!.score).toBeGreaterThan(scores[1]!.score);
      expect(scores[0]!.score).toBeGreaterThan(scores[2]!.score);

      // Verify reason strings contain useful info
      expect(scores[0]!.reason).toContain('safe');
      expect(scores[0]!.reason).toContain('same-race');
      expect(scores[0]!.reason).toContain('same-faction');
    });

    it('returns empty array when source has no Position', () => {
      // Create an entity with Population but no Position
      const eid = world.createEntity();
      world.addComponent(eid, makeComponent({
        type: 'Population' as const,
        count: 10,
        growthRate: 0.02,
        nonNotableIds: [],
      }));

      const scores = scoreMigrationTargets(eid as number, world, 1.0, 'Human', 1);
      expect(scores).toEqual([]);
    });

    it('excludes the source settlement from results', () => {
      const source = createSettlement(world, 0, 0, 'Human', 100);
      createSettlement(world, 5, 5, 'Human', 50);

      const scores = scoreMigrationTargets(source as number, world, 1.0, 'Human', 1);
      const sourceInResults = scores.find((s) => s.targetSiteId === (source as number));
      expect(sourceInResults).toBeUndefined();
      expect(scores.length).toBe(1);
    });

    it('applies pushFactor multiplier to all scores', () => {
      const source = createSettlement(world, 0, 0, 'Human', 100);
      createSettlement(world, 5, 5, 'Human', 50);

      const scoresBase = scoreMigrationTargets(source as number, world, 1.0, 'Human', 1);
      const scoresDoubled = scoreMigrationTargets(source as number, world, 2.0, 'Human', 1);

      expect(scoresDoubled[0]!.score).toBeCloseTo(scoresBase[0]!.score * 2, 5);
    });
  });

  describe('executeMigration', () => {
    it('moves entities between settlements', () => {
      const source = createSettlement(world, 0, 0, 'Human', 10);
      const target = createSettlement(world, 10, 10, 'Human', 5);

      // Create migrant entities and register them at source
      const migrants: number[] = [];
      for (let i = 0; i < 3; i++) {
        const m = createMigrantEntity(world, 0, 0);
        migrants.push(m as number);
      }

      const sourcePop = world.getComponent<PopulationComponent>(source, 'Population')!;
      sourcePop.nonNotableIds = [...migrants, 100, 101, 102]; // 3 migrants + 3 staying
      sourcePop.count = 6;

      const targetPop = world.getComponent<PopulationComponent>(target, 'Population')!;
      targetPop.nonNotableIds = [200, 201];
      targetPop.count = 2;

      executeMigration(world, migrants, source as number, target as number, clock, events);

      // Source should have lost the migrants
      const srcAfter = world.getComponent<PopulationComponent>(source, 'Population')!;
      expect(srcAfter.nonNotableIds).toEqual([100, 101, 102]);
      expect(srcAfter.count).toBe(3);

      // Target should have gained the migrants
      const tgtAfter = world.getComponent<PopulationComponent>(target, 'Population')!;
      expect(tgtAfter.nonNotableIds).toContain(migrants[0]);
      expect(tgtAfter.nonNotableIds).toContain(migrants[1]);
      expect(tgtAfter.nonNotableIds).toContain(migrants[2]);
      expect(tgtAfter.count).toBe(5);
    });

    it('updates Position components to target site coordinates', () => {
      const source = createSettlement(world, 0, 0, 'Human', 10);
      const target = createSettlement(world, 25, 30, 'Human', 5);

      const migrants: number[] = [];
      for (let i = 0; i < 2; i++) {
        const m = createMigrantEntity(world, 0, 0);
        migrants.push(m as number);
      }

      const sourcePop = world.getComponent<PopulationComponent>(source, 'Population')!;
      sourcePop.nonNotableIds = [...migrants];
      sourcePop.count = 2;

      executeMigration(world, migrants, source as number, target as number, clock, events);

      for (const mid of migrants) {
        const pos = world.getComponent<PositionComponent>(mid as EntityId, 'Position')!;
        expect(pos.x).toBe(25);
        expect(pos.y).toBe(30);
      }
    });

    it('emits migration event with correct category and data', () => {
      const source = createSettlement(world, 0, 0, 'Human', 10);
      const target = createSettlement(world, 10, 10, 'Human', 5);

      const migrants = [createMigrantEntity(world, 0, 0) as number];

      const sourcePop = world.getComponent<PopulationComponent>(source, 'Population')!;
      sourcePop.nonNotableIds = [...migrants];
      sourcePop.count = 1;

      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Personal, (evt) => emitted.push(evt));

      clock.advanceBy(42);

      executeMigration(world, migrants, source as number, target as number, clock, events);

      expect(emitted.length).toBe(1);
      const evt = emitted[0]!;
      expect(evt.category).toBe(EventCategory.Personal);
      expect(evt.subtype).toBe('population.migration');
      expect(evt.timestamp).toBe(42);
      expect(evt.data['sourceSiteId']).toBe(source as number);
      expect(evt.data['targetSiteId']).toBe(target as number);
      expect(evt.data['migrantCount']).toBe(1);
      expect(evt.participants).toContain(source);
      expect(evt.participants).toContain(target);
    });

    it('produces no changes with empty entityIds', () => {
      const source = createSettlement(world, 0, 0, 'Human', 10);
      const target = createSettlement(world, 10, 10, 'Human', 5);

      const sourcePop = world.getComponent<PopulationComponent>(source, 'Population')!;
      sourcePop.nonNotableIds = [1, 2, 3];
      sourcePop.count = 3;

      const targetPop = world.getComponent<PopulationComponent>(target, 'Population')!;
      targetPop.nonNotableIds = [10, 11];
      targetPop.count = 2;

      const emitted: WorldEvent[] = [];
      events.onAny((evt) => emitted.push(evt));

      executeMigration(world, [], source as number, target as number, clock, events);

      // No changes to source
      expect(sourcePop.nonNotableIds).toEqual([1, 2, 3]);
      expect(sourcePop.count).toBe(3);

      // No changes to target
      expect(targetPop.nonNotableIds).toEqual([10, 11]);
      expect(targetPop.count).toBe(2);

      // No events emitted
      expect(emitted.length).toBe(0);
    });
  });
});
