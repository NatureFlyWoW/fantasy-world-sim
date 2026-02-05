/**
 * Tectonic plate simulation.
 * Generates plates via Voronoi-like regions, then simulates collisions
 * to create mountain ranges and rift valleys.
 */

import type { SeededRNG } from '../rng.js';

/**
 * Movement direction and speed for a tectonic plate.
 */
interface PlateMotion {
  readonly dx: number;
  readonly dy: number;
}

/**
 * A tectonic plate definition.
 */
interface Plate {
  readonly id: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly motion: PlateMotion;
  readonly isOceanic: boolean;
}

/**
 * Map of plate assignments: plateMap[y][x] = plate ID.
 */
export interface PlateMap {
  readonly plates: readonly Plate[];
  readonly assignment: readonly (readonly number[])[];
}

/**
 * Collision strength at each tile: positive = convergent (mountains),
 * negative = divergent (rifts). Values roughly -1 to 1.
 */
export type CollisionMap = readonly (readonly number[])[];

/**
 * Squared distance between two points.
 */
function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export class TectonicSimulator {
  /**
   * Generate tectonic plates using Voronoi-style assignment.
   */
  generatePlates(
    width: number,
    height: number,
    plateCount: number,
    rng: SeededRNG
  ): PlateMap {
    const tecRng = rng.fork('tectonics');

    // Generate plate centers
    const plates: Plate[] = [];
    for (let i = 0; i < plateCount; i++) {
      plates.push({
        id: i,
        centerX: tecRng.nextInt(0, width - 1),
        centerY: tecRng.nextInt(0, height - 1),
        motion: {
          dx: tecRng.nextFloat(-1, 1),
          dy: tecRng.nextFloat(-1, 1),
        },
        // ~40% of plates are oceanic
        isOceanic: tecRng.next() < 0.4,
      });
    }

    // Assign each tile to nearest plate center (Voronoi)
    const assignment: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        let minDist = Infinity;
        let closestPlate = 0;
        for (const plate of plates) {
          const d = distSq(x, y, plate.centerX, plate.centerY);
          if (d < minDist) {
            minDist = d;
            closestPlate = plate.id;
          }
        }
        row.push(closestPlate);
      }
      assignment.push(row);
    }

    return { plates, assignment };
  }

  /**
   * Simulate plate collisions to produce a modifier map.
   * Convergent boundaries → mountains (positive values).
   * Divergent boundaries → rifts (negative values).
   */
  simulateCollision(plateMap: PlateMap, width: number, height: number): CollisionMap {
    const { plates, assignment } = plateMap;
    const collision: number[][] = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        const myPlateId = assignment[y]![x]!;
        let collisionStrength = 0;

        // Check 4-neighbors for plate boundaries
        const neighbors: Array<[number, number]> = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighborPlateId = assignment[ny]![nx]!;

          if (neighborPlateId !== myPlateId) {
            const myPlate = plates[myPlateId];
            const neighborPlate = plates[neighborPlateId];
            if (myPlate === undefined || neighborPlate === undefined) continue;

            // Direction from my plate center to neighbor plate center
            const bdx = neighborPlate.centerX - myPlate.centerX;
            const bdy = neighborPlate.centerY - myPlate.centerY;
            const bLen = Math.sqrt(bdx * bdx + bdy * bdy) || 1;

            // Relative motion along boundary normal
            const relDx = myPlate.motion.dx - neighborPlate.motion.dx;
            const relDy = myPlate.motion.dy - neighborPlate.motion.dy;
            const dot = (relDx * bdx + relDy * bdy) / bLen;

            // Positive dot = plates moving toward each other (convergent)
            // Negative dot = plates moving apart (divergent)
            collisionStrength += dot;
          }
        }

        // Clamp to [-1, 1]
        row.push(Math.max(-1, Math.min(1, collisionStrength)));
      }
      collision.push(row);
    }

    return collision;
  }

  /**
   * Apply tectonic collision effects to a heightmap in-place.
   * Convergent boundaries raise elevation (mountains).
   * Divergent boundaries lower elevation (rifts/valleys).
   */
  applyToHeightmap(
    heightmap: number[][],
    collision: CollisionMap,
    width: number,
    height: number
  ): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const strength = collision[y]![x]!;
        const hRow = heightmap[y]!;

        if (strength > 0) {
          // Convergent: raise elevation (mountain building)
          hRow[x] = Math.min(10000, hRow[x]! + strength * 3000);
        } else if (strength < 0) {
          // Divergent: lower elevation (rifting)
          hRow[x] = Math.max(-1000, hRow[x]! + strength * 1500);
        }
      }
    }
  }
}
