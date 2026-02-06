/**
 * Chronicler module - in-world narrators with biases and limitations.
 */

// Main chronicler types and registry
export {
  ChroniclerIdeology,
  WritingStyle,
  BiasStrength,
  BiasType,
  ChroniclerRegistry,
  createChronicler,
} from './chronicler.js';

export type {
  Chronicler,
  ChroniclerKnowledge,
  FactionRelation,
  ChroniclerInterest,
  ChroniclerAvoidance,
  ChroniclerOutput,
  AppliedBias,
} from './chronicler.js';

// Bias filter
export { ChroniclerBiasFilter } from './bias-filter.js';

export type { BiasFilterContext } from './bias-filter.js';

// Lost history tracker
export {
  LossReason,
  PreservationQuality,
  ChronicleFeature,
  LostHistoryTracker,
} from './lost-history.js';

export type {
  Chronicle,
  LossRecord,
  LossEvent,
} from './lost-history.js';
