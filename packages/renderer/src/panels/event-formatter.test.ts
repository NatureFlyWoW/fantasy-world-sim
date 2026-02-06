import { describe, it, expect, beforeEach } from 'vitest';
import { EventFormatter, CATEGORY_ICONS, defaultFormatter, ENTITY_NAME_COLOR } from './event-formatter.js';
import { EventCategory, toEntityId, toSiteId } from '@fws/core';
import type { WorldEvent, World, WorldClock, EntityId } from '@fws/core';
import type { EntityResolver } from '@fws/narrative';

// Mock WorldClock
const mockClock = {
  currentTick: 0,
  currentTime: { year: 1, month: 1, day: 1 },
} as WorldClock;

// Helper to create mock events
function createMockEvent(overrides: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: toEntityId(1) as unknown as WorldEvent['id'],
    category: EventCategory.Political,
    subtype: 'faction.treaty_signed',
    timestamp: 0,
    participants: [],
    causes: [],
    consequences: [],
    data: {},
    significance: 50,
    consequencePotential: [],
    ...overrides,
  } as WorldEvent;
}

// Mock World
function createMockWorld(): World {
  return {
    hasStore: () => false,
    getComponent: () => undefined,
  } as unknown as World;
}

// Mock EntityResolver
function createMockResolver(): EntityResolver {
  return {
    resolveCharacter: (id: number) => {
      if (id === 1) return { name: 'Aldric' };
      if (id === 2) return { name: 'Mira' };
      return undefined;
    },
    resolveFaction: (id: number) => {
      if (id === 3) return { name: 'Ironhaven' };
      if (id === 4) return { name: 'Jade Covenant' };
      return undefined;
    },
    resolveSite: (id: number) => {
      if (id === 10) return { name: 'Ashenmoor' };
      return undefined;
    },
    resolveArtifact: (id: number) => {
      if (id === 20) return { name: 'Starfire Blade' };
      return undefined;
    },
    resolveDeity: () => undefined,
  };
}

