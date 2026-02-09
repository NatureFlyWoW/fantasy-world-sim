import { describe, it, expect } from 'vitest';
import { WorldMap } from './world-map.js';
import { FloraDistributor } from './flora.js';
import { FloraSpecies } from './flora.js';
import { FaunaDistributor } from './fauna.js';
import { MagicalCreaturePlacer, MagicalCreatureType } from './magical-creatures.js';
import { DungeonPlacer, DungeonType } from './dungeons.js';
import { EcologicalBaseline } from './ecological-baseline.js';
import { BiomeType } from './terrain-tile.js';
import { SeededRNG } from '../rng.js';
import type { WorldConfig } from '../config/types.js';
import { configFromPreset } from '../config/presets.js';

function makeSmallConfig(seed: number, overrides?: Partial<WorldConfig>): WorldConfig {
  return {
    ...configFromPreset('standard_fantasy', seed),
    worldSize: 'small',
    ...overrides,
  };
}

function generateWorld(seed: number, overrides?: Partial<WorldConfig>) {
  const config = makeSmallConfig(seed, overrides);
  const rng = new SeededRNG(config.seed);
  const worldMap = new WorldMap(config, rng);
  worldMap.generate();
  return { config, rng, worldMap };
}

describe('FloraDistributor', () => {
  let rng: SeededRNG;
  let worldMap: WorldMap;
  let flora: (import('./flora.js').FloraEntry | undefined)[][];

  beforeAll(() => {
    const result = generateWorld(42);
    rng = result.rng;
    worldMap = result.worldMap;
    flora = new FloraDistributor().distribute(worldMap, rng);
  });

  it('should distribute flora across land tiles', () => {
    expect(flora.length).toBe(worldMap.getHeight());

    // Count non-undefined flora entries
    let floraCount = 0;
    for (let y = 0; y < worldMap.getHeight(); y++) {
      for (let x = 0; x < worldMap.getWidth(); x++) {
        if (flora[y]?.[x] !== undefined) {
          floraCount++;
        }
      }
    }

    expect(floraCount).toBeGreaterThan(0);
  });

  it('should not place flora on ocean tiles', () => {
    for (let y = 0; y < worldMap.getHeight(); y++) {
      for (let x = 0; x < worldMap.getWidth(); x++) {
        const tile = worldMap.getTile(x, y);
        if (tile !== undefined &&
            (tile.biome === BiomeType.DeepOcean || tile.biome === BiomeType.Ocean)) {
          expect(flora[y]?.[x]).toBeUndefined();
        }
      }
    }
  });

  it('should place forest species in forest biomes', () => {
    const forestSpecies = new Set<FloraSpecies>();
    for (let y = 0; y < worldMap.getHeight(); y++) {
      for (let x = 0; x < worldMap.getWidth(); x++) {
        const tile = worldMap.getTile(x, y);
        const entry = flora[y]?.[x];
        if (tile?.biome === BiomeType.Forest && entry !== undefined) {
          forestSpecies.add(entry.species);
        }
      }
    }

    // Forest biomes should have tree species
    const treeSpecies: FloraSpecies[] = [
      FloraSpecies.OakTree, FloraSpecies.ElmTree,
      FloraSpecies.MapleTree, FloraSpecies.BirchTree,
    ];
    const hasTree = treeSpecies.some(s => forestSpecies.has(s));
    expect(hasTree).toBe(true);
  });

  it('should have higher density in jungle/dense forest', () => {
    let jungleDensitySum = 0;
    let jungleCount = 0;
    let desertDensitySum = 0;
    let desertCount = 0;

    for (let y = 0; y < worldMap.getHeight(); y++) {
      for (let x = 0; x < worldMap.getWidth(); x++) {
        const tile = worldMap.getTile(x, y);
        const entry = flora[y]?.[x];
        if (entry !== undefined) {
          if (tile?.biome === BiomeType.Jungle || tile?.biome === BiomeType.DenseForest) {
            jungleDensitySum += entry.density;
            jungleCount++;
          } else if (tile?.biome === BiomeType.Desert) {
            desertDensitySum += entry.density;
            desertCount++;
          }
        }
      }
    }

    if (jungleCount > 0 && desertCount > 0) {
      const jungleAvg = jungleDensitySum / jungleCount;
      const desertAvg = desertDensitySum / desertCount;
      expect(jungleAvg).toBeGreaterThan(desertAvg);
    }
  });

  it('should be deterministic', () => {
    const { rng: rng1, worldMap: wm1 } = generateWorld(42);
    const { rng: rng2, worldMap: wm2 } = generateWorld(42);

    const flora1 = new FloraDistributor().distribute(wm1, rng1);
    const flora2 = new FloraDistributor().distribute(wm2, rng2);

    // Sample check
    for (let y = 0; y < 200; y += 20) {
      for (let x = 0; x < 200; x += 20) {
        const f1 = flora1[y]?.[x];
        const f2 = flora2[y]?.[x];
        if (f1 === undefined) {
          expect(f2).toBeUndefined();
        } else {
          expect(f2).toBeDefined();
          expect(f1.species).toBe(f2!.species);
          expect(f1.density).toBe(f2!.density);
        }
      }
    }
  });
});

