/**
 * Tests for the Religious System — divine power, interventions, church politics, and syncretism.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldEvent } from '../events/types.js';
import { EventCategory } from '../events/types.js';
import { EventBus } from '../events/event-bus.js';
import { WorldClock } from '../time/world-clock.js';
import { toEntityId, toDeityId, toCharacterId } from '../ecs/types.js';
import type { EntityId, DeityId, CharacterId } from '../ecs/types.js';
import {
  Domain,
  ALL_DOMAINS,
  InterventionType,
  ALL_INTERVENTION_TYPES,
  INTERVENTION_COSTS,
  DoctrineType,
  ALL_DOCTRINE_TYPES,
  ALL_CHURCH_EVENT_TYPES,
  HolyFigureType,
  ALL_HOLY_FIGURE_TYPES,
  calculateDivinePower,
  canIntervene,
  calculateSchismProbability,
  calculateSyncretismInfluence,
  createDeitySimId,
  createReligionId,
  createHolyFigureId,
  resetReligionIdCounters,
  ReligionSystem,
  type SimDeity,
  type Religion,
  type DevotionRecord,
  type HolyFigure,
} from './religion.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function did(n: number): DeityId {
  return toDeityId(toEntityId(n));
}

function eid(n: number): EntityId {
  return toEntityId(n);
}

function cid(n: number): CharacterId {
  return toCharacterId(toEntityId(n));
}

function makeDeity(overrides: Partial<SimDeity> & { id: DeityId }): SimDeity {
  return {
    name: 'Test Deity',
    primaryDomain: Domain.War,
    secondaryDomains: [],
    basePowerLevel: 5,
    currentPower: 100,
    isInterventionist: true,
    doctrine: DoctrineType.Obedience,
    alive: true,
    lastInterventionTick: 0,
    worshiperCount: 1000,
    averageDevotionLevel: 60,
    ...overrides,
  };
}

function makeReligion(overrides: Partial<Religion> & { id: EntityId; primaryDeityId: DeityId }): Religion {
  return {
    name: 'Test Religion',
    secondaryDeityIds: [],
    foundedTick: 0,
    founderCharacterId: null,
    doctrine: DoctrineType.Compassion,
    corruptionLevel: 0,
    reformPressure: 0,
    schismRisk: 0,
    memberCount: 1000,
    sites: [],
    headquarters: null,
    isStateReligion: new Map(),
    syncreticInfluences: new Map(),
    ...overrides,
  };
}

function makeDevotion(overrides: Partial<DevotionRecord> & { characterId: CharacterId; religionId: EntityId }): DevotionRecord {
  return {
    devotionLevel: 70,
    joinedTick: 0,
    lastPrayerTick: 0,
    miraclesWitnessed: 0,
    ...overrides,
  };
}

// Seeded RNG for deterministic tests
function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// ── Enum and constant tests ───────────────────────────────────────────────────

describe('Religion System Enums and Constants', () => {
  describe('Domain enum', () => {
    it('contains all 18 domains', () => {
      expect(ALL_DOMAINS).toHaveLength(18);
    });

    it('includes expected domains', () => {
      expect(ALL_DOMAINS).toContain(Domain.War);
      expect(ALL_DOMAINS).toContain(Domain.Death);
      expect(ALL_DOMAINS).toContain(Domain.Life);
      expect(ALL_DOMAINS).toContain(Domain.Nature);
      expect(ALL_DOMAINS).toContain(Domain.Magic);
      expect(ALL_DOMAINS).toContain(Domain.Knowledge);
    });
  });

  describe('InterventionType enum', () => {
    it('contains all intervention types', () => {
      expect(ALL_INTERVENTION_TYPES).toHaveLength(9);
    });

    it('includes expected intervention types', () => {
      expect(ALL_INTERVENTION_TYPES).toContain(InterventionType.EmpowerChampion);
      expect(ALL_INTERVENTION_TYPES).toContain(InterventionType.PropheticVision);
      expect(ALL_INTERVENTION_TYPES).toContain(InterventionType.PhysicalManifestation);
      expect(ALL_INTERVENTION_TYPES).toContain(InterventionType.BlessSite);
    });
  });

  describe('INTERVENTION_COSTS', () => {
    it('defines costs for all intervention types', () => {
      for (const type of ALL_INTERVENTION_TYPES) {
        expect(INTERVENTION_COSTS[type]).toBeDefined();
        expect(INTERVENTION_COSTS[type].powerCost).toBeGreaterThan(0);
        expect(INTERVENTION_COSTS[type].minimumPower).toBeGreaterThan(0);
      }
    });

    it('physical manifestation is the most expensive', () => {
      const manifestationCost = INTERVENTION_COSTS[InterventionType.PhysicalManifestation];
      for (const type of ALL_INTERVENTION_TYPES) {
        expect(INTERVENTION_COSTS[type].powerCost).toBeLessThanOrEqual(manifestationCost.powerCost);
      }
    });

    it('send omen is the cheapest', () => {
      const omenCost = INTERVENTION_COSTS[InterventionType.SendOmen];
      for (const type of ALL_INTERVENTION_TYPES) {
        expect(INTERVENTION_COSTS[type].powerCost).toBeGreaterThanOrEqual(omenCost.powerCost);
      }
    });
  });

  describe('DoctrineType enum', () => {
    it('contains all doctrine types', () => {
      expect(ALL_DOCTRINE_TYPES).toHaveLength(5);
    });
  });

  describe('ChurchEventType enum', () => {
    it('contains all church event types', () => {
      expect(ALL_CHURCH_EVENT_TYPES).toHaveLength(9);
    });
  });

  describe('HolyFigureType enum', () => {
    it('contains all holy figure types', () => {
      expect(ALL_HOLY_FIGURE_TYPES).toHaveLength(6);
    });

    it('includes prophets, saints, and martyrs', () => {
      expect(ALL_HOLY_FIGURE_TYPES).toContain(HolyFigureType.Prophet);
      expect(ALL_HOLY_FIGURE_TYPES).toContain(HolyFigureType.Saint);
      expect(ALL_HOLY_FIGURE_TYPES).toContain(HolyFigureType.Martyr);
    });
  });
});

// ── Divine power calculations ─────────────────────────────────────────────────

describe('Divine Power Calculations', () => {
  describe('calculateDivinePower', () => {
    it('returns 0 for 0 worshipers', () => {
      expect(calculateDivinePower(0, 100, 10)).toBe(0);
    });

    it('increases with worshiper count', () => {
      const power10 = calculateDivinePower(10, 50, 5);
      const power100 = calculateDivinePower(100, 50, 5);
      const power1000 = calculateDivinePower(1000, 50, 5);

      expect(power100).toBeGreaterThan(power10);
      expect(power1000).toBeGreaterThan(power100);
    });

    it('increases with devotion level', () => {
      const lowDevotion = calculateDivinePower(1000, 20, 5);
      const medDevotion = calculateDivinePower(1000, 50, 5);
      const highDevotion = calculateDivinePower(1000, 100, 5);

      expect(medDevotion).toBeGreaterThan(lowDevotion);
      expect(highDevotion).toBeGreaterThan(medDevotion);
    });

    it('increases with base power level', () => {
      const lowPower = calculateDivinePower(1000, 50, 1);
      const medPower = calculateDivinePower(1000, 50, 5);
      const highPower = calculateDivinePower(1000, 50, 10);

      expect(medPower).toBeGreaterThan(lowPower);
      expect(highPower).toBeGreaterThan(medPower);
    });

    it('uses logarithmic scaling for worshiper count', () => {
      // Doubling worshipers should not double power
      const power1000 = calculateDivinePower(1000, 50, 5);
      const power2000 = calculateDivinePower(2000, 50, 5);

      expect(power2000).toBeLessThan(power1000 * 2);
      expect(power2000).toBeGreaterThan(power1000);
    });

    it('handles very large worshiper counts', () => {
      const power = calculateDivinePower(1000000, 80, 10);
      expect(power).toBeGreaterThan(0);
      expect(Number.isFinite(power)).toBe(true);
    });
  });
});

// ── Divine intervention checks ────────────────────────────────────────────────

describe('Divine Intervention', () => {
  describe('canIntervene', () => {
    it('returns false for dead deities', () => {
      const deity = makeDeity({ id: did(1), alive: false, currentPower: 1000 });
      const result = canIntervene(deity, InterventionType.SendOmen, 100);

      expect(result.canDo).toBe(false);
      expect(result.reason).toContain('dead');
    });

    it('returns false for non-interventionist deities', () => {
      const deity = makeDeity({ id: did(1), isInterventionist: false, currentPower: 1000 });
      const result = canIntervene(deity, InterventionType.SendOmen, 100);

      expect(result.canDo).toBe(false);
      expect(result.reason).toContain('not interventionist');
    });

    it('returns false for insufficient power', () => {
      const deity = makeDeity({ id: did(1), currentPower: 10 }); // Need 20 for SendOmen
      const result = canIntervene(deity, InterventionType.SendOmen, 100);

      expect(result.canDo).toBe(false);
      expect(result.reason).toContain('Insufficient power');
    });

    it('returns false during cooldown', () => {
      const deity = makeDeity({ id: did(1), currentPower: 100, lastInterventionTick: 95 });
      // SendOmen has 7 day cooldown
      const result = canIntervene(deity, InterventionType.SendOmen, 100);

      expect(result.canDo).toBe(false);
      expect(result.reason).toContain('cooldown');
    });

    it('returns true when all conditions are met', () => {
      const deity = makeDeity({ id: did(1), currentPower: 100, lastInterventionTick: 0 });
      const result = canIntervene(deity, InterventionType.SendOmen, 100);

      expect(result.canDo).toBe(true);
    });

    it('requires higher power for more powerful interventions', () => {
      const deity = makeDeity({ id: did(1), currentPower: 100, lastInterventionTick: 0 });

      // Can do SendOmen (min 20)
      expect(canIntervene(deity, InterventionType.SendOmen, 100).canDo).toBe(true);

      // Cannot do PhysicalManifestation (min 500)
      expect(canIntervene(deity, InterventionType.PhysicalManifestation, 100).canDo).toBe(false);
    });
  });
});

// ── Schism probability ────────────────────────────────────────────────────────

describe('Schism Probability', () => {
  describe('calculateSchismProbability', () => {
    it('returns low probability for healthy religions', () => {
      const religion = makeReligion({
        id: eid(1),
        primaryDeityId: did(1),
        corruptionLevel: 10,
        reformPressure: 10,
        memberCount: 500,
      });

      const prob = calculateSchismProbability(religion);
      expect(prob).toBeLessThan(0.1);
    });

    it('increases with corruption', () => {
      const lowCorruption = makeReligion({
        id: eid(1),
        primaryDeityId: did(1),
        corruptionLevel: 20,
      });

      const highCorruption = makeReligion({
        id: eid(2),
        primaryDeityId: did(1),
        corruptionLevel: 80,
      });

      expect(calculateSchismProbability(highCorruption))
        .toBeGreaterThan(calculateSchismProbability(lowCorruption));
    });

    it('increases with reform pressure', () => {
      const lowPressure = makeReligion({
        id: eid(1),
        primaryDeityId: did(1),
        reformPressure: 10,
      });

      const highPressure = makeReligion({
        id: eid(2),
        primaryDeityId: did(1),
        reformPressure: 80,
      });

      expect(calculateSchismProbability(highPressure))
        .toBeGreaterThan(calculateSchismProbability(lowPressure));
    });

    it('increases with religion size', () => {
      const smallReligion = makeReligion({
        id: eid(1),
        primaryDeityId: did(1),
        memberCount: 100,
      });

      const largeReligion = makeReligion({
        id: eid(2),
        primaryDeityId: did(1),
        memberCount: 50000,
      });

      expect(calculateSchismProbability(largeReligion))
        .toBeGreaterThan(calculateSchismProbability(smallReligion));
    });

    it('is reduced by syncretic influences', () => {
      const nonSyncretic = makeReligion({
        id: eid(1),
        primaryDeityId: did(1),
        corruptionLevel: 50,
      });

      const syncreticInfluences = new Map<DeityId, number>();
      syncreticInfluences.set(did(2), 0.5);
      syncreticInfluences.set(did(3), 0.3);

      const syncretic = makeReligion({
        id: eid(2),
        primaryDeityId: did(1),
        corruptionLevel: 50,
        syncreticInfluences,
      });

      expect(calculateSchismProbability(syncretic))
        .toBeLessThan(calculateSchismProbability(nonSyncretic));
    });

    it('is capped at 50%', () => {
      const extremeReligion = makeReligion({
        id: eid(1),
        primaryDeityId: did(1),
        corruptionLevel: 100,
        reformPressure: 100,
        memberCount: 1000000,
      });

      const prob = calculateSchismProbability(extremeReligion);
      expect(prob).toBeLessThanOrEqual(0.5);
    });
  });
});

// ── Syncretism influence ──────────────────────────────────────────────────────

describe('Syncretism Influence', () => {
  describe('calculateSyncretismInfluence', () => {
    it('conquest has highest base influence', () => {
      const conquest = calculateSyncretismInfluence('conquest', 365, 1);
      const trade = calculateSyncretismInfluence('trade', 365, 1);
      const marriage = calculateSyncretismInfluence('marriage', 365, 1);

      expect(conquest).toBeGreaterThan(trade);
      expect(conquest).toBeGreaterThan(marriage);
    });

    it('increases with duration', () => {
      const short = calculateSyncretismInfluence('trade', 100, 1);
      const medium = calculateSyncretismInfluence('trade', 1000, 1);
      const long = calculateSyncretismInfluence('trade', 3650, 1);

      expect(medium).toBeGreaterThan(short);
      expect(long).toBeGreaterThan(medium);
    });

    it('increases with intensity', () => {
      const low = calculateSyncretismInfluence('trade', 1000, 0.2);
      const high = calculateSyncretismInfluence('trade', 1000, 1.0);

      expect(high).toBeGreaterThan(low);
    });

    it('caps duration factor at 10 years', () => {
      const tenYears = calculateSyncretismInfluence('trade', 3650, 1);
      const twentyYears = calculateSyncretismInfluence('trade', 7300, 1);

      expect(twentyYears).toBe(tenYears);
    });
  });
});

// ── ID generation ─────────────────────────────────────────────────────────────

describe('ID Generation', () => {
  beforeEach(() => {
    resetReligionIdCounters();
  });

  it('generates unique deity IDs', () => {
    const id1 = createDeitySimId();
    const id2 = createDeitySimId();
    const id3 = createDeitySimId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
  });

  it('generates unique religion IDs', () => {
    const id1 = createReligionId();
    const id2 = createReligionId();

    expect(id1).not.toBe(id2);
  });

  it('generates unique holy figure IDs', () => {
    const id1 = createHolyFigureId();
    const id2 = createHolyFigureId();

    expect(id1).not.toBe(id2);
  });

  it('resets ID counters correctly', () => {
    createDeitySimId();
    createReligionId();
    createHolyFigureId();

    resetReligionIdCounters();

    // After reset, should start from beginning again
    const deityId = createDeitySimId();
    expect(deityId).toBeDefined();
  });
});

// ── ReligionSystem class ──────────────────────────────────────────────────────

describe('ReligionSystem', () => {
  let system: ReligionSystem;
  let clock: WorldClock;
  let events: EventBus;

  beforeEach(() => {
    resetReligionIdCounters();
    system = new ReligionSystem();
    clock = new WorldClock();
    events = new EventBus();
  });

  describe('deity management', () => {
    it('registers and retrieves deities', () => {
      const deity = makeDeity({ id: did(1), name: 'Zeus' });
      system.registerDeity(deity);

      expect(system.getDeity(did(1))).toBe(deity);
    });

    it('returns undefined for unknown deities', () => {
      expect(system.getDeity(did(999))).toBeUndefined();
    });

    it('lists all deities', () => {
      system.registerDeity(makeDeity({ id: did(1), name: 'Zeus' }));
      system.registerDeity(makeDeity({ id: did(2), name: 'Hera' }));

      const all = system.getAllDeities();
      expect(all).toHaveLength(2);
    });

    it('lists only living deities', () => {
      system.registerDeity(makeDeity({ id: did(1), name: 'Zeus', alive: true }));
      system.registerDeity(makeDeity({ id: did(2), name: 'Kronos', alive: false }));

      const living = system.getLivingDeities();
      expect(living).toHaveLength(1);
      expect(living[0]!.name).toBe('Zeus');
    });
  });

  describe('religion management', () => {
    it('registers and retrieves religions', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = makeReligion({ id: eid(100), primaryDeityId: did(1), name: 'Olympian Faith' });
      system.registerReligion(religion);

      expect(system.getReligion(eid(100))).toBe(religion);
    });

    it('finds religions by deity', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion1 = makeReligion({ id: eid(100), primaryDeityId: did(1), name: 'Main Church' });
      const religion2 = makeReligion({ id: eid(101), primaryDeityId: did(1), name: 'Splinter Sect' });
      const religion3 = makeReligion({ id: eid(102), primaryDeityId: did(2), name: 'Other Faith' });

      system.registerReligion(religion1);
      system.registerReligion(religion2);
      system.registerReligion(religion3);

      const zeusReligions = system.getReligionsByDeity(did(1));
      expect(zeusReligions).toHaveLength(2);
    });
  });

  describe('devotion management', () => {
    it('adds and retrieves devotions by character', () => {
      const devotion = makeDevotion({ characterId: cid(1), religionId: eid(100) });
      system.addDevotion(devotion);

      const devotions = system.getDevotions(cid(1));
      expect(devotions).toHaveLength(1);
      expect(devotions[0]).toBe(devotion);
    });

    it('retrieves devotions by religion', () => {
      system.addDevotion(makeDevotion({ characterId: cid(1), religionId: eid(100) }));
      system.addDevotion(makeDevotion({ characterId: cid(2), religionId: eid(100) }));
      system.addDevotion(makeDevotion({ characterId: cid(3), religionId: eid(101) }));

      const religionDevotions = system.getDevotionsByReligion(eid(100));
      expect(religionDevotions).toHaveLength(2);
    });

    it('handles characters with multiple devotions', () => {
      system.addDevotion(makeDevotion({ characterId: cid(1), religionId: eid(100) }));
      system.addDevotion(makeDevotion({ characterId: cid(1), religionId: eid(101) }));

      const devotions = system.getDevotions(cid(1));
      expect(devotions).toHaveLength(2);
    });
  });

  describe('holy figure management', () => {
    it('registers and retrieves holy figures', () => {
      const prophet: HolyFigure = {
        id: eid(200),
        characterId: cid(1),
        religionId: eid(100),
        deityId: did(1),
        type: HolyFigureType.Prophet,
        emergenceTick: 100,
        name: 'The Great Prophet',
        fame: 80,
        miracleCount: 5,
        prophecies: ['Doom approaches'],
        alive: true,
        deathTick: null,
        canonized: false,
      };

      system.registerHolyFigure(prophet);

      expect(system.getHolyFigure(eid(200))).toBe(prophet);
    });

    it('finds holy figures by religion', () => {
      const prophet1: HolyFigure = {
        id: eid(200),
        characterId: cid(1),
        religionId: eid(100),
        deityId: did(1),
        type: HolyFigureType.Prophet,
        emergenceTick: 100,
        name: 'Prophet One',
        fame: 80,
        miracleCount: 5,
        prophecies: [],
        alive: true,
        deathTick: null,
        canonized: false,
      };

      const prophet2: HolyFigure = {
        id: eid(201),
        characterId: cid(2),
        religionId: eid(100),
        deityId: did(1),
        type: HolyFigureType.Saint,
        emergenceTick: 200,
        name: 'Saint Two',
        fame: 60,
        miracleCount: 3,
        prophecies: [],
        alive: false,
        deathTick: 300,
        canonized: true,
      };

      system.registerHolyFigure(prophet1);
      system.registerHolyFigure(prophet2);

      const figures = system.getHolyFiguresByReligion(eid(100));
      expect(figures).toHaveLength(2);
    });
  });

  describe('divine intervention', () => {
    it('succeeds when conditions are met', () => {
      // Set lastInterventionTick to -100 to be past cooldown (clock starts at 0)
      const deity = makeDeity({ id: did(1), currentPower: 100, lastInterventionTick: -100 });
      system.registerDeity(deity);

      // Always succeed
      const rng = () => 0;

      const result = system.attemptIntervention(
        did(1),
        InterventionType.SendOmen,
        eid(100),
        clock,
        events,
        rng,
      );

      expect(result.success).toBe(true);
    });

    it('deducts power on success', () => {
      // Set lastInterventionTick to -100 to be past cooldown
      const deity = makeDeity({ id: did(1), currentPower: 100, lastInterventionTick: -100 });
      system.registerDeity(deity);

      const rng = () => 0; // Always succeed
      const costBefore = deity.currentPower;

      system.attemptIntervention(did(1), InterventionType.SendOmen, eid(100), clock, events, rng);

      expect(deity.currentPower).toBeLessThan(costBefore);
    });

    it('emits event on success', () => {
      // Set lastInterventionTick to -100 to be past cooldown
      const deity = makeDeity({ id: did(1), currentPower: 100, lastInterventionTick: -100 });
      system.registerDeity(deity);

      const emittedEvents: WorldEvent[] = [];
      events.on(EventCategory.Religious, (e: WorldEvent) => emittedEvents.push(e));

      const rng = () => 0;
      system.attemptIntervention(did(1), InterventionType.SendOmen, eid(100), clock, events, rng);

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0]!.subtype).toContain('intervention');
    });

    it('fails when deity not found', () => {
      const result = system.attemptIntervention(
        did(999),
        InterventionType.SendOmen,
        eid(100),
        clock,
        events,
        () => 0,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('fails when power is insufficient', () => {
      const deity = makeDeity({ id: did(1), currentPower: 5 }); // Need 20 for SendOmen
      system.registerDeity(deity);

      const result = system.attemptIntervention(
        did(1),
        InterventionType.SendOmen,
        eid(100),
        clock,
        events,
        () => 0,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Insufficient');
    });

    it('updates last intervention tick', () => {
      const deity = makeDeity({ id: did(1), currentPower: 100, lastInterventionTick: 0 });
      system.registerDeity(deity);

      // Advance clock
      for (let i = 0; i < 50; i++) {
        clock.advance();
      }

      system.attemptIntervention(did(1), InterventionType.SendOmen, eid(100), clock, events, () => 0);

      expect(deity.lastInterventionTick).toBe(50);
    });
  });

  describe('schism handling', () => {
    it('creates a new religion on schism', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        name: 'Original Faith',
        memberCount: 1000,
        corruptionLevel: 70,
      });
      system.registerReligion(religion);

      // Add some devotions
      for (let i = 0; i < 100; i++) {
        system.addDevotion(makeDevotion({ characterId: cid(i), religionId: eid(100) }));
      }

      const rng = createSeededRng(12345);
      const newReligion = system.triggerSchism(eid(100), clock, events, rng);

      expect(newReligion).not.toBeNull();
      expect(newReligion!.name).toContain('Reformed');
    });

    it('splits worshiper base on schism', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        memberCount: 1000,
      });
      system.registerReligion(religion);

      // Add devotions
      for (let i = 0; i < 100; i++) {
        system.addDevotion(makeDevotion({ characterId: cid(i), religionId: eid(100) }));
      }

      const originalCount = religion.memberCount;
      const rng = createSeededRng(12345);
      const newReligion = system.triggerSchism(eid(100), clock, events, rng);

      // Members should be split
      expect(religion.memberCount).toBeLessThan(originalCount);
      expect(newReligion!.memberCount).toBeGreaterThan(0);
    });

    it('emits schism event', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        memberCount: 1000,
      });
      system.registerReligion(religion);

      const emittedEvents: WorldEvent[] = [];
      events.on(EventCategory.Religious, (e: WorldEvent) => emittedEvents.push(e));

      const rng = createSeededRng(12345);
      system.triggerSchism(eid(100), clock, events, rng);

      const schismEvents = emittedEvents.filter(e => e.subtype === 'religion.schism');
      expect(schismEvents).toHaveLength(1);
    });

    it('resets schism risk after schism', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        schismRisk: 80,
      });
      system.registerReligion(religion);

      const rng = createSeededRng(12345);
      system.triggerSchism(eid(100), clock, events, rng);

      expect(religion.schismRisk).toBeLessThan(80);
    });
  });

  describe('syncretism', () => {
    it('adds syncretic influence to a religion', () => {
      const deity1 = makeDeity({ id: did(1), name: 'Local God' });
      const deity2 = makeDeity({ id: did(2), name: 'Foreign God' });
      system.registerDeity(deity1);
      system.registerDeity(deity2);

      const religion = makeReligion({ id: eid(100), primaryDeityId: did(1) });
      system.registerReligion(religion);

      system.addSyncreticInfluence(eid(100), did(2), 0.2, clock, events);

      const updatedReligion = system.getReligion(eid(100))!;
      expect(updatedReligion.syncreticInfluences.get(did(2))).toBe(0.2);
    });

    it('accumulates syncretic influence', () => {
      const deity1 = makeDeity({ id: did(1) });
      const deity2 = makeDeity({ id: did(2) });
      system.registerDeity(deity1);
      system.registerDeity(deity2);

      const religion = makeReligion({ id: eid(100), primaryDeityId: did(1) });
      system.registerReligion(religion);

      system.addSyncreticInfluence(eid(100), did(2), 0.2, clock, events);
      system.addSyncreticInfluence(eid(100), did(2), 0.2, clock, events);

      const updatedReligion = system.getReligion(eid(100))!;
      expect(updatedReligion.syncreticInfluences.get(did(2))).toBe(0.4);
    });

    it('caps syncretic influence at 1.0', () => {
      const deity1 = makeDeity({ id: did(1) });
      const deity2 = makeDeity({ id: did(2) });
      system.registerDeity(deity1);
      system.registerDeity(deity2);

      const religion = makeReligion({ id: eid(100), primaryDeityId: did(1) });
      system.registerReligion(religion);

      system.addSyncreticInfluence(eid(100), did(2), 0.8, clock, events);
      system.addSyncreticInfluence(eid(100), did(2), 0.8, clock, events);

      const updatedReligion = system.getReligion(eid(100))!;
      expect(updatedReligion.syncreticInfluences.get(did(2))).toBe(1.0);
    });

    it('emits event when influence becomes significant', () => {
      const deity1 = makeDeity({ id: did(1) });
      const deity2 = makeDeity({ id: did(2) });
      system.registerDeity(deity1);
      system.registerDeity(deity2);

      const religion = makeReligion({ id: eid(100), primaryDeityId: did(1) });
      system.registerReligion(religion);

      const emittedEvents: WorldEvent[] = [];
      events.on(EventCategory.Religious, (e: WorldEvent) => emittedEvents.push(e));

      // First add gets to 0.2, no event
      system.addSyncreticInfluence(eid(100), did(2), 0.2, clock, events);
      expect(emittedEvents.filter(e => e.subtype.includes('syncretism'))).toHaveLength(0);

      // Second add gets to 0.4 (> 0.3 threshold), emits event
      system.addSyncreticInfluence(eid(100), did(2), 0.2, clock, events);
      expect(emittedEvents.filter(e => e.subtype.includes('syncretism'))).toHaveLength(1);
    });
  });

  describe('religion creation', () => {
    it('creates a new religion', () => {
      const deity = makeDeity({ id: did(1), name: 'Zeus' });
      system.registerDeity(deity);

      const religion = system.createReligion(
        'Church of Zeus',
        did(1),
        DoctrineType.Obedience,
        cid(1),
        clock,
        events,
      );

      expect(religion.name).toBe('Church of Zeus');
      expect(religion.primaryDeityId).toBe(did(1));
      expect(religion.founderCharacterId).toBe(cid(1));
      expect(religion.corruptionLevel).toBe(0);
    });

    it('emits religion founded event', () => {
      const deity = makeDeity({ id: did(1), name: 'Zeus' });
      system.registerDeity(deity);

      const emittedEvents: WorldEvent[] = [];
      events.on(EventCategory.Religious, (e: WorldEvent) => emittedEvents.push(e));

      system.createReligion('Church of Zeus', did(1), DoctrineType.Obedience, null, clock, events);

      const foundedEvents = emittedEvents.filter(e => e.subtype === 'religion.founded');
      expect(foundedEvents).toHaveLength(1);
    });

    it('registers the new religion automatically', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = system.createReligion(
        'New Faith',
        did(1),
        DoctrineType.Freedom,
        null,
        clock,
        events,
      );

      expect(system.getReligion(religion.id)).toBe(religion);
    });
  });

  describe('system properties', () => {
    it('has correct name', () => {
      expect(system.name).toBe('ReligionSystem');
    });

    it('has correct execution order', () => {
      expect(system.executionOrder).toBe(8); // ExecutionOrder.RELIGION
    });

    it('has weekly frequency', () => {
      expect(system.frequency).toBe(7); // TickFrequency.Weekly
    });
  });

  describe('pantheon complexity', () => {
    it('can set pantheon complexity', () => {
      system.setPantheonComplexity('atheistic');
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

// ── Integration tests ─────────────────────────────────────────────────────────

describe('Religion System Integration', () => {
  let system: ReligionSystem;
  let clock: WorldClock;
  let events: EventBus;

  beforeEach(() => {
    resetReligionIdCounters();
    system = new ReligionSystem();
    clock = new WorldClock();
    events = new EventBus();
  });

  describe('divine power tracks worshiper count', () => {
    it('deity power increases with more worshipers', () => {
      const deity = makeDeity({
        id: did(1),
        basePowerLevel: 5,
        worshiperCount: 100,
        averageDevotionLevel: 70,
        currentPower: 0,
      });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        memberCount: 100,
      });
      system.registerReligion(religion);

      // Add devotions
      for (let i = 0; i < 100; i++) {
        system.addDevotion(makeDevotion({
          characterId: cid(i),
          religionId: eid(100),
          devotionLevel: 70,
        }));
      }

      // Run enough ticks to trigger annual update
      for (let i = 0; i < 366; i++) {
        clock.advance();
      }
      // Use a mock world - not needed for devotion updates
      system.execute(null as any, clock, events);

      // Power should now be calculated from worshipers
      expect(deity.currentPower).toBeGreaterThan(0);
    });
  });

  describe('intervention requires power threshold', () => {
    it('cannot perform expensive intervention without enough power', () => {
      const deity = makeDeity({
        id: did(1),
        currentPower: 50, // Not enough for EmpowerChampion (150 minimum)
      });
      system.registerDeity(deity);

      const result = system.attemptIntervention(
        did(1),
        InterventionType.EmpowerChampion,
        eid(100),
        clock,
        events,
        () => 0,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Insufficient');
    });

    it('can perform cheap intervention with limited power', () => {
      const deity = makeDeity({
        id: did(1),
        currentPower: 50, // Enough for SendOmen (20 minimum)
        lastInterventionTick: -100, // Past cooldown
      });
      system.registerDeity(deity);

      const result = system.attemptIntervention(
        did(1),
        InterventionType.SendOmen,
        eid(100),
        clock,
        events,
        () => 0,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('god death on loss of faith', () => {
    it('god dies when worshiper count reaches 0 and power is low', () => {
      const deity = makeDeity({
        id: did(1),
        worshiperCount: 0,
        currentPower: 5, // Below threshold of 10
        alive: true,
      });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        memberCount: 0,
      });
      system.registerReligion(religion);

      const emittedEvents: WorldEvent[] = [];
      events.on(EventCategory.Religious, (e: WorldEvent) => emittedEvents.push(e));

      // Advance clock to trigger annual check
      for (let i = 0; i < 366; i++) {
        clock.advance();
      }
      system.execute(null as any, clock, events);

      expect(deity.alive).toBe(false);

      const deathEvents = emittedEvents.filter(e => e.subtype === 'religion.deity_death');
      expect(deathEvents).toHaveLength(1);
    });

    it('triggers theological crisis when primary deity dies', () => {
      const deity = makeDeity({
        id: did(1),
        worshiperCount: 0,
        currentPower: 5,
        alive: true,
      });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        memberCount: 0,
        schismRisk: 10,
      });
      system.registerReligion(religion);

      const emittedEvents: WorldEvent[] = [];
      events.on(EventCategory.Religious, (e: WorldEvent) => emittedEvents.push(e));

      for (let i = 0; i < 366; i++) {
        clock.advance();
      }
      system.execute(null as any, clock, events);

      const crisisEvents = emittedEvents.filter(e => e.subtype === 'religion.theological_crisis');
      expect(crisisEvents).toHaveLength(1);

      // Schism risk should increase dramatically
      expect(religion.schismRisk).toBeGreaterThan(10);
    });
  });

  describe('church politics lifecycle', () => {
    it('corruption grows over time for large religions', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        memberCount: 0, // Will be updated by devotions
        corruptionLevel: 20,
      });
      system.registerReligion(religion);

      // Add enough devotions to trigger corruption growth (> 100 members)
      for (let i = 0; i < 150; i++) {
        system.addDevotion(makeDevotion({
          characterId: cid(i),
          religionId: eid(100),
          lastPrayerTick: 0,
        }));
      }

      const initialCorruption = religion.corruptionLevel;

      // Run many weekly cycles
      for (let i = 0; i < 52; i++) {
        for (let j = 0; j < 7; j++) {
          clock.advance();
        }
        system.execute(null as any, clock, events);
      }

      expect(religion.corruptionLevel).toBeGreaterThan(initialCorruption);
    });

    it('reform pressure grows with corruption', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = makeReligion({
        id: eid(100),
        primaryDeityId: did(1),
        memberCount: 1000,
        corruptionLevel: 60, // High enough to trigger reform pressure
        reformPressure: 10,
      });
      system.registerReligion(religion);

      const initialPressure = religion.reformPressure;

      // Run weekly cycles
      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 7; j++) {
          clock.advance();
        }
        system.execute(null as any, clock, events);
      }

      expect(religion.reformPressure).toBeGreaterThan(initialPressure);
    });
  });

  describe('devotion decay', () => {
    it('devotion decreases if no prayer for extended period', () => {
      const deity = makeDeity({ id: did(1) });
      system.registerDeity(deity);

      const religion = makeReligion({ id: eid(100), primaryDeityId: did(1) });
      system.registerReligion(religion);

      const devotion = makeDevotion({
        characterId: cid(1),
        religionId: eid(100),
        devotionLevel: 80,
        lastPrayerTick: 0,
      });
      system.addDevotion(devotion);

      // Advance 50 days without prayer
      for (let i = 0; i < 50; i++) {
        clock.advance();
      }

      system.execute(null as any, clock, events);

      expect(devotion.devotionLevel).toBeLessThan(80);
    });
  });
});
