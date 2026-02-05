/**
 * RefinementValidator — validates refinement actions against world state.
 * Prevents nonsensical changes (city in deep ocean, alliance with
 * non-existent faction, population outside bounds, etc.).
 */

import { BiomeType } from '@fws/generator';
import type { GeneratedWorldState, RefinementAction } from './refinement-types.js';

/**
 * Result of validating a refinement action.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly warnings: readonly string[];
}

/**
 * Biomes where settlements cannot exist.
 */
const UNINHABITABLE = new Set<BiomeType>([
  BiomeType.DeepOcean,
  BiomeType.Ocean,
  BiomeType.Volcano,
  BiomeType.IceCap,
  BiomeType.MagicWasteland,
]);

/**
 * Population bounds per settlement type.
 */
const POP_BOUNDS = {
  village: { min: 10, max: 2000 },
  town: { min: 200, max: 15000 },
  city: { min: 1000, max: 100000 },
} as const;

/**
 * Maximum trigger day for seeded events (10 years of simulation = 3600 days).
 */
const MAX_TRIGGER_DAY = 3600;

export class RefinementValidator {
  /**
   * Validate a refinement action against the current world state.
   */
  validate(action: RefinementAction, world: GeneratedWorldState): ValidationResult {
    switch (action.kind) {
      case 'move_settlement':
        return this.validateMoveSettlement(action, world);
      case 'resize_territory':
        return this.validateResizeTerritory(action, world);
      case 'adjust_population':
        return this.validateAdjustPopulation(action, world);
      case 'create_character':
        return this.validateCreateCharacter(action, world);
      case 'remove_character':
        return this.validateRemoveCharacter(action, world);
      case 'establish_alliance':
        return this.validateEstablishAlliance(action, world);
      case 'establish_conflict':
        return this.validateEstablishConflict(action, world);
      case 'place_landmark':
        return this.validatePlaceLandmark(action, world);
      case 'place_artifact':
        return this.validatePlaceArtifact(action, world);
      case 'modify_biome':
        return this.validateModifyBiome(action, world);
      case 'seed_event':
        return this.validateSeedEvent(action, world);
    }
  }

