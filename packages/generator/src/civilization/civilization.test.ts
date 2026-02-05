import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng.js';
import { RaceGenerator } from './races.js';
import { InitialPopulationPlacer } from './population.js';
import { PantheonGenerator } from '../cosmology/pantheon.js';
import { WorldMap } from '../terrain/world-map.js';
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
    historicalDepth: 'moderate',
    geologicalActivity: 'normal',
    raceDiversity: 'standard',
    pantheonComplexity: 'theistic',
    technologyEra: 'iron_age',
    ...overrides,
  };
}

describe('RaceGenerator', () => {
  const raceGen = new RaceGenerator();
  const pantheonGen = new PantheonGenerator();

  it('homogeneous diversity produces 1-2 races', () => {
    const config = makeConfig({ raceDiversity: 'homogeneous' });
    const rng = new SeededRNG(42);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    expect(races.length).toBeGreaterThanOrEqual(1);
    expect(races.length).toBeLessThanOrEqual(2);
  });

  it('standard diversity produces 3-5 races', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng = new SeededRNG(123);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    expect(races.length).toBeGreaterThanOrEqual(3);
    expect(races.length).toBeLessThanOrEqual(5);
  });

  it('diverse produces 6-10 races', () => {
    const config = makeConfig({ raceDiversity: 'diverse' });
    const rng = new SeededRNG(456);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    expect(races.length).toBeGreaterThanOrEqual(6);
    expect(races.length).toBeLessThanOrEqual(10);
  });

  it('myriad produces 11+ races', () => {
    const config = makeConfig({ raceDiversity: 'myriad' });
    const rng = new SeededRNG(789);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    expect(races.length).toBeGreaterThanOrEqual(11);
    expect(races.length).toBeLessThanOrEqual(15);
  });

  it('first race is human-like (baseline lifespan 60-90)', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng = new SeededRNG(100);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    const first = races[0]!;
    // Baseline tier lifespan is 60-90 with ±5/10 variation
    expect(first.lifespan.min).toBeGreaterThanOrEqual(50);
    expect(first.lifespan.min).toBeLessThanOrEqual(100);
    expect(first.lifespan.max).toBeGreaterThanOrEqual(50);
    expect(first.lifespan.max).toBeLessThanOrEqual(100);
  });

  it('races have unique names', () => {
    const config = makeConfig({ raceDiversity: 'diverse' });
    const rng = new SeededRNG(200);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    const names = races.map(r => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('races have valid physical traits', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng = new SeededRNG(300);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    for (const race of races) {
      expect(race.physicalTraits.length).toBeGreaterThanOrEqual(3);
      for (const trait of race.physicalTraits) {
        expect(trait.length).toBeGreaterThan(0);
      }
    }
  });

  it('races have cultural tendencies', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng = new SeededRNG(400);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    for (const race of races) {
      expect(race.culturalTendencies.length).toBeGreaterThanOrEqual(2);
      expect(race.culturalTendencies.length).toBeLessThanOrEqual(3);
    }
  });

  it('races have innate abilities', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng = new SeededRNG(500);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    for (const race of races) {
      expect(race.innateAbilities.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('races have biome preferences', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng = new SeededRNG(600);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    for (const race of races) {
      expect(race.biomePreference.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('races have creation myths', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng = new SeededRNG(700);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    for (const race of races) {
      expect(race.creationMyth.length).toBeGreaterThan(20);
    }
  });

  it('creation myths reference pantheon deities', () => {
    const config = makeConfig({ raceDiversity: 'standard', pantheonComplexity: 'theistic' });
    const rng = new SeededRNG(800);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    const deityNames = pantheon.gods.map(g => g.name);
    // At least some myths should reference a deity
    const mythsWithDeity = races.filter(r =>
      deityNames.some(d => r.creationMyth.includes(d))
    );
    expect(mythsWithDeity.length).toBeGreaterThan(0);
  });

  it('atheistic pantheon produces myths with abstract forces', () => {
    const config = makeConfig({ raceDiversity: 'standard', pantheonComplexity: 'atheistic' });
    const rng = new SeededRNG(900);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    for (const race of races) {
      expect(race.creationMyth.length).toBeGreaterThan(20);
    }
  });

  it('races have valid naming conventions', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng = new SeededRNG(1000);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    const validCultures = ['nordic', 'elvish', 'dwarven', 'desert', 'eastern', 'fey', 'infernal'];
    for (const race of races) {
      expect(validCultures).toContain(race.namingConvention);
    }
  });

  it('starting tech modifier is within bounds', () => {
    const config = makeConfig({ raceDiversity: 'diverse' });
    const rng = new SeededRNG(1100);
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    for (const race of races) {
      expect(race.startingTechModifier).toBeGreaterThanOrEqual(-2);
      expect(race.startingTechModifier).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic with same seed', () => {
    const config = makeConfig({ raceDiversity: 'standard' });
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const pantheon1 = pantheonGen.generate(config.pantheonComplexity, rng1);
    const pantheon2 = pantheonGen.generate(config.pantheonComplexity, rng2);
    const races1 = raceGen.generate(config, pantheon1, rng1);
    const races2 = raceGen.generate(config, pantheon2, rng2);
    expect(races1.map(r => r.name)).toEqual(races2.map(r => r.name));
  });
});

describe('InitialPopulationPlacer', () => {
  const placer = new InitialPopulationPlacer();
  const raceGen = new RaceGenerator();
  const pantheonGen = new PantheonGenerator();

  /**
   * Helper: generate a small world and races.
   */
  function makeWorld(seed: number) {
    const config = makeConfig({ worldSize: 'small', raceDiversity: 'standard', seed });
    const rng = new SeededRNG(seed);
    const worldMap = new WorldMap(config, rng);
    worldMap.generate();
    const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
    const races = raceGen.generate(config, pantheon, rng);
    return { worldMap, races, rng, config };
  }

  it('produces population seeds for each race', () => {
    const { worldMap, races, rng } = makeWorld(42);
    const seeds = placer.place(worldMap, races, rng);
    // Each race should have at least one seed
    const racesWithSeeds = new Set(seeds.map(s => s.race.name));
    for (const race of races) {
      expect(racesWithSeeds.has(race.name)).toBe(true);
    }
  });

  it('population seeds have positive counts', () => {
    const { worldMap, races, rng } = makeWorld(123);
    const seeds = placer.place(worldMap, races, rng);
    for (const seed of seeds) {
      expect(seed.initialCount).toBeGreaterThan(0);
    }
  });

  it('population seeds are on valid map positions', () => {
    const { worldMap, races, rng } = makeWorld(456);
    const seeds = placer.place(worldMap, races, rng);
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    for (const seed of seeds) {
      expect(seed.x).toBeGreaterThanOrEqual(0);
      expect(seed.x).toBeLessThan(width);
      expect(seed.y).toBeGreaterThanOrEqual(0);
      expect(seed.y).toBeLessThan(height);
    }
  });

  it('short-lived races get larger starting populations', () => {
    const { worldMap, races, rng } = makeWorld(789);
    const seeds = placer.place(worldMap, races, rng);

    // Group by lifespan
    for (const seed of seeds) {
      if (seed.race.lifespan.max <= 50) {
        expect(seed.initialCount).toBeGreaterThanOrEqual(100);
      }
    }
  });

  it('is deterministic with same seed', () => {
    const w1 = makeWorld(42);
    const w2 = makeWorld(42);
    const seeds1 = placer.place(w1.worldMap, w1.races, w1.rng);
    const seeds2 = placer.place(w2.worldMap, w2.races, w2.rng);
    expect(seeds1.length).toBe(seeds2.length);
    for (let i = 0; i < seeds1.length; i++) {
      expect(seeds1[i]!.x).toBe(seeds2[i]!.x);
      expect(seeds1[i]!.y).toBe(seeds2[i]!.y);
    }
  });
});
