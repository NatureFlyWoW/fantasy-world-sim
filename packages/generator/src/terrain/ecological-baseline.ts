/**
 * Captures the initial ecological state for the Ecological Pressure System
 * to measure degradation against during simulation.
 */

import type { WorldMap } from './world-map.js';
import type { FloraMap, FloraEntry } from './flora.js';
import type { FaunaPopulation } from './fauna.js';
import { BiomeType } from './terrain-tile.js';

/**
 * Ecological baseline for a single region (grid cell).
 */
export interface RegionBaseline {
  /** Region grid coordinates */
  readonly regionX: number;
  readonly regionY: number;
  /** Total animal population across all species */
  readonly animalPopulation: number;
  /** Number of distinct fauna species present */
  readonly speciesCount: number;
  /** Fraction of tiles with forest cover (0-1) */
  readonly forestCover: number;
  /** Total number of resource nodes in the region */
  readonly resourceNodeCount: number;
  /** Average magical background level (ley line density, 0-1) */
  readonly magicLevel: number;
  /** Average flora density in the region (0-1) */
  readonly floraDensity: number;
}

/**
 * Complete ecological state snapshot.
 */
export interface EcologyState {
  /** Per-region baselines */
  readonly regions: readonly RegionBaseline[];
  /** Total world animal population */
  readonly totalAnimalPopulation: number;
  /** Total world forest cover fraction */
  readonly totalForestCover: number;
  /** Total number of fauna species across the world */
  readonly totalSpeciesCount: number;
  /** Region grid size used for sampling */
  readonly regionSize: number;
}

export class EcologicalBaseline {
  /**
   * Capture the ecological baseline for the generated world.
   */
  snapshot(
    worldMap: WorldMap,
    flora: FloraMap,
    fauna: readonly FaunaPopulation[]
  ): EcologyState {
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    const regionSize = Math.max(10, Math.floor(Math.min(width, height) / 10));

    const regions: RegionBaseline[] = [];
    let totalForestTiles = 0;
    let totalLandTiles = 0;

    // Build fauna lookup by region
    const faunaByRegion = this.buildFaunaRegionMap(fauna, regionSize);

    for (let ry = 0; ry * regionSize < height; ry++) {
      for (let rx = 0; rx * regionSize < width; rx++) {
        const region = this.computeRegionBaseline(
          worldMap, flora, faunaByRegion, rx, ry, regionSize, width, height
        );
        regions.push(region);

        // Accumulate forest cover
        const regionTiles = this.countRegionTiles(rx, ry, regionSize, width, height);
        const forestTilesInRegion = Math.round(region.forestCover * regionTiles);
        const landTilesInRegion = this.countLandTiles(worldMap, rx, ry, regionSize, width, height);
        totalForestTiles += forestTilesInRegion;
        totalLandTiles += landTilesInRegion;
      }
    }

    const totalAnimalPopulation = fauna.reduce((sum, f) => sum + f.population, 0);
    const totalSpeciesCount = new Set(fauna.map(f => f.species)).size;
    const totalForestCover = totalLandTiles > 0 ? totalForestTiles / totalLandTiles : 0;

    return {
      regions,
      totalAnimalPopulation,
      totalForestCover,
      totalSpeciesCount,
      regionSize,
    };
  }

  /**
   * Compute baseline for a single region.
   */
  private computeRegionBaseline(
    worldMap: WorldMap,
    flora: FloraMap,
    faunaByRegion: Map<string, FaunaPopulation[]>,
    rx: number,
    ry: number,
    regionSize: number,
    mapWidth: number,
    mapHeight: number
  ): RegionBaseline {
    const startX = rx * regionSize;
    const startY = ry * regionSize;
    const endX = Math.min(startX + regionSize, mapWidth);
    const endY = Math.min(startY + regionSize, mapHeight);

    let forestTiles = 0;
    let landTiles = 0;
    let resourceNodes = 0;
    let leyLineTiles = 0;
    let totalTiles = 0;
    let floraDensitySum = 0;
    let floraCount = 0;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        totalTiles++;
        const tile = worldMap.getTile(x, y);
        if (tile === undefined) continue;

        if (tile.elevation > 0) {
          landTiles++;
        }

        // Forest cover
        if (tile.biome === BiomeType.Forest ||
            tile.biome === BiomeType.DenseForest ||
            tile.biome === BiomeType.Taiga ||
            tile.biome === BiomeType.Jungle) {
          forestTiles++;
        }

        // Resources
        resourceNodes += tile.resources.length;

        // Magic
        if (tile.leyLine) leyLineTiles++;

        // Flora density
        const floraEntry: FloraEntry | undefined = flora[y]?.[x] as FloraEntry | undefined;
        if (floraEntry !== undefined) {
          floraDensitySum += floraEntry.density;
          floraCount++;
        }
      }
    }

    // Fauna in this region
    const key = `${rx},${ry}`;
    const regionFauna = faunaByRegion.get(key) ?? [];
    const animalPopulation = regionFauna.reduce((sum, f) => sum + f.population, 0);
    const speciesCount = new Set(regionFauna.map(f => f.species)).size;

    return {
      regionX: rx,
      regionY: ry,
      animalPopulation,
      speciesCount,
      forestCover: landTiles > 0 ? forestTiles / landTiles : 0,
      resourceNodeCount: resourceNodes,
      magicLevel: totalTiles > 0 ? leyLineTiles / totalTiles : 0,
      floraDensity: floraCount > 0 ? floraDensitySum / floraCount : 0,
    };
  }

  /**
   * Build a map of fauna populations keyed by region grid coordinates.
   */
  private buildFaunaRegionMap(
    fauna: readonly FaunaPopulation[],
    regionSize: number
  ): Map<string, FaunaPopulation[]> {
    const map = new Map<string, FaunaPopulation[]>();

    for (const pop of fauna) {
      const rx = Math.floor(pop.x / regionSize);
      const ry = Math.floor(pop.y / regionSize);
      const key = `${rx},${ry}`;
      const list = map.get(key);
      if (list !== undefined) {
        list.push(pop);
      } else {
        map.set(key, [pop]);
      }
    }

    return map;
  }

  /**
   * Count total tiles in a region.
   */
  private countRegionTiles(
    rx: number, ry: number, regionSize: number,
    mapWidth: number, mapHeight: number
  ): number {
    const startX = rx * regionSize;
    const startY = ry * regionSize;
    const endX = Math.min(startX + regionSize, mapWidth);
    const endY = Math.min(startY + regionSize, mapHeight);
    return (endX - startX) * (endY - startY);
  }

  /**
   * Count land tiles in a region.
   */
  private countLandTiles(
    worldMap: WorldMap,
    rx: number, ry: number, regionSize: number,
    mapWidth: number, mapHeight: number
  ): number {
    const startX = rx * regionSize;
    const startY = ry * regionSize;
    const endX = Math.min(startX + regionSize, mapWidth);
    const endY = Math.min(startY + regionSize, mapHeight);

    let count = 0;
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = worldMap.getTile(x, y);
        if (tile !== undefined && tile.elevation > 0) {
          count++;
        }
      }
    }
    return count;
  }
}
