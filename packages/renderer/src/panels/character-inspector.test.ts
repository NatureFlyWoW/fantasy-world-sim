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
    it('returns 8 sections', () => {
      expect(sections).toHaveLength(8);
    });

    it('includes header section', () => {
      expect(sections.some(s => s.id === 'header')).toBe(true);
    });

    it('includes attributes section', () => {
      expect(sections.some(s => s.id === 'attributes')).toBe(true);
    });

    it('includes personality section', () => {
      expect(sections.some(s => s.id === 'personality')).toBe(true);
    });

    it('includes goals section', () => {
      expect(sections.some(s => s.id === 'goals')).toBe(true);
    });

    it('includes relationships section', () => {
      expect(sections.some(s => s.id === 'relationships')).toBe(true);
    });

    it('includes memories section', () => {
      expect(sections.some(s => s.id === 'memories')).toBe(true);
    });

    it('includes possessions section', () => {
      expect(sections.some(s => s.id === 'possessions')).toBe(true);
    });

    it('includes timeline section', () => {
      expect(sections.some(s => s.id === 'timeline')).toBe(true);
    });

    it('has some sections collapsed by default', () => {
      const collapsedCount = sections.filter(s => s.collapsed).length;
      expect(collapsedCount).toBeGreaterThan(0);
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
      expect(lines.some(l => l.includes('Relationships'))).toBe(true);
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
      expect(lines.some(l => l.includes('Full Details'))).toBe(true);
    });
  });

  describe('header section', () => {
    it('displays entity ID when no name available', () => {
      const entityId = toEntityId(42);
      const lines = inspector.render(entityId, context, sections, 'overview');

      expect(lines.some(l => l.includes('#42') || l.includes('ID'))).toBe(true);
    });

    it('displays character name from Status component', () => {
      const entityId = toEntityId(1);
      const worldWithStatus = {
        hasStore: (type: string) => type === 'Status',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Status' && id === entityId) {
            return { titles: ['Lord Aldric', 'Duke of Eastmarch'] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithStatus);

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Lord Aldric'))).toBe(true);
    });

    it('displays health information', () => {
      const entityId = toEntityId(1);
      const worldWithHealth = {
        hasStore: (type: string) => type === 'Health',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Health' && id === entityId) {
            return { current: 75, maximum: 100, injuries: ['broken arm'] };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithHealth);

      const lines = inspector.render(entityId, ctx, sections, 'overview');

      expect(lines.some(l => l.includes('Health') && l.includes('75'))).toBe(true);
      expect(lines.some(l => l.includes('broken arm'))).toBe(true);
    });
  });

  describe('attributes section', () => {
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

      // Expand attributes section
      const expandedSections = sections.map(s =>
        s.id === 'attributes' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('STR'))).toBe(true);
      expect(lines.some(l => l.includes('INT'))).toBe(true);
      expect(lines.some(l => l.includes('█'))).toBe(true); // Bar character
    });
  });

  describe('personality section', () => {
    it('renders Big Five traits', () => {
      const entityId = toEntityId(1);
      const worldWithPersonality = {
        hasStore: (type: string) => type === 'Personality',
        getComponent: (id: EntityId, type: string) => {
          if (type === 'Personality' && id === entityId) {
            return {
              openness: 70,
              conscientiousness: 50,
              extraversion: 30,
              agreeableness: 80,
              neuroticism: 20,
            };
          }
          return undefined;
        },
      };
      const ctx = createMockContext(worldWithPersonality);

      const expandedSections = sections.map(s =>
        s.id === 'personality' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Big Five'))).toBe(true);
      expect(lines.some(l => l.includes('Open'))).toBe(true);
    });

    it('renders character traits', () => {
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
        s.id === 'personality' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('brave'))).toBe(true);
      expect(lines.some(l => l.includes('ambitious'))).toBe(true);
    });
  });

  describe('goals section', () => {
    it('renders objectives with priorities', () => {
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
        s.id === 'goals' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Conquer the East'))).toBe(true);
    });

    it('shows no active goals message when empty', () => {
      const entityId = toEntityId(1);
      const expandedSections = sections.map(s =>
        s.id === 'goals' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, context, expandedSections, 'overview');

      expect(lines.some(l => l.includes('No active goals'))).toBe(true);
    });
  });

  describe('relationships section', () => {
    it('renders relationships and affinities', () => {
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
        s.id === 'relationships' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('ally'))).toBe(true);
      expect(lines.some(l => l.includes('rival'))).toBe(true);
    });

    it('renders grudges', () => {
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
        s.id === 'relationships' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Grudges'))).toBe(true);
      expect(lines.some(l => l.includes('betrayal'))).toBe(true);
    });
  });

  describe('memories section', () => {
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
        s.id === 'memories' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Memories'))).toBe(true);
      expect(lines.some(l => l.includes('distorted'))).toBe(true);
    });
  });

  describe('possessions section', () => {
    it('renders wealth information', () => {
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
        s.id === 'possessions' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Wealth'))).toBe(true);
      expect(lines.some(l => l.includes('1000') || l.includes('1,000'))).toBe(true);
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
        s.id === 'possessions' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('[E]'))).toBe(true);
    });
  });

  describe('timeline section', () => {
    it('renders events from event log', () => {
      const entityId = toEntityId(1);
      const ctx = createMockContext();

      // Add events to the log
      ctx.eventLog.append(createMockEvent(1, 1));
      ctx.eventLog.append(createMockEvent(2, 1));

      const expandedSections = sections.map(s =>
        s.id === 'timeline' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, ctx, expandedSections, 'overview');

      expect(lines.some(l => l.includes('Event'))).toBe(true);
    });

    it('shows no events message when empty', () => {
      const entityId = toEntityId(1);
      const expandedSections = sections.map(s =>
        s.id === 'timeline' ? { ...s, collapsed: false } : s
      );

      const lines = inspector.render(entityId, context, expandedSections, 'overview');

      expect(lines.some(l => l.includes('No events recorded'))).toBe(true);
    });
  });
});
