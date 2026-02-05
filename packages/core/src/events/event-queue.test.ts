import { describe, it, expect, beforeEach } from 'vitest';
import { EventQueue } from './event-queue.js';
import { EventCategory } from './types.js';
import { createSimpleEvent, resetEventIdCounter } from './event-factory.js';
import { toEntityId } from '../ecs/types.js';
import type { WorldEvent } from './types.js';

function createTestEvent(significance: number, subtype = 'test.event'): WorldEvent {
  return createSimpleEvent(EventCategory.Personal, subtype, [toEntityId(1)], significance);
}

describe('EventQueue', () => {
  let queue: EventQueue;

  beforeEach(() => {
    queue = new EventQueue();
    resetEventIdCounter();
  });

  describe('enqueue/dequeue', () => {
    it('should enqueue and dequeue a single event', () => {
      const event = createTestEvent(50);
      queue.enqueue(event);

      const dequeued = queue.dequeue();
      expect(dequeued).toBe(event);
    });

    it('should return undefined when dequeuing from empty queue', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should dequeue highest significance first', () => {
      const lowEvent = createTestEvent(10, 'low');
      const highEvent = createTestEvent(90, 'high');
      const midEvent = createTestEvent(50, 'mid');

      queue.enqueue(lowEvent);
      queue.enqueue(highEvent);
      queue.enqueue(midEvent);

      expect(queue.dequeue()).toBe(highEvent);
      expect(queue.dequeue()).toBe(midEvent);
      expect(queue.dequeue()).toBe(lowEvent);
    });

    it('should handle many events correctly', () => {
      const events: WorldEvent[] = [];
      const significances = [30, 90, 10, 60, 40, 80, 20, 70, 50, 100];

      for (const sig of significances) {
        const event = createTestEvent(sig);
        events.push(event);
        queue.enqueue(event);
      }

      // Verify dequeue order is by significance descending
      const dequeued: number[] = [];
      while (!queue.isEmpty()) {
        const event = queue.dequeue();
        if (event !== undefined) {
          dequeued.push(event.significance);
        }
      }

      expect(dequeued).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    });

    it('should handle events with same significance', () => {
      const event1 = createTestEvent(50, 'first');
      const event2 = createTestEvent(50, 'second');
      const event3 = createTestEvent(50, 'third');

      queue.enqueue(event1);
      queue.enqueue(event2);
      queue.enqueue(event3);

      // All three should be dequeued
      expect(queue.dequeue()).toBeDefined();
      expect(queue.dequeue()).toBeDefined();
      expect(queue.dequeue()).toBeDefined();
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe('peek', () => {
    it('should return undefined for empty queue', () => {
      expect(queue.peek()).toBeUndefined();
    });

    it('should return highest significance event without removing', () => {
      const lowEvent = createTestEvent(10);
      const highEvent = createTestEvent(90);

      queue.enqueue(lowEvent);
      queue.enqueue(highEvent);

      expect(queue.peek()).toBe(highEvent);
      expect(queue.peek()).toBe(highEvent); // Still there
      expect(queue.size()).toBe(2);
    });
  });

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.size()).toBe(0);
    });

    it('should return correct count after enqueue', () => {
      queue.enqueue(createTestEvent(50));
      queue.enqueue(createTestEvent(60));
      queue.enqueue(createTestEvent(70));

      expect(queue.size()).toBe(3);
    });

    it('should decrease after dequeue', () => {
      queue.enqueue(createTestEvent(50));
      queue.enqueue(createTestEvent(60));

      queue.dequeue();
      expect(queue.size()).toBe(1);

      queue.dequeue();
      expect(queue.size()).toBe(0);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false when queue has events', () => {
      queue.enqueue(createTestEvent(50));
      expect(queue.isEmpty()).toBe(false);
    });

    it('should return true after all events dequeued', () => {
      queue.enqueue(createTestEvent(50));
      queue.dequeue();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('drain', () => {
    it('should return empty array for empty queue', () => {
      expect(queue.drain()).toEqual([]);
    });

    it('should return all events in significance order', () => {
      const lowEvent = createTestEvent(10, 'low');
      const highEvent = createTestEvent(90, 'high');
      const midEvent = createTestEvent(50, 'mid');

      queue.enqueue(lowEvent);
      queue.enqueue(highEvent);
      queue.enqueue(midEvent);

      const drained = queue.drain();

      expect(drained).toHaveLength(3);
      expect(drained[0]).toBe(highEvent);
      expect(drained[1]).toBe(midEvent);
      expect(drained[2]).toBe(lowEvent);
    });

    it('should leave queue empty after drain', () => {
      queue.enqueue(createTestEvent(50));
      queue.enqueue(createTestEvent(60));

      queue.drain();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all events', () => {
      queue.enqueue(createTestEvent(50));
      queue.enqueue(createTestEvent(60));
      queue.enqueue(createTestEvent(70));

      queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe('stress test', () => {
    it('should maintain heap property with random insertions', () => {
      const events: WorldEvent[] = [];

      // Insert 100 events with random significance
      for (let i = 0; i < 100; i++) {
        const sig = Math.floor(Math.random() * 100);
        const event = createTestEvent(sig);
        events.push(event);
        queue.enqueue(event);
      }

      // Dequeue all and verify decreasing order
      let lastSig = Infinity;
      while (!queue.isEmpty()) {
        const event = queue.dequeue();
        if (event !== undefined) {
          expect(event.significance).toBeLessThanOrEqual(lastSig);
          lastSig = event.significance;
        }
      }
    });
  });
});
