/**
 * Ecological Pressure System — models environmental dynamics, resource depletion,
 * creature territories, invasive species, and environmental events.
 * Design doc Section 18.6
 */

import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { EntityId, RegionId } from '../ecs/types.js';
import { toEntityId } from '../ecs/types.js';
import { TickFrequency } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { SeededRNG } from '../utils/seeded-rng.js';

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Types of harvestable resources subject to depletion.
 */
export enum EcologicalResourceType {
  Game = 'Game', // Wild animals for hunting
  Fish = 'Fish', // Fish populations
  Timber = 'Timber', // Forest resources
  Herbs = 'Herbs', // Medicinal/magical plants
  Ore = 'Ore', // Mining resources
  Water = 'Water', // Fresh water sources
  Soil = 'Soil', // Soil fertility
}

export const ALL_ECOLOGICAL_RESOURCE_TYPES: readonly EcologicalResourceType[] = [
  EcologicalResourceType.Game,
  EcologicalResourceType.Fish,
  EcologicalResourceType.Timber,
  EcologicalResourceType.Herbs,
  EcologicalResourceType.Ore,
  EcologicalResourceType.Water,
  EcologicalResourceType.Soil,
] as const;

/**
 * Types of environmental degradation.
 */
export enum DegradationType {
  Deforestation = 'Deforestation', // Forest clearing
  Erosion = 'Erosion', // Soil erosion
  MineInstability = 'MineInstability', // Mine shaft collapse risk
  MagicalPollution = 'MagicalPollution', // Magical contamination
  WaterPollution = 'WaterPollution', // Water contamination
  Desertification = 'Desertification', // Land becoming arid
  Overfishing = 'Overfishing', // Fish stock collapse
  Overhunting = 'Overhunting', // Wildlife depletion
}

export const ALL_DEGRADATION_TYPES: readonly DegradationType[] = [
  DegradationType.Deforestation,
  DegradationType.Erosion,
  DegradationType.MineInstability,
  DegradationType.MagicalPollution,
  DegradationType.WaterPollution,
  DegradationType.Desertification,
  DegradationType.Overfishing,
  DegradationType.Overhunting,
] as const;

/**
 * Types of powerful creature territories that constrain settlement.
 */
export enum CreatureTerritoryType {
  DragonLair = 'DragonLair', // Dragon-controlled area
  FeyForest = 'FeyForest', // Fey-dominated forest
  ElementalZone = 'ElementalZone', // Elemental manifestation
  UndeadDomain = 'UndeadDomain', // Area controlled by undead
  GiantClaim = 'GiantClaim', // Giant territory
  AbyssalRift = 'AbyssalRift', // Demonic incursion zone
  SeaMonsterWaters = 'SeaMonsterWaters', // Monster-infested waters
  HauntedLand = 'HauntedLand', // Ghost/spirit territory
}

export const ALL_CREATURE_TERRITORY_TYPES: readonly CreatureTerritoryType[] = [
  CreatureTerritoryType.DragonLair,
  CreatureTerritoryType.FeyForest,
  CreatureTerritoryType.ElementalZone,
  CreatureTerritoryType.UndeadDomain,
  CreatureTerritoryType.GiantClaim,
  CreatureTerritoryType.AbyssalRift,
  CreatureTerritoryType.SeaMonsterWaters,
  CreatureTerritoryType.HauntedLand,
] as const;

/**
 * Behavior patterns for invasive species.
 */
export enum InvasiveSpeciesBehavior {
  Aggressive = 'Aggressive', // Actively displaces native species
  Opportunistic = 'Opportunistic', // Takes advantage of disturbed areas
  Parasitic = 'Parasitic', // Harms host species
  Competitive = 'Competitive', // Competes for resources
  Predatory = 'Predatory', // Hunts native species
}

export const ALL_INVASIVE_BEHAVIORS: readonly InvasiveSpeciesBehavior[] = [
  InvasiveSpeciesBehavior.Aggressive,
  InvasiveSpeciesBehavior.Opportunistic,
  InvasiveSpeciesBehavior.Parasitic,
  InvasiveSpeciesBehavior.Competitive,
  InvasiveSpeciesBehavior.Predatory,
] as const;

/**
 * Types of environmental events triggered at degradation thresholds.
 */
