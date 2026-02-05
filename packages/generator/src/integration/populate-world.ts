// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.
// The code runs correctly through vitest which has its own module resolution.

/**
 * Populates an ECS World from generated world data.
 *
 * This is the bridge between the generator's plain data structures and
 * the simulation engine's ECS architecture. It creates entities with
 * proper components that the simulation systems can query.
 */

import type { World } from '@fws/core';
import type { EntityId, FactionId, SiteId, CharacterId } from '@fws/core';
import { toEntityId, toFactionId, toSiteId, toCharacterId } from '@fws/core';
import type {
  PositionComponent,
  PopulationComponent,
  EconomyComponent,
  BiomeComponent,
  OwnershipComponent,
  GovernmentComponent,
  MilitaryComponent,
  DiplomacyComponent,
  HierarchyComponent,
  TraitsComponent,
  MembershipComponent,
  StructuresComponent,
} from '@fws/core';

import type { Settlement } from '../civilization/settlement-placer.js';
import type { Faction } from '../civilization/faction-initializer.js';
import type { GeneratedCharacter } from '../civilization/character-generator.js';
import type { WorldMap } from '../terrain/world-map.js';

/**
 * Input data from the world generation pipeline.
 */
export interface GeneratedWorldData {
  worldMap: WorldMap;
  settlements: readonly Settlement[];
  factions: readonly Faction[];
  rulers: readonly GeneratedCharacter[];
  notables: readonly GeneratedCharacter[];
}

/**
 * Result of populating the world with entities.
 */
export interface PopulationResult {
  /** Map from settlement index to entity ID */
  settlementIds: Map<number, SiteId>;
  /** Map from faction index to entity ID */
  factionIds: Map<number, FactionId>;
  /** Map from character name to entity ID */
  characterIds: Map<string, CharacterId>;
  /** Total entities created */
  totalEntities: number;
}

/**
 * Create a serializable component with the serialize() method.
 */
function makeComponent<T extends { type: string }>(data: T): T & { serialize(): Record<string, unknown> } {
  return {
    ...data,
    serialize() {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this)) {
        if (key !== 'serialize' && typeof value !== 'function') {
          if (value instanceof Map) {
            result[key] = Object.fromEntries(value);
          } else {
            result[key] = value;
          }
        }
      }
      return result;
    },
  };
}

/**
 * Register all component types needed by simulation systems.
 */
function registerComponents(world: World): void {
  const types = [
    'Position',
    'Population',
    'Economy',
    'Biome',
    'Ownership',
    'Government',
    'Military',
    'Diplomacy',
    'Hierarchy',
    'Traits',
    'Membership',
    'Structures',
  ] as const;

  for (const type of types) {
    world.registerComponent(type);
  }
}

/**
 * Convert biome type string from generator to normalized form.
 */
function normalizeBiomeType(biomeType: string): string {
  // Map generator biome types to economics system expectations
  const mapping: Record<string, string> = {
    plains: 'plains',
    forest: 'forest',
    dense_forest: 'forest',
    mountain: 'mountain',
    coast: 'coastal',
    savanna: 'grassland',
    jungle: 'jungle',
    desert: 'desert',
    taiga: 'forest',
    tundra: 'tundra',
    swamp: 'swamp',
    ocean: 'coastal',
    river: 'plains',
  };
  return mapping[biomeType.toLowerCase()] ?? 'plains';
}

/**
 * Create settlement entities with components.
 */
