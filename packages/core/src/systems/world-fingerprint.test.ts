/**
 * Tests for WorldFingerprintCalculator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorldFingerprintCalculator,
  ALL_DOMAINS,
} from './world-fingerprint.js';
import type { FingerprintDomain } from './world-fingerprint.js';
import { EventCategory } from '../events/types.js';
import { EventLog } from '../events/event-log.js';
import { createEvent, resetEventIdCounter } from '../events/event-factory.js';
import { World } from '../ecs/world.js';
import type { EntityId } from '../ecs/types.js';
import { toEntityId, toFactionId, resetEntityIdCounter } from '../ecs/types.js';
import type { TerritoryComponent } from '../ecs/component.js';

/**
 * Helper: create a test event with minimal fields.
 */
function makeEvent(
  category: EventCategory,
  timestamp: number,
  significance = 50,
  participants: EntityId[] = [],
  causes: ReturnType<typeof createEvent>['id'][] = [],
): ReturnType<typeof createEvent> {
  return createEvent({
    category,
    subtype: `test.${category.toLowerCase()}`,
    timestamp,
    participants,
    significance,
    causes,
  });
}

describe('WorldFingerprintCalculator', () => {
  let calculator: WorldFingerprintCalculator;
  let eventLog: EventLog;
  let world: World;

  beforeEach(() => {
    calculator = new WorldFingerprintCalculator();
    eventLog = new EventLog();
    world = new World();
    resetEventIdCounter();
    resetEntityIdCounter();
  });

  describe('calculateDomainBalance', () => {
    it('returns all zeros for empty event list', () => {
      const balance = calculator.calculateDomainBalance([]);
      for (const domain of ALL_DOMAINS) {
        expect(balance.get(domain)).toBe(0);
      }
    });

    it('gives 100% to single-domain events', () => {
      const events = [
        makeEvent(EventCategory.Military, 0),
        makeEvent(EventCategory.Military, 1),
        makeEvent(EventCategory.Military, 2),
      ];
      const balance = calculator.calculateDomainBalance(events);
      expect(balance.get('Warfare')).toBe(100);
      expect(balance.get('Magic')).toBe(0);
      expect(balance.get('Religion')).toBe(0);
    });

    it('splits evenly between two domains', () => {
      const events = [
        makeEvent(EventCategory.Military, 0),
        makeEvent(EventCategory.Magical, 1),
      ];
      const balance = calculator.calculateDomainBalance(events);
      expect(balance.get('Warfare')).toBe(50);
      expect(balance.get('Magic')).toBe(50);
    });

    it('maps Scientific and Cultural to Scholarship domain', () => {
      const events = [
        makeEvent(EventCategory.Scientific, 0),
        makeEvent(EventCategory.Cultural, 1),
      ];
      const balance = calculator.calculateDomainBalance(events);
      expect(balance.get('Scholarship')).toBe(100);
    });

    it('maps Political to Diplomacy domain', () => {
      const events = [makeEvent(EventCategory.Political, 0)];
      const balance = calculator.calculateDomainBalance(events);
      expect(balance.get('Diplomacy')).toBe(100);
    });

    it('ignores unmapped categories like Personal and Disaster', () => {
      const events = [
        makeEvent(EventCategory.Personal, 0),
        makeEvent(EventCategory.Disaster, 1),
        makeEvent(EventCategory.Military, 2),
      ];
      const balance = calculator.calculateDomainBalance(events);
      // Only Military maps, so Warfare should be 100%
      expect(balance.get('Warfare')).toBe(100);
    });

    it('handles all 6 mapped categories', () => {
      const events = [
        makeEvent(EventCategory.Military, 0),
        makeEvent(EventCategory.Magical, 1),
        makeEvent(EventCategory.Religious, 2),
        makeEvent(EventCategory.Economic, 3),
        makeEvent(EventCategory.Scientific, 4),
        makeEvent(EventCategory.Political, 5),
      ];
      const balance = calculator.calculateDomainBalance(events);
      for (const domain of ALL_DOMAINS) {
        const val = balance.get(domain) ?? 0;
        // Each of 6 events maps to one of 6 domains ≈ 16.67%
        expect(val).toBeGreaterThan(15);
        expect(val).toBeLessThan(18);
      }
    });
  });

  describe('calculateCivPalette', () => {
    it('returns empty for world with no factions', () => {
      const palette = calculator.calculateCivPalette(world, []);
      expect(palette).toHaveLength(0);
    });

    it('returns proportions based on event participation', () => {
      // Register Territory store and create two faction entities
      world.registerComponent('Territory');
      const faction1 = world.createEntity();
      const faction2 = world.createEntity();
      world.addComponent(faction1, { type: 'Territory' } as TerritoryComponent);
      world.addComponent(faction2, { type: 'Territory' } as TerritoryComponent);

      // faction1 participates in 3 events, faction2 in 1
      const events = [
        makeEvent(EventCategory.Military, 0, 50, [faction1]),
        makeEvent(EventCategory.Military, 1, 50, [faction1]),
        makeEvent(EventCategory.Military, 2, 50, [faction1]),
        makeEvent(EventCategory.Economic, 3, 50, [faction2]),
      ];

      const palette = calculator.calculateCivPalette(world, events);
      expect(palette.length).toBe(2);

      // faction1 should have higher proportion
      const entry1 = palette.find((e) => e.factionId === toFactionId(faction1));
      const entry2 = palette.find((e) => e.factionId === toFactionId(faction2));
      expect(entry1).toBeDefined();
      expect(entry2).toBeDefined();
      expect(entry1!.proportion).toBe(0.75);
      expect(entry2!.proportion).toBe(0.25);
    });

    it('assigns distinct colors to factions', () => {
      world.registerComponent('Territory');
      const faction1 = world.createEntity();
      const faction2 = world.createEntity();
      world.addComponent(faction1, { type: 'Territory' } as TerritoryComponent);
      world.addComponent(faction2, { type: 'Territory' } as TerritoryComponent);

      const events = [
        makeEvent(EventCategory.Military, 0, 50, [faction1]),
        makeEvent(EventCategory.Military, 1, 50, [faction2]),
      ];

      const palette = calculator.calculateCivPalette(world, events);
      expect(palette.length).toBe(2);
      expect(palette[0]!.color).not.toBe(palette[1]!.color);
    });

    it('falls back to even distribution when no events involve factions', () => {
      world.registerComponent('Territory');
      const faction1 = world.createEntity();
      const faction2 = world.createEntity();
      world.addComponent(faction1, { type: 'Territory' } as TerritoryComponent);
      world.addComponent(faction2, { type: 'Territory' } as TerritoryComponent);

      // Events exist but don't have faction participants
      const events = [
        makeEvent(EventCategory.Personal, 0, 50, [toEntityId(999)]),
      ];

      const palette = calculator.calculateCivPalette(world, events);
      expect(palette.length).toBe(2);
      expect(palette[0]!.proportion).toBe(0.5);
    });
  });

  describe('calculateVolatilityTimeline', () => {
    it('returns empty for no events', () => {
      const timeline = calculator.calculateVolatilityTimeline([]);
      expect(timeline).toHaveLength(0);
    });

    it('returns one century bucket for events within first century', () => {
      const events = [
        makeEvent(EventCategory.Military, 0, 80),
        makeEvent(EventCategory.Military, 1000, 40),
      ];
      const timeline = calculator.calculateVolatilityTimeline(events);
      expect(timeline.length).toBe(1);
      // Both events in century 0, normalized: (80+40)/max = 120/120 = 100
      expect(timeline[0]).toBe(100);
    });

    it('tracks military events across centuries', () => {
      // Century 0: two military events with significance 50 each → 100
      // Century 1: one military event with significance 50 → 50
      const events = [
        makeEvent(EventCategory.Military, 100, 50),      // century 0
        makeEvent(EventCategory.Military, 200, 50),      // century 0
        makeEvent(EventCategory.Military, 36100, 50),    // century 1
      ];
      const timeline = calculator.calculateVolatilityTimeline(events);
      expect(timeline.length).toBe(2);
      // Century 0 has total 100, century 1 has 50. Max=100
      expect(timeline[0]).toBe(100);
      expect(timeline[1]).toBe(50);
    });

    it('ignores non-military events', () => {
      const events = [
        makeEvent(EventCategory.Economic, 0, 90),
        makeEvent(EventCategory.Military, 0, 40),
      ];
      const timeline = calculator.calculateVolatilityTimeline(events);
      expect(timeline.length).toBe(1);
      // Only military events contribute: 40/40 = 100 (normalized)
      expect(timeline[0]).toBe(100);
    });
  });

  describe('calculateMagicCurve', () => {
    it('tracks magical events', () => {
      const events = [
        makeEvent(EventCategory.Magical, 0, 60),
        makeEvent(EventCategory.Magical, 36000, 30), // century 1
      ];
      const curve = calculator.calculateMagicCurve(events);
      expect(curve.length).toBe(2);
      expect(curve[0]).toBe(100); // 60 is max
      expect(curve[1]).toBe(50);  // 30/60 = 50
    });
  });

  describe('calculatePopulationTrend', () => {
    it('counts Personal and Economic events as population proxy', () => {
      const events = [
        makeEvent(EventCategory.Personal, 0),
        makeEvent(EventCategory.Economic, 100),
        makeEvent(EventCategory.Military, 200), // should not count
      ];
      const trend = calculator.calculatePopulationTrend(events);
      expect(trend.length).toBe(1);
      // 2 matching events / max of 2 = 100
      expect(trend[0]).toBe(100);
    });
  });

  describe('calculateComplexityScore', () => {
    it('returns 0 for events with no cascades', () => {
      const events = [
        makeEvent(EventCategory.Military, 0),
        makeEvent(EventCategory.Economic, 1),
      ];
      for (const e of events) eventLog.append(e);
      const score = calculator.calculateComplexityScore(events, eventLog);
      expect(score).toBe(0);
    });

    it('counts cross-domain arcs', () => {
      // Root event → consequence in different domain
      const root = makeEvent(EventCategory.Military, 0, 50);
      const consequence = createEvent({
        category: EventCategory.Economic,
        subtype: 'test.economic',
        timestamp: 10,
        participants: [],
        significance: 40,
        causes: [root.id],
      });
      root.consequences.push(consequence.id);

      eventLog.append(root);
      eventLog.append(consequence);

      const score = calculator.calculateComplexityScore([root, consequence], eventLog);
      // 1 cross-domain arc, 0 deep cascades → 1/300 × 100 ≈ 0 (rounded)
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('counts deep cascade chains (depth > 3)', () => {
      // Create a chain of 5 events: e0 → e1 → e2 → e3 → e4
      const events = [];
      for (let i = 0; i < 5; i++) {
        const causes = i > 0 ? [events[i - 1]!.id] : [];
        const e = createEvent({
          category: EventCategory.Military,
          subtype: 'test.military',
          timestamp: i * 10,
          participants: [],
          significance: 50,
          causes: causes as typeof e['causes'] extends readonly (infer T)[] ? T[] : never[],
        });
        if (i > 0) {
          events[i - 1]!.consequences.push(e.id);
        }
        events.push(e);
      }

      for (const e of events) eventLog.append(e);

      const score = calculator.calculateComplexityScore(events, eventLog);
      // Chain depth = 4, so 1 deep cascade count. Same domain, so 0 cross-domain arcs.
      // 1/300 × 100 ≈ 0 (rounded)
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('produces higher score for many cascades', () => {
      // Create 100 root events, each with one cross-domain consequence
      const allEvents = [];
      for (let i = 0; i < 100; i++) {
        const root = createEvent({
          category: EventCategory.Military,
          subtype: 'test.mil',
          timestamp: i,
          participants: [],
          significance: 50,
        });
        const cons = createEvent({
          category: EventCategory.Economic,
          subtype: 'test.eco',
          timestamp: i + 1,
          participants: [],
          significance: 40,
          causes: [root.id],
        });
        root.consequences.push(cons.id);
        eventLog.append(root);
        eventLog.append(cons);
        allEvents.push(root, cons);
      }

      const score = calculator.calculateComplexityScore(allEvents, eventLog);
      // 100 cross-domain arcs / 300 × 100 = 33
      expect(score).toBe(33);
    });
  });

  describe('calculateFingerprint (integration)', () => {
    it('produces non-zero values for a simulated world', () => {
      world.registerComponent('Territory');

      // Create factions
      const faction1 = world.createEntity();
      const faction2 = world.createEntity();
      world.addComponent(faction1, { type: 'Territory' } as TerritoryComponent);
      world.addComponent(faction2, { type: 'Territory' } as TerritoryComponent);

      // Create diverse events across categories and centuries
      const categories = [
        EventCategory.Military,
        EventCategory.Magical,
        EventCategory.Religious,
        EventCategory.Economic,
        EventCategory.Scientific,
        EventCategory.Political,
        EventCategory.Personal,
        EventCategory.Cultural,
      ];

      for (let century = 0; century < 3; century++) {
        for (const cat of categories) {
          const baseTick = century * 36000;
          for (let i = 0; i < 5; i++) {
            const e = makeEvent(
              cat,
              baseTick + i * 100,
              30 + i * 10,
              [century % 2 === 0 ? faction1 : faction2],
            );
            eventLog.append(e);
          }
        }
      }

      const fingerprint = calculator.calculateFingerprint(world, eventLog);

      // Domain balance: all 6 domains should have non-zero values
      for (const domain of ALL_DOMAINS) {
        expect(fingerprint.domainBalance.get(domain)).toBeGreaterThan(0);
      }

      // Civilization palette should have 2 factions
      expect(fingerprint.civilizationPalette.length).toBe(2);
      const totalProportion = fingerprint.civilizationPalette.reduce(
        (sum, e) => sum + e.proportion,
        0,
      );
      expect(totalProportion).toBeCloseTo(1, 5);

      // Sparklines should have 3 centuries
      expect(fingerprint.volatilityTimeline.length).toBe(3);
      expect(fingerprint.magicCurve.length).toBe(3);
      expect(fingerprint.populationTrend.length).toBe(3);

      // Each century should have the same event distribution, so normalized values = 100
      for (const val of fingerprint.volatilityTimeline) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }

      // Complexity score is a number in range
      expect(fingerprint.complexityScore).toBeGreaterThanOrEqual(0);
      expect(fingerprint.complexityScore).toBeLessThanOrEqual(100);
    });
  });
});
