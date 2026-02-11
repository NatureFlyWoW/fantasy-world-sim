// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Legends Provider -- extracts entity summaries from the World ECS
 * for the Legends Viewer in the renderer.
 */

import { World } from '@fws/core';
import type { EntityId } from '@fws/core';
import type {
  LegendsSummary,
  CharacterSummary,
  FactionSummary,
  SiteSummary,
  ArtifactSummary,
  DeitySummary,
} from '../shared/types.js';

/**
 * Resolve an entity name from the Status component.
 */
function resolveName(world: World, eid: EntityId): string {
  if (!world.hasStore('Status')) return '';
  const status = world.getComponent(eid, 'Status');
  if (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined) {
    return status.titles[0];
  }
  return '';
}

/**
 * Build a complete legends summary by scanning all ECS entities.
 *
 * Entity type identification follows the same heuristics as simulation-runner.ts:
 * - Characters: have Personality component
 * - Factions: have Government component
 * - Sites: have Population component (settlements)
 * - Artifacts: have CreationHistory or OwnershipChain component
 * - Deities: have Domain component
 */
export function buildLegendsSummary(world: World): LegendsSummary {
  const characters: CharacterSummary[] = [];
  const factions: FactionSummary[] = [];
  const sites: SiteSummary[] = [];
  const artifacts: ArtifactSummary[] = [];
  const deities: DeitySummary[] = [];

  // Build a lookup map: faction entity ID -> faction name, for cross-referencing
  const factionNames = new Map<number, string>();

  // First pass: identify factions so we can reference them from characters/sites
  if (world.hasStore('Government')) {
    for (const [eid] of world.getStore('Government').getAll()) {
      const numId = eid as unknown as number;
      const name = resolveName(world, eid) || `Faction #${numId}`;
      factionNames.set(numId, name);
    }
  }

  // ── Characters ────────────────────────────────────────────────────────
  if (world.hasStore('Personality')) {
    for (const [eid] of world.getStore('Personality').getAll()) {
      const numId = eid as unknown as number;
      const name = resolveName(world, eid) || `Character #${numId}`;

      // Race from CreatureType
      let race = 'Unknown';
      if (world.hasStore('CreatureType')) {
        const ct = world.getComponent(eid, 'CreatureType');
        if (ct?.species !== undefined) race = ct.species;
      }

      // Profession from Status
      let profession = 'Unknown';
      const status = world.hasStore('Status')
        ? world.getComponent(eid, 'Status')
        : undefined;
      if (status?.socialClass !== undefined && status.socialClass !== '') {
        profession = status.socialClass;
      }

      // Faction from Membership
      let faction = 'None';
      let factionId = -1;
      if (world.hasStore('Membership')) {
        const membership = world.getComponent(eid, 'Membership');
        if (membership?.factionId !== undefined && membership.factionId !== null) {
          factionId = membership.factionId as number;
          faction = factionNames.get(factionId) ?? `Faction #${factionId}`;
        }
      }

      // Alive from Health
      let alive = true;
      if (world.hasStore('Health')) {
        const health = world.getComponent(eid, 'Health');
        if (health !== undefined && health.current <= 0) {
          alive = false;
        }
      }

      characters.push({ id: numId, name, race, profession, faction, factionId, alive });
    }
  }

  // ── Factions ──────────────────────────────────────────────────────────
  if (world.hasStore('Government')) {
    for (const [eid] of world.getStore('Government').getAll()) {
      const numId = eid as unknown as number;
      const name = factionNames.get(numId) || `Faction #${numId}`;

      const gov = world.getComponent(eid, 'Government');
      const governmentType = gov?.governmentType ?? 'Unknown';

      // Member count: count characters whose Membership.factionId matches
      let memberCount = 0;
      if (world.hasStore('Membership')) {
        for (const [memberEid] of world.getStore('Membership').getAll()) {
          const mem = world.getComponent(memberEid, 'Membership');
          if (mem?.factionId !== undefined && (mem.factionId as number) === numId) {
            memberCount++;
          }
        }
      }

      // Territory count from Territory component
      let territoryCount = 0;
      if (world.hasStore('Territory')) {
        const territory = world.getComponent(eid, 'Territory');
        if (territory?.controlledRegions !== undefined) {
          territoryCount = territory.controlledRegions.length;
        }
      }

      factions.push({ id: numId, name, governmentType, memberCount, territoryCount });
    }
  }

  // ── Sites ─────────────────────────────────────────────────────────────
  // Sites are entities with Population but NOT Personality (not characters)
  if (world.hasStore('Population')) {
    for (const [eid] of world.getStore('Population').getAll()) {
      // Skip entities that are characters (have Personality)
      if (world.hasStore('Personality') && world.getComponent(eid, 'Personality') !== undefined) {
        continue;
      }
      // Skip entities that are factions (have Government)
      if (world.hasStore('Government') && world.getComponent(eid, 'Government') !== undefined) {
        continue;
      }

      const numId = eid as unknown as number;
      const name = resolveName(world, eid) || `Site #${numId}`;

      const pop = world.getComponent(eid, 'Population');
      const population = pop?.count ?? pop?.total ?? pop?.size ?? 0;

      // Classify site type from population
      let siteType = 'Settlement';
      if (population >= 2000) siteType = 'City';
      else if (population >= 500) siteType = 'Town';
      else if (population >= 100) siteType = 'Village';
      else siteType = 'Hamlet';

      // Check for special structures
      if (world.hasStore('Structures')) {
        const structs = world.getComponent(eid, 'Structures');
        if (structs?.buildings !== undefined) {
          if (structs.buildings.some(b => b.toLowerCase().includes('temple'))) siteType = 'Temple';
          else if (structs.buildings.some(b => b.toLowerCase().includes('academy'))) siteType = 'Academy';
        }
      }

      // Owner faction from Ownership
      let ownerFaction = 'Unowned';
      let ownerFactionId = -1;
      if (world.hasStore('Ownership')) {
        const ownership = world.getComponent(eid, 'Ownership');
        if (ownership?.ownerId !== undefined && ownership.ownerId !== null) {
          ownerFactionId = ownership.ownerId as number;
          ownerFaction = factionNames.get(ownerFactionId) ?? `Faction #${ownerFactionId}`;
        }
      }

      sites.push({ id: numId, name, siteType, ownerFaction, ownerFactionId, population });
    }
  }

  // ── Artifacts ─────────────────────────────────────────────────────────
  const artifactEids = new Set<number>();
  if (world.hasStore('CreationHistory')) {
    for (const [eid] of world.getStore('CreationHistory').getAll()) {
      artifactEids.add(eid as unknown as number);
    }
  }
  if (world.hasStore('OwnershipChain')) {
    for (const [eid] of world.getStore('OwnershipChain').getAll()) {
      artifactEids.add(eid as unknown as number);
    }
  }

  for (const numId of artifactEids) {
    const eid = numId as unknown as EntityId;
    const name = resolveName(world, eid) || `Artifact #${numId}`;

    // Type from CreationHistory method
    let artifactType = 'Unknown';
    if (world.hasStore('CreationHistory')) {
      const creation = world.getComponent(eid, 'CreationHistory');
      if (creation?.method !== undefined) {
        artifactType = creation.method;
      }
    }

    // Current owner from OwnershipChain (last owner with null toTick)
    let currentOwner = 'Unknown';
    let currentOwnerId = -1;
    if (world.hasStore('OwnershipChain')) {
      const chain = world.getComponent(eid, 'OwnershipChain');
      if (chain?.owners !== undefined && chain.owners.length > 0) {
        const lastOwner = chain.owners[chain.owners.length - 1];
        if (lastOwner !== undefined && (lastOwner.toTick === null || lastOwner.toTick === undefined)) {
          currentOwnerId = lastOwner.ownerId as number;
          // Try to resolve name: could be character, faction, or site
          const ownerName = resolveName(world, lastOwner.ownerId as unknown as EntityId);
          currentOwner = ownerName || `Entity #${currentOwnerId}`;
        }
      }
    }

    artifacts.push({ id: numId, name, artifactType, currentOwner, currentOwnerId });
  }

  // ── Deities ───────────────────────────────────────────────────────────
  if (world.hasStore('Domain')) {
    for (const [eid] of world.getStore('Domain').getAll()) {
      const numId = eid as unknown as number;
      const name = resolveName(world, eid) || `Deity #${numId}`;

      const domain = world.getComponent(eid, 'Domain');
      const spheres = domain?.spheres ?? [];
      const domainStr = spheres.length > 0 ? spheres.join(', ') : 'Unknown';

      // Follower count from Worshiper component
      let followerCount = 0;
      if (world.hasStore('Worshiper')) {
        const worshiper = world.getComponent(eid, 'Worshiper');
        if (worshiper?.followerCount !== undefined) {
          followerCount = worshiper.followerCount;
        }
      }

      deities.push({ id: numId, name, domain: domainStr, followerCount });
    }
  }

  return { characters, factions, sites, artifacts, deities };
}
