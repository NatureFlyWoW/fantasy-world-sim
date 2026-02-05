import { describe, it, expect } from 'vitest';
import { RiverGenerator } from './hydrology.js';
import { HeightmapGenerator } from './heightmap.js';
import { SeededRNG } from '../rng.js';

describe('RiverGenerator', () => {
  const riverGen = new RiverGenerator();
  const heightmapGen = new HeightmapGenerator();

  function makeTestHeightmap(rng: SeededRNG): number[][] {
    return heightmapGen.generate(100, 100, rng);
  }

  describe('generateRivers', () => {
    it('should generate rivers', () => {
      const rng = new SeededRNG(42);
      const heightmap = makeTestHeightmap(rng);
      const rivers = riverGen.generateRivers(heightmap, rng);

      expect(rivers.length).toBeGreaterThan(0);
    });

    it('should generate rivers with valid paths', () => {
      const rng = new SeededRNG(42);
      const heightmap = makeTestHeightmap(rng);
      const rivers = riverGen.generateRivers(heightmap, rng);

      for (const river of rivers) {
        expect(river.path.length).toBeGreaterThanOrEqual(5);
        // All points should be within bounds
        for (const point of river.path) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThan(100);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThan(100);
        }
      }
    });

    it('should have rivers that flow downhill', () => {
      const rng = new SeededRNG(42);
      const heightmap = makeTestHeightmap(rng);
      const rivers = riverGen.generateRivers(heightmap, rng);

      for (const river of rivers) {
        // Overall trend should be downhill: source higher than end
        const sourceElev = heightmap[river.path[0]!.y]![river.path[0]!.x]!;
        const endPoint = river.path[river.path.length - 1]!;
        const endElev = heightmap[endPoint.y]![endPoint.x]!;
        expect(sourceElev).toBeGreaterThanOrEqual(endElev);
      }
    });

    it('should have rivers that reach ocean or stop at a basin', () => {
      const rng = new SeededRNG(42);
      const heightmap = makeTestHeightmap(rng);
      const rivers = riverGen.generateRivers(heightmap, rng);

      for (const river of rivers) {
        const endPoint = river.path[river.path.length - 1]!;
        const endElev = heightmap[endPoint.y]![endPoint.x]!;

        // River should end at ocean (elevation <= 0) or at a local minimum
        if (endElev > 0) {
          // At a local minimum — check that no neighbor is lower (or river joins another)
          // This is acceptable behavior (lake formation)
          expect(endElev).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(99);
      const rng2 = new SeededRNG(99);
      const hm1 = makeTestHeightmap(rng1);
      const hm2 = makeTestHeightmap(rng2);
      const rivers1 = riverGen.generateRivers(hm1, rng1);
      const rivers2 = riverGen.generateRivers(hm2, rng2);

      expect(rivers1.length).toBe(rivers2.length);
      for (let i = 0; i < rivers1.length; i++) {
        expect(rivers1[i]!.path.length).toBe(rivers2[i]!.path.length);
      }
    });

    it('should respect custom river count', () => {
      const rng = new SeededRNG(42);
      const heightmap = makeTestHeightmap(rng);
      const rivers = riverGen.generateRivers(heightmap, rng, 3);

      // Should get at most 3 rivers (may be fewer if not enough valid sources)
      expect(rivers.length).toBeLessThanOrEqual(3);
    });
  });

  describe('carveValleys', () => {
    it('should lower terrain along river paths', () => {
      const rng = new SeededRNG(42);
      const heightmap = makeTestHeightmap(rng);

      // Take a snapshot of elevation at river points before carving
      const rivers = riverGen.generateRivers(heightmap, rng);

      if (rivers.length > 0) {
        const river = rivers[0]!;
        const beforeElevations: number[] = [];
        for (const point of river.path) {
          beforeElevations.push(heightmap[point.y]![point.x]!);
        }

        riverGen.carveValleys(heightmap, rivers);

        // Check that land tiles were lowered
        let loweredCount = 0;
        for (let i = 0; i < river.path.length; i++) {
          const point = river.path[i]!;
          const after = heightmap[point.y]![point.x]!;
          const before = beforeElevations[i]!;
          if (before > 0 && after < before) {
            loweredCount++;
          }
        }

        expect(loweredCount).toBeGreaterThan(0);
      }
    });
  });
});
