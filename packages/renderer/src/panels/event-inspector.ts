/**
 * Event Inspector - renders detailed event information with prose-first design.
 * Provides 6 sections: What Happened, Who Was Involved, Where & When,
 * Why It Matters, What Came Before, What Followed.
 */

import type { EventId, WorldEvent, EntityId } from '@fws/core';
import type { RenderContext } from '../types.js';
import type { InspectorSection, InspectorMode } from './inspector-panel.js';
import { CATEGORY_ICONS } from './event-formatter.js';
import {
  DIM_COLOR,
  renderEntityName,
  renderBar,
  getSignificanceLabel,
  tickToYear,
  tickToSeason,
  wrapText,
  createEntitySpanMap,
} from './inspector-prose.js';
import type { EntitySpanMap } from './inspector-prose.js';

/**
 * Event inspector sub-component.
 */
export class EventInspector {
  private entitySpans: EntitySpanMap = createEntitySpanMap();

  /**
   * Get available sections for event inspection.
   */
  getSections(event?: WorldEvent | undefined): InspectorSection[] {
    const causeCount = event?.causes?.length ?? 0;
    const consequenceCount = event?.consequences?.length ?? 0;
    const participantCount = event?.participants?.length ?? 0;

    return [
      { id: 'what-happened', title: 'What Happened', collapsed: false },
      { id: 'who-involved', title: 'Who Was Involved', summaryHint: `${participantCount} participants`, collapsed: false },
      { id: 'where-when', title: 'Where & When', collapsed: false },
      { id: 'why-matters', title: 'Why It Matters', summaryHint: event !== undefined ? getSignificanceLabel(event.significance) : '', collapsed: true },
      { id: 'what-before', title: 'What Came Before', summaryHint: `${causeCount} causes`, collapsed: true },
      { id: 'what-followed', title: 'What Followed', summaryHint: `${consequenceCount} consequences`, collapsed: true },
    ];
  }

  /**
   * Get entity span map for click detection.
   */
  getEntitySpans(): EntitySpanMap {
    return this.entitySpans;
  }

  /**
   * Render event information.
   */
  render(
    eventId: EventId,
    context: RenderContext,
    sections: readonly InspectorSection[],
    mode: InspectorMode
  ): string[] {
    this.entitySpans = createEntitySpanMap();
    const lines: string[] = [];

    const event = context.eventLog.getById(eventId);
    if (event === undefined) {
      lines.push('');
      lines.push(`  {${DIM_COLOR}-fg}This event has passed beyond the reach of chronicles.{/}`);
      lines.push('');
      lines.push(`  {${DIM_COLOR}-fg}Event ${String(eventId)} is no longer present in the record.{/}`);
      return lines;
    }

    switch (mode) {
      case 'overview':
        lines.push(...this.renderOverview(event, context, sections));
        break;
      case 'relationships':
        lines.push(...this.renderParticipantsMode(event, context));
        break;
      case 'timeline':
        lines.push(...this.renderCascadeMode(event, context));
        break;
      case 'details':
        lines.push(...this.renderDetailsMode(event, context));
        break;
    }

    return lines;
  }

