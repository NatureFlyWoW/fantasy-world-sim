import { describe, it, expect } from 'vitest';
import { SeededRNG } from './rng.js';

describe('SeededRNG', () => {
  describe('determinism', () => {
    it('should produce the same sequence for the same seed', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const seq1 = Array.from({ length: 100 }, () => rng1.next());
      const seq2 = Array.from({ length: 100 }, () => rng2.next());

      expect(seq1).toEqual(seq2);
    });

    it('should produce different sequences for different seeds', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(43);

      const seq1 = Array.from({ length: 10 }, () => rng1.next());
      const seq2 = Array.from({ length: 10 }, () => rng2.next());

      expect(seq1).not.toEqual(seq2);
    });

    it('should be deterministic for nextInt', () => {
      const rng1 = new SeededRNG(99);
      const rng2 = new SeededRNG(99);

      const seq1 = Array.from({ length: 50 }, () => rng1.nextInt(0, 100));
      const seq2 = Array.from({ length: 50 }, () => rng2.nextInt(0, 100));

      expect(seq1).toEqual(seq2);
    });

    it('should return the seed via getSeed', () => {
      const rng = new SeededRNG(12345);
      expect(rng.getSeed()).toBe(12345);
    });
  });

  describe('next', () => {
    it('should produce values in [0, 1)', () => {
      const rng = new SeededRNG(1);
      for (let i = 0; i < 1000; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('nextInt', () => {
    it('should produce integers in [min, max]', () => {
      const rng = new SeededRNG(2);
      const min = 5;
      const max = 15;

      for (let i = 0; i < 1000; i++) {
        const val = rng.nextInt(min, max);
        expect(val).toBeGreaterThanOrEqual(min);
        expect(val).toBeLessThanOrEqual(max);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it('should return exact value when min equals max', () => {
      const rng = new SeededRNG(3);
      for (let i = 0; i < 10; i++) {
        expect(rng.nextInt(7, 7)).toBe(7);
      }
    });
  });

  describe('nextFloat', () => {
    it('should produce floats in [min, max)', () => {
      const rng = new SeededRNG(4);
      const min = -10;
      const max = 10;

      for (let i = 0; i < 1000; i++) {
        const val = rng.nextFloat(min, max);
        expect(val).toBeGreaterThanOrEqual(min);
        expect(val).toBeLessThan(max);
      }
    });
  });

  describe('pick', () => {
    it('should always pick from the array', () => {
      const rng = new SeededRNG(5);
      const items = ['a', 'b', 'c', 'd'];

      for (let i = 0; i < 100; i++) {
        const picked = rng.pick(items);
        expect(items).toContain(picked);
      }
    });

    it('should throw on empty array', () => {
      const rng = new SeededRNG(5);
      expect(() => rng.pick([])).toThrow('Cannot pick from an empty array');
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(6);
      const rng2 = new SeededRNG(6);
      const items = ['a', 'b', 'c', 'd', 'e'];

      const picks1 = Array.from({ length: 20 }, () => rng1.pick(items));
      const picks2 = Array.from({ length: 20 }, () => rng2.pick(items));

      expect(picks1).toEqual(picks2);
    });
  });

  describe('shuffle', () => {
    it('should contain the same elements after shuffle', () => {
      const rng = new SeededRNG(7);
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr = [...original];
      rng.shuffle(arr);

      expect(arr.sort((a, b) => a - b)).toEqual(original);
    });

    it('should return the same array reference', () => {
      const rng = new SeededRNG(8);
      const arr = [1, 2, 3];
      const result = rng.shuffle(arr);
      expect(result).toBe(arr);
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(9);
      const rng2 = new SeededRNG(9);

      const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
      const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];

      rng1.shuffle(arr1);
      rng2.shuffle(arr2);

      expect(arr1).toEqual(arr2);
    });

    it('should actually change the order for non-trivial arrays', () => {
      const rng = new SeededRNG(10);
      const arr = Array.from({ length: 20 }, (_, i) => i);
      const original = [...arr];
      rng.shuffle(arr);

      // With 20 elements, probability of identical order is 1/20! ≈ 0
      expect(arr).not.toEqual(original);
    });
  });

  describe('nextGaussian', () => {
    it('should produce values centered around the mean', () => {
      const rng = new SeededRNG(11);
      const mean = 50;
      const stddev = 10;
      const samples = Array.from({ length: 10000 }, () => rng.nextGaussian(mean, stddev));

      const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length;
      // With 10000 samples, mean should be within 1 of target
      expect(Math.abs(sampleMean - mean)).toBeLessThan(1);
    });

    it('should have approximately correct standard deviation', () => {
      const rng = new SeededRNG(12);
      const mean = 0;
      const stddev = 5;
      const samples = Array.from({ length: 10000 }, () => rng.nextGaussian(mean, stddev));

      const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length;
      const variance =
        samples.reduce((sum, v) => sum + (v - sampleMean) ** 2, 0) / samples.length;
      const sampleStddev = Math.sqrt(variance);

      // Within 0.5 of target stddev
      expect(Math.abs(sampleStddev - stddev)).toBeLessThan(0.5);
    });

    it('should default to mean=0 stddev=1', () => {
      const rng = new SeededRNG(13);
      const samples = Array.from({ length: 5000 }, () => rng.nextGaussian());

      const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(Math.abs(sampleMean)).toBeLessThan(0.1);
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(14);
      const rng2 = new SeededRNG(14);

      const seq1 = Array.from({ length: 50 }, () => rng1.nextGaussian(10, 3));
      const seq2 = Array.from({ length: 50 }, () => rng2.nextGaussian(10, 3));

      expect(seq1).toEqual(seq2);
    });
  });

  describe('weightedPick', () => {
    it('should respect weights', () => {
      const rng = new SeededRNG(15);
      const items = ['rare', 'common'];
      const weights = [1, 99];

      let rareCount = 0;
      const trials = 10000;
      for (let i = 0; i < trials; i++) {
        if (rng.weightedPick(items, weights) === 'rare') {
          rareCount++;
        }
      }

      // Rare should be picked ~1% of the time
      expect(rareCount / trials).toBeLessThan(0.05);
      expect(rareCount).toBeGreaterThan(0);
    });

    it('should throw on empty items', () => {
      const rng = new SeededRNG(16);
      expect(() => rng.weightedPick([], [])).toThrow('Cannot pick from empty items');
    });

    it('should throw on mismatched lengths', () => {
      const rng = new SeededRNG(17);
      expect(() => rng.weightedPick(['a', 'b'], [1])).toThrow(
        'Items and weights must have the same length'
      );
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(18);
      const rng2 = new SeededRNG(18);
      const items = ['a', 'b', 'c'];
      const weights = [10, 30, 60];

      const picks1 = Array.from({ length: 50 }, () => rng1.weightedPick(items, weights));
      const picks2 = Array.from({ length: 50 }, () => rng2.weightedPick(items, weights));

      expect(picks1).toEqual(picks2);
    });
  });

  describe('fork', () => {
    it('should create an independent child RNG', () => {
      const parent = new SeededRNG(20);

      const child1 = parent.fork('terrain');
      const child2 = parent.fork('names');

      const seq1 = Array.from({ length: 20 }, () => child1.next());
      const seq2 = Array.from({ length: 20 }, () => child2.next());

      // Different labels should produce different sequences
      expect(seq1).not.toEqual(seq2);
    });

    it('should be deterministic for same seed and label', () => {
      const parent1 = new SeededRNG(21);
      const parent2 = new SeededRNG(21);

      const child1 = parent1.fork('terrain');
      const child2 = parent2.fork('terrain');

      const seq1 = Array.from({ length: 50 }, () => child1.next());
      const seq2 = Array.from({ length: 50 }, () => child2.next());

      expect(seq1).toEqual(seq2);
    });

    it('should not affect the parent RNG state', () => {
      const rng1 = new SeededRNG(22);
      const rng2 = new SeededRNG(22);

      // Advance rng1, fork, then continue
      rng1.next();
      rng1.next();
      rng1.fork('test');
      const after1 = rng1.next();

      // Advance rng2 the same way, but don't fork
      rng2.next();
      rng2.next();
      const after2 = rng2.next();

      // fork() only creates a new RNG from baseSeed, doesn't consume parent state
      expect(after1).toBe(after2);
    });

    it('should produce different sequences for different parent seeds', () => {
      const parent1 = new SeededRNG(30);
      const parent2 = new SeededRNG(31);

      const child1 = parent1.fork('terrain');
      const child2 = parent2.fork('terrain');

      const seq1 = Array.from({ length: 10 }, () => child1.next());
      const seq2 = Array.from({ length: 10 }, () => child2.next());

      expect(seq1).not.toEqual(seq2);
    });
  });

  describe('edge cases', () => {
    it('should handle seed of 0', () => {
      const rng = new SeededRNG(0);
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });

    it('should handle negative seeds', () => {
      const rng = new SeededRNG(-999);
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });

    it('should handle very large seeds', () => {
      const rng = new SeededRNG(2147483647);
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });
  });
});
