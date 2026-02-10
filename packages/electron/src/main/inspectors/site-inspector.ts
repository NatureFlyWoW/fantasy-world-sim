// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Site Inspector — extracts structured data for site entities.
 */

import { World, WorldClock, EventLog } from '@fws/core';
import type { EntityId } from '@fws/core';
import type { InspectorResponse } from '../../shared/types.js';
import {
  EntityRefCollector,
  resolveName,
  entityMarker,
  tickToYear,
  getSettlementSize,
  getEconomicState,
  getFortificationName,
  renderBar,
  eventDescription,
  SETTLEMENT_SIZE_PROSE,
  ECONOMIC_PROSE,
  FORTIFICATION_PROSE,
} from './shared.js';

export function inspectSite(
  id: number,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  const eid = id as unknown as EntityId;
  const refs = new EntityRefCollector();

  const name = resolveName(id, world);

  // ── Section 1: A Living Portrait ────────────────────────────────────
  const portraitLines: string[] = [];

  const sitePopulation = world.hasStore('Population')
    ? world.getComponent(eid, 'Population') as { count?: number; growthRate?: number } | undefined
    : undefined;
  const ownership = world.hasStore('Ownership')
    ? world.getComponent(eid, 'Ownership') as { ownerId?: number | null; claimStrength?: number } | undefined
    : undefined;
  const position = world.hasStore('Position')
    ? world.getComponent(eid, 'Position') as { x?: number; y?: number } | undefined
    : undefined;
  const siteHistory = world.hasStore('History')
    ? world.getComponent(eid, 'History') as { foundingDate?: number } | undefined
    : undefined;
  const biome = world.hasStore('Biome')
    ? world.getComponent(eid, 'Biome') as { biomeType?: string; fertility?: number; moisture?: number } | undefined
    : undefined;

  if (sitePopulation?.count !== undefined) {
    const sizeCategory = getSettlementSize(sitePopulation.count);
    const sizeProse = SETTLEMENT_SIZE_PROSE[sizeCategory];
    if (sizeProse !== undefined) {
      portraitLines.push(`${sizeProse}.`);
      portraitLines.push('');
    }
  }

  if (biome?.biomeType !== undefined) {
    portraitLines.push(`The settlement sits amid ${biome.biomeType.toLowerCase()} terrain.`);
  }

  if (siteHistory?.foundingDate !== undefined) {
    const foundingYear = tickToYear(siteHistory.foundingDate);
    const currentYear = tickToYear(clock.currentTick);
    const age = currentYear - foundingYear;
    portraitLines.push(`Founded in Year ${foundingYear}${age > 0 ? ` (${age} years ago)` : ''}.`);
  }

  portraitLines.push('');

  if (sitePopulation?.count !== undefined) {
    const sizeCategory = getSettlementSize(sitePopulation.count);
    portraitLines.push(`Population: ${sitePopulation.count.toLocaleString()} (${sizeCategory})`);
    if (sitePopulation.growthRate !== undefined) {
      const growthPct = (sitePopulation.growthRate * 100).toFixed(1);
      const growthSign = sitePopulation.growthRate >= 0 ? '+' : '';
      portraitLines.push(`Growth: ${growthSign}${growthPct}%`);
    }
  }

  if (ownership?.ownerId !== undefined && ownership.ownerId !== null) {
    const factionMarker = entityMarker(ownership.ownerId, 'faction', world, refs);
    portraitLines.push(`Ruling Faction: ${factionMarker}`);
  }

  if (position !== undefined && position.x !== undefined && position.y !== undefined) {
    portraitLines.push(`Coordinates: (${position.x}, ${position.y})`);
  }

  if (portraitLines.length === 0) portraitLines.push('No information available about this location.');

  // ── Section 2: People & Peoples ─────────────────────────────────────
  const peopleLines: string[] = [];

  const demographics = world.hasStore('PopulationDemographics')
    ? world.getComponent(eid, 'PopulationDemographics') as {
        ageDistribution?: Map<string, number>; raceDistribution?: Map<string, number>;
      } | undefined
    : undefined;

  const siteCulture = world.hasStore('Culture')
    ? world.getComponent(eid, 'Culture') as { traditions?: string[]; values?: string[]; languageId?: number | null } | undefined
    : undefined;

  if (demographics?.raceDistribution !== undefined && demographics.raceDistribution.size > 0) {
    const total = [...demographics.raceDistribution.values()].reduce((a, b) => a + b, 0);
    let dominantRace = '';
    let dominantPct = 0;
    for (const [race, count] of demographics.raceDistribution) {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      if (pct > dominantPct) { dominantPct = pct; dominantRace = race; }
    }
    if (dominantRace.length > 0) {
      peopleLines.push(`The population is predominantly ${dominantRace.toLowerCase()}.`);
      peopleLines.push('');
    }
    peopleLines.push('Population by Race:');
    for (const [race, count] of demographics.raceDistribution) {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      peopleLines.push(`  ${race}: ${renderBar(pct, 100)} ${pct}%`);
    }
    peopleLines.push('');
  }

  if (siteCulture !== undefined) {
    if (siteCulture.traditions !== undefined && siteCulture.traditions.length > 0) {
      peopleLines.push('Traditions:');
      for (const tradition of siteCulture.traditions) {
        peopleLines.push(`  * ${tradition}`);
      }
      peopleLines.push('');
    }
    if (siteCulture.values !== undefined && siteCulture.values.length > 0) {
      peopleLines.push(`Cultural Values: ${siteCulture.values.join(' | ')}`);
    }
    if (siteCulture.languageId !== undefined && siteCulture.languageId !== null) {
      const langMarker = entityMarker(siteCulture.languageId, 'site', world, refs);
      peopleLines.push(`Language: ${langMarker}`);
    }
  }

  if (peopleLines.length === 0) peopleLines.push('No demographic data available.');

  // ── Section 3: Power & Governance ───────────────────────────────────
  const powerLines: string[] = [];

  const siteGov = world.hasStore('Government')
    ? world.getComponent(eid, 'Government') as { governmentType?: string; stability?: number; legitimacy?: number } | undefined
    : undefined;

  if (siteGov?.governmentType !== undefined && ownership?.ownerId !== undefined && ownership.ownerId !== null) {
    const factionMarker = entityMarker(ownership.ownerId, 'faction', world, refs);
    powerLines.push(`Governed as part of ${factionMarker} under a ${siteGov.governmentType} system.`);
    powerLines.push('');
  }

  if (siteGov !== undefined) {
    if (siteGov.governmentType !== undefined) powerLines.push(`Government: ${siteGov.governmentType}`);
    if (siteGov.stability !== undefined) powerLines.push(`Stability: ${renderBar(siteGov.stability, 100)} ${siteGov.stability}%`);
    if (siteGov.legitimacy !== undefined) powerLines.push(`Legitimacy: ${renderBar(siteGov.legitimacy, 100)} ${siteGov.legitimacy}%`);
  }

  if (ownership !== undefined) {
    if (ownership.ownerId !== undefined && ownership.ownerId !== null) {
      const factionMarker = entityMarker(ownership.ownerId, 'faction', world, refs);
      powerLines.push(`Ruling Faction: ${factionMarker}`);
    }
    if (ownership.claimStrength !== undefined) {
      powerLines.push(`Claim Strength: ${renderBar(ownership.claimStrength, 100)} ${ownership.claimStrength}%`);
    }
  }

  if (powerLines.length === 0) powerLines.push('No governance data available.');

  // ── Section 4: Trade & Industry ─────────────────────────────────────
  const tradeLines: string[] = [];

  const siteEconomy = world.hasStore('Economy')
    ? world.getComponent(eid, 'Economy') as { wealth?: number; tradeVolume?: number; industries?: string[] } | undefined
    : undefined;
  const resources = world.hasStore('Resource')
    ? world.getComponent(eid, 'Resource') as { resources?: Map<string, number> } | undefined
    : undefined;

  if (siteEconomy?.wealth !== undefined) {
    const state = getEconomicState(siteEconomy.wealth);
    const prose = ECONOMIC_PROSE[state];
    if (prose !== undefined) {
      tradeLines.push(`${prose}.`);
      tradeLines.push('');
    }
  }

  if (siteEconomy !== undefined) {
    if (siteEconomy.wealth !== undefined) tradeLines.push(`Treasury: ${siteEconomy.wealth.toLocaleString()}`);
    if (siteEconomy.tradeVolume !== undefined) tradeLines.push(`Trade Volume: ${siteEconomy.tradeVolume.toLocaleString()}`);
    if (siteEconomy.industries !== undefined && siteEconomy.industries.length > 0) {
      tradeLines.push('');
      tradeLines.push('Industries:');
      for (const industry of siteEconomy.industries) {
        tradeLines.push(`  * ${industry}`);
      }
    }
  }

  if (resources?.resources !== undefined && resources.resources.size > 0) {
    tradeLines.push('');
    tradeLines.push('Resources:');
    for (const [resource, amount] of resources.resources) {
      tradeLines.push(`  ${resource}: ${amount}`);
    }
  }

  if (tradeLines.length === 0) tradeLines.push('No economic data available.');

  // ── Section 5: Walls & Works ────────────────────────────────────────
  const wallsLines: string[] = [];

  const siteMilitary = world.hasStore('Military')
    ? world.getComponent(eid, 'Military') as { strength?: number; morale?: number; training?: number } | undefined
    : undefined;
  const structures = world.hasStore('Structures')
    ? world.getComponent(eid, 'Structures') as { fortificationLevel?: number; buildings?: string[] } | undefined
    : undefined;
  const condition = world.hasStore('Condition')
    ? world.getComponent(eid, 'Condition') as { durability?: number; maintenanceLevel?: number } | undefined
    : undefined;

  if (structures?.fortificationLevel !== undefined) {
    const fortName = getFortificationName(structures.fortificationLevel);
    const fortProse = FORTIFICATION_PROSE[fortName];
    if (fortProse !== undefined) {
      wallsLines.push(`${fortProse}.`);
      wallsLines.push('');
    }
    wallsLines.push(`Fortifications: ${fortName} (Level ${structures.fortificationLevel})`);
  }

  if (siteMilitary !== undefined) {
    if (siteMilitary.strength !== undefined) wallsLines.push(`Garrison: ${siteMilitary.strength.toLocaleString()} soldiers`);
    if (siteMilitary.morale !== undefined) wallsLines.push(`Morale: ${renderBar(siteMilitary.morale, 100)} ${siteMilitary.morale}%`);
    if (siteMilitary.training !== undefined) wallsLines.push(`Training: ${renderBar(siteMilitary.training, 100)} ${siteMilitary.training}%`);
  }

  if (structures?.buildings !== undefined && structures.buildings.length > 0) {
    wallsLines.push('');
    wallsLines.push('Notable Buildings:');
    for (const building of structures.buildings) {
      wallsLines.push(`  * ${building}`);
    }
  }

  if (condition !== undefined) {
    wallsLines.push('');
    if (condition.durability !== undefined) wallsLines.push(`Durability: ${renderBar(condition.durability, 100)} ${condition.durability}%`);
    if (condition.maintenanceLevel !== undefined) wallsLines.push(`Maintenance: ${renderBar(condition.maintenanceLevel, 100)} ${condition.maintenanceLevel}%`);
  }

  if (wallsLines.length === 0) wallsLines.push('No structural or military data available.');

  // ── Section 6: Notable Souls ────────────────────────────────────────
  const soulsLines: string[] = [];

  if (position?.x !== undefined && position.y !== undefined && world.hasStore('Position')) {
    const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> };
    const characters: Array<[number, string]> = [];

    for (const [checkEid, ePos] of posStore.getAll()) {
      if (checkEid !== eid && ePos.x === position.x && ePos.y === position.y) {
        if (world.hasStore('Attribute') && world.getComponent(checkEid, 'Attribute') !== undefined) {
          const charId = checkEid as unknown as number;
          const charName = resolveName(charId, world);
          characters.push([charId, charName]);
        }
      }
    }

    if (characters.length > 0) {
      soulsLines.push(`${characters.length} figure${characters.length > 1 ? 's' : ''} of note reside${characters.length === 1 ? 's' : ''} here:`);
      soulsLines.push('');
      for (const [charId, _charName] of characters.slice(0, 10)) {
        const marker = entityMarker(charId, 'character', world, refs);
        soulsLines.push(`  @ ${marker}`);
      }
      if (characters.length > 10) {
        soulsLines.push(`  And ${characters.length - 10} others of lesser renown.`);
      }
    }
  }

  if (soulsLines.length === 0) soulsLines.push('No notable inhabitants recorded.');

  // ── Section 7: The Annals ───────────────────────────────────────────
  const annalsLines: string[] = [];

  if (siteHistory?.foundingDate !== undefined) {
    annalsLines.push(`Founded: Year ${tickToYear(siteHistory.foundingDate)}`);
    annalsLines.push('');
  }

  const siteEvents = eventLog.getByEntity(eid);
  if (siteEvents.length > 0) {
    annalsLines.push('Defining moments:');
    const sorted = [...siteEvents].sort((a, b) => b.significance - a.significance);
    for (const event of sorted.slice(0, 5)) {
      annalsLines.push(`  Y${tickToYear(event.timestamp)} -- ${eventDescription(event)}`);
    }
    if (siteEvents.length > 5) {
      annalsLines.push(`  And ${siteEvents.length - 5} more recorded events.`);
    }
  } else {
    annalsLines.push('No recorded events for this location.');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (sitePopulation?.count !== undefined) {
    summaryParts.push(getSettlementSize(sitePopulation.count));
    summaryParts.push(`Pop: ${sitePopulation.count.toLocaleString()}`);
  }
  if (ownership?.ownerId !== undefined && ownership.ownerId !== null) {
    summaryParts.push(resolveName(ownership.ownerId, world));
  }

  const proseLines: string[] = [];
  if (sitePopulation?.count !== undefined) {
    const sizeProse = SETTLEMENT_SIZE_PROSE[getSettlementSize(sitePopulation.count)];
    if (sizeProse !== undefined) proseLines.push(`${sizeProse}.`);
  }

  return {
    entityType: 'site',
    entityName: name,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'A Living Portrait', content: portraitLines.join('\n') },
      { title: 'People & Peoples', content: peopleLines.join('\n') },
      { title: 'Power & Governance', content: powerLines.join('\n') },
      { title: 'Trade & Industry', content: tradeLines.join('\n') },
      { title: 'Walls & Works', content: wallsLines.join('\n') },
      { title: 'Notable Souls', content: soulsLines.join('\n') },
      { title: 'The Annals', content: annalsLines.join('\n') },
    ],
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}
