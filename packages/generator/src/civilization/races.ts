/**
 * Race generation — procedurally creates fantasy races with traits,
 * lifespans, abilities, and creation myths referencing the pantheon.
 * Count scaled by RaceDiversity setting.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldConfig, RaceDiversity } from '../config/types.js';
import type { Pantheon, Deity } from '../cosmology/pantheon.js';
import { BiomeType } from '../terrain/terrain-tile.js';

/**
 * Cultural tendencies that shape a race's society.
 */
export type CulturalTendency =
  | 'militaristic'
  | 'scholarly'
  | 'mercantile'
  | 'agrarian'
  | 'nomadic'
  | 'artistic'
  | 'religious'
  | 'isolationist'
  | 'expansionist'
  | 'seafaring'
  | 'industrious'
  | 'mystical';

const ALL_TENDENCIES: readonly CulturalTendency[] = [
  'militaristic', 'scholarly', 'mercantile', 'agrarian', 'nomadic',
  'artistic', 'religious', 'isolationist', 'expansionist', 'seafaring',
  'industrious', 'mystical',
];

/**
 * A procedurally generated fantasy race.
 */
export interface Race {
  /** Generated name */
  readonly name: string;
  /** Physical descriptions */
  readonly physicalTraits: readonly string[];
  /** Lifespan range in years */
  readonly lifespan: { readonly min: number; readonly max: number };
  /** Cultural tendencies */
  readonly culturalTendencies: readonly CulturalTendency[];
  /** Innate racial abilities */
  readonly innateAbilities: readonly string[];
  /** Biomes where this race prefers to settle */
  readonly biomePreference: readonly BiomeType[];
  /** Procedurally generated origin story */
  readonly creationMyth: string;
  /** Which name culture to use for this race */
  readonly namingConvention: string;
  /** Modifier to base tech era (-2 to +2) */
  readonly startingTechModifier: number;
}

/**
 * RaceDiversity → race count range.
 */
const DIVERSITY_COUNT: Record<RaceDiversity, { min: number; max: number }> = {
  homogeneous: { min: 1, max: 2 },
  standard: { min: 3, max: 5 },
  diverse: { min: 6, max: 10 },
  myriad: { min: 11, max: 15 },
};

/**
 * Lifespan tiers with associated traits.
 */
interface LifespanTier {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly traits: readonly string[];
  readonly abilities: readonly string[];
}

const LIFESPAN_TIERS: readonly LifespanTier[] = [
  {
    label: 'short-lived',
    min: 30, max: 50,
    traits: ['small and wiry', 'quick to mature', 'high metabolism'],
    abilities: ['rapid reproduction', 'fast reflexes', 'adaptable'],
  },
  {
    label: 'baseline',
    min: 60, max: 90,
    traits: ['medium build', 'adaptable physiology', 'varied complexion'],
    abilities: ['versatile', 'determined', 'quick learners'],
  },
  {
    label: 'long-lived',
    min: 200, max: 500,
    traits: ['tall and slender', 'angular features', 'graceful movement'],
    abilities: ['keen senses', 'magic affinity', 'patient strategists'],
  },
  {
    label: 'ancient',
    min: 500, max: 1000,
    traits: ['imposing stature', 'stone-like skin', 'deep-set eyes'],
    abilities: ['immense strength', 'elemental resistance', 'ancestral memory'],
  },
];

/**
 * Physical trait pools by body type.
 */
const BODY_TYPES: readonly string[][] = [
  ['tall and lean', 'long-limbed', 'willowy frame'],
  ['stocky and broad', 'barrel-chested', 'thick-boned'],
  ['average height', 'balanced build', 'athletic frame'],
  ['small and compact', 'nimble-fingered', 'light-footed'],
  ['towering and muscular', 'heavy-set', 'imposing presence'],
];

const SKIN_TRAITS: readonly string[] = [
  'pale ivory skin', 'dark brown skin', 'olive-toned skin', 'grey-blue skin',
  'ruddy copper skin', 'bark-like textured skin', 'scaled patches',
  'iridescent sheen', 'ashen complexion', 'golden-tinged skin',
  'midnight-dark skin', 'alabaster white skin', 'mottled green skin',
];

const EYE_TRAITS: readonly string[] = [
  'amber eyes', 'violet eyes', 'deep black eyes', 'silver-flecked eyes',
  'luminous green eyes', 'crimson-tinged eyes', 'pale blue eyes',
  'golden eyes with slit pupils', 'entirely white eyes', 'dark brown eyes',
  'multi-hued irises', 'glowing faintly in darkness',
];

const DISTINCTIVE_TRAITS: readonly string[] = [
  'pointed ears', 'blunt tusks', 'small horns', 'vestigial tail',
  'webbed fingers', 'feathered hair', 'crystalline nails',
  'bioluminescent markings', 'ridge of bone along the brow',
  'forked tongue', 'double-jointed', 'retractable claws',
  'elongated canines', 'extra digit on each hand', 'translucent ear tips',
];

