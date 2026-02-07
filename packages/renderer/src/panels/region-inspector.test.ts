import { describe, it, expect, beforeEach } from 'vitest';
import { RegionInspector } from './region-inspector.js';
import type { InspectorSection } from './inspector-panel.js';
import type { RenderContext, RenderableTile } from '../types.js';
import { EventLog, EventBus, EventCategory, toEntityId, toEventId } from '@fws/core';
import type { World, WorldClock, SpatialIndex, EntityId, WorldEvent } from '@fws/core';

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

function createMockContext(worldOverrides?: MockWorldOverrides): RenderContext {
  const eventLog = new EventLog();
  const eventBus = new EventBus();

  return {
    world: createMockWorld(worldOverrides),
    clock: {
      currentTick: 720,
      currentTime: { year: 3, month: 1, day: 1 },
    } as unknown as WorldClock,
    eventLog,
    eventBus,
    spatialIndex: {} as SpatialIndex,
  };
}

// Helper to create a mock tile
function createMockTile(overrides?: Partial<RenderableTile>): RenderableTile {
  return {
    biome: 'Mountain',
    elevation: 0.75,
    temperature: 0.45,
    rainfall: 0.35,
    resources: ['iron', 'stone'],
    ...overrides,
  };
}

describe('RegionInspector', () => {
  let inspector: RegionInspector;
  let context: RenderContext;

  beforeEach(() => {
    inspector = new RegionInspector();
    context = createMockContext();
  });

  describe('getSections', () => {
    it('returns 5 sections for tiles without ley line', () => {
      const tile = createMockTile();
      const sections = inspector.getSections(tile);
      expect(sections).toHaveLength(5);
    });

    it('returns 6 sections for tiles with ley line', () => {
      const tile = createMockTile({ leyLine: true });
      const sections = inspector.getSections(tile);
      expect(sections).toHaveLength(6);
      expect(sections[5]?.id).toBe('arcane');
    });

    it('includes all required section IDs', () => {
      const tile = createMockTile();
      const sections = inspector.getSections(tile);
      const ids = sections.map(s => s.id);
      expect(ids).toContain('land');
      expect(ids).toContain('riches');
      expect(ids).toContain('dwellers');
      expect(ids).toContain('marks');
      expect(ids).toContain('echoes');
    });

    it('first 2 sections expanded by default', () => {
      const tile = createMockTile();
      const sections = inspector.getSections(tile);
      expect(sections[0]?.collapsed).toBe(false);
      expect(sections[1]?.collapsed).toBe(false);
    });

    it('remaining sections collapsed by default', () => {
      const tile = createMockTile();
      const sections = inspector.getSections(tile);
      expect(sections[2]?.collapsed).toBe(true);
      expect(sections[3]?.collapsed).toBe(true);
      expect(sections[4]?.collapsed).toBe(true);
    });

    it('shows biome in summary hint', () => {
      const tile = createMockTile({ biome: 'Forest' });
      const sections = inspector.getSections(tile);
      expect(sections[0]?.summaryHint).toBe('Forest');
    });

    it('shows resource count in summary hint', () => {
      const tile = createMockTile({ resources: ['iron', 'gold', 'stone'] });
      const sections = inspector.getSections(tile);
      expect(sections[1]?.summaryHint).toBe('3 resources');
    });
  });

  describe('render', () => {
    it('renders in overview mode', () => {
      const tile = createMockTile();
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines).toBeInstanceOf(Array);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('renders in all modes without error', () => {
      const tile = createMockTile();
      const sections = inspector.getSections(tile);

      for (const mode of ['overview', 'relationships', 'timeline', 'details'] as const) {
        const lines = inspector.render(10, 20, tile, context, sections, mode);
        expect(lines).toBeInstanceOf(Array);
        expect(lines.length).toBeGreaterThan(0);
      }
    });
  });

  describe('land section', () => {
    it('displays biome prose for known biomes', () => {
      const tile = createMockTile({ biome: 'Mountain' });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      // BIOME_PROSE for Mountain includes "Rocky slopes"
      expect(lines.some(l => l.includes('Rocky slopes') || l.includes('wind-scoured'))).toBe(true);
    });

    it('displays elevation description', () => {
      const tile = createMockTile({ elevation: 0.8 });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('Lofty heights') || l.includes('sweeping view'))).toBe(true);
    });

    it('displays temperature description', () => {
      const tile = createMockTile({ temperature: 0.5 });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('temperate') || l.includes('mild'))).toBe(true);
    });

    it('displays rainfall description', () => {
      const tile = createMockTile({ rainfall: 0.7 });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('Heavy rains') || l.includes('lush'))).toBe(true);
    });

    it('displays river information when present', () => {
      const tile = createMockTile({ riverId: 42 });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('river'))).toBe(true);
    });
  });

  describe('riches section', () => {
    it('displays resource prose for known resources', () => {
      const tile = createMockTile({ resources: ['iron', 'gold'] });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('iron ore'))).toBe(true);
      expect(lines.some(l => l.includes('gold'))).toBe(true);
    });

    it('handles empty resources', () => {
      const tile = createMockTile({ resources: [] });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('few riches'))).toBe(true);
    });

    it('handles undefined resources', () => {
      const tile: RenderableTile = { biome: 'Desert' };
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('few riches') || l.includes('Desert'))).toBe(true);
    });

    it('shows wealth prose for abundant resources', () => {
      const tile = createMockTile({ resources: ['iron', 'gold', 'gemstones'] });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('wealthy') || l.includes('bounty'))).toBe(true);
    });
  });

  describe('dwellers section', () => {
    it('shows message when no inhabitants found', () => {
      const tile = createMockTile();
      const sections = inspector.getSections(tile).map(s =>
        s.id === 'dwellers' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('No inhabitants'))).toBe(true);
    });

    it('shows characters near the location', () => {
      const positionStore = new Map<EntityId, unknown>();
      positionStore.set(toEntityId(1), { x: 10, y: 20 });

      const worldWithEntities: MockWorldOverrides = {
        hasStore: (type: string) => type === 'Position' || type === 'Attribute' || type === 'Status',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Attribute' && id === toEntityId(1)) return { strength: 10 };
          if (type === 'Status' && id === toEntityId(1)) return { titles: ['Thorin Ironhand'] };
          return undefined;
        },
        getStore: (type: string) => {
          if (type === 'Position') return { getAll: () => positionStore };
          return { getAll: () => new Map() };
        },
      };
      const ctx = createMockContext(worldWithEntities);

      const tile = createMockTile();
      const sections = inspector.getSections(tile).map(s =>
        s.id === 'dwellers' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(10, 20, tile, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Thorin Ironhand'))).toBe(true);
    });
  });

  describe('echoes section', () => {
    it('shows message when no events found', () => {
      const tile = createMockTile();
      const sections = inspector.getSections(tile).map(s =>
        s.id === 'echoes' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('no recorded mark'))).toBe(true);
    });
  });

  describe('arcane section', () => {
    it('shows ley line prose when present', () => {
      const tile = createMockTile({ leyLine: true });
      const sections = inspector.getSections(tile).map(s =>
        s.id === 'arcane' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(10, 20, tile, context, sections, 'overview');

      expect(lines.some(l => l.includes('ley line') || l.includes('arcane energy'))).toBe(true);
    });
  });

  describe('entity span tracking', () => {
    it('provides an entity span map', () => {
      const spans = inspector.getEntitySpans();
      expect(spans).toBeInstanceOf(Map);
    });
  });

  describe('details mode', () => {
    it('renders all sections', () => {
      const tile = createMockTile({ leyLine: true });
      const sections = inspector.getSections(tile);
      const lines = inspector.render(10, 20, tile, context, sections, 'details');

      expect(lines.some(l => l.includes('Full Region Details'))).toBe(true);
      expect(lines.some(l => l.includes('Land'))).toBe(true);
      expect(lines.some(l => l.includes('Riches'))).toBe(true);
    });
  });
});
