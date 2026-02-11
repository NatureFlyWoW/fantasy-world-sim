import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import {
  SettlementLifecycleSystem,
  SETTLEMENT_TIERS,
  ABANDONMENT_THRESHOLD,
  ABANDONMENT_DURATION,
  MIN_PIONEERS,
} from './settlement-lifecycle.js';
import type { EntityId } from '../ecs/types.js';
import type {
  PopulationComponent,
  StatusComponent,
  PositionComponent,
} from '../ecs/component.js';
import type { WorldEvent } from '../events/types.js';

// =============================================================================
// Helpers
// =============================================================================

function registerAllComponents(world: World): void {
  const types = [
    'Position',
    'Status',
    'Notability',
    'Parentage',
    'Deceased',
    'Population',
    'PopulationDemographics',
    'Economy',
    'Biome',
    'Ownership',
    'Health',
    'CreatureType',
    'HiddenLocation',
    'Personality',
    'Goal',
    'Memory',
  ];
  for (const type of types) {
    world.registerComponent(type);
  }
}

function makeComponent<T extends { type: string }>(
  data: T,
): T & { serialize(): Record<string, unknown> } {
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
  options?: {
    conditions?: string[];
    wealth?: number;
    ownerId?: number | null;
    socialClass?: string;
    titles?: string[];
    nonNotableIds?: number[];
  },
): EntityId {
  const eid = world.createEntity();
  world.addComponent(eid, makeComponent({ type: 'Position' as const, x, y }));
  world.addComponent(
    eid,
    makeComponent({
      type: 'Population' as const,
      count: popCount,
      growthRate: 0.02,
      nonNotableIds: options?.nonNotableIds ?? ([] as number[]),
    }),
  );
  world.addComponent(
    eid,
    makeComponent({
      type: 'PopulationDemographics' as const,
      raceDistribution: new Map([[race, popCount]]),
      ageDistribution: new Map<string, number>(),
    }),
  );
  world.addComponent(
    eid,
    makeComponent({
      type: 'Status' as const,
      conditions: options?.conditions ?? [],
      titles: options?.titles ?? ['Settlement'],
      socialClass: options?.socialClass ?? 'village',
    }),
  );
  world.addComponent(
    eid,
    makeComponent({
      type: 'Economy' as const,
      wealth: options?.wealth ?? 50,
      tradeVolume: 10,
      industries: ['farming'],
    }),
  );
  world.addComponent(
    eid,
    makeComponent({
      type: 'Ownership' as const,
      ownerId: options?.ownerId !== undefined ? options.ownerId : null,
      claimStrength: 1,
    }),
  );
  return eid;
}

function createMigrantEntity(world: World, x: number, y: number): EntityId {
  const eid = world.createEntity();
  world.addComponent(eid, makeComponent({ type: 'Position' as const, x, y }));
  return eid;
}

// =============================================================================
// Tests
// =============================================================================

