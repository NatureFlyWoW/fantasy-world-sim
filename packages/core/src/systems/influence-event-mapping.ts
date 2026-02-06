/**
 * Influence Event Mapping — Maps player influence actions to existing domain categories.
 *
 * Design Philosophy: Player interventions must feel natural, not forced.
 * Rather than adding a new EventCategory.Influence, influence actions
 * produce events in existing domains (Personal, Religious, Ecological, etc.)
 * This allows influence effects to cascade naturally through existing systems.
 */

import { EventCategory } from '../events/types.js';

/**
 * Influence action types available to the player.
 * Each maps to an existing EventCategory for seamless integration.
 */
export enum InfluenceActionType {
  // Personal domain actions
  InspireIdea = 'InspireIdea',
  ArrangeMeeting = 'ArrangeMeeting',
  PersonalityNudge = 'PersonalityNudge',
  RevealSecret = 'RevealSecret',
  LuckModifier = 'LuckModifier',

  // Religious domain actions
  PropheticDream = 'PropheticDream',
  VisionOfFuture = 'VisionOfFuture',
  EmpowerChampion = 'EmpowerChampion',

  // Ecological domain actions (mapped to Disaster for environmental effects)
  AdjustWeather = 'AdjustWeather',
  MinorGeology = 'MinorGeology',
  AnimalMigration = 'AnimalMigration',

  // Economic domain actions
  ResourceDiscovery = 'ResourceDiscovery',

  // Disaster domain actions
  TriggerNaturalEvent = 'TriggerNaturalEvent',

  // Cultural domain actions
  PromoteArt = 'PromoteArt',
  StrengthenTradition = 'StrengthenTradition',
  IntroduceForeignConcept = 'IntroduceForeignConcept',

  // Scientific domain actions
  EncourageResearch = 'EncourageResearch',
}

/**
 * Configuration for an influence action type.
 */
export interface InfluenceActionConfig {
  /** The domain category this action produces events in */
  readonly category: EventCategory;
  /** Event subtype prefix for this action */
  readonly subtypePrefix: string;
  /** Base significance range [min, max] */
  readonly significanceRange: readonly [number, number];
  /** Base influence cost (resource spent by player) */
  readonly baseCost: number;
  /** Cooldown in ticks before this action can be used again */
  readonly cooldownTicks: number;
  /** Human-readable description */
  readonly description: string;
}

/**
 * Mapping from influence action types to their configurations.
 * Uses existing EventCategory values to integrate naturally with simulation.
 */
