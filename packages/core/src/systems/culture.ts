/**
 * Cultural Evolution System — technology, art, philosophy, and language.
 * Runs SEASONAL for short-term cultural events, ANNUAL for long-term evolution.
 * Integrates with OralTraditionSystem for pre-literate societies.
 */

import type { EntityId, CharacterId, FactionId, SiteId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import { TickFrequency } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import {
  ArtForm,
  ArtStyle,
  PhilosophyType,
  LanguageStatus,
  TECHNOLOGIES,
  shouldBecomeLanguage,
  createTechId,
  createMasterworkId,
  createMovementId,
  createSchoolId,
  createLanguageId,
} from './culture-types.js';
import type {
  Technology,
  TechnologyState,
  Masterwork,
  ArtisticMovement,
  PhilosophicalSchool,
  Language,
} from './culture-types.js';

// Re-export all types for external consumers
export {
  TechnologyCategory,
  ALL_TECHNOLOGY_CATEGORIES,
  ArtForm,
  ALL_ART_FORMS,
  ArtStyle,
  ALL_ART_STYLES,
  PhilosophyType,
  ALL_PHILOSOPHY_TYPES,
  LanguageStatus,
  ALL_LANGUAGE_STATUSES,
  TECHNOLOGIES,
  calculatePhilosophyEffects,
  calculateLanguageDivergence,
  shouldBecomeLanguage,
  createTechId,
  createMasterworkId,
  createMovementId,
  createSchoolId,
  createLanguageId,
  resetCultureIdCounters,
} from './culture-types.js';
export type {
  Technology,
  TechnologyState,
  Masterwork,
  ArtisticMovement,
  PhilosophicalSchool,
  Language,
} from './culture-types.js';

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
  private readonly rng: SeededRNG;

  private lastAnnualTick = 0;

  constructor(rng?: SeededRNG) {
    super();
    this.rng = rng ?? new SeededRNG(0);
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

            if (this.rng.next() < spreadChance) {
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
    for (const movement of this.movements.values()) {
      if (!movement.isActive) continue;

      const partners = this.tradeConnections.get(movement.originFaction) ?? [];
      for (const partner of partners) {
        if (movement.spreadTo.includes(partner)) continue;

        const spreadChance = 0.05 + (movement.influence / 500);
        if (this.rng.next() < spreadChance) {
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
        if (this.rng.next() < fadeChance) {
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
