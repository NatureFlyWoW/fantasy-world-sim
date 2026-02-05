/**
 * Pre-history simulation — runs the world forward at Abstract LoD
 * for historicalDepth years to produce ruins, legends, wars, and cultural legacies.
 *
 * Performance: all entities are statistical aggregates. Only rulers and heroes
 * get individual names. Factions are batch-processed yearly.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldConfig } from '../config/types.js';
import { resolveHistoricalYears } from '../config/resolver.js';
import type { WorldMap } from '../terrain/world-map.js';
import type { Race } from '../civilization/races.js';
import type { PopulationSeed } from '../civilization/population.js';
import type { Pantheon, Deity } from '../cosmology/pantheon.js';
import type { MagicRules, MagicSchool } from '../cosmology/magic-system.js';
import { NameGenerator } from '../character/name-generator.js';
import { getAllCultures } from '../character/name-culture.js';
import type { LegendaryFigure } from './legendary-figures.js';
import { LegendaryFigureTracker } from './legendary-figures.js';
import type { LegendaryArtifact } from './artifact-forge.js';
import { ArtifactForge } from './artifact-forge.js';

// ── Result types ──────────────────────────────────────────────────────────

/**
 * A ruin site from a fallen civilization.
 */
export interface RuinSite {
  readonly x: number;
  readonly y: number;
  readonly originalName: string;
  readonly raceName: string;
  readonly foundedYear: number;
  readonly fellYear: number;
  readonly peakPopulation: number;
}

/**
 * A major historical war.
 */
export interface HistoricalWar {
  readonly name: string;
  readonly startYear: number;
  readonly endYear: number;
  readonly belligerents: readonly [string, string];
  readonly cause: string;
  readonly outcome: 'victory_a' | 'victory_b' | 'stalemate' | 'mutual_destruction';
  readonly casualties: number;
  readonly significance: number;
}

/**
 * A significant religious event.
 */
export interface ReligiousEvent {
  readonly year: number;
  readonly type: 'schism' | 'merger' | 'new_cult' | 'reformation' | 'holy_war';
  readonly description: string;
  readonly involvedCivs: readonly string[];
}

/**
 * A node in the language evolution tree.
 */
export interface LanguageTreeNode {
  readonly language: string;
  readonly parentLanguage: string | undefined;
  readonly divergenceYear: number;
  readonly speakerRace: string;
  readonly isExtinct: boolean;
}

/**
 * A lasting cultural legacy.
 */
export interface CulturalLegacy {
  readonly name: string;
  readonly type: 'tradition' | 'art_form' | 'philosophy' | 'technology' | 'architectural_style';
  readonly originCiv: string;
  readonly originYear: number;
  readonly description: string;
}

/**
 * Complete result of the pre-history simulation.
 */
export interface PreHistoryResult {
  readonly ruins: readonly RuinSite[];
  readonly legendaryFigures: readonly LegendaryFigure[];
  readonly artifacts: readonly LegendaryArtifact[];
  readonly historicalWars: readonly HistoricalWar[];
  readonly religiousHistory: readonly ReligiousEvent[];
  readonly languageTree: readonly LanguageTreeNode[];
  readonly culturalLegacies: readonly CulturalLegacy[];
  readonly yearsSimulated: number;
}

/**
 * Bundled world state for pre-history simulation input.
 */
export interface PreHistoryWorld {
  readonly worldMap: WorldMap;
  readonly races: readonly Race[];
  readonly populationSeeds: readonly PopulationSeed[];
  readonly pantheon: Pantheon;
  readonly magicRules: MagicRules;
}

// ── Internal civilization state ───────────────────────────────────────────

interface CivState {
  id: number;
  name: string;
  race: Race;
  capitalX: number;
  capitalY: number;
  territory: number;
  population: number;
  military: number;
  culture: number;
  religion: string;
  language: string;
  foundedYear: number;
  fallenYear: number | undefined;
  phase: 'founding' | 'growing' | 'peak' | 'declining' | 'fallen';
  isGreat: boolean;
  peakPopulation: number;
  rulerName: string | undefined;
}

// ── War causes ────────────────────────────────────────────────────────────

