/**
 * WorldFingerprintCalculator — computes a composite identity signature for the world.
 *
 * The "World DNA" captures the unique character of a generated world:
 * domain balance, civilization palette, volatility timeline, magic curve,
 * population trend, and a complexity score derived from cascade chains.
 */

import { EventCategory } from '../events/types.js';
import type { WorldEvent } from '../events/types.js';
import type { EventLog } from '../events/event-log.js';
import type { World } from '../ecs/world.js';
import type { FactionId } from '../ecs/types.js';
/**
 * The six domains that define a world's character balance.
 */
export type FingerprintDomain =
  | 'Warfare'
  | 'Magic'
  | 'Religion'
  | 'Commerce'
  | 'Scholarship'
  | 'Diplomacy';

/**
 * All fingerprint domains in display order.
 */
export const ALL_DOMAINS: readonly FingerprintDomain[] = [
  'Warfare',
  'Magic',
  'Religion',
  'Commerce',
  'Scholarship',
  'Diplomacy',
];

/**
 * A single faction's contribution to the civilization palette.
 */
export interface CivPaletteEntry {
  readonly factionId: FactionId;
  readonly proportion: number;
  readonly color: string;
}

/**
 * Complete world fingerprint — the identity signature of this world.
 */
export interface WorldFingerprint {
  /** 6 domains, each scored 0-100 based on event distribution */
  readonly domainBalance: Map<FingerprintDomain, number>;
  /** Faction proportions with colors for the civilization palette bar */
  readonly civilizationPalette: readonly CivPaletteEntry[];
  /** Conflict intensity per century (normalized 0-100) */
  readonly volatilityTimeline: readonly number[];
  /** Magic prevalence per century (normalized 0-100) */
  readonly magicCurve: readonly number[];
  /** Total population per century (raw counts) */
  readonly populationTrend: readonly number[];
  /** Overall complexity 0-100 from cascade depth and cross-domain arcs */
  readonly complexityScore: number;
}

/**
 * Ticks per year in the simulation calendar (12 months × 30 days).
 */
const TICKS_PER_YEAR = 360;

/**
 * Ticks per century.
 */
const TICKS_PER_CENTURY = TICKS_PER_YEAR * 100;

/**
 * Colors assigned to factions in palette order.
 */
const FACTION_COLORS: readonly string[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'magenta',
  'cyan',
  'white',
  '#ff8800',
  '#88ff00',
  '#0088ff',
  '#ff0088',
  '#8800ff',
];

/**
 * Map EventCategory values to fingerprint domains.
 */
function categoryToDomain(category: EventCategory): FingerprintDomain | undefined {
  switch (category) {
    case EventCategory.Military:
      return 'Warfare';
    case EventCategory.Magical:
      return 'Magic';
    case EventCategory.Religious:
      return 'Religion';
    case EventCategory.Economic:
      return 'Commerce';
    case EventCategory.Scientific:
    case EventCategory.Cultural:
      return 'Scholarship';
    case EventCategory.Political:
      return 'Diplomacy';
    default:
      return undefined;
  }
}

/**
 * Calculate the number of centuries covered by the event log.
 */
function getCenturyCount(events: readonly WorldEvent[]): number {
  if (events.length === 0) return 0;
  let maxTick = 0;
  for (const event of events) {
    if (event.timestamp > maxTick) {
      maxTick = event.timestamp;
    }
  }
  return Math.max(1, Math.ceil((maxTick + 1) / TICKS_PER_CENTURY));
}

/**
 * Get the century index for a tick number.
 */
function tickToCentury(tick: number): number {
  return Math.floor(tick / TICKS_PER_CENTURY);
}

export class WorldFingerprintCalculator {
  /**
   * Compute the full world fingerprint from world state and event history.
   */
  calculateFingerprint(world: World, eventLog: EventLog): WorldFingerprint {
    const allEvents = eventLog.getAll();

    return {
      domainBalance: this.calculateDomainBalance(allEvents),
      civilizationPalette: this.calculateCivPalette(world, allEvents),
      volatilityTimeline: this.calculateVolatilityTimeline(allEvents),
      magicCurve: this.calculateMagicCurve(allEvents),
      populationTrend: this.calculatePopulationTrend(allEvents),
      complexityScore: this.calculateComplexityScore(allEvents, eventLog),
    };
  }

  /**
   * Domain balance: percentage of events in each domain, scaled to 0-100.
   */
  calculateDomainBalance(events: readonly WorldEvent[]): Map<FingerprintDomain, number> {
    const balance = new Map<FingerprintDomain, number>();
    for (const domain of ALL_DOMAINS) {
      balance.set(domain, 0);
    }

    if (events.length === 0) return balance;

    // Count events per domain
    const domainCounts = new Map<FingerprintDomain, number>();
    for (const domain of ALL_DOMAINS) {
      domainCounts.set(domain, 0);
    }

    let mappedTotal = 0;
    for (const event of events) {
      const domain = categoryToDomain(event.category);
      if (domain !== undefined) {
        domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
        mappedTotal++;
      }
    }

    if (mappedTotal === 0) return balance;

    // Convert counts to percentage (0-100)
    for (const domain of ALL_DOMAINS) {
      const count = domainCounts.get(domain) ?? 0;
      balance.set(domain, (count / mappedTotal) * 100);
    }

    return balance;
  }

