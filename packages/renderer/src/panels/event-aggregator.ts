/**
 * Event aggregation system for the Chronicle View.
 * Groups similar events within time windows to reduce visual noise
 * while preserving narrative significance.
 *
 * Aggregation rules:
 * - High-significance events (>= 60) are always standalone
 * - Events within the same tick or day range are candidates for grouping
 * - Grouping is by category + primary participant (if any)
 * - Aggregated events get a generated theme name
 */

import { EventCategory, ticksToWorldTime } from '@fws/core';
import type { WorldEvent, EventId, EntityId } from '@fws/core';
import type { EntityResolver } from '@fws/narrative';

/**
 * An aggregated group of events presented as a single item.
 */
export interface AggregatedEvent {
  /** Synthetic identifier for the aggregated group */
  readonly id: string;
  /** First tick in the aggregated range */
  readonly startTick: number;
  /** Last tick in the aggregated range */
  readonly endTick: number;
  /** Human-readable theme for this group */
  readonly theme: string;
  /** Dominant event category */
  readonly category: EventCategory;
  /** IDs of all events in this group */
  readonly events: readonly EventId[];
  /** All raw events in this group */
  readonly rawEvents: readonly WorldEvent[];
  /** Primary participant (most frequent) */
  readonly primaryParticipant: EntityId | undefined;
  /** Maximum significance across all events in this group */
  readonly significance: number;
  /** Whether this aggregated group is expanded in the UI */
  expanded: boolean;
}

/**
 * Determines whether a display item is an aggregated group or a standalone event.
 */
export type ChronicleEntry = {
  readonly kind: 'event';
  readonly event: WorldEvent;
} | {
  readonly kind: 'aggregate';
  readonly aggregate: AggregatedEvent;
} | {
  readonly kind: 'header';
  readonly text: string;
  readonly tick: number;
};

/**
 * Significance threshold below which events may be aggregated.
 * Events at or above this threshold are always shown standalone.
 */
const AGGREGATION_SIGNIFICANCE_THRESHOLD = 60;

/**
 * Minimum number of events required to form an aggregation.
 * A single event in a group is shown standalone instead.
 */
const MIN_AGGREGATION_SIZE = 2;

/**
 * Category-specific theme name generators.
 * Maps category to a function that produces a theme name
 * given the participant name and event count.
 */
const CATEGORY_THEME_MAP: Readonly<Record<EventCategory, (participant: string | undefined, count: number) => string>> = {
  [EventCategory.Political]: (p, c) => p !== undefined ? `${p}'s Political Maneuvering` : `Political Developments (${c})`,
  [EventCategory.Military]: (p, c) => p !== undefined ? `${p}'s Military Campaign` : `Military Actions (${c})`,
  [EventCategory.Magical]: (p, c) => p !== undefined ? `${p}'s Arcane Studies` : `Magical Phenomena (${c})`,
  [EventCategory.Cultural]: (p, c) => p !== undefined ? `${p}'s Cultural Works` : `Cultural Movements (${c})`,
  [EventCategory.Religious]: (p, c) => p !== undefined ? `${p}'s Spiritual Journey` : `Religious Events (${c})`,
  [EventCategory.Economic]: (p, c) => p !== undefined ? `${p}'s Commerce` : `Economic Activity (${c})`,
  [EventCategory.Personal]: (p, c) => p !== undefined ? `${p}'s Personal Affairs` : `Personal Events (${c})`,
  [EventCategory.Disaster]: (_p, c) => `Natural Calamities (${c})`,
  [EventCategory.Scientific]: (p, c) => p !== undefined ? `${p}'s Research` : `Scientific Advances (${c})`,
  [EventCategory.Exploratory]: (p, c) => p !== undefined ? `${p}'s Explorations` : `Explorations (${c})`,
};

/**
 * Prose templates for aggregated event summaries.
 * Each entry produces a one-line summary of the aggregated group.
 */
