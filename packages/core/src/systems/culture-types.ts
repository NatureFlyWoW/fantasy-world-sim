/**
 * Cultural Evolution types — technology, art, philosophy, and language evolution.
 * All type definitions, enums, interfaces, tables, and helper functions for the cultural system.
 */

import type { EntityId, CharacterId, FactionId, SiteId } from '../ecs/types.js';
import { toEntityId } from '../ecs/types.js';

// ══════════════════════════════════════════════════════════════════════════════
// TECHNOLOGY SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

export enum TechnologyCategory {
  Agriculture = 'agriculture',
  Crafting = 'crafting',
  Warfare = 'warfare',
  Communication = 'communication',
  Construction = 'construction',
  Medicine = 'medicine',
  Transportation = 'transportation',
  Magic = 'magic',
}

export const ALL_TECHNOLOGY_CATEGORIES: readonly TechnologyCategory[] = Object.values(TechnologyCategory);

/**
 * A technology that can be invented and spread.
 */
export interface Technology {
  readonly id: EntityId;
  readonly name: string;
  readonly category: TechnologyCategory;
  readonly description: string;
  readonly prerequisites: EntityId[]; // Other technologies required
  readonly inventionDifficulty: number; // 1-100
  readonly economicImpact: number; // Multiplier effect
  readonly militaryImpact: number;
  readonly culturalImpact: number;
  readonly canBeSuppressed: boolean;
}

/**
 * State of a technology within a faction.
 */
export interface TechnologyState {
  readonly technologyId: EntityId;
  readonly factionId: FactionId;
  inventedTick: number | null;
  adoptedTick: number | null;
  progress: number; // 0-100 for invention progress
  isSuppressed: boolean;
  suppressedBy: FactionId | null;
  researchersAllocated: number;
}

/**
 * Predefined technologies with their prerequisites.
 */
export const TECHNOLOGIES: readonly Omit<Technology, 'id'>[] = [
  // Basic technologies (no prerequisites)
  { name: 'Stone Tools', category: TechnologyCategory.Crafting, description: 'Basic tools made from shaped stone', prerequisites: [], inventionDifficulty: 5, economicImpact: 1.1, militaryImpact: 1.1, culturalImpact: 0, canBeSuppressed: false },
  { name: 'Fire Making', category: TechnologyCategory.Crafting, description: 'Controlled use of fire', prerequisites: [], inventionDifficulty: 10, economicImpact: 1.2, militaryImpact: 1.0, culturalImpact: 0.1, canBeSuppressed: false },
  { name: 'Agriculture', category: TechnologyCategory.Agriculture, description: 'Cultivation of crops', prerequisites: [], inventionDifficulty: 15, economicImpact: 1.5, militaryImpact: 1.0, culturalImpact: 0.1, canBeSuppressed: false },
  { name: 'Animal Husbandry', category: TechnologyCategory.Agriculture, description: 'Domestication of animals', prerequisites: [], inventionDifficulty: 15, economicImpact: 1.3, militaryImpact: 1.1, culturalImpact: 0.05, canBeSuppressed: false },

  // Intermediate technologies
  { name: 'Bronze Working', category: TechnologyCategory.Crafting, description: 'Smelting and working bronze', prerequisites: [], inventionDifficulty: 25, economicImpact: 1.3, militaryImpact: 1.4, culturalImpact: 0.1, canBeSuppressed: false },
  { name: 'Writing', category: TechnologyCategory.Communication, description: 'Recording language in symbols', prerequisites: [], inventionDifficulty: 30, economicImpact: 1.2, militaryImpact: 1.0, culturalImpact: 0.5, canBeSuppressed: true },
  { name: 'Wheel', category: TechnologyCategory.Transportation, description: 'Circular wheels for transport', prerequisites: [], inventionDifficulty: 20, economicImpact: 1.4, militaryImpact: 1.2, culturalImpact: 0.05, canBeSuppressed: false },
  { name: 'Pottery', category: TechnologyCategory.Crafting, description: 'Creating vessels from clay', prerequisites: [], inventionDifficulty: 15, economicImpact: 1.2, militaryImpact: 1.0, culturalImpact: 0.1, canBeSuppressed: false },

  // Advanced technologies (require prerequisites)
  { name: 'Iron Working', category: TechnologyCategory.Crafting, description: 'Smelting and forging iron', prerequisites: [], inventionDifficulty: 40, economicImpact: 1.5, militaryImpact: 1.6, culturalImpact: 0.1, canBeSuppressed: false },
  { name: 'Literacy', category: TechnologyCategory.Communication, description: 'Widespread reading and writing', prerequisites: [], inventionDifficulty: 35, economicImpact: 1.3, militaryImpact: 1.1, culturalImpact: 0.6, canBeSuppressed: true },
  { name: 'Mathematics', category: TechnologyCategory.Communication, description: 'Advanced numerical systems', prerequisites: [], inventionDifficulty: 40, economicImpact: 1.3, militaryImpact: 1.1, culturalImpact: 0.3, canBeSuppressed: true },
  { name: 'Architecture', category: TechnologyCategory.Construction, description: 'Advanced building techniques', prerequisites: [], inventionDifficulty: 35, economicImpact: 1.2, militaryImpact: 1.2, culturalImpact: 0.3, canBeSuppressed: false },

  // High technologies
  { name: 'Steel Working', category: TechnologyCategory.Crafting, description: 'Creating and working steel', prerequisites: [], inventionDifficulty: 60, economicImpact: 1.6, militaryImpact: 1.8, culturalImpact: 0.1, canBeSuppressed: false },
  { name: 'Printing Press', category: TechnologyCategory.Communication, description: 'Mechanical reproduction of text', prerequisites: [], inventionDifficulty: 70, economicImpact: 1.4, militaryImpact: 1.0, culturalImpact: 0.8, canBeSuppressed: true },
  { name: 'Alchemy', category: TechnologyCategory.Magic, description: 'Transformation of substances', prerequisites: [], inventionDifficulty: 55, economicImpact: 1.3, militaryImpact: 1.2, culturalImpact: 0.2, canBeSuppressed: true },
  { name: 'Navigation', category: TechnologyCategory.Transportation, description: 'Advanced seafaring techniques', prerequisites: [], inventionDifficulty: 45, economicImpact: 1.5, militaryImpact: 1.3, culturalImpact: 0.2, canBeSuppressed: false },

  // Medical
  { name: 'Herbalism', category: TechnologyCategory.Medicine, description: 'Use of plants for healing', prerequisites: [], inventionDifficulty: 20, economicImpact: 1.1, militaryImpact: 1.1, culturalImpact: 0.1, canBeSuppressed: false },
  { name: 'Surgery', category: TechnologyCategory.Medicine, description: 'Surgical procedures', prerequisites: [], inventionDifficulty: 50, economicImpact: 1.1, militaryImpact: 1.2, culturalImpact: 0.1, canBeSuppressed: false },
];

