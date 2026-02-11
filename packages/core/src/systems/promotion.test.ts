import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../ecs/world.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import { promote, PROMOTION_THRESHOLD } from './promotion.js';
import { createNonNotable } from './population-utils.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import type { EntityId } from '../ecs/types.js';
import type {
  GoalComponent,
  HealthComponent,
  MemoryComponent,
  NotabilityComponent,
  PersonalityComponent,
} from '../ecs/component.js';

function registerAllComponents(world: World): void {
  const types = [
    'Position', 'Status', 'Notability', 'Parentage', 'Deceased',
    'Population', 'PopulationDemographics', 'Economy', 'Biome',
    'Ownership', 'Health', 'CreatureType', 'HiddenLocation',
    'Personality', 'Goal', 'Memory',
  ];
  for (const type of types) {
    world.registerComponent(type);
  }
}

function createCharacterAtThreshold(world: World, score: number): EntityId {
  const eid = createNonNotable(world, {
    name: 'Test Hero',
    race: 'Human',
    age: 30,
    profession: 'blacksmith',
    siteId: 1,
    x: 10,
    y: 20,
    currentTick: 0,
    motherId: null,
    fatherId: null,
  });

  // Set notability score and spark history
  const notability = world.getComponent<NotabilityComponent>(eid, 'Notability');
  if (notability !== undefined) {
    notability.score = score;
    notability.sparkHistory = [
      { tick: 100, description: 'showed unexpected courage' },
      { tick: 200, description: 'made a shrewd trade' },
      { tick: 300, description: 'displayed unusual talent' },
    ];
  }

  return eid;
}