describe('FaunaDistributor', () => {
  let rng: SeededRNG;
  let worldMap: WorldMap;
  let flora: (import('./flora.js').FloraEntry | undefined)[][];
  let fauna: import('./fauna.js').FaunaPopulation[];

  beforeAll(() => {
    const result = generateWorld(42);
    rng = result.rng;
    worldMap = result.worldMap;
    flora = new FloraDistributor().distribute(worldMap, rng);
    fauna = new FaunaDistributor().distribute(worldMap, flora, rng);
  });

  it('should distribute fauna populations', () => {
    expect(fauna.length).toBeGreaterThan(0);
  });

  it('should include both herbivores and predators', () => {
    const herbivores = fauna.filter(f => !f.isPredator);
    const predators = fauna.filter(f => f.isPredator);

    expect(herbivores.length).toBeGreaterThan(0);
    expect(predators.length).toBeGreaterThan(0);
  });

  it('should place fauna within map bounds', () => {
    for (const pop of fauna) {
      expect(pop.x).toBeGreaterThanOrEqual(0);
      expect(pop.x).toBeLessThan(worldMap.getWidth());
      expect(pop.y).toBeGreaterThanOrEqual(0);
      expect(pop.y).toBeLessThan(worldMap.getHeight());
      expect(pop.population).toBeGreaterThan(0);
      expect(pop.radius).toBeGreaterThan(0);
    }
  });

  it('should have varied species', () => {
    const species = new Set(fauna.map(f => f.species));
    expect(species.size).toBeGreaterThanOrEqual(3);
  });
});

