/**
 * Resource placement based on terrain, biome, and geological features.
 */

import type { SeededRNG } from '../rng.js';
import { BiomeType, ResourceType } from './terrain-tile.js';
import type { CollisionMap } from './tectonics.js';

/**
 * Ley line definition — a great-circle arc across the map.
 */
export interface LeyLine {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
}

/**
 * Resource placement data for the map.
 */
export interface ResourceMapData {
  /** resources[y][x] = list of resources on that tile */
  readonly resources: readonly (readonly ResourceType[])[];
  /** Ley lines generated across the map */
  readonly leyLines: readonly LeyLine[];
  /** leyLineMap[y][x] = true if a ley line passes through */
  readonly leyLineMap: readonly (readonly boolean[])[];
}

export class ResourcePlacer {
  /**
   * Place resources across the map based on terrain features.
   */
  placeResources(
    heightmap: number[][],
    biomes: BiomeType[][],
    collision: CollisionMap,
    width: number,
    height: number,
    rng: SeededRNG
  ): ResourceMapData {
    const resRng = rng.fork('resources');

    // Generate ley lines
    const leyLineCount = Math.max(3, Math.floor((width * height) / 20000));
    const leyLines = this.generateLeyLines(width, height, leyLineCount, resRng);
    const leyLineMap = this.rasterizeLeyLines(leyLines, width, height);

    // Place resources per tile
    const resources: ResourceType[][] = [];

    for (let y = 0; y < height; y++) {
      const row: ResourceType[] = [];
      for (let x = 0; x < width; x++) {
        const tileResources = this.classifyResources(
          heightmap[y]![x]!,
          biomes[y]![x]!,
          collision[y]![x]!,
          leyLineMap[y]![x]!,
          resRng
        );
        row.push(tileResources);
      }
      resources.push(row);
    }

    return { resources: resources as unknown as readonly (readonly ResourceType[])[], leyLines, leyLineMap };
  }

  /**
   * Classify resources for a single tile.
   */
  private classifyResources(
    elevation: number,
    biome: BiomeType,
    collisionStrength: number,
    onLeyLine: boolean,
    rng: SeededRNG
  ): ResourceType {
    // This returns a single primary resource per tile.
    // WorldMap will aggregate into arrays.
    const volcanic = collisionStrength > 0.5;

    // Magical components at ley line intersections
    if (onLeyLine && rng.next() < 0.3) return ResourceType.MagicalComponents;

    // Gold near volcanic/tectonic activity
    if (volcanic && rng.next() < 0.15) return ResourceType.Gold;

    // Gems in mountains with tectonic activity
    if (elevation > 5000 && collisionStrength > 0.3 && rng.next() < 0.1) return ResourceType.Gems;

    switch (biome) {
      case BiomeType.Mountain:
      case BiomeType.HighMountain:
        // Mountains: stone, iron, coal, copper
        if (rng.next() < 0.3) return ResourceType.Iron;
        if (rng.next() < 0.3) return ResourceType.Stone;
        if (rng.next() < 0.2) return ResourceType.Coal;
        if (rng.next() < 0.15) return ResourceType.Copper;
        return ResourceType.Stone;

      case BiomeType.Volcano:
        if (rng.next() < 0.25) return ResourceType.Gold;
        if (rng.next() < 0.2) return ResourceType.Gems;
        return ResourceType.Stone;

      case BiomeType.Forest:
      case BiomeType.DenseForest:
      case BiomeType.Taiga:
        if (rng.next() < 0.15) return ResourceType.Herbs;
        return ResourceType.Timber;

      case BiomeType.Jungle:
        if (rng.next() < 0.2) return ResourceType.Herbs;
        if (rng.next() < 0.1) return ResourceType.LuxuryGoods;
        return ResourceType.Timber;

      case BiomeType.Plains:
      case BiomeType.Savanna:
        if (rng.next() < 0.15) return ResourceType.Herbs;
        return ResourceType.Food;

      case BiomeType.Coast:
        if (rng.next() < 0.5) return ResourceType.Fish;
        return ResourceType.Food;

      case BiomeType.Ocean:
      case BiomeType.DeepOcean:
        return ResourceType.Fish;

      case BiomeType.Swamp:
        if (rng.next() < 0.3) return ResourceType.Herbs;
        return ResourceType.Food;

      case BiomeType.Desert:
        if (rng.next() < 0.1) return ResourceType.Gold;
        if (rng.next() < 0.1) return ResourceType.Gems;
        return ResourceType.Stone;

      case BiomeType.Tundra:
      case BiomeType.IceCap:
        return ResourceType.Stone;

      case BiomeType.MagicWasteland:
        return ResourceType.MagicalComponents;

      default:
        return ResourceType.Food;
    }
  }

  /**
   * Generate ley lines as great-circle arcs across the map.
   */
  private generateLeyLines(
    width: number,
    height: number,
    count: number,
    rng: SeededRNG
  ): LeyLine[] {
    const lines: LeyLine[] = [];
    for (let i = 0; i < count; i++) {
      lines.push({
        startX: rng.nextInt(0, width - 1),
        startY: rng.nextInt(0, height - 1),
        endX: rng.nextInt(0, width - 1),
        endY: rng.nextInt(0, height - 1),
      });
    }
    return lines;
  }

  /**
   * Rasterize ley lines onto a boolean grid.
   * Uses Bresenham's line algorithm with a small radius.
   */
  private rasterizeLeyLines(
    leyLines: readonly LeyLine[],
    width: number,
    height: number
  ): boolean[][] {
    const map: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      map.push(new Array(width).fill(false) as boolean[]);
    }

    for (const line of leyLines) {
      this.bresenham(line.startX, line.startY, line.endX, line.endY, map, width, height);
    }

    return map;
  }

  /**
   * Draw a line using Bresenham's algorithm with a 1-tile radius.
   */
  private bresenham(
    x0: number, y0: number,
    x1: number, y1: number,
    map: boolean[][],
    width: number, height: number
  ): void {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    let cx = x0;
    let cy = y0;

    for (;;) {
      // Mark the point and immediate neighbors
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const px = cx + ox;
          const py = cy + oy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            map[py]![px] = true;
          }
        }
      }

      if (cx === x1 && cy === y1) break;

      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        cx += sx;
      }
      if (e2 <= dx) {
        err += dx;
        cy += sy;
      }
    }
  }
}
