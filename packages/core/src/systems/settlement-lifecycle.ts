/**
 * SettlementLifecycleSystem — Phase 13 Living Population.
 *
 * Manages the lifecycle of settlements: growth tiers, population pressure
 * triggering new settlement founding, abandonment after extended depopulation,
 * and stress-driven migration.
 *
 * Runs monthly (every 30 ticks) at execution order 45 (after Population, before Politics).
 */

import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { TickFrequency } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import { scoreMigrationTargets, executeMigration } from './migration.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { SeededRNG } from '../utils/seeded-rng.js';
import type { EntityId } from '../ecs/types.js';
import type {
  PositionComponent,
  PopulationComponent,
  PopulationDemographicsComponent,
  StatusComponent,
  EconomyComponent,
  OwnershipComponent,
} from '../ecs/component.js';

// =============================================================================
// Constants
// =============================================================================

export const SETTLEMENT_TIERS = [
  { name: 'camp', minPop: 0 },
  { name: 'village', minPop: 15 },
  { name: 'town', minPop: 75 },
  { name: 'city', minPop: 300 },
  { name: 'capital', minPop: 1000 },
] as const;

export const ABANDONMENT_THRESHOLD = 5;
export const ABANDONMENT_DURATION = 720; // ticks (~2 years)
export const POPULATION_PRESSURE_FACTOR = 1.5;
export const MIN_PIONEERS = 3;

// =============================================================================
// Helpers
// =============================================================================

function makeSerializable<T extends { type: string }>(
  data: T,
): T & { serialize(): Record<string, unknown> } {
  return {
    ...data,
    serialize() {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this)) {
        if (key !== 'serialize' && typeof value !== 'function') {
          result[key] = value;
        }
      }
      return result;
    },
  };
}

/**
 * Determine the settlement tier for a given population count.
 * Returns the highest tier whose minPop requirement is met.
 */
function getTierForPopulation(count: number): (typeof SETTLEMENT_TIERS)[number] {
  let tier: (typeof SETTLEMENT_TIERS)[number] = SETTLEMENT_TIERS[0]!;
  for (const t of SETTLEMENT_TIERS) {
    if (count >= t.minPop) {
      tier = t;
    }
  }
  return tier;
}

/**
 * Find the index of a tier by name. Returns 0 if not found.
 */
function getTierIndex(tierName: string): number {
  const idx = SETTLEMENT_TIERS.findIndex((t) => t.name === tierName);
  return idx >= 0 ? idx : 0;
}

/**
 * Significance for tier change events based on the new tier.
 */
function tierChangeSignificance(newTier: string): number {
  switch (newTier) {
    case 'capital':
      return 70;
    case 'city':
      return 60;
    case 'town':
      return 50;
    default:
      return 40;
  }
}

// =============================================================================
// System
// =============================================================================

export class SettlementLifecycleSystem extends BaseSystem {
  readonly name = 'SettlementLifecycleSystem';
  readonly frequency = TickFrequency.Monthly;
  readonly executionOrder = ExecutionOrder.SETTLEMENT_LIFECYCLE;

  /** Tracks when each settlement started declining (entityId -> tick). */
  private settlementDeclineStart: Map<number, number> = new Map();

