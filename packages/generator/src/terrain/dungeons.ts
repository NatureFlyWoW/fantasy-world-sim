/**
 * Dungeon site placement in geologically interesting locations.
 * Count scaled by dangerLevel and historicalDepth settings.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldConfig, DangerLevel, HistoricalDepth } from '../config/types.js';
import type { WorldMap } from './world-map.js';
import { BiomeType } from './terrain-tile.js';

/**
 * Type of dungeon site.
 */
export enum DungeonType {
  Cave = 'Cave',
  Ruin = 'Ruin',
  Temple = 'Temple',
  Tomb = 'Tomb',
  UnderwaterRuin = 'UnderwaterRuin',
  VolcanicLair = 'VolcanicLair',
}

/**
 * A placed dungeon site.
 */
export interface DungeonSite {
  /** Position */
  readonly x: number;
  readonly y: number;
  /** Dungeon type */
  readonly type: DungeonType;
  /** Danger rating 1-10 */
  readonly dangerRating: number;
  /** Loot potential 1-10 */
  readonly lootPotential: number;
  /** Age in years (will be populated with history during pre-history sim) */
  readonly age: number;
}

/**
 * DangerLevel → dungeon count multiplier.
 */
const DANGER_MULTIPLIER: Record<DangerLevel, number> = {
  peaceful: 0.3,
  moderate: 1.0,
  dangerous: 2.0,
  apocalyptic: 3.5,
};

/**
 * HistoricalDepth → age range and count boost.
 */
const DEPTH_CONFIG: Record<HistoricalDepth, { maxAge: number; countBoost: number }> = {
  shallow: { maxAge: 100, countBoost: 0.5 },
  moderate: { maxAge: 500, countBoost: 1.0 },
  deep: { maxAge: 2000, countBoost: 1.5 },
  ancient: { maxAge: 10000, countBoost: 2.5 },
};

export class DungeonPlacer {
  /**
   * Place dungeon sites across the world.
   */
  place(worldMap: WorldMap, config: WorldConfig, rng: SeededRNG): DungeonSite[] {
    const dungeonRng = rng.fork('dungeons');
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();

    const dangerMult = DANGER_MULTIPLIER[config.dangerLevel];
    const depthConfig = DEPTH_CONFIG[config.historicalDepth];
    const mapArea = width * height;
    const baseScale = mapArea / 40000;

    const totalCount = Math.round(Math.max(1, 8 * baseScale * dangerMult * depthConfig.countBoost));

    const sites: DungeonSite[] = [];

    // Caves: mountain edges (elevation 3000-7000)
    const caveCount = Math.round(totalCount * 0.3);
    this.placeDungeonType(
      worldMap, DungeonType.Cave, caveCount, dungeonRng,
      depthConfig.maxAge, dangerMult, sites,
      (tile) => tile.elevation > 3000 && tile.elevation < 7000 &&
                (tile.biome === BiomeType.Mountain || tile.biome === BiomeType.Forest)
    );

    // Ruins: plains and forests (old civilizations)
    const ruinCount = Math.round(totalCount * 0.25);
    this.placeDungeonType(
      worldMap, DungeonType.Ruin, ruinCount, dungeonRng,
      depthConfig.maxAge, dangerMult, sites,
      (tile) => tile.elevation > 100 && tile.elevation < 3000 &&
                (tile.biome === BiomeType.Plains || tile.biome === BiomeType.Forest ||
                 tile.biome === BiomeType.DenseForest || tile.biome === BiomeType.Savanna)
    );

    // Temples: mountains and special locations
    const templeCount = Math.round(totalCount * 0.15);
    this.placeDungeonType(
      worldMap, DungeonType.Temple, templeCount, dungeonRng,
      depthConfig.maxAge, dangerMult, sites,
      (tile) => tile.elevation > 2000 && tile.elevation < 8000
    );

    // Tombs: varied terrain
    const tombCount = Math.round(totalCount * 0.15);
    this.placeDungeonType(
      worldMap, DungeonType.Tomb, tombCount, dungeonRng,
      depthConfig.maxAge, dangerMult, sites,
      (tile) => tile.elevation > 0 &&
                (tile.biome === BiomeType.Desert || tile.biome === BiomeType.Tundra ||
                 tile.biome === BiomeType.Swamp || tile.biome === BiomeType.Mountain)
    );

    // Underwater ruins: coast tiles
    const underwaterCount = Math.round(totalCount * 0.1);
    this.placeDungeonType(
      worldMap, DungeonType.UnderwaterRuin, underwaterCount, dungeonRng,
      depthConfig.maxAge, dangerMult, sites,
      (tile) => tile.biome === BiomeType.Coast || tile.biome === BiomeType.Ocean
    );

    // Volcanic lairs: volcanic areas
    const volcanicCount = Math.round(totalCount * 0.05);
    this.placeDungeonType(
      worldMap, DungeonType.VolcanicLair, volcanicCount, dungeonRng,
      depthConfig.maxAge, dangerMult, sites,
      (tile) => tile.biome === BiomeType.Volcano ||
                (tile.elevation > 5000 && tile.biome === BiomeType.Mountain)
    );

    return sites;
  }

