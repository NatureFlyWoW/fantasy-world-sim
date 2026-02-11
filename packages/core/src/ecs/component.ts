/**
 * Component system for the ECS architecture.
 * Components are pure data containers attached to entities.
 */

/**
 * All component type discriminants.
 * Used for type narrowing and serialization.
 */
export type ComponentType =
  // Geographic components
  | 'Position'
  | 'Biome'
  | 'Climate'
  | 'Ownership'
  | 'Resource'
  | 'Population'
  | 'Economy'
  | 'Government'
  | 'Military'
  | 'Structures'
  | 'History'
  | 'Culture'
  | 'StructureType'
  | 'Condition'
  | 'FeatureType'
  | 'MagicalProperty'
  // Social components
  | 'Territory'
  | 'Diplomacy'
  | 'PopulationDemographics'
  | 'Membership'
  | 'Goal'
  | 'Influence'
  | 'Reputation'
  | 'Genealogy'
  | 'Wealth'
  | 'Traits'
  | 'Grudges'
  | 'Knowledge'
  | 'Hierarchy'
  | 'Doctrine'
  // Individual components
  | 'Attribute'
  | 'Skill'
  | 'Personality'
  | 'Relationship'
  | 'Memory'
  | 'Belief'
  | 'Possession'
  | 'Status'
  | 'Health'
  | 'CreatureType'
  | 'Behavior'
  | 'ThreatLevel'
  | 'Domain'
  | 'Power'
  | 'InterventionHistory'
  // Population components
  | 'Notability'
  | 'Parentage'
  | 'Deceased'
  | 'HiddenLocation'
  // Cultural components
  | 'Worshiper'
  | 'HolySite'
  | 'SchismHistory'
  | 'Ritual'
  | 'Origin'
  | 'Practice'
  | 'Spread'
  | 'EvolutionHistory'
  | 'Phoneme'
  | 'Vocabulary'
  | 'ParentLanguage'
  | 'SpeakerDistribution'
  | 'Style'
  | 'MasterworkList'
  | 'Patronage'
  // Knowledge components
  | 'Author'
  | 'Content'
  | 'Location'
  | 'PreservationState'
  | 'Discoverer'
  | 'Impact'
  | 'Creator'
  | 'School'
  | 'PowerLevel'
  | 'Requirement'
  | 'UserList'
  // Object components
  | 'CreationHistory'
  | 'OwnershipChain'
  | 'Curse'
  | 'Significance'
  | 'Value'
  | 'Guardian'
  // Event components
  | 'Participant'
  | 'Cause'
  | 'BattleList'
  | 'Outcome'
  | 'TerritoryChange'
  | 'Severity'
  | 'AffectedArea'
  | 'Casualty'
  | 'Recovery'
  | 'CulturalImpact';

/**
 * Base interface for all components.
 * Components must be serializable for persistence.
 */
export interface Component {
  readonly type: ComponentType;
  serialize(): Record<string, unknown>;
}

/**
 * Static interface for component classes.
 * Each component class must implement a deserialize factory.
 */
export interface ComponentClass<T extends Component> {
  deserialize(data: Record<string, unknown>): T;
}

// =============================================================================
// GEOGRAPHIC COMPONENTS
// =============================================================================

export interface PositionComponent extends Component {
  readonly type: 'Position';
  x: number;
  y: number;
  z?: number;
}

export interface BiomeComponent extends Component {
  readonly type: 'Biome';
  biomeType: string;
  fertility: number;
  moisture: number;
}

export interface ClimateComponent extends Component {
  readonly type: 'Climate';
  temperature: number;
  rainfall: number;
  seasonality: number;
}

export interface OwnershipComponent extends Component {
  readonly type: 'Ownership';
  ownerId: number | null;
  claimStrength: number;
}

export interface ResourceComponent extends Component {
  readonly type: 'Resource';
  resources: Map<string, number>;
}

