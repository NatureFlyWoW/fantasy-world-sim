/**
 * World generation configuration — types, presets, resolvers.
 */

export type {
  WorldSize,
  MagicPrevalence,
  CivilizationDensity,
  DangerLevel,
  HistoricalDepth,
  GeologicalActivity,
  RaceDiversity,
  PantheonComplexity,
  TechnologyEra,
  WorldConfig,
} from './types.js';

export type { PresetName, PresetConfig } from './presets.js';
export { getPresetNames, getPreset, configFromPreset } from './presets.js';

export {
  resolveGridSize,
  resolveCivCount,
  resolveHistoricalYears,
  resolveRaceCount,
  validateConfig,
} from './resolver.js';
