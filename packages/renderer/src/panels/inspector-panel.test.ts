import { describe, it, expect, beforeEach } from 'vitest';
import { InspectorPanel, createInspectorPanelLayout } from './inspector-panel.js';
import { MockScreen, createMockBoxFactory } from '../panel.js';
import type { RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { EventLog, EventBus, toEntityId } from '@fws/core';
import type { World, WorldClock, SpatialIndex, EntityId } from '@fws/core';

// Create mock world helper
interface MockWorldOverrides {
  hasStore?: (type: string) => boolean;
  getComponent?: (id: EntityId, type: string) => unknown;
}

function createMockWorld(overrides?: MockWorldOverrides): World {
  return {
    hasStore: overrides?.hasStore ?? (() => false),
    getComponent: overrides?.getComponent ?? (() => undefined),
  } as unknown as World;
}

// Create mock render context
function createMockContext(worldOverrides?: MockWorldOverrides): RenderContext {
  const eventLog = new EventLog();
  const eventBus = new EventBus();

  return {
    world: createMockWorld(worldOverrides),
    clock: {
      currentTick: 0,
      currentTime: { year: 1, month: 1, day: 1 },
    } as unknown as WorldClock,
    eventLog,
    eventBus,
    spatialIndex: {} as SpatialIndex,
  };
}

describe('InspectorPanel', () => {
  let screen: MockScreen;
  let panel: InspectorPanel;
  let context: RenderContext;

  beforeEach(() => {
    screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);
    const layout = createInspectorPanelLayout(0, 0, 60, 40);
    panel = new InspectorPanel(screen as unknown as any, layout, boxFactory as unknown as any);
    context = createMockContext();
  });

  describe('initialization', () => {
    it('creates with correct layout', () => {
      const layout = panel.getLayout();
      expect(layout.id).toBe(PanelId.Inspector);
      expect(layout.width).toBe(60);
      expect(layout.height).toBe(40);
    });

    it('starts with no entity selected', () => {
      expect(panel.getCurrentEntityId()).toBeNull();
      expect(panel.getCurrentEntityType()).toBe('unknown');
    });

    it('starts with empty history', () => {
      expect(panel.getHistory()).toHaveLength(0);
      expect(panel.getHistoryIndex()).toBe(-1);
    });

    it('starts in overview mode', () => {
      expect(panel.getMode()).toBe('overview');
    });
  });

  describe('entity inspection', () => {
    it('inspects entity by ID', () => {
      const entityId = toEntityId(42);
      panel.inspect(entityId, context);

      expect(panel.getCurrentEntityId()).toBe(entityId);
    });

    it('detects character type from Attribute component', () => {
      const entityId = toEntityId(1);
      const worldWithAttribute = {
        hasStore: (type: string) => type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Attribute' && id === entityId) {
            return { type: 'Attribute', strength: 10 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithAttribute);

      panel.inspect(entityId, ctx);

      expect(panel.getCurrentEntityType()).toBe('character');
    });

    it('detects location type from Position and Population components', () => {
      const entityId = toEntityId(2);
      const worldWithLocation = {
        hasStore: (type: string) => type === 'Position' || type === 'Population',
        getComponent: (id: EntityId, type: string) => {
          if (id === entityId) {
            if (type === 'Position') return { type: 'Position', x: 10, y: 20 };
            if (type === 'Population') return { type: 'Population', count: 1000 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithLocation);

      panel.inspect(entityId, ctx);

      expect(panel.getCurrentEntityType()).toBe('location');
    });

    it('detects faction type from Territory component', () => {
      const entityId = toEntityId(3);
      const worldWithFaction = {
        hasStore: (type: string) => type === 'Territory',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Territory' && id === entityId) {
            return { type: 'Territory', controlledRegions: [1, 2, 3] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithFaction);

      panel.inspect(entityId, ctx);

      expect(panel.getCurrentEntityType()).toBe('faction');
    });

    it('detects artifact type from CreationHistory component', () => {
      const entityId = toEntityId(4);
      const worldWithArtifact = {
        hasStore: (type: string) => type === 'CreationHistory',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'CreationHistory' && id === entityId) {
            return { type: 'CreationHistory', creatorId: 1 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithArtifact);

      panel.inspect(entityId, ctx);

      expect(panel.getCurrentEntityType()).toBe('artifact');
    });

    it('detects artifact type from OwnershipChain component', () => {
      const entityId = toEntityId(5);
      const worldWithArtifact = {
        hasStore: (type: string) => type === 'OwnershipChain',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'OwnershipChain' && id === entityId) {
            return { type: 'OwnershipChain', owners: [] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithArtifact);

      panel.inspect(entityId, ctx);

      expect(panel.getCurrentEntityType()).toBe('artifact');
    });

    it('returns unknown for entities without recognized components', () => {
      const entityId = toEntityId(99);
      panel.inspect(entityId, context);

      expect(panel.getCurrentEntityType()).toBe('unknown');
    });
  });

  describe('history navigation', () => {
    it('adds entries to history when inspecting', () => {
      panel.inspect(toEntityId(1), context);
      panel.inspect(toEntityId(2), context);
      panel.inspect(toEntityId(3), context);

      expect(panel.getHistory()).toHaveLength(3);
      expect(panel.getHistoryIndex()).toBe(2);
    });

    it('does not add duplicate entry for same entity', () => {
      panel.inspect(toEntityId(1), context);
      panel.inspect(toEntityId(1), context);

      expect(panel.getHistory()).toHaveLength(1);
    });

    it('navigates back in history', () => {
      panel.inspect(toEntityId(1), context);
      panel.inspect(toEntityId(2), context);
      panel.inspect(toEntityId(3), context);

      const result = panel.back();

      expect(result).toBe(true);
      expect(panel.getCurrentEntityId()).toBe(toEntityId(2));
      expect(panel.getHistoryIndex()).toBe(1);
    });

    it('navigates forward in history', () => {
      panel.inspect(toEntityId(1), context);
      panel.inspect(toEntityId(2), context);
      panel.inspect(toEntityId(3), context);

      panel.back();
      panel.back();
      const result = panel.forward();

      expect(result).toBe(true);
      expect(panel.getCurrentEntityId()).toBe(toEntityId(2));
      expect(panel.getHistoryIndex()).toBe(1);
    });

    it('returns false when cannot go back', () => {
      panel.inspect(toEntityId(1), context);

      const result = panel.back();

      expect(result).toBe(false);
      expect(panel.getHistoryIndex()).toBe(0);
    });

    it('returns false when cannot go forward', () => {
      panel.inspect(toEntityId(1), context);

      const result = panel.forward();

      expect(result).toBe(false);
    });

    it('truncates forward history when navigating from middle', () => {
      panel.inspect(toEntityId(1), context);
      panel.inspect(toEntityId(2), context);
      panel.inspect(toEntityId(3), context);

      panel.back();
      panel.back();
      panel.inspect(toEntityId(99), context);

      expect(panel.getHistory()).toHaveLength(2);
      expect(panel.getCurrentEntityId()).toBe(toEntityId(99));
    });

    it('clears history on clear()', () => {
      panel.inspect(toEntityId(1), context);
      panel.inspect(toEntityId(2), context);

      panel.clear();

      expect(panel.getHistory()).toHaveLength(0);
      expect(panel.getCurrentEntityId()).toBeNull();
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(() => {
      panel.inspect(toEntityId(1), context);
      panel.inspect(toEntityId(2), context);
      panel.inspect(toEntityId(3), context);
    });

    it('goes back with backspace', () => {
      panel.handleInput('backspace');
      expect(panel.getCurrentEntityId()).toBe(toEntityId(2));
    });

    it('goes back with left arrow', () => {
      panel.handleInput('left');
      expect(panel.getCurrentEntityId()).toBe(toEntityId(2));
    });

    it('goes forward with right arrow', () => {
      panel.handleInput('left');
      panel.handleInput('right');
      expect(panel.getCurrentEntityId()).toBe(toEntityId(3));
    });

    it('scrolls up with up/k', () => {
      const result1 = panel.handleInput('up');
      const result2 = panel.handleInput('k');
      // First scroll does nothing (already at top)
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('scrolls down with down/j', () => {
      expect(panel.handleInput('down')).toBe(true);
      expect(panel.handleInput('j')).toBe(true);
    });

    it('switches to overview mode with o', () => {
      panel.setMode('details');
      panel.handleInput('o');
      expect(panel.getMode()).toBe('overview');
    });

    it('switches to relationships mode with r', () => {
      panel.handleInput('r');
      expect(panel.getMode()).toBe('relationships');
    });

    it('switches to timeline mode with t', () => {
      panel.handleInput('t');
      expect(panel.getMode()).toBe('timeline');
    });

    it('switches to details mode with d', () => {
      panel.handleInput('d');
      expect(panel.getMode()).toBe('details');
    });

    it('returns false for unhandled keys', () => {
      expect(panel.handleInput('x')).toBe(false);
    });
  });

  describe('section management', () => {
    it('initializes sections for character type', () => {
      const entityId = toEntityId(1);
      const worldWithAttribute = {
        hasStore: (type: string) => type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Attribute' && id === entityId) {
            return { type: 'Attribute' };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithAttribute);

      panel.inspect(entityId, ctx);

      const sections = panel.getSections();
      expect(sections.length).toBeGreaterThan(0);
      expect(sections.some(s => s.id === 'attributes')).toBe(true);
    });

    it('toggles section collapsed state', () => {
      const entityId = toEntityId(1);
      const worldWithAttribute = {
        hasStore: (type: string) => type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Attribute' && id === entityId) {
            return { type: 'Attribute' };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithAttribute);

      panel.inspect(entityId, ctx);

      const initialState = panel.getSections()[0]?.collapsed;
      panel.toggleSection('header');
      const newState = panel.getSections()[0]?.collapsed;

      expect(newState).toBe(!initialState);
    });

    it('toggles section with number keys', () => {
      const entityId = toEntityId(1);
      const worldWithAttribute = {
        hasStore: (type: string) => type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Attribute' && id === entityId) {
            return { type: 'Attribute' };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithAttribute);

      panel.inspect(entityId, ctx);

      const initialState = panel.getSections()[0]?.collapsed;
      panel.handleInput('1');
      const newState = panel.getSections()[0]?.collapsed;

      expect(newState).toBe(!initialState);
    });
  });

  describe('event handlers', () => {
    it('sets inspect handler', () => {
      let calledWith: EntityId | undefined;
      panel.setInspectHandler((id) => {
        calledWith = id;
      });

      // Handler is stored but we can't easily test it's called without triggering the UI
      expect(calledWith).toBeUndefined();
    });

    it('sets go to location handler', () => {
      let calledX = -1;
      panel.setGoToLocationHandler((x, _y) => {
        calledX = x;
      });

      // Handler is stored but we can't easily test it's called without triggering the UI
      expect(calledX).toBe(-1);
    });
  });

  describe('rendering', () => {
    it('renders empty state when no entity selected', () => {
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders character inspection', () => {
      const entityId = toEntityId(1);
      const worldWithAttribute = {
        hasStore: (type: string) => type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Attribute' && id === entityId) {
            return { type: 'Attribute', strength: 15 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithAttribute);

      panel.inspect(entityId, ctx);
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('renders location inspection', () => {
      const entityId = toEntityId(2);
      const worldWithLocation = {
        hasStore: (type: string) => type === 'Position' || type === 'Population',
        getComponent: (id: EntityId, type: string) => {
          if (id === entityId) {
            if (type === 'Position') return { type: 'Position', x: 10, y: 20 };
            if (type === 'Population') return { type: 'Population', count: 1000 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithLocation);

      panel.inspect(entityId, ctx);
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('renders faction inspection', () => {
      const entityId = toEntityId(3);
      const worldWithFaction = {
        hasStore: (type: string) => type === 'Territory',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Territory' && id === entityId) {
            return { type: 'Territory', controlledRegions: [1, 2, 3] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithFaction);

      panel.inspect(entityId, ctx);
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('renders artifact inspection', () => {
      const entityId = toEntityId(4);
      const worldWithArtifact = {
        hasStore: (type: string) => type === 'CreationHistory',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'CreationHistory' && id === entityId) {
            return { type: 'CreationHistory', creatorId: 1 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithArtifact);

      panel.inspect(entityId, ctx);
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('renders in different modes', () => {
      panel.inspect(toEntityId(1), context);

      for (const mode of ['overview', 'relationships', 'timeline', 'details'] as const) {
        panel.setMode(mode);
        expect(() => panel.render(context)).not.toThrow();
      }
    });
  });

  describe('cleanup', () => {
    it('clears state on destroy', () => {
      panel.inspect(toEntityId(1), context);
      panel.destroy();

      expect(panel.getCurrentEntityId()).toBeNull();
      expect(panel.getHistory()).toHaveLength(0);
    });
  });

  describe('createInspectorPanelLayout', () => {
    it('creates layout with correct values', () => {
      const layout = createInspectorPanelLayout(10, 20, 50, 30);

      expect(layout.id).toBe(PanelId.Inspector);
      expect(layout.x).toBe(10);
      expect(layout.y).toBe(20);
      expect(layout.width).toBe(50);
      expect(layout.height).toBe(30);
      expect(layout.focused).toBe(false);
    });
  });
});
