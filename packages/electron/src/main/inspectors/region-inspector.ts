// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Region Inspector — extracts structured data for region (map tile) entities.
 */

import { World, WorldClock, EventLog, EventCategory } from '@fws/core';
import type { EntityId, WorldEvent } from '@fws/core';
import type { InspectorResponse, InspectorSection } from '../../shared/types.js';
import {
  EntityRefCollector,
  entityMarker,
  tickToYear,
  describeElevation,
  describeTemperature,
  describeRainfall,
  eventDescription,
  BIOME_PROSE,
  RESOURCE_PROSE,
} from './shared.js';

export function inspectRegion(
  id: number,
  world: World,
  eventLog: EventLog,
  _clock: WorldClock,
): InspectorResponse {
  const refs = new EntityRefCollector();

  // Decode coordinates: x = floor(id / 10000), y = id % 10000
  const x = Math.floor(id / 10000);
  const y = id % 10000;

  // Attempt to find tile data from ECS Biome component on nearby entities,
  // or fall back to basic coordinate-based inspection.
  // Since the main process doesn't have a direct worldMap reference in this function,
  // we reconstruct what we can from entity components.

  // Try to find a settlement or entity at these coordinates for biome info
  let tileBiome: string | undefined;
  let tileElevation: number | undefined;
  let tileTemperature: number | undefined;
  let tileRainfall: number | undefined;
  let tileRiverId: number | undefined;
  let tileLeyLine: boolean | undefined;
  let tileResources: string[] | undefined;

  // Scan entities at this position for biome data
  if (world.hasStore('Position')) {
    const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> };
    for (const [checkEid, pos] of posStore.getAll()) {
      if (pos.x === x && pos.y === y) {
        if (world.hasStore('Biome')) {
          const biomeComp = world.getComponent(checkEid, 'Biome') as {
            biomeType?: string; fertility?: number; moisture?: number;
          } | undefined;
          if (biomeComp?.biomeType !== undefined) tileBiome = biomeComp.biomeType;
        }
        if (world.hasStore('Resource')) {
          const resComp = world.getComponent(checkEid, 'Resource') as { resources?: Map<string, number> } | undefined;
          if (resComp?.resources !== undefined) {
            tileResources = [...resComp.resources.keys()];
          }
        }
        break;
      }
    }
  }

  // ── Section 1: The Land Itself ──────────────────────────────────────
  const landLines: string[] = [];

  if (tileBiome !== undefined) {
    const biomeProse = BIOME_PROSE[tileBiome];
    if (biomeProse !== undefined) {
      landLines.push(biomeProse);
    } else {
      landLines.push(`${tileBiome} terrain`);
    }
  } else {
    landLines.push(`Region at coordinates (${x}, ${y}).`);
  }

  landLines.push('');
  landLines.push('Conditions:');
  if (tileElevation !== undefined) landLines.push(`  ^ ${describeElevation(tileElevation)}`);
  if (tileTemperature !== undefined) landLines.push(`  * ${describeTemperature(tileTemperature)}`);
  if (tileRainfall !== undefined) landLines.push(`  ~ ${describeRainfall(tileRainfall)}`);

  if (tileElevation === undefined && tileTemperature === undefined && tileRainfall === undefined) {
    landLines.push('  (Detailed environmental data unavailable from this view)');
  }

  if (tileRiverId !== undefined) {
    landLines.push('');
    landLines.push('A river winds through this region, carving deep gorges in the ancient rock.');
  }

  // ── Section 2: Riches of the Earth ──────────────────────────────────
  const richesLines: string[] = [];
  const resources = tileResources ?? [];

  if (resources.length === 0) {
    richesLines.push('This land yields few riches of note.');
  } else {
    const introWord = resources.length >= 4 ? 'generously' : resources.length >= 2 ? 'reluctantly' : 'sparingly';
    richesLines.push(`The land yields its treasures ${introWord}:`);
    richesLines.push('');
    for (const resource of resources) {
      const prose = RESOURCE_PROSE[resource];
      if (prose !== undefined) {
        richesLines.push(`  * ${prose}`);
      } else {
        const formatted = resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ');
        richesLines.push(`  * ${formatted} can be found here`);
      }
    }
    if (resources.length >= 3) {
      richesLines.push('');
      richesLines.push('Those who control this land grow wealthy on its bounty.');
    }
  }

  // ── Section 3: Those Who Dwell Here ─────────────────────────────────
  const dwellerLines: string[] = [];
  const radius = 3;

  if (world.hasStore('Position')) {
    const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> };
    const factionEntities: number[] = [];
    const characterEntities: number[] = [];

    for (const [checkEid, pos] of posStore.getAll()) {
      if (pos.x === undefined || pos.y === undefined) continue;
      const dx = Math.abs(pos.x - x);
      const dy = Math.abs(pos.y - y);
      if (dx > radius || dy > radius) continue;

      const numId = checkEid as unknown as number;
      if (world.hasStore('Attribute') && world.getComponent(checkEid, 'Attribute') !== undefined) {
        characterEntities.push(numId);
      } else if (world.hasStore('Territory') && world.getComponent(checkEid, 'Territory') !== undefined) {
        factionEntities.push(numId);
      }
    }

    if (factionEntities.length > 0) {
      dwellerLines.push('Controlling Factions:');
      for (const fId of factionEntities) {
        const marker = entityMarker(fId, 'faction', world, refs);
        dwellerLines.push(`  & ${marker}`);
      }
      dwellerLines.push('');
    }

    if (characterEntities.length > 0) {
      dwellerLines.push('Notable Inhabitants:');
      for (const cId of characterEntities.slice(0, 5)) {
        const marker = entityMarker(cId, 'character', world, refs);
        dwellerLines.push(`  @ ${marker}`);
      }
      if (characterEntities.length > 5) {
        dwellerLines.push(`  ... and ${characterEntities.length - 5} others`);
      }
    }
  }

  if (dwellerLines.length === 0) dwellerLines.push('No inhabitants of note dwell in this region.');

  // ── Section 4: Marks Upon the Land ──────────────────────────────────
  const marksLines: string[] = [];
  const settlementRadius = 5;

  if (world.hasStore('Position') && world.hasStore('Population')) {
    const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> };
    const settlements: Array<{ id: number; distance: number }> = [];

    for (const [checkEid, pos] of posStore.getAll()) {
      if (pos.x === undefined || pos.y === undefined) continue;
      const pop = world.getComponent(checkEid, 'Population');
      if (pop === undefined) continue;

      const dx = Math.abs(pos.x - x);
      const dy = Math.abs(pos.y - y);
      const distance = Math.max(dx, dy);
      if (distance > settlementRadius) continue;

      settlements.push({ id: checkEid as unknown as number, distance });
    }
    settlements.sort((a, b) => a.distance - b.distance);

    if (settlements.length > 0) {
      marksLines.push('Nearby Settlements:');
      for (const settlement of settlements.slice(0, 8)) {
        const marker = entityMarker(settlement.id, 'site', world, refs);
        const distLabel = settlement.distance <= 1 ? 'adjacent' : settlement.distance <= 3 ? 'near' : 'distant';
        marksLines.push(`  # ${marker} ......... ${distLabel}`);
      }
    }
  }

  if (marksLines.length === 0) marksLines.push('No settlements mark this region.');

  // ── Section 5: Echoes of the Past ───────────────────────────────────
  const echoLines: string[] = [];

  const allEvents = eventLog.getAll();
  const recentEvents = allEvents.slice(Math.max(0, allEvents.length - 500));
  const matchedEvents: WorldEvent[] = [];

  for (const evt of recentEvents) {
    const evtData = evt.data as Record<string, unknown>;
    const evtX = evtData['x'];
    const evtY = evtData['y'];
    if (typeof evtX === 'number' && typeof evtY === 'number') {
      if (Math.abs(evtX - x) <= 2 && Math.abs(evtY - y) <= 2) {
        matchedEvents.push(evt);
        continue;
      }
    }
    // Check participant locations
    for (const participantId of evt.participants) {
      if (world.hasStore('Position')) {
        const pos = world.getComponent(participantId, 'Position') as { x?: number; y?: number } | undefined;
        if (pos?.x !== undefined && pos.y !== undefined) {
          if (Math.abs(pos.x - x) <= 1 && Math.abs(pos.y - y) <= 1) {
            matchedEvents.push(evt);
            break;
          }
        }
      }
    }
  }
  matchedEvents.sort((a, b) => b.significance - a.significance);

  if (matchedEvents.length === 0) {
    echoLines.push('History has left no recorded mark upon this land.');
  } else {
    echoLines.push('History has left its scars on this land:');
    echoLines.push('');
    for (const evt of matchedEvents.slice(0, 5)) {
      echoLines.push(`  Y${tickToYear(evt.timestamp)} -- ${eventDescription(evt)}`);
    }
    if (matchedEvents.length > 5) {
      echoLines.push(`  And ${matchedEvents.length - 5} more events in this region's history.`);
    }
  }

  // ── Section 6: Arcane Currents (only if ley line) ───────────────────
  const arcaneLines: string[] = [];
  const hasLeyLine = tileLeyLine === true;

  if (hasLeyLine) {
    arcaneLines.push('A ley line pulses with arcane energy beneath the earth.');
    arcaneLines.push('The concentration of magical power here has attracted');
    arcaneLines.push('scholars and sorcerers throughout the ages.');

    const magicEvents = matchedEvents.filter(e => e.category === EventCategory.Magical);
    if (magicEvents.length > 0) {
      arcaneLines.push('');
      arcaneLines.push('Recent magical events in this region:');
      for (const evt of magicEvents.slice(0, 3)) {
        arcaneLines.push(`  Y${tickToYear(evt.timestamp)} -- ${eventDescription(evt)}`);
      }
    }
  } else {
    // Check if any magical events exist nearby regardless of ley line
    const magicEvents = matchedEvents.filter(e => e.category === EventCategory.Magical);
    if (magicEvents.length > 0) {
      arcaneLines.push('Though no ley line runs beneath this land, magical events have been recorded:');
      arcaneLines.push('');
      for (const evt of magicEvents.slice(0, 3)) {
        arcaneLines.push(`  Y${tickToYear(evt.timestamp)} -- ${eventDescription(evt)}`);
      }
    } else {
      arcaneLines.push('No significant magical currents flow through this region.');
    }
  }

  // ── Build sections ──────────────────────────────────────────────────
  const sections: InspectorSection[] = [
    { title: 'The Land Itself', content: landLines.join('\n') },
    { title: 'Riches of the Earth', content: richesLines.join('\n') },
    { title: 'Those Who Dwell Here', content: dwellerLines.join('\n') },
    { title: 'Marks Upon the Land', content: marksLines.join('\n') },
    { title: 'Echoes of the Past', content: echoLines.join('\n') },
    { title: 'Arcane Currents', content: arcaneLines.join('\n') },
  ];

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (tileBiome !== undefined) summaryParts.push(tileBiome);
  summaryParts.push(`(${x}, ${y})`);

  const proseLines: string[] = [];
  if (tileBiome !== undefined) {
    const biomeProse = BIOME_PROSE[tileBiome];
    if (biomeProse !== undefined) proseLines.push(biomeProse);
  }

  return {
    entityType: 'region',
    entityName: tileBiome !== undefined ? `${tileBiome} (${x}, ${y})` : `Region (${x}, ${y})`,
    summary: summaryParts.join(' | '),
    sections,
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}
