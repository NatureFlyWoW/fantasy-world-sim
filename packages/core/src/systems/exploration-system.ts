/**
 * ExplorationSystem -- manages discovery of hidden locations, frontier encounters,
 * and world-revealed secrets.
 *
 * This is the first system to produce EventCategory.Exploratory events, filling
 * the previously empty event category.
 *
 * Runs monthly (every 30 ticks). Follows the Phase 3 internal Maps pattern.
 */

import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { TickFrequency } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { WorldEvent } from '../events/types.js';
import type { SeededRNG } from '../utils/seeded-rng.js';
import type { EntityId } from '../ecs/types.js';
import type {
  PositionComponent,
  StatusComponent,
  NotabilityComponent,
  PersonalityComponent,
  HiddenLocationComponent,
} from '../ecs/component.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Duration of an expedition in ticks (~3 months). */
export const EXPEDITION_DURATION_TICKS = 90;

/** Maximum Manhattan-distance to detect hidden locations. */
export const DISCOVERY_RANGE = 100;

/** Minimum Notability.score for a character to be considered an explorer. */
export const DISCOVERY_NOTABILITY_THRESHOLD = 60;

/** Notability bonus awarded upon successful discovery. */
export const DISCOVERY_NOTABILITY_BONUS = 30;

/** How long a settlement must exist (ticks) before it stops being a frontier camp. */
export const FRONTIER_AGE_TICKS = 720; // 2 years

/** Possible frontier events with subtypes, significance and descriptions. */
export const FRONTIER_EVENTS = [
  { subtype: 'exploration.frontier_danger', significance: 40, description: 'dangerous creatures spotted nearby' },
  { subtype: 'exploration.frontier_opportunity', significance: 30, description: 'fertile land discovered' },
  { subtype: 'exploration.frontier_wonder', significance: 50, description: 'natural wonder found' },
  { subtype: 'exploration.frontier_hardship', significance: 35, description: 'harsh conditions challenge settlers' },
  { subtype: 'exploration.frontier_discovery', significance: 45, description: 'hidden resource deposit uncovered' },
] as const;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ActiveExpedition {
  targetId: number;
  startTick: number;
  duration: number;
}

interface PendingEnvironmentalEvent {
  x: number;
  y: number;
  severity: number;
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export class ExplorationSystem extends BaseSystem {
  readonly name = 'ExplorationSystem';
  readonly frequency = TickFrequency.Monthly;
  readonly executionOrder = ExecutionOrder.EXPLORATION;

  // Internal state (Phase 3 Maps pattern)
  private activeExpeditions: Map<number, ActiveExpedition> = new Map();
  private subscribed = false;
  private pendingEnvironmentalEvents: PendingEnvironmentalEvent[] = [];

  constructor(private readonly rng: SeededRNG) {
    super();
  }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    this.subscribeToEnvironmentalEvents(events);
    this.processCharacterDiscovery(world, clock, events);
    this.processFrontierEncounters(world, clock, events);
    this.processWorldRevealedSecrets(world, clock, events);
  }

  // -------------------------------------------------------------------------
  // Lazy event subscription (same pattern as PopulationSystem)
  // -------------------------------------------------------------------------

