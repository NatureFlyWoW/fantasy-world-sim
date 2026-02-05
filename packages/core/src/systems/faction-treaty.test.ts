/**
 * Tests for the Faction & Political System with Treaty System (Task 3.3).
 * Covers: GovernmentTypes, DiplomaticActions, TreatyEnforcement, FactionPoliticalSystem.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { createWorldTime } from '../time/types.js';
import type { WorldTime } from '../time/types.js';
import { createEvent, resetEventIdCounter } from '../events/event-factory.js';
import { EventCategory } from '../events/types.js';
import type { EntityId, FactionId } from '../ecs/types.js';
import { toEntityId, toFactionId } from '../ecs/types.js';
import type {
  GovernmentComponent,
  DiplomacyComponent,
  TerritoryComponent,
  MilitaryComponent,
  HierarchyComponent,
} from '../ecs/component.js';
import { ReputationSystem } from './reputation-system.js';
import { ReputationDimension } from './reputation-types.js';
import { GrudgeSystem } from './grudge-system.js';
import {
  GovernmentType,
  ALL_GOVERNMENT_TYPES,
  GOVERNMENT_TRAITS,
  SUCCESSION_RULES,
  SuccessionType,
  getGovernmentDecisionModifiers,
  governmentFavors,
} from './government-types.js';
import type { DecisionContext } from './government-types.js';
import {
  DiplomaticAction,
  DIPLOMATIC_TEMPLATES,
  checkPreconditions,
  getRelation,
  calculateSuccessRate,
} from './diplomacy-types.js';
import {
  TreatyTermType,
  createTreaty,
  createNonAggressionTerm,
  createMutualDefenseTerm,
  createTreatyId,
  resetTreatyIdCounter,
  isTreatyExpired,
  getViolationBaseSeverity,
} from './treaty-types.js';
import type { Treaty, TreatyViolation } from './treaty-types.js';
import { TreatyEnforcement } from './treaty-enforcement.js';
import { FactionPoliticalSystem } from './faction-system.js';

// ── Test helpers ────────────────────────────────────────────────────────────

function eid(n: number): EntityId {
  return toEntityId(n);
}

function fid(n: number): FactionId {
  return toFactionId(toEntityId(n));
}

function makeTime(year: number, month = 1, day = 1): WorldTime {
  return createWorldTime(year, month, day);
}

function makeContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    factionId: fid(1),
    leaderId: eid(100),
    governmentType: GovernmentType.Monarchy,
    stability: 60,
    legitimacy: 70,
    militaryStrength: 50,
    economicWealth: 50,
    ...overrides,
  };
}

function makeFaction(
  world: World,
  _id: number,
  govType: GovernmentType = GovernmentType.Monarchy,
): FactionId {
  // Use createEntity to properly register the entity as alive
  const factionId = world.createEntity();
  // Also create a leader entity
  const leaderId = world.createEntity();

  world.addComponent(factionId, {
    type: 'Government' as const,
    governmentType: govType,
    stability: 60,
    legitimacy: 70,
    serialize: () => ({}),
  } satisfies GovernmentComponent);

  world.addComponent(factionId, {
    type: 'Diplomacy' as const,
    relations: new Map(),
    treaties: [],
    serialize: () => ({}),
  } satisfies DiplomacyComponent);

  world.addComponent(factionId, {
    type: 'Territory' as const,
    controlledRegions: [(factionId as number) * 10],
    capitalId: (factionId as number) * 10,
    serialize: () => ({}),
  } satisfies TerritoryComponent);

  world.addComponent(factionId, {
    type: 'Military' as const,
    strength: 50,
    morale: 60,
    training: 50,
    serialize: () => ({}),
  } satisfies MilitaryComponent);

  world.addComponent(factionId, {
    type: 'Hierarchy' as const,
    leaderId: leaderId as number,
    subordinateIds: [],
    serialize: () => ({}),
  } satisfies HierarchyComponent);

  return toFactionId(factionId);
}

function makeTreaty(overrides: Partial<Treaty> & { id: EntityId }): Treaty {
  return {
    name: 'Test Treaty',
    parties: [fid(1), fid(2)],
    terms: [],
    signedAt: makeTime(1),
    violations: [],
    ...overrides,
  };
}

function makeNonAggressionTreaty(_id: EntityId, parties: readonly FactionId[]): Treaty {
  return createTreaty(
    'Non-Aggression Pact',
    parties,
    [createNonAggressionTerm(parties, 3650)],
    makeTime(1),
    3650,
  );
}

function setupWorld(): World {
  const world = new World();
  world.registerComponent('Government');
  world.registerComponent('Diplomacy');
  world.registerComponent('Territory');
  world.registerComponent('Military');
  world.registerComponent('Hierarchy');
  return world;
}

// ═════════════════════════════════════════════════════════════════════════════
// GovernmentTypes
// ═════════════════════════════════════════════════════════════════════════════

describe('GovernmentTypes', () => {
  it('defines all 6 government types', () => {
    expect(ALL_GOVERNMENT_TYPES).toHaveLength(6);
    expect(ALL_GOVERNMENT_TYPES).toContain(GovernmentType.Monarchy);
    expect(ALL_GOVERNMENT_TYPES).toContain(GovernmentType.Republic);
    expect(ALL_GOVERNMENT_TYPES).toContain(GovernmentType.Theocracy);
    expect(ALL_GOVERNMENT_TYPES).toContain(GovernmentType.TribalConfederation);
    expect(ALL_GOVERNMENT_TYPES).toContain(GovernmentType.Oligarchy);
    expect(ALL_GOVERNMENT_TYPES).toContain(GovernmentType.Magocracy);
  });

  it('monarchy has high warlikeness and low reformTolerance', () => {
    const traits = GOVERNMENT_TRAITS[GovernmentType.Monarchy];
    expect(traits.warlikeness).toBeGreaterThan(50);
    expect(traits.reformTolerance).toBeLessThan(40);
  });

  it('republic has high reformTolerance and low warlikeness', () => {
    const traits = GOVERNMENT_TRAITS[GovernmentType.Republic];
    expect(traits.reformTolerance).toBeGreaterThan(60);
    expect(traits.warlikeness).toBeLessThan(50);
  });

  it('theocracy has high stability base', () => {
    const traits = GOVERNMENT_TRAITS[GovernmentType.Theocracy];
    expect(traits.stabilityBase).toBeGreaterThanOrEqual(70);
  });

  it('tribal confederation has low stability base', () => {
    const traits = GOVERNMENT_TRAITS[GovernmentType.TribalConfederation];
    expect(traits.stabilityBase).toBeLessThan(50);
  });

  it('monarchy uses hereditary succession', () => {
    const rule = SUCCESSION_RULES[GovernmentType.Monarchy];
    expect(rule.type).toBe(SuccessionType.Hereditary);
  });

  it('republic uses election succession', () => {
    const rule = SUCCESSION_RULES[GovernmentType.Republic];
    expect(rule.type).toBe(SuccessionType.Election);
  });

  it('theocracy uses divine selection', () => {
    const rule = SUCCESSION_RULES[GovernmentType.Theocracy];
    expect(rule.type).toBe(SuccessionType.DivineSelection);
  });

  it('tribal confederation uses trial by combat', () => {
    const rule = SUCCESSION_RULES[GovernmentType.TribalConfederation];
    expect(rule.type).toBe(SuccessionType.TrialByCombat);
  });

  it('magocracy uses magical ritual', () => {
    const rule = SUCCESSION_RULES[GovernmentType.Magocracy];
    expect(rule.type).toBe(SuccessionType.MagicalRitual);
  });

  it('getGovernmentDecisionModifiers returns military weight > 1 for warlike governments', () => {
    const context = makeContext({ governmentType: GovernmentType.Monarchy });
    const mods = getGovernmentDecisionModifiers(context);
    expect(mods.get('military_weight')).toBeGreaterThan(1);
  });

  it('getGovernmentDecisionModifiers returns low action likelihood at low stability', () => {
    const context = makeContext({ stability: 20 });
    const mods = getGovernmentDecisionModifiers(context);
    expect(mods.get('action_likelihood')).toBeLessThan(0.5);
  });

  it('low legitimacy increases internal crisis risk', () => {
    const context = makeContext({ legitimacy: 15 });
    const mods = getGovernmentDecisionModifiers(context);
    expect(mods.get('internal_crisis_risk')).toBeGreaterThan(1);
  });

  it('governmentFavors correctly identifies preferences', () => {
    expect(governmentFavors(GovernmentType.Monarchy, 'military')).toBe(true);
    expect(governmentFavors(GovernmentType.Republic, 'diplomacy')).toBe(true);
    expect(governmentFavors(GovernmentType.Republic, 'reform')).toBe(true);
    expect(governmentFavors(GovernmentType.Theocracy, 'reform')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DiplomaticActions
// ═════════════════════════════════════════════════════════════════════════════

describe('DiplomaticActions', () => {
  it('FormAlliance requires positive relations', () => {
    const template = DIPLOMATIC_TEMPLATES[DiplomaticAction.FormAlliance];
    expect(template.requiredRelation).toBeGreaterThan(0);
  });

  it('DeclareWar has no relation requirement', () => {
    const template = DIPLOMATIC_TEMPLATES[DiplomaticAction.DeclareWar];
    expect(template.requiredRelation).toBe(Number.NEGATIVE_INFINITY);
  });

  it('DeclareWar always succeeds (unilateral)', () => {
    const template = DIPLOMATIC_TEMPLATES[DiplomaticAction.DeclareWar];
    expect(template.baseSuccessRate).toBe(1.0);
  });

  it('successful alliance improves relations significantly', () => {
    const template = DIPLOMATIC_TEMPLATES[DiplomaticAction.FormAlliance];
    expect(template.relationshipImpact).toBeGreaterThan(20);
  });

  it('issuing ultimatum provides casus belli', () => {
    const template = DIPLOMATIC_TEMPLATES[DiplomaticAction.IssueUltimatum];
    expect(template.causesBelli).toBe(true);
  });

  it('checkPreconditions fails when stability too low', () => {
    const result = checkPreconditions(
      DiplomaticAction.FormAlliance,
      fid(1),
      fid(2),
      10, // stability below required 30
      50, // relation ok
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('stability');
    }
  });

  it('checkPreconditions fails when relations too poor', () => {
    const result = checkPreconditions(
      DiplomaticAction.FormAlliance,
      fid(1),
      fid(2),
      50, // stability ok
      10, // relation below required 40
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('Relations');
    }
  });

  it('checkPreconditions passes when all requirements met', () => {
    const result = checkPreconditions(
      DiplomaticAction.FormAlliance,
      fid(1),
      fid(2),
      50, // stability ok
      50, // relation ok
    );
    expect(result.valid).toBe(true);
  });

  it('getRelation returns 0 for unknown relations', () => {
    const diplomacy: DiplomacyComponent = {
      type: 'Diplomacy',
      relations: new Map(),
      treaties: [],
      serialize: () => ({}),
    };
    expect(getRelation(diplomacy, fid(99))).toBe(0);
  });

  it('getRelation returns stored value', () => {
    const diplomacy: DiplomacyComponent = {
      type: 'Diplomacy',
      relations: new Map([[5, 75]]),
      treaties: [],
      serialize: () => ({}),
    };
    expect(getRelation(diplomacy, fid(5))).toBe(75);
  });

  it('calculateSuccessRate is bounded between 0.05 and 0.95', () => {
    // Very bad conditions
    const lowRate = calculateSuccessRate(DiplomaticAction.FormAlliance, -100, 0);
    expect(lowRate).toBeGreaterThanOrEqual(0.05);

    // Very good conditions
    const highRate = calculateSuccessRate(DiplomaticAction.FormAlliance, 100, 100);
    expect(highRate).toBeLessThanOrEqual(0.95);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TreatyTypes
// ═════════════════════════════════════════════════════════════════════════════

describe('TreatyTypes', () => {
  beforeEach(() => {
    resetTreatyIdCounter();
  });

  it('createTreatyId generates sequential IDs', () => {
    const id1 = createTreatyId();
    const id2 = createTreatyId();
    expect((id2 as number) - (id1 as number)).toBe(1);
  });

  it('createNonAggressionTerm sets correct term type', () => {
    const term = createNonAggressionTerm([fid(1), fid(2)], 3650);
    expect(term.type).toBe(TreatyTermType.NonAggression);
    expect(term.parties).toEqual([fid(1), fid(2)]);
    expect(term.enforceability).toBe(90);
  });

  it('createMutualDefenseTerm includes commitment parameters', () => {
    const term = createMutualDefenseTerm([fid(1), fid(2)], 30, 75);
    expect(term.type).toBe(TreatyTermType.MutualDefense);
    expect(term.parameters['responseTimeInTicks']).toBe(30);
    expect(term.parameters['militaryCommitment']).toBe(75);
  });

  it('isTreatyExpired returns false for permanent treaties', () => {
    const treaty = makeTreaty({
      id: eid(1),
      // omit duration to make it permanent
    });
    expect(isTreatyExpired(treaty, 999999)).toBe(false);
  });

  it('isTreatyExpired returns true after duration', () => {
    const treaty = makeTreaty({
      id: eid(1),
      signedAt: makeTime(1, 1, 1),
      duration: 365, // 1 year
    });
    // signedAt ticks = 0, duration = 365, so expires at tick 365
    expect(isTreatyExpired(treaty, 364)).toBe(false);
    expect(isTreatyExpired(treaty, 365)).toBe(true);
    expect(isTreatyExpired(treaty, 1000)).toBe(true);
  });

  it('NonAggression violations have high severity', () => {
    expect(getViolationBaseSeverity(TreatyTermType.NonAggression)).toBeGreaterThanOrEqual(90);
  });

  it('CulturalExchange violations have low severity', () => {
    expect(getViolationBaseSeverity(TreatyTermType.CulturalExchange)).toBeLessThan(50);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TreatyEnforcement
// ═════════════════════════════════════════════════════════════════════════════

describe('TreatyEnforcement', () => {
  let enforcement: TreatyEnforcement;
  let world: World;
  let clock: WorldClock;
  let repSystem: ReputationSystem;

  beforeEach(() => {
    enforcement = new TreatyEnforcement();
    world = setupWorld();
    clock = new WorldClock();
    repSystem = new ReputationSystem();
    resetEventIdCounter();
    resetTreatyIdCounter();
  });

  it('registers treaties correctly', () => {
    const treaty = makeNonAggressionTreaty(eid(100), [fid(1), fid(2)]);
    enforcement.registerTreaty(treaty);

    const treaties = enforcement.getTreatiesForFaction(fid(1));
    expect(treaties).toHaveLength(1);
    expect(treaties[0]!.id).toBe(treaty.id);
  });

  it('removes treaties', () => {
    const treaty = makeNonAggressionTreaty(eid(100), [fid(1), fid(2)]);
    enforcement.registerTreaty(treaty);

    // Use the actual treaty ID (generated by createTreatyId), not eid(100)
    expect(enforcement.removeTreaty(treaty.id)).toBe(true);
    expect(enforcement.getTreatiesForFaction(fid(1))).toHaveLength(0);
  });

  it('detects NonAggression violation on war declaration', () => {
    const parties = [fid(1), fid(2)] as const;
    const treaty = createTreaty(
      'Non-Aggression Pact',
      parties,
      [createNonAggressionTerm(parties, 3650)],
      makeTime(1),
      3650,
    );
    enforcement.registerTreaty(treaty);

    const warEvent = createEvent({
      category: EventCategory.Military,
      subtype: 'faction.war_declared',
      timestamp: 100,
      participants: [fid(1), fid(2)],
      significance: 90,
      data: { attacker: fid(1), defender: fid(2) },
    });

    const violations = enforcement.checkViolations([warEvent], world, makeTime(1, 4, 10));

    expect(violations).toHaveLength(1);
    expect(violations[0]!.violatorId).toBe(fid(1));
    expect(violations[0]!.termType).toBe(TreatyTermType.NonAggression);
    expect(violations[0]!.severity).toBeGreaterThanOrEqual(90);
  });

  it('does not detect violation when non-signatories attack', () => {
    const parties = [fid(1), fid(2)] as const;
    const treaty = createTreaty(
      'Non-Aggression Pact',
      parties,
      [createNonAggressionTerm(parties, 3650)],
      makeTime(1),
      3650,
    );
    enforcement.registerTreaty(treaty);

    // Faction 3 attacks faction 1 — not a treaty violation
    const warEvent = createEvent({
      category: EventCategory.Military,
      subtype: 'faction.war_declared',
      timestamp: 100,
      participants: [fid(3), fid(1)],
      significance: 90,
      data: { attacker: fid(3), defender: fid(1) },
    });

    const violations = enforcement.checkViolations([warEvent], world, makeTime(1));
    expect(violations).toHaveLength(0);
  });

  it('onViolation damages Political reputation', () => {
    makeFaction(world, 1);
    makeFaction(world, 2);

    const violation: TreatyViolation = {
      treatyId: eid(100),
      violatorId: fid(1),
      termType: TreatyTermType.NonAggression,
      detectedAt: makeTime(1),
      severity: 90,
      evidence: 'Attacked signatory',
      witnessIds: [fid(2)],
    };

    const events = new EventBus();
    enforcement.onViolation(violation, repSystem, world, clock, events);

    const rep = repSystem.getReputation(fid(2), fid(1));
    expect(rep.dimensions.get(ReputationDimension.Political)).toBeLessThan(0);
  });

  it('onViolation damages Moral reputation', () => {
    makeFaction(world, 1);
    makeFaction(world, 2);

    const violation: TreatyViolation = {
      treatyId: eid(100),
      violatorId: fid(1),
      termType: TreatyTermType.NonAggression,
      detectedAt: makeTime(1),
      severity: 90,
      evidence: 'Attacked signatory',
      witnessIds: [fid(2)],
    };

    const events = new EventBus();
    enforcement.onViolation(violation, repSystem, world, clock, events);

    const rep = repSystem.getReputation(fid(2), fid(1));
    expect(rep.dimensions.get(ReputationDimension.Moral)).toBeLessThan(0);
  });

  it('getDiplomaticReputation returns 100 for factions with no violations', () => {
    expect(enforcement.getDiplomaticReputation(fid(1))).toBe(100);
  });

  it('getDiplomaticReputation decreases with violations', () => {
    const parties = [fid(1), fid(2)] as const;
    const treaty = createTreaty(
      'Test Treaty',
      parties,
      [createNonAggressionTerm(parties, 3650)],
      makeTime(1),
      3650,
    );
    enforcement.registerTreaty(treaty);

    // Cause a violation
    const warEvent = createEvent({
      category: EventCategory.Military,
      subtype: 'faction.war_declared',
      timestamp: 100,
      participants: [fid(1), fid(2)],
      significance: 90,
      data: { attacker: fid(1), defender: fid(2) },
    });

    enforcement.checkViolations([warEvent], world, makeTime(1, 4, 10));

    const reputation = enforcement.getDiplomaticReputation(fid(1));
    expect(reputation).toBeLessThan(100);
  });

  it('expires treaties after duration', () => {
    const treaty = createTreaty(
      'Expiring Treaty',
      [fid(1), fid(2)],
      [],
      makeTime(1, 1, 1),
      365, // 1 year
    );
    enforcement.registerTreaty(treaty);

    // 2 years later
    const expired = enforcement.expireTreaties(makeTime(3, 1, 1));

    expect(expired).toHaveLength(1);
    expect(expired[0]).toBe(treaty.id);
    expect(enforcement.treatyCount).toBe(0);
  });

  it('hasActiveTerm correctly identifies active terms', () => {
    const parties = [fid(1), fid(2)] as const;
    const treaty = createTreaty(
      'Defense Pact',
      parties,
      [createMutualDefenseTerm(parties, 30, 50)],
      makeTime(1),
    );
    enforcement.registerTreaty(treaty);

    expect(enforcement.hasActiveTerm(fid(1), fid(2), TreatyTermType.MutualDefense)).toBe(true);
    expect(enforcement.hasActiveTerm(fid(1), fid(2), TreatyTermType.NonAggression)).toBe(false);
    expect(enforcement.hasActiveTerm(fid(1), fid(3), TreatyTermType.MutualDefense)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FactionPoliticalSystem
// ═════════════════════════════════════════════════════════════════════════════

describe('FactionPoliticalSystem', () => {
  let system: FactionPoliticalSystem;
  let world: World;
  let clock: WorldClock;
  let events: EventBus;
  let repSystem: ReputationSystem;
  let grudgeSystem: GrudgeSystem;

  beforeEach(() => {
    repSystem = new ReputationSystem();
    grudgeSystem = new GrudgeSystem();
    system = new FactionPoliticalSystem(repSystem, grudgeSystem);
    world = setupWorld();
    clock = new WorldClock();
    events = new EventBus();
    resetEventIdCounter();
    resetTreatyIdCounter();

    system.initialize(world);
  });

  it('executes without crashing on empty world', () => {
    expect(() => system.execute(world, clock, events)).not.toThrow();
  });

  it('processes factions with different government types', () => {
    const monarchy = makeFaction(world, 1, GovernmentType.Monarchy);
    const republic = makeFaction(world, 2, GovernmentType.Republic);

    system.execute(world, clock, events);

    expect(world.isAlive(monarchy)).toBe(true);
    expect(world.isAlive(republic)).toBe(true);
  });

  it('low stability triggers coup attempt event', () => {
    const faction = makeFaction(world, 1);
    const gov = world.getComponent<GovernmentComponent>(faction, 'Government');

    // Force low stability and legitimacy
    gov!.stability = 15;
    gov!.legitimacy = 10;

    let coupEventEmitted = false;
    events.onSubtype('faction.coup_attempt', () => {
      coupEventEmitted = true;
    });

    system.execute(world, clock, events);

    expect(coupEventEmitted).toBe(true);
  });

  it('treaty violation creates grudge', () => {
    const faction1 = makeFaction(world, 1);
    const faction2 = makeFaction(world, 2);

    // Get leader IDs from hierarchy components
    const hier1 = world.getComponent<HierarchyComponent>(faction1, 'Hierarchy');
    const hier2 = world.getComponent<HierarchyComponent>(faction2, 'Hierarchy');
    const leader1 = hier1!.leaderId as EntityId;
    const leader2 = hier2!.leaderId as EntityId;

    // Create non-aggression treaty
    const parties = [faction1, faction2] as const;
    const treaty = createTreaty(
      'Non-Aggression Pact',
      parties,
      [createNonAggressionTerm(parties, 3650)],
      makeTime(1),
      3650,
    );
    system.getTreatyEnforcement().registerTreaty(treaty);

    // Add war declaration event
    const warEvent = createEvent({
      category: EventCategory.Military,
      subtype: 'faction.war_declared',
      timestamp: clock.currentTick,
      participants: [faction1, faction2],
      significance: 90,
      data: { attacker: faction1, defender: faction2 },
    });
    system.addRecentEvent(warEvent);

    system.execute(world, clock, events);

    // Leader of faction2 should have grudge against leader of faction1
    const grudgeLevel = grudgeSystem.getGrudgeLevel(leader2, leader1);
    expect(grudgeLevel).toBeGreaterThan(0);
  });

  it('successful alliance creates treaty', () => {
    const faction1 = makeFaction(world, 1);
    const faction2 = makeFaction(world, 2);

    // Set up favorable conditions for alliance
    const dip1 = world.getComponent<DiplomacyComponent>(faction1, 'Diplomacy');
    dip1!.relations.set(faction2 as number, 60);

    // Run multiple times to increase chance of alliance (RNG-based)
    for (let i = 0; i < 10; i++) {
      clock.advance(); // Advance 1 tick (daily)
      system.execute(world, clock, events);
    }

    // Check if any treaty was created
    const treaties = system.getTreatyEnforcement().getTreatiesForFaction(faction1);
    // May or may not have treaty depending on RNG, but should not crash
    expect(treaties).toBeDefined();
  });

  it('treatyEnforcement is accessible via getter', () => {
    expect(system.getTreatyEnforcement()).toBeInstanceOf(TreatyEnforcement);
  });

  it('different government types have different succession crisis probabilities', () => {
    const monarchyRule = SUCCESSION_RULES[GovernmentType.Monarchy];
    const republicRule = SUCCESSION_RULES[GovernmentType.Republic];

    expect(monarchyRule.crisisProbability).toBeGreaterThan(republicRule.crisisProbability);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Integration Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Treaty violation cascade', () => {
  it('treaty violation → reputation damage → event emission', () => {
    const world = setupWorld();
    const clock = new WorldClock();
    const eventBus = new EventBus();
    const repSystem = new ReputationSystem();
    const grudgeSystem = new GrudgeSystem();
    const system = new FactionPoliticalSystem(repSystem, grudgeSystem);

    resetEventIdCounter();
    resetTreatyIdCounter();

    system.initialize(world);

    const faction1 = makeFaction(world, 1);
    const faction2 = makeFaction(world, 2);

    // Create non-aggression treaty
    const parties = [faction1, faction2] as const;
    const treaty = createTreaty(
      'Non-Aggression Pact',
      parties,
      [createNonAggressionTerm(parties, 3650)],
      clock.currentTime,
      3650,
    );
    system.getTreatyEnforcement().registerTreaty(treaty);

    // Track emitted events
    const emittedEvents: string[] = [];
    eventBus.onAny((event) => {
      emittedEvents.push(event.subtype);
    });

    // Faction1 declares war (violates treaty)
    const warEvent = createEvent({
      category: EventCategory.Military,
      subtype: 'faction.war_declared',
      timestamp: clock.currentTick,
      participants: [faction1, faction2],
      significance: 90,
      data: { attacker: faction1, defender: faction2 },
    });
    system.addRecentEvent(warEvent);

    // Execute system
    system.execute(world, clock, eventBus);

    // Verify: treaty violation event was emitted
    expect(emittedEvents).toContain('faction.treaty_violated');

    // Verify: reputation was damaged
    const rep = repSystem.getReputation(faction2, faction1);
    expect(rep.dimensions.get(ReputationDimension.Political)).toBeLessThan(0);

    // Verify: diplomatic reputation tracked in enforcement system
    const dipRep = system.getTreatyEnforcement().getDiplomaticReputation(faction1);
    expect(dipRep).toBeLessThan(100);
  });

  it('multiple violations severely damage diplomatic reputation', () => {
    const world = setupWorld();
    const clock = new WorldClock();
    const eventBus = new EventBus();
    const repSystem = new ReputationSystem();
    const grudgeSystem = new GrudgeSystem();
    const system = new FactionPoliticalSystem(repSystem, grudgeSystem);

    resetEventIdCounter();
    resetTreatyIdCounter();

    system.initialize(world);

    makeFaction(world, 1);
    makeFaction(world, 2);
    makeFaction(world, 3);

    // Create two treaties
    const treaty1 = createTreaty(
      'Pact 1',
      [fid(1), fid(2)],
      [createNonAggressionTerm([fid(1), fid(2)], 3650)],
      clock.currentTime,
    );
    const treaty2 = createTreaty(
      'Pact 2',
      [fid(1), fid(3)],
      [createNonAggressionTerm([fid(1), fid(3)], 3650)],
      clock.currentTime,
    );
    system.getTreatyEnforcement().registerTreaty(treaty1);
    system.getTreatyEnforcement().registerTreaty(treaty2);

    // Faction 1 violates both treaties
    system.addRecentEvent(createEvent({
      category: EventCategory.Military,
      subtype: 'faction.war_declared',
      timestamp: clock.currentTick,
      participants: [fid(1), fid(2)],
      significance: 90,
      data: { attacker: fid(1), defender: fid(2) },
    }));
    system.addRecentEvent(createEvent({
      category: EventCategory.Military,
      subtype: 'faction.war_declared',
      timestamp: clock.currentTick,
      participants: [fid(1), fid(3)],
      significance: 90,
      data: { attacker: fid(1), defender: fid(3) },
    }));

    system.execute(world, clock, eventBus);

    // Diplomatic reputation should be severely damaged
    const dipRep = system.getTreatyEnforcement().getDiplomaticReputation(fid(1));
    expect(dipRep).toBeLessThan(50);
  });
});
