/**
 * Region Inspector - renders detailed region/tile information with prose-first design.
 * Provides 6 sections: The Land Itself, Riches of the Earth, Those Who Dwell Here,
 * Marks Upon the Land, Echoes of the Past, Arcane Currents.
 */

import { EventCategory } from '@fws/core';
import type { EntityId, WorldEvent } from '@fws/core';
import type { RenderContext, RenderableTile } from '../types.js';
import type { InspectorSection, InspectorMode } from './inspector-panel.js';
import {
  DIM_COLOR,
  renderEntityName,
  wrapText,
  tickToYear,
  createEntitySpanMap,
} from './inspector-prose.js';
import type { EntitySpanMap } from './inspector-prose.js';
import {
  BIOME_PROSE,
  RESOURCE_PROSE,
  describeElevation,
  describeTemperature,
  describeRainfall,
} from './region-detail-panel.js';

/**
 * Region inspector sub-component.
 */
export class RegionInspector {
  private entitySpans: EntitySpanMap = createEntitySpanMap();

  /**
   * Get available sections for region inspection.
   */
  getSections(tile?: RenderableTile | null): InspectorSection[] {
    const resourceCount = tile?.resources?.length ?? 0;
    const hasLeyLine = tile?.leyLine === true;

    const sections: InspectorSection[] = [
      { id: 'land', title: 'The Land Itself', summaryHint: tile?.biome ?? '', collapsed: false },
      { id: 'riches', title: 'Riches of the Earth', summaryHint: `${resourceCount} resources`, collapsed: false },
      { id: 'dwellers', title: 'Those Who Dwell Here', collapsed: true },
      { id: 'marks', title: 'Marks Upon the Land', collapsed: true },
      { id: 'echoes', title: 'Echoes of the Past', collapsed: true },
    ];

    // Only show Arcane Currents if ley line present or magic events exist
    if (hasLeyLine) {
      sections.push({ id: 'arcane', title: 'Arcane Currents', summaryHint: 'Ley Line Active', collapsed: true });
    }

    return sections;
  }

  /**
   * Get entity span map for click detection.
   */
  getEntitySpans(): EntitySpanMap {
    return this.entitySpans;
  }

  /**
   * Render region information.
   */
  render(
    x: number,
    y: number,
    tile: RenderableTile,
    context: RenderContext,
    sections: readonly InspectorSection[],
    mode: InspectorMode
  ): string[] {
    this.entitySpans = createEntitySpanMap();
    const lines: string[] = [];

    switch (mode) {
      case 'overview':
        lines.push(...this.renderOverview(x, y, tile, context, sections));
        break;
      case 'relationships':
        lines.push(...this.renderDwellersMode(x, y, tile, context));
        break;
      case 'timeline':
        lines.push(...this.renderHistoryMode(x, y, context));
        break;
      case 'details':
        lines.push(...this.renderDetailsMode(x, y, tile, context));
        break;
    }

    return lines;
  }

