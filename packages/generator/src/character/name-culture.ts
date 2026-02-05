/**
 * Name cultures — each culture provides Markov-backed generators
 * for personal names, family names, place names, artifact names,
 * spell names, and faction names.
 */

import type { SeededRNG } from '../rng.js';
import { MarkovChainGenerator } from './markov.js';
import type { CultureNameData } from './name-data.js';
import { ALL_CULTURE_DATA } from './name-data.js';

/**
 * A name culture provides generators for all name types.
 */
export interface NameCulture {
  /** Culture identifier */
  readonly id: string;
  /** Generate a personal name */
  personalName(gender: 'male' | 'female', rng: SeededRNG): string;
  /** Generate a family name */
  familyName(rng: SeededRNG): string;
  /** Generate a place name */
  placeName(rng: SeededRNG): string;
  /** Generate an artifact name */
  artifactName(rng: SeededRNG): string;
  /** Generate a spell name */
  spellName(rng: SeededRNG): string;
  /** Generate a faction name */
  factionName(rng: SeededRNG): string;
}

/**
 * Artifact name adjectives (shared across cultures).
 */
const ARTIFACT_ADJECTIVES: readonly string[] = [
  'Ancient', 'Eternal', 'Cursed', 'Blessed', 'Forgotten', 'Shattered',
  'Burning', 'Frozen', 'Silent', 'Screaming', 'Golden', 'Obsidian',
  'Crimson', 'Radiant', 'Shadowed', 'Hallowed', 'Profane', 'Crystalline',
  'Thundering', 'Venomous', 'Spectral', 'Vorpal', 'Eldritch', 'Primordial',
];

/**
 * Artifact noun categories.
 */
const ARTIFACT_NOUNS: readonly string[] = [
  'Blade', 'Crown', 'Scepter', 'Orb', 'Ring', 'Amulet', 'Staff',
  'Tome', 'Shield', 'Helm', 'Gauntlet', 'Chalice', 'Mirror', 'Key',
  'Lantern', 'Horn', 'Harp', 'Stone', 'Eye', 'Heart', 'Hammer',
  'Arrow', 'Cloak', 'Pendant',
];

/**
 * Spell name verbs.
 */
const SPELL_VERBS: readonly string[] = [
  'Conjure', 'Summon', 'Invoke', 'Dispel', 'Bind', 'Shatter',
  'Mend', 'Ward', 'Blight', 'Purify', 'Transmute', 'Banish',
  'Fortify', 'Drain', 'Ignite', 'Freeze', 'Wither', 'Restore',
];

/**
 * Spell name nouns.
 */
const SPELL_NOUNS: readonly string[] = [
  'Flame', 'Shadow', 'Storm', 'Light', 'Stone', 'Blood',
  'Spirit', 'Frost', 'Thunder', 'Void', 'Wind', 'Earth',
  'Souls', 'Stars', 'Dreams', 'Bones', 'Iron', 'Ash',
];

/**
 * Faction name patterns: "The [Adj] [Noun]" or "Order of the [Noun]"
 */
const FACTION_PREFIXES: readonly string[] = [
  'The', 'Order of the', 'Brotherhood of the', 'Guild of the',
  'Cult of the', 'Circle of the', 'League of the', 'House of the',
];

const FACTION_ADJECTIVES: readonly string[] = [
  'Iron', 'Silver', 'Golden', 'Crimson', 'Shadow', 'Azure', 'Verdant',
  'Obsidian', 'Ivory', 'Scarlet', 'Ashen', 'Radiant', 'Silent', 'Eternal',
];

const FACTION_NOUNS: readonly string[] = [
  'Hand', 'Eye', 'Flame', 'Shield', 'Crown', 'Fang', 'Claw', 'Blade',
  'Rose', 'Serpent', 'Lion', 'Eagle', 'Wolf', 'Dragon', 'Phoenix', 'Raven',
  'Star', 'Moon', 'Sun', 'Thorn', 'Hammer', 'Anvil', 'Tower', 'Gate',
];

/**
 * Create a concrete NameCulture from training data.
 */
function createCulture(id: string, data: CultureNameData): NameCulture {
  // Order 2 for personal names (short, varied)
  const maleModel = new MarkovChainGenerator(2, data.male);
  const femaleModel = new MarkovChainGenerator(2, data.female);
  const familyModel = new MarkovChainGenerator(2, data.family);

  return {
    id,

    personalName(gender: 'male' | 'female', rng: SeededRNG): string {
      const model = gender === 'male' ? maleModel : femaleModel;
      return model.generate(3, 12, rng);
    },

    familyName(rng: SeededRNG): string {
      return familyModel.generate(4, 14, rng);
    },

    placeName(rng: SeededRNG): string {
      const prefix = rng.pick(data.placePrefixes);
      const suffix = rng.pick(data.placeSuffixes);
      return prefix + suffix;
    },

    artifactName(rng: SeededRNG): string {
      const adj = rng.pick(ARTIFACT_ADJECTIVES);
      const noun = rng.pick(ARTIFACT_NOUNS);
      // Optionally add a culture-flavored proper name
      if (rng.next() < 0.5) {
        const name = maleModel.generate(3, 8, rng);
        return `${name}'s ${adj} ${noun}`;
      }
      return `The ${adj} ${noun}`;
    },

    spellName(rng: SeededRNG): string {
      const verb = rng.pick(SPELL_VERBS);
      const noun = rng.pick(SPELL_NOUNS);
      if (rng.next() < 0.3) {
        const name = maleModel.generate(3, 8, rng);
        return `${name}'s ${verb} ${noun}`;
      }
      return `${verb} ${noun}`;
    },

    factionName(rng: SeededRNG): string {
      const prefix = rng.pick(FACTION_PREFIXES);
      const adj = rng.pick(FACTION_ADJECTIVES);
      const noun = rng.pick(FACTION_NOUNS);
      if (rng.next() < 0.5) {
        return `${prefix} ${adj} ${noun}`;
      }
      return `${prefix} ${noun}`;
    },
  };
}

/**
 * Pre-built cultures keyed by convention name.
 */
const BUILT_IN_CULTURES: Map<string, NameCulture> = new Map();

for (const [id, data] of Object.entries(ALL_CULTURE_DATA)) {
  BUILT_IN_CULTURES.set(id, createCulture(id, data));
}

/**
 * Get a built-in culture by name.
 */
export function getCulture(id: string): NameCulture | undefined {
  return BUILT_IN_CULTURES.get(id);
}

/**
 * Get all built-in cultures.
 */
export function getAllCultures(): Map<string, NameCulture> {
  return new Map(BUILT_IN_CULTURES);
}

/**
 * Culture IDs available.
 */
export const CULTURE_IDS: readonly string[] = [
  'nordic', 'elvish', 'dwarven', 'desert', 'eastern', 'fey', 'infernal',
];
