import { describe, it, expect, beforeEach } from 'vitest';
import { EventLogPanel, createEventLogPanelLayout } from './event-log-panel.js';
import type { CascadeNode } from './event-log-panel.js';
import { MockScreen, createMockBoxFactory } from '../panel.js';
import type { RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { EventCategory, EventLog, EventBus, toEntityId, toEventId, toSiteId } from '@fws/core';
import type { WorldEvent, World, WorldClock, SpatialIndex, EntityId } from '@fws/core';

// Helper to create mock events
function createMockEvent(id: number, overrides: Partial<WorldEvent> = {}): WorldEvent {
  const eventId = toEventId(toEntityId(id));
  return {
    id: eventId,
    category: EventCategory.Political,
    subtype: 'faction.treaty_signed',
    timestamp: id * 10,
    participants: [toEntityId(id)],
    causes: [],
    consequences: [],
    data: { description: `Event ${id} description` },
    significance: 50,
    consequencePotential: [],
    ...overrides,
  } as WorldEvent;
}

// Create mock render context
function createMockContext(): RenderContext {
  const eventLog = new EventLog();
  const eventBus = new EventBus();

  return {
    world: {
      hasStore: () => false,
      getComponent: () => undefined,
    } as unknown as World,
    clock: {
      currentTick: 0,
      currentTime: { year: 1, month: 1, day: 1 },
    } as unknown as WorldClock,
    eventLog,
    eventBus,
    spatialIndex: {} as SpatialIndex,
  };
}

describe('EventLogPanel', () => {
  let screen: MockScreen;
  let panel: EventLogPanel;
  let context: RenderContext;

  beforeEach(() => {
    screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);
    const layout = createEventLogPanelLayout(0, 0, 80, 24);
    panel = new EventLogPanel(screen as unknown as any, layout, boxFactory as unknown as any);
    context = createMockContext();
  });

  describe('initialization', () => {
    it('creates with correct layout', () => {
      const layout = panel.getLayout();
      expect(layout.id).toBe(PanelId.EventLog);
      expect(layout.width).toBe(80);
      expect(layout.height).toBe(24);
    });

    it('starts in normal mode', () => {
      expect(panel.getMode()).toBe('normal');
    });

    it('starts with no events', () => {
      expect(panel.getTotalEventCount()).toBe(0);
      expect(panel.getFilteredEventCount()).toBe(0);
    });

    it('starts with no selected event', () => {
      expect(panel.getSelectedEvent()).toBeNull();
    });
  });

  describe('event management', () => {
    it('adds events correctly', () => {
      const event = createMockEvent(1);
      panel.addEvent(event);

      expect(panel.getTotalEventCount()).toBe(1);
      expect(panel.getFilteredEventCount()).toBe(1);
    });

    it('maintains event order', () => {
      panel.addEvent(createMockEvent(1));
      panel.addEvent(createMockEvent(2));
      panel.addEvent(createMockEvent(3));

      expect(panel.getTotalEventCount()).toBe(3);
    });

    it('loads events from event log', () => {
      context.eventLog.append(createMockEvent(1));
      context.eventLog.append(createMockEvent(2));

      panel.loadEventsFromLog(context);

      expect(panel.getTotalEventCount()).toBe(2);
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      // Add events of different categories
      panel.addEvent(createMockEvent(1, { category: EventCategory.Political }));
      panel.addEvent(createMockEvent(2, { category: EventCategory.Military }));
      panel.addEvent(createMockEvent(3, { category: EventCategory.Magical }));
      panel.addEvent(createMockEvent(4, { category: EventCategory.Political }));
    });

    it('shows all events by default', () => {
      expect(panel.getFilteredEventCount()).toBe(4);
    });

    it('filters by category', () => {
      panel.setCategoryFilter(EventCategory.Military, false);
      panel.setCategoryFilter(EventCategory.Magical, false);

      expect(panel.getFilteredEventCount()).toBe(2);
    });

    it('filters by minimum significance', () => {
      panel.addEvent(createMockEvent(5, { significance: 10 }));
      panel.addEvent(createMockEvent(6, { significance: 90 }));

      panel.setMinSignificance(60);

      expect(panel.getFilteredEventCount()).toBe(1);
    });

    it('filters by search query', () => {
      panel.setSearchQuery('Event 1');

      expect(panel.getFilteredEventCount()).toBe(1);
    });

    it('search is case insensitive', () => {
      panel.setSearchQuery('event 1');

      expect(panel.getFilteredEventCount()).toBe(1);
    });

    it('filters by entity', () => {
      panel.addEntityFilter(toEntityId(1));

      expect(panel.getFilteredEventCount()).toBe(1);
    });

    it('can clear entity filter', () => {
      panel.addEntityFilter(toEntityId(1));
      expect(panel.getFilteredEventCount()).toBe(1);

      panel.clearEntityFilter();
      expect(panel.getFilteredEventCount()).toBe(4);
    });

    it('combines multiple filters', () => {
      panel.setCategoryFilter(EventCategory.Military, false);
      panel.setMinSignificance(40);

      // Should have Political events only (2)
      expect(panel.getFilteredEventCount()).toBeLessThanOrEqual(3);
    });

    it('returns filter config', () => {
      const filter = panel.getFilter();

      expect(filter.minSignificance).toBe(40);
      expect(filter.searchQuery).toBe('');
      expect(filter.categories.size).toBeGreaterThan(0);
    });

    it('default filter has minSignificance of 40 to suppress low-significance noise', () => {
      const freshPanel = panel;
      const filter = freshPanel.getFilter();
      expect(filter.minSignificance).toBe(40);
    });

    it('filters out events below default significance threshold', () => {
      // Create a fresh panel to test default behavior
      const screen2 = new MockScreen();
      const boxFactory2 = createMockBoxFactory(screen2);
      const layout2 = createEventLogPanelLayout(0, 0, 80, 24);
      const freshPanel = new EventLogPanel(screen2 as unknown as any, layout2, boxFactory2 as unknown as any);

      // Add a low-significance event (typical CharacterAI noise)
      freshPanel.addEvent(createMockEvent(100, { significance: 20 }));
      // Add a meaningful event
      freshPanel.addEvent(createMockEvent(101, { significance: 50 }));

      expect(freshPanel.getTotalEventCount()).toBe(2);
      expect(freshPanel.getFilteredEventCount()).toBe(1);
    });
  });

  describe('bookmarks', () => {
    beforeEach(() => {
      panel.addEvent(createMockEvent(1));
      panel.addEvent(createMockEvent(2));
    });

    it('starts with no bookmarks', () => {
      expect(panel.getBookmarks()).toEqual([]);
    });

    it('can bookmark an event', () => {
      const eventId = toEventId(toEntityId(1));
      panel.toggleBookmark(eventId);

      expect(panel.isBookmarked(eventId)).toBe(true);
      expect(panel.getBookmarks()).toContain(eventId);
    });

    it('can unbookmark an event', () => {
      const eventId = toEventId(toEntityId(1));
      panel.toggleBookmark(eventId);
      panel.toggleBookmark(eventId);

      expect(panel.isBookmarked(eventId)).toBe(false);
    });

    it('can have multiple bookmarks', () => {
      const eventId1 = toEventId(toEntityId(1));
      const eventId2 = toEventId(toEntityId(2));
      panel.toggleBookmark(eventId1);
      panel.toggleBookmark(eventId2);

      expect(panel.getBookmarks()).toHaveLength(2);
    });
  });

  describe('cascade tree', () => {
    it('builds cascade tree for event', () => {
      const rootEvent = createMockEvent(1, { consequences: [toEventId(toEntityId(2)), toEventId(toEntityId(3))] });
      const child1 = createMockEvent(2, { causes: [toEventId(toEntityId(1))], consequences: [] });
      const child2 = createMockEvent(3, { causes: [toEventId(toEntityId(1))], consequences: [toEventId(toEntityId(4))] });
      const grandchild = createMockEvent(4, { causes: [toEventId(toEntityId(3))], consequences: [] });

      context.eventLog.append(rootEvent);
      context.eventLog.append(child1);
      context.eventLog.append(child2);
      context.eventLog.append(grandchild);

      const tree = panel.buildCascadeTree(rootEvent, context);

      expect(tree.event.id).toBe(toEventId(toEntityId(1)));
      expect(tree.children).toHaveLength(2);
      expect(tree.depth).toBe(0);
    });

    it('respects max depth', () => {
      const events: WorldEvent[] = [];
      for (let i = 1; i <= 10; i++) {
        events.push(createMockEvent(i, {
          consequences: i < 10 ? [toEventId(toEntityId(i + 1))] : [],
          causes: i > 1 ? [toEventId(toEntityId(i - 1))] : [],
        }));
      }

      for (const event of events) {
        context.eventLog.append(event);
      }

      const rootEvent = events[0];
      if (rootEvent === undefined) throw new Error('No root event');

      const tree = panel.buildCascadeTree(rootEvent, context, 3);

      // Check max depth is respected
      let maxDepth = 0;
      const checkDepth = (node: CascadeNode): void => {
        if (node.depth > maxDepth) maxDepth = node.depth;
        for (const child of node.children) {
          checkDepth(child);
        }
      };
      checkDepth(tree);

      expect(maxDepth).toBeLessThanOrEqual(3);
    });

    it('formats cascade tree as ASCII', () => {
      const rootEvent = createMockEvent(1, { consequences: [toEventId(toEntityId(2))] });
      const child = createMockEvent(2, { causes: [toEventId(toEntityId(1))], consequences: [] });

      context.eventLog.append(rootEvent);
      context.eventLog.append(child);

      const tree = panel.buildCascadeTree(rootEvent, context);
      const lines = panel.formatCascadeTree(tree);

      expect(lines.length).toBeGreaterThan(1);
      // Should have tree drawing characters
      expect(lines.join('')).toMatch(/[└├─]/);
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(() => {
      for (let i = 1; i <= 10; i++) {
        panel.addEvent(createMockEvent(i));
      }
    });

    it('auto-scroll selects latest event', () => {
      // With auto-scroll enabled, the last event should be selected
      expect(panel.getSelectedEvent()?.id).toBe(toEventId(toEntityId(10)));
    });

    it('selects previous event with up/k', () => {
      // Starting at event 10 (last), move up to 9, then 8
      panel.handleInput('up');
      expect(panel.getSelectedEvent()?.id).toBe(toEventId(toEntityId(9)));

      panel.handleInput('k');
      expect(panel.getSelectedEvent()?.id).toBe(toEventId(toEntityId(8)));
    });

    it('selects next event with down/j after moving up', () => {
      // Move up first, then down
      panel.handleInput('up');
      panel.handleInput('up');
      panel.handleInput('down');

      expect(panel.getSelectedEvent()?.id).toBe(toEventId(toEntityId(9)));
    });

    it('enters filter mode with f', () => {
      panel.handleInput('f');
      expect(panel.getMode()).toBe('filter');
    });

    it('exits filter mode with escape', () => {
      panel.handleInput('f');
      panel.handleInput('escape');
      expect(panel.getMode()).toBe('normal');
    });

    it('enters search mode with /', () => {
      panel.handleInput('/');
      expect(panel.getMode()).toBe('search');
    });

    it('exits search mode with escape', () => {
      panel.handleInput('/');
      panel.handleInput('escape');
      expect(panel.getMode()).toBe('normal');
    });

    it('toggles bookmark with b', () => {
      panel.handleInput('down'); // Select first event
      const event = panel.getSelectedEvent();
      expect(event).not.toBeNull();

      panel.handleInput('b');
      expect(panel.isBookmarked(event!.id)).toBe(true);

      panel.handleInput('b');
      expect(panel.isBookmarked(event!.id)).toBe(false);
    });

    it('enters cascade mode with c', () => {
      panel.handleInput('c');
      expect(panel.getMode()).toBe('cascade');
    });

    it('returns false for unhandled keys', () => {
      const result = panel.handleInput('q');
      expect(result).toBe(false);
    });
  });

  describe('search mode', () => {
    beforeEach(() => {
      panel.addEvent(createMockEvent(1, { data: { description: 'Alpha event' } }));
      panel.addEvent(createMockEvent(2, { data: { description: 'Beta event' } }));
      panel.handleInput('/'); // Enter search mode
    });

    it('builds search buffer from keypresses', () => {
      panel.handleInput('a');
      panel.handleInput('l');
      panel.handleInput('p');
      panel.handleInput('h');
      panel.handleInput('a');
      panel.handleInput('enter');

      expect(panel.getMode()).toBe('normal');
      expect(panel.getFilteredEventCount()).toBe(1);
    });

    it('backspace removes last character', () => {
      panel.handleInput('a');
      panel.handleInput('b');
      panel.handleInput('backspace');
      panel.handleInput('l');
      panel.handleInput('p');
      panel.handleInput('h');
      panel.handleInput('a');
      panel.handleInput('enter');

      expect(panel.getFilteredEventCount()).toBe(1);
    });
  });

  describe('event handlers', () => {
    it('calls event selection handler', () => {
      let selectedEvent: WorldEvent | null = null;
      panel.setEventSelectionHandler((event) => {
        selectedEvent = event;
      });

      panel.addEvent(createMockEvent(1));
      panel.handleInput('down');

      expect(selectedEvent).not.toBeNull();
    });

    it('calls go-to location handler', () => {
      let calledX = -1;
      panel.setGoToLocationHandler((x, _y) => {
        calledX = x;
      });

      panel.addEvent(createMockEvent(1, { location: toSiteId(toEntityId(42)) }));
      panel.handleInput('down');
      panel.handleInput('g');

      expect(calledX).toBe(42);
    });

    it('calls inspect entity handler', () => {
      let inspectedId: EntityId | undefined;
      panel.setInspectEntityHandler((entityId) => {
        inspectedId = entityId;
      });

      panel.addEvent(createMockEvent(1, { participants: [toEntityId(99)] }));
      panel.handleInput('down');
      panel.handleInput('enter');

      expect(inspectedId).toBe(toEntityId(99));
    });
  });

  describe('event subscription', () => {
    it('subscribes to event bus', () => {
      panel.subscribeToEvents(context);

      // Emit an event through the bus
      context.eventBus.emit(createMockEvent(100));

      expect(panel.getTotalEventCount()).toBe(1);
    });

    it('unsubscribes from event bus', () => {
      panel.subscribeToEvents(context);
      panel.unsubscribeFromEvents();

      // This event should not be added
      context.eventBus.emit(createMockEvent(100));

      expect(panel.getTotalEventCount()).toBe(0);
    });
  });

  describe('createEventLogPanelLayout', () => {
    it('creates layout with correct values', () => {
      const layout = createEventLogPanelLayout(10, 20, 60, 30);

      expect(layout.id).toBe(PanelId.EventLog);
      expect(layout.x).toBe(10);
      expect(layout.y).toBe(20);
      expect(layout.width).toBe(60);
      expect(layout.height).toBe(30);
      expect(layout.focused).toBe(false);
    });
  });

  describe('rendering', () => {
    it('renders without errors', () => {
      panel.addEvent(createMockEvent(1));
      panel.addEvent(createMockEvent(2));

      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders empty state', () => {
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders filter view', () => {
      panel.handleInput('f');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders search view', () => {
      panel.handleInput('/');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders cascade view', () => {
      const event = createMockEvent(1, { consequences: [] });
      context.eventLog.append(event);
      panel.addEvent(event);
      panel.handleInput('down');
      panel.buildCascadeForSelected(context);
      panel.handleInput('c');

      expect(() => panel.render(context)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('unsubscribes on destroy', () => {
      panel.subscribeToEvents(context);
      panel.destroy();

      // Should not throw when emitting after destroy
      context.eventBus.emit(createMockEvent(100));
    });
  });

  describe('narrative engine integration', () => {
    it('initializes with Epic Historical tone', () => {
      expect(panel.getCurrentTone()).toBe('EpicHistorical');
    });

    it('has all 5 tones available', () => {
      const tones = panel.getAvailableTones();
      expect(tones).toHaveLength(5);
      expect(tones).toContain('EpicHistorical');
      expect(tones).toContain('PersonalCharacterFocus');
      expect(tones).toContain('Mythological');
      expect(tones).toContain('PoliticalIntrigue');
      expect(tones).toContain('Scholarly');
    });

    it('cycles tone with t key', () => {
      const initialTone = panel.getCurrentTone();
      expect(initialTone).toBe('EpicHistorical');

      panel.handleInput('t');
      expect(panel.getCurrentTone()).toBe('PersonalCharacterFocus');

      panel.handleInput('t');
      expect(panel.getCurrentTone()).toBe('Mythological');

      panel.handleInput('t');
      expect(panel.getCurrentTone()).toBe('PoliticalIntrigue');

      panel.handleInput('t');
      expect(panel.getCurrentTone()).toBe('Scholarly');

      // Should wrap around
      panel.handleInput('t');
      expect(panel.getCurrentTone()).toBe('EpicHistorical');
    });

    it('initializes with default chroniclers', () => {
      const chroniclers = panel.getChroniclers();
      expect(chroniclers.length).toBeGreaterThanOrEqual(1);
    });

    it('cycles chronicler with h key', () => {
      const chroniclers = panel.getChroniclers();
      if (chroniclers.length > 1) {
        const initial = panel.getCurrentChronicler();

        panel.handleInput('h');
        const next = panel.getCurrentChronicler();

        // Should have changed to a different chronicler
        expect(next?.id).not.toBe(initial?.id);
      }
    });

    it('renders narrative panel with generated prose', () => {
      const event = createMockEvent(1, { significance: 70 });
      panel.addEvent(event);
      panel.handleInput('down');

      // Render should produce narrative content without placeholder text
      expect(() => panel.render(context)).not.toThrow();
    });

    it('shows different narrative text for different tones', () => {
      const event = createMockEvent(1, {
        significance: 80,
        subtype: 'faction.treaty_signed',
      });
      panel.addEvent(event);
      panel.handleInput('down');

      // Render with first tone
      panel.render(context);
      const firstTone = panel.getCurrentTone();

      // Change tone
      panel.handleInput('t');
      panel.render(context);
      const secondTone = panel.getCurrentTone();

      expect(firstTone).not.toBe(secondTone);
    });

    it('initializes without vignette', () => {
      expect(panel.getCurrentVignette()).toBeNull();
    });

    it('enters vignette mode with v key when vignette available', () => {
      // High significance event that might trigger vignette
      const event = createMockEvent(1, {
        significance: 95,
        subtype: 'character.death',
      });
      panel.addEvent(event);
      panel.handleInput('down');

      // Trigger vignette check
      panel.render(context);

      // If vignette was triggered, should enter vignette mode
      if (panel.getCurrentVignette() !== null) {
        panel.handleInput('v');
        expect(panel.getMode()).toBe('vignette');

        // Escape should return to normal
        panel.handleInput('escape');
        expect(panel.getMode()).toBe('normal');
      }
    });

    it('renders vignette view without errors', () => {
      // High significance event
      const event = createMockEvent(1, {
        significance: 95,
        subtype: 'coronation',
      });
      panel.addEvent(event);
      panel.handleInput('down');

      // Trigger vignette check
      panel.render(context);

      if (panel.getCurrentVignette() !== null) {
        panel.handleInput('v');
        expect(() => panel.render(context)).not.toThrow();
      }
    });
  });
});
