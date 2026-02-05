/**
 * FactionPoliticalSystem — orchestrates faction diplomacy, internal politics,
 * treaty management, and succession events.
 *
 * Runs monthly (30 ticks) at ExecutionOrder.POLITICS (4).
 */

import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import type { ExecutionOrderValue } from '../engine/system.js';
import type { World } from '../ecs/world.js';
import type { EntityId, FactionId } from '../ecs/types.js';
import { toFactionId } from '../ecs/types.js';
import type {
  GovernmentComponent,
  DiplomacyComponent,
  HierarchyComponent,
  MilitaryComponent,
} from '../ecs/component.js';
import type { WorldClock } from '../time/world-clock.js';
import { TickFrequency } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import type { WorldEvent } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import type { ReputationSystem } from './reputation-system.js';
import type { GrudgeSystem } from './grudge-system.js';
import { TreatyEnforcement } from './treaty-enforcement.js';
import {
  GovernmentType,
  GOVERNMENT_TRAITS,
  SUCCESSION_RULES,
  getGovernmentDecisionModifiers,
} from './government-types.js';
import type { DecisionContext } from './government-types.js';
import {
  DiplomaticAction,
  DIPLOMATIC_TEMPLATES,
  checkPreconditions,
  getRelation,
  calculateSuccessRate,
} from './diplomacy-types.js';
import type { DiplomaticOutcome } from './diplomacy-types.js';
import {
  TreatyTermType,
  createTreaty,
  createNonAggressionTerm,
  createMutualDefenseTerm,
} from './treaty-types.js';
import type { Treaty } from './treaty-types.js';

// ── FactionPoliticalSystem ──────────────────────────────────────────────────

export class FactionPoliticalSystem extends BaseSystem {
  readonly name = 'FactionPoliticalSystem';
  readonly frequency: TickFrequency = TickFrequency.Monthly;
  readonly executionOrder: ExecutionOrderValue = ExecutionOrder.POLITICS;

  private readonly treatyEnforcement: TreatyEnforcement;
  private recentEvents: WorldEvent[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly reputationSystem: ReputationSystem,
    private readonly grudgeSystem: GrudgeSystem,
  ) {
    super();
    this.treatyEnforcement = new TreatyEnforcement();
  }

  initialize(world: World): void {
    super.initialize(world);
    // Buffer recent events for treaty violation checking
    // Note: In actual integration, would subscribe to EventBus
  }

