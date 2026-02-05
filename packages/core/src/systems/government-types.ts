/**
 * Government type definitions, decision patterns, and succession rules.
 * Each government type has distinct behavioral characteristics that affect
 * faction decision-making, stability, and leadership transitions.
 */

import type { EntityId, FactionId } from '../ecs/types.js';

// ── Government type enum ────────────────────────────────────────────────────

/**
 * Government structures available to factions.
 * Values match the generator's GovernmentType union for compatibility.
 */
export enum GovernmentType {
  Monarchy = 'monarchy',
  Republic = 'republic',
  Theocracy = 'theocracy',
  TribalConfederation = 'tribal_confederation',
  Oligarchy = 'oligarchy',
  Magocracy = 'magocracy',
}

export const ALL_GOVERNMENT_TYPES: readonly GovernmentType[] =
  Object.values(GovernmentType);

// ── Succession types ────────────────────────────────────────────────────────

export enum SuccessionType {
  Hereditary = 'hereditary',
  Election = 'election',
  DivineSelection = 'divine_selection',
  TrialByCombat = 'trial_by_combat',
  MagicalRitual = 'magical_ritual',
  Coup = 'coup',
}

// ── Government traits ───────────────────────────────────────────────────────

/**
 * Behavioral characteristics of each government type.
 * All values are 0-100 scale.
 */
export interface GovernmentTraits {
  readonly decisionSpeed: number;        // How fast decisions are made
  readonly warlikeness: number;          // Tendency toward military action
  readonly stabilityBase: number;        // Inherent stability level
  readonly successionClarity: number;    // Clear line of succession (reduces crises)
  readonly reformTolerance: number;      // Acceptance of internal change
  readonly corruptionResistance: number; // Resistance to corruption
}

export const GOVERNMENT_TRAITS: Readonly<Record<GovernmentType, GovernmentTraits>> = {
  [GovernmentType.Monarchy]: {
    decisionSpeed: 75,
    warlikeness: 60,
    stabilityBase: 65,
    successionClarity: 50,    // Succession crises common
    reformTolerance: 25,
    corruptionResistance: 35,
  },
  [GovernmentType.Republic]: {
    decisionSpeed: 35,        // Slow deliberation
    warlikeness: 40,
    stabilityBase: 55,
    successionClarity: 80,    // Elections are clear
    reformTolerance: 75,
    corruptionResistance: 50,
  },
  [GovernmentType.Theocracy]: {
    decisionSpeed: 50,
    warlikeness: 55,          // Religious wars
    stabilityBase: 70,        // Faith provides stability
    successionClarity: 60,
    reformTolerance: 20,      // Dogma resists change
    corruptionResistance: 55,
  },
  [GovernmentType.TribalConfederation]: {
    decisionSpeed: 60,
    warlikeness: 65,
    stabilityBase: 45,        // Loose confederation
    successionClarity: 40,
    reformTolerance: 50,
    corruptionResistance: 60, // Communal oversight
  },
  [GovernmentType.Oligarchy]: {
    decisionSpeed: 55,
    warlikeness: 45,
    stabilityBase: 60,
    successionClarity: 65,    // Families endure
    reformTolerance: 35,
    corruptionResistance: 25, // Power concentrates
  },
  [GovernmentType.Magocracy]: {
    decisionSpeed: 45,
    warlikeness: 35,          // Scholarly, not warlike
    stabilityBase: 50,
    successionClarity: 55,
    reformTolerance: 60,      // Innovation welcomed
    corruptionResistance: 45,
  },
};

// ── Succession rules ────────────────────────────────────────────────────────

export interface SuccessionRule {
  readonly type: SuccessionType;
  readonly eligibilityCriteria: readonly string[];
  readonly stabilityImpact: number; // Change to stability during succession (-50 to +10)
  readonly crisisProbability: number; // 0-1, chance of succession crisis
}