export const INFLUENCE_ACTION_CONFIGS: Readonly<Record<InfluenceActionType, InfluenceActionConfig>> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONAL DOMAIN — Subtle nudges to individual characters
  // ═══════════════════════════════════════════════════════════════════════════

  [InfluenceActionType.InspireIdea]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.inspire_idea',
    significanceRange: [20, 50],
    baseCost: 10,
    cooldownTicks: 7,
    description: 'Plant a seed of inspiration in a character\'s mind',
  },

  [InfluenceActionType.ArrangeMeeting]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.arrange_meeting',
    significanceRange: [15, 40],
    baseCost: 15,
    cooldownTicks: 3,
    description: 'Create circumstances for two characters to cross paths',
  },

  [InfluenceActionType.PersonalityNudge]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.personality_nudge',
    significanceRange: [10, 30],
    baseCost: 20,
    cooldownTicks: 30,
    description: 'Subtly shift a character\'s personality trait over time',
  },

  [InfluenceActionType.RevealSecret]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.reveal_secret',
    significanceRange: [40, 80],
    baseCost: 25,
    cooldownTicks: 14,
    description: 'Allow a secret to come to light',
  },

  [InfluenceActionType.LuckModifier]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.luck_modifier',
    significanceRange: [5, 25],
    baseCost: 5,
    cooldownTicks: 1,
    description: 'Tip the scales of fortune for a character\'s next action',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RELIGIOUS DOMAIN — Divine/supernatural interventions
  // ═══════════════════════════════════════════════════════════════════════════

  [InfluenceActionType.PropheticDream]: {
    category: EventCategory.Religious,
    subtypePrefix: 'influence.prophetic_dream',
    significanceRange: [30, 60],
    baseCost: 20,
    cooldownTicks: 30,
    description: 'Send a vision or dream to a character',
  },

  [InfluenceActionType.VisionOfFuture]: {
    category: EventCategory.Religious,
    subtypePrefix: 'influence.vision_of_future',
    significanceRange: [50, 90],
    baseCost: 40,
    cooldownTicks: 90,
    description: 'Grant a character glimpse of possible futures',
  },

  [InfluenceActionType.EmpowerChampion]: {
    category: EventCategory.Religious,
    subtypePrefix: 'influence.empower_champion',
    significanceRange: [60, 95],
    baseCost: 50,
    cooldownTicks: 180,
    description: 'Bestow divine favor upon a chosen character',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ECOLOGICAL DOMAIN — Environmental adjustments (via Disaster category)
  // ═══════════════════════════════════════════════════════════════════════════

  [InfluenceActionType.AdjustWeather]: {
    category: EventCategory.Disaster,
    subtypePrefix: 'influence.adjust_weather',
    significanceRange: [20, 50],
    baseCost: 15,
    cooldownTicks: 7,
    description: 'Shift weather patterns in a region',
  },

  [InfluenceActionType.MinorGeology]: {
    category: EventCategory.Disaster,
    subtypePrefix: 'influence.minor_geology',
    significanceRange: [30, 60],
    baseCost: 30,
    cooldownTicks: 60,
    description: 'Cause minor geological activity (tremor, spring)',
  },

  [InfluenceActionType.AnimalMigration]: {
    category: EventCategory.Disaster,
    subtypePrefix: 'influence.animal_migration',
    significanceRange: [15, 35],
    baseCost: 10,
    cooldownTicks: 14,
    description: 'Influence creature movements and migrations',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ECONOMIC DOMAIN — Resource and trade influences
  // ═══════════════════════════════════════════════════════════════════════════

  [InfluenceActionType.ResourceDiscovery]: {
    category: EventCategory.Economic,
    subtypePrefix: 'influence.resource_discovery',
    significanceRange: [40, 70],
    baseCost: 35,
    cooldownTicks: 60,
    description: 'Lead characters to discover untapped resources',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DISASTER DOMAIN — Major environmental events
  // ═══════════════════════════════════════════════════════════════════════════

  [InfluenceActionType.TriggerNaturalEvent]: {
    category: EventCategory.Disaster,
    subtypePrefix: 'influence.trigger_natural_event',
    significanceRange: [50, 90],
    baseCost: 45,
    cooldownTicks: 90,
    description: 'Set in motion a natural disaster or phenomenon',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CULTURAL DOMAIN — Art, tradition, and ideas
  // ═══════════════════════════════════════════════════════════════════════════

  [InfluenceActionType.PromoteArt]: {
    category: EventCategory.Cultural,
    subtypePrefix: 'influence.promote_art',
    significanceRange: [20, 45],
    baseCost: 15,
    cooldownTicks: 14,
    description: 'Inspire the creation or spread of artistic works',
  },

  [InfluenceActionType.StrengthenTradition]: {
    category: EventCategory.Cultural,
    subtypePrefix: 'influence.strengthen_tradition',
    significanceRange: [25, 50],
    baseCost: 20,
    cooldownTicks: 30,
    description: 'Reinforce cultural practices and traditions',
  },

  [InfluenceActionType.IntroduceForeignConcept]: {
    category: EventCategory.Cultural,
    subtypePrefix: 'influence.introduce_foreign_concept',
    significanceRange: [35, 65],
    baseCost: 25,
    cooldownTicks: 30,
    description: 'Expose a culture to ideas from distant lands',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCIENTIFIC DOMAIN — Knowledge and research
  // ═══════════════════════════════════════════════════════════════════════════

  [InfluenceActionType.EncourageResearch]: {
    category: EventCategory.Scientific,
    subtypePrefix: 'influence.encourage_research',
    significanceRange: [30, 55],
    baseCost: 20,
    cooldownTicks: 14,
    description: 'Guide scholars toward promising research directions',
  },
};

/**
 * Get the configuration for an influence action.
 */
export function getInfluenceActionConfig(actionType: InfluenceActionType): InfluenceActionConfig {
  return INFLUENCE_ACTION_CONFIGS[actionType];
}

/**
 * Get all influence actions that produce events in a given category.
 */
export function getInfluenceActionsByCategory(category: EventCategory): InfluenceActionType[] {
  return Object.entries(INFLUENCE_ACTION_CONFIGS)
    .filter(([, config]) => config.category === category)
    .map(([actionType]) => actionType as InfluenceActionType);
}

/**
 * Calculate influence cost with modifiers.
 */
export function calculateInfluenceCost(
  actionType: InfluenceActionType,
  targetSignificance: number,
  distanceFromFocus: number
): number {
  const config = INFLUENCE_ACTION_CONFIGS[actionType];
  const [minSig, maxSig] = config.significanceRange;

  // Higher significance = higher cost
  const sigRatio = (targetSignificance - minSig) / (maxSig - minSig);
  const sigMultiplier = 1 + sigRatio * 0.5; // 1.0 to 1.5x

  // Distance from focus point increases cost
  const distanceMultiplier = 1 + distanceFromFocus * 0.01; // +1% per tile

  return Math.ceil(config.baseCost * sigMultiplier * distanceMultiplier);
}

/**
 * Check if an influence action is on cooldown.
 */
export function isOnCooldown(
  actionType: InfluenceActionType,
  lastUsedTick: number,
  currentTick: number
): boolean {
  const config = INFLUENCE_ACTION_CONFIGS[actionType];
  return currentTick - lastUsedTick < config.cooldownTicks;
}

/**
 * Get remaining cooldown ticks.
 */
export function getRemainingCooldown(
  actionType: InfluenceActionType,
  lastUsedTick: number,
  currentTick: number
): number {
  const config = INFLUENCE_ACTION_CONFIGS[actionType];
  const elapsed = currentTick - lastUsedTick;
  return Math.max(0, config.cooldownTicks - elapsed);
}
