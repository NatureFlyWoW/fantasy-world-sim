import { describe, it, expect, beforeEach } from 'vitest';
import { LocationInspector } from './location-inspector.js';
import { FactionInspector } from './faction-inspector.js';
import { ArtifactInspector } from './artifact-inspector.js';
import type { InspectorSection } from './inspector-panel.js';
import type { RenderContext } from '../types.js';
import { EventLog, EventBus, toEntityId } from '@fws/core';
import type { World, WorldClock, SpatialIndex, EntityId } from '@fws/core';

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

describe('LocationInspector', () => {
  let inspector: LocationInspector;
  let context: RenderContext;
  let sections: InspectorSection[];

  beforeEach(() => {
    inspector = new LocationInspector();
    context = createMockContext();
    sections = inspector.getSections();
  });

  describe('getSections', () => {
    it('returns correct sections with expected defaults', () => {
      expect(sections).toHaveLength(7);
      const sectionIds = sections.map(s => s.id);
      expect(sectionIds).toEqual([
        'living-portrait', 'people-peoples', 'power-governance',
        'trade-industry', 'walls-works', 'notable-souls', 'the-annals',
      ]);
      // First 2 expanded, rest collapsed
      expect(sections[0]?.collapsed).toBe(false);
      expect(sections[1]?.collapsed).toBe(false);
      for (let i = 2; i < sections.length; i++) {
        expect(sections[i]?.collapsed).toBe(true);
      }
    });

    it('includes settlement type summary hint from context', () => {
      const entityId = toEntityId(1);
      const worldWithPop = {
        hasStore: (type: string) => type === 'Population',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Population' && id === entityId) return { count: 5000 };
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithPop);
      const sects = inspector.getSections(entityId, ctx);
      expect(sects[0]?.summaryHint).toBe('City');
    });
  });

  describe('render', () => {
    it('renders in overview mode', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'overview');

      expect(lines).toBeInstanceOf(Array);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('renders in all modes without error', () => {
      const entityId = toEntityId(1);
      for (const mode of ['overview', 'relationships', 'timeline', 'details'] as const) {
        const lines = inspector.render(entityId, context, sections, mode);
        expect(lines).toBeInstanceOf(Array);
        expect(lines.length).toBeGreaterThan(0);
      }
    });

    it('renders relationships mode with Trade & Relations header', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'relationships');
      expect(lines.some(l => l.includes('Trade') && l.includes('Relations'))).toBe(true);
    });

    it('renders timeline mode with Settlement Timeline header', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'timeline');
      expect(lines.some(l => l.includes('Settlement Timeline'))).toBe(true);
    });

    it('renders details mode with Full Settlement Details', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'details');
      expect(lines.some(l => l.includes('Full Settlement Details'))).toBe(true);
    });
  });

  describe('living portrait section', () => {
    it('displays settlement name from Status via ruling faction', () => {
      const entityId = toEntityId(1);
      const worldWithOwnership = {
        hasStore: (type: string) => type === 'Ownership' || type === 'Status',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Ownership' && id === entityId) return { ownerId: 99 };
          if (type === 'Status' && (id as unknown as number) === 99) return { titles: ['Iron Confederacy'] };
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithOwnership);
      const lines = inspector.render(entityId, ctx, sections, 'overview');
      expect(lines.some(l => l.includes('Iron Confederacy'))).toBe(true);
    });

    it('displays population with size category', () => {
      const entityId = toEntityId(1);
      const worldWithPopulation = {
        hasStore: (type: string) => type === 'Population',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Population' && id === entityId) {
            return { count: 5000, growthRate: 0.02 };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithPopulation);
      const lines = inspector.render(entityId, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Population') && l.includes('5'))).toBe(true);
      expect(lines.some(l => l.includes('City') || l.includes('Town'))).toBe(true);
    });

    it('displays biome context', () => {
      const entityId = toEntityId(1);
      const worldWithBiome = {
        hasStore: (type: string) => type === 'Biome',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Biome' && id === entityId) return { biomeType: 'Forest' };
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithBiome);
      const lines = inspector.render(entityId, ctx, sections, 'overview');
      expect(lines.some(l => l.includes('forest'))).toBe(true);
    });

    it('displays coordinates', () => {
      const entityId = toEntityId(1);
      const worldWithPos = {
        hasStore: (type: string) => type === 'Position',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Position' && id === entityId) return { x: 10, y: 20 };
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithPos);
      const lines = inspector.render(entityId, ctx, sections, 'overview');
      expect(lines.some(l => l.includes('10') && l.includes('20'))).toBe(true);
    });
  });

  describe('trade & industry section', () => {
    it('displays wealth and industries', () => {
      const entityId = toEntityId(1);
      const worldWithEconomy = {
        hasStore: (type: string) => type === 'Economy',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Economy' && id === entityId) {
            return { wealth: 10000, tradeVolume: 5000, industries: ['Mining', 'Smithing'] };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithEconomy);

      const expandedSections = sections.map(s =>
        s.id === 'trade-industry' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Mining'))).toBe(true);
      expect(lines.some(l => l.includes('Smithing'))).toBe(true);
    });
  });

  describe('walls & works section', () => {
    it('displays garrison and fortifications', () => {
      const entityId = toEntityId(1);
      const worldWithMilitary = {
        hasStore: (type: string) => ['Military', 'Structures'].includes(type),
        getComponent: (id: EntityId, type: string) => {
          if (id === entityId) {
            if (type === 'Military') return { strength: 500, morale: 80, training: 70 };
            if (type === 'Structures') return { fortificationLevel: 3 };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithMilitary);

      const expandedSections = sections.map(s =>
        s.id === 'walls-works' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('500'))).toBe(true);
      expect(lines.some(l => l.includes('Stone') || l.includes('Level 3'))).toBe(true);
    });
  });

  describe('notable souls section', () => {
    it('shows characters at the same location', () => {
      const entityId = toEntityId(1);
      const charId = toEntityId(10);
      const positionStore = new Map<EntityId, unknown>();
      positionStore.set(entityId, { x: 5, y: 5 });
      positionStore.set(charId, { x: 5, y: 5 });

      const worldWithChars = {
        hasStore: (type: string) => type === 'Position' || type === 'Attribute' || type === 'Status',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Position') {
            if (id === entityId) return { x: 5, y: 5 };
            if (id === charId) return { x: 5, y: 5 };
          }
          if (type === 'Attribute' && id === charId) return { strength: 10 };
          if (type === 'Status' && id === charId) return { titles: ['Gandalf the Grey'] };
          return undefined;
        },
        getStore: (type: string) => {
          if (type === 'Position') return { getAll: () => positionStore };
          return { getAll: () => new Map() };
        },
      };
      const ctx = createMockContext(worldWithChars);

      const expandedSections = sections.map(s =>
        s.id === 'notable-souls' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');
      expect(lines.some(l => l.includes('Gandalf the Grey'))).toBe(true);
    });

    it('shows no inhabitants message when empty', () => {
      const expandedSections = sections.map(s =>
        s.id === 'notable-souls' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(toEntityId(1), context, expandedSections, 'overview');
      expect(lines.some(l => l.includes('No notable inhabitants'))).toBe(true);
    });
  });

  describe('entity span tracking', () => {
    it('provides an entity span map', () => {
      const spans = inspector.getEntitySpans();
      expect(spans).toBeInstanceOf(Map);
    });

    it('resets spans on each render', () => {
      inspector.render(toEntityId(1), context, sections, 'overview');
      const spans1 = inspector.getEntitySpans();

      inspector.render(toEntityId(1), context, sections, 'overview');
      const spans2 = inspector.getEntitySpans();

      expect(spans2).toBeInstanceOf(Map);
      // Should be a fresh map (different reference)
      expect(spans1).not.toBe(spans2);
    });
  });
});

describe('FactionInspector', () => {
  let inspector: FactionInspector;
  let context: RenderContext;
  let sections: InspectorSection[];

  beforeEach(() => {
    inspector = new FactionInspector();
    context = createMockContext();
    sections = inspector.getSections();
  });

  describe('getSections', () => {
    it('returns correct sections with expected defaults', () => {
      expect(sections).toHaveLength(8);
      const sectionIds = sections.map(s => s.id);
      expect(sectionIds).toEqual([
        'rise-reign', 'banner-creed', 'court-council', 'lands-holdings',
        'swords-shields', 'alliances-enmities', 'coffers-commerce', 'chronicles',
      ]);
      // First 3 expanded, rest collapsed
      for (let i = 0; i < sections.length; i++) {
        expect(sections[i]?.collapsed).toBe(i >= 3);
      }
    });

    it('includes summary hints from context data', () => {
      const entityId = toEntityId(1);
      const worldWithData = {
        hasStore: (type: string) => ['Origin', 'Territory', 'Military', 'Diplomacy', 'Economy', 'Hierarchy'].includes(type),
        getComponent: (id: EntityId, type: string) => {
          if (id !== entityId) return undefined;
          if (type === 'Origin') return { foundingTick: 360 }; // Year 2 -> age = 0 at tick 360
          if (type === 'Territory') return { controlledRegions: [1, 2, 3] };
          if (type === 'Military') return { strength: 5000 };
          if (type === 'Diplomacy') return { relations: new Map([[2, 50], [3, -60]]) };
          if (type === 'Economy') return { wealth: 14200 };
          if (type === 'Hierarchy') return { leaderId: 100 };
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithData);
      const sects = inspector.getSections(entityId, ctx);

      expect(sects[3]?.summaryHint).toBe('3 regions');
      expect(sects[4]?.summaryHint).toContain('5');
      expect(sects[4]?.summaryHint).toContain('strong');
      expect(sects[5]?.summaryHint).toBe('2 relations');
      expect(sects[6]?.summaryHint).toContain('gold');
    });
  });

  describe('render', () => {
    it('renders in all modes without errors', () => {
      const entityId = toEntityId(1);

      for (const mode of ['overview', 'relationships', 'timeline', 'details'] as const) {
        const lines = inspector.render(entityId, context, sections, mode);
        expect(lines).toBeInstanceOf(Array);
        expect(lines.length).toBeGreaterThan(0);
      }
    });

    it('renders relationships mode with Diplomatic Relations header', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'relationships');
      expect(lines.some(l => l.includes('Diplomatic Relations'))).toBe(true);
    });

    it('renders timeline mode with Faction History header', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'timeline');
      expect(lines.some(l => l.includes('Faction History'))).toBe(true);
    });

    it('renders details mode with Full Faction Details', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'details');
      expect(lines.some(l => l.includes('Full Faction Details'))).toBe(true);
    });
  });

  describe('rise & reign section', () => {
    it('displays government type and stability', () => {
      const entityId = toEntityId(1);
      const worldWithGov = {
        hasStore: (type: string) => type === 'Government',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Government' && id === entityId) {
            return { governmentType: 'Monarchy', stability: 75, legitimacy: 80 };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithGov);

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Monarchy'))).toBe(true);
      expect(lines.some(l => l.includes('Stability'))).toBe(true);
    });

    it('displays founding prose with age', () => {
      const entityId = toEntityId(1);
      const worldWithOrigin = {
        hasStore: (type: string) => type === 'Origin' || type === 'Status',
        getComponent: (id: EntityId, type: string) => {
          if (id !== entityId) return undefined;
          if (type === 'Origin') return { foundingTick: 0, founderId: 50 };
          if (type === 'Status') {
            return { titles: ['Iron Confederacy'] };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithOrigin);

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Iron Confederacy'))).toBe(true);
      expect(lines.some(l => l.includes('Year 1'))).toBe(true);
      expect(lines.some(l => l.includes('endured'))).toBe(true);
    });
  });

  describe('lands & holdings section', () => {
    it('displays controlled regions and capital', () => {
      const entityId = toEntityId(1);
      const worldWithTerritory = {
        hasStore: (type: string) => type === 'Territory',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Territory' && id === entityId) {
            return { controlledRegions: [1, 2, 3, 4, 5], capitalId: 1 };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithTerritory);

      const expandedSections = sections.map(s =>
        s.id === 'lands-holdings' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Capital'))).toBe(true);
      expect(lines.some(l => l.includes('Controlled Regions'))).toBe(true);
      expect(lines.some(l => l.includes('5 regions'))).toBe(true);
    });
  });

  describe('alliances & enmities section', () => {
    it('categorizes relations into ALLIES, ENEMIES, NEUTRAL', () => {
      const entityId = toEntityId(1);
      const worldWithDiplomacy = {
        hasStore: (type: string) => type === 'Diplomacy',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Diplomacy' && id === entityId) {
            return {
              relations: new Map([[2, 80], [3, -60], [4, 10]]),
              treaties: ['Trade Agreement with #2'],
            };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithDiplomacy);

      const expandedSections = sections.map(s =>
        s.id === 'alliances-enmities' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('ALLIES'))).toBe(true);
      expect(lines.some(l => l.includes('ENEMIES'))).toBe(true);
      expect(lines.some(l => l.includes('NEUTRAL'))).toBe(true);
      expect(lines.some(l => l.includes('Treaties'))).toBe(true);
    });

    it('uses diplomacy labels from shared prose', () => {
      const entityId = toEntityId(1);
      const worldWithDiplomacy = {
        hasStore: (type: string) => type === 'Diplomacy',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Diplomacy' && id === entityId) {
            return {
              relations: new Map([[2, 80], [3, -80]]),
            };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithDiplomacy);

      const expandedSections = sections.map(s =>
        s.id === 'alliances-enmities' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Allied'))).toBe(true);
      expect(lines.some(l => l.includes('Hostile'))).toBe(true);
    });
  });

  describe('court & council section', () => {
    it('displays leader and subordinates', () => {
      const entityId = toEntityId(1);
      const worldWithHierarchy = {
        hasStore: (type: string) => type === 'Hierarchy' || type === 'Status',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Hierarchy' && id === entityId) {
            return { leaderId: 100, subordinateIds: [101, 102, 103] };
          }
          if (type === 'Status' && (id as unknown as number) === 100) {
            return { titles: ['Thorin Ironhand'] };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithHierarchy);

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Thorin Ironhand'))).toBe(true);
      expect(lines.some(l => l.includes('Leader'))).toBe(true);
    });
  });

  describe('coffers & commerce section', () => {
    it('displays economic prose and treasury', () => {
      const entityId = toEntityId(1);
      const worldWithEconomy = {
        hasStore: (type: string) => type === 'Economy',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Economy' && id === entityId) {
            return { wealth: 20000, industries: ['Mining', 'Smithing'] };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithEconomy);

      const expandedSections = sections.map(s =>
        s.id === 'coffers-commerce' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Treasury'))).toBe(true);
      expect(lines.some(l => l.includes('Mining'))).toBe(true);
      expect(lines.some(l => l.includes('Smithing'))).toBe(true);
    });
  });

  describe('swords & shields section', () => {
    it('displays military prose and strength', () => {
      const entityId = toEntityId(1);
      const worldWithMilitary = {
        hasStore: (type: string) => type === 'Military',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Military' && id === entityId) {
            return { strength: 12000, morale: 78, training: 85 };
          }
          return undefined;
        },
        getStore: () => ({ getAll: () => new Map() }),
      };
      const ctx = createMockContext(worldWithMilitary);

      const expandedSections = sections.map(s =>
        s.id === 'swords-shields' ? { ...s, collapsed: false } : s
      );
      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('12') && l.includes('000'))).toBe(true);
      expect(lines.some(l => l.includes('Morale'))).toBe(true);
      expect(lines.some(l => l.includes('Training'))).toBe(true);
    });
  });

  describe('entity span tracking', () => {
    it('provides an entity span map', () => {
      const spans = inspector.getEntitySpans();
      expect(spans).toBeInstanceOf(Map);
    });

    it('resets spans on each render', () => {
      inspector.render(toEntityId(1), context, sections, 'overview');
      const spans1 = inspector.getEntitySpans();

      inspector.render(toEntityId(1), context, sections, 'overview');
      const spans2 = inspector.getEntitySpans();

      expect(spans2).toBeInstanceOf(Map);
      expect(spans1).not.toBe(spans2);
    });
  });
});

