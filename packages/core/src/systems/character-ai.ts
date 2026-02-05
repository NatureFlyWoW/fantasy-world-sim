/**
 * CharacterAISystem — 6-phase daily pipeline for character decision-making.
 *
 * Pipeline: Perceive → Evaluate → Generate → Score → Execute → Reflect
 *
 * Each phase is handled by a dedicated class. The system reads ECS components,
 * uses the personality/goal/action type systems for reasoning, then writes
 * changes back to components and emits WorldEvents.
 */

import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import type { ExecutionOrderValue } from '../engine/system.js';
import type { World } from '../ecs/world.js';
import type { EntityId } from '../ecs/types.js';
import type {
  PositionComponent,
  HealthComponent,
  StatusComponent,
  MembershipComponent,
  RelationshipComponent,
  MemoryComponent,
} from '../ecs/component.js';
import type { WorldClock } from '../time/world-clock.js';
import type { TickFrequency } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import {
  PersonalityTrait,
  computePersonalityAlignment,
  getImpulsivenessFactor,
} from './personality-traits.js';
import {
  GoalPriority,
  LifeGoal,
  computeBestLifeGoal,
  GOAL_SHIFT_TENDENCIES,
  createGoalId,
} from './goal-types.js';
import type { CharacterGoal, GoalChangeTrigger } from './goal-types.js';
import {
  ActionCategory,
  OutcomeType,
  ACTION_TEMPLATES,
  createActionId,
} from './action-types.js';
import type {
  CharacterAction,
  ActionScore,
  ActionOutcome,
  ActionTemplate,
} from './action-types.js';

// ── Character perception context ────────────────────────────────────────────

export interface PerceptionContext {
  readonly entityId: EntityId;
  readonly position: { readonly x: number; readonly y: number };
  readonly health: { readonly current: number; readonly maximum: number };
  readonly socialClass: string;
  readonly factionId: number | null;
  readonly titles: readonly string[];
  readonly nearbyEntityIds: readonly EntityId[];
  readonly relationships: ReadonlyMap<number, number>; // entityId → affinity
  readonly traitValues: ReadonlyMap<string, number>;
  readonly skillValues: ReadonlyMap<string, number>;
  readonly recentMemoryCount: number;
  readonly isInDanger: boolean;
  readonly isInjured: boolean;
  readonly isInSettlement: boolean;
}

// ── 1. PERCEIVE ─────────────────────────────────────────────────────────────

export class CharacterPerception {
  /**
   * Gather context for a character from ECS components.
   */
  perceive(
    entityId: EntityId,
    world: World,
    nearbyIds: readonly EntityId[],
  ): PerceptionContext {
    const pos = world.getComponent<PositionComponent>(entityId, 'Position');
    const hp = world.getComponent<HealthComponent>(entityId, 'Health');
    const status = world.getComponent<StatusComponent>(entityId, 'Status');
    const membership = world.getComponent<MembershipComponent>(entityId, 'Membership');
    const rels = world.getComponent<RelationshipComponent>(entityId, 'Relationship');
    const mem = world.getComponent<MemoryComponent>(entityId, 'Memory');

    // Extract traits from the Traits component (intensities map)
    const traitsComp = world.getComponent<{
      readonly type: 'Traits';
      intensities: Map<string, number>;
      serialize(): Record<string, unknown>;
    }>(entityId, 'Traits');

    // Extract skills from the Skill component
    const skillComp = world.getComponent<{
      readonly type: 'Skill';
      skills: Map<string, number>;
      experience: Map<string, number>;
      serialize(): Record<string, unknown>;
    }>(entityId, 'Skill');

    const traitValues: ReadonlyMap<string, number> =
      traitsComp?.intensities ?? new Map<string, number>();

    const skillValues: ReadonlyMap<string, number> =
      skillComp?.skills ?? new Map<string, number>();

    const relationships = new Map<number, number>();
    if (rels !== undefined) {
      for (const [id, affinity] of rels.affinity) {
        relationships.set(id, affinity);
      }
    }

    const healthCurr = hp?.current ?? 100;
    const healthMax = hp?.maximum ?? 100;
    const isInjured = healthCurr < healthMax * 0.5;
    const isInDanger = healthCurr < healthMax * 0.25;

    return {
      entityId,
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
      health: { current: healthCurr, maximum: healthMax },
      socialClass: status?.socialClass ?? 'commoner',
      factionId: membership?.factionId ?? null,
      titles: status?.titles ?? [],
      nearbyEntityIds: nearbyIds,
      relationships,
      traitValues,
      skillValues,
      recentMemoryCount: mem?.memories.length ?? 0,
      isInDanger,
      isInjured,
      isInSettlement: (status?.conditions ?? []).includes('in_settlement'),
    };
  }
}