describe('EventFormatter', () => {
  let formatter: EventFormatter;

  beforeEach(() => {
    formatter = new EventFormatter();
  });

  describe('formatRaw', () => {
    it('produces Year, Day format with category icon', () => {
      const event = createMockEvent({
        timestamp: 0, // Year 1, Day 1
        category: EventCategory.Military,
        subtype: 'battle.resolved',
      });

      const result = formatter.formatRaw(event, mockClock);

      expect(result).toContain('Year 1');
      expect(result).toContain('Day 1');
      expect(result).toContain(CATEGORY_ICONS[EventCategory.Military]);
    });

    it('handles later dates correctly', () => {
      // 360 days per year, 30 days per month
      // Timestamp 411 = 360 (year 1) + 51 days into year 2
      // 51 days = 1 month (30 days) + 21 days remaining
      // So: Year 2, Month 2, Day 22 (day = remainder + 1 = 21 + 1)
      const event = createMockEvent({
        timestamp: 360 + 30 + 21, // Year 2, Month 2, Day 22
        category: EventCategory.Cultural,
      });

      const result = formatter.formatRaw(event, mockClock);

      expect(result).toContain('Year 2');
      expect(result).toContain('Day 22');
    });

    it('includes all category icons', () => {
      for (const category of Object.values(EventCategory)) {
        const event = createMockEvent({ category });
        const result = formatter.formatRaw(event, mockClock);
        expect(result).toContain(CATEGORY_ICONS[category]);
      }
    });

    it('uses description from event data when available', () => {
      const event = createMockEvent({
        data: { description: 'The kingdom fell into chaos' },
      });

      const result = formatter.formatRaw(event, mockClock);

      expect(result).toContain('The kingdom fell into chaos');
    });

    it('builds description from subtype when no description', () => {
      const event = createMockEvent({
        subtype: 'faction.alliance_formed',
      });

      const result = formatter.formatRaw(event, mockClock);

      expect(result).toContain('Faction');
      expect(result).toContain('alliance formed');
    });
  });

  describe('formatRawColored', () => {
    it('includes blessed color codes', () => {
      const event = createMockEvent({
        category: EventCategory.Military,
      });

      const result = formatter.formatRawColored(event, mockClock);

      expect(result).toMatch(/\{#[0-9a-fA-F]+-fg\}/);
      expect(result).toContain('{/}');
    });
  });

  describe('formatSignificanceBar', () => {
    it('renders empty bar for significance 0', () => {
      const result = formatter.formatSignificanceBar(0);

      expect(result).toContain('░░░░░░░░░░');
      expect(result).toContain(' 0');
    });

    it('renders half-filled bar for significance 50', () => {
      const result = formatter.formatSignificanceBar(50);

      expect(result).toContain('█████');
      expect(result).toContain('░░░░░');
      expect(result).toContain(' 50');
    });

    it('renders full bar for significance 100', () => {
      const result = formatter.formatSignificanceBar(100);

      expect(result).toContain('██████████');
      expect(result).toContain(' 100');
      expect(result).not.toContain('░');
    });

    it('clamps significance above 100', () => {
      const result = formatter.formatSignificanceBar(150);

      expect(result).toContain('██████████');
      expect(result).toContain(' 100');
    });

    it('clamps significance below 0', () => {
      const result = formatter.formatSignificanceBar(-50);

      expect(result).toContain('░░░░░░░░░░');
      expect(result).toContain(' 0');
    });

    it('rounds to nearest block', () => {
      const result = formatter.formatSignificanceBar(25);

      // 25% of 10 = 2.5, rounds to 3 filled blocks
      expect(result.match(/█/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(result.match(/█/g)?.length ?? 0).toBeLessThanOrEqual(3);
    });
  });

  describe('formatSignificanceBarColored', () => {
    it('includes color codes', () => {
      const result = formatter.formatSignificanceBarColored(50);

      expect(result).toMatch(/\{#[0-9a-fA-F]+-fg\}/);
    });

    it('uses significance color for filled portion', () => {
      const lowResult = formatter.formatSignificanceBarColored(10);
      const highResult = formatter.formatSignificanceBarColored(95);

      // Different significance levels should have different colors
      expect(lowResult).not.toEqual(highResult);
    });
  });

  describe('formatParticipants', () => {
    it('returns "No participants" for empty array', () => {
      const event = createMockEvent({ participants: [] });
      const world = createMockWorld();

      const result = formatter.formatParticipants(event, world);

      expect(result).toBe('No participants');
    });

    it('returns single entity name', () => {
      const event = createMockEvent({ participants: [toEntityId(1)] });
      const world = createMockWorld();

      const result = formatter.formatParticipants(event, world);

      expect(result).toBe('Entity #1');
    });

    it('joins two entities with "and"', () => {
      const event = createMockEvent({ participants: [toEntityId(1), toEntityId(2)] });
      const world = createMockWorld();

      const result = formatter.formatParticipants(event, world);

      expect(result).toBe('Entity #1 and Entity #2');
    });

    it('uses Oxford comma for three or more', () => {
      const event = createMockEvent({ participants: [toEntityId(1), toEntityId(2), toEntityId(3)] });
      const world = createMockWorld();

      const result = formatter.formatParticipants(event, world);

      expect(result).toBe('Entity #1, Entity #2, and Entity #3');
    });

    it('resolves entity names from Status component', () => {
      const event = createMockEvent({ participants: [toEntityId(1)] });
      const world = {
        hasStore: (type: string) => type === 'Status',
        getComponent: (entityId: EntityId, type: string) => {
          if (type === 'Status' && entityId === 1) {
            return { titles: ['King Aldric'] };
          }
          return undefined;
        },
      } as unknown as World;

      const result = formatter.formatParticipants(event, world);

      expect(result).toBe('King Aldric');
    });
  });

  describe('formatLocation', () => {
    it('returns null for events without location', () => {
      const event = createMockEvent({});
      // No location property set
      const world = createMockWorld();

      const result = formatter.formatLocation(event, world);

      expect(result).toBeNull();
    });

    it('returns "at [location]" for events with location', () => {
      const event = createMockEvent({ location: toSiteId(toEntityId(42)) });
      const world = createMockWorld();

      const result = formatter.formatLocation(event, world);

      expect(result).toBe('at Entity #42');
    });
  });

  describe('getEventDescription', () => {
    it('uses description from event data', () => {
      const event = createMockEvent({
        data: { description: 'A great battle occurred' },
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('A great battle occurred');
    });

    it('builds from subtype when no description', () => {
      const event = createMockEvent({
        subtype: 'military.battle_resolved',
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('Military: battle resolved');
    });

    it('replaces underscores with spaces', () => {
      const event = createMockEvent({
        subtype: 'character.became_ruler',
      });

      const result = formatter.getEventDescription(event);

      expect(result).toContain('became ruler');
    });

    it('capitalizes domain name', () => {
      const event = createMockEvent({
        subtype: 'faction.treaty_signed',
      });

      const result = formatter.getEventDescription(event);

      expect(result).toMatch(/^Faction:/);
    });
  });

  describe('getCategoryColor', () => {
    it('returns color for all categories', () => {
      for (const category of Object.values(EventCategory)) {
        const event = createMockEvent({ category });
        const color = formatter.getCategoryColor(event);

        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('getSignificanceColor', () => {
    it('returns different colors for different significance levels', () => {
      const lowEvent = createMockEvent({ significance: 10 });
      const highEvent = createMockEvent({ significance: 95 });

      const lowColor = formatter.getSignificanceColor(lowEvent);
      const highColor = formatter.getSignificanceColor(highEvent);

      expect(lowColor).not.toBe(highColor);
    });
  });

  describe('CATEGORY_ICONS', () => {
    it('has icons for all categories', () => {
      for (const category of Object.values(EventCategory)) {
        expect(CATEGORY_ICONS[category]).toBeDefined();
        expect(CATEGORY_ICONS[category].length).toBeGreaterThan(0);
      }
    });
  });

  describe('defaultFormatter', () => {
    it('is an EventFormatter instance', () => {
      expect(defaultFormatter).toBeInstanceOf(EventFormatter);
    });
  });

  describe('EntityResolver integration', () => {
    it('sets and gets entity resolver', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      expect(formatter.getEntityResolver()).toBe(resolver);
    });

    it('resolves character name when resolver is set', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const result = formatter.resolveEntityIdToName(1);

      expect(result).toBe('Aldric');
    });

    it('resolves faction name when resolver is set', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const result = formatter.resolveEntityIdToName(3);

      expect(result).toBe('Ironhaven');
    });

    it('resolves site name when resolver is set', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const result = formatter.resolveEntityIdToName(10);

      expect(result).toBe('Ashenmoor');
    });

    it('resolves artifact name when resolver is set', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const result = formatter.resolveEntityIdToName(20);

      expect(result).toBe('Starfire Blade');
    });

    it('returns null when no resolver is set', () => {
      const result = formatter.resolveEntityIdToName(1);

      expect(result).toBeNull();
    });

    it('returns null when resolver does not find entity', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const result = formatter.resolveEntityIdToName(999);

      expect(result).toBeNull();
    });
  });

  describe('verb pattern descriptions', () => {
    it('formats character.befriend with two participants using names', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const event = createMockEvent({
        subtype: 'character.befriend',
        participants: [toEntityId(1), toEntityId(2)],
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('Aldric befriended Mira');
    });

    it('formats character.befriend with single participant', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const event = createMockEvent({
        subtype: 'character.befriend',
        participants: [toEntityId(1)],
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('Aldric befriended');
    });

    it('formats faction.war_declared with two participants', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const event = createMockEvent({
        subtype: 'faction.war_declared',
        participants: [toEntityId(3), toEntityId(4)],
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('Ironhaven declared war on Jade Covenant');
    });

    it('falls back to domain:action for unknown subtype', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const event = createMockEvent({
        subtype: 'unknown.test_action',
        participants: [toEntityId(1), toEntityId(2)],
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('Unknown: test action');
    });

    it('falls back to domain:action when no resolver is set', () => {
      const event = createMockEvent({
        subtype: 'character.befriend',
        participants: [toEntityId(1), toEntityId(2)],
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('Character: befriend');
    });
  });

  describe('enhanced descriptions', () => {
    it('prepends participant name when resolver is set and has description', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const event = createMockEvent({
        subtype: 'character.action',
        participants: [toEntityId(1)],
        data: { description: 'The kingdom fell into chaos' },
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('Aldric: The kingdom fell into chaos');
    });

    it('returns raw description when no resolver is set', () => {
      const event = createMockEvent({
        subtype: 'character.action',
        participants: [toEntityId(1)],
        data: { description: 'The kingdom fell into chaos' },
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('The kingdom fell into chaos');
    });

    it('does not duplicate name if description already starts with it', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const event = createMockEvent({
        subtype: 'character.action',
        participants: [toEntityId(1)],
        data: { description: 'Aldric conquered the realm' },
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('Aldric conquered the realm');
      expect(result.match(/Aldric/g)?.length).toBe(1);
    });

    it('returns description without participant name when no participants', () => {
      const resolver = createMockResolver();
      formatter.setEntityResolver(resolver);

      const event = createMockEvent({
        subtype: 'faction.action',
        participants: [],
        data: { description: 'The treaty was signed' },
      });

      const result = formatter.getEventDescription(event);

      expect(result).toBe('The treaty was signed');
    });
  });

  describe('ENTITY_NAME_COLOR', () => {
    it('is #88AAFF', () => {
      expect(ENTITY_NAME_COLOR).toBe('#88AAFF');
    });
  });
});
