/**
 * Character Inspector - renders detailed character information with prose-first design.
 * Provides 7 sections: The Story So Far, Strengths & Flaws, Bonds & Rivalries,
 * Worldly Standing, Heart & Mind, Remembered Things, Possessions & Treasures.
 */

import type { EntityId } from '@fws/core';
import type { RenderContext } from '../types.js';
import type { InspectorSection, InspectorMode } from './inspector-panel.js';
import {
  DIM_COLOR,
  NEGATIVE_COLOR,
  HEALTH_PROSE,
  renderEntityName,
  renderBar,
  renderDottedLeader,
  getHealthState,
  getPersonalityDescriptor,
  getSignificanceLabel,
  tickToYear,
  tickToSeason,
  wrapText,
  createEntitySpanMap,
} from './inspector-prose.js';
import type { EntitySpanMap } from './inspector-prose.js';

/**
 * Character inspector sub-component with prose-first rendering.
 */
export class CharacterInspector {
  private entitySpans: EntitySpanMap = createEntitySpanMap();

  /**
   * Get available sections for character inspection.
   */
  getSections(entityId?: EntityId, context?: RenderContext): InspectorSection[] {
    let eventCount = 0;
    let relationCount = 0;
    let memoryCount = 0;
    let topTrait = '';
    let topGoal = '';
    let wealthSummary = '';

    if (entityId !== undefined && context !== undefined) {
      // Count events
      const events = context.eventLog.getByEntity(entityId);
      eventCount = events.length;

      // Count relationships
      const { world } = context;
      if (world.hasStore('Relationship')) {
        const rel = world.getComponent(entityId, 'Relationship') as {
          relationships?: Map<number, string>;
        } | undefined;
        relationCount = rel?.relationships?.size ?? 0;
      }
      if (world.hasStore('Grudges')) {
        const grudges = world.getComponent(entityId, 'Grudges') as {
          grudges?: Map<number, string>;
        } | undefined;
        relationCount += grudges?.grudges?.size ?? 0;
      }

      // Count memories
      if (world.hasStore('Memory')) {
        const memory = world.getComponent(entityId, 'Memory') as {
          memories?: Array<{ eventId: number; importance: number; distortion: number }>;
        } | undefined;
        memoryCount = memory?.memories?.length ?? 0;
      }

      // Top trait
      if (world.hasStore('Traits')) {
        const traits = world.getComponent(entityId, 'Traits') as {
          traits?: string[];
        } | undefined;
        if (traits?.traits !== undefined && traits.traits.length > 0 && traits.traits[0] !== undefined) {
          topTrait = traits.traits[0].charAt(0).toUpperCase() + traits.traits[0].slice(1);
        }
      }

      // Top goal
      if (world.hasStore('Goal')) {
        const goals = world.getComponent(entityId, 'Goal') as {
          objectives?: string[];
          priorities?: Map<string, number>;
        } | undefined;
        if (goals?.objectives !== undefined && goals.objectives.length > 0) {
          const sorted = [...goals.objectives].sort((a, b) => {
            const pa = goals.priorities?.get(a) ?? 50;
            const pb = goals.priorities?.get(b) ?? 50;
            return pb - pa;
          });
          if (sorted[0] !== undefined) {
            topGoal = sorted[0].length > 20 ? sorted[0].slice(0, 20) + '...' : sorted[0];
          }
        }
      }

      // Wealth summary
      if (world.hasStore('Wealth')) {
        const wealth = world.getComponent(entityId, 'Wealth') as {
          coins?: number;
        } | undefined;
        if (wealth?.coins !== undefined) {
          wealthSummary = `${wealth.coins.toLocaleString()} gold`;
        }
      }
    }

    return [
      { id: 'story-so-far', title: 'The Story So Far', collapsed: false, ...(eventCount > 0 ? { summaryHint: `${eventCount} events` } : {}) },
      { id: 'strengths-flaws', title: 'Strengths & Flaws', collapsed: false, ...(topTrait.length > 0 ? { summaryHint: topTrait } : {}) },
      { id: 'bonds-rivalries', title: 'Bonds & Rivalries', collapsed: true, ...(relationCount > 0 ? { summaryHint: `${relationCount} relations` } : {}) },
      { id: 'worldly-standing', title: 'Worldly Standing', collapsed: true },
      { id: 'heart-mind', title: 'Heart & Mind', collapsed: true, ...(topGoal.length > 0 ? { summaryHint: topGoal } : {}) },
      { id: 'remembered-things', title: 'Remembered Things', collapsed: true, ...(memoryCount > 0 ? { summaryHint: `${memoryCount} memories` } : {}) },
      { id: 'possessions-treasures', title: 'Possessions & Treasures', collapsed: true, ...(wealthSummary.length > 0 ? { summaryHint: wealthSummary } : {}) },
    ];
  }