export enum EnvironmentalEventType {
  MineCollapse = 'MineCollapse', // Mine shaft collapse
  Flood = 'Flood', // Flooding from deforestation
  Drought = 'Drought', // Water shortage
  WildfireNatural = 'WildfireNatural', // Natural wildfire
  CropFailure = 'CropFailure', // Soil exhaustion
  FishStockCollapse = 'FishStockCollapse', // Fish population crash
  WildlifeExtinction = 'WildlifeExtinction', // Local species extinction
  MagicalStorm = 'MagicalStorm', // Magical pollution event
  PlagueOutbreak = 'PlagueOutbreak', // Disease from ecological stress
  Landslide = 'Landslide', // Erosion-triggered landslide
}

export const ALL_ENVIRONMENTAL_EVENT_TYPES: readonly EnvironmentalEventType[] = [
  EnvironmentalEventType.MineCollapse,
  EnvironmentalEventType.Flood,
  EnvironmentalEventType.Drought,
  EnvironmentalEventType.WildfireNatural,
  EnvironmentalEventType.CropFailure,
  EnvironmentalEventType.FishStockCollapse,
  EnvironmentalEventType.WildlifeExtinction,
  EnvironmentalEventType.MagicalStorm,
  EnvironmentalEventType.PlagueOutbreak,
  EnvironmentalEventType.Landslide,
] as const;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Resource depletion state for a region.
 */
export interface ResourceDepletionState {
  readonly regionId: RegionId;
  /** Current stock level for each resource type (0-100) */
  stocks: Map<EcologicalResourceType, number>;
  /** Harvest pressure per resource (units extracted per month) */
  harvestPressure: Map<EcologicalResourceType, number>;
  /** Natural regeneration rate per resource (units per month) */
  regenerationRate: Map<EcologicalResourceType, number>;
  /** Baseline stock levels (for recovery calculation) */
  readonly baselineStocks: Map<EcologicalResourceType, number>;
}

/**
 * Environmental degradation state for a region.
 */
export interface EnvironmentalDegradationState {
  readonly regionId: RegionId;
  /** Degradation level per type (0-100, higher = worse) */
  degradationLevels: Map<DegradationType, number>;
  /** Active mitigation efforts per type */
  mitigationEfforts: Map<DegradationType, number>;
  /** Whether threshold event has fired for each type */
  thresholdEventFired: Map<DegradationType, boolean>;
}

/**
 * Creature territory data.
 */
export interface CreatureTerritory {
  readonly id: EntityId;
  readonly type: CreatureTerritoryType;
  readonly centerRegionId: RegionId;
  /** Regions controlled by this territory */
  controlledRegions: RegionId[];
  /** Power level of the controlling creature(s) (1-10) */
  threatLevel: number;
  /** Whether the territory is actively defended */
  isActive: boolean;
  /** Creature entity ID if applicable */
  controllerEntityId?: EntityId;
  /** Settlement exclusion radius in tiles */
  exclusionRadius: number;
}

/**
 * Invasive species population.
 */
export interface InvasiveSpecies {
  readonly id: EntityId;
  readonly speciesName: string;
  readonly behavior: InvasiveSpeciesBehavior;
  /** Regions where this species is present */
  presentInRegions: RegionId[];
  /** Population level per region (0-100) */
  populationLevels: Map<RegionId, number>;
  /** Spread rate (regions per season) */
  spreadRate: number;
  /** Impact on native species (0-1 multiplier) */
  nativeSpeciesImpact: number;
  /** Impact on resources */
  resourceImpact: Map<EcologicalResourceType, number>;
  /** Origin region */
  readonly originRegionId: RegionId;
  /** Tick when introduced */
  readonly introducedAt: number;
}

/**
 * Environmental event record.
 */
export interface EnvironmentalEvent {
  readonly id: EntityId;
  readonly type: EnvironmentalEventType;
  readonly regionId: RegionId;
  readonly triggeredAt: number;
  readonly severity: number; // 1-10
  /** Casualties from the event */
  casualties: number;
  /** Economic damage */
  economicDamage: number;
  /** Whether the event is ongoing */
  isOngoing: boolean;
  /** Ticks until recovery */
  recoveryTicks: number;
}

/**
 * Configuration for ecological simulation.
 */