// ══════════════════════════════════════════════════════════════════════════════
// ARTISTIC MOVEMENTS
// ══════════════════════════════════════════════════════════════════════════════

export enum ArtForm {
  Visual = 'visual',
  Literary = 'literary',
  Musical = 'musical',
  Theatrical = 'theatrical',
  Architectural = 'architectural',
  Sculptural = 'sculptural',
}

export const ALL_ART_FORMS: readonly ArtForm[] = Object.values(ArtForm);

export enum ArtStyle {
  Classical = 'classical',
  Romantic = 'romantic',
  Dramatic = 'dramatic',
  Minimalist = 'minimalist',
  Ornate = 'ornate',
  Naturalistic = 'naturalistic',
  Abstract = 'abstract',
  Religious = 'religious',
  Heroic = 'heroic',
  Melancholic = 'melancholic',
}

export const ALL_ART_STYLES: readonly ArtStyle[] = Object.values(ArtStyle);

/**
 * A significant artistic work.
 */
export interface Masterwork {
  readonly id: EntityId;
  readonly name: string;
  readonly form: ArtForm;
  readonly style: ArtStyle;
  readonly creatorId: CharacterId;
  readonly creationTick: number;
  readonly originSite: SiteId;
  readonly originFaction: FactionId;
  quality: number; // 1-100
  fame: number; // 0-100, grows over time
  readonly culturalContext: string;
  triggeredMovement: EntityId | null;
}

/**
 * An artistic movement inspired by a masterwork.
 */
