/**
 * NotificationManager handles configurable alerts and notifications.
 * Displays temporary notifications for significant events.
 */

import { EventCategory } from '@fws/core';
import type {
  EntityId,
  EventBus,
  WorldEvent,
  Unsubscribe,
} from '@fws/core';

/**
 * Notification priority levels.
 */
export type NotificationPriority = 'low' | 'medium' | 'high';

/**
 * Notification entry.
 */
export interface NotificationEntry {
  readonly id: number;
  readonly message: string;
  readonly priority: NotificationPriority;
  readonly timestamp: number;
  readonly dismissed: boolean;
  readonly event?: WorldEvent;
}

/**
 * Configuration for NotificationManager.
 */
export interface NotificationConfig {
  /** Minimum significance to trigger notification. Default: 80 */
  readonly significanceThreshold: number;
  /** Only alert for these categories. Empty set = all categories */
  readonly categoryFilter: ReadonlySet<EventCategory>;
  /** Alert when bookmarked entities are involved. Default: true */
  readonly bookmarkedEntityAlert: boolean;
  /** Alert when focused entity is involved. Default: true */
  readonly focusEntityAlert: boolean;
  /** Maximum number of entries to keep in history. Default: 100 */
  readonly maxHistory: number;
}

/**
 * Default notification configuration.
 */
const DEFAULT_CONFIG: NotificationConfig = {
  significanceThreshold: 80,
  categoryFilter: new Set(),
  bookmarkedEntityAlert: true,
  focusEntityAlert: true,
  maxHistory: 100,
};

/**
 * Callback for notification display.
 */
export type NotificationDisplayCallback = (entry: NotificationEntry) => void;

/**
 * NotificationManager handles event-based notifications.
 */
export class NotificationManager {
  private readonly eventBus: EventBus;
  private config: NotificationConfig;

  private history: NotificationEntry[] = [];
  private currentNotification: NotificationEntry | null = null;
  private nextId = 1;

  private eventSubscription: Unsubscribe | null = null;
  private displayCallbacks: NotificationDisplayCallback[] = [];

  /** Set of bookmarked entity IDs (updated externally) */
  private bookmarkedEntities: Set<EntityId> = new Set();
  /** Currently focused entity ID (updated externally) */
  private focusedEntity: EntityId | null = null;

  constructor(
    eventBus: EventBus,
    config: Partial<NotificationConfig> = {}
  ) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.subscribeToEvents();
  }

  /**
   * Show a notification.
   */
  show(message: string, priority: NotificationPriority, event?: WorldEvent): void {
    const entry: NotificationEntry = {
      id: this.nextId++,
      message,
      priority,
      timestamp: Date.now(),
      dismissed: false,
      ...(event !== undefined ? { event } : {}),
    };

    this.currentNotification = entry;
    this.addToHistory(entry);
    this.notifyDisplay(entry);
  }

  /**
   * Dismiss the current notification.
   */
  dismiss(): void {
    if (this.currentNotification !== null) {
      // Mark as dismissed in history
      const index = this.history.findIndex(
        (e) => e.id === this.currentNotification?.id
      );
      if (index >= 0) {
        const entry = this.history[index];
        if (entry !== undefined) {
          this.history[index] = { ...entry, dismissed: true };
        }
      }
      this.currentNotification = null;
    }
  }

  /**
   * Get the current notification.
   */
  getCurrent(): NotificationEntry | null {
    return this.currentNotification;
  }

  /**
   * Get notification history.
   */
  getHistory(): readonly NotificationEntry[] {
    return this.history;
  }

  /**
   * Get undismissed notifications from history.
   */
  getActive(): readonly NotificationEntry[] {
    return this.history.filter((e) => !e.dismissed);
  }

  /**
   * Clear notification history.
   */
  clearHistory(): void {
    this.history = [];
    this.currentNotification = null;
  }

  /**
   * Update the significance threshold.
   */
  setSignificanceThreshold(threshold: number): void {
    this.config = { ...this.config, significanceThreshold: threshold };
  }

  /**
   * Get the current significance threshold.
   */
  get significanceThreshold(): number {
    return this.config.significanceThreshold;
  }

  /**
   * Update category filter.
   */
  setCategoryFilter(categories: ReadonlySet<EventCategory>): void {
    this.config = { ...this.config, categoryFilter: categories };
  }

  /**
   * Get the current category filter.
   */
  get categoryFilter(): ReadonlySet<EventCategory> {
    return this.config.categoryFilter;
  }

  /**
   * Enable/disable bookmarked entity alerts.
   */
  setBookmarkedEntityAlert(enabled: boolean): void {
    this.config = { ...this.config, bookmarkedEntityAlert: enabled };
  }

  /**
   * Enable/disable focus entity alerts.
   */
  setFocusEntityAlert(enabled: boolean): void {
    this.config = { ...this.config, focusEntityAlert: enabled };
  }

  /**
   * Update the set of bookmarked entities.
   * Called by BookmarkManager when bookmarks change.
   */
  setBookmarkedEntities(entities: Set<EntityId>): void {
    this.bookmarkedEntities = entities;
  }

  /**
   * Update the focused entity.
   * Called by FocusManager when focus changes.
   */
  setFocusedEntity(entityId: EntityId | null): void {
    this.focusedEntity = entityId;
  }

  /**
   * Register a callback for notification display.
   */
  onDisplay(callback: NotificationDisplayCallback): Unsubscribe {
    this.displayCallbacks.push(callback);
    return () => {
      const index = this.displayCallbacks.indexOf(callback);
      if (index >= 0) {
        this.displayCallbacks.splice(index, 1);
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
    this.displayCallbacks = [];
  }

  /**
   * Subscribe to events for notification triggering.
   */
  private subscribeToEvents(): void {
    this.eventSubscription = this.eventBus.onAny((event: WorldEvent) => {
      this.handleEvent(event);
    });
  }

  /**
   * Handle incoming event.
   */
  private handleEvent(event: WorldEvent): void {
    // Check category filter
    if (
      this.config.categoryFilter.size > 0 &&
      !this.config.categoryFilter.has(event.category)
    ) {
      return;
    }

    // Check for bookmarked entity involvement
    if (this.config.bookmarkedEntityAlert) {
      for (const participantId of event.participants) {
        if (this.bookmarkedEntities.has(participantId)) {
          this.show(
            `Bookmarked entity in ${event.subtype}`,
            'medium',
            event
          );
          return;
        }
      }
    }

    // Check for focused entity involvement
    if (
      this.config.focusEntityAlert &&
      this.focusedEntity !== null &&
      event.participants.includes(this.focusedEntity)
    ) {
      this.show(
        `Focused entity in ${event.subtype}`,
        'medium',
        event
      );
      return;
    }

    // Check significance threshold
    if (event.significance >= this.config.significanceThreshold) {
      const priority = this.getPriorityForSignificance(event.significance);
      this.show(
        `${event.subtype} (significance: ${event.significance})`,
        priority,
        event
      );
    }
  }

  /**
   * Map significance to priority.
   */
  private getPriorityForSignificance(significance: number): NotificationPriority {
    if (significance >= 95) return 'high';
    if (significance >= 85) return 'medium';
    return 'low';
  }

  /**
   * Add entry to history with size limit.
   */
  private addToHistory(entry: NotificationEntry): void {
    this.history.push(entry);

    if (this.history.length > this.config.maxHistory) {
      this.history = this.history.slice(-this.config.maxHistory);
    }
  }

  /**
   * Notify all display callbacks.
   */
  private notifyDisplay(entry: NotificationEntry): void {
    for (const callback of this.displayCallbacks) {
      callback(entry);
    }
  }
}
