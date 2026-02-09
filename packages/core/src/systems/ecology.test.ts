/**
 * Tests for the Ecological Pressure System.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { toRegionId, toEntityId } from '../ecs/types.js';
import type { RegionId, EntityId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory, type WorldEvent } from '../events/types.js';
import { TickFrequency } from '../time/types.js';
import { ExecutionOrder } from '../engine/system.js';
import {
  // Enums
  EcologicalResourceType,
  DegradationType,
  ALL_DEGRADATION_TYPES,
  CreatureTerritoryType,
  InvasiveSpeciesBehavior,
  EnvironmentalEventType,
  // Pure functions - Resource Depletion
  calculateStockChange,
  calculateHarvestPressure,
  isResourceCritical,
  isResourceDepleted,
  // Pure functions - Environmental Degradation
  calculateDegradationIncrease,
  calculateDegradationRecovery,
  shouldTriggerEnvironmentalEvent,
  getDegradationEventType,
  calculateDeforestationRainfallImpact,
  // Pure functions - Creature Territories
  isWithinTerritory,
  canSettleInRegion,
  calculateExpansionProbability,
  calculateTerritoryThreatLevel,
  // Pure functions - Invasive Species
  calculateSpreadProbability,
  calculateInvasiveImpact,
  canInvasiveSurvive,
  calculateInvasiveGrowth,
  // Pure functions - Environmental Events
  calculateEventSeverity,
  calculateEventCasualties,
  calculateEconomicDamage,
  calculateRecoveryTime,
  // System
  EcologySystem,
  DEFAULT_ECOLOGY_CONFIG,
  // ID functions
  createTerritoryId,
  createInvasiveId,
  createEnvironmentalEventId,
  resetEcologyIdCounters,
  // Types
  type CreatureTerritory,
  type InvasiveSpecies,
  type EcologyConfig,
} from './ecology.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function rid(n: number): RegionId {
  return toRegionId(toEntityId(n));
}

function eid(n: number): EntityId {
  return toEntityId(n);
}

function makeTerritory(
  overrides: Partial<CreatureTerritory> & { id: EntityId },
): CreatureTerritory {
  return {
    type: CreatureTerritoryType.DragonLair,
    centerRegionId: rid(1),
    controlledRegions: [rid(1)],
    threatLevel: 5,
    isActive: true,
    exclusionRadius: 3,
    ...overrides,
  };
}

function makeInvasiveSpecies(
  overrides: Partial<InvasiveSpecies> & { id: EntityId },
): InvasiveSpecies {
  return {
    speciesName: 'Dire Rats',
    behavior: InvasiveSpeciesBehavior.Aggressive,
    presentInRegions: [rid(1)],
    populationLevels: new Map([[rid(1), 50]]),
    spreadRate: 1.0,
    nativeSpeciesImpact: 0.5,
    resourceImpact: new Map([[EcologicalResourceType.Herbs, 0.2]]),
    originRegionId: rid(1),
    introducedAt: 0,
    ...overrides,
  };
}

function createMockWorld(): World {
  return {} as World;
}

function setupEcologySystem(
  config: Partial<EcologyConfig> = {},
): {
  system: EcologySystem;
  world: World;
  clock: WorldClock;
  events: EventBus;
  emittedEvents: WorldEvent[];
} {
  resetEcologyIdCounters();

  const system = new EcologySystem(config);
  const world = createMockWorld();
  const clock = new WorldClock();
  const events = new EventBus();
  const emittedEvents: WorldEvent[] = [];

  events.on(EventCategory.Disaster, (event) => emittedEvents.push(event));

  system.initialize(world);

  return { system, world, clock, events, emittedEvents };
}

// =============================================================================
// RESOURCE DEPLETION TESTS
// =============================================================================

describe('Resource Depletion', () => {
  describe('calculateStockChange', () => {
    it('should reduce stock when harvest exceeds regeneration', () => {
      const newStock = calculateStockChange(80, 5, 2, 100);
      // 80 - 5 + 2 = 77 (regen applies since below baseline)
      expect(newStock).toBe(77);
    });

    it('should not regenerate above baseline', () => {
      const newStock = calculateStockChange(100, 0, 5, 100);
      // Already at baseline, no regen needed
      expect(newStock).toBe(100);
    });

    it('should clamp stock to 0 minimum', () => {
      const newStock = calculateStockChange(5, 10, 0, 100);
      expect(newStock).toBe(0);
    });

    it('should clamp stock to 100 maximum', () => {
      const newStock = calculateStockChange(98, 0, 5, 100);
      // Would be 98 + 2 (limited regen) = 100
      expect(newStock).toBe(100);
    });

    it('should allow full regeneration when far below baseline', () => {
      const newStock = calculateStockChange(50, 0, 10, 100);
      expect(newStock).toBe(60);
    });
  });

  describe('calculateHarvestPressure', () => {
    it('should calculate base pressure from population', () => {
      const pressure = calculateHarvestPressure(1000, EcologicalResourceType.Game, 0);
      // 1000 * 0.01 * 1 = 10
      expect(pressure).toBe(10);
    });

    it('should increase pressure with industrial activity', () => {
      // Use smaller population to avoid hitting the cap
      const baseP = calculateHarvestPressure(100, EcologicalResourceType.Ore, 0);
      const indP = calculateHarvestPressure(100, EcologicalResourceType.Ore, 1);
      // Industrial multiplier is 1 + 1*2 = 3
      // baseP = 100 * 0.03 * 1 = 3
      // indP = 100 * 0.03 * 3 = 9
      expect(indP).toBeGreaterThan(baseP);
      expect(indP).toBeCloseTo(baseP * 3);
    });

    it('should cap pressure at 10', () => {
      const pressure = calculateHarvestPressure(10000, EcologicalResourceType.Timber, 1);
      expect(pressure).toBe(10);
    });

    it('should have different rates for different resources', () => {
      // Use smaller population to avoid hitting the cap (game=0.01, fish=0.015)
      const gamePressure = calculateHarvestPressure(500, EcologicalResourceType.Game, 0);
      const fishPressure = calculateHarvestPressure(500, EcologicalResourceType.Fish, 0);
      // gamePressure = 500 * 0.01 = 5
      // fishPressure = 500 * 0.015 = 7.5
      expect(fishPressure).toBeGreaterThan(gamePressure);
    });
  });

  describe('isResourceCritical', () => {
    it('should return true when stock below 20', () => {
      expect(isResourceCritical(19)).toBe(true);
      expect(isResourceCritical(10)).toBe(true);
      expect(isResourceCritical(0)).toBe(true);
    });

    it('should return false when stock at or above 20', () => {
      expect(isResourceCritical(20)).toBe(false);
      expect(isResourceCritical(50)).toBe(false);
      expect(isResourceCritical(100)).toBe(false);
    });
  });

  describe('isResourceDepleted', () => {
    it('should return true only when stock is 0 or below', () => {
      expect(isResourceDepleted(0)).toBe(true);
      expect(isResourceDepleted(-1)).toBe(true);
    });

    it('should return false when any stock remains', () => {
      expect(isResourceDepleted(1)).toBe(false);
      expect(isResourceDepleted(0.1)).toBe(false);
    });
  });
});

// =============================================================================
// ENVIRONMENTAL DEGRADATION TESTS
// =============================================================================

describe('Environmental Degradation', () => {
  describe('calculateDegradationIncrease', () => {
    it('should calculate base degradation from activity', () => {
      const increase = calculateDegradationIncrease(DegradationType.Deforestation, 5, 0);
      // 5 * 2 (base rate for deforestation) = 10
      expect(increase).toBe(10);
    });

    it('should reduce degradation with mitigation', () => {
      const withoutMit = calculateDegradationIncrease(DegradationType.Deforestation, 5, 0);
      const withMit = calculateDegradationIncrease(DegradationType.Deforestation, 5, 4);
      // Mitigation of 4 reduces by 4*0.5 = 2
      expect(withMit).toBe(withoutMit - 2);
    });

    it('should not go below 0', () => {
      // Use Desertification (baseRate = 1) with activityLevel = 1
      // mitigationReduction = min(10 * 0.5, 1) = 1
      // result = 1 * 1 - 1 = 0
      const increase = calculateDegradationIncrease(DegradationType.Desertification, 1, 10);
      expect(increase).toBe(0);
    });

    it('should have higher rates for mine instability', () => {
      const mineRate = calculateDegradationIncrease(DegradationType.MineInstability, 5, 0);
      const erosionRate = calculateDegradationIncrease(DegradationType.Erosion, 5, 0);
      expect(mineRate).toBeGreaterThan(erosionRate);
    });
  });

  describe('calculateDegradationRecovery', () => {
    it('should return 0 for mine instability (no natural recovery)', () => {
      expect(calculateDegradationRecovery(DegradationType.MineInstability, 50)).toBe(0);
      expect(calculateDegradationRecovery(DegradationType.MineInstability, 100)).toBe(0);
    });

    it('should return higher recovery for water pollution', () => {
      const waterRecovery = calculateDegradationRecovery(DegradationType.WaterPollution, 30);
      const erosionRecovery = calculateDegradationRecovery(DegradationType.Erosion, 30);
      expect(waterRecovery).toBeGreaterThan(erosionRecovery);
    });

    it('should increase recovery rate when degradation is severe', () => {
      const mildRecovery = calculateDegradationRecovery(DegradationType.WaterPollution, 30);
      const severeRecovery = calculateDegradationRecovery(DegradationType.WaterPollution, 60);
      expect(severeRecovery).toBeGreaterThan(mildRecovery);
    });
  });

  describe('shouldTriggerEnvironmentalEvent', () => {
    it('should return true when degradation meets threshold', () => {
      expect(shouldTriggerEnvironmentalEvent(75, 75)).toBe(true);
      expect(shouldTriggerEnvironmentalEvent(80, 75)).toBe(true);
    });

    it('should return false when degradation below threshold', () => {
      expect(shouldTriggerEnvironmentalEvent(74, 75)).toBe(false);
      expect(shouldTriggerEnvironmentalEvent(50, 75)).toBe(false);
    });
  });

  describe('getDegradationEventType', () => {
    it('should map deforestation to flood', () => {
      expect(getDegradationEventType(DegradationType.Deforestation)).toBe(
        EnvironmentalEventType.Flood,
      );
    });

    it('should map erosion to landslide', () => {
      expect(getDegradationEventType(DegradationType.Erosion)).toBe(
        EnvironmentalEventType.Landslide,
      );
    });

    it('should map mine instability to mine collapse', () => {
      expect(getDegradationEventType(DegradationType.MineInstability)).toBe(
        EnvironmentalEventType.MineCollapse,
      );
    });

    it('should map magical pollution to magical storm', () => {
      expect(getDegradationEventType(DegradationType.MagicalPollution)).toBe(
        EnvironmentalEventType.MagicalStorm,
      );
    });

    it('should map all degradation types', () => {
      for (const type of ALL_DEGRADATION_TYPES) {
        const eventType = getDegradationEventType(type);
        expect(eventType).not.toBeNull();
      }
    });
  });

  describe('calculateDeforestationRainfallImpact', () => {
    it('should reduce rainfall with high deforestation', () => {
      const baseRainfall = 100;
      const impactedRainfall = calculateDeforestationRainfallImpact(80, baseRainfall);
      // 80% deforestation = 0.3 * 0.8 = 24% reduction
      expect(impactedRainfall).toBeCloseTo(76);
    });

    it('should not affect rainfall with no deforestation', () => {
      const baseRainfall = 100;
      const impactedRainfall = calculateDeforestationRainfallImpact(0, baseRainfall);
      expect(impactedRainfall).toBe(100);
    });

    it('should reduce rainfall by max 30% at 100% deforestation', () => {
      const baseRainfall = 100;
      const impactedRainfall = calculateDeforestationRainfallImpact(100, baseRainfall);
      expect(impactedRainfall).toBe(70);
    });
  });
});

// =============================================================================
// CREATURE TERRITORY TESTS
// =============================================================================

describe('Creature Territories', () => {
  describe('isWithinTerritory', () => {
    it('should return true for controlled regions', () => {
      const territory = makeTerritory({
        id: eid(1),
        controlledRegions: [rid(1), rid(2), rid(3)],
      });
      expect(isWithinTerritory(rid(1), territory)).toBe(true);
      expect(isWithinTerritory(rid(2), territory)).toBe(true);
    });

    it('should return false for uncontrolled regions', () => {
      const territory = makeTerritory({
        id: eid(1),
        controlledRegions: [rid(1)],
      });
      expect(isWithinTerritory(rid(2), territory)).toBe(false);
      expect(isWithinTerritory(rid(99), territory)).toBe(false);
    });
  });

  describe('canSettleInRegion', () => {
    it('should allow settlement when no territories present', () => {
      const result = canSettleInRegion(rid(1), []);
      expect(result.allowed).toBe(true);
    });

    it('should block settlement in active dragon territory', () => {
      const territory = makeTerritory({
        id: eid(1),
        type: CreatureTerritoryType.DragonLair,
        controlledRegions: [rid(1), rid(2)],
        isActive: true,
      });
      const result = canSettleInRegion(rid(1), [territory]);
      expect(result.allowed).toBe(false);
      expect(result.blockingTerritory).toBe(territory);
    });

    it('should allow settlement in inactive territory', () => {
      const territory = makeTerritory({
        id: eid(1),
        controlledRegions: [rid(1)],
        isActive: false,
      });
      const result = canSettleInRegion(rid(1), [territory]);
      expect(result.allowed).toBe(true);
    });

    it('should allow settlement outside territory bounds', () => {
      const territory = makeTerritory({
        id: eid(1),
        controlledRegions: [rid(1)],
        isActive: true,
      });
      const result = canSettleInRegion(rid(5), [territory]);
      expect(result.allowed).toBe(true);
    });

    it('should check all territories for blocking', () => {
      const t1 = makeTerritory({ id: eid(1), controlledRegions: [rid(1)], isActive: true });
      const t2 = makeTerritory({ id: eid(2), controlledRegions: [rid(2)], isActive: true });

      expect(canSettleInRegion(rid(1), [t1, t2]).allowed).toBe(false);
      expect(canSettleInRegion(rid(2), [t1, t2]).allowed).toBe(false);
      expect(canSettleInRegion(rid(3), [t1, t2]).allowed).toBe(true);
    });
  });

  describe('calculateExpansionProbability', () => {
    it('should increase probability with higher threat level', () => {
      const lowThreat = calculateExpansionProbability(2, 0.5);
      const highThreat = calculateExpansionProbability(8, 0.5);
      expect(highThreat).toBeGreaterThan(lowThreat);
    });

    it('should cap probability at 1', () => {
      const prob = calculateExpansionProbability(10, 1.0);
      expect(prob).toBeLessThanOrEqual(1);
    });

    it('should scale with base rate', () => {
      const lowRate = calculateExpansionProbability(5, 0.2);
      const highRate = calculateExpansionProbability(5, 0.8);
      expect(highRate).toBeGreaterThan(lowRate);
    });
  });

  describe('calculateTerritoryThreatLevel', () => {
    it('should increase threat with creature power', () => {
      const weak = calculateTerritoryThreatLevel(3, 0);
      const strong = calculateTerritoryThreatLevel(7, 0);
      expect(strong).toBeGreaterThan(weak);
    });

    it('should increase threat with establishment time', () => {
      const newTerritory = calculateTerritoryThreatLevel(5, 0);
      const oldTerritory = calculateTerritoryThreatLevel(5, 10);
      expect(oldTerritory).toBeGreaterThan(newTerritory);
    });

    it('should cap threat at 10', () => {
      const threat = calculateTerritoryThreatLevel(10, 50);
      expect(threat).toBe(10);
    });
  });
});

// =============================================================================
// INVASIVE SPECIES TESTS
// =============================================================================

describe('Invasive Species', () => {
  describe('calculateSpreadProbability', () => {
    it('should return base probability for normal species', () => {
      const species = makeInvasiveSpecies({
        id: eid(1),
        behavior: InvasiveSpeciesBehavior.Competitive,
        spreadRate: 1.0,
      });
      const prob = calculateSpreadProbability(species, 0, 0.3);
      expect(prob).toBeCloseTo(0.3);
    });

    it('should increase probability for opportunistic in degraded areas', () => {
      const species = makeInvasiveSpecies({
        id: eid(1),
        behavior: InvasiveSpeciesBehavior.Opportunistic,
        spreadRate: 1.0,
      });
      const cleanProb = calculateSpreadProbability(species, 0, 0.3);
      const degradedProb = calculateSpreadProbability(species, 80, 0.3);
      expect(degradedProb).toBeGreaterThan(cleanProb);
    });

    it('should multiply probability for aggressive species', () => {
      const species = makeInvasiveSpecies({
        id: eid(1),
        behavior: InvasiveSpeciesBehavior.Aggressive,
        spreadRate: 1.0,
      });
      const prob = calculateSpreadProbability(species, 0, 0.3);
      expect(prob).toBeCloseTo(0.45); // 0.3 * 1.5
    });

    it('should scale with spread rate', () => {
      const slow = makeInvasiveSpecies({ id: eid(1), spreadRate: 0.5 });
      const fast = makeInvasiveSpecies({ id: eid(2), spreadRate: 2.0 });
      const slowProb = calculateSpreadProbability(slow, 0, 0.3);
      const fastProb = calculateSpreadProbability(fast, 0, 0.3);
      expect(fastProb).toBeGreaterThan(slowProb);
    });
  });

  describe('calculateInvasiveImpact', () => {
    it('should scale impact with population level', () => {
      const species = makeInvasiveSpecies({
        id: eid(1),
        nativeSpeciesImpact: 0.5,
      });
      const lowPop = calculateInvasiveImpact(species, 20);
      const highPop = calculateInvasiveImpact(species, 80);
      expect(highPop).toBeGreaterThan(lowPop);
    });

    it('should scale impact with species impact rating', () => {
      const mild = makeInvasiveSpecies({ id: eid(1), nativeSpeciesImpact: 0.2 });
      const severe = makeInvasiveSpecies({ id: eid(2), nativeSpeciesImpact: 0.8 });
      const mildImpact = calculateInvasiveImpact(mild, 50);
      const severeImpact = calculateInvasiveImpact(severe, 50);
      expect(severeImpact).toBeGreaterThan(mildImpact);
    });

    it('should return 0 for 0 population', () => {
      const species = makeInvasiveSpecies({ id: eid(1), nativeSpeciesImpact: 0.5 });
      expect(calculateInvasiveImpact(species, 0)).toBe(0);
    });
  });

  describe('canInvasiveSurvive', () => {
    it('should return false for very low population', () => {
      expect(canInvasiveSurvive(4, 50)).toBe(false);
      expect(canInvasiveSurvive(2, 50)).toBe(false);
    });

    it('should return false for very low resources', () => {
      expect(canInvasiveSurvive(50, 9)).toBe(false);
      expect(canInvasiveSurvive(50, 5)).toBe(false);
    });

    it('should return true for viable population and resources', () => {
      expect(canInvasiveSurvive(10, 20)).toBe(true);
      expect(canInvasiveSurvive(50, 50)).toBe(true);
    });

    it('should return false at exact threshold', () => {
      // Need >= 5 population and >= 10 resources
      expect(canInvasiveSurvive(5, 10)).toBe(true);
      expect(canInvasiveSurvive(4.9, 10)).toBe(false);
      expect(canInvasiveSurvive(5, 9.9)).toBe(false);
    });
  });

  describe('calculateInvasiveGrowth', () => {
    it('should grow population when below carrying capacity', () => {
      const newPop = calculateInvasiveGrowth(20, 80, 0);
      expect(newPop).toBeGreaterThan(20);
    });

    it('should slow growth near carrying capacity', () => {
      const farFromCap = calculateInvasiveGrowth(20, 80, 0);
      const nearCap = calculateInvasiveGrowth(70, 80, 0);
      const growthFar = farFromCap - 20;
      const growthNear = nearCap - 70;
      expect(growthFar).toBeGreaterThan(growthNear);
    });

    it('should reduce growth with native competition', () => {
      const noCompetition = calculateInvasiveGrowth(30, 60, 0);
      const withCompetition = calculateInvasiveGrowth(30, 60, 50);
      expect(withCompetition).toBeLessThan(noCompetition);
    });

    it('should clamp to valid range', () => {
      const result = calculateInvasiveGrowth(98, 100, 0);
      expect(result).toBeLessThanOrEqual(100);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});

// =============================================================================
// ENVIRONMENTAL EVENT TESTS
// =============================================================================

describe('Environmental Events', () => {
  describe('calculateEventSeverity', () => {
    it('should increase severity with degradation level', () => {
      const mild = calculateEventSeverity(50, EnvironmentalEventType.Flood);
      const severe = calculateEventSeverity(100, EnvironmentalEventType.Flood);
      expect(severe).toBeGreaterThan(mild);
    });

    it('should apply severity multipliers by event type', () => {
      const flood = calculateEventSeverity(80, EnvironmentalEventType.Flood);
      const extinction = calculateEventSeverity(80, EnvironmentalEventType.WildlifeExtinction);
      // Flood has 1.3 multiplier, extinction has 0.7
      expect(flood).toBeGreaterThan(extinction);
    });

    it('should cap severity at 10', () => {
      const severity = calculateEventSeverity(100, EnvironmentalEventType.MagicalStorm);
      expect(severity).toBe(10);
    });

    it('should return at least 1 for any degradation', () => {
      const severity = calculateEventSeverity(5, EnvironmentalEventType.Drought);
      expect(severity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calculateEventCasualties', () => {
    it('should increase casualties with severity', () => {
      const lowSev = calculateEventCasualties(2, 1000, 0);
      const highSev = calculateEventCasualties(8, 1000, 0);
      expect(highSev).toBeGreaterThan(lowSev);
    });

    it('should scale with population at risk', () => {
      const smallPop = calculateEventCasualties(5, 100, 0);
      const largePop = calculateEventCasualties(5, 10000, 0);
      expect(largePop).toBeGreaterThan(smallPop);
    });

    it('should reduce casualties with preparedness', () => {
      const unprepared = calculateEventCasualties(5, 1000, 0);
      const prepared = calculateEventCasualties(5, 1000, 1);
      expect(prepared).toBeLessThan(unprepared);
    });

    it('should allow preparedness to reduce casualties by up to 80%', () => {
      const unprepared = calculateEventCasualties(5, 1000, 0);
      const fullyPrepared = calculateEventCasualties(5, 1000, 1);
      // 80% reduction means prepared should be ~20% of unprepared
      // Allow tolerance of 1 due to floor() and floating point precision
      expect(fullyPrepared).toBeLessThanOrEqual(unprepared * 0.22); // ~20% with tolerance
      expect(fullyPrepared).toBeGreaterThanOrEqual(unprepared * 0.18);
    });
  });

  describe('calculateEconomicDamage', () => {
    it('should scale damage with severity', () => {
      const lowDamage = calculateEconomicDamage(2, 10000, EnvironmentalEventType.Flood);
      const highDamage = calculateEconomicDamage(8, 10000, EnvironmentalEventType.Flood);
      expect(highDamage).toBeGreaterThan(lowDamage);
    });

    it('should scale damage with regional wealth', () => {
      const poorRegion = calculateEconomicDamage(5, 1000, EnvironmentalEventType.Flood);
      const richRegion = calculateEconomicDamage(5, 100000, EnvironmentalEventType.Flood);
      expect(richRegion).toBeGreaterThan(poorRegion);
    });

    it('should apply different multipliers by event type', () => {
      const magicalStorm = calculateEconomicDamage(5, 10000, EnvironmentalEventType.MagicalStorm);
      const extinction = calculateEconomicDamage(5, 10000, EnvironmentalEventType.WildlifeExtinction);
      // Magical storm 0.35, extinction 0.05
      expect(magicalStorm).toBeGreaterThan(extinction);
    });
  });

  describe('calculateRecoveryTime', () => {
    it('should return longer recovery for more severe events', () => {
      const mild = calculateRecoveryTime(2, EnvironmentalEventType.Flood);
      const severe = calculateRecoveryTime(8, EnvironmentalEventType.Flood);
      expect(severe).toBeGreaterThan(mild);
    });

    it('should have longer recovery for wildlife extinction', () => {
      const flood = calculateRecoveryTime(5, EnvironmentalEventType.Flood);
      const extinction = calculateRecoveryTime(5, EnvironmentalEventType.WildlifeExtinction);
      expect(extinction).toBeGreaterThan(flood);
    });

    it('should have quick recovery for magical storms', () => {
      const storm = calculateRecoveryTime(5, EnvironmentalEventType.MagicalStorm);
      const collapse = calculateRecoveryTime(5, EnvironmentalEventType.MineCollapse);
      expect(storm).toBeLessThan(collapse);
    });
  });
});

// =============================================================================
// ID GENERATION TESTS
// =============================================================================

describe('ID Generation', () => {
  beforeEach(() => {
    resetEcologyIdCounters();
  });

  it('should generate sequential territory IDs', () => {
    const id1 = createTerritoryId();
    const id2 = createTerritoryId();
    expect(id2).toBe(id1 + 1);
  });

  it('should generate sequential invasive species IDs', () => {
    const id1 = createInvasiveId();
    const id2 = createInvasiveId();
    expect(id2).toBe(id1 + 1);
  });

  it('should generate sequential environmental event IDs', () => {
    const id1 = createEnvironmentalEventId();
    const id2 = createEnvironmentalEventId();
    expect(id2).toBe(id1 + 1);
  });

  it('should reset all counters', () => {
    createTerritoryId();
    createInvasiveId();
    createEnvironmentalEventId();
    resetEcologyIdCounters();

    const t = createTerritoryId();
    const i = createInvasiveId();
    const e = createEnvironmentalEventId();

    // IDs have different bases to avoid collision
    expect(t).toBe(100000 as EntityId);
    expect(i).toBe(200000 as EntityId);
    expect(e).toBe(300000 as EntityId);
  });
});

// =============================================================================
// ECOLOGY SYSTEM TESTS
// =============================================================================

describe('EcologySystem', () => {
  beforeEach(() => {
    resetEcologyIdCounters();
  });

  describe('System Properties', () => {
    it('should have correct name', () => {
      const { system } = setupEcologySystem();
      expect(system.name).toBe('EcologySystem');
    });

    it('should run monthly', () => {
      const { system } = setupEcologySystem();
      expect(system.frequency).toBe(TickFrequency.Monthly);
    });

    it('should execute in environment phase', () => {
      const { system } = setupEcologySystem();
      expect(system.executionOrder).toBe(ExecutionOrder.ENVIRONMENT);
    });

    it('should use default config when none provided', () => {
      const system = new EcologySystem();
      // Access private config through region registration
      const region = rid(1);
      system.registerRegion(region, new Map());
      const state = system.getResourceState(region);
      expect(state?.regenerationRate.get(EcologicalResourceType.Game)).toBe(
        DEFAULT_ECOLOGY_CONFIG.baseRegenerationRate,
      );
    });

    it('should merge custom config with defaults', () => {
      const system = new EcologySystem({ baseRegenerationRate: 5 });
      const region = rid(1);
      system.registerRegion(region, new Map());
      const state = system.getResourceState(region);
      expect(state?.regenerationRate.get(EcologicalResourceType.Game)).toBe(5);
    });
  });

  describe('Region Registration', () => {
    it('should register a region with default stocks', () => {
      const { system } = setupEcologySystem();
      const region = rid(1);
      system.registerRegion(region, new Map());

      const state = system.getResourceState(region);
      expect(state).toBeDefined();
      expect(state?.stocks.get(EcologicalResourceType.Game)).toBe(100);
    });

    it('should register a region with custom initial stocks', () => {
      const { system } = setupEcologySystem();
      const region = rid(1);
      const initialStocks = new Map([
        [EcologicalResourceType.Game, 80],
        [EcologicalResourceType.Fish, 60],
      ]);
      system.registerRegion(region, initialStocks);

      const state = system.getResourceState(region);
      expect(state?.stocks.get(EcologicalResourceType.Game)).toBe(80);
      expect(state?.stocks.get(EcologicalResourceType.Fish)).toBe(60);
      expect(state?.stocks.get(EcologicalResourceType.Timber)).toBe(100); // Default
    });

    it('should create degradation state on registration', () => {
      const { system } = setupEcologySystem();
      const region = rid(1);
      system.registerRegion(region, new Map());

      const state = system.getDegradationState(region);
      expect(state).toBeDefined();
      expect(state?.degradationLevels.get(DegradationType.Deforestation)).toBe(0);
    });
  });

  describe('Harvest Pressure', () => {
    it('should set harvest pressure for a resource', () => {
      const { system } = setupEcologySystem();
      const region = rid(1);
      system.registerRegion(region, new Map());

      system.setHarvestPressure(region, EcologicalResourceType.Game, 5);
      const state = system.getResourceState(region);
      expect(state?.harvestPressure.get(EcologicalResourceType.Game)).toBe(5);
    });

    it('should reduce stock when harvest pressure applied', () => {
      const { system, world, clock, events } = setupEcologySystem();
      const region = rid(1);
      system.registerRegion(region, new Map());

      system.setHarvestPressure(region, EcologicalResourceType.Game, 5);
      system.execute(world, clock, events);

      const state = system.getResourceState(region);
      const stock = state?.stocks.get(EcologicalResourceType.Game);
      expect(stock).toBeLessThan(100);
    });
  });

  describe('Degradation', () => {
    it('should add degradation to a region', () => {
      const { system } = setupEcologySystem();
      const region = rid(1);
      system.registerRegion(region, new Map());

      system.addDegradation(region, DegradationType.Deforestation, 30);
      const state = system.getDegradationState(region);
      expect(state?.degradationLevels.get(DegradationType.Deforestation)).toBe(30);
    });

    it('should cap degradation at 100', () => {
      const { system } = setupEcologySystem();
      const region = rid(1);
      system.registerRegion(region, new Map());

      system.addDegradation(region, DegradationType.Deforestation, 150);
      const state = system.getDegradationState(region);
      expect(state?.degradationLevels.get(DegradationType.Deforestation)).toBe(100);
    });

    it('should set mitigation effort', () => {
      const { system } = setupEcologySystem();
      const region = rid(1);
      system.registerRegion(region, new Map());

      system.setMitigationEffort(region, DegradationType.Deforestation, 5);
      const state = system.getDegradationState(region);
      expect(state?.mitigationEfforts.get(DegradationType.Deforestation)).toBe(5);
    });
  });

  describe('Resource Depletion Events', () => {
    it('should emit critical resource event when stock drops below 20', () => {
      const { system, world, clock, events, emittedEvents } = setupEcologySystem();
      const region = rid(1);
      const initialStocks = new Map([
        [EcologicalResourceType.Game, 22], // Just above critical
      ]);
      system.registerRegion(region, initialStocks);

      // High harvest pressure to push below 20
      system.setHarvestPressure(region, EcologicalResourceType.Game, 5);
      system.execute(world, clock, events);

      const criticalEvent = emittedEvents.find(
        (e) => e.subtype === 'ecology.resource_critical',
      );
      expect(criticalEvent).toBeDefined();
      expect(criticalEvent?.data['resourceType']).toBe(EcologicalResourceType.Game);
    });

    it('should emit depleted event when stock reaches 0', () => {
      const { system, world, clock, events, emittedEvents } = setupEcologySystem();
      const region = rid(1);
      const initialStocks = new Map([
        [EcologicalResourceType.Game, 5], // Almost depleted
      ]);
      system.registerRegion(region, initialStocks);

      system.setHarvestPressure(region, EcologicalResourceType.Game, 10);
      system.execute(world, clock, events);

      const depletedEvent = emittedEvents.find(
        (e) => e.subtype === 'ecology.resource_depleted',
      );
      expect(depletedEvent).toBeDefined();
    });
  });

  describe('Environmental Event Triggers', () => {
    it('should trigger environmental event at degradation threshold', () => {
      const { system, world, clock, events, emittedEvents } = setupEcologySystem({
        eventThreshold: 75,
      });
      const region = rid(1);
      system.registerRegion(region, new Map());

      // Push degradation above threshold
      system.addDegradation(region, DegradationType.Deforestation, 80);
      system.execute(world, clock, events);

      const floodEvent = emittedEvents.find((e) => e.subtype === 'ecology.flood');
      expect(floodEvent).toBeDefined();
      expect(floodEvent?.data['severity']).toBeGreaterThan(0);
    });

    it('should not re-trigger event until degradation drops below threshold', () => {
      const { system, world, clock, events, emittedEvents } = setupEcologySystem({
        eventThreshold: 75,
      });
      const region = rid(1);
      system.registerRegion(region, new Map());

      system.addDegradation(region, DegradationType.Deforestation, 80);
      system.execute(world, clock, events);

      const firstEventCount = emittedEvents.filter((e) => e.subtype === 'ecology.flood').length;
      expect(firstEventCount).toBe(1);

      // Execute again without degradation dropping
      clock.advance();
      system.execute(world, clock, events);

      const secondEventCount = emittedEvents.filter((e) => e.subtype === 'ecology.flood').length;
      expect(secondEventCount).toBe(1); // No new event
    });
  });

  describe('Creature Territories', () => {
    it('should register and retrieve territory', () => {
      const { system } = setupEcologySystem();
      const territory = makeTerritory({ id: createTerritoryId() });
      system.registerTerritory(territory);

      expect(system.getTerritory(territory.id)).toBe(territory);
    });

    it('should return all territories', () => {
      const { system } = setupEcologySystem();
      const t1 = makeTerritory({ id: createTerritoryId() });
      const t2 = makeTerritory({ id: createTerritoryId() });
      system.registerTerritory(t1);
      system.registerTerritory(t2);

      const all = system.getAllTerritories();
      expect(all).toHaveLength(2);
    });

    it('should block settlement in active territory', () => {
      const { system } = setupEcologySystem();
      const territory = makeTerritory({
        id: createTerritoryId(),
        controlledRegions: [rid(1)],
        isActive: true,
      });
      system.registerTerritory(territory);

      const result = system.canSettleAt(rid(1));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DragonLair');
    });

    it('should allow settlement outside territory', () => {
      const { system } = setupEcologySystem();
      const territory = makeTerritory({
        id: createTerritoryId(),
        controlledRegions: [rid(1)],
        isActive: true,
      });
      system.registerTerritory(territory);

      const result = system.canSettleAt(rid(5));
      expect(result.allowed).toBe(true);
    });
  });

  describe('Invasive Species', () => {
    it('should register and retrieve invasive species', () => {
      const { system } = setupEcologySystem();
      const species = makeInvasiveSpecies({ id: createInvasiveId() });
      system.registerInvasiveSpecies(species);

      expect(system.getInvasiveSpecies(species.id)).toBe(species);
    });

    it('should return all invasive species', () => {
      const { system } = setupEcologySystem();
      const s1 = makeInvasiveSpecies({ id: createInvasiveId() });
      const s2 = makeInvasiveSpecies({ id: createInvasiveId() });
      system.registerInvasiveSpecies(s1);
      system.registerInvasiveSpecies(s2);

      const all = system.getAllInvasiveSpecies();
      expect(all).toHaveLength(2);
    });
  });

  describe('Environmental Events', () => {
    it('should track environmental events', () => {
      const { system, world, clock, events } = setupEcologySystem({
        eventThreshold: 75,
      });
      const region = rid(1);
      system.registerRegion(region, new Map());

      system.addDegradation(region, DegradationType.Deforestation, 80);
      system.execute(world, clock, events);

      const allEvents = system.getAllEnvironmentalEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should mark events as recovered after recovery time', () => {
      const { system, world, clock, events, emittedEvents } = setupEcologySystem({
        eventThreshold: 75,
      });
      const region = rid(1);
      system.registerRegion(region, new Map());

      system.addDegradation(region, DegradationType.MagicalPollution, 80);
      system.execute(world, clock, events);

      const envEvent = system.getAllEnvironmentalEvents()[0];
      expect(envEvent).toBeDefined();
      expect(envEvent?.isOngoing).toBe(true);

      // Advance past recovery time (magical storm has short recovery)
      for (let i = 0; i < envEvent!.recoveryTicks + 10; i++) {
        clock.advance();
      }
      system.execute(world, clock, events);

      // Check for recovery event
      const recoveryEvent = emittedEvents.find(
        (e) => e.subtype === 'ecology.event_recovered',
      );
      expect(recoveryEvent).toBeDefined();
    });
  });

  describe('Seasonal Processing', () => {
    it('should process creature territories every 90 ticks', () => {
      const { system, world, clock, events, emittedEvents } = setupEcologySystem({
        territoryExpansionRate: 1.0, // Always expand for determinism
      });

      const territory = makeTerritory({
        id: createTerritoryId(),
        threatLevel: 10, // Max threat for high expansion chance
        isActive: true,
      });
      system.registerTerritory(territory);

      // Advance 90 ticks
      for (let i = 0; i < 90; i++) {
        clock.advance();
      }

      // Run multiple times to get past random chance
      let foundExpansion = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        emittedEvents.length = 0;
        system.execute(world, clock, events);
        if (emittedEvents.some((e) => e.subtype === 'ecology.territory_expanded')) {
          foundExpansion = true;
          break;
        }
        // Advance another season
        for (let i = 0; i < 90; i++) {
          clock.advance();
        }
      }

      // With 100% expansion rate and threat 10, should eventually expand
      expect(foundExpansion).toBe(true);
    });

    it('should process invasive species spread every 90 ticks', () => {
      const { system, world, clock, events, emittedEvents } = setupEcologySystem({
        invasiveSpreadProbability: 1.0, // Always spread
      });
      const region = rid(1);
      system.registerRegion(region, new Map());

      const species = makeInvasiveSpecies({
        id: createInvasiveId(),
        spreadRate: 1.0,
        presentInRegions: [region],
      });
      system.registerInvasiveSpecies(species);

      // Advance 90 ticks
      for (let i = 0; i < 90; i++) {
        clock.advance();
      }

      system.execute(world, clock, events);

      const spreadEvent = emittedEvents.find((e) => e.subtype === 'ecology.invasive_spread');
      expect(spreadEvent).toBeDefined();
    });
  });

  describe('Integration: Overhunting reduces population', () => {
    it('should deplete game when overhunted', () => {
      const { system, world, clock, events } = setupEcologySystem();
      const region = rid(1);
      const initialStocks = new Map([[EcologicalResourceType.Game, 100]]);
      system.registerRegion(region, initialStocks);

      // High hunting pressure for multiple months
      system.setHarvestPressure(region, EcologicalResourceType.Game, 8);

      for (let month = 0; month < 12; month++) {
        system.execute(world, clock, events);
        for (let day = 0; day < 30; day++) {
          clock.advance();
        }
      }

      const state = system.getResourceState(region);
      const gameStock = state?.stocks.get(EcologicalResourceType.Game) ?? 0;
      expect(gameStock).toBeLessThan(50); // Significantly depleted
    });
  });

  describe('Integration: Mining exhausts ore nodes', () => {
    it('should deplete ore when heavily mined', () => {
      const { system, world, clock, events } = setupEcologySystem();
      const region = rid(1);
      const initialStocks = new Map([[EcologicalResourceType.Ore, 100]]);
      system.registerRegion(region, initialStocks);

      // Heavy mining pressure
      system.setHarvestPressure(region, EcologicalResourceType.Ore, 10);

      for (let month = 0; month < 6; month++) {
        system.execute(world, clock, events);
        for (let day = 0; day < 30; day++) {
          clock.advance();
        }
      }

      const state = system.getResourceState(region);
      const oreStock = state?.stocks.get(EcologicalResourceType.Ore) ?? 0;
      expect(oreStock).toBeLessThan(60);
    });
  });

  describe('Integration: Dragon territory blocks settlement', () => {
    it('should prevent settlement in dragon-controlled region', () => {
      const { system } = setupEcologySystem();

      const dragonTerritory = makeTerritory({
        id: createTerritoryId(),
        type: CreatureTerritoryType.DragonLair,
        controlledRegions: [rid(10), rid(11), rid(12)],
        threatLevel: 8,
        isActive: true,
      });
      system.registerTerritory(dragonTerritory);

      // All controlled regions should be blocked
      expect(system.canSettleAt(rid(10)).allowed).toBe(false);
      expect(system.canSettleAt(rid(11)).allowed).toBe(false);
      expect(system.canSettleAt(rid(12)).allowed).toBe(false);

      // Nearby but uncontrolled should be allowed
      expect(system.canSettleAt(rid(13)).allowed).toBe(true);
    });
  });

  describe('Integration: Degradation triggers events at threshold', () => {
    it('should fire flood event when deforestation hits threshold', () => {
      const { system, world, clock, events, emittedEvents } = setupEcologySystem({
        eventThreshold: 75,
      });
      const region = rid(1);
      system.registerRegion(region, new Map());

      // Gradually increase deforestation
      for (let i = 0; i < 10; i++) {
        system.addDegradation(region, DegradationType.Deforestation, 8);
        system.execute(world, clock, events);

        if (emittedEvents.some((e) => e.subtype === 'ecology.flood')) {
          break;
        }

        for (let day = 0; day < 30; day++) {
          clock.advance();
        }
      }

      expect(emittedEvents.some((e) => e.subtype === 'ecology.flood')).toBe(true);
    });
  });
});
