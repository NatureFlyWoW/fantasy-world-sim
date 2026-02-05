/**
 * Pantheon generation — gods with domains, personalities, relationships.
 * Complexity scaled by PantheonComplexity setting.
 */

import type { SeededRNG } from '../rng.js';
import type { PantheonComplexity } from '../config/types.js';

/**
 * Divine domain — area of influence for a deity.
 */
export enum Domain {
  War = 'War',
  Death = 'Death',
  Life = 'Life',
  Nature = 'Nature',
  Magic = 'Magic',
  Knowledge = 'Knowledge',
  Trickery = 'Trickery',
  Love = 'Love',
  Justice = 'Justice',
  Chaos = 'Chaos',
  Sea = 'Sea',
  Sky = 'Sky',
  Earth = 'Earth',
  Fire = 'Fire',
  Forge = 'Forge',
  Harvest = 'Harvest',
  Moon = 'Moon',
  Sun = 'Sun',
}

const ALL_DOMAINS: readonly Domain[] = Object.values(Domain) as Domain[];

/**
 * Personality traits that shape a deity's doctrine and behavior.
 */
export type PersonalityTrait =
  | 'benevolent'
  | 'wrathful'
  | 'cunning'
  | 'stoic'
  | 'mercurial'
  | 'jealous'
  | 'nurturing'
  | 'destructive'
  | 'wise'
  | 'hedonistic';

const ALL_PERSONALITY_TRAITS: readonly PersonalityTrait[] = [
  'benevolent', 'wrathful', 'cunning', 'stoic', 'mercurial',
  'jealous', 'nurturing', 'destructive', 'wise', 'hedonistic',
];

/**
 * How two deities relate to each other.
 */
export type RelationshipType =
  | 'ally'
  | 'rival'
  | 'lover'
  | 'parent'
  | 'child'
  | 'enemy'
  | 'indifferent';

/**
 * A relationship between two deities.
 */
export interface DivineRelationship {
  /** Index of the source deity */
  readonly fromIndex: number;
  /** Index of the target deity */
  readonly toIndex: number;
  /** Relationship type */
  readonly type: RelationshipType;
  /** Strength of the relationship (0-1) */
  readonly strength: number;
}

/**
 * A single deity in the pantheon.
 */
export interface Deity {
  /** Deity name (generated) */
  readonly name: string;
  /** Primary domain */
  readonly primaryDomain: Domain;
  /** Secondary domains (0-2) */
  readonly secondaryDomains: readonly Domain[];
  /** Personality traits (1-3) */
  readonly personality: readonly PersonalityTrait[];
  /** Power level (1-10) */
  readonly powerLevel: number;
  /** Whether this deity actively intervenes in mortal affairs */
  readonly isInterventionist: boolean;
  /** Preferred doctrine style derived from personality */
  readonly doctrine: 'compassion' | 'obedience' | 'revelation' | 'sacrifice' | 'freedom';
}

/**
 * The complete divine pantheon.
 */
export interface Pantheon {
  /** All deities */
  readonly gods: readonly Deity[];
  /** Relationships between deities */
  readonly relationships: readonly DivineRelationship[];
  /** Complexity setting used to generate this */
  readonly complexity: PantheonComplexity;
  /** Whether deities actively intervene in the world */
  readonly isInterventionist: boolean;
}

/**
 * Pantheon complexity → god count range.
 */
const COMPLEXITY_GOD_COUNT: Record<PantheonComplexity, { min: number; max: number }> = {
  atheistic: { min: 0, max: 0 },
  deistic: { min: 3, max: 5 },
  theistic: { min: 5, max: 10 },
  interventionist: { min: 8, max: 15 },
};

/**
 * Name syllable pools for deity name generation.
 */
