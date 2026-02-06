/**
 * Persistence module — snapshot & branching for "What If" timelines.
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
