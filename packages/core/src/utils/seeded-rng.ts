/**
 * Seeded pseudo-random number generator using xoshiro128**.
 * Deterministic: same seed always produces the same sequence.
 */

/**
 * Splitmix32 — used to initialize xoshiro128** state from a single seed.
 */
function splitmix32(seed: number): () => number {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x9e3779b9) | 0;
    let t = state ^ (state >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}

/**
 * Hash a string label into a 32-bit integer for fork seeding.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash;
}

export class SeededRNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  private readonly baseSeed: number;

  /** Cached value for Box-Muller nextGaussian */
  private hasSpare = false;
  private spare = 0;

  constructor(seed: number) {
    this.baseSeed = seed;
    // Initialize state via splitmix32
    const init = splitmix32(seed);
    this.s0 = init();
    this.s1 = init();
    this.s2 = init();
    this.s3 = init();

    // Ensure state is non-zero
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      this.s0 = 1;
    }
  }

  /**
   * Generate the next random number in [0, 1).
   */
  next(): number {
    const result = this.xoshiro128ss();
    return result / 4294967296; // 2^32
  }

  /**
   * Random integer in [min, max] (inclusive).
   */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * Random float in [min, max).
   */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Pick a random element from an array.
   * Throws if the array is empty.
   */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    const index = this.nextInt(0, array.length - 1);
    return array[index] as T;
  }

  /**
   * Shuffle an array in-place using Fisher-Yates.
   * Returns the same array reference.
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = array[i] as T;
      array[i] = array[j] as T;
      array[j] = temp;
    }
    return array;
  }

  /**
   * Generate a normally distributed random number using Box-Muller transform.
   */
  nextGaussian(mean: number = 0, stddev: number = 1): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return mean + stddev * this.spare;
    }

    let u: number;
    let v: number;
    let s: number;

    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);

    const mul = Math.sqrt(-2 * Math.log(s) / s);
    this.spare = v * mul;
    this.hasSpare = true;

    return mean + stddev * u * mul;
  }

  /**
   * Pick a random element from an array with weighted probabilities.
   * Weights do not need to sum to 1.
   * Throws if arrays are empty or different lengths.
   */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty items');
    }
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have the same length');
    }

    let totalWeight = 0;
    for (const w of weights) {
      totalWeight += w;
    }

    let roll = this.next() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll <= 0) {
        return items[i] as T;
      }
    }

    // Fallback (floating point edge case)
    return items[items.length - 1] as T;
  }

  /**
   * Create a child RNG with an independent stream derived from a label.
   * This ensures e.g. terrain generation doesn't affect name generation.
   */
  fork(label: string): SeededRNG {
    const labelHash = hashString(label);
    return new SeededRNG((this.baseSeed ^ labelHash) >>> 0);
  }

  /**
   * Get the original seed used to create this RNG.
   */
  getSeed(): number {
    return this.baseSeed;
  }

  /**
   * xoshiro128** core — returns a 32-bit unsigned integer.
   */
  private xoshiro128ss(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;

    const t = this.s1 << 9;

    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;

    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);

    return result;
  }
}

/**
 * 32-bit left rotation.
 */
function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}