const ABILITY_POOL: readonly string[] = [
  'darkvision', 'heat resistance', 'cold resistance', 'poison resistance',
  'natural camouflage', 'echolocation', 'tremorsense', 'water breathing',
  'magic resistance', 'telepathic whispers', 'regeneration',
  'berserker rage', 'stone cunning', 'fey step', 'shadow meld',
  'beast speech', 'dream walking', 'iron stomach', 'perfect memory',
  'danger sense', 'natural armor', 'venomous bite',
];

/**
 * Habitable biomes grouped by environment type.
 */
const BIOME_GROUPS: readonly (readonly BiomeType[])[] = [
  [BiomeType.Forest, BiomeType.DenseForest],
  [BiomeType.Plains, BiomeType.Savanna],
  [BiomeType.Mountain],
  [BiomeType.Taiga, BiomeType.Tundra],
  [BiomeType.Desert],
  [BiomeType.Swamp, BiomeType.Jungle],
  [BiomeType.Coast],
];

/**
 * Name cultures available for assignment.
 */
const NAME_CULTURES: readonly string[] = [
  'nordic', 'elvish', 'dwarven', 'desert', 'eastern', 'fey', 'infernal',
];

/**
 * Creation myth templates. Placeholders: {deity}, {domain}, {material}, {purpose}.
 */
const MYTH_TEMPLATES: readonly string[] = [
  '{deity} shaped the {race} from {material}, breathing {domain} into their souls.',
  'Born from the {domain} of {deity}, the {race} emerged to serve as {purpose}.',
  'When {deity} wept tears of {material}, the {race} rose from the earth.',
  'The {race} were forged by {deity} in the fires of {material}, destined for {purpose}.',
  '{deity} dreamed of {purpose}, and from that dream the {race} awakened.',
  'From the clash between {deity} and the void, {material} scattered and became the {race}.',
  'The {race} crawled forth from {material} when {deity} sang the song of {domain}.',
  '{deity}, lord of {domain}, planted seeds of {material} that grew into the first {race}.',
];

const MYTH_MATERIALS: readonly string[] = [
  'living stone', 'starlight', 'ancient wood', 'sacred clay', 'frozen lightning',
  'moonsilver', 'primordial shadow', 'ocean foam', 'volcanic glass',
  'crystallized time', 'woven wind', 'distilled sunlight', 'dragon bone',
];

const MYTH_PURPOSES: readonly string[] = [
  'guardians of the wild', 'keepers of knowledge', 'warriors against darkness',
  'shepherds of the land', 'bridges between worlds', 'seekers of truth',
  'architects of civilization', 'vessels of the divine will',
  'chroniclers of history', 'tamers of the elements',
];

/**
 * Race name syllables for procedural name generation.
 */
const RACE_PREFIXES: readonly string[] = [
  'Aelf', 'Dwar', 'Gor', 'Thal', 'Nyr', 'Kel', 'Vor', 'Zha', 'Ith', 'Brak',
  'Sel', 'Mur', 'Dra', 'Fen', 'Har', 'Lok', 'Qui', 'Resh', 'Tal', 'Und',
];

const RACE_SUFFIXES: readonly string[] = [
  'kin', 'folk', 'born', 'ren', 'im', 'ari', 'oni', 'eth', 'uli', 'ani',
  'ven', 'dar', 'mir', 'ash', 'oth', 'iel', 'nak', 'gor', 'phi', 'thi',
];

export class RaceGenerator {
  /**
   * Generate races for the world.
   */
  generate(config: WorldConfig, pantheon: Pantheon, rng: SeededRNG): Race[] {
    const raceRng = rng.fork('races');
    const range = DIVERSITY_COUNT[config.raceDiversity];
    const count = raceRng.nextInt(range.min, range.max);

    const races: Race[] = [];
    const usedNames = new Set<string>();
    const usedCultures = new Set<string>();
    const coveredBiomeGroups = new Set<number>();

    // First race is always human-like (baseline)
    races.push(this.generateRace(
      raceRng, pantheon, usedNames, usedCultures, coveredBiomeGroups,
      1, // Force baseline lifespan tier
      true // isFirst
    ));

    // Generate remaining races
    for (let i = 1; i < count; i++) {
      races.push(this.generateRace(
        raceRng, pantheon, usedNames, usedCultures, coveredBiomeGroups,
        undefined,
        false
      ));
    }

    return races;
  }

