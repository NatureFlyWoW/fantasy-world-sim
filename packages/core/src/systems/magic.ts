/**
 * Magic System — handles magical research, institutions, artifacts, and catastrophes.
 * Research runs MONTHLY, catastrophic events run DAILY.
 * Implements artifact consciousness (design doc Section 18.5).
 */

import type { EntityId, CharacterId, FactionId, SiteId, ArtifactId } from '../ecs/types.js';
import { toEntityId, toArtifactId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import { TickFrequency } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { SeededRNG } from '../utils/seeded-rng.js';

// ── Magic schools (re-export from generator types for consistency) ───────────

export enum MagicSchool {
  Elemental = 'Elemental',
  Necromancy = 'Necromancy',
  Divination = 'Divination',
  Illusion = 'Illusion',
  Enchantment = 'Enchantment',
  Summoning = 'Summoning',
  Transmutation = 'Transmutation',
  Healing = 'Healing',
  Destruction = 'Destruction',
  Abjuration = 'Abjuration',
  Chronomancy = 'Chronomancy',
}

export const ALL_MAGIC_SCHOOLS: readonly MagicSchool[] = Object.values(MagicSchool);

// ── Magical institution types ────────────────────────────────────────────────

export enum InstitutionType {
  Academy = 'academy',
  Order = 'order',
  Coven = 'coven',
  Guild = 'guild',
  Temple = 'temple',
  Tower = 'tower',
}

export const ALL_INSTITUTION_TYPES: readonly InstitutionType[] = Object.values(InstitutionType);

/**
 * Traits for each institution type.
 */
export interface InstitutionTraits {
  readonly formality: number; // 0-100: structured vs. informal
  readonly secrecy: number; // 0-100: open vs. hidden
  readonly hierarchy: number; // 0-100: flat vs. strict hierarchy
  readonly researchFocus: number; // 0-100: practical vs. theoretical
  readonly ethicalFlexibility: number; // 0-100: strict vs. permissive
}

export const INSTITUTION_TRAITS: Readonly<Record<InstitutionType, InstitutionTraits>> = {
  [InstitutionType.Academy]: {
    formality: 80,
    secrecy: 20,
    hierarchy: 70,
    researchFocus: 90,
    ethicalFlexibility: 30,
  },
  [InstitutionType.Order]: {
    formality: 90,
    secrecy: 50,
    hierarchy: 95,
    researchFocus: 40,
    ethicalFlexibility: 20,
  },
  [InstitutionType.Coven]: {
    formality: 20,
    secrecy: 85,
    hierarchy: 30,
    researchFocus: 60,
    ethicalFlexibility: 80,
  },
  [InstitutionType.Guild]: {
    formality: 60,
    secrecy: 30,
    hierarchy: 50,
    researchFocus: 50,
    ethicalFlexibility: 50,
  },
  [InstitutionType.Temple]: {
    formality: 85,
    secrecy: 40,
    hierarchy: 80,
    researchFocus: 30,
    ethicalFlexibility: 10,
  },
  [InstitutionType.Tower]: {
    formality: 30,
    secrecy: 70,
    hierarchy: 20,
    researchFocus: 95,
    ethicalFlexibility: 60,
  },
};

// ── Research project types ───────────────────────────────────────────────────

export enum ResearchType {
  SpellDevelopment = 'spell_development',
  TheoreticalStudy = 'theoretical_study',
  ArtifactAnalysis = 'artifact_analysis',
  RitualDesign = 'ritual_design',
  EnchantmentTechnique = 'enchantment_technique',
  PlanarInvestigation = 'planar_investigation',
  ForbiddenKnowledge = 'forbidden_knowledge',
}

export const ALL_RESEARCH_TYPES: readonly ResearchType[] = Object.values(ResearchType);

/**
 * A magical research project.
 */
export interface ResearchProject {
  readonly id: EntityId;
  readonly institutionId: EntityId;
  readonly leadResearcherId: CharacterId;
  readonly type: ResearchType;
  readonly school: MagicSchool;
  readonly name: string;
  progress: number; // 0-100
  readonly difficulty: number; // 1-10
  readonly startTick: number;
  readonly estimatedTicks: number;
  readonly resourcesAllocated: number; // 0-100
  readonly assistants: CharacterId[];
  breakthroughChance: number; // calculated probability
}

/**
 * Factors affecting research breakthrough probability.
 */
export interface BreakthroughFactors {
  readonly researcherSkill: number; // 0-100
  readonly resourceLevel: number; // 0-100
  readonly environmentBonus: number; // multiplier, typically 0.5-2.0
  readonly serendipityRoll: number; // random 0-1
  readonly institutionSupport: number; // 0-100
  readonly schoolAffinity: number; // multiplier for school match
}

/**
 * Calculate breakthrough probability.
 * Formula: (skill/100) * (resources/100) * environment * (0.5 + serendipity*0.5) * (support/100)
 */
export function calculateBreakthroughProbability(factors: BreakthroughFactors): number {
  const skillFactor = factors.researcherSkill / 100;
  const resourceFactor = factors.resourceLevel / 100;
  const serendipityFactor = 0.5 + factors.serendipityRoll * 0.5;
  const supportFactor = factors.institutionSupport / 100;

  const baseProbability = skillFactor * resourceFactor * factors.environmentBonus *
    serendipityFactor * supportFactor * factors.schoolAffinity;

  // Cap at 95%
  return Math.min(0.95, Math.max(0, baseProbability));
}

// ── Magical institution ──────────────────────────────────────────────────────

/**
 * A magical institution (academy, order, coven, etc.).
 */
export interface MagicalInstitution {
  readonly id: EntityId;
  readonly name: string;
  readonly type: InstitutionType;
  readonly siteId: SiteId;
  readonly factionId: FactionId | null;
  readonly foundedTick: number;
  headmasterId: CharacterId | null;
  readonly specializations: MagicSchool[]; // Schools this institution focuses on
  headmasterBias: MagicSchool | null; // Current headmaster's preferred school
  members: CharacterId[];
  reputation: number; // 0-100
  resources: number; // 0-100
  politicalStability: number; // 0-100
  readonly forbiddenSchools: MagicSchool[]; // Schools banned by this institution
  schismRisk: number; // 0-100
  activeResearch: EntityId[];
}

/**
 * Internal politics event type.
 */
export enum InstitutionEventType {
  HeadmasterElection = 'headmaster_election',
  SchismThreat = 'schism_threat',
  SchismOccurred = 'schism_occurred',
  EthicsDebate = 'ethics_debate',
  ForbiddenResearch = 'forbidden_research',
  PurgeOfMembers = 'purge_of_members',
  MergerProposal = 'merger_proposal',
  Reformation = 'reformation',
}

// ── Artifact consciousness (design doc Section 18.5) ─────────────────────────

export enum ArtifactPersonalityTrait {
  Ambitious = 'ambitious',
  Protective = 'protective',
  Wrathful = 'wrathful',
  Wise = 'wise',
  Curious = 'curious',
  Malevolent = 'malevolent',
  Noble = 'noble',
  Jealous = 'jealous',
  Patient = 'patient',
  Impulsive = 'impulsive',
}

export const ALL_ARTIFACT_TRAITS: readonly ArtifactPersonalityTrait[] =
  Object.values(ArtifactPersonalityTrait);

/**
 * Artifact consciousness that develops over time.
 */
export interface ArtifactConsciousness {
  readonly awarenessLevel: number; // 0-100: how conscious is it
  personality: Map<ArtifactPersonalityTrait, number>; // trait -> intensity (0-100)
  readonly absorbedEmotions: Map<string, number>; // emotion type -> amount
  readonly previousWielders: CharacterId[];
  currentWielderId: CharacterId | null;
  bondStrength: number; // 0-100: how bonded to current wielder
  readonly rejectedWielders: CharacterId[]; // wielders it has rejected
  dormant: boolean; // true if consciousness is sleeping
  lastActiveInteractionTick: number;
}

/**
 * Artifact with creation story and consciousness.
 */
export interface Artifact {
  readonly id: ArtifactId;
  readonly name: string;
  readonly type: ArtifactType;
  readonly powerLevel: number; // 1-10
  readonly creatorId: CharacterId | null;
  readonly creationTick: number;
  readonly creationStory: ArtifactCreationStory;
  readonly schools: MagicSchool[]; // Magic schools imbued in artifact
  consciousness: ArtifactConsciousness;
  location: { type: 'wielded'; holderId: CharacterId } |
            { type: 'stored'; siteId: SiteId } |
            { type: 'lost'; lastKnownLocation?: { x: number; y: number } };
  corrupted: boolean;
}

export enum ArtifactType {
  Weapon = 'weapon',
  Armor = 'armor',
  Ring = 'ring',
  Staff = 'staff',
  Tome = 'tome',
  Crown = 'crown',
  Amulet = 'amulet',
  Orb = 'orb',
  Relic = 'relic',
}

export const ALL_ARTIFACT_TYPES: readonly ArtifactType[] = Object.values(ArtifactType);

/**
 * The story of how an artifact was created.
 */
export interface ArtifactCreationStory {
  readonly purpose: string;
  readonly circumstance: string;
  readonly sacrifice?: string; // what was sacrificed to create it
  readonly prophecy?: string; // any prophecy associated with it
  readonly linkedEventId?: EntityId; // the world event that led to creation
}

/**
 * Check if artifact personality is compatible with a potential wielder.
 */
export function checkArtifactCompatibility(
  artifact: Artifact,
  wielderTraits: Map<string, number>, // wielder personality trait -> intensity
): { compatible: boolean; reason: string; bondPotential: number } {
  const consciousness = artifact.consciousness;

  if (consciousness.awarenessLevel < 20) {
    // Artifact isn't conscious enough to reject anyone
    return { compatible: true, reason: 'Artifact lacks awareness', bondPotential: 50 };
  }

  let compatibility = 50;
  const reasons: string[] = [];

  // Check trait alignment
  for (const [artTrait, artIntensity] of consciousness.personality) {
    // Map artifact traits to expected wielder traits
    const mappings: Record<ArtifactPersonalityTrait, { alignedTraits: string[]; opposedTraits: string[] }> = {
      [ArtifactPersonalityTrait.Ambitious]: { alignedTraits: ['ambitious', 'driven'], opposedTraits: ['humble', 'content'] },
      [ArtifactPersonalityTrait.Protective]: { alignedTraits: ['protective', 'loyal'], opposedTraits: ['cruel', 'treacherous'] },
      [ArtifactPersonalityTrait.Wrathful]: { alignedTraits: ['wrathful', 'aggressive'], opposedTraits: ['calm', 'peaceful'] },
      [ArtifactPersonalityTrait.Wise]: { alignedTraits: ['wise', 'prudent'], opposedTraits: ['impulsive', 'reckless'] },
      [ArtifactPersonalityTrait.Curious]: { alignedTraits: ['curious', 'scholarly'], opposedTraits: ['incurious', 'traditional'] },
      [ArtifactPersonalityTrait.Malevolent]: { alignedTraits: ['cruel', 'dark'], opposedTraits: ['compassionate', 'noble'] },
      [ArtifactPersonalityTrait.Noble]: { alignedTraits: ['noble', 'honorable'], opposedTraits: ['treacherous', 'cruel'] },
      [ArtifactPersonalityTrait.Jealous]: { alignedTraits: ['possessive', 'envious'], opposedTraits: ['generous', 'trusting'] },
      [ArtifactPersonalityTrait.Patient]: { alignedTraits: ['patient', 'calm'], opposedTraits: ['impulsive', 'hasty'] },
      [ArtifactPersonalityTrait.Impulsive]: { alignedTraits: ['impulsive', 'spontaneous'], opposedTraits: ['cautious', 'deliberate'] },
    };

    const mapping = mappings[artTrait];
    const weight = artIntensity / 100;

    for (const aligned of mapping.alignedTraits) {
      const wielderValue = wielderTraits.get(aligned) ?? 0;
      compatibility += (wielderValue / 100) * weight * 20;
    }

    for (const opposed of mapping.opposedTraits) {
      const wielderValue = wielderTraits.get(opposed) ?? 0;
      compatibility -= (wielderValue / 100) * weight * 20;
    }
  }

  // Check if previously rejected this wielder
  if (consciousness.currentWielderId !== null &&
      consciousness.rejectedWielders.includes(consciousness.currentWielderId)) {
    compatibility -= 40;
    reasons.push('Previously rejected');
  }

  // Malevolent artifacts are harder for good characters
  const malevolence = consciousness.personality.get(ArtifactPersonalityTrait.Malevolent) ?? 0;
  const wielderNoble = wielderTraits.get('noble') ?? wielderTraits.get('compassionate') ?? 0;
  if (malevolence > 50 && wielderNoble > 60) {
    compatibility -= 30;
    reasons.push('Moral conflict');
  }

  compatibility = Math.max(0, Math.min(100, compatibility));

  return {
    compatible: compatibility >= 30,
    reason: reasons.length > 0 ? reasons.join(', ') :
            compatibility >= 70 ? 'Strong resonance' :
            compatibility >= 50 ? 'Acceptable match' :
            'Personality clash',
    bondPotential: compatibility,
  };
}

/**
 * Influence wielder traits based on artifact personality.
 */
export function calculateArtifactInfluence(
  artifact: Artifact,
  _currentWielderTraits: Map<string, number>,
  bondDuration: number, // ticks bonded
): Map<string, number> {
  const influence = new Map<string, number>();
  const consciousness = artifact.consciousness;

  if (consciousness.awarenessLevel < 30 || consciousness.dormant) {
    return influence; // No influence if not conscious enough
  }

  // Influence scales with bond strength, awareness, and duration
  const influenceStrength = (consciousness.bondStrength / 100) *
    (consciousness.awarenessLevel / 100) *
    Math.min(1, bondDuration / 365); // Full influence after 1 year

  // Map artifact traits to wielder trait modifications
  const traitInfluence: Record<ArtifactPersonalityTrait, { trait: string; direction: 1 | -1 }[]> = {
    [ArtifactPersonalityTrait.Ambitious]: [{ trait: 'ambitious', direction: 1 }],
    [ArtifactPersonalityTrait.Protective]: [{ trait: 'protective', direction: 1 }, { trait: 'cruel', direction: -1 }],
    [ArtifactPersonalityTrait.Wrathful]: [{ trait: 'wrathful', direction: 1 }, { trait: 'calm', direction: -1 }],
    [ArtifactPersonalityTrait.Wise]: [{ trait: 'wise', direction: 1 }, { trait: 'impulsive', direction: -1 }],
    [ArtifactPersonalityTrait.Curious]: [{ trait: 'curious', direction: 1 }],
    [ArtifactPersonalityTrait.Malevolent]: [{ trait: 'cruel', direction: 1 }, { trait: 'compassionate', direction: -1 }],
    [ArtifactPersonalityTrait.Noble]: [{ trait: 'noble', direction: 1 }, { trait: 'treacherous', direction: -1 }],
    [ArtifactPersonalityTrait.Jealous]: [{ trait: 'possessive', direction: 1 }, { trait: 'trusting', direction: -1 }],
    [ArtifactPersonalityTrait.Patient]: [{ trait: 'patient', direction: 1 }],
    [ArtifactPersonalityTrait.Impulsive]: [{ trait: 'impulsive', direction: 1 }, { trait: 'cautious', direction: -1 }],
  };

  for (const [artTrait, artIntensity] of consciousness.personality) {
    const influences = traitInfluence[artTrait];
    for (const inf of influences) {
      const change = (artIntensity / 100) * influenceStrength * inf.direction * 10;
      const current = influence.get(inf.trait) ?? 0;
      influence.set(inf.trait, current + change);
    }
  }

  return influence;
}

// ── Magical catastrophes ─────────────────────────────────────────────────────

export enum CatastropheType {
  WildMagicZone = 'wild_magic_zone',
  PlanarRift = 'planar_rift',
  FailedLichTransformation = 'failed_lich_transformation',
  MagicalPlague = 'magical_plague',
  ManaStorm = 'mana_storm',
  DimensionalTear = 'dimensional_tear',
  CursedGround = 'cursed_ground',
  SummoningGoneWrong = 'summoning_gone_wrong',
}

export const ALL_CATASTROPHE_TYPES: readonly CatastropheType[] = Object.values(CatastropheType);

/**
 * An active magical catastrophe in the world.
 */
export interface MagicalCatastrophe {
  readonly id: EntityId;
  readonly type: CatastropheType;
  readonly location: { x: number; y: number };
  readonly radius: number; // tiles affected
  readonly severity: number; // 1-10
  readonly startTick: number;
  duration: number | null; // null = permanent
  readonly causeId: EntityId | null; // character or event that caused it
  activeEffects: CatastropheEffect[];
  containmentLevel: number; // 0-100: how much it's been contained
}

export interface CatastropheEffect {
  readonly effectType: string;
  readonly intensity: number;
  readonly affectedSchools: MagicSchool[];
}

/**
 * Check catastrophe probability based on magical activity.
 */
export function calculateCatastropheProbability(
  magicalActivity: number, // 0-100
  worldMagicStrength: number, // multiplier from world config
  riskFactors: number, // sum of risk factors (forbidden research, unstable rituals, etc.)
): number {
  // Base daily catastrophe chance is very low
  const baseChance = 0.0001; // 0.01% per day

  const activityMultiplier = 1 + (magicalActivity / 100) * 3; // up to 4x
  const strengthMultiplier = worldMagicStrength;
  const riskMultiplier = 1 + (riskFactors / 100);

  return Math.min(0.05, baseChance * activityMultiplier * strengthMultiplier * riskMultiplier);
}

// ── Magic-society interaction ────────────────────────────────────────────────

export enum MagicSocietyRelation {
  Integrated = 'integrated', // Magic is normal part of society
  Privileged = 'privileged', // Mages have special status
  Regulated = 'regulated', // Magic is controlled by law
  Feared = 'feared', // Society fears mages
  Persecuted = 'persecuted', // Active witch hunts
  Suppressed = 'suppressed', // Magic is illegal
  Revered = 'revered', // Mages are religious figures
}

export const ALL_SOCIETY_RELATIONS: readonly MagicSocietyRelation[] =
  Object.values(MagicSocietyRelation);

/**
 * Effects of magic level on society.
 */
export interface MagicSocietyEffects {
  readonly economicMultiplier: number; // production bonus/penalty
  readonly techAdvancement: number; // research speed modifier
  readonly socialStability: number; // stability modifier
  readonly magePopulationGrowth: number; // mage training rate
  readonly persecutionRisk: number; // chance of witch hunts
}

/**
 * Calculate society effects based on magic prevalence.
 */
export function calculateMagicSocietyEffects(
  magicStrength: number, // 0-3 from world config
  societyRelation: MagicSocietyRelation,
  mageProportion: number, // 0-1 proportion of mages in population
): MagicSocietyEffects {
  // High magic = economic revolution potential
  const highMagicEconomicBonus = magicStrength > 1.5;

  const baseEconomic = highMagicEconomicBonus ? 1.2 : 1.0;
  const baseTech = 1.0 + magicStrength * 0.2;

  // Apply relation modifiers
  const relationModifiers: Record<MagicSocietyRelation, Partial<MagicSocietyEffects>> = {
    [MagicSocietyRelation.Integrated]: {
      economicMultiplier: baseEconomic * 1.1,
      techAdvancement: baseTech * 1.2,
      socialStability: 0.1,
      magePopulationGrowth: 1.2,
      persecutionRisk: 0,
    },
    [MagicSocietyRelation.Privileged]: {
      economicMultiplier: baseEconomic * 1.15,
      techAdvancement: baseTech * 1.3,
      socialStability: -0.1, // creates class tension
      magePopulationGrowth: 1.5,
      persecutionRisk: 0,
    },
    [MagicSocietyRelation.Regulated]: {
      economicMultiplier: baseEconomic * 1.0,
      techAdvancement: baseTech * 1.0,
      socialStability: 0.05,
      magePopulationGrowth: 0.8,
      persecutionRisk: 0.1,
    },
    [MagicSocietyRelation.Feared]: {
      economicMultiplier: baseEconomic * 0.9,
      techAdvancement: baseTech * 0.8,
      socialStability: -0.15,
      magePopulationGrowth: 0.5,
      persecutionRisk: 0.3,
    },
    [MagicSocietyRelation.Persecuted]: {
      economicMultiplier: baseEconomic * 0.7,
      techAdvancement: baseTech * 0.5,
      socialStability: -0.3,
      magePopulationGrowth: -0.5, // mages hide or flee
      persecutionRisk: 0.8,
    },
    [MagicSocietyRelation.Suppressed]: {
      economicMultiplier: baseEconomic * 0.8,
      techAdvancement: baseTech * 0.3,
      socialStability: 0.0, // enforced stability
      magePopulationGrowth: -0.8,
      persecutionRisk: 0.9,
    },
    [MagicSocietyRelation.Revered]: {
      economicMultiplier: baseEconomic * 1.05,
      techAdvancement: baseTech * 1.4,
      socialStability: 0.15,
      magePopulationGrowth: 2.0,
      persecutionRisk: 0,
    },
  };

  const mods = relationModifiers[societyRelation];

  // Adjust persecution risk based on mage proportion
  // More mages = either more integration or more fear
  const adjustedPersecution = (mods.persecutionRisk ?? 0) * (1 - mageProportion * 2);

  return {
    economicMultiplier: mods.economicMultiplier ?? 1.0,
    techAdvancement: mods.techAdvancement ?? 1.0,
    socialStability: mods.socialStability ?? 0,
    magePopulationGrowth: mods.magePopulationGrowth ?? 1.0,
    persecutionRisk: Math.max(0, adjustedPersecution),
  };
}

// ── ID generation ────────────────────────────────────────────────────────────

let nextResearchId = 70000;
let nextInstitutionId = 71000;
let nextArtifactId = 72000;
let nextCatastropheId = 73000;

export function createResearchId(): EntityId {
  return toEntityId(nextResearchId++);
}

export function createInstitutionId(): EntityId {
  return toEntityId(nextInstitutionId++);
}

export function createArtifactIdValue(): ArtifactId {
  return toArtifactId(toEntityId(nextArtifactId++));
}

export function createCatastropheId(): EntityId {
  return toEntityId(nextCatastropheId++);
}

export function resetMagicIdCounters(): void {
  nextResearchId = 70000;
  nextInstitutionId = 71000;
  nextArtifactId = 72000;
  nextCatastropheId = 73000;
}

// ── Magic System class ───────────────────────────────────────────────────────

/**
 * The Magic System manages all magical activities in the world.
 * Runs at two frequencies:
 * - MONTHLY for research progress and institution politics
 * - DAILY for catastrophe checks and artifact interactions (via execute)
 */
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
