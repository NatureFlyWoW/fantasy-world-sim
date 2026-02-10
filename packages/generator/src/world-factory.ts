/**
 * @fws/generator — World Factory
 *
 * Centralized world generation pipeline. Runs the 15-step generation process:
 * 1. Terrain (WorldMap)
 * 2. Cosmology (Pantheon + Magic Rules)
 * 3. Races
 * 4. Population placement
 * 5. Pre-history simulation
 * 6. Name generator
 * 7. Race dominance map
 * 8. Settlements
 * 9. Factions
 * 10. Characters (Rulers + Notables)
 * 11. Tensions
 *
 * Used by both CLI and Electron to eliminate ~135 lines of duplication.
 */

import { SeededRNG } from './rng.js';
import { WorldMap } from './terrain/index.js';
import { PantheonGenerator } from './cosmology/index.js';
import { MagicSystemGenerator } from './cosmology/index.js';
import { RaceGenerator } from './civilization/index.js';
import { InitialPopulationPlacer } from './civilization/index.js';
import { SettlementPlacer } from './civilization/index.js';
import { FactionInitializer } from './civilization/index.js';
import { CharacterGenerator } from './civilization/index.js';
import { TensionSeeder } from './civilization/index.js';
import { NameGenerator } from './character/index.js';
import { getAllCultures } from './character/index.js';
import { PreHistorySimulator } from './history/index.js';
import type { WorldConfig } from './config/index.js';
import type { Pantheon } from './cosmology/index.js';
import type { MagicRules } from './cosmology/index.js';
import type { Race } from './civilization/index.js';
import type { PopulationSeed } from './civilization/index.js';
import type { PreHistoryResult } from './history/index.js';
import type { Settlement } from './civilization/index.js';
import type { Faction } from './civilization/index.js';
import type { GeneratedCharacter } from './civilization/index.js';
import type { InitialTension } from './civilization/index.js';

/**
 * Result of world generation pipeline.
 */
export interface GeneratedWorld {
  config: WorldConfig;
  rng: SeededRNG;
  worldMap: WorldMap;
  pantheon: Pantheon;
  magicRules: MagicRules;
  races: Race[];
  populationSeeds: PopulationSeed[];
  preHistory: PreHistoryResult;
  nameGen: NameGenerator;
  settlements: Settlement[];
  factions: Faction[];
  rulers: GeneratedCharacter[];
  notables: GeneratedCharacter[];
  tensions: InitialTension[];
}

/**
 * Create default WorldConfig with standard_fantasy preset.
 */
function makeDefaultConfig(seed: number): WorldConfig {
  return {
    seed,
    worldSize: 'small',
    magicPrevalence: 'moderate',
    civilizationDensity: 'normal',
    dangerLevel: 'moderate',
    historicalDepth: 'shallow',
    geologicalActivity: 'normal',
    raceDiversity: 'standard',
    pantheonComplexity: 'theistic',
    technologyEra: 'iron_age',
  };
}

/**
 * Run the complete world generation pipeline.
 *
 * @param seed - Seed for deterministic world generation
 * @param config - Optional world configuration. If not provided, uses standard_fantasy preset.
 * @returns Complete generated world data
 */
export function generateWorld(seed: number, config?: WorldConfig): GeneratedWorld {
  const finalConfig = config ?? makeDefaultConfig(seed);
  const rng = new SeededRNG(seed);

  // Step 1: Terrain
  const worldMap = new WorldMap(finalConfig, rng);
  worldMap.generate();

  // Step 2: Cosmology
  const pantheonGen = new PantheonGenerator();
  const pantheon = pantheonGen.generate(finalConfig.pantheonComplexity, rng);
  const magicGen = new MagicSystemGenerator();
  const magicRules = magicGen.generate(finalConfig.magicPrevalence, rng);

  // Step 3-4: Races & population placement
  const raceGen = new RaceGenerator();
  const races = raceGen.generate(finalConfig, pantheon, rng);
  const popPlacer = new InitialPopulationPlacer();
  const populationSeeds = popPlacer.place(worldMap, races, rng);

  // Step 5: Pre-history
  const preSim = new PreHistorySimulator(
    { worldMap, races, populationSeeds, pantheon, magicRules },
    finalConfig,
    rng
  );
  const preHistory = preSim.run();

  // Step 6: Name generator
  const nameGen = new NameGenerator(getAllCultures());

  // Step 7: Race dominance map (for settlement placement)
  const raceDominance = new Map<string, string>();
  for (const pop of populationSeeds) {
    const key = `${Math.floor(pop.x / 50)},${Math.floor(pop.y / 50)}`;
    if (!raceDominance.has(key)) {
      raceDominance.set(key, pop.race.name);
    }
  }

  // Step 8: Settlements
  const settlementPlacer = new SettlementPlacer();
  const settlements = settlementPlacer.place(
    worldMap,
    preHistory,
    raceDominance,
    nameGen,
    finalConfig,
    rng
  );

  // Step 9: Factions
  const factionInit = new FactionInitializer();
  const factions = factionInit.initialize(
    settlements,
    races,
    preHistory,
    nameGen,
    finalConfig,
    rng
  );

  // Step 10: Characters
  const charGen = new CharacterGenerator(nameGen);
  const rulers = charGen.generateRulers(factions, settlements, rng);
  const notables = charGen.generateNotables(factions, settlements, finalConfig, rng);

  // Step 11: Tensions
  const tensionSeeder = new TensionSeeder();
  const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);

  return {
    config: finalConfig,
    rng,
    worldMap,
    pantheon,
    magicRules,
    races,
    populationSeeds,
    preHistory,
    nameGen,
    settlements,
    factions,
    rulers,
    notables,
    tensions,
  };
}
