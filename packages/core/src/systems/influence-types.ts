/**
 * Influence System Types — Player intervention actions and their effects.
 *
 * The Influence System allows players to subtly nudge the world without
 * directly commanding entities. Actions feel like natural world events
 * and map to existing event categories (Personal, Religious, etc.).
 */

import type { CharacterId, EntityId, FactionId, SiteId, EventId } from '../ecs/types.js';

// ════════════════════════════════════════════════════════════════════════════
// INFLUENCE ACTION TYPES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Base properties shared by all influence actions.
 */
interface InfluenceActionBase {
  /** Action type discriminant */
  readonly type: string;
  /** Cost in influence points (may be modified by distance/significance) */
  readonly cost: number;
}

// ── Divine Interventions ────────────────────────────────────────────────────

/**
 * Plant an idea in a character's mind.
 * Must relate to character's skills or interests for believability.
 */
export interface InspireIdeaAction extends InfluenceActionBase {
  readonly type: 'InspireIdea';
  readonly target: CharacterId;
  readonly concept: string;
  readonly cost: 5;
}

/**
 * Send a prophetic dream to a character.
 * Vision content guides their future decisions.
 */
export interface PropheticDreamAction extends InfluenceActionBase {
  readonly type: 'PropheticDream';
  readonly target: CharacterId;
  readonly vision: string;
  readonly cost: 10;
}

/**
 * Arrange circumstances for two characters to meet.
 * Characters must be within 50 tiles of each other.
 */
export interface ArrangeMeetingAction extends InfluenceActionBase {
  readonly type: 'ArrangeMeeting';
  readonly character1: CharacterId;
  readonly character2: CharacterId;
  readonly cost: 15;
}

/**
 * Subtly shift a character's personality trait.
 * Cannot swing more than 15 points at once.
 */
export interface PersonalityNudgeAction extends InfluenceActionBase {
  readonly type: 'PersonalityNudge';
  readonly target: CharacterId;
  readonly trait: string;
  readonly direction: number; // -15 to +15
  readonly cost: 20;
}

/**
 * Allow a secret to come to light for a character.
 * Character must be in position to learn (near a clue).
 */
export interface RevealSecretAction extends InfluenceActionBase {
  readonly type: 'RevealSecret';
  readonly target: CharacterId;
  readonly secretId: EntityId;
  readonly cost: 25;
}

/**
 * Tip the scales of fortune for a character's next action.
 */
export interface LuckModifierAction extends InfluenceActionBase {
  readonly type: 'LuckModifier';
  readonly target: CharacterId;
  readonly actionType: string;
  readonly modifier: number; // -0.3 to +0.3
  readonly cost: 10;
}

/**
 * Grant a character glimpse of possible futures.
 * Shows a specific future event.
 */
export interface VisionOfFutureAction extends InfluenceActionBase {
  readonly type: 'VisionOfFuture';
  readonly target: CharacterId;
  readonly futureEvent: EventId;
  readonly cost: 30;
}

/**
 * Bestow divine favor upon a chosen character.
 * Temporarily boosts their abilities.
 */
export interface EmpowerChampionAction extends InfluenceActionBase {
  readonly type: 'EmpowerChampion';
  readonly target: CharacterId;
  readonly boostAmount: number; // 10-50
  readonly duration: number; // ticks
  readonly cost: 50;
}

// ── Environmental Actions ───────────────────────────────────────────────────

/**
 * Shift weather patterns in a region.
 */
export interface AdjustWeatherAction extends InfluenceActionBase {
  readonly type: 'AdjustWeather';
  readonly location: SiteId;
  readonly change: string;
  readonly cost: 5;
}

/**
 * Cause minor geological activity.
 * Must be geologically plausible for location.
 */
export interface MinorGeologyAction extends InfluenceActionBase {
  readonly type: 'MinorGeology';
  readonly location: SiteId;
  readonly effect: string;
  readonly cost: 15;
}

/**
 * Influence creature movements and migrations.
 */
export interface AnimalMigrationAction extends InfluenceActionBase {
  readonly type: 'AnimalMigration';
  readonly species: string;
  readonly from: SiteId;
  readonly to: SiteId;
  readonly cost: 5;
}

/**
 * Lead characters to discover untapped resources.
 */
export interface ResourceDiscoveryAction extends InfluenceActionBase {
  readonly type: 'ResourceDiscovery';
  readonly location: SiteId;
  readonly resource: string;
  readonly cost: 20;
}

/**
 * Set in motion a natural disaster or phenomenon.
 * Must be geologically plausible for location.
 */
export interface TriggerNaturalEventAction extends InfluenceActionBase {
  readonly type: 'TriggerNaturalEvent';
  readonly eventType: string;
  readonly location: SiteId;
  readonly cost: 30;
}

// ── Cultural Actions ────────────────────────────────────────────────────────

/**
 * Inspire the creation or spread of artistic works.
 */
export interface PromoteArtAction extends InfluenceActionBase {
  readonly type: 'PromoteArt';
  readonly culture: FactionId;
  readonly artForm: string;
  readonly cost: 10;
}

/**
 * Guide scholars toward promising research directions.
 */
