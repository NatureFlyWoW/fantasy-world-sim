/**
 * Magic system generation — schools, power sources, rules, limitations.
 * Active schools scaled by MagicPrevalence setting.
 */

import type { SeededRNG } from '../rng.js';
import type { MagicPrevalence } from '../config/types.js';

/**
 * Schools of magic available in the world.
 */
export enum MagicSchool {
  Elemental = 'Elemental',
  Necromancy = 'Necromancy',
  Divination = 'Divination',
  Illusion = 'Illusion',
  Enchantment = 'Enchantment',
  Summoning = 'Summoning',
  Transmutation = 'Transmutation',
  Healing = 'Healing',
  Destruction = 'Destruction',
  Abjuration = 'Abjuration',
  Chronomancy = 'Chronomancy',
}

const ALL_SCHOOLS: readonly MagicSchool[] = Object.values(MagicSchool) as MagicSchool[];

/**
 * Sources of magical power.
 */
export enum PowerSource {
  Divine = 'Divine',
  Arcane = 'Arcane',
  Natural = 'Natural',
  Demonic = 'Demonic',
  Psionic = 'Psionic',
  Ley = 'Ley',
  Blood = 'Blood',
  Celestial = 'Celestial',
}

const ALL_SOURCES: readonly PowerSource[] = Object.values(PowerSource) as PowerSource[];

/**
 * A limitation or cost imposed on magic use.
 */
export interface MagicLimitation {
  /** Name of the limitation */
  readonly name: string;
  /** Which schools it applies to (empty = all) */
  readonly affectedSchools: readonly MagicSchool[];
  /** Severity (1-10) */
  readonly severity: number;
  /** Description */
  readonly description: string;
}

/**
 * How two magic schools interact.
 */
export interface SchoolInteraction {
  /** First school */
  readonly schoolA: MagicSchool;
  /** Second school */
  readonly schoolB: MagicSchool;
  /** Synergy (positive) or opposition (negative), range -1 to 1 */
  readonly affinity: number;
}

/**
 * Complete magic system rules for the world.
 */
export interface MagicRules {
  /** Active magic schools in this world */
  readonly schools: readonly MagicSchool[];
  /** Available power sources */
  readonly powerSources: readonly PowerSource[];
  /** Limitations and costs */
  readonly limitations: readonly MagicLimitation[];
  /** Interactions between schools */
  readonly interactions: readonly SchoolInteraction[];
  /** Overall magic strength multiplier (0 = no magic, 1 = normal, 2+ = high magic) */
  readonly strengthMultiplier: number;
  /** Magic prevalence setting used */
  readonly prevalence: MagicPrevalence;
}

/**
 * MagicPrevalence → active school count range.
 */
const PREVALENCE_SCHOOL_COUNT: Record<MagicPrevalence, { min: number; max: number }> = {
  mundane: { min: 0, max: 0 },
  low: { min: 1, max: 2 },
  moderate: { min: 3, max: 5 },
  high: { min: 5, max: 8 },
  ubiquitous: { min: 11, max: 11 },
};

/**
 * MagicPrevalence → strength multiplier range.
 */
const PREVALENCE_STRENGTH: Record<MagicPrevalence, { min: number; max: number }> = {
  mundane: { min: 0, max: 0 },
  low: { min: 0.3, max: 0.6 },
  moderate: { min: 0.6, max: 1.2 },
  high: { min: 1.0, max: 2.0 },
  ubiquitous: { min: 1.5, max: 3.0 },
};

/**
 * MagicPrevalence → source count range.
 */
const PREVALENCE_SOURCE_COUNT: Record<MagicPrevalence, { min: number; max: number }> = {
  mundane: { min: 0, max: 0 },
  low: { min: 1, max: 2 },
  moderate: { min: 2, max: 4 },
  high: { min: 3, max: 6 },
  ubiquitous: { min: 8, max: 8 },
};

/**
 * Predefined limitations that can apply to magic.
 */
const LIMITATION_TEMPLATES: readonly { name: string; description: string }[] = [
  { name: 'Physical Exhaustion', description: 'Casting drains the caster\'s physical stamina' },
  { name: 'Material Components', description: 'Spells require rare physical materials to cast' },
  { name: 'Backlash Risk', description: 'Failed spells can harm the caster' },
  { name: 'Corruption', description: 'Prolonged use corrupts the caster\'s body or mind' },
  { name: 'Ley Dependency', description: 'Magic only functions near ley lines' },
  { name: 'Emotional Toll', description: 'Casting requires intense emotional focus and leaves the caster drained' },
  { name: 'Temporal Debt', description: 'Magic use shortens the caster\'s lifespan' },
  { name: 'Spell Sickness', description: 'Rapid successive casting causes nausea and disorientation' },
  { name: 'Moonphase Binding', description: 'Certain magics only work during specific lunar phases' },
  { name: 'Sound Requirement', description: 'Spells require spoken incantations — silence blocks magic' },
];

/**
 * Natural school affinities (synergies and oppositions).
 */