export interface EcologyConfig {
  /** Base regeneration rate for resources (per month) */
  baseRegenerationRate: number;
  /** Degradation threshold to trigger events (0-100) */
  eventThreshold: number;
  /** How much degradation spreads to adjacent regions (0-1) */
  degradationSpreadFactor: number;
  /** Creature territory expansion rate per season */
  territoryExpansionRate: number;
  /** Invasive species spread probability per season */
  invasiveSpreadProbability: number;
  /** Population recovery rate after events (per season) */
  populationRecoveryRate: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_ECOLOGY_CONFIG: EcologyConfig = {
  baseRegenerationRate: 2, // 2% per month
  eventThreshold: 75, // 75% degradation triggers events
  degradationSpreadFactor: 0.1, // 10% spread to neighbors
  territoryExpansionRate: 0.5, // 50% chance to expand per season
  invasiveSpreadProbability: 0.3, // 30% chance to spread per season
  populationRecoveryRate: 5, // 5% per season
};

// =============================================================================
// ID GENERATION
// =============================================================================

let nextTerritoryId = 0;
let nextInvasiveId = 0;
let nextEnvironmentalEventId = 0;

export function createTerritoryId(): EntityId {
  return toEntityId(100000 + nextTerritoryId++);
}

export function createInvasiveId(): EntityId {
  return toEntityId(200000 + nextInvasiveId++);
}

export function createEnvironmentalEventId(): EntityId {
  return toEntityId(300000 + nextEnvironmentalEventId++);
}

export function resetEcologyIdCounters(): void {
  nextTerritoryId = 0;
  nextInvasiveId = 0;
  nextEnvironmentalEventId = 0;
}

// =============================================================================
// PURE FUNCTIONS — Resource Depletion
// =============================================================================

/**
 * Calculate new stock level after harvest and regeneration.
 */
export function calculateStockChange(
  currentStock: number,
  harvestPressure: number,
  regenerationRate: number,
  baselineStock: number,
): number {
  // Stock naturally regenerates toward baseline
  const regeneration =
    currentStock < baselineStock ? Math.min(regenerationRate, baselineStock - currentStock) : 0;

  // Apply harvest pressure
  const newStock = currentStock - harvestPressure + regeneration;

  // Clamp to valid range
  return Math.max(0, Math.min(100, newStock));
}

/**
 * Calculate harvest pressure from settlement population and activities.
 */
export function calculateHarvestPressure(
  population: number,
  resourceType: EcologicalResourceType,
  industrialActivity: number, // 0-1 scale
): number {
  // Base consumption per capita varies by resource
  const perCapitaRate: Record<EcologicalResourceType, number> = {
    [EcologicalResourceType.Game]: 0.01,
    [EcologicalResourceType.Fish]: 0.015,
    [EcologicalResourceType.Timber]: 0.02,
    [EcologicalResourceType.Herbs]: 0.005,
    [EcologicalResourceType.Ore]: 0.03,
    [EcologicalResourceType.Water]: 0.025,
    [EcologicalResourceType.Soil]: 0.01,
  };

  const baseRate = perCapitaRate[resourceType];
  const industrialMultiplier = 1 + industrialActivity * 2; // Industry doubles consumption

  return Math.min(10, population * baseRate * industrialMultiplier);
}

/**
 * Check if a resource is critically depleted.
 */
export function isResourceCritical(stock: number): boolean {
  return stock < 20;
}

/**
 * Check if a resource is depleted (extinct locally).
 */
export function isResourceDepleted(stock: number): boolean {
  return stock <= 0;
}

// =============================================================================
// PURE FUNCTIONS — Environmental Degradation
// =============================================================================

/**
 * Calculate degradation increase from activities.
 */
export function calculateDegradationIncrease(
  degradationType: DegradationType,
  activityLevel: number, // 0-10 scale
  mitigationEffort: number, // 0-10 scale
): number {
  // Base degradation rates per type
  const baseRates: Record<DegradationType, number> = {
    [DegradationType.Deforestation]: 2,
    [DegradationType.Erosion]: 1.5,
    [DegradationType.MineInstability]: 3,
    [DegradationType.MagicalPollution]: 2.5,
    [DegradationType.WaterPollution]: 2,
    [DegradationType.Desertification]: 1,
    [DegradationType.Overfishing]: 2,
    [DegradationType.Overhunting]: 1.5,
  };

  const baseRate = baseRates[degradationType];
  const mitigationReduction = Math.min(mitigationEffort * 0.5, activityLevel); // Can reduce up to 50%

  return Math.max(0, activityLevel * baseRate - mitigationReduction);
}

/**
 * Calculate natural degradation recovery rate.
 */
export function calculateDegradationRecovery(
  degradationType: DegradationType,
  currentLevel: number,
): number {
  // Some degradation types recover faster than others
  const recoveryRates: Record<DegradationType, number> = {
    [DegradationType.Deforestation]: 0.2, // Slow recovery
    [DegradationType.Erosion]: 0.1, // Very slow
    [DegradationType.MineInstability]: 0, // Does not recover naturally
    [DegradationType.MagicalPollution]: 0.5, // Moderate recovery
    [DegradationType.WaterPollution]: 1, // Fast recovery
    [DegradationType.Desertification]: 0.05, // Extremely slow
    [DegradationType.Overfishing]: 0.8, // Relatively fast
    [DegradationType.Overhunting]: 0.6, // Moderate
  };

  // Recovery is proportional to current level (faster when severe)
  const baseRecovery = recoveryRates[degradationType];
  return currentLevel > 50 ? baseRecovery * 1.5 : baseRecovery;
}

/**
 * Check if degradation has reached event threshold.
 */
export function shouldTriggerEnvironmentalEvent(
  degradationLevel: number,
  threshold: number,
): boolean {
  return degradationLevel >= threshold;
}

/**
 * Map degradation type to potential environmental event.
 */
export function getDegradationEventType(
  degradationType: DegradationType,
): EnvironmentalEventType | null {
  const mapping: Record<DegradationType, EnvironmentalEventType | null> = {
    [DegradationType.Deforestation]: EnvironmentalEventType.Flood,
    [DegradationType.Erosion]: EnvironmentalEventType.Landslide,
    [DegradationType.MineInstability]: EnvironmentalEventType.MineCollapse,
    [DegradationType.MagicalPollution]: EnvironmentalEventType.MagicalStorm,
    [DegradationType.WaterPollution]: EnvironmentalEventType.PlagueOutbreak,
    [DegradationType.Desertification]: EnvironmentalEventType.Drought,
    [DegradationType.Overfishing]: EnvironmentalEventType.FishStockCollapse,
    [DegradationType.Overhunting]: EnvironmentalEventType.WildlifeExtinction,
  };

  return mapping[degradationType] ?? null;
}

/**
 * Calculate deforestation's impact on local rainfall.
 */
export function calculateDeforestationRainfallImpact(
  deforestationLevel: number,
  baseRainfall: number,
): number {
  // Severe deforestation can reduce rainfall by up to 30%
  const reductionFactor = 1 - (deforestationLevel / 100) * 0.3;
  return Math.max(0, baseRainfall * reductionFactor);
}

// =============================================================================
// PURE FUNCTIONS — Creature Territories
// =============================================================================

/**
 * Check if a location is within a creature territory.
 */
export function isWithinTerritory(
  regionId: RegionId,
  territory: CreatureTerritory,
): boolean {
  return territory.controlledRegions.includes(regionId);
}

/**
 * Check if settlement is allowed in a region given creature territories.
 */
export function canSettleInRegion(
  regionId: RegionId,
  territories: readonly CreatureTerritory[],
): { allowed: boolean; blockingTerritory?: CreatureTerritory } {
  for (const territory of territories) {
    if (territory.isActive && isWithinTerritory(regionId, territory)) {
      return { allowed: false, blockingTerritory: territory };
    }
  }
  return { allowed: true };
}

/**
 * Calculate territory expansion probability based on threat level.
 */
export function calculateExpansionProbability(
  threatLevel: number,
  baseRate: number,
): number {
  // Higher threat creatures expand more aggressively
  return Math.min(1, baseRate * (threatLevel / 5));
}

/**
 * Calculate territory threat level based on creature power.
 */
export function calculateTerritoryThreatLevel(
  creaturePower: number,
  territoryAge: number, // in seasons
): number {
  // Threat increases as territory becomes more established
  const establishmentBonus = Math.min(2, territoryAge * 0.1);
  return Math.min(10, creaturePower + establishmentBonus);
}

// =============================================================================
// PURE FUNCTIONS — Invasive Species
// =============================================================================

/**
 * Calculate invasive species spread probability.
 */
export function calculateSpreadProbability(
  species: InvasiveSpecies,
  targetRegionDegradation: number,
  baseSpreadProbability: number,
): number {
  // Opportunistic species spread faster in degraded areas
  let probability = baseSpreadProbability;

  if (species.behavior === InvasiveSpeciesBehavior.Opportunistic) {
    probability += targetRegionDegradation / 200; // +0.5 max for heavily degraded
  }

  // Aggressive species have higher base spread
  if (species.behavior === InvasiveSpeciesBehavior.Aggressive) {
    probability *= 1.5;
  }

  return Math.min(1, probability * species.spreadRate);
}

/**
 * Calculate impact of invasive species on native populations.
 */
export function calculateInvasiveImpact(
  species: InvasiveSpecies,
  populationLevel: number,
): number {
  // Impact scales with population
  return species.nativeSpeciesImpact * (populationLevel / 100);
}

/**
 * Check if invasive species population can sustain itself.
 */
export function canInvasiveSurvive(
  populationLevel: number,
  resourceAvailability: number, // 0-100
): boolean {
  // Need at least 10% resources and 5% population to survive
  return populationLevel >= 5 && resourceAvailability >= 10;
}

/**
 * Calculate invasive population growth.
 */
export function calculateInvasiveGrowth(
  currentPopulation: number,
  resourceAvailability: number,
  nativeCompetition: number, // 0-100
): number {
  // Logistic growth with competition
  const carryingCapacity = resourceAvailability;
  const growthRate = 0.2 * (1 - nativeCompetition / 100);
  const growth = currentPopulation * growthRate * (1 - currentPopulation / carryingCapacity);

  return Math.max(0, Math.min(100, currentPopulation + growth));
}

// =============================================================================
// PURE FUNCTIONS — Environmental Events
// =============================================================================

/**
 * Calculate event severity based on degradation level.
 */
export function calculateEventSeverity(
  degradationLevel: number,
  eventType: EnvironmentalEventType,
): number {
  // Base severity from 1-10
  const baseSeverity = Math.ceil(degradationLevel / 10);

  // Some events are inherently more severe
  const severityMultipliers: Record<EnvironmentalEventType, number> = {
    [EnvironmentalEventType.MineCollapse]: 1.5,
    [EnvironmentalEventType.Flood]: 1.3,
    [EnvironmentalEventType.Drought]: 1.0,
    [EnvironmentalEventType.WildfireNatural]: 1.4,
    [EnvironmentalEventType.CropFailure]: 1.0,
    [EnvironmentalEventType.FishStockCollapse]: 0.8,
    [EnvironmentalEventType.WildlifeExtinction]: 0.7,
    [EnvironmentalEventType.MagicalStorm]: 1.6,
    [EnvironmentalEventType.PlagueOutbreak]: 1.5,
    [EnvironmentalEventType.Landslide]: 1.2,
  };

  return Math.min(10, Math.ceil(baseSeverity * severityMultipliers[eventType]));
}

/**
 * Calculate casualties from an environmental event.
 */
export function calculateEventCasualties(
  severity: number,
  populationAtRisk: number,
  preparedness: number, // 0-1, higher = better prepared
): number {
  // Base casualty rate increases with severity
  const baseCasualtyRate = severity * 0.01; // 1% per severity level
  const mitigatedRate = baseCasualtyRate * (1 - preparedness * 0.8); // Prep can reduce by 80%

  return Math.floor(populationAtRisk * mitigatedRate);
}

/**
 * Calculate economic damage from an environmental event.
 */
export function calculateEconomicDamage(
  severity: number,
  regionalWealth: number,
  eventType: EnvironmentalEventType,
): number {
  // Economic impact varies by event type
  const damageMultipliers: Record<EnvironmentalEventType, number> = {
    [EnvironmentalEventType.MineCollapse]: 0.3,
    [EnvironmentalEventType.Flood]: 0.25,
    [EnvironmentalEventType.Drought]: 0.2,
    [EnvironmentalEventType.WildfireNatural]: 0.3,
    [EnvironmentalEventType.CropFailure]: 0.15,
    [EnvironmentalEventType.FishStockCollapse]: 0.1,
    [EnvironmentalEventType.WildlifeExtinction]: 0.05,
    [EnvironmentalEventType.MagicalStorm]: 0.35,
    [EnvironmentalEventType.PlagueOutbreak]: 0.2,
    [EnvironmentalEventType.Landslide]: 0.2,
  };

  const baseDamage = regionalWealth * damageMultipliers[eventType];
  return Math.floor(baseDamage * (severity / 10));
}

/**
 * Calculate recovery time for an environmental event.
 */
export function calculateRecoveryTime(
  severity: number,
  eventType: EnvironmentalEventType,
): number {
  // Base recovery in ticks (days)
  const baseRecovery: Record<EnvironmentalEventType, number> = {
    [EnvironmentalEventType.MineCollapse]: 365, // 1 year
    [EnvironmentalEventType.Flood]: 90, // 3 months
    [EnvironmentalEventType.Drought]: 180, // 6 months
    [EnvironmentalEventType.WildfireNatural]: 365, // 1 year
    [EnvironmentalEventType.CropFailure]: 365, // 1 year (next harvest)
    [EnvironmentalEventType.FishStockCollapse]: 730, // 2 years
    [EnvironmentalEventType.WildlifeExtinction]: 1825, // 5 years
    [EnvironmentalEventType.MagicalStorm]: 30, // 1 month
    [EnvironmentalEventType.PlagueOutbreak]: 90, // 3 months
    [EnvironmentalEventType.Landslide]: 180, // 6 months
  };

  return Math.ceil(baseRecovery[eventType] * (severity / 5));
}

// =============================================================================
// ECOLOGY SYSTEM
// =============================================================================

/**
 * EcologySystem manages environmental dynamics.
 * Runs MONTHLY for resource checks and SEASONAL for population dynamics.
 */
export class EcologySystem extends BaseSystem {
  readonly name = 'EcologySystem';
  readonly frequency = TickFrequency.Monthly; // Primary frequency
  readonly executionOrder = ExecutionOrder.ENVIRONMENT;

