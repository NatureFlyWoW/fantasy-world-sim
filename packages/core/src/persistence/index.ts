/**
 * Persistence module — snapshot, branching, save/load, and export.
 */

// Snapshot
export {
  WorldSnapshotManager,
  resetSnapshotIdCounter,
} from './world-snapshot.js';
export type {
  WorldSnapshot,
  ComponentSnapshot,
} from './world-snapshot.js';

// Branch runner
export {
  BranchRunner,
  MAX_BRANCHES,
  resetBranchIdCounter,
} from './branch-runner.js';
export type {
  ReverseOutcome,
  RemoveCharacter,
  ChangeDecision,
  AddEvent,
  DifferentSeed,
  DivergenceAction,
  Branch,
  BranchResult,
  EngineFactory,
} from './branch-runner.js';

// Save manager
export {
  SaveManager,
  serializeValue,
  deserializeValue,
  resetSaveIdCounter,
} from './save-manager.js';
export type {
  SaveMetadata,
  SaveFile,
  SaveStorage,
} from './save-manager.js';

// Export manager
export {
  ExportManager,
} from './export-manager.js';
export type {
  ExportFormat,
  ExportOptions,
} from './export-manager.js';