// ── 2. EVALUATE ─────────────────────────────────────────────────────────────

export class GoalEvaluator {
  /**
   * Evaluate and prioritize goals for this tick.
   * Returns goals sorted by priority (highest first).
   */
  evaluate(
    context: PerceptionContext,
    currentGoals: readonly CharacterGoal[],
  ): readonly CharacterGoal[] {
    const activeGoals = [...currentGoals.filter(g => g.active)];

    // Ensure survival goal if in danger
    if (context.isInDanger) {
      const hasSurvival = activeGoals.some(g => g.type.kind === 'survival');
      if (!hasSurvival) {
        activeGoals.push({
          id: createGoalId(),
          priority: GoalPriority.Survival,
          type: { kind: 'survival', subtype: 'flee_danger' } as const,
          description: 'Survive immediate danger',
          progress: 0,
          active: true,
        });
      }
    }

    // Ensure healing goal if injured
    if (context.isInjured && !context.isInDanger) {
      const hasHeal = activeGoals.some(
        g => g.type.kind === 'survival' && g.type.subtype === 'heal_wounds',
      );
      if (!hasHeal) {
        activeGoals.push({
          id: createGoalId(),
          priority: GoalPriority.Survival,
          type: { kind: 'survival', subtype: 'heal_wounds' } as const,
          description: 'Heal injuries',
          progress: 0,
          active: true,
        });
      }
    }

    // Ensure a primary life goal exists
    const hasPrimary = activeGoals.some(g => g.type.kind === 'primary_life');
    if (!hasPrimary) {
      const lifeGoal = computeBestLifeGoal(context.traitValues);
      activeGoals.push({
        id: createGoalId(),
        priority: GoalPriority.PrimaryLife,
        type: { kind: 'primary_life', lifeGoal } as const,
        description: `Pursue ${lifeGoal.replace(/_/g, ' ')}`,
        progress: 0,
        active: true,
      });
    }

    // Sort by priority (highest first), then by progress (lowest first = most needed)
    activeGoals.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.progress - b.progress;
    });

    return activeGoals;
  }

  /**
   * Check if a life goal should change based on a significant event.
   */
  shouldShiftGoal(
    trigger: GoalChangeTrigger,
    currentLifeGoal: LifeGoal,
    traitValues: ReadonlyMap<string, number>,
  ): LifeGoal | undefined {
    const candidates = GOAL_SHIFT_TENDENCIES.get(trigger);
    if (candidates === undefined) return undefined;

    // Find best candidate based on trait affinity
    const newGoal = computeBestLifeGoal(traitValues);

    // Only shift if the new goal is different and in the shift tendency list
    if (newGoal !== currentLifeGoal && candidates.includes(newGoal)) {
      return newGoal;
    }

    // Fallback: shift to the first tendency that's different
    for (const candidate of candidates) {
      if (candidate !== currentLifeGoal) {
        return candidate;
      }
    }

    return undefined;
  }
}

// ── 3. GENERATE ─────────────────────────────────────────────────────────────