  /**
   * Render overview mode with collapsible sections.
   */
  private renderOverview(
    x: number,
    y: number,
    tile: RenderableTile,
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
        const content = this.renderSection(section.id, x, y, tile, context);
        lines.push(...content.map(line => `    ${line}`));
        lines.push('');
      }
    }

    return lines;
  }

  /**
   * Render a specific section.
   */
  private renderSection(
    sectionId: string,
    x: number,
    y: number,
    tile: RenderableTile,
    context: RenderContext
  ): string[] {
    switch (sectionId) {
      case 'land':
        return this.renderLand(tile);
      case 'riches':
        return this.renderRiches(tile);
      case 'dwellers':
        return this.renderDwellers(x, y, context);
      case 'marks':
        return this.renderMarks(x, y, context);
      case 'echoes':
        return this.renderEchoes(x, y, context);
      case 'arcane':
        return this.renderArcane(x, y, tile, context);
      default:
        return ['Unknown section'];
    }
  }

  /**
   * Section 1: The Land Itself - biome prose and conditions.
   */
  private renderLand(tile: RenderableTile): string[] {
    const lines: string[] = [];

    // Biome prose
    const biomeProse = BIOME_PROSE[tile.biome];
    if (biomeProse !== undefined) {
      const wrapped = wrapText(biomeProse, 50);
      lines.push(...wrapped);
    } else {
      lines.push(`${tile.biome} terrain`);
    }

    lines.push('');
    lines.push('Conditions:');

    // Elevation
    if (tile.elevation !== undefined) {
      const elevDesc = describeElevation(tile.elevation);
      lines.push(`  ^ ${elevDesc}`);
    }

    // Temperature
    if (tile.temperature !== undefined) {
      const tempDesc = describeTemperature(tile.temperature);
      lines.push(`  * ${tempDesc}`);
    }

    // Rainfall
    if (tile.rainfall !== undefined) {
      const rainDesc = describeRainfall(tile.rainfall);
      lines.push(`  ~ ${rainDesc}`);
    }

    // River
    if (tile.riverId !== undefined) {
      lines.push('');
      lines.push('A river winds through this region, carving deep');
      lines.push('gorges in the ancient rock.');
    }

    return lines;
  }

  /**
   * Section 2: Riches of the Earth - resource list with prose.
   */
  private renderRiches(tile: RenderableTile): string[] {
    const lines: string[] = [];

    const resources = tile.resources ?? [];

    if (resources.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}This land yields few riches of note.{/}`);
      return lines;
    }

    const introWord = resources.length >= 4 ? 'generously' : resources.length >= 2 ? 'reluctantly' : 'sparingly';
    lines.push(`The land yields its treasures ${introWord}:`);
    lines.push('');

    for (const resource of resources) {
      const prose = RESOURCE_PROSE[resource];
      if (prose !== undefined) {
        lines.push(`  * ${prose}`);
      } else {
        // Capitalize resource name
        const formatted = resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ');
        lines.push(`  * ${formatted} can be found here`);
      }
    }

    if (resources.length >= 3) {
      lines.push('');
      lines.push('Those who control this land grow wealthy on its bounty.');
    }

    return lines;
  }

  /**
   * Section 3: Those Who Dwell Here - factions and characters in the region.
   */
  private renderDwellers(x: number, y: number, context: RenderContext): string[] {
    const lines: string[] = [];

    // Try to find entities at or near this location
    const nearbyEntities = this.findEntitiesNearLocation(x, y, context);

    if (nearbyEntities.factions.length === 0 && nearbyEntities.characters.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No inhabitants of note dwell in this region.{/}`);
      return lines;
    }

    if (nearbyEntities.factions.length > 0) {
      lines.push('{bold}Controlling Factions:{/bold}');
      for (const faction of nearbyEntities.factions) {
        const name = this.resolveEntityName(faction.entityId, context);
        lines.push(`  & ${renderEntityName(name)}`);
      }
      lines.push('');
    }

    if (nearbyEntities.characters.length > 0) {
      lines.push('{bold}Notable Inhabitants:{/bold}');
      const toShow = nearbyEntities.characters.slice(0, 5);
      for (const char of toShow) {
        const name = this.resolveEntityName(char.entityId, context);
        lines.push(`  @ ${renderEntityName(name)}`);
      }
      if (nearbyEntities.characters.length > 5) {
        lines.push(`  {${DIM_COLOR}-fg}... and ${nearbyEntities.characters.length - 5} others{/}`);
      }
    }

    return lines;
  }

  /**
   * Section 4: Marks Upon the Land - nearby settlements and points of interest.
   */
  private renderMarks(x: number, y: number, context: RenderContext): string[] {
    const lines: string[] = [];

    const settlements = this.findNearbySettlements(x, y, context);

    if (settlements.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No settlements mark this region.{/}`);
      return lines;
    }

    lines.push('{bold}Nearby Settlements:{/bold}');
    for (const settlement of settlements.slice(0, 8)) {
      const name = this.resolveEntityName(settlement.entityId, context);
      const distLabel = settlement.distance <= 1 ? 'adjacent' : settlement.distance <= 3 ? 'near' : 'distant';
      lines.push(`  # ${renderEntityName(name)} ......... ${distLabel}`);
    }

    return lines;
  }

  /**
   * Section 5: Echoes of the Past - historical events at this location.
   */
  private renderEchoes(x: number, y: number, context: RenderContext): string[] {
    const lines: string[] = [];

    // Find events that occurred at or near this location
    const events = this.findEventsNearLocation(x, y, context);

    if (events.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}History has left no recorded mark upon this land.{/}`);
      return lines;
    }

    lines.push('History has left its scars on this land:');
    lines.push('');

    const toShow = events.slice(0, 5);
    for (const event of toShow) {
      const year = tickToYear(event.timestamp);
      const desc = (event.data as Record<string, unknown>)['description'];
      const description = typeof desc === 'string' ? desc : event.subtype.replace(/[._]/g, ' ');
      lines.push(`  ! Y${year} ${description}`);
    }

    if (events.length > 5) {
      lines.push(`  {${DIM_COLOR}-fg}And ${events.length - 5} more events in this region's history.{/}`);
    }

    return lines;
  }

  /**
   * Section 6: Arcane Currents - ley line and magical events.
   */
  private renderArcane(x: number, y: number, tile: RenderableTile, context: RenderContext): string[] {
    const lines: string[] = [];

    if (tile.leyLine === true) {
      lines.push('A ley line pulses with arcane energy beneath the earth.');
      lines.push('The concentration of magical power here has attracted');
      lines.push('scholars and sorcerers throughout the ages.');
    } else {
      lines.push(`{${DIM_COLOR}-fg}No significant magical currents flow through this region.{/}`);
      return lines;
    }

    // Find magical events near this location
    const magicEvents = this.findEventsNearLocation(x, y, context)
      .filter(e => e.category === EventCategory.Magical);

    if (magicEvents.length > 0) {
      lines.push('');
      lines.push('Recent magical events in this region:');
      for (const event of magicEvents.slice(0, 3)) {
        const year = tickToYear(event.timestamp);
        const desc = (event.data as Record<string, unknown>)['description'];
        const description = typeof desc === 'string' ? desc : event.subtype.replace(/[._]/g, ' ');
        lines.push(`  ! Y${year} ${description}`);
      }
    }

    return lines;
  }

  /**
   * Render dwellers mode (expanded view of inhabitants).
   */
  private renderDwellersMode(x: number, y: number, _tile: RenderableTile, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Inhabitants & Powers ===');
    lines.push('');
    lines.push(...this.renderDwellers(x, y, context));
    return lines;
  }

  /**
   * Render history mode (expanded timeline of events).
   */
  private renderHistoryMode(x: number, y: number, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Regional History ===');
    lines.push('');
    lines.push(...this.renderEchoes(x, y, context));
    return lines;
  }

  /**
   * Render details mode (all sections expanded).
   */
  private renderDetailsMode(x: number, y: number, tile: RenderableTile, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Full Region Details ===');
    lines.push('');

    const allSections = ['land', 'riches', 'dwellers', 'marks', 'echoes'];
    if (tile.leyLine === true) {
      allSections.push('arcane');
    }

    for (const sectionId of allSections) {
      const title = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      lines.push(`--- ${title} ---`);
      lines.push(...this.renderSection(sectionId, x, y, tile, context));
      lines.push('');
    }

    return lines;
  }

  /**
   * Find entities near a given location using Position components.
   */
  private findEntitiesNearLocation(
    x: number,
    y: number,
    context: RenderContext,
    radius: number = 3
  ): { factions: Array<{ entityId: EntityId }>; characters: Array<{ entityId: EntityId }> } {
    const result = { factions: [] as Array<{ entityId: EntityId }>, characters: [] as Array<{ entityId: EntityId }> };
    const { world } = context;

    if (!world.hasStore('Position')) return result;

    const positionStore = world.getStore('Position');
    for (const [entityId, component] of positionStore.getAll()) {
      const pos = component as { x?: number; y?: number };
      if (pos.x === undefined || pos.y === undefined) continue;

      const dx = Math.abs(pos.x - x);
      const dy = Math.abs(pos.y - y);
      if (dx > radius || dy > radius) continue;

      // Check entity type
      if (world.hasStore('Attribute') && world.getComponent(entityId, 'Attribute') !== undefined) {
        result.characters.push({ entityId });
      } else if (world.hasStore('Territory') && world.getComponent(entityId, 'Territory') !== undefined) {
        result.factions.push({ entityId });
      }
    }

    return result;
  }

  /**
   * Find nearby settlements using Position and Population components.
   */
  private findNearbySettlements(
    x: number,
    y: number,
    context: RenderContext,
    radius: number = 5
  ): Array<{ entityId: EntityId; distance: number }> {
    const settlements: Array<{ entityId: EntityId; distance: number }> = [];
    const { world } = context;

    if (!world.hasStore('Position') || !world.hasStore('Population')) return settlements;

    const positionStore = world.getStore('Position');
    for (const [entityId, component] of positionStore.getAll()) {
      const pos = component as { x?: number; y?: number };
      if (pos.x === undefined || pos.y === undefined) continue;

      const pop = world.getComponent(entityId, 'Population');
      if (pop === undefined) continue;

      const dx = Math.abs(pos.x - x);
      const dy = Math.abs(pos.y - y);
      const distance = Math.max(dx, dy);
      if (distance > radius) continue;

      settlements.push({ entityId, distance });
    }

    settlements.sort((a, b) => a.distance - b.distance);
    return settlements;
  }

  /**
   * Find events near a location by scanning event data for coordinates.
   * Uses a heuristic: check event participants for Position near (x, y).
   */
  private findEventsNearLocation(x: number, y: number, context: RenderContext): WorldEvent[] {
    const { eventLog } = context;
    const all = eventLog.getAll();

    // Look at last 500 events for location matches
    const recent = all.slice(Math.max(0, all.length - 500));
    const matched: WorldEvent[] = [];

    for (const event of recent) {
      const data = event.data as Record<string, unknown>;

      // Check if event has explicit coordinates
      const ex = data['x'];
      const ey = data['y'];
      if (typeof ex === 'number' && typeof ey === 'number') {
        if (Math.abs(ex - x) <= 2 && Math.abs(ey - y) <= 2) {
          matched.push(event);
          continue;
        }
      }

      // Check participant locations
      for (const participantId of event.participants) {
        const { world } = context;
        if (world.hasStore('Position')) {
          const pos = world.getComponent(participantId, 'Position') as { x?: number; y?: number } | undefined;
          if (pos?.x !== undefined && pos.y !== undefined) {
            if (Math.abs(pos.x - x) <= 1 && Math.abs(pos.y - y) <= 1) {
              matched.push(event);
              break;
            }
          }
        }
      }
    }

    // Sort by significance descending
    matched.sort((a, b) => b.significance - a.significance);
    return matched;
  }

  /**
   * Resolve an entity name from the world.
   */
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
