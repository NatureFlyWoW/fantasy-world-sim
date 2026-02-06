/**
 * Character Inspector - renders detailed character information.
 * Provides 8 sections: header, attributes, personality, goals, relationships, memories, possessions, timeline.
 */

import type { EntityId } from '@fws/core';
import type { RenderContext } from '../types.js';
import type { InspectorSection, InspectorMode } from './inspector-panel.js';

/**
 * Attribute bar configuration.
 */
const ATTRIBUTE_BAR_WIDTH = 20;
const FILLED_BLOCK = '█';
const EMPTY_BLOCK = '░';

/**
 * Character inspector sub-component.
 */
export class CharacterInspector {
  /**
   * Get available sections for character inspection.
   */
  getSections(): InspectorSection[] {
    return [
      { id: 'header', title: 'Overview', collapsed: false },
      { id: 'attributes', title: 'Attributes', collapsed: false },
      { id: 'personality', title: 'Personality', collapsed: false },
      { id: 'goals', title: 'Goals', collapsed: true },
      { id: 'relationships', title: 'Relationships', collapsed: true },
      { id: 'memories', title: 'Memories', collapsed: true },
      { id: 'possessions', title: 'Possessions', collapsed: true },
      { id: 'timeline', title: 'Timeline', collapsed: true },
    ];
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
    const lines: string[] = [];

    // Render based on mode
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
        lines.push(...this.renderDetailsMode(entityId, context, sections));
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
      case 'header':
        return this.renderHeader(entityId, context);
      case 'attributes':
        return this.renderAttributes(entityId, context);
      case 'personality':
        return this.renderPersonality(entityId, context);
      case 'goals':
        return this.renderGoals(entityId, context);
      case 'relationships':
        return this.renderRelationships(entityId, context);
      case 'memories':
        return this.renderMemories(entityId, context);
      case 'possessions':
        return this.renderPossessions(entityId, context);
      case 'timeline':
        return this.renderTimeline(entityId, context);
      default:
        return ['Unknown section'];
    }
  }

  /**
   * Render header section with basic info.
   */
  private renderHeader(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    // Get status component for name/titles
    const status = world.hasStore('Status')
      ? world.getComponent(entityId, 'Status') as { titles?: string[]; socialClass?: string; conditions?: string[] } | undefined
      : undefined;

    // Get health component
    const health = world.hasStore('Health')
      ? world.getComponent(entityId, 'Health') as { current?: number; maximum?: number; injuries?: string[]; diseases?: string[] } | undefined
      : undefined;

    // Get membership for faction info
    const membership = world.hasStore('Membership')
      ? world.getComponent(entityId, 'Membership') as { factionId?: number | null; rank?: string } | undefined
      : undefined;

    // Name/title
    if (status?.titles !== undefined && status.titles.length > 0) {
      lines.push(`Name: ${status.titles[0] ?? 'Unknown'}`);
      if (status.titles.length > 1) {
        lines.push(`Titles: ${status.titles.slice(1).join(', ')}`);
      }
    } else {
      lines.push(`ID: #${entityId}`);
    }

    // Social class
    if (status?.socialClass !== undefined) {
      lines.push(`Class: ${status.socialClass}`);
    }

    // Health status
    if (health !== undefined) {
      const current = health.current ?? 100;
      const maximum = health.maximum ?? 100;
      const healthPct = Math.round((current / maximum) * 100);
      lines.push(`Health: ${current}/${maximum} (${healthPct}%)`);

      if (health.injuries !== undefined && health.injuries.length > 0) {
        lines.push(`Injuries: ${health.injuries.join(', ')}`);
      }
      if (health.diseases !== undefined && health.diseases.length > 0) {
        lines.push(`Diseases: ${health.diseases.join(', ')}`);
      }
    }

    // Conditions
    if (status?.conditions !== undefined && status.conditions.length > 0) {
      lines.push(`Conditions: ${status.conditions.join(', ')}`);
    }

    // Faction membership
    if (membership?.factionId !== undefined && membership.factionId !== null) {
      const rankStr = membership.rank !== undefined ? ` (${membership.rank})` : '';
      lines.push(`Faction: #${membership.factionId}${rankStr}`);
    }

    return lines;
  }

  /**
   * Render attributes section with ASCII bar charts.
   */
  private renderAttributes(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

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

    if (attr === undefined) {
      lines.push('No attribute data');
      return lines;
    }

    // Render each attribute as a bar
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
      const bar = this.renderAttributeBar(v, 20); // Max 20 for attributes
      lines.push(`${name}: ${bar} ${v}`);
    }

    return lines;
  }

  /**
   * Render an ASCII attribute bar.
   */
  private renderAttributeBar(value: number, maxValue: number): string {
    const normalized = Math.max(0, Math.min(1, value / maxValue));
    const filledCount = Math.round(normalized * ATTRIBUTE_BAR_WIDTH);
    const emptyCount = ATTRIBUTE_BAR_WIDTH - filledCount;

    return FILLED_BLOCK.repeat(filledCount) + EMPTY_BLOCK.repeat(emptyCount);
  }

  /**
   * Render personality section.
   */
  private renderPersonality(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    // Big Five personality traits
    const personality = world.hasStore('Personality')
      ? world.getComponent(entityId, 'Personality') as {
          openness?: number;
          conscientiousness?: number;
          extraversion?: number;
          agreeableness?: number;
          neuroticism?: number;
        } | undefined
      : undefined;

    // Character traits
    const traits = world.hasStore('Traits')
      ? world.getComponent(entityId, 'Traits') as { traits?: string[]; intensities?: Map<string, number> } | undefined
      : undefined;

    if (personality !== undefined) {
      lines.push('Big Five:');
      const bigFive: Array<[string, number | undefined]> = [
        ['Openness', personality.openness],
        ['Conscientiousness', personality.conscientiousness],
        ['Extraversion', personality.extraversion],
        ['Agreeableness', personality.agreeableness],
        ['Neuroticism', personality.neuroticism],
      ];

      for (const [name, value] of bigFive) {
        const v = value ?? 50;
        const bar = this.renderAttributeBar(v, 100);
        lines.push(`  ${name.slice(0, 4)}: ${bar} ${v}`);
      }
    }

    if (traits?.traits !== undefined && traits.traits.length > 0) {
      lines.push('');
      lines.push('Traits:');
      for (const trait of traits.traits) {
        const intensity = traits.intensities?.get(trait) ?? 50;
        lines.push(`  • ${trait} (${intensity})`);
      }
    }

    if (lines.length === 0) {
      lines.push('No personality data');
    }

    return lines;
  }

  /**
   * Render goals section.
   */
  private renderGoals(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const goals = world.hasStore('Goal')
      ? world.getComponent(entityId, 'Goal') as { objectives?: string[]; priorities?: Map<string, number> } | undefined
      : undefined;

    if (goals?.objectives !== undefined && goals.objectives.length > 0) {
      for (const objective of goals.objectives) {
        const priority = goals.priorities?.get(objective) ?? 50;
        const priorityLabel = priority >= 80 ? '!!!' : priority >= 50 ? '!!' : '!';
        lines.push(`${priorityLabel} ${objective}`);
      }
    } else {
      lines.push('No active goals');
    }

    return lines;
  }

  /**
   * Render relationships section.
   */
  private renderRelationships(entityId: EntityId, context: RenderContext): string[] {
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

    if (relationships?.relationships !== undefined) {
      const relMap = relationships.relationships;
      const affMap = relationships.affinity ?? new Map<number, number>();

      if (relMap.size > 0) {
        lines.push('Relations:');
        for (const [targetId, relType] of relMap) {
          const affinity = affMap.get(targetId) ?? 0;
          const affinityStr = affinity >= 0 ? `+${affinity}` : `${affinity}`;
          lines.push(`  #${targetId}: ${relType} [${affinityStr}]`);
        }
      }
    }

    if (grudges?.grudges !== undefined && grudges.grudges.size > 0) {
      lines.push('');
      lines.push('Grudges:');
      for (const [targetId, reason] of grudges.grudges) {
        const severity = grudges.severity?.get(targetId) ?? 50;
        lines.push(`  #${targetId}: ${reason} (severity: ${severity})`);
      }
    }

    if (lines.length === 0) {
      lines.push('No known relationships');
    }

    return lines;
  }

  /**
   * Render memories section.
   */
  private renderMemories(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const memory = world.hasStore('Memory')
      ? world.getComponent(entityId, 'Memory') as {
          memories?: Array<{ eventId: number; importance: number; distortion: number }>;
          capacity?: number;
        } | undefined
      : undefined;

    if (memory?.memories !== undefined && memory.memories.length > 0) {
      lines.push(`Memories (${memory.memories.length}/${memory.capacity ?? '?'}):`);

      // Sort by importance, show top 10
      const sorted = [...memory.memories].sort((a, b) => b.importance - a.importance);
      const toShow = sorted.slice(0, 10);

      for (const mem of toShow) {
        const distortionLabel = mem.distortion > 50 ? ' (distorted)' : '';
        lines.push(`  Event #${mem.eventId} [imp: ${mem.importance}]${distortionLabel}`);
      }

      if (sorted.length > 10) {
        lines.push(`  ... and ${sorted.length - 10} more`);
      }
    } else {
      lines.push('No memories recorded');
    }

    return lines;
  }

  /**
   * Render possessions section.
   */
  private renderPossessions(entityId: EntityId, context: RenderContext): string[] {
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
      lines.push('Wealth:');
      if (wealth.coins !== undefined) lines.push(`  Coins: ${wealth.coins}`);
      if (wealth.propertyValue !== undefined) lines.push(`  Property: ${wealth.propertyValue}`);
      if (wealth.debts !== undefined && wealth.debts > 0) lines.push(`  Debts: ${wealth.debts}`);
      lines.push('');
    }

    if (possessions?.itemIds !== undefined && possessions.itemIds.length > 0) {
      lines.push('Items:');
      const equipped = new Set(possessions.equippedIds ?? []);

      for (const itemId of possessions.itemIds) {
        const equippedLabel = equipped.has(itemId) ? ' [E]' : '';
        lines.push(`  Item #${itemId}${equippedLabel}`);
      }
    } else {
      if (wealth === undefined) {
        lines.push('No possessions');
      }
    }

    return lines;
  }

  /**
   * Render timeline section.
   */
  private renderTimeline(entityId: EntityId, context: RenderContext): string[] {
    const { eventLog } = context;
    const lines: string[] = [];

    // Get events involving this character
    const events = eventLog.getByEntity(entityId);

    if (events.length === 0) {
      lines.push('No events recorded');
      return lines;
    }

    // Sort by timestamp descending (most recent first)
    const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const toShow = sorted.slice(0, 15);

    for (const event of toShow) {
      const year = Math.floor(event.timestamp / 360) + 1;
      const day = (event.timestamp % 360) + 1;
      const desc = (event.data as Record<string, unknown>)['description'] ?? event.subtype;
      lines.push(`Y${year}D${day}: ${desc}`);
    }

    if (sorted.length > 15) {
      lines.push(`... and ${sorted.length - 15} more events`);
    }

    return lines;
  }

  /**
   * Render relationships mode (full relationship view).
   */
  private renderRelationshipsMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Relationships ═══');
    lines.push('');
    lines.push(...this.renderRelationships(entityId, context));
    return lines;
  }

  /**
   * Render timeline mode (full event history).
   */
  private renderTimelineMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Timeline ═══');
    lines.push('');

    const { eventLog } = context;
    const events = eventLog.getByEntity(entityId);

    if (events.length === 0) {
      lines.push('No events recorded');
      return lines;
    }

    // Sort by timestamp
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of sorted) {
      const year = Math.floor(event.timestamp / 360) + 1;
      const day = (event.timestamp % 360) + 1;
      const desc = (event.data as Record<string, unknown>)['description'] ?? event.subtype;
      lines.push(`Y${year}D${day}: ${desc}`);
      lines.push(`  Category: ${event.category}`);
      lines.push(`  Significance: ${event.significance}`);
      lines.push('');
    }

    return lines;
  }

  /**
   * Render details mode (all sections expanded).
   */
  private renderDetailsMode(
    entityId: EntityId,
    context: RenderContext,
    _sections: readonly InspectorSection[]
  ): string[] {
    const lines: string[] = [];

    lines.push('═══ Full Details ═══');
    lines.push('');

    // Render all sections
    const allSections = ['header', 'attributes', 'personality', 'goals', 'relationships', 'memories', 'possessions', 'timeline'];

    for (const sectionId of allSections) {
      const title = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      lines.push(`─── ${title} ───`);
      lines.push(...this.renderSection(sectionId, entityId, context));
      lines.push('');
    }

    return lines;
  }
}
