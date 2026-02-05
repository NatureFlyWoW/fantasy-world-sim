/**
 * CascadeEngine resolves event consequence chains.
 *
 * When an event resolves, evaluates its ConsequenceRules:
 * 1. Calculate dynamic probability with dampening and cross-domain modifiers
 * 2. Roll against probability to determine if consequence fires
 * 3. Queue consequences with temporal offsets
 * 4. Track full cause-effect graph
 * 5. Enforce maximum cascade depth
 */

import type { WorldEvent, ConsequenceRule } from './types.js';
import { createEvent, linkConsequence } from './event-factory.js';
import { EventBus } from './event-bus.js';
import { EventLog } from './event-log.js';
import {
  calculateDampenedProbability,
  adjustDampeningForSignificance,
  shouldContinueCascade,
} from './dampening.js';
import { getTransitionModifier } from './cross-domain-rules.js';

/**
 * A pending consequence waiting to fire at a future tick.
 */
export interface PendingConsequence {
  /** The rule that generated this consequence */
  readonly rule: ConsequenceRule;
  /** The event that caused this consequence */
  readonly causeEvent: WorldEvent;
  /** Tick when this consequence should fire */
  readonly fireTick: number;
  /** Depth in the cascade chain */
  readonly chainDepth: number;
  /** Effective probability after dampening */
  readonly effectiveProbability: number;
}

/**
 * Result of processing a single tick's cascade resolution.
 */
export interface CascadeResult {
  /** Events that were generated this tick */
  readonly eventsGenerated: WorldEvent[];
  /** Number of consequences still pending for future ticks */
  readonly pendingCount: number;
  /** Maximum chain depth reached */
  readonly maxDepthReached: number;
}

/**
 * Random number generator function type (injectable for testing).
 */
export type RandomFn = () => number;

export class CascadeEngine {
  private pendingConsequences: PendingConsequence[] = [];
  private maxCascadeDepth: number;
  private randomFn: RandomFn;

  constructor(
    private readonly eventBus: EventBus,
    private readonly eventLog: EventLog,
    options?: {
      maxCascadeDepth?: number;
      randomFn?: RandomFn;
    }
  ) {
    this.maxCascadeDepth = options?.maxCascadeDepth ?? 10;
    this.randomFn = options?.randomFn ?? Math.random;
  }

  /**
   * Process an event: evaluate its ConsequenceRules and schedule consequences.
   * Called when an event is resolved during Step 10 (EVENT RESOLUTION).
   */
  processEvent(event: WorldEvent, currentTick: number, chainDepth = 0): void {
    if (chainDepth >= this.maxCascadeDepth) {
      return;
    }

    for (const rule of event.consequencePotential) {
      this.evaluateRule(event, rule, currentTick, chainDepth);
    }
  }

  /**
   * Evaluate a single ConsequenceRule against the current state.
   */
  private evaluateRule(
    causeEvent: WorldEvent,
    rule: ConsequenceRule,
    currentTick: number,
    chainDepth: number
  ): void {
    // Apply significance-adjusted dampening
    const adjustedDampening = adjustDampeningForSignificance(
      rule.dampening,
      causeEvent.significance
    );

    // Calculate dampened probability
    let effectiveProbability = calculateDampenedProbability(
      rule.baseProbability,
      adjustedDampening,
      chainDepth
    );

    // Apply cross-domain modifier if consequence is in a different category
    if (rule.category !== causeEvent.category) {
      const modifier = getTransitionModifier(causeEvent.category, rule.category);
      if (modifier !== undefined) {
        effectiveProbability *= modifier;
      } else {
        // No defined transition path: heavily reduce probability
        effectiveProbability *= 0.1;
      }
    }

    // Check if probability is too low to bother
    if (!shouldContinueCascade(effectiveProbability)) {
      return;
    }

    // Calculate fire tick with temporal offset
    const delay = rule.delayTicks + (causeEvent.temporalOffset ?? 0);
    const fireTick = currentTick + delay;

    // Schedule the consequence
    this.pendingConsequences.push({
      rule,
      causeEvent,
      fireTick,
      chainDepth: chainDepth + 1,
      effectiveProbability,
    });
  }

  /**
   * Resolve all consequences that should fire on the current tick.
   * Returns events that were generated.
   */
  resolveTick(currentTick: number): CascadeResult {
    const eventsGenerated: WorldEvent[] = [];
    let maxDepthReached = 0;

    // Partition into due-now and still-pending
    const dueNow: PendingConsequence[] = [];
    const stillPending: PendingConsequence[] = [];

    for (const pending of this.pendingConsequences) {
      if (pending.fireTick <= currentTick) {
        dueNow.push(pending);
      } else {
        stillPending.push(pending);
      }
    }

    this.pendingConsequences = stillPending;

    // Process due consequences
    for (const pending of dueNow) {
      if (pending.chainDepth > maxDepthReached) {
        maxDepthReached = pending.chainDepth;
      }

      // Roll against effective probability
      const roll = this.randomFn();
      if (roll >= pending.effectiveProbability) {
        continue; // Consequence didn't fire
      }

      // Create the consequence event
      const consequenceEvent = createEvent({
        category: pending.rule.category,
        subtype: pending.rule.eventSubtype,
        timestamp: currentTick,
        participants: [...pending.causeEvent.participants],
        significance: this.calculateConsequenceSignificance(
          pending.causeEvent.significance,
          pending.chainDepth
        ),
        causes: [pending.causeEvent.id],
      });

      // Link in the cause-effect graph
      linkConsequence(pending.causeEvent, consequenceEvent);

      // Emit and log
      this.eventBus.emit(consequenceEvent);
      this.eventLog.append(consequenceEvent);
      eventsGenerated.push(consequenceEvent);

      // Recursively process the new event's consequences
      this.processEvent(consequenceEvent, currentTick, pending.chainDepth);
    }

    return {
      eventsGenerated,
      pendingCount: this.pendingConsequences.length,
      maxDepthReached,
    };
  }

  /**
   * Calculate significance for a consequence event.
   * Consequences are generally slightly less significant than their cause,
   * decaying further at deeper chain depths.
   */
  private calculateConsequenceSignificance(
    causeSignificance: number,
    chainDepth: number
  ): number {
    // Reduce by 10% per chain depth, minimum 5
    const reduction = chainDepth * 0.1;
    const significance = causeSignificance * (1 - reduction);
    return Math.max(5, Math.round(significance));
  }

  /**
   * Get all pending consequences.
   */
  getPendingConsequences(): readonly PendingConsequence[] {
    return this.pendingConsequences;
  }

  /**
   * Get pending consequences count.
   */
  getPendingCount(): number {
    return this.pendingConsequences.length;
  }

  /**
   * Get the maximum cascade depth setting.
   */
  getMaxCascadeDepth(): number {
    return this.maxCascadeDepth;
  }

  /**
   * Set the maximum cascade depth.
   */
  setMaxCascadeDepth(depth: number): void {
    this.maxCascadeDepth = depth;
  }

  /**
   * Clear all pending consequences (for testing).
   */
  clear(): void {
    this.pendingConsequences = [];
  }
}
