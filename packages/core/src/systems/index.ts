/**
 * Systems module — simulation systems that process entities each tick.
 */

// Personality traits
export {
  PersonalityTrait,
  ALL_TRAITS,
  TRAIT_OPPOSITIONS,
  TRAIT_SYNERGIES,
  getImpulsivenessFactor,
  computePersonalityAlignment,
  type TraitActionWeight,
} from './personality-traits.js';

// Goal types
export {
  GoalPriority,
  LifeGoal,
  ALL_LIFE_GOALS,
  LIFE_GOAL_TRAIT_AFFINITY,
  GOAL_SHIFT_TENDENCIES,
  computeBestLifeGoal,
  createGoalId,
  resetGoalIdCounter,
  type CharacterGoal,
  type GoalType,
  type SurvivalGoalType,
  type PrimaryLifeGoalType,
  type SecondaryGoalType,
  type OpportunisticGoalType,
  type GoalChangeTrigger,
} from './goal-types.js';

// Action types
export {
  ActionCategory,
  OutcomeType,
  ACTION_TEMPLATES,
  createActionId,
  resetActionIdCounter,
  type CharacterAction,
  type ActionScore,
  type ActionOutcome,
  type ActionTemplate,
} from './action-types.js';

// Character AI system
export {
  CharacterAISystem,
  CharacterPerception,
  GoalEvaluator,
  ActionGenerator,
  ActionScorer,
  ActionExecutor,
  GoalReflector,
  type PerceptionContext,
} from './character-ai.js';

// Memory types
export {
  MemoryRole,
  MemoryCategory,
  DEFAULT_DECAY_CONFIG,
  type Memory,
  type MemoryDecayConfig,
  type MemoryFilter,
} from './memory-types.js';

// Memory store
export { CharacterMemoryStore } from './memory-store.js';

// Reputation types
export {
  ReputationDimension,
  ALL_REPUTATION_DIMENSIONS,
  DEFAULT_PROPAGATION_CONFIG,
  type ReputationProfile,
  type ReputationEntry,
  type FactionReputationEntry,
  type PropagationConfig,
  type ReputationImpactRule,
} from './reputation-types.js';

// Reputation system
export { ReputationSystem } from './reputation-system.js';

// Grudge system
export {
  GrudgeSystem,
  DEFAULT_GRUDGE_CONFIG,
  type Grudge,
  type GrudgeConfig,
} from './grudge-system.js';

// Propaganda system
export {
  PropagandaSystem,
  PropagandaType,
  type PropagandaEffect,
} from './propaganda.js';

// Government types
export {
  GovernmentType,
  SuccessionType,
  ALL_GOVERNMENT_TYPES,
  GOVERNMENT_TRAITS,
  SUCCESSION_RULES,
  getGovernmentDecisionModifiers,
  governmentFavors,
  type GovernmentTraits,
  type SuccessionRule,
  type DecisionContext,
} from './government-types.js';

// Diplomacy types
export {
  DiplomaticAction,
  ALL_DIPLOMATIC_ACTIONS,
  DIPLOMATIC_TEMPLATES,
  checkPreconditions,
  getRelation,
  calculateSuccessRate,
  type DiplomaticActionTemplate,
  type DiplomaticPrecondition,
  type DiplomaticOutcome,
} from './diplomacy-types.js';

// Treaty types
export {
  TreatyTermType,
  ALL_TREATY_TERM_TYPES,
  createTreatyId,
  resetTreatyIdCounter,
  createNonAggressionTerm,
  createMutualDefenseTerm,
  createTributaryTerm,
  createMarriageContractTerm,
  createDemilitarizedZoneTerm,
  createTreaty,
  isTreatyExpired,
  getViolationBaseSeverity,
  type Treaty,
  type TreatyTerm,
  type TreatyViolation,
  type MutualDefenseParams,
  type TradeExclusivityParams,
  type NonAggressionParams,
  type TributaryParams,
  type DemilitarizedZoneParams,
  type CulturalExchangeParams,
  type MarriageContractParams,
  type TerritorialClaimParams,
  type ResourceSharingParams,
} from './treaty-types.js';

// Treaty enforcement
export { TreatyEnforcement } from './treaty-enforcement.js';

// Faction political system
export { FactionPoliticalSystem } from './faction-system.js';

// Economic system
export {
  ResourceType,
  ALL_RESOURCE_TYPES,
  RAW_RESOURCES,
  MANUFACTURED_GOODS,
  BASE_PRICES,
  TERRAIN_RESOURCE_BONUSES,
  EconomicEventType,
  EconomicSystem,
  calculateProduction,
  calculatePrice,
  determineTrend,
  calculateDemand,
  calculateTradeProfitability,
  checkTradeAllowed,
  calculateTradeVolume,
  createTradeRouteId,
  resetTradeRouteIdCounter,
  type MarketPrice,
  type SettlementMarket,
  type TradeRoute,
  type EconomicEvent,
  type ProductionFactors,
} from './economics.js';

