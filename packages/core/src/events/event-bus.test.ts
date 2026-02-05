import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from './event-bus.js';
import { EventCategory } from './types.js';
import type { WorldEvent } from './types.js';
import { createSimpleEvent, resetEventIdCounter } from './event-factory.js';
import { toEntityId } from '../ecs/types.js';

function createTestEvent(
  category: EventCategory,
  subtype: string,
  significance = 50
): WorldEvent {
  return createSimpleEvent(category, subtype, [toEntityId(1)], significance);
}

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    resetEventIdCounter();
  });

  describe('on (category subscription)', () => {
    it('should call handler when event of matching category is emitted', () => {
      const handler = vi.fn();
      bus.on(EventCategory.Military, handler);

      const event = createTestEvent(EventCategory.Military, 'battle.started');
      bus.emit(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not call handler for different category', () => {
      const handler = vi.fn();
      bus.on(EventCategory.Military, handler);

      const event = createTestEvent(EventCategory.Political, 'treaty.signed');
      bus.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should call multiple handlers for same category', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on(EventCategory.Cultural, handler1);
      bus.on(EventCategory.Cultural, handler2);

      const event = createTestEvent(EventCategory.Cultural, 'festival.started');
      bus.emit(event);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('should return unsubscribe function that works', () => {
      const handler = vi.fn();
      const unsubscribe = bus.on(EventCategory.Economic, handler);

      const event1 = createTestEvent(EventCategory.Economic, 'trade.completed');
      bus.emit(event1);
      expect(handler).toHaveBeenCalledOnce();

      unsubscribe();

      const event2 = createTestEvent(EventCategory.Economic, 'market.crashed');
      bus.emit(event2);
      expect(handler).toHaveBeenCalledOnce(); // Still just once
    });
  });

  describe('onSubtype (subtype subscription)', () => {
    it('should call handler when event of matching subtype is emitted', () => {
      const handler = vi.fn();
      bus.onSubtype('character.death', handler);

      const event = createTestEvent(EventCategory.Personal, 'character.death');
      bus.emit(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not call handler for different subtype', () => {
      const handler = vi.fn();
      bus.onSubtype('character.death', handler);

      const event = createTestEvent(EventCategory.Personal, 'character.birth');
      bus.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function that works', () => {
      const handler = vi.fn();
      const unsubscribe = bus.onSubtype('battle.resolved', handler);

      const event1 = createTestEvent(EventCategory.Military, 'battle.resolved');
      bus.emit(event1);
      expect(handler).toHaveBeenCalledOnce();

      unsubscribe();

      const event2 = createTestEvent(EventCategory.Military, 'battle.resolved');
      bus.emit(event2);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('onAny (catch-all subscription)', () => {
    it('should call handler for any event', () => {
      const handler = vi.fn();
      bus.onAny(handler);

      bus.emit(createTestEvent(EventCategory.Military, 'battle.started'));
      bus.emit(createTestEvent(EventCategory.Political, 'treaty.signed'));
      bus.emit(createTestEvent(EventCategory.Magical, 'spell.cast'));

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should return unsubscribe function that works', () => {
      const handler = vi.fn();
      const unsubscribe = bus.onAny(handler);

      bus.emit(createTestEvent(EventCategory.Disaster, 'earthquake.occurred'));
      expect(handler).toHaveBeenCalledOnce();

      unsubscribe();

      bus.emit(createTestEvent(EventCategory.Disaster, 'flood.occurred'));
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('emit order', () => {
    it('should call handlers in order: subtype → category → any', () => {
      const callOrder: string[] = [];

      bus.onSubtype('test.event', () => callOrder.push('subtype'));
      bus.on(EventCategory.Personal, () => callOrder.push('category'));
      bus.onAny(() => callOrder.push('any'));

      bus.emit(createTestEvent(EventCategory.Personal, 'test.event'));

      expect(callOrder).toEqual(['subtype', 'category', 'any']);
    });
  });

  describe('handler counts', () => {
    it('should track category handler count', () => {
      expect(bus.categoryHandlerCount(EventCategory.Military)).toBe(0);

      const unsub1 = bus.on(EventCategory.Military, () => {});
      expect(bus.categoryHandlerCount(EventCategory.Military)).toBe(1);

      bus.on(EventCategory.Military, () => {});
      expect(bus.categoryHandlerCount(EventCategory.Military)).toBe(2);

      unsub1();
      expect(bus.categoryHandlerCount(EventCategory.Military)).toBe(1);
    });

    it('should track subtype handler count', () => {
      expect(bus.subtypeHandlerCount('battle.started')).toBe(0);

      bus.onSubtype('battle.started', () => {});
      expect(bus.subtypeHandlerCount('battle.started')).toBe(1);
    });

    it('should track any handler count', () => {
      expect(bus.anyHandlerCount()).toBe(0);

      bus.onAny(() => {});
      bus.onAny(() => {});
      expect(bus.anyHandlerCount()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all handlers', () => {
      bus.on(EventCategory.Military, () => {});
      bus.onSubtype('test.event', () => {});
      bus.onAny(() => {});

      bus.clear();

      expect(bus.categoryHandlerCount(EventCategory.Military)).toBe(0);
      expect(bus.subtypeHandlerCount('test.event')).toBe(0);
      expect(bus.anyHandlerCount()).toBe(0);
    });
  });
});