export class ActionGenerator {
  /**
   * Generate a pool of available actions based on context.
   * Filters templates by status, context, and basic eligibility.
   */
  generate(
    context: PerceptionContext,
    goals: readonly CharacterGoal[],
  ): readonly CharacterAction[] {
    const actions: CharacterAction[] = [];

    for (const template of ACTION_TEMPLATES) {
      if (!this.isEligible(template, context)) continue;

      const action: CharacterAction = {
        id: createActionId(),
        category: template.category,
        name: template.name,
        description: template.description,
        goalRelevance: template.goalRelevance,
        traitWeights: template.traitWeights,
        primarySkill: template.primarySkill,
        baseSuccessRate: template.baseSuccessRate,
        riskLevel: template.riskLevel,
        culturalConformity: template.culturalConformity,
      };

      actions.push(action);
    }

    // Ensure survival actions if any survival goal is active
    const hasSurvivalGoal = goals.some(g => g.type.kind === 'survival' && g.active);
    if (hasSurvivalGoal || context.isInDanger || context.isInjured) {
      const hasSurvival = actions.some(a => a.category === ActionCategory.Survival);
      if (!hasSurvival) {
        actions.push({
          id: createActionId(),
          category: ActionCategory.Survival,
          name: 'rest',
          description: 'Rest and recuperate',
          goalRelevance: [GoalPriority.Survival],
          traitWeights: [{ trait: PersonalityTrait.Patient, weight: 0.5 }],
          primarySkill: 'survival',
          baseSuccessRate: 0.9,
          riskLevel: 0.0,
          culturalConformity: 0.5,
        });
      }
    }

    return actions;
  }

  private isEligible(template: ActionTemplate, context: PerceptionContext): boolean {
    // Check status requirement
    if (template.requiredStatus !== undefined) {
      if (!template.requiredStatus.includes(context.socialClass)) {
        return false;
      }
    }

    // Check context requirement
    if (template.requiredContext !== undefined) {
      for (const req of template.requiredContext) {
        if (req === 'in_settlement' && !context.isInSettlement) return false;
      }
    }

    // Social actions need nearby entities
    if (template.category === ActionCategory.Social && context.nearbyEntityIds.length === 0) {
      return false;
    }

    return true;
  }
}

// ── 4. SCORE ────────────────────────────────────────────────────────────────

export class ActionScorer {
  /**
   * Score all candidate actions using the formula from design doc Section 5.1:
   *
   *   score = (personality_alignment × 0.3)
   *         + (goal_advancement × 0.3)
   *         + (relationship_impact × 0.15)
   *         + (risk_assessment × 0.10)
   *         + (opportunity_value × 0.10)
   *         + (cultural_conformity × 0.05)
   *         + (random_factor × impulsiveness_trait)
   */
  scoreAll(
    actions: readonly CharacterAction[],
    context: PerceptionContext,
    goals: readonly CharacterGoal[],
    randomFn: () => number,
  ): readonly ActionScore[] {
    const impulsiveness = getImpulsivenessFactor(
      context.traitValues.get(PersonalityTrait.Impulsive) ?? 0,
    );

    return actions.map(action => this.scoreOne(action, context, goals, impulsiveness, randomFn));
  }

  scoreOne(
    action: CharacterAction,
    context: PerceptionContext,
    goals: readonly CharacterGoal[],
    impulsiveness: number,
    randomFn: () => number,
  ): ActionScore {
    const personalityAlignment = computePersonalityAlignment(
      context.traitValues,
      action.traitWeights,
    );

    const goalAdvancement = this.computeGoalAdvancement(action, goals);
    const relationshipImpact = this.computeRelationshipImpact(action, context);
    const riskAssessment = this.computeRiskAssessment(action, context);
    const opportunityValue = this.computeOpportunityValue(action, context);
    const culturalConformity = this.normalizeCulturalConformity(action.culturalConformity);
    const randomFactor = randomFn();

    const totalScore =
      personalityAlignment * 0.30
      + goalAdvancement * 0.30
      + relationshipImpact * 0.15
      + riskAssessment * 0.10
      + opportunityValue * 0.10
      + culturalConformity * 0.05
      + randomFactor * impulsiveness;

    return {
      action,
      personalityAlignment,
      goalAdvancement,
      relationshipImpact,
      riskAssessment,
      opportunityValue,
      culturalConformity,
      randomFactor,
      totalScore,
    };
  }