describe('MagicalCreaturePlacer', () => {
  describe('moderate magic', () => {
    let config: WorldConfig;
    let rng: SeededRNG;
    let worldMap: WorldMap;

    beforeAll(() => {
      const result = generateWorld(42);
      config = result.config;
      rng = result.rng;
      worldMap = result.worldMap;
    });

    it('should place creatures for moderate magic', () => {
      const creatures = new MagicalCreaturePlacer().place(worldMap, config, rng);
      expect(creatures.length).toBeGreaterThan(0);
    });
  });

  describe('mundane magic', () => {
    let config: WorldConfig;
    let rng: SeededRNG;
    let worldMap: WorldMap;

    beforeAll(() => {
      const result = generateWorld(42, { magicPrevalence: 'mundane' });
      config = result.config;
      rng = result.rng;
      worldMap = result.worldMap;
    });

    it('should place zero creatures for mundane magic', () => {
      const creatures = new MagicalCreaturePlacer().place(worldMap, config, rng);
      expect(creatures.length).toBe(0);
    });
  });

  describe('high magic', () => {
    let config: WorldConfig;
    let rng: SeededRNG;
    let worldMap: WorldMap;
    let creatures: import('./magical-creatures.js').MagicalCreature[];

    beforeAll(() => {
      const result = generateWorld(42, { magicPrevalence: 'high' });
      config = result.config;
      rng = result.rng;
      worldMap = result.worldMap;
      creatures = new MagicalCreaturePlacer().place(worldMap, config, rng);
    });

    it('should place dragons in high mountains', () => {
      const dragons = creatures.filter(c => c.type === MagicalCreatureType.Dragon);
      for (const dragon of dragons) {
        const tile = worldMap.getTile(dragon.x, dragon.y);
        expect(tile).toBeDefined();
        expect(tile!.elevation).toBeGreaterThan(5000);
      }
    });

    it('should place fey in dense forests', () => {
      const fey = creatures.filter(c => c.type === MagicalCreatureType.Fey);
      for (const f of fey) {
        const tile = worldMap.getTile(f.x, f.y);
        expect(tile).toBeDefined();
        expect([BiomeType.DenseForest, BiomeType.Jungle]).toContain(tile!.biome);
      }
    });

    it('should place elementals on ley lines', () => {
      const elementals = creatures.filter(c => c.type === MagicalCreatureType.Elemental);
      for (const e of elementals) {
        const tile = worldMap.getTile(e.x, e.y);
        expect(tile).toBeDefined();
        expect(tile!.leyLine).toBe(true);
        expect(e.affinity).toBeDefined();
      }
    });
  });

  it('should scale creature count with magic prevalence', () => {
    const { config: lowConfig, rng: lowRng, worldMap: lowMap } = generateWorld(42, {
      magicPrevalence: 'low',
    });
    const { config: highConfig, rng: highRng, worldMap: highMap } = generateWorld(42, {
      magicPrevalence: 'high',
    });

    const lowCreatures = new MagicalCreaturePlacer().place(lowMap, lowConfig, lowRng);
    const highCreatures = new MagicalCreaturePlacer().place(highMap, highConfig, highRng);

    expect(highCreatures.length).toBeGreaterThan(lowCreatures.length);
  });
});

