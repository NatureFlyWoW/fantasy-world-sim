/**
 * NarrativeArcDetector identifies rising-action patterns in event chains.
 * From design doc Section 7.4: Detect when a cascade forms a narrative arc
 * and mark it for special narrative treatment.
 */

import type { WorldEvent } from './types.js';
import type { EventId } from '../ecs/types.js';
import type { EventLog } from './event-log.js';

/**
 * Phases of a narrative arc.
 */
export enum ArcPhase {
  Setup = 'Setup',
  RisingAction = 'RisingAction',
  Climax = 'Climax',
  FallingAction = 'FallingAction',
  Resolution = 'Resolution',
}

/**
 * A detected narrative arc.
 */
export interface NarrativeArc {
  /** Unique identifier for this arc */
  readonly id: number;
  /** Events in the arc, in chronological order */
  readonly events: readonly WorldEvent[];
  /** Current phase of the arc */
  readonly phase: ArcPhase;
  /** The event with the highest significance (climax) */
  readonly climaxEvent: WorldEvent | undefined;
  /** Overall arc significance (max significance in chain) */
  readonly peakSignificance: number;
  /** Number of domain transitions in the arc */
  readonly domainTransitions: number;
}

let nextArcId = 0;

/**
 * Reset arc ID counter (for testing).
 */
export function resetArcIdCounter(): void {
  nextArcId = 0;
}

export class NarrativeArcDetector {
  /** Minimum number of events to form an arc */
  private readonly minArcLength: number;
  /** Minimum significance increase to count as "rising" */
  private readonly risingThreshold: number;

  constructor(options?: {
    minArcLength?: number;
    risingThreshold?: number;
  }) {
    this.minArcLength = options?.minArcLength ?? 3;
    this.risingThreshold = options?.risingThreshold ?? 5;
  }

  /**
   * Analyze an event's causal chain to detect a narrative arc.
   * Walks backward from the event through its causes to find patterns.
   */
  detectArc(event: WorldEvent, eventLog: EventLog): NarrativeArc | undefined {
    // Build the causal chain backward
    const chain = this.buildChain(event, eventLog);

    if (chain.length < this.minArcLength) {
      return undefined;
    }

    // Analyze the significance pattern
    const phase = this.classifyPhase(chain);
    if (phase === undefined) {
      return undefined;
    }

    const climaxEvent = this.findClimax(chain);
    const domainTransitions = this.countDomainTransitions(chain);

    return {
      id: nextArcId++,
      events: chain,
      phase,
      climaxEvent,
      peakSignificance: climaxEvent?.significance ?? 0,
      domainTransitions,
    };
  }

  /**
   * Analyze a cascade forward from an event to detect an emerging arc.
   * Uses the event's consequences rather than causes.
   */
  detectForwardArc(event: WorldEvent, eventLog: EventLog): NarrativeArc | undefined {
    const chain = this.buildForwardChain(event, eventLog);

    if (chain.length < this.minArcLength) {
      return undefined;
    }

    const phase = this.classifyPhase(chain);
    if (phase === undefined) {
      return undefined;
    }

    const climaxEvent = this.findClimax(chain);
    const domainTransitions = this.countDomainTransitions(chain);

    return {
      id: nextArcId++,
      events: chain,
      phase,
      climaxEvent,
      peakSignificance: climaxEvent?.significance ?? 0,
      domainTransitions,
    };
  }

  /**
   * Classify the current phase of a chain based on significance pattern.
   */
  classifyPhase(chain: readonly WorldEvent[]): ArcPhase | undefined {
    if (chain.length < this.minArcLength) {
      return undefined;
    }

    const significances = chain.map((e) => e.significance);
    const peakIndex = this.findPeakIndex(significances);

    // Check for rising action: each step should be increasingly significant
    const hasRising = this.hasRisingSection(significances, 0, peakIndex);

    if (!hasRising) {
      return undefined;
    }

    // Determine phase based on where the peak is relative to chain length
    const relativePosition = peakIndex / (chain.length - 1);

    // If peak is the last event, we're still in rising action or at climax
    if (peakIndex === chain.length - 1) {
      if (chain.length <= this.minArcLength) {
        return ArcPhase.RisingAction;
      }
      return ArcPhase.Climax;
    }

    // If there's a decline after the peak
    const hasFalling = this.hasFallingSection(significances, peakIndex, chain.length - 1);

    if (hasFalling && relativePosition < 0.8) {
      // Peak is in middle and there's a decline
      if (relativePosition <= 0.3) {
        return ArcPhase.FallingAction;
      }
      const remainingRatio = (chain.length - 1 - peakIndex) / chain.length;
      if (remainingRatio > 0.3) {
        return ArcPhase.Resolution;
      }
      return ArcPhase.FallingAction;
    }

    return ArcPhase.RisingAction;
  }

