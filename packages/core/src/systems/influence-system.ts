/**
 * InfluenceSystem — Player intervention system for subtle world manipulation.
 *
 * The influence system allows players to nudge the simulation without
 * directly commanding entities. Actions map to existing event categories
 * and cascade naturally through other systems.
 *
 * Design principles:
 * - Player actions feel natural, not forced
 * - Influence is a limited resource that regenerates slowly
 * - Strong-willed characters can resist mental interventions
 * - Older worlds resist change more (narrative momentum)
 */

import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { CharacterId, SiteId } from '../ecs/types.js';
import type { PositionComponent, TraitsComponent } from '../ecs/component.js';
import type {
  InfluenceAction,
  InfluenceResult,
  BelievabilityResult,
  ResistanceResult,
  InfluencePointState,
  InfluenceActionKind,
} from './influence-types.js';
import type { TickNumber } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import { LevelOfDetailManager } from '../engine/lod-manager.js';
import { PersonalityTrait } from './personality-traits.js';
import {
  InfluenceActionType,
  getInfluenceActionConfig,
} from './influence-event-mapping.js';

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/** Starting influence points */
const STARTING_IP = 50;

/** Maximum influence points */
const MAX_IP = 100;

/** Base IP regeneration per simulation year (365 ticks) */
const BASE_REGENERATION_RATE = 1;

/** Ticks per year for regeneration calculation */
const TICKS_PER_YEAR = 365;

/** Base success probability for resistance checks */
const BASE_SUCCESS_PROBABILITY = 0.7;

/** Resistance score divisor for success probability */
const RESISTANCE_DIVISOR = 200;

/** Bonus IP per significant event involving focused entity */
const FOCUSED_EVENT_BONUS = 0.5;

/** World age threshold for narrative momentum (years) */
const NARRATIVE_MOMENTUM_THRESHOLD_YEARS = 5000;

/** Partial refund percentage on resistance */
const RESISTANCE_REFUND_PERCENT = 0.5;

// ════════════════════════════════════════════════════════════════════════════
// SEEDED RNG
// ════════════════════════════════════════════════════════════════════════════

/**
 * Simple seeded random number generator for deterministic resistance checks.
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// INFLUENCE SYSTEM
// ════════════════════════════════════════════════════════════════════════════

/**
 * InfluenceSystem manages player interventions in the world.
 */
export class InfluenceSystem {
  private influencePoints: number = STARTING_IP;
  private readonly maxPoints: number = MAX_IP;
  private readonly regenerationRate: number = BASE_REGENERATION_RATE;
  private worldAge: number = 0;
  private lastRegenerationTick: number = 0;
  private fractionalIP: number = 0;

  private readonly world: World;
  private readonly lodManager: LevelOfDetailManager | null;
  private rng: SeededRandom;

  /** Track cooldowns per action type */
  private readonly cooldowns: Map<InfluenceActionKind, number> = new Map();

  /** Pending actions to execute next tick */
  private readonly pendingActions: Array<{
    action: InfluenceAction;
    queuedAt: number;
  }> = [];

  constructor(
    world: World,
    lodManager: LevelOfDetailManager | null = null,
    seed: number = Date.now()
  ) {
    this.world = world;
    this.lodManager = lodManager;
    this.rng = new SeededRandom(seed);
  }

  // ── IP Management ─────────────────────────────────────────────────────────

  /**
   * Get the current available influence points.
   */
  getAvailablePoints(): number {
    return this.influencePoints;
  }

  /**
   * Get the maximum influence points.
   */
  getMaxPoints(): number {
    return this.maxPoints;
  }

  /**
   * Get the current state of influence points.
   */
  getPointState(): InfluencePointState {
    return {
      current: this.influencePoints,
      maximum: this.maxPoints,
      regenerationRate: this.regenerationRate,
      effectiveRegeneration: this.calculateEffectiveRegeneration(),
      worldAge: this.worldAge,
    };
  }

  /**
   * Check if the player can afford an action.
   */
  canAfford(action: InfluenceAction): boolean {
    const cost = this.calculateCost(action);
    return cost <= this.influencePoints;
  }

