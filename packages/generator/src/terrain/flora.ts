/**
 * Flora distribution based on biome classification.
 * Places vegetation types with density, growth rate, and resource yield.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldMap } from './world-map.js';
import { BiomeType } from './terrain-tile.js';

/**
 * Species of flora that can be placed.
 */
export enum FloraSpecies {
  OakTree = 'OakTree',
  ElmTree = 'ElmTree',
  MapleTree = 'MapleTree',
  PineTree = 'PineTree',
  SpruceTree = 'SpruceTree',
  BirchTree = 'BirchTree',
  WillowTree = 'WillowTree',
  JungleTree = 'JungleTree',
  Bamboo = 'Bamboo',
  PalmTree = 'PalmTree',
  Cactus = 'Cactus',
  TallGrass = 'TallGrass',
  SavannaGrass = 'SavannaGrass',
  Fern = 'Fern',
  Moss = 'Moss',
  Shrub = 'Shrub',
  Seaweed = 'Seaweed',
  Lichen = 'Lichen',
  ArcticMoss = 'ArcticMoss',
  SwampReed = 'SwampReed',
  MagicMushroom = 'MagicMushroom',
}

/**
 * Flora data for a single tile.
 */
export interface FloraEntry {
  /** Primary species on this tile */
  readonly species: FloraSpecies;
  /** Vegetation density 0-1 (0 = bare, 1 = fully covered) */
  readonly density: number;
  /** Growth rate multiplier (higher = faster regeneration) */
  readonly growthRate: number;
  /** Timber/food resource yield multiplier */
  readonly resourceYield: number;
}

/**
 * Flora map: floraMap[y][x] = flora entry or undefined (barren).
 */
export type FloraMap = readonly (readonly (FloraEntry | undefined)[])[];

/**
 * Biome → candidate flora species with weights.
 */
const BIOME_FLORA: Partial<Record<BiomeType, ReadonlyArray<{ species: FloraSpecies; weight: number }>>> = {
  [BiomeType.Forest]: [
    { species: FloraSpecies.OakTree, weight: 30 },
    { species: FloraSpecies.ElmTree, weight: 20 },
    { species: FloraSpecies.MapleTree, weight: 20 },
    { species: FloraSpecies.BirchTree, weight: 15 },
    { species: FloraSpecies.Shrub, weight: 15 },
  ],
  [BiomeType.DenseForest]: [
    { species: FloraSpecies.OakTree, weight: 25 },
    { species: FloraSpecies.ElmTree, weight: 20 },
    { species: FloraSpecies.Fern, weight: 25 },
    { species: FloraSpecies.Moss, weight: 15 },
    { species: FloraSpecies.MapleTree, weight: 15 },
  ],
  [BiomeType.Taiga]: [
    { species: FloraSpecies.PineTree, weight: 40 },
    { species: FloraSpecies.SpruceTree, weight: 35 },
    { species: FloraSpecies.Lichen, weight: 15 },
    { species: FloraSpecies.Moss, weight: 10 },
  ],
  [BiomeType.Jungle]: [
    { species: FloraSpecies.JungleTree, weight: 35 },
    { species: FloraSpecies.Bamboo, weight: 20 },
    { species: FloraSpecies.Fern, weight: 20 },
    { species: FloraSpecies.PalmTree, weight: 15 },
    { species: FloraSpecies.MagicMushroom, weight: 10 },
  ],
  [BiomeType.Plains]: [
    { species: FloraSpecies.TallGrass, weight: 50 },
    { species: FloraSpecies.Shrub, weight: 30 },
    { species: FloraSpecies.OakTree, weight: 20 },
  ],
  [BiomeType.Savanna]: [
    { species: FloraSpecies.SavannaGrass, weight: 50 },
    { species: FloraSpecies.Shrub, weight: 30 },
    { species: FloraSpecies.PalmTree, weight: 20 },
  ],
  [BiomeType.Desert]: [
    { species: FloraSpecies.Cactus, weight: 70 },
    { species: FloraSpecies.Shrub, weight: 30 },
  ],
  [BiomeType.Swamp]: [
    { species: FloraSpecies.WillowTree, weight: 30 },
    { species: FloraSpecies.SwampReed, weight: 35 },
    { species: FloraSpecies.Moss, weight: 20 },
    { species: FloraSpecies.MagicMushroom, weight: 15 },
  ],
  [BiomeType.Tundra]: [
    { species: FloraSpecies.Lichen, weight: 50 },
    { species: FloraSpecies.ArcticMoss, weight: 40 },
    { species: FloraSpecies.Shrub, weight: 10 },
  ],
  [BiomeType.Coast]: [
    { species: FloraSpecies.TallGrass, weight: 40 },
    { species: FloraSpecies.PalmTree, weight: 30 },
    { species: FloraSpecies.Seaweed, weight: 30 },
  ],
  [BiomeType.Mountain]: [
    { species: FloraSpecies.PineTree, weight: 40 },
    { species: FloraSpecies.Lichen, weight: 35 },
    { species: FloraSpecies.Shrub, weight: 25 },
  ],
  [BiomeType.MagicWasteland]: [
    { species: FloraSpecies.MagicMushroom, weight: 70 },
    { species: FloraSpecies.Moss, weight: 30 },
  ],
};

