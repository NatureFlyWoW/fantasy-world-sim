/**
 * Treaty system types — agreements between factions with enforceable terms.
 * Treaties can have multiple terms, expire, and be violated.
 */

import type { EntityId, FactionId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';

// ── Treaty term types ───────────────────────────────────────────────────────

export enum TreatyTermType {
  MutualDefense = 'mutual_defense',
  TradeExclusivity = 'trade_exclusivity',
  NonAggression = 'non_aggression',
  Tributary = 'tributary',
  DemilitarizedZone = 'demilitarized_zone',
  CulturalExchange = 'cultural_exchange',
  MarriageContract = 'marriage_contract',
  TerritorialClaim = 'territorial_claim',
  ResourceSharing = 'resource_sharing',
}

export const ALL_TREATY_TERM_TYPES: readonly TreatyTermType[] =
  Object.values(TreatyTermType);

// ── Term-specific parameters ────────────────────────────────────────────────

export interface MutualDefenseParams {
  readonly responseTimeInTicks: number;
  readonly militaryCommitment: number; // 0-100 percentage
}

export interface TradeExclusivityParams {
  readonly resources: readonly string[];
  readonly duration: number; // Ticks
}

export interface NonAggressionParams {
  readonly duration: number; // Ticks
}

export interface TributaryParams {
  readonly tributeAmount: number;
  readonly paymentFrequency: number; // Ticks between payments
  readonly protectorId: FactionId;
  readonly vassalId: FactionId;
}

export interface DemilitarizedZoneParams {
  readonly regionIds: readonly number[];
  readonly bufferDistance: number; // Tiles
}

export interface CulturalExchangeParams {
  readonly techSharing: boolean;
  readonly scholarExchange: boolean;
}

export interface MarriageContractParams {
  readonly spouse1Id: EntityId;
  readonly spouse2Id: EntityId;
  readonly successionClauses: readonly string[];
  readonly inheritanceTerms: readonly string[];
}

export interface TerritorialClaimParams {
  readonly recognizedOwner: FactionId;
  readonly regionIds: readonly number[];
}

export interface ResourceSharingParams {
  readonly resources: readonly string[];
  readonly sharingRatio: number; // 0-1
}

export type TreatyTermParams =
  | MutualDefenseParams
  | TradeExclusivityParams
  | NonAggressionParams
  | TributaryParams
  | DemilitarizedZoneParams
  | CulturalExchangeParams
  | MarriageContractParams
  | TerritorialClaimParams
  | ResourceSharingParams;

// ── Treaty term ─────────────────────────────────────────────────────────────

export interface TreatyTerm {
  readonly type: TreatyTermType;
  readonly parties: readonly FactionId[];
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly enforceability: number; // 0-100, how easy to detect violations
}

// ── Treaty ──────────────────────────────────────────────────────────────────

export interface Treaty {
  readonly id: EntityId;
  readonly name: string;
  readonly parties: readonly FactionId[];
  readonly terms: readonly TreatyTerm[];
  readonly signedAt: WorldTime;
  readonly duration?: number; // Ticks until expiry, undefined = permanent
  violations: TreatyViolation[];
}

// ── Treaty violation ────────────────────────────────────────────────────────

export interface TreatyViolation {
  readonly treatyId: EntityId;
  readonly violatorId: FactionId;
  readonly termType: TreatyTermType;
  readonly detectedAt: WorldTime;
  readonly severity: number; // 0-100
  readonly evidence: string;
  readonly witnessIds: readonly FactionId[];
}

// ── Treaty ID generation ────────────────────────────────────────────────────

let nextTreatyId = 10000; // Start high to avoid collision with entity IDs

export function createTreatyId(): EntityId {
  return nextTreatyId++ as EntityId;
}

export function resetTreatyIdCounter(): void {
  nextTreatyId = 10000;
}

// ── Treaty creation helpers ─────────────────────────────────────────────────

export function createNonAggressionTerm(
  parties: readonly FactionId[],
  durationTicks: number,
): TreatyTerm {
  return {
    type: TreatyTermType.NonAggression,
    parties,
    parameters: { duration: durationTicks } satisfies NonAggressionParams,
    enforceability: 90, // Easy to detect war
  };
}

export function createMutualDefenseTerm(
  parties: readonly FactionId[],
  responseTime: number,
  commitment: number,
): TreatyTerm {
  return {
    type: TreatyTermType.MutualDefense,
    parties,
    parameters: {
      responseTimeInTicks: responseTime,
      militaryCommitment: commitment,
    } satisfies MutualDefenseParams,
    enforceability: 70, // Harder to prove non-response
  };
}

export function createTributaryTerm(
  protectorId: FactionId,
  vassalId: FactionId,
  amount: number,
  frequency: number,
): TreatyTerm {
  return {
    type: TreatyTermType.Tributary,
    parties: [protectorId, vassalId],
    parameters: {
      tributeAmount: amount,
      paymentFrequency: frequency,
      protectorId,
      vassalId,
    } satisfies TributaryParams,
    enforceability: 85, // Payment records
  };
}

export function createMarriageContractTerm(
  parties: readonly FactionId[],
  spouse1: EntityId,
  spouse2: EntityId,
  successionClauses: readonly string[],
  inheritanceTerms: readonly string[],
): TreatyTerm {
  return {
    type: TreatyTermType.MarriageContract,
    parties,
    parameters: {
      spouse1Id: spouse1,
      spouse2Id: spouse2,
      successionClauses,
      inheritanceTerms,
    } satisfies MarriageContractParams,
    enforceability: 60, // Subjective interpretation
  };
}

export function createDemilitarizedZoneTerm(
  parties: readonly FactionId[],
  regionIds: readonly number[],
  buffer: number,
): TreatyTerm {
  return {
    type: TreatyTermType.DemilitarizedZone,
    parties,
    parameters: {
      regionIds,
      bufferDistance: buffer,
    } satisfies DemilitarizedZoneParams,
    enforceability: 75, // Can observe troop movements
  };
}

/**
 * Create a complete treaty from terms.
 */
export function createTreaty(
  name: string,
  parties: readonly FactionId[],
  terms: readonly TreatyTerm[],
  signedAt: WorldTime,
  duration?: number,
): Treaty {
  const treaty: Treaty = {
    id: createTreatyId(),
    name,
    parties,
    terms,
    signedAt,
    violations: [],
  };
  if (duration !== undefined) {
    (treaty as { duration: number }).duration = duration;
  }
  return treaty;
}

/**
 * Check if a treaty has expired.
 */
export function isTreatyExpired(treaty: Treaty, currentTicks: number): boolean {
  if (treaty.duration === undefined) return false;

  const signedTicks =
    (treaty.signedAt.year - 1) * 360 +
    (treaty.signedAt.month - 1) * 30 +
    (treaty.signedAt.day - 1);

  return currentTicks >= signedTicks + treaty.duration;
}

/**
 * Get severity rating for a term type violation.
 * More serious terms have higher base severity.
 */
export function getViolationBaseSeverity(termType: TreatyTermType): number {
  switch (termType) {
    case TreatyTermType.NonAggression:
      return 90; // Direct attack is very serious
    case TreatyTermType.MutualDefense:
      return 85; // Abandoning ally is serious
    case TreatyTermType.Tributary:
      return 60; // Financial default
    case TreatyTermType.DemilitarizedZone:
      return 70; // Military provocation
    case TreatyTermType.TradeExclusivity:
      return 50; // Commercial violation
    case TreatyTermType.CulturalExchange:
      return 30; // Minor breach
    case TreatyTermType.MarriageContract:
      return 75; // Personal/political insult
    case TreatyTermType.TerritorialClaim:
      return 80; // Land dispute
    case TreatyTermType.ResourceSharing:
      return 55; // Economic breach
  }
}
