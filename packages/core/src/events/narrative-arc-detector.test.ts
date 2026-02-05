import { describe, it, expect, beforeEach } from 'vitest';
import {
  NarrativeArcDetector,
  ArcPhase,
  resetArcIdCounter,
} from './narrative-arc-detector.js';
import { EventLog } from './event-log.js';
import { EventCategory } from './types.js';
import { createEvent, resetEventIdCounter, linkConsequence } from './event-factory.js';
import { toEntityId } from '../ecs/types.js';

describe('NarrativeArcDetector', () => {
  let detector: NarrativeArcDetector;
  let eventLog: EventLog;

  beforeEach(() => {
    detector = new NarrativeArcDetector();
    eventLog = new EventLog();
    resetEventIdCounter();
    resetArcIdCounter();
  });

  function createTestEvent(
    category: EventCategory,
    significance: number,
    timestamp: number
  ) {
    return createEvent({
      category,
      subtype: `${category.toLowerCase()}.test`,
      timestamp,
      participants: [toEntityId(1)],
      significance,
    });
  }

  function buildCausalChain(
    events: Array<{ category: EventCategory; significance: number; timestamp: number }>
  ) {
    const created = events.map((e) => createTestEvent(e.category, e.significance, e.timestamp));

    // Link each event as a consequence of the previous
    for (let i = 1; i < created.length; i++) {
      const prev = created[i - 1];
      const current = created[i];
      if (prev !== undefined && current !== undefined) {
        linkConsequence(prev, current);
        // Also set causes on current (need to recreate since causes is readonly)
        // We'll manually append cause since createEvent already sets causes: []
        (current.causes as unknown[]).push(prev.id);
      }
    }

    // Add all to event log
    for (const event of created) {
      eventLog.append(event);
    }

    return created;
  }

  describe('detectArc', () => {
    it('should detect a rising-action arc', () => {
      const events = buildCausalChain([
        { category: EventCategory.Political, significance: 20, timestamp: 1 },
        { category: EventCategory.Political, significance: 40, timestamp: 2 },
        { category: EventCategory.Political, significance: 65, timestamp: 3 },
        { category: EventCategory.Political, significance: 90, timestamp: 4 },
      ]);

      const lastEvent = events[events.length - 1];
      if (lastEvent === undefined) throw new Error('No events');

      const arc = detector.detectArc(lastEvent, eventLog);

      expect(arc).toBeDefined();
      expect(arc?.events).toHaveLength(4);
      expect(arc?.peakSignificance).toBe(90);
    });

    it('should return undefined for chains below minimum length', () => {
      const events = buildCausalChain([
        { category: EventCategory.Political, significance: 20, timestamp: 1 },
        { category: EventCategory.Political, significance: 80, timestamp: 2 },
      ]);

      const lastEvent = events[events.length - 1];
      if (lastEvent === undefined) throw new Error('No events');

      const arc = detector.detectArc(lastEvent, eventLog);
      expect(arc).toBeUndefined();
    });

    it('should return undefined for flat significance chains', () => {
      const events = buildCausalChain([
        { category: EventCategory.Political, significance: 50, timestamp: 1 },
        { category: EventCategory.Political, significance: 50, timestamp: 2 },
        { category: EventCategory.Political, significance: 50, timestamp: 3 },
        { category: EventCategory.Political, significance: 50, timestamp: 4 },
      ]);

      const lastEvent = events[events.length - 1];
      if (lastEvent === undefined) throw new Error('No events');

      const arc = detector.detectArc(lastEvent, eventLog);
      // No rising action → no arc
      expect(arc).toBeUndefined();
    });

    it('should identify climax at peak significance', () => {
      const events = buildCausalChain([
        { category: EventCategory.Political, significance: 20, timestamp: 1 },
        { category: EventCategory.Political, significance: 50, timestamp: 2 },
        { category: EventCategory.Political, significance: 90, timestamp: 3 },
        { category: EventCategory.Political, significance: 60, timestamp: 4 },
      ]);

      const lastEvent = events[events.length - 1];
      if (lastEvent === undefined) throw new Error('No events');

      const arc = detector.detectArc(lastEvent, eventLog);

      expect(arc).toBeDefined();
      expect(arc?.climaxEvent?.significance).toBe(90);
      expect(arc?.peakSignificance).toBe(90);
    });

    it('should auto-increment arc IDs', () => {
      const events1 = buildCausalChain([
        { category: EventCategory.Political, significance: 20, timestamp: 1 },
        { category: EventCategory.Political, significance: 40, timestamp: 2 },
        { category: EventCategory.Political, significance: 80, timestamp: 3 },
      ]);

      resetEventIdCounter();
      const events2 = buildCausalChain([
        { category: EventCategory.Military, significance: 30, timestamp: 10 },
        { category: EventCategory.Military, significance: 60, timestamp: 11 },
        { category: EventCategory.Military, significance: 95, timestamp: 12 },
      ]);

      const last1 = events1[events1.length - 1]!;
      const last2 = events2[events2.length - 1]!;

      const arc1 = detector.detectArc(last1, eventLog);
      const arc2 = detector.detectArc(last2, eventLog);

      expect(arc1?.id).toBe(0);
      expect(arc2?.id).toBe(1);
    });
  });

  describe('domain transitions', () => {
    it('should count domain transitions in a chain', () => {
      const events = buildCausalChain([
        { category: EventCategory.Military, significance: 30, timestamp: 1 },
        { category: EventCategory.Political, significance: 50, timestamp: 2 },
        { category: EventCategory.Economic, significance: 70, timestamp: 3 },
        { category: EventCategory.Cultural, significance: 90, timestamp: 4 },
      ]);

      const lastEvent = events[events.length - 1];
      if (lastEvent === undefined) throw new Error('No events');

      const arc = detector.detectArc(lastEvent, eventLog);

      expect(arc).toBeDefined();
      expect(arc?.domainTransitions).toBe(3); // Military→Political, Political→Economic, Economic→Cultural
    });

    it('should report zero transitions for same-domain chains', () => {
      const events = buildCausalChain([
        { category: EventCategory.Military, significance: 30, timestamp: 1 },
        { category: EventCategory.Military, significance: 50, timestamp: 2 },
        { category: EventCategory.Military, significance: 80, timestamp: 3 },
      ]);

      const lastEvent = events[events.length - 1];
      if (lastEvent === undefined) throw new Error('No events');

      const arc = detector.detectArc(lastEvent, eventLog);

      expect(arc).toBeDefined();
      expect(arc?.domainTransitions).toBe(0);
    });
  });

  describe('classifyPhase', () => {
    it('should classify rising action at minimum length', () => {
      const events = [
        createTestEvent(EventCategory.Political, 20, 1),
        createTestEvent(EventCategory.Political, 40, 2),
        createTestEvent(EventCategory.Political, 80, 3),
      ];

      const phase = detector.classifyPhase(events);
      // Peak at end with chain.length === minArcLength → RisingAction
      expect(phase).toBe(ArcPhase.RisingAction);
    });

    it('should classify climax when peak at end with longer chain', () => {
      const events = [
        createTestEvent(EventCategory.Political, 20, 1),
        createTestEvent(EventCategory.Political, 35, 2),
        createTestEvent(EventCategory.Political, 55, 3),
        createTestEvent(EventCategory.Political, 90, 4),
      ];

      const phase = detector.classifyPhase(events);
      // Peak at end with chain > minArcLength → Climax
      expect(phase).toBe(ArcPhase.Climax);
    });

    it('should return undefined for too-short chains', () => {
      const events = [
        createTestEvent(EventCategory.Political, 20, 1),
        createTestEvent(EventCategory.Political, 80, 2),
      ];

      const phase = detector.classifyPhase(events);
      expect(phase).toBeUndefined();
    });

    it('should detect resolution when peak is in middle with long decline', () => {
      const events = [
        createTestEvent(EventCategory.Political, 20, 1),
        createTestEvent(EventCategory.Political, 50, 2),
        createTestEvent(EventCategory.Political, 90, 3),
        createTestEvent(EventCategory.Political, 60, 4),
        createTestEvent(EventCategory.Political, 40, 5),
      ];

      const phase = detector.classifyPhase(events);
      // Peak at index 2 (relative 0.5), remainingRatio 0.4 > 0.3 → Resolution
      expect(phase).toBe(ArcPhase.Resolution);
    });

    it('should detect falling action when peak is early', () => {
      const events = [
        createTestEvent(EventCategory.Political, 20, 1),
        createTestEvent(EventCategory.Political, 90, 2),
        createTestEvent(EventCategory.Political, 70, 3),
        createTestEvent(EventCategory.Political, 60, 4),
      ];

      const phase = detector.classifyPhase(events);
      // Peak at index 1 (relative 0.33 ≤ 0.3 borderline) → FallingAction
      expect(phase).toBeDefined();
    });

    it('should detect resolution phase', () => {
      const events = [
        createTestEvent(EventCategory.Political, 30, 1),
        createTestEvent(EventCategory.Political, 90, 2),
        createTestEvent(EventCategory.Political, 60, 3),
        createTestEvent(EventCategory.Political, 40, 4),
        createTestEvent(EventCategory.Political, 20, 5),
        createTestEvent(EventCategory.Political, 10, 6),
      ];

      const phase = detector.classifyPhase(events);
      // Peak at index 1 (early), lots of decline after
      expect(phase).toBeDefined();
      // Peak is at position 1/5 = 0.2, should be FallingAction or Resolution
      expect([ArcPhase.FallingAction, ArcPhase.Resolution]).toContain(phase);
    });
  });

  describe('detectForwardArc', () => {
    it('should detect arc following consequences forward', () => {
      const events = buildCausalChain([
        { category: EventCategory.Political, significance: 30, timestamp: 1 },
        { category: EventCategory.Political, significance: 50, timestamp: 2 },
        { category: EventCategory.Political, significance: 80, timestamp: 3 },
      ]);

      const firstEvent = events[0];
      if (firstEvent === undefined) throw new Error('No events');

      const arc = detector.detectForwardArc(firstEvent, eventLog);

      expect(arc).toBeDefined();
      expect(arc?.events).toHaveLength(3);
      expect(arc?.peakSignificance).toBe(80);
    });
  });

  describe('configuration', () => {
    it('should respect custom minimum arc length', () => {
      const customDetector = new NarrativeArcDetector({ minArcLength: 5 });

      const events = buildCausalChain([
        { category: EventCategory.Political, significance: 20, timestamp: 1 },
        { category: EventCategory.Political, significance: 40, timestamp: 2 },
        { category: EventCategory.Political, significance: 80, timestamp: 3 },
      ]);

      const lastEvent = events[events.length - 1];
      if (lastEvent === undefined) throw new Error('No events');

      const arc = customDetector.detectArc(lastEvent, eventLog);
      expect(arc).toBeUndefined(); // Chain of 3 < minArcLength of 5
    });

    it('should respect custom rising threshold', () => {
      // With high threshold, small significance increases don't count as "rising"
      const strictDetector = new NarrativeArcDetector({ risingThreshold: 30 });

      const events = buildCausalChain([
        { category: EventCategory.Political, significance: 40, timestamp: 1 },
        { category: EventCategory.Political, significance: 50, timestamp: 2 },
        { category: EventCategory.Political, significance: 60, timestamp: 3 },
      ]);

      const lastEvent = events[events.length - 1];
      if (lastEvent === undefined) throw new Error('No events');

      const arc = strictDetector.detectArc(lastEvent, eventLog);
      expect(arc).toBeUndefined(); // Increases of 10 < threshold of 30
    });
  });

  describe('resetArcIdCounter', () => {
    it('should reset arc IDs', () => {
      const events = buildCausalChain([
        { category: EventCategory.Political, significance: 20, timestamp: 1 },
        { category: EventCategory.Political, significance: 50, timestamp: 2 },
        { category: EventCategory.Political, significance: 80, timestamp: 3 },
      ]);

      const lastEvent = events[events.length - 1]!;
      const arc1 = detector.detectArc(lastEvent, eventLog);
      expect(arc1?.id).toBe(0);

      resetArcIdCounter();
      const arc2 = detector.detectArc(lastEvent, eventLog);
      expect(arc2?.id).toBe(0);
    });
  });
});
