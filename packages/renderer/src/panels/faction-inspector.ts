/**
 * Faction Inspector - renders detailed faction information.
 * Provides sections: overview, government, territory, military, diplomacy, economy, leadership, history.
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
 * Faction inspector sub-component.
 */
export class FactionInspector {
  /**
   * Get available sections for faction inspection.
   */
  getSections(): InspectorSection[] {
    return [
      { id: 'overview', title: 'Overview', collapsed: false },
      { id: 'government', title: 'Government', collapsed: false },
      { id: 'territory', title: 'Territory', collapsed: true },
      { id: 'military', title: 'Military', collapsed: true },
      { id: 'diplomacy', title: 'Diplomacy', collapsed: true },
      { id: 'economy', title: 'Economy', collapsed: true },
      { id: 'leadership', title: 'Leadership', collapsed: true },
      { id: 'history', title: 'History', collapsed: true },
    ];
  }

  /**
   * Render faction information.
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
        lines.push(...this.renderDiplomacyMode(entityId, context));
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
      case 'government':
        return this.renderGovernment(entityId, context);
      case 'territory':
        return this.renderTerritory(entityId, context);
      case 'military':
        return this.renderMilitary(entityId, context);
      case 'diplomacy':
        return this.renderDiplomacy(entityId, context);
      case 'economy':
        return this.renderEconomy(entityId, context);
      case 'leadership':
        return this.renderLeadership(entityId, context);
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
      ? world.getComponent(entityId, 'Population') as { count?: number } | undefined
      : undefined;

    // Get territory for size
    const territory = world.hasStore('Territory')
      ? world.getComponent(entityId, 'Territory') as { controlledRegions?: number[]; capitalId?: number | null } | undefined
      : undefined;

    // Name
    if (status?.titles !== undefined && status.titles.length > 0) {
      lines.push(`Name: ${status.titles[0] ?? 'Unknown Faction'}`);
    } else {
      lines.push(`Faction #${entityId}`);
    }

    // Population
    if (population?.count !== undefined) {
      lines.push(`Total Population: ${population.count.toLocaleString()}`);
    }

    // Territory size
    if (territory?.controlledRegions !== undefined) {
      const regionCount = territory.controlledRegions.length;
      lines.push(`Controlled Regions: ${regionCount}`);

      if (territory.capitalId !== undefined && territory.capitalId !== null) {
        lines.push(`Capital: Location #${territory.capitalId}`);
      }
    }

    return lines;
  }

  /**
   * Render government section.
   */
  private renderGovernment(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const government = world.hasStore('Government')
      ? world.getComponent(entityId, 'Government') as {
          governmentType?: string;
          stability?: number;
          legitimacy?: number;
        } | undefined
      : undefined;

    const doctrine = world.hasStore('Doctrine')
      ? world.getComponent(entityId, 'Doctrine') as {
          beliefs?: string[];
          prohibitions?: string[];
        } | undefined
      : undefined;

    if (government !== undefined) {
      if (government.governmentType !== undefined) {
        lines.push(`Type: ${government.governmentType}`);
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

    if (doctrine !== undefined) {
      if (doctrine.beliefs !== undefined && doctrine.beliefs.length > 0) {
        lines.push('');
        lines.push('Guiding Principles:');
        for (const belief of doctrine.beliefs.slice(0, 5)) {
          lines.push(`  • ${belief}`);
        }
      }
    }

    if (lines.length === 0) {
      lines.push('No government data');
    }

    return lines;
  }

  /**
   * Render territory section.
   */
  private renderTerritory(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const territory = world.hasStore('Territory')
      ? world.getComponent(entityId, 'Territory') as {
          controlledRegions?: number[];
          capitalId?: number | null;
        } | undefined
      : undefined;

    if (territory !== undefined) {
      if (territory.capitalId !== undefined && territory.capitalId !== null) {
        lines.push(`Capital: Location #${territory.capitalId}`);
      }

      if (territory.controlledRegions !== undefined && territory.controlledRegions.length > 0) {
        lines.push('');
        lines.push(`Controlled Regions (${territory.controlledRegions.length}):`);
        const toShow = territory.controlledRegions.slice(0, 10);
        for (const regionId of toShow) {
          lines.push(`  • Region #${regionId}`);
        }
        if (territory.controlledRegions.length > 10) {
          lines.push(`  ... and ${territory.controlledRegions.length - 10} more`);
        }
      }
    } else {
      lines.push('No territory data');
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

    if (military !== undefined) {
      if (military.strength !== undefined) {
        lines.push(`Total Strength: ${military.strength.toLocaleString()}`);
      }
      if (military.morale !== undefined) {
        const bar = this.renderBar(military.morale, 100);
        lines.push(`Army Morale: ${bar} ${military.morale}%`);
      }
      if (military.training !== undefined) {
        const bar = this.renderBar(military.training, 100);
        lines.push(`Training Level: ${bar} ${military.training}%`);
      }
    } else {
      lines.push('No military data');
    }

    return lines;
  }

  /**
   * Render diplomacy section.
   */
  private renderDiplomacy(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const diplomacy = world.hasStore('Diplomacy')
      ? world.getComponent(entityId, 'Diplomacy') as {
          relations?: Map<number, number>;
          treaties?: string[];
        } | undefined
      : undefined;

    if (diplomacy !== undefined) {
      if (diplomacy.relations !== undefined && diplomacy.relations.size > 0) {
        lines.push('Relations:');

        // Sort by relation value
        const sorted = [...diplomacy.relations.entries()].sort((a, b) => b[1] - a[1]);
        const toShow = sorted.slice(0, 10);

        for (const [factionId, relation] of toShow) {
          const label = this.getRelationLabel(relation);
          const sign = relation >= 0 ? '+' : '';
          lines.push(`  Faction #${factionId}: ${label} (${sign}${relation})`);
        }

        if (sorted.length > 10) {
          lines.push(`  ... and ${sorted.length - 10} more`);
        }
      }

      if (diplomacy.treaties !== undefined && diplomacy.treaties.length > 0) {
        lines.push('');
        lines.push('Treaties:');
        for (const treaty of diplomacy.treaties) {
          lines.push(`  • ${treaty}`);
        }
      }
    } else {
      lines.push('No diplomatic data');
    }

    return lines;
  }

  /**
   * Get relation label based on value.
   */
  private getRelationLabel(relation: number): string {
    if (relation >= 80) return 'Allied';
    if (relation >= 50) return 'Friendly';
    if (relation >= 20) return 'Cordial';
    if (relation >= -20) return 'Neutral';
    if (relation >= -50) return 'Unfriendly';
    if (relation >= -80) return 'Hostile';
    return 'At War';
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

    const wealth = world.hasStore('Wealth')
      ? world.getComponent(entityId, 'Wealth') as {
          coins?: number;
          propertyValue?: number;
          debts?: number;
        } | undefined
      : undefined;

    if (economy !== undefined) {
      if (economy.wealth !== undefined) {
        lines.push(`Treasury: ${economy.wealth.toLocaleString()}`);
      }
      if (economy.tradeVolume !== undefined) {
        lines.push(`Trade Volume: ${economy.tradeVolume.toLocaleString()}`);
      }
      if (economy.industries !== undefined && economy.industries.length > 0) {
        lines.push('');
        lines.push('Major Industries:');
        for (const industry of economy.industries) {
          lines.push(`  • ${industry}`);
        }
      }
    }

    if (wealth !== undefined) {
      lines.push('');
      if (wealth.propertyValue !== undefined) {
        lines.push(`Total Assets: ${wealth.propertyValue.toLocaleString()}`);
      }
      if (wealth.debts !== undefined && wealth.debts > 0) {
        lines.push(`National Debt: ${wealth.debts.toLocaleString()}`);
      }
    }

    if (lines.length === 0) {
      lines.push('No economic data');
    }

    return lines;
  }

  /**
   * Render leadership section.
   */
  private renderLeadership(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const hierarchy = world.hasStore('Hierarchy')
      ? world.getComponent(entityId, 'Hierarchy') as {
          leaderId?: number | null;
          subordinateIds?: number[];
        } | undefined
      : undefined;

    if (hierarchy !== undefined) {
      if (hierarchy.leaderId !== undefined && hierarchy.leaderId !== null) {
        lines.push(`Leader: Character #${hierarchy.leaderId}`);
      }

      if (hierarchy.subordinateIds !== undefined && hierarchy.subordinateIds.length > 0) {
        lines.push('');
        lines.push('Council/Subordinates:');
        const toShow = hierarchy.subordinateIds.slice(0, 10);
        for (const subordinateId of toShow) {
          lines.push(`  • Character #${subordinateId}`);
        }
        if (hierarchy.subordinateIds.length > 10) {
          lines.push(`  ... and ${hierarchy.subordinateIds.length - 10} more`);
        }
      }
    } else {
      lines.push('No leadership data');
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
      ? world.getComponent(entityId, 'History') as { foundingDate?: number } | undefined
      : undefined;

    const origin = world.hasStore('Origin')
      ? world.getComponent(entityId, 'Origin') as {
          founderId?: number | null;
          foundingTick?: number;
          foundingLocation?: number | null;
        } | undefined
      : undefined;

    if (origin !== undefined) {
      if (origin.foundingTick !== undefined) {
        const year = Math.floor(origin.foundingTick / 360) + 1;
        lines.push(`Founded: Year ${year}`);
      }
      if (origin.founderId !== undefined && origin.founderId !== null) {
        lines.push(`Founder: Character #${origin.founderId}`);
      }
      if (origin.foundingLocation !== undefined && origin.foundingLocation !== null) {
        lines.push(`Origin: Location #${origin.foundingLocation}`);
      }
    } else if (history?.foundingDate !== undefined) {
      const year = Math.floor(history.foundingDate / 360) + 1;
      lines.push(`Founded: Year ${year}`);
    }

    // Recent events
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
    }

    if (lines.length === 0) {
      lines.push('No historical data');
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
   * Render full diplomacy mode.
   */
  private renderDiplomacyMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Diplomatic Relations ═══');
    lines.push('');
    lines.push(...this.renderDiplomacy(entityId, context));
    return lines;
  }

  /**
   * Render full timeline mode.
   */
  private renderTimelineMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Faction History ═══');
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

    const allSections = ['overview', 'government', 'territory', 'military', 'diplomacy', 'economy', 'leadership', 'history'];

    for (const sectionId of allSections) {
      const title = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      lines.push(`─── ${title} ───`);
      lines.push(...this.renderSection(sectionId, entityId, context));
      lines.push('');
    }

    return lines;
  }
}
