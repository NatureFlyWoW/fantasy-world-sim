/**
 * GrudgeSystem — generational grudge tracking with inheritance.
 * Grudges persist across generations with decaying intensity:
 * Gen 0 (original): 100%
 * Gen 1 (children): 60% of original grudge
 * Gen 2 (grandchildren): 30%
 * Gen 3 (great-grandchildren): 10%
 * Gen 4+: fade to nothing
 */

import type { EntityId, EventId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';
import { timeDifferenceInDays } from '../time/types.js';

// ── Grudge interface ────────────────────────────────────────────────────────

export interface Grudge {
  readonly targetId: EntityId;
  readonly originatorId: EntityId;
  readonly causeEventId: EventId;
  readonly cause: string;
  severity: number;                  // 0-100, current (may decay over time)
  readonly originalSeverity: number; // Severity at generation 0 (for inheritance calc)
  readonly generation: number;       // 0 = original, 1 = child, 2 = grandchild, etc.
  readonly createdAt: WorldTime;
  lastIntensified: WorldTime;
}

/** Inheritance multipliers per generation */
const GENERATIONAL_DECAY: readonly number[] = [1.0, 0.6, 0.3, 0.1];

// ── Configuration ───────────────────────────────────────────────────────────

export interface GrudgeConfig {
  /** Maximum number of grudges per entity */
  readonly maxGrudges: number;
  /** Severity below which grudges are forgotten */
  readonly forgetThreshold: number;
  /** Natural decay per year (severity points) */
  readonly decayPerYear: number;
  /** Maximum generation depth for inheritance */
  readonly maxGeneration: number;
}

export const DEFAULT_GRUDGE_CONFIG: GrudgeConfig = {
  maxGrudges: 20,
  forgetThreshold: 5,
  decayPerYear: 2,
  maxGeneration: 3,
};

// ── GrudgeSystem ────────────────────────────────────────────────────────────

export class GrudgeSystem {
  /** holderId → list of grudges */
  private grudges: Map<number, Grudge[]> = new Map();
  private readonly config: GrudgeConfig;

  constructor(config?: GrudgeConfig) {
    this.config = config ?? DEFAULT_GRUDGE_CONFIG;
  }

  /**
   * Add a new grudge or intensify an existing one against the same target.
   */
  addGrudge(
    holderId: EntityId,
    targetId: EntityId,
    causeEventId: EventId,
    cause: string,
    severity: number,
    currentTime: WorldTime,
  ): void {
    const existing = this.getGrudge(holderId, targetId);
    if (existing !== undefined) {
      // Intensify existing grudge
      existing.severity = Math.min(100, existing.severity + severity);
      existing.lastIntensified = currentTime;
      return;
    }

    const clamped = Math.min(100, Math.max(0, severity));
    const grudge: Grudge = {
      targetId,
      originatorId: holderId,
      causeEventId,
      cause,
      severity: clamped,
      originalSeverity: clamped,
      generation: 0,
      createdAt: currentTime,
      lastIntensified: currentTime,
    };

    let list = this.grudges.get(holderId as number);
    if (list === undefined) {
      list = [];
      this.grudges.set(holderId as number, list);
    }

    list.push(grudge);

    // Prune if over capacity — remove weakest
    if (list.length > this.config.maxGrudges) {
      list.sort((a, b) => a.severity - b.severity);
      list.shift();
    }
  }

  /**
   * Inherit grudges from parent to child.
   * Applies generational decay multiplier:
   * Gen 1 → 60%, Gen 2 → 30%, Gen 3 → 10%, Gen 4+ → nothing.
   */
  inheritGrudges(parentId: EntityId, childId: EntityId, currentTime: WorldTime): void {
    const parentGrudges = this.grudges.get(parentId as number);
    if (parentGrudges === undefined) return;

    for (const grudge of parentGrudges) {
      const newGeneration = grudge.generation + 1;
      if (newGeneration > this.config.maxGeneration) continue;

      const decayIdx = Math.min(newGeneration, GENERATIONAL_DECAY.length - 1);
      const multiplier = GENERATIONAL_DECAY[decayIdx] ?? 0;
      // Apply percentage to ORIGINAL severity, not current (which may have decayed)
      const inheritedSeverity = grudge.originalSeverity * multiplier;

      if (inheritedSeverity < this.config.forgetThreshold) continue;

      let childList = this.grudges.get(childId as number);
      if (childList === undefined) {
        childList = [];
        this.grudges.set(childId as number, childList);
      }

      // Don't duplicate — keep the stronger grudge
      const existingChild = childList.find(g => g.targetId === grudge.targetId);
      if (existingChild !== undefined) {
        if (inheritedSeverity > existingChild.severity) {
          existingChild.severity = inheritedSeverity;
        }
        continue;
      }

      const inherited: Grudge = {
        targetId: grudge.targetId,
        originatorId: grudge.originatorId,
        causeEventId: grudge.causeEventId,
        cause: grudge.cause,
        severity: inheritedSeverity,
        originalSeverity: grudge.originalSeverity,
        generation: newGeneration,
        createdAt: currentTime,
        lastIntensified: currentTime,
      };

      childList.push(inherited);
    }
  }

  /**
   * Resolve (remove) a grudge toward a specific target.
   */
  resolveGrudge(holderId: EntityId, targetId: EntityId): boolean {
    const list = this.grudges.get(holderId as number);
    if (list === undefined) return false;

    const idx = list.findIndex(g => g.targetId === targetId);
    if (idx === -1) return false;

    list.splice(idx, 1);
    if (list.length === 0) {
      this.grudges.delete(holderId as number);
    }
    return true;
  }

  /**
   * Get the grudge severity toward a target (0 = no grudge).
   */
  getGrudgeLevel(holderId: EntityId, targetId: EntityId): number {
    const grudge = this.getGrudge(holderId, targetId);
    return grudge?.severity ?? 0;
  }

  /**
   * Get a specific grudge if it exists.
   */
  getGrudge(holderId: EntityId, targetId: EntityId): Grudge | undefined {
    const list = this.grudges.get(holderId as number);
    if (list === undefined) return undefined;
    return list.find(g => g.targetId === targetId);
  }

  /**
   * Get all grudges held by an entity.
   */
  getGrudges(holderId: EntityId): readonly Grudge[] {
    return this.grudges.get(holderId as number) ?? [];
  }

  /**
   * Get all entities who hold grudges against a target.
   */
  getGrudgeHolders(targetId: EntityId): readonly EntityId[] {
    const holders: EntityId[] = [];
    for (const [holderId, list] of this.grudges) {
      if (list.some(g => g.targetId === targetId)) {
        holders.push(holderId as EntityId);
      }
    }
    return holders;
  }

  /**
   * Apply time-based decay to all grudges.
   * Removes grudges that fall below the forget threshold.
   */
  decayAll(currentTime: WorldTime): void {
    for (const [holderId, list] of this.grudges) {
      for (let i = list.length - 1; i >= 0; i--) {
        const grudge = list[i]!;
        const daysSince = timeDifferenceInDays(grudge.lastIntensified, currentTime);
        if (daysSince <= 0) continue;

        const yearsElapsed = daysSince / 360;
        const decay = yearsElapsed * this.config.decayPerYear;
        grudge.severity = Math.max(0, grudge.severity - decay);

        if (grudge.severity < this.config.forgetThreshold) {
          list.splice(i, 1);
        }
      }

      if (list.length === 0) {
        this.grudges.delete(holderId);
      }
    }
  }

  /**
   * Get total number of grudges across all entities.
   */
  get totalGrudgeCount(): number {
    let count = 0;
    for (const [, list] of this.grudges) {
      count += list.length;
    }
    return count;
  }
}
