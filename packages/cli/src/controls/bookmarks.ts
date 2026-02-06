/**
 * BookmarkManager manages entity and event bookmarks.
 * Provides alerts when bookmarked entities are involved in events.
 */

import type {
  EntityId,
  EventId,
  EventBus,
  WorldEvent,
  Unsubscribe,
  WorldTime,
} from '@fws/core';

/**
 * Bookmark type discriminator.
 */
export type BookmarkType = 'entity' | 'event';

/**
 * Bookmark entry.
 */
export interface Bookmark {
  readonly type: BookmarkType;
  readonly id: EntityId | EventId;
  readonly label?: string;
  readonly addedAt: WorldTime;
}

/**
 * Alert generated when a bookmarked entity is involved in an event.
 */
export interface BookmarkAlert {
  readonly bookmark: Bookmark;
  readonly event: WorldEvent;
  readonly message: string;
}

/**
 * Callback for bookmark alerts.
 */
export type BookmarkAlertCallback = (alert: BookmarkAlert) => void;

/**
 * Callback for bookmark changes.
 */
export type BookmarkChangeCallback = (bookmark: Bookmark, action: 'add' | 'remove') => void;

/**
 * BookmarkManager tracks bookmarked entities and events.
 */
export class BookmarkManager {
  private readonly bookmarks: Map<EntityId | EventId, Bookmark> = new Map();
  private readonly eventBus: EventBus;
  private readonly getCurrentTime: () => WorldTime;

  private eventSubscription: Unsubscribe | null = null;
  private alertCallbacks: BookmarkAlertCallback[] = [];
  private changeCallbacks: BookmarkChangeCallback[] = [];

  constructor(eventBus: EventBus, getCurrentTime: () => WorldTime) {
    this.eventBus = eventBus;
    this.getCurrentTime = getCurrentTime;

    this.subscribeToEvents();
  }

  /**
   * Toggle bookmark on an entity or event.
   * Adds if not bookmarked, removes if bookmarked.
   */
  toggle(id: EntityId | EventId, type: BookmarkType, label?: string): void {
    if (this.bookmarks.has(id)) {
      this.remove(id);
    } else {
      this.add(id, type, label);
    }
  }

  /**
   * Add a bookmark.
   */
  add(id: EntityId | EventId, type: BookmarkType, label?: string): void {
    if (this.bookmarks.has(id)) return;

    const bookmark: Bookmark = {
      type,
      id,
      addedAt: this.getCurrentTime(),
      ...(label !== undefined ? { label } : {}),
    };

    this.bookmarks.set(id, bookmark);
    this.notifyChange(bookmark, 'add');
  }

  /**
   * Remove a bookmark.
   */
  remove(id: EntityId | EventId): void {
    const bookmark = this.bookmarks.get(id);
    if (bookmark === undefined) return;

    this.bookmarks.delete(id);
    this.notifyChange(bookmark, 'remove');
  }

  /**
   * Get all bookmarks.
   */
  getAll(): readonly Bookmark[] {
    return Array.from(this.bookmarks.values());
  }

  /**
   * Get all entity bookmarks.
   */
  getEntityBookmarks(): readonly Bookmark[] {
    return this.getAll().filter((b) => b.type === 'entity');
  }

  /**
   * Get all event bookmarks.
   */
  getEventBookmarks(): readonly Bookmark[] {
    return this.getAll().filter((b) => b.type === 'event');
  }

  /**
   * Check if an entity or event is bookmarked.
   */
  isBookmarked(id: EntityId | EventId): boolean {
    return this.bookmarks.has(id);
  }

  /**
   * Get a bookmark by ID.
   */
  get(id: EntityId | EventId): Bookmark | undefined {
    return this.bookmarks.get(id);
  }

  /**
   * Get bookmark count.
   */
  get count(): number {
    return this.bookmarks.size;
  }

  /**
   * Check an event for bookmark alerts.
   * Returns an alert if the event involves a bookmarked entity.
   */
  checkAlerts(event: WorldEvent): BookmarkAlert | null {
    // Check if any participant is a bookmarked entity
    for (const participantId of event.participants) {
      const bookmark = this.bookmarks.get(participantId);
      if (bookmark !== undefined && bookmark.type === 'entity') {
        const label = bookmark.label ?? `Entity #${participantId}`;
        return {
          bookmark,
          event,
          message: `Bookmarked entity "${label}" involved in ${event.subtype}`,
        };
      }
    }

    // Check if this is a bookmarked event's consequence
    for (const causeId of event.causes) {
      const bookmark = this.bookmarks.get(causeId);
      if (bookmark !== undefined && bookmark.type === 'event') {
        const label = bookmark.label ?? `Event #${causeId}`;
        return {
          bookmark,
          event,
          message: `Consequence of bookmarked event "${label}": ${event.subtype}`,
        };
      }
    }

    return null;
  }

  /**
   * Update a bookmark's label.
   */
  setLabel(id: EntityId | EventId, label: string): void {
    const bookmark = this.bookmarks.get(id);
    if (bookmark === undefined) return;

    const updatedBookmark: Bookmark = {
      ...bookmark,
      label,
    };
    this.bookmarks.set(id, updatedBookmark);
  }

  /**
   * Clear all bookmarks.
   */
  clear(): void {
    const bookmarks = Array.from(this.bookmarks.values());
    this.bookmarks.clear();

    for (const bookmark of bookmarks) {
      this.notifyChange(bookmark, 'remove');
    }
  }

  /**
   * Register a callback for bookmark alerts.
   */
  onAlert(callback: BookmarkAlertCallback): Unsubscribe {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index >= 0) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register a callback for bookmark changes.
   */
  onChange(callback: BookmarkChangeCallback): Unsubscribe {
    this.changeCallbacks.push(callback);
    return () => {
      const index = this.changeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.changeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.eventSubscription !== null) {
      this.eventSubscription();
      this.eventSubscription = null;
    }
    this.alertCallbacks = [];
    this.changeCallbacks = [];
  }

  /**
   * Subscribe to events for alert checking.
   */
  private subscribeToEvents(): void {
    this.eventSubscription = this.eventBus.onAny((event: WorldEvent) => {
      const alert = this.checkAlerts(event);
      if (alert !== null) {
        this.notifyAlert(alert);
      }
    });
  }

  /**
   * Notify all alert callbacks.
   */
  private notifyAlert(alert: BookmarkAlert): void {
    for (const callback of this.alertCallbacks) {
      callback(alert);
    }
  }

  /**
   * Notify all change callbacks.
   */
  private notifyChange(bookmark: Bookmark, action: 'add' | 'remove'): void {
    for (const callback of this.changeCallbacks) {
      callback(bookmark, action);
    }
  }
}
