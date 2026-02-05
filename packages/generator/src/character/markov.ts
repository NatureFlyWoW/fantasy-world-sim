/**
 * Markov chain name generator.
 * Learns character-level patterns from training data and generates
 * new names that "feel" similar to the input corpus.
 */

import type { SeededRNG } from '../rng.js';

/**
 * End-of-name sentinel character.
 */
const END = '\0';

export class MarkovChainGenerator {
  private readonly order: number;
  private readonly transitions: Map<string, Map<string, number>> = new Map();
  private readonly starts: string[] = [];

  /**
   * @param order — number of characters to use as context (2-3 for names, 3-4 for places)
   * @param trainingData — array of example names to learn from
   */
  constructor(order: number, trainingData: readonly string[]) {
    this.order = order;
    this.train(trainingData);
  }

  /**
   * Generate a single name within length bounds.
   */
  generate(minLength: number, maxLength: number, rng: SeededRNG): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = this.generateOne(maxLength, rng);
      if (result.length >= minLength && result.length <= maxLength) {
        return result.charAt(0).toUpperCase() + result.slice(1);
      }
    }
    // Fallback: capitalize a random start pattern
    const fallback = this.starts.length > 0 ? rng.pick(this.starts) : 'name';
    return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  }

  /**
   * Generate multiple unique names.
   */
  generateMultiple(
    count: number,
    rng: SeededRNG,
    minLength: number = 3,
    maxLength: number = 10
  ): string[] {
    const results: string[] = [];
    const used = new Set<string>();

    for (let attempt = 0; results.length < count && attempt < count * 10; attempt++) {
      const name = this.generate(minLength, maxLength, rng);
      const lower = name.toLowerCase();
      if (!used.has(lower)) {
        used.add(lower);
        results.push(name);
      }
    }

    return results;
  }

  /**
   * Build the transition table from training data.
   */
  private train(data: readonly string[]): void {
    for (const word of data) {
      const lower = word.toLowerCase();
      if (lower.length < this.order) continue;

      // Record start pattern
      this.starts.push(lower.substring(0, this.order));

      // Build transitions
      for (let i = 0; i <= lower.length - this.order; i++) {
        const key = lower.substring(i, i + this.order);
        const next = i + this.order < lower.length ? lower.charAt(i + this.order) : END;

        let trans = this.transitions.get(key);
        if (trans === undefined) {
          trans = new Map();
          this.transitions.set(key, trans);
        }
        trans.set(next, (trans.get(next) ?? 0) + 1);
      }
    }
  }

  /**
   * Generate a single name (lowercase) using the chain.
   */
  private generateOne(maxLength: number, rng: SeededRNG): string {
    if (this.starts.length === 0) return '';

    let result = rng.pick(this.starts);

    for (let i = 0; i < maxLength - this.order; i++) {
      const key = result.substring(result.length - this.order);
      const trans = this.transitions.get(key);
      if (trans === undefined) break;

      // Weighted pick from transitions
      const entries = [...trans.entries()];
      const chars = entries.map(e => e[0]);
      const weights = entries.map(e => e[1]);
      const next = rng.weightedPick(chars, weights);

      if (next === END) break;
      result += next;
    }

    return result;
  }
}
