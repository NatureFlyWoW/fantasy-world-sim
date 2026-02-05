/**
 * Faction initialization — creates political factions that control settlements
 * and assigns government types based on race, history, and configuration.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldConfig, TechnologyEra } from '../config/types.js';
import type { PreHistoryResult } from '../history/pre-history.js';
import type { Race } from './races.js';
import type { Settlement } from './settlement-placer.js';
import type { NameGenerator } from '../character/name-generator.js';

/**
 * Government type of a faction.
 */
export type GovernmentType =
  | 'monarchy'
  | 'republic'
  | 'theocracy'
  | 'tribal_confederation'
  | 'oligarchy'
  | 'magocracy';

/**
 * Cultural tendency → government type weights.
 */
const TENDENCY_GOV_WEIGHTS: Record<string, Partial<Record<GovernmentType, number>>> = {
  militaristic: { monarchy: 30, tribal_confederation: 20, oligarchy: 10 },
  scholarly: { republic: 25, magocracy: 20, oligarchy: 15 },
  mercantile: { republic: 30, oligarchy: 25 },
  agrarian: { monarchy: 20, tribal_confederation: 25 },
  nomadic: { tribal_confederation: 40 },
  artistic: { republic: 25, monarchy: 15 },
  religious: { theocracy: 40, monarchy: 15 },
  isolationist: { tribal_confederation: 25, monarchy: 15 },
  expansionist: { monarchy: 30, oligarchy: 15 },
  seafaring: { republic: 20, oligarchy: 20 },
  industrious: { oligarchy: 25, republic: 15, monarchy: 10 },
  mystical: { magocracy: 35, theocracy: 20 },
};

/**
 * All government types with base weights.
 */
const ALL_GOV_TYPES: readonly GovernmentType[] = [
  'monarchy', 'republic', 'theocracy', 'tribal_confederation', 'oligarchy', 'magocracy',
];

const BASE_GOV_WEIGHTS: Record<GovernmentType, number> = {
  monarchy: 25,
  republic: 15,
  theocracy: 15,
  tribal_confederation: 15,
  oligarchy: 15,
  magocracy: 15,
};

/**
 * A political faction controlling territory.
 */
export interface Faction {
  /** Faction name */
  readonly name: string;
  /** Government structure */
  readonly governmentType: GovernmentType;
  /** Primary race of the faction */
  readonly primaryRace: Race;
  /** Capital settlement index */
  readonly capitalIndex: number;
  /** Indices of all controlled settlements */
  readonly settlementIndices: readonly number[];
  /** Military strength (0-100) */
  readonly militaryStrength: number;
  /** Economic wealth (0-100) */
  readonly economicWealth: number;
  /** Cultural influence (0-100) */
  readonly culturalInfluence: number;
  /** Diplomatic reputation (0-100) */
  readonly diplomaticReputation: number;
  /** Primary religion */
  readonly religion: string;
  /** Technology era */
  readonly technologyEra: TechnologyEra;
  /** Faction color (for map rendering) */
  readonly color: string;
}

/**
 * Colors for faction territories.
 */
const FACTION_COLORS: readonly string[] = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#6a4c93', '#1982c4', '#8ac926', '#ff595e',
  '#6d6875', '#b5838d', '#ffb703', '#023047', '#219ebc',
  '#8338ec', '#ff006e', '#3a86ff', '#fb5607', '#80b918',
];