  /**
   * Get the cost for an action (with modifiers).
   */
  getCost(action: InfluenceAction): number {
    return this.calculateCost(action);
  }

  /**
   * Grant bonus IP (e.g., for significant events involving focused entity).
   */
  grantBonus(amount: number): void {
    this.influencePoints = Math.min(
      this.maxPoints,
      this.influencePoints + amount
    );
  }

  // ── Cooldown Management ───────────────────────────────────────────────────

  /**
   * Check if an action type is on cooldown.
   */
  isOnCooldown(actionType: InfluenceActionKind): boolean {
    const lastUsed = this.cooldowns.get(actionType);
    if (lastUsed === undefined) return false;

    const config = this.getConfigForActionType(actionType);
    if (config === undefined) return false;

    return this.worldAge - lastUsed < config.cooldownTicks;
  }

  /**
   * Get remaining cooldown ticks for an action type.
   */
  getRemainingCooldown(actionType: InfluenceActionKind): number {
    const lastUsed = this.cooldowns.get(actionType);
    if (lastUsed === undefined) return 0;

    const config = this.getConfigForActionType(actionType);
    if (config === undefined) return 0;

    const elapsed = this.worldAge - lastUsed;
    return Math.max(0, config.cooldownTicks - elapsed);
  }

  // ── Action Execution ──────────────────────────────────────────────────────

  /**
   * Queue an action for execution on the next tick.
   */
  queueAction(action: InfluenceAction): void {
    this.pendingActions.push({
      action,
      queuedAt: this.worldAge,
    });
  }

  /**
   * Execute a queued influence action immediately.
   * Returns the result of the execution.
   */
  execute(
    action: InfluenceAction,
    eventBus: EventBus,
    clock: WorldClock
  ): InfluenceResult {
    const currentTick = clock.currentTick;

    // Step 1: Check cooldown
    if (this.isOnCooldown(action.type)) {
      const remaining = this.getRemainingCooldown(action.type);
      return {
        success: false,
        costPaid: 0,
        narrative: `Cannot use ${action.type} - on cooldown for ${remaining} more ticks`,
        failureReason: 'cooldown',
      };
    }

    // Step 2: Check cost
    const cost = this.calculateCost(action);
    if (cost > this.influencePoints) {
      return {
        success: false,
        costPaid: 0,
        narrative: `Insufficient influence points: need ${cost}, have ${this.influencePoints}`,
        failureReason: 'insufficient_points',
      };
    }

    // Step 3: Check believability
    const believability = this.checkBelievability(action);
    if (!believability.believable) {
      return {
        success: false,
        costPaid: 0,
        narrative: believability.reason ?? 'Action not believable',
        failureReason: 'implausible',
      };
    }

    // Step 4: Check resistance (for character-targeted actions)
    const resistance = this.checkResistance(action);
    if (resistance.resisted) {
      // Partial refund on resistance
      const refund = Math.floor(cost * RESISTANCE_REFUND_PERCENT);
      const actualCost = cost - refund;
      this.influencePoints -= actualCost;
      this.cooldowns.set(action.type, currentTick);

      // Emit a "resisted" event
      this.emitResistedEvent(action, eventBus, currentTick, resistance);

      return {
        success: false,
        costPaid: actualCost,
        resistedBy: resistance.explanation,
        narrative: `The influence was resisted: ${resistance.explanation}`,
      };
    }

    // Step 5: Success - deduct full cost, apply effect, emit event
    this.influencePoints -= cost;
    this.cooldowns.set(action.type, currentTick);

    // Apply the effect and generate event
    const narrative = this.applyEffect(action, eventBus, currentTick);

    return {
      success: true,
      costPaid: cost,
      narrative,
    };
  }

  /**
   * Process all pending actions. Call at start of tick.
   */
  processPendingActions(eventBus: EventBus, clock: WorldClock): InfluenceResult[] {
    const results: InfluenceResult[] = [];

    for (const { action } of this.pendingActions) {
      const result = this.execute(action, eventBus, clock);
      results.push(result);
    }

    this.pendingActions.length = 0;
    return results;
  }

  // ── Tick Processing ───────────────────────────────────────────────────────