describe('ArtifactInspector', () => {
  let inspector: ArtifactInspector;
  let context: RenderContext;
  let sections: InspectorSection[];

  beforeEach(() => {
    inspector = new ArtifactInspector();
    context = createMockContext();
    sections = inspector.getSections();
  });

  describe('getSections', () => {
    it('returns correct sections', () => {
      expect(sections).toHaveLength(8);
      const sectionIds = sections.map(s => s.id);
      expect(sectionIds).toEqual([
        'overview', 'creation', 'powers', 'consciousness',
        'ownership', 'curses', 'significance', 'history',
      ]);
    });
  });

  describe('render', () => {
    it('renders in all modes without errors', () => {
      const entityId = toEntityId(1);

      for (const mode of ['overview', 'relationships', 'timeline', 'details'] as const) {
        const lines = inspector.render(entityId, context, sections, mode);
        expect(lines).toBeInstanceOf(Array);
        expect(lines.length).toBeGreaterThan(0);
      }
    });
  });

  describe('creation section', () => {
    it('displays creator and creation date', () => {
      const entityId = toEntityId(1);
      const worldWithCreation = {
        hasStore: (type: string) => type === 'CreationHistory',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'CreationHistory' && id === entityId) {
            return { creatorId: 50, creationTick: 720, method: 'Arcane Forging' };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithCreation);

      const expandedSections = sections.map(s =>
        s.id === 'creation' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Creator') && l.includes('50'))).toBe(true);
      expect(lines.some(l => l.includes('Year 3') || l.includes('Created'))).toBe(true);
      expect(lines.some(l => l.includes('Arcane Forging'))).toBe(true);
    });
  });

  describe('powers section', () => {
    it('displays enchantments and abilities', () => {
      const entityId = toEntityId(1);
      const worldWithPowers = {
        hasStore: (type: string) => type === 'MagicalProperty' || type === 'Power',
        getComponent: (id: EntityId, type: string) => {
          if (id === entityId) {
            if (type === 'MagicalProperty') {
              return { enchantments: ['Fire Damage', 'Lifesteal'], powerLevel: 75 };
            }
            if (type === 'Power') {
              return { abilities: ['Summon Flame'], manaPool: 100, rechargeRate: 10 };
            }
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithPowers);

      const expandedSections = sections.map(s =>
        s.id === 'powers' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Fire Damage'))).toBe(true);
      expect(lines.some(l => l.includes('Summon Flame'))).toBe(true);
    });
  });

  describe('consciousness section', () => {
    it('displays sentient status when personality present', () => {
      const entityId = toEntityId(1);
      const worldWithPersonality = {
        hasStore: (type: string) => type === 'Personality',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Personality' && id === entityId) {
            return { openness: 50, conscientiousness: 60, extraversion: 30, agreeableness: 20, neuroticism: 70 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithPersonality);

      const expandedSections = sections.map(s =>
        s.id === 'consciousness' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('SENTIENT'))).toBe(true);
    });

    it('displays non-sentient status when no personality', () => {
      const entityId = toEntityId(1);
      const expandedSections = sections.map(s =>
        s.id === 'consciousness' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, context, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Non-sentient'))).toBe(true);
    });
  });

  describe('ownership section', () => {
    it('displays ownership chain', () => {
      const entityId = toEntityId(1);
      const worldWithOwnership = {
        hasStore: (type: string) => type === 'OwnershipChain',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'OwnershipChain' && id === entityId) {
            return {
              owners: [
                { ownerId: 1, fromTick: 0, toTick: 360 },
                { ownerId: 2, fromTick: 360, toTick: null },
              ],
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithOwnership);

      const expandedSections = sections.map(s =>
        s.id === 'ownership' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Ownership History'))).toBe(true);
      expect(lines.some(l => l.includes('present'))).toBe(true);
    });
  });

  describe('curses section', () => {
    it('displays curse information', () => {
      const entityId = toEntityId(1);
      const worldWithCurse = {
        hasStore: (type: string) => type === 'Curse',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Curse' && id === entityId) {
            return { curseType: 'Bloodlust', severity: 80, breakCondition: 'Bathe in holy water' };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithCurse);

      const expandedSections = sections.map(s =>
        s.id === 'curses' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('CURSED'))).toBe(true);
      expect(lines.some(l => l.includes('Bloodlust'))).toBe(true);
      expect(lines.some(l => l.includes('holy water'))).toBe(true);
    });

    it('displays no curses when none present', () => {
      const entityId = toEntityId(1);
      const expandedSections = sections.map(s =>
        s.id === 'curses' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, context, expandedSections, 'overview');

      expect(lines.some(l => l.includes('No curses'))).toBe(true);
    });
  });

  describe('significance section', () => {
    it('displays legendary status', () => {
      const entityId = toEntityId(1);
      const worldWithSignificance = {
        hasStore: (type: string) => type === 'Significance',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Significance' && id === entityId) {
            return { historicalValue: 95, legendaryStatus: true, associatedEvents: [1, 2, 3] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithSignificance);

      const expandedSections = sections.map(s =>
        s.id === 'significance' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('LEGENDARY'))).toBe(true);
      expect(lines.some(l => l.includes('3 historical events'))).toBe(true);
    });

    it('displays value assessment', () => {
      const entityId = toEntityId(1);
      const worldWithValue = {
        hasStore: (type: string) => type === 'Value',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Value' && id === entityId) {
            return { monetaryValue: 5000, magicalValue: 8000, sentimentalValue: 100 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithValue);

      const expandedSections = sections.map(s =>
        s.id === 'significance' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Value Assessment'))).toBe(true);
      // Check for monetary value - locale may format differently
      expect(lines.some(l => l.includes('Monetary') && l.includes('5'))).toBe(true);
    });
  });
});