  /**
   * Get entity span map for click detection.
   */
  getEntitySpans(): EntitySpanMap {
    return this.entitySpans;
  }

  /**
   * Render character information.
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
        lines.push(...this.renderRelationshipsMode(entityId, context));
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
      case 'story-so-far':
        return this.renderStorySoFar(entityId, context);
      case 'strengths-flaws':
        return this.renderStrengthsFlaws(entityId, context);
      case 'bonds-rivalries':
        return this.renderBondsRivalries(entityId, context);
      case 'worldly-standing':
        return this.renderWorldlyStanding(entityId, context);
      case 'heart-mind':
        return this.renderHeartMind(entityId, context);
      case 'remembered-things':
        return this.renderRememberedThings(entityId, context);
      case 'possessions-treasures':
        return this.renderPossessionsTreasures(entityId, context);
      default:
        return ['Unknown section'];
    }
  }

  // ─── Section 1: The Story So Far ──────────────────────────────────

  private renderStorySoFar(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    const { world, eventLog } = context;

    // Get character info for narrative
    const status = world.hasStore('Status')
      ? world.getComponent(entityId, 'Status') as { titles?: string[]; socialClass?: string } | undefined
      : undefined;
    const name = (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined)
      ? status.titles[0] : `Entity #${entityId}`;

    // Health prose
    const health = world.hasStore('Health')
      ? world.getComponent(entityId, 'Health') as { current?: number; maximum?: number } | undefined
      : undefined;
    if (health !== undefined) {
      const current = health.current ?? 100;
      const maximum = health.maximum ?? 100;
      const healthKey = getHealthState(current, maximum);
      const healthText = HEALTH_PROSE[healthKey];
      if (healthText !== undefined) {
        lines.push(`${name} ${healthText}.`);
        lines.push('');
      }
    }

    // Get events for this character
    const events = eventLog.getByEntity(entityId);

    if (events.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}The story of ${name} has yet to be written.{/}`);
      return lines;
    }

    // Sort by timestamp ascending, filter significant events
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const significant = sorted.filter(e => e.significance >= 50);
    const keyEvents = significant.length > 0 ? significant : sorted.slice(0, 3);

    // Generate life narrative summary
    if (keyEvents.length > 0) {
      const firstEvent = keyEvents[0];
      const lastEvent = keyEvents[keyEvents.length - 1];
      if (firstEvent !== undefined && lastEvent !== undefined) {
        const firstYear = tickToYear(firstEvent.timestamp);
        const lastYear = tickToYear(lastEvent.timestamp);
        if (firstYear === lastYear) {
          lines.push(`In Year ${firstYear}, events shaped the course of ${name}'s life.`);
        } else {
          lines.push(`From Year ${firstYear} to Year ${lastYear}, a chain of events shaped ${name}'s fate.`);
        }
        lines.push('');
      }
    }

    // Key moments
    lines.push('Key moments:');
    const toShow = keyEvents.slice(0, 5);
    for (const event of toShow) {
      const year = tickToYear(event.timestamp);
      const desc = (event.data as Record<string, unknown>)['description'];
      const description = typeof desc === 'string' ? desc : event.subtype.replace(/[._]/g, ' ');
      lines.push(`  ! Y${year} ${description}`);
    }

    if (events.length > toShow.length) {
      lines.push('');
      lines.push(`{${DIM_COLOR}-fg}(${events.length} events total -- press 't' for full timeline){/}`);
    }

    return lines;
  }

  // ─── Section 2: Strengths & Flaws ─────────────────────────────────

  private renderStrengthsFlaws(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    // Personality prose (Big Five)
    const personality = world.hasStore('Personality')
      ? world.getComponent(entityId, 'Personality') as {
          openness?: number;
          conscientiousness?: number;
          extraversion?: number;
          agreeableness?: number;
          neuroticism?: number;
        } | undefined
      : undefined;

    // Traits
    const traits = world.hasStore('Traits')
      ? world.getComponent(entityId, 'Traits') as { traits?: string[]; intensities?: Map<string, number> } | undefined
      : undefined;

    // Attributes
    const attr = world.hasStore('Attribute')
      ? world.getComponent(entityId, 'Attribute') as {
          strength?: number;
          agility?: number;
          endurance?: number;
          intelligence?: number;
          wisdom?: number;
          charisma?: number;
        } | undefined
      : undefined;

    // Generate prose from personality
    if (personality !== undefined) {
      const descriptors: string[] = [];
      for (const [axis, value] of Object.entries(personality) as Array<[string, number | undefined]>) {
        if (value === undefined) continue;
        const desc = getPersonalityDescriptor(axis, value);
        if (desc !== null) {
          descriptors.push(desc);
        }
      }

      if (descriptors.length > 0) {
        const proseText = descriptors.join(', and ');
        const wrapped = wrapText(`This individual is ${proseText}.`, 50);
        lines.push(...wrapped);
        lines.push('');
      } else {
        lines.push(`{${DIM_COLOR}-fg}A moderate temperament with no extreme tendencies.{/}`);
        lines.push('');
      }
    }

    // Attribute bars (secondary, beneath prose)
    if (attr !== undefined) {
      lines.push('Attributes:');
      const attributes: Array<[string, number | undefined]> = [
        ['STR', attr.strength],
        ['AGI', attr.agility],
        ['END', attr.endurance],
        ['INT', attr.intelligence],
        ['WIS', attr.wisdom],
        ['CHA', attr.charisma],
      ];

      for (const [name, value] of attributes) {
        const v = value ?? 10;
        const bar = renderBar(v, 20);
        lines.push(`  ${name}: ${bar} ${v}`);
      }
      lines.push('');
    }

    // Traits as compact tags
    if (traits?.traits !== undefined && traits.traits.length > 0) {
      const traitList = traits.traits.map(t => {
        const intensity = traits.intensities?.get(t) ?? 50;
        return intensity >= 70 ? `{bold}${t}{/bold}` : t;
      });
      lines.push(`Traits: ${traitList.join('  |  ')}`);
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No personality data available.{/}`);
    }

    return lines;
  }

  // ─── Section 3: Bonds & Rivalries ─────────────────────────────────

  private renderBondsRivalries(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const relationships = world.hasStore('Relationship')
      ? world.getComponent(entityId, 'Relationship') as {
          relationships?: Map<number, string>;
          affinity?: Map<number, number>;
        } | undefined
      : undefined;

    const grudges = world.hasStore('Grudges')
      ? world.getComponent(entityId, 'Grudges') as {
          grudges?: Map<number, string>;
          severity?: Map<number, number>;
        } | undefined
      : undefined;

    // Faction membership
    const membership = world.hasStore('Membership')
      ? world.getComponent(entityId, 'Membership') as { factionId?: number | null; rank?: string } | undefined
      : undefined;

    if (membership?.factionId !== undefined && membership.factionId !== null) {
      const factionName = this.resolveEntityName(membership.factionId as unknown as EntityId, context);
      const rankStr = membership.rank !== undefined ? ` (${membership.rank})` : '';
      lines.push(`ALLEGIANCE:`);
      lines.push(`  & ${renderEntityName(factionName)}${rankStr}`);
      lines.push('');
    }

    if (relationships?.relationships !== undefined && relationships.relationships.size > 0) {
      const affMap = relationships.affinity ?? new Map<number, number>();

      // Categorize: allies (affinity > 0), rivals (affinity < 0)
      const allies: Array<[number, string, number]> = [];
      const rivals: Array<[number, string, number]> = [];

      for (const [targetId, relType] of relationships.relationships) {
        const affinity = affMap.get(targetId) ?? 0;
        if (affinity >= 0) {
          allies.push([targetId, relType, affinity]);
        } else {
          rivals.push([targetId, relType, affinity]);
        }
      }

      // Sort allies by affinity descending, rivals by affinity ascending
      allies.sort((a, b) => b[2] - a[2]);
      rivals.sort((a, b) => a[2] - b[2]);

      if (allies.length > 0) {
        lines.push('ALLIES:');
        for (const [targetId, relType, affinity] of allies.slice(0, 5)) {
          const name = this.resolveEntityName(targetId as unknown as EntityId, context);
          const leader = renderDottedLeader(`@ ${name}`, `${relType} [+${affinity}]`, 45);
          lines.push(`  ${leader}`);
        }
        if (allies.length > 5) {
          lines.push(`  {${DIM_COLOR}-fg}... and ${allies.length - 5} more allies{/}`);
        }
        lines.push('');
      }

      if (rivals.length > 0) {
        lines.push('RIVALS:');
        for (const [targetId, relType, affinity] of rivals.slice(0, 5)) {
          const name = this.resolveEntityName(targetId as unknown as EntityId, context);
          const leader = renderDottedLeader(`@ ${name}`, `${relType} [${affinity}]`, 45);
          lines.push(`  ${leader}`);
        }
        if (rivals.length > 5) {
          lines.push(`  {${DIM_COLOR}-fg}... and ${rivals.length - 5} more rivals{/}`);
        }
        lines.push('');
      }
    }

    if (grudges?.grudges !== undefined && grudges.grudges.size > 0) {
      lines.push(`${grudges.grudges.size} grudge${grudges.grudges.size > 1 ? 's' : ''} burn in memory:`);
      for (const [targetId, reason] of grudges.grudges) {
        const severity = grudges.severity?.get(targetId) ?? 50;
        const name = this.resolveEntityName(targetId as unknown as EntityId, context);
        lines.push(`  ${renderEntityName(name)}: ${reason} (severity: ${severity})`);
      }
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No known relationships or rivalries.{/}`);
    }

    return lines;
  }

  // ─── Section 4: Worldly Standing ──────────────────────────────────

  private renderWorldlyStanding(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const status = world.hasStore('Status')
      ? world.getComponent(entityId, 'Status') as { titles?: string[]; socialClass?: string; conditions?: string[] } | undefined
      : undefined;

    const membership = world.hasStore('Membership')
      ? world.getComponent(entityId, 'Membership') as { factionId?: number | null; rank?: string } | undefined
      : undefined;

    const wealth = world.hasStore('Wealth')
      ? world.getComponent(entityId, 'Wealth') as { coins?: number; propertyValue?: number; debts?: number } | undefined
      : undefined;

    // Generate prose
    const parts: string[] = [];

    if (membership?.rank !== undefined && membership.factionId !== undefined && membership.factionId !== null) {
      const factionName = this.resolveEntityName(membership.factionId as unknown as EntityId, context);
      parts.push(`holds the rank of ${membership.rank} within the ${renderEntityName(factionName)}`);
    }

    if (status?.socialClass !== undefined) {
      parts.push(`of the ${status.socialClass} class`);
    }

    if (parts.length > 0) {
      const name = (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined)
        ? status.titles[0] : 'This individual';
      lines.push(`${name} ${parts.join(', ')}.`);
      lines.push('');
    }

    // Wealth data
    if (wealth !== undefined) {
      if (wealth.coins !== undefined) {
        lines.push(`Wealth: ${wealth.coins.toLocaleString()} gold`);
      }
      if (wealth.propertyValue !== undefined) {
        lines.push(`Property: ${wealth.propertyValue.toLocaleString()}`);
      }
      if (wealth.debts !== undefined && wealth.debts > 0) {
        lines.push(`{${NEGATIVE_COLOR}-fg}Debts: ${wealth.debts.toLocaleString()}{/}`);
      }
    }

    // Titles
    if (status?.titles !== undefined && status.titles.length > 1) {
      lines.push('');
      lines.push('Titles:');
      for (const title of status.titles.slice(1)) {
        lines.push(`  * ${title}`);
      }
    }

    // Conditions
    if (status?.conditions !== undefined && status.conditions.length > 0) {
      lines.push('');
      lines.push(`Conditions: ${status.conditions.join(', ')}`);
    }

    if (lines.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No worldly standing recorded.{/}`);
    }

    return lines;
  }

  // ─── Section 5: Heart & Mind ──────────────────────────────────────

  private renderHeartMind(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const goals = world.hasStore('Goal')
      ? world.getComponent(entityId, 'Goal') as { objectives?: string[]; priorities?: Map<string, number> } | undefined
      : undefined;

    if (goals?.objectives !== undefined && goals.objectives.length > 0) {
      // Sort by priority
      const sorted = [...goals.objectives].sort((a, b) => {
        const pa = goals.priorities?.get(a) ?? 50;
        const pb = goals.priorities?.get(b) ?? 50;
        return pb - pa;
      });

      const count = sorted.length;
      lines.push(`${count} ambition${count > 1 ? 's' : ''} drive${count === 1 ? 's' : ''} this soul forward:`);
      lines.push('');

      for (const objective of sorted) {
        const priority = goals.priorities?.get(objective) ?? 50;
        const urgency = priority >= 80 ? '!!!' : priority >= 50 ? '!!' : '!';
        lines.push(`${urgency} ${objective}  {${DIM_COLOR}-fg}(priority: ${priority}){/}`);
      }
    } else {
      lines.push(`{${DIM_COLOR}-fg}No active goals or ambitions recorded.{/}`);
    }

    return lines;
  }

  // ─── Section 6: Remembered Things ─────────────────────────────────

  private renderRememberedThings(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const memory = world.hasStore('Memory')
      ? world.getComponent(entityId, 'Memory') as {
          memories?: Array<{ eventId: number; importance: number; distortion: number }>;
          capacity?: number;
        } | undefined
      : undefined;

    if (memory?.memories !== undefined && memory.memories.length > 0) {
      const total = memory.memories.length;
      const distortedCount = memory.memories.filter(m => m.distortion > 50).length;
      const fadedCount = memory.memories.filter(m => m.importance < 20).length;

      lines.push(`Carries ${total} memories${distortedCount > 0 ? `, ${distortedCount} distorted with time` : ''}.`);
      lines.push('');

      // Sort by importance, show strongest
      const sorted = [...memory.memories].sort((a, b) => b.importance - a.importance);
      const toShow = sorted.slice(0, 5);

      lines.push('Strongest memories:');
      for (const mem of toShow) {
        const distortionLabel = mem.distortion > 50 ? ' (distorted)' : '';
        // Try to resolve event description
        const event = context.eventLog.getById(mem.eventId as unknown as EntityId as unknown as import('@fws/core').EventId);
        if (event !== undefined) {
          const desc = (event.data as Record<string, unknown>)['description'];
          const description = typeof desc === 'string' ? desc : event.subtype.replace(/[._]/g, ' ');
          lines.push(`  ! ${description} {${DIM_COLOR}-fg}[imp: ${mem.importance}]${distortionLabel}{/}`);
        } else {
          lines.push(`  ! Event #${mem.eventId} {${DIM_COLOR}-fg}[imp: ${mem.importance}]${distortionLabel}{/}`);
        }
      }

      if (fadedCount > 0) {
        lines.push('');
        lines.push(`{${DIM_COLOR}-fg}${fadedCount} memories have faded beyond recognition.{/}`);
      }

      if (sorted.length > 5) {
        lines.push(`{${DIM_COLOR}-fg}... and ${sorted.length - 5} more memories{/}`);
      }
    } else {
      lines.push(`{${DIM_COLOR}-fg}No memories recorded.{/}`);
    }

    return lines;
  }

  // ─── Section 7: Possessions & Treasures ───────────────────────────

  private renderPossessionsTreasures(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const possessions = world.hasStore('Possession')
      ? world.getComponent(entityId, 'Possession') as {
          itemIds?: number[];
          equippedIds?: number[];
        } | undefined
      : undefined;

    const wealth = world.hasStore('Wealth')
      ? world.getComponent(entityId, 'Wealth') as {
          coins?: number;
          propertyValue?: number;
          debts?: number;
        } | undefined
      : undefined;

    if (wealth !== undefined) {
      const parts: string[] = [];
      if (wealth.coins !== undefined) parts.push(`${wealth.coins.toLocaleString()} gold in coin`);
      if (wealth.propertyValue !== undefined) parts.push(`property valued at ${wealth.propertyValue.toLocaleString()}`);

      if (parts.length > 0) {
        lines.push(`Wealth: ${parts.join(', ')}.`);
      }

      if (wealth.debts !== undefined && wealth.debts > 0) {
        lines.push(`{${NEGATIVE_COLOR}-fg}Outstanding debts of ${wealth.debts.toLocaleString()}.{/}`);
      }
      lines.push('');
    }

    if (possessions?.itemIds !== undefined && possessions.itemIds.length > 0) {
      const equipped = new Set(possessions.equippedIds ?? []);
      const total = possessions.itemIds.length;

      lines.push(`Carries ${total} item${total > 1 ? 's' : ''}:`);
      for (const itemId of possessions.itemIds.slice(0, 10)) {
        const equippedLabel = equipped.has(itemId) ? ' {bold}[E]{/bold}' : '';
        const itemName = this.resolveEntityName(itemId as unknown as EntityId, context);
        lines.push(`  * ${renderEntityName(itemName)}${equippedLabel}`);
      }

      if (possessions.itemIds.length > 10) {
        lines.push(`  {${DIM_COLOR}-fg}... and ${possessions.itemIds.length - 10} more items{/}`);
      }
    } else if (wealth === undefined) {
      lines.push(`{${DIM_COLOR}-fg}No possessions of note.{/}`);
    }

    return lines;
  }

  // ─── Mode renderers ───────────────────────────────────────────────

  private renderRelationshipsMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Bonds & Rivalries ===');
    lines.push('');
    lines.push(...this.renderBondsRivalries(entityId, context));
    return lines;
  }

  private renderTimelineMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Timeline ===');
    lines.push('');

    const { eventLog } = context;
    const events = eventLog.getByEntity(entityId);

    if (events.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No events recorded.{/}`);
      return lines;
    }

    // Sort by timestamp ascending
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
    lines.push('=== Full Character Details ===');
    lines.push('');

    const allSections = [
      'story-so-far', 'strengths-flaws', 'bonds-rivalries',
      'worldly-standing', 'heart-mind', 'remembered-things',
      'possessions-treasures',
    ];

    const sectionTitles: Record<string, string> = {
      'story-so-far': 'The Story So Far',
      'strengths-flaws': 'Strengths & Flaws',
      'bonds-rivalries': 'Bonds & Rivalries',
      'worldly-standing': 'Worldly Standing',
      'heart-mind': 'Heart & Mind',
      'remembered-things': 'Remembered Things',
      'possessions-treasures': 'Possessions & Treasures',
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