describe('Promotion System', () => {
  let world: World;
  let events: EventBus;
  let rng: SeededRNG;

  beforeEach(() => {
    world = new World();
    registerAllComponents(world);
    events = new EventBus();
    rng = new SeededRNG(42);
  });

  describe('promote()', () => {
    it('promotes non-notable to full notable when Notability reaches threshold', () => {
      const eid = createCharacterAtThreshold(world, 105);

      const result = promote(world, eid, 1000, events, rng.fork('promo'));

      expect(result).toBe(true);
      expect(world.hasComponent(eid, 'Personality')).toBe(true);
      expect(world.hasComponent(eid, 'Goal')).toBe(true);
      expect(world.hasComponent(eid, 'Memory')).toBe(true);
      expect(world.hasComponent(eid, 'Health')).toBe(true);
    });

    it('retains existing components after promotion', () => {
      const eid = createCharacterAtThreshold(world, 100);

      promote(world, eid, 1000, events, rng.fork('promo'));

      // Should retain original components
      expect(world.hasComponent(eid, 'Status')).toBe(true);
      expect(world.hasComponent(eid, 'Position')).toBe(true);
      expect(world.hasComponent(eid, 'Parentage')).toBe(true);
      expect(world.hasComponent(eid, 'Notability')).toBe(true);
    });

    it('does not promote when score is below threshold', () => {
      const eid = createCharacterAtThreshold(world, 99);

      const result = promote(world, eid, 1000, events, rng.fork('promo'));

      expect(result).toBe(false);
      expect(world.hasComponent(eid, 'Personality')).toBe(false);
    });

    it('does not re-promote an already promoted character', () => {
      const eid = createCharacterAtThreshold(world, 105);

      const result1 = promote(world, eid, 1000, events, rng.fork('promo'));
      const result2 = promote(world, eid, 2000, events, rng.fork('promo'));

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('never demotes a promoted character even if score drops', () => {
      const eid = createCharacterAtThreshold(world, 105);

      promote(world, eid, 1000, events, rng.fork('promo'));

      // Manually drop score below threshold
      const notability = world.getComponent<NotabilityComponent>(eid, 'Notability');
      if (notability !== undefined) {
        notability.score = 50;
      }

      // Should still have notable components
      expect(world.hasComponent(eid, 'Personality')).toBe(true);
      expect(world.hasComponent(eid, 'Goal')).toBe(true);
      expect(world.hasComponent(eid, 'Memory')).toBe(true);
    });
  });

  describe('personality generation', () => {
    it('generates personality values from spark history', () => {
      const eid = createCharacterAtThreshold(world, 105);

      promote(world, eid, 1000, events, rng.fork('promo'));

      const personality = world.getComponent<PersonalityComponent>(eid, 'Personality');
      expect(personality).toBeDefined();

      // All traits should be in [0, 1]
      expect(personality!.openness).toBeGreaterThanOrEqual(0);
      expect(personality!.openness).toBeLessThanOrEqual(1);
      expect(personality!.conscientiousness).toBeGreaterThanOrEqual(0);
      expect(personality!.conscientiousness).toBeLessThanOrEqual(1);
      expect(personality!.extraversion).toBeGreaterThanOrEqual(0);
      expect(personality!.extraversion).toBeLessThanOrEqual(1);
      expect(personality!.agreeableness).toBeGreaterThanOrEqual(0);
      expect(personality!.agreeableness).toBeLessThanOrEqual(1);
      expect(personality!.neuroticism).toBeGreaterThanOrEqual(0);
      expect(personality!.neuroticism).toBeLessThanOrEqual(1);
    });

    it('adjusts personality based on courage sparks', () => {
      const eid = createNonNotable(world, {
        name: 'Brave One', race: 'Human', age: 30, profession: 'guard',
        siteId: 1, x: 10, y: 20, currentTick: 0, motherId: null, fatherId: null,
      });
      const notability = world.getComponent<NotabilityComponent>(eid, 'Notability')!;
      notability.score = 100;
      notability.sparkHistory = [
        { tick: 100, description: 'showed unexpected courage' },
        { tick: 200, description: 'showed unexpected courage' },
        { tick: 300, description: 'showed unexpected courage' },
      ];

      promote(world, eid, 1000, events, rng.fork('promo'));

      const personality = world.getComponent<PersonalityComponent>(eid, 'Personality')!;
      // Repeated courage should boost extraversion and reduce neuroticism
      expect(personality.extraversion).toBeGreaterThan(0.5);
    });
  });

  describe('goal generation', () => {
    it('assigns profession-based goals', () => {
      const eid = createCharacterAtThreshold(world, 105);

      promote(world, eid, 1000, events, rng.fork('promo'));

      const goals = world.getComponent<GoalComponent>(eid, 'Goal');
      expect(goals).toBeDefined();
      expect(goals!.objectives.length).toBeGreaterThan(0);
      expect(goals!.objectives.length).toBeLessThanOrEqual(2);
      // Blacksmith-specific goals
      expect(goals!.objectives[0]).toBe('Master the craft');
    });
  });

  describe('memory backfill', () => {
    it('creates memories from spark history', () => {
      const eid = createCharacterAtThreshold(world, 105);

      promote(world, eid, 1000, events, rng.fork('promo'));

      const memory = world.getComponent<MemoryComponent>(eid, 'Memory');
      expect(memory).toBeDefined();
      expect(memory!.memories.length).toBe(3); // 3 sparks = 3 memories
      expect(memory!.capacity).toBe(50);
    });
  });

  describe('event emission', () => {
    it('emits promotion event with narrative potential', () => {
      const eid = createCharacterAtThreshold(world, 105);
      const handler = vi.fn();
      events.on(EventCategory.Personal, handler);

      promote(world, eid, 1000, events, rng.fork('promo'));

      const promotionEvents = handler.mock.calls.filter(
        c => (c[0] as { subtype: string }).subtype === 'population.promotion'
      );
      expect(promotionEvents.length).toBe(1);

      const evt = promotionEvents[0]![0] as { data: Record<string, unknown> };
      expect(evt.data.name).toBe('Test Hero');
      expect(evt.data.profession).toBe('blacksmith');
      expect(evt.data.backstory).toBeDefined();
      expect(evt.data.notabilityScore).toBeGreaterThanOrEqual(100);
    });

    it('does not emit event when promotion fails', () => {
      const eid = createCharacterAtThreshold(world, 50);
      const handler = vi.fn();
      events.on(EventCategory.Personal, handler);

      promote(world, eid, 1000, events, rng.fork('promo'));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('health component', () => {
    it('adds Health component with full health', () => {
      const eid = createCharacterAtThreshold(world, 105);

      promote(world, eid, 1000, events, rng.fork('promo'));

      const health = world.getComponent<HealthComponent>(eid, 'Health');
      expect(health).toBeDefined();
      expect(health!.current).toBe(100);
      expect(health!.maximum).toBe(100);
      expect(health!.injuries).toEqual([]);
      expect(health!.diseases).toEqual([]);
    });
  });
});
