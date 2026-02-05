/**
 * WorldMap orchestrates the full terrain generation pipeline:
 * heightmap → tectonics → hydrology → climate → biomes → resources.
 */

import type { WorldConfig } from '../config/types.js';
import type { SeededRNG } from '../rng.js';
import { resolveGridSize } from '../config/resolver.js';
import { HeightmapGenerator } from './heightmap.js';
import { TectonicSimulator } from './tectonics.js';
import { RiverGenerator } from './hydrology.js';
import type { River } from './hydrology.js';
import { ClimateGenerator } from './climate.js';
import { BiomeClassifier } from './biomes.js';
import { ResourcePlacer } from './resources.js';
import type { ResourceMapData } from './resources.js';
import { BiomeType, ResourceType } from './terrain-tile.js';
import type { TerrainTile } from './terrain-tile.js';

/**
 * A scored settlement site.
 */
export interface SettlementSite {
  readonly x: number;
  readonly y: number;
  readonly score: number;
}

/**
 * Geological activity → plate count multiplier.
 */
const GEO_PLATE_MULTIPLIER: Record<string, number> = {
  dormant: 0.5,
  normal: 1.0,
  active: 1.5,
  volatile: 2.0,
};

export class WorldMap {
  private tiles: TerrainTile[][] = [];
  private rivers: River[] = [];
  private mapWidth = 0;
  private mapHeight = 0;
  private generated = false;

  constructor(
    private readonly config: WorldConfig,
    private readonly rng: SeededRNG
  ) {}

  /**
   * Run the full terrain generation pipeline.
   */
  generate(): TerrainTile[][] {
    const { width, height } = resolveGridSize(this.config.worldSize);
    this.mapWidth = width;
    this.mapHeight = height;

    // Step 1: Base heightmap
    const heightmapGen = new HeightmapGenerator();
    const heightmap = heightmapGen.generate(width, height, this.rng);

    // Step 2: Tectonic plates
    const tectonics = new TectonicSimulator();
    const basePlateCount = Math.max(4, Math.round(Math.sqrt(width * height) / 20));
    const geoMult = GEO_PLATE_MULTIPLIER[this.config.geologicalActivity] ?? 1;
    const plateCount = Math.round(basePlateCount * geoMult);

    const plateMap = tectonics.generatePlates(width, height, plateCount, this.rng);
    const collision = tectonics.simulateCollision(plateMap, width, height);
    tectonics.applyToHeightmap(heightmap, collision, width, height);

    // Step 3: Rivers
    const hydro = new RiverGenerator();
    this.rivers = hydro.generateRivers(heightmap, this.rng);
    hydro.carveValleys(heightmap, this.rivers);

    // Build river lookup: tile → river id
    const riverLookup = new Map<string, number>();
    for (const river of this.rivers) {
      for (const point of river.path) {
        riverLookup.set(`${point.x},${point.y}`, river.id);
      }
    }

    // Step 4: Climate
    const climateGen = new ClimateGenerator();
    const climate = climateGen.generateClimate(heightmap, width);

    // Step 5: Biomes
    const biomeClassifier = new BiomeClassifier();
    const biomeGrid: BiomeType[][] = [];
    for (let y = 0; y < height; y++) {
      const row: BiomeType[] = [];
      for (let x = 0; x < width; x++) {
        const elev = heightmap[y]![x]!;
        const temp = climate[y]![x]!.temperature;
        const rain = climate[y]![x]!.rainfall;
        const isVolcanic = collision[y]![x]! > 0.7;
        row.push(biomeClassifier.classify(temp, rain, elev, isVolcanic));
      }
      biomeGrid.push(row);
    }

    // Step 6: Resources
    const resourcePlacer = new ResourcePlacer();
    const resourceData: ResourceMapData = resourcePlacer.placeResources(
      heightmap, biomeGrid, collision, width, height, this.rng
    );

    // Assemble tiles
    this.tiles = [];
    for (let y = 0; y < height; y++) {
      const row: TerrainTile[] = [];
      for (let x = 0; x < width; x++) {
        const primaryResource = (resourceData.resources[y] as readonly ResourceType[])[x]!;
        row.push({
          elevation: heightmap[y]![x]!,
          temperature: climate[y]![x]!.temperature,
          rainfall: climate[y]![x]!.rainfall,
          biome: biomeGrid[y]![x]!,
          resources: primaryResource !== undefined ? [primaryResource] : [],
          riverId: riverLookup.get(`${x},${y}`),
          plateId: plateMap.assignment[y]![x]!,
          leyLine: resourceData.leyLineMap[y]![x]!,
        });
      }
      this.tiles.push(row);
    }

    this.generated = true;
    return this.tiles;
  }

