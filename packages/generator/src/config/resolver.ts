/**
 * Resolves named configuration settings to concrete numeric values.
 */

import type {
  WorldConfig,
  WorldSize,
  CivilizationDensity,
  HistoricalDepth,
  RaceDiversity,
} from './types.js';

/**
 * Resolve a WorldSize to grid dimensions.
 */
export function resolveGridSize(worldSize: WorldSize): { width: number; height: number } {
  switch (worldSize) {
    case 'small':  return { width: 200, height: 200 };
    case 'medium': return { width: 400, height: 400 };
    case 'large':  return { width: 800, height: 800 };
    case 'epic':   return { width: 1600, height: 1600 };
  }
}

/**
 * Base civilization count range per world size.
 */
const BASE_CIV_COUNT: Record<WorldSize, { min: number; max: number }> = {
  small:  { min: 2, max: 4 },
  medium: { min: 4, max: 8 },
  large:  { min: 8, max: 16 },
  epic:   { min: 16, max: 32 },
};

/**
 * Density multiplier applied to civilization counts.
 */
const DENSITY_MULTIPLIER: Record<CivilizationDensity, number> = {
  sparse:  0.5,
  normal:  1.0,
  dense:   1.5,
  crowded: 2.0,
};

/**
 * Resolve civilization count range based on world size and density.
 */
export function resolveCivCount(
  worldSize: WorldSize,
  density: CivilizationDensity
): { min: number; max: number } {
  const base = BASE_CIV_COUNT[worldSize];
  const mult = DENSITY_MULTIPLIER[density];
  return {
    min: Math.max(1, Math.round(base.min * mult)),
    max: Math.max(1, Math.round(base.max * mult)),
  };
}

/**
 * Resolve historical depth to number of simulated years.
 */
export function resolveHistoricalYears(depth: HistoricalDepth): number {
  switch (depth) {
    case 'shallow':  return 100;
    case 'moderate': return 500;
    case 'deep':     return 2000;
    case 'ancient':  return 10000;
  }
}

/**
 * Resolve race diversity to a race count range.
 */
export function resolveRaceCount(diversity: RaceDiversity): { min: number; max: number } {
  switch (diversity) {
    case 'homogeneous': return { min: 1, max: 2 };
    case 'standard':    return { min: 3, max: 5 };
    case 'diverse':     return { min: 6, max: 10 };
    case 'myriad':      return { min: 11, max: 20 };
  }
}

const VALID_WORLD_SIZES: readonly string[] = ['small', 'medium', 'large', 'epic'];
const VALID_MAGIC: readonly string[] = ['mundane', 'low', 'moderate', 'high', 'ubiquitous'];
const VALID_DENSITY: readonly string[] = ['sparse', 'normal', 'dense', 'crowded'];
const VALID_DANGER: readonly string[] = ['peaceful', 'moderate', 'dangerous', 'apocalyptic'];
const VALID_DEPTH: readonly string[] = ['shallow', 'moderate', 'deep', 'ancient'];
const VALID_GEO: readonly string[] = ['dormant', 'normal', 'active', 'volatile'];
const VALID_RACE: readonly string[] = ['homogeneous', 'standard', 'diverse', 'myriad'];
const VALID_PANTHEON: readonly string[] = ['atheistic', 'deistic', 'theistic', 'interventionist'];
const VALID_TECH: readonly string[] = ['stone_age', 'bronze_age', 'iron_age', 'renaissance'];

/**
 * Validate a WorldConfig, returning any errors found.
 */
export function validateConfig(config: WorldConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof config.seed !== 'number' || !Number.isFinite(config.seed)) {
    errors.push('seed must be a finite number');
  }

  if (!VALID_WORLD_SIZES.includes(config.worldSize)) {
    errors.push(`invalid worldSize: ${String(config.worldSize)}`);
  }
  if (!VALID_MAGIC.includes(config.magicPrevalence)) {
    errors.push(`invalid magicPrevalence: ${String(config.magicPrevalence)}`);
  }
  if (!VALID_DENSITY.includes(config.civilizationDensity)) {
    errors.push(`invalid civilizationDensity: ${String(config.civilizationDensity)}`);
  }
  if (!VALID_DANGER.includes(config.dangerLevel)) {
    errors.push(`invalid dangerLevel: ${String(config.dangerLevel)}`);
  }
  if (!VALID_DEPTH.includes(config.historicalDepth)) {
    errors.push(`invalid historicalDepth: ${String(config.historicalDepth)}`);
  }
  if (!VALID_GEO.includes(config.geologicalActivity)) {
    errors.push(`invalid geologicalActivity: ${String(config.geologicalActivity)}`);
  }
  if (!VALID_RACE.includes(config.raceDiversity)) {
    errors.push(`invalid raceDiversity: ${String(config.raceDiversity)}`);
  }
  if (!VALID_PANTHEON.includes(config.pantheonComplexity)) {
    errors.push(`invalid pantheonComplexity: ${String(config.pantheonComplexity)}`);
  }
  if (!VALID_TECH.includes(config.technologyEra)) {
    errors.push(`invalid technologyEra: ${String(config.technologyEra)}`);
  }

  return { valid: errors.length === 0, errors };
}