  private subscribeToEnvironmentalEvents(events: EventBus): void {
    if (this.subscribed) return;
    this.subscribed = true;

    events.on(EventCategory.Disaster, (event: WorldEvent) => {
      const data = event.data as Record<string, unknown>;
      if (typeof data['x'] === 'number' && typeof data['y'] === 'number') {
        this.pendingEnvironmentalEvents.push({
          x: data['x'],
          y: data['y'],
          severity: event.significance,
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // Character Discovery (Task 24)
  // -------------------------------------------------------------------------

  private processCharacterDiscovery(world: World, clock: WorldClock, events: EventBus): void {
    // 1. Check ongoing expeditions for completion
    const completed: number[] = [];
    for (const [explorerId, expedition] of this.activeExpeditions) {
      if (clock.currentTick - expedition.startTick >= expedition.duration) {
        completed.push(explorerId);
        this.completeExpedition(world, clock, events, explorerId as EntityId, expedition);
      }
    }
    for (const id of completed) {
      this.activeExpeditions.delete(id);
    }

    // 2. Find new explorers
    const notableEntities = world.query('Notability');
    for (const eid of notableEntities) {
      const entityNum = eid as number;
      if (this.activeExpeditions.has(entityNum)) continue;

      const notability = world.getComponent<NotabilityComponent>(eid, 'Notability');
      if (notability === undefined) continue;

      const personality = world.getComponent<PersonalityComponent>(eid, 'Personality');
      const position = world.getComponent<PositionComponent>(eid, 'Position');
      if (position === undefined) continue;

      // Notable characters need high openness, OR very high notability for adventurous commoners
      const isNotableExplorer = notability.score >= DISCOVERY_NOTABILITY_THRESHOLD
        && personality !== undefined && personality.openness > 0.6;
      const isAdventurousCommoner = notability.score >= 80 && personality === undefined;

      if (!isNotableExplorer && !isAdventurousCommoner) continue;

      // Find nearby unrevealed hidden locations within DISCOVERY_RANGE (Manhattan distance)
      const target = this.findNearbyUnrevealedLocation(world, position.x, position.y);
      if (target === null) continue;

      // Start expedition
      this.activeExpeditions.set(entityNum, {
        targetId: target as number,
        startTick: clock.currentTick,
        duration: EXPEDITION_DURATION_TICKS,
      });

      // Emit expedition start event
      events.emit(createEvent({
        category: EventCategory.Exploratory,
        subtype: 'exploration.expedition_start',
        timestamp: clock.currentTick,
        participants: [eid],
        significance: 30,
        data: {
          explorerId: entityNum,
          targetId: target as number,
        },
      }));
    }
  }

  private completeExpedition(
    world: World,
    clock: WorldClock,
    events: EventBus,
    explorerId: EntityId,
    expedition: ActiveExpedition,
  ): void {
    const targetId = expedition.targetId as EntityId;
    const hidden = world.getComponent<HiddenLocationComponent>(targetId, 'HiddenLocation');
    if (hidden === undefined || hidden.revealed) return;

    // Reveal the hidden location
    hidden.revealed = true;
    hidden.revealedTick = clock.currentTick;

    // Award notability bonus to explorer
    const notability = world.getComponent<NotabilityComponent>(explorerId, 'Notability');
    if (notability !== undefined) {
      notability.score += DISCOVERY_NOTABILITY_BONUS;
    }

    // Emit discovery event
    events.emit(createEvent({
      category: EventCategory.Exploratory,
      subtype: 'exploration.discovery',
      timestamp: clock.currentTick,
      participants: [explorerId],
      significance: 55,
      data: {
        explorerId: explorerId as number,
        locationId: expedition.targetId,
        locationType: hidden.locationType,
        x: hidden.x,
        y: hidden.y,
      },
    }));
  }

  private findNearbyUnrevealedLocation(world: World, cx: number, cy: number): EntityId | null {
    const hiddenEntities = world.query('HiddenLocation');
    let bestId: EntityId | null = null;
    let bestDist = Infinity;

    for (const eid of hiddenEntities) {
      const hidden = world.getComponent<HiddenLocationComponent>(eid, 'HiddenLocation');
      if (hidden === undefined || hidden.revealed) continue;

      const dx = Math.abs(hidden.x - cx);
      const dy = Math.abs(hidden.y - cy);
      const dist = dx + dy; // Manhattan distance

      if (dist <= DISCOVERY_RANGE && dist < bestDist) {
        bestDist = dist;
        bestId = eid;
      }
    }

    return bestId;
  }

  // -------------------------------------------------------------------------
  // Frontier Encounters (Task 25)
  // -------------------------------------------------------------------------

  private processFrontierEncounters(world: World, clock: WorldClock, events: EventBus): void {
    const settlements = world.query('Population', 'Status');

    for (const eid of settlements) {
      const status = world.getComponent<StatusComponent>(eid, 'Status');
      if (status === undefined || status.socialClass !== 'camp') continue;

      // Roll for frontier event: 15% chance per month
      if (this.rng.next() >= 0.15) continue;

      // Pick a random frontier event
      const frontierEvent = FRONTIER_EVENTS[this.rng.nextInt(0, FRONTIER_EVENTS.length - 1)]!;

      const settlementName = status.titles[0] ?? 'Unknown Camp';

      events.emit(createEvent({
        category: EventCategory.Exploratory,
        subtype: frontierEvent.subtype,
        timestamp: clock.currentTick,
        participants: [eid],
        significance: frontierEvent.significance,
        data: {
          settlementName,
          description: frontierEvent.description,
        },
      }));
    }
  }

  // -------------------------------------------------------------------------
  // World-Revealed Secrets (Task 26)
  // -------------------------------------------------------------------------

  private processWorldRevealedSecrets(world: World, clock: WorldClock, events: EventBus): void {
    if (this.pendingEnvironmentalEvents.length === 0) return;

    const hiddenEntities = world.query('HiddenLocation');
    const pending = [...this.pendingEnvironmentalEvents];
    this.pendingEnvironmentalEvents = [];

    for (const envEvent of pending) {
      for (const eid of hiddenEntities) {
        const hidden = world.getComponent<HiddenLocationComponent>(eid, 'HiddenLocation');
        if (hidden === undefined || hidden.revealed) continue;

        // Check Manhattan distance <= 30
        const dx = Math.abs(hidden.x - envEvent.x);
        const dy = Math.abs(hidden.y - envEvent.y);
        if (dx + dy > 30) continue;

        // Roll reveal chance: 20-50% based on severity
        const revealChance = 0.2 + (envEvent.severity / 100) * 0.3;
        if (this.rng.next() >= revealChance) continue;

        // Reveal the hidden location
        hidden.revealed = true;
        hidden.revealedTick = clock.currentTick;

        events.emit(createEvent({
          category: EventCategory.Exploratory,
          subtype: 'exploration.world_revealed',
          timestamp: clock.currentTick,
          participants: [eid],
          significance: 45,
          data: {
            locationType: hidden.locationType,
            x: hidden.x,
            y: hidden.y,
            revealedBy: 'environmental_event',
            severity: envEvent.severity,
          },
        }));
      }
    }
  }
}
