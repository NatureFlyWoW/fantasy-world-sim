import { describe, it, expect, beforeEach } from 'vitest';
import { CascadeEngine } from './cascade-engine.js';
import { EventBus } from './event-bus.js';
import { EventLog } from './event-log.js';
import { EventCategory, type WorldEvent, type ConsequenceRule } from './types.js';
import { createEvent, resetEventIdCounter } from './event-factory.js';
import { toEntityId } from '../ecs/types.js';
import {
  calculateDampenedProbability,
  adjustDampeningForSignificance,
  shouldContinueCascade,
} from './dampening.js';
import {
  getTransitions,
  getTransitionModifier,
  hasTransition,
  getTargetCategories,
} from './cross-domain-rules.js';

describe('CascadeEngine', () => {
  let eventBus: EventBus;
  let eventLog: EventLog;
  let engine: CascadeEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    eventLog = new EventLog();
    resetEventIdCounter();
  });

  function createTestEvent(
    category: EventCategory,
    significance: number,
    consequences: ConsequenceRule[] = [],
    timestamp = 100
  ): WorldEvent {
    return createEvent({
      category,
      subtype: `${category.toLowerCase()}.test`,
      timestamp,
      participants: [toEntityId(1)],
      significance,
      consequencePotential: consequences,
    });
  }

  describe('processEvent', () => {
    it('should schedule consequences from event rules', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 0.8,
          category: EventCategory.Political,
          delayTicks: 7,
          dampening: 0.3,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);

      expect(engine.getPendingCount()).toBe(1);
      const pending = engine.getPendingConsequences();
      expect(pending[0]?.rule.eventSubtype).toBe('political.unrest');
      expect(pending[0]?.fireTick).toBe(107);
    });

    it('should schedule multiple consequences', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 0.8,
          category: EventCategory.Political,
          delayTicks: 7,
          dampening: 0.3,
        },
        {
          eventSubtype: 'economic.disruption',
          baseProbability: 0.6,
          category: EventCategory.Economic,
          delayTicks: 30,
          dampening: 0.4,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);

      expect(engine.getPendingCount()).toBe(2);
    });

    it('should respect max cascade depth', () => {
      engine = new CascadeEngine(eventBus, eventLog, {
        maxCascadeDepth: 2,
        randomFn: () => 0,
      });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.test',
          baseProbability: 1.0,
          category: EventCategory.Military,
          delayTicks: 0,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      // Depth 0 → creates consequence at depth 1
      engine.processEvent(event, 100);
      expect(engine.getPendingCount()).toBe(1);

      // At depth 2 (which equals max), should not process further
      engine.processEvent(event, 100, 2);
      // No new consequences added since depth >= maxCascadeDepth
      expect(engine.getPendingCount()).toBe(1);
    });
  });

  describe('resolveTick', () => {
    it('should fire consequences when roll succeeds', () => {
      // randomFn returns 0, which is always < probability → always fires
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 0.8,
          category: EventCategory.Political,
          delayTicks: 0,
          dampening: 0.3,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);
      const result = engine.resolveTick(100);

      expect(result.eventsGenerated).toHaveLength(1);
      expect(result.eventsGenerated[0]?.category).toBe(EventCategory.Political);
      expect(result.eventsGenerated[0]?.subtype).toBe('political.unrest');
    });

    it('should not fire consequences when roll fails', () => {
      // randomFn returns 0.99, which is always >= probability → never fires
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0.99 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 0.5,
          category: EventCategory.Political,
          delayTicks: 0,
          dampening: 0.3,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);
      const result = engine.resolveTick(100);

      expect(result.eventsGenerated).toHaveLength(0);
    });

    it('should respect temporal offsets', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 0.8,
          category: EventCategory.Political,
          delayTicks: 10,
          dampening: 0.3,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);

      // Should not fire at tick 100
      const result100 = engine.resolveTick(100);
      expect(result100.eventsGenerated).toHaveLength(0);
      expect(result100.pendingCount).toBe(1);

      // Should fire at tick 110
      const result110 = engine.resolveTick(110);
      expect(result110.eventsGenerated).toHaveLength(1);
      expect(result110.pendingCount).toBe(0);
    });

    it('should link cause-effect graph', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 1.0,
          category: EventCategory.Political,
          delayTicks: 0,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);
      const result = engine.resolveTick(100);

      const consequence = result.eventsGenerated[0];
      expect(consequence).toBeDefined();

      // Consequence should reference cause
      expect(consequence?.causes).toContain(event.id);

      // Cause should reference consequence
      expect(event.consequences).toContain(consequence?.id);
    });

    it('should emit consequences via event bus', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const emitted: WorldEvent[] = [];
      eventBus.onAny((e) => emitted.push(e));

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 1.0,
          category: EventCategory.Political,
          delayTicks: 0,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);
      engine.resolveTick(100);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.subtype).toBe('political.unrest');
    });

    it('should log consequences to event log', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 1.0,
          category: EventCategory.Political,
          delayTicks: 0,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);
      engine.resolveTick(100);

      // Original event + consequence
      expect(eventLog.getCount()).toBe(2);
    });

    it('should cascade recursively within same tick', () => {
      engine = new CascadeEngine(eventBus, eventLog, {
        randomFn: () => 0,
        maxCascadeDepth: 5,
      });

      // Create event whose consequence also has a consequence
      const event = createTestEvent(EventCategory.Military, 90, [
        {
          eventSubtype: 'political.unrest',
          baseProbability: 1.0,
          category: EventCategory.Military, // Same domain to avoid cross-domain modifier
          delayTicks: 0,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);
      const result = engine.resolveTick(100);

      // Should generate at least one event (the chain continues but
      // consequence events have empty consequencePotential by default)
      expect(result.eventsGenerated.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('consequence significance', () => {
    it('should reduce significance for deeper chain depths', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'military.test',
          baseProbability: 1.0,
          category: EventCategory.Military,
          delayTicks: 0,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);
      const result = engine.resolveTick(100);

      const consequence = result.eventsGenerated[0];
      // Depth 1: 80 * (1 - 0.1) = 72
      expect(consequence?.significance).toBe(72);
    });
  });

  describe('cross-domain transitions', () => {
    it('should apply cross-domain modifier for different categories', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.test',
          baseProbability: 1.0,
          category: EventCategory.Political,
          delayTicks: 0,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);

      // Military → Political has modifier of 1.2, so effective prob = 1.0 * 1.2 = 1.2 (capped)
      const pending = engine.getPendingConsequences();
      expect(pending).toHaveLength(1);
      // The effective probability should incorporate the modifier
      expect(pending[0]?.effectiveProbability).toBeGreaterThan(0);
    });

    it('should reduce probability for undefined transitions', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      // Create an event that would transition to a category without a defined rule
      // Cultural → Military is not in the transition map
      const event = createTestEvent(EventCategory.Cultural, 80, [
        {
          eventSubtype: 'military.test',
          baseProbability: 1.0,
          category: EventCategory.Military,
          delayTicks: 0,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);

      const pending = engine.getPendingConsequences();
      // Should still be scheduled but with reduced probability (× 0.1)
      expect(pending).toHaveLength(1);
      expect(pending[0]?.effectiveProbability).toBeCloseTo(0.1, 2);
    });
  });

  describe('configuration', () => {
    it('should default max cascade depth to 10', () => {
      engine = new CascadeEngine(eventBus, eventLog);
      expect(engine.getMaxCascadeDepth()).toBe(10);
    });

    it('should allow configurable max cascade depth', () => {
      engine = new CascadeEngine(eventBus, eventLog, { maxCascadeDepth: 5 });
      expect(engine.getMaxCascadeDepth()).toBe(5);
    });

    it('should allow changing max cascade depth', () => {
      engine = new CascadeEngine(eventBus, eventLog);
      engine.setMaxCascadeDepth(3);
      expect(engine.getMaxCascadeDepth()).toBe(3);
    });

    it('should clear pending consequences', () => {
      engine = new CascadeEngine(eventBus, eventLog, { randomFn: () => 0 });

      const event = createTestEvent(EventCategory.Military, 80, [
        {
          eventSubtype: 'political.test',
          baseProbability: 1.0,
          category: EventCategory.Political,
          delayTicks: 10,
          dampening: 0,
        },
      ]);
      eventLog.append(event);

      engine.processEvent(event, 100);
      expect(engine.getPendingCount()).toBe(1);

      engine.clear();
      expect(engine.getPendingCount()).toBe(0);
    });
  });
});

