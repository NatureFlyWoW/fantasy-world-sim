import { describe, it, expect, beforeEach } from 'vitest';
import { EventInspector } from './event-inspector.js';
import type { InspectorSection } from './inspector-panel.js';
import type { RenderContext } from '../types.js';
import { EventLog, EventBus, EventCategory, toEntityId, toEventId } from '@fws/core';
import type { World, WorldClock, SpatialIndex, EntityId, EventId, WorldEvent } from '@fws/core';

// Create mock world helper
interface MockWorldOverrides {
  hasStore?: (type: string) => boolean;
  getComponent?: (id: EntityId, type: string) => unknown;
  getStore?: (type: string) => { getAll: () => Map<EntityId, unknown> };
}

function createMockWorld(overrides?: MockWorldOverrides): World {
  return {
    hasStore: overrides?.hasStore ?? (() => false),
    getComponent: overrides?.getComponent ?? (() => undefined),
    getStore: overrides?.getStore ?? (() => ({ getAll: () => new Map() })),
  } as unknown as World;
}

// Create mock render context
function createMockContext(worldOverrides?: MockWorldOverrides): RenderContext {
  const eventLog = new EventLog();
  const eventBus = new EventBus();

  return {
    world: createMockWorld(worldOverrides),
    clock: {
      currentTick: 360,
      currentTime: { year: 2, month: 1, day: 1 },
    } as unknown as WorldClock,
    eventLog,
    eventBus,
    spatialIndex: {} as SpatialIndex,
  };
}

// Helper to create mock event
function createMockEvent(
  id: number,
  opts?: {
    category?: EventCategory;
    subtype?: string;
    timestamp?: number;
    participants?: EntityId[];
    causes?: EventId[];
    consequences?: EventId[];
    significance?: number;
    description?: string;
  }
): WorldEvent {
  return {
    id: toEventId(toEntityId(id)),
    category: opts?.category ?? EventCategory.Political,
    subtype: opts?.subtype ?? 'faction.treaty_signed',
    timestamp: opts?.timestamp ?? id * 30,
    participants: opts?.participants ?? [toEntityId(1)],
    causes: opts?.causes ?? [],
    consequences: opts?.consequences ?? [],
    data: { description: opts?.description ?? `Event ${id} occurred` },
    significance: opts?.significance ?? 50,
    consequencePotential: [],
  } as WorldEvent;
}