  /**
   * Update world age and process regeneration.
   * Call once per tick.
   */
  tick(currentTick: number, significantFocusedEvent: boolean = false): void {
    this.worldAge = currentTick;

    // Regenerate IP annually
    const yearsSinceLastRegen = Math.floor(
      (currentTick - this.lastRegenerationTick) / TICKS_PER_YEAR
    );

    if (yearsSinceLastRegen > 0) {
      const effectiveRegen = this.calculateEffectiveRegeneration();
      const totalRegen = yearsSinceLastRegen * effectiveRegen;

      // Add fractional IP and whole IP separately
      this.fractionalIP += totalRegen;
      const wholeIP = Math.floor(this.fractionalIP);
      this.fractionalIP -= wholeIP;

      this.influencePoints = Math.min(
        this.maxPoints,
        this.influencePoints + wholeIP
      );
      this.lastRegenerationTick =
        this.lastRegenerationTick + yearsSinceLastRegen * TICKS_PER_YEAR;
    }

    // Bonus for significant events involving focused entity
    if (significantFocusedEvent) {
      this.grantBonus(FOCUSED_EVENT_BONUS);
    }
  }

  /**
   * Reset to initial state (for testing).
   */
  reset(): void {
    this.influencePoints = STARTING_IP;
    this.worldAge = 0;
    this.lastRegenerationTick = 0;
    this.fractionalIP = 0;
    this.cooldowns.clear();
    this.pendingActions.length = 0;
  }

  // ── Believability Checks ──────────────────────────────────────────────────

  /**
   * Check if an action is believable given world state.
   * Delegates to config-defined believabilityCheck function if present.
   */
  checkBelievability(action: InfluenceAction): BelievabilityResult {
    const config = this.getConfigForActionType(action.type);
    if (config === undefined) {
      return { believable: true };
    }

    // Use config-defined check if present, otherwise default to believable
    if (config.believabilityCheck !== undefined) {
      return config.believabilityCheck(action, this.world);
    }

    return { believable: true };
  }

  // ── Resistance Checks ─────────────────────────────────────────────────────

  /**
   * Check if a character-targeted action is resisted.
   * Uses config-defined extractTarget to identify the target.
   */
  checkResistance(action: InfluenceAction): ResistanceResult {
    // Only character-targeted actions have resistance
    const config = this.getConfigForActionType(action.type);
    if (config === undefined) {
      return {
        resisted: false,
        resistanceScore: 0,
        successProbability: 1,
        explanation: 'No target to resist',
      };
    }

    const targetId = config.extractTarget(action);
    if (targetId === null) {
      return {
        resisted: false,
        resistanceScore: 0,
        successProbability: 1,
        explanation: 'No target to resist',
      };
    }

    // Calculate resistance score from traits
    const resistanceScore = this.calculateResistanceScore(targetId, action.type);

    // Calculate success probability
    const successProbability = Math.max(
      0,
      BASE_SUCCESS_PROBABILITY - resistanceScore / RESISTANCE_DIVISOR
    );

    // Roll against probability
    const roll = this.rng.next();
    const resisted = roll >= successProbability;

    return {
      resisted,
      resistanceScore,
      successProbability,
      explanation: resisted
        ? this.getResistanceExplanation(targetId, action.type)
        : 'The target was receptive to influence',
    };
  }

  private calculateResistanceScore(
    characterId: CharacterId,
    actionType: InfluenceActionKind
  ): number {
    let score = 0;

    // Get character traits
    const traits = this.getCharacterTraits(characterId);

    // Base resistance from willpower-related traits
    // High paranoid = +15 for mental interventions
    const paranoidValue = traits.get(PersonalityTrait.Paranoid) ?? 0;
    if (this.isMentalIntervention(actionType)) {
      score += Math.max(0, paranoidValue) * 0.15;
    }

    // Patient + Cautious = more resistant
    const patientValue = traits.get(PersonalityTrait.Patient) ?? 0;
    const cautiousValue = traits.get(PersonalityTrait.Cautious) ?? 0;
    score += Math.max(0, patientValue) * 0.1;
    score += Math.max(0, cautiousValue) * 0.1;

    // Pragmatic characters resist idealistic interventions
    const pragmaticValue = traits.get(PersonalityTrait.Pragmatic) ?? 0;
    if (actionType === 'PropheticDream' || actionType === 'VisionOfFuture') {
      score += Math.max(0, pragmaticValue) * 0.15;
    }

    // Check for magical protection (placeholder)
    // const magicProtection = this.world.getComponent<...>(characterId, 'MagicProtection');
    // if (magicProtection) score += 20;

    // Check for divine favor of opposing god (placeholder)
    // const divineFavor = this.world.getComponent<...>(characterId, 'DivineFavor');
    // if (divineFavorOpposesPlayer(divineFavor)) score += 30;

    return score;
  }

