// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Faction Inspector — extracts structured data for faction entities.
 */

import { World, WorldClock, EventLog } from '@fws/core';
import type { EntityId } from '@fws/core';
import type { InspectorResponse } from '../../shared/types.js';
import {
  EntityRefCollector,
  entityMarker,
  tickToYear,
  renderBar,
  getMilitaryState,
  getEconomicState,
  getDiplomacyLabel,
  getSignificanceLabel,
  eventDescription,
  MILITARY_PROSE,
  ECONOMIC_PROSE,
} from './shared.js';

export function inspectFaction(
  id: number,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  const eid = id as unknown as EntityId;
  const refs = new EntityRefCollector();

  const status = world.hasStore('Status')
    ? world.getComponent(eid, 'Status') as { titles?: string[] } | undefined
    : undefined;
  const factionName = (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined)
    ? status.titles[0]
    : `Faction #${id}`;

  // ── Section 1: Rise & Reign ─────────────────────────────────────────
  const riseLines: string[] = [];

  const origin = world.hasStore('Origin')
    ? world.getComponent(eid, 'Origin') as { founderId?: number | null; foundingTick?: number; foundingLocation?: number | null } | undefined
    : undefined;
  const history = world.hasStore('History')
    ? world.getComponent(eid, 'History') as { foundingDate?: number } | undefined
    : undefined;
  const government = world.hasStore('Government')
    ? world.getComponent(eid, 'Government') as { governmentType?: string; stability?: number; legitimacy?: number } | undefined
    : undefined;
  const population = world.hasStore('Population')
    ? world.getComponent(eid, 'Population') as { count?: number } | undefined
    : undefined;

  const foundingTick = origin?.foundingTick ?? history?.foundingDate;
  if (foundingTick !== undefined) {
    const foundingYear = tickToYear(foundingTick);
    const currentYear = tickToYear(clock.currentTick);
    const age = currentYear - foundingYear;

    if (origin?.founderId !== undefined && origin.founderId !== null) {
      const founderMarker = entityMarker(origin.founderId, 'character', world, refs);
      riseLines.push(`${factionName} was founded in Year ${foundingYear} by ${founderMarker}.`);
    } else {
      riseLines.push(`${factionName} was established in Year ${foundingYear}.`);
    }
    if (age > 0) riseLines.push(`For ${age} years it has endured, shaping the history of this land.`);
    riseLines.push('');
  }

  if (government !== undefined) {
    if (government.governmentType !== undefined) riseLines.push(`Government: ${government.governmentType}`);
    if (government.stability !== undefined) riseLines.push(`Stability: ${renderBar(government.stability, 100)} ${government.stability}%`);
    if (government.legitimacy !== undefined) riseLines.push(`Legitimacy: ${renderBar(government.legitimacy, 100)} ${government.legitimacy}%`);
  }

  if (population?.count !== undefined) {
    riseLines.push(`Total Population: ${population.count.toLocaleString()}`);
  }

  if (riseLines.length === 0) riseLines.push('No historical data available for this faction.');

  // ── Section 2: Banner & Creed ───────────────────────────────────────
  const bannerLines: string[] = [];

  const culture = world.hasStore('Culture')
    ? world.getComponent(eid, 'Culture') as { traditions?: string[]; values?: string[] } | undefined
    : undefined;
  const doctrine = world.hasStore('Doctrine')
    ? world.getComponent(eid, 'Doctrine') as { beliefs?: string[]; prohibitions?: string[] } | undefined
    : undefined;

  if (culture?.values !== undefined && culture.values.length > 0) {
    bannerLines.push('Guiding Principles:');
    for (const value of culture.values) {
      bannerLines.push(`  * ${value}`);
    }
    bannerLines.push('');
  }

  if (doctrine?.beliefs !== undefined && doctrine.beliefs.length > 0) {
    bannerLines.push('Sacred Tenets:');
    for (const belief of doctrine.beliefs.slice(0, 5)) {
      bannerLines.push(`  * ${belief}`);
    }
    bannerLines.push('');
  }

  if (doctrine?.prohibitions !== undefined && doctrine.prohibitions.length > 0) {
    bannerLines.push('Forbidden Acts:');
    for (const prohibition of doctrine.prohibitions.slice(0, 3)) {
      bannerLines.push(`  * ${prohibition}`);
    }
  }

  if (bannerLines.length === 0) bannerLines.push('No cultural data available.');

  // ── Section 3: Court & Council ──────────────────────────────────────
  const courtLines: string[] = [];

  const hierarchy = world.hasStore('Hierarchy')
    ? world.getComponent(eid, 'Hierarchy') as { leaderId?: number | null; subordinateIds?: number[] } | undefined
    : undefined;

  if (hierarchy !== undefined) {
    if (hierarchy.leaderId !== undefined && hierarchy.leaderId !== null) {
      const leaderMarker = entityMarker(hierarchy.leaderId, 'character', world, refs);
      courtLines.push(`${leaderMarker} ......... (Leader)`);
    }
    if (hierarchy.subordinateIds !== undefined && hierarchy.subordinateIds.length > 0) {
      courtLines.push('');
      for (const subId of hierarchy.subordinateIds.slice(0, 10)) {
        const marker = entityMarker(subId, 'character', world, refs);
        courtLines.push(`  ${marker}`);
      }
      if (hierarchy.subordinateIds.length > 10) {
        courtLines.push(`  And ${hierarchy.subordinateIds.length - 10} other members of note.`);
      }
    }
  }

  if (courtLines.length === 0) courtLines.push('No leadership data available.');

  // ── Section 4: Lands & Holdings ─────────────────────────────────────
  const landsLines: string[] = [];

  const territory = world.hasStore('Territory')
    ? world.getComponent(eid, 'Territory') as { controlledRegions?: number[]; capitalId?: number | null } | undefined
    : undefined;

  if (territory !== undefined) {
    if (territory.controlledRegions !== undefined && territory.controlledRegions.length > 0) {
      landsLines.push(`The faction controls ${territory.controlledRegions.length} regions.`);
      landsLines.push('');
    }
    if (territory.capitalId !== undefined && territory.capitalId !== null) {
      const capitalMarker = entityMarker(territory.capitalId, 'site', world, refs);
      landsLines.push(`Capital: ${capitalMarker}`);
      landsLines.push('');
    }
    if (territory.controlledRegions !== undefined && territory.controlledRegions.length > 0) {
      landsLines.push('Controlled Regions:');
      for (const regionId of territory.controlledRegions.slice(0, 10)) {
        const marker = entityMarker(regionId, 'site', world, refs);
        landsLines.push(`  ~ ${marker}`);
      }
      if (territory.controlledRegions.length > 10) {
        landsLines.push(`  ... and ${territory.controlledRegions.length - 10} more`);
      }
    }
  }

  if (landsLines.length === 0) landsLines.push('No territory data available.');

  // ── Section 5: Swords & Shields ─────────────────────────────────────
  const swordsLines: string[] = [];

  const military = world.hasStore('Military')
    ? world.getComponent(eid, 'Military') as { strength?: number; morale?: number; training?: number } | undefined
    : undefined;

  if (military?.strength !== undefined && military.morale !== undefined) {
    const state = getMilitaryState(military.strength, military.morale);
    const prose = MILITARY_PROSE[state];
    if (prose !== undefined) {
      swordsLines.push(`${prose}.`);
      swordsLines.push('');
    }
  }

  if (military !== undefined) {
    if (military.strength !== undefined) swordsLines.push(`Total Strength: ${military.strength.toLocaleString()}`);
    if (military.morale !== undefined) swordsLines.push(`Morale: ${renderBar(military.morale, 100)} ${military.morale}%`);
    if (military.training !== undefined) swordsLines.push(`Training: ${renderBar(military.training, 100)} ${military.training}%`);
  }

  const factionEvents = eventLog.getByEntity(eid);
  const recentMilitary = factionEvents.filter(e => e.category === 'Military' && e.significance >= 50);
  if (recentMilitary.length > 0) {
    swordsLines.push('');
    swordsLines.push('Active Conflicts:');
    for (const event of recentMilitary.slice(0, 5)) {
      swordsLines.push(`  Y${tickToYear(event.timestamp)} -- ${eventDescription(event)}`);
    }
  }

  if (swordsLines.length === 0) swordsLines.push('No military data available.');

  // ── Section 6: Alliances & Enmities ─────────────────────────────────
  const allianceLines: string[] = [];

  const diplomacy = world.hasStore('Diplomacy')
    ? world.getComponent(eid, 'Diplomacy') as { relations?: Map<number, number>; treaties?: string[] } | undefined
    : undefined;

  if (diplomacy?.relations !== undefined && diplomacy.relations.size > 0) {
    const allies: Array<[number, number]> = [];
    const enemies: Array<[number, number]> = [];
    const neutral: Array<[number, number]> = [];

    for (const [factionId, relation] of diplomacy.relations) {
      if (relation >= 50) allies.push([factionId, relation]);
      else if (relation <= -50) enemies.push([factionId, relation]);
      else neutral.push([factionId, relation]);
    }
    allies.sort((a, b) => b[1] - a[1]);
    enemies.sort((a, b) => a[1] - b[1]);

    if (allies.length > 0) {
      allianceLines.push('ALLIES:');
      for (const [factionId, relation] of allies) {
        const marker = entityMarker(factionId, 'faction', world, refs);
        const label = getDiplomacyLabel(relation);
        allianceLines.push(`  ${marker} ......... ${label} [+${relation}]`);
      }
      allianceLines.push('');
    }

    if (enemies.length > 0) {
      allianceLines.push('ENEMIES:');
      for (const [factionId, relation] of enemies) {
        const marker = entityMarker(factionId, 'faction', world, refs);
        const label = getDiplomacyLabel(relation);
        allianceLines.push(`  ${marker} ......... ${label} [${relation}]`);
      }
      allianceLines.push('');
    }

    if (neutral.length > 0) {
      allianceLines.push('NEUTRAL:');
      for (const [factionId, relation] of neutral) {
        const marker = entityMarker(factionId, 'faction', world, refs);
        const label = getDiplomacyLabel(relation);
        const sign = relation >= 0 ? '+' : '';
        allianceLines.push(`  ${marker} ......... ${label} [${sign}${relation}]`);
      }
      allianceLines.push('');
    }
  }

  if (diplomacy?.treaties !== undefined && diplomacy.treaties.length > 0) {
    allianceLines.push('Treaties:');
    for (const treaty of diplomacy.treaties) {
      allianceLines.push(`  * ${treaty}`);
    }
  }

  if (allianceLines.length === 0) allianceLines.push('No diplomatic data available.');

  // ── Section 7: Coffers & Commerce ───────────────────────────────────
  const cofferLines: string[] = [];

  const economy = world.hasStore('Economy')
    ? world.getComponent(eid, 'Economy') as { wealth?: number; tradeVolume?: number; industries?: string[] } | undefined
    : undefined;
  const fWealth = world.hasStore('Wealth')
    ? world.getComponent(eid, 'Wealth') as { coins?: number; propertyValue?: number; debts?: number } | undefined
    : undefined;

  if (economy?.wealth !== undefined) {
    const state = getEconomicState(economy.wealth);
    const prose = ECONOMIC_PROSE[state];
    if (prose !== undefined) {
      cofferLines.push(`${prose}.`);
      cofferLines.push('');
    }
  }

  if (economy !== undefined) {
    if (economy.wealth !== undefined) cofferLines.push(`Treasury: ${economy.wealth.toLocaleString()}`);
    if (economy.tradeVolume !== undefined) cofferLines.push(`Trade Volume: ${economy.tradeVolume.toLocaleString()}`);
    if (economy.industries !== undefined && economy.industries.length > 0) {
      cofferLines.push('');
      cofferLines.push('Major Industries:');
      for (const industry of economy.industries) {
        cofferLines.push(`  * ${industry}`);
      }
    }
  }

  if (fWealth !== undefined) {
    cofferLines.push('');
    if (fWealth.propertyValue !== undefined) cofferLines.push(`Total Assets: ${fWealth.propertyValue.toLocaleString()}`);
    if (fWealth.debts !== undefined && fWealth.debts > 0) cofferLines.push(`National Debt: ${fWealth.debts.toLocaleString()}`);
  }

  if (cofferLines.length === 0) cofferLines.push('No economic data available.');

  // ── Section 8: Chronicles ───────────────────────────────────────────
  const chronicleLines: string[] = [];

  if (foundingTick !== undefined) {
    chronicleLines.push(`Founded: Year ${tickToYear(foundingTick)}`);
    if (origin?.founderId !== undefined && origin.founderId !== null) {
      const founderMarker = entityMarker(origin.founderId, 'character', world, refs);
      chronicleLines.push(`Founder: ${founderMarker}`);
    }
    if (origin?.foundingLocation !== undefined && origin.foundingLocation !== null) {
      const locMarker = entityMarker(origin.foundingLocation, 'site', world, refs);
      chronicleLines.push(`Origin: ${locMarker}`);
    }
    chronicleLines.push('');
  }

  if (factionEvents.length > 0) {
    chronicleLines.push('Defining moments:');
    const sorted = [...factionEvents].sort((a, b) => b.significance - a.significance);
    for (const event of sorted.slice(0, 10)) {
      const sigLabel = getSignificanceLabel(event.significance);
      chronicleLines.push(`  Y${tickToYear(event.timestamp)} -- ${eventDescription(event)}`);
      chronicleLines.push(`    ${event.category} | ${sigLabel} (${event.significance})`);
    }
    if (factionEvents.length > 10) {
      chronicleLines.push(`  And ${factionEvents.length - 10} more recorded events.`);
    }
  } else {
    chronicleLines.push('No historical events recorded.');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (government?.governmentType !== undefined) summaryParts.push(government.governmentType);
  if (population?.count !== undefined) summaryParts.push(`Pop: ${population.count.toLocaleString()}`);
  if (territory?.controlledRegions !== undefined) summaryParts.push(`${territory.controlledRegions.length} regions`);

  const proseLines: string[] = [];
  if (foundingTick !== undefined) {
    const age = tickToYear(clock.currentTick) - tickToYear(foundingTick);
    if (age > 0) proseLines.push(`For ${age} years, ${factionName} has endured.`);
  }

  return {
    entityType: 'faction',
    entityName: factionName,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'Rise & Reign', content: riseLines.join('\n') },
      { title: 'Banner & Creed', content: bannerLines.join('\n') },
      { title: 'Court & Council', content: courtLines.join('\n') },
      { title: 'Lands & Holdings', content: landsLines.join('\n') },
      { title: 'Swords & Shields', content: swordsLines.join('\n') },
      { title: 'Alliances & Enmities', content: allianceLines.join('\n') },
      { title: 'Coffers & Commerce', content: cofferLines.join('\n') },
      { title: 'Chronicles', content: chronicleLines.join('\n') },
    ],
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}
