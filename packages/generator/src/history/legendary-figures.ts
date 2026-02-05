/**
 * Legendary figure generation — tracks and records significant
 * historical characters during the pre-history simulation.
 */

import type { SeededRNG } from '../rng.js';
import type { NameGenerator } from '../character/name-generator.js';

/**
 * Role of a legendary figure in history.
 */
export type FigureRole =
  | 'ruler'
  | 'warrior'
  | 'sage'
  | 'prophet'
  | 'villain'
  | 'explorer'
  | 'artisan'
  | 'sorcerer';

const ALL_ROLES: readonly FigureRole[] = [
  'ruler', 'warrior', 'sage', 'prophet', 'villain',
  'explorer', 'artisan', 'sorcerer',
];

/**
 * Titles associated with each role.
 */
const ROLE_TITLES: Record<FigureRole, readonly string[]> = {
  ruler: ['the Great', 'the Conqueror', 'the Unifier', 'the Just', 'the Magnificent', 'the Tyrant'],
  warrior: ['the Bold', 'the Invincible', 'Ironhand', 'the Slayer', 'Shieldbreaker', 'the Fearless'],
  sage: ['the Wise', 'the Enlightened', 'the Seer', 'All-Knowing', 'the Scholar', 'the Learned'],
  prophet: ['the Divine', 'the Chosen', 'the Anointed', 'Voice of the Gods', 'the Blessed', 'the Herald'],
  villain: ['the Cruel', 'the Betrayer', 'the Dark', 'Kinslayer', 'the Accursed', 'the Terrible'],
  explorer: ['the Wanderer', 'the Pathfinder', 'Horizon-Seeker', 'the Discoverer', 'Far-Strider', 'the Voyager'],
  artisan: ['the Maker', 'Golden-Hands', 'the Architect', 'the Master', 'the Creator', 'the Artificer'],
  sorcerer: ['the Arcane', 'Spellweaver', 'the Mystic', 'Stormcaller', 'the Enchanter', 'the Warlock'],
};

/**
 * Deed templates for generating legendary deeds.
 */
const DEED_TEMPLATES: Record<FigureRole, readonly string[]> = {
  ruler: [
    'United the {race} under a single banner',
    'Expanded the borders of {civ} to their greatest extent',
    'Established the great laws of {civ}',
    'Built the legendary capital of {civ}',
    'Forged an alliance that would last centuries',
  ],
  warrior: [
    'Defeated the army of {enemy} single-handedly at the Battle of {place}',
    'Led the defense of {civ} against overwhelming odds',
    'Slew the great beast that terrorized {civ}',
    'Won twelve duels in succession without defeat',
    'Held the pass of {place} for seven days and nights',
  ],
  sage: [
    'Discovered the principles of {school} magic',
    'Wrote the Great Codex that would guide {race} scholars for centuries',
    'Unlocked the secrets of the ancient ruins near {place}',
    'Established the first great library of {civ}',
    'Solved the riddle of the {artifact} and averted catastrophe',
  ],
  prophet: [
    'Received a vision from {deity} that changed the course of history',
    'Founded the great temple of {deity} in {civ}',
    'Led the faithful through the dark years of persecution',
    'Performed miracles that converted thousands to the worship of {deity}',
    'Prophesied the fall of {enemy} centuries before it occurred',
  ],
  villain: [
    'Betrayed {civ} and opened the gates to the enemy',
    'Cursed the bloodline of {enemy} for eternity',
    'Unleashed a plague that decimated {civ}',
    'Practiced forbidden arts that corrupted the land around {place}',
    'Assassinated the rightful ruler and seized power through treachery',
  ],
  explorer: [
    'Discovered the lost lands beyond the {place}',
    'Mapped the uncharted regions of the wilderness',
    'Established the first trade routes between {civ} and distant lands',
    'Survived the crossing of the great desert and returned with rare knowledge',
    'Found the hidden valley that would become a sanctuary for {race}',
  ],
  artisan: [
    'Forged the legendary {artifact} that would shape nations',
    'Built the great walls of {civ} that stood for a thousand years',
    'Created a masterwork of art that inspired generations',
    'Invented techniques that revolutionized {race} craftsmanship',
    'Designed the grand architecture of {civ} that became legendary',
  ],
  sorcerer: [
    'Mastered the forbidden school of {school} and bent it to their will',
    'Created a spell that would be named after them for all time',
    'Bound a great elemental to protect {civ} for centuries',
    'Opened a portal to the outer planes and bargained with beings beyond',
    'Enchanted the great {artifact} with power beyond mortal understanding',
  ],
};

/**
 * A legendary historical figure.
 */
