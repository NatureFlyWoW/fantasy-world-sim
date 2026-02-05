/**
 * Reputation system types — multi-dimensional reputation with social propagation.
 * Each observer can have a different subjective view of a subject's reputation.
 */

import type { EntityId, FactionId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';

// ── Reputation dimensions ───────────────────────────────────────────────────

export enum ReputationDimension {
  Military = 'military',       // martial prowess, tactical ability
  Political = 'political',     // governance, diplomacy, leadership
  Economic = 'economic',       // wealth management, trade acumen
  Scholarly = 'scholarly',     // knowledge, research, magical expertise
  Religious = 'religious',     // piety, divine favor, ritual knowledge
  Moral = 'moral',             // honor, trustworthiness, ethical standing
  Social = 'social',           // charisma, popularity, social influence
}

export const ALL_REPUTATION_DIMENSIONS: readonly ReputationDimension[] =
  Object.values(ReputationDimension);

// ── Reputation profile ──────────────────────────────────────────────────────

/**
 * Multi-dimensional reputation as perceived by a specific observer.
 * Values range from -100 (infamous) to +100 (legendary).
 */
export interface ReputationProfile {
  readonly dimensions: ReadonlyMap<ReputationDimension, number>;
}

/**
 * A single reputation observation entry.
 * Tracks who holds this view, when it was last updated, and confidence.
 */
export interface ReputationEntry {
  readonly observerId: EntityId;
  readonly subjectId: EntityId;
  dimensions: Map<ReputationDimension, number>;
  lastUpdated: WorldTime;
  /** How confident the observer is in this assessment (0-100).
   * Direct witnesses have high confidence; rumors lower. */
  confidence: number;
  /** How many hops from original source (0 = direct witness) */
  propagationDepth: number;
}

/**
 * Reputation of an entire faction as perceived by another faction.
 */
export interface FactionReputationEntry {
  readonly observerFactionId: FactionId;
  readonly subjectFactionId: FactionId;
  dimensions: Map<ReputationDimension, number>;
  lastUpdated: WorldTime;
  /** How public/well-known this reputation is (0-100) */
  publicity: number;
}

// ── Propagation rules ───────────────────────────────────────────────────────

/**
 * How reputation information decays as it propagates through social networks.
 */
export interface PropagationConfig {
  /** Maximum number of hops reputation can travel */
  readonly maxHops: number;
  /** Confidence multiplier per hop (0-1, typically 0.6-0.8) */
  readonly confidenceDecayPerHop: number;
  /** Minimum confidence threshold; below this, info is discarded */
  readonly minConfidence: number;
  /** How much reputation values shift per hop (noise/distortion) */
  readonly distortionPerHop: number;
  /** Base decay of confidence per year (0-100) */
  readonly temporalDecayPerYear: number;
}

export const DEFAULT_PROPAGATION_CONFIG: PropagationConfig = {
  maxHops: 4,
  confidenceDecayPerHop: 0.7,
  minConfidence: 10,
  distortionPerHop: 5,
  temporalDecayPerYear: 15,
};

// ── Event → Reputation mapping ──────────────────────────────────────────────

/**
 * Defines how an event category affects reputation dimensions.
 */
export interface ReputationImpactRule {
  readonly dimension: ReputationDimension;
  readonly baseImpact: number; // -50 to +50
  /** Multiplied by event significance (0-100) / 100 */
  readonly significanceScaling: boolean;
}
