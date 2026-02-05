/**
 * Action system types for the Character AI.
 * Actions are context-dependent things a character can do on a given tick.
 */

import type { EntityId } from '../ecs/types.js';
import { PersonalityTrait } from './personality-traits.js';
import type { TraitActionWeight } from './personality-traits.js';
import { GoalPriority } from './goal-types.js';

// ── Action categories ───────────────────────────────────────────────────────

export enum ActionCategory {
  Diplomatic = 'diplomatic',
  MilitaryCommand = 'military_command',
  ScholarlyResearch = 'scholarly_research',
  Crafting = 'crafting',
  Social = 'social',
  Travel = 'travel',
  Economic = 'economic',
  Religious = 'religious',
  Magical = 'magical',
  Survival = 'survival',
}

// ── Character action ────────────────────────────────────────────────────────

export interface CharacterAction {
  readonly id: number;
  readonly category: ActionCategory;
  readonly name: string;
  readonly description: string;
  /** Which goals this action could advance */
  readonly goalRelevance: readonly GoalPriority[];
  /** Personality trait weights for scoring alignment */
  readonly traitWeights: readonly TraitActionWeight[];
  /** Skill used to determine outcome probability */
  readonly primarySkill: string;
  /** Base success probability before skill modifiers (0.0–1.0) */
  readonly baseSuccessRate: number;
  /** Risk level 0.0 (safe) to 1.0 (deadly) */
  readonly riskLevel: number;
  /** Cultural conformity factor: positive if culturally accepted */
  readonly culturalConformity: number;
  /** Target entity, if any */
  readonly targetId?: EntityId;
}

// ── Action outcome ──────────────────────────────────────────────────────────

export enum OutcomeType {
  Success = 'success',
  PartialSuccess = 'partial_success',
  Failure = 'failure',
  CriticalSuccess = 'critical_success',
  CriticalFailure = 'critical_failure',
}

export interface ActionOutcome {
  readonly action: CharacterAction;
  readonly outcome: OutcomeType;
  readonly effectDescription: string;
  /** Significance for event generation (0–100) */
  readonly significance: number;
}

// ── Action score breakdown ──────────────────────────────────────────────────

/**
 * Detailed score breakdown from the scoring formula.
 * Useful for debugging and explaining AI decisions.
 */
export interface ActionScore {
  readonly action: CharacterAction;
  readonly personalityAlignment: number;  // 0.0–1.0, weighted 0.30
  readonly goalAdvancement: number;       // 0.0–1.0, weighted 0.30
  readonly relationshipImpact: number;    // 0.0–1.0, weighted 0.15
  readonly riskAssessment: number;        // 0.0–1.0, weighted 0.10
  readonly opportunityValue: number;      // 0.0–1.0, weighted 0.10
  readonly culturalConformity: number;    // 0.0–1.0, weighted 0.05
  readonly randomFactor: number;          // 0.0–1.0, weighted by impulsiveness
  readonly totalScore: number;
}

// ── Action templates ────────────────────────────────────────────────────────

/**
 * Pre-defined action templates for each category.
 * The ActionGenerator picks from these based on context.
 */
export interface ActionTemplate {
  readonly category: ActionCategory;
  readonly name: string;
  readonly description: string;
  readonly traitWeights: readonly TraitActionWeight[];
  readonly primarySkill: string;
  readonly baseSuccessRate: number;
  readonly riskLevel: number;
  readonly culturalConformity: number;
  readonly goalRelevance: readonly GoalPriority[];
  /** Status types that can use this action (undefined = any) */
  readonly requiredStatus?: readonly string[];
  /** Context required (e.g. 'in_settlement', 'at_court', 'in_wilderness') */
  readonly requiredContext?: readonly string[];
}

// ── Standard action templates ───────────────────────────────────────────────

