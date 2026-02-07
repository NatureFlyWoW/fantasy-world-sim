import { describe, it, expect, beforeEach } from 'vitest';
import { CharacterInspector } from './character-inspector.js';
import type { InspectorSection } from './inspector-panel.js';
import type { RenderContext } from '../types.js';
import { EventLog, EventBus, EventCategory, toEntityId, toEventId } from '@fws/core';
import type { World, WorldClock, SpatialIndex, EntityId, WorldEvent } from '@fws/core';

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

// Helper to create mock event
function createMockEvent(id: number, entityId: number): WorldEvent {
  return {
    id: toEventId(toEntityId(id)),
    category: EventCategory.Personal,
    subtype: 'character.action',
    timestamp: id * 10,
    participants: [toEntityId(entityId)],
    causes: [],
    consequences: [],
    data: { description: `Event ${id}` },
    significance: 50,
    consequencePotential: [],
  } as WorldEvent;
}

describe('CharacterInspector', () => {
  let inspector: CharacterInspector;
  let context: RenderContext;
  let sections: InspectorSection[];

  beforeEach(() => {
    inspector = new CharacterInspector();
    context = createMockContext();
    sections = inspector.getSections();
  });

  describe('getSections', () => {
    it('returns 7 sections', () => {
      expect(sections).toHaveLength(7);
    });

    it('includes all prose-first section IDs', () => {
      const ids = sections.map(s => s.id);
      expect(ids).toContain('story-so-far');
      expect(ids).toContain('strengths-flaws');
      expect(ids).toContain('bonds-rivalries');
      expect(ids).toContain('worldly-standing');
      expect(ids).toContain('heart-mind');
      expect(ids).toContain('remembered-things');
      expect(ids).toContain('possessions-treasures');
    });

    it('has first 2 sections expanded by default', () => {
      expect(sections[0]?.collapsed).toBe(false);
      expect(sections[1]?.collapsed).toBe(false);
    });

    it('has remaining sections collapsed by default', () => {
      expect(sections[2]?.collapsed).toBe(true);
      expect(sections[3]?.collapsed).toBe(true);
      expect(sections[4]?.collapsed).toBe(true);
      expect(sections[5]?.collapsed).toBe(true);
      expect(sections[6]?.collapsed).toBe(true);
    });

    it('provides summary hints when data is available', () => {
      const entityId = toEntityId(1);
      const worldWithData = {
        hasStore: (type: string) => ['Traits', 'Relationship', 'Memory', 'Goal', 'Wealth'].includes(type),
        getComponent: (id: EntityId, type: string) => {
          if (id === entityId) {
            if (type === 'Traits') return { traits: ['brave', 'cunning'] };
            if (type === 'Relationship') return { relationships: new Map([[2, 'ally'], [3, 'rival']]) };
            if (type === 'Memory') return { memories: [{ eventId: 1, importance: 50, distortion: 10 }] };
            if (type === 'Goal') return { objectives: ['Conquer the East'], priorities: new Map([['Conquer the East', 90]]) };
            if (type === 'Wealth') return { coins: 5000 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithData);
      ctx.eventLog.append(createMockEvent(1, 1));

      const s = inspector.getSections(entityId, ctx);

      // story-so-far should have event count hint
      expect(s[0]?.summaryHint).toBe('1 events');
      // strengths-flaws should have top trait
      expect(s[1]?.summaryHint).toBe('Brave');
      // bonds-rivalries should have relation count
      expect(s[2]?.summaryHint).toBe('2 relations');
      // remembered-things should have memory count
      expect(s[5]?.summaryHint).toBe('1 memories');
      // possessions-treasures should have wealth
      expect(s[6]?.summaryHint).toContain('gold');
    });
  });

  describe('render', () => {
    it('renders without errors in overview mode', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'overview');

      expect(lines).toBeInstanceOf(Array);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('renders without errors in relationships mode', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'relationships');

      expect(lines).toBeInstanceOf(Array);
      expect(lines.some(l => l.includes('Bonds') || l.includes('Rivalries'))).toBe(true);
    });

    it('renders without errors in timeline mode', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'timeline');

      expect(lines).toBeInstanceOf(Array);
      expect(lines.some(l => l.includes('Timeline'))).toBe(true);
    });

    it('renders without errors in details mode', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'details');

      expect(lines).toBeInstanceOf(Array);
      expect(lines.some(l => l.includes('Full Character Details'))).toBe(true);
    });

    it('renders in all modes without error', () => {
      const entityId = toEntityId(1);
      for (const mode of ['overview', 'relationships', 'timeline', 'details'] as const) {
        const lines = inspector.render(entityId, context, sections, mode);
        expect(lines).toBeInstanceOf(Array);
        expect(lines.length).toBeGreaterThan(0);
      }
    });
  });

  describe('entity span tracking', () => {
    it('provides an entity span map', () => {
      const spans = inspector.getEntitySpans();
      expect(spans).toBeInstanceOf(Map);
    });

    it('resets spans on each render', () => {
      const entityId = toEntityId(1);
      inspector.render(entityId, context, sections, 'overview');
      const spans1 = inspector.getEntitySpans();

      inspector.render(entityId, context, sections, 'overview');
      const spans2 = inspector.getEntitySpans();

      expect(spans2).toBeInstanceOf(Map);
      // Different map instances
      expect(spans1).not.toBe(spans2);
    });
  });

  describe('story so far section', () => {
    it('shows message when no events recorded', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'overview');

      expect(lines.some(l => l.includes('yet to be written'))).toBe(true);
    });

    it('shows key moments when events exist', () => {
      const entityId = toEntityId(1);
      const ctx = createMockContext();

      ctx.eventLog.append(createMockEvent(1, 1));
      ctx.eventLog.append(createMockEvent(2, 1));

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Key moments'))).toBe(true);
      expect(lines.some(l => l.includes('Event'))).toBe(true);
    });

    it('shows health prose from health component', () => {
      const entityId = toEntityId(1);
      const worldWithHealth = {
        hasStore: (type: string) => type === 'Health',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Health' && id === entityId) {
            return { current: 75, maximum: 100 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithHealth);
      ctx.eventLog.append(createMockEvent(1, 1));

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      // Health should use prose from HEALTH_PROSE
      expect(lines.some(l => l.includes('wounds') || l.includes('health') || l.includes('injuries'))).toBe(true);
    });
  });

  describe('strengths and flaws section', () => {
    it('renders personality prose from Big Five', () => {
      const entityId = toEntityId(1);
      const worldWithPersonality = {
        hasStore: (type: string) => type === 'Personality',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Personality' && id === entityId) {
            return {
              openness: 80,      // high -> "endlessly curious"
              conscientiousness: 20, // low -> "free-spirited"
              extraversion: 50,     // moderate -> no descriptor
              agreeableness: 10,    // low -> "sharp-tongued"
              neuroticism: 50,      // moderate -> no descriptor
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithPersonality);

      const expandedSections = sections.map(s =>
        s.id === 'strengths-flaws' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      // Should include personality prose, not raw "Big Five:" label
      expect(lines.some(l => l.includes('individual is') || l.includes('curious') || l.includes('sharp-tongued'))).toBe(true);
    });

    it('renders attribute bars', () => {
      const entityId = toEntityId(1);
      const worldWithAttributes = {
        hasStore: (type: string) => type === 'Attribute',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Attribute' && id === entityId) {
            return {
              strength: 15,
              agility: 12,
              endurance: 10,
              intelligence: 18,
              wisdom: 14,
              charisma: 8,
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithAttributes);

      const expandedSections = sections.map(s =>
        s.id === 'strengths-flaws' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('STR'))).toBe(true);
      expect(lines.some(l => l.includes('INT'))).toBe(true);
    });

    it('renders traits as compact tags', () => {
      const entityId = toEntityId(1);
      const worldWithTraits = {
        hasStore: (type: string) => type === 'Traits',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Traits' && id === entityId) {
            return {
              traits: ['brave', 'ambitious'],
              intensities: new Map([['brave', 80], ['ambitious', 60]]),
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithTraits);

      const expandedSections = sections.map(s =>
        s.id === 'strengths-flaws' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('brave'))).toBe(true);
      expect(lines.some(l => l.includes('ambitious'))).toBe(true);
      expect(lines.some(l => l.includes('Traits:'))).toBe(true);
    });
  });

  describe('bonds and rivalries section', () => {
    it('categorizes relationships into allies and rivals', () => {
      const entityId = toEntityId(1);
      const worldWithRelationships = {
        hasStore: (type: string) => type === 'Relationship',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Relationship' && id === entityId) {
            return {
              relationships: new Map([[2, 'ally'], [3, 'rival']]),
              affinity: new Map([[2, 75], [3, -50]]),
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithRelationships);

      const expandedSections = sections.map(s =>
        s.id === 'bonds-rivalries' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('ALLIES'))).toBe(true);
      expect(lines.some(l => l.includes('RIVALS'))).toBe(true);
      expect(lines.some(l => l.includes('ally'))).toBe(true);
      expect(lines.some(l => l.includes('rival'))).toBe(true);
    });

    it('renders grudges with severity', () => {
      const entityId = toEntityId(1);
      const worldWithGrudges = {
        hasStore: (type: string) => type === 'Grudges',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Grudges' && id === entityId) {
            return {
              grudges: new Map([[5, 'betrayal']]),
              severity: new Map([[5, 80]]),
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithGrudges);

      const expandedSections = sections.map(s =>
        s.id === 'bonds-rivalries' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('grudge'))).toBe(true);
      expect(lines.some(l => l.includes('betrayal'))).toBe(true);
    });

    it('shows faction allegiance', () => {
      const entityId = toEntityId(1);
      const worldWithMembership = {
        hasStore: (type: string) => type === 'Membership',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Membership' && id === entityId) {
            return { factionId: 42, rank: 'Commander' };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithMembership);

      const expandedSections = sections.map(s =>
        s.id === 'bonds-rivalries' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('ALLEGIANCE'))).toBe(true);
      expect(lines.some(l => l.includes('Commander'))).toBe(true);
    });
  });

  describe('worldly standing section', () => {
    it('displays rank and faction', () => {
      const entityId = toEntityId(1);
      const worldWithStanding = {
        hasStore: (type: string) => ['Status', 'Membership'].includes(type),
        getComponent: (id: EntityId, type: string) => {
          if (id === entityId) {
            if (type === 'Status') return { titles: ['Lord Aldric'], socialClass: 'Noble' };
            if (type === 'Membership') return { factionId: 42, rank: 'Warlord' };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithStanding);

      const expandedSections = sections.map(s =>
        s.id === 'worldly-standing' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Warlord'))).toBe(true);
      expect(lines.some(l => l.includes('Lord Aldric'))).toBe(true);
    });

    it('displays wealth information', () => {
      const entityId = toEntityId(1);
      const worldWithWealth = {
        hasStore: (type: string) => type === 'Wealth',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Wealth' && id === entityId) {
            return { coins: 1000, propertyValue: 5000, debts: 200 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithWealth);

      const expandedSections = sections.map(s =>
        s.id === 'worldly-standing' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Wealth') && l.includes('gold'))).toBe(true);
    });
  });

  describe('heart and mind section', () => {
    it('renders goals with priority markers', () => {
      const entityId = toEntityId(1);
      const worldWithGoals = {
        hasStore: (type: string) => type === 'Goal',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Goal' && id === entityId) {
            return {
              objectives: ['Conquer the East', 'Find the artifact'],
              priorities: new Map([['Conquer the East', 90], ['Find the artifact', 50]]),
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithGoals);

      const expandedSections = sections.map(s =>
        s.id === 'heart-mind' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Conquer the East'))).toBe(true);
      expect(lines.some(l => l.includes('!!!'))).toBe(true); // High priority marker
      expect(lines.some(l => l.includes('ambition'))).toBe(true);
    });

    it('shows empty goals message when none exist', () => {
      const entityId = toEntityId(1);
      const expandedSections = sections.map(s =>
        s.id === 'heart-mind' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, context, expandedSections, 'overview');

      expect(lines.some(l => l.includes('No active goals'))).toBe(true);
    });
  });

  describe('remembered things section', () => {
    it('renders memories sorted by importance', () => {
      const entityId = toEntityId(1);
      const worldWithMemories = {
        hasStore: (type: string) => type === 'Memory',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Memory' && id === entityId) {
            return {
              memories: [
                { eventId: 1, importance: 50, distortion: 10 },
                { eventId: 2, importance: 90, distortion: 60 },
              ],
              capacity: 100,
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithMemories);

      const expandedSections = sections.map(s =>
        s.id === 'remembered-things' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Carries 2 memories'))).toBe(true);
      expect(lines.some(l => l.includes('distorted'))).toBe(true);
      expect(lines.some(l => l.includes('Strongest memories'))).toBe(true);
    });

    it('shows empty memories message', () => {
      const entityId = toEntityId(1);
      const expandedSections = sections.map(s =>
        s.id === 'remembered-things' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, context, expandedSections, 'overview');

      expect(lines.some(l => l.includes('No memories recorded'))).toBe(true);
    });
  });

  describe('possessions and treasures section', () => {
    it('renders wealth prose', () => {
      const entityId = toEntityId(1);
      const worldWithWealth = {
        hasStore: (type: string) => type === 'Wealth',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Wealth' && id === entityId) {
            return { coins: 1000, propertyValue: 5000, debts: 200 };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithWealth);

      const expandedSections = sections.map(s =>
        s.id === 'possessions-treasures' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('gold in coin'))).toBe(true);
      expect(lines.some(l => l.includes('debts') || l.includes('Debts'))).toBe(true);
    });

    it('renders item list with equipped indicator', () => {
      const entityId = toEntityId(1);
      const worldWithPossessions = {
        hasStore: (type: string) => type === 'Possession',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Possession' && id === entityId) {
            return { itemIds: [10, 11, 12], equippedIds: [10] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithPossessions);

      const expandedSections = sections.map(s =>
        s.id === 'possessions-treasures' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('[E]'))).toBe(true);
      expect(lines.some(l => l.includes('Carries 3 items'))).toBe(true);
    });

    it('shows no possessions message when empty', () => {
      const entityId = toEntityId(1);
      const expandedSections = sections.map(s =>
        s.id === 'possessions-treasures' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, context, expandedSections, 'overview');

      expect(lines.some(l => l.includes('No possessions'))).toBe(true);
    });
  });

  describe('timeline section', () => {
    it('renders events from event log', () => {
      const entityId = toEntityId(1);
      const ctx = createMockContext();

      ctx.eventLog.append(createMockEvent(1, 1));
      ctx.eventLog.append(createMockEvent(2, 1));

      const lines = inspector.render(entityId, ctx, sections, 'timeline');

      expect(lines.some(l => l.includes('Event'))).toBe(true);
    });

    it('shows no events message when empty', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'timeline');

      expect(lines.some(l => l.includes('No events recorded'))).toBe(true);
    });
  });

  describe('details mode', () => {
    it('renders all section titles', () => {
      const entityId = toEntityId(1);
      const lines = inspector.render(entityId, context, sections, 'details');

      expect(lines.some(l => l.includes('The Story So Far'))).toBe(true);
      expect(lines.some(l => l.includes('Strengths & Flaws'))).toBe(true);
      expect(lines.some(l => l.includes('Bonds & Rivalries'))).toBe(true);
      expect(lines.some(l => l.includes('Worldly Standing'))).toBe(true);
      expect(lines.some(l => l.includes('Heart & Mind'))).toBe(true);
      expect(lines.some(l => l.includes('Remembered Things'))).toBe(true);
      expect(lines.some(l => l.includes('Possessions & Treasures'))).toBe(true);
    });
  });
});
