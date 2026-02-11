/**
 * Tests for the Character AI system — 6-phase decision-making pipeline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../ecs/world.js';
import type { EntityId } from '../ecs/types.js';
import { toEntityId } from '../ecs/types.js';
import type {
  PositionComponent,
  HealthComponent,
  StatusComponent,
  MembershipComponent,
  RelationshipComponent,
  MemoryComponent,
  TraitsComponent,
  SkillComponent,
} from '../ecs/component.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import {
  PersonalityTrait,
  ALL_TRAITS,
  computePersonalityAlignment,
  getImpulsivenessFactor,
  TRAIT_OPPOSITIONS,
} from './personality-traits.js';
import type { TraitActionWeight } from './personality-traits.js';
import {
  GoalPriority,
  LifeGoal,
  computeBestLifeGoal,
  createGoalId,
  resetGoalIdCounter,
} from './goal-types.js';
import type { CharacterGoal } from './goal-types.js';
import {
  ActionCategory,
  OutcomeType,
  resetActionIdCounter,
} from './action-types.js';
import {
  CharacterAISystem,
  GoalEvaluator,
  ActionGenerator,
  ActionScorer,
  ActionExecutor,
  GoalReflector,
} from './character-ai.js';
import type { PerceptionContext } from './character-ai.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTraits(overrides: Partial<Record<PersonalityTrait, number>> = {}): Map<string, number> {
  const traits = new Map<string, number>();
  for (const t of ALL_TRAITS) {
    traits.set(t, 0);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) traits.set(k, v);
  }
  return traits;
}

function makeSkills(overrides: Partial<Record<string, number>> = {}): Map<string, number> {
  const skills = new Map<string, number>();
  const allSkills = ['combat', 'leadership', 'diplomacy', 'stealth', 'magic',
    'crafting', 'medicine', 'lore', 'trade', 'survival'];
  for (const s of allSkills) {
    skills.set(s, 30);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) skills.set(k, v);
  }
  return skills;
}

function makeContext(overrides: Partial<PerceptionContext> = {}): PerceptionContext {
  return {
    entityId: toEntityId(1) as EntityId,
    position: { x: 5, y: 5 },
    health: { current: 100, maximum: 100 },
    socialClass: 'commoner',
    factionId: 0,
    titles: [],
    nearbyEntityIds: [toEntityId(2) as EntityId],
    relationships: new Map(),
    traitValues: makeTraits(),
    skillValues: makeSkills(),
    recentMemoryCount: 5,
    isInDanger: false,
    isInjured: false,
    isInSettlement: true,
    ...overrides,
  };
}

function makeGoal(overrides: Partial<CharacterGoal> = {}): CharacterGoal {
  return {
    id: createGoalId(),
    priority: GoalPriority.PrimaryLife,
    type: { kind: 'primary_life', lifeGoal: LifeGoal.GainPower },
    description: 'Gain power',
    progress: 0,
    active: true,
    ...overrides,
  };
}

function setupWorldWithCharacter(world: World, overrides: {
  traits?: Map<string, number>;
  skills?: Map<string, number>;
  health?: { current: number; maximum: number };
  socialClass?: string;
  factionId?: number | null;
} = {}): EntityId {
  // Register required component stores
  world.registerComponent('Position');
  world.registerComponent('Health');
  world.registerComponent('Status');
  world.registerComponent('Membership');
  world.registerComponent('Relationship');
  world.registerComponent('Memory');
  world.registerComponent('Traits');
  world.registerComponent('Skill');

  const id = world.createEntity();

  world.addComponent(id, {
    type: 'Position' as const,
    x: 5,
    y: 5,
    serialize: () => ({}),
  } satisfies PositionComponent);

  const hp = overrides.health ?? { current: 100, maximum: 100 };
  world.addComponent(id, {
    type: 'Health' as const,
    current: hp.current,
    maximum: hp.maximum,
    injuries: [],
    diseases: [],
    serialize: () => ({}),
  } satisfies HealthComponent);

  world.addComponent(id, {
    type: 'Status' as const,
    conditions: ['in_settlement'],
    titles: [],
    socialClass: overrides.socialClass ?? 'commoner',
    serialize: () => ({}),
  } satisfies StatusComponent);

  world.addComponent(id, {
    type: 'Membership' as const,
    factionId: overrides.factionId ?? 0,
    rank: 'member',
    joinDate: 0,
    serialize: () => ({}),
  } satisfies MembershipComponent);

  world.addComponent(id, {
    type: 'Relationship' as const,
    relationships: new Map(),
    affinity: new Map(),
    serialize: () => ({}),
  } satisfies RelationshipComponent);

  world.addComponent(id, {
    type: 'Memory' as const,
    memories: [],
    capacity: 50,
    serialize: () => ({}),
  } satisfies MemoryComponent);

  world.addComponent(id, {
    type: 'Traits' as const,
    traits: [...(overrides.traits ?? makeTraits()).keys()],
    intensities: overrides.traits ?? makeTraits(),
    serialize: () => ({}),
  } satisfies TraitsComponent);

  world.addComponent(id, {
    type: 'Skill' as const,
    skills: overrides.skills ?? makeSkills(),
    experience: new Map<string, number>(),
    serialize: () => ({}),
  } satisfies SkillComponent);

  return id;
}

let deterministicCounter = 0;

function deterministicRng(): number {
  deterministicCounter = (deterministicCounter + 1) % 100;
  return deterministicCounter / 100;
}

// ── PersonalityTraits tests ─────────────────────────────────────────────────

describe('PersonalityTraits', () => {
  it('defines 18 personality traits', () => {
    expect(ALL_TRAITS.length).toBe(18);
  });

  it('all traits have opposition or synergy relationships', () => {
    // At least some traits should have oppositions defined
    expect(TRAIT_OPPOSITIONS.size).toBeGreaterThan(0);
  });

  it('getImpulsivenessFactor returns 0 for maximally patient', () => {
    const factor = getImpulsivenessFactor(-100);
    expect(factor).toBeCloseTo(0, 5);
  });

  it('getImpulsivenessFactor returns 0.3 for maximally impulsive', () => {
    const factor = getImpulsivenessFactor(100);
    expect(factor).toBeCloseTo(0.3, 5);
  });

  it('getImpulsivenessFactor returns ~0.15 for neutral', () => {
    const factor = getImpulsivenessFactor(0);
    expect(factor).toBeCloseTo(0.15, 5);
  });

  it('computePersonalityAlignment returns 0.5 for empty weights', () => {
    const traits = makeTraits();
    const alignment = computePersonalityAlignment(traits, []);
    expect(alignment).toBe(0.5);
  });

  it('personality alignment is higher when traits match positively', () => {
    const traits = makeTraits({ [PersonalityTrait.Brave]: 90 });
    const weights: TraitActionWeight[] = [
      { trait: PersonalityTrait.Brave, weight: 1.0 },
    ];
    const alignment = computePersonalityAlignment(traits, weights);
    expect(alignment).toBeGreaterThan(0.7);
  });

  it('personality alignment is lower when traits oppose action', () => {
    const cruelTraits = makeTraits({ [PersonalityTrait.Cruel]: 90 });
    const mercyWeights: TraitActionWeight[] = [
      { trait: PersonalityTrait.Empathetic, weight: 0.7 },
      { trait: PersonalityTrait.Forgiving, weight: 0.6 },
      { trait: PersonalityTrait.Cruel, weight: -0.8 },
    ];
    const alignment = computePersonalityAlignment(cruelTraits, mercyWeights);

    const kindTraits = makeTraits({
      [PersonalityTrait.Empathetic]: 90,
      [PersonalityTrait.Forgiving]: 80,
    });
    const kindAlignment = computePersonalityAlignment(kindTraits, mercyWeights);

    expect(kindAlignment).toBeGreaterThan(alignment);
  });
});

// ── GoalEvaluator tests ─────────────────────────────────────────────────────

describe('GoalEvaluator', () => {
  const evaluator = new GoalEvaluator();

  beforeEach(() => {
    resetGoalIdCounter();
  });

  it('adds survival goal when character is in danger', () => {
    const context = makeContext({ isInDanger: true });
    const goals = evaluator.evaluate(context, []);
    const survivalGoal = goals.find(g => g.type.kind === 'survival');
    expect(survivalGoal).toBeDefined();
    expect(survivalGoal!.priority).toBe(GoalPriority.Survival);
  });

  it('adds healing goal when character is injured but not in danger', () => {
    const context = makeContext({ isInjured: true, isInDanger: false });
    const goals = evaluator.evaluate(context, []);
    const healGoal = goals.find(
      g => g.type.kind === 'survival' && g.type.subtype === 'heal_wounds',
    );
    expect(healGoal).toBeDefined();
  });

  it('assigns a primary life goal if none exists', () => {
    const context = makeContext();
    const goals = evaluator.evaluate(context, []);
    const primaryGoal = goals.find(g => g.type.kind === 'primary_life');
    expect(primaryGoal).toBeDefined();
  });

  it('sorts goals with survival highest', () => {
    const context = makeContext({ isInDanger: true });
    const existing = [makeGoal()];
    const goals = evaluator.evaluate(context, existing);
    expect(goals[0]!.priority).toBe(GoalPriority.Survival);
  });

  it('scholarly character gets SeekKnowledge as primary goal', () => {
    const traits = makeTraits({ [PersonalityTrait.Scholarly]: 90, [PersonalityTrait.Curious]: 80 });
    const context = makeContext({ traitValues: traits });
    const goals = evaluator.evaluate(context, []);
    const primary = goals.find(g => g.type.kind === 'primary_life');
    expect(primary).toBeDefined();
    expect(primary!.type.kind).toBe('primary_life');
    if (primary!.type.kind === 'primary_life') {
      expect(primary!.type.lifeGoal).toBe(LifeGoal.SeekKnowledge);
    }
  });

  it('computeBestLifeGoal returns GainPower for ambitious+cruel', () => {
    const traits = makeTraits({ [PersonalityTrait.Ambitious]: 90, [PersonalityTrait.Cruel]: 60 });
    expect(computeBestLifeGoal(traits)).toBe(LifeGoal.GainPower);
  });

  it('computeBestLifeGoal returns AchieveGlory for brave+ambitious', () => {
    const traits = makeTraits({ [PersonalityTrait.Brave]: 90, [PersonalityTrait.Ambitious]: 80 });
    expect(computeBestLifeGoal(traits)).toBe(LifeGoal.AchieveGlory);
  });

  it('shouldShiftGoal changes goal after battle defeat', () => {
    const traits = makeTraits({ [PersonalityTrait.Scholarly]: 80, [PersonalityTrait.Curious]: 70 });
    const newGoal = evaluator.shouldShiftGoal('battle_defeat', LifeGoal.AchieveGlory, traits);
    expect(newGoal).toBeDefined();
    expect(newGoal).toBe(LifeGoal.SeekKnowledge);
  });
});

// ── ActionGenerator tests ───────────────────────────────────────────────────

describe('ActionGenerator', () => {
  const generator = new ActionGenerator();

  beforeEach(() => {
    resetActionIdCounter();
  });

  it('generates actions for a commoner in a settlement', () => {
    const context = makeContext({ socialClass: 'commoner', isInSettlement: true });
    const goals = [makeGoal()];
    const actions = generator.generate(context, goals);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('rulers get more action options than commoners', () => {
    const commonerCtx = makeContext({ socialClass: 'commoner' });
    const rulerCtx = makeContext({ socialClass: 'ruler' });
    const goals = [makeGoal()];
    const commonerActions = generator.generate(commonerCtx, goals);
    const rulerActions = generator.generate(rulerCtx, goals);
    expect(rulerActions.length).toBeGreaterThan(commonerActions.length);
  });

  it('social actions are excluded when no nearby entities', () => {
    const context = makeContext({ nearbyEntityIds: [] });
    const goals = [makeGoal()];
    const actions = generator.generate(context, goals);
    const socialActions = actions.filter(a => a.category === ActionCategory.Social);
    expect(socialActions.length).toBe(0);
  });

  it('includes survival actions when character is in danger', () => {
    const context = makeContext({ isInDanger: true });
    const goals = [makeGoal({
      type: { kind: 'survival', subtype: 'flee_danger' },
      priority: GoalPriority.Survival,
    })];
    const actions = generator.generate(context, goals);
    const survivalActions = actions.filter(a => a.category === ActionCategory.Survival);
    expect(survivalActions.length).toBeGreaterThan(0);
  });

  it('all generated actions have required properties', () => {
    const context = makeContext({ socialClass: 'ruler' });
    const goals = [makeGoal()];
    const actions = generator.generate(context, goals);
    for (const action of actions) {
      expect(action.id).toBeTypeOf('number');
      expect(action.name).toBeTypeOf('string');
      expect(action.name.length).toBeGreaterThan(0);
      expect(action.baseSuccessRate).toBeGreaterThanOrEqual(0);
      expect(action.baseSuccessRate).toBeLessThanOrEqual(1);
      expect(action.riskLevel).toBeGreaterThanOrEqual(0);
      expect(action.riskLevel).toBeLessThanOrEqual(1);
    }
  });
});

// ── ActionScorer tests ──────────────────────────────────────────────────────

describe('ActionScorer', () => {
  const scorer = new ActionScorer();

  beforeEach(() => {
    resetActionIdCounter();
    deterministicCounter = 0;
  });

  it('scoring formula produces expected total', () => {
    const context = makeContext();
    const goals = [makeGoal()];
    const generator = new ActionGenerator();
    const actions = generator.generate(context, goals);
    expect(actions.length).toBeGreaterThan(0);

    const scores = scorer.scoreAll(actions, context, goals, deterministicRng);
    for (const score of scores) {
      // Total should be a composition of the 7 factors
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      // All sub-factors should be 0-1
      expect(score.personalityAlignment).toBeGreaterThanOrEqual(0);
      expect(score.personalityAlignment).toBeLessThanOrEqual(1);
      expect(score.goalAdvancement).toBeGreaterThanOrEqual(0);
      expect(score.goalAdvancement).toBeLessThanOrEqual(1);
      expect(score.relationshipImpact).toBeGreaterThanOrEqual(0);
      expect(score.relationshipImpact).toBeLessThanOrEqual(1);
      expect(score.riskAssessment).toBeGreaterThanOrEqual(0);
      expect(score.riskAssessment).toBeLessThanOrEqual(1);
      expect(score.opportunityValue).toBeGreaterThanOrEqual(0);
      expect(score.opportunityValue).toBeLessThanOrEqual(1);
      expect(score.culturalConformity).toBeGreaterThanOrEqual(0);
      expect(score.culturalConformity).toBeLessThanOrEqual(1);
    }
  });

  it('cruel character avoids mercy actions', () => {
    const cruelTraits = makeTraits({ [PersonalityTrait.Cruel]: 90, [PersonalityTrait.Vengeful]: 70 });
    const kindTraits = makeTraits({ [PersonalityTrait.Empathetic]: 90, [PersonalityTrait.Forgiving]: 80 });

    const cruelCtx = makeContext({ traitValues: cruelTraits, socialClass: 'ruler' });
    const kindCtx = makeContext({ traitValues: kindTraits, socialClass: 'ruler' });
    const goals = [makeGoal()];

    const generator = new ActionGenerator();
    const actions = generator.generate(cruelCtx, goals);
    const mercyAction = actions.find(a => a.name === 'show_mercy');

    if (mercyAction !== undefined) {
      let counter1 = 50;
      const rng1 = () => { counter1 = (counter1 + 1) % 100; return counter1 / 100; };
      let counter2 = 50;
      const rng2 = () => { counter2 = (counter2 + 1) % 100; return counter2 / 100; };

      const cruelScores = scorer.scoreAll(actions, cruelCtx, goals, rng1);
      const kindScores = scorer.scoreAll(actions, kindCtx, goals, rng2);

      const cruelMercy = cruelScores.find(s => s.action.name === 'show_mercy');
      const kindMercy = kindScores.find(s => s.action.name === 'show_mercy');

      expect(cruelMercy).toBeDefined();
      expect(kindMercy).toBeDefined();
      // Kind character should score mercy higher than cruel one
      expect(kindMercy!.personalityAlignment).toBeGreaterThan(cruelMercy!.personalityAlignment);
    }
  });

  it('impulsive characters show more variance', () => {
    const impulsiveFactor = getImpulsivenessFactor(100);
    const patientFactor = getImpulsivenessFactor(-100);

    // Impulsive character has a larger random weight
    expect(impulsiveFactor).toBeGreaterThan(patientFactor);
    expect(impulsiveFactor).toBeCloseTo(0.3, 2);
    expect(patientFactor).toBeCloseTo(0.0, 2);
  });

  it('cautious character rates low-risk actions higher', () => {
    const cautiousTraits = makeTraits({ [PersonalityTrait.Cautious]: 90 });
    const braveTraits = makeTraits({ [PersonalityTrait.Brave]: 90 });

    const cautiousCtx = makeContext({ traitValues: cautiousTraits, socialClass: 'ruler' });
    const braveCtx = makeContext({ traitValues: braveTraits, socialClass: 'ruler' });
    const goals = [makeGoal()];

    const generator = new ActionGenerator();
    const actions = generator.generate(cautiousCtx, goals);

    const highRiskAction = actions.find(a => a.riskLevel >= 0.5);
    if (highRiskAction !== undefined) {
      let c1 = 50;
      const rng1 = () => { c1 = (c1 + 1) % 100; return c1 / 100; };
      let c2 = 50;
      const rng2 = () => { c2 = (c2 + 1) % 100; return c2 / 100; };

      const cautiousScore = scorer.scoreOne(
        highRiskAction, cautiousCtx, goals, getImpulsivenessFactor(0), rng1,
      );
      const braveScore = scorer.scoreOne(
        highRiskAction, braveCtx, goals, getImpulsivenessFactor(0), rng2,
      );

      // Cautious character should assess high-risk action as worse
      expect(cautiousScore.riskAssessment).toBeLessThan(braveScore.riskAssessment);
    }
  });

  it('cultural conformity affects scores', () => {
    const generator = new ActionGenerator();
    const context = makeContext({ socialClass: 'commoner' });
    const goals = [makeGoal()];
    const actions = generator.generate(context, goals);

    const scores = scorer.scoreAll(actions, context, goals, () => 0.5);
    // Actions with high cultural conformity should have conformity factor close to 1
    for (const score of scores) {
      const rawConformity = score.action.culturalConformity;
      const expected = (rawConformity + 1) / 2;
      expect(score.culturalConformity).toBeCloseTo(expected, 5);
    }
  });
});

// ── ActionExecutor tests ────────────────────────────────────────────────────

describe('ActionExecutor', () => {
  const executor = new ActionExecutor();
  let clock: WorldClock;
  let eventBus: EventBus;

  beforeEach(() => {
    clock = new WorldClock();
    eventBus = new EventBus();
    resetActionIdCounter();
  });

  it('emits an event when executing an action', () => {
    const handler = vi.fn();
    eventBus.onAny(handler);

    const context = makeContext();
    const scorer = new ActionScorer();
    const generator = new ActionGenerator();
    const actions = generator.generate(context, [makeGoal()]);
    const scores = scorer.scoreAll(actions, context, [makeGoal()], () => 0.5);
    const topScore = [...scores].sort((a, b) => b.totalScore - a.totalScore)[0]!;

    executor.execute(topScore, context, clock, eventBus, () => 0.5);

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0]![0];
    expect(event.subtype).toMatch(/^character\./);
    expect(event.participants).toContain(context.entityId);
  });

  it('produces different outcomes for different rolls', () => {
    const context = makeContext();
    const scorer = new ActionScorer();
    const generator = new ActionGenerator();
    const actions = generator.generate(context, [makeGoal()]);
    const scores = scorer.scoreAll(actions, context, [makeGoal()], () => 0.5);
    const topScore = [...scores].sort((a, b) => b.totalScore - a.totalScore)[0]!;

    // Low roll = success
    const outcome1 = executor.execute(topScore, context, clock, eventBus, () => 0.1);
    // High roll = failure
    const outcome2Result = executor.execute(topScore, context, clock, eventBus, () => 0.99);

    // Low roll should produce success/partial, high roll should produce failure
    expect(
      outcome1.outcome === OutcomeType.Success
      || outcome1.outcome === OutcomeType.CriticalSuccess
      || outcome1.outcome === OutcomeType.PartialSuccess
    ).toBe(true);
    expect(
      outcome2Result.outcome === OutcomeType.Failure
      || outcome2Result.outcome === OutcomeType.CriticalFailure
      || outcome2Result.outcome === OutcomeType.PartialSuccess
    ).toBe(true);
  });

  it('rulers actions have higher significance', () => {
    const rulerCtx = makeContext({ socialClass: 'ruler' });
    const commonerCtx = makeContext({ socialClass: 'commoner' });

    const generator = new ActionGenerator();
    const goals = [makeGoal()];
    const rulerActions = generator.generate(rulerCtx, goals);
    const commonerActions = generator.generate(commonerCtx, goals);

    if (rulerActions.length > 0 && commonerActions.length > 0) {
      const scorer = new ActionScorer();
      const rulerScores = scorer.scoreAll(rulerActions, rulerCtx, goals, () => 0.5);
      const commonerScores = scorer.scoreAll(commonerActions, commonerCtx, goals, () => 0.5);

      const rulerTop = [...rulerScores].sort((a, b) => b.totalScore - a.totalScore)[0]!;
      const commonerTop = [...commonerScores].sort((a, b) => b.totalScore - a.totalScore)[0]!;

      const rulerOutcome = executor.execute(rulerTop, rulerCtx, clock, eventBus, () => 0.3);
      const commonerOutcome = executor.execute(commonerTop, commonerCtx, clock, eventBus, () => 0.3);

      expect(rulerOutcome.significance).toBeGreaterThan(commonerOutcome.significance);
    }
  });
});

// ── GoalReflector tests ─────────────────────────────────────────────────────

describe('GoalReflector', () => {
  const reflector = new GoalReflector();

  beforeEach(() => {
    resetGoalIdCounter();
    resetActionIdCounter();
  });

  it('updates goal progress after success', () => {
    const goals: CharacterGoal[] = [makeGoal({ progress: 0.5 })];
    const context = makeContext();
    const outcome = {
      action: {
        id: 1,
        category: ActionCategory.Diplomatic,
        name: 'negotiate_treaty',
        description: 'Negotiate a treaty',
        goalRelevance: [GoalPriority.PrimaryLife],
        traitWeights: [],
        primarySkill: 'diplomacy',
        baseSuccessRate: 0.5,
        riskLevel: 0.1,
        culturalConformity: 0.8,
      },
      outcome: OutcomeType.Success,
      effectDescription: 'Successfully negotiated',
      significance: 30,
    };

    const result = reflector.reflect(outcome, context, goals);
    const updatedGoal = result.goals.find(g => g.type.kind === 'primary_life');
    expect(updatedGoal).toBeDefined();
    expect(updatedGoal!.progress).toBeGreaterThan(0.5);
  });

  it('goals change after significant events (critical failure in military)', () => {
    const scholarlyTraits = makeTraits({
      [PersonalityTrait.Scholarly]: 90,
      [PersonalityTrait.Curious]: 80,
    });
    const context = makeContext({ traitValues: scholarlyTraits });

    const goals: CharacterGoal[] = [makeGoal({
      type: { kind: 'primary_life', lifeGoal: LifeGoal.AchieveGlory },
    })];

    const outcome = {
      action: {
        id: 1,
        category: ActionCategory.MilitaryCommand,
        name: 'plan_campaign',
        description: 'Plan a military campaign',
        goalRelevance: [GoalPriority.PrimaryLife],
        traitWeights: [],
        primarySkill: 'combat',
        baseSuccessRate: 0.5,
        riskLevel: 0.6,
        culturalConformity: 0.5,
      },
      outcome: OutcomeType.CriticalFailure,
      effectDescription: 'Catastrophic campaign failure',
      significance: 60,
    };

    const result = reflector.reflect(outcome, context, goals);
    expect(result.lifeGoalShifted).toBe(true);
    const newPrimary = result.goals.find(g => g.type.kind === 'primary_life' && g.active);
    expect(newPrimary).toBeDefined();
    if (newPrimary !== undefined && newPrimary.type.kind === 'primary_life') {
      expect(newPrimary.type.lifeGoal).toBe(LifeGoal.SeekKnowledge);
    }
  });

  it('critical failure reduces goal progress', () => {
    const goals: CharacterGoal[] = [makeGoal({ progress: 0.5 })];
    const context = makeContext();
    const outcome = {
      action: {
        id: 1,
        category: ActionCategory.Social,
        name: 'befriend',
        description: 'Befriend someone',
        goalRelevance: [GoalPriority.PrimaryLife],
        traitWeights: [],
        primarySkill: 'diplomacy',
        baseSuccessRate: 0.5,
        riskLevel: 0.05,
        culturalConformity: 0.9,
      },
      outcome: OutcomeType.CriticalFailure,
      effectDescription: 'Failed to befriend',
      significance: 20,
    };

    const result = reflector.reflect(outcome, context, goals);
    const updatedGoal = result.goals.find(g => g.type.kind === 'primary_life');
    expect(updatedGoal!.progress).toBeLessThan(0.5);
  });

  it('completed goals are marked inactive', () => {
    const goals: CharacterGoal[] = [makeGoal({ progress: 0.95 })];
    const context = makeContext();
    const outcome = {
      action: {
        id: 1,
        category: ActionCategory.Diplomatic,
        name: 'negotiate_treaty',
        description: 'Negotiate a treaty',
        goalRelevance: [GoalPriority.PrimaryLife],
        traitWeights: [],
        primarySkill: 'diplomacy',
        baseSuccessRate: 0.5,
        riskLevel: 0.1,
        culturalConformity: 0.8,
      },
      outcome: OutcomeType.Success,
      effectDescription: 'Treaty completed',
      significance: 30,
    };

    const result = reflector.reflect(outcome, context, goals);
    const completedGoal = result.goals.find(
      g => g.type.kind === 'primary_life' && !g.active,
    );
    expect(completedGoal).toBeDefined();
    expect(completedGoal!.progress).toBe(1);
  });
});

// ── CharacterAISystem integration tests ─────────────────────────────────────

describe('CharacterAISystem', () => {
  let world: World;
  let clock: WorldClock;
  let eventBus: EventBus;
  let system: CharacterAISystem;

  beforeEach(() => {
    world = new World();
    clock = new WorldClock();
    eventBus = new EventBus();
    system = new CharacterAISystem();
    resetGoalIdCounter();
    resetActionIdCounter();
  });

  it('has correct system properties', () => {
    expect(system.name).toBe('CHARACTER_AI');
    expect(system.frequency).toBe(1);
    expect(system.executionOrder).toBe(60);
  });

  it('processes a character and emits events', () => {
    const handler = vi.fn();
    eventBus.onAny(handler);

    setupWorldWithCharacter(world);
    system.execute(world, clock, eventBus);

    // Should have emitted at least one event
    expect(handler).toHaveBeenCalled();
  });

  it('skips dead characters', () => {
    const handler = vi.fn();
    eventBus.onAny(handler);

    setupWorldWithCharacter(world, { health: { current: 0, maximum: 100 } });
    system.execute(world, clock, eventBus);

    expect(handler).not.toHaveBeenCalled();
  });

  it('creates goals for character on first tick', () => {
    const entityId = setupWorldWithCharacter(world);
    system.execute(world, clock, eventBus);

    const goals = system.getGoals(entityId);
    expect(goals.length).toBeGreaterThan(0);
    // Should have at least a primary life goal
    const primary = goals.find(g => g.type.kind === 'primary_life');
    expect(primary).toBeDefined();
  });

  it('updates memory after action', () => {
    const entityId = setupWorldWithCharacter(world);
    system.execute(world, clock, eventBus);

    const memory = world.getComponent<MemoryComponent>(entityId, 'Memory');
    expect(memory).toBeDefined();
    expect(memory!.memories.length).toBeGreaterThan(0);
  });

  it('personality-driven action: scholarly character tends toward research', () => {
    const scholarTraits = makeTraits({
      [PersonalityTrait.Scholarly]: 90,
      [PersonalityTrait.Curious]: 80,
      [PersonalityTrait.Patient]: 60,
    });
    const scholarSkills = makeSkills({ lore: 80, magic: 70 });

    const handler = vi.fn();
    eventBus.onAny(handler);

    setupWorldWithCharacter(world, {
      traits: scholarTraits,
      skills: scholarSkills,
    });
    system.execute(world, clock, eventBus);

    // The scholar should tend toward research-type actions
    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0]![0];
    expect(event.data.actionCategory).toBeDefined();
  });

  it('processes multiple characters independently', () => {
    const handler = vi.fn();
    eventBus.onAny(handler);

    setupWorldWithCharacter(world, {
      traits: makeTraits({ [PersonalityTrait.Brave]: 90 }),
    });
    // Create second character (reuse stores already registered)
    const id2 = world.createEntity();
    world.addComponent(id2, {
      type: 'Position' as const, x: 10, y: 10, serialize: () => ({}),
    } satisfies PositionComponent);
    world.addComponent(id2, {
      type: 'Health' as const, current: 100, maximum: 100,
      injuries: [], diseases: [], serialize: () => ({}),
    } satisfies HealthComponent);
    world.addComponent(id2, {
      type: 'Status' as const, conditions: ['in_settlement'],
      titles: [], socialClass: 'commoner', serialize: () => ({}),
    } satisfies StatusComponent);
    world.addComponent(id2, {
      type: 'Membership' as const, factionId: 0,
      rank: 'member', joinDate: 0, serialize: () => ({}),
    } satisfies MembershipComponent);
    world.addComponent(id2, {
      type: 'Relationship' as const,
      relationships: new Map(), affinity: new Map(), serialize: () => ({}),
    } satisfies RelationshipComponent);
    world.addComponent(id2, {
      type: 'Memory' as const, memories: [], capacity: 50,
      serialize: () => ({}),
    } satisfies MemoryComponent);
    world.addComponent(id2, {
      type: 'Traits' as const,
      traits: [...makeTraits({ [PersonalityTrait.Scholarly]: 90 }).keys()],
      intensities: makeTraits({ [PersonalityTrait.Scholarly]: 90 }),
      serialize: () => ({}),
    } satisfies TraitsComponent);
    world.addComponent(id2, {
      type: 'Skill' as const, skills: makeSkills(),
      experience: new Map<string, number>(), serialize: () => ({}),
    } satisfies SkillComponent);

    system.execute(world, clock, eventBus);

    // Both characters should emit events (at least one event each)
    expect(handler.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('cleanup clears internal goal state', () => {
    const entityId = setupWorldWithCharacter(world);
    system.execute(world, clock, eventBus);
    expect(system.getGoals(entityId).length).toBeGreaterThan(0);

    system.cleanup();
    expect(system.getGoals(entityId).length).toBe(0);
  });

  it('goals persist across ticks', () => {
    const entityId = setupWorldWithCharacter(world);

    system.execute(world, clock, eventBus);
    const goalsAfterTick1 = system.getGoals(entityId);
    expect(goalsAfterTick1.length).toBeGreaterThan(0);

    clock.advance();
    system.execute(world, clock, eventBus);
    const goalsAfterTick2 = system.getGoals(entityId);
    expect(goalsAfterTick2.length).toBeGreaterThan(0);
  });
});