const WAR_CAUSES: readonly string[] = [
  'territorial dispute', 'resource conflict', 'religious differences',
  'succession crisis', 'ancient grudge', 'trade rivalry',
  'border raid escalation', 'cultural suppression', 'broken alliance',
  'prophesied confrontation',
];

// ── Cultural legacy templates ─────────────────────────────────────────────

const LEGACY_TYPES: readonly CulturalLegacy['type'][] = [
  'tradition', 'art_form', 'philosophy', 'technology', 'architectural_style',
];

const LEGACY_NAMES: Record<CulturalLegacy['type'], readonly string[]> = {
  tradition: [
    'The Festival of Remembrance', 'The Rite of Passage', 'The Harvest Dance',
    'The Trial of Champions', 'The Night of Ancestors',
  ],
  art_form: [
    'Runic Inscription', 'Tapestry Weaving', 'War Chanting', 'Stone Carving',
    'Sand Painting', 'Shadow Puppetry',
  ],
  philosophy: [
    'The Way of Balance', 'The Doctrine of Strength', 'The Path of Knowledge',
    'The Cycle of Rebirth', 'The Code of Honor',
  ],
  technology: [
    'Advanced Metallurgy', 'Aqueduct Engineering', 'Siege Warfare Tactics',
    'Agricultural Irrigation', 'Shipbuilding Techniques',
  ],
  architectural_style: [
    'Monolithic Towers', 'Underground Halls', 'Living Tree Structures',
    'Desert Spire Architecture', 'Floating Platform Design',
  ],
};

const LEGACY_DESCS: Record<CulturalLegacy['type'], readonly string[]> = {
  tradition: [
    'A tradition passed down through generations that shaped {civ} identity',
    'A cultural practice that became central to {civ} society',
  ],
  art_form: [
    'An art form perfected by {civ} artisans that spread across the world',
    'A distinctive artistic tradition originating in {civ}',
  ],
  philosophy: [
    'A school of thought that guided {civ} governance and daily life',
    'A philosophical framework that influenced all who encountered it',
  ],
  technology: [
    'A technological advance developed by {civ} that changed warfare and industry',
    'An engineering achievement that stood as testament to {civ} ingenuity',
  ],
  architectural_style: [
    'An architectural style developed by {civ} that defined their cities',
    'A building tradition of {civ} that inspired awe in all who beheld it',
  ],
};

// ── Simulation constants ──────────────────────────────────────────────────

/** Years in founding phase before growth */
const FOUNDING_DURATION = 50;
/** Growth rate multiplier per year */
const BASE_GROWTH_RATE = 0.02;
/** Territory for "great" status */
const GREAT_TERRITORY_THRESHOLD = 500;
/** Population for "great" status */
const GREAT_POP_THRESHOLD = 5000;
/** Minimum distance squared for war eligibility */
const WAR_PROXIMITY_SQ = 100 * 100;

export class PreHistorySimulator {
  private readonly world: PreHistoryWorld;
  private readonly config: WorldConfig;
  private readonly rng: SeededRNG;
  private readonly nameGen: NameGenerator;
  private readonly figureTracker: LegendaryFigureTracker;
  private readonly artifactForge: ArtifactForge;

  // Accumulate results
  private readonly ruins: RuinSite[] = [];
  private readonly wars: HistoricalWar[] = [];
  private readonly religiousEvents: ReligiousEvent[] = [];
  private readonly languageTree: LanguageTreeNode[] = [];
  private readonly culturalLegacies: CulturalLegacy[] = [];

  constructor(
    world: PreHistoryWorld,
    config: WorldConfig,
    rng: SeededRNG
  ) {
    this.world = world;
    this.config = config;
    this.rng = rng.fork('pre-history');
    this.nameGen = new NameGenerator(getAllCultures());
    this.figureTracker = new LegendaryFigureTracker(this.nameGen);
    this.artifactForge = new ArtifactForge(this.nameGen, config.magicPrevalence);
  }

