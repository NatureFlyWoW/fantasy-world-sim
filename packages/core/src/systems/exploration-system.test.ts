import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import {
  ExplorationSystem,
  EXPEDITION_DURATION_TICKS,
  DISCOVERY_NOTABILITY_BONUS,
  DISCOVERY_RANGE,
} from './exploration-system.js';
import type { EntityId } from '../ecs/types.js';
import type {
  HiddenLocationComponent,
  NotabilityComponent,
} from '../ecs/component.js';
import type { WorldEvent } from '../events/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function registerAllComponents(world: World): void {
  const types = [
    'Position', 'Status', 'Notability', 'Parentage', 'Deceased',
    'Population', 'PopulationDemographics', 'Economy', 'Biome',
    'Ownership', 'Health', 'Personality', 'HiddenLocation',
    'Attribute', 'Skill', 'Membership',
  ];
  for (const type of types) {
    world.registerComponent(type);
  }
}

function makeComponent<T extends { type: string }>(data: T): T & { serialize(): Record<string, unknown> } {
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

function createHiddenLocation(
  world: World,
  x: number,
  y: number,
  locationType: 'ruins' | 'resource' | 'magical' | 'lore',
): EntityId {
  const eid = world.createEntity();
  world.addComponent(eid, makeComponent({
    type: 'Position' as const, x, y,
  }));
  world.addComponent(eid, makeComponent({
    type: 'HiddenLocation' as const,
    locationType,
    revealed: false,
    revealedTick: null,
    x,
    y,
  }));
  return eid;
}

function createExplorer(
  world: World,
  x: number,
  y: number,
  notability: number,
): EntityId {
  const eid = world.createEntity();
  world.addComponent(eid, makeComponent({
    type: 'Position' as const, x, y,
  }));
  world.addComponent(eid, makeComponent({
    type: 'Status' as const,
    conditions: [] as string[],
    titles: ['Explorer'],
    socialClass: 'hunter',
  }));
  world.addComponent(eid, makeComponent({
    type: 'Notability' as const,
    score: notability,
    birthTick: 0,
    sparkHistory: [] as Array<{ tick: number; description: string }>,
  }));
  world.addComponent(eid, makeComponent({
    type: 'Personality' as const,
    openness: 0.8,
    conscientiousness: 0.5,
    extraversion: 0.6,
    agreeableness: 0.5,
    neuroticism: 0.3,
  }));
  return eid;
}

function createSettlement(
  world: World,
  x: number,
  y: number,
  socialClass: string,
): EntityId {
  const eid = world.createEntity();
  world.addComponent(eid, makeComponent({
    type: 'Position' as const, x, y,
  }));
  world.addComponent(eid, makeComponent({
    type: 'Population' as const,
    count: 50,
    growthRate: 0.02,
    nonNotableIds: [] as number[],
  }));
  world.addComponent(eid, makeComponent({
    type: 'Status' as const,
    conditions: [] as string[],
    titles: ['Frontier Camp'],
    socialClass,
  }));
  return eid;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExplorationSystem', () => {
  let world: World;
  let clock: WorldClock;
  let events: EventBus;
  let system: ExplorationSystem;
  let rng: SeededRNG;

  beforeEach(() => {
    world = new World();
    registerAllComponents(world);
    clock = new WorldClock();
    events = new EventBus();
    rng = new SeededRNG(42);
    system = new ExplorationSystem(rng.fork('exploration'));
  });

  // =========================================================================
  // System Properties
  // =========================================================================

  describe('system properties', () => {
    it('has correct system properties', () => {
      expect(system.name).toBe('ExplorationSystem');
      expect(system.frequency).toBe(30); // TickFrequency.Monthly
      expect(system.executionOrder).toBe(65); // ExecutionOrder.EXPLORATION
    });

    it('initializes without errors', () => {
      system.initialize(world);
      expect(system.isInitialized()).toBe(true);
    });
  });

  // =========================================================================
  // Character Discovery (Task 24)
  // =========================================================================

  describe('character discovery', () => {
    it('starts expedition for notable with high openness near hidden location', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      // Explorer at (50, 50) with notability 70 and high openness
      createExplorer(world, 50, 50, 70);
      // Hidden location at (60, 60) -- Manhattan distance = 20, within range
      createHiddenLocation(world, 60, 60, 'ruins');

      system.execute(world, clock, events);

      const startEvents = emitted.filter(e => e.subtype === 'exploration.expedition_start');
      expect(startEvents.length).toBe(1);
    });

    it('discovers hidden location after expedition duration', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      createExplorer(world, 50, 50, 70);
      const hiddenId = createHiddenLocation(world, 60, 60, 'magical');

      // First execution: start expedition
      system.execute(world, clock, events);
      expect(emitted.some(e => e.subtype === 'exploration.expedition_start')).toBe(true);

      // Advance past expedition duration
      clock.advanceBy(EXPEDITION_DURATION_TICKS + 30);

      // Second execution: complete expedition
      system.execute(world, clock, events);

      const discoveryEvents = emitted.filter(e => e.subtype === 'exploration.discovery');
      expect(discoveryEvents.length).toBe(1);

      // Verify the hidden location is now revealed
      const hidden = world.getComponent<HiddenLocationComponent>(hiddenId, 'HiddenLocation');
      expect(hidden).toBeDefined();
      expect(hidden!.revealed).toBe(true);
      expect(hidden!.revealedTick).toBe(clock.currentTick);
    });

    it('awards notability bonus to discoverer', () => {
      createExplorer(world, 50, 50, 70);
      createHiddenLocation(world, 60, 60, 'ruins');

      // Start expedition
      system.execute(world, clock, events);

      // Complete expedition
      clock.advanceBy(EXPEDITION_DURATION_TICKS + 30);
      system.execute(world, clock, events);

      // Check all entities with Notability for the explorer
      const entities = world.query('Notability', 'Personality');
      expect(entities.length).toBe(1);

      const notability = world.getComponent<NotabilityComponent>(entities[0]!, 'Notability');
      expect(notability).toBeDefined();
      expect(notability!.score).toBe(70 + DISCOVERY_NOTABILITY_BONUS);
    });

    it('emits Exploratory category events', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      createExplorer(world, 50, 50, 70);
      createHiddenLocation(world, 60, 60, 'lore');

      system.execute(world, clock, events);
      clock.advanceBy(EXPEDITION_DURATION_TICKS + 30);
      system.execute(world, clock, events);

      // All events should be Exploratory
      expect(emitted.length).toBeGreaterThanOrEqual(2); // start + discovery
      for (const event of emitted) {
        expect(event.category).toBe(EventCategory.Exploratory);
      }
    });

    it('ignores already revealed locations', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      createExplorer(world, 50, 50, 70);

      // Create a hidden location that is already revealed
      const eid = world.createEntity();
      world.addComponent(eid, makeComponent({
        type: 'Position' as const, x: 60, y: 60,
      }));
      world.addComponent(eid, makeComponent({
        type: 'HiddenLocation' as const,
        locationType: 'ruins' as const,
        revealed: true,
        revealedTick: 0,
        x: 60,
        y: 60,
      }));

      system.execute(world, clock, events);

      // No expedition should start since the only nearby location is already revealed
      const startEvents = emitted.filter(e => e.subtype === 'exploration.expedition_start');
      expect(startEvents.length).toBe(0);
    });

    it('does not start expedition for characters with low notability', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      // Explorer with notability below threshold (30 < 60)
      createExplorer(world, 50, 50, 30);
      createHiddenLocation(world, 60, 60, 'ruins');

      system.execute(world, clock, events);

      const startEvents = emitted.filter(e => e.subtype === 'exploration.expedition_start');
      expect(startEvents.length).toBe(0);
    });

    it('does not start expedition for characters with low openness', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      // Create explorer with high notability but low openness
      const eid = world.createEntity();
      world.addComponent(eid, makeComponent({
        type: 'Position' as const, x: 50, y: 50,
      }));
      world.addComponent(eid, makeComponent({
        type: 'Status' as const,
        conditions: [] as string[],
        titles: ['Scholar'],
        socialClass: 'noble',
      }));
      world.addComponent(eid, makeComponent({
        type: 'Notability' as const,
        score: 70,
        birthTick: 0,
        sparkHistory: [] as Array<{ tick: number; description: string }>,
      }));
      world.addComponent(eid, makeComponent({
        type: 'Personality' as const,
        openness: 0.3, // Below 0.6 threshold
        conscientiousness: 0.8,
        extraversion: 0.4,
        agreeableness: 0.7,
        neuroticism: 0.2,
      }));

      createHiddenLocation(world, 60, 60, 'ruins');

      system.execute(world, clock, events);

      const startEvents = emitted.filter(e => e.subtype === 'exploration.expedition_start');
      expect(startEvents.length).toBe(0);
    });

    it('does not start expedition when no hidden locations are in range', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      createExplorer(world, 50, 50, 70);
      // Hidden location far away -- Manhattan distance = 200, well beyond DISCOVERY_RANGE
      createHiddenLocation(world, 150, 150, 'ruins');

      system.execute(world, clock, events);

      const startEvents = emitted.filter(e => e.subtype === 'exploration.expedition_start');
      expect(startEvents.length).toBe(0);
    });
  });

  // =========================================================================
  // Frontier Encounters (Task 25)
  // =========================================================================

  describe('frontier encounters', () => {
    it('generates frontier events for camp settlements', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      createSettlement(world, 100, 100, 'camp');

      // Run many times to guarantee at least one trigger (15% per run)
      // With 50 iterations, probability of at least one hit is 1 - 0.85^50 > 0.9997
      for (let i = 0; i < 50; i++) {
        system.execute(world, clock, events);
        clock.advanceBy(30);
      }

      // Filter for frontier events (not expedition events)
      const frontierEvents = emitted.filter(e => e.subtype.startsWith('exploration.frontier'));
      expect(frontierEvents.length).toBeGreaterThan(0);

      // Verify they are all Exploratory category
      for (const event of frontierEvents) {
        expect(event.category).toBe(EventCategory.Exploratory);
      }
    });

    it('does not generate frontier events for established settlements', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      createSettlement(world, 100, 100, 'town');

      for (let i = 0; i < 20; i++) {
        system.execute(world, clock, events);
        clock.advanceBy(30);
      }

      const frontierEvents = emitted.filter(e => e.subtype.startsWith('exploration.frontier'));
      expect(frontierEvents.length).toBe(0);
    });

    it('does not generate frontier events for city settlements', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      createSettlement(world, 100, 100, 'city');

      for (let i = 0; i < 10; i++) {
        system.execute(world, clock, events);
        clock.advanceBy(30);
      }

      const frontierEvents = emitted.filter(e => e.subtype.startsWith('exploration.frontier'));
      expect(frontierEvents.length).toBe(0);
    });

    it('includes settlement name in frontier event data', () => {
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      createSettlement(world, 100, 100, 'camp');

      // Run until we get a frontier event
      for (let i = 0; i < 40; i++) {
        system.execute(world, clock, events);
        clock.advanceBy(30);
      }

      const frontierEvents = emitted.filter(e => e.subtype.startsWith('exploration.frontier'));
      if (frontierEvents.length > 0) {
        const data = frontierEvents[0]!.data as Record<string, unknown>;
        expect(data['settlementName']).toBe('Frontier Camp');
        expect(typeof data['description']).toBe('string');
      }
    });
  });

  // =========================================================================
  // World-Revealed Secrets (Task 26)
  // =========================================================================

  describe('world-revealed secrets', () => {
    it('reveals hidden location when disaster occurs nearby', () => {
      const hiddenId = createHiddenLocation(world, 50, 50, 'ruins');

      // First execute to subscribe to events
      system.execute(world, clock, events);

      // Emit a high-severity disaster event near the hidden location
      events.emit(createEvent({
        category: EventCategory.Disaster,
        subtype: 'ecology.earthquake',
        timestamp: clock.currentTick,
        participants: [],
        significance: 90, // High severity = high reveal chance
        data: { x: 55, y: 55 },
      }));

      // Execute again to process the pending environmental event
      // Need high severity + favorable RNG. Run a few times with new systems to ensure coverage.
      let revealed = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        const attemptRng = new SeededRNG(attempt);
        const attemptSystem = new ExplorationSystem(attemptRng.fork('exploration'));

        const attemptWorld = new World();
        registerAllComponents(attemptWorld);
        const attemptClock = new WorldClock();
        const attemptEvents = new EventBus();

        const attemptHiddenId = createHiddenLocation(attemptWorld, 50, 50, 'ruins');

        // Subscribe
        attemptSystem.execute(attemptWorld, attemptClock, attemptEvents);

        // Emit disaster
        attemptEvents.emit(createEvent({
          category: EventCategory.Disaster,
          subtype: 'ecology.earthquake',
          timestamp: attemptClock.currentTick,
          participants: [],
          significance: 90,
          data: { x: 55, y: 55 },
        }));

        // Process
        attemptSystem.execute(attemptWorld, attemptClock, attemptEvents);

        const hidden = attemptWorld.getComponent<HiddenLocationComponent>(attemptHiddenId, 'HiddenLocation');
        if (hidden !== undefined && hidden.revealed) {
          revealed = true;
          break;
        }
      }

      expect(revealed).toBe(true);
    });

    it('does not reveal distant hidden locations', () => {
      createHiddenLocation(world, 50, 50, 'lore');

      // Subscribe
      system.execute(world, clock, events);

      // Emit disaster far away (Manhattan distance = 300, well beyond 30)
      events.emit(createEvent({
        category: EventCategory.Disaster,
        subtype: 'ecology.volcanic_eruption',
        timestamp: clock.currentTick,
        participants: [],
        significance: 100,
        data: { x: 200, y: 200 },
      }));

      // Process
      system.execute(world, clock, events);

      const hiddenEntities = world.query('HiddenLocation');
      for (const eid of hiddenEntities) {
        const hidden = world.getComponent<HiddenLocationComponent>(eid, 'HiddenLocation');
        expect(hidden).toBeDefined();
        expect(hidden!.revealed).toBe(false);
      }
    });

    it('emits world_revealed event when location is discovered by disaster', () => {
      const emitted: WorldEvent[] = [];

      // Use a deterministic approach: try multiple seeds to find one that reveals
      let foundSeed = -1;
      for (let seed = 0; seed < 20; seed++) {
        const testRng = new SeededRNG(seed);
        const testSystem = new ExplorationSystem(testRng.fork('exploration'));
        const testWorld = new World();
        registerAllComponents(testWorld);
        const testClock = new WorldClock();
        const testEvents = new EventBus();

        const testEmitted: WorldEvent[] = [];
        testEvents.on(EventCategory.Exploratory, (event) => { testEmitted.push(event); });

        createHiddenLocation(testWorld, 50, 50, 'magical');

        // Subscribe
        testSystem.execute(testWorld, testClock, testEvents);

        // Emit disaster nearby with high significance
        testEvents.emit(createEvent({
          category: EventCategory.Disaster,
          subtype: 'ecology.earthquake',
          timestamp: testClock.currentTick,
          participants: [],
          significance: 95,
          data: { x: 52, y: 48 },
        }));

        // Process
        testSystem.execute(testWorld, testClock, testEvents);

        const revealedEvents = testEmitted.filter(e => e.subtype === 'exploration.world_revealed');
        if (revealedEvents.length > 0) {
          foundSeed = seed;
          break;
        }
      }

      expect(foundSeed).toBeGreaterThanOrEqual(0);
    });

    it('clears pending environmental events after processing', () => {
      createHiddenLocation(world, 50, 50, 'resource');

      // Subscribe
      system.execute(world, clock, events);

      // Emit disaster
      events.emit(createEvent({
        category: EventCategory.Disaster,
        subtype: 'ecology.flood',
        timestamp: clock.currentTick,
        participants: [],
        significance: 50,
        data: { x: 55, y: 55 },
      }));

      // Process once -- this should clear pending events
      system.execute(world, clock, events);

      // Create a new unrevealed location
      createHiddenLocation(world, 55, 55, 'lore');

      // Process again -- should NOT attempt to reveal anything
      // since pending events were cleared
      const emitted: WorldEvent[] = [];
      events.on(EventCategory.Exploratory, (event) => { emitted.push(event); });

      system.execute(world, clock, events);

      // If there was a new hidden location added and no new disaster, no world_revealed events
      const revealedEvents = emitted.filter(e => e.subtype === 'exploration.world_revealed');
      expect(revealedEvents.length).toBe(0);
    });

    it('ignores disaster events without x/y coordinates', () => {
      createHiddenLocation(world, 50, 50, 'ruins');

      // Subscribe
      system.execute(world, clock, events);

      // Emit disaster without x/y data
      events.emit(createEvent({
        category: EventCategory.Disaster,
        subtype: 'ecology.drought',
        timestamp: clock.currentTick,
        participants: [],
        significance: 80,
        data: { severity: 80 }, // No x/y coordinates
      }));

      // Process
      system.execute(world, clock, events);

      const hiddenEntities = world.query('HiddenLocation');
      for (const eid of hiddenEntities) {
        const hidden = world.getComponent<HiddenLocationComponent>(eid, 'HiddenLocation');
        expect(hidden).toBeDefined();
        expect(hidden!.revealed).toBe(false);
      }
    });
  });
});