  /**
   * Civilization palette: faction proportions based on event participation.
   */
  calculateCivPalette(world: World, events: readonly WorldEvent[]): CivPaletteEntry[] {
    // Count event participation per faction
    const factionEventCounts = new Map<string, number>();

    // Find all faction entities
    const factionEntities = new Set<string>();
    if (world.hasStore('Territory')) {
      const factionIds = world.query('Territory');
      for (const id of factionIds) {
        factionEntities.add(String(id));
      }
    }

    // Count how often each faction-entity appears as a participant
    for (const event of events) {
      for (const participant of event.participants) {
        const key = String(participant);
        if (factionEntities.has(key)) {
          factionEventCounts.set(key, (factionEventCounts.get(key) ?? 0) + 1);
        }
      }
    }

    // If no faction participation, return empty
    if (factionEventCounts.size === 0) {
      // Fall back: distribute evenly among factions
      if (factionEntities.size === 0) return [];
      const proportion = 1 / factionEntities.size;
      let colorIdx = 0;
      const result: CivPaletteEntry[] = [];
      for (const key of factionEntities) {
        result.push({
          factionId: Number(key) as unknown as FactionId,
          proportion,
          color: FACTION_COLORS[colorIdx % FACTION_COLORS.length] ?? 'white',
        });
        colorIdx++;
      }
      return result;
    }

    // Sort by count descending
    const sorted = [...factionEventCounts.entries()].sort((a, b) => b[1] - a[1]);
    const totalParticipation = sorted.reduce((sum, [, count]) => sum + count, 0);

    return sorted.map(([key, count], idx) => ({
      factionId: Number(key) as unknown as FactionId,
      proportion: totalParticipation > 0 ? count / totalParticipation : 0,
      color: FACTION_COLORS[idx % FACTION_COLORS.length] ?? 'white',
    }));
  }

  /**
   * Volatility timeline: military event intensity per century, normalized 0-100.
   */
  calculateVolatilityTimeline(events: readonly WorldEvent[]): number[] {
    return this.calculateCenturyMetric(events, (e) =>
      e.category === EventCategory.Military ? e.significance : 0,
    );
  }

  /**
   * Magic curve: magical event intensity per century, normalized 0-100.
   */
  calculateMagicCurve(events: readonly WorldEvent[]): number[] {
    return this.calculateCenturyMetric(events, (e) =>
      e.category === EventCategory.Magical ? e.significance : 0,
    );
  }

  /**
   * Population trend: total Personal-category events per century as a proxy.
   * (True population would require component snapshots; event count is a
   * reasonable proxy for population activity.)
   */
  calculatePopulationTrend(events: readonly WorldEvent[]): number[] {
    return this.calculateCenturyMetric(events, (e) =>
      e.category === EventCategory.Personal || e.category === EventCategory.Economic ? 1 : 0,
    );
  }

  /**
   * Complexity score: based on cascade chain depth and cross-domain arcs.
   * Count of cascade chains with depth > 3 + count of cross-domain arcs,
   * normalized to 0-100.
   */
  calculateComplexityScore(events: readonly WorldEvent[], eventLog: EventLog): number {
    let deepCascadeCount = 0;
    let crossDomainArcCount = 0;

    for (const event of events) {
      // Only check root events (no causes) to avoid double-counting
      if (event.causes.length > 0) continue;
      if (event.consequences.length === 0) continue;

      // Walk the cascade chain forward
      const cascade = eventLog.getCascade(event.id);
      const chainDepth = this.measureMaxDepth(event, eventLog);

      if (chainDepth > 3) {
        deepCascadeCount++;
      }

      // Check for cross-domain transitions in this cascade
      const categories = new Set<EventCategory>();
      categories.add(event.category);
      for (const consequenceEvent of cascade) {
        categories.add(consequenceEvent.category);
      }
      if (categories.size >= 2) {
        crossDomainArcCount++;
      }
    }

    // Normalize: assume a "complex" world has ~100 deep cascades and ~200 cross-domain arcs
    const rawScore = deepCascadeCount + crossDomainArcCount;
    return Math.min(100, Math.round((rawScore / 300) * 100));
  }

  /**
   * Measure the maximum depth of a cascade chain from a root event.
   */
  private measureMaxDepth(rootEvent: WorldEvent, eventLog: EventLog): number {
    let maxDepth = 0;
    const queue: Array<{ eventId: typeof rootEvent.id; depth: number }> = [
      { eventId: rootEvent.id, depth: 0 },
    ];
    const visited = new Set<typeof rootEvent.id>();

    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;

      if (visited.has(item.eventId)) continue;
      visited.add(item.eventId);

      if (item.depth > maxDepth) {
        maxDepth = item.depth;
      }

      const event = eventLog.getById(item.eventId);
      if (event === undefined) continue;

      for (const consequenceId of event.consequences) {
        if (!visited.has(consequenceId)) {
          queue.push({ eventId: consequenceId, depth: item.depth + 1 });
        }
      }
    }

    return maxDepth;
  }

  /**
   * Generic per-century metric calculation with normalization to 0-100.
   */
  private calculateCenturyMetric(
    events: readonly WorldEvent[],
    valueFn: (event: WorldEvent) => number,
  ): number[] {
    const centuryCount = getCenturyCount(events);
    if (centuryCount === 0) return [];

    const buckets = new Array<number>(centuryCount).fill(0);

    for (const event of events) {
      const century = tickToCentury(event.timestamp);
      if (century >= 0 && century < centuryCount) {
        const current = buckets[century];
        if (current !== undefined) {
          buckets[century] = current + valueFn(event);
        }
      }
    }

    // Normalize to 0-100 based on max bucket value
    const maxValue = Math.max(1, ...buckets);
    return buckets.map((v) => Math.round((v / maxValue) * 100));
  }
}
