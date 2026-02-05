/**
 * TreatyEnforcement — monitors treaties, detects violations, and handles consequences.
 * Integrates with ReputationSystem to damage reputation on violations.
 */

import type { EntityId, FactionId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import type { WorldTime } from '../time/types.js';
import { worldTimeToTicks } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { WorldEvent } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { ReputationDimension } from './reputation-types.js';
import type { ReputationSystem } from './reputation-system.js';
import {
  TreatyTermType,
  isTreatyExpired,
  getViolationBaseSeverity,
} from './treaty-types.js';
import type { Treaty, TreatyTerm, TreatyViolation } from './treaty-types.js';

// ── Violation detection rules ───────────────────────────────────────────────

interface ViolationDetector {
  (
    treaty: Treaty,
    term: TreatyTerm,
    recentEvents: readonly WorldEvent[],
    world: World,
    currentTime: WorldTime,
  ): TreatyViolation | null;
}

function detectNonAggressionViolation(
  treaty: Treaty,
  term: TreatyTerm,
  recentEvents: readonly WorldEvent[],
  _world: World,
  currentTime: WorldTime,
): TreatyViolation | null {
  for (const event of recentEvents) {
    if (
      event.subtype === 'faction.war_declared' ||
      event.subtype === 'faction.attacked'
    ) {
      const attacker = event.data['attacker'] as FactionId | undefined;
      const defender = event.data['defender'] as FactionId | undefined;

      if (attacker === undefined || defender === undefined) continue;

      // Check if both attacker and defender are signatories
      if (term.parties.includes(attacker) && term.parties.includes(defender)) {
        return {
          treatyId: treaty.id,
          violatorId: attacker,
          termType: TreatyTermType.NonAggression,
          detectedAt: currentTime,
          severity: getViolationBaseSeverity(TreatyTermType.NonAggression),
          evidence: `Attacked treaty signatory ${defender as number}`,
          witnessIds: term.parties.filter(p => p !== attacker),
        };
      }
    }
  }
  return null;
}

function detectMutualDefenseViolation(
  treaty: Treaty,
  term: TreatyTerm,
  recentEvents: readonly WorldEvent[],
  _world: World,
  currentTime: WorldTime,
): TreatyViolation | null {
  // Find attacks against signatories
  for (const event of recentEvents) {
    if (event.subtype === 'faction.attacked' || event.subtype === 'faction.war_declared') {
      const defender = event.data['defender'] as FactionId | undefined;
      if (defender === undefined || !term.parties.includes(defender)) continue;

      // Check if any ally responded (would be a separate event)
      // For simplicity, we check if there's a corresponding response event
      const responseTime = (term.parameters['responseTimeInTicks'] as number | undefined) ?? 30;
      const attackTime = event.timestamp;

      // Look for ally response within window
      const allyResponded = recentEvents.some(e => {
        if (e.subtype !== 'faction.war_declared') return false;
        if (e.timestamp < attackTime || e.timestamp > attackTime + responseTime) return false;
        const allyAttacker = e.data['attacker'] as FactionId | undefined;
        const allyDefenderTarget = e.data['defender'] as FactionId | undefined;
        // Ally must attack the aggressor
        return (
          allyAttacker !== undefined &&
          term.parties.includes(allyAttacker) &&
          allyAttacker !== defender &&
          allyDefenderTarget === event.data['attacker']
        );
      });

      if (!allyResponded) {
        // Find which ally failed to respond
        for (const ally of term.parties) {
          if (ally === defender) continue;
          // This ally should have responded but didn't
          return {
            treatyId: treaty.id,
            violatorId: ally,
            termType: TreatyTermType.MutualDefense,
            detectedAt: currentTime,
            severity: getViolationBaseSeverity(TreatyTermType.MutualDefense),
            evidence: `Failed to defend ally ${defender as number} within ${responseTime} ticks`,
            witnessIds: [defender],
          };
        }
      }
    }
  }
  return null;
}

function detectTributaryViolation(
  treaty: Treaty,
  term: TreatyTerm,
  recentEvents: readonly WorldEvent[],
  _world: World,
  currentTime: WorldTime,
): TreatyViolation | null {
  const vassalId = term.parameters['vassalId'] as FactionId | undefined;
  const protectorId = term.parameters['protectorId'] as FactionId | undefined;
  const frequency = term.parameters['paymentFrequency'] as number | undefined;

  if (vassalId === undefined || protectorId === undefined || frequency === undefined) {
    return null;
  }

  // Check if a tribute payment was due and not made
  const currentTicks = worldTimeToTicks(currentTime);
  const signedTicks = worldTimeToTicks(treaty.signedAt);
  const ticksSinceSigned = currentTicks - signedTicks;

  // Only check if we're past the first payment period
  if (ticksSinceSigned < frequency) return null;

  // Payment should occur within the frequency period
  const paymentsMade = recentEvents.filter(
    e =>
      e.subtype === 'faction.tribute_paid' &&
      e.data['from'] === vassalId &&
      e.data['to'] === protectorId,
  ).length;

  // Expected payments in the recent window
  const expectedPayments = 1; // Simplified: expect 1 payment per check period

  if (paymentsMade < expectedPayments) {
    return {
      treatyId: treaty.id,
      violatorId: vassalId,
      termType: TreatyTermType.Tributary,
      detectedAt: currentTime,
      severity: getViolationBaseSeverity(TreatyTermType.Tributary),
      evidence: `Failed to pay tribute to ${protectorId as number}`,
      witnessIds: [protectorId],
    };
  }

  return null;
}

// Map term types to their detection functions
const VIOLATION_DETECTORS: ReadonlyMap<TreatyTermType, ViolationDetector> = new Map([
  [TreatyTermType.NonAggression, detectNonAggressionViolation],
  [TreatyTermType.MutualDefense, detectMutualDefenseViolation],
  [TreatyTermType.Tributary, detectTributaryViolation],
  // Other term types can be added as needed
]);

// ── TreatyEnforcement class ─────────────────────────────────────────────────

export class TreatyEnforcement {
  private treaties: Map<number, Treaty> = new Map();
  private violationHistory: Map<number, TreatyViolation[]> = new Map(); // factionId → violations

  /**
   * Register a new treaty for enforcement.
   */
  registerTreaty(treaty: Treaty): void {
    this.treaties.set(treaty.id as number, treaty);
  }

  /**
   * Remove a treaty (e.g., when it expires or is annulled).
   */
  removeTreaty(treatyId: EntityId): boolean {
    return this.treaties.delete(treatyId as number);
  }

  /**
   * Get a treaty by ID.
   */
  getTreaty(treatyId: EntityId): Treaty | undefined {
    return this.treaties.get(treatyId as number);
  }

  /**
   * Get all active treaties involving a faction.
   */
  getTreatiesForFaction(factionId: FactionId): readonly Treaty[] {
    const result: Treaty[] = [];
    for (const treaty of this.treaties.values()) {
      if (treaty.parties.includes(factionId)) {
        result.push(treaty);
      }
    }
    return result;
  }

  /**
   * Check all treaties for violations based on recent events.
   * Returns all detected violations.
   */
  checkViolations(
    recentEvents: readonly WorldEvent[],
    world: World,
    currentTime: WorldTime,
  ): TreatyViolation[] {
    const violations: TreatyViolation[] = [];

    for (const treaty of this.treaties.values()) {
      for (const term of treaty.terms) {
        const detector = VIOLATION_DETECTORS.get(term.type);
        if (detector === undefined) continue;

        const violation = detector(treaty, term, recentEvents, world, currentTime);
        if (violation !== null) {
          violations.push(violation);
          treaty.violations.push(violation);

          // Track in faction history
          let history = this.violationHistory.get(violation.violatorId as number);
          if (history === undefined) {
            history = [];
            this.violationHistory.set(violation.violatorId as number, history);
          }
          history.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Handle a detected violation — emit diplomatic crisis event, damage reputation.
   */
  onViolation(
    violation: TreatyViolation,
    reputationSystem: ReputationSystem,
    _world: World,
    clock: WorldClock,
    events: EventBus,
  ): void {
    // Damage reputation with all witnesses
    for (const witnessId of violation.witnessIds) {
      // Political reputation damage
      reputationSystem.setDirectObservation(
        witnessId,
        violation.violatorId,
        ReputationDimension.Political,
        -violation.severity,
        clock.currentTime,
      );

      // Moral reputation damage (seen as untrustworthy)
      reputationSystem.setDirectObservation(
        witnessId,
        violation.violatorId,
        ReputationDimension.Moral,
        Math.round(-violation.severity * 0.6),
        clock.currentTime,
      );
    }

    // Emit diplomatic crisis event
    const crisisEvent = createEvent({
      category: EventCategory.Political,
      subtype: 'faction.treaty_violated',
      timestamp: clock.currentTick,
      participants: [violation.violatorId, ...violation.witnessIds],
      significance: Math.min(100, violation.severity + 10),
      data: {
        treatyId: violation.treatyId,
        termType: violation.termType,
        evidence: violation.evidence,
        severity: violation.severity,
      },
    });

    events.emit(crisisEvent);
  }

  /**
   * Get diplomatic reputation for a faction based on treaty compliance history.
   * Returns 0-100 where 100 = perfect compliance, 0 = serial violator.
   */
  getDiplomaticReputation(factionId: FactionId): number {
    const history = this.violationHistory.get(factionId as number);
    if (history === undefined || history.length === 0) {
      return 100; // No violations = perfect reputation
    }

    // Each violation reduces reputation based on severity
    let totalPenalty = 0;
    for (const violation of history) {
      totalPenalty += violation.severity * 0.5; // 50% of severity as penalty
    }

    return Math.max(0, Math.round(100 - totalPenalty));
  }

  /**
   * Expire old treaties and clean up. Returns IDs of expired treaties.
   */
  expireTreaties(currentTime: WorldTime): EntityId[] {
    const currentTicks = worldTimeToTicks(currentTime);
    const expired: EntityId[] = [];

    for (const [id, treaty] of this.treaties) {
      if (isTreatyExpired(treaty, currentTicks)) {
        expired.push(id as EntityId);
        this.treaties.delete(id);
      }
    }

    return expired;
  }

  /**
   * Check if two factions have a specific type of treaty term active.
   */
  hasActiveTerm(
    factionA: FactionId,
    factionB: FactionId,
    termType: TreatyTermType,
  ): boolean {
    for (const treaty of this.treaties.values()) {
      if (!treaty.parties.includes(factionA) || !treaty.parties.includes(factionB)) {
        continue;
      }
      for (const term of treaty.terms) {
        if (term.type === termType) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get all violations committed by a faction.
   */
  getViolationHistory(factionId: FactionId): readonly TreatyViolation[] {
    return this.violationHistory.get(factionId as number) ?? [];
  }

  /**
   * Get total number of active treaties.
   */
  get treatyCount(): number {
    return this.treaties.size;
  }

  /**
   * Clear all treaties (for testing).
   */
  clear(): void {
    this.treaties.clear();
    this.violationHistory.clear();
  }
}