describe('SettlementLifecycleSystem', () => {
  let world: World;
  let clock: WorldClock;
  let events: EventBus;
  let rng: SeededRNG;
  let system: SettlementLifecycleSystem;

  beforeEach(() => {
    world = new World();
    registerAllComponents(world);
    clock = new WorldClock();
    events = new EventBus();
    rng = new SeededRNG(42);
    system = new SettlementLifecycleSystem(rng);
  });

  // ---------------------------------------------------------------------------
  // System properties
  // ---------------------------------------------------------------------------

  describe('system properties', () => {
    it('has correct system properties', () => {
      expect(system.name).toBe('SettlementLifecycleSystem');
      expect(system.frequency).toBe(30); // TickFrequency.Monthly
      expect(system.executionOrder).toBe(45); // ExecutionOrder.SETTLEMENT_LIFECYCLE
    });
  });

  // ---------------------------------------------------------------------------
  // Growth tiers (Task 18)
  // ---------------------------------------------------------------------------

  describe('growth tiers', () => {
    it('promotes settlement from village to town when population crosses 75', () => {
      createSettlement(world, 10, 10, 'Human', 80, { socialClass: 'village' });

      system.execute(world, clock, events);

      const settlements = world.query('Population');
      const status = world.getComponent<StatusComponent>(settlements[0]!, 'Status');
      expect(status).toBeDefined();
      expect(status!.socialClass).toBe('town');
    });

    it('demotes settlement from town to village when population drops', () => {
      createSettlement(world, 10, 10, 'Human', 50, { socialClass: 'town' });

      system.execute(world, clock, events);

      const settlements = world.query('Population');
      const status = world.getComponent<StatusComponent>(settlements[0]!, 'Status');
      expect(status).toBeDefined();
      expect(status!.socialClass).toBe('village');
    });

    it('emits tier change event', () => {
      createSettlement(world, 10, 10, 'Human', 80, {
        socialClass: 'village',
        titles: ['Oakvale'],
      });

      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Personal, (evt) => emitted.push(evt));

      clock.advanceBy(30);
      system.execute(world, clock, events);

      expect(emitted.length).toBeGreaterThanOrEqual(1);
      const tierEvt = emitted.find((e) => e.subtype === 'settlement.tier_change');
      expect(tierEvt).toBeDefined();
      expect(tierEvt!.category).toBe(EventCategory.Personal);
      expect(tierEvt!.data['previousTier']).toBe('village');
      expect(tierEvt!.data['newTier']).toBe('town');
      expect(tierEvt!.data['settlementName']).toBe('Oakvale');
      expect(tierEvt!.data['population']).toBe(80);
      expect(tierEvt!.significance).toBe(50); // town significance
    });

    it('does not emit event when tier is unchanged', () => {
      // Population 20 is village tier (>= 15, < 75), and socialClass is already 'village'
      createSettlement(world, 10, 10, 'Human', 20, { socialClass: 'village' });

      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Personal, (evt) => emitted.push(evt));

      system.execute(world, clock, events);

      const tierEvents = emitted.filter((e) => e.subtype === 'settlement.tier_change');
      expect(tierEvents.length).toBe(0);
    });

    it('promotes directly to city when population is 300+', () => {
      createSettlement(world, 10, 10, 'Human', 350, { socialClass: 'village' });

      system.execute(world, clock, events);

      const settlements = world.query('Population');
      const status = world.getComponent<StatusComponent>(settlements[0]!, 'Status');
      expect(status!.socialClass).toBe('city');
    });
  });

  // ---------------------------------------------------------------------------
  // Settlement founding (Task 19)
  // ---------------------------------------------------------------------------

  describe('settlement founding', () => {
    it('founds new settlement when population pressure exceeds threshold', () => {
      // Village tier: minPop=15, pressure threshold = minPop * 1.5 = 22.5
      // Population of 50 exceeds this, so founding should trigger if enough pioneers
      // Need at least MIN_PIONEERS (3) from 10-20% of nonNotableIds
      // With 50 non-notables: 10-20% = 5-10 pioneers, well above MIN_PIONEERS
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 50; i++) {
        const m = createMigrantEntity(world, 10, 10);
        nonNotableIds.push(m as number);
      }

      createSettlement(world, 10, 10, 'Human', 50, {
        socialClass: 'village',
        nonNotableIds,
      });

      const entityCountBefore = world.entityCount();

      system.execute(world, clock, events);

      // A new settlement entity should have been created (plus its components add no entities)
      expect(world.entityCount()).toBeGreaterThan(entityCountBefore);

      // Source settlement should have lost some pioneers
      const settlements = world.query('Population');
      // There should now be at least 2 settlements
      expect(settlements.length).toBeGreaterThanOrEqual(2);
    });

    it('new settlement starts as camp', () => {
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 50; i++) {
        const m = createMigrantEntity(world, 10, 10);
        nonNotableIds.push(m as number);
      }

      const source = createSettlement(world, 10, 10, 'Human', 50, {
        socialClass: 'village',
        nonNotableIds,
      });

      system.execute(world, clock, events);

      // Find the new settlement (not the source)
      const settlements = world.query('Population');
      const newSettlements = settlements.filter((id) => id !== source);
      expect(newSettlements.length).toBeGreaterThanOrEqual(1);

      const newStatus = world.getComponent<StatusComponent>(newSettlements[0]!, 'Status');
      expect(newStatus).toBeDefined();
      // New settlement starts as camp, but updateGrowthTiers runs first and may
      // have promoted it if it has enough pop. Since pioneers are ~5-10 out of 50,
      // that's < 15, so it stays as camp.
      expect(newStatus!.socialClass).toBe('camp');
    });

    it('emits founding event with correct data', () => {
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 50; i++) {
        const m = createMigrantEntity(world, 10, 10);
        nonNotableIds.push(m as number);
      }

      createSettlement(world, 10, 10, 'Human', 50, {
        socialClass: 'village',
        titles: ['Millhaven'],
        nonNotableIds,
      });

      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Personal, (evt) => emitted.push(evt));

      system.execute(world, clock, events);

      const foundingEvt = emitted.find((e) => e.subtype === 'settlement.founded');
      expect(foundingEvt).toBeDefined();
      expect(foundingEvt!.category).toBe(EventCategory.Personal);
      expect(foundingEvt!.significance).toBe(55);
      expect(foundingEvt!.data['sourceName']).toBe('Millhaven');
      expect(foundingEvt!.data['newSettlementName']).toBe('New Settlement');
      expect(foundingEvt!.data['pioneerCount']).toBeGreaterThanOrEqual(MIN_PIONEERS);
      expect(foundingEvt!.data['location']).toBeDefined();
    });

    it('does not found settlement when too few pioneers', () => {
      // Only 2 non-notables: 10-20% = 0, which is < MIN_PIONEERS
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 2; i++) {
        const m = createMigrantEntity(world, 10, 10);
        nonNotableIds.push(m as number);
      }

      createSettlement(world, 10, 10, 'Human', 50, {
        socialClass: 'village',
        nonNotableIds,
      });

      const entityCountBefore = world.entityCount();

      system.execute(world, clock, events);

      // No new settlement should be created (only entity change is from tier update)
      const settlements = world.query('Population');
      expect(settlements.length).toBe(1); // Still just the original
    });
  });

  // ---------------------------------------------------------------------------
  // Abandonment (Task 20)
  // ---------------------------------------------------------------------------

  describe('abandonment', () => {
    it('starts tracking decline when population drops below threshold', () => {
      createSettlement(world, 10, 10, 'Human', 3, { socialClass: 'camp' });

      system.execute(world, clock, events);

      // Settlement should not be abandoned yet (just started tracking)
      const settlements = world.query('Population');
      const status = world.getComponent<StatusComponent>(settlements[0]!, 'Status');
      expect(status!.socialClass).not.toBe('ruins');
      expect(status!.conditions).not.toContain('abandoned');
    });

    it('abandons settlement after extended depopulation', () => {
      // Create some non-notables so we can verify they get cleared
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 3; i++) {
        const m = createMigrantEntity(world, 10, 10);
        nonNotableIds.push(m as number);
      }

      createSettlement(world, 10, 10, 'Human', 3, {
        socialClass: 'camp',
        nonNotableIds,
      });

      // First execution — starts decline tracking at tick 0
      system.execute(world, clock, events);

      // Advance clock past ABANDONMENT_DURATION (720 ticks)
      clock.advanceBy(ABANDONMENT_DURATION);

      // Second execution — should abandon
      system.execute(world, clock, events);

      const settlements = world.query('Population');
      const status = world.getComponent<StatusComponent>(settlements[0]!, 'Status');
      expect(status!.socialClass).toBe('ruins');
      expect(status!.conditions).toContain('abandoned');

      const pop = world.getComponent<PopulationComponent>(settlements[0]!, 'Population');
      expect(pop!.count).toBe(0);
      expect(pop!.nonNotableIds).toEqual([]);
    });

    it('emits abandonment event with correct data', () => {
      createSettlement(world, 10, 10, 'Human', 3, {
        socialClass: 'camp',
        titles: ['Dusthollow'],
      });

      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Personal, (evt) => emitted.push(evt));

      // Start tracking
      system.execute(world, clock, events);

      // Advance past threshold
      clock.advanceBy(ABANDONMENT_DURATION);
      system.execute(world, clock, events);

      const abandonEvt = emitted.find((e) => e.subtype === 'settlement.abandoned');
      expect(abandonEvt).toBeDefined();
      expect(abandonEvt!.category).toBe(EventCategory.Personal);
      expect(abandonEvt!.significance).toBe(50);
      expect(abandonEvt!.data['settlementName']).toBe('Dusthollow');
      expect(abandonEvt!.data['population']).toBe(3);
      expect(abandonEvt!.data['yearsInDecline']).toBe(
        Math.floor(ABANDONMENT_DURATION / 360),
      );
    });

    it('migrates survivors on abandonment to nearby settlement', () => {
      // Source: tiny settlement about to be abandoned
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 3; i++) {
        const m = createMigrantEntity(world, 10, 10);
        nonNotableIds.push(m as number);
      }

      createSettlement(world, 10, 10, 'Human', 3, {
        socialClass: 'camp',
        nonNotableIds,
      });

      // Target: healthy settlement nearby
      const target = createSettlement(world, 12, 12, 'Human', 50, {
        socialClass: 'village',
        wealth: 60,
      });

      // Start tracking
      system.execute(world, clock, events);

      // Advance past threshold
      clock.advanceBy(ABANDONMENT_DURATION);
      system.execute(world, clock, events);

      // Target should have gained migrants
      const targetPop = world.getComponent<PopulationComponent>(target, 'Population');
      expect(targetPop!.nonNotableIds.length).toBeGreaterThan(0);
      // The migrants should be among the target's nonNotableIds
      for (const mid of nonNotableIds) {
        expect(targetPop!.nonNotableIds).toContain(mid);
      }
    });

    it('recovers from decline if population rises', () => {
      const settlement = createSettlement(world, 10, 10, 'Human', 3, {
        socialClass: 'camp',
      });

      // Start tracking at tick 0
      system.execute(world, clock, events);

      // Increase population above threshold before abandonment
      const pop = world.getComponent<PopulationComponent>(settlement, 'Population')!;
      pop.count = ABANDONMENT_THRESHOLD + 5;

      clock.advanceBy(ABANDONMENT_DURATION);
      system.execute(world, clock, events);

      // Should NOT be abandoned
      const status = world.getComponent<StatusComponent>(settlement, 'Status');
      expect(status!.socialClass).not.toBe('ruins');
      expect(status!.conditions).not.toContain('abandoned');
    });
  });

  // ---------------------------------------------------------------------------
  // Migration
  // ---------------------------------------------------------------------------

  describe('migration', () => {
    it('triggers migration from war-torn settlement', () => {
      // Source: at war, with non-notables to migrate
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 10; i++) {
        const m = createMigrantEntity(world, 5, 5);
        nonNotableIds.push(m as number);
      }

      createSettlement(world, 5, 5, 'Human', 30, {
        socialClass: 'village',
        conditions: ['war'],
        wealth: 50,
        nonNotableIds,
      });

      // Target: peaceful, wealthy
      const target = createSettlement(world, 8, 8, 'Human', 50, {
        socialClass: 'town',
        wealth: 80,
      });

      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Personal, (evt) => emitted.push(evt));

      system.execute(world, clock, events);

      // Some migration should have occurred — check for migration event
      const migrationEvts = emitted.filter((e) => e.subtype === 'population.migration');
      expect(migrationEvts.length).toBeGreaterThanOrEqual(1);

      // Target should have gained some migrants
      const targetPop = world.getComponent<PopulationComponent>(target, 'Population');
      expect(targetPop!.nonNotableIds.length).toBeGreaterThan(0);
    });

    it('triggers migration from poor settlement', () => {
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 10; i++) {
        const m = createMigrantEntity(world, 5, 5);
        nonNotableIds.push(m as number);
      }

      createSettlement(world, 5, 5, 'Human', 30, {
        socialClass: 'village',
        wealth: 10, // Below 20 threshold
        nonNotableIds,
      });

      // Target: prosperous
      const target = createSettlement(world, 8, 8, 'Human', 50, {
        socialClass: 'town',
        wealth: 80,
      });

      system.execute(world, clock, events);

      // Target should have gained migrants
      const targetPop = world.getComponent<PopulationComponent>(target, 'Population');
      expect(targetPop!.nonNotableIds.length).toBeGreaterThan(0);
    });

    it('does not trigger migration from prosperous peaceful settlement', () => {
      const nonNotableIds: number[] = [];
      for (let i = 0; i < 10; i++) {
        const m = createMigrantEntity(world, 5, 5);
        nonNotableIds.push(m as number);
      }

      createSettlement(world, 5, 5, 'Human', 20, {
        socialClass: 'village',
        wealth: 50, // Above 20 threshold
        conditions: [], // No war
        nonNotableIds,
      });

      // Target
      createSettlement(world, 8, 8, 'Human', 50, {
        socialClass: 'town',
        wealth: 80,
      });

      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Personal, (evt) => emitted.push(evt));

      system.execute(world, clock, events);

      // No stress-driven migration events (tier changes may still fire)
      const migrationEvts = emitted.filter((e) => e.subtype === 'population.migration');
      expect(migrationEvts.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Tier constants sanity check
  // ---------------------------------------------------------------------------

  describe('constants', () => {
    it('SETTLEMENT_TIERS are in ascending minPop order', () => {
      for (let i = 1; i < SETTLEMENT_TIERS.length; i++) {
        expect(SETTLEMENT_TIERS[i]!.minPop).toBeGreaterThan(
          SETTLEMENT_TIERS[i - 1]!.minPop,
        );
      }
    });

    it('ABANDONMENT_THRESHOLD is below the lowest non-camp tier', () => {
      expect(ABANDONMENT_THRESHOLD).toBeLessThan(SETTLEMENT_TIERS[1]!.minPop);
    });
  });
});