export interface PopulationComponent extends Component {
  readonly type: 'Population';
  count: number;
  growthRate: number;
}

export interface EconomyComponent extends Component {
  readonly type: 'Economy';
  wealth: number;
  tradeVolume: number;
  industries: string[];
}

export interface GovernmentComponent extends Component {
  readonly type: 'Government';
  governmentType: string;
  stability: number;
  legitimacy: number;
}

export interface MilitaryComponent extends Component {
  readonly type: 'Military';
  strength: number;
  morale: number;
  training: number;
}

export interface StructuresComponent extends Component {
  readonly type: 'Structures';
  buildings: string[];
  fortificationLevel: number;
}

export interface HistoryComponent extends Component {
  readonly type: 'History';
  events: number[];
  foundingDate: number;
}

export interface CultureComponent extends Component {
  readonly type: 'Culture';
  traditions: string[];
  values: string[];
  languageId: number | null;
}

export interface StructureTypeComponent extends Component {
  readonly type: 'StructureType';
  category: string;
  size: number;
}

export interface ConditionComponent extends Component {
  readonly type: 'Condition';
  durability: number;
  maintenanceLevel: number;
}

export interface FeatureTypeComponent extends Component {
  readonly type: 'FeatureType';
  category: string;
  prominence: number;
}

export interface MagicalPropertyComponent extends Component {
  readonly type: 'MagicalProperty';
  enchantments: string[];
  powerLevel: number;
}

// =============================================================================
// SOCIAL COMPONENTS
// =============================================================================

export interface TerritoryComponent extends Component {
  readonly type: 'Territory';
  controlledRegions: number[];
  capitalId: number | null;
}

export interface DiplomacyComponent extends Component {
  readonly type: 'Diplomacy';
  relations: Map<number, number>;
  treaties: string[];
}

export interface PopulationDemographicsComponent extends Component {
  readonly type: 'PopulationDemographics';
  ageDistribution: Map<string, number>;
  raceDistribution: Map<string, number>;
}

export interface MembershipComponent extends Component {
  readonly type: 'Membership';
  factionId: number | null;
  rank: string;
  joinDate: number;
}

export interface GoalComponent extends Component {
  readonly type: 'Goal';
  objectives: string[];
  priorities: Map<string, number>;
}

export interface InfluenceComponent extends Component {
  readonly type: 'Influence';
  spheres: Map<string, number>;
  reach: number;
}

export interface ReputationComponent extends Component {
  readonly type: 'Reputation';
  fame: number;
  infamy: number;
  perceptions: Map<number, number>;
}

export interface GenealogyComponent extends Component {
  readonly type: 'Genealogy';
  parentIds: number[];
  childIds: number[];
  spouseIds: number[];
}

export interface WealthComponent extends Component {
  readonly type: 'Wealth';
  coins: number;
  propertyValue: number;
  debts: number;
}

export interface TraitsComponent extends Component {
  readonly type: 'Traits';
  traits: string[];
  intensities: Map<string, number>;
}

export interface GrudgesComponent extends Component {
  readonly type: 'Grudges';
  grudges: Map<number, string>;
  severity: Map<number, number>;
}

export interface KnowledgeComponent extends Component {
  readonly type: 'Knowledge';
  knownFacts: string[];
  skills: Map<string, number>;
}

export interface HierarchyComponent extends Component {
  readonly type: 'Hierarchy';
  leaderId: number | null;
  subordinateIds: number[];
}

export interface DoctrineComponent extends Component {
  readonly type: 'Doctrine';
  beliefs: string[];
  prohibitions: string[];
  rituals: string[];
}

// =============================================================================
// INDIVIDUAL COMPONENTS
// =============================================================================

