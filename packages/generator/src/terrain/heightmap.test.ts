import { describe, it, expect } from 'vitest';
import { HeightmapGenerator } from './heightmap.js';
import { SeededRNG } from '../rng.js';

describe('HeightmapGenerator', () => {
  const generator = new HeightmapGenerator();

  describe('generate', () => {
    it('should produce a heightmap of the correct dimensions', () => {
      const rng = new SeededRNG(42);
      const map = generator.generate(50, 40, rng);

      expect(map).toHaveLength(40);
      for (const row of map) {
        expect(row).toHaveLength(50);
      }
    });

    it('should produce values within [-1000, 10000]', () => {
      const rng = new SeededRNG(42);
      const map = generator.generate(100, 100, rng);

      for (const row of map) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(-1000);
          expect(val).toBeLessThanOrEqual(10000);
        }
      }
    });

    it('should be deterministic — same seed produces same map', () => {
      const rng1 = new SeededRNG(123);
      const rng2 = new SeededRNG(123);
      const map1 = generator.generate(50, 50, rng1);
      const map2 = generator.generate(50, 50, rng2);

      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          expect(map1[y]![x]).toBe(map2[y]![x]);
        }
      }
    });

    it('should produce different maps for different seeds', () => {
      const rng1 = new SeededRNG(1);
      const rng2 = new SeededRNG(2);
      const map1 = generator.generate(50, 50, rng1);
      const map2 = generator.generate(50, 50, rng2);

      let differences = 0;
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          if (map1[y]![x] !== map2[y]![x]) differences++;
        }
      }

      // Most tiles should differ
      expect(differences).toBeGreaterThan(1000);
    });

    it('should have lower values at map edges (island mask)', () => {
      const rng = new SeededRNG(42);
      const map = generator.generate(100, 100, rng);

      // Sample edge tiles
      let edgeSum = 0;
      let edgeCount = 0;
      let centerSum = 0;
      let centerCount = 0;

      for (let y = 0; y < 100; y++) {
        for (let x = 0; x < 100; x++) {
          const val = map[y]![x]!;
          if (x < 5 || x > 94 || y < 5 || y > 94) {
            edgeSum += val;
            edgeCount++;
          } else if (x > 30 && x < 70 && y > 30 && y < 70) {
            centerSum += val;
            centerCount++;
          }
        }
      }

      const edgeAvg = edgeSum / edgeCount;
      const centerAvg = centerSum / centerCount;

      // Edges should be lower than center on average
      expect(edgeAvg).toBeLessThan(centerAvg);
    });

    it('should produce a mix of ocean and land', () => {
      const rng = new SeededRNG(42);
      const map = generator.generate(100, 100, rng);

      let oceanCount = 0;
      let landCount = 0;

      for (const row of map) {
        for (const val of row) {
          if (val <= 0) oceanCount++;
          else landCount++;
        }
      }

      // Should have both ocean and land
      expect(oceanCount).toBeGreaterThan(0);
      expect(landCount).toBeGreaterThan(0);
    });
  });
});
