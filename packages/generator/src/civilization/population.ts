/**
 * Initial population placement — distributes starting populations
 * across the map based on race biome affinity and settlement suitability.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldMap } from '../terrain/world-map.js';
import type { Race } from './races.js';
import { BiomeType } from '../terrain/terrain-tile.js';

/**
 * A seed of initial population placed on the map.
 */
export interface PopulationSeed {
  /** Which race */
  readonly race: Race;
  /** Map position */
  readonly x: number;
  readonly y: number;
  /** Initial population count */
  readonly initialCount: number;
}

/**
 * Habitable biomes (exclude ocean and volcano).
 */
const HABITABLE_BIOMES = new Set<BiomeType>([
  BiomeType.Forest, BiomeType.DenseForest, BiomeType.Plains,
  BiomeType.Savanna, BiomeType.Jungle, BiomeType.Mountain,
  BiomeType.Taiga, BiomeType.Tundra, BiomeType.Swamp,
  BiomeType.Desert, BiomeType.Coast,
]);

export class InitialPopulationPlacer {
  /**
   * Place initial populations for all races on the map.
   * Each race gets 1-3 starting settlements based on biome affinity.
   */
  place(worldMap: WorldMap, races: readonly Race[], rng: SeededRNG): PopulationSeed[] {
    const popRng = rng.fork('population');
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    const seeds: PopulationSeed[] = [];

    // Collect candidate sites (sample grid)
    const step = Math.max(1, Math.floor(Math.min(width, height) / 40));
    const candidates = this.findHabitableSites(worldMap, step);

    if (candidates.length === 0) return seeds;

    // Track occupied areas to spread populations apart
    const occupied: Array<{ x: number; y: number }> = [];
    const minDistSq = Math.pow(Math.min(width, height) / 8, 2);

    for (const race of races) {
      // Number of starting settlements per race
      const settlementCount = popRng.nextInt(1, 3);

      // Score candidates by biome affinity
      const preferredSet = new Set(race.biomePreference);
      const scored = candidates.map(c => {
        const tile = worldMap.getTile(c.x, c.y);
        if (tile === undefined) return { ...c, score: 0 };

        let score = 1;
        if (preferredSet.has(tile.biome)) score += 5;
        if (tile.riverId !== undefined) score += 2;
        if (tile.resources.length > 0) score += 1;

        // Penalty for proximity to existing placements
        for (const occ of occupied) {
          const dx = c.x - occ.x;
          const dy = c.y - occ.y;
          if (dx * dx + dy * dy < minDistSq) {
            score -= 3;
          }
        }

        return { ...c, score: Math.max(0, score) };
      }).filter(c => c.score > 0);

      if (scored.length === 0) continue;

      // Sort by score descending, then pick from top candidates with some randomness
      scored.sort((a, b) => b.score - a.score);
      const topN = Math.min(scored.length, Math.max(10, Math.floor(scored.length * 0.2)));
      const topCandidates = scored.slice(0, topN);

      for (let s = 0; s < settlementCount && topCandidates.length > 0; s++) {
        const idx = popRng.nextInt(0, Math.min(topCandidates.length - 1, 4));
        const site = topCandidates[idx]!;
        topCandidates.splice(idx, 1);

        // Base population scaled by lifespan (short-lived breed faster)
        let basePop = 100;
        if (race.lifespan.max <= 50) {
          basePop = popRng.nextInt(150, 300);
        } else if (race.lifespan.max <= 100) {
          basePop = popRng.nextInt(80, 200);
        } else if (race.lifespan.max <= 500) {
          basePop = popRng.nextInt(40, 100);
        } else {
          basePop = popRng.nextInt(20, 60);
        }

        seeds.push({
          race,
          x: site.x,
          y: site.y,
          initialCount: basePop,
        });

        occupied.push({ x: site.x, y: site.y });
      }
    }

    return seeds;
  }

  /**
   * Find habitable sites across the map.
   */
  private findHabitableSites(
    worldMap: WorldMap,
    step: number
  ): Array<{ x: number; y: number }> {
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    const sites: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const tile = worldMap.getTile(x, y);
        if (tile !== undefined && HABITABLE_BIOMES.has(tile.biome)) {
          sites.push({ x, y });
        }
      }
    }

    return sites;
  }
}
