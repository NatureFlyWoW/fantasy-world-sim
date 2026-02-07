/**
 * Faction Inspector - renders detailed faction information with prose-first design.
 * Provides 8 sections: Rise & Reign, Banner & Creed, Court & Council,
 * Lands & Holdings, Swords & Shields, Alliances & Enmities, Coffers & Commerce, Chronicles.
 */

import type { EntityId } from '@fws/core';
import type { RenderContext } from '../types.js';
import type { InspectorSection, InspectorMode } from './inspector-panel.js';
import {
  generateCoatOfArms,
  renderLargeCoatOfArms,
  describeCoatOfArms,
} from '../widgets/heraldry.js';
import type { FactionProperties } from '../widgets/heraldry.js';
import {
  DIM_COLOR,
  MILITARY_PROSE,
  ECONOMIC_PROSE,
  renderEntityName,
  renderBar,
  renderDottedLeader,
  getDiplomacyLabel,
  getEconomicState,
  getMilitaryState,
  tickToYear,
  tickToSeason,
  getSignificanceLabel,
  createEntitySpanMap,
} from './inspector-prose.js';
import type { EntitySpanMap } from './inspector-prose.js';

/**
 * Faction inspector sub-component with prose-first rendering.
 */
export class FactionInspector {
  private entitySpans: EntitySpanMap = createEntitySpanMap();

  /**
   * Get available sections for faction inspection.
   */
  getSections(entityId?: EntityId, context?: RenderContext): InspectorSection[] {
    let ageHint = '';
    let leaderHint = '';
    let regionCount = 0;
    let strengthHint = '';
    let relationCount = 0;
    let treasuryHint = '';
    let eventCount = 0;

    if (entityId !== undefined && context !== undefined) {
      const { world } = context;

      // Age from Origin or History
      if (world.hasStore('Origin')) {
        const origin = world.getComponent(entityId, 'Origin') as { foundingTick?: number } | undefined;
        if (origin?.foundingTick !== undefined) {
          const foundingYear = tickToYear(origin.foundingTick);
          const currentYear = tickToYear(context.clock.currentTick);
          const age = currentYear - foundingYear;
          ageHint = `${age} years old`;
        }
      } else if (world.hasStore('History')) {
        const history = world.getComponent(entityId, 'History') as { foundingDate?: number } | undefined;
        if (history?.foundingDate !== undefined) {
          const foundingYear = tickToYear(history.foundingDate);
          const currentYear = tickToYear(context.clock.currentTick);
          const age = currentYear - foundingYear;
          ageHint = `${age} years old`;
        }
      }

      // Leader name
      if (world.hasStore('Hierarchy')) {
        const hierarchy = world.getComponent(entityId, 'Hierarchy') as { leaderId?: number | null } | undefined;
        if (hierarchy?.leaderId !== undefined && hierarchy.leaderId !== null) {
          leaderHint = this.resolveEntityName(hierarchy.leaderId as unknown as EntityId, context);
        }
      }

      // Territory count
      if (world.hasStore('Territory')) {
        const territory = world.getComponent(entityId, 'Territory') as { controlledRegions?: number[] } | undefined;
        if (territory?.controlledRegions !== undefined) {
          regionCount = territory.controlledRegions.length;
        }
      }

      // Military strength
      if (world.hasStore('Military')) {
        const military = world.getComponent(entityId, 'Military') as { strength?: number } | undefined;
        if (military?.strength !== undefined) {
          strengthHint = `${military.strength.toLocaleString()} strong`;
        }
      }

      // Diplomacy relation count
      if (world.hasStore('Diplomacy')) {
        const diplomacy = world.getComponent(entityId, 'Diplomacy') as { relations?: Map<number, number> } | undefined;
        if (diplomacy?.relations !== undefined) {
          relationCount = diplomacy.relations.size;
        }
      }

      // Treasury
      if (world.hasStore('Economy')) {
        const economy = world.getComponent(entityId, 'Economy') as { wealth?: number } | undefined;
        if (economy?.wealth !== undefined) {
          treasuryHint = `${economy.wealth.toLocaleString()} gold`;
        }
      }

      // Event count
      eventCount = context.eventLog.getByEntity(entityId).length;
    }

    return [
      { id: 'rise-reign', title: 'Rise & Reign', collapsed: false, ...(ageHint.length > 0 ? { summaryHint: ageHint } : {}) },
      { id: 'banner-creed', title: 'Banner & Creed', collapsed: false },
      { id: 'court-council', title: 'Court & Council', collapsed: false, ...(leaderHint.length > 0 ? { summaryHint: leaderHint } : {}) },
      { id: 'lands-holdings', title: 'Lands & Holdings', collapsed: true, ...(regionCount > 0 ? { summaryHint: `${regionCount} regions` } : {}) },
      { id: 'swords-shields', title: 'Swords & Shields', collapsed: true, ...(strengthHint.length > 0 ? { summaryHint: strengthHint } : {}) },
      { id: 'alliances-enmities', title: 'Alliances & Enmities', collapsed: true, ...(relationCount > 0 ? { summaryHint: `${relationCount} relations` } : {}) },
      { id: 'coffers-commerce', title: 'Coffers & Commerce', collapsed: true, ...(treasuryHint.length > 0 ? { summaryHint: treasuryHint } : {}) },
      { id: 'chronicles', title: 'Chronicles', collapsed: true, ...(eventCount > 0 ? { summaryHint: `${eventCount} events` } : {}) },
    ];
  }