  private computeGoalAdvancement(
    action: CharacterAction,
    goals: readonly CharacterGoal[],
  ): number {
    if (goals.length === 0) return 0.5;

    // Check if the action is relevant to the highest priority goal
    const topGoal = goals[0];
    if (topGoal === undefined) return 0.5;

    // Direct match: the action's goal relevance includes the top goal's priority
    if (action.goalRelevance.includes(topGoal.priority)) {
      // Higher priority goals give higher advancement scores
      return Math.min(1, 0.5 + topGoal.priority * 0.12);
    }

    // Check remaining goals
    for (let i = 1; i < Math.min(goals.length, 3); i++) {
      const goal = goals[i];
      if (goal !== undefined && action.goalRelevance.includes(goal.priority)) {
        return Math.min(1, 0.3 + goal.priority * 0.08);
      }
    }

    return 0.2;
  }

  private computeRelationshipImpact(
    action: CharacterAction,
    context: PerceptionContext,
  ): number {
    // Actions with targets get relationship consideration
    if (action.targetId !== undefined) {
      const affinity = context.relationships.get(action.targetId as number) ?? 0;
      // Positive affinity + helpful action = high score
      // Negative affinity + harmful action = high score
      const isHarmful = action.category === ActionCategory.MilitaryCommand
        || action.name === 'betray' || action.name === 'intimidate' || action.name === 'steal';

      if (isHarmful) {
        return Math.max(0, Math.min(1, 0.5 + (-affinity) / 200));
      }
      return Math.max(0, Math.min(1, 0.5 + affinity / 200));
    }

    // Social actions score based on nearby relationship quality
    if (action.category === ActionCategory.Social) {
      const totalAffinity = Array.from(context.relationships.values())
        .reduce((sum, v) => sum + v, 0);
      const avgAffinity = context.relationships.size > 0
        ? totalAffinity / context.relationships.size
        : 0;
      return Math.max(0, Math.min(1, 0.5 + avgAffinity / 200));
    }

    return 0.5;
  }

  private computeRiskAssessment(
    action: CharacterAction,
    context: PerceptionContext,
  ): number {
    // Cautious characters rate low-risk actions higher
    // Brave characters rate high-risk actions as acceptable
    const cautious = context.traitValues.get(PersonalityTrait.Cautious) ?? 0;
    const brave = context.traitValues.get(PersonalityTrait.Brave) ?? 0;
    const riskTolerance = (brave - cautious + 100) / 200; // 0 to 1

    // Low risk + cautious = good, high risk + brave = acceptable
    const riskPenalty = action.riskLevel * (1 - riskTolerance);
    return Math.max(0, Math.min(1, 1 - riskPenalty));
  }

  private computeOpportunityValue(
    action: CharacterAction,
    context: PerceptionContext,
  ): number {
    // Skill proficiency makes actions more attractive
    const skillLevel = context.skillValues.get(action.primarySkill) ?? 0;
    const normalized = Math.min(1, skillLevel / 100);

    // Being in a settlement opens up more opportunity
    const settlementBonus = context.isInSettlement ? 0.1 : 0;

    return Math.max(0, Math.min(1, normalized * 0.7 + 0.2 + settlementBonus));
  }

  private normalizeCulturalConformity(raw: number): number {
    // raw is -1.0 to +1.0, normalize to 0.0 to 1.0
    return (raw + 1) / 2;
  }
}

// ── 5. EXECUTE ──────────────────────────────────────────────────────────────