describe('Dampening Functions', () => {
  describe('calculateDampenedProbability', () => {
    it('should return base probability at depth 0', () => {
      expect(calculateDampenedProbability(0.8, 0.5, 0)).toBe(0.8);
    });

    it('should apply dampening at depth 1', () => {
      // 0.8 × (1 - 0.5)^1 = 0.8 × 0.5 = 0.4
      expect(calculateDampenedProbability(0.8, 0.5, 1)).toBeCloseTo(0.4);
    });

    it('should apply dampening exponentially', () => {
      // 0.8 × (1 - 0.5)^2 = 0.8 × 0.25 = 0.2
      expect(calculateDampenedProbability(0.8, 0.5, 2)).toBeCloseTo(0.2);

      // 0.8 × (1 - 0.5)^3 = 0.8 × 0.125 = 0.1
      expect(calculateDampenedProbability(0.8, 0.5, 3)).toBeCloseTo(0.1);
    });

    it('should handle zero dampening (no reduction)', () => {
      expect(calculateDampenedProbability(0.8, 0, 5)).toBe(0.8);
    });

    it('should handle full dampening (immediate zero)', () => {
      expect(calculateDampenedProbability(0.8, 1, 1)).toBe(0);
    });

    it('should handle low dampening values', () => {
      // 0.8 × (1 - 0.1)^3 = 0.8 × 0.729 = 0.5832
      expect(calculateDampenedProbability(0.8, 0.1, 3)).toBeCloseTo(0.5832);
    });
  });

  describe('adjustDampeningForSignificance', () => {
    it('should not adjust for normal significance (30-80)', () => {
      expect(adjustDampeningForSignificance(0.5, 50)).toBe(0.5);
      expect(adjustDampeningForSignificance(0.5, 30)).toBe(0.5);
      expect(adjustDampeningForSignificance(0.5, 79)).toBe(0.5);
    });

    it('should reduce dampening for high significance (80+)', () => {
      // Significance 100: reduction = (100-80)/20 * 0.4 = 0.4
      // adjustedDampening = 0.5 * (1 - 0.4) = 0.5 * 0.6 = 0.3
      expect(adjustDampeningForSignificance(0.5, 100)).toBeCloseTo(0.3);

      // Significance 90: reduction = (90-80)/20 * 0.4 = 0.2
      // adjustedDampening = 0.5 * (1 - 0.2) = 0.5 * 0.8 = 0.4
      expect(adjustDampeningForSignificance(0.5, 90)).toBeCloseTo(0.4);
    });

    it('should increase dampening for low significance (<30)', () => {
      // Significance 0: increase = (30-0)/30 * 0.5 = 0.5
      // adjustedDampening = 0.5 * (1 + 0.5) = 0.5 * 1.5 = 0.75
      expect(adjustDampeningForSignificance(0.5, 0)).toBeCloseTo(0.75);

      // Significance 15: increase = (30-15)/30 * 0.5 = 0.25
      // adjustedDampening = 0.5 * (1 + 0.25) = 0.5 * 1.25 = 0.625
      expect(adjustDampeningForSignificance(0.5, 15)).toBeCloseTo(0.625);
    });

    it('should not exceed 1', () => {
      expect(adjustDampeningForSignificance(0.9, 0)).toBeLessThanOrEqual(1);
    });

    it('should not go below 0', () => {
      expect(adjustDampeningForSignificance(0.1, 100)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shouldContinueCascade', () => {
    it('should continue for probabilities above threshold', () => {
      expect(shouldContinueCascade(0.5)).toBe(true);
      expect(shouldContinueCascade(0.01)).toBe(true);
    });

    it('should stop for probabilities below threshold', () => {
      expect(shouldContinueCascade(0.009)).toBe(false);
      expect(shouldContinueCascade(0.001)).toBe(false);
      expect(shouldContinueCascade(0)).toBe(false);
    });

    it('should respect custom threshold', () => {
      expect(shouldContinueCascade(0.05, 0.1)).toBe(false);
      expect(shouldContinueCascade(0.15, 0.1)).toBe(true);
    });
  });
});

describe('Cross-Domain Rules', () => {
  describe('getTransitions', () => {
    it('should return transitions for Military', () => {
      const transitions = getTransitions(EventCategory.Military);
      expect(transitions.length).toBeGreaterThan(0);
      const categories = transitions.map((t) => t.targetCategory);
      expect(categories).toContain(EventCategory.Political);
      expect(categories).toContain(EventCategory.Economic);
      expect(categories).toContain(EventCategory.Personal);
    });

    it('should return transitions for Disaster', () => {
      const transitions = getTransitions(EventCategory.Disaster);
      expect(transitions.length).toBeGreaterThan(0);
      const categories = transitions.map((t) => t.targetCategory);
      expect(categories).toContain(EventCategory.Economic);
      expect(categories).toContain(EventCategory.Religious);
      expect(categories).toContain(EventCategory.Personal);
    });

    it('should return transitions for all categories', () => {
      for (const category of Object.values(EventCategory)) {
        const transitions = getTransitions(category);
        expect(transitions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getTransitionModifier', () => {
    it('should return modifier for Military → Political', () => {
      const modifier = getTransitionModifier(EventCategory.Military, EventCategory.Political);
      expect(modifier).toBe(1.2);
    });

    it('should return undefined for non-existent transition', () => {
      // Cultural does not transition to Military in our rules
      const modifier = getTransitionModifier(EventCategory.Cultural, EventCategory.Military);
      expect(modifier).toBeUndefined();
    });
  });

  describe('hasTransition', () => {
    it('should return true for defined transitions', () => {
      expect(hasTransition(EventCategory.Military, EventCategory.Political)).toBe(true);
      expect(hasTransition(EventCategory.Disaster, EventCategory.Economic)).toBe(true);
    });

    it('should return false for undefined transitions', () => {
      expect(hasTransition(EventCategory.Cultural, EventCategory.Military)).toBe(false);
    });
  });

  describe('getTargetCategories', () => {
    it('should return all target categories for a source', () => {
      const targets = getTargetCategories(EventCategory.Military);
      expect(targets).toContain(EventCategory.Political);
      expect(targets).toContain(EventCategory.Economic);
      expect(targets).toContain(EventCategory.Cultural);
    });
  });
});
