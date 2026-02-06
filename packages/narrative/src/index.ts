/**
 * @fws/narrative - Event-to-prose transformation, template engine, chronicler system, vignettes
 */

// Template types and constants
export {
  NarrativeTone,
  PRONOUNS,
  DEFAULT_ENGINE_CONFIG,
} from './templates/types.js';

export type {
  NarrativeTemplate,
  NarrativeOutput,
  NarrativeEngineConfig,
  TemplateContext,
  EntityResolver,
  ResolvedEntity,
  Gender,
  PronounSet,
  SignificanceRange,
} from './templates/types.js';

// Template collections
export {
  ALL_TEMPLATES,
  getTemplateStats,
  politicalTemplates,
  militaryTemplates,
  personalTemplates,
  magicalTemplates,
  religiousTemplates,
  culturalTemplates,
  economicTemplates,
  disasterTemplates,
  secretTemplates,
  ecologicalTemplates,
} from './templates/index.js';

// Template parser
export {
  TemplateParser,
  createDefaultResolver,
} from './transforms/template-parser.js';

export type {
  Token,
  TokenType,
  ParsedReference,
  EvaluationContext,
} from './transforms/template-parser.js';

// Narrative engine
export {
  NarrativeEngine,
  createNarrativeEngine,
} from './transforms/narrative-engine.js';

// Tone configurations
export {
  TONE_CONFIGS,
  EPIC_HISTORICAL_CONFIG,
  PERSONAL_CHARACTER_CONFIG,
  MYTHOLOGICAL_CONFIG,
  POLITICAL_INTRIGUE_CONFIG,
  SCHOLARLY_CONFIG,
  getRandomPhrase,
  applySubstitutions,
  getToneCharacteristicWords,
  calculateVocabularyMatch,
} from './styles/tones.js';

export type {
  ToneConfig,
  ToneSubstitutions,
  TonePhrases,
} from './styles/tones.js';

// Chronicler system
export {
  ChroniclerIdeology,
  WritingStyle,
  BiasStrength,
  BiasType,
  ChroniclerRegistry,
  createChronicler,
  ChroniclerBiasFilter,
  LossReason,
  PreservationQuality,
  ChronicleFeature,
  LostHistoryTracker,
} from './chronicler/index.js';

export type {
  Chronicler,
  ChroniclerKnowledge,
  FactionRelation,
  ChroniclerInterest,
  ChroniclerAvoidance,
  ChroniclerOutput,
  AppliedBias,
  BiasFilterContext,
  Chronicle,
  LossRecord,
  LossEvent,
} from './chronicler/index.js';

// Vignette system
export {
  EmotionalContent,
  VignetteArchetype,
  TriggerConditionType,
  VignetteMood,
  VignetteTrigger,
  VignetteGenerator,
} from './vignettes/index.js';

export type {
  TriggerCondition,
  VignetteTriggerResult,
  VignetteTriggerContext,
  Vignette,
  VignetteGeneratorContext,
} from './vignettes/index.js';

import { ALL_TEMPLATES } from './templates/index.js';
import { NarrativeEngine } from './transforms/narrative-engine.js';
import type { NarrativeEngineConfig, EntityResolver } from './templates/types.js';

/**
 * Create a fully configured narrative engine with all default templates.
 */
export function createDefaultNarrativeEngine(
  config?: Partial<NarrativeEngineConfig>,
  resolver?: EntityResolver
): NarrativeEngine {
  return new NarrativeEngine(ALL_TEMPLATES, config, resolver);
}
