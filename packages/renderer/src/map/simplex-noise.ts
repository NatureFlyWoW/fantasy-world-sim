/**
 * Re-export SimplexNoise from @fws/core with a convenience wrapper
 * that accepts plain number seeds (the renderer's existing API).
 *
 * This preserves the renderer's existing API while using the canonical
 * SimplexNoise implementation from @fws/core.
 */

import { SeededRNG, SimplexNoise as CoreSimplexNoise } from '@fws/core';

/**
 * SimplexNoise wrapper that accepts a plain number seed.
 * Internally constructs a SeededRNG and uses the core SimplexNoise.
 */
export class SimplexNoise {
  private readonly impl: CoreSimplexNoise;

  constructor(seed: number) {
    const rng = new SeededRNG(seed);
    this.impl = new CoreSimplexNoise(rng);
  }

  /**
   * Evaluate 2D simplex noise at (x, y). Returns value in [-1, 1].
   */
  noise2D(x: number, y: number): number {
    return this.impl.noise2D(x, y);
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