  /**
   * Get a tile at the given coordinates.
   */
  getTile(x: number, y: number): TerrainTile | undefined {
    return this.tiles[y]?.[x];
  }

  /**
   * Get the generated rivers.
   */
  getRivers(): readonly River[] {
    return this.rivers;
  }

  /**
   * Get the map width.
   */
  getWidth(): number {
    return this.mapWidth;
  }

  /**
   * Get the map height.
   */
  getHeight(): number {
    return this.mapHeight;
  }

  /**
   * Whether the map has been generated.
   */
  isGenerated(): boolean {
    return this.generated;
  }

  /**
   * Find the best settlement sites.
   * Score based on: fresh water proximity, fertile land, defense,
   * resource access, trade route potential.
   */
  findSuitableSettlementSites(count: number): SettlementSite[] {
    if (!this.generated) {
      throw new Error('Map must be generated before finding settlement sites');
    }

    const candidates: SettlementSite[] = [];
    // Sample at regular intervals for performance
    const step = Math.max(1, Math.floor(Math.min(this.mapWidth, this.mapHeight) / 50));

    for (let y = step; y < this.mapHeight - step; y += step) {
      for (let x = step; x < this.mapWidth - step; x += step) {
        const tile = this.tiles[y]![x]!;

        // Only consider land tiles at reasonable elevation
        if (tile.elevation < 10 || tile.elevation > 4000) continue;

        // Skip harsh biomes
        if (tile.biome === BiomeType.Desert ||
            tile.biome === BiomeType.IceCap ||
            tile.biome === BiomeType.HighMountain ||
            tile.biome === BiomeType.Volcano ||
            tile.biome === BiomeType.MagicWasteland ||
            tile.biome === BiomeType.Swamp) continue;

        const score = this.scoreSettlementSite(x, y, tile);
        if (score > 0) {
          candidates.push({ x, y, score });
        }
      }
    }

    // Sort by score descending, return top N
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, count);
  }

  /**
   * Score a potential settlement site.
   */
  private scoreSettlementSite(x: number, y: number, tile: TerrainTile): number {
    let score = 0;

    // Fresh water: river nearby
    const riverRadius = 5;
    let hasRiver = false;
    for (let dy = -riverRadius; dy <= riverRadius && !hasRiver; dy++) {
      for (let dx = -riverRadius; dx <= riverRadius && !hasRiver; dx++) {
        const neighbor = this.tiles[y + dy]?.[x + dx];
        if (neighbor?.riverId !== undefined) {
          hasRiver = true;
        }
      }
    }
    if (hasRiver) score += 30;

    // Fertile land: food-producing biomes nearby
    const fertileRadius = 3;
    let fertileCount = 0;
    for (let dy = -fertileRadius; dy <= fertileRadius; dy++) {
      for (let dx = -fertileRadius; dx <= fertileRadius; dx++) {
        const neighbor = this.tiles[y + dy]?.[x + dx];
        if (neighbor !== undefined &&
            (neighbor.biome === BiomeType.Plains ||
             neighbor.biome === BiomeType.Forest ||
             neighbor.biome === BiomeType.Savanna)) {
          fertileCount++;
        }
      }
    }
    score += Math.min(25, fertileCount * 2);

    // Defense: moderate elevation is good, steep terrain nearby
    if (tile.elevation > 200 && tile.elevation < 1500) {
      score += 10;
    }
    if (tile.biome === BiomeType.Forest || tile.biome === BiomeType.DenseForest) {
      score += 5;
    }

    // Resource diversity
    const resourceRadius = 8;
    const resourceTypes = new Set<ResourceType>();
    for (let dy = -resourceRadius; dy <= resourceRadius; dy++) {
      for (let dx = -resourceRadius; dx <= resourceRadius; dx++) {
        const neighbor = this.tiles[y + dy]?.[x + dx];
        if (neighbor !== undefined) {
          for (const res of neighbor.resources) {
            resourceTypes.add(res);
          }
        }
      }
    }
    score += Math.min(20, resourceTypes.size * 4);

    // Coast access (trade routes)
    const coastRadius = 10;
    let hasCoast = false;
    for (let dy = -coastRadius; dy <= coastRadius && !hasCoast; dy++) {
      for (let dx = -coastRadius; dx <= coastRadius && !hasCoast; dx++) {
        const neighbor = this.tiles[y + dy]?.[x + dx];
        if (neighbor?.biome === BiomeType.Coast || neighbor?.biome === BiomeType.Ocean) {
          hasCoast = true;
        }
      }
    }
    if (hasCoast) score += 15;

    // Temperature preference: moderate is best
    if (tile.temperature > 5 && tile.temperature < 30) {
      score += 10;
    }

    return score;
  }
}