  private config: EcologyConfig;
  private resourceStates: Map<RegionId, ResourceDepletionState> = new Map();
  private degradationStates: Map<RegionId, EnvironmentalDegradationState> = new Map();
  private territories: Map<EntityId, CreatureTerritory> = new Map();
  private invasiveSpecies: Map<EntityId, InvasiveSpecies> = new Map();
  private environmentalEvents: Map<EntityId, EnvironmentalEvent> = new Map();
  private readonly rng: SeededRNG;
  private lastSeasonalTick = 0;

  constructor(config?: Partial<EcologyConfig>, rng?: SeededRNG) {
    super();
    this.config = { ...DEFAULT_ECOLOGY_CONFIG, ...(config ?? {}) };
    this.rng = rng ?? new SeededRNG(0);
  }

  // --- Registration Methods ---

  registerRegion(
    regionId: RegionId,
    initialStocks: Map<EcologicalResourceType, number>,
  ): void {
    // Create resource depletion state
    const stocks = new Map<EcologicalResourceType, number>();
    const baselineStocks = new Map<EcologicalResourceType, number>();
    const harvestPressure = new Map<EcologicalResourceType, number>();
    const regenerationRate = new Map<EcologicalResourceType, number>();

    for (const resourceType of ALL_ECOLOGICAL_RESOURCE_TYPES) {
      const stock = initialStocks.get(resourceType) ?? 100;
      stocks.set(resourceType, stock);
      baselineStocks.set(resourceType, stock);
      harvestPressure.set(resourceType, 0);
      regenerationRate.set(resourceType, this.config.baseRegenerationRate);
    }

    this.resourceStates.set(regionId, {
      regionId,
      stocks,
      harvestPressure,
      regenerationRate,
      baselineStocks,
    });

    // Create degradation state
    const degradationLevels = new Map<DegradationType, number>();
    const mitigationEfforts = new Map<DegradationType, number>();
    const thresholdEventFired = new Map<DegradationType, boolean>();

    for (const degradationType of ALL_DEGRADATION_TYPES) {
      degradationLevels.set(degradationType, 0);
      mitigationEfforts.set(degradationType, 0);
      thresholdEventFired.set(degradationType, false);
    }

    this.degradationStates.set(regionId, {
      regionId,
      degradationLevels,
      mitigationEfforts,
      thresholdEventFired,
    });
  }

