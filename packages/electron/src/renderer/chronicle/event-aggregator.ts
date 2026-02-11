import type { SerializedEvent } from '../../shared/types.js';
import type { FormattedEvent } from './event-formatter.js';
import { formatEvent } from './event-formatter.js';

export type ChronicleEntry =
  | { readonly kind: 'event'; readonly event: SerializedEvent; readonly formatted: FormattedEvent }
  | {
      readonly kind: 'aggregate';
      readonly category: string;
      readonly count: number;
      readonly theme: string;
      readonly significance: number;
      readonly tick: number;
      readonly icon: string;
      readonly categoryColor: string;
      readonly eventIds: readonly number[];
    }
  | { readonly kind: 'header'; readonly text: string; readonly tick: number };

const AGGREGATION_PROSE: Record<string, readonly string[]> = {
  Personal: [
    '{participant} was busy with personal affairs this {period}',
    'Several personal events unfolded for {participant}',
    "{count} moments shaped {participant}'s character",
  ],
  Political: [
    'The halls of power saw {count} developments this {period}',
    'Political currents shifted as {count} events unfolded',
    '{participant} navigated treacherous political waters',
  ],
  Military: [
    '{count} clashes marked this {period} of conflict',
    'Steel rang across the land as {count} battles were fought',
    '{participant} led forces through {count} engagements',
  ],
  Cultural: [
    'A cultural renaissance swept through, producing {count} developments',
    'The creative spirit flourished with {count} breakthroughs',
    '{participant} contributed to a {period} of cultural growth',
  ],
  Magical: [
    'The arcane realm stirred with {count} phenomena',
    'Magic waxed and waned through {count} manifestations',
    '{participant} pursued {count} lines of magical inquiry',
  ],
  Religious: [
    'The faithful witnessed {count} signs and portents',
    'Divine matters occupied the devout through {count} events',
    '{participant} experienced {count} spiritual revelations',
  ],
  Economic: [
    'Markets and trade shifted through {count} transactions',
    'Commerce ebbed and flowed across {count} developments',
    '{participant} was involved in {count} economic dealings',
  ],
  Disaster: [
    "Nature's fury manifested in {count} calamities",
    'The land suffered through {count} disasters',
    '{count} catastrophes tested the resilience of the realm',
  ],
  Scientific: [
    '{count} discoveries advanced the boundaries of knowledge',
    'Scholars unveiled {count} new insights',
    '{participant} pursued {count} lines of inquiry',
  ],
  Exploratory: [
    '{count} expeditions ventured into the unknown',
    'The frontier expanded through {count} explorations',
    '{participant} charted {count} new paths',
  ],
};

const CATEGORY_ICONS: Record<string, string> = {
  Political: '\u269C',
  Military: '\u2694',
  Magical: '\u2726',
  Cultural: '\u266B',
  Religious: '\u271D',
  Economic: '\u2696',
  Personal: '\u2660',
  Disaster: '\u2620',
  Scientific: '\u2604',
  Exploratory: '\u2609',
};

const CATEGORY_COLORS: Record<string, string> = {
  Political: '#FFDD44',
  Military: '#FF4444',
  Magical: '#CC44FF',
  Cultural: '#44DDFF',
  Religious: '#FFAAFF',
  Economic: '#44FF88',
  Personal: '#88AAFF',
  Disaster: '#FF6600',
  Scientific: '#00FFCC',
  Exploratory: '#88FF44',
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash | 0;
  }
  return Math.abs(hash);
}

/**
 * Compute the grouping key for a low-significance event.
 */
function groupKey(event: SerializedEvent, timeWindow: number): string {
  const primaryParticipant = event.participants[0] ?? 'none';
  const window = Math.floor(event.tick / timeWindow);
  return `${event.category}|${primaryParticipant}|${window}`;
}

/**
 * Build an aggregate theme string from a group key and count.
 */