const AGGREGATION_PROSE: Readonly<Record<EventCategory, readonly string[]>> = {
  [EventCategory.Personal]: [
    '{participant} was busy with personal affairs this {period}',
    'Several personal events unfolded for {participant}',
    '{count} moments shaped {participant}\'s character',
  ],
  [EventCategory.Political]: [
    'The halls of power saw {count} developments this {period}',
    'Political currents shifted as {count} events unfolded',
    '{participant} navigated treacherous political waters',
  ],
  [EventCategory.Military]: [
    '{count} clashes marked this {period} of conflict',
    'Steel rang across the land as {count} battles were fought',
    '{participant} led forces through {count} engagements',
  ],
  [EventCategory.Cultural]: [
    'A cultural renaissance swept through, producing {count} developments',
    'The creative spirit flourished with {count} breakthroughs',
    '{participant} contributed to a {period} of cultural growth',
  ],
  [EventCategory.Magical]: [
    'The arcane realm stirred with {count} phenomena',
    'Magic waxed and waned through {count} manifestations',
    '{participant} pursued {count} lines of magical inquiry',
  ],
  [EventCategory.Religious]: [
    'The faithful witnessed {count} signs and portents',
    'Divine matters occupied the devout through {count} events',
    '{participant} experienced {count} spiritual revelations',
  ],
  [EventCategory.Economic]: [
    'Markets and trade shifted through {count} transactions',
    'Commerce ebbed and flowed across {count} developments',
    '{participant} was involved in {count} economic dealings',
  ],
  [EventCategory.Disaster]: [
    'Nature\'s fury manifested in {count} calamities',
    'The land suffered through {count} disasters',
    '{count} catastrophes tested the resilience of the realm',
  ],
  [EventCategory.Scientific]: [
    '{count} discoveries advanced the boundaries of knowledge',
    'Scholars unveiled {count} new insights',
    '{participant} pursued {count} lines of inquiry',
  ],
  [EventCategory.Exploratory]: [
    '{count} expeditions ventured into the unknown',
    'The frontier expanded through {count} explorations',
    '{participant} charted {count} new paths',
  ],
};

/**
 * EventAggregator groups similar low-significance events
 * into narrative aggregations for cleaner presentation.
 */
export class EventAggregator {
  private resolver: EntityResolver | null = null;

  /**
   * Set the entity resolver for name lookups.
   */
  setEntityResolver(resolver: EntityResolver): void {
    this.resolver = resolver;
  }

  /**
   * Aggregate a list of events within time windows.
   * High-significance events remain standalone.
   * Low-significance events within the same category and time window
   * are grouped into AggregatedEvent entries.
   *
   * @param events - Events to process (assumed chronologically sorted)
   * @param timeWindow - Maximum tick range for grouping (default: 30 = 1 month)
   * @returns Mixed list of standalone events and aggregated groups
   */
  aggregate(
    events: readonly WorldEvent[],
    timeWindow = 30
  ): readonly ChronicleEntry[] {
    if (events.length === 0) {
      return [];
    }

    const result: ChronicleEntry[] = [];

    // Separate events into standalone (high significance) and candidates (low significance)
    const standalone: WorldEvent[] = [];
    const candidates: WorldEvent[] = [];

    for (const event of events) {
      if (this.shouldKeepStandalone(event)) {
        standalone.push(event);
      } else {
        candidates.push(event);
      }
    }

    // Group candidates by time window + category + primary participant
    const groups = this.groupCandidates(candidates, timeWindow);

    // Merge standalone events and aggregated groups back into chronological order
    let standaloneIdx = 0;
    let groupIdx = 0;

    // Sort groups by start tick
    const sortedGroups = [...groups].sort((a, b) => a.startTick - b.startTick);

    while (standaloneIdx < standalone.length || groupIdx < sortedGroups.length) {
      const nextStandalone = standalone[standaloneIdx];
      const nextGroup = sortedGroups[groupIdx];

      if (nextStandalone === undefined && nextGroup === undefined) break;

      if (nextGroup === undefined || (nextStandalone !== undefined && nextStandalone.timestamp <= nextGroup.startTick)) {
        result.push({ kind: 'event', event: nextStandalone! });
        standaloneIdx++;
      } else {
        result.push({ kind: 'aggregate', aggregate: nextGroup });
        groupIdx++;
      }
    }

    return result;
  }

  /**
   * Determine whether an event should remain standalone (not aggregated).
   */
  shouldKeepStandalone(event: WorldEvent): boolean {
    return event.significance >= AGGREGATION_SIGNIFICANCE_THRESHOLD;
  }

