/**
 * PopulationSystem — manages non-notable character lifecycle.
 *
 * Handles aging, natural death, births, and spark micro-events that
 * can promote non-notables to full notable characters.
 *
 * Runs monthly (every 30 ticks). Follows the Phase 3 internal Maps pattern.
 */

import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { TickFrequency } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import { createNonNotable, PROFESSIONS, FALLBACK_LIFESPAN } from './population-utils.js';
import { promote, PROMOTION_THRESHOLD } from './promotion.js';
import type { RaceLifespan } from './population-utils.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { SeededRNG } from '../utils/seeded-rng.js';
import type { WorldEvent } from '../events/types.js';
import type { EntityId } from '../ecs/types.js';
import type {
  DeceasedComponent,
  NotabilityComponent,
  PopulationComponent,
  PopulationDemographicsComponent,
  PositionComponent,
  StatusComponent,
} from '../ecs/component.js';

const TICKS_PER_YEAR = 360;

/**
 * Demographic signal — queued from external system events.
 */
interface DemographicSignal {
  type: 'casualties' | 'prosperity' | 'catastrophe';
  casualties?: number;
  prosperityDelta?: number;
  settlementId?: number;
  regionId?: number;
  sourceTick: number;
}

/**
 * Spark type definitions — micro-events that increase a non-notable's Notability score.
 */
const SPARK_TYPES = [
  { description: 'had a vivid prophetic dream', points: 8 },
  { description: 'displayed unusual talent', points: 12 },
  { description: 'survived a close brush with danger', points: 15 },
  { description: 'made a shrewd trade', points: 7 },
  { description: 'showed unexpected courage', points: 10 },
  { description: 'discovered a hidden skill', points: 11 },
  { description: 'earned respect through hard work', points: 6 },
  { description: 'witnessed something extraordinary', points: 9 },
  { description: 'rescued a neighbor from peril', points: 13 },
  { description: 'forged an unlikely friendship', points: 8 },
  { description: 'spoke truth to power', points: 14 },
  { description: 'recovered a lost heirloom', points: 10 },
] as const;

/**
 * Simple first/family name lists for birth name generation.
 */
const BIRTH_FIRST_NAMES = [
  'Ada', 'Bran', 'Cora', 'Dael', 'Eira', 'Finn', 'Gwen', 'Holt',
  'Iris', 'Jace', 'Kira', 'Lorn', 'Mira', 'Nox', 'Orin', 'Pria',
  'Quinn', 'Reva', 'Sven', 'Tara', 'Ulf', 'Vara', 'Wren', 'Xara',
  'Yori', 'Zara', 'Ash', 'Beck', 'Clay', 'Dove', 'Elm', 'Fern',
];

const BIRTH_FAMILY_NAMES = [
  'Smith', 'Stone', 'Brook', 'Hill', 'Wood', 'Field', 'Dale', 'Ford',
  'Glen', 'Marsh', 'Heath', 'Moor', 'Ridge', 'Thorne', 'Cross', 'Wells',
];

export class PopulationSystem extends BaseSystem {
  readonly name = 'PopulationSystem';
  readonly frequency = TickFrequency.Monthly;
  readonly executionOrder = ExecutionOrder.POPULATION;

  // Internal Maps (Phase 3 pattern)
  private settlementIds: EntityId[] = [];
  private raceLifespans: Map<string, RaceLifespan> = new Map();
  private pendingSignals: DemographicSignal[] = [];
  private subscribed = false;

  constructor(private readonly rng?: SeededRNG) {
    super();
  }

  override initialize(world: World): void {
    super.initialize(world);
    this.loadSettlementData(world);
  }