  registerTerritory(territory: CreatureTerritory): void {
    this.territories.set(territory.id, territory);
  }

  registerInvasiveSpecies(species: InvasiveSpecies): void {
    this.invasiveSpecies.set(species.id, species);
  }

  // --- Getters ---

  getResourceState(regionId: RegionId): ResourceDepletionState | undefined {
    return this.resourceStates.get(regionId);
  }

  getDegradationState(regionId: RegionId): EnvironmentalDegradationState | undefined {
    return this.degradationStates.get(regionId);
  }

  getTerritory(territoryId: EntityId): CreatureTerritory | undefined {
    return this.territories.get(territoryId);
  }

  getAllTerritories(): readonly CreatureTerritory[] {
    return Array.from(this.territories.values());
  }

  getInvasiveSpecies(speciesId: EntityId): InvasiveSpecies | undefined {
    return this.invasiveSpecies.get(speciesId);
  }

  getAllInvasiveSpecies(): readonly InvasiveSpecies[] {
    return Array.from(this.invasiveSpecies.values());
  }

  getEnvironmentalEvent(eventId: EntityId): EnvironmentalEvent | undefined {
    return this.environmentalEvents.get(eventId);
  }

  getAllEnvironmentalEvents(): readonly EnvironmentalEvent[] {
    return Array.from(this.environmentalEvents.values());
  }

