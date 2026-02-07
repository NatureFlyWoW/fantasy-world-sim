/**
 * Region-contextual event filtering for the Chronicle View.
 * Provides spatial filtering to show events near the cursor position on the map.
 *
 * Distance model:
 * - Events with a location (SiteId) are filtered by Manhattan distance
 *   from the cursor position to the site's coordinates.
 * - Events without a location are placed in a "World Events" category,
 *   shown at the bottom when region filtering is active.
 */

import type { WorldEvent, EntityId } from '@fws/core';

/**
 * Site coordinate lookup function.
 * Resolves a site/location entity ID to (x, y) tile coordinates.
 * Returns undefined if the site cannot be located.
 */
export type SiteCoordinateLookup = (siteId: EntityId) => { x: number; y: number } | undefined;

/**
 * Region filter configuration.
 */
export interface RegionFilterConfig {
  /** Whether region filtering is currently active */
  readonly enabled: boolean;
  /** Center X coordinate (cursor position) */
  readonly centerX: number;
  /** Center Y coordinate (cursor position) */
  readonly centerY: number;
  /** Radius in tiles for inclusion */
  readonly radius: number;
}

/**
 * Result of filtering events by region.
 */
export interface RegionFilterResult {
  /** Events within the region radius */
  readonly localEvents: readonly WorldEvent[];
  /** Events without a location (shown as "World Events") */
  readonly worldEvents: readonly WorldEvent[];
  /** Total events before filtering */
  readonly totalBefore: number;
}

/**
 * Default filter radius by Level of Detail zone.
 */
export const DEFAULT_RADIUS_BY_LOD = {
  full: 5,
  reduced: 10,
  abstract: 20,
} as const;

/**
 * EventRegionFilter provides spatial event filtering.
 */
export class EventRegionFilter {
  private config: RegionFilterConfig = {
    enabled: false,
    centerX: 0,
    centerY: 0,
    radius: DEFAULT_RADIUS_BY_LOD.full,
  };

  private siteLookup: SiteCoordinateLookup | null = null;

  /**
   * Set the site coordinate lookup function.
   */
  setSiteLookup(lookup: SiteCoordinateLookup): void {
    this.siteLookup = lookup;
  }

  /**
   * Toggle region filtering on/off.
   */
  toggle(): void {
    this.config = { ...this.config, enabled: !this.config.enabled };
  }

  /**
   * Check if region filtering is active.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update the filter center position (cursor location).
   */
  setCenter(x: number, y: number): void {
    this.config = { ...this.config, centerX: x, centerY: y };
  }

  /**
   * Update the filter radius.
   */
  setRadius(radius: number): void {
    this.config = { ...this.config, radius: Math.max(1, radius) };
  }

  /**
   * Get the current filter configuration.
   */
  getConfig(): RegionFilterConfig {
    return { ...this.config };
  }

  /**
   * Filter events by region proximity.
   * Returns events within radius of the center, plus locationless events.
   *
   * If filtering is disabled, returns all events as local events.
   */
  filterByRegion(events: readonly WorldEvent[]): RegionFilterResult {
    if (!this.config.enabled || this.siteLookup === null) {
      return {
        localEvents: events,
        worldEvents: [],
        totalBefore: events.length,
      };
    }

    const localEvents: WorldEvent[] = [];
    const worldEvents: WorldEvent[] = [];

    for (const event of events) {
      if (event.location === undefined) {
        worldEvents.push(event);
        continue;
      }

      const coords = this.siteLookup(event.location as unknown as EntityId);
      if (coords === undefined) {
        worldEvents.push(event);
        continue;
      }

      const distance = this.manhattanDistance(
        coords.x, coords.y,
        this.config.centerX, this.config.centerY
      );

      if (distance <= this.config.radius) {
        localEvents.push(event);
      }
    }

    return {
      localEvents,
      worldEvents,
      totalBefore: events.length,
    };
  }

  /**
   * Get a display string for the filter status.
   */
  getStatusText(): string {
    if (!this.config.enabled) {
      return '';
    }
    return `Showing events near (${this.config.centerX}, ${this.config.centerY}) [r=${this.config.radius}]`;
  }

  /**
   * Calculate Manhattan distance between two points.
   */
  private manhattanDistance(
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
}