export class FactionInitializer {
  /**
   * Initialize factions from settlements and assign territories.
   */
  initialize(
    settlements: Settlement[],
    races: readonly Race[],
    preHistory: PreHistoryResult,
    nameGen: NameGenerator,
    config: WorldConfig,
    rng: SeededRNG
  ): Faction[] {
    const facRng = rng.fork('factions');
    if (settlements.length === 0) return [];

    // Find cities — each city becomes a faction capital
    const cities = settlements
      .map((s, i) => ({ settlement: s, index: i }))
      .filter(e => e.settlement.type === 'city');

    if (cities.length === 0) {
      // Fallback: use towns as capitals
      const towns = settlements
        .map((s, i) => ({ settlement: s, index: i }))
        .filter(e => e.settlement.type === 'town');
      if (towns.length === 0) return [];
      cities.push(...towns.slice(0, Math.min(3, towns.length)));
    }

    // Create a faction for each capital
    const factions: Faction[] = [];

    for (let fi = 0; fi < cities.length; fi++) {
      const capital = cities[fi]!;
      const race = this.findRace(capital.settlement.dominantRace, races);
      const govType = this.pickGovernment(race, config, facRng);

      // Determine religion from pre-history
      const religion = this.pickReligion(preHistory, facRng);

      // Adjusted tech era
      const technologyEra = this.adjustTechEra(config.technologyEra, race, facRng);

      // Generate faction name using the race's naming convention
      const namingConvention = race.namingConvention;
      const name = nameGen.generateFactionName(namingConvention, facRng);

      // Stats scaled by settlement population
      const pop = capital.settlement.population;
      const militaryStrength = Math.min(100, Math.max(10,
        Math.round(40 + facRng.nextGaussian(0, 15) + (race.culturalTendencies.includes('militaristic') ? 15 : 0))
      ));
      const economicWealth = Math.min(100, Math.max(10,
        Math.round(35 + facRng.nextGaussian(0, 15) + (pop > 10000 ? 15 : 0))
      ));
      const culturalInfluence = Math.min(100, Math.max(10,
        Math.round(30 + facRng.nextGaussian(0, 15) + (race.culturalTendencies.includes('artistic') ? 15 : 0))
      ));
      const diplomaticReputation = Math.min(100, Math.max(10,
        Math.round(40 + facRng.nextGaussian(0, 15))
      ));

      const color = FACTION_COLORS[fi % FACTION_COLORS.length]!;

      factions.push({
        name,
        governmentType: govType,
        primaryRace: race,
        capitalIndex: capital.index,
        settlementIndices: [capital.index],
        militaryStrength,
        economicWealth,
        culturalInfluence,
        diplomaticReputation,
        religion,
        technologyEra,
        color,
      });

      // Assign capital to this faction
      capital.settlement.factionIndex = fi;
    }

    // Assign remaining settlements to nearest faction
    this.assignTerritories(settlements, factions);

    return factions;
  }

  /**
   * Assign non-capital settlements to the nearest faction.
   */
  private assignTerritories(settlements: Settlement[], factions: Faction[]): void {
    for (let si = 0; si < settlements.length; si++) {
      const settlement = settlements[si]!;
      if (settlement.factionIndex !== undefined) continue;

      // Find nearest faction capital
      let bestDist = Infinity;
      let bestFi = 0;
      for (let fi = 0; fi < factions.length; fi++) {
        const capital = settlements[factions[fi]!.capitalIndex]!;
        const dx = settlement.x - capital.x;
        const dy = settlement.y - capital.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestFi = fi;
        }
      }

      settlement.factionIndex = bestFi;
      // Add to faction's settlement indices (cast away readonly for mutation during init)
      (factions[bestFi]!.settlementIndices as number[]).push(si);
    }
  }

  private findRace(raceName: string, races: readonly Race[]): Race {
    const found = races.find(r => r.name === raceName);
    if (found !== undefined) return found;
    // Fallback to first race
    return races[0]!;
  }

  private pickGovernment(
    race: Race,
    config: WorldConfig,
    rng: SeededRNG
  ): GovernmentType {
    // Build weighted probabilities from cultural tendencies
    const weights: Record<GovernmentType, number> = { ...BASE_GOV_WEIGHTS };

    for (const tendency of race.culturalTendencies) {
      const bonuses = TENDENCY_GOV_WEIGHTS[tendency];
      if (bonuses !== undefined) {
        for (const [gov, bonus] of Object.entries(bonuses)) {
          weights[gov as GovernmentType] += bonus;
        }
      }
    }

    // Suppress magocracy in low/no magic worlds
    if (config.magicPrevalence === 'mundane' || config.magicPrevalence === 'low') {
      weights.magocracy = 0;
    }

    // Suppress theocracy in atheistic worlds
    if (config.pantheonComplexity === 'atheistic') {
      weights.theocracy = 0;
    }

    const govTypes = [...ALL_GOV_TYPES];
    const govWeights = govTypes.map(g => weights[g]);
    return rng.weightedPick(govTypes, govWeights);
  }

  private pickReligion(preHistory: PreHistoryResult, rng: SeededRNG): string {
    if (preHistory.religiousHistory.length > 0) {
      const event = rng.pick(preHistory.religiousHistory);
      return event.description.slice(0, 60);
    }
    return 'Ancestral traditions';
  }

  private adjustTechEra(
    baseTech: TechnologyEra,
    race: Race,
    rng: SeededRNG
  ): TechnologyEra {
    const eras: readonly TechnologyEra[] = ['stone_age', 'bronze_age', 'iron_age', 'renaissance'];
    let idx = eras.indexOf(baseTech);
    idx += race.startingTechModifier;

    // Small random variation
    if (rng.next() < 0.2) idx += rng.nextInt(-1, 1);

    idx = Math.max(0, Math.min(eras.length - 1, idx));
    return eras[idx]!;
  }
}
