/**
 * Location (Site) Inspector - renders detailed settlement/site information with prose-first design.
 * Provides 7 sections: A Living Portrait, People & Peoples, Power & Governance,
 * Trade & Industry, Walls & Works, Notable Souls, The Annals.
 */

import type { EntityId } from '@fws/core';
import type { RenderContext } from '../types.js';
import type { InspectorSection, InspectorMode } from './inspector-panel.js';
import {
  DIM_COLOR,
  SETTLEMENT_SIZE_PROSE,
  ECONOMIC_PROSE,
  renderEntityName,
  renderBar,
  getSettlementSize,
  getEconomicState,
  tickToYear,
  tickToSeason,
  getSignificanceLabel,
  createEntitySpanMap,
} from './inspector-prose.js';
import type { EntitySpanMap } from './inspector-prose.js';

/**
 * Fortification level prose.
 */
const FORTIFICATION_PROSE: Readonly<Record<string, string>> = {
  None: 'The settlement lies open and undefended',
  Palisade: 'A wooden palisade offers modest protection against raiders',
  'Wooden Walls': 'Sturdy wooden walls encircle the settlement',
  'Stone Walls': 'Solid stone walls stand guard over the approaches',
  'Fortified Walls': 'Thick fortified walls bristle with towers and battlements',
  Castle: 'A mighty castle dominates the skyline, its defenses virtually impregnable',
};

/**
 * Location inspector sub-component with prose-first rendering.
 */
export class LocationInspector {
  private entitySpans: EntitySpanMap = createEntitySpanMap();

  /**
   * Get available sections for location inspection.
   */
  getSections(entityId?: EntityId, context?: RenderContext): InspectorSection[] {
    let settlementType = '';
    let popHint = '';
    let rulerHint = '';
    let wealthHint = '';
    let fortHint = '';
    let charCount = 0;
    let eventCount = 0;

    if (entityId !== undefined && context !== undefined) {
      const { world } = context;

      // Population and size
      if (world.hasStore('Population')) {
        const pop = world.getComponent(entityId, 'Population') as { count?: number } | undefined;
        if (pop?.count !== undefined) {
          settlementType = getSettlementSize(pop.count);
          popHint = `${pop.count.toLocaleString()} souls`;
        }
      }

      // Ruler/faction
      if (world.hasStore('Ownership')) {
        const ownership = world.getComponent(entityId, 'Ownership') as { ownerId?: number | null } | undefined;
        if (ownership?.ownerId !== undefined && ownership.ownerId !== null) {
          rulerHint = this.resolveEntityName(ownership.ownerId as unknown as EntityId, context);
        }
      }

      // Wealth
      if (world.hasStore('Economy')) {
        const economy = world.getComponent(entityId, 'Economy') as { wealth?: number } | undefined;
        if (economy?.wealth !== undefined) {
          const state = getEconomicState(economy.wealth);
          const econProse = ECONOMIC_PROSE[state];
          wealthHint = econProse !== undefined ? state.charAt(0).toUpperCase() + state.slice(1) : '';
        }
      }

      // Fortification
      if (world.hasStore('Structures')) {
        const structures = world.getComponent(entityId, 'Structures') as { fortificationLevel?: number } | undefined;
        if (structures?.fortificationLevel !== undefined) {
          fortHint = this.getFortificationName(structures.fortificationLevel);
        }
      }

      // Notable characters (count entities at this position)
      if (world.hasStore('Position')) {
        const pos = world.getComponent(entityId, 'Position') as { x?: number; y?: number } | undefined;
        if (pos?.x !== undefined && pos.y !== undefined) {
          const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> } | undefined;
          if (posStore !== undefined) {
            for (const [eid, ePos] of posStore.getAll()) {
              if (eid !== entityId && ePos.x === pos.x && ePos.y === pos.y) {
                if (world.hasStore('Attribute') && world.getComponent(eid, 'Attribute') !== undefined) {
                  charCount++;
                }
              }
            }
          }
        }
      }

      // Event count
      eventCount = context.eventLog.getByEntity(entityId).length;
    }