  /**
   * Render overview mode with collapsible sections.
   */
  private renderOverview(
    event: WorldEvent,
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
        const content = this.renderSection(section.id, event, context);
        lines.push(...content.map(line => `    ${line}`));
        lines.push('');
      }
    }

    return lines;
  }

  /**
   * Render a specific section.
   */
  private renderSection(sectionId: string, event: WorldEvent, context: RenderContext): string[] {
    switch (sectionId) {
      case 'what-happened':
        return this.renderWhatHappened(event, context);
      case 'who-involved':
        return this.renderWhoInvolved(event, context);
      case 'where-when':
        return this.renderWhereWhen(event, context);
      case 'why-matters':
        return this.renderWhyMatters(event, context);
      case 'what-before':
        return this.renderWhatBefore(event, context);
      case 'what-followed':
        return this.renderWhatFollowed(event, context);
      default:
        return ['Unknown section'];
    }
  }

  /**
   * Section 1: What Happened - narrative prose of the event.
   */
  private renderWhatHappened(event: WorldEvent, _context: RenderContext): string[] {
    const lines: string[] = [];

    // Event category icon
    const icon = CATEGORY_ICONS[event.category] ?? '!';

    // Try to get description from event data
    const desc = (event.data as Record<string, unknown>)['description'];
    const description = typeof desc === 'string' && desc.length > 0 ? desc : event.subtype;

    lines.push(`${icon} {bold}${description}{/bold}`);
    lines.push('');

    // Generate prose from available data
    const year = tickToYear(event.timestamp);
    const season = tickToSeason(event.timestamp);
    const humanSubtype = event.subtype.replace(/[._]/g, ' ');

    lines.push(`In the ${season.toLowerCase()} of Year ${year}, ${humanSubtype}.`);

    // If there's extended narrative data, show it
    const narrative = (event.data as Record<string, unknown>)['narrative'];
    if (typeof narrative === 'string' && narrative.length > 0) {
      lines.push('');
      const wrapped = wrapText(narrative, 50);
      lines.push(...wrapped);
    }

    return lines;
  }

  /**
   * Section 2: Who Was Involved - participant list with clickable names.
   */
  private renderWhoInvolved(event: WorldEvent, context: RenderContext): string[] {
    const lines: string[] = [];

    if (event.participants.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No specific participants recorded.{/}`);
      return lines;
    }

    // Primary participants (first 2)
    const primary = event.participants.slice(0, 2);
    const secondary = event.participants.slice(2);

    if (primary.length > 0) {
      lines.push('{bold}PRIMARY:{/bold}');
      for (const entityId of primary) {
        const name = this.resolveEntityName(entityId, context);
        const typeIcon = this.getEntityTypeIcon(entityId, context);
        lines.push(`  ${typeIcon} ${renderEntityName(name)}`);
      }
    }

    if (secondary.length > 0) {
      lines.push('');
      lines.push('{bold}SECONDARY:{/bold}');
      for (const entityId of secondary) {
        const name = this.resolveEntityName(entityId, context);
        const typeIcon = this.getEntityTypeIcon(entityId, context);
        lines.push(`  ${typeIcon} ${renderEntityName(name)}`);
      }
    }

    // Also scan event data for additional entity references
    const data = event.data as Record<string, unknown>;
    const additionalIds: EntityId[] = [];
    for (const [key, value] of Object.entries(data)) {
      if ((key.endsWith('Id') || key.endsWith('_id')) && typeof value === 'number') {
        const entityId = value as unknown as EntityId;
        if (!event.participants.includes(entityId)) {
          additionalIds.push(entityId);
        }
      }
    }

    if (additionalIds.length > 0) {
      lines.push('');
      lines.push(`{${DIM_COLOR}-fg}Also referenced:{/}`);
      for (const entityId of additionalIds.slice(0, 5)) {
        const name = this.resolveEntityName(entityId, context);
        lines.push(`  ${renderEntityName(name)}`);
      }
    }

    return lines;
  }

  /**
   * Section 3: Where & When - location and date information.
   */
  private renderWhereWhen(event: WorldEvent, context: RenderContext): string[] {
    const lines: string[] = [];

    // Date
    const year = tickToYear(event.timestamp);
    const season = tickToSeason(event.timestamp);
    const month = Math.floor((event.timestamp % 360) / 30) + 1;
    const dayOfMonth = ((event.timestamp % 360) % 30) + 1;

    lines.push(`Date: Year ${year}, Month ${month}, Day ${dayOfMonth} (${season})`);

    // Location from event data
    const data = event.data as Record<string, unknown>;
    const locationId = data['locationId'] ?? data['location_id'] ?? data['siteId'];
    if (typeof locationId === 'number') {
      const locationEntityId = locationId as unknown as EntityId;
      const name = this.resolveEntityName(locationEntityId, context);
      lines.push(`Location: # ${renderEntityName(name)}`);
    }

    // Coordinates from event data
    const x = data['x'];
    const y = data['y'];
    if (typeof x === 'number' && typeof y === 'number') {
      lines.push(`Coordinates: (${x}, ${y})`);
    }

    if (lines.length === 1) {
      lines.push(`{${DIM_COLOR}-fg}Location not recorded.{/}`);
    }

    return lines;
  }

  /**
   * Section 4: Why It Matters - significance analysis.
   */
  private renderWhyMatters(event: WorldEvent, _context: RenderContext): string[] {
    const lines: string[] = [];

    const label = getSignificanceLabel(event.significance);
    const bar = renderBar(event.significance, 100);
    lines.push(`Significance: ${bar} {bold}${label}{/bold} (${event.significance})`);
    lines.push('');

    // Count consequences
    const consequenceCount = event.consequences.length;
    if (consequenceCount > 0) {
      lines.push(`This event triggered a cascade of ${consequenceCount} subsequent event${consequenceCount > 1 ? 's' : ''}.`);
    } else {
      lines.push(`{${DIM_COLOR}-fg}This event did not trigger further cascading events.{/}`);
    }

    return lines;
  }

  /**
   * Section 5: What Came Before - causal chain.
   */
  private renderWhatBefore(event: WorldEvent, context: RenderContext): string[] {
    const lines: string[] = [];

    if (event.causes.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}This event arose from no recorded prior cause.{/}`);
      return lines;
    }

    lines.push('This event grew from earlier seeds:');
    lines.push('');

    for (const causeId of event.causes.slice(0, 5)) {
      const causeEvent = context.eventLog.getById(causeId);
      if (causeEvent !== undefined) {
        const year = tickToYear(causeEvent.timestamp);
        const desc = (causeEvent.data as Record<string, unknown>)['description'];
        const description = typeof desc === 'string' ? desc : causeEvent.subtype.replace(/[._]/g, ' ');
        const timeDelta = tickToYear(event.timestamp) - year;
        const timeStr = timeDelta > 0 ? `(${timeDelta} year${timeDelta > 1 ? 's' : ''} before)` : '(same year)';
        lines.push(`  ! Y${year} ${description}`);
        lines.push(`    {${DIM_COLOR}-fg}${timeStr}{/}`);
      } else {
        lines.push(`  ! Event ${String(causeId)} (record lost)`);
      }
    }

    if (event.causes.length > 5) {
      lines.push(`  {${DIM_COLOR}-fg}... and ${event.causes.length - 5} more causes{/}`);
    }

    return lines;
  }

  /**
   * Section 6: What Followed - consequence chain.
   */
  private renderWhatFollowed(event: WorldEvent, context: RenderContext): string[] {
    const lines: string[] = [];

    if (event.consequences.length === 0) {
      lines.push(`{${DIM_COLOR}-fg}No consequences have been recorded.{/}`);
      return lines;
    }

    lines.push('The ripples of this event spread far:');
    lines.push('');

    const toShow = event.consequences.slice(0, 5);
    for (const consequenceId of toShow) {
      const consequenceEvent = context.eventLog.getById(consequenceId);
      if (consequenceEvent !== undefined) {
        const year = tickToYear(consequenceEvent.timestamp);
        const desc = (consequenceEvent.data as Record<string, unknown>)['description'];
        const description = typeof desc === 'string' ? desc : consequenceEvent.subtype.replace(/[._]/g, ' ');
        lines.push(`  ! Y${year} ${description}`);
      } else {
        lines.push(`  ! Event ${String(consequenceId)} (record lost)`);
      }
    }

    if (event.consequences.length > 5) {
      lines.push(`  {${DIM_COLOR}-fg}... and ${event.consequences.length - 5} more consequences{/}`);
    }

    return lines;
  }

  /**
   * Render participants mode (expanded view of all involved entities).
   */
  private renderParticipantsMode(event: WorldEvent, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Participants ===');
    lines.push('');
    lines.push(...this.renderWhoInvolved(event, context));
    return lines;
  }

  /**
   * Render cascade mode (cause-effect chain view).
   */
  private renderCascadeMode(event: WorldEvent, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Cascade Chain ===');
    lines.push('');

    // Show causes
    if (event.causes.length > 0) {
      lines.push('{bold}CAUSES:{/bold}');
      lines.push(...this.renderWhatBefore(event, context));
      lines.push('');
    }

    // Show the event itself
    lines.push('{bold}THIS EVENT:{/bold}');
    const desc = (event.data as Record<string, unknown>)['description'];
    const description = typeof desc === 'string' ? desc : event.subtype;
    lines.push(`  >>> ${description} <<<`);
    lines.push('');

    // Show consequences
    if (event.consequences.length > 0) {
      lines.push('{bold}CONSEQUENCES:{/bold}');
      lines.push(...this.renderWhatFollowed(event, context));
    }

    return lines;
  }

  /**
   * Render details mode (all sections expanded).
   */
  private renderDetailsMode(event: WorldEvent, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('=== Full Event Details ===');
    lines.push('');

    const allSections = ['what-happened', 'who-involved', 'where-when', 'why-matters', 'what-before', 'what-followed'];

    for (const sectionId of allSections) {
      const title = sectionId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      lines.push(`--- ${title} ---`);
      lines.push(...this.renderSection(sectionId, event, context));
      lines.push('');
    }

    return lines;
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

  /**
   * Get entity type icon for a given entity.
   */
  private getEntityTypeIcon(entityId: EntityId, context: RenderContext): string {
    const { world } = context;

    if (world.hasStore('Attribute') && world.getComponent(entityId, 'Attribute') !== undefined) {
      return '@';
    }
    if (world.hasStore('Territory') && world.getComponent(entityId, 'Territory') !== undefined) {
      return '&';
    }
    if (world.hasStore('Position') && world.hasStore('Population')) {
      const pos = world.getComponent(entityId, 'Position');
      const pop = world.getComponent(entityId, 'Population');
      if (pos !== undefined && pop !== undefined) {
        return '#';
      }
    }

    return '*';
  }
}