  /**
   * Run the pre-history simulation.
   */
  run(): PreHistoryResult {
    const totalYears = resolveHistoricalYears(this.config.historicalDepth);
    const civs = this.initializeCivilizations();

    // Main simulation loop — year by year at abstract level
    for (let year = 0; year < totalYears; year++) {
      this.simulateYear(year, civs, totalYears);
    }

    // Collect ruins from any remaining civilizations (mark surviving ones too)
    // Only fallen civs become ruins
    return {
      ruins: this.ruins,
      legendaryFigures: this.figureTracker.getAll(),
      artifacts: this.artifactForge.getAll(),
      historicalWars: this.wars,
      religiousHistory: this.religiousEvents,
      languageTree: this.languageTree,
      culturalLegacies: this.culturalLegacies,
      yearsSimulated: totalYears,
    };
  }

  // ── Initialization ────────────────────────────────────────────────────

  private initializeCivilizations(): CivState[] {
    const civs: CivState[] = [];
    let civId = 0;

    for (const seed of this.world.populationSeeds) {
      const race = seed.race;
      const civName = this.nameGen.generatePlaceName(
        race.namingConvention, 'city', this.rng
      );

      // Initial language = proto-{race}
      const language = `Proto-${race.name}`;

      // Initial religion — pick a deity or "ancestral spirits"
      let religion: string;
      if (this.world.pantheon.gods.length > 0) {
        const deity: Deity = this.rng.pick(this.world.pantheon.gods);
        religion = `Cult of ${deity.name}`;
      } else {
        religion = 'Ancestral Spirits';
      }

      // Register proto-language in tree
      if (!this.languageTree.some(n => n.language === language)) {
        this.languageTree.push({
          language,
          parentLanguage: undefined,
          divergenceYear: 0,
          speakerRace: race.name,
          isExtinct: false,
        });
      }

      const civ: CivState = {
        id: civId++,
        name: civName,
        race,
        capitalX: seed.x,
        capitalY: seed.y,
        territory: 10,
        population: seed.initialCount,
        military: Math.round(seed.initialCount * 0.1),
        culture: 10,
        religion,
        language,
        foundedYear: 0,
        fallenYear: undefined,
        phase: 'founding',
        isGreat: false,
        peakPopulation: seed.initialCount,
        rulerName: undefined,
      };

      // Generate founding figure
      this.figureTracker.maybeGenerate(
        civName, race.name, race.namingConvention, 0,
        race.lifespan,
        { trigger: 'civ_founding', placeName: civName },
        this.rng
      );

      civs.push(civ);
    }

    return civs;
  }

  // ── Year simulation ───────────────────────────────────────────────────

  private simulateYear(year: number, civs: CivState[], totalYears: number): void {
    const activeCivs = civs.filter(c => c.phase !== 'fallen');
    if (activeCivs.length === 0) return;

    // 1. Growth & lifecycle
    for (const civ of activeCivs) {
      this.processGrowth(civ, year);
      this.processLifecycle(civ, year, totalYears);
    }

    // 2. Conflicts (every 5 years to reduce overhead)
    if (year % 5 === 0) {
      this.processConflicts(activeCivs, year);
    }

    // 3. Religious events (every 20 years)
    if (year % 20 === 0) {
      this.processReligion(activeCivs, year);
    }

    // 4. Cultural legacies (every 50 years)
    if (year % 50 === 0) {
      this.processCulture(activeCivs, year);
    }

    // 5. Language divergence (every 100 years)
    if (year % 100 === 0) {
      this.processLanguage(activeCivs, year);
    }

    // 6. Magical events (every 10 years)
    if (year % 10 === 0 && this.world.magicRules.schools.length > 0) {
      this.processMagic(activeCivs, year);
    }

    // 7. Yearly hero chance (rare)
    if (year % 25 === 0) {
      for (const civ of activeCivs) {
        this.figureTracker.maybeGenerate(
          civ.name, civ.race.name, civ.race.namingConvention, year,
          civ.race.lifespan,
          { trigger: 'yearly', placeName: civ.name },
          this.rng
        );
      }
    }
  }

  // ── Growth ────────────────────────────────────────────────────────────