  /**
   * Generate a single race.
   */
  private generateRace(
    rng: SeededRNG,
    pantheon: Pantheon,
    usedNames: Set<string>,
    usedCultures: Set<string>,
    coveredBiomeGroups: Set<number>,
    forceTier: number | undefined,
    isFirst: boolean
  ): Race {
    // Name
    const name = this.generateRaceName(rng, usedNames);
    usedNames.add(name);

    // Lifespan tier
    const tierIndex = forceTier ?? rng.nextInt(0, LIFESPAN_TIERS.length - 1);
    const tier = LIFESPAN_TIERS[tierIndex] as LifespanTier;
    const lifespan = {
      min: tier.min + rng.nextInt(-5, 5),
      max: tier.max + rng.nextInt(-10, 10),
    };

    // Physical traits (3-5)
    const bodyType = rng.pick(rng.pick(BODY_TYPES));
    const skin = rng.pick(SKIN_TRAITS);
    const eyes = rng.pick(EYE_TRAITS);
    const physicalTraits: string[] = [bodyType, skin, eyes];

    // Tier-specific traits
    const tierTrait = rng.pick(tier.traits);
    physicalTraits.push(tierTrait);

    // Maybe a distinctive trait
    if (rng.next() < 0.7 || !isFirst) {
      physicalTraits.push(rng.pick(DISTINCTIVE_TRAITS));
    }

    // Cultural tendencies (2-3)
    const tendencyCount = rng.nextInt(2, 3);
    const tendencyPool = [...ALL_TENDENCIES];
    rng.shuffle(tendencyPool);
    const culturalTendencies = tendencyPool.slice(0, tendencyCount) as CulturalTendency[];

    // Innate abilities (1-3, from tier + general pool)
    const tierAbility = rng.pick(tier.abilities);
    const abilityPool = [...ABILITY_POOL];
    rng.shuffle(abilityPool);
    const extraAbilities = abilityPool.slice(0, rng.nextInt(0, 2));
    const innateAbilities = [tierAbility, ...extraAbilities];

    // Biome preference — try to cover uncovered groups first
    const biomePreference = this.selectBiomes(rng, coveredBiomeGroups);

    // Naming convention — prefer unused cultures
    const namingConvention = this.selectCulture(rng, usedCultures);
    usedCultures.add(namingConvention);

    // Starting tech modifier
    let startingTechModifier = 0;
    if (tier.label === 'short-lived') {
      startingTechModifier = rng.nextInt(-1, 1);
    } else if (tier.label === 'long-lived' || tier.label === 'ancient') {
      startingTechModifier = rng.nextInt(0, 2);
    } else {
      startingTechModifier = rng.nextInt(-1, 1);
    }

    // Creation myth
    const creationMyth = this.generateCreationMyth(rng, pantheon, name);

    return {
      name,
      physicalTraits,
      lifespan,
      culturalTendencies,
      innateAbilities,
      biomePreference,
      creationMyth,
      namingConvention,
      startingTechModifier,
    };
  }

  /**
   * Generate a unique race name from syllable pools.
   */
  private generateRaceName(rng: SeededRNG, usedNames: Set<string>): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      const prefix = rng.pick(RACE_PREFIXES);
      const suffix = rng.pick(RACE_SUFFIXES);
      const name = prefix + suffix;
      if (!usedNames.has(name)) return name;
    }
    return rng.pick(RACE_PREFIXES) + rng.pick(RACE_SUFFIXES) + rng.nextInt(1, 99);
  }

  /**
   * Select biome preferences, favoring uncovered biome groups.
   */
  private selectBiomes(
    rng: SeededRNG,
    coveredGroups: Set<number>
  ): BiomeType[] {
    const groupCount = rng.nextInt(1, 3);
    const selected: BiomeType[] = [];
    const groupIndices = Array.from({ length: BIOME_GROUPS.length }, (_, i) => i);

    // Prefer uncovered groups
    const uncovered = groupIndices.filter(i => !coveredGroups.has(i));
    const pool = uncovered.length > 0 ? uncovered : groupIndices;
    rng.shuffle(pool as number[]);

    for (let i = 0; i < groupCount && i < pool.length; i++) {
      const groupIdx = pool[i] as number;
      coveredGroups.add(groupIdx);
      const group = BIOME_GROUPS[groupIdx] as readonly BiomeType[];
      for (const biome of group) {
        selected.push(biome);
      }
    }

    return selected;
  }

  /**
   * Select a naming convention, preferring unused cultures.
   */
  private selectCulture(rng: SeededRNG, usedCultures: Set<string>): string {
    const unused = NAME_CULTURES.filter(c => !usedCultures.has(c));
    if (unused.length > 0) {
      return rng.pick(unused);
    }
    return rng.pick(NAME_CULTURES);
  }

  /**
   * Generate a creation myth referencing the pantheon.
   */
  private generateCreationMyth(
    rng: SeededRNG,
    pantheon: Pantheon,
    raceName: string
  ): string {
    const template = rng.pick(MYTH_TEMPLATES);
    const material = rng.pick(MYTH_MATERIALS);
    const purpose = rng.pick(MYTH_PURPOSES);

    let deityName: string;
    let domainName: string;

    if (pantheon.gods.length > 0) {
      const deity: Deity = rng.pick(pantheon.gods);
      deityName = deity.name;
      domainName = deity.primaryDomain;
    } else {
      // Atheistic world — use abstract forces
      deityName = rng.pick(['the Void', 'the First Light', 'the Eternal Storm', 'the Deep']);
      domainName = rng.pick(['creation', 'chaos', 'order', 'nature']);
    }

    return template
      .replace('{deity}', deityName)
      .replace('{domain}', domainName)
      .replace('{material}', material)
      .replace('{purpose}', purpose)
      .replace('{race}', raceName);
  }
}
