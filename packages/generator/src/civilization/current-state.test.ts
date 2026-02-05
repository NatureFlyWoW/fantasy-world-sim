import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng.js';
import { RaceGenerator } from './races.js';
import { InitialPopulationPlacer } from './population.js';
import { SettlementPlacer } from './settlement-placer.js';
import { FactionInitializer } from './faction-initializer.js';
import { CharacterGenerator } from './character-generator.js';
import { TensionSeeder } from './tension-seeder.js';
import { PantheonGenerator } from '../cosmology/pantheon.js';
import { MagicSystemGenerator } from '../cosmology/magic-system.js';
import { WorldMap } from '../terrain/world-map.js';
import { NameGenerator } from '../character/name-generator.js';
import { getAllCultures } from '../character/name-culture.js';
import { PreHistorySimulator } from '../history/pre-history.js';
import type { WorldConfig } from '../config/types.js';

/**
 * Helper: create a minimal world config.
 */
function makeConfig(overrides: Partial<WorldConfig> = {}): WorldConfig {
  return {
    seed: 12345,
    worldSize: 'small',
    magicPrevalence: 'moderate',
    civilizationDensity: 'normal',
    dangerLevel: 'moderate',
    historicalDepth: 'shallow',
    geologicalActivity: 'normal',
    raceDiversity: 'standard',
    pantheonComplexity: 'theistic',
    technologyEra: 'iron_age',
    ...overrides,
  };
}

/**
 * Helper: run the full generation pipeline up to current state.
 */
function generateWorld(seed: number, overrides: Partial<WorldConfig> = {}) {
  const config = makeConfig({ seed, ...overrides });
  const rng = new SeededRNG(seed);

  // Terrain
  const worldMap = new WorldMap(config, rng);
  worldMap.generate();

  // Cosmology
  const pantheonGen = new PantheonGenerator();
  const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
  const magicGen = new MagicSystemGenerator();
  const magicRules = magicGen.generate(config.magicPrevalence, rng);

  // Races & population
  const raceGen = new RaceGenerator();
  const races = raceGen.generate(config, pantheon, rng);
  const popPlacer = new InitialPopulationPlacer();
  const populationSeeds = popPlacer.place(worldMap, races, rng);

  // Pre-history
  const preSim = new PreHistorySimulator(
    { worldMap, races, populationSeeds, pantheon, magicRules },
    config,
    rng
  );
  const preHistory = preSim.run();

  // Name generator
  const nameGen = new NameGenerator(getAllCultures());

  // Race dominance map — simplified: associate grid regions with first race
  const raceDominance = new Map<string, string>();
  for (const pop of populationSeeds) {
    const key = `${Math.floor(pop.x / 50)},${Math.floor(pop.y / 50)}`;
    if (!raceDominance.has(key)) {
      raceDominance.set(key, pop.race.name);
    }
  }

  return { config, rng, worldMap, pantheon, magicRules, races, populationSeeds, preHistory, nameGen, raceDominance };
}

