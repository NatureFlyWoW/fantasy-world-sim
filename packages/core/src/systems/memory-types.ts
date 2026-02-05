/**
 * Memory system types for character subjective experience.
 * Memories decay, distort, and bias character decision-making.
 */

import type { EntityId, EventId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';

// ── Memory role ─────────────────────────────────────────────────────────────

export enum MemoryRole {
  Witness = 'witness',
  Participant = 'participant',
  Victim = 'victim',
  Instigator = 'instigator',
  Beneficiary = 'beneficiary',
  Bystander = 'bystander',
}

// ── Memory category ─────────────────────────────────────────────────────────

export enum MemoryCategory {
  Personal = 'personal',
  Political = 'political',
  Military = 'military',
  Economic = 'economic',
  Religious = 'religious',
  Magical = 'magical',
  Cultural = 'cultural',
  Scientific = 'scientific',
  Disaster = 'disaster',
  Social = 'social',
}

// ── Memory interface ────────────────────────────────────────────────────────

/**
 * A single subjective memory held by a character.
 * Accuracy degrades over time; narrative drifts based on personality.
 */
export interface Memory {
  readonly eventId: EventId;
  readonly timestamp: WorldTime;
  emotionalWeight: number;        // -100 (traumatic) to +100 (joyful)
  significance: number;           // 0-100
  readonly participants: readonly EntityId[];
  readonly myRole: MemoryRole;
  readonly category: MemoryCategory;
  accuracy: number;               // 0-100, degrades over time
  timesRecalled: number;
  lastRecalled: WorldTime;
  narrative: string;              // character's SUBJECTIVE version
}

// ── Decay configuration ─────────────────────────────────────────────────────

export interface MemoryDecayConfig {
  /** Base accuracy loss per year (0-100 scale) */
  readonly baseDecayPerYear: number;
  /** Multiplier for emotional memories (< 1.0 = slower decay) */
  readonly emotionalDecayMultiplier: number;
  /** Accuracy boost per recall (0-100 scale) */
  readonly recallBoost: number;
  /** Maximum accuracy after recall (can't exceed original) */
  readonly recallCeiling: number;
  /** Below this significance, memories can be pruned */
  readonly pruneThreshold: number;
  /** Maximum number of memories per character */
  readonly maxCapacity: number;
}

export const DEFAULT_DECAY_CONFIG: MemoryDecayConfig = {
  baseDecayPerYear: 10,
  emotionalDecayMultiplier: 0.5,
  recallBoost: 5,
  recallCeiling: 95,
  pruneThreshold: 10,
  maxCapacity: 200,
};

// ── Memory filter ───────────────────────────────────────────────────────────

export interface MemoryFilter {
  readonly category?: MemoryCategory;
  readonly involving?: EntityId;
  readonly minSignificance?: number;
  readonly minAccuracy?: number;
  readonly role?: MemoryRole;
  readonly afterTime?: WorldTime;
  readonly beforeTime?: WorldTime;
}
