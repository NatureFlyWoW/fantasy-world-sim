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
    const primaryParticipant = event.participants[0] ?? 'none';
    const window = Math.floor(event.tick / timeWindow);
    const key = `${event.category}|${primaryParticipant}|${window}`;
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
      const [category, participantStr] = key.split('|') as [string, string];
      const participant = participantStr === 'none' ? 0 : parseInt(participantStr, 10);
      const templates = AGGREGATION_PROSE[category] ?? ['Multiple events occurred'];
      const templateIndex = hashString(key) % templates.length;
      const template = templates[templateIndex] ?? 'Multiple events occurred';
      const theme = template
        .replace('{participant}', getName(participant))
        .replace('{count}', String(group.length))
        .replace('{period}', 'period');
      const maxSig = Math.max(...group.map((e) => e.significance));
      const minTick = Math.min(...group.map((e) => e.tick));
      aggregated.push({
        kind: 'aggregate',
        category,
        count: group.length,
        theme,
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
      const season =
        month <= 3 ? 'Winter' : month <= 6 ? 'Spring' : month <= 9 ? 'Summer' : 'Autumn';
      result.push({ kind: 'header', text: `${season}, Month ${month}`, tick });
      lastMonth = month;
    }

    result.push(entry);
  }

  return result;
}