describe('SettlementPlacer', () => {
  const placer = new SettlementPlacer();

  it('places settlements on a generated world', () => {
    const { worldMap, preHistory, raceDominance, nameGen, config, rng } = generateWorld(42);
    const settlements = placer.place(worldMap, preHistory, raceDominance, nameGen, config, rng);
    expect(settlements.length).toBeGreaterThan(0);
  });

  it('settlements have valid types', () => {
    const { worldMap, preHistory, raceDominance, nameGen, config, rng } = generateWorld(100);
    const settlements = placer.place(worldMap, preHistory, raceDominance, nameGen, config, rng);
    const validTypes = ['city', 'town', 'village'];
    for (const s of settlements) {
      expect(validTypes).toContain(s.type);
    }
  });

  it('settlements have positive population', () => {
    const { worldMap, preHistory, raceDominance, nameGen, config, rng } = generateWorld(200);
    const settlements = placer.place(worldMap, preHistory, raceDominance, nameGen, config, rng);
    for (const s of settlements) {
      expect(s.population).toBeGreaterThan(0);
    }
  });

  it('settlements have names', () => {
    const { worldMap, preHistory, raceDominance, nameGen, config, rng } = generateWorld(300);
    const settlements = placer.place(worldMap, preHistory, raceDominance, nameGen, config, rng);
    for (const s of settlements) {
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it('settlements have at least one structure', () => {
    const { worldMap, preHistory, raceDominance, nameGen, config, rng } = generateWorld(400);
    const settlements = placer.place(worldMap, preHistory, raceDominance, nameGen, config, rng);
    for (const s of settlements) {
      expect(s.structures.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('cities have more structures than villages', () => {
    const { worldMap, preHistory, raceDominance, nameGen, config, rng } = generateWorld(500);
    const settlements = placer.place(worldMap, preHistory, raceDominance, nameGen, config, rng);
    const cities = settlements.filter(s => s.type === 'city');
    const villages = settlements.filter(s => s.type === 'village');
    if (cities.length > 0 && villages.length > 0) {
      const avgCityStructures = cities.reduce((a, c) => a + c.structures.length, 0) / cities.length;
      const avgVillageStructures = villages.reduce((a, v) => a + v.structures.length, 0) / villages.length;
      expect(avgCityStructures).toBeGreaterThan(avgVillageStructures);
    }
  });

  it('settlement positions are within map bounds', () => {
    const { worldMap, preHistory, raceDominance, nameGen, config, rng } = generateWorld(600);
    const settlements = placer.place(worldMap, preHistory, raceDominance, nameGen, config, rng);
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    for (const s of settlements) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(width);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(height);
    }
  });
});

describe('FactionInitializer', () => {
  const placer = new SettlementPlacer();
  const facInit = new FactionInitializer();

  function makeFactionWorld(seed: number) {
    const world = generateWorld(seed);
    const settlements = placer.place(
      world.worldMap, world.preHistory, world.raceDominance,
      world.nameGen, world.config, world.rng
    );
    return { ...world, settlements };
  }

  it('creates factions for settlements', () => {
    const { settlements, races, preHistory, nameGen, config, rng } = makeFactionWorld(42);
    const factions = facInit.initialize(settlements, races, preHistory, nameGen, config, rng);
    expect(factions.length).toBeGreaterThan(0);
  });

  it('factions have valid government types', () => {
    const { settlements, races, preHistory, nameGen, config, rng } = makeFactionWorld(100);
    const factions = facInit.initialize(settlements, races, preHistory, nameGen, config, rng);
    const validGovs = ['monarchy', 'republic', 'theocracy', 'tribal_confederation', 'oligarchy', 'magocracy'];
    for (const f of factions) {
      expect(validGovs).toContain(f.governmentType);
    }
  });

  it('every settlement belongs to a faction', () => {
    const { settlements, races, preHistory, nameGen, config, rng } = makeFactionWorld(200);
    const factions = facInit.initialize(settlements, races, preHistory, nameGen, config, rng);
    if (factions.length > 0) {
      for (const s of settlements) {
        expect(s.factionIndex).toBeDefined();
        expect(s.factionIndex).toBeGreaterThanOrEqual(0);
        expect(s.factionIndex).toBeLessThan(factions.length);
      }
    }
  });

  it('factions cover all territory (settlement indices consistent)', () => {
    const { settlements, races, preHistory, nameGen, config, rng } = makeFactionWorld(300);
    const factions = facInit.initialize(settlements, races, preHistory, nameGen, config, rng);
    if (factions.length > 0) {
      // Every settlement index should appear in exactly one faction
      const allIndices = new Set<number>();
      for (const f of factions) {
        for (const idx of f.settlementIndices) {
          expect(allIndices.has(idx)).toBe(false);
          allIndices.add(idx);
        }
      }
      expect(allIndices.size).toBe(settlements.length);
    }
  });

  it('factions have names', () => {
    const { settlements, races, preHistory, nameGen, config, rng } = makeFactionWorld(400);
    const factions = facInit.initialize(settlements, races, preHistory, nameGen, config, rng);
    for (const f of factions) {
      expect(f.name.length).toBeGreaterThan(0);
    }
  });

  it('factions have valid stat ranges', () => {
    const { settlements, races, preHistory, nameGen, config, rng } = makeFactionWorld(500);
    const factions = facInit.initialize(settlements, races, preHistory, nameGen, config, rng);
    for (const f of factions) {
      expect(f.militaryStrength).toBeGreaterThanOrEqual(0);
      expect(f.militaryStrength).toBeLessThanOrEqual(100);
      expect(f.economicWealth).toBeGreaterThanOrEqual(0);
      expect(f.economicWealth).toBeLessThanOrEqual(100);
      expect(f.culturalInfluence).toBeGreaterThanOrEqual(0);
      expect(f.culturalInfluence).toBeLessThanOrEqual(100);
    }
  });

  it('magocracy is suppressed in mundane worlds', () => {
    const { settlements, races, preHistory, nameGen, config, rng } = makeFactionWorld(600);
    const mundaneConfig = { ...config, magicPrevalence: 'mundane' as const };
    // Re-initialize with mundane config
    const factions = facInit.initialize(settlements, races, preHistory, nameGen, mundaneConfig, rng);
    for (const f of factions) {
      expect(f.governmentType).not.toBe('magocracy');
    }
  });
});

describe('CharacterGenerator', () => {
  const placer = new SettlementPlacer();
  const facInit = new FactionInitializer();

  function makeCharWorld(seed: number) {
    const world = generateWorld(seed);
    const settlements = placer.place(
      world.worldMap, world.preHistory, world.raceDominance,
      world.nameGen, world.config, world.rng
    );
    const factions = facInit.initialize(
      settlements, world.races, world.preHistory,
      world.nameGen, world.config, world.rng
    );
    return { ...world, settlements, factions };
  }

  it('generates rulers for each faction', () => {
    const { factions, settlements, nameGen, rng } = makeCharWorld(42);
    const charGen = new CharacterGenerator(nameGen);
    const rulers = charGen.generateRulers(factions, settlements, rng);
    expect(rulers.length).toBe(factions.length);
  });

  it('rulers have valid components', () => {
    const { factions, settlements, nameGen, rng } = makeCharWorld(100);
    const charGen = new CharacterGenerator(nameGen);
    const rulers = charGen.generateRulers(factions, settlements, rng);
    for (const ruler of rulers) {
      // Name
      expect(ruler.name.length).toBeGreaterThan(0);
      expect(ruler.fullName.first.length).toBeGreaterThan(0);
      expect(ruler.fullName.family.length).toBeGreaterThan(0);

      // Status
      expect(ruler.status.type).toBe('ruler');
      expect(ruler.status.title.length).toBeGreaterThan(0);

      // Attributes: 1-100
      expect(ruler.attributes.strength).toBeGreaterThanOrEqual(1);
      expect(ruler.attributes.strength).toBeLessThanOrEqual(100);
      expect(ruler.attributes.charisma).toBeGreaterThanOrEqual(1);
      expect(ruler.attributes.charisma).toBeLessThanOrEqual(100);

      // Personality: 18 traits, each -100 to +100
      expect(ruler.personality.traits.size).toBe(18);
      for (const [, value] of ruler.personality.traits) {
        expect(value).toBeGreaterThanOrEqual(-100);
        expect(value).toBeLessThanOrEqual(100);
      }

      // Skills
      expect(ruler.skills.skills.size).toBe(10);
      for (const [, value] of ruler.skills.skills) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }

      // Goals
      expect(ruler.goals.length).toBeGreaterThanOrEqual(1);

      // Beliefs
      expect(ruler.beliefs.length).toBeGreaterThanOrEqual(1);

      // Possessions
      expect(ruler.possessions.length).toBeGreaterThanOrEqual(1);

      // Health
      expect(ruler.health.current).toBeGreaterThan(0);
      expect(ruler.health.max).toBe(100);
    }
  });

  it('generates notable characters', () => {
    const { factions, settlements, nameGen, config, rng } = makeCharWorld(200);
    const charGen = new CharacterGenerator(nameGen);
    const notables = charGen.generateNotables(factions, settlements, config, rng);
    expect(notables.length).toBeGreaterThan(0);
    // At least 2 per faction
    expect(notables.length).toBeGreaterThanOrEqual(factions.length * 2);
  });

  it('characters have valid ages for their race', () => {
    const { factions, settlements, nameGen, config, rng } = makeCharWorld(300);
    const charGen = new CharacterGenerator(nameGen);
    const rulers = charGen.generateRulers(factions, settlements, rng);
    const notables = charGen.generateNotables(factions, settlements, config, rng);
    const all = [...rulers, ...notables];
    for (const c of all) {
      expect(c.age).toBeGreaterThanOrEqual(1);
    }
  });

  it('characters reference real factions', () => {
    const { factions, settlements, nameGen, config, rng } = makeCharWorld(400);
    const charGen = new CharacterGenerator(nameGen);
    const rulers = charGen.generateRulers(factions, settlements, rng);
    const notables = charGen.generateNotables(factions, settlements, config, rng);
    const factionNames = new Set(factions.map(f => f.name));
    for (const c of [...rulers, ...notables]) {
      expect(factionNames.has(c.factionName)).toBe(true);
    }
  });
});

describe('TensionSeeder', () => {
  const placer = new SettlementPlacer();
  const facInit = new FactionInitializer();
  const tensionSeeder = new TensionSeeder();

  function makeTensionWorld(seed: number) {
    const world = generateWorld(seed);
    const settlements = placer.place(
      world.worldMap, world.preHistory, world.raceDominance,
      world.nameGen, world.config, world.rng
    );
    const factions = facInit.initialize(
      settlements, world.races, world.preHistory,
      world.nameGen, world.config, world.rng
    );
    return { ...world, settlements, factions };
  }

  it('seeds tensions between factions', () => {
    const { factions, settlements, preHistory, rng } = makeTensionWorld(42);
    const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);
    // Should produce at least some tensions when there are multiple factions
    if (factions.length >= 2) {
      expect(tensions.length).toBeGreaterThan(0);
    }
  });

  it('tensions have valid types', () => {
    const { factions, settlements, preHistory, rng } = makeTensionWorld(100);
    const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);
    const validTypes = ['border_dispute', 'succession_crisis', 'religious_tension', 'trade_rivalry', 'historical_grudge'];
    for (const t of tensions) {
      expect(validTypes).toContain(t.type);
    }
  });

  it('tensions have valid severity levels', () => {
    const { factions, settlements, preHistory, rng } = makeTensionWorld(200);
    const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);
    const validSeverities = ['minor', 'moderate', 'major', 'critical'];
    for (const t of tensions) {
      expect(validSeverities).toContain(t.severity);
    }
  });

  it('tensions reference valid faction indices', () => {
    const { factions, settlements, preHistory, rng } = makeTensionWorld(300);
    const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);
    for (const t of tensions) {
      expect(t.factionAIndex).toBeGreaterThanOrEqual(0);
      expect(t.factionAIndex).toBeLessThan(factions.length);
      if (t.factionBIndex !== undefined) {
        expect(t.factionBIndex).toBeGreaterThanOrEqual(0);
        expect(t.factionBIndex).toBeLessThan(factions.length);
      }
    }
  });

  it('tensions have descriptions', () => {
    const { factions, settlements, preHistory, rng } = makeTensionWorld(400);
    const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);
    for (const t of tensions) {
      expect(t.description.length).toBeGreaterThan(10);
    }
  });

  it('escalation risk is within bounds', () => {
    const { factions, settlements, preHistory, rng } = makeTensionWorld(500);
    const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);
    for (const t of tensions) {
      expect(t.escalationRisk).toBeGreaterThanOrEqual(0);
      expect(t.escalationRisk).toBeLessThanOrEqual(100);
    }
  });

  it('succession crises are internal (no factionB)', () => {
    const { factions, settlements, preHistory, rng } = makeTensionWorld(600);
    const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);
    const successionCrises = tensions.filter(t => t.type === 'succession_crisis');
    for (const t of successionCrises) {
      expect(t.factionBIndex).toBeUndefined();
    }
  });
});
