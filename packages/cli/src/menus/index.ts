/**
 * Menus module — refinement UI for post-generation adjustments.
 */

export { RefinementMenu } from './refinement-menu.js';
export type { WorldSummary, WorldSummarySection } from './refinement-menu.js';

export { RefinementValidator } from './refinement-validator.js';
export type { ValidationResult } from './refinement-validator.js';

export { RefinementApplier } from './refinement-applier.js';

export type {
  GeneratedWorldState,
  RefinementAction,
  MoveSettlementAction,
  ResizeTerritoryAction,
  AdjustPopulationAction,
  CreateCharacterAction,
  RemoveCharacterAction,
  EstablishAllianceAction,
  EstablishConflictAction,
  PlaceLandmarkAction,
  PlaceArtifactAction,
  ModifyBiomeAction,
  SeedEventAction,
  RefinementLogEntry,
  RefinementResult,
  Landmark,
  SeededEvent,
} from './refinement-types.js';