  /**
   * Build a causal chain backward from an event.
   * Returns events in chronological order (earliest first).
   */
  private buildChain(event: WorldEvent, eventLog: EventLog): WorldEvent[] {
    const chain: WorldEvent[] = [event];
    const visited = new Set<EventId>([event.id]);

    let current = event;
    while (current.causes.length > 0) {
      // Follow the first (primary) cause
      const causeId = current.causes[0];
      if (causeId === undefined || visited.has(causeId)) {
        break;
      }

      const causeEvent = eventLog.getById(causeId);
      if (causeEvent === undefined) {
        break;
      }

      visited.add(causeId);
      chain.unshift(causeEvent); // Add to front for chronological order
      current = causeEvent;
    }

    return chain;
  }

  /**
   * Build a consequence chain forward from an event.
   * Returns events in chronological order.
   */
  private buildForwardChain(event: WorldEvent, eventLog: EventLog): WorldEvent[] {
    const chain: WorldEvent[] = [event];
    const visited = new Set<EventId>([event.id]);

    let current = event;
    while (current.consequences.length > 0) {
      // Follow the first (primary) consequence
      const consequenceId = current.consequences[0];
      if (consequenceId === undefined || visited.has(consequenceId)) {
        break;
      }

      const consequenceEvent = eventLog.getById(consequenceId);
      if (consequenceEvent === undefined) {
        break;
      }

      visited.add(consequenceId);
      chain.push(consequenceEvent);
      current = consequenceEvent;
    }

    return chain;
  }

  /**
   * Find the index of the peak significance in the chain.
   */
  private findPeakIndex(significances: number[]): number {
    let maxIndex = 0;
    let maxValue = 0;

    for (let i = 0; i < significances.length; i++) {
      const sig = significances[i];
      if (sig !== undefined && sig > maxValue) {
        maxValue = sig;
        maxIndex = i;
      }
    }

    return maxIndex;
  }

  /**
   * Find the climax event (highest significance).
   */
  private findClimax(chain: readonly WorldEvent[]): WorldEvent | undefined {
    let climax: WorldEvent | undefined;
    let maxSig = -1;

    for (const event of chain) {
      if (event.significance > maxSig) {
        maxSig = event.significance;
        climax = event;
      }
    }

    return climax;
  }

  /**
   * Check if there's a rising significance section between two indices.
   */
  private hasRisingSection(significances: number[], from: number, to: number): boolean {
    if (to <= from) return false;

    let risingSteps = 0;
    for (let i = from; i < to; i++) {
      const current = significances[i];
      const next = significances[i + 1];
      if (current !== undefined && next !== undefined && next >= current + this.risingThreshold) {
        risingSteps++;
      }
    }

    // Need at least one rising step to count
    return risingSteps > 0;
  }

  /**
   * Check if there's a falling significance section between two indices.
   */
  private hasFallingSection(significances: number[], from: number, to: number): boolean {
    if (to <= from) return false;

    for (let i = from; i < to; i++) {
      const current = significances[i];
      const next = significances[i + 1];
      if (current !== undefined && next !== undefined && next < current) {
        return true;
      }
    }

    return false;
  }

  /**
   * Count the number of domain (category) transitions in a chain.
   */
  private countDomainTransitions(chain: readonly WorldEvent[]): number {
    let transitions = 0;
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1];
      const current = chain[i];
      if (prev !== undefined && current !== undefined && prev.category !== current.category) {
        transitions++;
      }
    }
    return transitions;
  }
}