  private isMentalIntervention(actionType: InfluenceActionKind): boolean {
    return (
      actionType === 'InspireIdea' ||
      actionType === 'PropheticDream' ||
      actionType === 'PersonalityNudge' ||
      actionType === 'VisionOfFuture' ||
      actionType === 'LuckModifier'
    );
  }

  private getResistanceExplanation(
    characterId: CharacterId,
    actionType: InfluenceActionKind
  ): string {
    const traits = this.getCharacterTraits(characterId);

    const paranoidValue = traits.get(PersonalityTrait.Paranoid) ?? 0;
    const cautiousValue = traits.get(PersonalityTrait.Cautious) ?? 0;
    const pragmaticValue = traits.get(PersonalityTrait.Pragmatic) ?? 0;

    if (paranoidValue > 50 && this.isMentalIntervention(actionType)) {
      return 'The character\'s paranoid nature shielded them from influence';
    }
    if (cautiousValue > 50) {
      return 'The character\'s cautious disposition resisted the subtle manipulation';
    }
    if (pragmaticValue > 50 && (actionType === 'PropheticDream' || actionType === 'VisionOfFuture')) {
      return 'The character\'s pragmatic mindset dismissed the vision as fantasy';
    }

    return 'The character\'s willpower resisted the influence';
  }

  // ── Effect Application ────────────────────────────────────────────────────

  private applyEffect(
    action: InfluenceAction,
    eventBus: EventBus,
    currentTick: TickNumber
  ): string {
    // Get the config for this action type
    const config = this.getConfigForActionType(action.type);
    if (config === undefined) {
      return 'Unknown action type';
    }

    // Build event data, participants, location, and narrative from config
    const eventData = config.buildEventData(action);
    const participants = config.extractParticipants(action);
    const location = config.extractLocation(action);
    const narrative = config.buildNarrative(action);

    // Calculate significance
    const significance = this.calculateSignificance(action);

    // Emit the event
    const eventOptions: Parameters<typeof createEvent>[0] = {
      category: config.category,
      subtype: config.subtypePrefix,
      timestamp: currentTick,
      participants,
      significance,
      data: eventData,
    };

    if (location !== null) {
      eventOptions.location = location;
    }

    const event = createEvent(eventOptions);
    eventBus.emit(event);

    return narrative;
  }

  private emitResistedEvent(
    action: InfluenceAction,
    eventBus: EventBus,
    currentTick: TickNumber,
    resistance: ResistanceResult
  ): void {
    const config = this.getConfigForActionType(action.type);
    if (config === undefined) return;

    const event = createEvent({
      category: config.category,
      subtype: `${config.subtypePrefix}.resisted`,
      timestamp: currentTick,
      participants: config.extractParticipants(action),
      significance: 10, // Low significance for resisted actions
      data: {
        actionType: action.type,
        resistanceScore: resistance.resistanceScore,
        explanation: resistance.explanation,
      },
    });

    eventBus.emit(event);
  }


  // ── Helper Methods ────────────────────────────────────────────────────────

  private calculateCost(action: InfluenceAction): number {
    const baseCost = action.cost;

    // Distance modifier if we have LoD manager and action has a target
    if (this.lodManager !== null) {
      const targetPos = this.getActionPosition(action);
      if (targetPos !== null) {
        const distance = this.lodManager.getDistanceFromFocus(
          targetPos.x,
          targetPos.y
        );
        // +1% per tile distance
        const distanceMultiplier = 1 + distance * 0.01;
        return Math.ceil(baseCost * distanceMultiplier);
      }
    }

    return baseCost;
  }

