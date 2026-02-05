/**
 * Events module - Event system for simulation communication.
 */

// Types
export {
  EventCategory,
  type TickNumber,
  type ConsequenceRule,
  type WorldEvent,
  type EventHandler,
  type Unsubscribe,
} from './types.js';

// Event bus (pub/sub)
export { EventBus } from './event-bus.js';

// Event queue (priority queue)
export { EventQueue } from './event-queue.js';

// Event log (historical record)
export { EventLog } from './event-log.js';

// Event factory (creation helpers)
export {
  resetEventIdCounter,
  createEvent,
  createSimpleEvent,
  createConsequenceEvent,
  linkConsequence,
  type CreateEventOptions,
} from './event-factory.js';

// Cascade engine
export {
  CascadeEngine,
  type PendingConsequence,
  type CascadeResult,
  type RandomFn,
} from './cascade-engine.js';

// Dampening functions
export {
  calculateDampenedProbability,
  adjustDampeningForSignificance,
  shouldContinueCascade,
} from './dampening.js';

// Cross-domain transition rules
export {
  getTransitions,
  getTransitionModifier,
  hasTransition,
  getTargetCategories,
  type CrossDomainTransition,
} from './cross-domain-rules.js';

// Narrative arc detector
export {
  NarrativeArcDetector,
  ArcPhase,
  resetArcIdCounter,
  type NarrativeArc,
} from './narrative-arc-detector.js';