// Warfare system
export {
  UnitType,
  ALL_UNIT_TYPES,
  STANDARD_UNITS,
  RACIAL_UNITS,
  UNIT_STATS,
  TerrainType,
  TERRAIN_MODIFIERS,
  WeatherType,
  WEATHER_EFFECTS,
  WarObjective,
  WarPhase,
  SiegeMethod,
  SiegePhase,
  WarfareSystem,
  calculateArmyStrength,
  getArmySize,
  resolveBattle,
  progressSiege,
  createWarId,
  createBattleId,
  createSiegeId,
  createArmyId,
  resetWarfareIdCounters,
  type UnitStats,
  type TerrainModifiers,
  type WeatherEffects,
  type ArmyUnit,
  type Army,
  type CommanderStats,
  type War,
  type BattleContext,
  type BattleMoment,
  type BattleResult,
  type SiegeState,
  type SiegeEvent,
  type WarConsequences,
} from './warfare.js';

// Magic system
export {
  MagicSchool,
  ALL_MAGIC_SCHOOLS,
  InstitutionType,
  ALL_INSTITUTION_TYPES,
  INSTITUTION_TRAITS,
  ResearchType,
  ALL_RESEARCH_TYPES,
  ArtifactType,
  ALL_ARTIFACT_TYPES,
  ArtifactPersonalityTrait,
  ALL_ARTIFACT_TRAITS,
  CatastropheType,
  ALL_CATASTROPHE_TYPES,
  MagicSocietyRelation,
  ALL_SOCIETY_RELATIONS,
  InstitutionEventType,
  MagicSystem,
  calculateBreakthroughProbability,
  checkArtifactCompatibility,
  calculateArtifactInfluence,
  calculateCatastropheProbability,
  calculateMagicSocietyEffects,
  createResearchId,
  createInstitutionId,
  createArtifactIdValue,
  createCatastropheId,
  resetMagicIdCounters,
  type InstitutionTraits,
  type ResearchProject,
  type BreakthroughFactors,
  type MagicalInstitution,
  type ArtifactConsciousness,
  type Artifact,
  type ArtifactCreationStory,
  type MagicalCatastrophe,
  type CatastropheEffect,
  type MagicSocietyEffects,
} from './magic.js';

// Religion system
export {
  Domain,
  ALL_DOMAINS,
  InterventionType,
  ALL_INTERVENTION_TYPES,
  INTERVENTION_COSTS,
  DoctrineType,
  ALL_DOCTRINE_TYPES,
  ChurchEventType,
  ALL_CHURCH_EVENT_TYPES,
  HolyFigureType,
  ALL_HOLY_FIGURE_TYPES,
  ReligionSystem,
  calculateDivinePower,
  canIntervene,
  calculateSchismProbability,
  calculateSyncretismInfluence,
  createDeitySimId,
  createReligionId,
  createHolyFigureId,
  resetReligionIdCounters,
  type InterventionCost,
  type SimDeity,
  type Religion,
  type DevotionRecord,
  type HolyFigure,
} from './religion.js';

// Oral tradition system
export {
  OralTraditionSystem,
  createOralTradition,
  applyMutation,
  processRetelling,
  calculateRecognizability,
  writeDownTradition,
  createTraditionId,
  resetTraditionIdCounter,
  DEFAULT_MUTATION_CONFIG,
  type OralTradition,
  type Retelling,
  type MutationConfig,
} from './oral-tradition.js';

// Cultural evolution system
export {
  TechnologyCategory,
  ALL_TECHNOLOGY_CATEGORIES,
  ArtForm,
  ALL_ART_FORMS,
  ArtStyle,
  ALL_ART_STYLES,
  PhilosophyType,
  ALL_PHILOSOPHY_TYPES,
  LanguageStatus,
  ALL_LANGUAGE_STATUSES,
  TECHNOLOGIES,
  CulturalEvolutionSystem,
  calculatePhilosophyEffects,
  calculateLanguageDivergence,
  shouldBecomeLanguage,
  createTechId,
  createMasterworkId,
  createMovementId,
  createSchoolId,
  createLanguageId,
  resetCultureIdCounters,
  type Technology,
  type TechnologyState,
  type Masterwork,
  type ArtisticMovement,
  type PhilosophicalSchool,
  type Language,
} from './culture.js';