  private calculateEffectiveRegeneration(): number {
    // Apply narrative momentum modifier for old worlds
    const worldAgeYears = this.worldAge / TICKS_PER_YEAR;
    if (worldAgeYears <= NARRATIVE_MOMENTUM_THRESHOLD_YEARS) {
      return this.regenerationRate;
    }

    // Older worlds resist change more
    // Formula: regeneration × (1 - log10(worldAge/1000) × 0.1)
    const modifier = 1 - Math.log10(worldAgeYears / 1000) * 0.1;
    return Math.max(0.1, this.regenerationRate * modifier);
  }

  private calculateSignificance(action: InfluenceAction): number {
    const config = this.getConfigForActionType(action.type);
    if (config === undefined) return 30;

    const [minSig, maxSig] = config.significanceRange;
    // Use midpoint for now; could vary based on action parameters
    return Math.floor((minSig + maxSig) / 2);
  }


  private getActionPosition(
    action: InfluenceAction
  ): { x: number; y: number } | null {
    const config = this.getConfigForActionType(action.type);
    if (config === undefined) return null;

    // First try to get character position
    const targetId = config.extractTarget(action);
    if (targetId !== null) {
      return this.getCharacterPosition(targetId);
    }

    // Then try location
    const locationId = config.extractLocation(action);
    if (locationId !== null) {
      return this.getSitePosition(locationId);
    }

    return null;
  }

  private getCharacterPosition(
    characterId: CharacterId
  ): { x: number; y: number } | null {
    const pos = this.world.getComponent<PositionComponent>(
      characterId,
      'Position'
    );
    if (pos === undefined) return null;
    return { x: pos.x, y: pos.y };
  }

  private getSitePosition(siteId: SiteId): { x: number; y: number } | null {
    const pos = this.world.getComponent<PositionComponent>(siteId, 'Position');
    if (pos === undefined) return null;
    return { x: pos.x, y: pos.y };
  }

  private getCharacterTraits(
    characterId: CharacterId
  ): Map<PersonalityTrait, number> {
    const traitsComp = this.world.getComponent<TraitsComponent>(
      characterId,
      'Traits'
    );

    if (traitsComp === undefined) {
      return new Map();
    }

    const result = new Map<PersonalityTrait, number>();
    for (const trait of Object.values(PersonalityTrait)) {
      const value = traitsComp.intensities.get(trait);
      if (value !== undefined) {
        result.set(trait, value);
      }
    }
    return result;
  }

  private getConfigForActionType(actionType: InfluenceActionKind) {
    // Map action kind to InfluenceActionType enum
    const mapping: Record<InfluenceActionKind, InfluenceActionType> = {
      InspireIdea: InfluenceActionType.InspireIdea,
      PropheticDream: InfluenceActionType.PropheticDream,
      ArrangeMeeting: InfluenceActionType.ArrangeMeeting,
      PersonalityNudge: InfluenceActionType.PersonalityNudge,
      RevealSecret: InfluenceActionType.RevealSecret,
      LuckModifier: InfluenceActionType.LuckModifier,
      VisionOfFuture: InfluenceActionType.VisionOfFuture,
      EmpowerChampion: InfluenceActionType.EmpowerChampion,
      AdjustWeather: InfluenceActionType.AdjustWeather,
      MinorGeology: InfluenceActionType.MinorGeology,
      AnimalMigration: InfluenceActionType.AnimalMigration,
      ResourceDiscovery: InfluenceActionType.ResourceDiscovery,
      TriggerNaturalEvent: InfluenceActionType.TriggerNaturalEvent,
      PromoteArt: InfluenceActionType.PromoteArt,
      EncourageResearch: InfluenceActionType.EncourageResearch,
      StrengthenTradition: InfluenceActionType.StrengthenTradition,
      IntroduceForeignConcept: InfluenceActionType.IntroduceForeignConcept,
    };

    const enumValue = mapping[actionType];
    return enumValue !== undefined
      ? getInfluenceActionConfig(enumValue)
      : undefined;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

export { STARTING_IP, MAX_IP, BASE_REGENERATION_RATE, TICKS_PER_YEAR };
