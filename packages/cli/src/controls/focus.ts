/**
 * FocusManager manages entity focus and position tracking.
 * Integrates with LevelOfDetailManager to update simulation detail zones.
 */

import type {
  EntityId,
  World,
  EventBus,
  WorldEvent,
  Unsubscribe,
  PositionComponent,
} from '@fws/core';
import { LevelOfDetailManager } from '@fws/core';

/**
 * Focus position in world coordinates.
 */
export interface FocusPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Configuration for FocusManager.
 */
export interface FocusConfig {
  /** Automatically follow focused entity when it moves. Default: true */
  readonly followFocus: boolean;
}

/**
 * Default focus configuration.
 */
const DEFAULT_FOCUS_CONFIG: FocusConfig = {
  followFocus: true,
};

/**
 * Callback for focus change notifications.
 */
export type FocusChangeCallback = (
  entityId: EntityId | null,
  position: FocusPosition | null
) => void;

/**
 * FocusManager tracks entity focus and updates LoD zones accordingly.
 */
export class FocusManager {
  private readonly world: World;
  private readonly eventBus: EventBus;
  private readonly lodManager: LevelOfDetailManager;
  private readonly config: FocusConfig;

  private focusedEntity: EntityId | null = null;
  private focusedPosition: FocusPosition | null = null;
  private focusedEntityEvents: WorldEvent[] = [];

  private eventSubscription: Unsubscribe | null = null;
  private focusChangeCallbacks: FocusChangeCallback[] = [];

  /** Maximum number of events to retain per focused entity */
  private static readonly MAX_FOCUSED_EVENTS = 100;

  constructor(
    world: World,
    eventBus: EventBus,
    lodManager: LevelOfDetailManager,
    config: Partial<FocusConfig> = {}
  ) {
    this.world = world;
    this.eventBus = eventBus;
    this.lodManager = lodManager;
    this.config = { ...DEFAULT_FOCUS_CONFIG, ...config };

    this.subscribeToEvents();
  }

  /**
   * Get the currently focused entity ID.
   */
  get focusEntity(): EntityId | null {
    return this.focusedEntity;
  }

  /**
   * Get the current focus position.
   */
  get focusPosition(): FocusPosition | null {
    return this.focusedPosition;
  }

  /**
   * Set focus on an entity.
   * Updates LoD manager and pans map viewport to entity position.
   */
  setFocus(entityId: EntityId): void {
    // Get entity's position from components
    const position = this.getEntityPosition(entityId);
    if (position === null) {
      // Entity has no position - can't focus on it
      return;
    }

    this.focusedEntity = entityId;
    this.focusedPosition = position;
    this.focusedEntityEvents = [];

    // Update LoD manager to full detail around focused position
    this.lodManager.setFocus(position.x, position.y);

    // Notify callbacks
    this.notifyFocusChange(entityId, position);
  }

  /**
   * Clear the current focus.
   * Restores default LoD behavior.
   */
  clearFocus(): void {
    if (this.focusedEntity === null) return;

    this.focusedEntity = null;
    this.focusedPosition = null;
    this.focusedEntityEvents = [];

    // Notify callbacks with null values
    this.notifyFocusChange(null, null);
  }

  /**
   * Get events involving the focused entity.
   * Returns empty array if no entity is focused.
   */
  getFocusedEntityEvents(): readonly WorldEvent[] {
    return this.focusedEntityEvents;
  }

  /**
   * Check if an entity is currently focused.
   */
  hasFocus(): boolean {
    return this.focusedEntity !== null;
  }

  /**
   * Check if a specific entity is the focused entity.
   */
  isFocused(entityId: EntityId): boolean {
    return this.focusedEntity === entityId;
  }

  /**
   * Update focus position from entity's current position.
   * Call this periodically or when entity position changes.
   */
  updateFocusPosition(): void {
    if (this.focusedEntity === null) return;
    if (!this.config.followFocus) return;

    const position = this.getEntityPosition(this.focusedEntity);
    if (position === null) {
      // Entity no longer has position - clear focus
      this.clearFocus();
      return;
    }

    // Check if position changed
    if (
      this.focusedPosition !== null &&
      position.x === this.focusedPosition.x &&
      position.y === this.focusedPosition.y
    ) {
      return; // No change
    }

    // Update position
    this.focusedPosition = position;
    this.lodManager.setFocus(position.x, position.y);

    // Notify callbacks of position update
    this.notifyFocusChange(this.focusedEntity, position);
  }

  /**
   * Register a callback for focus changes.
   */
  onFocusChange(callback: FocusChangeCallback): Unsubscribe {
    this.focusChangeCallbacks.push(callback);
    return () => {
      const index = this.focusChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.focusChangeCallbacks.splice(index, 1);
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
    this.focusChangeCallbacks = [];
    this.focusedEntityEvents = [];
  }

  /**
   * Get an entity's position from its Position component.
   */
  private getEntityPosition(entityId: EntityId): FocusPosition | null {
    const positionComponent = this.world.getComponent<PositionComponent>(
      entityId,
      'Position'
    );

    if (positionComponent === undefined) {
      return null;
    }

    return { x: positionComponent.x, y: positionComponent.y };
  }

  /**
   * Subscribe to events for focused entity tracking.
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
    if (this.focusedEntity === null) return;

    // Check if event involves the focused entity
    if (event.participants.includes(this.focusedEntity)) {
      this.focusedEntityEvents.push(event);

      // Trim to max size
      if (this.focusedEntityEvents.length > FocusManager.MAX_FOCUSED_EVENTS) {
        this.focusedEntityEvents = this.focusedEntityEvents.slice(
          -FocusManager.MAX_FOCUSED_EVENTS
        );
      }
    }
  }

  /**
   * Notify all registered callbacks of a focus change.
   */
  private notifyFocusChange(
    entityId: EntityId | null,
    position: FocusPosition | null
  ): void {
    for (const callback of this.focusChangeCallbacks) {
      callback(entityId, position);
    }
  }
}
