/**
 * Influence Event Mapping — Maps player influence actions to existing domain categories.
 *
 * Design Philosophy: Player interventions must feel natural, not forced.
 * Rather than adding a new EventCategory.Influence, influence actions
 * produce events in existing domains (Personal, Religious, Ecological, etc.)
 * This allows influence effects to cascade naturally through existing systems.
 */

import { EventCategory } from '../events/types.js';
import type { World } from '../ecs/world.js';
import type { EntityId, CharacterId, SiteId } from '../ecs/types.js';
import type {
  InfluenceAction,
  BelievabilityResult,
} from './influence-types.js';
import type { PositionComponent } from '../ecs/component.js';
import { PersonalityTrait } from './personality-traits.js';

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/** Maximum distance for ArrangeMeeting action */
const MAX_MEETING_DISTANCE = 50;

/** Maximum personality nudge swing */
const MAX_NUDGE_SWING = 15;

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get the position of a character from the world.
 */
function getCharacterPosition(
  world: World,
  characterId: CharacterId
): { x: number; y: number } | null {
  const pos = world.getComponent<PositionComponent>(characterId, 'Position');
  if (pos === undefined) return null;
  return { x: pos.x, y: pos.y };
}

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
 * Defines both metadata and behavior for each action.
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

  // ── Function-valued properties (replaces switch statements) ──────────────

  /**
   * Extract participant entity IDs from an action.
   * Used to populate the event's participants array.
   */
  readonly extractParticipants: (action: InfluenceAction) => EntityId[];

  /**
   * Extract the primary location from an action (if applicable).
   * Used to populate the event's location field.
   */
  readonly extractLocation: (action: InfluenceAction) => SiteId | null;

  /**
   * Extract the primary character target from an action (if applicable).
   * Used for resistance checks on character-targeted actions.
   */
  readonly extractTarget: (action: InfluenceAction) => CharacterId | null;

  /**
   * Build the event data payload for this action.
   * Used to populate the event's data field.
   */
  readonly buildEventData: (action: InfluenceAction) => Record<string, unknown>;

  /**
   * Build the narrative description for this action's effect.
   * Used to generate the player-facing result message.
   */
  readonly buildNarrative: (action: InfluenceAction) => string;

  /**
   * Check if this action is believable given the world state.
   * Optional - if not provided, action is assumed to be always believable.
   */
  readonly believabilityCheck?: (action: InfluenceAction, world: World) => BelievabilityResult;
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
    extractParticipants: (action) => {
      if (action.type !== 'InspireIdea') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'InspireIdea') return null;
      return action.target;
    },
    buildEventData: (action) => {
      if (action.type !== 'InspireIdea') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        concept: action.concept,
        target: action.target,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'InspireIdea') return '';
      return `A moment of inspiration strikes - the concept of "${action.concept}" takes root`;
    },
    believabilityCheck: (action, _world) => {
      if (action.type !== 'InspireIdea') return { believable: true };
      if (action.concept.trim().length === 0) {
        return { believable: false, reason: 'Concept cannot be empty' };
      }
      return { believable: true };
    },
  },

  [InfluenceActionType.ArrangeMeeting]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.arrange_meeting',
    significanceRange: [15, 40],
    baseCost: 15,
    cooldownTicks: 3,
    description: 'Create circumstances for two characters to cross paths',
    extractParticipants: (action) => {
      if (action.type !== 'ArrangeMeeting') return [];
      return [action.character1, action.character2];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'ArrangeMeeting') return null;
      return action.character1;
    },
    buildEventData: (action) => {
      if (action.type !== 'ArrangeMeeting') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        character1: action.character1,
        character2: action.character2,
      };
    },
    buildNarrative: () => {
      return 'Fate conspires to bring two souls together in an unexpected encounter';
    },
    believabilityCheck: (action, world) => {
      if (action.type !== 'ArrangeMeeting') return { believable: true };
      const pos1 = getCharacterPosition(world, action.character1);
      const pos2 = getCharacterPosition(world, action.character2);
      if (pos1 === null || pos2 === null) {
        return { believable: false, reason: 'Cannot determine character positions' };
      }
      const distance = Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
      if (distance > MAX_MEETING_DISTANCE) {
        return {
          believable: false,
          reason: `Characters are too far apart (${Math.round(distance)} tiles, max ${MAX_MEETING_DISTANCE})`,
        };
      }
      return { believable: true };
    },
  },

  [InfluenceActionType.PersonalityNudge]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.personality_nudge',
    significanceRange: [10, 30],
    baseCost: 20,
    cooldownTicks: 30,
    description: 'Subtly shift a character\'s personality trait over time',
    extractParticipants: (action) => {
      if (action.type !== 'PersonalityNudge') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'PersonalityNudge') return null;
      return action.target;
    },
    buildEventData: (action) => {
      if (action.type !== 'PersonalityNudge') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        trait: action.trait,
        direction: action.direction,
        target: action.target,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'PersonalityNudge') return '';
      return `A subtle shift occurs in temperament, ${action.direction > 0 ? 'strengthening' : 'weakening'} ${action.trait}`;
    },
    believabilityCheck: (action, _world) => {
      if (action.type !== 'PersonalityNudge') return { believable: true };
      if (Math.abs(action.direction) > MAX_NUDGE_SWING) {
        return {
          believable: false,
          reason: `Cannot nudge personality more than ${MAX_NUDGE_SWING} points at once (requested ${Math.abs(action.direction)})`,
        };
      }
      const validTraits = Object.values(PersonalityTrait) as string[];
      if (!validTraits.includes(action.trait)) {
        return { believable: false, reason: `Unknown personality trait: ${action.trait}` };
      }
      return { believable: true };
    },
  },

  [InfluenceActionType.RevealSecret]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.reveal_secret',
    significanceRange: [40, 80],
    baseCost: 25,
    cooldownTicks: 14,
    description: 'Allow a secret to come to light',
    extractParticipants: (action) => {
      if (action.type !== 'RevealSecret') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'RevealSecret') return null;
      return action.target;
    },
    buildEventData: (action) => {
      if (action.type !== 'RevealSecret') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        secretId: action.secretId,
        target: action.target,
      };
    },
    buildNarrative: () => {
      return 'Hidden knowledge begins to surface, bringing long-buried truths to light';
    },
    believabilityCheck: (action, _world) => {
      if (action.type !== 'RevealSecret') return { believable: true };
      if ((action.secretId as number) < 0) {
        return { believable: false, reason: 'Invalid secret reference' };
      }
      return { believable: true };
    },
  },

  [InfluenceActionType.LuckModifier]: {
    category: EventCategory.Personal,
    subtypePrefix: 'influence.luck_modifier',
    significanceRange: [5, 25],
    baseCost: 5,
    cooldownTicks: 1,
    description: 'Tip the scales of fortune for a character\'s next action',
    extractParticipants: (action) => {
      if (action.type !== 'LuckModifier') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'LuckModifier') return null;
      return action.target;
    },
    buildEventData: (action) => {
      if (action.type !== 'LuckModifier') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        actionTypeModified: action.actionType,
        modifier: action.modifier,
        target: action.target,
      };
    },
    buildNarrative: () => {
      return 'Fortune\'s wheel turns slightly, altering the odds of what is to come';
    },
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
    extractParticipants: (action) => {
      if (action.type !== 'PropheticDream') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'PropheticDream') return null;
      return action.target;
    },
    buildEventData: (action) => {
      if (action.type !== 'PropheticDream') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        vision: action.vision,
        target: action.target,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'PropheticDream') return '';
      return `A prophetic dream visits the sleeper, showing visions of "${action.vision}"`;
    },
  },

  [InfluenceActionType.VisionOfFuture]: {
    category: EventCategory.Religious,
    subtypePrefix: 'influence.vision_of_future',
    significanceRange: [50, 90],
    baseCost: 40,
    cooldownTicks: 90,
    description: 'Grant a character glimpse of possible futures',
    extractParticipants: (action) => {
      if (action.type !== 'VisionOfFuture') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'VisionOfFuture') return null;
      return action.target;
    },
    buildEventData: (action) => {
      if (action.type !== 'VisionOfFuture') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        futureEvent: action.futureEvent,
        target: action.target,
      };
    },
    buildNarrative: () => {
      return 'The mists of time part briefly, revealing a glimpse of what may yet be';
    },
  },

  [InfluenceActionType.EmpowerChampion]: {
    category: EventCategory.Religious,
    subtypePrefix: 'influence.empower_champion',
    significanceRange: [60, 95],
    baseCost: 50,
    cooldownTicks: 180,
    description: 'Bestow divine favor upon a chosen character',
    extractParticipants: (action) => {
      if (action.type !== 'EmpowerChampion') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'EmpowerChampion') return null;
      return action.target;
    },
    buildEventData: (action) => {
      if (action.type !== 'EmpowerChampion') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        boostAmount: action.boostAmount,
        duration: action.duration,
        target: action.target,
      };
    },
    buildNarrative: () => {
      return 'Divine favor settles upon the chosen one, granting temporary blessings';
    },
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
    extractParticipants: (action) => {
      if (action.type !== 'AdjustWeather') return [];
      return [action.location];
    },
    extractLocation: (action) => {
      if (action.type !== 'AdjustWeather') return null;
      return action.location;
    },
    extractTarget: () => null,
    buildEventData: (action) => {
      if (action.type !== 'AdjustWeather') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        change: action.change,
        location: action.location,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'AdjustWeather') return '';
      return `The winds shift and weather patterns change - ${action.change}`;
    },
  },

  [InfluenceActionType.MinorGeology]: {
    category: EventCategory.Disaster,
    subtypePrefix: 'influence.minor_geology',
    significanceRange: [30, 60],
    baseCost: 30,
    cooldownTicks: 60,
    description: 'Cause minor geological activity (tremor, spring)',
    extractParticipants: (action) => {
      if (action.type !== 'MinorGeology') return [];
      return [action.location];
    },
    extractLocation: (action) => {
      if (action.type !== 'MinorGeology') return null;
      return action.location;
    },
    extractTarget: () => null,
    buildEventData: (action) => {
      if (action.type !== 'MinorGeology') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        effect: action.effect,
        location: action.location,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'MinorGeology') return '';
      return `The earth stirs with subtle movement - ${action.effect}`;
    },
    believabilityCheck: (action, _world) => {
      if (action.type !== 'MinorGeology') return { believable: true };
      if (action.effect.trim().length === 0) {
        return { believable: false, reason: 'Geological effect cannot be empty' };
      }
      return { believable: true };
    },
  },

  [InfluenceActionType.AnimalMigration]: {
    category: EventCategory.Disaster,
    subtypePrefix: 'influence.animal_migration',
    significanceRange: [15, 35],
    baseCost: 10,
    cooldownTicks: 14,
    description: 'Influence creature movements and migrations',
    extractParticipants: (action) => {
      if (action.type !== 'AnimalMigration') return [];
      return [action.from, action.to];
    },
    extractLocation: (action) => {
      if (action.type !== 'AnimalMigration') return null;
      return action.from; // Use origin as primary location
    },
    extractTarget: () => null,
    buildEventData: (action) => {
      if (action.type !== 'AnimalMigration') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        species: action.species,
        from: action.from,
        to: action.to,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'AnimalMigration') return '';
      return `The ${action.species} begin an unexpected migration`;
    },
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
    extractParticipants: (action) => {
      if (action.type !== 'ResourceDiscovery') return [];
      return [action.location];
    },
    extractLocation: (action) => {
      if (action.type !== 'ResourceDiscovery') return null;
      return action.location;
    },
    extractTarget: () => null,
    buildEventData: (action) => {
      if (action.type !== 'ResourceDiscovery') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        resource: action.resource,
        location: action.location,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'ResourceDiscovery') return '';
      return `Prospectors stumble upon deposits of ${action.resource}`;
    },
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
    extractParticipants: (action) => {
      if (action.type !== 'TriggerNaturalEvent') return [];
      return [action.location];
    },
    extractLocation: (action) => {
      if (action.type !== 'TriggerNaturalEvent') return null;
      return action.location;
    },
    extractTarget: () => null,
    buildEventData: (action) => {
      if (action.type !== 'TriggerNaturalEvent') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        eventType: action.eventType,
        location: action.location,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'TriggerNaturalEvent') return '';
      return `Nature stirs, and a ${action.eventType} begins to unfold`;
    },
    believabilityCheck: (action, _world) => {
      if (action.type !== 'TriggerNaturalEvent') return { believable: true };
      if (action.eventType.trim().length === 0) {
        return { believable: false, reason: 'Event type cannot be empty' };
      }
      return { believable: true };
    },
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
    extractParticipants: (action) => {
      if (action.type !== 'PromoteArt') return [];
      return [action.culture];
    },
    extractLocation: () => null,
    extractTarget: () => null,
    buildEventData: (action) => {
      if (action.type !== 'PromoteArt') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        artForm: action.artForm,
        culture: action.culture,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'PromoteArt') return '';
      return `Artistic inspiration flourishes - ${action.artForm} gains new prominence`;
    },
  },

  [InfluenceActionType.StrengthenTradition]: {
    category: EventCategory.Cultural,
    subtypePrefix: 'influence.strengthen_tradition',
    significanceRange: [25, 50],
    baseCost: 20,
    cooldownTicks: 30,
    description: 'Reinforce cultural practices and traditions',
    extractParticipants: (action) => {
      if (action.type !== 'StrengthenTradition') return [];
      return [action.faction];
    },
    extractLocation: () => null,
    extractTarget: () => null,
    buildEventData: (action) => {
      if (action.type !== 'StrengthenTradition') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        tradition: action.tradition,
        faction: action.faction,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'StrengthenTradition') return '';
      return `The old ways are renewed - ${action.tradition} grows stronger`;
    },
  },

  [InfluenceActionType.IntroduceForeignConcept]: {
    category: EventCategory.Cultural,
    subtypePrefix: 'influence.introduce_foreign_concept',
    significanceRange: [35, 65],
    baseCost: 25,
    cooldownTicks: 30,
    description: 'Expose a culture to ideas from distant lands',
    extractParticipants: (action) => {
      if (action.type !== 'IntroduceForeignConcept') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: () => null,
    buildEventData: (action) => {
      if (action.type !== 'IntroduceForeignConcept') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        concept: action.concept,
        target: action.target,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'IntroduceForeignConcept') return '';
      return `New ideas arrive from distant lands - "${action.concept}" spreads through the culture`;
    },
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
    extractParticipants: (action) => {
      if (action.type !== 'EncourageResearch') return [];
      return [action.target];
    },
    extractLocation: () => null,
    extractTarget: (action) => {
      if (action.type !== 'EncourageResearch') return null;
      return action.target;
    },
    buildEventData: (action) => {
      if (action.type !== 'EncourageResearch') return {};
      return {
        actionType: action.type,
        influenceCost: action.cost,
        field: action.field,
        target: action.target,
      };
    },
    buildNarrative: (action) => {
      if (action.type !== 'EncourageResearch') return '';
      return `Scholarly attention turns toward the mysteries of ${action.field}`;
    },
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
