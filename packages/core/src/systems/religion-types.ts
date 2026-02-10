/**
 * Religion System types — domains, interventions, doctrines, and holy figures.
 * All type definitions, enums, interfaces, tables, and helper functions for the religion system.
 */

import type { EntityId, CharacterId, DeityId, FactionId, SiteId } from '../ecs/types.js';
import { toEntityId, toDeityId } from '../ecs/types.js';

// ── Divine domains (mirroring generator) ─────────────────────────────────────

export enum Domain {
  War = 'War',
  Death = 'Death',
  Life = 'Life',
  Nature = 'Nature',
  Magic = 'Magic',
  Knowledge = 'Knowledge',
  Trickery = 'Trickery',
  Love = 'Love',
  Justice = 'Justice',
  Chaos = 'Chaos',
  Sea = 'Sea',
  Sky = 'Sky',
  Earth = 'Earth',
  Fire = 'Fire',
  Forge = 'Forge',
  Harvest = 'Harvest',
  Moon = 'Moon',
  Sun = 'Sun',
}

export const ALL_DOMAINS: readonly Domain[] = Object.values(Domain);

// ── Divine intervention types ────────────────────────────────────────────────

export enum InterventionType {
  EmpowerChampion = 'empower_champion',
  PropheticVision = 'prophetic_vision',
  PhysicalManifestation = 'physical_manifestation',
  BlessSite = 'bless_site',
  BlessArmy = 'bless_army',
  CurseEnemy = 'curse_enemy',
  CreateMiracle = 'create_miracle',
  SendOmen = 'send_omen',
  GrantDivineWeapon = 'grant_divine_weapon',
}

export const ALL_INTERVENTION_TYPES: readonly InterventionType[] = Object.values(InterventionType);

/**
 * Cost and requirements for each intervention type.
 */
export interface InterventionCost {
  readonly powerCost: number; // Divine power spent
  readonly minimumPower: number; // Minimum power to attempt
  readonly cooldownDays: number; // Days before this deity can intervene again
  readonly rarity: number; // 0-1, lower = rarer
}

export const INTERVENTION_COSTS: Readonly<Record<InterventionType, InterventionCost>> = {
  [InterventionType.SendOmen]: {
    powerCost: 5,
    minimumPower: 20,
    cooldownDays: 7,
    rarity: 0.8,
  },
  [InterventionType.PropheticVision]: {
    powerCost: 15,
    minimumPower: 50,
    cooldownDays: 30,
    rarity: 0.5,
  },
  [InterventionType.BlessSite]: {
    powerCost: 20,
    minimumPower: 80,
    cooldownDays: 90,
    rarity: 0.4,
  },
  [InterventionType.BlessArmy]: {
    powerCost: 30,
    minimumPower: 100,
    cooldownDays: 60,
    rarity: 0.3,
  },
  [InterventionType.CurseEnemy]: {
    powerCost: 25,
    minimumPower: 100,
    cooldownDays: 60,
    rarity: 0.35,
  },
  [InterventionType.EmpowerChampion]: {
    powerCost: 40,
    minimumPower: 150,
    cooldownDays: 180,
    rarity: 0.2,
  },
  [InterventionType.CreateMiracle]: {
    powerCost: 50,
    minimumPower: 200,
    cooldownDays: 365,
    rarity: 0.1,
  },
  [InterventionType.GrantDivineWeapon]: {
    powerCost: 60,
    minimumPower: 250,
    cooldownDays: 365,
    rarity: 0.08,
  },
  [InterventionType.PhysicalManifestation]: {
    powerCost: 100,
    minimumPower: 500,
    cooldownDays: 1000,
    rarity: 0.02,
  },
};

// ── Church and religion structures ───────────────────────────────────────────

export enum DoctrineType {
  Compassion = 'compassion',
  Obedience = 'obedience',
  Revelation = 'revelation',
  Sacrifice = 'sacrifice',
  Freedom = 'freedom',
}

export const ALL_DOCTRINE_TYPES: readonly DoctrineType[] = Object.values(DoctrineType);

/**
 * A deity in the simulation with dynamic power tracking.
 */
export interface SimDeity {
  readonly id: DeityId;
  readonly name: string;
  readonly primaryDomain: Domain;
  readonly secondaryDomains: Domain[];
  readonly basePowerLevel: number; // 1-10 from generator
  currentPower: number; // Dynamic power from worshipers
  readonly isInterventionist: boolean;
  readonly doctrine: DoctrineType;
  alive: boolean;
  lastInterventionTick: number;
  worshiperCount: number;
  averageDevotionLevel: number;
}

/**
 * A religious organization (church, cult, etc.).
 */
export interface Religion {
  readonly id: EntityId;
  readonly name: string;
  primaryDeityId: DeityId;
  secondaryDeityIds: DeityId[]; // For syncretic religions
  readonly foundedTick: number;
  founderCharacterId: CharacterId | null;
  doctrine: DoctrineType;
  corruptionLevel: number; // 0-100
  reformPressure: number; // 0-100
  schismRisk: number; // 0-100
  memberCount: number;
  sites: SiteId[]; // Sites where this religion is practiced
  headquarters: SiteId | null;
  readonly isStateReligion: Map<FactionId, boolean>;
  syncreticInfluences: Map<DeityId, number>; // Foreign deity -> influence strength
}

/**
 * A worshiper's devotion to a specific religion.
 */