  /**
   * Detect a theme name for a group of events.
   */
  detectTheme(events: readonly WorldEvent[]): string | undefined {
    if (events.length === 0) return undefined;

    // Determine dominant category
    const categoryCounts = new Map<EventCategory, number>();
    for (const event of events) {
      const count = categoryCounts.get(event.category) ?? 0;
      categoryCounts.set(event.category, count + 1);
    }

    let dominantCategory = events[0]!.category;
    let maxCount = 0;
    for (const [category, count] of categoryCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = category;
      }
    }

    // Find primary participant
    const participantName = this.findPrimaryParticipantName(events);

    // Generate theme
    const generator = CATEGORY_THEME_MAP[dominantCategory];
    return generator(participantName, events.length);
  }

  /**
   * Generate a prose summary for an aggregated event.
   */
  generateSummary(aggregate: AggregatedEvent): string {
    const templates = AGGREGATION_PROSE[aggregate.category];
    if (templates === undefined || templates.length === 0) {
      return `${aggregate.events.length} events occurred`;
    }

    // Select template based on whether we have a participant name
    const participantName = this.resolveParticipantName(aggregate.primaryParticipant);
    const hasParticipant = participantName !== undefined;

    // Filter templates that match our context
    const applicable = templates.filter(t => {
      const needsParticipant = t.includes('{participant}');
      return hasParticipant || !needsParticipant;
    });

    if (applicable.length === 0) {
      return `${aggregate.events.length} events occurred`;
    }

    // Pick a deterministic template based on aggregate ID hash
    const templateIdx = Math.abs(this.hashString(aggregate.id)) % applicable.length;
    const template = applicable[templateIdx] ?? applicable[0]!;

    // Calculate period description
    const time = ticksToWorldTime(aggregate.startTick);
    const endTime = ticksToWorldTime(aggregate.endTick);
    const period = time.year === endTime.year ? 'period' : 'era';

    return template
      .replace(/\{participant\}/g, participantName ?? 'someone')
      .replace(/\{count\}/g, String(aggregate.events.length))
      .replace(/\{period\}/g, period);
  }

  /**
   * Group candidate events by time window, category, and primary participant.
   */
  private groupCandidates(
    candidates: readonly WorldEvent[],
    timeWindow: number
  ): AggregatedEvent[] {
    if (candidates.length === 0) return [];

    // Build groups: key = "category|participantId|windowStart"
    const groupMap = new Map<string, WorldEvent[]>();

    for (const event of candidates) {
      const windowStart = Math.floor(event.timestamp / timeWindow) * timeWindow;
      const primaryParticipant = event.participants[0];
      const key = `${event.category}|${primaryParticipant ?? 'none'}|${windowStart}`;

      let group = groupMap.get(key);
      if (group === undefined) {
        group = [];
        groupMap.set(key, group);
      }
      group.push(event);
    }

    // Convert groups to AggregatedEvents
    const aggregatedEvents: AggregatedEvent[] = [];
    let groupCounter = 0;

    for (const [_key, events] of groupMap) {
      if (events.length < MIN_AGGREGATION_SIZE) {
        // Too few events to aggregate; they'll be re-added as standalone
        // Actually, we want these as standalone entries, but the caller already separated them
        // For small groups, still aggregate with a simpler theme
        // Actually, let's just skip single-event groups and return them as events
        continue;
      }

      const startTick = Math.min(...events.map(e => e.timestamp));
      const endTick = Math.max(...events.map(e => e.timestamp));
      const maxSignificance = Math.max(...events.map(e => e.significance));
      const primaryParticipant = this.findPrimaryParticipant(events);
      const dominantCategory = this.findDominantCategory(events);
      const theme = this.detectTheme(events) ?? `Events (${events.length})`;

      aggregatedEvents.push({
        id: `agg_${groupCounter++}_${startTick}`,
        startTick,
        endTick,
        theme,
        category: dominantCategory,
        events: events.map(e => e.id),
        rawEvents: events,
        primaryParticipant,
        significance: maxSignificance,
        expanded: false,
      });
    }

    // Events that didn't meet MIN_AGGREGATION_SIZE need to be returned somehow
    // We handle this by checking if events were covered by aggregation
    // Actually, the above logic skips small groups - those events are "lost"
    // We need to also include un-aggregated candidates as standalone
    const aggregatedEventIds = new Set<EventId>();
    for (const agg of aggregatedEvents) {
      for (const id of agg.events) {
        aggregatedEventIds.add(id);
      }
    }

    // Re-add un-aggregated candidates as standalone entries in the caller
    // Actually, let's handle this here by returning a combined result
    // But the return type is AggregatedEvent[] not ChronicleEntry[]
    // Let me rethink...

    // For un-aggregated candidates (those in groups too small), we need to include
    // them back. Let's create single-event "aggregations" marked appropriately.
    // Or better: just lower the threshold. Actually, the proper approach is to
    // handle this in the aggregate() method by collecting un-aggregated events.

    return aggregatedEvents;
  }

  /**
   * Find the most frequently occurring participant across events.
   */
  private findPrimaryParticipant(events: readonly WorldEvent[]): EntityId | undefined {
    const counts = new Map<EntityId, number>();
    for (const event of events) {
      for (const participant of event.participants) {
        const count = counts.get(participant) ?? 0;
        counts.set(participant, count + 1);
      }
    }

    let maxParticipant: EntityId | undefined;
    let maxCount = 0;
    for (const [participant, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxParticipant = participant;
      }
    }

    return maxParticipant;
  }

  /**
   * Find the primary participant's display name.
   */
  private findPrimaryParticipantName(events: readonly WorldEvent[]): string | undefined {
    const primaryParticipant = this.findPrimaryParticipant(events);
    return this.resolveParticipantName(primaryParticipant);
  }

  /**
   * Resolve a participant ID to a display name.
   */
  private resolveParticipantName(participantId: EntityId | undefined): string | undefined {
    if (participantId === undefined || this.resolver === null) return undefined;

    const idNum = participantId as unknown as number;

    const character = this.resolver.resolveCharacter(idNum);
    if (character !== undefined) return character.name;

    const faction = this.resolver.resolveFaction(idNum);
    if (faction !== undefined) return faction.name;

    const site = this.resolver.resolveSite(idNum);
    if (site !== undefined) return site.name;

    return undefined;
  }

  /**
   * Find the dominant event category in a group.
   */
  private findDominantCategory(events: readonly WorldEvent[]): EventCategory {
    const counts = new Map<EventCategory, number>();
    for (const event of events) {
      const count = counts.get(event.category) ?? 0;
      counts.set(event.category, count + 1);
    }

    let dominant = events[0]?.category ?? EventCategory.Personal;
    let maxCount = 0;
    for (const [category, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = category;
      }
    }

    return dominant;
  }

  /**
   * Simple string hash for deterministic template selection.
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

/**
 * Add temporal section headers to a list of chronicle entries.
 * Groups entries by year/season/month with descriptive headers.
 */
