/**
 * Self-contained 2D simplex noise with splitmix32 seeding.
 * Adapted from the generator's SimplexNoise to avoid cross-package dependency.
 * Based on Stefan Gustavson's simplex noise implementation.
 */

/**
 * Splitmix32 PRNG — fast, well-distributed 32-bit generator.
 * Used to build the permutation table from a seed.
 */
function splitmix32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return (t >>> 0) / 4294967296; // [0, 1)
  };
}

/**
 * 2D simplex noise generator seeded from a plain number.
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

  constructor(seed: number) {
    const rng = splitmix32(seed);

    // Build a permutation table
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    // Fisher-Yates shuffle using the seeded PRNG
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
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
export function fbm(
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
