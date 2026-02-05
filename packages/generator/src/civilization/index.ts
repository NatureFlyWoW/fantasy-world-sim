/**
 * Civilization module — race generation, population placement,
 * settlement placement, factions, characters, and tensions.
 */

export { RaceGenerator } from './races.js';
export type { Race, CulturalTendency } from './races.js';

export { InitialPopulationPlacer } from './population.js';
export type { PopulationSeed } from './population.js';

export { SettlementPlacer } from './settlement-placer.js';
export type {
  Settlement,
  SettlementType,
  EconomicFocus,
  SettlementStructure,
} from './settlement-placer.js';

export { FactionInitializer } from './faction-initializer.js';
export type {
  Faction,
  GovernmentType,
} from './faction-initializer.js';

export { CharacterGenerator } from './character-generator.js';
export type {
  GeneratedCharacter,
  PersonalityTraitName,
  PositionComponent,
  AttributeComponent,
  SkillName,
  SkillComponent,
  PersonalityComponent,
  RelationshipKind,
  RelationshipComponent,
  GoalComponent,
  MemoryComponent,
  BeliefComponent,
  PossessionComponent,
  ReputationComponent,
  StatusType,
  StatusComponent,
  HealthComponent,
} from './character-generator.js';

export { TensionSeeder } from './tension-seeder.js';
export type {
  InitialTension,
  TensionType,
  TensionSeverity,
} from './tension-seeder.js';