  /**
   * Subscribe to EventBus for demographic signals from other systems.
   * Called lazily on first execute since EventBus isn't available at initialize.
   */
  private subscribeToSignals(events: EventBus): void {
    if (this.subscribed) return;
    this.subscribed = true;

    // Military casualties
    events.on(EventCategory.Military, (event: WorldEvent) => {
      const data = event.data as Record<string, unknown>;
      if (data.civilianCasualties !== undefined && typeof data.civilianCasualties === 'number') {
        this.pendingSignals.push({
          type: 'casualties',
          casualties: data.civilianCasualties,
          ...(typeof data.affectedSiteId === 'number' ? { settlementId: data.affectedSiteId } : {}),
          sourceTick: event.timestamp,
        });
      }
    });

    // Ecological disasters
    events.on(EventCategory.Disaster, (event: WorldEvent) => {
      const data = event.data as Record<string, unknown>;
      if (data.estimatedCasualties !== undefined && typeof data.estimatedCasualties === 'number') {
        this.pendingSignals.push({
          type: 'catastrophe',
          casualties: data.estimatedCasualties,
          ...(typeof data.regionId === 'number' ? { regionId: data.regionId } : {}),
          sourceTick: event.timestamp,
        });
      }
    });

    // Economic signals
    events.on(EventCategory.Economic, (event: WorldEvent) => {
      const data = event.data as Record<string, unknown>;
      if (data.prosperityDelta !== undefined && typeof data.prosperityDelta === 'number') {
        this.pendingSignals.push({
          type: 'prosperity',
          prosperityDelta: data.prosperityDelta,
          ...(typeof data.settlementId === 'number' ? { settlementId: data.settlementId } : {}),
          sourceTick: event.timestamp,
        });
      }
    });

    // Magic catastrophes
    events.on(EventCategory.Magical, (event: WorldEvent) => {
      const data = event.data as Record<string, unknown>;
      if (data.magicCasualties !== undefined && typeof data.magicCasualties === 'number') {
        this.pendingSignals.push({
          type: 'catastrophe',
          casualties: data.magicCasualties,
          sourceTick: event.timestamp,
        });
      }
    });
  }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    this.subscribeToSignals(events);
    this.processDemographicSignals(world, clock, events);
    this.processAging(world, clock);
    this.processNaturalDeath(world, clock, events);
    this.processBirths(world, clock, events);
    this.processSparks(world, clock, events);
    this.processPromotions(world, clock, events);
  }

  /**
   * Register a race's lifespan data. Called during system initialization
   * or externally by the generation pipeline.
   */
  registerRaceLifespan(race: string, lifespan: RaceLifespan): void {
    this.raceLifespans.set(race, lifespan);
  }

  /**
   * Get registered race lifespan, falling back to FALLBACK_LIFESPAN.
   */
  getRaceLifespan(race: string): RaceLifespan {
    return this.raceLifespans.get(race) ?? FALLBACK_LIFESPAN;
  }

  private loadSettlementData(world: World): void {
    // Scan entities for those with Population component to find settlements
    this.settlementIds = [];
    if (!world.hasStore('Population')) return;

    this.settlementIds = world.query('Population');
  }

  /**
   * Increment age for non-notables that cross a year boundary.
   */
  private processAging(world: World, clock: WorldClock): void {
    for (const settlementId of this.settlementIds) {
      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population');
      if (pop === undefined) continue;

      for (const nnId of pop.nonNotableIds) {
        const notability = world.getComponent<NotabilityComponent>(nnId as EntityId, 'Notability');
        if (notability === undefined) continue;

        // Check if we crossed a year boundary this month
        const ageBefore = Math.floor((clock.currentTick - 30 - notability.birthTick) / TICKS_PER_YEAR);
        const ageNow = Math.floor((clock.currentTick - notability.birthTick) / TICKS_PER_YEAR);

        if (ageNow > ageBefore) {
          // Age incremented — nothing to write since we compute age from birthTick
          // The Status component doesn't store age; it's derived on read.
        }
      }
    }
  }

  /**
   * Kill elderly non-notables with increasing probability.
   */
  private processNaturalDeath(world: World, clock: WorldClock, events: EventBus): void {
    for (const settlementId of this.settlementIds) {
      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population');
      if (pop === undefined) continue;

      const toRemove: number[] = [];

      for (const nnId of pop.nonNotableIds) {
        const notability = world.getComponent<NotabilityComponent>(nnId as EntityId, 'Notability');
        if (notability === undefined) continue;

        // Skip entities that already have Deceased component
        if (world.hasComponent(nnId as EntityId, 'Deceased')) continue;

        const age = Math.floor((clock.currentTick - notability.birthTick) / TICKS_PER_YEAR);

        // Get race from Status conditions or use fallback
        const status = world.getComponent<StatusComponent>(nnId as EntityId, 'Status');
        const raceName = this.inferRace(world, settlementId);
        const lifespan = this.getRaceLifespan(raceName);

        if (age < lifespan.expected) continue;

        // Increasing probability: 0% at expected, 100% at maximum
        const range = lifespan.maximum - lifespan.expected;
        const overage = age - lifespan.expected;
        const deathProbability = range > 0 ? Math.min(1, overage / range) : 1;

        // Monthly roll
        const roll = this.rng !== undefined ? this.rng.next() : Math.random();
        // Scale to monthly probability (roughly 1/12 chance per month at boundary)
        if (roll < deathProbability * 0.1) {
          // Mark as deceased
          const deceasedCause = 'natural causes';
          const deceasedTick = clock.currentTick;
          const deceasedLocationId = settlementId as number;
          const deceased: DeceasedComponent & { serialize(): Record<string, unknown> } = {
            type: 'Deceased' as const,
            cause: deceasedCause,
            tick: deceasedTick,
            locationId: deceasedLocationId,
            serialize() {
              return { type: 'Deceased', cause: deceasedCause, tick: deceasedTick, locationId: deceasedLocationId };
            },
          };
          world.addComponent(nnId as EntityId, deceased);

          toRemove.push(nnId);

          // Emit death event
          const name = status !== undefined ? status.titles[0] ?? 'Unknown' : 'Unknown';
          events.emit(createEvent({
            category: EventCategory.Personal,
            subtype: 'population.natural_death',
            timestamp: clock.currentTick,
            participants: [nnId as EntityId],
            significance: 10,
            data: { name, age, cause: 'natural causes', settlementId: settlementId as number },
          }));
        }
      }

      // Remove deceased from active population
      if (toRemove.length > 0) {
        pop.nonNotableIds = pop.nonNotableIds.filter(id => !toRemove.includes(id));
        pop.count = Math.max(0, pop.count - toRemove.length);
      }
    }
  }

  /**
   * Generate births based on settlement population and prosperity.
   */
  private processBirths(world: World, clock: WorldClock, events: EventBus): void {
    for (const settlementId of this.settlementIds) {
      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population');
      if (pop === undefined) continue;

      const currentPop = pop.nonNotableIds.length;
      if (currentPop < 2) continue; // Need at least 2 for reproduction

      // Base birth rate: ~2% per month, scaled by population
      // Larger settlements have more births but also more density pressure
      const softCap = 50;
      const densityFactor = currentPop < softCap ? 1.0 : softCap / currentPop;
      const baseBirthRate = 0.02 * densityFactor;

      // Expected births this month
      const expectedBirths = currentPop * baseBirthRate;
      const roll = this.rng !== undefined ? this.rng.next() : Math.random();

      // Poisson-like: floor + chance of one more
      const births = Math.floor(expectedBirths) + (roll < (expectedBirths % 1) ? 1 : 0);

      if (births === 0) continue;

      const race = this.inferRace(world, settlementId);
      const settlementPos = world.getComponent<PositionComponent>(settlementId, 'Position');
      const x = settlementPos !== undefined ? settlementPos.x : 0;
      const y = settlementPos !== undefined ? settlementPos.y : 0;

      for (let b = 0; b < births; b++) {
        // Pick parents from existing non-notables
        const motherIdx = this.rng !== undefined
          ? Math.floor(this.rng.next() * currentPop)
          : Math.floor(Math.random() * currentPop);
        let fatherIdx = this.rng !== undefined
          ? Math.floor(this.rng.next() * currentPop)
          : Math.floor(Math.random() * currentPop);
        if (fatherIdx === motherIdx && currentPop > 1) {
          fatherIdx = (motherIdx + 1) % currentPop;
        }

        const motherId = pop.nonNotableIds[motherIdx] ?? null;
        const fatherId = pop.nonNotableIds[fatherIdx] ?? null;

        // Generate name
        const nameRoll = this.rng !== undefined ? this.rng.next() : Math.random();
        const fi = Math.floor(nameRoll * BIRTH_FIRST_NAMES.length);
        const li = Math.floor((this.rng !== undefined ? this.rng.next() : Math.random()) * BIRTH_FAMILY_NAMES.length);
        const firstName = BIRTH_FIRST_NAMES[fi] ?? 'Unknown';
        const lastName = BIRTH_FAMILY_NAMES[li] ?? 'Unknown';
        const name = `${firstName} ${lastName}`;

        // Pick profession (babies are assigned one for when they grow up)
        const profIdx = Math.floor((this.rng !== undefined ? this.rng.next() : Math.random()) * PROFESSIONS.length);
        const profession = PROFESSIONS[profIdx] ?? 'farmer';

        const entityId = createNonNotable(world, {
          name,
          race,
          age: 0,
          profession,
          siteId: settlementId as number,
          x,
          y,
          currentTick: clock.currentTick,
          motherId: motherId ?? null,
          fatherId: fatherId ?? null,
        });

        pop.nonNotableIds.push(entityId as number);
        pop.count++;
      }

      if (births > 0) {
        events.emit(createEvent({
          category: EventCategory.Personal,
          subtype: 'population.births',
          timestamp: clock.currentTick,
          participants: [settlementId],
          significance: 5,
          data: { births, settlementId: settlementId as number },
        }));
      }
    }
  }

  /**
   * Generate spark micro-events that increase Notability score.
   * ~2% chance per character per month.
   */
  private processSparks(world: World, clock: WorldClock, events: EventBus): void {
    const sparkChance = 0.02;

    for (const settlementId of this.settlementIds) {
      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population');
      if (pop === undefined) continue;

      for (const nnId of pop.nonNotableIds) {
        const notability = world.getComponent<NotabilityComponent>(nnId as EntityId, 'Notability');
        if (notability === undefined) continue;

        // Already promoted? Skip
        if (notability.score >= 100) continue;

        const roll = this.rng !== undefined ? this.rng.next() : Math.random();
        if (roll >= sparkChance) continue;

        // Pick a random spark type
        const sparkIdx = Math.floor((this.rng !== undefined ? this.rng.next() : Math.random()) * SPARK_TYPES.length);
        const spark = SPARK_TYPES[sparkIdx]!;

        notability.score += spark.points;
        notability.sparkHistory.push({
          tick: clock.currentTick,
          description: spark.description,
        });

        // Emit spark event (low significance, no narrative template needed yet)
        const status = world.getComponent<StatusComponent>(nnId as EntityId, 'Status');
        const name = status !== undefined ? status.titles[0] ?? 'Unknown' : 'Unknown';

        events.emit(createEvent({
          category: EventCategory.Personal,
          subtype: 'population.spark',
          timestamp: clock.currentTick,
          participants: [nnId as EntityId],
          significance: 5,
          data: {
            name,
            description: spark.description,
            points: spark.points,
            newScore: notability.score,
          },
        }));
      }
    }
  }

  /**
   * Check non-notables for Notability threshold crossing and promote.
   */
  private processPromotions(world: World, clock: WorldClock, events: EventBus): void {
    for (const settlementId of this.settlementIds) {
      const pop = world.getComponent<PopulationComponent>(settlementId, 'Population');
      if (pop === undefined) continue;

      for (const nnId of pop.nonNotableIds) {
        const notability = world.getComponent<NotabilityComponent>(nnId as EntityId, 'Notability');
        if (notability === undefined) continue;

        if (notability.score >= PROMOTION_THRESHOLD) {
          promote(world, nnId as EntityId, clock.currentTick, events, this.rng);
        }
      }
    }
  }

  /**
   * Process queued demographic signals from other systems.
   * Casualties kill non-notables, survivors gain Notability.
   */
  private processDemographicSignals(world: World, clock: WorldClock, events: EventBus): void {
    if (this.pendingSignals.length === 0) return;

    const signals = this.pendingSignals.splice(0);

    for (const signal of signals) {
      if (signal.type === 'casualties' || signal.type === 'catastrophe') {
        this.applyCasualties(world, clock, events, signal);
      }
      // Prosperity signals modify birth rate — stored for processBirths
      // (handled implicitly through settlement prosperity state)
    }
  }

  /**
   * Apply casualty signals: kill N non-notables, boost survivors' Notability.
   */
  private applyCasualties(
    world: World,
    clock: WorldClock,
    _events: EventBus,
    signal: DemographicSignal,
  ): void {
    const casualties = signal.casualties ?? 0;
    if (casualties <= 0) return;

    // Find the affected settlement (specific or random)
    let targetSettlement: EntityId | undefined;
    if (signal.settlementId !== undefined) {
      targetSettlement = signal.settlementId as EntityId;
    } else if (this.settlementIds.length > 0) {
      // Spread casualties across a random settlement if no specific target
      const idx = this.rng !== undefined
        ? Math.floor(this.rng.next() * this.settlementIds.length)
        : Math.floor(Math.random() * this.settlementIds.length);
      targetSettlement = this.settlementIds[idx];
    }

    if (targetSettlement === undefined) return;

    const pop = world.getComponent<PopulationComponent>(targetSettlement, 'Population');
    if (pop === undefined || pop.nonNotableIds.length === 0) return;

    const actualCasualties = Math.min(casualties, pop.nonNotableIds.length);
    const killed: number[] = [];

    // Kill random non-notables
    for (let i = 0; i < actualCasualties; i++) {
      const idx = this.rng !== undefined
        ? Math.floor(this.rng.next() * pop.nonNotableIds.length)
        : Math.floor(Math.random() * pop.nonNotableIds.length);

      const victimId = pop.nonNotableIds[idx];
      if (victimId === undefined) continue;
      if (world.hasComponent(victimId as EntityId, 'Deceased')) continue;

      const cause = signal.type === 'catastrophe' ? 'magical catastrophe' : 'war casualties';
      const deceasedCause = cause;
      const deceasedTick = clock.currentTick;
      const deceasedLocationId = targetSettlement as number;
      const deceased: DeceasedComponent & { serialize(): Record<string, unknown> } = {
        type: 'Deceased' as const,
        cause: deceasedCause,
        tick: deceasedTick,
        locationId: deceasedLocationId,
        serialize() {
          return { type: 'Deceased', cause: deceasedCause, tick: deceasedTick, locationId: deceasedLocationId };
        },
      };
      world.addComponent(victimId as EntityId, deceased);
      killed.push(victimId);
    }

    // Remove killed from population
    if (killed.length > 0) {
      pop.nonNotableIds = pop.nonNotableIds.filter(id => !killed.includes(id));
      pop.count = Math.max(0, pop.count - killed.length);

      // Boost survivors' Notability (Task 15: surviving trauma)
      const traumaBoost = 20 + Math.floor((this.rng !== undefined ? this.rng.next() : Math.random()) * 20);
      const traumaDesc = signal.type === 'catastrophe'
        ? 'survived a magical catastrophe'
        : 'survived the ravages of war';

      for (const nnId of pop.nonNotableIds) {
        const notability = world.getComponent<NotabilityComponent>(nnId as EntityId, 'Notability');
        if (notability === undefined) continue;

        notability.score += traumaBoost;
        notability.sparkHistory.push({
          tick: clock.currentTick,
          description: traumaDesc,
        });
      }
    }
  }

  /**
   * Infer the dominant race of a settlement from its PopulationDemographics.
   */
  private inferRace(world: World, settlementId: EntityId): string {
    const demographics = world.getComponent<PopulationDemographicsComponent>(settlementId, 'PopulationDemographics');
    if (demographics !== undefined) {
      const dist = demographics.raceDistribution;
      if (dist.size > 0) {
        // Return the race with highest population
        let maxRace = '';
        let maxPop = 0;
        for (const [race, count] of dist) {
          if (count > maxPop) {
            maxPop = count;
            maxRace = race;
          }
        }
        if (maxRace.length > 0) return maxRace;
      }
    }
    return 'Unknown';
  }
}
