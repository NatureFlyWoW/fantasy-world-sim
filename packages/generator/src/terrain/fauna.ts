/**
 * Fauna distribution based on flora availability and biome.
 * Herbivores follow food, predators follow herbivores.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldMap } from './world-map.js';
import type { FloraMap } from './flora.js';
import { BiomeType } from './terrain-tile.js';

/**
 * Fauna species category.
 */
export enum FaunaSpecies {
  // Herbivores
  Deer = 'Deer',
  Elk = 'Elk',
  Bison = 'Bison',
  Rabbit = 'Rabbit',
  Boar = 'Boar',
  MountainGoat = 'MountainGoat',
  Antelope = 'Antelope',
  Mammoth = 'Mammoth',
  // Predators
  Wolf = 'Wolf',
  Bear = 'Bear',
  Lion = 'Lion',
  Eagle = 'Eagle',
  GiantSpider = 'GiantSpider',
  Crocodile = 'Crocodile',
  PolarBear = 'PolarBear',
  // Aquatic
  Fish = 'Fish',
  Whale = 'Whale',
  Shark = 'Shark',
}

/**
 * Behavioral archetype for a fauna population.
 */
export type FaunaBehavior = 'migratory' | 'territorial' | 'pack' | 'solitary';

/**
 * A population of fauna occupying a territory.
 */
export interface FaunaPopulation {
  /** Species */
  readonly species: FaunaSpecies;
  /** Center of territory */
  readonly x: number;
  readonly y: number;
  /** Territory radius in tiles */
  readonly radius: number;
  /** Current population count */
  readonly population: number;
  /** Behavioral archetype */
  readonly behavior: FaunaBehavior;
  /** Threat level to travelers/settlers: 0 (harmless) to 10 (lethal) */
  readonly threatLevel: number;
  /** Whether this is a predator */
  readonly isPredator: boolean;
}

/**
 * Biome → candidate fauna with weights and properties.
 */
interface FaunaTemplate {
  readonly species: FaunaSpecies;
  readonly weight: number;
  readonly behavior: FaunaBehavior;
  readonly threatLevel: number;
  readonly isPredator: boolean;
  readonly basePop: number;
  readonly radius: number;
}

