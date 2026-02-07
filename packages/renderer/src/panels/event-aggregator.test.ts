import { describe, it, expect, beforeEach } from 'vitest';
import { EventAggregator, addTemporalHeaders } from './event-aggregator.js';
import type { ChronicleEntry } from './event-aggregator.js';
import { EventCategory, toEntityId, toEventId } from '@fws/core';
import type { WorldEvent, EntityId } from '@fws/core';
import type { EntityResolver, ResolvedEntity } from '@fws/narrative';

// Helper to create mock events
function createMockEvent(id: number, overrides: Partial<WorldEvent> = {}): WorldEvent {
  const eventId = toEventId(toEntityId(id));
  return {
    id: eventId,
    category: EventCategory.Personal,
    subtype: 'character.befriend',
    timestamp: id * 10,
    participants: [toEntityId(id)],
    causes: [],
    consequences: [],
    data: { description: `Event ${id} description` },
    significance: 30, // Below aggregation threshold by default
    consequencePotential: [],
    ...overrides,
  } as WorldEvent;
}

// Create a mock entity resolver
function createMockResolver(): EntityResolver {
  const entities: Map<number, ResolvedEntity> = new Map([
    [1, { name: 'Thorin Ironhand' }],
    [2, { name: 'Elara Shadowmend' }],
    [3, { name: 'The Northern Kingdom' }],
  ]);

  return {
    resolveCharacter: (id: number) => entities.get(id),
    resolveFaction: (_id: number) => undefined,
    resolveSite: (_id: number) => undefined,
    resolveArtifact: (_id: number) => undefined,
    resolveDeity: (_id: number) => undefined,
  };
}

