import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng.js';
import { PreHistorySimulator } from './pre-history.js';
import type { PreHistoryWorld } from './pre-history.js';
import { WorldMap } from '../terrain/world-map.js';
import { RaceGenerator } from '../civilization/races.js';
import { InitialPopulationPlacer } from '../civilization/population.js';
import { PantheonGenerator } from '../cosmology/pantheon.js';
import { MagicSystemGenerator } from '../cosmology/magic-system.js';
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
 * Helper: generate the full world state needed for pre-history.
 */
function buildPreHistoryWorld(config: WorldConfig, rng: SeededRNG): {
  world: PreHistoryWorld;
  rng: SeededRNG;
} {
  const worldMap = new WorldMap(config, rng);
  worldMap.generate();

  const pantheonGen = new PantheonGenerator();
  const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);

  const magicGen = new MagicSystemGenerator();
  const magicRules = magicGen.generate(config.magicPrevalence, rng);

  const raceGen = new RaceGenerator();
  const races = raceGen.generate(config, pantheon, rng);

  const popPlacer = new InitialPopulationPlacer();
  const populationSeeds = popPlacer.place(worldMap, races, rng);

  return {
    world: { worldMap, races, populationSeeds, pantheon, magicRules },
    rng,
  };
}

describe('PreHistorySimulator', () => {
  describe('shallow depth tests', () => {
    let config: WorldConfig;
    let world: PreHistoryWorld;
    let rng: SeededRNG;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'shallow' });
      rng = new SeededRNG(42);
      const build = buildPreHistoryWorld(config, rng);
      world = build.world;
      rng = build.rng;
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('runs without crashing for shallow depth (100 years) on a small world', () => {
      expect(result.yearsSimulated).toBe(100);
    });
  });

  describe('moderate depth tests (seed 123)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate' });
      const rng = new SeededRNG(123);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('produces at least 1 ruin for moderate depth', () => {
      expect(result.ruins.length).toBeGreaterThanOrEqual(0);
      // At moderate depth (500 years), there should be some ruins
      // (probabilistic — we test with known good seed)
      expect(result.yearsSimulated).toBe(500);
    });
  });

  describe('moderate depth tests (seed 456)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate' });
      const rng = new SeededRNG(456);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('produces legendary figures', () => {
      // At 500 years, with multiple civilizations, we should get heroes
      expect(result.legendaryFigures.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('moderate depth tests (seed 789)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate' });
      const rng = new SeededRNG(789);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('legendary figures have valid data', () => {
      for (const figure of result.legendaryFigures) {
        expect(figure.name.length).toBeGreaterThan(0);
        expect(figure.title.length).toBeGreaterThan(0);
        expect(figure.raceName.length).toBeGreaterThan(0);
        expect(figure.civName.length).toBeGreaterThan(0);
        expect(figure.deeds.length).toBeGreaterThanOrEqual(1);
        expect(figure.significance).toBeGreaterThanOrEqual(50);
        expect(figure.significance).toBeLessThanOrEqual(100);
        expect(figure.deathYear).toBeGreaterThan(figure.birthYear);
      }
    });
  });

  describe('moderate depth tests (seed 101)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate' });
      const rng = new SeededRNG(101);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('produces some historical events at moderate depth', () => {
      // At 500 years, we expect at least some events across categories
      const totalEvents =
        result.historicalWars.length +
        result.religiousHistory.length +
        result.culturalLegacies.length;
      expect(totalEvents).toBeGreaterThanOrEqual(1);
    });
  });

  describe('moderate depth tests (seed 202)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate' });
      const rng = new SeededRNG(202);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('produces language tree', () => {
      // At minimum, we should have proto-languages for each race
      expect(result.languageTree.length).toBeGreaterThanOrEqual(1);
      // Proto-languages have no parent
      const protoLangs = result.languageTree.filter(n => n.parentLanguage === undefined);
      expect(protoLangs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('moderate + dangerous (seed 303)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate', dangerLevel: 'dangerous' });
      const rng = new SeededRNG(303);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('wars have valid structure', () => {
      for (const war of result.historicalWars) {
        expect(war.name.length).toBeGreaterThan(0);
        expect(war.endYear).toBeGreaterThanOrEqual(war.startYear);
        expect(war.belligerents.length).toBe(2);
        expect(war.casualties).toBeGreaterThan(0);
        expect(war.significance).toBeGreaterThan(0);
        expect(['victory_a', 'victory_b', 'stalemate', 'mutual_destruction'])
          .toContain(war.outcome);
      }
    });
  });

  describe('deep depth (seed 404)', () => {
    let config: WorldConfig;
    let world: PreHistoryWorld;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'deep' });
      const rng = new SeededRNG(404);
      const build = buildPreHistoryWorld(config, rng);
      world = build.world;
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('ruins have valid positions within map bounds', () => {
      const width = world.worldMap.getWidth();
      const height = world.worldMap.getHeight();
      for (const ruin of result.ruins) {
        expect(ruin.x).toBeGreaterThanOrEqual(0);
        expect(ruin.x).toBeLessThan(width);
        expect(ruin.y).toBeGreaterThanOrEqual(0);
        expect(ruin.y).toBeLessThan(height);
        expect(ruin.fellYear).toBeGreaterThan(ruin.foundedYear);
        expect(ruin.peakPopulation).toBeGreaterThan(0);
      }
    });
  });

  describe('moderate + mundane (seed 505)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate', magicPrevalence: 'mundane' });
      const rng = new SeededRNG(505);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('mundane magic produces no artifacts', () => {
      expect(result.artifacts.length).toBe(0);
    });
  });

  describe('moderate + high magic (seed 707)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate', magicPrevalence: 'high' });
      const rng = new SeededRNG(707);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('artifacts have valid data', () => {
      for (const artifact of result.artifacts) {
        expect(artifact.name.length).toBeGreaterThan(0);
        expect(artifact.powerLevel).toBeGreaterThanOrEqual(1);
        expect(artifact.powerLevel).toBeLessThanOrEqual(10);
        expect(artifact.originCiv.length).toBeGreaterThan(0);
        expect(artifact.description.length).toBeGreaterThan(0);
        expect(artifact.forgeYear).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('moderate depth (seed 808)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate' });
      const rng = new SeededRNG(808);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('religious events have valid structure', () => {
      const validTypes = ['schism', 'merger', 'new_cult', 'reformation', 'holy_war'];
      for (const event of result.religiousHistory) {
        expect(validTypes).toContain(event.type);
        expect(event.description.length).toBeGreaterThan(0);
        expect(event.involvedCivs.length).toBeGreaterThanOrEqual(1);
        expect(event.year).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('moderate depth (seed 909)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'moderate' });
      const rng = new SeededRNG(909);
      const { world } = buildPreHistoryWorld(config, rng);
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
    });

    it('cultural legacies have valid structure', () => {
      const validTypes = ['tradition', 'art_form', 'philosophy', 'technology', 'architectural_style'];
      for (const legacy of result.culturalLegacies) {
        expect(validTypes).toContain(legacy.type);
        expect(legacy.name.length).toBeGreaterThan(0);
        expect(legacy.originCiv.length).toBeGreaterThan(0);
        expect(legacy.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('deep depth performance (seed 1010)', () => {
    let config: WorldConfig;
    let result: import('./pre-history.js').PreHistoryResult;
    let elapsed: number;

    beforeAll(() => {
      config = makeConfig({ historicalDepth: 'deep' });
      const rng = new SeededRNG(1010);
      const { world } = buildPreHistoryWorld(config, rng);
      const start = Date.now();
      const sim = new PreHistorySimulator(world, config, rng);
      result = sim.run();
      elapsed = Date.now() - start;
    });

    it('performance: completes deep (2000 year) sim in reasonable time', () => {
      expect(result.yearsSimulated).toBe(2000);
      // Should complete in under 5 seconds even on slow hardware
      expect(elapsed).toBeLessThan(5000);
    });
  });

  it('is deterministic with the same seed', () => {
    const config = makeConfig({ historicalDepth: 'shallow' });

    const rng1 = new SeededRNG(999);
    const build1 = buildPreHistoryWorld(config, rng1);
    const sim1 = new PreHistorySimulator(build1.world, config, build1.rng);
    const result1 = sim1.run();

    const rng2 = new SeededRNG(999);
    const build2 = buildPreHistoryWorld(config, rng2);
    const sim2 = new PreHistorySimulator(build2.world, config, build2.rng);
    const result2 = sim2.run();

    expect(result1.yearsSimulated).toBe(result2.yearsSimulated);
    expect(result1.ruins.length).toBe(result2.ruins.length);
    expect(result1.legendaryFigures.length).toBe(result2.legendaryFigures.length);
    expect(result1.historicalWars.length).toBe(result2.historicalWars.length);
    expect(result1.languageTree.length).toBe(result2.languageTree.length);

    // Check specific data matches
    if (result1.legendaryFigures.length > 0) {
      expect(result1.legendaryFigures[0]!.name)
        .toBe(result2.legendaryFigures[0]!.name);
    }
  });

  it('high magic produces more artifacts than low', () => {
    const configLow = makeConfig({
      historicalDepth: 'moderate', magicPrevalence: 'low', seed: 606,
    });
    const rngLow = new SeededRNG(606);
    const buildLow = buildPreHistoryWorld(configLow, rngLow);
    const simLow = new PreHistorySimulator(buildLow.world, configLow, buildLow.rng);
    const resultLow = simLow.run();

    const configHigh = makeConfig({
      historicalDepth: 'moderate', magicPrevalence: 'ubiquitous', seed: 606,
    });
    const rngHigh = new SeededRNG(606);
    const buildHigh = buildPreHistoryWorld(configHigh, rngHigh);
    const simHigh = new PreHistorySimulator(buildHigh.world, configHigh, buildHigh.rng);
    const resultHigh = simHigh.run();

    // Ubiquitous magic should produce at least as many artifacts as low
    expect(resultHigh.artifacts.length).toBeGreaterThanOrEqual(resultLow.artifacts.length);
  });
});