  /**
   * Get entity span map for click detection.
   */
  getEntitySpans(): EntitySpanMap {
    return this.entitySpans;
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
    this.entitySpans = createEntitySpanMap();
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
      case 'rise-reign':
        return this.renderRiseAndReign(entityId, context);
      case 'banner-creed':
        return this.renderBannerAndCreed(entityId, context);
      case 'court-council':
        return this.renderCourtAndCouncil(entityId, context);
      case 'lands-holdings':
        return this.renderLandsAndHoldings(entityId, context);
      case 'swords-shields':
        return this.renderSwordsAndShields(entityId, context);
      case 'alliances-enmities':
        return this.renderAlliancesAndEnmities(entityId, context);
      case 'coffers-commerce':
        return this.renderCoffersAndCommerce(entityId, context);
      case 'chronicles':
        return this.renderChronicles(entityId, context);
      default:
        return ['Unknown section'];
    }
  }

  // ─── Section 1: Rise & Reign ───────────────────────────────────────

  private renderRiseAndReign(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const origin = world.hasStore('Origin')
      ? world.getComponent(entityId, 'Origin') as {
          founderId?: number | null;
          foundingTick?: number;
          foundingLocation?: number | null;
        } | undefined
      : undefined;

    const history = world.hasStore('History')
      ? world.getComponent(entityId, 'History') as { foundingDate?: number } | undefined
      : undefined;

    const government = world.hasStore('Government')
      ? world.getComponent(entityId, 'Government') as {
          governmentType?: string;
          stability?: number;
          legitimacy?: number;
        } | undefined
      : undefined;

    const status = world.hasStore('Status')
      ? world.getComponent(entityId, 'Status') as { titles?: string[] } | undefined
      : undefined;

    const population = world.hasStore('Population')
      ? world.getComponent(entityId, 'Population') as { count?: number } | undefined
      : undefined;

    // Opening prose
    const factionName = (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined)
      ? status.titles[0]
      : `Faction #${entityId}`;

    const foundingTick = origin?.foundingTick ?? history?.foundingDate;

    if (foundingTick !== undefined) {
      const foundingYear = tickToYear(foundingTick);
      const currentYear = tickToYear(context.clock.currentTick);
      const age = currentYear - foundingYear;

      if (origin?.founderId !== undefined && origin.founderId !== null) {
        const founderName = this.resolveEntityName(origin.founderId as unknown as EntityId, context);
        lines.push(`${factionName} was founded in Year ${foundingYear} by ${renderEntityName(founderName)}.`);
      } else {
        lines.push(`${factionName} was established in Year ${foundingYear}.`);
      }

      if (age > 0) {
        lines.push(`For ${age} years it has endured, shaping the history of this land.`);
      }
      lines.push('');
    }

    // Government data
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

    // Population
    if (population?.count !== undefined) {
      lines.push(`Total Population: ${population.count.toLocaleString()}`);
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No historical data available for this faction.{/}`);
    }

    return lines;
  }

  // ─── Section 2: Banner & Creed ─────────────────────────────────────

  private renderBannerAndCreed(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const status = world.hasStore('Status')
      ? world.getComponent(entityId, 'Status') as { titles?: string[] } | undefined
      : undefined;
    const culture = world.hasStore('Culture')
      ? world.getComponent(entityId, 'Culture') as { traditions?: string[]; values?: string[] } | undefined
      : undefined;
    const military = world.hasStore('Military')
      ? world.getComponent(entityId, 'Military') as { strength?: number } | undefined
      : undefined;
    const doctrine = world.hasStore('Doctrine')
      ? world.getComponent(entityId, 'Doctrine') as { beliefs?: string[]; prohibitions?: string[] } | undefined
      : undefined;

    const factionName = (status?.titles !== undefined && status.titles.length > 0)
      ? (status.titles[0] ?? `Faction #${entityId}`)
      : `Faction #${entityId}`;

    // Derive culture string from values heuristic
    const cultureId = this.deriveCultureId(culture?.values ?? []);

    const props: FactionProperties = {
      name: factionName,
      culture: cultureId,
      color: '#888888',
      militaryStrength: military?.strength ?? 50,
      economicWealth: 50,
      culturalInfluence: 50,
      tendencies: culture?.values ?? [],
    };

    const arms = generateCoatOfArms(props);
    const shieldLines = renderLargeCoatOfArms(arms);
    lines.push(...shieldLines);
    lines.push('');
    lines.push(describeCoatOfArms(arms));
    lines.push('');

    // Cultural values and doctrine
    if (culture?.values !== undefined && culture.values.length > 0) {
      lines.push('Guiding Principles:');
      const valuesPerLine = 3;
      for (let i = 0; i < culture.values.length; i += valuesPerLine) {
        const chunk = culture.values.slice(i, i + valuesPerLine);
        lines.push(`  ${chunk.map(v => `* ${v}`).join('     ')}`);
      }
      lines.push('');
    }

    if (doctrine?.beliefs !== undefined && doctrine.beliefs.length > 0) {
      lines.push('Sacred Tenets:');
      for (const belief of doctrine.beliefs.slice(0, 5)) {
        lines.push(`  * ${belief}`);
      }
      lines.push('');
    }

    if (doctrine?.prohibitions !== undefined && doctrine.prohibitions.length > 0) {
      lines.push('Forbidden Acts:');
      for (const prohibition of doctrine.prohibitions.slice(0, 3)) {
        lines.push(`  * ${prohibition}`);
      }
    }

    return lines;
  }

  // ─── Section 3: Court & Council ────────────────────────────────────

  private renderCourtAndCouncil(entityId: EntityId, context: RenderContext): string[] {
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
        const leaderName = this.resolveEntityName(hierarchy.leaderId as unknown as EntityId, context);
        lines.push(`@ ${renderDottedLeader(renderEntityName(leaderName), '(Leader)', 40)}`);
      }

      if (hierarchy.subordinateIds !== undefined && hierarchy.subordinateIds.length > 0) {
        lines.push('');
        const toShow = hierarchy.subordinateIds.slice(0, 10);
        for (const subId of toShow) {
          const name = this.resolveEntityName(subId as unknown as EntityId, context);
          lines.push(`@ ${renderEntityName(name)}`);
        }
        if (hierarchy.subordinateIds.length > 10) {
          lines.push('');
          lines.push(`{${DIM_COLOR}-fg}And ${hierarchy.subordinateIds.length - 10} other members of note.{/}`);
        }
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No leadership data available.{/}`);
    }

    return lines;
  }

  // ─── Section 4: Lands & Holdings ───────────────────────────────────

  private renderLandsAndHoldings(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const territory = world.hasStore('Territory')
      ? world.getComponent(entityId, 'Territory') as {
          controlledRegions?: number[];
          capitalId?: number | null;
        } | undefined
      : undefined;

    if (territory !== undefined) {
      if (territory.controlledRegions !== undefined && territory.controlledRegions.length > 0) {
        lines.push(`The faction controls ${territory.controlledRegions.length} regions.`);
        lines.push('');
      }

      if (territory.capitalId !== undefined && territory.capitalId !== null) {
        const capitalName = this.resolveEntityName(territory.capitalId as unknown as EntityId, context);
        lines.push(`Capital: ${renderEntityName(capitalName)}`);
        lines.push('');
      }

      if (territory.controlledRegions !== undefined && territory.controlledRegions.length > 0) {
        lines.push('Controlled Regions:');
        const toShow = territory.controlledRegions.slice(0, 10);
        for (const regionId of toShow) {
          const name = this.resolveEntityName(regionId as unknown as EntityId, context);
          lines.push(`  ~ ${renderEntityName(name)}`);
        }
        if (territory.controlledRegions.length > 10) {
          lines.push(`  {${DIM_COLOR}-fg}... and ${territory.controlledRegions.length - 10} more{/}`);
        }
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No territory data available.{/}`);
    }

    return lines;
  }

  // ─── Section 5: Swords & Shields ───────────────────────────────────

  private renderSwordsAndShields(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const military = world.hasStore('Military')
      ? world.getComponent(entityId, 'Military') as {
          strength?: number;
          morale?: number;
          training?: number;
        } | undefined
      : undefined;

    // Military prose
    if (military?.strength !== undefined && military.morale !== undefined) {
      const state = getMilitaryState(military.strength, military.morale);
      const prose = MILITARY_PROSE[state];
      if (prose !== undefined) {
        lines.push(prose + '.');
        lines.push('');
      }
    }

    if (military !== undefined) {
      if (military.strength !== undefined) {
        lines.push(`Total Strength: ${military.strength.toLocaleString()}`);
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

    // Active conflicts from events
    const events = context.eventLog.getByEntity(entityId);
    const recentMilitaryEvents = events.filter(e =>
      e.category === 'Military' && e.significance >= 50
    );
    if (recentMilitaryEvents.length > 0) {
      lines.push('');
      lines.push('Active Conflicts:');
      const toShow = recentMilitaryEvents.slice(0, 5);
      for (const event of toShow) {
        const year = tickToYear(event.timestamp);
        const desc = (event.data as Record<string, unknown>)['description'] ?? event.subtype.replace(/[._]/g, ' ');
        lines.push(`  ! Y${year} ${desc}`);
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No military data available.{/}`);
    }

    return lines;
  }

  // ─── Section 6: Alliances & Enmities ───────────────────────────────

  private renderAlliancesAndEnmities(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const diplomacy = world.hasStore('Diplomacy')
      ? world.getComponent(entityId, 'Diplomacy') as {
          relations?: Map<number, number>;
          treaties?: string[];
        } | undefined
      : undefined;

    if (diplomacy?.relations !== undefined && diplomacy.relations.size > 0) {
      const allies: Array<[number, number]> = [];
      const enemies: Array<[number, number]> = [];
      const neutral: Array<[number, number]> = [];

      for (const [factionId, relation] of diplomacy.relations) {
        if (relation >= 50) {
          allies.push([factionId, relation]);
        } else if (relation <= -50) {
          enemies.push([factionId, relation]);
        } else {
          neutral.push([factionId, relation]);
        }
      }

      // Sort each group by absolute relation value
      allies.sort((a, b) => b[1] - a[1]);
      enemies.sort((a, b) => a[1] - b[1]);

      if (allies.length > 0) {
        lines.push('ALLIES:');
        for (const [factionId, relation] of allies) {
          const name = this.resolveEntityName(factionId as unknown as EntityId, context);
          const label = getDiplomacyLabel(relation);
          const sign = relation >= 0 ? '+' : '';
          lines.push(`  & ${renderDottedLeader(renderEntityName(name), `${label}    [${sign}${relation}]`, 50)}`);
        }
        lines.push('');
      }

      if (enemies.length > 0) {
        lines.push('ENEMIES:');
        for (const [factionId, relation] of enemies) {
          const name = this.resolveEntityName(factionId as unknown as EntityId, context);
          const label = getDiplomacyLabel(relation);
          lines.push(`  & ${renderDottedLeader(renderEntityName(name), `${label}    [${relation}]`, 50)}`);
        }
        lines.push('');
      }

      if (neutral.length > 0) {
        lines.push('NEUTRAL:');
        for (const [factionId, relation] of neutral) {
          const name = this.resolveEntityName(factionId as unknown as EntityId, context);
          const label = getDiplomacyLabel(relation);
          const sign = relation >= 0 ? '+' : '';
          lines.push(`  & ${renderDottedLeader(renderEntityName(name), `${label}    [${sign}${relation}]`, 50)}`);
        }
        lines.push('');
      }
    }

    if (diplomacy?.treaties !== undefined && diplomacy.treaties.length > 0) {
      lines.push('Treaties:');
      for (const treaty of diplomacy.treaties) {
        lines.push(`  * ${treaty}`);
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No diplomatic data available.{/}`);
    }

    return lines;
  }

  // ─── Section 7: Coffers & Commerce ─────────────────────────────────

  private renderCoffersAndCommerce(entityId: EntityId, context: RenderContext): string[] {
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
        lines.push('Major Industries:');
        for (const industry of economy.industries) {
          lines.push(`  * ${industry}`);
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
      lines.push(`{${DIM_COLOR}-fg}No economic data available.{/}`);
    }

    return lines;
  }

  // ─── Section 8: Chronicles ─────────────────────────────────────────

  private renderChronicles(entityId: EntityId, context: RenderContext): string[] {
    const { world, eventLog } = context;
    const lines: string[] = [];

    const origin = world.hasStore('Origin')
      ? world.getComponent(entityId, 'Origin') as {
          founderId?: number | null;
          foundingTick?: number;
          foundingLocation?: number | null;
        } | undefined
      : undefined;

    const history = world.hasStore('History')
      ? world.getComponent(entityId, 'History') as { foundingDate?: number } | undefined
      : undefined;

    // Founding information
    const foundingTick = origin?.foundingTick ?? history?.foundingDate;
    if (foundingTick !== undefined) {
      const year = tickToYear(foundingTick);
      lines.push(`Founded: Year ${year}`);
      if (origin?.founderId !== undefined && origin.founderId !== null) {
        const founderName = this.resolveEntityName(origin.founderId as unknown as EntityId, context);
        lines.push(`Founder: ${renderEntityName(founderName)}`);
      }
      if (origin?.foundingLocation !== undefined && origin.foundingLocation !== null) {
        const locationName = this.resolveEntityName(origin.foundingLocation as unknown as EntityId, context);
        lines.push(`Origin: ${renderEntityName(locationName)}`);
      }
      lines.push('');
    }

    // Events sorted by significance
    const events = eventLog.getByEntity(entityId);
    if (events.length > 0) {
      lines.push('Defining moments:');

      const sorted = [...events].sort((a, b) => b.significance - a.significance);
      const toShow = sorted.slice(0, 10);

      for (const event of toShow) {
        const year = tickToYear(event.timestamp);
        const desc = (event.data as Record<string, unknown>)['description'];
        const description = typeof desc === 'string' ? desc : event.subtype.replace(/[._]/g, ' ');
        const sigLabel = getSignificanceLabel(event.significance);
        lines.push(`  ! Y${year} ${description}`);
        lines.push(`    {${DIM_COLOR}-fg}${event.category} | ${sigLabel} (${event.significance}){/}`);
      }

      if (events.length > toShow.length) {
        lines.push('');
        lines.push(`{${DIM_COLOR}-fg}And ${events.length - toShow.length} more recorded events.{/}`);
      }
    } else {
      lines.push(`{${DIM_COLOR}-fg}No historical events recorded.{/}`);
    }

    return lines;
  }

  // ─── Mode renderers ────────────────────────────────────────────────

  private renderDiplomacyMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Diplomatic Relations ===');
    lines.push('');
    lines.push(...this.renderAlliancesAndEnmities(entityId, context));
    return lines;
  }

  private renderTimelineMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Faction History ===');
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
    lines.push('=== Full Faction Details ===');
    lines.push('');

    const allSections = [
      'rise-reign', 'banner-creed', 'court-council', 'lands-holdings',
      'swords-shields', 'alliances-enmities', 'coffers-commerce', 'chronicles',
    ];

    const sectionTitles: Record<string, string> = {
      'rise-reign': 'Rise & Reign',
      'banner-creed': 'Banner & Creed',
      'court-council': 'Court & Council',
      'lands-holdings': 'Lands & Holdings',
      'swords-shields': 'Swords & Shields',
      'alliances-enmities': 'Alliances & Enmities',
      'coffers-commerce': 'Coffers & Commerce',
      chronicles: 'Chronicles',
    };

    for (const sectionId of allSections) {
      const title = sectionTitles[sectionId] ?? sectionId;
      lines.push(`--- ${title} ---`);
      lines.push(...this.renderSection(sectionId, entityId, context));
      lines.push('');
    }

    return lines;
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  /**
   * Derive a culture id string from faction values.
   * Falls back to 'nordic' if no match found.
   */
  private deriveCultureId(values: readonly string[]): string {
    const CULTURE_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
      nordic:   ['militaristic', 'expansionist', 'seafaring'],
      elvish:   ['artistic', 'scholarly', 'mystical'],
      dwarven:  ['industrious', 'isolationist'],
      desert:   ['nomadic', 'mercantile'],
      eastern:  ['religious', 'scholarly'],
      fey:      ['artistic', 'mystical'],
      infernal: ['expansionist', 'militaristic'],
    };

    let bestCulture = 'nordic';
    let bestScore = 0;

    for (const [culture, keywords] of Object.entries(CULTURE_KEYWORDS)) {
      let score = 0;
      for (const v of values) {
        if (keywords.includes(v)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCulture = culture;
      }
    }

    return bestCulture;
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