  canSettleAt(regionId: RegionId): { allowed: boolean; reason?: string } {
    const result = canSettleInRegion(regionId, this.getAllTerritories());
    if (!result.allowed && result.blockingTerritory !== undefined) {
      return {
        allowed: false,
        reason: `Blocked by ${result.blockingTerritory.type} territory`,
      };
    }
    return { allowed: true };
  }

  // --- Mutation Methods ---

  setHarvestPressure(
    regionId: RegionId,
    resourceType: EcologicalResourceType,
    pressure: number,
  ): void {
    const state = this.resourceStates.get(regionId);
    if (state !== undefined) {
      state.harvestPressure.set(resourceType, pressure);
    }
  }

  setMitigationEffort(
    regionId: RegionId,
    degradationType: DegradationType,
    effort: number,
  ): void {
    const state = this.degradationStates.get(regionId);
    if (state !== undefined) {
      state.mitigationEfforts.set(degradationType, effort);
    }
  }

  addDegradation(
    regionId: RegionId,
    degradationType: DegradationType,
    amount: number,
  ): void {
    const state = this.degradationStates.get(regionId);
    if (state !== undefined) {
      const current = state.degradationLevels.get(degradationType) ?? 0;
      state.degradationLevels.set(degradationType, Math.min(100, current + amount));
    }
  }