const NAME_PREFIXES = [
  'Ae', 'Mor', 'Sol', 'Val', 'Tyr', 'Ish', 'Zar', 'Kor', 'Elu', 'Nyx',
  'Ath', 'Bal', 'Cel', 'Dra', 'Fey', 'Gal', 'Hel', 'Ith', 'Kal', 'Lor',
  'Myr', 'Nar', 'Oth', 'Pho', 'Rha', 'Sha', 'Tho', 'Uma', 'Vor', 'Xan',
];

const NAME_SUFFIXES = [
  'ris', 'oth', 'ara', 'iel', 'ane', 'uun', 'esh', 'ios', 'ynn', 'ael',
  'eon', 'ith', 'ura', 'zan', 'mir', 'pha', 'dor', 'ven', 'lux', 'nar',
];

/**
 * Map personality to doctrine style.
 */
function doctrinFromPersonality(traits: readonly PersonalityTrait[]): Deity['doctrine'] {
  const primary = traits[0];
  switch (primary) {
    case 'benevolent':
    case 'nurturing':
      return 'compassion';
    case 'wrathful':
    case 'destructive':
      return 'sacrifice';
    case 'wise':
    case 'stoic':
      return 'revelation';
    case 'cunning':
    case 'mercurial':
      return 'freedom';
    case 'jealous':
    case 'hedonistic':
      return 'obedience';
    default:
      return 'revelation';
  }
}

export class PantheonGenerator {
  /**
   * Generate a pantheon of gods based on complexity setting.
   */
  generate(complexity: PantheonComplexity, rng: SeededRNG): Pantheon {
    const pantheonRng = rng.fork('pantheon');

    if (complexity === 'atheistic') {
      return {
        gods: [],
        relationships: [],
        complexity,
        isInterventionist: false,
      };
    }

    const range = COMPLEXITY_GOD_COUNT[complexity];
    const godCount = pantheonRng.nextInt(range.min, range.max);
    const isInterventionist = complexity === 'interventionist';

    // Ensure domain coverage — assign primary domains first
    const gods = this.generateGods(godCount, isInterventionist, pantheonRng);
    const relationships = this.generateRelationships(gods, pantheonRng);

    return {
      gods,
      relationships,
      complexity,
      isInterventionist,
    };
  }

  /**
   * Generate individual deities with domain coverage.
   */
  private generateGods(
    count: number,
    isInterventionist: boolean,
    rng: SeededRNG
  ): Deity[] {
    const gods: Deity[] = [];
    const usedPrimaryDomains = new Set<Domain>();
    const usedNames = new Set<string>();

    // Shuffle domains for assignment priority
    const domainPool = [...ALL_DOMAINS];
    rng.shuffle(domainPool);

    for (let i = 0; i < count; i++) {
      // Primary domain: prefer uncovered domains
      let primaryDomain: Domain;
      const uncovered = domainPool.filter(d => !usedPrimaryDomains.has(d));
      if (uncovered.length > 0) {
        primaryDomain = rng.pick(uncovered);
      } else {
        primaryDomain = rng.pick(domainPool);
      }
      usedPrimaryDomains.add(primaryDomain);

      // Secondary domains (0-2, never same as primary)
      const secondaryCount = rng.nextInt(0, 2);
      const secondaryDomains: Domain[] = [];
      const available = ALL_DOMAINS.filter(d => d !== primaryDomain);
      for (let s = 0; s < secondaryCount && available.length > 0; s++) {
        const idx = rng.nextInt(0, available.length - 1);
        const domain = available[idx] as Domain;
        secondaryDomains.push(domain);
        available.splice(idx, 1);
      }

      // Personality (1-3 traits)
      const traitCount = rng.nextInt(1, 3);
      const traitPool = [...ALL_PERSONALITY_TRAITS];
      rng.shuffle(traitPool);
      const personality = traitPool.slice(0, traitCount);

      // Power level (1-10, skewed toward mid-high)
      const powerLevel = Math.min(10, Math.max(1,
        Math.round(rng.nextGaussian(6, 2))
      ));

      // Name
      const name = this.generateName(rng, usedNames);
      usedNames.add(name);

      // Deity interventionism: all gods in interventionist pantheon,
      // ~30% chance in theistic, never in deistic
      let godIsInterventionist = false;
      if (isInterventionist) {
        godIsInterventionist = true;
      } else {
        godIsInterventionist = rng.next() < 0.3;
      }

      gods.push({
        name,
        primaryDomain,
        secondaryDomains,
        personality,
        powerLevel,
        isInterventionist: godIsInterventionist,
        doctrine: doctrinFromPersonality(personality),
      });
    }

    return gods;
  }