  /**
   * Place dungeons of a specific type.
   */
  private placeDungeonType(
    worldMap: WorldMap,
    type: DungeonType,
    count: number,
    rng: SeededRNG,
    maxAge: number,
    dangerMult: number,
    sites: DungeonSite[],
    predicate: (tile: { elevation: number; biome: BiomeType }) => boolean
  ): void {
    if (count <= 0) return;

    const candidates = this.findCandidates(worldMap, predicate);
    rng.shuffle(candidates as Array<{ x: number; y: number }>);
    const placed = this.pickSpaced(candidates, count, 15);

    for (const pos of placed) {
      const baseDanger = this.baseDangerForType(type);
      const dangerRating = Math.min(10, Math.max(1,
        Math.round(baseDanger * dangerMult * rng.nextFloat(0.7, 1.3))
      ));

      const lootPotential = Math.min(10, Math.max(1,
        Math.round((dangerRating * 0.7 + rng.nextFloat(1, 3)) * rng.nextFloat(0.8, 1.2))
      ));

      const age = Math.round(rng.nextFloat(maxAge * 0.1, maxAge));

      sites.push({
        x: pos.x,
        y: pos.y,
        type,
        dangerRating,
        lootPotential,
        age,
      });
    }
  }

  /**
   * Base danger rating per dungeon type.
   */
  private baseDangerForType(type: DungeonType): number {
    switch (type) {
      case DungeonType.Cave: return 4;
      case DungeonType.Ruin: return 3;
      case DungeonType.Temple: return 6;
      case DungeonType.Tomb: return 5;
      case DungeonType.UnderwaterRuin: return 5;
      case DungeonType.VolcanicLair: return 8;
    }
  }

  /**
   * Find candidate tiles matching a predicate.
   */
  private findCandidates(
    worldMap: WorldMap,
    predicate: (tile: { elevation: number; biome: BiomeType }) => boolean
  ): Array<{ x: number; y: number }> {
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
    const results: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const tile = worldMap.getTile(x, y);
        if (tile !== undefined && predicate(tile)) {
          results.push({ x, y });
        }
      }
    }

    return results;
  }

  /**
   * Pick well-spaced positions from candidates.
   */
  private pickSpaced(
    candidates: readonly { x: number; y: number }[],
    count: number,
    minDist: number
  ): Array<{ x: number; y: number }> {
    const minDistSq = minDist * minDist;
    const picked: Array<{ x: number; y: number }> = [];

    for (const candidate of candidates) {
      if (picked.length >= count) break;

      let tooClose = false;
      for (const existing of picked) {
        const dx = candidate.x - existing.x;
        const dy = candidate.y - existing.y;
        if (dx * dx + dy * dy < minDistSq) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        picked.push(candidate);
      }
    }

    return picked;
  }
}