export interface AttributeComponent extends Component {
  readonly type: 'Attribute';
  strength: number;
  agility: number;
  endurance: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface SkillComponent extends Component {
  readonly type: 'Skill';
  skills: Map<string, number>;
  experience: Map<string, number>;
}

export interface PersonalityComponent extends Component {
  readonly type: 'Personality';
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface RelationshipComponent extends Component {
  readonly type: 'Relationship';
  relationships: Map<number, string>;
  affinity: Map<number, number>;
}

export interface MemoryComponent extends Component {
  readonly type: 'Memory';
  memories: Array<{ eventId: number; importance: number; distortion: number }>;
  capacity: number;
}

export interface BeliefComponent extends Component {
  readonly type: 'Belief';
  deityIds: number[];
  devotion: Map<number, number>;
  doubts: string[];
}

export interface PossessionComponent extends Component {
  readonly type: 'Possession';
  itemIds: number[];
  equippedIds: number[];
}

export interface StatusComponent extends Component {
  readonly type: 'Status';
  conditions: string[];
  titles: string[];
  socialClass: string;
}

export interface HealthComponent extends Component {
  readonly type: 'Health';
  current: number;
  maximum: number;
  injuries: string[];
  diseases: string[];
}

export interface CreatureTypeComponent extends Component {
  readonly type: 'CreatureType';
  species: string;
  size: string;
  diet: string;
}

export interface BehaviorComponent extends Component {
  readonly type: 'Behavior';
  patterns: string[];
  aggression: number;
  territoriality: number;
}

export interface ThreatLevelComponent extends Component {
  readonly type: 'ThreatLevel';
  dangerRating: number;
  abilities: string[];
}

export interface DomainComponent extends Component {
  readonly type: 'Domain';
  spheres: string[];
  power: number;
}

export interface PowerComponent extends Component {
  readonly type: 'Power';
  abilities: string[];
  manaPool: number;
  rechargeRate: number;
}

export interface InterventionHistoryComponent extends Component {
  readonly type: 'InterventionHistory';
  interventions: Array<{ tick: number; type: string; targetId: number }>;
}

// =============================================================================
// POPULATION COMPONENTS
// =============================================================================

export interface NotabilityComponent extends Component {
  readonly type: 'Notability';
  score: number;
  sparkHistory: Array<{ tick: number; description: string }>;
}

export interface ParentageComponent extends Component {
  readonly type: 'Parentage';
  motherId: number | null;
  fatherId: number | null;
}

export interface DeceasedComponent extends Component {
  readonly type: 'Deceased';
  cause: string;
  tick: number;
  locationId: number;
}

export interface HiddenLocationComponent extends Component {
  readonly type: 'HiddenLocation';
  locationType: 'ruins' | 'resource' | 'magical' | 'lore';
  revealed: boolean;
  revealedTick: number | null;
  x: number;
  y: number;
}

// =============================================================================
// CULTURAL COMPONENTS
// =============================================================================

export interface WorshiperComponent extends Component {
  readonly type: 'Worshiper';
  followerCount: number;
  devotionLevel: number;
}

export interface HolySiteComponent extends Component {
  readonly type: 'HolySite';
  siteIds: number[];
  sanctity: number;
}

export interface SchismHistoryComponent extends Component {
  readonly type: 'SchismHistory';
  schisms: Array<{ tick: number; splinterFactionId: number; cause: string }>;
}

export interface RitualComponent extends Component {
  readonly type: 'Ritual';
  rituals: Array<{ name: string; frequency: string; requirements: string[] }>;
}

export interface OriginComponent extends Component {
  readonly type: 'Origin';
  founderId: number | null;
  foundingTick: number;
  foundingLocation: number | null;
}

export interface PracticeComponent extends Component {
  readonly type: 'Practice';
  practices: string[];
  taboos: string[];
}

export interface SpreadComponent extends Component {
  readonly type: 'Spread';
  regionIds: number[];
  adoptionRate: number;
}

export interface EvolutionHistoryComponent extends Component {
  readonly type: 'EvolutionHistory';
  changes: Array<{ tick: number; description: string }>;
}

export interface PhonemeComponent extends Component {
  readonly type: 'Phoneme';
  consonants: string[];
  vowels: string[];
  syllableStructure: string;
}

export interface VocabularyComponent extends Component {
  readonly type: 'Vocabulary';
  words: Map<string, string>;
  loanwords: Map<string, number>;
}

export interface ParentLanguageComponent extends Component {
  readonly type: 'ParentLanguage';
  parentId: number | null;
  divergenceTick: number;
}

export interface SpeakerDistributionComponent extends Component {
  readonly type: 'SpeakerDistribution';
  speakersByRegion: Map<number, number>;
  totalSpeakers: number;
}

export interface StyleComponent extends Component {
  readonly type: 'Style';
  aesthetics: string[];
  techniques: string[];
  influences: number[];
}

export interface MasterworkListComponent extends Component {
  readonly type: 'MasterworkList';
  workIds: number[];
}

export interface PatronageComponent extends Component {
  readonly type: 'Patronage';
  patronIds: number[];
  commissions: Array<{ patronId: number; workId: number }>;
}

// =============================================================================
// KNOWLEDGE COMPONENTS
// =============================================================================

export interface AuthorComponent extends Component {
  readonly type: 'Author';
  authorId: number;
  coauthorIds: number[];
}

export interface ContentComponent extends Component {
  readonly type: 'Content';
  subject: string;
  genre: string;
  quality: number;
}

export interface LocationComponent extends Component {
  readonly type: 'Location';
  currentLocationId: number | null;
  previousLocationIds: number[];
}

export interface PreservationStateComponent extends Component {
  readonly type: 'PreservationState';
  condition: number;
  copiesExist: number;
}

export interface DiscovererComponent extends Component {
  readonly type: 'Discoverer';
  discovererId: number;
  discoveryTick: number;
}

export interface ImpactComponent extends Component {
  readonly type: 'Impact';
  technologicalImpact: number;
  socialImpact: number;
  affectedEntities: number[];
}

export interface CreatorComponent extends Component {
  readonly type: 'Creator';
  creatorId: number;
  creationTick: number;
}

export interface SchoolComponent extends Component {
  readonly type: 'School';
  schoolName: string;
  principles: string[];
  masterIds: number[];
}

export interface PowerLevelComponent extends Component {
  readonly type: 'PowerLevel';
  tier: number;
  potency: number;
}

export interface RequirementComponent extends Component {
  readonly type: 'Requirement';
  prerequisites: string[];
  components: string[];
  castingTime: number;
}

export interface UserListComponent extends Component {
  readonly type: 'UserList';
  userIds: number[];
  masteryLevels: Map<number, number>;
}

// =============================================================================
// OBJECT COMPONENTS
// =============================================================================

export interface CreationHistoryComponent extends Component {
  readonly type: 'CreationHistory';
  creatorId: number;
  creationTick: number;
  method: string;
}

export interface OwnershipChainComponent extends Component {
  readonly type: 'OwnershipChain';
  owners: Array<{ ownerId: number; fromTick: number; toTick: number | null }>;
}

export interface CurseComponent extends Component {
  readonly type: 'Curse';
  curseType: string;
  severity: number;
  breakCondition: string | null;
}

export interface SignificanceComponent extends Component {
  readonly type: 'Significance';
  historicalValue: number;
  legendaryStatus: boolean;
  associatedEvents: number[];
}

export interface ValueComponent extends Component {
  readonly type: 'Value';
  monetaryValue: number;
  sentimentalValue: number;
  magicalValue: number;
}

export interface GuardianComponent extends Component {
  readonly type: 'Guardian';
  guardianId: number | null;
  protectionLevel: number;
}

// =============================================================================
// EVENT COMPONENTS
// =============================================================================

export interface ParticipantComponent extends Component {
  readonly type: 'Participant';
  participantIds: number[];
  roles: Map<number, string>;
}

export interface CauseComponent extends Component {
  readonly type: 'Cause';
  triggerEventId: number | null;
  causes: string[];
}

export interface BattleListComponent extends Component {
  readonly type: 'BattleList';
  battleIds: number[];
}

export interface OutcomeComponent extends Component {
  readonly type: 'Outcome';
  result: string;
  winnerId: number | null;
  loserId: number | null;
}

export interface TerritoryChangeComponent extends Component {
  readonly type: 'TerritoryChange';
  regionId: number;
  fromOwnerId: number | null;
  toOwnerId: number | null;
}

export interface SeverityComponent extends Component {
  readonly type: 'Severity';
  magnitude: number;
  scale: string;
}

export interface AffectedAreaComponent extends Component {
  readonly type: 'AffectedArea';
  regionIds: number[];
  epicenterId: number | null;
}

export interface CasualtyComponent extends Component {
  readonly type: 'Casualty';
  deaths: number;
  injuries: number;
  displaced: number;
}

export interface RecoveryComponent extends Component {
  readonly type: 'Recovery';
  estimatedRecoveryTicks: number;
  recoveryProgress: number;
}

export interface CulturalImpactComponent extends Component {
  readonly type: 'CulturalImpact';
  memorability: number;
  mythologized: boolean;
  traditions: string[];
}

// =============================================================================
// COMPONENT UNION TYPE
// =============================================================================

export type AnyComponent =
  | PositionComponent
  | BiomeComponent
  | ClimateComponent
  | OwnershipComponent
  | ResourceComponent
  | PopulationComponent
  | EconomyComponent
  | GovernmentComponent
  | MilitaryComponent
  | StructuresComponent
  | HistoryComponent
  | CultureComponent
  | StructureTypeComponent
  | ConditionComponent
  | FeatureTypeComponent
  | MagicalPropertyComponent
  | TerritoryComponent
  | DiplomacyComponent
  | PopulationDemographicsComponent
  | MembershipComponent
  | GoalComponent
  | InfluenceComponent
  | ReputationComponent
  | GenealogyComponent
  | WealthComponent
  | TraitsComponent
  | GrudgesComponent
  | KnowledgeComponent
  | HierarchyComponent
  | DoctrineComponent
  | AttributeComponent
  | SkillComponent
  | PersonalityComponent
  | RelationshipComponent
  | MemoryComponent
  | BeliefComponent
  | PossessionComponent
  | StatusComponent
  | HealthComponent
  | CreatureTypeComponent
  | BehaviorComponent
  | ThreatLevelComponent
  | DomainComponent
  | PowerComponent
  | InterventionHistoryComponent
  | NotabilityComponent
  | ParentageComponent
  | DeceasedComponent
  | HiddenLocationComponent
  | WorshiperComponent
  | HolySiteComponent
  | SchismHistoryComponent
  | RitualComponent
  | OriginComponent
  | PracticeComponent
  | SpreadComponent
  | EvolutionHistoryComponent
  | PhonemeComponent
  | VocabularyComponent
  | ParentLanguageComponent
  | SpeakerDistributionComponent
  | StyleComponent
  | MasterworkListComponent
  | PatronageComponent
  | AuthorComponent
  | ContentComponent
  | LocationComponent
  | PreservationStateComponent
  | DiscovererComponent
  | ImpactComponent
  | CreatorComponent
  | SchoolComponent
  | PowerLevelComponent
  | RequirementComponent
  | UserListComponent
  | CreationHistoryComponent
  | OwnershipChainComponent
  | CurseComponent
  | SignificanceComponent
  | ValueComponent
  | GuardianComponent
  | ParticipantComponent
  | CauseComponent
  | BattleListComponent
  | OutcomeComponent
  | TerritoryChangeComponent
  | SeverityComponent
  | AffectedAreaComponent
  | CasualtyComponent
  | RecoveryComponent
  | CulturalImpactComponent;
