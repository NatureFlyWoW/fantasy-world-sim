/**
 * ReputationSystem — manages multi-dimensional reputation with social propagation.
 * Reputation is subjective: different observers can have different views of the same subject.
 */

import type { EntityId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';
import { timeDifferenceInDays } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import type { WorldEvent } from '../events/types.js';
import {
  ReputationDimension,
  DEFAULT_PROPAGATION_CONFIG,
} from './reputation-types.js';
import type {
  ReputationProfile,
  ReputationEntry,
  PropagationConfig,
  ReputationImpactRule,
} from './reputation-types.js';

// ── Event → Reputation impact mapping ───────────────────────────────────────

const EVENT_REPUTATION_IMPACTS: ReadonlyMap<EventCategory, readonly ReputationImpactRule[]> =
  new Map([
    [EventCategory.Military, [
      { dimension: ReputationDimension.Military, baseImpact: 20, significanceScaling: true },
    ]],
    [EventCategory.Political, [
      { dimension: ReputationDimension.Political, baseImpact: 15, significanceScaling: true },
      { dimension: ReputationDimension.Social, baseImpact: 5, significanceScaling: true },
    ]],
    [EventCategory.Economic, [
      { dimension: ReputationDimension.Economic, baseImpact: 15, significanceScaling: true },
    ]],
    [EventCategory.Religious, [
      { dimension: ReputationDimension.Religious, baseImpact: 20, significanceScaling: true },
    ]],
    [EventCategory.Scientific, [
      { dimension: ReputationDimension.Scholarly, baseImpact: 20, significanceScaling: true },
    ]],
    [EventCategory.Cultural, [
      { dimension: ReputationDimension.Social, baseImpact: 15, significanceScaling: true },
    ]],
    [EventCategory.Personal, [
      { dimension: ReputationDimension.Moral, baseImpact: 10, significanceScaling: true },
      { dimension: ReputationDimension.Social, baseImpact: 10, significanceScaling: true },
    ]],
    [EventCategory.Disaster, [
      { dimension: ReputationDimension.Moral, baseImpact: -5, significanceScaling: true },
    ]],
  ]);

// ── ReputationSystem ────────────────────────────────────────────────────────

export class ReputationSystem {
  /** observer (number) → subject (number) → entry */
  private entries: Map<number, Map<number, ReputationEntry>> = new Map();
  private readonly config: PropagationConfig;

  constructor(config?: PropagationConfig) {
    this.config = config ?? DEFAULT_PROPAGATION_CONFIG;
  }

  /**
   * Get how one entity perceives another's reputation.
   * Returns a neutral profile if no data exists.
   */
  getReputation(observerId: EntityId, subjectId: EntityId): ReputationProfile {
    const subjectMap = this.entries.get(observerId as number);
    if (subjectMap === undefined) {
      return { dimensions: new Map() };
    }
    const entry = subjectMap.get(subjectId as number);
    if (entry === undefined) {
      return { dimensions: new Map() };
    }
    return { dimensions: new Map(entry.dimensions) };
  }

  /**
   * Get the full reputation entry if it exists.
   */
  getEntry(observerId: EntityId, subjectId: EntityId): ReputationEntry | undefined {
    return this.entries.get(observerId as number)?.get(subjectId as number);
  }

  /**
   * Set a direct observation of reputation (confidence = 100, depth = 0).
   */
  setDirectObservation(
    observerId: EntityId,
    subjectId: EntityId,
    dimension: ReputationDimension,
    value: number,
    currentTime: WorldTime,
  ): void {
    const entry = this.getOrCreateEntry(observerId, subjectId, currentTime);
    const clamped = Math.max(-100, Math.min(100, value));
    entry.dimensions.set(dimension, clamped);
    entry.lastUpdated = currentTime;
    entry.confidence = 100;
    entry.propagationDepth = 0;
  }

  /**
   * Update reputations based on a world event.
   * All participants gain reputation changes. Witnesses observe directly.
   */
  updateFromEvent(
    event: WorldEvent,
    witnesses: readonly EntityId[],
    currentTime: WorldTime,
  ): void {
    const impacts = EVENT_REPUTATION_IMPACTS.get(event.category);
    if (impacts === undefined) return;

    for (const participant of event.participants) {
      for (const rule of impacts) {
        const impact = rule.significanceScaling
          ? rule.baseImpact * (event.significance / 100)
          : rule.baseImpact;

        // Witnesses observe the participant's reputation change
        for (const witness of witnesses) {
          if (witness === participant) continue;
          this.applyImpact(witness, participant, rule.dimension, impact, currentTime);
        }

        // Other participants also observe
        for (const otherParticipant of event.participants) {
          if (otherParticipant === participant) continue;
          if (witnesses.includes(otherParticipant)) continue;
          this.applyImpact(
            otherParticipant, participant, rule.dimension, impact, currentTime,
          );
        }
      }
    }
  }

  /**
   * Propagate reputation through a social network via BFS.
   * @param sourceId - Entity whose opinions to propagate
   * @param connections - Social graph: entityId → list of connected entityIds
   * @param currentTime - Current world time
   * @param rng - Random number generator for distortion (deterministic in sim)
   */
  propagate(
    sourceId: EntityId,
    connections: ReadonlyMap<number, readonly EntityId[]>,
    currentTime: WorldTime,
    rng: () => number = Math.random,
  ): void {
    const sourceEntries = this.entries.get(sourceId as number);
    if (sourceEntries === undefined) return;

    const visited = new Set<number>([sourceId as number]);
    const directConnections = connections.get(sourceId as number);
    let frontier: EntityId[] = directConnections !== undefined
      ? [...directConnections]
      : [];
    let currentDepth = 1;

    while (frontier.length > 0 && currentDepth <= this.config.maxHops) {
      const nextFrontier: EntityId[] = [];

      for (const receiverId of frontier) {
        if (visited.has(receiverId as number)) continue;
        visited.add(receiverId as number);

        // Propagate all reputation knowledge from source to receiver
        for (const [subjectId, sourceEntry] of sourceEntries) {
          // Don't tell someone about themselves via gossip
          if (subjectId === (receiverId as number)) continue;

          const confidence =
            sourceEntry.confidence * Math.pow(this.config.confidenceDecayPerHop, currentDepth);
          if (confidence < this.config.minConfidence) continue;

          // Only update if new info is higher confidence than existing
          const existingEntry = this.entries.get(receiverId as number)?.get(subjectId);
          if (existingEntry !== undefined && existingEntry.confidence >= confidence) continue;

          const entry = this.getOrCreateEntry(
            receiverId,
            subjectId as EntityId,
            currentTime,
          );

          // Copy dimensions with distortion noise
          for (const [dim, value] of sourceEntry.dimensions) {
            const distortion =
              (rng() - 0.5) * 2 * this.config.distortionPerHop * currentDepth;
            const distorted = Math.max(-100, Math.min(100, value + distortion));
            entry.dimensions.set(dim, distorted);
          }

          entry.confidence = confidence;
          entry.propagationDepth = currentDepth;
          entry.lastUpdated = currentTime;
        }

        // Add next-hop connections to the frontier
        const nextConnections = connections.get(receiverId as number);
        if (nextConnections !== undefined) {
          nextFrontier.push(...nextConnections);
        }
      }

      frontier = nextFrontier;
      currentDepth++;
    }
  }

  /**
   * Apply time-based decay to all reputation entries.
   * Removes entries whose confidence drops to zero.
   */
  decayAll(currentTime: WorldTime): void {
    for (const [, subjectMap] of this.entries) {
      const toDelete: number[] = [];
      for (const [subjectId, entry] of subjectMap) {
        const daysSince = timeDifferenceInDays(entry.lastUpdated, currentTime);
        if (daysSince <= 0) continue;

        const yearsElapsed = daysSince / 360;
        const confidenceLoss = yearsElapsed * this.config.temporalDecayPerYear;
        entry.confidence = Math.max(0, entry.confidence - confidenceLoss);

        if (entry.confidence <= 0) {
          toDelete.push(subjectId);
        }
      }
      for (const id of toDelete) {
        subjectMap.delete(id);
      }
    }
  }

  /**
   * Get all entities who have formed an opinion about a subject.
   */
  getObserversOf(subjectId: EntityId): readonly EntityId[] {
    const observers: EntityId[] = [];
    for (const [observerId, subjectMap] of this.entries) {
      if (subjectMap.has(subjectId as number)) {
        observers.push(observerId as EntityId);
      }
    }
    return observers;
  }

  /**
   * Get the confidence-weighted average reputation across all observers.
   */
  getPublicReputation(subjectId: EntityId): ReputationProfile {
    const totals = new Map<ReputationDimension, { sum: number; weight: number }>();

    for (const [, subjectMap] of this.entries) {
      const entry = subjectMap.get(subjectId as number);
      if (entry === undefined) continue;

      const confidenceWeight = entry.confidence / 100;
      for (const [dim, value] of entry.dimensions) {
        const current = totals.get(dim);
        if (current !== undefined) {
          current.sum += value * confidenceWeight;
          current.weight += confidenceWeight;
        } else {
          totals.set(dim, { sum: value * confidenceWeight, weight: confidenceWeight });
        }
      }
    }

    const dimensions = new Map<ReputationDimension, number>();
    for (const [dim, { sum, weight }] of totals) {
      if (weight > 0) {
        dimensions.set(dim, Math.round(sum / weight));
      }
    }

    return { dimensions };
  }

  /**
   * Get the total number of reputation entries stored.
   */
  get entryCount(): number {
    let count = 0;
    for (const [, subjectMap] of this.entries) {
      count += subjectMap.size;
    }
    return count;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private getOrCreateEntry(
    observerId: EntityId,
    subjectId: EntityId,
    currentTime: WorldTime,
  ): ReputationEntry {
    let subjectMap = this.entries.get(observerId as number);
    if (subjectMap === undefined) {
      subjectMap = new Map();
      this.entries.set(observerId as number, subjectMap);
    }

    let entry = subjectMap.get(subjectId as number);
    if (entry === undefined) {
      entry = {
        observerId,
        subjectId,
        dimensions: new Map(),
        lastUpdated: currentTime,
        confidence: 0,
        propagationDepth: 0,
      };
      subjectMap.set(subjectId as number, entry);
    }

    return entry;
  }

  private applyImpact(
    observerId: EntityId,
    subjectId: EntityId,
    dimension: ReputationDimension,
    impact: number,
    currentTime: WorldTime,
  ): void {
    const entry = this.getOrCreateEntry(observerId, subjectId, currentTime);
    const current = entry.dimensions.get(dimension) ?? 0;
    const newValue = Math.max(-100, Math.min(100, current + impact));
    entry.dimensions.set(dimension, newValue);
    entry.lastUpdated = currentTime;
    entry.confidence = 100;
    entry.propagationDepth = 0;
  }
}
