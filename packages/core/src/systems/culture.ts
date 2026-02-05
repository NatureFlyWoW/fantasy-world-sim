/**
 * Cultural Evolution System — technology, art, philosophy, and language.
 * Runs SEASONAL for short-term cultural events, ANNUAL for long-term evolution.
 * Integrates with OralTraditionSystem for pre-literate societies.
 */

import type { EntityId, CharacterId, FactionId, SiteId } from '../ecs/types.js';
import { toEntityId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import { TickFrequency } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';

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
export class CulturalEvolutionSystem extends BaseSystem {
  readonly name = 'CulturalEvolutionSystem';
  readonly frequency = TickFrequency.Seasonal;
  readonly executionOrder = ExecutionOrder.SOCIAL;

  private readonly technologies = new Map<EntityId, Technology>();
  private readonly techStates = new Map<string, TechnologyState>(); // key: `${techId}-${factionId}`
  private readonly masterworks = new Map<EntityId, Masterwork>();
  private readonly movements = new Map<EntityId, ArtisticMovement>();
  private readonly schools = new Map<EntityId, PhilosophicalSchool>();
  private readonly languages = new Map<EntityId, Language>();
  private readonly tradeConnections = new Map<FactionId, FactionId[]>();

  private lastAnnualTick = 0;

  constructor() {
    super();
    // Initialize base technologies
    for (const tech of TECHNOLOGIES) {
      const id = createTechId();
      this.technologies.set(id, { ...tech, id, prerequisites: [] });
    }
  }

  override initialize(world: World): void {
    super.initialize(world);
  }

  execute(_world: World, clock: WorldClock, events: EventBus): void {
    const currentTick = clock.currentTick;

    // Seasonal processing
    this.processResearch(currentTick, events);
    this.processTechSpread(currentTick, events);
    this.processArtisticActivity(currentTick, events);
    this.processPhilosophicalActivity(currentTick, events);

    // Annual processing
    if (currentTick - this.lastAnnualTick >= TickFrequency.Annual) {
      this.processLanguageEvolution(currentTick, events);
      this.processMovementLifecycle(currentTick, events);
      this.processSchoolCompetition(currentTick, events);
      this.lastAnnualTick = currentTick;
    }
  }

  // ── Technology management ───────────────────────────────────────────────────

  getTechnology(id: EntityId): Technology | undefined {
    return this.technologies.get(id);
  }

  getTechnologyByName(name: string): Technology | undefined {
    for (const tech of this.technologies.values()) {
      if (tech.name === name) return tech;
    }
    return undefined;
  }

  getAllTechnologies(): Technology[] {
    return Array.from(this.technologies.values());
  }

  getTechState(techId: EntityId, factionId: FactionId): TechnologyState | undefined {
    return this.techStates.get(`${techId}-${factionId}`);
  }

  hasTechnology(techId: EntityId, factionId: FactionId): boolean {
    const state = this.getTechState(techId, factionId);
    return state !== undefined && state.inventedTick !== null && !state.isSuppressed;
  }

  canResearch(techId: EntityId, factionId: FactionId): { canDo: boolean; reason: string } {
    const tech = this.technologies.get(techId);
    if (tech === undefined) {
      return { canDo: false, reason: 'Technology not found' };
    }

    // Check if already invented
    if (this.hasTechnology(techId, factionId)) {
      return { canDo: false, reason: 'Already invented' };
    }

    // Check prerequisites
    for (const prereqId of tech.prerequisites) {
      if (!this.hasTechnology(prereqId, factionId)) {
        const prereq = this.technologies.get(prereqId);
        return { canDo: false, reason: `Missing prerequisite: ${prereq?.name ?? 'Unknown'}` };
      }
    }

    return { canDo: true, reason: 'Can research' };
  }

  startResearch(techId: EntityId, factionId: FactionId, researchers: number): boolean {
    const check = this.canResearch(techId, factionId);
    if (!check.canDo) return false;

    const key = `${techId}-${factionId}`;
    const existing = this.techStates.get(key);

    if (existing !== undefined) {
      existing.researchersAllocated = researchers;
    } else {
      const state: TechnologyState = {
        technologyId: techId,
        factionId,
        inventedTick: null,
        adoptedTick: null,
        progress: 0,
        isSuppressed: false,
        suppressedBy: null,
        researchersAllocated: researchers,
      };
      this.techStates.set(key, state);
    }

    return true;
  }

  suppressTechnology(
    techId: EntityId,
    targetFaction: FactionId,
    suppressorFaction: FactionId,
    tick: number,
    events: EventBus,
  ): boolean {
    const tech = this.technologies.get(techId);
    if (tech === undefined || !tech.canBeSuppressed) return false;

    const key = `${techId}-${targetFaction}`;
    const state = this.techStates.get(key);

    if (state !== undefined) {
      state.isSuppressed = true;
      state.suppressedBy = suppressorFaction;

      events.emit(createEvent({
        category: EventCategory.Cultural,
        subtype: 'culture.technology_suppressed',
        timestamp: tick,
        participants: [techId, targetFaction, suppressorFaction],
        significance: 60 + tech.culturalImpact * 20,
        data: {
          technologyId: techId,
          technologyName: tech.name,
          targetFaction,
          suppressorFaction,
        },
      }));

      return true;
    }

    return false;
  }

  // ── Trade connections (for tech spread) ─────────────────────────────────────

  addTradeConnection(factionA: FactionId, factionB: FactionId): void {
    const connectionsA = this.tradeConnections.get(factionA) ?? [];
    const connectionsB = this.tradeConnections.get(factionB) ?? [];

    if (!connectionsA.includes(factionB)) {
      connectionsA.push(factionB);
      this.tradeConnections.set(factionA, connectionsA);
    }

    if (!connectionsB.includes(factionA)) {
      connectionsB.push(factionA);
      this.tradeConnections.set(factionB, connectionsB);
    }
  }

  getTradePartners(factionId: FactionId): FactionId[] {
    return this.tradeConnections.get(factionId) ?? [];
  }

  // ── Masterwork and movement management ──────────────────────────────────────

  registerMasterwork(work: Masterwork): void {
    this.masterworks.set(work.id, work);
  }

  getMasterwork(id: EntityId): Masterwork | undefined {
    return this.masterworks.get(id);
  }

  createMasterwork(
    name: string,
    form: ArtForm,
    style: ArtStyle,
    creatorId: CharacterId,
    originSite: SiteId,
    originFaction: FactionId,
    quality: number,
    culturalContext: string,
    tick: number,
    events: EventBus,
  ): Masterwork {
    const work: Masterwork = {
      id: createMasterworkId(),
      name,
      form,
      style,
      creatorId,
      creationTick: tick,
      originSite,
      originFaction,
      quality,
      fame: Math.min(50, quality / 2),
      culturalContext,
      triggeredMovement: null,
    };

    this.masterworks.set(work.id, work);

    events.emit(createEvent({
      category: EventCategory.Cultural,
      subtype: 'culture.masterwork_created',
      timestamp: tick,
      participants: [work.id, creatorId, originFaction],
      significance: 40 + quality / 2,
      data: {
        masterworkId: work.id,
        name,
        form,
        style,
        quality,
        creatorId,
        originFaction,
      },
    }));

    // High-quality works can trigger movements
    if (quality >= 80) {
      this.tryTriggerMovement(work, tick, events);
    }

    return work;
  }

  getMovement(id: EntityId): ArtisticMovement | undefined {
    return this.movements.get(id);
  }

  getActiveMovements(): ArtisticMovement[] {
    return Array.from(this.movements.values()).filter(m => m.isActive);
  }

  // ── Philosophical school management ─────────────────────────────────────────

  registerSchool(school: PhilosophicalSchool): void {
    this.schools.set(school.id, school);
  }

  getSchool(id: EntityId): PhilosophicalSchool | undefined {
    return this.schools.get(id);
  }

  getSchoolsByFaction(factionId: FactionId): PhilosophicalSchool[] {
    return Array.from(this.schools.values()).filter(
      s => s.originFaction === factionId || s.followers.length > 0
    );
  }

  createSchool(
    name: string,
    primaryType: PhilosophyType,
    secondaryType: PhilosophyType | null,
    founderId: CharacterId,
    originFaction: FactionId,
    tick: number,
    events: EventBus,
  ): PhilosophicalSchool {
    // Calculate effects based on type
    const stabilityEffect = primaryType === PhilosophyType.Conservative ? 10 :
                           primaryType === PhilosophyType.Revolutionary ? -15 :
                           primaryType === PhilosophyType.Martial ? 5 : 0;

    const reformEffect = primaryType === PhilosophyType.Revolutionary ? 20 :
                        primaryType === PhilosophyType.Conservative ? -10 :
                        primaryType === PhilosophyType.Rationalist ? 10 : 5;

    const school: PhilosophicalSchool = {
      id: createSchoolId(),
      name,
      primaryType,
      secondaryType,
      founderId,
      foundedTick: tick,
      originFaction,
      followers: [founderId],
      influence: 10,
      stabilityEffect,
      reformEffect,
      isActive: true,
      competingWith: [],
    };

    this.schools.set(school.id, school);

    // Find competing schools
    for (const other of this.schools.values()) {
      if (other.id === school.id) continue;
      if (this.areCompetingTypes(school.primaryType, other.primaryType)) {
        school.competingWith.push(other.id);
        other.competingWith.push(school.id);
      }
    }

    events.emit(createEvent({
      category: EventCategory.Cultural,
      subtype: 'culture.philosophy_founded',
      timestamp: tick,
      participants: [school.id, founderId, originFaction],
      significance: 55,
      data: {
        schoolId: school.id,
        name,
        primaryType,
        founderId,
        originFaction,
      },
    }));

    return school;
  }

  // ── Language management ─────────────────────────────────────────────────────

  registerLanguage(language: Language): void {
    this.languages.set(language.id, language);
  }

  getLanguage(id: EntityId): Language | undefined {
    return this.languages.get(id);
  }

  getAllLanguages(): Language[] {
    return Array.from(this.languages.values());
  }

  getLivingLanguages(): Language[] {
    return Array.from(this.languages.values()).filter(
      l => l.status === LanguageStatus.Living || l.status === LanguageStatus.Dialect
    );
  }

  createLanguage(
    name: string,
    regions: SiteId[],
    hasWriting: boolean,
    tick: number,
    events: EventBus,
    parentId?: EntityId,
    isDialect?: boolean,
  ): Language {
    const language: Language = {
      id: createLanguageId(),
      name,
      status: isDialect === true ? LanguageStatus.Dialect : LanguageStatus.Living,
      parentLanguageId: parentId ?? null,
      speakers: 0,
      nativeSpeakers: 0,
      literacyRate: hasWriting ? 5 : 0,
      hasWritingSystem: hasWriting,
      preservedByScholars: false,
      dialectOf: isDialect === true ? (parentId ?? null) : null,
      derivedDialects: [],
      loanWords: new Map(),
      regions,
      imposedBy: null,
      lastEvolutionTick: tick,
      age: 0,
    };

    this.languages.set(language.id, language);

    // Update parent if this is a dialect
    if (parentId !== undefined) {
      const parent = this.languages.get(parentId);
      if (parent !== undefined) {
        parent.derivedDialects.push(language.id);
      }
    }

    events.emit(createEvent({
      category: EventCategory.Cultural,
      subtype: isDialect === true ? 'culture.dialect_emerged' : 'culture.language_emerged',
      timestamp: tick,
      participants: [language.id],
      significance: isDialect === true ? 30 : 50,
      data: {
        languageId: language.id,
        name,
        parentId,
        regions,
        hasWriting,
      },
    }));

    return language;
  }

  addLoanWords(
    receivingId: EntityId,
    givingId: EntityId,
    count: number,
    tick: number,
    events: EventBus,
  ): void {
    const receiving = this.languages.get(receivingId);
    if (receiving === undefined) return;

    const existing = receiving.loanWords.get(givingId) ?? 0;
    receiving.loanWords.set(givingId, existing + count);

    if (count >= 10) {
      const giving = this.languages.get(givingId);
      events.emit(createEvent({
        category: EventCategory.Cultural,
        subtype: 'culture.loan_words_adopted',
        timestamp: tick,
        participants: [receivingId, givingId],
        significance: 20,
        data: {
          receivingLanguage: receiving.name,
          givingLanguage: giving?.name ?? 'Unknown',
          count,
          totalFromSource: existing + count,
        },
      }));
    }
  }

  imposeLanguage(
    languageId: EntityId,
    regionId: SiteId,
    conquerorFaction: FactionId,
    tick: number,
    events: EventBus,
  ): void {
    const language = this.languages.get(languageId);
    if (language === undefined) return;

    if (!language.regions.includes(regionId)) {
      language.regions.push(regionId);
    }
    language.imposedBy = conquerorFaction;

    events.emit(createEvent({
      category: EventCategory.Cultural,
      subtype: 'culture.language_imposed',
      timestamp: tick,
      participants: [languageId, conquerorFaction],
      significance: 45,
      data: {
        languageId,
        languageName: language.name,
        regionId,
        conquerorFaction,
      },
    }));
  }

  // ── Private processing methods ──────────────────────────────────────────────

  private processResearch(tick: number, events: EventBus): void {
    for (const state of this.techStates.values()) {
      if (state.inventedTick !== null) continue;
      if (state.researchersAllocated === 0) continue;

      const tech = this.technologies.get(state.technologyId);
      if (tech === undefined) continue;

      // Progress based on researchers and difficulty
      const progressRate = (state.researchersAllocated * 5) / tech.inventionDifficulty;
      state.progress = Math.min(100, state.progress + progressRate);

      // Check for invention
      if (state.progress >= 100) {
        state.inventedTick = tick;
        state.adoptedTick = tick;

        events.emit(createEvent({
          category: EventCategory.Cultural,
          subtype: 'culture.technology_invented',
          timestamp: tick,
          participants: [state.technologyId, state.factionId],
          significance: 60 + tech.inventionDifficulty / 2,
          data: {
            technologyId: state.technologyId,
            technologyName: tech.name,
            factionId: state.factionId,
            category: tech.category,
          },
        }));
      }
    }
  }

  private processTechSpread(tick: number, events: EventBus): void {
    const rng = () => Math.random();

    for (const [factionId, partners] of this.tradeConnections) {
      for (const partnerId of partners) {
        // Check each technology the partner has
        for (const [techId, tech] of this.technologies) {
          if (this.hasTechnology(techId, partnerId) && !this.hasTechnology(techId, factionId)) {
            // Check if faction can adopt (has prerequisites)
            const check = this.canResearch(techId, factionId);
            if (!check.canDo) continue;

            // Spread chance based on trade and tech difficulty
            const spreadChance = 0.1 / tech.inventionDifficulty;

            if (rng() < spreadChance) {
              // Adopt the technology
              const key = `${techId}-${factionId}`;
              const state: TechnologyState = {
                technologyId: techId,
                factionId,
                inventedTick: null,
                adoptedTick: tick,
                progress: 100,
                isSuppressed: false,
                suppressedBy: null,
                researchersAllocated: 0,
              };
              this.techStates.set(key, state);

              events.emit(createEvent({
                category: EventCategory.Cultural,
                subtype: 'culture.technology_spread',
                timestamp: tick,
                participants: [techId, factionId, partnerId],
                significance: 45,
                data: {
                  technologyId: techId,
                  technologyName: tech.name,
                  adoptingFaction: factionId,
                  sourceFaction: partnerId,
                  spreadMethod: 'trade',
                },
              }));
            }
          }
        }
      }
    }
  }

  private processArtisticActivity(tick: number, events: EventBus): void {
    // Fame grows for masterworks over time
    for (const work of this.masterworks.values()) {
      if (work.fame < 100) {
        work.fame = Math.min(100, work.fame + (work.quality / 50));
      }
    }

    // Movements spread to trade partners
    const rng = () => Math.random();
    for (const movement of this.movements.values()) {
      if (!movement.isActive) continue;

      const partners = this.tradeConnections.get(movement.originFaction) ?? [];
      for (const partner of partners) {
        if (movement.spreadTo.includes(partner)) continue;

        const spreadChance = 0.05 + (movement.influence / 500);
        if (rng() < spreadChance) {
          movement.spreadTo.push(partner);

          events.emit(createEvent({
            category: EventCategory.Cultural,
            subtype: 'culture.movement_spread',
            timestamp: tick,
            participants: [movement.id, partner],
            significance: 35,
            data: {
              movementId: movement.id,
              movementName: movement.name,
              spreadToFaction: partner,
              totalReach: movement.spreadTo.length,
            },
          }));
        }
      }
    }
  }

  private processPhilosophicalActivity(_tick: number, _events: EventBus): void {
    // Schools gain/lose influence based on followers
    for (const school of this.schools.values()) {
      if (!school.isActive) continue;

      // Base influence change from follower count
      const followerFactor = Math.log10(school.followers.length + 1) * 5;
      school.influence = Math.min(100, Math.max(0, school.influence + (followerFactor - 2)));

      // Competition reduces influence of both schools
      for (const competitorId of school.competingWith) {
        const competitor = this.schools.get(competitorId);
        if (competitor !== undefined && competitor.isActive) {
          const competitionPenalty = Math.min(5, competitor.influence / 20);
          school.influence = Math.max(0, school.influence - competitionPenalty);
        }
      }
    }
  }

  private processLanguageEvolution(tick: number, events: EventBus): void {
    for (const language of this.languages.values()) {
      if (language.status === LanguageStatus.Dead) continue;

      language.age += TickFrequency.Annual;

      // Check if dialect should become a language
      if (language.status === LanguageStatus.Dialect && language.dialectOf !== null) {
        const parent = this.languages.get(language.dialectOf);
        if (parent !== undefined && shouldBecomeLanguage(language, parent)) {
          language.status = LanguageStatus.Living;
          language.dialectOf = null;

          events.emit(createEvent({
            category: EventCategory.Cultural,
            subtype: 'culture.dialect_became_language',
            timestamp: tick,
            participants: [language.id, parent.id],
            significance: 55,
            data: {
              languageId: language.id,
              languageName: language.name,
              parentId: parent.id,
              parentName: parent.name,
              centuriesApart: Math.floor(language.age / (365 * 100)),
            },
          }));
        }
      }

      // Languages with no speakers die
      if (language.speakers === 0 && language.nativeSpeakers === 0) {
        if (language.preservedByScholars) {
          language.status = LanguageStatus.Scholarly;
        } else {
          language.status = LanguageStatus.Dead;

          events.emit(createEvent({
            category: EventCategory.Cultural,
            subtype: 'culture.language_died',
            timestamp: tick,
            participants: [language.id],
            significance: 50,
            data: {
              languageId: language.id,
              languageName: language.name,
              age: language.age,
              hadWriting: language.hasWritingSystem,
            },
          }));
        }
      }
    }
  }

  private processMovementLifecycle(tick: number, events: EventBus): void {
    for (const movement of this.movements.values()) {
      if (!movement.isActive) continue;

      // Movements fade over time
      const age = tick - movement.startTick;
      const ageInYears = age / TickFrequency.Annual;

      if (ageInYears > 50) {
        // Movements typically last 50-100 years
        const fadeChance = (ageInYears - 50) / 100;
        if (Math.random() < fadeChance) {
          movement.isActive = false;
          movement.endTick = tick;

          events.emit(createEvent({
            category: EventCategory.Cultural,
            subtype: 'culture.movement_ended',
            timestamp: tick,
            participants: [movement.id],
            significance: 40,
            data: {
              movementId: movement.id,
              movementName: movement.name,
              duration: ageInYears,
              worksProduced: movement.worksProduced,
              peakInfluence: movement.influence,
            },
          }));
        }
      }
    }
  }

  private processSchoolCompetition(tick: number, events: EventBus): void {
    // Schools with low influence fade
    for (const school of this.schools.values()) {
      if (!school.isActive) continue;

      if (school.influence < 5 && school.followers.length < 3) {
        school.isActive = false;

        events.emit(createEvent({
          category: EventCategory.Cultural,
          subtype: 'culture.philosophy_faded',
          timestamp: tick,
          participants: [school.id],
          significance: 30,
          data: {
            schoolId: school.id,
            schoolName: school.name,
            primaryType: school.primaryType,
            finalInfluence: school.influence,
            finalFollowers: school.followers.length,
          },
        }));
      }
    }
  }

  private tryTriggerMovement(work: Masterwork, tick: number, events: EventBus): void {
    // Check if conditions are right for a movement
    const existingMovements = this.getActiveMovements().filter(
      m => m.primaryStyle === work.style
    );

    // Don't trigger if similar movement already exists
    if (existingMovements.length > 0) return;

    // Create the movement
    const movement: ArtisticMovement = {
      id: createMovementId(),
      name: `${work.style.charAt(0).toUpperCase() + work.style.slice(1)} Movement`,
      primaryStyle: work.style,
      triggeringWorkId: work.id,
      originFaction: work.originFaction,
      startTick: tick,
      spreadTo: [],
      participants: [work.creatorId],
      influence: 30,
      isActive: true,
      endTick: null,
      worksProduced: 1,
    };

    this.movements.set(movement.id, movement);
    (work as { triggeredMovement: EntityId | null }).triggeredMovement = movement.id;

    events.emit(createEvent({
      category: EventCategory.Cultural,
      subtype: 'culture.artistic_movement_born',
      timestamp: tick,
      participants: [movement.id, work.id, work.creatorId],
      significance: 65,
      data: {
        movementId: movement.id,
        movementName: movement.name,
        triggeringWorkId: work.id,
        triggeringWorkName: work.name,
        style: work.style,
        originFaction: work.originFaction,
      },
    }));
  }

  private areCompetingTypes(a: PhilosophyType, b: PhilosophyType): boolean {
    const oppositions: Map<PhilosophyType, PhilosophyType[]> = new Map([
      [PhilosophyType.Conservative, [PhilosophyType.Revolutionary]],
      [PhilosophyType.Revolutionary, [PhilosophyType.Conservative]],
      [PhilosophyType.Mystical, [PhilosophyType.Rationalist]],
      [PhilosophyType.Rationalist, [PhilosophyType.Mystical]],
      [PhilosophyType.Ascetic, [PhilosophyType.Hedonist]],
      [PhilosophyType.Hedonist, [PhilosophyType.Ascetic]],
    ]);

    return oppositions.get(a)?.includes(b) ?? false;
  }
}
