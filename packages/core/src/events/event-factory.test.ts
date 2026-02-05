import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEvent,
  createSimpleEvent,
  createConsequenceEvent,
  linkConsequence,
  resetEventIdCounter,
} from './event-factory.js';
import { EventCategory } from './types.js';
import { toEntityId, toSiteId, toEventId } from '../ecs/types.js';

describe('Event Factory', () => {
  beforeEach(() => {
    resetEventIdCounter();
  });

  describe('createEvent', () => {
    it('should create event with auto-generated ID', () => {
      const event = createEvent({
        category: EventCategory.Military,
        subtype: 'battle.started',
        timestamp: 100,
        participants: [toEntityId(1), toEntityId(2)],
        significance: 75,
      });

      expect(event.id).toBe(0);
      expect(event.category).toBe(EventCategory.Military);
      expect(event.subtype).toBe('battle.started');
      expect(event.timestamp).toBe(100);
      expect(event.participants).toEqual([toEntityId(1), toEntityId(2)]);
      expect(event.significance).toBe(75);
    });

    it('should auto-increment IDs', () => {
      const event1 = createEvent({
        category: EventCategory.Personal,
        subtype: 'test',
        timestamp: 0,
        participants: [],
        significance: 50,
      });

      const event2 = createEvent({
        category: EventCategory.Personal,
        subtype: 'test',
        timestamp: 0,
        participants: [],
        significance: 50,
      });

      const event3 = createEvent({
        category: EventCategory.Personal,
        subtype: 'test',
        timestamp: 0,
        participants: [],
        significance: 50,
      });

      expect(event1.id).toBe(0);
      expect(event2.id).toBe(1);
      expect(event3.id).toBe(2);
    });

    it('should include optional fields when provided', () => {
      const event = createEvent({
        category: EventCategory.Political,
        subtype: 'treaty.signed',
        timestamp: 200,
        participants: [toEntityId(1)],
        significance: 80,
        location: toSiteId(toEntityId(10)),
        causes: [toEventId(toEntityId(5))],
        data: { treatyType: 'peace', terms: ['cease fire'] },
        temporalOffset: 10,
        consequencePotential: [
          {
            eventSubtype: 'faction.reputation_change',
            baseProbability: 0.8,
            category: EventCategory.Political,
            delayTicks: 1,
            dampening: 0.5,
          },
        ],
      });

      expect(event.location).toEqual(toSiteId(toEntityId(10)));
      expect(event.causes).toEqual([toEventId(toEntityId(5))]);
      expect(event.data).toEqual({ treatyType: 'peace', terms: ['cease fire'] });
      expect(event.temporalOffset).toBe(10);
      expect(event.consequencePotential).toHaveLength(1);
    });

    it('should default optional fields correctly', () => {
      const event = createEvent({
        category: EventCategory.Personal,
        subtype: 'test',
        timestamp: 0,
        participants: [toEntityId(1)],
        significance: 50,
      });

      expect(event.location).toBeUndefined();
      expect(event.causes).toEqual([]);
      expect(event.consequences).toEqual([]);
      expect(event.data).toEqual({});
      expect(event.consequencePotential).toEqual([]);
      expect(event.temporalOffset).toBeUndefined();
    });

    it('should copy arrays to prevent external mutation', () => {
      const participants = [toEntityId(1), toEntityId(2)];
      const causes = [toEventId(toEntityId(10))];

      const event = createEvent({
        category: EventCategory.Personal,
        subtype: 'test',
        timestamp: 0,
        participants,
        significance: 50,
        causes,
      });

      // Mutate originals
      participants.push(toEntityId(3));
      causes.push(toEventId(toEntityId(11)));

      // Event should be unaffected
      expect(event.participants).toHaveLength(2);
      expect(event.causes).toHaveLength(1);
    });
  });

  describe('createSimpleEvent', () => {
    it('should create event with minimal fields', () => {
      const event = createSimpleEvent(
        EventCategory.Disaster,
        'earthquake.occurred',
        [toEntityId(1)],
        90
      );

      expect(event.category).toBe(EventCategory.Disaster);
      expect(event.subtype).toBe('earthquake.occurred');
      expect(event.participants).toEqual([toEntityId(1)]);
      expect(event.significance).toBe(90);
      expect(event.timestamp).toBe(0); // Default
    });

    it('should include data when provided', () => {
      const event = createSimpleEvent(
        EventCategory.Economic,
        'trade.completed',
        [toEntityId(1), toEntityId(2)],
        40,
        { goods: 'gold', quantity: 100 }
      );

      expect(event.data).toEqual({ goods: 'gold', quantity: 100 });
    });
  });

  describe('createConsequenceEvent', () => {
    it('should create event with cause reference', () => {
      const cause = createSimpleEvent(
        EventCategory.Political,
        'treaty.broken',
        [toEntityId(1)],
        70
      );

      const consequence = createConsequenceEvent(cause, {
        category: EventCategory.Military,
        subtype: 'war.declared',
        timestamp: 10,
        participants: [toEntityId(1), toEntityId(2)],
        significance: 90,
      });

      expect(consequence.causes).toEqual([cause.id]);
    });

    it('should preserve other options', () => {
      const cause = createSimpleEvent(EventCategory.Political, 'cause', [toEntityId(1)], 50);

      const consequence = createConsequenceEvent(cause, {
        category: EventCategory.Economic,
        subtype: 'market.crashed',
        timestamp: 20,
        participants: [toEntityId(3)],
        significance: 85,
        data: { loss: 1000000 },
        location: toSiteId(toEntityId(5)),
      });

      expect(consequence.category).toBe(EventCategory.Economic);
      expect(consequence.data).toEqual({ loss: 1000000 });
      expect(consequence.location).toEqual(toSiteId(toEntityId(5)));
    });
  });

  describe('linkConsequence', () => {
    it('should add consequence to cause event', () => {
      const cause = createSimpleEvent(EventCategory.Political, 'cause', [toEntityId(1)], 50);
      const consequence = createSimpleEvent(
        EventCategory.Military,
        'consequence',
        [toEntityId(1)],
        60
      );

      expect(cause.consequences).toEqual([]);

      linkConsequence(cause, consequence);

      expect(cause.consequences).toEqual([consequence.id]);
    });

    it('should allow multiple consequences', () => {
      const cause = createSimpleEvent(EventCategory.Political, 'cause', [toEntityId(1)], 50);
      const consequence1 = createSimpleEvent(
        EventCategory.Military,
        'consequence1',
        [toEntityId(1)],
        60
      );
      const consequence2 = createSimpleEvent(
        EventCategory.Economic,
        'consequence2',
        [toEntityId(1)],
        55
      );

      linkConsequence(cause, consequence1);
      linkConsequence(cause, consequence2);

      expect(cause.consequences).toHaveLength(2);
      expect(cause.consequences).toContain(consequence1.id);
      expect(cause.consequences).toContain(consequence2.id);
    });
  });

  describe('resetEventIdCounter', () => {
    it('should reset ID counter', () => {
      createSimpleEvent(EventCategory.Personal, 'test', [], 50);
      createSimpleEvent(EventCategory.Personal, 'test', [], 50);

      resetEventIdCounter();

      const event = createSimpleEvent(EventCategory.Personal, 'test', [], 50);
      expect(event.id).toBe(0);
    });
  });
});