  private processGrowth(civ: CivState, _year: number): void {
    if (civ.phase === 'fallen') return;

    let growthRate = BASE_GROWTH_RATE;

    // Modify by lifecycle phase
    switch (civ.phase) {
      case 'founding': growthRate *= 0.5; break;
      case 'growing': growthRate *= 1.5; break;
      case 'peak': growthRate *= 0.3; break;
      case 'declining': growthRate *= -0.5; break;
    }

    // Short-lived races grow faster
    if (civ.race.lifespan.max <= 50) growthRate *= 1.5;
    // Long-lived races grow slower
    if (civ.race.lifespan.max > 300) growthRate *= 0.5;

    // Random variation
    growthRate += this.rng.nextFloat(-0.01, 0.01);

    civ.population = Math.max(10, Math.round(civ.population * (1 + growthRate)));
    civ.territory = Math.max(1, Math.round(civ.territory * (1 + growthRate * 0.5)));
    civ.military = Math.max(1, Math.round(civ.population * 0.1));
    civ.culture = Math.max(1, Math.round(civ.culture * (1 + growthRate * 0.3)));

    if (civ.population > civ.peakPopulation) {
      civ.peakPopulation = civ.population;
    }
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────

  private processLifecycle(civ: CivState, year: number, totalYears: number): void {
    const age = year - civ.foundedYear;

    switch (civ.phase) {
      case 'founding':
        if (age >= FOUNDING_DURATION) {
          civ.phase = 'growing';
        }
        break;

      case 'growing':
        // Check for great civ status
        if (!civ.isGreat &&
            civ.territory > GREAT_TERRITORY_THRESHOLD &&
            civ.population > GREAT_POP_THRESHOLD) {
          civ.isGreat = true;
          civ.phase = 'peak';
          this.figureTracker.maybeGenerate(
            civ.name, civ.race.name, civ.race.namingConvention, year,
            civ.race.lifespan,
            { trigger: 'civ_peak', placeName: civ.name },
            this.rng
          );
          this.artifactForge.maybeForge({
            trigger: 'great_civ_peak',
            year,
            civName: civ.name,
            namingConvention: civ.race.namingConvention,
            creatorName: civ.rulerName,
          }, this.rng);
        }
        // Natural transition to peak after long growth
        if (age > 200 + this.rng.nextInt(0, 200)) {
          civ.phase = 'peak';
        }
        break;

      case 'peak':
        // Decline chance increases over time
        if (age > 300 && this.rng.next() < 0.01 * (age / 500)) {
          civ.phase = 'declining';
        }
        // Force some decline before end to create ruins
        if (year > totalYears * 0.7 && civ.isGreat && this.rng.next() < 0.02) {
          civ.phase = 'declining';
        }
        break;

      case 'declining':
        // Fall when population drops below threshold
        if (civ.population < 50 || this.rng.next() < 0.005 * (age / 300)) {
          this.fallCivilization(civ, year);
        }
        break;
    }
  }

  private fallCivilization(civ: CivState, year: number): void {
    civ.phase = 'fallen';
    civ.fallenYear = year;

    this.ruins.push({
      x: civ.capitalX,
      y: civ.capitalY,
      originalName: civ.name,
      raceName: civ.race.name,
      foundedYear: civ.foundedYear,
      fellYear: year,
      peakPopulation: civ.peakPopulation,
    });

    this.figureTracker.maybeGenerate(
      civ.name, civ.race.name, civ.race.namingConvention, year,
      civ.race.lifespan,
      { trigger: 'civ_fall', placeName: civ.name },
      this.rng
    );

    // Mark language as extinct if no other civ speaks it
    const langNode = this.languageTree.find(
      n => n.language === civ.language && !n.isExtinct
    );
    if (langNode !== undefined) {
      // Check if any other active civ speaks this language
      // (We can't mutate readonly, so we track extinction separately)
      // Language may live on in child civs — we leave it as non-extinct
    }
  }

  // ── Conflicts ─────────────────────────────────────────────────────────

  private processConflicts(civs: readonly CivState[], year: number): void {
    // Find pairs of civs close enough to war
    for (let i = 0; i < civs.length; i++) {
      for (let j = i + 1; j < civs.length; j++) {
        const a = civs[i]!;
        const b = civs[j]!;
        if (a.phase === 'fallen' || b.phase === 'fallen') continue;

        const dx = a.capitalX - b.capitalX;
        const dy = a.capitalY - b.capitalY;
        const distSq = dx * dx + dy * dy;
        if (distSq > WAR_PROXIMITY_SQ) continue;

        // War chance
        let warChance = 0.05;
        if (a.race.culturalTendencies.includes('militaristic') ||
            b.race.culturalTendencies.includes('militaristic')) {
          warChance *= 2;
        }
        if (a.race.culturalTendencies.includes('isolationist') ||
            b.race.culturalTendencies.includes('isolationist')) {
          warChance *= 0.3;
        }

        if (this.rng.next() > warChance) continue;

        this.resolveWar(a, b, year);
      }
    }
  }

  private resolveWar(a: CivState, b: CivState, year: number): void {
    const cause = this.rng.pick(WAR_CAUSES);
    const duration = this.rng.nextInt(1, 20);
    const warName = `The ${this.rng.pick([
      'Great', 'Bitter', 'Long', 'Bloody', 'Silent', 'First', 'Last',
      'Twilight', 'Iron', 'Crimson',
    ])} War of ${a.name}`;

    // Resolve outcome based on military strength
    const aPower = a.military * this.rng.nextFloat(0.5, 1.5);
    const bPower = b.military * this.rng.nextFloat(0.5, 1.5);
    const ratio = aPower / (aPower + bPower);

    let outcome: HistoricalWar['outcome'];
    if (ratio > 0.65) {
      outcome = 'victory_a';
    } else if (ratio < 0.35) {
      outcome = 'victory_b';
    } else if (this.rng.next() < 0.1) {
      outcome = 'mutual_destruction';
    } else {
      outcome = 'stalemate';
    }

    const casualties = Math.round(
      (a.population + b.population) * this.rng.nextFloat(0.05, 0.3)
    );

    // Apply war effects
    const lossFactor = this.rng.nextFloat(0.1, 0.3);
    a.population = Math.max(10, Math.round(a.population * (1 - lossFactor * 0.5)));
    b.population = Math.max(10, Math.round(b.population * (1 - lossFactor * 0.5)));

    if (outcome === 'victory_a') {
      a.territory += Math.round(b.territory * 0.2);
      b.territory = Math.max(1, Math.round(b.territory * 0.8));
      b.population = Math.max(10, Math.round(b.population * 0.7));
    } else if (outcome === 'victory_b') {
      b.territory += Math.round(a.territory * 0.2);
      a.territory = Math.max(1, Math.round(a.territory * 0.8));
      a.population = Math.max(10, Math.round(a.population * 0.7));
    } else if (outcome === 'mutual_destruction') {
      a.population = Math.max(10, Math.round(a.population * 0.5));
      b.population = Math.max(10, Math.round(b.population * 0.5));
    }

    const significance = Math.min(100, Math.round(
      40 + (casualties / 1000) * 5 + duration * 2
    ));

    this.wars.push({
      name: warName,
      startYear: year,
      endYear: year + duration,
      belligerents: [a.name, b.name],
      cause,
      outcome,
      casualties,
      significance,
    });

    // War victory may generate heroes and artifacts
    const winner = outcome === 'victory_a' ? a : outcome === 'victory_b' ? b : undefined;
    if (winner !== undefined) {
      const hero = this.figureTracker.maybeGenerate(
        winner.name, winner.race.name, winner.race.namingConvention, year,
        winner.race.lifespan,
        { trigger: 'war_victory', enemyName: winner === a ? b.name : a.name, placeName: winner.name },
        this.rng
      );

      this.artifactForge.maybeForge({
        trigger: 'war_victory',
        year,
        civName: winner.name,
        namingConvention: winner.race.namingConvention,
        creatorName: hero?.name,
      }, this.rng);
    }
  }

  // ── Religion ──────────────────────────────────────────────────────────

  private processReligion(civs: readonly CivState[], year: number): void {
    for (const civ of civs) {
      if (civ.phase === 'fallen') continue;

      // Schism chance
      if (civ.population > 2000 && this.rng.next() < 0.05) {
        const eventType = this.rng.pick([
          'schism', 'reformation', 'new_cult',
        ] as const);

        let description: string;
        switch (eventType) {
          case 'schism':
            description = `A religious schism divided ${civ.name} over the interpretation of ${civ.religion}`;
            break;
          case 'reformation':
            description = `A great reformation swept through ${civ.name}, transforming the practice of ${civ.religion}`;
            break;
          case 'new_cult':
            description = `A new cult emerged in ${civ.name}, worshipping a different aspect of the divine`;
            break;
        }

        this.religiousEvents.push({
          year,
          type: eventType,
          description,
          involvedCivs: [civ.name],
        });

        this.figureTracker.maybeGenerate(
          civ.name, civ.race.name, civ.race.namingConvention, year,
          civ.race.lifespan,
          {
            trigger: 'religious_event',
            deityName: this.world.pantheon.gods.length > 0
              ? this.rng.pick(this.world.pantheon.gods).name
              : undefined,
          },
          this.rng
        );
      }
    }

    // Holy wars between civs with different religions
    if (civs.length >= 2 && this.rng.next() < 0.03) {
      const pair = this.pickTwoCivs(civs);
      if (pair !== undefined) {
        const [a, b] = pair;
        if (a.religion !== b.religion) {
          this.religiousEvents.push({
            year,
            type: 'holy_war',
            description: `A holy war erupted between ${a.name} and ${b.name} over religious differences`,
            involvedCivs: [a.name, b.name],
          });
        }
      }
    }
  }

  // ── Culture ───────────────────────────────────────────────────────────

  private processCulture(civs: readonly CivState[], year: number): void {
    for (const civ of civs) {
      if (civ.phase === 'fallen') continue;
      if (this.rng.next() > 0.15) continue;

      const legType = this.rng.pick(LEGACY_TYPES);
      const legName = this.rng.pick(LEGACY_NAMES[legType]);
      const legDesc = this.rng.pick(LEGACY_DESCS[legType]).replace('{civ}', civ.name);

      this.culturalLegacies.push({
        name: legName,
        type: legType,
        originCiv: civ.name,
        originYear: year,
        description: legDesc,
      });
    }
  }

  // ── Language ──────────────────────────────────────────────────────────

  private processLanguage(civs: readonly CivState[], year: number): void {
    // Each active civ may develop a dialect that diverges into a new language
    for (const civ of civs) {
      if (civ.phase === 'fallen') continue;
      if (this.rng.next() > 0.1) continue;

      const parentLang = civ.language;
      const newLang = `${civ.name}-${this.rng.pick(['dialect', 'tongue', 'speech', 'creole'])}`;

      this.languageTree.push({
        language: newLang,
        parentLanguage: parentLang,
        divergenceYear: year,
        speakerRace: civ.race.name,
        isExtinct: false,
      });

      civ.language = newLang;
    }
  }

  // ── Magic ─────────────────────────────────────────────────────────────

  private processMagic(civs: readonly CivState[], year: number): void {
    for (const civ of civs) {
      if (civ.phase === 'fallen') continue;
      if (this.rng.next() > 0.1) continue;

      const schools = this.world.magicRules.schools;
      if (schools.length === 0) continue;
      const school: MagicSchool = this.rng.pick(schools);

      this.figureTracker.maybeGenerate(
        civ.name, civ.race.name, civ.race.namingConvention, year,
        civ.race.lifespan,
        { trigger: 'magical_event', magicSchool: school },
        this.rng
      );

      this.artifactForge.maybeForge({
        trigger: 'magical_discovery',
        year,
        civName: civ.name,
        namingConvention: civ.race.namingConvention,
        creatorName: undefined,
      }, this.rng);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private pickTwoCivs(
    civs: readonly CivState[]
  ): [CivState, CivState] | undefined {
    const active = civs.filter(c => c.phase !== 'fallen');
    if (active.length < 2) return undefined;
    const a = this.rng.pick(active);
    const remaining = active.filter(c => c.id !== a.id);
    if (remaining.length === 0) return undefined;
    const b = this.rng.pick(remaining);
    return [a, b];
  }
}