export interface DevotionRecord {
  readonly characterId: CharacterId;
  readonly religionId: EntityId;
  devotionLevel: number; // 0-100
  readonly joinedTick: number;
  lastPrayerTick: number;
  miraclesWitnessed: number;
}

// ── Church politics events ───────────────────────────────────────────────────

export enum ChurchEventType {
  CorruptionScandal = 'corruption_scandal',
  PowerStruggle = 'power_struggle',
  SchismThreat = 'schism_threat',
  SchismOccurred = 'schism_occurred',
  ReformMovement = 'reform_movement',
  ReformEnacted = 'reform_enacted',
  Inquisition = 'inquisition',
  HolyWar = 'holy_war',
  PilgrimageEstablished = 'pilgrimage_established',
}

export const ALL_CHURCH_EVENT_TYPES: readonly ChurchEventType[] = Object.values(ChurchEventType);

// ── Prophet/Saint types ──────────────────────────────────────────────────────

export enum HolyFigureType {
  Prophet = 'prophet',
  Saint = 'saint',
  Martyr = 'martyr',
  Mystic = 'mystic',
  HolyWarrior = 'holy_warrior',
  Heretic = 'heretic',
}

export const ALL_HOLY_FIGURE_TYPES: readonly HolyFigureType[] = Object.values(HolyFigureType);

/**
 * A significant religious figure.
 */
export interface HolyFigure {
  readonly id: EntityId;
  readonly characterId: CharacterId;
  readonly religionId: EntityId;
  readonly deityId: DeityId;
  readonly type: HolyFigureType;
  readonly emergenceTick: number;
  readonly name: string;
  fame: number; // 0-100
  miracleCount: number;
  prophecies: string[];
  alive: boolean;
  deathTick: number | null;
  canonized: boolean;
}

// ── Divine power calculations ────────────────────────────────────────────────

/**
 * Calculate divine power from worshiper count and devotion.
 * Power = worshiperCount × (averageDevotion / 100) × basePowerLevel
 */
export function calculateDivinePower(
  worshiperCount: number,
  averageDevotionLevel: number,
  basePowerLevel: number,
): number {
  if (worshiperCount === 0) return 0;
  const devotionMultiplier = averageDevotionLevel / 100;
  const scaleFactor = Math.log10(worshiperCount + 1);
  return Math.round(scaleFactor * devotionMultiplier * basePowerLevel * 10);
}

/**
 * Check if a deity can perform an intervention.
 */
export function canIntervene(
  deity: SimDeity,
  interventionType: InterventionType,
  currentTick: number,
): { canDo: boolean; reason: string } {
  if (!deity.alive) {
    return { canDo: false, reason: 'Deity is dead' };
  }

  if (!deity.isInterventionist) {
    return { canDo: false, reason: 'Deity is not interventionist' };
  }

  const cost = INTERVENTION_COSTS[interventionType];

  if (deity.currentPower < cost.minimumPower) {
    return { canDo: false, reason: `Insufficient power (need ${cost.minimumPower}, have ${deity.currentPower})` };
  }

  const daysSinceLastIntervention = currentTick - deity.lastInterventionTick;
  if (daysSinceLastIntervention < cost.cooldownDays) {
    return { canDo: false, reason: `On cooldown (${cost.cooldownDays - daysSinceLastIntervention} days remaining)` };
  }

  return { canDo: true, reason: 'Can perform intervention' };
}

/**
 * Calculate the probability of a schism based on religion state.
 */
export function calculateSchismProbability(religion: Religion): number {
  // Base factors
  const corruptionFactor = religion.corruptionLevel / 200; // 50% at max corruption
  const reformFactor = religion.reformPressure / 300; // 33% at max reform pressure
  const sizeFactor = Math.min(0.2, religion.memberCount / 50000); // Larger religions more likely to split

  // Syncretic religions are more stable (blended beliefs)
  const syncreticStability = religion.syncreticInfluences.size * 0.02;

  const probability = corruptionFactor + reformFactor + sizeFactor - syncreticStability;
  return Math.max(0, Math.min(0.5, probability)); // Cap at 50%
}

/**
 * Calculate syncretism influence strength based on interaction type.
 */
export function calculateSyncretismInfluence(
  interactionType: 'trade' | 'conquest' | 'marriage' | 'migration',
  duration: number, // ticks of interaction
  intensity: number, // 0-1
): number {
  const baseInfluence: Record<string, number> = {
    trade: 0.1,
    conquest: 0.4,
    marriage: 0.25,
    migration: 0.3,
  };

  const base = baseInfluence[interactionType] ?? 0.1;
  const durationFactor = Math.min(1, duration / 3650); // Max after 10 years
  return base * durationFactor * intensity;
}

// ── ID generation ────────────────────────────────────────────────────────────

let nextDeitySimId = 80000;
let nextReligionId = 81000;
let nextHolyFigureId = 82000;

export function createDeitySimId(): DeityId {
  return toDeityId(toEntityId(nextDeitySimId++));
}

export function createReligionId(): EntityId {
  return toEntityId(nextReligionId++);
}

export function createHolyFigureId(): EntityId {
  return toEntityId(nextHolyFigureId++);
}

export function resetReligionIdCounters(): void {
  nextDeitySimId = 80000;
  nextReligionId = 81000;
  nextHolyFigureId = 82000;
}

// ── Religion System class ────────────────────────────────────────────────────

/**
 * The Religion System manages divine power, interventions, and church politics.
 * Runs at two frequencies:
 * - ANNUAL for divine power calculations and god death checks
 * - WEEKLY for devotion updates and minor events
 */
