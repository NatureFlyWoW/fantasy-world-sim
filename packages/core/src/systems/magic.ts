/**
 * Magic System — handles magical research, institutions, artifacts, and catastrophes.
 * Research runs MONTHLY, catastrophic events run DAILY.
 * Implements artifact consciousness (design doc Section 18.5).
 */

import type { EntityId, CharacterId, SiteId, ArtifactId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import { TickFrequency } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import {
  MagicSchool,
  INSTITUTION_TRAITS,
  ArtifactType,
  ALL_ARTIFACT_TRAITS,
  CatastropheType,
  calculateBreakthroughProbability,
  checkArtifactCompatibility,
  calculateCatastropheProbability,
  createArtifactIdValue,
  createCatastropheId,
  ArtifactPersonalityTrait,
} from './magic-types.js';
import type {
  ResearchProject,
  BreakthroughFactors,
  MagicalInstitution,
  ArtifactConsciousness,
  Artifact,
  ArtifactCreationStory,
  MagicalCatastrophe,
} from './magic-types.js';

// Re-export all types for external consumers
export {
  MagicSchool,
  ALL_MAGIC_SCHOOLS,
  InstitutionType,
  ALL_INSTITUTION_TYPES,
  INSTITUTION_TRAITS,
  ResearchType,
  ALL_RESEARCH_TYPES,
  ArtifactType,
  ALL_ARTIFACT_TYPES,
  ArtifactPersonalityTrait,
  ALL_ARTIFACT_TRAITS,
  CatastropheType,
  ALL_CATASTROPHE_TYPES,
  MagicSocietyRelation,
  ALL_SOCIETY_RELATIONS,
  InstitutionEventType,
  calculateBreakthroughProbability,
  checkArtifactCompatibility,
  calculateArtifactInfluence,
  calculateCatastropheProbability,
  calculateMagicSocietyEffects,
  createResearchId,
  createInstitutionId,
  createArtifactIdValue,
  createCatastropheId,
  resetMagicIdCounters,
} from './magic-types.js';
export type {
  InstitutionTraits,
  ResearchProject,
  BreakthroughFactors,
  MagicalInstitution,
  ArtifactConsciousness,
  Artifact,
  ArtifactCreationStory,
  MagicalCatastrophe,
  CatastropheEffect,
  MagicSocietyEffects,
} from './magic-types.js';

export class MagicSystem extends BaseSystem {
  readonly name = 'MagicSystem';
  readonly frequency = TickFrequency.Daily; // Primary frequency
  readonly executionOrder = ExecutionOrder.MAGIC;

  private readonly institutions = new Map<EntityId, MagicalInstitution>();
  private readonly research = new Map<EntityId, ResearchProject>();
  private readonly artifacts = new Map<ArtifactId, Artifact>();
  private readonly catastrophes = new Map<EntityId, MagicalCatastrophe>();

  private lastMonthlyTick = 0;
  private worldMagicStrength = 1.0; // Set during initialize
  private readonly rng: SeededRNG;

  constructor(rng?: SeededRNG) {
    super();
    this.rng = rng ?? new SeededRNG(0);
  }

  override initialize(world: World): void {
    super.initialize(world);
    // Could load magic strength from world config
    // For now use default
  }

  setWorldMagicStrength(strength: number): void {
    this.worldMagicStrength = strength;
  }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    const currentTick = clock.currentTick;

    // Daily checks
    this.processArtifactInteractions(world, clock, events);
    this.checkForCatastrophes(world, clock, events);
    this.updateCatastrophes(world, clock, events);

    // Monthly checks (every 30 ticks)
    if (currentTick - this.lastMonthlyTick >= TickFrequency.Monthly) {
      this.processResearch(world, clock, events);
      this.processInstitutionPolitics(world, clock, events);
      this.processMageSocietyRelations(world, clock, events);
      this.lastMonthlyTick = currentTick;
    }
  }

  // ── Institution management ───────────────────────────────────────────────

  registerInstitution(institution: MagicalInstitution): void {
    this.institutions.set(institution.id, institution);
  }

  getInstitution(id: EntityId): MagicalInstitution | undefined {
    return this.institutions.get(id);
  }

  getInstitutionsAtSite(siteId: SiteId): MagicalInstitution[] {
    return Array.from(this.institutions.values()).filter(i => i.siteId === siteId);
  }

  // ── Research management ──────────────────────────────────────────────────

  startResearch(project: ResearchProject): void {
    this.research.set(project.id, project);
    const institution = this.institutions.get(project.institutionId);
    if (institution !== undefined) {
      institution.activeResearch.push(project.id);
    }
  }

  getResearch(id: EntityId): ResearchProject | undefined {
    return this.research.get(id);
  }

  getResearchByInstitution(institutionId: EntityId): ResearchProject[] {
    return Array.from(this.research.values()).filter(r => r.institutionId === institutionId);
  }

  // ── Artifact management ──────────────────────────────────────────────────

  registerArtifact(artifact: Artifact): void {
    this.artifacts.set(artifact.id, artifact);
  }

  getArtifact(id: ArtifactId): Artifact | undefined {
    return this.artifacts.get(id);
  }

  getArtifactsByWielder(wielderId: CharacterId): Artifact[] {
    return Array.from(this.artifacts.values()).filter(
      a => a.location.type === 'wielded' && a.location.holderId === wielderId
    );
  }

  /**
   * Attempt to bond an artifact to a wielder.
   */
  attemptBond(
    artifactId: ArtifactId,
    wielderId: CharacterId,
    wielderTraits: Map<string, number>,
  ): { success: boolean; reason: string } {
    const artifact = this.artifacts.get(artifactId);
    if (artifact === undefined) {
      return { success: false, reason: 'Artifact not found' };
    }

    const compatibility = checkArtifactCompatibility(artifact, wielderTraits);

    if (!compatibility.compatible) {
      // Artifact rejects wielder
      artifact.consciousness.rejectedWielders.push(wielderId);
      return { success: false, reason: compatibility.reason };
    }

    // Chance of rejection even if compatible, based on bond potential
    const rejectionChance = (100 - compatibility.bondPotential) / 200;
    if (this.rng.next() < rejectionChance) {
      artifact.consciousness.rejectedWielders.push(wielderId);
      return { success: false, reason: 'Artifact resisted the bond' };
    }

    // Successful bond
    if (artifact.consciousness.currentWielderId !== null) {
      artifact.consciousness.previousWielders.push(artifact.consciousness.currentWielderId);
    }
    artifact.consciousness.currentWielderId = wielderId;
    artifact.consciousness.bondStrength = Math.round(compatibility.bondPotential * 0.5); // Starts at half potential
    artifact.consciousness.dormant = false;
    artifact.location = { type: 'wielded', holderId: wielderId };

    return { success: true, reason: compatibility.reason };
  }

  // ── Catastrophe management ───────────────────────────────────────────────

  getCatastrophe(id: EntityId): MagicalCatastrophe | undefined {
    return this.catastrophes.get(id);
  }

  getActiveCatastrophes(): MagicalCatastrophe[] {
    return Array.from(this.catastrophes.values());
  }

  getCatastrophesInArea(x: number, y: number, radius: number): MagicalCatastrophe[] {
    return Array.from(this.catastrophes.values()).filter(c => {
      const dx = c.location.x - x;
      const dy = c.location.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= radius + c.radius;
    });
  }

  // ── Private processing methods ───────────────────────────────────────────

  private processResearch(_world: World, clock: WorldClock, events: EventBus): void {
    for (const project of this.research.values()) {
      if (project.progress >= 100) continue;

      const institution = this.institutions.get(project.institutionId);
      if (institution === undefined) continue;

      // Calculate progress
      const progressRate = this.calculateResearchProgress(project, institution);
      project.progress = Math.min(100, project.progress + progressRate);

      // Check for breakthrough
      const factors: BreakthroughFactors = {
        researcherSkill: 60, // Would come from character component
        resourceLevel: institution.resources,
        environmentBonus: institution.specializations.includes(project.school) ? 1.5 : 1.0,
        serendipityRoll: this.rng.next(),
        institutionSupport: institution.politicalStability,
        schoolAffinity: institution.headmasterBias === project.school ? 1.3 : 1.0,
      };

      project.breakthroughChance = calculateBreakthroughProbability(factors);

      // If project complete, emit event
      if (project.progress >= 100) {
        events.emit(createEvent({
          category: EventCategory.Magical,
          subtype: 'magic.research_complete',
          timestamp: clock.currentTick,
          participants: [project.institutionId, project.leadResearcherId],
          significance: 50 + project.difficulty * 5,
          data: {
            projectId: project.id,
            projectName: project.name,
            type: project.type,
            school: project.school,
            breakthrough: this.rng.next() < project.breakthroughChance,
          },
        }));
      }
    }
  }

  private calculateResearchProgress(project: ResearchProject, institution: MagicalInstitution): number {
    // Base progress per month
    const baseProgress = 10 / project.difficulty;

    // Modifiers
    const resourceMod = institution.resources / 100;
    const specialtyMod = institution.specializations.includes(project.school) ? 1.5 : 1.0;
    const biasMod = institution.headmasterBias === project.school ? 1.2 :
                    institution.forbiddenSchools.includes(project.school) ? 0.2 : 1.0;
    const teamMod = 1 + project.assistants.length * 0.1;

    return baseProgress * resourceMod * specialtyMod * biasMod * teamMod;
  }

  private processInstitutionPolitics(_world: World, clock: WorldClock, events: EventBus): void {
    for (const institution of this.institutions.values()) {
      // Check for schism risk
      if (institution.schismRisk > 70) {
        const schismChance = (institution.schismRisk - 70) / 100;
        if (this.rng.next() < schismChance) {
          this.triggerSchism(institution, clock, events);
        }
      }

      // Update schism risk based on internal factors
      const ethicalTension = this.calculateEthicalTension(institution);
      const leadershipTension = institution.headmasterId === null ? 20 : 0;

      institution.schismRisk = Math.min(100, Math.max(0,
        institution.schismRisk + ethicalTension + leadershipTension - 5
      ));

      // Emit politics event if significant tension
      if (institution.schismRisk > 50 && this.rng.next() < 0.2) {
        events.emit(createEvent({
          category: EventCategory.Magical,
          subtype: 'magic.institution_tension',
          timestamp: clock.currentTick,
          participants: [institution.id],
          significance: 40 + Math.floor(institution.schismRisk / 5),
          data: {
            institutionName: institution.name,
            tensionLevel: institution.schismRisk,
            cause: ethicalTension > 10 ? 'ethical_disagreement' : 'leadership_crisis',
          },
        }));
      }
    }
  }

  private calculateEthicalTension(institution: MagicalInstitution): number {
    const traits = INSTITUTION_TRAITS[institution.type];

    // Check if any forbidden research is happening
    const forbiddenResearch = this.getResearchByInstitution(institution.id)
      .filter(r => institution.forbiddenSchools.includes(r.school));

    if (forbiddenResearch.length > 0) {
      return (100 - traits.ethicalFlexibility) / 5;
    }

    // Check for controversial schools being practiced
    const controversialSchools = [MagicSchool.Necromancy, MagicSchool.Destruction];
    const hasControversial = institution.specializations.some(s => controversialSchools.includes(s));

    if (hasControversial && traits.ethicalFlexibility < 50) {
      return 5;
    }

    return 0;
  }

  private triggerSchism(institution: MagicalInstitution, clock: WorldClock, events: EventBus): void {
    // Split off some members
    const departingCount = Math.floor(institution.members.length * 0.3);
    const departing = institution.members.splice(0, departingCount);

    institution.schismRisk = 20; // Reset after schism
    institution.politicalStability = Math.max(0, institution.politicalStability - 30);

    events.emit(createEvent({
      category: EventCategory.Magical,
      subtype: 'magic.schism',
      timestamp: clock.currentTick,
      participants: [institution.id, ...departing],
      significance: 75,
      data: {
        institutionName: institution.name,
        departingCount,
        cause: 'ethical_disagreement',
      },
    }));
  }

  private processArtifactInteractions(_world: World, clock: WorldClock, events: EventBus): void {
    for (const artifact of this.artifacts.values()) {
      if (artifact.location.type !== 'wielded') continue;

      const consciousness = artifact.consciousness;
      if (consciousness.dormant) continue;

      // Strengthen bond over time
      if (consciousness.bondStrength < 100) {
        consciousness.bondStrength = Math.min(100, consciousness.bondStrength + 0.1);
      }

      // Increase awareness over time when wielded
      if (consciousness.awarenessLevel < 100) {
        const awarenessGain = artifact.powerLevel * 0.01;
        (consciousness as { awarenessLevel: number }).awarenessLevel =
          Math.min(100, consciousness.awarenessLevel + awarenessGain);
      }

      consciousness.lastActiveInteractionTick = clock.currentTick;

      // Occasional significant interaction events
      if (consciousness.awarenessLevel > 50 && this.rng.next() < 0.01) {
        events.emit(createEvent({
          category: EventCategory.Magical,
          subtype: 'magic.artifact_influence',
          timestamp: clock.currentTick,
          participants: [artifact.id, artifact.location.holderId],
          significance: 30 + Math.floor(consciousness.awarenessLevel / 3),
          data: {
            artifactName: artifact.name,
            influenceType: this.pickInfluenceType(consciousness),
            awarenessLevel: consciousness.awarenessLevel,
            bondStrength: consciousness.bondStrength,
          },
        }));
      }
    }
  }

  private pickInfluenceType(consciousness: ArtifactConsciousness): string {
    // Pick most prominent trait
    let maxTrait: ArtifactPersonalityTrait = ArtifactPersonalityTrait.Curious;
    let maxValue = 0;
    for (const [trait, value] of consciousness.personality) {
      if (value > maxValue) {
        maxValue = value;
        maxTrait = trait;
      }
    }
    return maxTrait;
  }

  private checkForCatastrophes(_world: World, clock: WorldClock, events: EventBus): void {
    // Sum up magical activity from institutions
    let totalActivity = 0;
    let riskFactors = 0;

    for (const institution of this.institutions.values()) {
      totalActivity += institution.resources;

      // Forbidden research adds risk
      const forbiddenResearch = this.getResearchByInstitution(institution.id)
        .filter(r => institution.forbiddenSchools.includes(r.school));
      riskFactors += forbiddenResearch.length * 10;

      // Unstable institutions add risk
      if (institution.politicalStability < 30) {
        riskFactors += 5;
      }
    }

    const averageActivity = this.institutions.size > 0 ?
      totalActivity / this.institutions.size : 0;

    const catastropheChance = calculateCatastropheProbability(
      averageActivity,
      this.worldMagicStrength,
      riskFactors
    );

    if (this.rng.next() < catastropheChance) {
      this.triggerCatastrophe(clock, events);
    }
  }

  private triggerCatastrophe(clock: WorldClock, events: EventBus): void {
    const types = [
      CatastropheType.WildMagicZone,
      CatastropheType.ManaStorm,
      CatastropheType.MagicalPlague,
      CatastropheType.CursedGround,
    ];
    const type = types[this.rng.nextInt(0, types.length - 1)]!;

    const catastrophe: MagicalCatastrophe = {
      id: createCatastropheId(),
      type,
      location: { x: this.rng.nextInt(0, 99), y: this.rng.nextInt(0, 99) },
      radius: this.rng.nextInt(3, 9),
      severity: this.rng.nextInt(1, 10),
      startTick: clock.currentTick,
      duration: type === CatastropheType.ManaStorm ? this.rng.nextInt(30, 89) : null,
      causeId: null,
      activeEffects: [],
      containmentLevel: 0,
    };

    this.catastrophes.set(catastrophe.id, catastrophe);

    events.emit(createEvent({
      category: EventCategory.Disaster,
      subtype: `magic.catastrophe.${type}`,
      timestamp: clock.currentTick,
      participants: [catastrophe.id],
      significance: 60 + catastrophe.severity * 4,
      data: {
        catastropheId: catastrophe.id,
        type: catastrophe.type,
        location: catastrophe.location,
        radius: catastrophe.radius,
        severity: catastrophe.severity,
        magicCasualties: Math.floor(catastrophe.severity * 3),
      },
    }));
  }

  private updateCatastrophes(_world: World, clock: WorldClock, events: EventBus): void {
    for (const catastrophe of this.catastrophes.values()) {
      // Check if catastrophe should end
      if (catastrophe.duration !== null) {
        const elapsed = clock.currentTick - catastrophe.startTick;
        if (elapsed >= catastrophe.duration) {
          this.catastrophes.delete(catastrophe.id);
          events.emit(createEvent({
            category: EventCategory.Magical,
            subtype: 'magic.catastrophe_ended',
            timestamp: clock.currentTick,
            participants: [catastrophe.id],
            significance: 40,
            data: {
              catastropheId: catastrophe.id,
              type: catastrophe.type,
              duration: elapsed,
            },
          }));
          continue;
        }
      }

      // Containment can reduce severity
      if (catastrophe.containmentLevel >= 80) {
        (catastrophe as { severity: number }).severity = Math.max(1, catastrophe.severity - 1);
        if (catastrophe.severity <= 1 && catastrophe.containmentLevel >= 95) {
          this.catastrophes.delete(catastrophe.id);
          events.emit(createEvent({
            category: EventCategory.Magical,
            subtype: 'magic.catastrophe_contained',
            timestamp: clock.currentTick,
            participants: [catastrophe.id],
            significance: 50,
            data: {
              catastropheId: catastrophe.id,
              type: catastrophe.type,
            },
          }));
        }
      }
    }
  }

  private processMageSocietyRelations(_world: World, clock: WorldClock, events: EventBus): void {
    // This would interact with faction system to track magic-society relations
    // For now, emit events for significant changes

    // Check if low magic areas are experiencing persecution
    for (const institution of this.institutions.values()) {
      if (institution.reputation < 30 && this.rng.next() < 0.1) {
        events.emit(createEvent({
          category: EventCategory.Magical,
          subtype: 'magic.persecution_threat',
          timestamp: clock.currentTick,
          participants: [institution.id],
          significance: 45,
          data: {
            institutionName: institution.name,
            reputation: institution.reputation,
            threat: 'local_authorities',
          },
        }));
      }
    }
  }

  /**
   * Create an artifact during a significant event.
   */
  createArtifact(
    name: string,
    type: ArtifactType,
    powerLevel: number,
    creatorId: CharacterId | null,
    creationStory: ArtifactCreationStory,
    schools: MagicSchool[],
    clock: WorldClock,
    events: EventBus,
  ): Artifact {
    // Determine initial personality based on creation context
    const personality = new Map<ArtifactPersonalityTrait, number>();

    // Add some random base traits
    const traitCount = this.rng.nextInt(2, 4);
    const shuffledTraits = this.rng.shuffle([...ALL_ARTIFACT_TRAITS]);
    for (let i = 0; i < traitCount; i++) {
      personality.set(shuffledTraits[i]!, this.rng.nextInt(30, 79));
    }

    // Modify based on purpose
    if (creationStory.purpose.includes('war') || creationStory.purpose.includes('battle')) {
      personality.set(ArtifactPersonalityTrait.Wrathful,
        (personality.get(ArtifactPersonalityTrait.Wrathful) ?? 0) + 30);
    }
    if (creationStory.purpose.includes('protect') || creationStory.purpose.includes('defend')) {
      personality.set(ArtifactPersonalityTrait.Protective,
        (personality.get(ArtifactPersonalityTrait.Protective) ?? 0) + 40);
    }
    if (creationStory.sacrifice !== undefined) {
      personality.set(ArtifactPersonalityTrait.Noble,
        (personality.get(ArtifactPersonalityTrait.Noble) ?? 0) + 20);
    }

    const artifact: Artifact = {
      id: createArtifactIdValue(),
      name,
      type,
      powerLevel,
      creatorId,
      creationTick: clock.currentTick,
      creationStory,
      schools,
      consciousness: {
        awarenessLevel: powerLevel * 5, // Higher power = more initial awareness
        personality,
        absorbedEmotions: new Map(),
        previousWielders: [],
        currentWielderId: null,
        bondStrength: 0,
        rejectedWielders: [],
        dormant: true, // Starts dormant until wielded
        lastActiveInteractionTick: clock.currentTick,
      },
      location: { type: 'lost' },
      corrupted: false,
    };

    this.artifacts.set(artifact.id, artifact);

    events.emit(createEvent({
      category: EventCategory.Magical,
      subtype: 'magic.artifact_created',
      timestamp: clock.currentTick,
      participants: creatorId !== null ? [artifact.id, creatorId] : [artifact.id],
      significance: 70 + powerLevel * 3,
      data: {
        artifactId: artifact.id,
        artifactName: name,
        artifactType: type,
        powerLevel,
        purpose: creationStory.purpose,
        schools,
      },
    }));

    return artifact;
  }
}
