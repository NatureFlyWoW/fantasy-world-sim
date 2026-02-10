// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Artifact Inspector — extracts structured data for artifact entities.
 */

import { World, WorldClock, EventLog } from '@fws/core';
import type { EntityId } from '@fws/core';
import type { InspectorResponse } from '../../shared/types.js';
import {
  EntityRefCollector,
  resolveName,
  entityMarker,
  tickToYear,
  renderBar,
  getPowerTierName,
  getRarityLabel,
  eventDescription,
} from './shared.js';

export function inspectArtifact(
  id: number,
  world: World,
  eventLog: EventLog,
  _clock: WorldClock,
): InspectorResponse {
  const eid = id as unknown as EntityId;
  const refs = new EntityRefCollector();

  const name = resolveName(id, world);

  // ── Section 1: Overview ─────────────────────────────────────────────
  const overviewLines: string[] = [];

  const status = world.hasStore('Status')
    ? world.getComponent(eid, 'Status') as { titles?: string[] } | undefined
    : undefined;
  const value = world.hasStore('Value')
    ? world.getComponent(eid, 'Value') as { monetaryValue?: number; sentimentalValue?: number; magicalValue?: number } | undefined
    : undefined;
  const location = world.hasStore('Location')
    ? world.getComponent(eid, 'Location') as { currentLocationId?: number | null } | undefined
    : undefined;

  if (status?.titles !== undefined && status.titles.length > 0) {
    overviewLines.push(`Name: ${status.titles[0] ?? 'Unknown Artifact'}`);
    if (status.titles.length > 1) {
      overviewLines.push(`Also known as: ${status.titles.slice(1).join(', ')}`);
    }
  } else {
    overviewLines.push(`Artifact #${id}`);
  }

  if (location?.currentLocationId !== undefined && location.currentLocationId !== null) {
    const locMarker = entityMarker(location.currentLocationId, 'site', world, refs);
    overviewLines.push(`Location: ${locMarker}`);
  } else {
    overviewLines.push('Location: Unknown');
  }

  if (value !== undefined) {
    const totalValue = (value.monetaryValue ?? 0) + (value.magicalValue ?? 0);
    if (totalValue > 0) {
      overviewLines.push(`Rarity: ${getRarityLabel(totalValue)}`);
    }
  }

  // ── Section 2: Creation ─────────────────────────────────────────────
  const creationLines: string[] = [];

  const creation = world.hasStore('CreationHistory')
    ? world.getComponent(eid, 'CreationHistory') as { creatorId?: number; creationTick?: number; method?: string } | undefined
    : undefined;
  const artOrigin = world.hasStore('Origin')
    ? world.getComponent(eid, 'Origin') as { founderId?: number | null; foundingTick?: number; foundingLocation?: number | null } | undefined
    : undefined;

  if (creation !== undefined) {
    if (creation.creatorId !== undefined) {
      const creatorMarker = entityMarker(creation.creatorId, 'character', world, refs);
      creationLines.push(`Creator: ${creatorMarker}`);
    }
    if (creation.creationTick !== undefined) {
      creationLines.push(`Created: Year ${tickToYear(creation.creationTick)}`);
    }
    if (creation.method !== undefined) {
      creationLines.push(`Method: ${creation.method}`);
    }
  } else if (artOrigin !== undefined) {
    if (artOrigin.founderId !== undefined && artOrigin.founderId !== null) {
      const creatorMarker = entityMarker(artOrigin.founderId, 'character', world, refs);
      creationLines.push(`Creator: ${creatorMarker}`);
    }
    if (artOrigin.foundingTick !== undefined) {
      creationLines.push(`Created: Year ${tickToYear(artOrigin.foundingTick)}`);
    }
    if (artOrigin.foundingLocation !== undefined && artOrigin.foundingLocation !== null) {
      const locMarker = entityMarker(artOrigin.foundingLocation, 'site', world, refs);
      creationLines.push(`Place of Creation: ${locMarker}`);
    }
  } else {
    creationLines.push('Origin unknown');
  }

  // ── Section 3: Powers ───────────────────────────────────────────────
  const powerLines: string[] = [];

  const magical = world.hasStore('MagicalProperty')
    ? world.getComponent(eid, 'MagicalProperty') as { enchantments?: string[]; powerLevel?: number } | undefined
    : undefined;
  const power = world.hasStore('Power')
    ? world.getComponent(eid, 'Power') as { abilities?: string[]; manaPool?: number; rechargeRate?: number } | undefined
    : undefined;
  const powerLevel = world.hasStore('PowerLevel')
    ? world.getComponent(eid, 'PowerLevel') as { tier?: number; potency?: number } | undefined
    : undefined;

  if (powerLevel !== undefined) {
    if (powerLevel.tier !== undefined) {
      powerLines.push(`Power Tier: ${getPowerTierName(powerLevel.tier)} (${powerLevel.tier})`);
    }
    if (powerLevel.potency !== undefined) {
      powerLines.push(`Potency: ${renderBar(powerLevel.potency, 100)} ${powerLevel.potency}%`);
    }
  }

  if (magical !== undefined) {
    if (magical.powerLevel !== undefined && powerLevel === undefined) {
      powerLines.push(`Power Level: ${renderBar(magical.powerLevel, 100)} ${magical.powerLevel}%`);
    }
    if (magical.enchantments !== undefined && magical.enchantments.length > 0) {
      powerLines.push('');
      powerLines.push('Enchantments:');
      for (const enchant of magical.enchantments) {
        powerLines.push(`  * ${enchant}`);
      }
    }
  }

  if (power !== undefined) {
    if (power.abilities !== undefined && power.abilities.length > 0) {
      powerLines.push('');
      powerLines.push('Abilities:');
      for (const ability of power.abilities) {
        powerLines.push(`  * ${ability}`);
      }
    }
    if (power.manaPool !== undefined) {
      powerLines.push('');
      powerLines.push(`Mana Pool: ${power.manaPool}`);
      if (power.rechargeRate !== undefined) {
        powerLines.push(`Recharge Rate: ${power.rechargeRate}/day`);
      }
    }
  }

  if (powerLines.length === 0) powerLines.push('No magical properties detected.');

  // ── Section 4: Ownership Chain ──────────────────────────────────────
  const ownershipLines: string[] = [];

  const guardian = world.hasStore('Guardian')
    ? world.getComponent(eid, 'Guardian') as { guardianId?: number | null; protectionLevel?: number } | undefined
    : undefined;
  const ownershipChain = world.hasStore('OwnershipChain')
    ? world.getComponent(eid, 'OwnershipChain') as {
        owners?: Array<{ ownerId: number; fromTick: number; toTick: number | null }>;
      } | undefined
    : undefined;

  if (guardian?.guardianId !== undefined && guardian.guardianId !== null) {
    const guardianMarker = entityMarker(guardian.guardianId, 'character', world, refs);
    ownershipLines.push(`Current Guardian: ${guardianMarker}`);
    if (guardian.protectionLevel !== undefined) {
      ownershipLines.push(`Protection Level: ${renderBar(guardian.protectionLevel, 100)} ${guardian.protectionLevel}%`);
    }
    ownershipLines.push('');
  }

  if (ownershipChain?.owners !== undefined && ownershipChain.owners.length > 0) {
    ownershipLines.push('Ownership History:');
    const sorted = [...ownershipChain.owners].sort((a, b) => b.fromTick - a.fromTick);
    for (const owner of sorted) {
      const fromYear = tickToYear(owner.fromTick);
      const toYear = owner.toTick !== null ? String(tickToYear(owner.toTick)) : 'present';
      const ownerMarker = entityMarker(owner.ownerId, 'character', world, refs);
      ownershipLines.push(`  Y${fromYear}-${toYear}: ${ownerMarker}`);
    }
  } else if (ownershipLines.length === 0) {
    ownershipLines.push('No ownership records.');
  }

  // ── Section 5: History ──────────────────────────────────────────────
  const historyLines: string[] = [];

  const artEvents = eventLog.getByEntity(eid);
  if (artEvents.length > 0) {
    historyLines.push('Event History:');
    const sorted = [...artEvents].sort((a, b) => b.timestamp - a.timestamp);
    for (const event of sorted.slice(0, 15)) {
      historyLines.push(`  Y${tickToYear(event.timestamp)}: ${eventDescription(event)}`);
    }
    if (sorted.length > 15) {
      historyLines.push(`  ... and ${sorted.length - 15} more events`);
    }
  } else {
    historyLines.push('No recorded events.');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (value !== undefined) {
    const totalValue = (value.monetaryValue ?? 0) + (value.magicalValue ?? 0);
    if (totalValue > 0) summaryParts.push(getRarityLabel(totalValue));
  }
  if (powerLevel?.tier !== undefined) {
    summaryParts.push(`${getPowerTierName(powerLevel.tier)} Power`);
  }

  return {
    entityType: 'artifact',
    entityName: name,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'Overview', content: overviewLines.join('\n') },
      { title: 'Creation', content: creationLines.join('\n') },
      { title: 'Powers', content: powerLines.join('\n') },
      { title: 'Ownership Chain', content: ownershipLines.join('\n') },
      { title: 'History', content: historyLines.join('\n') },
    ],
    prose: [],
    relatedEntities: refs.toArray(),
  };
}