// Ecological pressure system
export {
  EcologicalResourceType,
  ALL_ECOLOGICAL_RESOURCE_TYPES,
  DegradationType,
  ALL_DEGRADATION_TYPES,
  CreatureTerritoryType,
  ALL_CREATURE_TERRITORY_TYPES,
  InvasiveSpeciesBehavior,
  ALL_INVASIVE_BEHAVIORS,
  EnvironmentalEventType,
  ALL_ENVIRONMENTAL_EVENT_TYPES,
  EcologySystem,
  DEFAULT_ECOLOGY_CONFIG,
  calculateStockChange,
  calculateHarvestPressure,
  isResourceCritical,
  isResourceDepleted,
  calculateDegradationIncrease,
  calculateDegradationRecovery,
  shouldTriggerEnvironmentalEvent,
  getDegradationEventType,
  calculateDeforestationRainfallImpact,
  isWithinTerritory,
  canSettleInRegion,
  calculateExpansionProbability,
  calculateTerritoryThreatLevel,
  calculateSpreadProbability,
  calculateInvasiveImpact,
  canInvasiveSurvive,
  calculateInvasiveGrowth,
  calculateEventSeverity,
  calculateEventCasualties,
  calculateEconomicDamage,
  calculateRecoveryTime,
  createTerritoryId,
  createInvasiveId,
  createEnvironmentalEventId,
  resetEcologyIdCounters,
  type ResourceDepletionState,
  type EnvironmentalDegradationState,
  type CreatureTerritory,
  type InvasiveSpecies,
  type EnvironmentalEvent,
  type EcologyConfig,
} from './ecology.js';

// Secret types
export {
  SecretType,
  ALL_SECRET_TYPES,
  RevelationMethod,
  ALL_REVELATION_METHODS,
  SECRET_BASE_SIGNIFICANCE,
  SECRET_BASE_REVELATION_RATE,
} from './secret-types.js';

// Secret interface and ID generation
export {
  createSecretId,
  createClueId,
  resetSecretIdCounters,
  type Secret,
  type CreateSecretOptions,
  type SecretRevelationEvent,
  type SuspicionRecord,
  type RevelationCheckResult,
  type Clue,
} from './secret.js';

// Secret manager
export {
  SecretManager,
  DEFAULT_SECRET_CONFIG,
  type SecretManagerConfig,
  type SecretWorldState,
} from './secret-manager.js';

// Perception filter
export {
  SecretPerceptionFilter,
  DEFAULT_PERCEPTION_CONFIG,
  type GroundTruthState,
  type PerceivedState,
  type PerceptionFilterConfig,
} from './perception-filter.js';

// Discovery actions
export {
  DiscoveryActions,
  DEFAULT_DISCOVERY_CONFIG,
  type DiscoverySkills,
  type DiscoveryResult,
  type DiscoveryActionConfig,
} from './discovery-actions.js';

// Influence event mapping
export {
  InfluenceActionType,
  INFLUENCE_ACTION_CONFIGS,
  getInfluenceActionConfig,
  getInfluenceActionsByCategory,
  calculateInfluenceCost,
  isOnCooldown,
  getRemainingCooldown,
  type InfluenceActionConfig,
} from './influence-event-mapping.js';

// Influence types
export {
  InfluenceCategory,
  getInfluenceCategory,
  getActionsInCategory,
  INFLUENCE_ACTION_META,
  getActionMeta,
  type InfluenceAction,
  type InfluenceActionKind,
  type InfluenceResult,
  type BelievabilityResult,
  type ResistanceResult,
  type InfluencePointState,
  type InfluenceActionMeta,
  type InspireIdeaAction,
  type PropheticDreamAction,
  type ArrangeMeetingAction,
  type PersonalityNudgeAction,
  type RevealSecretAction,
  type LuckModifierAction,
  type VisionOfFutureAction,
  type EmpowerChampionAction,
  type AdjustWeatherAction,
  type MinorGeologyAction,
  type AnimalMigrationAction,
  type ResourceDiscoveryAction,
  type TriggerNaturalEventAction,
  type PromoteArtAction,
  type EncourageResearchAction,
  type StrengthenTraditionAction,
  type IntroduceForeignConceptAction,
} from './influence-types.js';

// Influence system
export {
  InfluenceSystem,
  STARTING_IP,
  MAX_IP,
  BASE_REGENERATION_RATE,
  TICKS_PER_YEAR,
} from './influence-system.js';

// World fingerprint
export {
  WorldFingerprintCalculator,
  ALL_DOMAINS as FINGERPRINT_DOMAINS,
} from './world-fingerprint.js';
export type {
  FingerprintDomain,
  CivPaletteEntry,
  WorldFingerprint,
} from './world-fingerprint.js';

// Population utilities
export {
  createNonNotable,
  DEFAULT_RACE_LIFESPANS,
  FALLBACK_LIFESPAN,
  PROFESSIONS,
  type NonNotableConfig,
  type RaceLifespan,
} from './population-utils.js';

// Dreaming system
export {
  DreamingSystem,
  DreamType,
  ALL_DREAM_TYPES,
  DEFAULT_DREAMING_CONFIG,
  computeEmotionalLoad,
  calculateDreamProbability,
  computeDreamTypeWeights,
  selectDreamType,
  buildDreamEffect,
  selectDreamDescription,
} from './dreaming.js';
export type {
  DreamRecord,
  DreamEffect,
  DreamTypeContext,
  PlantedDream,
  DreamingConfig,
} from './dreaming.js';
