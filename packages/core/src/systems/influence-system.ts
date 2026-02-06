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
import type { EntityId, CharacterId, SiteId } from '../ecs/types.js';
import type { PositionComponent, TraitsComponent } from '../ecs/component.js';
import type {
  InfluenceAction,
  InfluenceResult,
  BelievabilityResult,
  ResistanceResult,
  InfluencePointState,
  InfluenceActionKind,
} from './influence-types.js';
import { EventCategory, type TickNumber } from '../events/types.js';
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

/** Maximum distance for ArrangeMeeting action */
const MAX_MEETING_DISTANCE = 50;

/** Maximum personality nudge swing */
const MAX_NUDGE_SWING = 15;

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
   */
  checkBelievability(action: InfluenceAction): BelievabilityResult {
    switch (action.type) {
      case 'InspireIdea':
        return this.checkInspireIdeaBelievability(action);
      case 'PersonalityNudge':
        return this.checkPersonalityNudgeBelievability(action);
      case 'ArrangeMeeting':
        return this.checkArrangeMeetingBelievability(action);
      case 'RevealSecret':
        return this.checkRevealSecretBelievability(action);
      case 'TriggerNaturalEvent':
        return this.checkTriggerNaturalEventBelievability(action);
      case 'MinorGeology':
        return this.checkMinorGeologyBelievability(action);
      default:
        // Most actions are always believable
        return { believable: true };
    }
  }

  private checkInspireIdeaBelievability(
    action: Extract<InfluenceAction, { type: 'InspireIdea' }>
  ): BelievabilityResult {
    // Check if concept relates to character's skills/interests
    // For now, just check that the concept is not empty
    if (action.concept.trim().length === 0) {
      return { believable: false, reason: 'Concept cannot be empty' };
    }

    // Future: Check character's skills component and match against concept keywords
    // const skills = this.world.getComponent<SkillComponent>(action.target, 'Skill');
    // if (!conceptRelatedToSkills(action.concept, skills)) {
    //   return { believable: false, reason: 'Concept unrelated to character interests' };
    // }

    return { believable: true };
  }

  private checkPersonalityNudgeBelievability(
    action: Extract<InfluenceAction, { type: 'PersonalityNudge' }>
  ): BelievabilityResult {
    // Cannot swing more than 15 points at once
    if (Math.abs(action.direction) > MAX_NUDGE_SWING) {
      return {
        believable: false,
        reason: `Cannot nudge personality more than ${MAX_NUDGE_SWING} points at once (requested ${Math.abs(action.direction)})`,
      };
    }

    // Validate trait name
    const validTraits = Object.values(PersonalityTrait) as string[];
    if (!validTraits.includes(action.trait)) {
      return {
        believable: false,
        reason: `Unknown personality trait: ${action.trait}`,
      };
    }

    return { believable: true };
  }

  private checkArrangeMeetingBelievability(
    action: Extract<InfluenceAction, { type: 'ArrangeMeeting' }>
  ): BelievabilityResult {
    // Characters must be within 50 tiles of each other
    const pos1 = this.getCharacterPosition(action.character1);
    const pos2 = this.getCharacterPosition(action.character2);

    if (pos1 === null || pos2 === null) {
      return {
        believable: false,
        reason: 'Cannot determine character positions',
      };
    }

    const distance = Math.sqrt(
      (pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2
    );

    if (distance > MAX_MEETING_DISTANCE) {
      return {
        believable: false,
        reason: `Characters are too far apart (${Math.round(distance)} tiles, max ${MAX_MEETING_DISTANCE})`,
      };
    }

    return { believable: true };
  }

  private checkRevealSecretBelievability(
    action: Extract<InfluenceAction, { type: 'RevealSecret' }>
  ): BelievabilityResult {
    // Character must be in position to learn (near a clue)
    // For now, we allow it if the secret exists
    // Future: Check proximity to clues, knowledge of related characters, etc.

    // Validate secret exists (placeholder)
    if ((action.secretId as number) < 0) {
      return { believable: false, reason: 'Invalid secret reference' };
    }

    return { believable: true };
  }

  private checkTriggerNaturalEventBelievability(
    action: Extract<InfluenceAction, { type: 'TriggerNaturalEvent' }>
  ): BelievabilityResult {
    // Must be geologically plausible for location
    // For now, accept any non-empty event type
    if (action.eventType.trim().length === 0) {
      return { believable: false, reason: 'Event type cannot be empty' };
    }

    // Future: Check location's geological properties
    // const biome = this.world.getComponent<BiomeComponent>(action.location, 'Biome');
    // if (!eventPlausibleForBiome(action.eventType, biome)) {
    //   return { believable: false, reason: 'Event implausible for location' };
    // }

    return { believable: true };
  }

  private checkMinorGeologyBelievability(
    action: Extract<InfluenceAction, { type: 'MinorGeology' }>
  ): BelievabilityResult {
    // Must be geologically plausible for location
    if (action.effect.trim().length === 0) {
      return { believable: false, reason: 'Geological effect cannot be empty' };
    }

    return { believable: true };
  }

  // ── Resistance Checks ─────────────────────────────────────────────────────

  /**
   * Check if a character-targeted action is resisted.
   */
  checkResistance(action: InfluenceAction): ResistanceResult {
    // Only character-targeted actions have resistance
    const targetId = this.getActionTarget(action);
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
    // Get the event category and subtype from mapping
    const config = this.getConfigForActionType(action.type);
    const category = config?.category ?? EventCategory.Personal;
    const subtype = config?.subtypePrefix ?? `influence.${action.type.toLowerCase()}`;

    // Build event data based on action type
    const eventData = this.buildEventData(action);

    // Calculate significance
    const significance = this.calculateSignificance(action);

    // Get participants
    const participants = this.getParticipants(action);

    // Get location if applicable
    const location = this.getActionLocation(action);

    // Emit the event
    const eventOptions: Parameters<typeof createEvent>[0] = {
      category,
      subtype,
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

    return this.buildNarrative(action);
  }

  private emitResistedEvent(
    action: InfluenceAction,
    eventBus: EventBus,
    currentTick: TickNumber,
    resistance: ResistanceResult
  ): void {
    const config = this.getConfigForActionType(action.type);
    const category = config?.category ?? EventCategory.Personal;
    const subtype = `influence.${action.type.toLowerCase()}.resisted`;

    const event = createEvent({
      category,
      subtype,
      timestamp: currentTick,
      participants: this.getParticipants(action),
      significance: 10, // Low significance for resisted actions
      data: {
        actionType: action.type,
        resistanceScore: resistance.resistanceScore,
        explanation: resistance.explanation,
      },
    });

    eventBus.emit(event);
  }

  private buildEventData(action: InfluenceAction): Record<string, unknown> {
    const baseData: Record<string, unknown> = {
      actionType: action.type,
      influenceCost: action.cost,
    };

    switch (action.type) {
      case 'InspireIdea':
        return { ...baseData, concept: action.concept, target: action.target };
      case 'PropheticDream':
        return { ...baseData, vision: action.vision, target: action.target };
      case 'ArrangeMeeting':
        return {
          ...baseData,
          character1: action.character1,
          character2: action.character2,
        };
      case 'PersonalityNudge':
        return {
          ...baseData,
          trait: action.trait,
          direction: action.direction,
          target: action.target,
        };
      case 'RevealSecret':
        return {
          ...baseData,
          secretId: action.secretId,
          target: action.target,
        };
      case 'LuckModifier':
        return {
          ...baseData,
          actionType: action.actionType,
          modifier: action.modifier,
          target: action.target,
        };
      case 'VisionOfFuture':
        return {
          ...baseData,
          futureEvent: action.futureEvent,
          target: action.target,
        };
      case 'EmpowerChampion':
        return {
          ...baseData,
          boostAmount: action.boostAmount,
          duration: action.duration,
          target: action.target,
        };
      case 'AdjustWeather':
        return { ...baseData, change: action.change, location: action.location };
      case 'MinorGeology':
        return { ...baseData, effect: action.effect, location: action.location };
      case 'AnimalMigration':
        return {
          ...baseData,
          species: action.species,
          from: action.from,
          to: action.to,
        };
      case 'ResourceDiscovery':
        return {
          ...baseData,
          resource: action.resource,
          location: action.location,
        };
      case 'TriggerNaturalEvent':
        return {
          ...baseData,
          eventType: action.eventType,
          location: action.location,
        };
      case 'PromoteArt':
        return { ...baseData, artForm: action.artForm, culture: action.culture };
      case 'EncourageResearch':
        return { ...baseData, field: action.field, target: action.target };
      case 'StrengthenTradition':
        return {
          ...baseData,
          tradition: action.tradition,
          faction: action.faction,
        };
      case 'IntroduceForeignConcept':
        return {
          ...baseData,
          concept: action.concept,
          target: action.target,
        };
    }
  }

  private buildNarrative(action: InfluenceAction): string {
    switch (action.type) {
      case 'InspireIdea':
        return `A moment of inspiration strikes - the concept of "${action.concept}" takes root`;
      case 'PropheticDream':
        return `A prophetic dream visits the sleeper, showing visions of "${action.vision}"`;
      case 'ArrangeMeeting':
        return 'Fate conspires to bring two souls together in an unexpected encounter';
      case 'PersonalityNudge':
        return `A subtle shift occurs in temperament, ${action.direction > 0 ? 'strengthening' : 'weakening'} ${action.trait}`;
      case 'RevealSecret':
        return 'Hidden knowledge begins to surface, bringing long-buried truths to light';
      case 'LuckModifier':
        return 'Fortune\'s wheel turns slightly, altering the odds of what is to come';
      case 'VisionOfFuture':
        return 'The mists of time part briefly, revealing a glimpse of what may yet be';
      case 'EmpowerChampion':
        return 'Divine favor settles upon the chosen one, granting temporary blessings';
      case 'AdjustWeather':
        return `The winds shift and weather patterns change - ${action.change}`;
      case 'MinorGeology':
        return `The earth stirs with subtle movement - ${action.effect}`;
      case 'AnimalMigration':
        return `The ${action.species} begin an unexpected migration`;
      case 'ResourceDiscovery':
        return `Prospectors stumble upon deposits of ${action.resource}`;
      case 'TriggerNaturalEvent':
        return `Nature stirs, and a ${action.eventType} begins to unfold`;
      case 'PromoteArt':
        return `Artistic inspiration flourishes - ${action.artForm} gains new prominence`;
      case 'EncourageResearch':
        return `Scholarly attention turns toward the mysteries of ${action.field}`;
      case 'StrengthenTradition':
        return `The old ways are renewed - ${action.tradition} grows stronger`;
      case 'IntroduceForeignConcept':
        return `New ideas arrive from distant lands - "${action.concept}" spreads through the culture`;
    }
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

  private getActionTarget(action: InfluenceAction): CharacterId | null {
    switch (action.type) {
      case 'InspireIdea':
      case 'PropheticDream':
      case 'PersonalityNudge':
      case 'RevealSecret':
      case 'LuckModifier':
      case 'VisionOfFuture':
      case 'EmpowerChampion':
      case 'EncourageResearch':
        return action.target;
      case 'ArrangeMeeting':
        // Both characters could resist, but we'll just check the first
        return action.character1;
      default:
        return null;
    }
  }

  private getActionLocation(action: InfluenceAction): SiteId | null {
    switch (action.type) {
      case 'AdjustWeather':
      case 'MinorGeology':
      case 'ResourceDiscovery':
      case 'TriggerNaturalEvent':
        return action.location;
      case 'AnimalMigration':
        return action.from; // Use origin as primary location
      default:
        return null;
    }
  }

  private getActionPosition(
    action: InfluenceAction
  ): { x: number; y: number } | null {
    // First try to get character position
    const targetId = this.getActionTarget(action);
    if (targetId !== null) {
      return this.getCharacterPosition(targetId);
    }

    // Then try location
    const locationId = this.getActionLocation(action);
    if (locationId !== null) {
      return this.getSitePosition(locationId);
    }

    return null;
  }

  private getParticipants(action: InfluenceAction): EntityId[] {
    const participants: EntityId[] = [];

    switch (action.type) {
      case 'InspireIdea':
      case 'PropheticDream':
      case 'PersonalityNudge':
      case 'RevealSecret':
      case 'LuckModifier':
      case 'VisionOfFuture':
      case 'EmpowerChampion':
      case 'EncourageResearch':
        participants.push(action.target);
        break;
      case 'ArrangeMeeting':
        participants.push(action.character1, action.character2);
        break;
      case 'AdjustWeather':
      case 'MinorGeology':
      case 'ResourceDiscovery':
      case 'TriggerNaturalEvent':
        participants.push(action.location);
        break;
      case 'AnimalMigration':
        participants.push(action.from, action.to);
        break;
      case 'PromoteArt':
        participants.push(action.culture);
        break;
      case 'StrengthenTradition':
        participants.push(action.faction);
        break;
      case 'IntroduceForeignConcept':
        participants.push(action.target);
        break;
    }

    return participants;
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