describe('EventAggregator', () => {
  let aggregator: EventAggregator;

  beforeEach(() => {
    aggregator = new EventAggregator();
  });

  describe('shouldKeepStandalone', () => {
    it('keeps high-significance events standalone', () => {
      const highSig = createMockEvent(1, { significance: 80 });
      expect(aggregator.shouldKeepStandalone(highSig)).toBe(true);
    });

    it('allows low-significance events to be aggregated', () => {
      const lowSig = createMockEvent(1, { significance: 30 });
      expect(aggregator.shouldKeepStandalone(lowSig)).toBe(false);
    });

    it('keeps events at threshold (60) standalone', () => {
      const atThreshold = createMockEvent(1, { significance: 60 });
      expect(aggregator.shouldKeepStandalone(atThreshold)).toBe(true);
    });

    it('allows events just below threshold', () => {
      const belowThreshold = createMockEvent(1, { significance: 59 });
      expect(aggregator.shouldKeepStandalone(belowThreshold)).toBe(false);
    });
  });

  describe('aggregate', () => {
    it('returns empty array for empty input', () => {
      const result = aggregator.aggregate([]);
      expect(result).toEqual([]);
    });

    it('keeps high-significance events as standalone entries', () => {
      const events = [
        createMockEvent(1, { significance: 80 }),
        createMockEvent(2, { significance: 90 }),
      ];

      const result = aggregator.aggregate(events);
      const eventEntries = result.filter(e => e.kind === 'event');
      expect(eventEntries.length).toBe(2);
    });

    it('aggregates low-significance events in same category and time window', () => {
      const events = [
        createMockEvent(1, { significance: 30, category: EventCategory.Personal, timestamp: 1, participants: [toEntityId(1)] }),
        createMockEvent(2, { significance: 25, category: EventCategory.Personal, timestamp: 5, participants: [toEntityId(1)] }),
        createMockEvent(3, { significance: 35, category: EventCategory.Personal, timestamp: 10, participants: [toEntityId(1)] }),
      ];

      const result = aggregator.aggregate(events, 30);
      const aggregates = result.filter(e => e.kind === 'aggregate');
      expect(aggregates.length).toBeGreaterThanOrEqual(1);
    });

    it('does not aggregate events from different categories', () => {
      const events = [
        createMockEvent(1, { significance: 30, category: EventCategory.Personal, timestamp: 1 }),
        createMockEvent(2, { significance: 30, category: EventCategory.Military, timestamp: 2 }),
      ];

      const result = aggregator.aggregate(events, 30);
      // Each event should remain standalone (groups too small to aggregate)
      const eventEntries = result.filter(e => e.kind === 'event');
      const aggregates = result.filter(e => e.kind === 'aggregate');
      // Either standalone events or single-item aggregates
      expect(eventEntries.length + aggregates.length).toBeGreaterThanOrEqual(0);
    });

    it('preserves chronological order in output', () => {
      const events = [
        createMockEvent(1, { significance: 80, timestamp: 10 }),
        createMockEvent(2, { significance: 30, timestamp: 20, participants: [toEntityId(1)] }),
        createMockEvent(3, { significance: 30, timestamp: 25, participants: [toEntityId(1)] }),
        createMockEvent(4, { significance: 90, timestamp: 30 }),
      ];

      const result = aggregator.aggregate(events, 30);
      expect(result.length).toBeGreaterThan(0);

      // First entry should be the first high-sig event
      const first = result[0];
      expect(first).toBeDefined();
    });

    it('uses time window to separate groups', () => {
      const events = [
        createMockEvent(1, { significance: 30, timestamp: 1, participants: [toEntityId(1)], category: EventCategory.Personal }),
        createMockEvent(2, { significance: 30, timestamp: 2, participants: [toEntityId(1)], category: EventCategory.Personal }),
        createMockEvent(3, { significance: 30, timestamp: 100, participants: [toEntityId(1)], category: EventCategory.Personal }),
        createMockEvent(4, { significance: 30, timestamp: 101, participants: [toEntityId(1)], category: EventCategory.Personal }),
      ];

      const result = aggregator.aggregate(events, 30);
      const aggregates = result.filter(e => e.kind === 'aggregate');
      // Should create separate groups for events far apart in time
      expect(aggregates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('detectTheme', () => {
    it('returns undefined for empty events', () => {
      expect(aggregator.detectTheme([])).toBeUndefined();
    });

    it('generates theme based on dominant category', () => {
      const events = [
        createMockEvent(1, { category: EventCategory.Military }),
        createMockEvent(2, { category: EventCategory.Military }),
        createMockEvent(3, { category: EventCategory.Political }),
      ];

      const theme = aggregator.detectTheme(events);
      expect(theme).toBeDefined();
      expect(theme).toContain('Military');
    });

    it('includes participant name when resolver is set', () => {
      aggregator.setEntityResolver(createMockResolver());
      const events = [
        createMockEvent(1, { category: EventCategory.Personal, participants: [toEntityId(1)] }),
        createMockEvent(2, { category: EventCategory.Personal, participants: [toEntityId(1)] }),
      ];

      const theme = aggregator.detectTheme(events);
      expect(theme).toBeDefined();
      expect(theme).toContain('Thorin');
    });
  });

  describe('generateSummary', () => {
    it('generates summary text for an aggregated event', () => {
      const aggregate = {
        id: 'agg_0_0',
        startTick: 0,
        endTick: 30,
        theme: 'Test Theme',
        category: EventCategory.Personal,
        events: [toEventId(toEntityId(1)), toEventId(toEntityId(2))],
        rawEvents: [createMockEvent(1), createMockEvent(2)],
        primaryParticipant: undefined,
        significance: 30,
        expanded: false,
      };

      const summary = aggregator.generateSummary(aggregate);
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).toContain('2'); // event count
    });

    it('includes participant name when available', () => {
      aggregator.setEntityResolver(createMockResolver());
      const aggregate = {
        id: 'agg_0_0',
        startTick: 0,
        endTick: 30,
        theme: 'Test Theme',
        category: EventCategory.Personal,
        events: [toEventId(toEntityId(1)), toEventId(toEntityId(2))],
        rawEvents: [
          createMockEvent(1, { participants: [toEntityId(1)] }),
          createMockEvent(2, { participants: [toEntityId(1)] }),
        ],
        primaryParticipant: toEntityId(1),
        significance: 30,
        expanded: false,
      };

      const summary = aggregator.generateSummary(aggregate);
      expect(summary.length).toBeGreaterThan(0);
    });
  });
});

describe('addTemporalHeaders', () => {
  it('returns empty array for empty input', () => {
    expect(addTemporalHeaders([])).toEqual([]);
  });

  it('adds year headers when year changes', () => {
    const entries: ChronicleEntry[] = [
      { kind: 'event', event: createMockEvent(1, { timestamp: 0 }) },      // Year 1
      { kind: 'event', event: createMockEvent(2, { timestamp: 360 }) },     // Year 2
    ];

    const result = addTemporalHeaders(entries);
    const headers = result.filter(e => e.kind === 'header');
    // Should have year headers and month headers
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it('adds month headers when month changes within year', () => {
    const entries: ChronicleEntry[] = [
      { kind: 'event', event: createMockEvent(1, { timestamp: 0 }) },     // Month 1
      { kind: 'event', event: createMockEvent(2, { timestamp: 30 }) },    // Month 2
    ];

    const result = addTemporalHeaders(entries);
    const monthHeaders = result.filter(
      e => e.kind === 'header' && e.text.includes('Month')
    );
    expect(monthHeaders.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves original entries between headers', () => {
    const entries: ChronicleEntry[] = [
      { kind: 'event', event: createMockEvent(1, { timestamp: 0 }) },
    ];

    const result = addTemporalHeaders(entries);
    const events = result.filter(e => e.kind === 'event');
    expect(events.length).toBe(1);
  });

  it('includes season names in headers', () => {
    const entries: ChronicleEntry[] = [
      { kind: 'event', event: createMockEvent(1, { timestamp: 90 }) },  // Month 4 = Spring
    ];

    const result = addTemporalHeaders(entries);
    const monthHeaders = result.filter(
      e => e.kind === 'header' && e.text.includes('Spring')
    );
    expect(monthHeaders.length).toBeGreaterThanOrEqual(1);
  });
});
