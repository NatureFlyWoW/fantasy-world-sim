/**
 * ECS module - Entity-Component-System architecture
 */

// Types and branded IDs
export type {
  EntityId,
  CharacterId,
  FactionId,
  SiteId,
  ArtifactId,
  EventId,
  DeityId,
  BookId,
  RegionId,
  WarId,
} from './types.js';

export {
  createEntityId,
  toEntityId,
  toCharacterId,
  toFactionId,
  toSiteId,
  toArtifactId,
  toEventId,
  toDeityId,
  toBookId,
  toRegionId,
  toWarId,
  resetEntityIdCounter,
} from './types.js';

// Component system
export type {
  Component,
  ComponentClass,
  ComponentType,
  AnyComponent,
  // Geographic
  PositionComponent,
  BiomeComponent,
  ClimateComponent,
  OwnershipComponent,
  ResourceComponent,
  PopulationComponent,
  EconomyComponent,
  GovernmentComponent,
  MilitaryComponent,
  StructuresComponent,
  HistoryComponent,
  CultureComponent,
  StructureTypeComponent,
  ConditionComponent,
  FeatureTypeComponent,
  MagicalPropertyComponent,
  // Social
  TerritoryComponent,
  DiplomacyComponent,
  PopulationDemographicsComponent,
  MembershipComponent,
  GoalComponent,
  InfluenceComponent,
  ReputationComponent,
  GenealogyComponent,
  WealthComponent,
  TraitsComponent,
  GrudgesComponent,
  KnowledgeComponent,
  HierarchyComponent,
  DoctrineComponent,
  // Individual
  AttributeComponent,
  SkillComponent,
  PersonalityComponent,
  RelationshipComponent,
  MemoryComponent,
  BeliefComponent,
  PossessionComponent,
  StatusComponent,
  HealthComponent,
  CreatureTypeComponent,
  BehaviorComponent,
  ThreatLevelComponent,
  DomainComponent,
  PowerComponent,
  InterventionHistoryComponent,
  // Population
  NotabilityComponent,
  ParentageComponent,
  DeceasedComponent,
  HiddenLocationComponent,
  // Cultural
  WorshiperComponent,
  HolySiteComponent,
  SchismHistoryComponent,
  RitualComponent,
  OriginComponent,
  PracticeComponent,
  SpreadComponent,
  EvolutionHistoryComponent,
  PhonemeComponent,
  VocabularyComponent,
  ParentLanguageComponent,
  SpeakerDistributionComponent,
  StyleComponent,
  MasterworkListComponent,
  PatronageComponent,
  // Knowledge
  AuthorComponent,
  ContentComponent,
  LocationComponent,
  PreservationStateComponent,
  DiscovererComponent,
  ImpactComponent,
  CreatorComponent,
  SchoolComponent,
  PowerLevelComponent,
  RequirementComponent,
  UserListComponent,
  // Object
  CreationHistoryComponent,
  OwnershipChainComponent,
  CurseComponent,
  SignificanceComponent,
  ValueComponent,
  GuardianComponent,
  // Event
  ParticipantComponent,
  CauseComponent,
  BattleListComponent,
  OutcomeComponent,
  TerritoryChangeComponent,
  SeverityComponent,
  AffectedAreaComponent,
  CasualtyComponent,
  RecoveryComponent,
  CulturalImpactComponent,
} from './component.js';

// Entity management
export { EntityManager } from './entity-manager.js';

// Component storage
export { ComponentStore } from './component-store.js';

// World container
export { World } from './world.js';