  constructor(private readonly rng: SeededRNG) {
    super();
  }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    this.updateGrowthTiers(world, clock, events);
    this.checkPopulationPressure(world, clock, events);
    this.checkAbandonment(world, clock, events);
    this.processMigration(world, clock, events);
  }

  // ---------------------------------------------------------------------------
  // Method 1: Growth tier promotions/demotions
  // ---------------------------------------------------------------------------

  private updateGrowthTiers(world: World, clock: WorldClock, events: EventBus): void {
    const settlements = world.query('Population');

    for (const entityId of settlements) {
      const pop = world.getComponent<PopulationComponent>(entityId, 'Population');
      const status = world.getComponent<StatusComponent>(entityId, 'Status');
      if (pop === undefined || status === undefined) {
        continue;
      }

      // Skip already-abandoned settlements
      if (status.socialClass === 'ruins') {
        continue;
      }

      const currentTierName = status.socialClass;
      const expectedTier = getTierForPopulation(pop.count);

      if (expectedTier.name !== currentTierName) {
        const previousTier = currentTierName;
        status.socialClass = expectedTier.name;

        const evt = createEvent({
          category: EventCategory.Personal,
          subtype: 'settlement.tier_change',
          timestamp: clock.currentTick,
          participants: [entityId],
          significance: tierChangeSignificance(expectedTier.name),
          data: {
            settlementName: status.titles[0] ?? 'Unknown Settlement',
            previousTier,
            newTier: expectedTier.name,
            population: pop.count,
          },
        });
        events.emit(evt);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Method 2: Population pressure — new settlement founding
  // ---------------------------------------------------------------------------

  private checkPopulationPressure(world: World, clock: WorldClock, events: EventBus): void {
    const settlements = world.query('Population');
    const forkedRng = this.rng.fork('settlement-founding');

    for (const entityId of settlements) {
      const pop = world.getComponent<PopulationComponent>(entityId, 'Population');
      const status = world.getComponent<StatusComponent>(entityId, 'Status');
      if (pop === undefined || status === undefined) {
        continue;
      }

      // Skip ruins
      if (status.socialClass === 'ruins') {
        continue;
      }

      const tierIndex = getTierIndex(status.socialClass);
      const currentTier = SETTLEMENT_TIERS[tierIndex]!;

      // Determine the pressure threshold:
      // - For non-max tiers: current tier minPop * factor
      // - For max tier (capital): current tier minPop * factor
      const pressureThreshold = currentTier.minPop * POPULATION_PRESSURE_FACTOR;

      if (pop.count <= pressureThreshold) {
        continue;
      }

      // Select 10-20% of nonNotableIds as pioneers
      const pioneerFraction = 0.1 + forkedRng.next() * 0.1; // 10-20%
      const pioneerCount = Math.floor(pop.nonNotableIds.length * pioneerFraction);
      if (pioneerCount < MIN_PIONEERS) {
        continue;
      }

      // Pick pioneers from the end of the array (shuffled by rng for variety)
      const shuffled = [...pop.nonNotableIds];
      forkedRng.shuffle(shuffled);
      const pioneers = shuffled.slice(0, pioneerCount);

      // Find position for new settlement: ring 10-30 tiles from source
      const sourcePos = world.getComponent<PositionComponent>(entityId, 'Position');
      if (sourcePos === undefined) {
        continue;
      }

      const dxSign = forkedRng.next() < 0.5 ? -1 : 1;
      const dySign = forkedRng.next() < 0.5 ? -1 : 1;
      const dx = (Math.floor(forkedRng.next() * 21) + 10) * dxSign;
      const dy = (Math.floor(forkedRng.next() * 21) + 10) * dySign;
      const newX = Math.max(1, sourcePos.x + dx);
      const newY = Math.max(1, sourcePos.y + dy);

      // Copy demographic info from source
      const sourceDemographics = world.getComponent<PopulationDemographicsComponent>(
        entityId,
        'PopulationDemographics',
      );
      const sourceOwnership = world.getComponent<OwnershipComponent>(entityId, 'Ownership');

      // Determine dominant race
      let dominantRace = 'unknown';
      if (sourceDemographics !== undefined) {
        let maxCount = 0;
        for (const [race, count] of sourceDemographics.raceDistribution) {
          if (count > maxCount) {
            maxCount = count;
            dominantRace = race;
          }
        }
      }

      // Create the new settlement entity
      const newSiteId = world.createEntity();

      world.addComponent(
        newSiteId,
        makeSerializable({
          type: 'Position' as const,
          x: newX,
          y: newY,
        }),
      );

      world.addComponent(
        newSiteId,
        makeSerializable({
          type: 'Population' as const,
          count: pioneers.length,
          growthRate: 0.02,
          nonNotableIds: [...pioneers],
        }),
      );

      world.addComponent(
        newSiteId,
        makeSerializable({
          type: 'PopulationDemographics' as const,
          raceDistribution: new Map([[dominantRace, pioneers.length]]),
          ageDistribution: new Map<string, number>(),
        }),
      );

      world.addComponent(
        newSiteId,
        makeSerializable({
          type: 'Status' as const,
          conditions: [] as string[],
          titles: ['New Settlement'],
          socialClass: 'camp',
        }),
      );

      world.addComponent(
        newSiteId,
        makeSerializable({
          type: 'Economy' as const,
          wealth: 10,
          tradeVolume: 0,
          industries: ['farming'],
        }),
      );

      world.addComponent(
        newSiteId,
        makeSerializable({
          type: 'Ownership' as const,
          ownerId: sourceOwnership !== undefined ? sourceOwnership.ownerId : null,
          claimStrength: 0.5,
        }),
      );

      // Remove pioneers from source settlement
      const pioneerSet = new Set(pioneers);
      pop.nonNotableIds = pop.nonNotableIds.filter((id) => !pioneerSet.has(id));
      pop.count -= pioneers.length;
      if (pop.count < 0) {
        pop.count = 0;
      }

      // Update pioneer Position components to new settlement coordinates
      for (const pid of pioneers) {
        const pos = world.getComponent<PositionComponent>(pid as EntityId, 'Position');
        if (pos !== undefined) {
          pos.x = newX;
          pos.y = newY;
        }
      }

      // Emit founding event
      const sourceName = status.titles[0] ?? 'Unknown Settlement';
      const foundingEvent = createEvent({
        category: EventCategory.Personal,
        subtype: 'settlement.founded',
        timestamp: clock.currentTick,
        participants: [entityId, newSiteId],
        significance: 55,
        data: {
          sourceName,
          newSettlementName: 'New Settlement',
          pioneerCount: pioneers.length,
          location: { x: newX, y: newY },
        },
      });
      events.emit(foundingEvent);
    }
  }

  // ---------------------------------------------------------------------------
  // Method 3: Abandonment tracking
  // ---------------------------------------------------------------------------

  private checkAbandonment(world: World, clock: WorldClock, events: EventBus): void {
    const settlements = world.query('Population');

    for (const entityId of settlements) {
      const pop = world.getComponent<PopulationComponent>(entityId, 'Population');
      const status = world.getComponent<StatusComponent>(entityId, 'Status');
      if (pop === undefined || status === undefined) {
        continue;
      }

      // Skip already-abandoned settlements
      if (status.socialClass === 'ruins') {
        continue;
      }

      const eid = entityId as number;

      if (pop.count < ABANDONMENT_THRESHOLD) {
        // Start or continue decline tracking
        if (!this.settlementDeclineStart.has(eid)) {
          this.settlementDeclineStart.set(eid, clock.currentTick);
        }

        const startTick = this.settlementDeclineStart.get(eid)!;
        if (clock.currentTick - startTick >= ABANDONMENT_DURATION) {
          // Time to abandon
          const previousCount = pop.count;
          const settlementName = status.titles[0] ?? 'Unknown Settlement';

          // Migrate remaining non-notables to nearest viable settlement
          if (pop.nonNotableIds.length > 0) {
            // Determine dominant race and faction for scoring
            let migrantRace = 'unknown';
            const demographics = world.getComponent<PopulationDemographicsComponent>(
              entityId,
              'PopulationDemographics',
            );
            if (demographics !== undefined) {
              let maxCount = 0;
              for (const [race, count] of demographics.raceDistribution) {
                if (count > maxCount) {
                  maxCount = count;
                  migrantRace = race;
                }
              }
            }

            const ownership = world.getComponent<OwnershipComponent>(entityId, 'Ownership');
            const migrantFaction = ownership !== undefined && ownership.ownerId !== null
              ? ownership.ownerId
              : 0;

            const targets = scoreMigrationTargets(
              eid,
              world,
              1.0,
              migrantRace,
              migrantFaction,
            );

            if (targets.length > 0 && targets[0]!.score > 0) {
              executeMigration(
                world,
                [...pop.nonNotableIds],
                eid,
                targets[0]!.targetSiteId,
                clock,
                events,
              );
            }
          }

          // Mark as abandoned
          status.socialClass = 'ruins';
          if (!status.conditions.includes('abandoned')) {
            status.conditions.push('abandoned');
          }
          pop.count = 0;
          pop.nonNotableIds = [];

          // Emit abandonment event
          const abandonEvent = createEvent({
            category: EventCategory.Personal,
            subtype: 'settlement.abandoned',
            timestamp: clock.currentTick,
            participants: [entityId],
            significance: 50,
            data: {
              settlementName,
              population: previousCount,
              yearsInDecline: Math.floor((clock.currentTick - startTick) / 360),
            },
          });
          events.emit(abandonEvent);

          // Remove from tracking
          this.settlementDeclineStart.delete(eid);
        }
      } else {
        // Population recovered — remove from decline tracking
        if (this.settlementDeclineStart.has(eid)) {
          this.settlementDeclineStart.delete(eid);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Method 4: Stress-driven migration
  // ---------------------------------------------------------------------------

  private processMigration(world: World, clock: WorldClock, events: EventBus): void {
    const settlements = world.query('Population');
    const forkedRng = this.rng.fork('settlement-migration');

    for (const entityId of settlements) {
      const pop = world.getComponent<PopulationComponent>(entityId, 'Population');
      const status = world.getComponent<StatusComponent>(entityId, 'Status');
      const economy = world.getComponent<EconomyComponent>(entityId, 'Economy');
      if (pop === undefined || status === undefined) {
        continue;
      }

      // Skip ruins
      if (status.socialClass === 'ruins') {
        continue;
      }

      // Check stress conditions
      const isWarTorn = status.conditions.some(
        (c) => c.toLowerCase().includes('war'),
      );
      const isPoor = economy !== undefined && economy.wealth < 20;

      if (!isWarTorn && !isPoor) {
        continue;
      }

      // Calculate push factor (higher for worse conditions)
      let pushFactor = 1.0;
      if (isWarTorn) {
        pushFactor += 0.5;
      }
      if (isPoor) {
        pushFactor += 0.3;
      }

      // Select 1-5 non-notables to migrate
      if (pop.nonNotableIds.length === 0) {
        continue;
      }

      const migrantCount = Math.min(
        pop.nonNotableIds.length,
        1 + Math.floor(forkedRng.next() * 5),
      );
      const shuffled = [...pop.nonNotableIds];
      forkedRng.shuffle(shuffled);
      const migrants = shuffled.slice(0, migrantCount);

      // Determine dominant race and faction for scoring
      let migrantRace = 'unknown';
      const demographics = world.getComponent<PopulationDemographicsComponent>(
        entityId,
        'PopulationDemographics',
      );
      if (demographics !== undefined) {
        let maxCount = 0;
        for (const [race, count] of demographics.raceDistribution) {
          if (count > maxCount) {
            maxCount = count;
            migrantRace = race;
          }
        }
      }

      const ownership = world.getComponent<OwnershipComponent>(entityId, 'Ownership');
      const migrantFaction = ownership !== undefined && ownership.ownerId !== null
        ? ownership.ownerId
        : 0;

      const targets = scoreMigrationTargets(
        entityId as number,
        world,
        pushFactor,
        migrantRace,
        migrantFaction,
      );

      if (targets.length > 0 && targets[0]!.score > 0) {
        executeMigration(
          world,
          migrants,
          entityId as number,
          targets[0]!.targetSiteId,
          clock,
          events,
        );
      }
    }
  }
}
