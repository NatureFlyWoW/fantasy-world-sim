/**
 * Vignettes module - micro-narrative passages that bring key moments to life.
 */

// Vignette trigger system
export {
  EmotionalContent,
  VignetteArchetype,
  TriggerConditionType,
  VignetteMood,
  VignetteTrigger,
} from './vignette-trigger.js';

export type {
  TriggerCondition,
  VignetteTriggerResult,
  VignetteTriggerContext,
} from './vignette-trigger.js';

// Vignette generator
export { VignetteGenerator } from './vignette-generator.js';

export type {
  Vignette,
  VignetteGeneratorContext,
} from './vignette-generator.js';
