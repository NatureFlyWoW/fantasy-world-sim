/**
 * RefinementApplier — applies validated refinement actions to the generated
 * world state. Each action is logged as a "pre-simulation adjustment" event.
 */

import type { GeneratedCharacter, LegendaryArtifact, SkillName, PersonalityTraitName } from '@fws/generator';
import type {
  GeneratedWorldState,
  RefinementAction,
  RefinementResult,
  RefinementLogEntry,
  Landmark,
  SeededEvent,
} from './refinement-types.js';
import { RefinementValidator } from './refinement-validator.js';
import { RefinementMenu } from './refinement-menu.js';

export class RefinementApplier {
  private readonly validator: RefinementValidator;
  private readonly menu: RefinementMenu;

  constructor() {
    this.validator = new RefinementValidator();
    this.menu = new RefinementMenu();
  }

  /**
   * Apply a list of validated refinements to the world state.
   * Invalid actions are skipped and counted.
   */
  apply(world: GeneratedWorldState, actions: readonly RefinementAction[]): RefinementResult {
    const log: RefinementLogEntry[] = [];
    const landmarks: Landmark[] = [];
    const seededEvents: SeededEvent[] = [];
    const addedArtifacts: LegendaryArtifact[] = [];
    let appliedCount = 0;
    let rejectedCount = 0;

    for (const action of actions) {
      const validation = this.validator.validate(action, world);
      const description = this.menu.describeAction(action);

      if (!validation.valid) {
        log.push({
          action,
          timestamp: Date.now(),
          description: `REJECTED: ${description} — ${validation.warnings.join('; ')}`,
        });
        rejectedCount++;
        continue;
      }

      // Apply the action
      this.applyAction(action, world, landmarks, seededEvents, addedArtifacts);

      // Log with warnings if any
      const warningText = validation.warnings.length > 0
        ? ` [warnings: ${validation.warnings.join('; ')}]`
        : '';
      log.push({
        action,
        timestamp: Date.now(),
        description: `APPLIED: ${description}${warningText}`,
      });
      appliedCount++;
    }

    return {
      appliedCount,
      rejectedCount,
      log,
      landmarks,
      seededEvents,
      addedArtifacts,
    };
  }

  private applyAction(
    action: RefinementAction,
    world: GeneratedWorldState,
    landmarks: Landmark[],
    seededEvents: SeededEvent[],
    addedArtifacts: LegendaryArtifact[]
  ): void {
    switch (action.kind) {
      case 'move_settlement':
        this.applyMoveSettlement(action, world);
        break;
      case 'resize_territory':
        this.applyResizeTerritory(action, world);
        break;
      case 'adjust_population':
        this.applyAdjustPopulation(action, world);
        break;
      case 'create_character':
        this.applyCreateCharacter(action, world);
        break;
      case 'remove_character':
        this.applyRemoveCharacter(action, world);
        break;
      case 'establish_alliance':
        this.applyEstablishAlliance(action, world);
        break;
      case 'establish_conflict':
        this.applyEstablishConflict(action, world);
        break;
      case 'place_landmark':
        this.applyPlaceLandmark(action, landmarks);
        break;
      case 'place_artifact':
        this.applyPlaceArtifact(action, world, addedArtifacts);
        break;
      case 'modify_biome':
        this.applyModifyBiome(action, world);
        break;
      case 'seed_event':
        this.applySeedEvent(action, seededEvents);
        break;
    }
  }

  private applyMoveSettlement(
    action: Extract<RefinementAction, { kind: 'move_settlement' }>,
    world: GeneratedWorldState
  ): void {
    const settlement = world.settlements[action.settlementIndex]!;
    // Settlements have readonly x/y — we need to replace the object
    world.settlements[action.settlementIndex] = {
      ...settlement,
      x: action.newX,
      y: action.newY,
    };
  }

  private applyResizeTerritory(
    action: Extract<RefinementAction, { kind: 'resize_territory' }>,
    world: GeneratedWorldState
  ): void {
    const settlement = world.settlements[action.settlementIndex]!;
    const oldFactionIdx = settlement.factionIndex;

    // Remove from old faction's settlement list
    if (oldFactionIdx !== undefined) {
      const oldFaction = world.factions[oldFactionIdx];
      if (oldFaction !== undefined) {
        const newIndices = oldFaction.settlementIndices.filter(
          (i: number) => i !== action.settlementIndex
        );
        world.factions[oldFactionIdx] = {
          ...oldFaction,
          settlementIndices: newIndices,
        };
      }
    }

    // Add to new faction's settlement list
    const newFaction = world.factions[action.newFactionIndex]!;
    world.factions[action.newFactionIndex] = {
      ...newFaction,
      settlementIndices: [...newFaction.settlementIndices, action.settlementIndex],
    };

    // Update settlement's faction reference
    world.settlements[action.settlementIndex] = {
      ...settlement,
      factionIndex: action.newFactionIndex,
    };
  }

  private applyAdjustPopulation(
    action: Extract<RefinementAction, { kind: 'adjust_population' }>,
    world: GeneratedWorldState
  ): void {
    const settlement = world.settlements[action.settlementIndex]!;
    world.settlements[action.settlementIndex] = {
      ...settlement,
      population: action.newPopulation,
    };
  }

