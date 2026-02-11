/**
 * Ecological Pressure System — models environmental dynamics, resource depletion,
 * creature territories, invasive species, and environmental events.
 * Design doc Section 18.6
 */

import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { EntityId, RegionId } from '../ecs/types.js';
import { TickFrequency } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import {
  EcologicalResourceType,
  ALL_ECOLOGICAL_RESOURCE_TYPES,
  DegradationType,
  ALL_DEGRADATION_TYPES,
  EnvironmentalEventType,
  DEFAULT_ECOLOGY_CONFIG,
  calculateStockChange,
  isResourceCritical,
  isResourceDepleted,
  calculateDegradationRecovery,
  shouldTriggerEnvironmentalEvent,
  getDegradationEventType,
  canSettleInRegion,
  calculateExpansionProbability,
  canInvasiveSurvive,
  calculateInvasiveGrowth,
  calculateEventSeverity,
  calculateRecoveryTime,
  createEnvironmentalEventId,
} from './ecology-types.js';
import type {
  ResourceDepletionState,
  EnvironmentalDegradationState,
  CreatureTerritory,
  InvasiveSpecies,
  EnvironmentalEvent,
  EcologyConfig,
} from './ecology-types.js';

// Re-export all types for external consumers
export {
  EcologicalResourceType,
  ALL_ECOLOGICAL_RESOURCE_TYPES,
  DegradationType,
  ALL_DEGRADATION_TYPES,
  CreatureTerritoryType,
  ALL_CREATURE_TERRITORY_TYPES,
  InvasiveSpeciesBehavior,
  ALL_INVASIVE_BEHAVIORS,
  EnvironmentalEventType,
  ALL_ENVIRONMENTAL_EVENT_TYPES,
  DEFAULT_ECOLOGY_CONFIG,
  calculateStockChange,
  calculateHarvestPressure,
  isResourceCritical,
  isResourceDepleted,
  calculateDegradationIncrease,
  calculateDegradationRecovery,
  shouldTriggerEnvironmentalEvent,
  getDegradationEventType,
  calculateDeforestationRainfallImpact,
  isWithinTerritory,
  canSettleInRegion,
  calculateExpansionProbability,
  calculateTerritoryThreatLevel,
  calculateSpreadProbability,
  calculateInvasiveImpact,
  canInvasiveSurvive,
  calculateInvasiveGrowth,
  calculateEventSeverity,
  calculateEventCasualties,
  calculateEconomicDamage,
  calculateRecoveryTime,
  createTerritoryId,
  createInvasiveId,
  createEnvironmentalEventId,
  resetEcologyIdCounters,
} from './ecology-types.js';
export type {
  ResourceDepletionState,
  EnvironmentalDegradationState,
  CreatureTerritory,
  InvasiveSpecies,
  EnvironmentalEvent,
  EcologyConfig,
} from './ecology-types.js';

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
          estimatedCasualties: Math.floor(severity * 5),
          regionId,
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