export class ActionExecutor {
  /**
   * Execute the top-scoring action. Roll for outcome based on skills,
   * generate a WorldEvent, and return the result.
   */
  execute(
    topScore: ActionScore,
    context: PerceptionContext,
    clock: WorldClock,
    events: EventBus,
    randomFn: () => number,
  ): ActionOutcome {
    const action = topScore.action;
    const skillLevel = context.skillValues.get(action.primarySkill) ?? 0;

    // Outcome probability: base + skill modifier
    const skillModifier = skillLevel / 200; // 0 to 0.5 for 0-100 skill
    const successProbability = Math.min(0.95, action.baseSuccessRate + skillModifier);

    const roll = randomFn();
    const outcome = this.determineOutcome(roll, successProbability);

    const significance = this.computeSignificance(action, outcome, context);

    const effectDescription = this.describeEffect(action, outcome);

    // Emit the WorldEvent
    const event = createEvent({
      category: this.actionCategoryToEventCategory(action.category),
      subtype: `character.${action.name}`,
      timestamp: clock.currentTick,
      participants: [context.entityId],
      significance,
      data: {
        actionName: action.name,
        actionCategory: action.category,
        outcome: outcome,
        skillUsed: action.primarySkill,
        skillLevel,
        roll,
        successProbability,
      },
      consequencePotential: outcome === OutcomeType.CriticalSuccess
        || outcome === OutcomeType.CriticalFailure
        ? [{
            eventSubtype: `character.${action.name}_consequence`,
            baseProbability: 0.6,
            category: this.actionCategoryToEventCategory(action.category),
            delayTicks: 3,
            dampening: 0.8,
          }]
        : [],
    });

    events.emit(event);

    return { action, outcome, effectDescription, significance };
  }

  private determineOutcome(roll: number, successProbability: number): OutcomeType {
    if (roll < successProbability * 0.15) {
      return OutcomeType.CriticalSuccess;
    }
    if (roll < successProbability) {
      return OutcomeType.Success;
    }
    if (roll < successProbability + (1 - successProbability) * 0.5) {
      return OutcomeType.PartialSuccess;
    }
    if (roll > 0.95) {
      return OutcomeType.CriticalFailure;
    }
    return OutcomeType.Failure;
  }

  private computeSignificance(
    action: CharacterAction,
    outcome: OutcomeType,
    context: PerceptionContext,
  ): number {
    let base = 20;

    // High-risk actions are more significant
    base += action.riskLevel * 20;

    // Critical outcomes are more significant
    if (outcome === OutcomeType.CriticalSuccess) base += 25;
    if (outcome === OutcomeType.CriticalFailure) base += 30;

    // Rulers' actions are more significant
    if (context.socialClass === 'ruler') base += 15;
    if (context.socialClass === 'general' || context.socialClass === 'noble') base += 10;

    return Math.min(100, Math.max(0, base));
  }

  private describeEffect(action: CharacterAction, outcome: OutcomeType): string {
    const outcomeDesc: Record<string, string> = {
      [OutcomeType.CriticalSuccess]: 'achieved a remarkable',
      [OutcomeType.Success]: 'successfully completed',
      [OutcomeType.PartialSuccess]: 'partially succeeded at',
      [OutcomeType.Failure]: 'failed to complete',
      [OutcomeType.CriticalFailure]: 'catastrophically failed at',
    };
    const desc = outcomeDesc[outcome] ?? 'attempted';
    return `${desc} ${action.description.toLowerCase()}`;
  }

  private actionCategoryToEventCategory(category: ActionCategory): EventCategory {
    const map: Record<string, EventCategory> = {
      [ActionCategory.Diplomatic]: EventCategory.Political,
      [ActionCategory.MilitaryCommand]: EventCategory.Military,
      [ActionCategory.ScholarlyResearch]: EventCategory.Scientific,
      [ActionCategory.Crafting]: EventCategory.Economic,
      [ActionCategory.Social]: EventCategory.Personal,
      [ActionCategory.Travel]: EventCategory.Exploratory,
      [ActionCategory.Economic]: EventCategory.Economic,
      [ActionCategory.Religious]: EventCategory.Religious,
      [ActionCategory.Magical]: EventCategory.Magical,
      [ActionCategory.Survival]: EventCategory.Personal,
    };
    return map[category] ?? EventCategory.Personal;
  }
}

// ── 6. REFLECT ──────────────────────────────────────────────────────────────

export class GoalReflector {
  private readonly goalEvaluator = new GoalEvaluator();

