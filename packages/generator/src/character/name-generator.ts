/**
 * NameGenerator — facade for all name generation needs.
 * Routes requests to the appropriate NameCulture.
 */

import type { SeededRNG } from '../rng.js';
import type { NameCulture } from './name-culture.js';

/**
 * A generated person name with first and family components.
 */
export interface PersonName {
  readonly first: string;
  readonly family: string;
}

export class NameGenerator {
  private readonly cultures: Map<string, NameCulture>;

  constructor(cultures: Map<string, NameCulture>) {
    this.cultures = cultures;
  }

  /**
   * Generate a personal name in the given culture.
   */
  generatePersonName(
    culture: string,
    gender: 'male' | 'female',
    rng: SeededRNG
  ): PersonName {
    const c = this.getCultureOrThrow(culture);
    return {
      first: c.personalName(gender, rng),
      family: c.familyName(rng),
    };
  }

  /**
   * Generate a place name in the given culture.
   */
  generatePlaceName(
    culture: string,
    _featureType: string,
    rng: SeededRNG
  ): string {
    const c = this.getCultureOrThrow(culture);
    return c.placeName(rng);
  }

  /**
   * Generate an artifact name in the given culture.
   */
  generateArtifactName(culture: string, rng: SeededRNG): string {
    const c = this.getCultureOrThrow(culture);
    return c.artifactName(rng);
  }

  /**
   * Generate a faction name in the given culture.
   */
  generateFactionName(culture: string, rng: SeededRNG): string {
    const c = this.getCultureOrThrow(culture);
    return c.factionName(rng);
  }

  /**
   * Generate a spell name in the given culture.
   */
  generateSpellName(culture: string, rng: SeededRNG): string {
    const c = this.getCultureOrThrow(culture);
    return c.spellName(rng);
  }

  /**
   * Check whether a culture is available.
   */
  hasCulture(culture: string): boolean {
    return this.cultures.has(culture);
  }

  /**
   * Get the culture or throw.
   */
  private getCultureOrThrow(culture: string): NameCulture {
    const c = this.cultures.get(culture);
    if (c === undefined) {
      throw new Error(`Unknown name culture: '${culture}'`);
    }
    return c;
  }
}
