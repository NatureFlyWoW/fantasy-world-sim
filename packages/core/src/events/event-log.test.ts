import { describe, it, expect, beforeEach } from 'vitest';
import { EventLog } from './event-log.js';
import { EventCategory } from './types.js';
import type { WorldEvent } from './types.js';
import { createEvent, resetEventIdCounter, linkConsequence } from './event-factory.js';
import { toEntityId } from '../ecs/types.js';
import type { EntityId } from '../ecs/types.js';

function createTestEvent(
  category: EventCategory,
  timestamp: number,
  participants: EntityId[],
  significance = 50,
  subtype = 'test.event'
): WorldEvent {
  return createEvent({
    category,
    subtype,
    timestamp,
    participants,
    significance,
  });
}

describe('EventLog', () => {
  let log: EventLog;

  beforeEach(() => {
    log = new EventLog();
    resetEventIdCounter();
  });

  describe('append and getById', () => {
    it('should store and retrieve events by id', () => {
      const event = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      log.append(event);

      const retrieved = log.getById(event.id);
      expect(retrieved).toBe(event);
    });

    it('should return undefined for non-existent id', () => {
      expect(log.getById(999 as never)).toBeUndefined();
    });

    it('should store multiple events', () => {
      const event1 = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      const event2 = createTestEvent(EventCategory.Political, 20, [toEntityId(2)]);

      log.append(event1);
      log.append(event2);

      expect(log.getById(event1.id)).toBe(event1);
      expect(log.getById(event2.id)).toBe(event2);
    });
  });

  describe('getByTimeRange', () => {
    it('should return empty array for empty log', () => {
      expect(log.getByTimeRange(0, 100)).toEqual([]);
    });

    it('should return events within time range (inclusive)', () => {
      const event1 = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      const event2 = createTestEvent(EventCategory.Military, 20, [toEntityId(1)]);
      const event3 = createTestEvent(EventCategory.Military, 30, [toEntityId(1)]);
      const event4 = createTestEvent(EventCategory.Military, 40, [toEntityId(1)]);

      log.append(event1);
      log.append(event2);
      log.append(event3);
      log.append(event4);

      const result = log.getByTimeRange(15, 35);
      expect(result).toHaveLength(2);
      expect(result).toContain(event2);
      expect(result).toContain(event3);
    });

    it('should include events at range boundaries', () => {
      const event = createTestEvent(EventCategory.Military, 20, [toEntityId(1)]);
      log.append(event);

      const result = log.getByTimeRange(20, 20);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(event);
    });

    it('should return empty array when no events in range', () => {
      const event = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      log.append(event);

      expect(log.getByTimeRange(20, 30)).toEqual([]);
    });

    it('should handle events appended out of order', () => {
      const event1 = createTestEvent(EventCategory.Military, 30, [toEntityId(1)]);
      const event2 = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      const event3 = createTestEvent(EventCategory.Military, 20, [toEntityId(1)]);

      log.append(event1);
      log.append(event2);
      log.append(event3);

      const result = log.getByTimeRange(0, 100);
      expect(result).toHaveLength(3);
      // Should be in chronological order
      expect(result[0]?.timestamp).toBe(10);
      expect(result[1]?.timestamp).toBe(20);
      expect(result[2]?.timestamp).toBe(30);
    });
  });

  describe('getByEntity', () => {
    it('should return empty array for entity with no events', () => {
      expect(log.getByEntity(toEntityId(999))).toEqual([]);
    });

    it('should return all events involving an entity', () => {
      const entity1 = toEntityId(1);
      const entity2 = toEntityId(2);

      const event1 = createTestEvent(EventCategory.Personal, 10, [entity1]);
      const event2 = createTestEvent(EventCategory.Personal, 20, [entity1, entity2]);
      const event3 = createTestEvent(EventCategory.Personal, 30, [entity2]);

      log.append(event1);
      log.append(event2);
      log.append(event3);

      const entity1Events = log.getByEntity(entity1);
      expect(entity1Events).toHaveLength(2);
      expect(entity1Events).toContain(event1);
      expect(entity1Events).toContain(event2);

      const entity2Events = log.getByEntity(entity2);
      expect(entity2Events).toHaveLength(2);
      expect(entity2Events).toContain(event2);
      expect(entity2Events).toContain(event3);
    });
  });

  describe('getByCategory', () => {
    it('should return empty array for category with no events', () => {
      expect(log.getByCategory(EventCategory.Magical)).toEqual([]);
    });

    it('should return all events of a category', () => {
      const military1 = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      const political = createTestEvent(EventCategory.Political, 20, [toEntityId(1)]);
      const military2 = createTestEvent(EventCategory.Military, 30, [toEntityId(1)]);

      log.append(military1);
      log.append(political);
      log.append(military2);

      const militaryEvents = log.getByCategory(EventCategory.Military);
      expect(militaryEvents).toHaveLength(2);
      expect(militaryEvents).toContain(military1);
      expect(militaryEvents).toContain(military2);

      const politicalEvents = log.getByCategory(EventCategory.Political);
      expect(politicalEvents).toHaveLength(1);
      expect(politicalEvents[0]).toBe(political);
    });
  });

  describe('getBySignificanceAbove', () => {
    it('should return empty array when no events above threshold', () => {
      const event = createTestEvent(EventCategory.Military, 10, [toEntityId(1)], 50);
      log.append(event);

      expect(log.getBySignificanceAbove(60)).toEqual([]);
    });

    it('should return events above threshold (exclusive)', () => {
      const low = createTestEvent(EventCategory.Military, 10, [toEntityId(1)], 30);
      const mid = createTestEvent(EventCategory.Military, 20, [toEntityId(1)], 50);
      const high = createTestEvent(EventCategory.Military, 30, [toEntityId(1)], 80);

      log.append(low);
      log.append(mid);
      log.append(high);

      const result = log.getBySignificanceAbove(50);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(high);
    });
  });

  describe('getChain (causal chain)', () => {
    it('should return empty array for event with no causes', () => {
      const event = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      log.append(event);

      expect(log.getChain(event.id)).toEqual([]);
    });

    it('should walk backward through causes', () => {
      // Create a causal chain: cause1 -> cause2 -> effect
      const cause1 = createEvent({
        category: EventCategory.Political,
        subtype: 'treaty.broken',
        timestamp: 10,
        participants: [toEntityId(1)],
        significance: 60,
      });

      const cause2 = createEvent({
        category: EventCategory.Military,
        subtype: 'war.declared',
        timestamp: 20,
        participants: [toEntityId(1)],
        significance: 80,
        causes: [cause1.id],
      });

      const effect = createEvent({
        category: EventCategory.Military,
        subtype: 'battle.started',
        timestamp: 30,
        participants: [toEntityId(1)],
        significance: 70,
        causes: [cause2.id],
      });

      log.append(cause1);
      log.append(cause2);
      log.append(effect);

      const chain = log.getChain(effect.id);
      expect(chain).toHaveLength(2);
      expect(chain).toContain(cause1);
      expect(chain).toContain(cause2);
    });

    it('should not include the starting event itself', () => {
      const cause = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      const effect = createEvent({
        category: EventCategory.Military,
        subtype: 'effect',
        timestamp: 20,
        participants: [toEntityId(1)],
        significance: 50,
        causes: [cause.id],
      });

      log.append(cause);
      log.append(effect);

      const chain = log.getChain(effect.id);
      expect(chain).not.toContain(effect);
    });
  });

  describe('getCascade (consequence cascade)', () => {
    it('should return empty array for event with no consequences', () => {
      const event = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      log.append(event);

      expect(log.getCascade(event.id)).toEqual([]);
    });

    it('should walk forward through consequences', () => {
      // Create a cascade: trigger -> consequence1 -> consequence2
      const trigger = createTestEvent(EventCategory.Political, 10, [toEntityId(1)]);
      const consequence1 = createTestEvent(EventCategory.Military, 20, [toEntityId(1)]);
      const consequence2 = createTestEvent(EventCategory.Economic, 30, [toEntityId(1)]);

      // Link consequences
      linkConsequence(trigger, consequence1);
      linkConsequence(consequence1, consequence2);

      log.append(trigger);
      log.append(consequence1);
      log.append(consequence2);

      const cascade = log.getCascade(trigger.id);
      expect(cascade).toHaveLength(2);
      expect(cascade).toContain(consequence1);
      expect(cascade).toContain(consequence2);
    });

    it('should not include the starting event itself', () => {
      const trigger = createTestEvent(EventCategory.Political, 10, [toEntityId(1)]);
      const consequence = createTestEvent(EventCategory.Military, 20, [toEntityId(1)]);

      linkConsequence(trigger, consequence);

      log.append(trigger);
      log.append(consequence);

      const cascade = log.getCascade(trigger.id);
      expect(cascade).not.toContain(trigger);
    });
  });

  describe('getCount', () => {
    it('should return 0 for empty log', () => {
      expect(log.getCount()).toBe(0);
    });

    it('should return correct count after appending', () => {
      log.append(createTestEvent(EventCategory.Military, 10, [toEntityId(1)]));
      log.append(createTestEvent(EventCategory.Military, 20, [toEntityId(1)]));
      log.append(createTestEvent(EventCategory.Military, 30, [toEntityId(1)]));

      expect(log.getCount()).toBe(3);
    });
  });

  describe('getAll', () => {
    it('should return empty array for empty log', () => {
      expect(log.getAll()).toEqual([]);
    });

    it('should return all events in chronological order', () => {
      const event1 = createTestEvent(EventCategory.Military, 30, [toEntityId(1)]);
      const event2 = createTestEvent(EventCategory.Military, 10, [toEntityId(1)]);
      const event3 = createTestEvent(EventCategory.Military, 20, [toEntityId(1)]);

      log.append(event1);
      log.append(event2);
      log.append(event3);

      const all = log.getAll();
      expect(all).toHaveLength(3);
      expect(all[0]?.timestamp).toBe(10);
      expect(all[1]?.timestamp).toBe(20);
      expect(all[2]?.timestamp).toBe(30);
    });
  });

  describe('clear', () => {
    it('should remove all events and indexes', () => {
      log.append(createTestEvent(EventCategory.Military, 10, [toEntityId(1)]));
      log.append(createTestEvent(EventCategory.Military, 20, [toEntityId(1)]));

      log.clear();

      expect(log.getCount()).toBe(0);
      expect(log.getAll()).toEqual([]);
      expect(log.getByCategory(EventCategory.Military)).toEqual([]);
      expect(log.getByEntity(toEntityId(1))).toEqual([]);
    });
  });
});