  /**
   * After action execution, check if the outcome warrants a goal or strategy change.
   * Returns updated goals and optional trigger if a life goal shift occurred.
   */
  reflect(
    outcome: ActionOutcome,
    context: PerceptionContext,
    currentGoals: readonly CharacterGoal[],
  ): { goals: readonly CharacterGoal[]; lifeGoalShifted: boolean } {
    const mutableGoals = currentGoals.map(g => ({ ...g }));
    let lifeGoalShifted = false;

    // Update goal progress based on outcome
    for (const goal of mutableGoals) {
      if (!goal.active) continue;
      if (!outcome.action.goalRelevance.includes(goal.priority)) continue;

      switch (outcome.outcome) {
        case OutcomeType.CriticalSuccess:
          goal.progress = Math.min(1, goal.progress + 0.15);
          break;
        case OutcomeType.Success:
          goal.progress = Math.min(1, goal.progress + 0.08);
          break;
        case OutcomeType.PartialSuccess:
          goal.progress = Math.min(1, goal.progress + 0.03);
          break;
        case OutcomeType.Failure:
          // No progress, but don't lose any
          break;
        case OutcomeType.CriticalFailure:
          goal.progress = Math.max(0, goal.progress - 0.05);
          break;
      }

      // Mark completed goals
      if (goal.progress >= 1) {
        goal.active = false;
      }
    }

    // Check for life goal shift on critical failures in primary pursuit
    if (outcome.outcome === OutcomeType.CriticalFailure) {
      const primaryGoal = mutableGoals.find(g => g.type.kind === 'primary_life' && g.active);
      if (primaryGoal !== undefined && primaryGoal.type.kind === 'primary_life') {
        const trigger = this.inferTrigger(outcome);
        if (trigger !== undefined) {
          const newGoal = this.goalEvaluator.shouldShiftGoal(
            trigger,
            primaryGoal.type.lifeGoal,
            context.traitValues,
          );
          if (newGoal !== undefined) {
            primaryGoal.active = false;
            mutableGoals.push({
              id: createGoalId(),
              priority: GoalPriority.PrimaryLife,
              type: { kind: 'primary_life', lifeGoal: newGoal } as const,
              description: `Pursue ${newGoal.replace(/_/g, ' ')}`,
              progress: 0,
              active: true,
            });
            lifeGoalShifted = true;
          }
        }
      }
    }

    // Also check for goal shift on critical success (ambition escalation)
    if (outcome.outcome === OutcomeType.CriticalSuccess) {
      const trigger = this.inferSuccessTrigger(outcome);
      if (trigger !== undefined) {
        const primaryGoal = mutableGoals.find(g => g.type.kind === 'primary_life' && g.active);
        if (primaryGoal !== undefined && primaryGoal.type.kind === 'primary_life') {
          const newGoal = this.goalEvaluator.shouldShiftGoal(
            trigger,
            primaryGoal.type.lifeGoal,
            context.traitValues,
          );
          if (newGoal !== undefined) {
            primaryGoal.active = false;
            mutableGoals.push({
              id: createGoalId(),
              priority: GoalPriority.PrimaryLife,
              type: { kind: 'primary_life', lifeGoal: newGoal } as const,
              description: `Pursue ${newGoal.replace(/_/g, ' ')}`,
              progress: 0,
              active: true,
            });
            lifeGoalShifted = true;
          }
        }
      }
    }

    return { goals: mutableGoals, lifeGoalShifted };
  }

  private inferTrigger(outcome: ActionOutcome): GoalChangeTrigger | undefined {
    const cat = outcome.action.category;
    if (cat === ActionCategory.MilitaryCommand) return 'battle_defeat';
    if (cat === ActionCategory.Social && outcome.action.name === 'betray') return 'betrayal';
    if (cat === ActionCategory.Religious) return 'religious_experience';
    if (cat === ActionCategory.Survival) return 'near_death';
    return undefined;
  }

  private inferSuccessTrigger(outcome: ActionOutcome): GoalChangeTrigger | undefined {
    const cat = outcome.action.category;
    if (cat === ActionCategory.ScholarlyResearch) return 'discovery';
    if (cat === ActionCategory.MilitaryCommand) return 'great_success';
    if (cat === ActionCategory.Religious) return 'religious_experience';
    return undefined;
  }
}

// ── Main system ─────────────────────────────────────────────────────────────

export class CharacterAISystem extends BaseSystem {
  readonly name = 'CHARACTER_AI';
  readonly frequency: TickFrequency = 1 as TickFrequency; // Daily
  readonly executionOrder: ExecutionOrderValue = ExecutionOrder.CHARACTER_AI;