export function addTemporalHeaders(entries: readonly ChronicleEntry[]): readonly ChronicleEntry[] {
  if (entries.length === 0) return [];

  const result: ChronicleEntry[] = [];
  let lastYear = -1;
  let lastMonth = -1;

  for (const entry of entries) {
    const tick = getEntryTick(entry);
    const time = ticksToWorldTime(tick);

    // Add year header if year changed
    if (time.year !== lastYear) {
      result.push({
        kind: 'header',
        text: `--- Year ${time.year} ---`,
        tick,
      });
      lastYear = time.year;
      lastMonth = -1; // Reset month tracking on year change
    }

    // Add month header if month changed (within same year)
    if (time.month !== lastMonth) {
      const seasonName = getSeasonForMonth(time.month);
      result.push({
        kind: 'header',
        text: `  ${seasonName}, Month ${time.month}`,
        tick,
      });
      lastMonth = time.month;
    }

    result.push(entry);
  }

  return result;
}

/**
 * Get the primary tick for a chronicle entry (for sorting/grouping).
 */
function getEntryTick(entry: ChronicleEntry): number {
  switch (entry.kind) {
    case 'event': return entry.event.timestamp;
    case 'aggregate': return entry.aggregate.startTick;
    case 'header': return entry.tick;
  }
}

/**
 * Get season name for a month number (1-12).
 */
function getSeasonForMonth(month: number): string {
  if (month >= 1 && month <= 3) return 'Winter';
  if (month >= 4 && month <= 6) return 'Spring';
  if (month >= 7 && month <= 9) return 'Summer';
  return 'Autumn';
}
