/**
 * Tests for BookmarkManager.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookmarkManager } from './bookmarks.js';
import { EventBus, EventCategory, toEntityId, toEventId } from '@fws/core';
import type { WorldEvent, WorldTime } from '@fws/core';

/**
 * Create a test event.
 */
function createEvent(
  participants: number[],
  causes: number[] = []
): WorldEvent {
  return {
    id: toEventId(toEntityId(100)),
    category: EventCategory.Personal,
    subtype: 'test.event',
    timestamp: 0,
    participants: participants.map(toEntityId),
    causes: causes.map((id) => toEventId(toEntityId(id))),
    consequences: [],
    data: {},
    significance: 50,
    consequencePotential: [],
  };
}

describe('BookmarkManager', () => {
  let eventBus: EventBus;
  let bookmarkManager: BookmarkManager;
  let currentTime: WorldTime;

  beforeEach(() => {
    eventBus = new EventBus();
    currentTime = { year: 1, month: 1, day: 1 };
    bookmarkManager = new BookmarkManager(eventBus, () => currentTime);
  });

  describe('adding bookmarks', () => {
    it('can add entity bookmark', () => {
      const entityId = toEntityId(1);
      bookmarkManager.add(entityId, 'entity', 'Test Entity');

      expect(bookmarkManager.isBookmarked(entityId)).toBe(true);
      expect(bookmarkManager.count).toBe(1);
    });

    it('can add event bookmark', () => {
      const eventId = toEventId(toEntityId(1));
      bookmarkManager.add(eventId, 'event', 'Test Event');

      expect(bookmarkManager.isBookmarked(eventId)).toBe(true);
      expect(bookmarkManager.count).toBe(1);
    });

    it('records timestamp when bookmark is added', () => {
      currentTime = { year: 5, month: 3, day: 15 };
      const entityId = toEntityId(1);

      bookmarkManager.add(entityId, 'entity');

      const bookmark = bookmarkManager.get(entityId);
      expect(bookmark?.addedAt).toEqual({ year: 5, month: 3, day: 15 });
    });

    it('does not add duplicate bookmarks', () => {
      const entityId = toEntityId(1);

      bookmarkManager.add(entityId, 'entity', 'First');
      bookmarkManager.add(entityId, 'entity', 'Second');

      expect(bookmarkManager.count).toBe(1);
      expect(bookmarkManager.get(entityId)?.label).toBe('First');
    });
  });

  describe('removing bookmarks', () => {
    it('can remove bookmark', () => {
      const entityId = toEntityId(1);
      bookmarkManager.add(entityId, 'entity');

      bookmarkManager.remove(entityId);

      expect(bookmarkManager.isBookmarked(entityId)).toBe(false);
      expect(bookmarkManager.count).toBe(0);
    });

    it('handles removing non-existent bookmark', () => {
      const entityId = toEntityId(999);

      // Should not throw
      bookmarkManager.remove(entityId);

      expect(bookmarkManager.count).toBe(0);
    });
  });

  describe('toggle', () => {
    it('adds bookmark if not present', () => {
      const entityId = toEntityId(1);

      bookmarkManager.toggle(entityId, 'entity', 'Test');

      expect(bookmarkManager.isBookmarked(entityId)).toBe(true);
    });

    it('removes bookmark if present', () => {
      const entityId = toEntityId(1);
      bookmarkManager.add(entityId, 'entity');

      bookmarkManager.toggle(entityId, 'entity');

      expect(bookmarkManager.isBookmarked(entityId)).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns all bookmarks', () => {
      bookmarkManager.add(toEntityId(1), 'entity', 'Entity 1');
      bookmarkManager.add(toEntityId(2), 'entity', 'Entity 2');
      bookmarkManager.add(toEventId(toEntityId(3)), 'event', 'Event 1');

      const all = bookmarkManager.getAll();

      expect(all.length).toBe(3);
    });

    it('returns empty array when no bookmarks', () => {
      expect(bookmarkManager.getAll()).toEqual([]);
    });
  });

  describe('filtered getters', () => {
    beforeEach(() => {
      bookmarkManager.add(toEntityId(1), 'entity', 'Entity 1');
      bookmarkManager.add(toEntityId(2), 'entity', 'Entity 2');
      bookmarkManager.add(toEventId(toEntityId(3)), 'event', 'Event 1');
    });

    it('getEntityBookmarks returns only entity bookmarks', () => {
      const entities = bookmarkManager.getEntityBookmarks();

      expect(entities.length).toBe(2);
      expect(entities.every((b) => b.type === 'entity')).toBe(true);
    });

    it('getEventBookmarks returns only event bookmarks', () => {
      const events = bookmarkManager.getEventBookmarks();

      expect(events.length).toBe(1);
      expect(events.every((b) => b.type === 'event')).toBe(true);
    });
  });

  describe('label management', () => {
    it('can set label on existing bookmark', () => {
      const entityId = toEntityId(1);
      bookmarkManager.add(entityId, 'entity', 'Original');

      bookmarkManager.setLabel(entityId, 'Updated');

      expect(bookmarkManager.get(entityId)?.label).toBe('Updated');
    });

    it('handles setLabel on non-existent bookmark', () => {
      // Should not throw
      bookmarkManager.setLabel(toEntityId(999), 'Test');

      expect(bookmarkManager.count).toBe(0);
    });
  });

  describe('clear', () => {
    it('removes all bookmarks', () => {
      bookmarkManager.add(toEntityId(1), 'entity');
      bookmarkManager.add(toEntityId(2), 'entity');
      bookmarkManager.add(toEventId(toEntityId(3)), 'event');

      bookmarkManager.clear();

      expect(bookmarkManager.count).toBe(0);
    });
  });

  describe('checkAlerts', () => {
    it('returns alert when bookmarked entity is in event participants', () => {
      const entityId = toEntityId(1);
      bookmarkManager.add(entityId, 'entity', 'Test Entity');

      const event = createEvent([1, 2, 3]);
      const alert = bookmarkManager.checkAlerts(event);

      expect(alert).not.toBeNull();
      expect(alert?.bookmark.id).toBe(entityId);
      expect(alert?.event).toBe(event);
      expect(alert?.message).toContain('Test Entity');
    });

    it('returns alert when event is consequence of bookmarked event', () => {
      const bookmarkedEventId = toEventId(toEntityId(50));
      bookmarkManager.add(bookmarkedEventId, 'event', 'Bookmarked Event');

      const consequenceEvent = createEvent([1], [50]);
      const alert = bookmarkManager.checkAlerts(consequenceEvent);

      expect(alert).not.toBeNull();
      expect(alert?.bookmark.id).toBe(bookmarkedEventId);
      expect(alert?.message).toContain('Consequence');
    });

    it('returns null when no bookmarked entities involved', () => {
      bookmarkManager.add(toEntityId(1), 'entity');

      const event = createEvent([5, 6, 7]); // Different entities
      const alert = bookmarkManager.checkAlerts(event);

      expect(alert).toBeNull();
    });

    it('uses entity ID as label when no label set', () => {
      const entityId = toEntityId(42);
      bookmarkManager.add(entityId, 'entity'); // No label

      const event = createEvent([42]);
      const alert = bookmarkManager.checkAlerts(event);

      expect(alert?.message).toContain('Entity #42');
    });
  });

  describe('automatic alerts via EventBus', () => {
    it('fires alert callback when bookmarked entity appears in event', () => {
      const callback = vi.fn();
      bookmarkManager.onAlert(callback);

      const entityId = toEntityId(1);
      bookmarkManager.add(entityId, 'entity', 'Hero');

      const event = createEvent([1]);
      eventBus.emit(event);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0]?.[0]?.bookmark.id).toBe(entityId);
    });

    it('does not fire alert for non-bookmarked entities', () => {
      const callback = vi.fn();
      bookmarkManager.onAlert(callback);

      bookmarkManager.add(toEntityId(1), 'entity');

      const event = createEvent([99]); // Different entity
      eventBus.emit(event);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('change callbacks', () => {
    it('fires callback on add', () => {
      const callback = vi.fn();
      bookmarkManager.onChange(callback);

      const entityId = toEntityId(1);
      bookmarkManager.add(entityId, 'entity', 'Test');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ id: entityId, type: 'entity' }),
        'add'
      );
    });

    it('fires callback on remove', () => {
      const callback = vi.fn();
      bookmarkManager.onChange(callback);

      const entityId = toEntityId(1);
      bookmarkManager.add(entityId, 'entity');
      callback.mockClear();

      bookmarkManager.remove(entityId);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ id: entityId }),
        'remove'
      );
    });

    it('fires callbacks for each bookmark on clear', () => {
      const callback = vi.fn();
      bookmarkManager.onChange(callback);

      bookmarkManager.add(toEntityId(1), 'entity');
      bookmarkManager.add(toEntityId(2), 'entity');
      callback.mockClear();

      bookmarkManager.clear();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(expect.anything(), 'remove');
    });

    it('can unsubscribe from change callback', () => {
      const callback = vi.fn();
      const unsubscribe = bookmarkManager.onChange(callback);

      unsubscribe();

      bookmarkManager.add(toEntityId(1), 'entity');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('unsubscribes from EventBus on destroy', () => {
      expect(eventBus.anyHandlerCount()).toBe(1);

      bookmarkManager.destroy();

      expect(eventBus.anyHandlerCount()).toBe(0);
    });
  });
});