function buildTheme(key: string, count: number, getName: (id: number) => string): string {
  const [category, participantStr] = key.split('|') as [string, string];
  const participant = participantStr === 'none' ? 0 : parseInt(participantStr, 10);
  const templates = AGGREGATION_PROSE[category ?? ''] ?? ['Multiple events occurred'];
  const templateIndex = hashString(key) % templates.length;
  const template = templates[templateIndex] ?? 'Multiple events occurred';
  return template
    .replace('{participant}', getName(participant))
    .replace('{count}', String(count))
    .replace('{period}', 'period');
}

/**
 * Season name for a given month number (1-indexed).
 */
function seasonName(month: number): string {
  if (month <= 3) return 'Winter';
  if (month <= 6) return 'Spring';
  if (month <= 9) return 'Summer';
  return 'Autumn';
}

// ── Incremental aggregation state ────────────────────────────────────────────

/**
 * Mutable state carried between incremental `appendEvents()` calls.
 *
 * `groupIndex` maps grouping keys to the index in `entries` where the
 * corresponding aggregate or singleton event entry lives, allowing O(1) lookup
 * when deciding whether a new low-significance event should merge into an
 * existing group or start a new one.
 */
export interface AggregationState {
  /** The live entry list rendered by the chronicle. */
  entries: ChronicleEntry[];
  /** group key -> index in entries */
  groupIndex: Map<string, number>;
  /** Last year for which a header was emitted. */
  lastYear: number;
  /** Last month for which a header was emitted. */
  lastMonth: number;
  /** Cached formatted events keyed by event ID to avoid re-formatting. */
  formatCache: Map<number, FormattedEvent>;
}

/**
 * Create a fresh aggregation state.
 */
export function createAggregationState(): AggregationState {
  return {
    entries: [],
    groupIndex: new Map(),
    lastYear: -1,
    lastMonth: -1,
    formatCache: new Map(),
  };
}

/**
 * Incrementally append new events into an existing aggregation state.
 *
 * New events are assumed to be chronologically ordered (or at least from the
 * same or later ticks than the events already in state). This avoids the
 * O(n log n) full re-sort that `aggregateEvents()` performs.
 *
 * - sig >= 60: standalone event entry, appended at the end.
 * - sig < 60: merged into an existing aggregate/singleton or creates a new one.
 *
 * Temporal headers are inserted as needed for new year/month boundaries.
 */
export function appendEvents(
  state: AggregationState,
  newEvents: readonly SerializedEvent[],
  getName: (id: number) => string,
  timeWindow = 30,
): void {
  for (const event of newEvents) {
    const tick = event.tick;
    const year = Math.floor(tick / 360) + 1;
    const month = Math.floor((tick % 360) / 30) + 1;

    // ── Temporal headers ──
    if (year !== state.lastYear) {
      state.entries.push({ kind: 'header', text: `--- Year ${year} ---`, tick });
      state.lastYear = year;
      state.lastMonth = -1;
    }
    if (month !== state.lastMonth) {
      state.entries.push({ kind: 'header', text: `${seasonName(month)}, Month ${month}`, tick });
      state.lastMonth = month;
    }

    // ── Standalone (high significance) ──
    if (event.significance >= 60) {
      let formatted = state.formatCache.get(event.id);
      if (formatted === undefined) {
        formatted = formatEvent(event, getName);
        state.formatCache.set(event.id, formatted);
      }
      state.entries.push({ kind: 'event', event, formatted });
      continue;
    }

    // ── Low significance — try to merge into existing group ──
    const key = groupKey(event, timeWindow);
    const existingIdx = state.groupIndex.get(key);

    if (existingIdx !== undefined) {
      const existing = state.entries[existingIdx];

      if (existing !== undefined && existing.kind === 'aggregate') {
        // Merge into existing aggregate — replace with updated entry.
        const newCount = existing.count + 1;
        const newSig = Math.max(existing.significance, event.significance);
        const newIds = [...existing.eventIds, event.id];
        state.entries[existingIdx] = {
          kind: 'aggregate',
          category: existing.category,
          count: newCount,
          theme: buildTheme(key, newCount, getName),
          significance: newSig,
          tick: existing.tick,
          icon: existing.icon,
          categoryColor: existing.categoryColor,
          eventIds: newIds,
        };
      } else if (existing !== undefined && existing.kind === 'event') {
        // Promote singleton to aggregate.
        const category = event.category;
        state.entries[existingIdx] = {
          kind: 'aggregate',
          category,
          count: 2,
          theme: buildTheme(key, 2, getName),
          significance: Math.max(existing.event.significance, event.significance),
          tick: existing.event.tick,
          icon: CATEGORY_ICONS[category] ?? '\u2022',
          categoryColor: CATEGORY_COLORS[category] ?? '#888888',
          eventIds: [existing.event.id, event.id],
        };
      }
      // In either merge case we are done with this event.
    } else {
      // No existing group — add as standalone singleton, register key.
      let formatted = state.formatCache.get(event.id);
      if (formatted === undefined) {
        formatted = formatEvent(event, getName);
        state.formatCache.set(event.id, formatted);
      }
      const idx = state.entries.length;
      state.entries.push({ kind: 'event', event, formatted });
      state.groupIndex.set(key, idx);
    }
  }
}

