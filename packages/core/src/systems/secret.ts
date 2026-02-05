/**
 * Secret interface and related types for the Secret Knowledge System.
 * Secrets represent hidden information in the simulation.
 */

import type { EntityId, CharacterId, FactionId, EventId } from '../ecs/types.js';
import { toEntityId } from '../ecs/types.js';
import type { SecretType, RevelationMethod } from './secret-types.js';

/**
 * Core secret data structure.
 * Tracks what is true vs what different characters know or suspect.
 */
export interface Secret {
  /** Unique identifier for this secret */
  readonly id: EntityId;
  /** Category of secret */
  readonly type: SecretType;
  /** The actual truth — what's really going on */
  readonly groundTruth: Readonly<Record<string, unknown>>;
  /** Characters who definitively know this secret */
  knownBy: Set<CharacterId>;
  /** Characters who suspect with varying confidence (0-100) */
  suspectedBy: Map<CharacterId, number>;
  /** Base probability per tick of natural revelation */
  revelationProbability: number;
  /** Ticks since the secret was created */
  age: number;
  /** How significant a revelation would be (0-100) */
  readonly significance: number;
  /** When the secret was created (tick) */
  readonly createdAt: number;
  /** Related entities (subject of the secret) */
  readonly relatedEntities: readonly EntityId[];
  /** Related factions */
  readonly relatedFactions: readonly FactionId[];
  /** Whether the secret has been revealed */
  isRevealed: boolean;
  /** When it was revealed (if applicable) */
  revealedAt?: number;
  /** How it was revealed (if applicable) */
  revealedBy?: RevelationMethod;
  /** Who revealed it (if applicable) */
  revealerId?: CharacterId;
}

/**
 * Event data for secret revelation.
 */
export interface SecretRevelationEvent {
  /** The secret that was revealed */
  secretId: EntityId;
  /** Type of secret */
  secretType: SecretType;
  /** How it was revealed */
  method: RevelationMethod;
  /** Who revealed it (if applicable) */
  revealerId?: CharacterId;
  /** Who learned about it */
  learnedBy: CharacterId[];
  /** Significance of the revelation */
  significance: number;
  /** The ground truth that was revealed */
  truthRevealed: Record<string, unknown>;
}

/**
 * Options for creating a new secret.
 */
export interface CreateSecretOptions {
  type: SecretType;
  groundTruth: Record<string, unknown>;
  initialKnowers: CharacterId[];
  significance?: number;
  revelationProbability?: number;
  relatedEntities?: EntityId[];
  relatedFactions?: FactionId[];
  createdAt: number;
}

/**
 * Suspicion record for tracking character suspicions.
 */
export interface SuspicionRecord {
  characterId: CharacterId;
  secretId: EntityId;
  confidence: number; // 0-100
  basedOn: string[]; // Clues that led to suspicion
  addedAt: number;
}

/**
 * Revelation check result.
 */
export interface RevelationCheckResult {
  shouldReveal: boolean;
  probability: number;
  method: RevelationMethod;
  trigger?: string;
}

/**
 * Clue that can lead to deduction of a secret.
 */
export interface Clue {
  readonly id: EntityId;
  /** What secret this clue relates to */
  readonly secretId: EntityId;
  /** Description of the clue */
  readonly description: string;
  /** How much this clue contributes to deduction (0-1) */
  readonly weight: number;
  /** When the clue was discovered */
  readonly discoveredAt: number;
  /** Who discovered it */
  readonly discoveredBy: CharacterId;
  /** Event that created this clue */
  readonly sourceEventId?: EventId;
}

// =============================================================================
// ID GENERATION
// =============================================================================

let nextSecretId = 0;
let nextClueId = 0;

export function createSecretId(): EntityId {
  return toEntityId(400000 + nextSecretId++);
}

export function createClueId(): EntityId {
  return toEntityId(410000 + nextClueId++);
}

export function resetSecretIdCounters(): void {
  nextSecretId = 0;
  nextClueId = 0;
}
