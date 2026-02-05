/**
 * Refinement system types — defines all possible post-generation adjustments
 * the player can make before simulation begins.
 */

import type { WorldConfig, BiomeType, Settlement, Faction, GeneratedCharacter,
  InitialTension, PersonalityTraitName, StatusType, TensionSeverity,
  WorldMap, PreHistoryResult, LegendaryArtifact,
} from '@fws/generator';

// ── Generated world state bundle ─────────────────────────────────────────

/**
 * The complete generated world state available for refinement.
 * All mutable — refinement modifies this in-place.
 */
export interface GeneratedWorldState {
  readonly config: WorldConfig;
  readonly worldMap: WorldMap;
  settlements: Settlement[];
  factions: Faction[];
  characters: GeneratedCharacter[];
  tensions: InitialTension[];
  readonly preHistory: PreHistoryResult;
}

// ── Refinement action types ──────────────────────────────────────────────

/**
 * Move a settlement to new coordinates.
 */
export interface MoveSettlementAction {
  readonly kind: 'move_settlement';
  readonly settlementIndex: number;
  readonly newX: number;
  readonly newY: number;
}

/**
 * Reassign settlements between factions (resize territory).
 */
export interface ResizeTerritoryAction {
  readonly kind: 'resize_territory';
  readonly settlementIndex: number;
  readonly newFactionIndex: number;
}

/**
 * Adjust a settlement's starting population.
 */
export interface AdjustPopulationAction {
  readonly kind: 'adjust_population';
  readonly settlementIndex: number;
  readonly newPopulation: number;
}

/**
 * Create a new key character with custom traits.
 */
export interface CreateCharacterAction {
  readonly kind: 'create_character';
  readonly name: string;
  readonly raceName: string;
  readonly factionIndex: number;
  readonly statusType: StatusType;
  readonly personalityOverrides: ReadonlyMap<PersonalityTraitName, number>;
}

/**
 * Remove an existing character.
 */
export interface RemoveCharacterAction {
  readonly kind: 'remove_character';
  readonly characterIndex: number;
}

/**
 * Establish an initial alliance between two factions.
 */
export interface EstablishAllianceAction {
  readonly kind: 'establish_alliance';
  readonly factionAIndex: number;
  readonly factionBIndex: number;
}

/**
 * Establish an initial conflict between two factions.
 */
export interface EstablishConflictAction {
  readonly kind: 'establish_conflict';
  readonly factionAIndex: number;
  readonly factionBIndex: number;
  readonly severity: TensionSeverity;
}

/**
 * Place a special landmark at a map position.
 */
export interface PlaceLandmarkAction {
  readonly kind: 'place_landmark';
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly description: string;
}

/**
 * Place a legendary artifact at a settlement.
 */
export interface PlaceArtifactAction {
  readonly kind: 'place_artifact';
  readonly settlementIndex: number;
  readonly artifactName: string;
  readonly artifactType: 'weapon' | 'armor' | 'ring' | 'staff' | 'tome' | 'crown' | 'amulet';
  readonly powerLevel: number;
}

/**
 * Modify the biome of a tile.
 */
export interface ModifyBiomeAction {
  readonly kind: 'modify_biome';
  readonly x: number;
  readonly y: number;
  readonly newBiome: BiomeType;
}

/**
 * Seed a specific event to trigger early in simulation.
 */
export interface SeedEventAction {
  readonly kind: 'seed_event';
  readonly eventType: 'war' | 'plague' | 'famine' | 'discovery' | 'migration' | 'natural_disaster';
  readonly targetFactionIndex: number;
  readonly triggerDay: number;
  readonly description: string;
}

/**
 * Discriminated union of all refinement actions.
 */
export type RefinementAction =
  | MoveSettlementAction
  | ResizeTerritoryAction
  | AdjustPopulationAction
  | CreateCharacterAction
  | RemoveCharacterAction
  | EstablishAllianceAction
  | EstablishConflictAction
  | PlaceLandmarkAction
  | PlaceArtifactAction
  | ModifyBiomeAction
  | SeedEventAction;

/**
 * A logged refinement for the Decisions Log.
 */
export interface RefinementLogEntry {
  readonly action: RefinementAction;
  readonly timestamp: number;
  readonly description: string;
}

/**
 * A seeded event to fire during simulation.
 */
export interface SeededEvent {
  readonly eventType: SeedEventAction['eventType'];
  readonly targetFactionIndex: number;
  readonly triggerDay: number;
  readonly description: string;
}

/**
 * A player-placed landmark.
 */
export interface Landmark {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly description: string;
}

/**
 * Result of applying refinements — tracks what was changed.
 */
export interface RefinementResult {
  readonly appliedCount: number;
  readonly rejectedCount: number;
  readonly log: readonly RefinementLogEntry[];
  readonly landmarks: readonly Landmark[];
  readonly seededEvents: readonly SeededEvent[];
  readonly addedArtifacts: readonly LegendaryArtifact[];
}
