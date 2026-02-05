/**
 * Named preset configurations for common world generation scenarios.
 */

import type { WorldConfig } from './types.js';

/**
 * Available preset names.
 */
export type PresetName =
  | 'standard_fantasy'
  | 'low_magic'
  | 'high_chaos'
  | 'classical_era'
  | 'kitchen_sink';

/**
 * A preset is a WorldConfig without a seed (seed is always user-provided).
 */
export type PresetConfig = Omit<WorldConfig, 'seed'>;

const PRESETS: Record<PresetName, PresetConfig> = {
  standard_fantasy: {
    worldSize: 'medium',
    magicPrevalence: 'moderate',
    civilizationDensity: 'normal',
    dangerLevel: 'moderate',
    historicalDepth: 'moderate',
    geologicalActivity: 'normal',
    raceDiversity: 'standard',
    pantheonComplexity: 'theistic',
    technologyEra: 'iron_age',
  },

  low_magic: {
    worldSize: 'medium',
    magicPrevalence: 'low',
    civilizationDensity: 'normal',
    dangerLevel: 'moderate',
    historicalDepth: 'deep',
    geologicalActivity: 'normal',
    raceDiversity: 'homogeneous',
    pantheonComplexity: 'deistic',
    technologyEra: 'iron_age',
  },

  high_chaos: {
    worldSize: 'large',
    magicPrevalence: 'high',
    civilizationDensity: 'dense',
    dangerLevel: 'dangerous',
    historicalDepth: 'deep',
    geologicalActivity: 'active',
    raceDiversity: 'diverse',
    pantheonComplexity: 'interventionist',
    technologyEra: 'iron_age',
  },

  classical_era: {
    worldSize: 'medium',
    magicPrevalence: 'mundane',
    civilizationDensity: 'normal',
    dangerLevel: 'moderate',
    historicalDepth: 'moderate',
    geologicalActivity: 'normal',
    raceDiversity: 'homogeneous',
    pantheonComplexity: 'atheistic',
    technologyEra: 'bronze_age',
  },

  kitchen_sink: {
    worldSize: 'large',
    magicPrevalence: 'ubiquitous',
    civilizationDensity: 'crowded',
    dangerLevel: 'apocalyptic',
    historicalDepth: 'ancient',
    geologicalActivity: 'volatile',
    raceDiversity: 'myriad',
    pantheonComplexity: 'interventionist',
    technologyEra: 'renaissance',
  },
};

/**
 * Get all available preset names.
 */
export function getPresetNames(): readonly PresetName[] {
  return Object.keys(PRESETS) as PresetName[];
}

/**
 * Get a preset configuration by name.
 */
export function getPreset(name: PresetName): PresetConfig {
  return PRESETS[name];
}

/**
 * Create a full WorldConfig from a preset and a seed.
 */
export function configFromPreset(name: PresetName, seed: number): WorldConfig {
  return { ...PRESETS[name], seed };
}
