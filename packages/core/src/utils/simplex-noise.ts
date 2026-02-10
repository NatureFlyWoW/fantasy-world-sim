/**
 * 2D simplex noise generator seeded from SeededRNG.
 * Based on Stefan Gustavson's simplex noise implementation.
 *
 * This is the canonical SimplexNoise implementation for Æternum.
 * Other packages should import from @fws/core, not duplicate this code.
 */

import type { SeededRNG } from './seeded-rng.js';

/**
 * 2D simplex noise generator using a seeded RNG for initialization.
 * Produces smooth, continuous noise values in the range [-1, 1].
 *
 * Usage:
 * ```ts
 * const rng = new SeededRNG(12345);
 * const noise = new SimplexNoise(rng);
 * const value = noise.noise2D(x, y); // Returns [-1, 1]
 * ```
 */
export class SimplexNoise {
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
