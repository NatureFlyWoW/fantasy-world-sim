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
  StatusComponent,
  AttributeComponent,
  PersonalityComponent,
  HealthComponent,
  SkillComponent,
  RelationshipComponent,
  GoalComponent,
  PopulationDemographicsComponent,
} from '@fws/core';

import type { Settlement } from '../civilization/settlement-placer.js';
import type { Faction } from '../civilization/faction-initializer.js';
import type { GeneratedCharacter } from '../civilization/character-generator.js';
import type { WorldMap } from '../terrain/world-map.js';
import type { PreHistoryResult } from '../history/pre-history.js';
import type { InitialTension } from '../civilization/tension-seeder.js';

// Import system types for initialization
import type {
  MagicSystem,
  CulturalEvolutionSystem,
  EcologySystem,
  WarfareSystem,
} from '@fws/core';
import {
  ArtifactType as MagicArtifactType,
  MagicSchool,
  EcologicalResourceType,
  InstitutionType,
  ResearchType,
} from '@fws/core';
import type { RegionId } from '@fws/core';
import { toRegionId } from '@fws/core';
import { createNonNotable, PROFESSIONS } from '@fws/core';

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
 * Extended input data that includes pre-history for system initialization.
 */
export interface ExtendedGeneratedWorldData extends GeneratedWorldData {
  preHistory: PreHistoryResult;
  tensions: readonly InitialTension[];
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
    'Status',
    'Attribute',
    'Personality',
    'Health',
    'Skill',
    'Relationship',
    'Goal',
    'PopulationDemographics',
    'Notability',
    'Parentage',
    'Deceased',
    'HiddenLocation',
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
 * Derive an OCEAN personality dimension from generator trait values.
 * Positive traits contribute positively, negative traits are subtracted.
 * The result is clamped to -100..+100.
 */
function deriveOceanDimension(
  traits: ReadonlyMap<string, number>,
  positiveTraits: readonly string[],
  negativeTraits: readonly string[],
): number {
  let sum = 0;
  let count = 0;
  for (const name of positiveTraits) {
    const val = traits.get(name);
    if (val !== undefined) {
      sum += val;
      count++;
    }
  }
  for (const name of negativeTraits) {
    const val = traits.get(name);
    if (val !== undefined) {
      sum -= val;
      count++;
    }
  }
  if (count === 0) return 0;
  return Math.max(-100, Math.min(100, Math.round(sum / count)));
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
      nonNotableIds: [],
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

    // Status component — stores settlement name for entity resolution
    world.addComponent(entityId, makeComponent<StatusComponent>({
      type: 'Status',
      conditions: [],
      titles: [settlement.name],
      socialClass: 'settlement',
    }));

    // PopulationDemographics component — race distribution for the settlement
    world.addComponent(entityId, makeComponent<PopulationDemographicsComponent>({
      type: 'PopulationDemographics',
      raceDistribution: new Map([[settlement.dominantRace, settlement.population]]),
      ageDistribution: new Map(),
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

  // Pass 1: Create all faction entities with non-relational components
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

    // Hierarchy component (no leader yet, will be linked after characters)
    world.addComponent(entityId, makeComponent<HierarchyComponent>({
      type: 'Hierarchy',
      leaderId: null,
      subordinateIds: [],
    }));

    // Status component — stores faction name for entity resolution
    world.addComponent(entityId, makeComponent<StatusComponent>({
      type: 'Status',
      conditions: [],
      titles: [faction.name],
      socialClass: 'faction',
    }));
  }

  // Pass 2: Add Diplomacy components using actual entity IDs (not indices)
  for (let i = 0; i < factions.length; i++) {
    const faction = factions[i];
    if (faction === undefined) continue;

    const factionId = factionIds.get(i);
    if (factionId === undefined) continue;

    const relations = new Map<number, number>();
    for (let j = 0; j < factions.length; j++) {
      if (j !== i) {
        const otherFactionId = factionIds.get(j);
        if (otherFactionId !== undefined) {
          relations.set(otherFactionId as number, 50); // Neutral starting relations
        }
      }
    }

    world.addComponent(factionId as EntityId, makeComponent<DiplomacyComponent>({
      type: 'Diplomacy',
      relations,
      treaties: [],
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

    // Status component — stores character name and title for entity resolution
    const charTitles = [character.name];
    if (character.status.title.length > 0) {
      charTitles.push(character.status.title);
    }
    world.addComponent(entityId, makeComponent<StatusComponent>({
      type: 'Status',
      conditions: [],
      titles: charTitles,
      socialClass: character.status.type,
    }));

    // Attribute component — base stats from generator
    world.addComponent(entityId, makeComponent<AttributeComponent>({
      type: 'Attribute',
      strength: character.attributes.strength,
      agility: character.attributes.agility,
      endurance: character.attributes.endurance,
      intelligence: character.attributes.intelligence,
      wisdom: character.attributes.wisdom,
      charisma: character.attributes.charisma,
    }));

    // Personality component — derive OCEAN model from generator trait map.
    // Trait-to-dimension mapping covers all 18 generator traits.
    // Some traits appear in multiple dimensions (e.g., patient -> C+ and N-),
    // creating psychologically valid inter-dimension correlations.
    world.addComponent(entityId, makeComponent<PersonalityComponent>({
      type: 'Personality',
      openness: deriveOceanDimension(character.personality.traits, ['curious', 'creative', 'scholarly', 'idealistic'], ['pragmatic']),
      conscientiousness: deriveOceanDimension(character.personality.traits, ['patient', 'pragmatic'], ['impulsive', 'amoral']),
      extraversion: deriveOceanDimension(character.personality.traits, ['brave', 'ambitious'], ['cautious']),
      agreeableness: deriveOceanDimension(character.personality.traits, ['empathetic', 'forgiving', 'loyal', 'idealistic'], ['cruel', 'selfAbsorbed', 'amoral']),
      neuroticism: deriveOceanDimension(character.personality.traits, ['paranoid', 'vengeful', 'impulsive'], ['patient', 'forgiving']),
    }));

    // Health component — map generator health to ECS format
    world.addComponent(entityId, makeComponent<HealthComponent>({
      type: 'Health',
      current: character.health.current,
      maximum: character.health.max,
      injuries: character.health.conditions.length > 0 ? [...character.health.conditions] : [],
      diseases: [],
    }));

    // Skill component — map generator skills + empty experience
    const skillsMap = new Map<string, number>();
    const experienceMap = new Map<string, number>();
    for (const [skillName, skillValue] of character.skills.skills) {
      skillsMap.set(skillName, skillValue);
      experienceMap.set(skillName, 0);
    }
    world.addComponent(entityId, makeComponent<SkillComponent>({
      type: 'Skill',
      skills: skillsMap,
      experience: experienceMap,
    }));

    // Relationship component — map by character name (resolve IDs in second pass)
    // Initialize empty; filled below after all characters are created
    world.addComponent(entityId, makeComponent<RelationshipComponent>({
      type: 'Relationship',
      relationships: new Map(),
      affinity: new Map(),
    }));

    // Goal component — map generator goals to ECS format
    const objectives: string[] = [];
    const goalPriorities = new Map<string, number>();
    for (const goal of character.goals) {
      objectives.push(goal.description);
      goalPriorities.set(goal.description, goal.priority);
    }
    world.addComponent(entityId, makeComponent<GoalComponent>({
      type: 'Goal',
      objectives,
      priorities: goalPriorities,
    }));
  }

  // Second pass: resolve character relationships by name → entity ID
  for (const character of allCharacters) {
    const characterId = characterIds.get(character.name);
    if (characterId === undefined) continue;
    if (character.relationships.length === 0) continue;

    const relationships = new Map<number, string>();
    const affinity = new Map<number, number>();
    for (const rel of character.relationships) {
      const targetId = characterIds.get(rel.targetName);
      if (targetId !== undefined) {
        relationships.set(targetId as number, rel.kind);
        affinity.set(targetId as number, rel.strength);
      }
    }

    if (relationships.size > 0) {
      const relComp = world.getComponent<RelationshipComponent>(characterId as EntityId, 'Relationship');
      if (relComp !== undefined) {
        // Update the existing component's maps
        for (const [id, kind] of relationships) {
          relComp.relationships.set(id, kind);
        }
        for (const [id, aff] of affinity) {
          relComp.affinity.set(id, aff);
        }
      }
    }
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

// ══════════════════════════════════════════════════════════════════════════════
// NON-NOTABLE CHARACTER SEEDING
// ══════════════════════════════════════════════════════════════════════════════

const FIRST_NAMES = [
  'Ada', 'Bran', 'Cora', 'Dael', 'Eira', 'Finn', 'Gwen', 'Holt',
  'Iris', 'Jace', 'Kira', 'Lorn', 'Mira', 'Nox', 'Orin', 'Pria',
  'Quinn', 'Reva', 'Sven', 'Tara', 'Ulf', 'Vara', 'Wren', 'Xara',
  'Yori', 'Zara', 'Ash', 'Beck', 'Clay', 'Dove', 'Elm', 'Fern',
  'Glen', 'Hart', 'Ivy', 'Jade', 'Knox', 'Leaf', 'Moss', 'Nell',
  'Oak', 'Pike', 'Rain', 'Sage', 'Thorn', 'Vale', 'Wolf', 'Yew',
];

const FAMILY_NAMES = [
  'Smith', 'Stone', 'Brook', 'Hill', 'Wood', 'Field', 'Dale', 'Ford',
  'Glen', 'Marsh', 'Heath', 'Moor', 'Ridge', 'Thorne', 'Cross', 'Wells',
  'Frost', 'Storm', 'Bright', 'Dark', 'Swift', 'Strong', 'Bold', 'Keen',
  'Ward', 'Hale', 'Grey', 'White', 'Black', 'Green', 'Brown', 'Reed',
];

/**
 * Simple deterministic name pick using index-based selection.
 */
function pickSimpleName(settlementIndex: number, personIndex: number): string {
  const fi = (settlementIndex * 7 + personIndex * 13) % FIRST_NAMES.length;
  const li = (settlementIndex * 11 + personIndex * 17 + 3) % FAMILY_NAMES.length;
  return `${FIRST_NAMES[fi]} ${FAMILY_NAMES[li]}`;
}

/**
 * Seed non-notable characters for each settlement.
 * Creates lightweight person entities with Position, Status, Notability, Parentage.
 */
function seedNonNotables(
  world: World,
  settlements: readonly Settlement[],
  settlementIds: Map<number, SiteId>,
): number {
  let totalCreated = 0;
  const softCap = 30;

  for (let i = 0; i < settlements.length; i++) {
    const settlement = settlements[i];
    const siteId = settlementIds.get(i);
    if (settlement === undefined || siteId === undefined) continue;

    // Determine how many non-notables to create (capped at softCap)
    const count = Math.min(settlement.population, softCap);
    const nonNotableIds: number[] = [];

    for (let p = 0; p < count; p++) {
      const name = pickSimpleName(i, p);
      const professionIndex = (i * 3 + p * 7) % PROFESSIONS.length;

      // Age distribution: weighted toward working age (18-55) with some young/old
      const ageBucket = (i * 5 + p * 11) % 10;
      let age: number;
      if (ageBucket < 2) {
        age = 1 + (p % 17); // Children: 1-17
      } else if (ageBucket < 8) {
        age = 18 + ((i * 3 + p * 5) % 38); // Working age: 18-55
      } else {
        age = 56 + ((i * 7 + p * 3) % 25); // Elderly: 56-80
      }

      const entityId = createNonNotable(world, {
        name,
        race: settlement.dominantRace,
        age,
        profession: PROFESSIONS[professionIndex],
        siteId: siteId as number,
        x: settlement.x,
        y: settlement.y,
        currentTick: 0, // World generation happens at tick 0
        motherId: null,
        fatherId: null,
      });

      nonNotableIds.push(entityId as number);
    }

    // Update the settlement's Population component with non-notable IDs
    const pop = world.getComponent(siteId as EntityId, 'Population');
    if (pop !== undefined) {
      pop.nonNotableIds = nonNotableIds;
    }

    totalCreated += count;
  }

  return totalCreated;
}

// ══════════════════════════════════════════════════════════════════════════════
// HIDDEN LOCATION SEEDING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Seed hidden locations across the world for the ExplorationSystem to discover.
 * Creates 20-40 hidden locations of various types at random positions.
 */
function seedHiddenLocations(world: World, _worldMap: WorldMap): number {
  const count = 20 + Math.floor(Math.random() * 21); // 20-40 hidden locations
  const LOCATION_TYPES = ['ruins', 'resource', 'magical', 'lore'];

  for (let i = 0; i < count; i++) {
    const locationType = LOCATION_TYPES[Math.floor(Math.random() * LOCATION_TYPES.length)];
    const x = 5 + Math.floor(Math.random() * 190);
    const y = 5 + Math.floor(Math.random() * 190);

    const entityId = world.createEntity();
    world.addComponent(entityId, makeComponent({
      type: 'Position',
      x,
      y,
    }));
    world.addComponent(entityId, makeComponent({
      type: 'HiddenLocation',
      locationType,
      revealed: false,
      revealedTick: null,
      x,
      y,
    }));
  }
  return count;
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

  // Seed non-notable characters for each settlement
  const nonNotableCount = seedNonNotables(world, data.settlements, settlementIds);

  // Seed hidden locations for exploration
  const hiddenLocationCount = seedHiddenLocations(world, data.worldMap);

  const totalEntities = settlementIds.size + factionIds.size + characterIds.size + nonNotableCount + hiddenLocationCount;

  return {
    settlementIds,
    factionIds,
    characterIds,
    totalEntities,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM INITIALIZATION FROM GENERATOR DATA
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Systems that can be initialized from generator data.
 */
export interface InitializableSystems {
  magicSystem?: MagicSystem;
  culturalSystem?: CulturalEvolutionSystem;
  ecologySystem?: EcologySystem;
  warfareSystem?: WarfareSystem;
}

/**
 * Result of system initialization.
 */
export interface SystemInitResult {
  artifactsRegistered: number;
  regionsRegistered: number;
  languagesCreated: number;
  tradeConnectionsCreated: number;
  warsStarted: number;
}

/**
 * Map generator artifact type to MagicSystem artifact type.
 */
function mapArtifactType(generatorType: string): MagicArtifactType {
  const mapping: Record<string, MagicArtifactType> = {
    weapon: MagicArtifactType.Weapon,
    armor: MagicArtifactType.Armor,
    ring: MagicArtifactType.Ring,
    staff: MagicArtifactType.Staff,
    tome: MagicArtifactType.Tome,
    crown: MagicArtifactType.Crown,
    amulet: MagicArtifactType.Amulet,
  };
  return mapping[generatorType.toLowerCase()] ?? MagicArtifactType.Relic;
}

/**
 * Map tech era to starting technologies that should be researched.
 */
function getTechsForEra(era: string): string[] {
  const techs: Record<string, string[]> = {
    stone_age: ['Stone Tools', 'Fire Making'],
    bronze_age: ['Stone Tools', 'Fire Making', 'Agriculture', 'Animal Husbandry', 'Bronze Working', 'Pottery'],
    iron_age: ['Stone Tools', 'Fire Making', 'Agriculture', 'Animal Husbandry', 'Bronze Working', 'Pottery', 'Wheel', 'Iron Working', 'Writing'],
    renaissance: ['Stone Tools', 'Fire Making', 'Agriculture', 'Animal Husbandry', 'Bronze Working', 'Pottery', 'Wheel', 'Iron Working', 'Writing', 'Literacy', 'Mathematics', 'Architecture', 'Navigation'],
  };
  return techs[era] ?? techs['iron_age']!;
}

/**
 * Initialize simulation systems with data from the world generator.
 *
 * This function bridges the gap between generated world data and the
 * internal state Maps that simulation systems use. It should be called
 * AFTER creating the simulation engine but BEFORE running ticks.
 *
 * @param systems - Object containing system instances to initialize
 * @param data - Extended generated world data including pre-history
 * @param populationResult - Result from populateWorldFromGenerated
 * @param eventBus - Event bus for emitting initialization events
 * @param clock - World clock for timestamps
 */
export function initializeSystemsFromGenerated(
  systems: InitializableSystems,
  data: ExtendedGeneratedWorldData,
  populationResult: PopulationResult,
  eventBus: { emit: (event: unknown) => void },
  clock: { currentTick: number },
): SystemInitResult {
  const result: SystemInitResult = {
    artifactsRegistered: 0,
    regionsRegistered: 0,
    languagesCreated: 0,
    tradeConnectionsCreated: 0,
    warsStarted: 0,
  };

  // ── Initialize Magic System ──────────────────────────────────────────────
  // Initialize if we have artifacts OR factions (which get institutions)
  if (systems.magicSystem !== undefined && (data.preHistory.artifacts.length > 0 || data.factions.length > 0)) {
    result.artifactsRegistered = initializeMagicSystem(
      systems.magicSystem,
      data,
      populationResult,
      eventBus,
      clock,
    );
  }

  // ── Initialize Cultural Evolution System ─────────────────────────────────
  if (systems.culturalSystem !== undefined) {
    const culturalResult = initializeCulturalSystem(
      systems.culturalSystem,
      data,
      populationResult,
      eventBus,
      clock,
    );
    result.languagesCreated = culturalResult.languages;
    result.tradeConnectionsCreated = culturalResult.tradeConnections;
  }

  // ── Initialize Ecology System ────────────────────────────────────────────
  if (systems.ecologySystem !== undefined) {
    result.regionsRegistered = initializeEcologySystem(
      systems.ecologySystem,
      data,
      populationResult,
    );
  }

  // ── Initialize Warfare System from tensions ──────────────────────────────
  if (systems.warfareSystem !== undefined && data.tensions.length > 0) {
    result.warsStarted = initializeWarfareSystem(
      systems.warfareSystem,
      data,
      populationResult,
      clock,
    );
  }

  return result;
}

/**
 * Initialize MagicSystem with artifacts and institutions from pre-history.
 */
function initializeMagicSystem(
  magicSystem: MagicSystem,
  data: ExtendedGeneratedWorldData,
  populationResult: PopulationResult,
  eventBus: { emit: (event: unknown) => void },
  clock: { currentTick: number },
): number {
  let count = 0;

  // Create artifacts from pre-history
  for (const artifact of data.preHistory.artifacts) {
    const artifactType = mapArtifactType(artifact.type);
    const schools = inferSchoolsFromDescription(artifact.description, artifactType);

    let rngState = artifact.forgeYear + artifact.powerLevel;
    const simpleRng = (): number => {
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState / 0x7fffffff;
    };

    magicSystem.createArtifact(
      artifact.name,
      artifactType,
      artifact.powerLevel,
      artifact.creatorName !== undefined ? toCharacterId(toEntityId(1000 + count)) : null,
      {
        purpose: artifact.description,
        circumstance: `Forged in ${artifact.originCiv} during year ${artifact.forgeYear}`,
      },
      schools,
      clock as { currentTick: number; currentTime: { year: number; month: number; day: number } },
      eventBus as { emit: (event: unknown) => void },
      simpleRng,
    );
    count++;
  }

  // Create magic institutions for cities/large towns
  // Each faction's capital or largest settlement gets a magic institution
  const institutionTypes = [
    InstitutionType.Academy,
    InstitutionType.Tower,
    InstitutionType.Order,
    InstitutionType.Guild,
  ];
  const schools = [
    MagicSchool.Elemental,
    MagicSchool.Enchantment,
    MagicSchool.Abjuration,
    MagicSchool.Divination,
    MagicSchool.Transmutation,
  ];

  let institutionCount = 0;
  for (let fi = 0; fi < data.factions.length; fi++) {
    const faction = data.factions[fi];
    if (faction === undefined) continue;

    const factionId = populationResult.factionIds.get(fi);
    const capital = data.settlements[faction.capitalIndex];
    const siteId = populationResult.settlementIds.get(faction.capitalIndex);

    if (factionId === undefined || capital === undefined || siteId === undefined) continue;

    // Create an institution at the capital
    const institutionId = toEntityId(2000 + institutionCount);
    const instType = institutionTypes[institutionCount % institutionTypes.length]!;
    const primarySchool = schools[institutionCount % schools.length]!;
    const secondarySchool = schools[(institutionCount + 1) % schools.length]!;

    const institutionNames = [
      `Academy of ${capital.name}`,
      `${faction.name} Mages Guild`,
      `The Arcane Tower of ${capital.name}`,
      `Order of the ${primarySchool} Masters`,
    ];

    const institution = {
      id: institutionId,
      name: institutionNames[institutionCount % institutionNames.length]!,
      type: instType,
      siteId: siteId,
      factionId: factionId,
      foundedTick: 0,
      headmasterId: null,
      specializations: [primarySchool, secondarySchool],
      headmasterBias: primarySchool,
      members: [],
      reputation: 50 + Math.floor(faction.culturalInfluence / 2),
      resources: 40 + Math.floor(faction.economicWealth / 2),
      politicalStability: 60,
      forbiddenSchools: [MagicSchool.Necromancy], // Most ban necromancy
      schismRisk: 20,
      activeResearch: [] as EntityId[],
    };

    magicSystem.registerInstitution(institution);

    // Start a research project for this institution
    const researchTypes = [
      ResearchType.SpellDevelopment,
      ResearchType.TheoreticalStudy,
      ResearchType.EnchantmentTechnique,
      ResearchType.RitualDesign,
    ];

    const projectId = toEntityId(3000 + institutionCount);
    const researchType = researchTypes[institutionCount % researchTypes.length]!;

    const researchNames = [
      `Improved ${primarySchool} Techniques`,
      `${secondarySchool} Enhancement Research`,
      `Theoretical Study of ${primarySchool}`,
      `Applied ${primarySchool} Development`,
    ];

    const project = {
      id: projectId,
      institutionId: institutionId,
      leadResearcherId: toCharacterId(toEntityId(4000 + institutionCount)),
      type: researchType,
      school: primarySchool,
      name: researchNames[institutionCount % researchNames.length]!,
      progress: 30, // Start with some progress
      difficulty: 3 + (institutionCount % 3),
      startTick: 0,
      estimatedTicks: 300,
      resourcesAllocated: 60,
      assistants: [],
      breakthroughChance: 0.1,
    };

    magicSystem.startResearch(project);
    institutionCount++;
  }

  return count + institutionCount;
}

/**
 * Infer magic schools from artifact description.
 */
function inferSchoolsFromDescription(description: string, artifactType: MagicArtifactType): MagicSchool[] {
  const schools: MagicSchool[] = [];
  const desc = description.toLowerCase();

  if (desc.includes('fire') || desc.includes('burn') || desc.includes('flame')) {
    schools.push(MagicSchool.Elemental);
  }
  if (desc.includes('undead') || desc.includes('death') || desc.includes('soul')) {
    schools.push(MagicSchool.Necromancy);
  }
  if (desc.includes('prophecy') || desc.includes('vision') || desc.includes('secret')) {
    schools.push(MagicSchool.Divination);
  }
  if (desc.includes('invisible') || desc.includes('illusion') || desc.includes('shadow')) {
    schools.push(MagicSchool.Illusion);
  }
  if (desc.includes('command') || desc.includes('obey') || desc.includes('dominion')) {
    schools.push(MagicSchool.Enchantment);
  }
  if (desc.includes('portal') || desc.includes('summon') || desc.includes('demon')) {
    schools.push(MagicSchool.Summoning);
  }
  if (desc.includes('transform') || desc.includes('shape') || desc.includes('change')) {
    schools.push(MagicSchool.Transmutation);
  }

  if (schools.length === 0) {
    // Default based on artifact type
    if (artifactType === MagicArtifactType.Staff || artifactType === MagicArtifactType.Tome) {
      schools.push(MagicSchool.Elemental);
    } else if (artifactType === MagicArtifactType.Ring || artifactType === MagicArtifactType.Amulet) {
      schools.push(MagicSchool.Enchantment);
    } else {
      schools.push(MagicSchool.Abjuration);
    }
  }

  return schools;
}

/**
 * Initialize CulturalEvolutionSystem with languages and trade connections.
 */
function initializeCulturalSystem(
  culturalSystem: CulturalEvolutionSystem,
  data: ExtendedGeneratedWorldData,
  populationResult: PopulationResult,
  eventBus: { emit: (event: unknown) => void },
  clock: { currentTick: number },
): { languages: number; tradeConnections: number } {
  let languages = 0;
  let tradeConnections = 0;

  // Create languages from the language tree in pre-history
  for (const langNode of data.preHistory.languageTree) {
    // Get regions where this language is spoken (settlements of the race)
    const regions: SiteId[] = [];
    for (let i = 0; i < data.settlements.length; i++) {
      const settlement = data.settlements[i];
      if (settlement !== undefined && settlement.dominantRace === langNode.speakerRace) {
        const siteId = populationResult.settlementIds.get(i);
        if (siteId !== undefined) {
          regions.push(siteId);
        }
      }
    }

    // Skip if no regions speak this language
    if (regions.length === 0) continue;

    // Determine if this is a dialect (has parent) or main language
    const isDialect = langNode.parentLanguage !== undefined && !langNode.isExtinct;
    const hasWriting = !langNode.isExtinct; // Living languages likely have writing

    culturalSystem.createLanguage(
      langNode.language,
      regions,
      hasWriting,
      clock.currentTick,
      eventBus as { emit: (event: unknown) => void },
      undefined, // parentId - would need to track language IDs
      isDialect,
    );
    languages++;
  }

  // Create trade connections between neighboring factions
  // Factions that share borders (have adjacent settlements) can trade
  const factionSettlements = new Map<number, Array<{ x: number; y: number }>>();
  for (let i = 0; i < data.settlements.length; i++) {
    const settlement = data.settlements[i];
    if (settlement === undefined) continue;
    const factionIndex = settlement.factionIndex;
    if (factionIndex === undefined) continue;

    const existing = factionSettlements.get(factionIndex) ?? [];
    existing.push({ x: settlement.x, y: settlement.y });
    factionSettlements.set(factionIndex, existing);
  }

  // Check each pair of factions for proximity
  const factionIndices = Array.from(factionSettlements.keys());
  for (let i = 0; i < factionIndices.length; i++) {
    for (let j = i + 1; j < factionIndices.length; j++) {
      const fi = factionIndices[i];
      const fj = factionIndices[j];
      if (fi === undefined || fj === undefined) continue;

      const settlementsI = factionSettlements.get(fi) ?? [];
      const settlementsJ = factionSettlements.get(fj) ?? [];

      // Check if any settlements are within trade range (50 tiles)
      let canTrade = false;
      for (const si of settlementsI) {
        for (const sj of settlementsJ) {
          const dx = si.x - sj.x;
          const dy = si.y - sj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 50) {
            canTrade = true;
            break;
          }
        }
        if (canTrade) break;
      }

      if (canTrade) {
        const factionIdI = populationResult.factionIds.get(fi);
        const factionIdJ = populationResult.factionIds.get(fj);
        if (factionIdI !== undefined && factionIdJ !== undefined) {
          culturalSystem.addTradeConnection(factionIdI, factionIdJ);
          tradeConnections++;
        }
      }
    }
  }

  // Initialize tech states for each faction based on their technology era
  // Also start active research on technologies not yet known
  const allTechs = culturalSystem.getAllTechnologies();

  for (let fi = 0; fi < data.factions.length; fi++) {
    const faction = data.factions[fi];
    if (faction === undefined) continue;
    const factionId = populationResult.factionIds.get(fi);
    if (factionId === undefined) continue;

    const knownTechNames = getTechsForEra(faction.technologyEra);

    // Mark era-appropriate techs as known
    for (const techName of knownTechNames) {
      const tech = culturalSystem.getTechnologyByName(techName);
      if (tech !== undefined) {
        culturalSystem.startResearch(tech.id, factionId, 10);
        const state = culturalSystem.getTechState(tech.id, factionId);
        if (state !== undefined) {
          state.progress = 100;
          state.inventedTick = 0;
          state.adoptedTick = 0;
        }
      }
    }

    // Find technologies that can be researched (not yet known, prerequisites met)
    // Start active research with researchers allocated so processResearch() emits events
    let activeResearchStarted = 0;
    for (const tech of allTechs) {
      if (activeResearchStarted >= 2) break; // Limit to 2 active research per faction

      // Skip if already known
      if (knownTechNames.includes(tech.name)) continue;

      // Check prerequisites
      const check = culturalSystem.canResearch(tech.id, factionId);
      if (!check.canDo) continue;

      // Start active research with very high progress so techs complete early
      // With difficulty ~35 and 20 researchers: (20*5)/35 = 2.86 progress/tick
      // Need to start at ~97 to complete within first seasonal tick
      const started = culturalSystem.startResearch(tech.id, factionId, 20); // 20 researchers
      if (started) {
        const state = culturalSystem.getTechState(tech.id, factionId);
        if (state !== undefined) {
          state.progress = 97 + (fi % 3); // 97, 98, 99 - ensures completion quickly
          activeResearchStarted++;
        }
      }
    }
  }

  return { languages, tradeConnections };
}

/**
 * Initialize EcologySystem with regions for each settlement.
 */
function initializeEcologySystem(
  ecologySystem: EcologySystem,
  data: ExtendedGeneratedWorldData,
  populationResult: PopulationResult,
): number {
  let count = 0;

  for (let i = 0; i < data.settlements.length; i++) {
    const settlement = data.settlements[i];
    if (settlement === undefined) continue;

    const siteId = populationResult.settlementIds.get(i);
    if (siteId === undefined) continue;

    // Get terrain data for this settlement's location
    const tile = data.worldMap.getTile(settlement.x, settlement.y);

    // Calculate initial resource stocks based on biome and terrain
    const initialStocks = new Map<EcologicalResourceType, number>();

    // Base stocks vary by biome
    const biome = tile?.biome ?? 'plains';
    const biomeStocks: Record<string, Partial<Record<EcologicalResourceType, number>>> = {
      forest: { [EcologicalResourceType.Timber]: 100, [EcologicalResourceType.Game]: 80, [EcologicalResourceType.Herbs]: 70 },
      dense_forest: { [EcologicalResourceType.Timber]: 100, [EcologicalResourceType.Game]: 90, [EcologicalResourceType.Herbs]: 80 },
      plains: { [EcologicalResourceType.Soil]: 90, [EcologicalResourceType.Game]: 60, [EcologicalResourceType.Water]: 70 },
      mountain: { [EcologicalResourceType.Ore]: 100, [EcologicalResourceType.Water]: 80, [EcologicalResourceType.Game]: 40 },
      coast: { [EcologicalResourceType.Fish]: 100, [EcologicalResourceType.Water]: 90 },
      desert: { [EcologicalResourceType.Ore]: 60, [EcologicalResourceType.Water]: 20 },
      swamp: { [EcologicalResourceType.Herbs]: 90, [EcologicalResourceType.Fish]: 60, [EcologicalResourceType.Water]: 100 },
      jungle: { [EcologicalResourceType.Timber]: 90, [EcologicalResourceType.Herbs]: 100, [EcologicalResourceType.Game]: 70 },
      tundra: { [EcologicalResourceType.Game]: 50, [EcologicalResourceType.Water]: 60 },
    };

    // Start with defaults
    initialStocks.set(EcologicalResourceType.Game, 60);
    initialStocks.set(EcologicalResourceType.Fish, 50);
    initialStocks.set(EcologicalResourceType.Timber, 50);
    initialStocks.set(EcologicalResourceType.Herbs, 40);
    initialStocks.set(EcologicalResourceType.Ore, 40);
    initialStocks.set(EcologicalResourceType.Water, 70);
    initialStocks.set(EcologicalResourceType.Soil, 70);

    // Override with biome-specific values
    const biomeOverrides = biomeStocks[biome.toLowerCase()];
    if (biomeOverrides !== undefined) {
      for (const [resource, value] of Object.entries(biomeOverrides)) {
        initialStocks.set(resource as EcologicalResourceType, value as number);
      }
    }

    // Adjust based on fertility and moisture
    if (tile !== undefined) {
      const fertilityMod = tile.fertility ?? 0.5;
      const moistureMod = tile.moisture ?? 0.5;

      // Fertile land has better soil and herbs
      const currentSoil = initialStocks.get(EcologicalResourceType.Soil) ?? 70;
      initialStocks.set(EcologicalResourceType.Soil, Math.round(currentSoil * (0.5 + fertilityMod)));

      const currentHerbs = initialStocks.get(EcologicalResourceType.Herbs) ?? 40;
      initialStocks.set(EcologicalResourceType.Herbs, Math.round(currentHerbs * (0.5 + fertilityMod)));

      // Moisture affects water and fish
      const currentWater = initialStocks.get(EcologicalResourceType.Water) ?? 70;
      initialStocks.set(EcologicalResourceType.Water, Math.round(currentWater * (0.3 + moistureMod * 0.7)));
    }

    // Register the region with the ecology system
    ecologySystem.registerRegion(
      toRegionId(siteId as unknown as EntityId),
      initialStocks,
    );

    // Set initial harvest pressure based on population
    const pop = settlement.population;
    const pressure = Math.min(5, pop / 2000); // Light pressure based on population

    ecologySystem.setHarvestPressure(
      toRegionId(siteId as unknown as EntityId),
      EcologicalResourceType.Timber,
      pressure,
    );
    ecologySystem.setHarvestPressure(
      toRegionId(siteId as unknown as EntityId),
      EcologicalResourceType.Game,
      pressure * 0.5,
    );

    count++;
  }

  return count;
}

/**
 * Initialize WarfareSystem from high-escalation tensions.
 */
function initializeWarfareSystem(
  warfareSystem: WarfareSystem,
  data: ExtendedGeneratedWorldData,
  populationResult: PopulationResult,
  _clock: { currentTick: number },
): number {
  let warsStarted = 0;

  // Find tensions with escalation risk that could become wars
  // Only consider bilateral tensions (factionBIndex !== undefined)
  // Lower threshold (40) to ensure wars can start from moderate tensions
  let highTensions = data.tensions.filter(
    t => t.escalationRisk > 40 && t.factionBIndex !== undefined
  );

  // Fallback: if no high tensions, pick the highest-risk bilateral tension
  if (highTensions.length === 0 && data.tensions.length > 0) {
    const bilateralTensions = data.tensions
      .filter(t => t.factionBIndex !== undefined)
      .sort((a, b) => b.escalationRisk - a.escalationRisk);
    if (bilateralTensions.length > 0) {
      highTensions = [bilateralTensions[0]!];
    }
  }

  for (const tension of highTensions) {
    // Get faction indices directly from the tension
    const factionAIndex = tension.factionAIndex;
    const factionBIndex = tension.factionBIndex;

    // Skip if factionB is undefined (internal succession crises)
    if (factionBIndex === undefined) continue;

    const factionAId = populationResult.factionIds.get(factionAIndex);
    const factionBId = populationResult.factionIds.get(factionBIndex);

    if (factionAId === undefined || factionBId === undefined) continue;

    // Get faction data
    const factionA = data.factions[factionAIndex];
    const factionB = data.factions[factionBIndex];

    if (factionA === undefined || factionB === undefined) continue;

    // Map tension type/description to war objective
    let objective: 'conquest' | 'punitive' | 'succession' | 'religious' = 'conquest';
    const desc = tension.description.toLowerCase();
    if (tension.type === 'border_dispute' || desc.includes('border') || desc.includes('territory')) {
      objective = 'conquest';
    } else if (tension.type === 'historical_grudge' || desc.includes('grudge') || desc.includes('raid')) {
      objective = 'punitive';
    } else if (tension.type === 'succession_crisis' || desc.includes('succession')) {
      objective = 'succession';
    } else if (tension.type === 'religious_tension' || desc.includes('religious')) {
      objective = 'religious';
    }

    // Create the war
    const warName = `${factionA.name}-${factionB.name} Conflict`;
    warfareSystem.declareWar(
      factionAId,
      factionBId,
      objective,
      warName,
      { year: 1, month: 1, day: 1 },
    );

    // Create initial armies for both sides
    const capitalA = data.settlements[factionA.capitalIndex];
    if (capitalA !== undefined) {
      const armyA = warfareSystem.createArmy(
        factionAId,
        [
          { type: 'infantry' as any, count: Math.round(factionA.militaryStrength * 10), veterancy: 30, morale: 70 },
          { type: 'archers' as any, count: Math.round(factionA.militaryStrength * 3), veterancy: 25, morale: 65 },
        ],
        { x: capitalA.x, y: capitalA.y },
      );
      // Set army objective to enemy capital
      const capitalB = data.settlements[factionB.capitalIndex];
      if (capitalB !== undefined) {
        const targetSiteId = populationResult.settlementIds.get(factionB.capitalIndex);
        if (targetSiteId !== undefined) {
          warfareSystem.setArmyObjective(armyA.id, targetSiteId);
        }
      }
    }

    const capitalB = data.settlements[factionB.capitalIndex];
    if (capitalB !== undefined) {
      warfareSystem.createArmy(
        factionBId,
        [
          { type: 'infantry' as any, count: Math.round(factionB.militaryStrength * 10), veterancy: 30, morale: 70 },
          { type: 'archers' as any, count: Math.round(factionB.militaryStrength * 3), veterancy: 25, morale: 65 },
        ],
        { x: capitalB.x, y: capitalB.y },
      );
    }

    warsStarted++;

    // Limit to 2 wars to avoid overwhelming the simulation
    if (warsStarted >= 2) break;
  }

  return warsStarted;
}
