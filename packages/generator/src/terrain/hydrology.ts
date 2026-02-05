/**
 * River generation via downhill flow simulation.
 * Water flows from peaks, carving valleys, pooling in lakes, reaching oceans.
 */

import type { SeededRNG } from '../rng.js';

/**
 * A point along a river's path.
 */
export interface RiverPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A generated river.
 */
export interface River {
  readonly id: number;
  readonly path: readonly RiverPoint[];
  readonly sourceX: number;
  readonly sourceY: number;
}

/**
 * Cardinal + diagonal neighbor offsets.
 */
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
];

export class RiverGenerator {
  /**
   * Generate rivers by finding high-elevation source points and flowing downhill.
   */
  generateRivers(
    heightmap: number[][],
    rng: SeededRNG,
    riverCount?: number
  ): River[] {
    const hydroRng = rng.fork('hydrology');
    const mapHeight = heightmap.length;
    if (mapHeight === 0) return [];
    const mapWidth = heightmap[0]!.length;

    // Determine river count based on map size if not specified
    const targetCount = riverCount ?? Math.max(5, Math.floor((mapWidth * mapHeight) / 5000));

    // Find candidate source points (high elevation land)
    const candidates: Array<{ x: number; y: number; elevation: number }> = [];
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const elev = heightmap[y]![x]!;
        if (elev > 3000) {
          candidates.push({ x, y, elevation: elev });
        }
      }
    }

    // Sort by elevation descending, pick top candidates with some randomness
    candidates.sort((a, b) => b.elevation - a.elevation);
    const sources = this.selectSources(candidates, targetCount, mapWidth, hydroRng);

    // Track which tiles have rivers (to avoid overlapping)
    const riverTiles = new Set<string>();

    const rivers: River[] = [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]!;
      const path = this.traceRiver(heightmap, source.x, source.y, mapWidth, mapHeight, riverTiles);

      if (path.length >= 5) {
        rivers.push({
          id: i,
          path,
          sourceX: source.x,
          sourceY: source.y,
        });

        // Mark tiles as having rivers
        for (const point of path) {
          riverTiles.add(`${point.x},${point.y}`);
        }
      }
    }

    return rivers;
  }

  /**
   * Carve river valleys into the heightmap.
   * Rivers lower the terrain slightly along their path.
   */
  carveValleys(heightmap: number[][], rivers: readonly River[]): void {
    for (const river of rivers) {
      for (let i = 0; i < river.path.length; i++) {
        const point = river.path[i]!;
        const row = heightmap[point.y];
        if (row === undefined) continue;
        const current = row[point.x];
        if (current === undefined) continue;

        // Carve more at the end (where river is bigger)
        const riverSize = Math.min(1, i / river.path.length);
        const carveDepth = 20 + riverSize * 80;
        row[point.x] = Math.max(0, current - carveDepth);
      }
    }
  }

  /**
   * Select well-spaced river sources from candidates.
   */
  private selectSources(
    candidates: readonly { x: number; y: number; elevation: number }[],
    targetCount: number,
    _mapWidth: number,
    rng: SeededRNG
  ): Array<{ x: number; y: number }> {
    const sources: Array<{ x: number; y: number }> = [];
    const minDistSq = 900; // minimum 30 tiles apart

    for (const candidate of candidates) {
      if (sources.length >= targetCount) break;

      // Check distance from existing sources
      let tooClose = false;
      for (const existing of sources) {
        const dx = candidate.x - existing.x;
        const dy = candidate.y - existing.y;
        if (dx * dx + dy * dy < minDistSq) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        // Some randomness: skip occasionally
        if (rng.next() < 0.7) {
          sources.push({ x: candidate.x, y: candidate.y });
        }
      }
    }

    return sources;
  }

  /**
   * Trace a river path downhill from a source point.
   */
  private traceRiver(
    heightmap: number[][],
    startX: number,
    startY: number,
    width: number,
    height: number,
    existingRivers: ReadonlySet<string>
  ): RiverPoint[] {
    const path: RiverPoint[] = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    let cx = startX;
    let cy = startY;
    const maxSteps = width + height;

    for (let step = 0; step < maxSteps; step++) {
      const currentElev = heightmap[cy]![cx]!;

      // Reached ocean
      if (currentElev <= 0) break;

      // Find lowest neighbor
      let bestX = -1;
      let bestY = -1;
      let bestElev = currentElev;

      for (const [dx, dy] of NEIGHBORS) {
        const nx = cx + dx;
        const ny = cy + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;

        const nElev = heightmap[ny]![nx]!;
        if (nElev < bestElev) {
          bestElev = nElev;
          bestX = nx;
          bestY = ny;
        }
      }

      // No downhill neighbor found → pool into lake, stop
      if (bestX === -1) break;

      // Join existing river → stop
      if (existingRivers.has(`${bestX},${bestY}`)) {
        path.push({ x: bestX, y: bestY });
        break;
      }

      visited.add(`${bestX},${bestY}`);
      path.push({ x: bestX, y: bestY });
      cx = bestX;
      cy = bestY;
    }

    return path;
  }
}