const BIOME_FAUNA: Partial<Record<BiomeType, readonly FaunaTemplate[]>> = {
  [BiomeType.Forest]: [
    { species: FaunaSpecies.Deer, weight: 30, behavior: 'migratory', threatLevel: 0, isPredator: false, basePop: 40, radius: 15 },
    { species: FaunaSpecies.Boar, weight: 20, behavior: 'territorial', threatLevel: 2, isPredator: false, basePop: 20, radius: 10 },
    { species: FaunaSpecies.Rabbit, weight: 25, behavior: 'solitary', threatLevel: 0, isPredator: false, basePop: 80, radius: 8 },
    { species: FaunaSpecies.Wolf, weight: 15, behavior: 'pack', threatLevel: 5, isPredator: true, basePop: 12, radius: 20 },
    { species: FaunaSpecies.Bear, weight: 10, behavior: 'solitary', threatLevel: 6, isPredator: true, basePop: 4, radius: 15 },
  ],
  [BiomeType.DenseForest]: [
    { species: FaunaSpecies.Deer, weight: 20, behavior: 'migratory', threatLevel: 0, isPredator: false, basePop: 30, radius: 12 },
    { species: FaunaSpecies.Boar, weight: 25, behavior: 'territorial', threatLevel: 2, isPredator: false, basePop: 25, radius: 10 },
    { species: FaunaSpecies.GiantSpider, weight: 15, behavior: 'territorial', threatLevel: 7, isPredator: true, basePop: 8, radius: 8 },
    { species: FaunaSpecies.Bear, weight: 15, behavior: 'solitary', threatLevel: 6, isPredator: true, basePop: 5, radius: 15 },
    { species: FaunaSpecies.Eagle, weight: 10, behavior: 'solitary', threatLevel: 2, isPredator: true, basePop: 6, radius: 25 },
    { species: FaunaSpecies.Wolf, weight: 15, behavior: 'pack', threatLevel: 5, isPredator: true, basePop: 10, radius: 18 },
  ],
  [BiomeType.Plains]: [
    { species: FaunaSpecies.Bison, weight: 30, behavior: 'migratory', threatLevel: 1, isPredator: false, basePop: 60, radius: 25 },
    { species: FaunaSpecies.Rabbit, weight: 30, behavior: 'solitary', threatLevel: 0, isPredator: false, basePop: 100, radius: 10 },
    { species: FaunaSpecies.Antelope, weight: 20, behavior: 'migratory', threatLevel: 0, isPredator: false, basePop: 50, radius: 20 },
    { species: FaunaSpecies.Wolf, weight: 15, behavior: 'pack', threatLevel: 5, isPredator: true, basePop: 15, radius: 25 },
    { species: FaunaSpecies.Eagle, weight: 5, behavior: 'solitary', threatLevel: 2, isPredator: true, basePop: 4, radius: 30 },
  ],
  [BiomeType.Savanna]: [
    { species: FaunaSpecies.Antelope, weight: 35, behavior: 'migratory', threatLevel: 0, isPredator: false, basePop: 80, radius: 25 },
    { species: FaunaSpecies.Bison, weight: 20, behavior: 'migratory', threatLevel: 1, isPredator: false, basePop: 40, radius: 25 },
    { species: FaunaSpecies.Lion, weight: 25, behavior: 'pack', threatLevel: 8, isPredator: true, basePop: 8, radius: 20 },
    { species: FaunaSpecies.Eagle, weight: 20, behavior: 'solitary', threatLevel: 2, isPredator: true, basePop: 6, radius: 30 },
  ],
  [BiomeType.Jungle]: [
    { species: FaunaSpecies.Boar, weight: 25, behavior: 'territorial', threatLevel: 2, isPredator: false, basePop: 20, radius: 10 },
    { species: FaunaSpecies.GiantSpider, weight: 25, behavior: 'territorial', threatLevel: 7, isPredator: true, basePop: 12, radius: 10 },
    { species: FaunaSpecies.Crocodile, weight: 20, behavior: 'territorial', threatLevel: 8, isPredator: true, basePop: 6, radius: 12 },
    { species: FaunaSpecies.Eagle, weight: 10, behavior: 'solitary', threatLevel: 2, isPredator: true, basePop: 5, radius: 20 },
  ],
  [BiomeType.Mountain]: [
    { species: FaunaSpecies.MountainGoat, weight: 40, behavior: 'territorial', threatLevel: 0, isPredator: false, basePop: 20, radius: 12 },
    { species: FaunaSpecies.Eagle, weight: 30, behavior: 'solitary', threatLevel: 2, isPredator: true, basePop: 4, radius: 30 },
    { species: FaunaSpecies.Bear, weight: 20, behavior: 'solitary', threatLevel: 6, isPredator: true, basePop: 3, radius: 15 },
    { species: FaunaSpecies.Wolf, weight: 10, behavior: 'pack', threatLevel: 5, isPredator: true, basePop: 8, radius: 20 },
  ],
  [BiomeType.Taiga]: [
    { species: FaunaSpecies.Elk, weight: 30, behavior: 'migratory', threatLevel: 1, isPredator: false, basePop: 25, radius: 20 },
    { species: FaunaSpecies.Wolf, weight: 25, behavior: 'pack', threatLevel: 5, isPredator: true, basePop: 12, radius: 25 },
    { species: FaunaSpecies.Bear, weight: 20, behavior: 'solitary', threatLevel: 6, isPredator: true, basePop: 4, radius: 15 },
    { species: FaunaSpecies.Rabbit, weight: 25, behavior: 'solitary', threatLevel: 0, isPredator: false, basePop: 40, radius: 8 },
  ],
  [BiomeType.Tundra]: [
    { species: FaunaSpecies.Mammoth, weight: 25, behavior: 'migratory', threatLevel: 3, isPredator: false, basePop: 10, radius: 30 },
    { species: FaunaSpecies.PolarBear, weight: 25, behavior: 'solitary', threatLevel: 8, isPredator: true, basePop: 3, radius: 20 },
    { species: FaunaSpecies.Rabbit, weight: 30, behavior: 'solitary', threatLevel: 0, isPredator: false, basePop: 30, radius: 10 },
    { species: FaunaSpecies.Wolf, weight: 20, behavior: 'pack', threatLevel: 5, isPredator: true, basePop: 10, radius: 25 },
  ],
  [BiomeType.Swamp]: [
    { species: FaunaSpecies.Crocodile, weight: 35, behavior: 'territorial', threatLevel: 8, isPredator: true, basePop: 8, radius: 12 },
    { species: FaunaSpecies.Boar, weight: 25, behavior: 'territorial', threatLevel: 2, isPredator: false, basePop: 15, radius: 10 },
    { species: FaunaSpecies.GiantSpider, weight: 25, behavior: 'territorial', threatLevel: 7, isPredator: true, basePop: 10, radius: 8 },
    { species: FaunaSpecies.Fish, weight: 15, behavior: 'solitary', threatLevel: 0, isPredator: false, basePop: 200, radius: 5 },
  ],
  [BiomeType.Coast]: [
    { species: FaunaSpecies.Fish, weight: 50, behavior: 'migratory', threatLevel: 0, isPredator: false, basePop: 500, radius: 10 },
    { species: FaunaSpecies.Eagle, weight: 20, behavior: 'solitary', threatLevel: 2, isPredator: true, basePop: 4, radius: 20 },
    { species: FaunaSpecies.Crocodile, weight: 15, behavior: 'territorial', threatLevel: 8, isPredator: true, basePop: 4, radius: 10 },
  ],
  [BiomeType.Ocean]: [
    { species: FaunaSpecies.Fish, weight: 50, behavior: 'migratory', threatLevel: 0, isPredator: false, basePop: 1000, radius: 20 },
    { species: FaunaSpecies.Whale, weight: 20, behavior: 'migratory', threatLevel: 1, isPredator: false, basePop: 5, radius: 50 },
    { species: FaunaSpecies.Shark, weight: 30, behavior: 'territorial', threatLevel: 7, isPredator: true, basePop: 8, radius: 30 },
  ],
  [BiomeType.Desert]: [
    { species: FaunaSpecies.Rabbit, weight: 50, behavior: 'solitary', threatLevel: 0, isPredator: false, basePop: 10, radius: 15 },
    { species: FaunaSpecies.Eagle, weight: 30, behavior: 'solitary', threatLevel: 2, isPredator: true, basePop: 2, radius: 30 },
    { species: FaunaSpecies.GiantSpider, weight: 20, behavior: 'territorial', threatLevel: 7, isPredator: true, basePop: 3, radius: 10 },
  ],
};

