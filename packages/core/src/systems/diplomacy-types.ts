/**
 * Diplomatic action definitions, preconditions, and outcome structures.
 * Actions are proposed by faction leaders and evaluated against preconditions.
 */

import type { EntityId, FactionId, EventId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import type { DiplomacyComponent } from '../ecs/component.js';

// ── Diplomatic actions ──────────────────────────────────────────────────────

export enum DiplomaticAction {
  FormAlliance = 'form_alliance',
  DeclareWar = 'declare_war',
  ProposeTrade = 'propose_trade',
  ArrangeMarriage = 'arrange_marriage',
  OfferTribute = 'offer_tribute',
  IssueUltimatum = 'issue_ultimatum',
  SignPeace = 'sign_peace',
  FormCoalition = 'form_coalition',
  BreakAlliance = 'break_alliance',
  DemandVassalization = 'demand_vassalization',
}

export const ALL_DIPLOMATIC_ACTIONS: readonly DiplomaticAction[] =
  Object.values(DiplomaticAction);

// ── Action templates ────────────────────────────────────────────────────────

export interface DiplomaticActionTemplate {
  readonly action: DiplomaticAction;
  readonly requiredRelation: number;      // Min relation (-100 to 100) to attempt
  readonly requiredStability: number;     // Min stability (0-100) to attempt
  readonly baseSuccessRate: number;       // 0.0-1.0 base chance
  readonly relationshipImpact: number;    // Change to relations on success
  readonly failureRelationImpact: number; // Change on failure
  readonly causesBelli: boolean;          // Provides war justification
  readonly generatesEvent: boolean;       // Creates a WorldEvent
  readonly eventSubtype: string;          // Event subtype if generates
  readonly eventSignificance: number;     // Event significance (0-100)
  readonly createsTreaty: boolean;        // Whether this creates a treaty
}

export const DIPLOMATIC_TEMPLATES: Readonly<Record<DiplomaticAction, DiplomaticActionTemplate>> = {
  [DiplomaticAction.FormAlliance]: {
    action: DiplomaticAction.FormAlliance,
    requiredRelation: 40,
    requiredStability: 30,
    baseSuccessRate: 0.6,
    relationshipImpact: 30,
    failureRelationImpact: -5,
    causesBelli: false,
    generatesEvent: true,
    eventSubtype: 'faction.alliance_formed',
    eventSignificance: 70,
    createsTreaty: true,
  },
  [DiplomaticAction.DeclareWar]: {
    action: DiplomaticAction.DeclareWar,
    requiredRelation: Number.NEGATIVE_INFINITY, // Can always declare
    requiredStability: 20,
    baseSuccessRate: 1.0, // War declaration always "succeeds" (unilateral)
    relationshipImpact: -80,
    failureRelationImpact: 0,
    causesBelli: false,
    generatesEvent: true,
    eventSubtype: 'faction.war_declared',
    eventSignificance: 90,
    createsTreaty: false,
  },
  [DiplomaticAction.ProposeTrade]: {
    action: DiplomaticAction.ProposeTrade,
    requiredRelation: -20,
    requiredStability: 20,
    baseSuccessRate: 0.7,
    relationshipImpact: 15,
    failureRelationImpact: -3,
    causesBelli: false,
    generatesEvent: true,
    eventSubtype: 'faction.trade_agreement',
    eventSignificance: 40,
    createsTreaty: true,
  },
  [DiplomaticAction.ArrangeMarriage]: {
    action: DiplomaticAction.ArrangeMarriage,
    requiredRelation: 20,
    requiredStability: 40,
    baseSuccessRate: 0.5,
    relationshipImpact: 40,
    failureRelationImpact: -10,
    causesBelli: false,
    generatesEvent: true,
    eventSubtype: 'faction.marriage_arranged',
    eventSignificance: 60,
    createsTreaty: true,
  },
  [DiplomaticAction.OfferTribute]: {
    action: DiplomaticAction.OfferTribute,
    requiredRelation: Number.NEGATIVE_INFINITY,
    requiredStability: 10,
    baseSuccessRate: 0.85,
    relationshipImpact: 25,
    failureRelationImpact: -15,
    causesBelli: false,
    generatesEvent: true,
    eventSubtype: 'faction.tribute_offered',
    eventSignificance: 50,
    createsTreaty: true,
  },
  [DiplomaticAction.IssueUltimatum]: {
    action: DiplomaticAction.IssueUltimatum,
    requiredRelation: Number.NEGATIVE_INFINITY,
    requiredStability: 40,
    baseSuccessRate: 0.3,
    relationshipImpact: -20,
    failureRelationImpact: -40,
    causesBelli: true,
    generatesEvent: true,
    eventSubtype: 'faction.ultimatum_issued',
    eventSignificance: 65,
    createsTreaty: false,
  },
  [DiplomaticAction.SignPeace]: {
    action: DiplomaticAction.SignPeace,
    requiredRelation: Number.NEGATIVE_INFINITY, // Can sign peace with anyone
    requiredStability: 10,
    baseSuccessRate: 0.6,
    relationshipImpact: 40,
    failureRelationImpact: -10,
    causesBelli: false,
    generatesEvent: true,
    eventSubtype: 'faction.peace_signed',
    eventSignificance: 80,
    createsTreaty: true,
  },
  [DiplomaticAction.FormCoalition]: {
    action: DiplomaticAction.FormCoalition,
    requiredRelation: 30,
    requiredStability: 35,
    baseSuccessRate: 0.45,
    relationshipImpact: 25,
    failureRelationImpact: -5,
    causesBelli: false,
    generatesEvent: true,
    eventSubtype: 'faction.coalition_formed',
    eventSignificance: 75,
    createsTreaty: true,
  },
  [DiplomaticAction.BreakAlliance]: {
    action: DiplomaticAction.BreakAlliance,
    requiredRelation: Number.NEGATIVE_INFINITY,
    requiredStability: 20,
    baseSuccessRate: 1.0, // Unilateral
    relationshipImpact: -50,
    failureRelationImpact: 0,
    causesBelli: true,
    generatesEvent: true,
    eventSubtype: 'faction.alliance_broken',
    eventSignificance: 65,
    createsTreaty: false,
  },
  [DiplomaticAction.DemandVassalization]: {
    action: DiplomaticAction.DemandVassalization,
    requiredRelation: Number.NEGATIVE_INFINITY,
    requiredStability: 50,
    baseSuccessRate: 0.2,
    relationshipImpact: -30,
    failureRelationImpact: -50,
    causesBelli: true,
    generatesEvent: true,
    eventSubtype: 'faction.vassalization_demanded',
    eventSignificance: 70,
    createsTreaty: true,
  },
};

// ── Preconditions ───────────────────────────────────────────────────────────

export interface DiplomaticPrecondition {
  check(actor: FactionId, target: FactionId, world: World): boolean;
  readonly reason: string;
}

/**
 * Check if a diplomatic action meets all preconditions.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function checkPreconditions(
  action: DiplomaticAction,
  _actorId: FactionId,
  _targetId: FactionId,
  actorStability: number,
  actorRelation: number,
): { valid: true } | { valid: false; reason: string } {
  const template = DIPLOMATIC_TEMPLATES[action];

  // Check stability requirement
  if (actorStability < template.requiredStability) {
    return {
      valid: false,
      reason: `Insufficient stability (${actorStability} < ${template.requiredStability})`,
    };
  }

  // Check relation requirement
  if (actorRelation < template.requiredRelation) {
    return {
      valid: false,
      reason: `Relations too poor (${actorRelation} < ${template.requiredRelation})`,
    };
  }

  // Action-specific checks
  if (action === DiplomaticAction.BreakAlliance) {
    // Must have an alliance to break (caller should verify)
  }

  if (action === DiplomaticAction.SignPeace) {
    // Must be at war (caller should verify via war state)
  }

  return { valid: true };
}

/**
 * Get the relation between two factions from DiplomacyComponent.
 * Returns 0 (neutral) if no relation exists.
 */
export function getRelation(
  diplomacy: DiplomacyComponent | undefined,
  targetId: FactionId,
): number {
  if (diplomacy === undefined) return 0;
  return diplomacy.relations.get(targetId as number) ?? 0;
}

// ── Outcome ─────────────────────────────────────────────────────────────────

export interface DiplomaticOutcome {
  readonly action: DiplomaticAction;
  readonly actorId: FactionId;
  readonly targetId: FactionId;
  readonly success: boolean;
  readonly relationChange: number;
  readonly stabilityChange: number;
  readonly generatedTreatyId?: EntityId;
  readonly causeEventId?: EventId;
}

/**
 * Calculate the success probability for a diplomatic action.
 * Modifies base rate by relation, stability, and diplomatic reputation.
 */
export function calculateSuccessRate(
  action: DiplomaticAction,
  actorRelation: number,
  actorDiplomaticReputation: number, // 0-100
): number {
  const template = DIPLOMATIC_TEMPLATES[action];
  let rate = template.baseSuccessRate;

  // Relations modifier: +/- 20% based on current relations
  const relationMod = (actorRelation / 100) * 0.2;
  rate += relationMod;

  // Reputation modifier: +/- 15% based on diplomatic reputation
  const repMod = ((actorDiplomaticReputation - 50) / 100) * 0.15;
  rate += repMod;

  return Math.max(0.05, Math.min(0.95, rate));
}
