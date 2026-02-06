/**
 * Location Inspector - renders detailed settlement/site information.
 * Provides sections: overview, geography, demographics, economy, governance, military, structures, history.
 */

import type { EntityId } from '@fws/core';
import type { RenderContext } from '../types.js';
import type { InspectorSection, InspectorMode } from './inspector-panel.js';

/**
 * Bar rendering constants.
 */
const BAR_WIDTH = 20;
const FILLED_BLOCK = '█';
const EMPTY_BLOCK = '░';

/**
 * Location inspector sub-component.
 */
export class LocationInspector {
  /**
   * Get available sections for location inspection.
   */
  getSections(): InspectorSection[] {
    return [
      { id: 'overview', title: 'Overview', collapsed: false },
      { id: 'geography', title: 'Geography', collapsed: false },
      { id: 'demographics', title: 'Demographics', collapsed: true },
      { id: 'economy', title: 'Economy', collapsed: true },
      { id: 'governance', title: 'Governance', collapsed: true },
      { id: 'military', title: 'Military', collapsed: true },
      { id: 'structures', title: 'Structures', collapsed: true },
      { id: 'history', title: 'History', collapsed: true },
    ];
  }

  /**
   * Render location information.
   */
  render(
    entityId: EntityId,
    context: RenderContext,
    sections: readonly InspectorSection[],
    mode: InspectorMode
  ): string[] {
    const lines: string[] = [];

    switch (mode) {
      case 'overview':
        lines.push(...this.renderOverview(entityId, context, sections));
        break;
      case 'relationships':
        lines.push(...this.renderTradeRoutes(entityId, context));
        break;
      case 'timeline':
        lines.push(...this.renderTimelineMode(entityId, context));
        break;
      case 'details':
        lines.push(...this.renderDetailsMode(entityId, context));
        break;
    }

    return lines;
  }

  /**
   * Render overview mode with collapsible sections.
   */
  private renderOverview(
    entityId: EntityId,
    context: RenderContext,
    sections: readonly InspectorSection[]
  ): string[] {
    const lines: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (section === undefined) continue;

      const indicator = section.collapsed ? '▶' : '▼';
      const num = i + 1;
      lines.push(`${indicator} [${num}] ${section.title}`);

      if (!section.collapsed) {
        const content = this.renderSection(section.id, entityId, context);
        lines.push(...content.map(line => `  ${line}`));
        lines.push('');
      }
    }