    return [
      { id: 'living-portrait', title: 'A Living Portrait', collapsed: false, ...(settlementType.length > 0 ? { summaryHint: settlementType } : {}) },
      { id: 'people-peoples', title: 'People & Peoples', collapsed: false, ...(popHint.length > 0 ? { summaryHint: popHint } : {}) },
      { id: 'power-governance', title: 'Power & Governance', collapsed: true, ...(rulerHint.length > 0 ? { summaryHint: rulerHint } : {}) },
      { id: 'trade-industry', title: 'Trade & Industry', collapsed: true, ...(wealthHint.length > 0 ? { summaryHint: wealthHint } : {}) },
      { id: 'walls-works', title: 'Walls & Works', collapsed: true, ...(fortHint.length > 0 ? { summaryHint: fortHint } : {}) },
      { id: 'notable-souls', title: 'Notable Souls', collapsed: true, ...(charCount > 0 ? { summaryHint: `${charCount} characters` } : {}) },
      { id: 'the-annals', title: 'The Annals', collapsed: true, ...(eventCount > 0 ? { summaryHint: `${eventCount} events` } : {}) },
    ];
  }

  /**
   * Get entity span map for click detection.
   */
  getEntitySpans(): EntitySpanMap {
    return this.entitySpans;
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
    this.entitySpans = createEntitySpanMap();
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

      const indicator = section.collapsed ? '>' : 'v';
      const num = i + 1;
      const hint = section.summaryHint !== undefined ? `  {${DIM_COLOR}-fg}${section.summaryHint}{/}` : '';
      lines.push(`  ${indicator} [${num}] ${section.title}${hint}`);

      if (!section.collapsed) {
        const content = this.renderSection(section.id, entityId, context);
        lines.push(...content.map(line => `    ${line}`));
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
      case 'living-portrait':
        return this.renderLivingPortrait(entityId, context);
      case 'people-peoples':
        return this.renderPeoplePeoples(entityId, context);
      case 'power-governance':
        return this.renderPowerGovernance(entityId, context);
      case 'trade-industry':
        return this.renderTradeIndustry(entityId, context);
      case 'walls-works':
        return this.renderWallsWorks(entityId, context);
      case 'notable-souls':
        return this.renderNotableSouls(entityId, context);
      case 'the-annals':
        return this.renderTheAnnals(entityId, context);
      default:
        return ['Unknown section'];
    }
  }

  // ─── Section 1: A Living Portrait ─────────────────────────────────

  private renderLivingPortrait(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const population = world.hasStore('Population')
      ? world.getComponent(entityId, 'Population') as { count?: number; growthRate?: number } | undefined
      : undefined;
    const ownership = world.hasStore('Ownership')
      ? world.getComponent(entityId, 'Ownership') as { ownerId?: number | null } | undefined
      : undefined;
    const position = world.hasStore('Position')
      ? world.getComponent(entityId, 'Position') as { x?: number; y?: number } | undefined
      : undefined;
    const history = world.hasStore('History')
      ? world.getComponent(entityId, 'History') as { foundingDate?: number } | undefined
      : undefined;
    const biome = world.hasStore('Biome')
      ? world.getComponent(entityId, 'Biome') as { biomeType?: string; fertility?: number; moisture?: number } | undefined
      : undefined;

    // Settlement size prose
    if (population?.count !== undefined) {
      const sizeCategory = getSettlementSize(population.count);
      const sizeProse = SETTLEMENT_SIZE_PROSE[sizeCategory];
      if (sizeProse !== undefined) {
        lines.push(`${sizeProse}.`);
        lines.push('');
      }
    }

    // Biome context
    if (biome?.biomeType !== undefined) {
      lines.push(`The settlement sits amid ${biome.biomeType.toLowerCase()} terrain.`);
    }

    // Founding prose
    if (history?.foundingDate !== undefined) {
      const foundingYear = tickToYear(history.foundingDate);
      const currentYear = tickToYear(context.clock.currentTick);
      const age = currentYear - foundingYear;
      lines.push(`Founded in Year ${foundingYear}${age > 0 ? ` (${age} years ago)` : ''}.`);
    }

    lines.push('');

    // Structured data
    if (population?.count !== undefined) {
      const sizeCategory = getSettlementSize(population.count);
      lines.push(`Population: ${population.count.toLocaleString()} (${sizeCategory})`);

      if (population.growthRate !== undefined) {
        const growthPct = (population.growthRate * 100).toFixed(1);
        const growthSign = population.growthRate >= 0 ? '+' : '';
        lines.push(`Growth: ${growthSign}${growthPct}%`);
      }
    }

    if (ownership?.ownerId !== undefined && ownership.ownerId !== null) {
      const factionName = this.resolveEntityName(ownership.ownerId as unknown as EntityId, context);
      lines.push(`Ruling Faction: ${renderEntityName(factionName)}`);
    }

    if (position !== undefined && position.x !== undefined && position.y !== undefined) {
      lines.push(`Coordinates: (${position.x}, ${position.y})`);
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No information available about this location.{/}`);
    }

    return lines;
  }

  // ─── Section 2: People & Peoples ──────────────────────────────────

  private renderPeoplePeoples(entityId: EntityId, context: RenderContext): string[] {
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

    // Race distribution
    if (demographics?.raceDistribution !== undefined && demographics.raceDistribution.size > 0) {
      const total = [...demographics.raceDistribution.values()].reduce((a, b) => a + b, 0);

      // Find dominant race
      let dominantRace = '';
      let dominantPct = 0;
      for (const [race, count] of demographics.raceDistribution) {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        if (pct > dominantPct) {
          dominantPct = pct;
          dominantRace = race;
        }
      }

      if (dominantRace.length > 0) {
        lines.push(`The population is predominantly ${dominantRace.toLowerCase()}.`);
        lines.push('');
      }

      lines.push('Population by Race:');
      for (const [race, count] of demographics.raceDistribution) {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const bar = renderBar(pct, 100);
        lines.push(`  ${race}: ${bar} ${pct}%`);
      }
      lines.push('');
    }

    // Culture
    if (culture !== undefined) {
      if (culture.traditions !== undefined && culture.traditions.length > 0) {
        lines.push('Traditions:');
        for (const tradition of culture.traditions) {
          lines.push(`  * ${tradition}`);
        }
        lines.push('');
      }

      if (culture.values !== undefined && culture.values.length > 0) {
        lines.push(`Cultural Values: ${culture.values.join(' | ')}`);
      }

      if (culture.languageId !== undefined && culture.languageId !== null) {
        const langName = this.resolveEntityName(culture.languageId as unknown as EntityId, context);
        lines.push(`Language: ${renderEntityName(langName)}`);
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No demographic data available.{/}`);
    }

    return lines;
  }

  // ─── Section 3: Power & Governance ────────────────────────────────

  private renderPowerGovernance(entityId: EntityId, context: RenderContext): string[] {
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

    // Prose introduction
    if (government?.governmentType !== undefined && ownership?.ownerId !== undefined && ownership.ownerId !== null) {
      const factionName = this.resolveEntityName(ownership.ownerId as unknown as EntityId, context);
      lines.push(`Governed as part of ${renderEntityName(factionName)} under a ${government.governmentType} system.`);
      lines.push('');
    }

    if (government !== undefined) {
      if (government.governmentType !== undefined) {
        lines.push(`Government: ${government.governmentType}`);
      }
      if (government.stability !== undefined) {
        const bar = renderBar(government.stability, 100);
        lines.push(`Stability: ${bar} ${government.stability}%`);
      }
      if (government.legitimacy !== undefined) {
        const bar = renderBar(government.legitimacy, 100);
        lines.push(`Legitimacy: ${bar} ${government.legitimacy}%`);
      }
    }

    if (ownership !== undefined) {
      if (ownership.ownerId !== undefined && ownership.ownerId !== null) {
        const factionName = this.resolveEntityName(ownership.ownerId as unknown as EntityId, context);
        lines.push(`Ruling Faction: & ${renderEntityName(factionName)}`);
      }
      if (ownership.claimStrength !== undefined) {
        const bar = renderBar(ownership.claimStrength, 100);
        lines.push(`Claim Strength: ${bar} ${ownership.claimStrength}%`);
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No governance data available.{/}`);
    }

    return lines;
  }

  // ─── Section 4: Trade & Industry ──────────────────────────────────

  private renderTradeIndustry(entityId: EntityId, context: RenderContext): string[] {
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

    // Economic prose
    if (economy?.wealth !== undefined) {
      const state = getEconomicState(economy.wealth);
      const prose = ECONOMIC_PROSE[state];
      if (prose !== undefined) {
        lines.push(prose + '.');
        lines.push('');
      }
    }

    if (economy !== undefined) {
      if (economy.wealth !== undefined) {
        lines.push(`Treasury: ${economy.wealth.toLocaleString()}`);
      }
      if (economy.tradeVolume !== undefined) {
        lines.push(`Trade Volume: ${economy.tradeVolume.toLocaleString()}`);
      }
      if (economy.industries !== undefined && economy.industries.length > 0) {
        lines.push('');
        lines.push('Industries:');
        for (const industry of economy.industries) {
          lines.push(`  * ${industry}`);
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
      lines.push(`{${DIM_COLOR}-fg}No economic data available.{/}`);
    }

    return lines;
  }

  // ─── Section 5: Walls & Works ─────────────────────────────────────

  private renderWallsWorks(entityId: EntityId, context: RenderContext): string[] {
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
      ? world.getComponent(entityId, 'Structures') as { fortificationLevel?: number; buildings?: string[] } | undefined
      : undefined;

    const condition = world.hasStore('Condition')
      ? world.getComponent(entityId, 'Condition') as { durability?: number; maintenanceLevel?: number } | undefined
      : undefined;

    // Fortification prose
    if (structures?.fortificationLevel !== undefined) {
      const fortName = this.getFortificationName(structures.fortificationLevel);
      const fortProse = FORTIFICATION_PROSE[fortName];
      if (fortProse !== undefined) {
        lines.push(`${fortProse}.`);
        lines.push('');
      }
      lines.push(`Fortifications: ${fortName} (Level ${structures.fortificationLevel})`);
    }

    // Military garrison
    if (military !== undefined) {
      if (military.strength !== undefined) {
        lines.push(`Garrison: ${military.strength.toLocaleString()} soldiers`);
      }
      if (military.morale !== undefined) {
        const bar = renderBar(military.morale, 100);
        lines.push(`Morale: ${bar} ${military.morale}%`);
      }
      if (military.training !== undefined) {
        const bar = renderBar(military.training, 100);
        lines.push(`Training: ${bar} ${military.training}%`);
      }
    }

    // Buildings
    if (structures?.buildings !== undefined && structures.buildings.length > 0) {
      lines.push('');
      lines.push('Notable Buildings:');
      for (const building of structures.buildings) {
        lines.push(`  * ${building}`);
      }
    }

    // Condition
    if (condition !== undefined) {
      lines.push('');
      if (condition.durability !== undefined) {
        const bar = renderBar(condition.durability, 100);
        lines.push(`Durability: ${bar} ${condition.durability}%`);
      }
      if (condition.maintenanceLevel !== undefined) {
        const bar = renderBar(condition.maintenanceLevel, 100);
        lines.push(`Maintenance: ${bar} ${condition.maintenanceLevel}%`);
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No structural or military data available.{/}`);
    }

    return lines;
  }

  // ─── Section 6: Notable Souls ─────────────────────────────────────

  private renderNotableSouls(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    // Find characters at this location
    const position = world.hasStore('Position')
      ? world.getComponent(entityId, 'Position') as { x?: number; y?: number } | undefined
      : undefined;

    if (position?.x !== undefined && position.y !== undefined) {
      const posStore = world.hasStore('Position')
        ? world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> } | undefined
        : undefined;

      if (posStore !== undefined) {
        const characters: Array<[EntityId, string]> = [];

        for (const [eid, ePos] of posStore.getAll()) {
          if (eid !== entityId && ePos.x === position.x && ePos.y === position.y) {
            // Check if this is a character (has Attribute component)
            if (world.hasStore('Attribute') && world.getComponent(eid, 'Attribute') !== undefined) {
              const name = this.resolveEntityName(eid, context);
              characters.push([eid, name]);
            }
          }
        }

        if (characters.length > 0) {
          lines.push(`${characters.length} figure${characters.length > 1 ? 's' : ''} of note reside${characters.length === 1 ? 's' : ''} here:`);
          lines.push('');

          const toShow = characters.slice(0, 10);
          for (const [_eid, name] of toShow) {
            lines.push(`  @ ${renderEntityName(name)}`);
          }

          if (characters.length > 10) {
            lines.push(`  {${DIM_COLOR}-fg}And ${characters.length - 10} others of lesser renown.{/}`);
          }
        }
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No notable inhabitants recorded.{/}`);
    }

    return lines;
  }

  // ─── Section 7: The Annals ────────────────────────────────────────

  private renderTheAnnals(entityId: EntityId, context: RenderContext): string[] {
    const { world, eventLog } = context;
    const lines: string[] = [];

    const history = world.hasStore('History')
      ? world.getComponent(entityId, 'History') as { events?: number[]; foundingDate?: number } | undefined
      : undefined;

    if (history?.foundingDate !== undefined) {
      const year = tickToYear(history.foundingDate);
      lines.push(`Founded: Year ${year}`);
      lines.push('');
    }

    // Recent events
    const events = eventLog.getByEntity(entityId);
    if (events.length > 0) {
      lines.push('Defining moments:');

      const sorted = [...events].sort((a, b) => b.significance - a.significance);
      const toShow = sorted.slice(0, 5);

      for (const event of toShow) {
        const year = tickToYear(event.timestamp);
        const desc = (event.data as Record<string, unknown>)['description'];
        const description = typeof desc === 'string' ? desc : event.subtype.replace(/[._]/g, ' ');
        lines.push(`  ! Y${year} ${description}`);
      }

      if (events.length > toShow.length) {
        lines.push('');
        lines.push(`{${DIM_COLOR}-fg}And ${events.length - toShow.length} more recorded events.{/}`);
      }
    } else {
      lines.push(`{${DIM_COLOR}-fg}No recorded events for this location.{/}`);
    }

    return lines;
  }

  // ─── Mode renderers ───────────────────────────────────────────────

  private renderTradeRoutes(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Trade & Relations ===');
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
        const name = this.resolveEntityName(otherId as unknown as EntityId, context);
        const relLabel = relation > 50 ? 'Friendly' : relation > 0 ? 'Neutral' : 'Hostile';
        lines.push(`  # ${renderEntityName(name)}: ${relLabel} (${relation})`);
      }
    }

    if (diplomacy?.treaties !== undefined && diplomacy.treaties.length > 0) {
      lines.push('');
      lines.push('Trade Agreements:');
      for (const treaty of diplomacy.treaties) {
        lines.push(`  * ${treaty}`);
      }
    }

    if (lines.length <= 2) {
      lines.push(`{${DIM_COLOR}-fg}No trade relations recorded.{/}`);
    }

    return lines;
  }

  private renderTimelineMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Settlement Timeline ===');
    lines.push('');

    const { eventLog } = context;
    const events = eventLog.getByEntity(entityId);

    if (events.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No events recorded.{/}`);
      return lines;
    }

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of sorted) {
      const year = tickToYear(event.timestamp);
      const season = tickToSeason(event.timestamp);
      const desc = (event.data as Record<string, unknown>)['description'] ?? event.subtype;
      const sigLabel = getSignificanceLabel(event.significance);
      lines.push(`Y${year} ${season}: ${desc}`);
      lines.push(`  {${DIM_COLOR}-fg}${event.category} | ${sigLabel} (${event.significance}){/}`);
      lines.push('');
    }

    return lines;
  }

  private renderDetailsMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Full Settlement Details ===');
    lines.push('');

    const allSections = [
      'living-portrait', 'people-peoples', 'power-governance',
      'trade-industry', 'walls-works', 'notable-souls', 'the-annals',
    ];

    const sectionTitles: Record<string, string> = {
      'living-portrait': 'A Living Portrait',
      'people-peoples': 'People & Peoples',
      'power-governance': 'Power & Governance',
      'trade-industry': 'Trade & Industry',
      'walls-works': 'Walls & Works',
      'notable-souls': 'Notable Souls',
      'the-annals': 'The Annals',
    };

    for (const sectionId of allSections) {
      const title = sectionTitles[sectionId] ?? sectionId;
      lines.push(`--- ${title} ---`);
      lines.push(...this.renderSection(sectionId, entityId, context));
      lines.push('');
    }

    return lines;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private getFortificationName(level: number): string {
    if (level <= 0) return 'None';
    if (level <= 1) return 'Palisade';
    if (level <= 2) return 'Wooden Walls';
    if (level <= 3) return 'Stone Walls';
    if (level <= 4) return 'Fortified Walls';
    return 'Castle';
  }

  private resolveEntityName(entityId: EntityId, context: RenderContext): string {
    const { world } = context;
    if (world.hasStore('Status')) {
      const status = world.getComponent(entityId, 'Status') as { titles?: string[] } | undefined;
      if (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined) {
        return status.titles[0];
      }
    }
    return `#${entityId}`;
  }
}