/**
 * Base density per biome (before randomization).
 */
const BIOME_DENSITY: Partial<Record<BiomeType, number>> = {
  [BiomeType.DenseForest]: 0.9,
  [BiomeType.Jungle]: 0.95,
  [BiomeType.Forest]: 0.7,
  [BiomeType.Taiga]: 0.6,
  [BiomeType.Swamp]: 0.65,
  [BiomeType.Plains]: 0.5,
  [BiomeType.Savanna]: 0.35,
  [BiomeType.Coast]: 0.3,
  [BiomeType.Mountain]: 0.2,
  [BiomeType.Desert]: 0.05,
  [BiomeType.Tundra]: 0.1,
  [BiomeType.MagicWasteland]: 0.15,
};

export class FloraDistributor {
  /**
   * Distribute flora across the world map based on biome types.
   */
  distribute(worldMap: WorldMap, rng: SeededRNG): FloraMap {
    const floraRng = rng.fork('flora');
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();

    const result: (FloraEntry | undefined)[][] = [];

    for (let y = 0; y < height; y++) {
      const row: (FloraEntry | undefined)[] = [];
      for (let x = 0; x < width; x++) {
        const tile = worldMap.getTile(x, y);
        if (tile === undefined) {
          row.push(undefined);
          continue;
        }

        row.push(this.placeFlora(tile.biome, floraRng));
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Place flora for a single tile based on its biome.
   */
  private placeFlora(biome: BiomeType, rng: SeededRNG): FloraEntry | undefined {
    // Water biomes have no land flora
    if (biome === BiomeType.DeepOcean || biome === BiomeType.Ocean) {
      return undefined;
    }
    // High mountains and ice caps are barren
    if (biome === BiomeType.HighMountain || biome === BiomeType.IceCap) {
      return undefined;
    }
    // Volcanoes have no flora
    if (biome === BiomeType.Volcano) {
      return undefined;
    }

    const candidates = BIOME_FLORA[biome];
    if (candidates === undefined || candidates.length === 0) {
      return undefined;
    }

    const baseDensity = BIOME_DENSITY[biome] ?? 0.3;

    // Some tiles are barren even in fertile biomes
    if (rng.next() > baseDensity + 0.2) {
      return undefined;
    }

    // Weighted pick of species
    const items = candidates.map(c => c.species);
    const weights = candidates.map(c => c.weight);
    const species = rng.weightedPick(items, weights);

    // Randomize density around base
    const density = Math.max(0.01, Math.min(1, baseDensity + rng.nextFloat(-0.15, 0.15)));

    // Growth rate based on biome productivity
    const growthRate = this.computeGrowthRate(biome, density);

    // Resource yield scales with density
    const resourceYield = density * growthRate;

    return { species, density, growthRate, resourceYield };
  }

  /**
   * Compute growth rate based on biome type and density.
   */
  private computeGrowthRate(biome: BiomeType, density: number): number {
    let base: number;
    switch (biome) {
      case BiomeType.Jungle:
      case BiomeType.DenseForest:
        base = 1.5;
        break;
      case BiomeType.Forest:
      case BiomeType.Swamp:
        base = 1.2;
        break;
      case BiomeType.Plains:
      case BiomeType.Savanna:
      case BiomeType.Coast:
        base = 1.0;
        break;
      case BiomeType.Taiga:
      case BiomeType.Mountain:
        base = 0.6;
        break;
      case BiomeType.Desert:
      case BiomeType.Tundra:
        base = 0.2;
        break;
      default:
        base = 0.5;
    }

    // Higher density slightly reduces growth rate (competition)
    return base * (1 - density * 0.2);
  }
}
