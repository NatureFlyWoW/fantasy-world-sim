/**
 * Heightmap generation using layered simplex noise.
 * Produces elevation values from -1000 (deep ocean) to 10000 (mountain peak).
 */

import type { SeededRNG } from '../rng.js';

/**
 * 2D simplex noise generator seeded from an RNG.
 * Based on Stefan Gustavson's simplex noise implementation.
 */
class SimplexNoise {
  private readonly perm: Uint8Array;

  // Gradients for 2D simplex noise
  private static readonly GRAD2: ReadonlyArray<readonly [number, number]> = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  // Skewing factors for 2D
  private static readonly F2 = 0.5 * (Math.sqrt(3) - 1);
  private static readonly G2 = (3 - Math.sqrt(3)) / 6;

  constructor(rng: SeededRNG) {
    // Build a permutation table from the RNG
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    // Fisher-Yates shuffle using the seeded RNG
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(0, i);
      const tmp = p[i]!;
      p[i] = p[j]!;
      p[j] = tmp;
    }
    // Double the permutation table to avoid index wrapping
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]!;
    }
  }

  /**
   * Evaluate 2D simplex noise at (x, y). Returns value in [-1, 1].
   */
  noise2D(x: number, y: number): number {
    const F2 = SimplexNoise.F2;
    const G2 = SimplexNoise.G2;

    // Skew input space to determine which simplex cell we're in
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine which simplex triangle we're in
    let i1: number;
    let j1: number;
    if (x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + (this.perm[jj] ?? 0)]! % 8;
    const gi1 = this.perm[ii + i1 + (this.perm[jj + j1] ?? 0)]! % 8;
    const gi2 = this.perm[ii + 1 + (this.perm[jj + 1] ?? 0)]! % 8;

    // Calculate contribution from the three corners
    let n0 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const g0 = SimplexNoise.GRAD2[gi0]!;
      n0 = t0 * t0 * (g0[0] * x0 + g0[1] * y0);
    }

    let n1 = 0;
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const g1 = SimplexNoise.GRAD2[gi1]!;
      n1 = t1 * t1 * (g1[0] * x1 + g1[1] * y1);
    }

    let n2 = 0;
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const g2 = SimplexNoise.GRAD2[gi2]!;
      n2 = t2 * t2 * (g2[0] * x2 + g2[1] * y2);
    }

    // Scale to [-1, 1]
    return 70 * (n0 + n1 + n2);
  }
}

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
