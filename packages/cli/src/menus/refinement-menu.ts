/**
 * RefinementMenu — presents the generated world summary and collects
 * player adjustments before simulation begins. This is the one moment
 * of direct control; once simulation starts, only the influence system applies.
 */

import type { GeneratedWorldState, RefinementAction, RefinementLogEntry } from './refinement-types.js';

/**
 * World summary section for display.
 */
export interface WorldSummarySection {
  readonly heading: string;
  readonly lines: readonly string[];
}

/**
 * Full world summary for the refinement screen.
 */
export interface WorldSummary {
  readonly sections: readonly WorldSummarySection[];
  readonly totalSettlements: number;
  readonly totalFactions: number;
  readonly totalCharacters: number;
  readonly totalTensions: number;
  readonly yearsSimulated: number;
}

export class RefinementMenu {
  private readonly actions: RefinementAction[] = [];
  private readonly log: RefinementLogEntry[] = [];

  /**
   * Generate a textual summary of the generated world.
   */
  summarize(world: GeneratedWorldState): WorldSummary {
    const sections: WorldSummarySection[] = [];

    // Geography
    sections.push({
      heading: 'Geography',
      lines: [
        `World size: ${world.config.worldSize} (${world.worldMap.getWidth()}×${world.worldMap.getHeight()})`,
        `Geological activity: ${world.config.geologicalActivity}`,
        `Rivers: ${world.worldMap.getRivers().length}`,
      ],
    });

    // Settlements
    const cities = world.settlements.filter(s => s.type === 'city');
    const towns = world.settlements.filter(s => s.type === 'town');
    const villages = world.settlements.filter(s => s.type === 'village');
    sections.push({
      heading: 'Settlements',
      lines: [
        `Cities: ${cities.length}`,
        `Towns: ${towns.length}`,
        `Villages: ${villages.length}`,
        `Total population: ${world.settlements.reduce((sum, s) => sum + s.population, 0).toLocaleString()}`,
      ],
    });

    // Factions
    const factionLines: string[] = [];
    for (const faction of world.factions) {
      factionLines.push(
        `${faction.name} (${faction.governmentType}) — ${faction.primaryRace.name}, ${faction.settlementIndices.length} settlements`
      );
    }
    sections.push({
      heading: 'Factions',
      lines: factionLines.length > 0 ? factionLines : ['No factions established'],
    });

    // Characters
    const rulers = world.characters.filter(c => c.status.type === 'ruler');
    const notables = world.characters.filter(c => c.status.type !== 'ruler');
    sections.push({
      heading: 'Notable Characters',
      lines: [
        `Rulers: ${rulers.length}`,
        `Other notables: ${notables.length}`,
      ],
    });

    // Tensions
    const tensionsByType = new Map<string, number>();
    for (const t of world.tensions) {
      tensionsByType.set(t.type, (tensionsByType.get(t.type) ?? 0) + 1);
    }
    const tensionLines: string[] = [];
    for (const [type, count] of tensionsByType) {
      tensionLines.push(`${type.replace(/_/g, ' ')}: ${count}`);
    }
    sections.push({
      heading: 'Current Tensions',
      lines: tensionLines.length > 0 ? tensionLines : ['No active tensions'],
    });

    // Pre-history summary
    sections.push({
      heading: 'Pre-History',
      lines: [
        `Years simulated: ${world.preHistory.yearsSimulated}`,
        `Historical wars: ${world.preHistory.historicalWars.length}`,
        `Legendary figures: ${world.preHistory.legendaryFigures.length}`,
        `Artifacts: ${world.preHistory.artifacts.length}`,
        `Ruins: ${world.preHistory.ruins.length}`,
        `Cultural legacies: ${world.preHistory.culturalLegacies.length}`,
      ],
    });

    // Configuration
    sections.push({
      heading: 'World Settings',
      lines: [
        `Magic: ${world.config.magicPrevalence}`,
        `Danger: ${world.config.dangerLevel}`,
        `Pantheon: ${world.config.pantheonComplexity}`,
        `Technology: ${world.config.technologyEra}`,
        `Race diversity: ${world.config.raceDiversity}`,
      ],
    });

    return {
      sections,
      totalSettlements: world.settlements.length,
      totalFactions: world.factions.length,
      totalCharacters: world.characters.length,
      totalTensions: world.tensions.length,
      yearsSimulated: world.preHistory.yearsSimulated,
    };
  }

  /**
   * Queue a refinement action.
   */
  addAction(action: RefinementAction): void {
    this.actions.push(action);
    this.log.push({
      action,
      timestamp: Date.now(),
      description: this.describeAction(action),
    });
  }

  /**
   * Remove the last queued action (undo).
   */
  undoLast(): RefinementAction | undefined {
    const removed = this.actions.pop();
    if (removed !== undefined) {
      this.log.push({
        action: removed,
        timestamp: Date.now(),
        description: `UNDO: ${this.describeAction(removed)}`,
      });
    }
    return removed;
  }

  /**
   * Clear all queued actions.
   */
  clearActions(): void {
    this.actions.length = 0;
  }

  /**
   * Get all queued actions.
   */
  getActions(): readonly RefinementAction[] {
    return this.actions;
  }

  /**
   * Get the full action log (including undos).
   */
  getLog(): readonly RefinementLogEntry[] {
    return this.log;
  }

  /**
   * Generate a human-readable description for an action.
   */
  describeAction(action: RefinementAction): string {
    switch (action.kind) {
      case 'move_settlement':
        return `Move settlement #${action.settlementIndex} to (${action.newX}, ${action.newY})`;
      case 'resize_territory':
        return `Reassign settlement #${action.settlementIndex} to faction #${action.newFactionIndex}`;
      case 'adjust_population':
        return `Set settlement #${action.settlementIndex} population to ${action.newPopulation}`;
      case 'create_character':
        return `Create character "${action.name}" (${action.statusType}) in faction #${action.factionIndex}`;
      case 'remove_character':
        return `Remove character #${action.characterIndex}`;
      case 'establish_alliance':
        return `Alliance between faction #${action.factionAIndex} and #${action.factionBIndex}`;
      case 'establish_conflict':
        return `${action.severity} conflict between faction #${action.factionAIndex} and #${action.factionBIndex}`;
      case 'place_landmark':
        return `Place landmark "${action.name}" at (${action.x}, ${action.y})`;
      case 'place_artifact':
        return `Place artifact "${action.artifactName}" (${action.artifactType}) at settlement #${action.settlementIndex}`;
      case 'modify_biome':
        return `Change biome at (${action.x}, ${action.y}) to ${action.newBiome}`;
      case 'seed_event':
        return `Seed ${action.eventType} event for faction #${action.targetFactionIndex} at day ${action.triggerDay}`;
    }
  }
}
