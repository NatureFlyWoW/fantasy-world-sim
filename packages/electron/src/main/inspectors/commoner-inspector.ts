// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Commoner Inspector — simplified inspector for non-notable characters.
 * Shows: name, age, race, profession, Notability score, parentage, spark history.
 *
 * Non-notables lack Personality, Goal, Memory, Health components that
 * full characters have, so this inspector focuses on the data they do carry:
 * Status, Notability, Parentage, Position, CreatureType.
 */

import { World, WorldClock, EventLog } from '@fws/core';
import type { EntityId } from '@fws/core';
import type { InspectorResponse } from '../../shared/types.js';
import {
  EntityRefCollector,
  resolveName,
  entityMarker,
  tickToYear,
} from './shared.js';

export function inspectCommoner(
  id: number,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  const eid = id as unknown as EntityId;
  const refs = new EntityRefCollector();
  const name = resolveName(id, world);

  // ── Read components ──────────────────────────────────────────────────────

  const status = world.hasStore('Status')
    ? world.getComponent(eid, 'Status')
    : undefined;

  const notability = world.hasStore('Notability')
    ? world.getComponent(eid, 'Notability')
    : undefined;

  const parentage = world.hasStore('Parentage')
    ? world.getComponent(eid, 'Parentage')
    : undefined;

  const position = world.hasStore('Position')
    ? world.getComponent(eid, 'Position')
    : undefined;

  const creatureType = world.hasStore('CreatureType')
    ? world.getComponent(eid, 'CreatureType')
    : undefined;

  // ── Derived values ───────────────────────────────────────────────────────

  const birthTick = notability?.birthTick ?? 0;
  const ageYears = Math.floor((clock.currentTick - birthTick) / 360);
  const profession = status?.socialClass ?? 'commoner';
  const race = creatureType?.species ?? 'Unknown';

  // ── Summary (identity card) ──────────────────────────────────────────────

  const summaryParts = [];
  if (race !== 'Unknown') summaryParts.push(race);
  summaryParts.push(`Age ${ageYears}`);
  summaryParts.push(profession.charAt(0).toUpperCase() + profession.slice(1));
  const summary = summaryParts.join(' \u00B7 ');

  // ── Section 1: Overview ──────────────────────────────────────────────────

  const overviewLines = [];
  overviewLines.push(`${name}, a ${profession} of ${ageYears} years.`);
  overviewLines.push('');

  if (race !== 'Unknown') {
    overviewLines.push(`Race: ${race}`);
  }
  overviewLines.push(`Profession: ${profession}`);
  if (position !== undefined && position.x !== undefined && position.y !== undefined) {
    overviewLines.push(`Location: (${position.x}, ${position.y})`);
  }
  overviewLines.push('');
  overviewLines.push(`Notability: ${notability?.score ?? 0}/100`);

  // ── Section 2: Spark History ─────────────────────────────────────────────

  const sparkLines = [];

  if (notability?.sparkHistory !== undefined && notability.sparkHistory.length > 0) {
    sparkLines.push(`${notability.sparkHistory.length} moment${notability.sparkHistory.length > 1 ? 's' : ''} of note in this commoner's life:`);
    sparkLines.push('');
    for (const spark of notability.sparkHistory) {
      const year = tickToYear(spark.tick);
      sparkLines.push(`  Y${year} -- ${spark.description}`);
    }
  } else {
    sparkLines.push('No remarkable events have marked this life.');
  }

  // ── Section 3: Family ────────────────────────────────────────────────────

  const familyLines = [];

  if (parentage !== undefined) {
    if (parentage.motherId !== undefined && parentage.motherId !== null) {
      const motherMarker = entityMarker(parentage.motherId, 'character', world, refs);
      familyLines.push(`Mother: ${motherMarker}`);
    }
    if (parentage.fatherId !== undefined && parentage.fatherId !== null) {
      const fatherMarker = entityMarker(parentage.fatherId, 'character', world, refs);
      familyLines.push(`Father: ${fatherMarker}`);
    }
  }

  if (familyLines.length === 0) {
    familyLines.push('No known parentage.');
  }

  // ── Build response ───────────────────────────────────────────────────────

  return {
    entityType: 'character',
    entityName: name,
    summary,
    sections: [
      { title: 'Overview', content: overviewLines.join('\n') },
      { title: 'Life Events', content: sparkLines.join('\n') },
      { title: 'Family', content: familyLines.join('\n') },
    ],
    prose: [],
    relatedEntities: refs.toArray(),
  };
}