  // --- System Execution ---

  execute(_world: World, clock: WorldClock, events: EventBus): void {
    const currentTick = clock.currentTick;

    // Monthly: Resource depletion and degradation checks
    this.processResourceDepletion(currentTick, events);
    this.processDegradation(currentTick, events);
    this.processOngoingEvents(currentTick, events);

    // Seasonal: Population dynamics (every 90 ticks)
    if (currentTick - this.lastSeasonalTick >= TickFrequency.Seasonal) {
      this.lastSeasonalTick = currentTick;
      this.processCreatureTerritories(currentTick, events);
      this.processInvasiveSpecies(currentTick, events);
    }
  }

  private processResourceDepletion(currentTick: number, events: EventBus): void {
    for (const state of this.resourceStates.values()) {
      for (const resourceType of ALL_ECOLOGICAL_RESOURCE_TYPES) {
        const currentStock = state.stocks.get(resourceType) ?? 0;
        const pressure = state.harvestPressure.get(resourceType) ?? 0;
        const regen = state.regenerationRate.get(resourceType) ?? 0;
        const baseline = state.baselineStocks.get(resourceType) ?? 100;

        const newStock = calculateStockChange(currentStock, pressure, regen, baseline);
        state.stocks.set(resourceType, newStock);

        // Emit events for critical depletion
        if (!isResourceCritical(currentStock) && isResourceCritical(newStock)) {
          events.emit(
            createEvent({
              category: EventCategory.Disaster,
              subtype: 'ecology.resource_critical',
              timestamp: currentTick,
              participants: [state.regionId as unknown as EntityId],
              significance: 40,
              data: { resourceType, stockLevel: newStock },
            }),
          );
        }

        if (!isResourceDepleted(currentStock) && isResourceDepleted(newStock)) {
          events.emit(
            createEvent({
              category: EventCategory.Disaster,
              subtype: 'ecology.resource_depleted',
              timestamp: currentTick,
              participants: [state.regionId as unknown as EntityId],
              significance: 60,
              data: { resourceType },
            }),
          );
        }
      }
    }
  }

  private processDegradation(currentTick: number, events: EventBus): void {
    for (const state of this.degradationStates.values()) {
      for (const degradationType of ALL_DEGRADATION_TYPES) {
        const currentLevel = state.degradationLevels.get(degradationType) ?? 0;
        const eventFired = state.thresholdEventFired.get(degradationType) ?? false;

        // Natural recovery
        const recovery = calculateDegradationRecovery(degradationType, currentLevel);
        const newLevel = Math.max(0, currentLevel - recovery);
        state.degradationLevels.set(degradationType, newLevel);

        // Check threshold events
        if (
          !eventFired &&
          shouldTriggerEnvironmentalEvent(newLevel, this.config.eventThreshold)
        ) {
          state.thresholdEventFired.set(degradationType, true);

          const eventType = getDegradationEventType(degradationType);
          if (eventType !== null) {
            this.triggerEnvironmentalEvent(state.regionId, eventType, newLevel, currentTick, events);
          }
        }

        // Reset threshold flag if degradation drops below threshold
        if (eventFired && newLevel < this.config.eventThreshold - 10) {
          state.thresholdEventFired.set(degradationType, false);
        }
      }
    }
  }

