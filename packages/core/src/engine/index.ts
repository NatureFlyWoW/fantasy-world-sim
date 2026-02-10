/**
 * Engine module - Simulation loop orchestration.
 */

// System interface
export {
  type System,
  BaseSystem,
  ExecutionOrder,
  type ExecutionOrderValue,
} from './system.js';

// System registry
export { SystemRegistry } from './system-registry.js';

// Simulation engine
export { SimulationEngine, type TickCallback } from './simulation-engine.js';

// Level of detail manager
export {
  LevelOfDetailManager,
  type DetailLevel,
  type Position,
  LOD_CONSTANTS,
} from './lod-manager.js';

// Engine factory
export {
  createSimulationEngine,
  type CharacterInitData,
  type EngineCreationResult,
} from './engine-factory.js';