function populateSettlements(
  world: World,
  worldMap: WorldMap,
  settlements: readonly Settlement[],
  factionIds: Map<number, FactionId>,
): Map<number, SiteId> {
  const settlementIds = new Map<number, SiteId>();

  for (let i = 0; i < settlements.length; i++) {
    const settlement = settlements[i];
    if (settlement === undefined) continue;

    const entityId = world.createEntity();
    const siteId = toSiteId(entityId);
    settlementIds.set(i, siteId);

    // Get terrain info from world map
    const tile = worldMap.getTile(settlement.x, settlement.y);
    const biomeType = tile !== undefined ? tile.biome : 'plains';

    // Position component
    world.addComponent(entityId, makeComponent<PositionComponent>({
      type: 'Position',
      x: settlement.x,
      y: settlement.y,
    }));

    // Population component
    world.addComponent(entityId, makeComponent<PopulationComponent>({
      type: 'Population',
      count: settlement.population,
      growthRate: 0.02, // 2% base growth
    }));

    // Economy component
    const industries = [settlement.economicFocus];
    // Add secondary industries based on structures
    for (const struct of settlement.structures) {
      if (struct.type === 'guild') industries.push('crafting');
      if (struct.type === 'harbor') industries.push('fishing');
      if (struct.type === 'mine') industries.push('mining');
    }
    world.addComponent(entityId, makeComponent<EconomyComponent>({
      type: 'Economy',
      wealth: settlement.population * 2, // Base wealth from population
      tradeVolume: 0,
      industries: [...new Set(industries)],
    }));

    // Biome component
    world.addComponent(entityId, makeComponent<BiomeComponent>({
      type: 'Biome',
      biomeType: normalizeBiomeType(biomeType),
      fertility: tile?.fertility ?? 0.5,
      moisture: tile?.moisture ?? 0.5,
    }));

    // Ownership component (link to faction)
    const factionIndex = settlement.factionIndex;
    const ownerId = factionIndex !== undefined ? factionIds.get(factionIndex) : null;
    world.addComponent(entityId, makeComponent<OwnershipComponent>({
      type: 'Ownership',
      ownerId: ownerId !== undefined ? (ownerId as number) : null,
      claimStrength: 100,
    }));

    // Structures component
    world.addComponent(entityId, makeComponent<StructuresComponent>({
      type: 'Structures',
      buildings: settlement.structures.map(s => s.name),
      fortificationLevel: settlement.structures.some(s => s.type === 'wall' || s.type === 'fortress') ? 50 : 0,
    }));
  }

  return settlementIds;
}

/**
 * Create faction entities with components.
 */
function populateFactions(
  world: World,
  factions: readonly Faction[],
  settlementIds: Map<number, SiteId>,
): Map<number, FactionId> {
  const factionIds = new Map<number, FactionId>();

  for (let i = 0; i < factions.length; i++) {
    const faction = factions[i];
    if (faction === undefined) continue;

    const entityId = world.createEntity();
    const factionId = toFactionId(entityId);
    factionIds.set(i, factionId);

    // Government component
    world.addComponent(entityId, makeComponent<GovernmentComponent>({
      type: 'Government',
      governmentType: faction.governmentType,
      stability: 70, // Base stability
      legitimacy: 80, // Base legitimacy
    }));

    // Military component
    world.addComponent(entityId, makeComponent<MilitaryComponent>({
      type: 'Military',
      strength: faction.militaryStrength,
      morale: 70,
      training: 50,
    }));

    // Diplomacy component - initialize relations to neutral (50)
    const relations = new Map<number, number>();
    for (let j = 0; j < factions.length; j++) {
      if (j !== i) {
        relations.set(j, 50); // Neutral starting relations
      }
    }
    world.addComponent(entityId, makeComponent<DiplomacyComponent>({
      type: 'Diplomacy',
      relations,
      treaties: [],
    }));

    // Hierarchy component (no leader yet, will be linked after characters)
    world.addComponent(entityId, makeComponent<HierarchyComponent>({
      type: 'Hierarchy',
      leaderId: null,
      subordinateIds: [],
    }));
  }

  return factionIds;
}

/**
 * Create character entities with components.
 */