export interface EncourageResearchAction extends InfluenceActionBase {
  readonly type: 'EncourageResearch';
  readonly target: CharacterId;
  readonly field: string;
  readonly cost: 15;
}

/**
 * Reinforce cultural practices and traditions.
 */
export interface StrengthenTraditionAction extends InfluenceActionBase {
  readonly type: 'StrengthenTradition';
  readonly faction: FactionId;
  readonly tradition: string;
  readonly cost: 10;
}

/**
 * Expose a culture to ideas from distant lands.
 */
export interface IntroduceForeignConceptAction extends InfluenceActionBase {
  readonly type: 'IntroduceForeignConcept';
  readonly target: FactionId;
  readonly concept: string;
  readonly cost: 20;
}

// ── Union Type ──────────────────────────────────────────────────────────────

/**
 * All possible influence actions.
 */
export type InfluenceAction =
  // Divine Interventions
  | InspireIdeaAction
  | PropheticDreamAction
  | ArrangeMeetingAction
  | PersonalityNudgeAction
  | RevealSecretAction
  | LuckModifierAction
  | VisionOfFutureAction
  | EmpowerChampionAction
  // Environmental
  | AdjustWeatherAction
  | MinorGeologyAction
  | AnimalMigrationAction
  | ResourceDiscoveryAction
  | TriggerNaturalEventAction
  // Cultural
  | PromoteArtAction
  | EncourageResearchAction
  | StrengthenTraditionAction
  | IntroduceForeignConceptAction;

/**
 * Influence action type discriminants.
 */
export type InfluenceActionKind = InfluenceAction['type'];

// ════════════════════════════════════════════════════════════════════════════
// INFLUENCE RESULT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Result of executing an influence action.
 */