  private validateMoveSettlement(
    action: Extract<RefinementAction, { kind: 'move_settlement' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    // Settlement index in bounds
    if (action.settlementIndex < 0 || action.settlementIndex >= world.settlements.length) {
      return { valid: false, warnings: [`Settlement index ${action.settlementIndex} out of range (0-${world.settlements.length - 1})`] };
    }

    // Coordinates in bounds
    const width = world.worldMap.getWidth();
    const height = world.worldMap.getHeight();
    if (action.newX < 0 || action.newX >= width || action.newY < 0 || action.newY >= height) {
      return { valid: false, warnings: [`Coordinates (${action.newX}, ${action.newY}) out of map bounds (${width}×${height})`] };
    }

    // Target tile must be habitable
    const tile = world.worldMap.getTile(action.newX, action.newY);
    if (tile === undefined) {
      return { valid: false, warnings: ['Target tile does not exist'] };
    }
    if (UNINHABITABLE.has(tile.biome)) {
      return { valid: false, warnings: [`Cannot place settlement on ${tile.biome} terrain`] };
    }

    // Warn if far from water
    if (tile.riverId === undefined) {
      warnings.push('New location has no river access — settlement may struggle');
    }

    // Warn if harsh biome
    if (tile.biome === BiomeType.Desert || tile.biome === BiomeType.Tundra || tile.biome === BiomeType.Swamp) {
      warnings.push(`${tile.biome} terrain will limit settlement growth`);
    }

    return { valid: true, warnings };
  }

  private validateResizeTerritory(
    action: Extract<RefinementAction, { kind: 'resize_territory' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    if (action.settlementIndex < 0 || action.settlementIndex >= world.settlements.length) {
      return { valid: false, warnings: [`Settlement index ${action.settlementIndex} out of range`] };
    }
    if (action.newFactionIndex < 0 || action.newFactionIndex >= world.factions.length) {
      return { valid: false, warnings: [`Faction index ${action.newFactionIndex} out of range`] };
    }

    // Warn if reassigning a faction's capital
    const settlement = world.settlements[action.settlementIndex]!;
    const currentFactionIdx = settlement.factionIndex;
    if (currentFactionIdx !== undefined) {
      const currentFaction = world.factions[currentFactionIdx];
      if (currentFaction !== undefined && currentFaction.capitalIndex === action.settlementIndex) {
        warnings.push('This is the faction\'s capital — reassignment will leave the faction without a capital');
      }
    }

    return { valid: true, warnings };
  }

  private validateAdjustPopulation(
    action: Extract<RefinementAction, { kind: 'adjust_population' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    if (action.settlementIndex < 0 || action.settlementIndex >= world.settlements.length) {
      return { valid: false, warnings: [`Settlement index ${action.settlementIndex} out of range`] };
    }

    const settlement = world.settlements[action.settlementIndex]!;
    const bounds = POP_BOUNDS[settlement.type];

    if (action.newPopulation < 1) {
      return { valid: false, warnings: ['Population must be at least 1'] };
    }
    if (action.newPopulation > 1000000) {
      return { valid: false, warnings: ['Population exceeds maximum of 1,000,000'] };
    }

    if (action.newPopulation < bounds.min) {
      warnings.push(`Population ${action.newPopulation} is below typical minimum (${bounds.min}) for a ${settlement.type}`);
    }
    if (action.newPopulation > bounds.max) {
      warnings.push(`Population ${action.newPopulation} is above typical maximum (${bounds.max}) for a ${settlement.type}`);
    }

    return { valid: true, warnings };
  }

  private validateCreateCharacter(
    action: Extract<RefinementAction, { kind: 'create_character' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    if (action.name.trim().length === 0) {
      return { valid: false, warnings: ['Character name cannot be empty'] };
    }
    if (action.name.length > 100) {
      return { valid: false, warnings: ['Character name is too long (max 100 characters)'] };
    }
    if (action.factionIndex < 0 || action.factionIndex >= world.factions.length) {
      return { valid: false, warnings: [`Faction index ${action.factionIndex} out of range`] };
    }

    // Check race exists
    const faction = world.factions[action.factionIndex]!;
    if (action.raceName !== faction.primaryRace.name) {
      warnings.push(`Character race "${action.raceName}" differs from faction's primary race "${faction.primaryRace.name}"`);
    }

    // Validate personality overrides
    for (const [, value] of action.personalityOverrides) {
      if (value < -100 || value > 100) {
        return { valid: false, warnings: ['Personality trait values must be between -100 and +100'] };
      }
    }

    // Warn about duplicate rulers
    if (action.statusType === 'ruler') {
      const existingRuler = world.characters.find(
        c => c.status.type === 'ruler' && c.factionName === faction.name
      );
      if (existingRuler !== undefined) {
        warnings.push(`Faction "${faction.name}" already has a ruler: ${existingRuler.name}`);
      }
    }

    return { valid: true, warnings };
  }

  private validateRemoveCharacter(
    action: Extract<RefinementAction, { kind: 'remove_character' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    if (action.characterIndex < 0 || action.characterIndex >= world.characters.length) {
      return { valid: false, warnings: [`Character index ${action.characterIndex} out of range`] };
    }

    const character = world.characters[action.characterIndex]!;
    if (character.status.type === 'ruler') {
      warnings.push(`Removing ruler "${character.name}" will leave faction "${character.factionName}" leaderless`);
    }

    return { valid: true, warnings };
  }

  private validateEstablishAlliance(
    action: Extract<RefinementAction, { kind: 'establish_alliance' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    if (action.factionAIndex < 0 || action.factionAIndex >= world.factions.length) {
      return { valid: false, warnings: [`Faction A index ${action.factionAIndex} out of range`] };
    }
    if (action.factionBIndex < 0 || action.factionBIndex >= world.factions.length) {
      return { valid: false, warnings: [`Faction B index ${action.factionBIndex} out of range`] };
    }
    if (action.factionAIndex === action.factionBIndex) {
      return { valid: false, warnings: ['Cannot create alliance with self'] };
    }

    return { valid: true, warnings: [] };
  }

  private validateEstablishConflict(
    action: Extract<RefinementAction, { kind: 'establish_conflict' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    if (action.factionAIndex < 0 || action.factionAIndex >= world.factions.length) {
      return { valid: false, warnings: [`Faction A index ${action.factionAIndex} out of range`] };
    }
    if (action.factionBIndex < 0 || action.factionBIndex >= world.factions.length) {
      return { valid: false, warnings: [`Faction B index ${action.factionBIndex} out of range`] };
    }
    if (action.factionAIndex === action.factionBIndex) {
      return { valid: false, warnings: ['Cannot create conflict with self'] };
    }

    return { valid: true, warnings: [] };
  }

  private validatePlaceLandmark(
    action: Extract<RefinementAction, { kind: 'place_landmark' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    const width = world.worldMap.getWidth();
    const height = world.worldMap.getHeight();
    if (action.x < 0 || action.x >= width || action.y < 0 || action.y >= height) {
      return { valid: false, warnings: [`Coordinates (${action.x}, ${action.y}) out of map bounds`] };
    }
    if (action.name.trim().length === 0) {
      return { valid: false, warnings: ['Landmark name cannot be empty'] };
    }

    const tile = world.worldMap.getTile(action.x, action.y);
    if (tile !== undefined && (tile.biome === BiomeType.DeepOcean || tile.biome === BiomeType.Ocean)) {
      warnings.push('Landmark placed in water — will be submerged');
    }

    return { valid: true, warnings };
  }

  private validatePlaceArtifact(
    action: Extract<RefinementAction, { kind: 'place_artifact' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    if (action.settlementIndex < 0 || action.settlementIndex >= world.settlements.length) {
      return { valid: false, warnings: [`Settlement index ${action.settlementIndex} out of range`] };
    }
    if (action.artifactName.trim().length === 0) {
      return { valid: false, warnings: ['Artifact name cannot be empty'] };
    }
    if (action.powerLevel < 1 || action.powerLevel > 10) {
      return { valid: false, warnings: [`Power level ${action.powerLevel} out of range (1-10)`] };
    }

    if (action.powerLevel >= 8) {
      warnings.push('High-power artifacts may destabilize the simulation balance');
    }

    return { valid: true, warnings };
  }

  private validateModifyBiome(
    action: Extract<RefinementAction, { kind: 'modify_biome' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    const width = world.worldMap.getWidth();
    const height = world.worldMap.getHeight();
    if (action.x < 0 || action.x >= width || action.y < 0 || action.y >= height) {
      return { valid: false, warnings: [`Coordinates (${action.x}, ${action.y}) out of map bounds`] };
    }

    // Check for settlements on this tile
    const settlementsHere = world.settlements.filter(s => s.x === action.x && s.y === action.y);
    if (settlementsHere.length > 0 && UNINHABITABLE.has(action.newBiome)) {
      return { valid: false, warnings: [`Cannot change biome to ${action.newBiome} — settlement "${settlementsHere[0]!.name}" exists here`] };
    }

    if (UNINHABITABLE.has(action.newBiome)) {
      warnings.push(`Changing to ${action.newBiome} may isolate nearby settlements`);
    }

    return { valid: true, warnings };
  }

  private validateSeedEvent(
    action: Extract<RefinementAction, { kind: 'seed_event' }>,
    world: GeneratedWorldState
  ): ValidationResult {
    const warnings: string[] = [];

    if (action.targetFactionIndex < 0 || action.targetFactionIndex >= world.factions.length) {
      return { valid: false, warnings: [`Faction index ${action.targetFactionIndex} out of range`] };
    }
    if (action.triggerDay < 1) {
      return { valid: false, warnings: ['Trigger day must be at least 1'] };
    }
    if (action.triggerDay > MAX_TRIGGER_DAY) {
      return { valid: false, warnings: [`Trigger day ${action.triggerDay} exceeds maximum (${MAX_TRIGGER_DAY})`] };
    }
    if (action.description.trim().length === 0) {
      return { valid: false, warnings: ['Event description cannot be empty'] };
    }

    if (action.eventType === 'plague' || action.eventType === 'natural_disaster') {
      warnings.push(`Seeding a ${action.eventType} event may significantly impact the targeted faction`);
    }

    return { valid: true, warnings };
  }
}