export const SUCCESSION_RULES: Readonly<Record<GovernmentType, SuccessionRule>> = {
  [GovernmentType.Monarchy]: {
    type: SuccessionType.Hereditary,
    eligibilityCriteria: ['is_heir', 'has_royal_blood', 'legitimized'],
    stabilityImpact: -15,
    crisisProbability: 0.3,
  },
  [GovernmentType.Republic]: {
    type: SuccessionType.Election,
    eligibilityCriteria: ['is_citizen', 'has_political_standing', 'not_criminal'],
    stabilityImpact: -5,
    crisisProbability: 0.1,
  },
  [GovernmentType.Theocracy]: {
    type: SuccessionType.DivineSelection,
    eligibilityCriteria: ['is_clergy', 'has_divine_favor', 'pious'],
    stabilityImpact: -10,
    crisisProbability: 0.2,
  },
  [GovernmentType.TribalConfederation]: {
    type: SuccessionType.TrialByCombat,
    eligibilityCriteria: ['is_warrior', 'has_tribal_support', 'proven_leader'],
    stabilityImpact: -20,
    crisisProbability: 0.4,
  },
  [GovernmentType.Oligarchy]: {
    type: SuccessionType.Election,
    eligibilityCriteria: ['is_noble', 'has_wealth', 'family_standing'],
    stabilityImpact: -8,
    crisisProbability: 0.15,
  },
  [GovernmentType.Magocracy]: {
    type: SuccessionType.MagicalRitual,
    eligibilityCriteria: ['is_mage', 'has_magical_power', 'arcane_knowledge'],
    stabilityImpact: -12,
    crisisProbability: 0.25,
  },
};

// ── Decision context ────────────────────────────────────────────────────────

export interface DecisionContext {
  readonly factionId: FactionId;
  readonly leaderId: EntityId | null;
  readonly governmentType: GovernmentType;
  readonly stability: number;
  readonly legitimacy: number;
  readonly militaryStrength: number;
  readonly economicWealth: number;
}

// ── Decision modifiers ──────────────────────────────────────────────────────

/**
 * Get decision-making modifiers based on government type.
 * Returns multipliers for different action categories.
 * Values > 1.0 = more likely, < 1.0 = less likely.
 */
export function getGovernmentDecisionModifiers(
  context: DecisionContext,
): Map<string, number> {
  const traits = GOVERNMENT_TRAITS[context.governmentType];
  const modifiers = new Map<string, number>();

  // Base modifiers from government traits
  modifiers.set('diplomacy_weight', (100 - traits.warlikeness) / 100 + 0.5);
  modifiers.set('military_weight', traits.warlikeness / 100 + 0.5);
  modifiers.set('trade_weight', (100 - traits.warlikeness) / 100 + 0.3);
  modifiers.set('reform_weight', traits.reformTolerance / 100);
  modifiers.set('risk_tolerance', traits.decisionSpeed / 100);

  // Stability affects willingness to take action
  const stabilityFactor = context.stability / 100;
  modifiers.set('action_likelihood', 0.3 + stabilityFactor * 0.7);

  // Low legitimacy increases coup/reform likelihood
  if (context.legitimacy < 40) {
    modifiers.set('internal_crisis_risk', 1.5 - context.legitimacy / 100);
  } else {
    modifiers.set('internal_crisis_risk', 0.5);
  }

  // Military strength affects aggressive action likelihood
  if (context.militaryStrength > 70) {
    const current = modifiers.get('military_weight') ?? 1.0;
    modifiers.set('military_weight', current * 1.2);
  }

  return modifiers;
}

/**
 * Check if a government type tends toward a particular decision style.
 */
export function governmentFavors(
  govType: GovernmentType,
  aspect: 'diplomacy' | 'military' | 'trade' | 'reform',
): boolean {
  const traits = GOVERNMENT_TRAITS[govType];
  switch (aspect) {
    case 'diplomacy':
      return traits.warlikeness < 50;
    case 'military':
      return traits.warlikeness >= 50;
    case 'trade':
      return traits.warlikeness < 50 && traits.reformTolerance > 40;
    case 'reform':
      return traits.reformTolerance >= 50;
  }
}
