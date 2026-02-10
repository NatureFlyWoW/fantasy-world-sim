import { describe, it, expect } from 'vitest';
import { SimplexNoise } from './simplex-noise.js';
import { SeededRNG } from './seeded-rng.js';

describe('SimplexNoise', () => {
  it('produces deterministic noise from seeded RNG', () => {
    const rng1 = new SeededRNG(12345);
    const noise1 = new SimplexNoise(rng1);

    const rng2 = new SeededRNG(12345);
    const noise2 = new SimplexNoise(rng2);

    // Same seed should produce identical noise
    expect(noise1.noise2D(0, 0)).toBe(noise2.noise2D(0, 0));
    expect(noise1.noise2D(1, 1)).toBe(noise2.noise2D(1, 1));
    expect(noise1.noise2D(5.5, 3.2)).toBe(noise2.noise2D(5.5, 3.2));
  });

  it('produces different noise from different seeds', () => {
    const rng1 = new SeededRNG(12345);
    const noise1 = new SimplexNoise(rng1);

    const rng2 = new SeededRNG(54321);
    const noise2 = new SimplexNoise(rng2);

    // Different seeds should produce different noise (avoid origin — always 0)
    expect(noise1.noise2D(3.7, 8.2)).not.toBe(noise2.noise2D(3.7, 8.2));
    expect(noise1.noise2D(1.5, 1.5)).not.toBe(noise2.noise2D(1.5, 1.5));
  });

  it('returns values in the range [-1, 1]', () => {
    const rng = new SeededRNG(42);
    const noise = new SimplexNoise(rng);

    // Test many coordinates
    for (let x = -10; x <= 10; x += 0.5) {
      for (let y = -10; y <= 10; y += 0.5) {
        const value = noise.noise2D(x, y);
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('produces smooth continuous values', () => {
    const rng = new SeededRNG(999);
    const noise = new SimplexNoise(rng);

    // Adjacent samples should be relatively close
    const v1 = noise.noise2D(5.0, 5.0);
    const v2 = noise.noise2D(5.01, 5.0);
    const v3 = noise.noise2D(5.0, 5.01);

    // Simplex noise is continuous, so tiny steps should give similar values
    expect(Math.abs(v2 - v1)).toBeLessThan(0.1);
    expect(Math.abs(v3 - v1)).toBeLessThan(0.1);
  });
});