export const ACTION_TEMPLATES: readonly ActionTemplate[] = [
  // Diplomatic
  {
    category: ActionCategory.Diplomatic,
    name: 'negotiate_treaty',
    description: 'Negotiate a treaty with another faction',
    traitWeights: [
      { trait: PersonalityTrait.Patient, weight: 0.6 },
      { trait: PersonalityTrait.Empathetic, weight: 0.4 },
      { trait: PersonalityTrait.Pragmatic, weight: 0.3 },
    ],
    primarySkill: 'diplomacy',
    baseSuccessRate: 0.5,
    riskLevel: 0.1,
    culturalConformity: 0.8,
    goalRelevance: [GoalPriority.Secondary, GoalPriority.PrimaryLife],
    requiredStatus: ['ruler', 'noble', 'advisor'],
  },
  {
    category: ActionCategory.Diplomatic,
    name: 'forge_alliance',
    description: 'Propose a formal alliance with a neighboring faction',
    traitWeights: [
      { trait: PersonalityTrait.Loyal, weight: 0.5 },
      { trait: PersonalityTrait.Pragmatic, weight: 0.4 },
      { trait: PersonalityTrait.Ambitious, weight: 0.3 },
    ],
    primarySkill: 'diplomacy',
    baseSuccessRate: 0.4,
    riskLevel: 0.1,
    culturalConformity: 0.7,
    goalRelevance: [GoalPriority.Secondary, GoalPriority.PrimaryLife],
    requiredStatus: ['ruler', 'noble', 'advisor'],
  },
  // Military command
  {
    category: ActionCategory.MilitaryCommand,
    name: 'rally_troops',
    description: 'Inspire and rally military forces',
    traitWeights: [
      { trait: PersonalityTrait.Brave, weight: 0.7 },
      { trait: PersonalityTrait.Ambitious, weight: 0.4 },
      { trait: PersonalityTrait.Loyal, weight: 0.3 },
    ],
    primarySkill: 'leadership',
    baseSuccessRate: 0.6,
    riskLevel: 0.3,
    culturalConformity: 0.8,
    goalRelevance: [GoalPriority.Secondary, GoalPriority.PrimaryLife],
    requiredStatus: ['ruler', 'general'],
  },
  {
    category: ActionCategory.MilitaryCommand,
    name: 'plan_campaign',
    description: 'Plan a military campaign against a rival',
    traitWeights: [
      { trait: PersonalityTrait.Ambitious, weight: 0.6 },
      { trait: PersonalityTrait.Brave, weight: 0.5 },
      { trait: PersonalityTrait.Pragmatic, weight: 0.4 },
      { trait: PersonalityTrait.Cruel, weight: 0.2 },
    ],
    primarySkill: 'combat',
    baseSuccessRate: 0.5,
    riskLevel: 0.6,
    culturalConformity: 0.5,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Secondary],
    requiredStatus: ['ruler', 'general'],
  },
  // Scholarly research
  {
    category: ActionCategory.ScholarlyResearch,
    name: 'study_lore',
    description: 'Research ancient texts and lore',
    traitWeights: [
      { trait: PersonalityTrait.Scholarly, weight: 0.8 },
      { trait: PersonalityTrait.Curious, weight: 0.6 },
      { trait: PersonalityTrait.Patient, weight: 0.4 },
    ],
    primarySkill: 'lore',
    baseSuccessRate: 0.7,
    riskLevel: 0.05,
    culturalConformity: 0.7,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Opportunistic],
  },
  {
    category: ActionCategory.ScholarlyResearch,
    name: 'experiment',
    description: 'Conduct an experiment or investigation',
    traitWeights: [
      { trait: PersonalityTrait.Curious, weight: 0.7 },
      { trait: PersonalityTrait.Creative, weight: 0.5 },
      { trait: PersonalityTrait.Brave, weight: 0.2 },
    ],
    primarySkill: 'lore',
    baseSuccessRate: 0.5,
    riskLevel: 0.2,
    culturalConformity: 0.5,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Opportunistic],
  },
  // Crafting
  {
    category: ActionCategory.Crafting,
    name: 'craft_item',
    description: 'Create a useful item or work of art',
    traitWeights: [
      { trait: PersonalityTrait.Creative, weight: 0.7 },
      { trait: PersonalityTrait.Patient, weight: 0.5 },
      { trait: PersonalityTrait.Pragmatic, weight: 0.3 },
    ],
    primarySkill: 'crafting',
    baseSuccessRate: 0.6,
    riskLevel: 0.05,
    culturalConformity: 0.8,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Secondary],
  },
  // Social actions
  {
    category: ActionCategory.Social,
    name: 'befriend',
    description: 'Attempt to befriend another character',
    traitWeights: [
      { trait: PersonalityTrait.Empathetic, weight: 0.6 },
      { trait: PersonalityTrait.Loyal, weight: 0.4 },
      { trait: PersonalityTrait.Forgiving, weight: 0.3 },
    ],
    primarySkill: 'diplomacy',
    baseSuccessRate: 0.5,
    riskLevel: 0.05,
    culturalConformity: 0.9,
    goalRelevance: [GoalPriority.Opportunistic, GoalPriority.PrimaryLife],
  },
  {
    category: ActionCategory.Social,
    name: 'betray',
    description: 'Betray a trust for personal gain',
    traitWeights: [
      { trait: PersonalityTrait.Amoral, weight: 0.7 },
      { trait: PersonalityTrait.Ambitious, weight: 0.5 },
      { trait: PersonalityTrait.Cruel, weight: 0.3 },
      { trait: PersonalityTrait.Loyal, weight: -0.8 },
    ],
    primarySkill: 'stealth',
    baseSuccessRate: 0.4,
    riskLevel: 0.5,
    culturalConformity: -0.8,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Secondary],
  },
  {
    category: ActionCategory.Social,
    name: 'intimidate',
    description: 'Intimidate someone into compliance',
    traitWeights: [
      { trait: PersonalityTrait.Cruel, weight: 0.5 },
      { trait: PersonalityTrait.Brave, weight: 0.4 },
      { trait: PersonalityTrait.Ambitious, weight: 0.3 },
      { trait: PersonalityTrait.Empathetic, weight: -0.5 },
    ],
    primarySkill: 'combat',
    baseSuccessRate: 0.5,
    riskLevel: 0.3,
    culturalConformity: 0.1,
    goalRelevance: [GoalPriority.Secondary, GoalPriority.PrimaryLife],
  },
  {
    category: ActionCategory.Social,
    name: 'show_mercy',
    description: 'Show mercy to a defeated enemy',
    traitWeights: [
      { trait: PersonalityTrait.Empathetic, weight: 0.7 },
      { trait: PersonalityTrait.Forgiving, weight: 0.6 },
      { trait: PersonalityTrait.Idealistic, weight: 0.4 },
      { trait: PersonalityTrait.Cruel, weight: -0.8 },
      { trait: PersonalityTrait.Vengeful, weight: -0.6 },
    ],
    primarySkill: 'diplomacy',
    baseSuccessRate: 0.8,
    riskLevel: 0.2,
    culturalConformity: 0.5,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Opportunistic],
  },
  // Travel
  {
    category: ActionCategory.Travel,
    name: 'journey',
    description: 'Travel to a distant location',
    traitWeights: [
      { trait: PersonalityTrait.Brave, weight: 0.4 },
      { trait: PersonalityTrait.Curious, weight: 0.5 },
      { trait: PersonalityTrait.Cautious, weight: -0.3 },
    ],
    primarySkill: 'survival',
    baseSuccessRate: 0.7,
    riskLevel: 0.3,
    culturalConformity: 0.4,
    goalRelevance: [GoalPriority.Secondary, GoalPriority.Opportunistic],
  },
  // Economic
  {
    category: ActionCategory.Economic,
    name: 'trade',
    description: 'Conduct a trade deal',
    traitWeights: [
      { trait: PersonalityTrait.Pragmatic, weight: 0.6 },
      { trait: PersonalityTrait.Patient, weight: 0.3 },
      { trait: PersonalityTrait.Ambitious, weight: 0.3 },
    ],
    primarySkill: 'trade',
    baseSuccessRate: 0.6,
    riskLevel: 0.1,
    culturalConformity: 0.8,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Secondary],
  },
  {
    category: ActionCategory.Economic,
    name: 'steal',
    description: 'Steal valuables from another',
    traitWeights: [
      { trait: PersonalityTrait.Amoral, weight: 0.6 },
      { trait: PersonalityTrait.Impulsive, weight: 0.3 },
      { trait: PersonalityTrait.Brave, weight: 0.2 },
      { trait: PersonalityTrait.Loyal, weight: -0.5 },
      { trait: PersonalityTrait.Idealistic, weight: -0.4 },
    ],
    primarySkill: 'stealth',
    baseSuccessRate: 0.35,
    riskLevel: 0.5,
    culturalConformity: -0.9,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Survival],
    requiredStatus: ['outlaw', 'commoner'],
  },
  // Religious
  {
    category: ActionCategory.Religious,
    name: 'pray',
    description: 'Pray at a holy site or temple',
    traitWeights: [
      { trait: PersonalityTrait.Idealistic, weight: 0.5 },
      { trait: PersonalityTrait.Patient, weight: 0.3 },
      { trait: PersonalityTrait.Loyal, weight: 0.2 },
    ],
    primarySkill: 'lore',
    baseSuccessRate: 0.9,
    riskLevel: 0.0,
    culturalConformity: 0.9,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Opportunistic],
  },
  {
    category: ActionCategory.Religious,
    name: 'proselytize',
    description: 'Spread religious doctrine to others',
    traitWeights: [
      { trait: PersonalityTrait.Idealistic, weight: 0.6 },
      { trait: PersonalityTrait.Brave, weight: 0.3 },
      { trait: PersonalityTrait.Empathetic, weight: 0.3 },
    ],
    primarySkill: 'diplomacy',
    baseSuccessRate: 0.4,
    riskLevel: 0.2,
    culturalConformity: 0.4,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Secondary],
    requiredStatus: ['priest'],
  },
  // Magical
  {
    category: ActionCategory.Magical,
    name: 'research_spell',
    description: 'Research a new spell or magical technique',
    traitWeights: [
      { trait: PersonalityTrait.Scholarly, weight: 0.6 },
      { trait: PersonalityTrait.Curious, weight: 0.5 },
      { trait: PersonalityTrait.Patient, weight: 0.4 },
    ],
    primarySkill: 'magic',
    baseSuccessRate: 0.4,
    riskLevel: 0.2,
    culturalConformity: 0.5,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Secondary],
    requiredStatus: ['mage'],
  },
  {
    category: ActionCategory.Magical,
    name: 'enchant_item',
    description: 'Enchant an item with magical properties',
    traitWeights: [
      { trait: PersonalityTrait.Creative, weight: 0.5 },
      { trait: PersonalityTrait.Scholarly, weight: 0.4 },
      { trait: PersonalityTrait.Patient, weight: 0.4 },
    ],
    primarySkill: 'magic',
    baseSuccessRate: 0.35,
    riskLevel: 0.3,
    culturalConformity: 0.5,
    goalRelevance: [GoalPriority.PrimaryLife, GoalPriority.Secondary],
    requiredStatus: ['mage'],
  },
  // Survival
  {
    category: ActionCategory.Survival,
    name: 'forage',
    description: 'Search for food and supplies',
    traitWeights: [
      { trait: PersonalityTrait.Pragmatic, weight: 0.5 },
      { trait: PersonalityTrait.Patient, weight: 0.3 },
      { trait: PersonalityTrait.Cautious, weight: 0.3 },
    ],
    primarySkill: 'survival',
    baseSuccessRate: 0.7,
    riskLevel: 0.1,
    culturalConformity: 0.5,
    goalRelevance: [GoalPriority.Survival],
  },
  {
    category: ActionCategory.Survival,
    name: 'flee',
    description: 'Flee from danger',
    traitWeights: [
      { trait: PersonalityTrait.Cautious, weight: 0.7 },
      { trait: PersonalityTrait.Brave, weight: -0.5 },
    ],
    primarySkill: 'survival',
    baseSuccessRate: 0.6,
    riskLevel: 0.4,
    culturalConformity: 0.0,
    goalRelevance: [GoalPriority.Survival],
  },
  {
    category: ActionCategory.Survival,
    name: 'seek_healing',
    description: 'Seek medical or magical healing',
    traitWeights: [
      { trait: PersonalityTrait.Pragmatic, weight: 0.5 },
      { trait: PersonalityTrait.Patient, weight: 0.3 },
    ],
    primarySkill: 'medicine',
    baseSuccessRate: 0.6,
    riskLevel: 0.05,
    culturalConformity: 0.7,
    goalRelevance: [GoalPriority.Survival],
  },
];

let nextActionId = 0;

export function createActionId(): number {
  return nextActionId++;
}

export function resetActionIdCounter(): void {
  nextActionId = 0;
}