export interface InfluenceResult {
  /** Whether the action succeeded */
  readonly success: boolean;
  /** Influence points actually spent (may differ on failure) */
  readonly costPaid: number;
  /** Name/description of what resisted (for character-targeted failures) */
  readonly resistedBy?: string;
  /** Narrative description of what happened */
  readonly narrative: string;
  /** Reason for failure (for implausible actions) */
  readonly failureReason?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// BELIEVABILITY CHECK RESULT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Result of a believability check.
 */
export interface BelievabilityResult {
  /** Whether the action is believable */
  readonly believable: boolean;
  /** Reason if not believable */
  readonly reason?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// RESISTANCE CHECK RESULT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Result of a resistance check for character-targeted actions.
 */
export interface ResistanceResult {
  /** Whether the character resisted */
  readonly resisted: boolean;
  /** Character's resistance score (0-100+) */
  readonly resistanceScore: number;
  /** Probability of success that was rolled against */
  readonly successProbability: number;
  /** Narrative explanation */
  readonly explanation: string;
}

// ════════════════════════════════════════════════════════════════════════════
// INFLUENCE POINT STATE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Current state of the player's influence points.
 */
export interface InfluencePointState {
  /** Current available points */
  readonly current: number;
  /** Maximum points */
  readonly maximum: number;
  /** Base regeneration rate (IP per year) */
  readonly regenerationRate: number;
  /** Current effective regeneration (after modifiers) */
  readonly effectiveRegeneration: number;
  /** World age in ticks */
  readonly worldAge: number;
}

// ════════════════════════════════════════════════════════════════════════════
// ACTION CATEGORY
// ════════════════════════════════════════════════════════════════════════════

/**
 * Categories for grouping influence actions in the UI.
 */
export enum InfluenceCategory {
  Divine = 'Divine',
  Environmental = 'Environmental',
  Cultural = 'Cultural',
}

/**
 * Get the category for an influence action type.
 */
export function getInfluenceCategory(actionType: InfluenceActionKind): InfluenceCategory {
  switch (actionType) {
    case 'InspireIdea':
    case 'PropheticDream':
    case 'ArrangeMeeting':
    case 'PersonalityNudge':
    case 'RevealSecret':
    case 'LuckModifier':
    case 'VisionOfFuture':
    case 'EmpowerChampion':
      return InfluenceCategory.Divine;

    case 'AdjustWeather':
    case 'MinorGeology':
    case 'AnimalMigration':
    case 'ResourceDiscovery':
    case 'TriggerNaturalEvent':
      return InfluenceCategory.Environmental;

    case 'PromoteArt':
    case 'EncourageResearch':
    case 'StrengthenTradition':
    case 'IntroduceForeignConcept':
      return InfluenceCategory.Cultural;
  }
}

/**
 * Get all action types in a category.
 */
export function getActionsInCategory(category: InfluenceCategory): InfluenceActionKind[] {
  switch (category) {
    case InfluenceCategory.Divine:
      return [
        'InspireIdea',
        'PropheticDream',
        'ArrangeMeeting',
        'PersonalityNudge',
        'RevealSecret',
        'LuckModifier',
        'VisionOfFuture',
        'EmpowerChampion',
      ];
    case InfluenceCategory.Environmental:
      return [
        'AdjustWeather',
        'MinorGeology',
        'AnimalMigration',
        'ResourceDiscovery',
        'TriggerNaturalEvent',
      ];
    case InfluenceCategory.Cultural:
      return [
        'PromoteArt',
        'EncourageResearch',
        'StrengthenTradition',
        'IntroduceForeignConcept',
      ];
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ACTION METADATA
// ════════════════════════════════════════════════════════════════════════════

/**
 * Metadata for displaying influence actions in the UI.
 */
export interface InfluenceActionMeta {
  readonly type: InfluenceActionKind;
  readonly name: string;
  readonly description: string;
  readonly baseCost: number;
  readonly category: InfluenceCategory;
  readonly requiresTarget: 'character' | 'location' | 'faction' | 'dual-character' | 'dual-location' | 'none';
}

/**
 * All influence action metadata for UI display.
 */
export const INFLUENCE_ACTION_META: readonly InfluenceActionMeta[] = [
  // Divine
  {
    type: 'InspireIdea',
    name: 'Inspire Idea',
    description: 'Plant a seed of inspiration in a character\'s mind',
    baseCost: 5,
    category: InfluenceCategory.Divine,
    requiresTarget: 'character',
  },
  {
    type: 'PropheticDream',
    name: 'Prophetic Dream',
    description: 'Send a vision or dream to a character',
    baseCost: 10,
    category: InfluenceCategory.Divine,
    requiresTarget: 'character',
  },
  {
    type: 'ArrangeMeeting',
    name: 'Arrange Meeting',
    description: 'Create circumstances for two characters to meet',
    baseCost: 15,
    category: InfluenceCategory.Divine,
    requiresTarget: 'dual-character',
  },
  {
    type: 'PersonalityNudge',
    name: 'Personality Nudge',
    description: 'Subtly shift a character\'s personality trait',
    baseCost: 20,
    category: InfluenceCategory.Divine,
    requiresTarget: 'character',
  },
  {
    type: 'RevealSecret',
    name: 'Reveal Secret',
    description: 'Allow a secret to come to light',
    baseCost: 25,
    category: InfluenceCategory.Divine,
    requiresTarget: 'character',
  },
  {
    type: 'LuckModifier',
    name: 'Luck Modifier',
    description: 'Tip the scales of fortune for a character',
    baseCost: 10,
    category: InfluenceCategory.Divine,
    requiresTarget: 'character',
  },
  {
    type: 'VisionOfFuture',
    name: 'Vision of Future',
    description: 'Grant a glimpse of possible futures',
    baseCost: 30,
    category: InfluenceCategory.Divine,
    requiresTarget: 'character',
  },
  {
    type: 'EmpowerChampion',
    name: 'Empower Champion',
    description: 'Bestow divine favor upon a chosen character',
    baseCost: 50,
    category: InfluenceCategory.Divine,
    requiresTarget: 'character',
  },
  // Environmental
  {
    type: 'AdjustWeather',
    name: 'Adjust Weather',
    description: 'Shift weather patterns in a region',
    baseCost: 5,
    category: InfluenceCategory.Environmental,
    requiresTarget: 'location',
  },
  {
    type: 'MinorGeology',
    name: 'Minor Geology',
    description: 'Cause minor geological activity',
    baseCost: 15,
    category: InfluenceCategory.Environmental,
    requiresTarget: 'location',
  },
  {
    type: 'AnimalMigration',
    name: 'Animal Migration',
    description: 'Influence creature movements',
    baseCost: 5,
    category: InfluenceCategory.Environmental,
    requiresTarget: 'dual-location',
  },
  {
    type: 'ResourceDiscovery',
    name: 'Resource Discovery',
    description: 'Lead characters to discover resources',
    baseCost: 20,
    category: InfluenceCategory.Environmental,
    requiresTarget: 'location',
  },
  {
    type: 'TriggerNaturalEvent',
    name: 'Trigger Natural Event',
    description: 'Set in motion a natural phenomenon',
    baseCost: 30,
    category: InfluenceCategory.Environmental,
    requiresTarget: 'location',
  },
  // Cultural
  {
    type: 'PromoteArt',
    name: 'Promote Art',
    description: 'Inspire artistic creation or spread',
    baseCost: 10,
    category: InfluenceCategory.Cultural,
    requiresTarget: 'faction',
  },
  {
    type: 'EncourageResearch',
    name: 'Encourage Research',
    description: 'Guide scholars toward discoveries',
    baseCost: 15,
    category: InfluenceCategory.Cultural,
    requiresTarget: 'character',
  },
  {
    type: 'StrengthenTradition',
    name: 'Strengthen Tradition',
    description: 'Reinforce cultural practices',
    baseCost: 10,
    category: InfluenceCategory.Cultural,
    requiresTarget: 'faction',
  },
  {
    type: 'IntroduceForeignConcept',
    name: 'Introduce Foreign Concept',
    description: 'Expose a culture to new ideas',
    baseCost: 20,
    category: InfluenceCategory.Cultural,
    requiresTarget: 'faction',
  },
];

/**
 * Get metadata for an action type.
 */
export function getActionMeta(actionType: InfluenceActionKind): InfluenceActionMeta | undefined {
  return INFLUENCE_ACTION_META.find((meta) => meta.type === actionType);
}
