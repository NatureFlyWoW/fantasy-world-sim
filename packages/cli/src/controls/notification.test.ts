/**
 * Tests for NotificationManager.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationManager } from './notification.js';
import { EventBus, EventCategory, toEntityId, toEventId } from '@fws/core';
import type { WorldEvent } from '@fws/core';

/**
 * Create a test event.
 */
function createEvent(
  significance: number,
  category: EventCategory = EventCategory.Personal,
  participants: number[] = [1]
): WorldEvent {
  return {
    id: toEventId(toEntityId(100)),
    category,
    subtype: `${category.toLowerCase()}.test`,
    timestamp: 0,
    participants: participants.map(toEntityId),
    causes: [],
    consequences: [],
    data: {},
    significance,
    consequencePotential: [],
  };
}

describe('NotificationManager', () => {
  let eventBus: EventBus;
  let notificationManager: NotificationManager;

  beforeEach(() => {
    eventBus = new EventBus();
    notificationManager = new NotificationManager(eventBus);
  });

  describe('manual notifications', () => {
    it('can show a notification', () => {
      notificationManager.show('Test message', 'medium');

      const current = notificationManager.getCurrent();
      expect(current).not.toBeNull();
      expect(current?.message).toBe('Test message');
      expect(current?.priority).toBe('medium');
    });

    it('can dismiss notification', () => {
      notificationManager.show('Test message', 'low');

      notificationManager.dismiss();

      expect(notificationManager.getCurrent()).toBeNull();
    });

    it('marks notification as dismissed in history', () => {
      notificationManager.show('Test message', 'low');
      const id = notificationManager.getCurrent()?.id;

      notificationManager.dismiss();

      const history = notificationManager.getHistory();
      const entry = history.find((e) => e.id === id);
      expect(entry?.dismissed).toBe(true);
    });

    it('tracks notification history', () => {
      notificationManager.show('Message 1', 'low');
      notificationManager.show('Message 2', 'medium');
      notificationManager.show('Message 3', 'high');

      const history = notificationManager.getHistory();
      expect(history.length).toBe(3);
    });

    it('limits history size', () => {
      const manager = new NotificationManager(eventBus, { maxHistory: 5 });

      for (let i = 0; i < 10; i++) {
        manager.show(`Message ${i}`, 'low');
      }

      expect(manager.getHistory().length).toBe(5);
      manager.destroy();
    });

    it('can clear history', () => {
      notificationManager.show('Message 1', 'low');
      notificationManager.show('Message 2', 'low');

      notificationManager.clearHistory();

      expect(notificationManager.getHistory().length).toBe(0);
      expect(notificationManager.getCurrent()).toBeNull();
    });

    it('getActive returns only undismissed notifications', () => {
      notificationManager.show('Message 1', 'low');
      notificationManager.dismiss();
      notificationManager.show('Message 2', 'low');

      const active = notificationManager.getActive();
      expect(active.length).toBe(1);
      expect(active[0]?.message).toBe('Message 2');
    });
  });

  describe('significance threshold filtering', () => {
    it('triggers notification for events above threshold', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      eventBus.emit(createEvent(85)); // Above default 80

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not trigger notification for events below threshold', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      eventBus.emit(createEvent(75)); // Below default 80

      expect(callback).not.toHaveBeenCalled();
    });

    it('can update significance threshold', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      notificationManager.setSignificanceThreshold(90);

      eventBus.emit(createEvent(85)); // Below new threshold

      expect(callback).not.toHaveBeenCalled();

      eventBus.emit(createEvent(95)); // Above new threshold

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('exposes current threshold', () => {
      expect(notificationManager.significanceThreshold).toBe(80);

      notificationManager.setSignificanceThreshold(95);

      expect(notificationManager.significanceThreshold).toBe(95);
    });
  });

  describe('category filtering', () => {
    it('only triggers for events in filter when filter is set', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      notificationManager.setCategoryFilter(
        new Set([EventCategory.Military, EventCategory.Political])
      );

      // These should be filtered out (even with high significance)
      eventBus.emit(createEvent(95, EventCategory.Personal));
      eventBus.emit(createEvent(95, EventCategory.Economic));

      expect(callback).not.toHaveBeenCalled();

      // This should trigger
      eventBus.emit(createEvent(95, EventCategory.Military));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('allows all categories when filter is empty', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      notificationManager.setCategoryFilter(new Set());

      eventBus.emit(createEvent(95, EventCategory.Personal));
      eventBus.emit(createEvent(95, EventCategory.Military));

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('exposes current category filter', () => {
      const filter = new Set([EventCategory.Military]);
      notificationManager.setCategoryFilter(filter);

      expect(notificationManager.categoryFilter).toBe(filter);
    });
  });

  describe('bookmarked entity alerts', () => {
    it('triggers notification for bookmarked entity events', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      const bookmarkedEntity = toEntityId(5);
      notificationManager.setBookmarkedEntities(new Set([bookmarkedEntity]));

      // Low significance event but involves bookmarked entity
      eventBus.emit(createEvent(50, EventCategory.Personal, [5]));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0]?.[0]?.message).toContain('Bookmarked');
    });

    it('can disable bookmarked entity alerts', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      notificationManager.setBookmarkedEntityAlert(false);
      notificationManager.setBookmarkedEntities(new Set([toEntityId(5)]));

      eventBus.emit(createEvent(50, EventCategory.Personal, [5]));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('focused entity alerts', () => {
    it('triggers notification for focused entity events', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      const focusedEntity = toEntityId(10);
      notificationManager.setFocusedEntity(focusedEntity);

      // Low significance event but involves focused entity
      eventBus.emit(createEvent(50, EventCategory.Personal, [10]));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0]?.[0]?.message).toContain('Focused');
    });

    it('can disable focused entity alerts', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      notificationManager.setFocusEntityAlert(false);
      notificationManager.setFocusedEntity(toEntityId(10));

      eventBus.emit(createEvent(50, EventCategory.Personal, [10]));

      expect(callback).not.toHaveBeenCalled();
    });

    it('handles null focused entity', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      notificationManager.setFocusedEntity(null);

      eventBus.emit(createEvent(50, EventCategory.Personal, [10]));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('priority mapping', () => {
    it('assigns high priority to significance >= 95', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      eventBus.emit(createEvent(95));

      expect(callback.mock.calls[0]?.[0]?.priority).toBe('high');
    });

    it('assigns medium priority to significance 85-94', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      eventBus.emit(createEvent(90));

      expect(callback.mock.calls[0]?.[0]?.priority).toBe('medium');
    });

    it('assigns low priority to significance 80-84', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      eventBus.emit(createEvent(82));

      expect(callback.mock.calls[0]?.[0]?.priority).toBe('low');
    });
  });

  describe('display callbacks', () => {
    it('notifies on display', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      notificationManager.show('Test', 'medium');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test',
          priority: 'medium',
        })
      );
    });

    it('can unsubscribe from display callback', () => {
      const callback = vi.fn();
      const unsubscribe = notificationManager.onDisplay(callback);

      unsubscribe();

      notificationManager.show('Test', 'medium');

      expect(callback).not.toHaveBeenCalled();
    });

    it('includes event in notification entry when triggered by event', () => {
      const callback = vi.fn();
      notificationManager.onDisplay(callback);

      const event = createEvent(95);
      eventBus.emit(event);

      expect(callback.mock.calls[0]?.[0]?.event).toBe(event);
    });
  });

  describe('cleanup', () => {
    it('unsubscribes from EventBus on destroy', () => {
      expect(eventBus.anyHandlerCount()).toBe(1);

      notificationManager.destroy();

      expect(eventBus.anyHandlerCount()).toBe(0);
    });
  });
});
