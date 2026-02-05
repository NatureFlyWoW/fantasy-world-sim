/**
 * History module — pre-history simulation producing ruins, legends, and legacies.
 */

export { PreHistorySimulator } from './pre-history.js';
export type {
  PreHistoryResult,
  PreHistoryWorld,
  RuinSite,
  HistoricalWar,
  ReligiousEvent,
  LanguageTreeNode,
  CulturalLegacy,
} from './pre-history.js';

export { LegendaryFigureTracker } from './legendary-figures.js';
export type { LegendaryFigure, FigureRole, FigureContext } from './legendary-figures.js';

export { ArtifactForge } from './artifact-forge.js';
export type { LegendaryArtifact, ArtifactType, ForgeContext } from './artifact-forge.js';