  /**
   * Generate relationships between deities.
   * Ensures: at least 2 rivalries, at least 1 alliance, parent-child families.
   */
  private generateRelationships(
    gods: readonly Deity[],
    rng: SeededRNG
  ): DivineRelationship[] {
    if (gods.length < 2) return [];

    const relationships: DivineRelationship[] = [];
    const pairExists = new Set<string>();

    const addRelation = (from: number, to: number, type: RelationshipType): void => {
      const key = `${from}-${to}`;
      if (pairExists.has(key)) return;
      pairExists.add(key);

      relationships.push({
        fromIndex: from,
        toIndex: to,
        type,
        strength: rng.nextFloat(0.4, 1.0),
      });
    };

    // Guarantee at least 2 rivalries
    const indices = Array.from({ length: gods.length }, (_, i) => i);
    rng.shuffle(indices);

    const rivalryCount = Math.min(2, Math.floor(gods.length / 2));
    for (let r = 0; r < rivalryCount; r++) {
      const a = indices[r * 2] as number;
      const b = indices[r * 2 + 1] as number;
      addRelation(a, b, 'rival');
      addRelation(b, a, 'rival');
    }

    // Guarantee at least 1 alliance
    if (gods.length >= 2) {
      // Find a pair not already in rivalry
      let allyA = -1;
      let allyB = -1;
      for (let i = 0; i < gods.length && allyA === -1; i++) {
        for (let j = i + 1; j < gods.length; j++) {
          if (!pairExists.has(`${i}-${j}`)) {
            allyA = i;
            allyB = j;
            break;
          }
        }
      }
      if (allyA >= 0 && allyB >= 0) {
        addRelation(allyA, allyB, 'ally');
        addRelation(allyB, allyA, 'ally');
      }
    }

    // Parent-child families (if enough gods)
    if (gods.length >= 4) {
      const familyCount = Math.min(
        Math.floor(gods.length / 3),
        rng.nextInt(1, Math.floor(gods.length / 2))
      );
      const familyPool = [...indices];
      rng.shuffle(familyPool);

      for (let f = 0; f < familyCount && familyPool.length >= 2; f++) {
        const parentIdx = familyPool.pop()!;
        const childIdx = familyPool.pop()!;
        addRelation(parentIdx, childIdx, 'parent');
        addRelation(childIdx, parentIdx, 'child');
      }
    }

    // Random additional relationships
    const extraCount = rng.nextInt(1, Math.max(1, Math.floor(gods.length * 0.8)));
    const relTypes: RelationshipType[] = ['ally', 'rival', 'lover', 'enemy', 'indifferent'];

    for (let e = 0; e < extraCount; e++) {
      const a = rng.nextInt(0, gods.length - 1);
      let b = rng.nextInt(0, gods.length - 1);
      if (a === b) b = (b + 1) % gods.length;

      const type = rng.pick(relTypes);
      addRelation(a, b, type);
    }

    return relationships;
  }

  /**
   * Generate a unique deity name from syllable pools.
   */
  private generateName(rng: SeededRNG, usedNames: Set<string>): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      const prefix = rng.pick(NAME_PREFIXES);
      const suffix = rng.pick(NAME_SUFFIXES);
      const name = prefix + suffix;
      if (!usedNames.has(name)) {
        return name;
      }
    }
    // Fallback: append number
    return rng.pick(NAME_PREFIXES) + rng.pick(NAME_SUFFIXES) + rng.nextInt(1, 999);
  }
}