  cleanup(): void {
    super.cleanup();
    if (this.unsubscribe !== null) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Subscribe to event bus to track recent events.
   * Call this when the system is added to the simulation.
   */
  subscribeToEvents(events: EventBus): void {
    this.unsubscribe = events.onAny((event: WorldEvent) => {
      this.recentEvents.push(event);
    });
  }

  /**
   * Main execution — called each month.
   */
  execute(world: World, clock: WorldClock, events: EventBus): void {
    // 1. Check treaty violations from recent events
    const violations = this.treatyEnforcement.checkViolations(
      this.recentEvents,
      world,
      clock.currentTime,
    );

    for (const violation of violations) {
      this.treatyEnforcement.onViolation(
        violation,
        this.reputationSystem,
        world,
        clock,
        events,
      );

      // Add grudge to victim faction's leader
      for (const witnessId of violation.witnessIds) {
        const witnessLeader = this.getFactionLeader(witnessId, world);
        const violatorLeader = this.getFactionLeader(violation.violatorId, world);
        if (witnessLeader !== null && violatorLeader !== null) {
          this.grudgeSystem.addGrudge(
            witnessLeader,
            violatorLeader,
            violation.treatyId as unknown as import('../ecs/types.js').EventId,
            `Treaty violation: ${violation.termType}`,
            Math.round(violation.severity * 0.8),
            clock.currentTime,
          );
        }
      }
    }

    // 2. Expire old treaties
    const expired = this.treatyEnforcement.expireTreaties(clock.currentTime);
    for (const treatyId of expired) {
      const treaty = this.treatyEnforcement.getTreaty(treatyId);
      if (treaty !== undefined) {
        events.emit(createEvent({
          category: EventCategory.Political,
          subtype: 'faction.treaty_expired',
          timestamp: clock.currentTick,
          participants: [...treaty.parties],
          significance: 30,
          data: { treatyId, treatyName: treaty.name },
        }));
      }
    }

    // 3. Process each faction
    const factionIds = this.getFactions(world);
    for (const factionId of factionIds) {
      this.processFactionTurn(factionId, world, clock, events);
    }

    // 4. Process internal politics (coups, reforms)
    this.processInternalPolitics(world, clock, events);

    // 5. Clear recent events buffer for next cycle
    this.recentEvents = [];
  }

  // ── Faction processing ──────────────────────────────────────────────────

  private processFactionTurn(
    factionId: FactionId,
    world: World,
    clock: WorldClock,
    events: EventBus,
  ): void {
    const govComp = world.getComponent<GovernmentComponent>(factionId, 'Government');
    const dipComp = world.getComponent<DiplomacyComponent>(factionId, 'Diplomacy');
    if (govComp === undefined || dipComp === undefined) return;

    const leaderId = this.getFactionLeader(factionId, world);
    const militaryStrength = this.getMilitaryStrength(factionId, world);

    const context: DecisionContext = {
      factionId,
      leaderId,
      governmentType: govComp.governmentType as GovernmentType,
      stability: govComp.stability,
      legitimacy: govComp.legitimacy,
      militaryStrength,
      economicWealth: 50, // Placeholder
    };

    const modifiers = getGovernmentDecisionModifiers(context);

    // Decide whether to take diplomatic action
    const actionLikelihood = modifiers.get('action_likelihood') ?? 0.5;

    // Simple RNG based on tick for determinism
    const rng = this.makeRng(clock.currentTick, factionId);
    if (rng() > actionLikelihood) return;

    // Find a target faction and potential action
    const otherFactions = this.getFactions(world).filter(f => f !== factionId);
    if (otherFactions.length === 0) return;

    // Pick a target (prioritize those with existing relations)
    const targetId = this.selectTarget(factionId, otherFactions, dipComp, rng);
    if (targetId === undefined) return;

    // Choose best action for this target
    const outcome = this.chooseDiplomaticAction(
      factionId,
      targetId,
      context,
      modifiers,
      dipComp,
      world,
      clock,
      rng,
    );

    if (outcome !== null) {
      this.executeDiplomaticAction(outcome, world, clock, events);
    }
  }

  private selectTarget(
    _actorId: FactionId,
    targets: readonly FactionId[],
    diplomacy: DiplomacyComponent,
    rng: () => number,
  ): FactionId | undefined {
    if (targets.length === 0) return undefined;

    // Prefer factions we have existing relations with
    const withRelations = targets.filter(t => diplomacy.relations.has(t as number));
    const pool = withRelations.length > 0 ? withRelations : targets;

    const idx = Math.floor(rng() * pool.length);
    return pool[idx];
  }

  private chooseDiplomaticAction(
    actorId: FactionId,
    targetId: FactionId,
    context: DecisionContext,
    modifiers: Map<string, number>,
    diplomacy: DiplomacyComponent,
    _world: World,
    _clock: WorldClock,
    rng: () => number,
  ): DiplomaticOutcome | null {
    const relation = getRelation(diplomacy, targetId);
    const dipRep = this.treatyEnforcement.getDiplomaticReputation(actorId);

    // Score each possible action
    const scoredActions: { action: DiplomaticAction; score: number }[] = [];

    for (const action of Object.values(DiplomaticAction)) {
      const template = DIPLOMATIC_TEMPLATES[action];
      const precondResult = checkPreconditions(
        action,
        actorId,
        targetId,
        context.stability,
        relation,
      );

      if (!precondResult.valid) continue;

      // Calculate score based on government preferences
      let score = template.baseSuccessRate * 100;

      // Government type modifiers
      if (action === DiplomaticAction.DeclareWar || action === DiplomaticAction.IssueUltimatum) {
        score *= modifiers.get('military_weight') ?? 1.0;
      } else if (action === DiplomaticAction.FormAlliance || action === DiplomaticAction.ProposeTrade) {
        score *= modifiers.get('diplomacy_weight') ?? 1.0;
      }

      // Relations affect action preference
      if (relation > 30 && (action === DiplomaticAction.FormAlliance || action === DiplomaticAction.ArrangeMarriage)) {
        score *= 1.3;
      }
      if (relation < -30 && action === DiplomaticAction.DeclareWar) {
        score *= 1.2;
      }

      // Check grudges — more likely to act against grudge holders
      const leaderGrudge = context.leaderId !== null
        ? this.grudgeSystem.getGrudgeLevel(context.leaderId, targetId)
        : 0;
      if (leaderGrudge > 50 && action === DiplomaticAction.DeclareWar) {
        score *= 1.4;
      }

      // Existing treaties affect actions
      if (this.treatyEnforcement.hasActiveTerm(actorId, targetId, TreatyTermType.NonAggression)) {
        if (action === DiplomaticAction.DeclareWar) {
          score *= 0.3; // Risky to break treaty
        }
      }

      scoredActions.push({ action, score });
    }

    if (scoredActions.length === 0) return null;

    // Sort by score descending
    scoredActions.sort((a, b) => b.score - a.score);

    // Pick top action with some randomness
    const topAction = scoredActions[0]!;
    const template = DIPLOMATIC_TEMPLATES[topAction.action];

    // Roll for success
    const successRate = calculateSuccessRate(topAction.action, relation, dipRep);
    const success = rng() < successRate;

    const outcome: DiplomaticOutcome = {
      action: topAction.action,
      actorId,
      targetId,
      success,
      relationChange: success ? template.relationshipImpact : template.failureRelationImpact,
      stabilityChange: success ? 0 : -5,
    };

    return outcome;
  }

  private executeDiplomaticAction(
    outcome: DiplomaticOutcome,
    world: World,
    clock: WorldClock,
    events: EventBus,
  ): void {
    const template = DIPLOMATIC_TEMPLATES[outcome.action];

    // Update relations
    const actorDip = world.getComponent<DiplomacyComponent>(outcome.actorId, 'Diplomacy');
    const targetDip = world.getComponent<DiplomacyComponent>(outcome.targetId, 'Diplomacy');

    if (actorDip !== undefined) {
      const current = actorDip.relations.get(outcome.targetId as number) ?? 0;
      actorDip.relations.set(outcome.targetId as number, current + outcome.relationChange);
    }
    if (targetDip !== undefined) {
      const current = targetDip.relations.get(outcome.actorId as number) ?? 0;
      // Target relation change is usually symmetric but can be adjusted
      targetDip.relations.set(outcome.actorId as number, current + outcome.relationChange);
    }

    // Update stability on failure
    if (!outcome.success && outcome.stabilityChange !== 0) {
      const actorGov = world.getComponent<GovernmentComponent>(outcome.actorId, 'Government');
      if (actorGov !== undefined) {
        actorGov.stability = Math.max(0, Math.min(100, actorGov.stability + outcome.stabilityChange));
      }
    }

    // Create treaty if applicable
    if (outcome.success && template.createsTreaty) {
      const treaty = this.createTreatyForAction(outcome, clock);
      if (treaty !== null) {
        this.treatyEnforcement.registerTreaty(treaty);
      }
    }

    // Emit event
    if (template.generatesEvent) {
      events.emit(createEvent({
        category: EventCategory.Political,
        subtype: template.eventSubtype,
        timestamp: clock.currentTick,
        participants: [outcome.actorId, outcome.targetId],
        significance: template.eventSignificance,
        data: {
          action: outcome.action,
          success: outcome.success,
          relationChange: outcome.relationChange,
        },
      }));
    }
  }

  private createTreatyForAction(outcome: DiplomaticOutcome, clock: WorldClock): Treaty | null {
    const parties = [outcome.actorId, outcome.targetId] as const;

    switch (outcome.action) {
      case DiplomaticAction.FormAlliance:
        return createTreaty(
          'Mutual Defense Pact',
          parties,
          [
            createNonAggressionTerm(parties, 3650), // 10 years
            createMutualDefenseTerm(parties, 30, 50),
          ],
          clock.currentTime,
          3650,
        );

      case DiplomaticAction.SignPeace:
        return createTreaty(
          'Peace Treaty',
          parties,
          [createNonAggressionTerm(parties, 1825)], // 5 years
          clock.currentTime,
          1825,
        );

      case DiplomaticAction.ProposeTrade:
        return createTreaty(
          'Trade Agreement',
          parties,
          [], // Trade terms would be added here
          clock.currentTime,
          730, // 2 years
        );

      default:
        return null;
    }
  }

  // ── Internal politics ─────────────────────────────────────────────────────

  private processInternalPolitics(
    world: World,
    clock: WorldClock,
    events: EventBus,
  ): void {
    const factionIds = this.getFactions(world);

    for (const factionId of factionIds) {
      const gov = world.getComponent<GovernmentComponent>(factionId, 'Government');
      if (gov === undefined) continue;

      const rng = this.makeRng(clock.currentTick + 1000, factionId);

      // Check for coup attempts (low legitimacy + low stability)
      if (gov.legitimacy < 20 && gov.stability < 30) {
        this.attemptCoup(factionId, gov, world, clock, events, rng);
      }

      // Check for reform movements (moderate stability, reformable gov)
      const traits = GOVERNMENT_TRAITS[gov.governmentType as GovernmentType];
      if (traits !== undefined && gov.stability > 40 && gov.stability < 70) {
        if (rng() < traits.reformTolerance / 500) { // Low base chance
          this.triggerReformMovement(factionId, gov, world, clock, events);
        }
      }

      // Natural stability drift based on government type
      this.updateStability(gov, traits);
    }
  }

  private attemptCoup(
    factionId: FactionId,
    gov: GovernmentComponent,
    world: World,
    clock: WorldClock,
    events: EventBus,
    rng: () => number,
  ): void {
    // Emit coup attempt event
    events.emit(createEvent({
      category: EventCategory.Political,
      subtype: 'faction.coup_attempt',
      timestamp: clock.currentTick,
      participants: [factionId],
      significance: 75,
      data: { factionId },
    }));

    // Coup success based on military morale and legitimacy
    const military = world.getComponent<MilitaryComponent>(factionId, 'Military');
    const morale = military?.morale ?? 50;

    // Low legitimacy + low morale = higher coup success
    const successChance = (100 - gov.legitimacy) / 200 + (100 - morale) / 400;
    const success = rng() < successChance;

    if (success) {
      events.emit(createEvent({
        category: EventCategory.Political,
        subtype: 'faction.coup_success',
        timestamp: clock.currentTick,
        participants: [factionId],
        significance: 90,
        data: { factionId },
      }));

      // Reset legitimacy, damage stability
      gov.legitimacy = 30;
      gov.stability = Math.max(10, gov.stability - 20);

      // Trigger succession to new leader
      this.triggerSuccession(factionId, gov, world, clock, events);
    } else {
      events.emit(createEvent({
        category: EventCategory.Political,
        subtype: 'faction.coup_failed',
        timestamp: clock.currentTick,
        participants: [factionId],
        significance: 60,
        data: { factionId },
      }));

      // Failed coup slightly stabilizes (purge of dissidents)
      gov.stability = Math.min(100, gov.stability + 10);
      gov.legitimacy = Math.min(100, gov.legitimacy + 5);
    }
  }

  private triggerReformMovement(
    factionId: FactionId,
    _gov: GovernmentComponent,
    _world: World,
    clock: WorldClock,
    events: EventBus,
  ): void {
    events.emit(createEvent({
      category: EventCategory.Political,
      subtype: 'faction.reform_movement',
      timestamp: clock.currentTick,
      participants: [factionId],
      significance: 45,
      data: { factionId },
    }));
  }

  private triggerSuccession(
    factionId: FactionId,
    gov: GovernmentComponent,
    _world: World,
    clock: WorldClock,
    events: EventBus,
  ): void {
    const successionRule = SUCCESSION_RULES[gov.governmentType as GovernmentType];
    if (successionRule === undefined) return;

    // Apply stability impact
    gov.stability = Math.max(0, Math.min(100, gov.stability + successionRule.stabilityImpact));

    // Check for succession crisis
    const rng = this.makeRng(clock.currentTick + 2000, factionId);
    const crisis = rng() < successionRule.crisisProbability;

    events.emit(createEvent({
      category: EventCategory.Political,
      subtype: crisis ? 'faction.succession_crisis' : 'faction.succession',
      timestamp: clock.currentTick,
      participants: [factionId],
      significance: crisis ? 80 : 55,
      data: {
        factionId,
        successionType: successionRule.type,
        crisis,
      },
    }));

    if (crisis) {
      gov.stability = Math.max(0, gov.stability - 15);
    }
  }

  private updateStability(gov: GovernmentComponent, traits: { stabilityBase: number } | undefined): void {
    if (traits === undefined) return;

    // Drift toward base stability over time
    const base = traits.stabilityBase;
    const diff = base - gov.stability;
    const drift = Math.sign(diff) * Math.min(Math.abs(diff), 1);
    gov.stability = Math.max(0, Math.min(100, gov.stability + drift));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getFactions(world: World): FactionId[] {
    return world
      .query('Government', 'Diplomacy')
      .map(id => toFactionId(id));
  }

  private getFactionLeader(factionId: FactionId, world: World): EntityId | null {
    const hierarchy = world.getComponent<HierarchyComponent>(factionId, 'Hierarchy');
    if (hierarchy === undefined || hierarchy.leaderId === null) return null;
    return hierarchy.leaderId as EntityId;
  }

  private getMilitaryStrength(factionId: FactionId, world: World): number {
    const military = world.getComponent<MilitaryComponent>(factionId, 'Military');
    return military?.strength ?? 0;
  }

  /**
   * Deterministic RNG for reproducible faction decisions.
   */
  private makeRng(tick: number, factionId: FactionId): () => number {
    let seed = tick * 31337 + (factionId as number) * 7919;
    return (): number => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return (seed % 1000000) / 1000000;
    };
  }

  // ── Public API for integration ────────────────────────────────────────────

  /**
   * Get the treaty enforcement instance for external access.
   */
  getTreatyEnforcement(): TreatyEnforcement {
    return this.treatyEnforcement;
  }

  /**
   * Add an event to the recent events buffer (for manual injection in tests).
   */
  addRecentEvent(event: WorldEvent): void {
    this.recentEvents.push(event);
  }
}