// ── Full rebuild (used on mode change / filter change) ───────────────────────

export function aggregateEvents(
  events: readonly SerializedEvent[],
  getName: (id: number) => string,
  timeWindow = 30,
): readonly ChronicleEntry[] {
  const standalone: ChronicleEntry[] = [];
  const candidates: SerializedEvent[] = [];

  // 1. Separate by significance threshold
  for (const event of events) {
    if (event.significance >= 60) {
      standalone.push({ kind: 'event', event, formatted: formatEvent(event, getName) });
    } else {
      candidates.push(event);
    }
  }

  // 2. Group candidates
  const groups = new Map<string, SerializedEvent[]>();
  for (const event of candidates) {
    const key = groupKey(event, timeWindow);
    const group = groups.get(key);
    if (group) {
      group.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  // 3. Create aggregates or format singles
  const aggregated: ChronicleEntry[] = [];
  for (const [key, group] of groups) {
    if (group.length >= 2) {
      const [category] = key.split('|') as [string];
      const maxSig = Math.max(...group.map((e) => e.significance));
      const minTick = Math.min(...group.map((e) => e.tick));
      aggregated.push({
        kind: 'aggregate',
        category,
        count: group.length,
        theme: buildTheme(key, group.length, getName),
        significance: maxSig,
        tick: minTick,
        icon: CATEGORY_ICONS[category] ?? '\u2022',
        categoryColor: CATEGORY_COLORS[category] ?? '#888888',
        eventIds: group.map((e) => e.id),
      });
    } else {
      const event = group[0];
      if (event) {
        aggregated.push({ kind: 'event', event, formatted: formatEvent(event, getName) });
      }
    }
  }

  // 4. Merge and sort chronologically
  const merged = [...standalone, ...aggregated].sort((a, b) => {
    const tickA = a.kind === 'event' ? a.event.tick : a.tick;
    const tickB = b.kind === 'event' ? b.event.tick : b.tick;
    return tickA - tickB;
  });

  // 5. Insert temporal headers
  const result: ChronicleEntry[] = [];
  let lastYear = -1;
  let lastMonth = -1;

  for (const entry of merged) {
    const tick = entry.kind === 'event' ? entry.event.tick : entry.tick;
    const year = Math.floor(tick / 360) + 1;
    const month = Math.floor((tick % 360) / 30) + 1;

    if (year !== lastYear) {
      result.push({ kind: 'header', text: `--- Year ${year} ---`, tick });
      lastYear = year;
      lastMonth = -1;
    }

    if (month !== lastMonth) {
      const season = seasonName(month);
      result.push({ kind: 'header', text: `${season}, Month ${month}`, tick });
      lastMonth = month;
    }

    result.push(entry);
  }

  return result;
}