export interface LegendaryFigure {
  /** Personal name */
  readonly name: string;
  /** Honorific title */
  readonly title: string;
  /** Historical role */
  readonly role: FigureRole;
  /** Race they belonged to */
  readonly raceName: string;
  /** Civilization they were part of */
  readonly civName: string;
  /** Year of birth */
  readonly birthYear: number;
  /** Year of death */
  readonly deathYear: number;
  /** Notable deeds */
  readonly deeds: readonly string[];
  /** Historical significance (0-100) */
  readonly significance: number;
}

export class LegendaryFigureTracker {
  private readonly figures: LegendaryFigure[] = [];
  private readonly nameGen: NameGenerator;

  constructor(nameGen: NameGenerator) {
    this.nameGen = nameGen;
  }

  /**
   * Maybe generate a legendary figure for a civilization event.
   * Returns the figure if one was generated, undefined otherwise.
   */
  maybeGenerate(
    civName: string,
    raceName: string,
    namingConvention: string,
    year: number,
    lifespan: { min: number; max: number },
    context: FigureContext,
    rng: SeededRNG
  ): LegendaryFigure | undefined {
    // Base chance depends on context
    const chance = this.baseChance(context);
    if (rng.next() > chance) return undefined;

    const role = this.pickRole(context, rng);
    const gender = rng.next() < 0.5 ? 'male' as const : 'female' as const;
    const personName = this.nameGen.generatePersonName(namingConvention, gender, rng);
    const title = rng.pick(ROLE_TITLES[role]);

    const age = rng.nextInt(lifespan.min, lifespan.max);
    const birthYear = year - rng.nextInt(20, Math.min(age, 60));
    const deathYear = birthYear + age;

    const deedTemplates = DEED_TEMPLATES[role];
    const deedCount = rng.nextInt(1, Math.min(3, deedTemplates.length));
    const deedPool = [...deedTemplates];
    rng.shuffle(deedPool);
    const deeds = deedPool.slice(0, deedCount).map(d =>
      d.replace('{race}', raceName)
        .replace('{civ}', civName)
        .replace('{enemy}', context.enemyName ?? 'a rival nation')
        .replace('{place}', context.placeName ?? 'the frontier')
        .replace('{deity}', context.deityName ?? 'the divine')
        .replace('{artifact}', context.artifactName ?? 'an ancient relic')
        .replace('{school}', context.magicSchool ?? 'arcane')
    );

    const significance = Math.min(100, Math.max(50,
      Math.round(80 + rng.nextGaussian(0, 10))
    ));

    const figure: LegendaryFigure = {
      name: `${personName.first} ${personName.family}`,
      title,
      role,
      raceName,
      civName,
      birthYear,
      deathYear,
      deeds,
      significance,
    };

    this.figures.push(figure);
    return figure;
  }

  /**
   * Get all tracked legendary figures.
   */
  getAll(): readonly LegendaryFigure[] {
    return this.figures;
  }

  private baseChance(context: FigureContext): number {
    switch (context.trigger) {
      case 'war_victory': return 0.4;
      case 'civ_peak': return 0.3;
      case 'civ_founding': return 0.2;
      case 'magical_event': return 0.25;
      case 'religious_event': return 0.2;
      case 'civ_fall': return 0.35;
      case 'yearly': return 0.02;
    }
  }

  private pickRole(context: FigureContext, rng: SeededRNG): FigureRole {
    switch (context.trigger) {
      case 'war_victory':
      case 'civ_fall':
        return rng.weightedPick(
          ALL_ROLES,
          [20, 30, 5, 5, 20, 5, 5, 10]
        );
      case 'civ_peak':
      case 'civ_founding':
        return rng.weightedPick(
          ALL_ROLES,
          [40, 10, 15, 10, 5, 10, 5, 5]
        );
      case 'magical_event':
        return rng.weightedPick(
          ALL_ROLES,
          [5, 5, 15, 5, 10, 5, 15, 40]
        );
      case 'religious_event':
        return rng.weightedPick(
          ALL_ROLES,
          [10, 5, 15, 40, 10, 5, 5, 10]
        );
      case 'yearly':
        return rng.pick(ALL_ROLES);
    }
  }
}

/**
 * Context for figure generation — what triggered the opportunity.
 */
export interface FigureContext {
  readonly trigger: 'war_victory' | 'civ_peak' | 'civ_founding' | 'magical_event' | 'religious_event' | 'civ_fall' | 'yearly';
  readonly enemyName?: string | undefined;
  readonly placeName?: string | undefined;
  readonly deityName?: string | undefined;
  readonly artifactName?: string | undefined;
  readonly magicSchool?: string | undefined;
}
