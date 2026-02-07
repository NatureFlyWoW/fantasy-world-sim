import { describe, it, expect, beforeEach } from 'vitest';
import { EventRegionFilter, DEFAULT_RADIUS_BY_LOD } from './event-filter.js';
import type { SiteCoordinateLookup } from './event-filter.js';
import { EventCategory, toEntityId, toEventId, toSiteId } from '@fws/core';
import type { WorldEvent, EntityId } from '@fws/core';

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
    data: { description: `Event ${id}` },
    significance: 50,
    consequencePotential: [],
    ...overrides,
  } as WorldEvent;
}

// Create a simple site coordinate lookup
function createMockSiteLookup(): SiteCoordinateLookup {
  const sites = new Map<number, { x: number; y: number }>([
    [10, { x: 5, y: 5 }],    // Close to center
    [20, { x: 50, y: 50 }],  // Far from center
    [30, { x: 7, y: 7 }],    // Also close
  ]);

  return (siteId: EntityId) => {
    const id = siteId as unknown as number;
    return sites.get(id);
  };
}

describe('EventRegionFilter', () => {
  let filter: EventRegionFilter;

  beforeEach(() => {
    filter = new EventRegionFilter();
  });

  describe('initialization', () => {
    it('starts disabled', () => {
      expect(filter.isEnabled()).toBe(false);
    });

    it('has default configuration', () => {
      const config = filter.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.radius).toBe(DEFAULT_RADIUS_BY_LOD.full);
    });
  });

  describe('toggle', () => {
    it('enables when toggled from disabled', () => {
      filter.toggle();
      expect(filter.isEnabled()).toBe(true);
    });

    it('disables when toggled from enabled', () => {
      filter.toggle();
      filter.toggle();
      expect(filter.isEnabled()).toBe(false);
    });
  });

  describe('configuration', () => {
    it('updates center position', () => {
      filter.setCenter(10, 20);
      const config = filter.getConfig();
      expect(config.centerX).toBe(10);
      expect(config.centerY).toBe(20);
    });

    it('updates radius', () => {
      filter.setRadius(15);
      expect(filter.getConfig().radius).toBe(15);
    });

    it('enforces minimum radius of 1', () => {
      filter.setRadius(0);
      expect(filter.getConfig().radius).toBe(1);

      filter.setRadius(-5);
      expect(filter.getConfig().radius).toBe(1);
    });
  });

  describe('filterByRegion', () => {
    it('returns all events when disabled', () => {
      const events = [createMockEvent(1), createMockEvent(2)];
      const result = filter.filterByRegion(events);

      expect(result.localEvents.length).toBe(2);
      expect(result.worldEvents.length).toBe(0);
      expect(result.totalBefore).toBe(2);
    });

    it('returns all events when no site lookup is set', () => {
      filter.toggle(); // Enable
      const events = [createMockEvent(1), createMockEvent(2)];
      const result = filter.filterByRegion(events);

      expect(result.localEvents.length).toBe(2);
    });

    it('filters events by Manhattan distance when enabled', () => {
      filter.setSiteLookup(createMockSiteLookup());
      filter.toggle(); // Enable
      filter.setCenter(5, 5);
      filter.setRadius(5);

      const events = [
        createMockEvent(1, { location: toSiteId(toEntityId(10)) }), // at (5,5) - distance 0
        createMockEvent(2, { location: toSiteId(toEntityId(20)) }), // at (50,50) - distance 90
        createMockEvent(3, { location: toSiteId(toEntityId(30)) }), // at (7,7) - distance 4
      ];

      const result = filter.filterByRegion(events);

      expect(result.localEvents.length).toBe(2); // Events at sites 10 and 30
      expect(result.worldEvents.length).toBe(0); // Event at site 20 is filtered out (not a world event, just excluded)
    });

    it('puts events without location in worldEvents', () => {
      filter.setSiteLookup(createMockSiteLookup());
      filter.toggle();
      filter.setCenter(5, 5);

      const events = [
        createMockEvent(1, { location: toSiteId(toEntityId(10)) }), // Has location
        createMockEvent(2), // No location
      ];

      const result = filter.filterByRegion(events);

      expect(result.worldEvents.length).toBe(1); // The locationless event
    });

    it('puts events with unresolvable locations in worldEvents', () => {
      filter.setSiteLookup(createMockSiteLookup());
      filter.toggle();
      filter.setCenter(5, 5);

      const events = [
        createMockEvent(1, { location: toSiteId(toEntityId(999)) }), // Unknown site
      ];

      const result = filter.filterByRegion(events);

      expect(result.worldEvents.length).toBe(1);
    });
  });

  describe('getStatusText', () => {
    it('returns empty string when disabled', () => {
      expect(filter.getStatusText()).toBe('');
    });

    it('returns position info when enabled', () => {
      filter.toggle();
      filter.setCenter(10, 20);
      filter.setRadius(5);

      const text = filter.getStatusText();
      expect(text).toContain('10');
      expect(text).toContain('20');
      expect(text).toContain('5');
    });
  });

  describe('DEFAULT_RADIUS_BY_LOD', () => {
    it('has expected radius values', () => {
      expect(DEFAULT_RADIUS_BY_LOD.full).toBe(5);
      expect(DEFAULT_RADIUS_BY_LOD.reduced).toBe(10);
      expect(DEFAULT_RADIUS_BY_LOD.abstract).toBe(20);
    });
  });
});