describe('DungeonPlacer', () => {
  describe('moderate danger', () => {
    let config: WorldConfig;
    let rng: SeededRNG;
    let worldMap: WorldMap;
    let dungeons: import('./dungeons.js').Dungeon[];

    beforeAll(() => {
      const result = generateWorld(42);
      config = result.config;
      rng = result.rng;
      worldMap = result.worldMap;
      dungeons = new DungeonPlacer().place(worldMap, config, rng);
    });

    it('should place dungeons', () => {
      expect(dungeons.length).toBeGreaterThan(0);
    });

    it('should place dungeons on valid terrain', () => {
      for (const dungeon of dungeons) {
        expect(dungeon.x).toBeGreaterThanOrEqual(0);
        expect(dungeon.x).toBeLessThan(worldMap.getWidth());
        expect(dungeon.y).toBeGreaterThanOrEqual(0);
        expect(dungeon.y).toBeLessThan(worldMap.getHeight());
        expect(dungeon.dangerRating).toBeGreaterThanOrEqual(1);
        expect(dungeon.dangerRating).toBeLessThanOrEqual(10);
        expect(dungeon.lootPotential).toBeGreaterThanOrEqual(1);
        expect(dungeon.lootPotential).toBeLessThanOrEqual(10);
        expect(dungeon.age).toBeGreaterThan(0);
      }
    });
  });

  describe('dangerous + ancient', () => {
    let config: WorldConfig;
    let rng: SeededRNG;
    let worldMap: WorldMap;
    let dungeons: import('./dungeons.js').Dungeon[];

    beforeAll(() => {
      const result = generateWorld(42, {
        dangerLevel: 'dangerous',
        historicalDepth: 'ancient',
      });
      config = result.config;
      rng = result.rng;
      worldMap = result.worldMap;
      dungeons = new DungeonPlacer().place(worldMap, config, rng);
    });

    it('should produce diverse dungeon types', () => {
      const types = new Set(dungeons.map(d => d.type));
      expect(types.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('apocalyptic + ancient', () => {
    let config: WorldConfig;
    let rng: SeededRNG;
    let worldMap: WorldMap;
    let dungeons: import('./dungeons.js').Dungeon[];

    beforeAll(() => {
      const result = generateWorld(42, {
        dangerLevel: 'apocalyptic',
        historicalDepth: 'ancient',
      });
      config = result.config;
      rng = result.rng;
      worldMap = result.worldMap;
      dungeons = new DungeonPlacer().place(worldMap, config, rng);
    });

    it('should place underwater ruins on coast/ocean', () => {
      const underwater = dungeons.filter(d => d.type === DungeonType.UnderwaterRuin);
      for (const d of underwater) {
        const tile = worldMap.getTile(d.x, d.y);
        expect(tile).toBeDefined();
        expect([BiomeType.Coast, BiomeType.Ocean]).toContain(tile!.biome);
      }
    });
  });

  it('should scale count with danger level', () => {
    const { config: peacefulConfig, rng: pRng, worldMap: pMap } = generateWorld(42, {
      dangerLevel: 'peaceful',
    });
    const { config: dangerConfig, rng: dRng, worldMap: dMap } = generateWorld(42, {
      dangerLevel: 'dangerous',
    });

    const peaceful = new DungeonPlacer().place(pMap, peacefulConfig, pRng);
    const dangerous = new DungeonPlacer().place(dMap, dangerConfig, dRng);

    expect(dangerous.length).toBeGreaterThan(peaceful.length);
  });

  it('should scale with historical depth', () => {
    const { config: shallowConfig, rng: sRng, worldMap: sMap } = generateWorld(42, {
      historicalDepth: 'shallow',
    });
    const { config: ancientConfig, rng: aRng, worldMap: aMap } = generateWorld(42, {
      historicalDepth: 'ancient',
    });

    const shallow = new DungeonPlacer().place(sMap, shallowConfig, sRng);
    const ancient = new DungeonPlacer().place(aMap, ancientConfig, aRng);

    expect(ancient.length).toBeGreaterThan(shallow.length);
  });
});

describe('EcologicalBaseline', () => {
  let rng: SeededRNG;
  let worldMap: WorldMap;
  let flora: (import('./flora.js').FloraEntry | undefined)[][];
  let fauna: import('./fauna.js').FaunaPopulation[];
  let baseline: import('./ecological-baseline.js').EcologicalSnapshot;

  beforeAll(() => {
    const result = generateWorld(42);
    rng = result.rng;
    worldMap = result.worldMap;
    flora = new FloraDistributor().distribute(worldMap, rng);
    fauna = new FaunaDistributor().distribute(worldMap, flora, rng);
    baseline = new EcologicalBaseline().snapshot(worldMap, flora, fauna);
  });

  it('should capture baseline with non-zero values', () => {
    expect(baseline.totalAnimalPopulation).toBeGreaterThan(0);
    expect(baseline.totalSpeciesCount).toBeGreaterThan(0);
    expect(baseline.totalForestCover).toBeGreaterThan(0);
    expect(baseline.totalForestCover).toBeLessThanOrEqual(1);
    expect(baseline.regions.length).toBeGreaterThan(0);
    expect(baseline.regionSize).toBeGreaterThan(0);
  });

  it('should have populated regions with non-zero fauna', () => {
    const regionsWithFauna = baseline.regions.filter(r => r.animalPopulation > 0);
    expect(regionsWithFauna.length).toBeGreaterThan(0);
  });

  it('should track forest cover per region', () => {
    // Some regions should have forest cover, some should not
    const withForest = baseline.regions.filter(r => r.forestCover > 0);
    const withoutForest = baseline.regions.filter(r => r.forestCover === 0);
    expect(withForest.length).toBeGreaterThan(0);
    expect(withoutForest.length).toBeGreaterThan(0);
  });

  it('should track resource nodes', () => {
    const totalResources = baseline.regions.reduce((sum, r) => sum + r.resourceNodeCount, 0);
    expect(totalResources).toBeGreaterThan(0);
  });

  it('should track magic level from ley lines', () => {
    const regionsWithMagic = baseline.regions.filter(r => r.magicLevel > 0);
    expect(regionsWithMagic.length).toBeGreaterThan(0);
  });

  it('should track flora density', () => {
    const regionsWithFlora = baseline.regions.filter(r => r.floraDensity > 0);
    expect(regionsWithFlora.length).toBeGreaterThan(0);
  });
});