  private applyCreateCharacter(
    action: Extract<RefinementAction, { kind: 'create_character' }>,
    world: GeneratedWorldState
  ): void {
    const faction = world.factions[action.factionIndex]!;
    const capitalSettlement = world.settlements[faction.capitalIndex];

    // Build personality traits map, starting from neutral
    const traits = new Map<PersonalityTraitName, number>();
    const allTraits: PersonalityTraitName[] = [
      'ambitious', 'loyal', 'cruel', 'scholarly', 'curious', 'amoral',
      'paranoid', 'patient', 'impulsive', 'brave', 'cautious', 'empathetic',
      'selfAbsorbed', 'vengeful', 'forgiving', 'creative', 'pragmatic', 'idealistic',
    ];
    for (const t of allTraits) {
      traits.set(t, 0);
    }
    // Apply overrides
    for (const [trait, value] of action.personalityOverrides) {
      traits.set(trait, value);
    }

    // Build default skills
    const skills = new Map<SkillName, number>();
    const allSkills: SkillName[] = [
      'combat', 'leadership', 'diplomacy', 'stealth', 'magic',
      'crafting', 'medicine', 'lore', 'trade', 'survival',
    ];
    for (const s of allSkills) {
      skills.set(s, 20);
    }

    const character: GeneratedCharacter = {
      name: action.name,
      fullName: { first: action.name.split(' ')[0] ?? action.name, family: action.name.split(' ').slice(1).join(' ') || 'Unknown' },
      gender: 'male',
      age: 30,
      raceName: action.raceName,
      factionName: faction.name,
      position: {
        x: capitalSettlement?.x ?? 0,
        y: capitalSettlement?.y ?? 0,
        settlementName: capitalSettlement?.name,
      },
      attributes: {
        strength: 50,
        agility: 50,
        endurance: 50,
        intelligence: 50,
        wisdom: 50,
        charisma: 50,
      },
      skills: { skills },
      personality: { traits },
      relationships: [],
      goals: [{ description: 'Fulfill my destiny', priority: 5 }],
      memories: [{ description: 'Placed by the hand of fate', year: 0, emotionalWeight: 50 }],
      beliefs: [{ description: 'I am destined for greatness', strength: 70 }],
      possessions: [{ name: 'Gold coins', type: 'gold', value: 100 }],
      reputations: [{ factionName: faction.name, standing: 50 }],
      status: { type: action.statusType, title: action.statusType.charAt(0).toUpperCase() + action.statusType.slice(1) },
      health: { current: 100, max: 100, conditions: [] },
    };

    world.characters.push(character);
  }

  private applyRemoveCharacter(
    action: Extract<RefinementAction, { kind: 'remove_character' }>,
    world: GeneratedWorldState
  ): void {
    world.characters.splice(action.characterIndex, 1);
  }

  private applyEstablishAlliance(
    action: Extract<RefinementAction, { kind: 'establish_alliance' }>,
    world: GeneratedWorldState
  ): void {
    const factionA = world.factions[action.factionAIndex]!;
    const factionB = world.factions[action.factionBIndex]!;

    // Remove any existing conflicts between these factions
    world.tensions = world.tensions.filter(t => !(
      (t.factionAIndex === action.factionAIndex && t.factionBIndex === action.factionBIndex) ||
      (t.factionAIndex === action.factionBIndex && t.factionBIndex === action.factionAIndex)
    ));

    // Add alliance as a negative-severity tension (diplomatic bond)
    world.tensions.push({
      type: 'trade_rivalry' as const,
      severity: 'minor' as const,
      factionAIndex: action.factionAIndex,
      factionBIndex: action.factionBIndex,
      description: `Alliance established between ${factionA.name} and ${factionB.name}`,
      escalationRisk: 0,
    });
  }

  private applyEstablishConflict(
    action: Extract<RefinementAction, { kind: 'establish_conflict' }>,
    world: GeneratedWorldState
  ): void {
    const factionA = world.factions[action.factionAIndex]!;
    const factionB = world.factions[action.factionBIndex]!;

    const escalationMap: Record<string, number> = {
      minor: 20,
      moderate: 40,
      major: 65,
      critical: 90,
    };

    world.tensions.push({
      type: 'border_dispute' as const,
      severity: action.severity,
      factionAIndex: action.factionAIndex,
      factionBIndex: action.factionBIndex,
      description: `Conflict seeded between ${factionA.name} and ${factionB.name}`,
      escalationRisk: escalationMap[action.severity] ?? 40,
    });
  }

  private applyPlaceLandmark(
    action: Extract<RefinementAction, { kind: 'place_landmark' }>,
    landmarks: Landmark[]
  ): void {
    landmarks.push({
      x: action.x,
      y: action.y,
      name: action.name,
      description: action.description,
    });
  }

  private applyPlaceArtifact(
    action: Extract<RefinementAction, { kind: 'place_artifact' }>,
    world: GeneratedWorldState,
    addedArtifacts: LegendaryArtifact[]
  ): void {
    const settlement = world.settlements[action.settlementIndex]!;

    const artifact: LegendaryArtifact = {
      name: action.artifactName,
      type: action.artifactType,
      powerLevel: action.powerLevel,
      creatorName: undefined,
      forgeYear: 0,
      originCiv: settlement.name,
      description: `A legendary ${action.artifactType} placed at ${settlement.name} by the hand of fate`,
    };

    addedArtifacts.push(artifact);
  }

  private applyModifyBiome(
    action: Extract<RefinementAction, { kind: 'modify_biome' }>,
    world: GeneratedWorldState
  ): void {
    const tile = world.worldMap.getTile(action.x, action.y);
    if (tile !== undefined) {
      // TerrainTile is a plain object with mutable biome
      tile.biome = action.newBiome;
    }
  }

  private applySeedEvent(
    action: Extract<RefinementAction, { kind: 'seed_event' }>,
    seededEvents: SeededEvent[]
  ): void {
    seededEvents.push({
      eventType: action.eventType,
      targetFactionIndex: action.targetFactionIndex,
      triggerDay: action.triggerDay,
      description: action.description,
    });
  }
}
