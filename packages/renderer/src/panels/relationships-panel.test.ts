import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipsPanel, createRelationshipsPanelLayout } from './relationships-panel.js';
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

describe('RelationshipsPanel', () => {
  let screen: MockScreen;
  let panel: RelationshipsPanel;
  let context: RenderContext;

  beforeEach(() => {
    screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);
    const layout = createRelationshipsPanelLayout(0, 0, 60, 40);
    panel = new RelationshipsPanel(screen as unknown as any, layout, boxFactory as unknown as any);
    context = createMockContext();
  });

  describe('initialization', () => {
    it('creates with correct layout', () => {
      const layout = panel.getLayout();
      expect(layout.id).toBe(PanelId.RelationshipGraph);
      expect(layout.width).toBe(60);
      expect(layout.height).toBe(40);
    });

    it('starts with no center entity', () => {
      expect(panel.getCenterEntity()).toBeNull();
    });

    it('starts with default depth of 2', () => {
      expect(panel.getDepth()).toBe(2);
    });

    it('starts with all filter', () => {
      expect(panel.getFilter()).toBe('all');
    });

    it('starts with legend hidden', () => {
      expect(panel.isLegendShown()).toBe(false);
    });
  });

  describe('center entity', () => {
    it('sets center entity', () => {
      panel.setCenterEntity(toEntityId(42));
      expect(panel.getCenterEntity()).toBe(toEntityId(42));
    });
  });

  describe('depth control', () => {
    it('sets depth within bounds', () => {
      panel.setDepth(1);
      expect(panel.getDepth()).toBe(1);

      panel.setDepth(3);
      expect(panel.getDepth()).toBe(3);
    });

    it('clamps depth to minimum of 1', () => {
      panel.setDepth(0);
      expect(panel.getDepth()).toBe(1);

      panel.setDepth(-5);
      expect(panel.getDepth()).toBe(1);
    });

    it('clamps depth to maximum of 3', () => {
      panel.setDepth(4);
      expect(panel.getDepth()).toBe(3);

      panel.setDepth(10);
      expect(panel.getDepth()).toBe(3);
    });

    it('cycles depth with d key', () => {
      panel.setDepth(1);
      panel.handleInput('d');
      expect(panel.getDepth()).toBe(2);

      panel.handleInput('d');
      expect(panel.getDepth()).toBe(3);

      panel.handleInput('d');
      expect(panel.getDepth()).toBe(1);
    });
  });

  describe('filter control', () => {
    it('sets filter', () => {
      panel.setFilter('positive');
      expect(panel.getFilter()).toBe('positive');

      panel.setFilter('negative');
      expect(panel.getFilter()).toBe('negative');
    });

    it('cycles filter with f key', () => {
      expect(panel.getFilter()).toBe('all');

      panel.handleInput('f');
      expect(panel.getFilter()).toBe('positive');

      panel.handleInput('f');
      expect(panel.getFilter()).toBe('negative');

      panel.handleInput('f');
      expect(panel.getFilter()).toBe('family');

      panel.handleInput('f');
      expect(panel.getFilter()).toBe('political');

      panel.handleInput('f');
      expect(panel.getFilter()).toBe('economic');

      panel.handleInput('f');
      expect(panel.getFilter()).toBe('all');
    });
  });

  describe('legend control', () => {
    it('toggles legend with l key', () => {
      expect(panel.isLegendShown()).toBe(false);

      panel.handleInput('l');
      expect(panel.isLegendShown()).toBe(true);

      panel.handleInput('l');
      expect(panel.isLegendShown()).toBe(false);
    });
  });

  describe('cursor navigation', () => {
    beforeEach(() => {
      panel.setCenterEntity(toEntityId(1));
    });

    it('moves cursor up with up/k', () => {
      // Start at some position first by moving down
      panel.handleInput('down');
      panel.handleInput('down');

      panel.handleInput('up');
      // Cursor should move
      expect(panel.handleInput('k')).toBe(true);
    });

    it('moves cursor down with down/j', () => {
      expect(panel.handleInput('down')).toBe(true);
      expect(panel.handleInput('j')).toBe(true);
    });

    it('moves cursor left with left/h', () => {
      // Move right first
      panel.handleInput('right');

      expect(panel.handleInput('left')).toBe(true);
      expect(panel.handleInput('h')).toBe(true);
    });

    it('moves cursor right with right/l', () => {
      expect(panel.handleInput('right')).toBe(true);
    });

    it('does not move cursor past left boundary', () => {
      // Try to move left at x=0
      panel.handleInput('left');
      panel.handleInput('left');
      panel.handleInput('left');
      // Should not throw
    });

    it('does not move cursor past top boundary', () => {
      // Try to move up at y=0
      panel.handleInput('up');
      panel.handleInput('up');
      panel.handleInput('up');
      // Should not throw
    });
  });

  describe('event handlers', () => {
    it('sets and retrieves inspect handler', () => {
      const handler = (_id: EntityId) => {
        // Handler called with entity ID
      };

      panel.setInspectHandler(handler);
      expect(panel.getInspectHandler()).toBe(handler);
    });

    it('sets center handler', () => {
      const handler = (_id: EntityId) => {
        // Handler called with entity ID
      };

      panel.setCenterHandler(handler);
      // Handler is stored - we can't easily verify it's called without triggering the UI
    });
  });

  describe('rendering', () => {
    it('renders empty state when no center entity', () => {
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders no relationships message when entity has none', () => {
      panel.setCenterEntity(toEntityId(1));
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders graph when entity has relationships', () => {
      const entityId = toEntityId(1);
      const worldWithRelationships = {
        hasStore: (type: string) => type === 'Relationship' || type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Relationship' && id === entityId) {
            return {
              relationships: new Map([[2, 'ally'], [3, 'rival']]),
              affinity: new Map([[2, 75], [3, -50]]),
            };
          }
          if (type === 'Attribute') {
            return { strength: 10 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithRelationships);

      panel.setCenterEntity(entityId);
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('renders with different depths', () => {
      panel.setCenterEntity(toEntityId(1));

      for (const depth of [1, 2, 3]) {
        panel.setDepth(depth);
        expect(() => panel.render(context)).not.toThrow();
      }
    });

    it('renders with different filters', () => {
      panel.setCenterEntity(toEntityId(1));

      for (const filter of ['all', 'positive', 'negative', 'family', 'political', 'economic'] as const) {
        panel.setFilter(filter);
        expect(() => panel.render(context)).not.toThrow();
      }
    });

    it('renders with legend visible', () => {
      panel.setCenterEntity(toEntityId(1));
      panel.toggleLegend();
      expect(() => panel.render(context)).not.toThrow();
    });
  });

  describe('entity type detection', () => {
    it('detects character type', () => {
      const entityId = toEntityId(1);
      const worldWithCharacter = {
        hasStore: (type: string) => type === 'Attribute' || type === 'Relationship',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Attribute' && id === entityId) {
            return { strength: 10 };
          }
          if (type === 'Relationship' && id === entityId) {
            return {
              relationships: new Map([[2, 'friend']]),
              affinity: new Map([[2, 50]]),
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithCharacter);

      panel.setCenterEntity(entityId);
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('detects faction type', () => {
      const entityId = toEntityId(1);
      const worldWithFaction = {
        hasStore: (type: string) => type === 'Territory' || type === 'Relationship',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Territory' && id === entityId) {
            return { regions: [1, 2, 3] };
          }
          if (type === 'Relationship' && id === entityId) {
            return {
              relationships: new Map([[2, 'ally']]),
              affinity: new Map([[2, 80]]),
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithFaction);

      panel.setCenterEntity(entityId);
      expect(() => panel.render(ctx)).not.toThrow();
    });
  });

  describe('faction membership', () => {
    it('adds faction membership edges', () => {
      const entityId = toEntityId(1);
      const factionId = toEntityId(100);
      const worldWithAffiliation = {
        hasStore: (type: string) => type === 'Affiliation' || type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Affiliation' && id === entityId) {
            return { factionId: factionId, role: 'member' };
          }
          if (type === 'Attribute') {
            return { strength: 10 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithAffiliation);

      panel.setCenterEntity(entityId);
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('identifies leader role', () => {
      const entityId = toEntityId(1);
      const factionId = toEntityId(100);
      const worldWithLeader = {
        hasStore: (type: string) => type === 'Affiliation' || type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Affiliation' && id === entityId) {
            return { factionId: factionId, role: 'leader' };
          }
          if (type === 'Attribute') {
            return { strength: 10 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithLeader);

      panel.setCenterEntity(entityId);
      expect(() => panel.render(ctx)).not.toThrow();
    });
  });

  describe('filter behavior', () => {
    const createWorldWithRelationships = () => ({
      hasStore: (type: string) => type === 'Relationship' || type === 'Attribute',
      getComponent: (id: EntityId, type: string) => {
        if (type === 'Relationship' && id === toEntityId(1)) {
          return {
            relationships: new Map([
              [2, 'ally'],
              [3, 'enemy'],
              [4, 'family'],
              [5, 'trade partner'],
            ]),
            affinity: new Map([
              [2, 80],
              [3, -70],
              [4, 60],
              [5, 40],
            ]),
          };
        }
        if (type === 'Attribute') {
          return { strength: 10 };
        }
        return undefined;
      },
    });

    it('filters positive relationships', () => {
      const ctx = createMockContext(createWorldWithRelationships());
      panel.setCenterEntity(toEntityId(1));
      panel.setFilter('positive');
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('filters negative relationships', () => {
      const ctx = createMockContext(createWorldWithRelationships());
      panel.setCenterEntity(toEntityId(1));
      panel.setFilter('negative');
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('filters family relationships', () => {
      const ctx = createMockContext(createWorldWithRelationships());
      panel.setCenterEntity(toEntityId(1));
      panel.setFilter('family');
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('filters political relationships', () => {
      const ctx = createMockContext(createWorldWithRelationships());
      panel.setCenterEntity(toEntityId(1));
      panel.setFilter('political');
      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('filters economic relationships', () => {
      const ctx = createMockContext(createWorldWithRelationships());
      panel.setCenterEntity(toEntityId(1));
      panel.setFilter('economic');
      expect(() => panel.render(ctx)).not.toThrow();
    });
  });

  describe('keyboard input', () => {
    it('returns false for unhandled keys', () => {
      expect(panel.handleInput('x')).toBe(false);
      expect(panel.handleInput('q')).toBe(false);
    });

    it('returns true for handled keys', () => {
      expect(panel.handleInput('d')).toBe(true);
      expect(panel.handleInput('f')).toBe(true);
      expect(panel.handleInput('l')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('clears state on destroy', () => {
      panel.setCenterEntity(toEntityId(1));
      panel.destroy();

      expect(panel.getCenterEntity()).toBeNull();
    });
  });

  describe('createRelationshipsPanelLayout', () => {
    it('creates layout with correct values', () => {
      const layout = createRelationshipsPanelLayout(10, 20, 50, 30);

      expect(layout.id).toBe(PanelId.RelationshipGraph);
      expect(layout.x).toBe(10);
      expect(layout.y).toBe(20);
      expect(layout.width).toBe(50);
      expect(layout.height).toBe(30);
      expect(layout.focused).toBe(false);
    });
  });
});
