/**
 * Heightmap generation using layered simplex noise.
 * Produces elevation values from -1000 (deep ocean) to 10000 (mountain peak).
 */

import type { SeededRNG } from '../rng.js';
import { SimplexNoise } from '@fws/core';

/**
 * Generate a layered noise value using fractal Brownian motion (fBm).
 */
function fbm(
  simplex: SimplexNoise,
  x: number,
  y: number,
  octaves: number,
  lacunarity: number,
  persistence: number
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += simplex.noise2D(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

export class HeightmapGenerator {
  /**
   * Generate a heightmap using layered simplex noise.
   * Returns a 2D array [y][x] with values from -1000 to 10000.
   */
  generate(width: number, height: number, rng: SeededRNG): number[][] {
    const noiseRng = rng.fork('heightmap');
    const simplex = new SimplexNoise(noiseRng);

    // Base scale: larger values = more zoomed out terrain
    const baseScale = 0.005;

    const map: number[][] = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        // Large-scale continent shape (low frequency)
        const continent = fbm(simplex, x * baseScale, y * baseScale, 4, 2.0, 0.5);

        // Medium detail terrain (higher frequency)
        const detail = fbm(simplex, x * baseScale * 3, y * baseScale * 3, 4, 2.0, 0.45);

        // Fine detail roughness
        const roughness = fbm(simplex, x * baseScale * 8, y * baseScale * 8, 3, 2.0, 0.4);

        // Combine layers: continent dominates, detail adds features, roughness adds texture
        let elevation = continent * 0.6 + detail * 0.3 + roughness * 0.1;

        // Apply island mask: lower edges to create oceans at borders
        const edgeX = Math.min(x, width - 1 - x) / (width * 0.15);
        const edgeY = Math.min(y, height - 1 - y) / (height * 0.15);
        const edgeFade = Math.min(1, Math.min(edgeX, edgeY));
        elevation = elevation * edgeFade - (1 - edgeFade) * 0.5;

        // Map from [-1, 1] to [-1000, 10000]
        // Bias: more ocean than land (shift center down)
        const normalized = (elevation + 0.3) / 1.3;
        const finalElevation = normalized * 11000 - 1000;

        row.push(Math.max(-1000, Math.min(10000, finalElevation)));
      }
      map.push(row);
    }

    return map;
  }
}
