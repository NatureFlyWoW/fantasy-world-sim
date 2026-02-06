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
    it('returns 8 sections', () => {
      expect(sections).toHaveLength(8);
    });

    it('includes required sections', () => {
      const sectionIds = sections.map(s => s.id);
      expect(sectionIds).toContain('overview');
      expect(sectionIds).toContain('geography');
      expect(sectionIds).toContain('demographics');
      expect(sectionIds).toContain('economy');
      expect(sectionIds).toContain('governance');
      expect(sectionIds).toContain('military');
      expect(sectionIds).toContain('structures');
      expect(sectionIds).toContain('history');
    });
  });

  describe('render', () => {
    it('renders in overview mode', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'overview');

      expect(lines).toBeInstanceOf(Array);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('renders in relationships mode', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'relationships');

      expect(lines.some(l => l.includes('Trade') || l.includes('Relations'))).toBe(true);
    });

    it('renders in timeline mode', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'timeline');

      expect(lines.some(l => l.includes('Timeline'))).toBe(true);
    });

    it('renders in details mode', () => {
      const lines = inspector.render(toEntityId(1), context, sections, 'details');

      expect(lines.some(l => l.includes('Full Details'))).toBe(true);
    });
  });

  describe('overview section', () => {
    it('displays settlement name from Status', () => {
      const entityId = toEntityId(1);
      const worldWithStatus = {
        hasStore: (type: string) => type === 'Status',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Status' && id === entityId) {
            return { titles: ['Ironforge'] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithStatus);

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Ironforge'))).toBe(true);
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
      };
      const ctx = createMockContext(worldWithPopulation);

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      // Check for population value - locale may format differently
      expect(lines.some(l => l.includes('Population') && l.includes('5'))).toBe(true);
      expect(lines.some(l => l.includes('City') || l.includes('Town'))).toBe(true);
    });
  });

  describe('geography section', () => {
    it('displays position and biome', () => {
      const entityId = toEntityId(1);
      const worldWithGeo = {
        hasStore: (type: string) => ['Position', 'Biome'].includes(type),
        getComponent: (id: EntityId, type: string) => {
          if (id === entityId) {
            if (type === 'Position') return { x: 10, y: 20 };
            if (type === 'Biome') return { biomeType: 'Forest', fertility: 70, moisture: 60 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithGeo);

      const expandedSections = sections.map(s =>
        s.id === 'geography' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('10') && l.includes('20'))).toBe(true);
      expect(lines.some(l => l.includes('Forest'))).toBe(true);
    });
  });

  describe('economy section', () => {
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
      };
      const ctx = createMockContext(worldWithEconomy);

      const expandedSections = sections.map(s =>
        s.id === 'economy' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Mining'))).toBe(true);
      expect(lines.some(l => l.includes('Smithing'))).toBe(true);
    });
  });

  describe('military section', () => {
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
      };
      const ctx = createMockContext(worldWithMilitary);

      const expandedSections = sections.map(s =>
        s.id === 'military' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('500'))).toBe(true);
      expect(lines.some(l => l.includes('Stone') || l.includes('Level 3'))).toBe(true);
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
    it('returns 9 sections', () => {
      expect(sections).toHaveLength(9);
    });

    it('includes required sections', () => {
      const sectionIds = sections.map(s => s.id);
      expect(sectionIds).toContain('overview');
      expect(sectionIds).toContain('heraldry');
      expect(sectionIds).toContain('government');
      expect(sectionIds).toContain('territory');
      expect(sectionIds).toContain('military');
      expect(sectionIds).toContain('diplomacy');
      expect(sectionIds).toContain('economy');
      expect(sectionIds).toContain('leadership');
      expect(sectionIds).toContain('history');
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

  describe('government section', () => {
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
      };
      const ctx = createMockContext(worldWithGov);

      const expandedSections = sections.map(s =>
        s.id === 'government' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Monarchy'))).toBe(true);
      expect(lines.some(l => l.includes('Stability'))).toBe(true);
    });
  });

  describe('territory section', () => {
    it('displays controlled regions', () => {
      const entityId = toEntityId(1);
      const worldWithTerritory = {
        hasStore: (type: string) => type === 'Territory',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Territory' && id === entityId) {
            return { controlledRegions: [1, 2, 3, 4, 5], capitalId: 1 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithTerritory);

      const expandedSections = sections.map(s =>
        s.id === 'territory' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Capital'))).toBe(true);
      expect(lines.some(l => l.includes('Controlled Regions'))).toBe(true);
    });
  });

  describe('diplomacy section', () => {
    it('displays relations with labels', () => {
      const entityId = toEntityId(1);
      const worldWithDiplomacy = {
        hasStore: (type: string) => type === 'Diplomacy',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Diplomacy' && id === entityId) {
            return {
              relations: new Map([[2, 80], [3, -60]]),
              treaties: ['Trade Agreement with #2'],
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithDiplomacy);

      const expandedSections = sections.map(s =>
        s.id === 'diplomacy' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Allied') || l.includes('Friendly'))).toBe(true);
      expect(lines.some(l => l.includes('Hostile') || l.includes('Unfriendly'))).toBe(true);
      expect(lines.some(l => l.includes('Treaties'))).toBe(true);
    });
  });

  describe('leadership section', () => {
    it('displays leader and subordinates', () => {
      const entityId = toEntityId(1);
      const worldWithHierarchy = {
        hasStore: (type: string) => type === 'Hierarchy',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Hierarchy' && id === entityId) {
            return { leaderId: 100, subordinateIds: [101, 102, 103] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithHierarchy);

      const expandedSections = sections.map(s =>
        s.id === 'leadership' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Leader') && l.includes('100'))).toBe(true);
      expect(lines.some(l => l.includes('Council') || l.includes('Subordinates'))).toBe(true);
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
    it('returns 8 sections', () => {
      expect(sections).toHaveLength(8);
    });

    it('includes required sections', () => {
      const sectionIds = sections.map(s => s.id);
      expect(sectionIds).toContain('overview');
      expect(sectionIds).toContain('creation');
      expect(sectionIds).toContain('powers');
      expect(sectionIds).toContain('consciousness');
      expect(sectionIds).toContain('ownership');
      expect(sectionIds).toContain('curses');
      expect(sectionIds).toContain('significance');
      expect(sectionIds).toContain('history');
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