  private triggerEnvironmentalEvent(
    regionId: RegionId,
    eventType: EnvironmentalEventType,
    degradationLevel: number,
    currentTick: number,
    eventBus: EventBus,
  ): void {
    const severity = calculateEventSeverity(degradationLevel, eventType);
    const recoveryTicks = calculateRecoveryTime(severity, eventType);

    const envEvent: EnvironmentalEvent = {
      id: createEnvironmentalEventId(),
      type: eventType,
      regionId,
      triggeredAt: currentTick,
      severity,
      casualties: 0, // Will be calculated when applied to settlements
      economicDamage: 0,
      isOngoing: true,
      recoveryTicks,
    };

    this.environmentalEvents.set(envEvent.id, envEvent);

    eventBus.emit(
      createEvent({
        category: EventCategory.Disaster,
        subtype: `ecology.${eventType.toLowerCase()}`,
        timestamp: currentTick,
        participants: [regionId as unknown as EntityId],
        significance: 50 + severity * 5,
        data: {
          eventType,
          severity,
          recoveryTicks,
          environmentalEventId: envEvent.id,
        },
      }),
    );
  }

  private processOngoingEvents(currentTick: number, events: EventBus): void {
    for (const envEvent of this.environmentalEvents.values()) {
      if (!envEvent.isOngoing) continue;

      const elapsed = currentTick - envEvent.triggeredAt;
      if (elapsed >= envEvent.recoveryTicks) {
        (envEvent as { isOngoing: boolean }).isOngoing = false;

        events.emit(
          createEvent({
            category: EventCategory.Disaster,
            subtype: 'ecology.event_recovered',
            timestamp: currentTick,
            participants: [envEvent.regionId as unknown as EntityId],
            significance: 30,
            data: {
              eventType: envEvent.type,
              recoveryTime: elapsed,
            },
          }),
        );
      }
    }
  }

  private processCreatureTerritories(currentTick: number, events: EventBus): void {
    for (const territory of this.territories.values()) {
      if (!territory.isActive) continue;

      // Chance to expand territory
      const expansionProb = calculateExpansionProbability(
        territory.threatLevel,
        this.config.territoryExpansionRate,
      );

      // Simple expansion check (would need adjacent region logic in real impl)
      if (this.rng.next() < expansionProb) {
        events.emit(
          createEvent({
            category: EventCategory.Disaster,
            subtype: 'ecology.territory_expanded',
            timestamp: currentTick,
            participants: [territory.id],
            significance: 35,
            data: {
              territoryType: territory.type,
              threatLevel: territory.threatLevel,
            },
          }),
        );
      }
    }
  }

  private processInvasiveSpecies(currentTick: number, events: EventBus): void {
    for (const species of this.invasiveSpecies.values()) {
      // Process population dynamics in each region
      for (const regionId of species.presentInRegions) {
        const currentPop = species.populationLevels.get(regionId) ?? 0;

        // Get resource availability from region state
        const resourceState = this.resourceStates.get(regionId);
        const resourceAvailability =
          resourceState !== undefined
            ? (resourceState.stocks.get(EcologicalResourceType.Herbs) ?? 50)
            : 50;

        const newPop = calculateInvasiveGrowth(currentPop, resourceAvailability, 50);
        species.populationLevels.set(regionId, newPop);

        // Check for population collapse
        if (!canInvasiveSurvive(newPop, resourceAvailability)) {
          species.populationLevels.set(regionId, 0);
          const index = species.presentInRegions.indexOf(regionId);
          if (index >= 0) {
            species.presentInRegions.splice(index, 1);
          }
        }
      }

      // Check for spread to new regions
      if (this.rng.next() < this.config.invasiveSpreadProbability * species.spreadRate) {
        events.emit(
          createEvent({
            category: EventCategory.Disaster,
            subtype: 'ecology.invasive_spread',
            timestamp: currentTick,
            participants: [species.id],
            significance: 40,
            data: {
              speciesName: species.speciesName,
              behavior: species.behavior,
              regionCount: species.presentInRegions.length,
            },
          }),
        );
      }
    }
  }
}