const NATURAL_AFFINITIES: readonly { a: MagicSchool; b: MagicSchool; affinity: number }[] = [
  { a: MagicSchool.Healing, b: MagicSchool.Necromancy, affinity: -0.8 },
  { a: MagicSchool.Destruction, b: MagicSchool.Abjuration, affinity: -0.6 },
  { a: MagicSchool.Elemental, b: MagicSchool.Destruction, affinity: 0.7 },
  { a: MagicSchool.Divination, b: MagicSchool.Chronomancy, affinity: 0.8 },
  { a: MagicSchool.Illusion, b: MagicSchool.Enchantment, affinity: 0.6 },
  { a: MagicSchool.Summoning, b: MagicSchool.Necromancy, affinity: 0.5 },
  { a: MagicSchool.Transmutation, b: MagicSchool.Elemental, affinity: 0.4 },
  { a: MagicSchool.Healing, b: MagicSchool.Destruction, affinity: -0.7 },
];

export class MagicSystemGenerator {
  /**
   * Generate magic system rules based on prevalence setting.
   */
  generate(prevalence: MagicPrevalence, rng: SeededRNG): MagicRules {
    const magicRng = rng.fork('magic-system');

    if (prevalence === 'mundane') {
      return {
        schools: [],
        powerSources: [],
        limitations: [],
        interactions: [],
        strengthMultiplier: 0,
        prevalence,
      };
    }

    const schools = this.selectSchools(prevalence, magicRng);
    const powerSources = this.selectSources(prevalence, magicRng);
    const limitations = this.selectLimitations(schools, magicRng);
    const interactions = this.computeInteractions(schools, magicRng);

    const strengthRange = PREVALENCE_STRENGTH[prevalence];
    const strengthMultiplier = magicRng.nextFloat(strengthRange.min, strengthRange.max);

    return {
      schools,
      powerSources,
      limitations,
      interactions,
      strengthMultiplier: Math.round(strengthMultiplier * 100) / 100,
      prevalence,
    };
  }

  /**
   * Select active magic schools based on prevalence.
   */
  private selectSchools(prevalence: MagicPrevalence, rng: SeededRNG): MagicSchool[] {
    const range = PREVALENCE_SCHOOL_COUNT[prevalence];

    if (range.min === ALL_SCHOOLS.length) {
      return [...ALL_SCHOOLS];
    }

    const count = rng.nextInt(range.min, range.max);
    const pool = [...ALL_SCHOOLS];
    rng.shuffle(pool);
    return pool.slice(0, count);
  }

  /**
   * Select available power sources based on prevalence.
   */
  private selectSources(prevalence: MagicPrevalence, rng: SeededRNG): PowerSource[] {
    const range = PREVALENCE_SOURCE_COUNT[prevalence];

    if (range.min === ALL_SOURCES.length) {
      return [...ALL_SOURCES];
    }

    const count = rng.nextInt(range.min, range.max);
    const pool = [...ALL_SOURCES];
    rng.shuffle(pool);
    return pool.slice(0, count);
  }

  /**
   * Select limitations for the magic system.
   * More limitations with fewer schools (magic is rare → more restricted).
   */
  private selectLimitations(schools: readonly MagicSchool[], rng: SeededRNG): MagicLimitation[] {
    const baseLimitCount = Math.max(1, Math.min(5, 6 - schools.length));
    const limitCount = rng.nextInt(baseLimitCount, baseLimitCount + 2);

    const pool = [...LIMITATION_TEMPLATES];
    rng.shuffle(pool);

    const limitations: MagicLimitation[] = [];
    for (let i = 0; i < limitCount && i < pool.length; i++) {
      const template = pool[i]!;

      // Randomly assign to specific schools or all
      let affectedSchools: MagicSchool[] = [];
      if (rng.next() < 0.4 && schools.length > 1) {
        // Applies to specific schools
        const affected = rng.nextInt(1, Math.min(3, schools.length));
        const schoolPool = [...schools];
        rng.shuffle(schoolPool);
        affectedSchools = schoolPool.slice(0, affected);
      }

      limitations.push({
        name: template.name,
        affectedSchools,
        severity: rng.nextInt(2, 8),
        description: template.description,
      });
    }

    return limitations;
  }

  /**
   * Compute interactions between active schools.
   */
  private computeInteractions(
    schools: readonly MagicSchool[],
    rng: SeededRNG
  ): SchoolInteraction[] {
    const interactions: SchoolInteraction[] = [];
    const schoolSet = new Set(schools);

    // Add natural affinities for active schools
    for (const nat of NATURAL_AFFINITIES) {
      if (schoolSet.has(nat.a) && schoolSet.has(nat.b)) {
        interactions.push({
          schoolA: nat.a,
          schoolB: nat.b,
          affinity: nat.affinity + rng.nextFloat(-0.1, 0.1),
        });
      }
    }

    // Add a few random interactions for pairs without defined affinities
    const existingPairs = new Set(interactions.map(i => `${i.schoolA}-${i.schoolB}`));
    const extraCount = rng.nextInt(0, Math.max(0, Math.floor(schools.length / 2)));

    for (let e = 0; e < extraCount; e++) {
      const a = rng.pick(schools);
      const b = rng.pick(schools);
      if (a === b) continue;
      const key = `${a}-${b}`;
      const keyRev = `${b}-${a}`;
      if (existingPairs.has(key) || existingPairs.has(keyRev)) continue;

      existingPairs.add(key);
      interactions.push({
        schoolA: a,
        schoolB: b,
        affinity: rng.nextFloat(-0.5, 0.5),
      });
    }

    return interactions;
  }
}
