/**
 * World generation configuration types.
 * All parameters from design doc Section 3.1.
 */

/**
 * World grid size preset.
 * small: 200×200, medium: 400×400, large: 800×800, epic: 1600×1600
 */
export type WorldSize = 'small' | 'medium' | 'large' | 'epic';

/**
 * How prevalent magic is in the world.
 */
export type MagicPrevalence = 'mundane' | 'low' | 'moderate' | 'high' | 'ubiquitous';

/**
 * How densely civilizations populate the world.
 */
export type CivilizationDensity = 'sparse' | 'normal' | 'dense' | 'crowded';

/**
 * How dangerous the world is for its inhabitants.
 */
export type DangerLevel = 'peaceful' | 'moderate' | 'dangerous' | 'apocalyptic';

/**
 * How far back the simulated history extends.
 * shallow: 100 years, moderate: 500, deep: 2000, ancient: 10000
 */
export type HistoricalDepth = 'shallow' | 'moderate' | 'deep' | 'ancient';

/**
 * How geologically active the world is (volcanoes, earthquakes, etc.).
 */
export type GeologicalActivity = 'dormant' | 'normal' | 'active' | 'volatile';

/**
 * How many distinct races inhabit the world.
 * homogeneous: 1-2, standard: 3-5, diverse: 6-10, myriad: 11+
 */
export type RaceDiversity = 'homogeneous' | 'standard' | 'diverse' | 'myriad';

/**
 * How complex and interventionist the divine pantheon is.
 */
export type PantheonComplexity = 'atheistic' | 'deistic' | 'theistic' | 'interventionist';

/**
 * The starting technological era for civilizations.
 */
export type TechnologyEra = 'stone_age' | 'bronze_age' | 'iron_age' | 'renaissance';

/**
 * Complete world generation configuration.
 */
export interface WorldConfig {
  /** Seed for deterministic generation */
  readonly seed: number;
  /** World grid size */
  readonly worldSize: WorldSize;
  /** Magic prevalence level */
  readonly magicPrevalence: MagicPrevalence;
  /** Civilization density */
  readonly civilizationDensity: CivilizationDensity;
  /** World danger level */
  readonly dangerLevel: DangerLevel;
  /** How far back history extends */
  readonly historicalDepth: HistoricalDepth;
  /** Geological activity level */
  readonly geologicalActivity: GeologicalActivity;
  /** Number of distinct races */
  readonly raceDiversity: RaceDiversity;
  /** Divine pantheon complexity */
  readonly pantheonComplexity: PantheonComplexity;
  /** Starting technology era */
  readonly technologyEra: TechnologyEra;
}
