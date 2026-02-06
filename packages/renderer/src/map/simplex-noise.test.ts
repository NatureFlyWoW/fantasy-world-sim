/**
 * Tests for the renderer's self-contained SimplexNoise.
 */

import { describe, it, expect } from 'vitest';
import { SimplexNoise, fbm } from './simplex-noise.js';

describe('SimplexNoise', () => {
  it('output range is always [-1, 1]', () => {
    const noise = new SimplexNoise(42);
    for (let x = -50; x <= 50; x++) {
      for (let y = -50; y <= 50; y++) {
        const v = noise.noise2D(x * 0.1, y * 0.1);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic: same seed + coords = same value', () => {
    const noise1 = new SimplexNoise(123);
    const noise2 = new SimplexNoise(123);
    for (let i = 0; i < 20; i++) {
      const x = i * 0.37;
      const y = i * 0.53;
      expect(noise1.noise2D(x, y)).toBe(noise2.noise2D(x, y));
    }
  });

  it('different seeds produce different values', () => {
    const noise1 = new SimplexNoise(1);
    const noise2 = new SimplexNoise(999);
    let diffCount = 0;
    for (let i = 0; i < 20; i++) {
      if (noise1.noise2D(i * 0.5, i * 0.5) !== noise2.noise2D(i * 0.5, i * 0.5)) {
        diffCount++;
      }
    }
    expect(diffCount).toBeGreaterThan(10);
  });

  it('nearby coordinates produce similar values (smoothness)', () => {
    const noise = new SimplexNoise(42);
    const v1 = noise.noise2D(5.0, 5.0);
    const v2 = noise.noise2D(5.01, 5.01);
    expect(Math.abs(v1 - v2)).toBeLessThan(0.1);
  });

  it('works with seed 0', () => {
    const noise = new SimplexNoise(0);
    const v = noise.noise2D(1.5, 2.5);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('works with negative seeds', () => {
    const noise = new SimplexNoise(-42);
    const v = noise.noise2D(3.0, 4.0);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('10x10 grid produces 5+ distinct values', () => {
    const noise = new SimplexNoise(42);
    const values = new Set<number>();
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        values.add(Math.round(noise.noise2D(x * 0.3, y * 0.3) * 1000));
      }
    }
    expect(values.size).toBeGreaterThanOrEqual(5);
  });

  it('different seeds produce different landscapes at the same offset coords', () => {
    // Using non-origin coords (simplex noise is zero at integer lattice points)
    const values = new Set<number>();
    for (let s = 0; s < 10; s++) {
      const noise = new SimplexNoise(s * 100);
      values.add(Math.round(noise.noise2D(0.73, 1.29) * 1000));
    }
    expect(values.size).toBeGreaterThanOrEqual(2);
  });
});

describe('fbm', () => {
  it('output is within [-1, 1]', () => {
    const noise = new SimplexNoise(42);
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        const v = fbm(noise, x * 0.1, y * 0.1, 4, 2.0, 0.5);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic', () => {
    const noise1 = new SimplexNoise(42);
    const noise2 = new SimplexNoise(42);
    expect(fbm(noise1, 3.5, 7.2, 4, 2.0, 0.5)).toBe(
      fbm(noise2, 3.5, 7.2, 4, 2.0, 0.5)
    );
  });
});
