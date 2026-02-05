/**
 * CharacterMemoryStore — manages a single character's memories.
 * Handles storage, recall, decay, distortion, and capacity management.
 */

import type { EntityId, EventId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';
import { timeDifferenceInDays, compareTimes } from '../time/types.js';
import { DEFAULT_DECAY_CONFIG } from './memory-types.js';
import type { Memory, MemoryFilter, MemoryDecayConfig } from './memory-types.js';

export class CharacterMemoryStore {
  private memories: Memory[] = [];
  private readonly config: MemoryDecayConfig;

  constructor(config?: MemoryDecayConfig) {
    this.config = config ?? DEFAULT_DECAY_CONFIG;
  }

  get count(): number {
    return this.memories.length;
  }

  get capacity(): number {
    return this.config.maxCapacity;
  }

  /**
   * Add a new memory. Prunes weakest memories if over capacity.
   */
  addMemory(memory: Memory): void {
    this.memories.push(memory);
    if (this.memories.length > this.config.maxCapacity) {
      this.pruneInsignificant();
    }
  }

  /**
   * Recall memories matching a filter. Updates recall metadata.
   * Recalling reinforces accuracy slightly (recollection strengthening).
   * Returns memories sorted by significance (descending).
   */
  recall(filter: MemoryFilter, currentTime: WorldTime): readonly Memory[] {
    const matches = this.memories.filter(m => this.matchesFilter(m, filter));

    // Update recall metadata for each matched memory
    for (const memory of matches) {
      memory.timesRecalled++;
      memory.lastRecalled = currentTime;
      // Recall slightly boosts accuracy (reinforcement effect)
      memory.accuracy = Math.min(
        this.config.recallCeiling,
        memory.accuracy + this.config.recallBoost,
      );
    }

    // Sort by significance descending
    return [...matches].sort((a, b) => b.significance - a.significance);
  }

  /**
   * Query memories without updating recall metadata.
   */
  query(filter: MemoryFilter): readonly Memory[] {
    return this.memories.filter(m => this.matchesFilter(m, filter));
  }

  /**
   * Apply time-based decay to all memories.
   * Emotional memories decay slower; frequently recalled memories decay slower.
   */
  decayAll(currentTime: WorldTime): void {
    for (const memory of this.memories) {
      const daysSinceEvent = timeDifferenceInDays(memory.timestamp, currentTime);
      if (daysSinceEvent <= 0) continue;

      const yearsElapsed = daysSinceEvent / 360;

      // Emotional memories decay slower (strong feelings = sticky memories)
      const emotionalFactor = Math.abs(memory.emotionalWeight) > 50
        ? this.config.emotionalDecayMultiplier
        : 1.0;

      // Frequently recalled memories decay slower
      const recallFactor = Math.max(0.3, 1.0 - memory.timesRecalled * 0.05);

      // Compute target accuracy based on elapsed time
      const targetAccuracy = Math.max(
        0,
        100 - yearsElapsed * this.config.baseDecayPerYear * emotionalFactor * recallFactor,
      );

      // Only decay — never improve accuracy via decay (that's recall's job)
      if (targetAccuracy < memory.accuracy) {
        memory.accuracy = Math.max(0, targetAccuracy);
      }
    }
  }

  /**
   * Distort a specific memory's narrative and accuracy.
   * Used by personality-based drift and propaganda.
   * @returns true if the memory was found and distorted
   */
  distortMemory(
    eventId: EventId,
    accuracyLoss: number,
    narrativeShift?: string,
    emotionalShift?: number,
  ): boolean {
    const memory = this.memories.find(m => m.eventId === eventId);
    if (memory === undefined) return false;

    memory.accuracy = Math.max(0, memory.accuracy - accuracyLoss);
    if (narrativeShift !== undefined) {
      memory.narrative = narrativeShift;
    }
    if (emotionalShift !== undefined) {
      memory.emotionalWeight = Math.max(
        -100,
        Math.min(100, memory.emotionalWeight + emotionalShift),
      );
    }
    return true;
  }

  /**
   * Get the strongest (most significant) memory, optionally filtered by category.
   */
  getStrongestMemory(category?: string): Memory | undefined {
    let candidates = this.memories;
    if (category !== undefined) {
      candidates = candidates.filter(m => m.category === category);
    }
    if (candidates.length === 0) return undefined;

    let strongest = candidates[0]!;
    for (let i = 1; i < candidates.length; i++) {
      const c = candidates[i]!;
      if (c.significance > strongest.significance) {
        strongest = c;
      }
    }
    return strongest;
  }

  /**
   * Get all memories involving a specific entity.
   */
  getMemoriesInvolving(entityId: EntityId): readonly Memory[] {
    return this.memories.filter(m => m.participants.includes(entityId));
  }

  /**
   * Get all stored memories (read-only).
   */
  getAllMemories(): readonly Memory[] {
    return this.memories;
  }

  /**
   * Remove the least significant memories to stay within capacity.
   * @returns number of memories removed
   */
  pruneInsignificant(): number {
    if (this.memories.length <= this.config.maxCapacity) return 0;

    const toRemove = this.memories.length - this.config.maxCapacity;
    // Sort by significance ascending to find removal candidates
    const sorted = [...this.memories].sort((a, b) => a.significance - b.significance);
    const removedIds = new Set(sorted.slice(0, toRemove).map(m => m.eventId));

    const before = this.memories.length;
    this.memories = this.memories.filter(m => !removedIds.has(m.eventId));
    return before - this.memories.length;
  }

  /**
   * Check if the character has any memory of a specific event.
   */
  hasMemoryOf(eventId: EventId): boolean {
    return this.memories.some(m => m.eventId === eventId);
  }

  /**
   * Get the emotional disposition toward an entity based on all memories involving them.
   * Returns -100 (very negative) to +100 (very positive).
   */
  getEmotionalDisposition(entityId: EntityId): number {
    const memories = this.getMemoriesInvolving(entityId);
    if (memories.length === 0) return 0;

    let totalWeight = 0;
    let totalSignificance = 0;

    for (const memory of memories) {
      // Weight by both significance and accuracy
      const weight = (memory.significance / 100) * (memory.accuracy / 100);
      totalWeight += memory.emotionalWeight * weight;
      totalSignificance += weight;
    }

    if (totalSignificance === 0) return 0;
    return Math.round(totalWeight / totalSignificance);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private matchesFilter(memory: Memory, filter: MemoryFilter): boolean {
    if (filter.category !== undefined && memory.category !== filter.category) return false;
    if (filter.involving !== undefined && !memory.participants.includes(filter.involving)) {
      return false;
    }
    if (filter.minSignificance !== undefined && memory.significance < filter.minSignificance) {
      return false;
    }
    if (filter.minAccuracy !== undefined && memory.accuracy < filter.minAccuracy) return false;
    if (filter.role !== undefined && memory.myRole !== filter.role) return false;
    if (filter.afterTime !== undefined && compareTimes(memory.timestamp, filter.afterTime) < 0) {
      return false;
    }
    if (filter.beforeTime !== undefined && compareTimes(memory.timestamp, filter.beforeTime) > 0) {
      return false;
    }
    return true;
  }
}