function populateCharacters(
  world: World,
  rulers: readonly GeneratedCharacter[],
  notables: readonly GeneratedCharacter[],
  factionIds: Map<number, FactionId>,
  factions: readonly Faction[],
): Map<string, CharacterId> {
  const characterIds = new Map<string, CharacterId>();
  const allCharacters = [...rulers, ...notables];

  // Build faction name to ID mapping
  const factionNameToId = new Map<string, FactionId>();
  for (let i = 0; i < factions.length; i++) {
    const faction = factions[i];
    const factionId = factionIds.get(i);
    if (faction !== undefined && factionId !== undefined) {
      factionNameToId.set(faction.name, factionId);
    }
  }

  for (const character of allCharacters) {
    const entityId = world.createEntity();
    const characterId = toCharacterId(entityId);
    characterIds.set(character.name, characterId);

    // Position component
    world.addComponent(entityId, makeComponent<PositionComponent>({
      type: 'Position',
      x: character.position.x,
      y: character.position.y,
    }));

    // Traits component - convert personality traits to the ECS format
    const traits: string[] = [];
    const intensities = new Map<string, number>();
    for (const [traitName, value] of character.personality.traits) {
      traits.push(traitName);
      intensities.set(traitName, value);
    }
    world.addComponent(entityId, makeComponent<TraitsComponent>({
      type: 'Traits',
      traits,
      intensities,
    }));

    // Membership component
    const factionId = factionNameToId.get(character.factionName);
    world.addComponent(entityId, makeComponent<MembershipComponent>({
      type: 'Membership',
      factionId: factionId !== undefined ? (factionId as number) : null,
      rank: character.status.type,
      joinDate: 0,
    }));
  }

  // Link rulers to their factions' hierarchy
  for (const ruler of rulers) {
    const characterId = characterIds.get(ruler.name);
    const factionId = factionNameToId.get(ruler.factionName);

    if (characterId !== undefined && factionId !== undefined) {
      const hierarchy = world.getComponent<HierarchyComponent>(factionId as EntityId, 'Hierarchy');
      if (hierarchy !== undefined) {
        // Update hierarchy to point to leader
        hierarchy.leaderId = characterId as number;
      }
    }
  }

  return characterIds;
}

/**
 * Populate an ECS World from generated world data.
 *
 * This function bridges the generator's output (plain JS objects) to the
 * ECS architecture that simulation systems expect. It creates entities
 * with proper components so systems like EconomicSystem, WarfareSystem,
 * etc. can find and process them.
 *
 * @param world - The ECS World to populate (should be empty)
 * @param data - Generated world data from the generation pipeline
 * @returns Mappings from generator indices/names to ECS entity IDs
 */
export function populateWorldFromGenerated(
  world: World,
  data: GeneratedWorldData,
): PopulationResult {
  // Register all component types first
  registerComponents(world);

  // Create entities in order: factions first (for ownership references),
  // then settlements, then characters (for hierarchy references)
  const factionIds = populateFactions(world, data.factions, new Map());
  const settlementIds = populateSettlements(world, data.worldMap, data.settlements, factionIds);
  const characterIds = populateCharacters(world, data.rulers, data.notables, factionIds, data.factions);

  // Link settlements back to factions now that we have all IDs
  // Update ownership components with correct faction IDs
  for (let i = 0; i < data.settlements.length; i++) {
    const settlement = data.settlements[i];
    const settlementId = settlementIds.get(i);
    if (settlement === undefined || settlementId === undefined) continue;

    const factionIndex = settlement.factionIndex;
    if (factionIndex !== undefined) {
      const factionId = factionIds.get(factionIndex);
      if (factionId !== undefined) {
        const ownership = world.getComponent<OwnershipComponent>(settlementId as EntityId, 'Ownership');
        if (ownership !== undefined) {
          ownership.ownerId = factionId as number;
        }
      }
    }
  }

  const totalEntities = settlementIds.size + factionIds.size + characterIds.size;

  return {
    settlementIds,
    factionIds,
    characterIds,
    totalEntities,
  };
}
