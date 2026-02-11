/**
 * @fws/core - ECS engine, simulation loop, event system, time management, level-of-detail manager
 */

// ECS module
export * from './ecs/index.js';

// Events module
export * from './events/index.js';

// Time module
export * from './time/index.js';

// Engine module
export * from './engine/index.js';

// Spatial module
export * from './spatial/index.js';

// Systems module
export * from './systems/index.js';

// Note: Persistence module is NOT exported through barrel to avoid pulling
// Node.js dependencies (zlib from save-manager) into browser contexts.
// Node.js entry points (CLI) import persistence directly.
// Type-only re-exports are safe (erased at runtime):
export type {
  DivergenceAction,
  Branch,
  BranchResult,
  WorldSnapshot,
  ComponentSnapshot,
  SaveMetadata,
  ExportFormat,
  ExportOptions,
} from './persistence/index.js';

// Utils module
export * from './utils/index.js';