export class FaunaDistributor {
  /**
   * Distribute fauna populations across the map.
   * Uses a grid sampling approach — divides map into regions and
   * places populations based on local biome and flora density.
   */
  distribute(
    worldMap: WorldMap,
    flora: FloraMap,
    rng: SeededRNG
  ): FaunaPopulation[] {
    const faunaRng = rng.fork('fauna');
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    const populations: FaunaPopulation[] = [];

    // Sample at region-sized intervals
    const regionSize = Math.max(10, Math.floor(Math.min(width, height) / 15));

    for (let ry = regionSize / 2; ry < height; ry += regionSize) {
      for (let rx = regionSize / 2; rx < width; rx += regionSize) {
        const y = Math.floor(ry);
        const x = Math.floor(rx);
        const tile = worldMap.getTile(x, y);
        if (tile === undefined) continue;

        const templates = BIOME_FAUNA[tile.biome];
        if (templates === undefined || templates.length === 0) continue;

        // Flora density affects herbivore populations
        const floraEntry = flora[y]?.[x];
        const floraDensity = floraEntry?.density ?? 0;

        // Place 1-3 species per region
        const speciesCount = faunaRng.nextInt(1, Math.min(3, templates.length));
        const used = new Set<FaunaSpecies>();

        for (let s = 0; s < speciesCount; s++) {
          const items = templates.filter(t => !used.has(t.species)).map(t => t.species);
          const weights = templates.filter(t => !used.has(t.species)).map(t => t.weight);
          if (items.length === 0) break;

          const species = faunaRng.weightedPick(items, weights);
          used.add(species);

          const template = templates.find(t => t.species === species);
          if (template === undefined) continue;

          // Adjust population by flora density for herbivores
          let popMultiplier = 1;
          if (!template.isPredator) {
            popMultiplier = 0.3 + floraDensity * 0.7;
          }

          // Randomize position slightly within region
          const px = Math.max(0, Math.min(width - 1, x + faunaRng.nextInt(-regionSize / 4, regionSize / 4)));
          const py = Math.max(0, Math.min(height - 1, y + faunaRng.nextInt(-regionSize / 4, regionSize / 4)));

          const population = Math.max(1, Math.round(
            template.basePop * popMultiplier * faunaRng.nextFloat(0.5, 1.5)
          ));

          populations.push({
            species: template.species,
            x: px,
            y: py,
            radius: template.radius,
            population,
            behavior: template.behavior,
            threatLevel: template.threatLevel,
            isPredator: template.isPredator,
          });
        }
      }
    }

    return populations;
  }
}