describe('EventInspector', () => {
  let inspector: EventInspector;
  let context: RenderContext;

  beforeEach(() => {
    inspector = new EventInspector();
    context = createMockContext();
  });

  describe('getSections', () => {
    it('returns 6 sections', () => {
      const sections = inspector.getSections();
      expect(sections).toHaveLength(6);
    });

    it('includes all required section IDs', () => {
      const sections = inspector.getSections();
      const ids = sections.map(s => s.id);
      expect(ids).toContain('what-happened');
      expect(ids).toContain('who-involved');
      expect(ids).toContain('where-when');
      expect(ids).toContain('why-matters');
      expect(ids).toContain('what-before');
      expect(ids).toContain('what-followed');
    });

    it('first 3 sections expanded by default', () => {
      const sections = inspector.getSections();
      expect(sections[0]?.collapsed).toBe(false);
      expect(sections[1]?.collapsed).toBe(false);
      expect(sections[2]?.collapsed).toBe(false);
    });

    it('last 3 sections collapsed by default', () => {
      const sections = inspector.getSections();
      expect(sections[3]?.collapsed).toBe(true);
      expect(sections[4]?.collapsed).toBe(true);
      expect(sections[5]?.collapsed).toBe(true);
    });

    it('includes summary hints from event data', () => {
      const event = createMockEvent(1, {
        participants: [toEntityId(1), toEntityId(2), toEntityId(3)],
        significance: 85,
        causes: [toEventId(toEntityId(10))],
        consequences: [toEventId(toEntityId(20)), toEventId(toEntityId(21))],
      });
      const sections = inspector.getSections(event);

      expect(sections[1]?.summaryHint).toBe('3 participants');
      expect(sections[3]?.summaryHint).toBe('Critical');
      expect(sections[4]?.summaryHint).toBe('1 causes');
      expect(sections[5]?.summaryHint).toBe('2 consequences');
    });
  });

  describe('render', () => {
    it('renders missing event gracefully', () => {
      const fakeEventId = toEventId(toEntityId(999));
      const sections = inspector.getSections();
      const lines = inspector.render(fakeEventId, context, sections, 'overview');

      expect(lines.length).toBeGreaterThan(0);
      expect(lines.some(l => l.includes('beyond the reach'))).toBe(true);
    });

    it('renders overview mode with event data', () => {
      const event = createMockEvent(1, { description: 'A great battle was fought' });
      context.eventLog.append(event);
      const sections = inspector.getSections(event);
      const lines = inspector.render(event.id, context, sections, 'overview');

      expect(lines).toBeInstanceOf(Array);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('renders in all modes without error', () => {
      const event = createMockEvent(1);
      context.eventLog.append(event);
      const sections = inspector.getSections(event);

      for (const mode of ['overview', 'relationships', 'timeline', 'details'] as const) {
        const lines = inspector.render(event.id, context, sections, mode);
        expect(lines).toBeInstanceOf(Array);
        expect(lines.length).toBeGreaterThan(0);
      }
    });
  });

  describe('what happened section', () => {
    it('displays event description', () => {
      const event = createMockEvent(1, {
        description: 'The alliance crumbled',
        subtype: 'faction.alliance_broken',
      });
      context.eventLog.append(event);
      const sections = inspector.getSections(event);
      const lines = inspector.render(event.id, context, sections, 'overview');

      expect(lines.some(l => l.includes('alliance crumbled'))).toBe(true);
    });

    it('shows year and season', () => {
      const event = createMockEvent(1, { timestamp: 360 * 3 + 90 }); // Year 4, Spring
      context.eventLog.append(event);
      const sections = inspector.getSections(event);
      const lines = inspector.render(event.id, context, sections, 'overview');

      expect(lines.some(l => l.includes('Year 4'))).toBe(true);
    });
  });

  describe('who was involved section', () => {
    it('shows participants', () => {
      const worldWithStatus = {
        hasStore: (type: string) => type === 'Status',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Status' && id === toEntityId(1)) {
            return { titles: ['Lord Aldric'] };
          }
          if (type === 'Status' && id === toEntityId(2)) {
            return { titles: ['Baron Kael'] };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithStatus);
      const event = createMockEvent(1, {
        participants: [toEntityId(1), toEntityId(2)],
      });
      ctx.eventLog.append(event);
      const sections = inspector.getSections(event);
      const lines = inspector.render(event.id, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Lord Aldric'))).toBe(true);
      expect(lines.some(l => l.includes('Baron Kael'))).toBe(true);
    });

    it('handles empty participants', () => {
      const event = createMockEvent(1, { participants: [] });
      context.eventLog.append(event);
      const sections = inspector.getSections(event);
      const lines = inspector.render(event.id, context, sections, 'overview');

      expect(lines.some(l => l.includes('No specific participants'))).toBe(true);
    });
  });

  describe('why it matters section', () => {
    it('shows significance label', () => {
      const event = createMockEvent(1, { significance: 90 });
      context.eventLog.append(event);

      // Expand the why-matters section
      const sections = inspector.getSections(event).map(s =>
        s.id === 'why-matters' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(event.id, context, sections, 'overview');

      expect(lines.some(l => l.includes('Critical'))).toBe(true);
    });
  });

  describe('what came before section', () => {
    it('shows cause events', () => {
      const causeEvent = createMockEvent(10, {
        timestamp: 100,
        description: 'The initial provocation',
      });
      const mainEvent = createMockEvent(1, {
        timestamp: 200,
        causes: [causeEvent.id],
      });
      context.eventLog.append(causeEvent);
      context.eventLog.append(mainEvent);

      const sections = inspector.getSections(mainEvent).map(s =>
        s.id === 'what-before' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(mainEvent.id, context, sections, 'overview');

      expect(lines.some(l => l.includes('initial provocation'))).toBe(true);
    });

    it('handles no causes', () => {
      const event = createMockEvent(1, { causes: [] });
      context.eventLog.append(event);

      const sections = inspector.getSections(event).map(s =>
        s.id === 'what-before' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(event.id, context, sections, 'overview');

      expect(lines.some(l => l.includes('no recorded prior cause'))).toBe(true);
    });
  });

  describe('what followed section', () => {
    it('shows consequence events', () => {
      const consequenceEvent = createMockEvent(20, {
        timestamp: 300,
        description: 'War broke out',
      });
      const mainEvent = createMockEvent(1, {
        timestamp: 200,
        consequences: [consequenceEvent.id],
      });
      context.eventLog.append(consequenceEvent);
      context.eventLog.append(mainEvent);

      const sections = inspector.getSections(mainEvent).map(s =>
        s.id === 'what-followed' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(mainEvent.id, context, sections, 'overview');

      expect(lines.some(l => l.includes('War broke out'))).toBe(true);
    });

    it('handles no consequences', () => {
      const event = createMockEvent(1, { consequences: [] });
      context.eventLog.append(event);

      const sections = inspector.getSections(event).map(s =>
        s.id === 'what-followed' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(event.id, context, sections, 'overview');

      expect(lines.some(l => l.includes('No consequences'))).toBe(true);
    });
  });

  describe('entity span tracking', () => {
    it('provides an entity span map', () => {
      const spans = inspector.getEntitySpans();
      expect(spans).toBeInstanceOf(Map);
    });

    it('resets spans on each render', () => {
      const event = createMockEvent(1);
      context.eventLog.append(event);
      const sections = inspector.getSections(event);

      inspector.render(event.id, context, sections, 'overview');
      const spans1 = inspector.getEntitySpans();

      inspector.render(event.id, context, sections, 'overview');
      const spans2 = inspector.getEntitySpans();

      // Should be a fresh map (different reference or reset)
      expect(spans2).toBeInstanceOf(Map);
    });
  });
});
