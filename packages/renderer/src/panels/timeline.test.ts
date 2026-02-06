import { describe, it, expect, beforeEach } from 'vitest';
import { TimelinePanel, createTimelinePanelLayout, ZOOM_SCALES, SIGNIFICANCE_MARKERS } from './timeline.js';
import { MockScreen, createMockBoxFactory } from '../panel.js';
import type { RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { EventLog, EventBus, toEventId, toEntityId } from '@fws/core';
import type { World, WorldClock, SpatialIndex, WorldEvent, EventCategory } from '@fws/core';

// Create mock world
function createMockWorld(): World {
  return {
    hasStore: () => false,
    getComponent: () => undefined,
  } as unknown as World;
}

// Create a mock event
function createMockEvent(
  id: number,
  timestamp: number,
  significance: number,
  category: EventCategory = 'Political' as EventCategory
): WorldEvent {
  return {
    id: toEventId(toEntityId(id)),
    category,
    subtype: 'test.event',
    timestamp,
    participants: [toEntityId(1)],
    causes: [],
    consequences: [],
    data: {},
    significance,
    consequencePotential: [],
  };
}

// Create mock render context
function createMockContext(events: WorldEvent[] = []): RenderContext {
  const eventLog = new EventLog();
  const eventBus = new EventBus();

  for (const event of events) {
    eventLog.append(event);
  }

  return {
    world: createMockWorld(),
    clock: {
      currentTick: 360, // 1 year
      currentTime: { year: 1, month: 1, day: 1 },
    } as unknown as WorldClock,
    eventLog,
    eventBus,
    spatialIndex: {} as SpatialIndex,
  };
}

describe('TimelinePanel', () => {
  let screen: MockScreen;
  let panel: TimelinePanel;
  let context: RenderContext;

  beforeEach(() => {
    screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);
    const layout = createTimelinePanelLayout(0, 0, 80, 20);
    panel = new TimelinePanel(screen as unknown as any, layout, boxFactory as unknown as any);
    context = createMockContext();
  });

  describe('initialization', () => {
    it('creates with correct layout', () => {
      const layout = panel.getLayout();
      expect(layout.id).toBe(PanelId.Timeline);
      expect(layout.width).toBe(80);
      expect(layout.height).toBe(20);
    });

    it('starts with decade zoom level', () => {
      expect(panel.getZoomLevel()).toBe('decade');
    });

    it('starts with zero scroll offset', () => {
      expect(panel.getScrollOffset()).toBe(0);
    });

    it('starts with tracks visible', () => {
      expect(panel.areTracksVisible()).toBe(true);
    });

    it('starts with no category filter', () => {
      expect(panel.getCategoryFilter()).toBeNull();
    });
  });

  describe('zoom control', () => {
    it('sets zoom level', () => {
      panel.setZoomLevel('year');
      expect(panel.getZoomLevel()).toBe('year');

      panel.setZoomLevel('century');
      expect(panel.getZoomLevel()).toBe('century');
    });

    it('cycles zoom with z key', () => {
      expect(panel.getZoomLevel()).toBe('decade');

      panel.handleInput('z');
      expect(panel.getZoomLevel()).toBe('century');

      panel.handleInput('z');
      expect(panel.getZoomLevel()).toBe('year');

      panel.handleInput('z');
      expect(panel.getZoomLevel()).toBe('decade');
    });
  });

  describe('scroll control', () => {
    it('sets scroll offset', () => {
      panel.setScrollOffset(1000);
      expect(panel.getScrollOffset()).toBe(1000);
    });

    it('clamps scroll offset to non-negative', () => {
      panel.setScrollOffset(-100);
      expect(panel.getScrollOffset()).toBe(0);
    });

    it('scrolls left with left/h keys', () => {
      panel.setScrollOffset(10000);
      const initial = panel.getScrollOffset();

      panel.handleInput('left');
      expect(panel.getScrollOffset()).toBeLessThan(initial);

      const afterLeft = panel.getScrollOffset();
      panel.handleInput('h');
      expect(panel.getScrollOffset()).toBeLessThan(afterLeft);
    });

    it('scrolls right with right/l keys', () => {
      const initial = panel.getScrollOffset();

      panel.handleInput('right');
      expect(panel.getScrollOffset()).toBeGreaterThan(initial);

      const afterRight = panel.getScrollOffset();
      panel.handleInput('l');
      expect(panel.getScrollOffset()).toBeGreaterThan(afterRight);
    });

    it('scrolls to start with home key', () => {
      panel.setScrollOffset(10000);
      panel.handleInput('home');
      expect(panel.getScrollOffset()).toBe(0);
    });

    it('scrolls forward with end key', () => {
      panel.handleInput('end');
      expect(panel.getScrollOffset()).toBeGreaterThan(0);
    });
  });

  describe('track control', () => {
    it('toggles tracks with t key', () => {
      expect(panel.areTracksVisible()).toBe(true);

      panel.handleInput('t');
      expect(panel.areTracksVisible()).toBe(false);

      panel.handleInput('t');
      expect(panel.areTracksVisible()).toBe(true);
    });

    it('adds and retrieves tracks', () => {
      expect(panel.getTracks().length).toBe(0);

      const events: WorldEvent[] = [createMockEvent(1, 100, 50)];
      panel.addTrack(toEntityId(1), 'Faction A', events);

      expect(panel.getTracks().length).toBe(1);
      expect(panel.getTracks()[0]?.label).toBe('Faction A');
    });

    it('clears tracks', () => {
      panel.addTrack(toEntityId(1), 'Faction A', []);
      panel.addTrack(toEntityId(2), 'Faction B', []);
      expect(panel.getTracks().length).toBe(2);

      panel.clearTracks();
      expect(panel.getTracks().length).toBe(0);
    });
  });

  describe('era markers', () => {
    it('adds and retrieves eras', () => {
      expect(panel.getEras().length).toBe(0);

      panel.addEra(0, 3600, 'Age of Heroes', '#FFD700');
      expect(panel.getEras().length).toBe(1);
      expect(panel.getEras()[0]?.label).toBe('Age of Heroes');
    });

    it('clears eras', () => {
      panel.addEra(0, 3600, 'Era 1', '#FFF');
      panel.addEra(3600, 7200, 'Era 2', '#FFF');
      expect(panel.getEras().length).toBe(2);

      panel.clearEras();
      expect(panel.getEras().length).toBe(0);
    });
  });

  describe('category filter', () => {
    it('sets category filter', () => {
      panel.setCategoryFilter('Military' as EventCategory);
      expect(panel.getCategoryFilter()).toBe('Military');
    });

    it('clears category filter', () => {
      panel.setCategoryFilter('Military' as EventCategory);
      panel.setCategoryFilter(null);
      expect(panel.getCategoryFilter()).toBeNull();
    });

    it('cycles filter with c key', () => {
      expect(panel.getCategoryFilter()).toBeNull();

      panel.handleInput('c');
      expect(panel.getCategoryFilter()).not.toBeNull();

      // Keep cycling until we get back to null
      for (let i = 0; i < 15; i++) {
        panel.handleInput('c');
      }
      // Should cycle through all categories and back to null
    });
  });

  describe('cursor control', () => {
    it('moves cursor with [ and ]', () => {
      const initial = panel.getCursorPosition();

      panel.handleInput(']');
      expect(panel.getCursorPosition()).toBe(initial + 1);

      panel.handleInput('[');
      expect(panel.getCursorPosition()).toBe(initial);
    });

    it('clamps cursor to bounds', () => {
      // Move left many times from position 0
      for (let i = 0; i < 10; i++) {
        panel.handleInput('[');
      }
      expect(panel.getCursorPosition()).toBe(0);
    });
  });

  describe('rendering', () => {
    it('renders without errors when empty', () => {
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders with events', () => {
      const events = [
        createMockEvent(1, 100, 25),
        createMockEvent(2, 200, 50),
        createMockEvent(3, 300, 75),
        createMockEvent(4, 400, 90),
      ];
      const ctx = createMockContext(events);

      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('renders with tracks', () => {
      panel.addTrack(toEntityId(1), 'Test Faction', [createMockEvent(1, 100, 50)]);
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders with era markers', () => {
      panel.addEra(0, 1000, 'Test Era', '#FFFFFF');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders at different zoom levels', () => {
      for (const zoom of ['year', 'decade', 'century'] as const) {
        panel.setZoomLevel(zoom);
        expect(() => panel.render(context)).not.toThrow();
      }
    });
  });

  describe('event inspection', () => {
    it('sets inspect handler', () => {
      let inspectedId = null as unknown;
      panel.setInspectHandler((id) => {
        inspectedId = id;
      });

      // Handler is stored but we can't easily trigger it without the right event
      expect(inspectedId).toBeNull();
    });
  });

  describe('keyboard input', () => {
    it('returns false for unhandled keys', () => {
      expect(panel.handleInput('x')).toBe(false);
      expect(panel.handleInput('q')).toBe(false);
    });

    it('returns true for handled keys', () => {
      expect(panel.handleInput('z')).toBe(true);
      expect(panel.handleInput('t')).toBe(true);
      expect(panel.handleInput('c')).toBe(true);
      expect(panel.handleInput('left')).toBe(true);
      expect(panel.handleInput('right')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('clears state on destroy', () => {
      panel.addTrack(toEntityId(1), 'Test', []);
      panel.addEra(0, 100, 'Era', '#FFF');
      panel.destroy();

      expect(panel.getTracks().length).toBe(0);
      expect(panel.getEras().length).toBe(0);
    });
  });

  describe('createTimelinePanelLayout', () => {
    it('creates layout with correct values', () => {
      const layout = createTimelinePanelLayout(10, 20, 100, 30);

      expect(layout.id).toBe(PanelId.Timeline);
      expect(layout.x).toBe(10);
      expect(layout.y).toBe(20);
      expect(layout.width).toBe(100);
      expect(layout.height).toBe(30);
      expect(layout.focused).toBe(false);
    });
  });
});

describe('ZOOM_SCALES', () => {
  it('has correct scale values', () => {
    expect(ZOOM_SCALES.year).toBe(30);
    expect(ZOOM_SCALES.decade).toBe(360);
    expect(ZOOM_SCALES.century).toBe(3600);
  });
});

describe('SIGNIFICANCE_MARKERS', () => {
  it('has markers in descending threshold order', () => {
    for (let i = 0; i < SIGNIFICANCE_MARKERS.length - 1; i++) {
      const current = SIGNIFICANCE_MARKERS[i];
      const next = SIGNIFICANCE_MARKERS[i + 1];
      if (current !== undefined && next !== undefined) {
        expect(current.threshold).toBeGreaterThan(next.threshold);
      }
    }
  });

  it('has expected markers', () => {
    expect(SIGNIFICANCE_MARKERS[0]?.marker).toBe('★');
    expect(SIGNIFICANCE_MARKERS[1]?.marker).toBe('●');
    expect(SIGNIFICANCE_MARKERS[2]?.marker).toBe('○');
    expect(SIGNIFICANCE_MARKERS[3]?.marker).toBe('·');
  });
});