    return lines;
  }

  /**
   * Render a specific section.
   */
  private renderSection(sectionId: string, entityId: EntityId, context: RenderContext): string[] {
    switch (sectionId) {
      case 'overview':
        return this.renderOverviewSection(entityId, context);
      case 'geography':
        return this.renderGeography(entityId, context);
      case 'demographics':
        return this.renderDemographics(entityId, context);
      case 'economy':
        return this.renderEconomy(entityId, context);
      case 'governance':
        return this.renderGovernance(entityId, context);
      case 'military':
        return this.renderMilitary(entityId, context);
      case 'structures':
        return this.renderStructures(entityId, context);
      case 'history':
        return this.renderHistory(entityId, context);
      default:
        return ['Unknown section'];
    }
  }

  /**
   * Render overview section with basic info.
   */
  private renderOverviewSection(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    // Get status for name
    const status = world.hasStore('Status')
      ? world.getComponent(entityId, 'Status') as { titles?: string[] } | undefined
      : undefined;

    // Get population
    const population = world.hasStore('Population')
      ? world.getComponent(entityId, 'Population') as { count?: number; growthRate?: number } | undefined
      : undefined;

    // Get ownership
    const ownership = world.hasStore('Ownership')
      ? world.getComponent(entityId, 'Ownership') as { ownerId?: number | null } | undefined
      : undefined;

    // Name
    if (status?.titles !== undefined && status.titles.length > 0) {
      lines.push(`Name: ${status.titles[0] ?? 'Unknown Settlement'}`);
    } else {
      lines.push(`Location #${entityId}`);
    }

    // Population
    if (population?.count !== undefined) {
      const pop = population.count;
      const sizeCategory = this.getSettlementSize(pop);
      lines.push(`Population: ${pop.toLocaleString()} (${sizeCategory})`);

      if (population.growthRate !== undefined) {
        const growthPct = (population.growthRate * 100).toFixed(1);
        const growthSign = population.growthRate >= 0 ? '+' : '';
        lines.push(`Growth Rate: ${growthSign}${growthPct}%`);
      }
    }

    // Owner
    if (ownership?.ownerId !== undefined && ownership.ownerId !== null) {
      lines.push(`Controlled by: Faction #${ownership.ownerId}`);
    }

    return lines;
  }

  /**
   * Get settlement size category based on population.
   */
  private getSettlementSize(population: number): string {
    if (population < 100) return 'Hamlet';
    if (population < 1000) return 'Village';
    if (population < 5000) return 'Town';
    if (population < 25000) return 'City';
    if (population < 100000) return 'Large City';
    return 'Metropolis';
  }

  /**
   * Render geography section.
   */
  private renderGeography(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    // Get position
    const position = world.hasStore('Position')
      ? world.getComponent(entityId, 'Position') as { x?: number; y?: number; z?: number } | undefined
      : undefined;

    // Get biome
    const biome = world.hasStore('Biome')
      ? world.getComponent(entityId, 'Biome') as { biomeType?: string; fertility?: number; moisture?: number } | undefined
      : undefined;

    // Get climate
    const climate = world.hasStore('Climate')
      ? world.getComponent(entityId, 'Climate') as { temperature?: number; rainfall?: number; seasonality?: number } | undefined
      : undefined;

    if (position !== undefined) {
      const x = position.x ?? 0;
      const y = position.y ?? 0;
      lines.push(`Coordinates: (${x}, ${y})`);
    }

    if (biome !== undefined) {
      if (biome.biomeType !== undefined) {
        lines.push(`Biome: ${biome.biomeType}`);
      }
      if (biome.fertility !== undefined) {
        const bar = this.renderBar(biome.fertility, 100);
        lines.push(`Fertility: ${bar} ${biome.fertility}%`);
      }
      if (biome.moisture !== undefined) {
        const bar = this.renderBar(biome.moisture, 100);
        lines.push(`Moisture: ${bar} ${biome.moisture}%`);
      }
    }

    if (climate !== undefined) {
      if (climate.temperature !== undefined) {
        lines.push(`Temperature: ${climate.temperature}°`);
      }
      if (climate.rainfall !== undefined) {
        lines.push(`Rainfall: ${climate.rainfall} mm/yr`);
      }
    }

    if (lines.length === 0) {
      lines.push('No geographic data');
    }

    return lines;
  }

  /**
   * Render demographics section.
   */
  private renderDemographics(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const demographics = world.hasStore('PopulationDemographics')
      ? world.getComponent(entityId, 'PopulationDemographics') as {
          ageDistribution?: Map<string, number>;
          raceDistribution?: Map<string, number>;
        } | undefined
      : undefined;

    const culture = world.hasStore('Culture')
      ? world.getComponent(entityId, 'Culture') as {
          traditions?: string[];
          values?: string[];
          languageId?: number | null;
        } | undefined
      : undefined;

    if (demographics?.raceDistribution !== undefined && demographics.raceDistribution.size > 0) {
      lines.push('Population by Race:');
      const total = [...demographics.raceDistribution.values()].reduce((a, b) => a + b, 0);
      for (const [race, count] of demographics.raceDistribution) {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        lines.push(`  ${race}: ${pct}%`);
      }
    }

    if (demographics?.ageDistribution !== undefined && demographics.ageDistribution.size > 0) {
      lines.push('');
      lines.push('Age Distribution:');
      const total = [...demographics.ageDistribution.values()].reduce((a, b) => a + b, 0);
      for (const [age, count] of demographics.ageDistribution) {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        lines.push(`  ${age}: ${pct}%`);
      }
    }

    if (culture !== undefined) {
      if (culture.languageId !== undefined && culture.languageId !== null) {
        lines.push('');
        lines.push(`Primary Language: #${culture.languageId}`);
      }

      if (culture.traditions !== undefined && culture.traditions.length > 0) {
        lines.push('');
        lines.push('Traditions:');
        for (const tradition of culture.traditions) {
          lines.push(`  • ${tradition}`);
        }
      }

      if (culture.values !== undefined && culture.values.length > 0) {
        lines.push('');
        lines.push('Cultural Values:');
        for (const value of culture.values) {
          lines.push(`  • ${value}`);
        }
      }
    }

    if (lines.length === 0) {
      lines.push('No demographic data');
    }

    return lines;
  }

  /**
   * Render economy section.
   */
  private renderEconomy(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const economy = world.hasStore('Economy')
      ? world.getComponent(entityId, 'Economy') as {
          wealth?: number;
          tradeVolume?: number;
          industries?: string[];
        } | undefined
      : undefined;

    const resources = world.hasStore('Resource')
      ? world.getComponent(entityId, 'Resource') as { resources?: Map<string, number> } | undefined
      : undefined;

    if (economy !== undefined) {
      if (economy.wealth !== undefined) {
        lines.push(`Wealth: ${economy.wealth.toLocaleString()}`);
      }
      if (economy.tradeVolume !== undefined) {
        lines.push(`Trade Volume: ${economy.tradeVolume.toLocaleString()}`);
      }
      if (economy.industries !== undefined && economy.industries.length > 0) {
        lines.push('');
        lines.push('Industries:');
        for (const industry of economy.industries) {
          lines.push(`  • ${industry}`);
        }
      }
    }

    if (resources?.resources !== undefined && resources.resources.size > 0) {
      lines.push('');
      lines.push('Resources:');
      for (const [resource, amount] of resources.resources) {
        lines.push(`  ${resource}: ${amount}`);
      }
    }

    if (lines.length === 0) {
      lines.push('No economic data');
    }

    return lines;
  }

  /**
   * Render governance section.
   */
  private renderGovernance(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const government = world.hasStore('Government')
      ? world.getComponent(entityId, 'Government') as {
          governmentType?: string;
          stability?: number;
          legitimacy?: number;
        } | undefined
      : undefined;

    const ownership = world.hasStore('Ownership')
      ? world.getComponent(entityId, 'Ownership') as { ownerId?: number | null; claimStrength?: number } | undefined
      : undefined;

    if (government !== undefined) {
      if (government.governmentType !== undefined) {
        lines.push(`Government Type: ${government.governmentType}`);
      }
      if (government.stability !== undefined) {
        const bar = this.renderBar(government.stability, 100);
        lines.push(`Stability: ${bar} ${government.stability}%`);
      }
      if (government.legitimacy !== undefined) {
        const bar = this.renderBar(government.legitimacy, 100);
        lines.push(`Legitimacy: ${bar} ${government.legitimacy}%`);
      }
    }

    if (ownership !== undefined) {
      if (ownership.ownerId !== undefined && ownership.ownerId !== null) {
        lines.push('');
        lines.push(`Ruling Faction: #${ownership.ownerId}`);
      }
      if (ownership.claimStrength !== undefined) {
        const bar = this.renderBar(ownership.claimStrength, 100);
        lines.push(`Claim Strength: ${bar} ${ownership.claimStrength}%`);
      }
    }

    if (lines.length === 0) {
      lines.push('No governance data');
    }

    return lines;
  }

  /**
   * Render military section.
   */
  private renderMilitary(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const military = world.hasStore('Military')
      ? world.getComponent(entityId, 'Military') as {
          strength?: number;
          morale?: number;
          training?: number;
        } | undefined
      : undefined;

    const structures = world.hasStore('Structures')
      ? world.getComponent(entityId, 'Structures') as { fortificationLevel?: number } | undefined
      : undefined;

    if (military !== undefined) {
      if (military.strength !== undefined) {
        lines.push(`Garrison Strength: ${military.strength}`);
      }
      if (military.morale !== undefined) {
        const bar = this.renderBar(military.morale, 100);
        lines.push(`Morale: ${bar} ${military.morale}%`);
      }
      if (military.training !== undefined) {
        const bar = this.renderBar(military.training, 100);
        lines.push(`Training: ${bar} ${military.training}%`);
      }
    }

    if (structures?.fortificationLevel !== undefined) {
      lines.push('');
      const fortLevel = structures.fortificationLevel;
      const fortName = this.getFortificationName(fortLevel);
      lines.push(`Fortifications: ${fortName} (Level ${fortLevel})`);
    }

    if (lines.length === 0) {
      lines.push('No military data');
    }

    return lines;
  }

  /**
   * Get fortification name based on level.
   */
  private getFortificationName(level: number): string {
    if (level <= 0) return 'None';
    if (level <= 1) return 'Palisade';
    if (level <= 2) return 'Wooden Walls';
    if (level <= 3) return 'Stone Walls';
    if (level <= 4) return 'Fortified Walls';
    return 'Castle';
  }

  /**
   * Render structures section.
   */
  private renderStructures(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const structures = world.hasStore('Structures')
      ? world.getComponent(entityId, 'Structures') as { buildings?: string[] } | undefined
      : undefined;

    const condition = world.hasStore('Condition')
      ? world.getComponent(entityId, 'Condition') as { durability?: number; maintenanceLevel?: number } | undefined
      : undefined;

    if (structures?.buildings !== undefined && structures.buildings.length > 0) {
      lines.push('Buildings:');
      for (const building of structures.buildings) {
        lines.push(`  • ${building}`);
      }
    }

    if (condition !== undefined) {
      lines.push('');
      if (condition.durability !== undefined) {
        const bar = this.renderBar(condition.durability, 100);
        lines.push(`Durability: ${bar} ${condition.durability}%`);
      }
      if (condition.maintenanceLevel !== undefined) {
        const bar = this.renderBar(condition.maintenanceLevel, 100);
        lines.push(`Maintenance: ${bar} ${condition.maintenanceLevel}%`);
      }
    }

    if (lines.length === 0) {
      lines.push('No structure data');
    }

    return lines;
  }

  /**
   * Render history section.
   */
  private renderHistory(entityId: EntityId, context: RenderContext): string[] {
    const { world, eventLog } = context;
    const lines: string[] = [];

    const history = world.hasStore('History')
      ? world.getComponent(entityId, 'History') as { events?: number[]; foundingDate?: number } | undefined
      : undefined;

    if (history?.foundingDate !== undefined) {
      const year = Math.floor(history.foundingDate / 360) + 1;
      lines.push(`Founded: Year ${year}`);
    }

    // Get recent events
    const events = eventLog.getByEntity(entityId);
    if (events.length > 0) {
      lines.push('');
      lines.push('Recent Events:');

      const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
      const toShow = sorted.slice(0, 10);

      for (const event of toShow) {
        const year = Math.floor(event.timestamp / 360) + 1;
        const desc = (event.data as Record<string, unknown>)['description'] ?? event.subtype;
        lines.push(`  Y${year}: ${desc}`);
      }

      if (sorted.length > 10) {
        lines.push(`  ... and ${sorted.length - 10} more events`);
      }
    } else {
      lines.push('No recorded events');
    }

    return lines;
  }

  /**
   * Render an ASCII bar.
   */
  private renderBar(value: number, maxValue: number): string {
    const normalized = Math.max(0, Math.min(1, value / maxValue));
    const filledCount = Math.round(normalized * BAR_WIDTH);
    const emptyCount = BAR_WIDTH - filledCount;

    return FILLED_BLOCK.repeat(filledCount) + EMPTY_BLOCK.repeat(emptyCount);
  }

  /**
   * Render trade routes (relationships mode).
   */
  private renderTradeRoutes(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Trade & Relations ═══');
    lines.push('');

    const { world } = context;

    const diplomacy = world.hasStore('Diplomacy')
      ? world.getComponent(entityId, 'Diplomacy') as {
          relations?: Map<number, number>;
          treaties?: string[];
        } | undefined
      : undefined;

    if (diplomacy?.relations !== undefined && diplomacy.relations.size > 0) {
      lines.push('Relations with other settlements:');
      for (const [otherId, relation] of diplomacy.relations) {
        const relLabel = relation > 50 ? 'Friendly' : relation > 0 ? 'Neutral' : 'Hostile';
        lines.push(`  #${otherId}: ${relLabel} (${relation})`);
      }
    }

    if (diplomacy?.treaties !== undefined && diplomacy.treaties.length > 0) {
      lines.push('');
      lines.push('Trade Agreements:');
      for (const treaty of diplomacy.treaties) {
        lines.push(`  • ${treaty}`);
      }
    }

    if (lines.length <= 2) {
      lines.push('No trade relations recorded');
    }

    return lines;
  }

  /**
   * Render full timeline mode.
   */
  private renderTimelineMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Settlement Timeline ═══');
    lines.push('');

    const { eventLog } = context;
    const events = eventLog.getByEntity(entityId);

    if (events.length === 0) {
      lines.push('No events recorded');
      return lines;
    }

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of sorted) {
      const year = Math.floor(event.timestamp / 360) + 1;
      const day = (event.timestamp % 360) + 1;
      const desc = (event.data as Record<string, unknown>)['description'] ?? event.subtype;
      lines.push(`Y${year}D${day}: ${desc}`);
      lines.push(`  Category: ${event.category}, Significance: ${event.significance}`);
      lines.push('');
    }

    return lines;
  }

  /**
   * Render full details mode.
   */
  private renderDetailsMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Full Details ═══');
    lines.push('');

    const allSections = ['overview', 'geography', 'demographics', 'economy', 'governance', 'military', 'structures', 'history'];

    for (const sectionId of allSections) {
      const title = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      lines.push(`─── ${title} ───`);
      lines.push(...this.renderSection(sectionId, entityId, context));
      lines.push('');
    }

    return lines;
  }
}
