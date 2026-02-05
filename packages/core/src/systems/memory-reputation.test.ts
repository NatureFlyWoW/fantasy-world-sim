/**
 * Tests for the Memory & Reputation system (Task 3.2).
 * Covers: CharacterMemoryStore, ReputationSystem, GrudgeSystem, PropagandaSystem.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { EntityId, EventId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';
import { createWorldTime } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import { createEvent, resetEventIdCounter } from '../events/event-factory.js';
import { MemoryRole, MemoryCategory } from './memory-types.js';
import type { Memory } from './memory-types.js';
import { CharacterMemoryStore } from './memory-store.js';
import { ReputationDimension } from './reputation-types.js';
import { ReputationSystem } from './reputation-system.js';
import { GrudgeSystem } from './grudge-system.js';
import { PropagandaSystem, PropagandaType } from './propaganda.js';
import { PersonalityTrait } from './personality-traits.js';

// ── Test helpers ────────────────────────────────────────────────────────────

function eid(n: number): EntityId {
  return n as EntityId;
}

function evtId(n: number): EventId {
  return n as unknown as EventId;
}

function makeTime(year: number, month = 1, day = 1): WorldTime {
  return createWorldTime(year, month, day);
}

function makeMemory(overrides: Partial<Memory> & { eventId: EventId }): Memory {
  return {
    timestamp: makeTime(1),
    emotionalWeight: 0,
    significance: 50,
    participants: [eid(1), eid(2)],
    myRole: MemoryRole.Participant,
    category: MemoryCategory.Personal,
    accuracy: 100,
    timesRecalled: 0,
    lastRecalled: makeTime(1),
    narrative: 'Something happened.',
    ...overrides,
  };
}

function makeTraitMap(
  traits: Partial<Record<PersonalityTrait, number>>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const [k, v] of Object.entries(traits)) {
    if (v !== undefined) {
      map.set(k, v);
    }
  }
  return map;
}

// ═════════════════════════════════════════════════════════════════════════════
// CharacterMemoryStore
// ═════════════════════════════════════════════════════════════════════════════

describe('CharacterMemoryStore', () => {
  let store: CharacterMemoryStore;

  beforeEach(() => {
    store = new CharacterMemoryStore();
  });

  it('stores and retrieves memories', () => {
    const mem = makeMemory({ eventId: evtId(1) });
    store.addMemory(mem);
    expect(store.count).toBe(1);
    expect(store.getAllMemories()).toHaveLength(1);
  });

  it('recall returns matching memories sorted by significance', () => {
    store.addMemory(makeMemory({ eventId: evtId(1), significance: 30 }));
    store.addMemory(makeMemory({ eventId: evtId(2), significance: 80 }));
    store.addMemory(makeMemory({ eventId: evtId(3), significance: 50 }));

    const recalled = store.recall({}, makeTime(1));
    expect(recalled).toHaveLength(3);
    expect(recalled[0]!.significance).toBe(80);
    expect(recalled[1]!.significance).toBe(50);
    expect(recalled[2]!.significance).toBe(30);
  });

  it('recall updates recall metadata', () => {
    const mem = makeMemory({ eventId: evtId(1), accuracy: 80 });
    store.addMemory(mem);

    store.recall({}, makeTime(2));
    expect(mem.timesRecalled).toBe(1);
    expect(mem.lastRecalled).toEqual(makeTime(2));
    // recallBoost = 5 → 80 + 5 = 85
    expect(mem.accuracy).toBe(85);
  });

  it('query does NOT update recall metadata', () => {
    const mem = makeMemory({ eventId: evtId(1), accuracy: 80 });
    store.addMemory(mem);

    store.query({});
    expect(mem.timesRecalled).toBe(0);
    expect(mem.accuracy).toBe(80);
  });

  it('recall filters by category', () => {
    store.addMemory(makeMemory({ eventId: evtId(1), category: MemoryCategory.Military }));
    store.addMemory(makeMemory({ eventId: evtId(2), category: MemoryCategory.Personal }));

    const military = store.recall({ category: MemoryCategory.Military }, makeTime(1));
    expect(military).toHaveLength(1);
  });

  it('recall filters by involving entity', () => {
    store.addMemory(makeMemory({
      eventId: evtId(1),
      participants: [eid(1), eid(5)],
    }));
    store.addMemory(makeMemory({
      eventId: evtId(2),
      participants: [eid(1), eid(6)],
    }));

    const involving5 = store.recall({ involving: eid(5) }, makeTime(1));
    expect(involving5).toHaveLength(1);
  });

  it('decayAll reduces accuracy over time', () => {
    const mem = makeMemory({ eventId: evtId(1), accuracy: 100, timestamp: makeTime(1) });
    store.addMemory(mem);

    // 2 years later: ~20 accuracy lost (baseDecayPerYear=10)
    store.decayAll(makeTime(3));
    expect(mem.accuracy).toBeLessThan(100);
    expect(mem.accuracy).toBeGreaterThan(70);
  });

  it('emotional memories decay slower', () => {
    const neutral = makeMemory({
      eventId: evtId(1), accuracy: 100, emotionalWeight: 0, timestamp: makeTime(1),
    });
    const emotional = makeMemory({
      eventId: evtId(2), accuracy: 100, emotionalWeight: -80, timestamp: makeTime(1),
    });
    store.addMemory(neutral);
    store.addMemory(emotional);

    store.decayAll(makeTime(5)); // 4 years
    expect(emotional.accuracy).toBeGreaterThan(neutral.accuracy);
  });

  it('distortMemory modifies accuracy and narrative', () => {
    const mem = makeMemory({ eventId: evtId(1), accuracy: 90, narrative: 'original' });
    store.addMemory(mem);

    const result = store.distortMemory(evtId(1), 15, 'altered version', 20);
    expect(result).toBe(true);
    expect(mem.accuracy).toBe(75);
    expect(mem.narrative).toBe('altered version');
    expect(mem.emotionalWeight).toBe(20);
  });

  it('distortMemory returns false for unknown event', () => {
    expect(store.distortMemory(evtId(999), 10)).toBe(false);
  });

  it('prunes weakest memories when over capacity', () => {
    const smallStore = new CharacterMemoryStore({
      baseDecayPerYear: 10,
      emotionalDecayMultiplier: 0.5,
      recallBoost: 5,
      recallCeiling: 95,
      pruneThreshold: 10,
      maxCapacity: 3,
    });

    smallStore.addMemory(makeMemory({ eventId: evtId(1), significance: 20 }));
    smallStore.addMemory(makeMemory({ eventId: evtId(2), significance: 80 }));
    smallStore.addMemory(makeMemory({ eventId: evtId(3), significance: 50 }));
    // Adding 4th triggers pruning
    smallStore.addMemory(makeMemory({ eventId: evtId(4), significance: 90 }));

    expect(smallStore.count).toBe(3);
    // Weakest (significance 20) should be pruned
    expect(smallStore.hasMemoryOf(evtId(1))).toBe(false);
    expect(smallStore.hasMemoryOf(evtId(2))).toBe(true);
  });

  it('getEmotionalDisposition computes weighted average', () => {
    const target = eid(5);
    store.addMemory(makeMemory({
      eventId: evtId(1),
      participants: [eid(1), target],
      emotionalWeight: -60,
      significance: 80,
      accuracy: 100,
    }));
    store.addMemory(makeMemory({
      eventId: evtId(2),
      participants: [eid(1), target],
      emotionalWeight: 40,
      significance: 40,
      accuracy: 100,
    }));

    const disposition = store.getEmotionalDisposition(target);
    // Weighted: (-60 * 0.8 + 40 * 0.4) / (0.8 + 0.4) = (-48 + 16) / 1.2 = -26.67 → -27
    expect(disposition).toBe(-27);
  });

  it('getStrongestMemory returns highest significance', () => {
    store.addMemory(makeMemory({ eventId: evtId(1), significance: 30 }));
    store.addMemory(makeMemory({ eventId: evtId(2), significance: 90 }));
    store.addMemory(makeMemory({ eventId: evtId(3), significance: 60 }));

    const strongest = store.getStrongestMemory();
    expect(strongest?.eventId).toBe(evtId(2));
  });

  it('getStrongestMemory filters by category', () => {
    store.addMemory(makeMemory({
      eventId: evtId(1), significance: 90, category: MemoryCategory.Military,
    }));
    store.addMemory(makeMemory({
      eventId: evtId(2), significance: 30, category: MemoryCategory.Personal,
    }));

    const strongest = store.getStrongestMemory(MemoryCategory.Personal);
    expect(strongest?.eventId).toBe(evtId(2));
  });

  it('recall caps accuracy at recallCeiling', () => {
    const mem = makeMemory({ eventId: evtId(1), accuracy: 93 });
    store.addMemory(mem);

    store.recall({}, makeTime(1)); // +5 → capped at 95
    expect(mem.accuracy).toBe(95);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ReputationSystem
// ═════════════════════════════════════════════════════════════════════════════

describe('ReputationSystem', () => {
  let system: ReputationSystem;
  const now = makeTime(1);

  beforeEach(() => {
    system = new ReputationSystem();
    resetEventIdCounter();
  });

  it('returns neutral profile for unknown pairs', () => {
    const profile = system.getReputation(eid(1), eid(2));
    expect(profile.dimensions.size).toBe(0);
  });

  it('setDirectObservation creates an entry', () => {
    system.setDirectObservation(eid(1), eid(2), ReputationDimension.Military, 75, now);

    const profile = system.getReputation(eid(1), eid(2));
    expect(profile.dimensions.get(ReputationDimension.Military)).toBe(75);
  });

  it('clamps reputation values to -100..+100', () => {
    system.setDirectObservation(eid(1), eid(2), ReputationDimension.Military, 200, now);
    const profile = system.getReputation(eid(1), eid(2));
    expect(profile.dimensions.get(ReputationDimension.Military)).toBe(100);
  });

  it('updateFromEvent updates reputation for witnesses', () => {
    const event = createEvent({
      category: EventCategory.Military,
      subtype: 'battle.victory',
      timestamp: 0,
      participants: [eid(10)],
      significance: 80,
    });

    system.updateFromEvent(event, [eid(20), eid(30)], now);

    const from20 = system.getReputation(eid(20), eid(10));
    expect(from20.dimensions.get(ReputationDimension.Military)).toBeGreaterThan(0);

    const from30 = system.getReputation(eid(30), eid(10));
    expect(from30.dimensions.get(ReputationDimension.Military)).toBeGreaterThan(0);
  });

  it('other participants observe each other', () => {
    const event = createEvent({
      category: EventCategory.Military,
      subtype: 'battle.victory',
      timestamp: 0,
      participants: [eid(10), eid(11)],
      significance: 60,
    });

    system.updateFromEvent(event, [], now);

    // Participant 10 should observe participant 11
    const from10 = system.getReputation(eid(10), eid(11));
    expect(from10.dimensions.get(ReputationDimension.Military)).toBeGreaterThan(0);
  });

  it('propagates reputation through social network', () => {
    system.setDirectObservation(eid(1), eid(2), ReputationDimension.Military, 50, now);

    // Network: 1 → 3 → 4
    const connections: Map<number, EntityId[]> = new Map([
      [1, [eid(3)]],
      [3, [eid(4)]],
    ]);

    // Deterministic rng (0.5 → no distortion)
    system.propagate(eid(1), connections, now, () => 0.5);

    // Entity 3 should know about entity 2 (1 hop)
    const from3 = system.getEntry(eid(3), eid(2));
    expect(from3).toBeDefined();
    expect(from3!.confidence).toBeLessThan(100);
    expect(from3!.propagationDepth).toBe(1);

    // Entity 4 should know too (2 hops), with lower confidence
    const from4 = system.getEntry(eid(4), eid(2));
    expect(from4).toBeDefined();
    expect(from4!.confidence).toBeLessThan(from3!.confidence);
    expect(from4!.propagationDepth).toBe(2);
  });

  it('propagation does not tell entity about themselves', () => {
    system.setDirectObservation(eid(1), eid(3), ReputationDimension.Social, 40, now);

    // Network: 1 → 3 (entity 3 is told about entity 3 — should be skipped)
    const connections: Map<number, EntityId[]> = new Map([
      [1, [eid(3)]],
    ]);

    system.propagate(eid(1), connections, now, () => 0.5);

    const entry = system.getEntry(eid(3), eid(3));
    expect(entry).toBeUndefined();
  });

  it('decayAll reduces confidence over time', () => {
    system.setDirectObservation(eid(1), eid(2), ReputationDimension.Moral, 60, makeTime(1));

    // 3 years later → confidence should drop
    system.decayAll(makeTime(4));

    const entry = system.getEntry(eid(1), eid(2));
    expect(entry).toBeDefined();
    expect(entry!.confidence).toBeLessThan(100);
  });

  it('getPublicReputation averages across observers', () => {
    system.setDirectObservation(eid(1), eid(5), ReputationDimension.Military, 80, now);
    system.setDirectObservation(eid(2), eid(5), ReputationDimension.Military, 40, now);

    const pub = system.getPublicReputation(eid(5));
    // Both at confidence 100, so average = (80+40)/2 = 60
    expect(pub.dimensions.get(ReputationDimension.Military)).toBe(60);
  });

  it('getObserversOf returns all observers', () => {
    system.setDirectObservation(eid(10), eid(5), ReputationDimension.Social, 30, now);
    system.setDirectObservation(eid(20), eid(5), ReputationDimension.Social, 50, now);

    const observers = system.getObserversOf(eid(5));
    expect(observers).toHaveLength(2);
    expect(observers).toContain(eid(10));
    expect(observers).toContain(eid(20));
  });

  it('entryCount tracks total entries', () => {
    system.setDirectObservation(eid(1), eid(2), ReputationDimension.Military, 50, now);
    system.setDirectObservation(eid(1), eid(3), ReputationDimension.Military, 50, now);
    system.setDirectObservation(eid(2), eid(3), ReputationDimension.Military, 50, now);

    expect(system.entryCount).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GrudgeSystem
// ═════════════════════════════════════════════════════════════════════════════

describe('GrudgeSystem', () => {
  let system: GrudgeSystem;
  const now = makeTime(1);

  beforeEach(() => {
    system = new GrudgeSystem();
  });

  it('addGrudge creates a new grudge', () => {
    system.addGrudge(eid(1), eid(2), evtId(10), 'betrayal', 70, now);

    expect(system.getGrudgeLevel(eid(1), eid(2))).toBe(70);
    expect(system.totalGrudgeCount).toBe(1);
  });

  it('addGrudge intensifies existing grudge against same target', () => {
    system.addGrudge(eid(1), eid(2), evtId(10), 'betrayal', 40, now);
    system.addGrudge(eid(1), eid(2), evtId(11), 'insult', 30, now);

    expect(system.getGrudgeLevel(eid(1), eid(2))).toBe(70);
    expect(system.totalGrudgeCount).toBe(1);
  });

  it('addGrudge clamps severity to 100', () => {
    system.addGrudge(eid(1), eid(2), evtId(10), 'war', 80, now);
    system.addGrudge(eid(1), eid(2), evtId(11), 'more war', 50, now);

    expect(system.getGrudgeLevel(eid(1), eid(2))).toBe(100);
  });

  it('inheritGrudges applies 60% for gen 1', () => {
    system.addGrudge(eid(1), eid(99), evtId(10), 'war', 100, now);
    system.inheritGrudges(eid(1), eid(2), now);

    expect(system.getGrudgeLevel(eid(2), eid(99))).toBe(60);
  });

  it('inheritGrudges applies 30% for gen 2 (of original)', () => {
    system.addGrudge(eid(1), eid(99), evtId(10), 'war', 100, now);
    system.inheritGrudges(eid(1), eid(2), now); // Gen 1: 60
    system.inheritGrudges(eid(2), eid(3), now); // Gen 2: 100 * 0.3 = 30

    expect(system.getGrudgeLevel(eid(3), eid(99))).toBe(30);
  });

  it('inheritGrudges applies 10% for gen 3 (of original)', () => {
    system.addGrudge(eid(1), eid(99), evtId(10), 'war', 100, now);
    system.inheritGrudges(eid(1), eid(2), now); // Gen 1: 60
    system.inheritGrudges(eid(2), eid(3), now); // Gen 2: 30
    system.inheritGrudges(eid(3), eid(4), now); // Gen 3: 100 * 0.1 = 10

    expect(system.getGrudgeLevel(eid(4), eid(99))).toBe(10);
  });

  it('does not inherit past maxGeneration (gen 4+ fades)', () => {
    system.addGrudge(eid(1), eid(99), evtId(10), 'war', 100, now);
    system.inheritGrudges(eid(1), eid(2), now);
    system.inheritGrudges(eid(2), eid(3), now);
    system.inheritGrudges(eid(3), eid(4), now);
    system.inheritGrudges(eid(4), eid(5), now); // Gen 4 — beyond maxGeneration

    expect(system.getGrudgeLevel(eid(5), eid(99))).toBe(0);
  });

  it('inheritGrudges skips if inherited severity below threshold', () => {
    // Severity 8 at gen 0, gen 1 = 8 * 0.6 = 4.8, below forgetThreshold(5)
    system.addGrudge(eid(1), eid(99), evtId(10), 'slight', 8, now);
    system.inheritGrudges(eid(1), eid(2), now);

    expect(system.getGrudgeLevel(eid(2), eid(99))).toBe(0);
  });

  it('resolveGrudge removes a grudge', () => {
    system.addGrudge(eid(1), eid(2), evtId(10), 'insult', 50, now);
    expect(system.resolveGrudge(eid(1), eid(2))).toBe(true);
    expect(system.getGrudgeLevel(eid(1), eid(2))).toBe(0);
    expect(system.totalGrudgeCount).toBe(0);
  });

  it('resolveGrudge returns false if no grudge exists', () => {
    expect(system.resolveGrudge(eid(1), eid(99))).toBe(false);
  });

  it('decayAll reduces severity and removes forgotten grudges', () => {
    system.addGrudge(eid(1), eid(2), evtId(10), 'insult', 10, now);
    // 5 years later: decay = 5 * 2 = 10, leaving 0 → below threshold
    system.decayAll(makeTime(6));

    expect(system.getGrudgeLevel(eid(1), eid(2))).toBe(0);
    expect(system.totalGrudgeCount).toBe(0);
  });

  it('getGrudgeHolders finds all entities with grudges against target', () => {
    system.addGrudge(eid(1), eid(99), evtId(10), 'war', 50, now);
    system.addGrudge(eid(2), eid(99), evtId(11), 'theft', 30, now);
    system.addGrudge(eid(3), eid(50), evtId(12), 'other', 40, now);

    const holders = system.getGrudgeHolders(eid(99));
    expect(holders).toHaveLength(2);
    expect(holders).toContain(eid(1));
    expect(holders).toContain(eid(2));
  });

  it('capacity limit removes weakest grudge', () => {
    const smallSystem = new GrudgeSystem({
      maxGrudges: 2,
      forgetThreshold: 5,
      decayPerYear: 2,
      maxGeneration: 3,
    });

    smallSystem.addGrudge(eid(1), eid(10), evtId(1), 'a', 20, now);
    smallSystem.addGrudge(eid(1), eid(20), evtId(2), 'b', 80, now);
    smallSystem.addGrudge(eid(1), eid(30), evtId(3), 'c', 50, now);

    const grudges = smallSystem.getGrudges(eid(1));
    expect(grudges).toHaveLength(2);
    // Weakest (severity 20) should have been removed
    expect(grudges.some(g => g.targetId === eid(10))).toBe(false);
  });

  it('getGrudge returns grudge details', () => {
    system.addGrudge(eid(1), eid(2), evtId(10), 'betrayal', 70, now);

    const grudge = system.getGrudge(eid(1), eid(2));
    expect(grudge).toBeDefined();
    expect(grudge!.cause).toBe('betrayal');
    expect(grudge!.generation).toBe(0);
    expect(grudge!.originatorId).toBe(eid(1));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PropagandaSystem
// ═════════════════════════════════════════════════════════════════════════════

describe('PropagandaSystem', () => {
  let system: PropagandaSystem;

  beforeEach(() => {
    system = new PropagandaSystem();
  });

  it('organicDistortion shifts emotional weight for paranoid character', () => {
    const mem = makeMemory({
      eventId: evtId(1),
      emotionalWeight: 0,
      accuracy: 100,
      myRole: MemoryRole.Victim,
    });

    const traits = makeTraitMap({ [PersonalityTrait.Paranoid]: 80 });
    const distorted = system.organicDistortion(mem, traits, () => 0.5);

    // Paranoid trait: emotionalBias = -15, villainization for victim
    expect(distorted.emotionalWeight).toBeLessThan(0);
    expect(distorted.accuracy).toBeLessThan(100);
    // Original is not mutated
    expect(mem.emotionalWeight).toBe(0);
    expect(mem.accuracy).toBe(100);
  });

  it('scholarly trait reduces accuracy loss (negative accuracyImpact)', () => {
    const mem = makeMemory({ eventId: evtId(1), accuracy: 100 });
    const traits = makeTraitMap({ [PersonalityTrait.Scholarly]: 80 });
    const distorted = system.organicDistortion(mem, traits, () => 0.5);

    // Scholarly has accuracyImpact = -2, so accuracy should increase (or not decrease)
    expect(distorted.accuracy).toBeGreaterThanOrEqual(100);
  });

  it('self-aggrandizement adds narrative prefix for instigators', () => {
    const mem = makeMemory({
      eventId: evtId(1),
      myRole: MemoryRole.Instigator,
      narrative: 'I led the charge',
    });

    const traits = makeTraitMap({ [PersonalityTrait.SelfAbsorbed]: 100 });
    // rng = 0.1, selfAggrandizement(0.5) * intensity(1.0) = 0.5 → 0.1 < 0.5 → embellished
    const distorted = system.organicDistortion(mem, traits, () => 0.1);

    expect(distorted.narrative).toContain('[embellished]');
  });

  it('does not embellish for bystanders', () => {
    const mem = makeMemory({
      eventId: evtId(1),
      myRole: MemoryRole.Bystander,
      narrative: 'I saw it happen',
    });

    const traits = makeTraitMap({ [PersonalityTrait.SelfAbsorbed]: 100 });
    const distorted = system.organicDistortion(mem, traits, () => 0.1);

    expect(distorted.narrative).not.toContain('[embellished]');
  });

  it('inactive traits (value <= 0) do not cause distortion', () => {
    const mem = makeMemory({ eventId: evtId(1), accuracy: 100, emotionalWeight: 0 });
    const traits = makeTraitMap({ [PersonalityTrait.Paranoid]: -50 });
    const distorted = system.organicDistortion(mem, traits, () => 0.5);

    expect(distorted.accuracy).toBe(100);
    expect(distorted.emotionalWeight).toBe(0);
  });

  it('createPropaganda generates Victory effect', () => {
    const effect = system.createPropaganda(
      PropagandaType.Victory, eid(1), 42, 80, 70,
    );

    expect(effect.type).toBe(PropagandaType.Victory);
    expect(effect.emotionalShift).toBe(30);
    expect(effect.accuracyPenalty).toBe(20);
    expect(effect.reach).toBe(80);
    expect(effect.credibility).toBe(70);
  });

  it('createPropaganda generates Demonization effect', () => {
    const effect = system.createPropaganda(
      PropagandaType.Demonization, eid(1), 42, 60, 50,
    );

    expect(effect.emotionalShift).toBe(-40);
    expect(effect.accuracyPenalty).toBe(30);
  });

  it('createPropaganda clamps reach and credibility', () => {
    const effect = system.createPropaganda(
      PropagandaType.Victory, eid(1), 42, 150, -10,
    );

    expect(effect.reach).toBe(100);
    expect(effect.credibility).toBe(0);
  });

  it('applyPropaganda modifies memory when accepted', () => {
    const mem = makeMemory({ eventId: evtId(1), emotionalWeight: 0, accuracy: 100 });
    const effect = system.createPropaganda(
      PropagandaType.Victory, eid(1), 1, 80, 100,
    );

    // rng returns 0.1 → 0.1 * 100 = 10, which is <= 100 (credibility) → accepted
    const result = system.applyPropaganda(mem, effect, () => 0.1);

    expect(result.emotionalWeight).toBe(30);
    expect(result.accuracy).toBe(80);
    expect(result.narrative).toContain('glorious victory');
  });

  it('applyPropaganda rejects when credibility check fails', () => {
    const mem = makeMemory({ eventId: evtId(1), emotionalWeight: 0 });
    const effect = system.createPropaganda(
      PropagandaType.Victory, eid(1), 1, 80, 30,
    );

    // rng = 0.9 → 0.9 * 100 = 90, which > 30 (credibility) → rejected
    const result = system.applyPropaganda(mem, effect, () => 0.9);

    expect(result.emotionalWeight).toBe(0);
    expect(result).toBe(mem); // Same reference — not modified
  });

  it('filterHistorian with ambitious trait favors political/military', () => {
    const memories: Memory[] = [
      makeMemory({ eventId: evtId(1), category: MemoryCategory.Political, significance: 25 }),
      makeMemory({ eventId: evtId(2), category: MemoryCategory.Personal, significance: 25 }),
      makeMemory({ eventId: evtId(3), category: MemoryCategory.Military, significance: 15 }),
    ];

    const traits = makeTraitMap({ [PersonalityTrait.Ambitious]: 80 });
    const filtered = system.filterHistorian(memories, traits);

    // Political (preferred, sig 25 ≥ threshold 10) → included
    // Personal (suppressed by ambitious, sig 25 < 60) → excluded
    // Military (preferred, sig 15 ≥ threshold 10) → included
    expect(filtered).toHaveLength(2);
    expect(filtered.some(m => m.category === MemoryCategory.Personal)).toBe(false);
  });

  it('filterHistorian with no strong traits uses neutral filter', () => {
    const memories: Memory[] = [
      makeMemory({ eventId: evtId(1), significance: 20 }),
      makeMemory({ eventId: evtId(2), significance: 10 }),
      makeMemory({ eventId: evtId(3), significance: 5 }),
    ];

    const traits = makeTraitMap({});
    const filtered = system.filterHistorian(memories, traits);

    // Neutral filter: significance >= 15
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.significance).toBe(20);
  });

  it('filterHistorian always includes very significant events', () => {
    const memories: Memory[] = [
      makeMemory({
        eventId: evtId(1),
        category: MemoryCategory.Personal, // suppressed by ambitious
        significance: 85, // But very significant (>= 80)
      }),
    ];

    const traits = makeTraitMap({ [PersonalityTrait.Ambitious]: 80 });
    const filtered = system.filterHistorian(memories, traits);

    expect(filtered).toHaveLength(1);
  });

  it('Revisionism propaganda has highest accuracy penalty', () => {
    const effect = system.createPropaganda(
      PropagandaType.Revisionism, eid(1), 1, 80, 80,
    );

    expect(effect.accuracyPenalty).toBe(40);
    expect(effect.emotionalShift).toBe(0);
  });
});