  private readonly perception = new CharacterPerception();
  private readonly goalEvaluator = new GoalEvaluator();
  private readonly actionGenerator = new ActionGenerator();
  private readonly actionScorer = new ActionScorer();
  private readonly actionExecutor = new ActionExecutor();
  private readonly goalReflector = new GoalReflector();

  /** Internal goal storage keyed by entity ID. */
  private readonly entityGoals: Map<EntityId, CharacterGoal[]> = new Map();

  /** Simple deterministic random seeded per tick + entity. */
  private makeRng(tick: number, entityId: EntityId): () => number {
    let state = (tick * 2654435761 + (entityId as number) * 1597334677) >>> 0;
    return () => {
      state = (state ^ (state << 13)) >>> 0;
      state = (state ^ (state >> 17)) >>> 0;
      state = (state ^ (state << 5)) >>> 0;
      return (state >>> 0) / 4294967296;
    };
  }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    // Query all entities with Traits + Position (character entities)
    const characterIds = world.query('Traits', 'Position');

    for (const entityId of characterIds) {
      this.processCharacter(entityId, world, clock, events);
    }
  }

  private processCharacter(
    entityId: EntityId,
    world: World,
    clock: WorldClock,
    events: EventBus,
  ): void {
    const rng = this.makeRng(clock.currentTick, entityId);

    // Skip dead characters
    const hp = world.getComponent<HealthComponent>(entityId, 'Health');
    if (hp !== undefined && hp.current <= 0) return;

    // Nearby entities — simple: all other entities with Position
    // (In production this would use SpatialIndex for radius queries)
    const allChars = world.query('Traits', 'Position');
    const nearbyIds = allChars.filter(id => id !== entityId);

    // 1. PERCEIVE
    const context = this.perception.perceive(entityId, world, nearbyIds);

    // 2. EVALUATE
    const existingGoals = this.entityGoals.get(entityId) ?? [];
    const prioritizedGoals = this.goalEvaluator.evaluate(context, existingGoals);

    // 3. GENERATE
    const availableActions = this.actionGenerator.generate(context, prioritizedGoals);
    if (availableActions.length === 0) return;

    // 4. SCORE
    const scores = this.actionScorer.scoreAll(availableActions, context, prioritizedGoals, rng);
    const sortedScores = [...scores].sort((a, b) => b.totalScore - a.totalScore);
    const topScore = sortedScores[0];
    if (topScore === undefined) return;

    // 5. EXECUTE
    const outcome = this.actionExecutor.execute(topScore, context, clock, events, rng);

    // 6. REFLECT
    const reflection = this.goalReflector.reflect(outcome, context, prioritizedGoals);

    // Store updated goals
    this.entityGoals.set(entityId, [...reflection.goals]);

    // If life goal shifted, emit an event
    if (reflection.lifeGoalShifted) {
      const shiftEvent = createEvent({
        category: EventCategory.Personal,
        subtype: 'character.goal_shift',
        timestamp: clock.currentTick,
        participants: [entityId],
        significance: 40,
        data: {
          reason: outcome.action.name,
          outcomeType: outcome.outcome,
        },
      });
      events.emit(shiftEvent);
    }

    // Update memory component with the action taken
    const memComp = world.getComponent<MemoryComponent>(entityId, 'Memory');
    if (memComp !== undefined) {
      memComp.memories.push({
        eventId: clock.currentTick,
        importance: outcome.significance,
        distortion: 0,
      });
      // Cap memory at capacity
      while (memComp.memories.length > memComp.capacity) {
        memComp.memories.shift();
      }
    }
  }

  /**
   * Get the current goals for an entity (for testing/inspection).
   */
  getGoals(entityId: EntityId): readonly CharacterGoal[] {
    return this.entityGoals.get(entityId) ?? [];
  }

  /**
   * Set goals for an entity (for testing/initialization).
   */
  setGoals(entityId: EntityId, goals: readonly CharacterGoal[]): void {
    this.entityGoals.set(entityId, [...goals]);
  }

  cleanup(): void {
    super.cleanup();
    this.entityGoals.clear();
  }
}
