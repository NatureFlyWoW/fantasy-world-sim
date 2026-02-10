// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Event Inspector — extracts structured data for event entities.
 */

import { World, WorldClock, EventLog, EventCategory } from '@fws/core';
import type { EventId } from '@fws/core';
import type { InspectorResponse } from '../../shared/types.js';
import {
  EntityRefCollector,
  entityMarker,
  detectEntityType,
  tickToYear,
  tickToSeason,
  renderBar,
  getSignificanceLabel,
  eventDescription,
} from './shared.js';

export function inspectEvent(
  id: number,
  world: World,
  eventLog: EventLog,
  _clock: WorldClock,
): InspectorResponse {
  const refs = new EntityRefCollector();

  // Cast from number to EventId
  const eventId = id as unknown as EventId;
  const event = eventLog.getById(eventId);

  if (event === undefined) {
    return {
      entityType: 'event',
      entityName: `Event #${id}`,
      summary: 'Not found',
      sections: [
        { title: 'What Happened', content: 'This event has passed beyond the reach of chronicles.\nEvent is no longer present in the record.' },
      ],
      prose: [],
      relatedEntities: [],
    };
  }

  const description = eventDescription(event);

  // ── Section 1: What Happened ────────────────────────────────────────
  const whatLines: string[] = [];
  whatLines.push(description);
  whatLines.push('');

  const year = tickToYear(event.timestamp);
  const season = tickToSeason(event.timestamp);
  const humanSubtype = event.subtype.replace(/[._]/g, ' ');
  whatLines.push(`In the ${season.toLowerCase()} of Year ${year}, ${humanSubtype}.`);

  const narrative = (event.data as Record<string, unknown>)['narrative'];
  if (typeof narrative === 'string' && narrative.length > 0) {
    whatLines.push('');
    whatLines.push(narrative);
  }

  // ── Section 2: Who Was Involved ─────────────────────────────────────
  const whoLines: string[] = [];

  if (event.participants.length === 0) {
    whoLines.push('No specific participants recorded.');
  } else {
    const primary = event.participants.slice(0, 2);
    const secondary = event.participants.slice(2);

    if (primary.length > 0) {
      whoLines.push('PRIMARY:');
      for (const participantId of primary) {
        const numId = participantId as unknown as number;
        const type = detectEntityType(numId, world);
        const marker = entityMarker(numId, type, world, refs);
        whoLines.push(`  ${marker}`);
      }
    }

    if (secondary.length > 0) {
      whoLines.push('');
      whoLines.push('SECONDARY:');
      for (const participantId of secondary) {
        const numId = participantId as unknown as number;
        const type = detectEntityType(numId, world);
        const marker = entityMarker(numId, type, world, refs);
        whoLines.push(`  ${marker}`);
      }
    }

    // Scan event data for additional entity references
    const data = event.data as Record<string, unknown>;
    const additionalIds: number[] = [];
    for (const [key, val] of Object.entries(data)) {
      if ((key.endsWith('Id') || key.endsWith('_id')) && typeof val === 'number') {
        const participantNums = event.participants.map(p => p as unknown as number);
        if (!participantNums.includes(val)) {
          additionalIds.push(val);
        }
      }
    }

    if (additionalIds.length > 0) {
      whoLines.push('');
      whoLines.push('Also referenced:');
      for (const refId of additionalIds.slice(0, 5)) {
        const type = detectEntityType(refId, world);
        const marker = entityMarker(refId, type, world, refs);
        whoLines.push(`  ${marker}`);
      }
    }
  }

  // ── Section 3: Where & When ─────────────────────────────────────────
  const whereLines: string[] = [];

  const month = Math.floor((event.timestamp % 360) / 30) + 1;
  const dayOfMonth = ((event.timestamp % 360) % 30) + 1;
  whereLines.push(`Date: Year ${year}, Month ${month}, Day ${dayOfMonth} (${season})`);

  const data = event.data as Record<string, unknown>;
  const locationId = data['locationId'] ?? data['location_id'] ?? data['siteId'];
  if (typeof locationId === 'number') {
    const locMarker = entityMarker(locationId, 'site', world, refs);
    whereLines.push(`Location: ${locMarker}`);
  }

  const ex = data['x'];
  const ey = data['y'];
  if (typeof ex === 'number' && typeof ey === 'number') {
    whereLines.push(`Coordinates: (${ex}, ${ey})`);
  }

  if (whereLines.length === 1) {
    whereLines.push('Location not recorded.');
  }

  // ── Section 4: Why It Matters ───────────────────────────────────────
  const whyLines: string[] = [];

  const sigLabel = getSignificanceLabel(event.significance);
  whyLines.push(`Significance: ${renderBar(event.significance, 100)} ${sigLabel} (${event.significance})`);
  whyLines.push('');

  const consequenceCount = event.consequences.length;
  if (consequenceCount > 0) {
    whyLines.push(`This event triggered a cascade of ${consequenceCount} subsequent event${consequenceCount > 1 ? 's' : ''}.`);
  } else {
    whyLines.push('This event did not trigger further cascading events.');
  }

  // ── Section 5: What Came Before ─────────────────────────────────────
  const beforeLines: string[] = [];

  if (event.causes.length === 0) {
    beforeLines.push('This event arose from no recorded prior cause.');
  } else {
    beforeLines.push('This event grew from earlier seeds:');
    beforeLines.push('');
    for (const causeId of event.causes.slice(0, 5)) {
      const causeEvent = eventLog.getById(causeId);
      if (causeEvent !== undefined) {
        const causeYear = tickToYear(causeEvent.timestamp);
        const timeDelta = year - causeYear;
        const timeStr = timeDelta > 0 ? `(${timeDelta} year${timeDelta > 1 ? 's' : ''} before)` : '(same year)';
        beforeLines.push(`  Y${causeYear} -- ${eventDescription(causeEvent)}`);
        beforeLines.push(`    ${timeStr}`);
      } else {
        beforeLines.push(`  Event ${String(causeId)} (record lost)`);
      }
    }
    if (event.causes.length > 5) {
      beforeLines.push(`  ... and ${event.causes.length - 5} more causes`);
    }
  }

  // ── Section 6: What Followed ────────────────────────────────────────
  const afterLines: string[] = [];

  if (event.consequences.length === 0) {
    afterLines.push('No consequences have been recorded.');
  } else {
    afterLines.push('The ripples of this event spread far:');
    afterLines.push('');
    for (const consequenceId of event.consequences.slice(0, 5)) {
      const consequenceEvent = eventLog.getById(consequenceId);
      if (consequenceEvent !== undefined) {
        afterLines.push(`  Y${tickToYear(consequenceEvent.timestamp)} -- ${eventDescription(consequenceEvent)}`);
      } else {
        afterLines.push(`  Event ${String(consequenceId)} (record lost)`);
      }
    }
    if (event.consequences.length > 5) {
      afterLines.push(`  ... and ${event.consequences.length - 5} more consequences`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts = [
    event.category,
    `Year ${year}, ${season}`,
    sigLabel,
  ];

  const proseLines: string[] = [];
  proseLines.push(`In the ${season.toLowerCase()} of Year ${year}, ${humanSubtype}.`);

  return {
    entityType: 'event',
    entityName: description,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'What Happened', content: whatLines.join('\n') },
      { title: 'Who Was Involved', content: whoLines.join('\n') },
      { title: 'Where & When', content: whereLines.join('\n') },
      { title: 'Why It Matters', content: whyLines.join('\n') },
      { title: 'What Came Before', content: beforeLines.join('\n') },
      { title: 'What Followed', content: afterLines.join('\n') },
    ],
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}
