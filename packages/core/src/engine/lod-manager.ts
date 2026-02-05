/**
 * LevelOfDetailManager handles simulation detail levels based on distance from focus.
 * From design doc Section 2.3:
 * - Full Detail: within 50 tile radius of focus
 * - Reduced Detail: within 200 tile radius
 * - Abstract: beyond 200 tiles
 *
 * Entities with significance >= 85 are always simulated at full detail.
 */

/**
 * Detail levels for simulation.
 */
export type DetailLevel = 'full' | 'reduced' | 'abstract';

/**
 * Position in world coordinates.
 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Temporary detail override for a position.
 */
interface DetailOverride {
  position: Position;
  level: DetailLevel;
  expiresAt: number; // Tick when override expires
}

// Constants from design doc Section 2.3
const FULL_DETAIL_RADIUS = 50;
const REDUCED_DETAIL_RADIUS = 200;
const HIGH_SIGNIFICANCE_THRESHOLD = 85;

export class LevelOfDetailManager {
  private focusPosition: Position = { x: 0, y: 0 };
  private overrides: Map<string, DetailOverride> = new Map();
  private currentTick = 0;

  /**
   * Set the focus position (typically camera or player view center).
   */
  setFocus(x: number, y: number): void {
    this.focusPosition = { x, y };
  }

  /**
   * Get the current focus position.
   */
  getFocus(): Position {
    return { ...this.focusPosition };
  }

  /**
   * Update the current tick (call at start of each tick).
   */
  setCurrentTick(tick: number): void {
    this.currentTick = tick;
    this.cleanupExpiredOverrides();
  }

  /**
   * Get the detail level for a position based on distance from focus.
   */
  getDetailLevel(x: number, y: number): DetailLevel {
    // Check for overrides first
    const key = this.positionKey(x, y);
    const override = this.overrides.get(key);
    if (override !== undefined && override.expiresAt > this.currentTick) {
      return override.level;
    }

    const distance = this.calculateDistance(x, y);

    if (distance <= FULL_DETAIL_RADIUS) {
      return 'full';
    }
    if (distance <= REDUCED_DETAIL_RADIUS) {
      return 'reduced';
    }
    return 'abstract';
  }

  /**
   * Determine if an entity should be simulated based on position and significance.
   * High-significance entities (>= 85) are always simulated.
   */
  shouldSimulateEntity(position: Position, significance?: number): boolean {
    // High significance entities always get full simulation
    if (significance !== undefined && significance >= HIGH_SIGNIFICANCE_THRESHOLD) {
      return true;
    }

    const level = this.getDetailLevel(position.x, position.y);

    // Full detail: always simulate
    // Reduced detail: simulate (with reduced frequency handled elsewhere)
    // Abstract: don't simulate directly
    return level !== 'abstract';
  }

  /**
   * Get the simulation frequency multiplier for a position.
   * Full: 1 (every tick), Reduced: 0.1 (every 10th tick), Abstract: 0
   */
  getSimulationFrequency(x: number, y: number): number {
    const level = this.getDetailLevel(x, y);
    switch (level) {
      case 'full':
        return 1;
      case 'reduced':
        return 0.1;
      case 'abstract':
        return 0;
    }
  }

  /**
   * Temporarily promote a position to full detail.
   * Used when significant events occur in abstract regions.
   * @param duration Number of ticks the override lasts
   */
  promoteToFullDetail(x: number, y: number, duration: number): void {
    const key = this.positionKey(x, y);
    this.overrides.set(key, {
      position: { x, y },
      level: 'full',
      expiresAt: this.currentTick + duration,
    });
  }

  /**
   * Remove an override for a position.
   */
  removeOverride(x: number, y: number): void {
    const key = this.positionKey(x, y);
    this.overrides.delete(key);
  }

  /**
   * Placeholder for detail inflation when focus moves to abstract area.
   * Will generate detailed state from abstract summaries.
   */
  inflateSummary(_region: { x: number; y: number; width: number; height: number }): void {
    // TODO: Implement detail inflation
    // This will:
    // 1. Load abstract summary for the region
    // 2. Procedurally generate detailed entities based on summary
    // 3. Maintain consistency with any known facts about the region
  }

  /**
   * Get the distance from focus for a position.
   */
  getDistanceFromFocus(x: number, y: number): number {
    return this.calculateDistance(x, y);
  }

  /**
   * Get all active overrides.
   */
  getActiveOverrides(): ReadonlyArray<{ position: Position; level: DetailLevel; ticksRemaining: number }> {
    const result: Array<{ position: Position; level: DetailLevel; ticksRemaining: number }> = [];
    for (const override of this.overrides.values()) {
      if (override.expiresAt > this.currentTick) {
        result.push({
          position: override.position,
          level: override.level,
          ticksRemaining: override.expiresAt - this.currentTick,
        });
      }
    }
    return result;
  }

  /**
   * Clear all overrides.
   */
  clearOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Calculate Euclidean distance from focus.
   */
  private calculateDistance(x: number, y: number): number {
    const dx = x - this.focusPosition.x;
    const dy = y - this.focusPosition.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Generate a unique key for a position.
   */
  private positionKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /**
   * Remove expired overrides.
   */
  private cleanupExpiredOverrides(): void {
    for (const [key, override] of this.overrides) {
      if (override.expiresAt <= this.currentTick) {
        this.overrides.delete(key);
      }
    }
  }
}

// Export constants for testing
export const LOD_CONSTANTS = {
  FULL_DETAIL_RADIUS,
  REDUCED_DETAIL_RADIUS,
  HIGH_SIGNIFICANCE_THRESHOLD,
} as const;