export interface ArtisticMovement {
  readonly id: EntityId;
  readonly name: string;
  readonly primaryStyle: ArtStyle;
  readonly triggeringWorkId: EntityId;
  readonly originFaction: FactionId;
  readonly startTick: number;
  spreadTo: FactionId[];
  participants: CharacterId[];
  influence: number; // 0-100
  isActive: boolean;
  endTick: number | null;
  worksProduced: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// PHILOSOPHICAL SCHOOLS
// ══════════════════════════════════════════════════════════════════════════════

export enum PhilosophyType {
  Conservative = 'conservative',
  Revolutionary = 'revolutionary',
  Mystical = 'mystical',
  Rationalist = 'rationalist',
  Naturalist = 'naturalist',
  Ascetic = 'ascetic',
  Hedonist = 'hedonist',
  Martial = 'martial',
}

export const ALL_PHILOSOPHY_TYPES: readonly PhilosophyType[] = Object.values(PhilosophyType);

/**
 * A school of philosophical thought.
 */
export interface PhilosophicalSchool {
  readonly id: EntityId;
  readonly name: string;
  readonly primaryType: PhilosophyType;
  readonly secondaryType: PhilosophyType | null;
  readonly founderId: CharacterId;
  readonly foundedTick: number;
  readonly originFaction: FactionId;
  followers: CharacterId[];
  influence: number; // 0-100
  stabilityEffect: number; // Negative = destabilizing, positive = stabilizing
  reformEffect: number; // Higher = more reform pressure
  isActive: boolean;
  competingWith: EntityId[]; // Other schools this one opposes
}

/**
 * Calculate the net effect of philosophies on a faction.
 */
export function calculatePhilosophyEffects(schools: PhilosophicalSchool[]): {
  stabilityModifier: number;
  reformPressure: number;
  culturalVibrancy: number;
} {
  let stabilityModifier = 0;
  let reformPressure = 0;
  let culturalVibrancy = 0;

  for (const school of schools) {
    if (!school.isActive) continue;

    const weight = school.influence / 100;
    stabilityModifier += school.stabilityEffect * weight;
    reformPressure += school.reformEffect * weight;
    culturalVibrancy += 10 * weight; // Active schools increase cultural vibrancy

    // Competing schools create tension but also vibrancy
    if (school.competingWith.length > 0) {
      culturalVibrancy += 5 * school.competingWith.length * weight;
      stabilityModifier -= 2 * school.competingWith.length * weight;
    }
  }

  return {
    stabilityModifier: Math.round(stabilityModifier),
    reformPressure: Math.round(reformPressure),
    culturalVibrancy: Math.min(100, Math.round(culturalVibrancy)),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// LANGUAGE EVOLUTION
// ══════════════════════════════════════════════════════════════════════════════

export enum LanguageStatus {
  Living = 'living',
  Dialect = 'dialect',
  Dead = 'dead',
  Scholarly = 'scholarly', // Dead but preserved by scholars
}

export const ALL_LANGUAGE_STATUSES: readonly LanguageStatus[] = Object.values(LanguageStatus);

/**
 * A language or dialect.
 */
export interface Language {
  readonly id: EntityId;
  readonly name: string;
  status: LanguageStatus;
  readonly parentLanguageId: EntityId | null; // For dialects/derived languages
  speakers: number;
  nativeSpeakers: number;
  literacyRate: number; // 0-100
  hasWritingSystem: boolean;
  preservedByScholars: boolean;
  dialectOf: EntityId | null;
  derivedDialects: EntityId[];
  loanWords: Map<EntityId, number>; // From language ID -> count
  regions: SiteId[];
  imposedBy: FactionId | null; // If imposed through conquest
  lastEvolutionTick: number;
  age: number; // Ticks since language emerged
}

/**
 * Calculate divergence between two related languages.
 */
export function calculateLanguageDivergence(
  original: Language,
  derived: Language,
  centuriesApart: number,
): number {
  // Base divergence from time
  const timeDivergence = Math.min(100, centuriesApart * 10);

  // Geographic separation accelerates divergence
  const sharedRegions = original.regions.filter(r => derived.regions.includes(r)).length;
  const isolationFactor = sharedRegions === 0 ? 1.5 : 1.0;

  // Loan words from other languages increase divergence
  const loanWordFactor = 1 + (derived.loanWords.size * 0.05);

  return Math.min(100, Math.round(timeDivergence * isolationFactor * loanWordFactor));
}

/**
 * Check if a dialect has diverged enough to become a separate language.
 */
export function shouldBecomeLanguage(dialect: Language, parent: Language): boolean {
  if (dialect.status !== LanguageStatus.Dialect) return false;
  if (dialect.dialectOf !== parent.id) return false;

  const centuriesApart = dialect.age / (365 * 100);
  const divergence = calculateLanguageDivergence(parent, dialect, centuriesApart);

  // Become a language if divergence > 60% (roughly 6 centuries of isolation)
  return divergence > 60;
}

// ══════════════════════════════════════════════════════════════════════════════
// ID GENERATION
// ══════════════════════════════════════════════════════════════════════════════

let nextTechId = 100000;
let nextMasterworkId = 101000;
let nextMovementId = 102000;
let nextSchoolId = 103000;
let nextLanguageId = 104000;

export function createTechId(): EntityId {
  return toEntityId(nextTechId++);
}

export function createMasterworkId(): EntityId {
  return toEntityId(nextMasterworkId++);
}

export function createMovementId(): EntityId {
  return toEntityId(nextMovementId++);
}

export function createSchoolId(): EntityId {
  return toEntityId(nextSchoolId++);
}

export function createLanguageId(): EntityId {
  return toEntityId(nextLanguageId++);
}

export function resetCultureIdCounters(): void {
  nextTechId = 100000;
  nextMasterworkId = 101000;
  nextMovementId = 102000;
  nextSchoolId = 103000;
  nextLanguageId = 104000;
}

// ══════════════════════════════════════════════════════════════════════════════
// CULTURAL EVOLUTION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The Cultural Evolution System manages technology, art, philosophy, and language.
 * Runs SEASONAL for short-term cultural changes.
 * Annual processing handles long-term evolution (language divergence, movement fade).
 */
