/**
 * Event formatter for rendering WorldEvents as text.
 * Provides raw format, significance bar, and participant resolution.
 */

import { EventCategory, ticksToWorldTime } from '@fws/core';
import type { WorldEvent, World, WorldClock, EntityId } from '@fws/core';
import type { EntityResolver } from '@fws/narrative';
import { CATEGORY_COLORS, getSignificanceColor } from '../theme.js';

/**
 * Category icons for display.
 */
export const CATEGORY_ICONS: Readonly<Record<EventCategory, string>> = {
  [EventCategory.Political]: '\u269C',  // ⚜
  [EventCategory.Military]: '\u2694',   // ⚔
  [EventCategory.Magical]: '\u2726',    // ✦
  [EventCategory.Cultural]: '\u266B',   // ♫
  [EventCategory.Religious]: '\u271D',  // ✝
  [EventCategory.Economic]: '\u2696',   // ⚖
  [EventCategory.Personal]: '\u2660',   // ♠
  [EventCategory.Disaster]: '\u2620',   // ☠
  [EventCategory.Scientific]: '\u2604', // ☄
  [EventCategory.Exploratory]: '\u2609', // ☉
} as const;

/**
 * Filled and empty block characters for significance bar.
 */
const FILLED_BLOCK = '\u2588'; // █
const EMPTY_BLOCK = '\u2591';  // ░

/**
 * Width of the significance bar in characters.
 */
const SIGNIFICANCE_BAR_WIDTH = 10;

/**
 * Subtype-to-verb mapping for human-readable event descriptions.
 * Maps "domain.action" subtypes to verb patterns.
 * {0} = first participant, {1} = second participant, {loc} = location.
 */
const SUBTYPE_VERB_MAP: Readonly<Record<string, string>> = {
  // Character AI actions (Personal)
  'character.befriend': '{0} befriended {1}',
  'character.betray': '{0} betrayed {1}',
  'character.intimidate': '{0} intimidated {1}',
  'character.show_mercy': '{0} showed mercy',
  'character.negotiate_treaty': '{0} negotiated a treaty with {1}',
  'character.forge_alliance': '{0} forged an alliance with {1}',
  'character.rally_troops': '{0} rallied troops',
  'character.plan_campaign': '{0} planned a campaign',
  'character.study_lore': '{0} studied ancient lore',
  'character.experiment': '{0} conducted an experiment',
  'character.craft_item': '{0} crafted an item',
  'character.journey': '{0} set out on a journey',
  'character.trade': '{0} struck a trade deal',
  'character.steal': '{0} committed theft',
  'character.pray': '{0} prayed at the shrine',
  'character.proselytize': '{0} spread the faith',
  'character.research_spell': '{0} researched a new spell',
  'character.enchant_item': '{0} enchanted an item',
  'character.forage': '{0} foraged for supplies',
  'character.flee': '{0} fled from danger',
  'character.seek_healing': '{0} sought healing',
  'character.dream': '{0} dreamed vividly',

  // Faction / Political events
  'faction.treaty_expired': 'A treaty expired between {0} and {1}',
  'faction.coup_attempt': '{0} staged a coup attempt',
  'faction.coup_success': 'A coup succeeded in {0}',
  'faction.coup_failed': 'A coup attempt failed in {0}',
  'faction.reform_movement': 'A reform movement arose in {0}',
  'faction.war_declared': '{0} declared war on {1}',

  // Military / Warfare
  'battle.resolved': 'A battle was fought',
  'war.declared': '{0} declared war on {1}',
  'war.ended': 'The war between {0} and {1} ended',
  'siege.began': '{0} laid siege',
  'siege.ended': 'The siege ended',

  // Cultural
  'culture.technology_invented': 'A new technology was invented',
  'culture.technology_spread': 'Technology spread to new regions',
  'culture.technology_suppressed': 'Technology was suppressed',
  'culture.masterwork_created': 'A masterwork was created',
  'culture.artistic_movement_born': 'An artistic movement was born',
  'culture.movement_spread': 'A cultural movement spread',
  'culture.movement_ended': 'A cultural movement faded',
  'culture.philosophy_founded': 'A new philosophy was founded',
  'culture.philosophy_faded': 'A philosophy faded from prominence',
  'culture.language_imposed': 'A language was imposed',
  'culture.loan_words_adopted': 'Loan words were adopted',
  'culture.dialect_became_language': 'A dialect became a language',
  'culture.language_died': 'A language died out',
  'culture.tradition_recorded': 'An oral tradition was recorded',

  // Magic
  'magic.research_complete': 'Magical research was completed',
  'magic.institution_tension': 'Tensions rose in a magical institution',
  'magic.schism': 'A magical schism occurred',
  'magic.artifact_influence': 'An artifact exerted its influence',
  'magic.artifact_created': 'A magical artifact was created',
  'magic.catastrophe_ended': 'A magical catastrophe ended',
  'magic.catastrophe_contained': 'A magical catastrophe was contained',
  'magic.persecution_threat': 'Mages faced persecution',

  // Religion
  'religion.intervention': 'A divine intervention occurred',
  'religion.schism': 'A religious schism occurred',
  'religion.prophet_arose': 'A prophet arose',
  'religion.saint_recognized': 'A saint was recognized',
  'religion.syncretism': 'Religions blended together',

  // Economy
  'economy.trade_exclusivity_violated': 'A trade exclusivity pact was violated',
  'economy.market_crash': 'A market crash occurred',
  'economy.trade_route_opened': 'A new trade route opened',

  // Ecology / Disaster
  'ecology.resource_critical': 'Resources reached critical levels',
  'ecology.resource_depleted': 'Resources were depleted',
  'ecology.event_recovered': 'An environment recovered',
  'ecology.territory_expanded': 'Creature territory expanded',
  'ecology.invasive_spread': 'Invasive species spread',
};

/**
 * Name color for blessed tags. Entity names rendered in this color
 * to indicate they are inspectable.
 */
export const ENTITY_NAME_COLOR = '#88AAFF';

/**
 * EventFormatter provides methods to format WorldEvents for display.
 */
export class EventFormatter {
  private resolver: EntityResolver | null = null;

  /**
   * Set the entity resolver for name resolution.
   */
  setEntityResolver(resolver: EntityResolver): void {
    this.resolver = resolver;
  }

  /**
   * Get the current entity resolver.
   */
  getEntityResolver(): EntityResolver | null {
    return this.resolver;
  }

  /**
   * Format an event as a raw log line.
   * Format: "Year 1247, Day 23: [icon] Event description"
   */
  formatRaw(event: WorldEvent, _clock: WorldClock): string {
    const time = ticksToWorldTime(event.timestamp);
    const icon = CATEGORY_ICONS[event.category];
    const description = this.getEventDescription(event);

    return `Year ${time.year}, Day ${time.day}: ${icon} ${description}`;
  }

  /**
   * Format an event as a raw log line with color codes for blessed.
   */
  formatRawColored(event: WorldEvent, _clock: WorldClock): string {
    const time = ticksToWorldTime(event.timestamp);
    const icon = CATEGORY_ICONS[event.category];
    const color = CATEGORY_COLORS[event.category];
    const description = this.getEventDescription(event);

    return `{${color}-fg}Year ${time.year}, Day ${time.day}: ${icon} ${description}{/}`;
  }

  /**
   * Format a significance bar.
   * Produces: "█████░░░░░ 50" with colored blocks.
   */
  formatSignificanceBar(significance: number): string {
    const clamped = Math.max(0, Math.min(100, significance));
    const filledCount = Math.round((clamped / 100) * SIGNIFICANCE_BAR_WIDTH);
    const emptyCount = SIGNIFICANCE_BAR_WIDTH - filledCount;

    const filled = FILLED_BLOCK.repeat(filledCount);
    const empty = EMPTY_BLOCK.repeat(emptyCount);

    return `${filled}${empty} ${Math.round(clamped)}`;
  }

  /**
   * Format a significance bar with color codes for blessed.
   */
  formatSignificanceBarColored(significance: number): string {
    const clamped = Math.max(0, Math.min(100, significance));
    const filledCount = Math.round((clamped / 100) * SIGNIFICANCE_BAR_WIDTH);
    const emptyCount = SIGNIFICANCE_BAR_WIDTH - filledCount;

    const color = getSignificanceColor(clamped);
    const filled = FILLED_BLOCK.repeat(filledCount);
    const empty = EMPTY_BLOCK.repeat(emptyCount);

    return `{${color}-fg}${filled}{/}{#666666-fg}${empty}{/} ${Math.round(clamped)}`;
  }

  /**
   * Format event participants as a string.
   * Resolves entity IDs to names using the World.
   */
  formatParticipants(event: WorldEvent, world: World): string {
    if (event.participants.length === 0) {
      return 'No participants';
    }

    const names = event.participants.map(id => this.resolveEntityName(id, world));

    if (names.length === 1) {
      return names[0] ?? 'Unknown';
    }

    if (names.length === 2) {
      return `${names[0] ?? 'Unknown'} and ${names[1] ?? 'Unknown'}`;
    }

    const allButLast = names.slice(0, -1).join(', ');
    const last = names[names.length - 1] ?? 'Unknown';
    return `${allButLast}, and ${last}`;
  }

  /**
   * Format the event location if available.
   */
  formatLocation(event: WorldEvent, world: World): string | null {
    if (event.location === undefined) {
      return null;
    }

    const name = this.resolveEntityName(event.location, world);
    return `at ${name}`;
  }

  /**
   * Get a human-readable description of an event.
   * If an EntityResolver is set, resolves participant names and uses
   * verb patterns from SUBTYPE_VERB_MAP for readable prose.
   * Falls back to the old domain:action format without a resolver.
   */
  getEventDescription(event: WorldEvent): string {
    // Check if event.data has a description field
    const data = event.data as Record<string, unknown>;
    if (typeof data['description'] === 'string') {
      // If we have a resolver, try to enhance the description with names
      if (this.resolver !== null && event.participants.length > 0) {
        return this.enhanceDescription(data['description'], event);
      }
      return data['description'];
    }

    // Try verb-pattern approach if resolver is available
    if (this.resolver !== null) {
      const verbResult = this.formatWithVerbPattern(event);
      if (verbResult !== null) {
        return verbResult;
      }
    }

    // Fallback: build description from subtype
    const parts = event.subtype.split('.');
    if (parts.length >= 2) {
      const domain = parts[0];
      const action = parts.slice(1).join(' ').replace(/_/g, ' ');
      return `${this.capitalize(domain ?? '')}: ${action}`;
    }

    return event.subtype.replace(/_/g, ' ');
  }

  /**
   * Resolve an entity ID to a name using the EntityResolver.
   * Tries character → faction → site → artifact resolution in order.
   */
  resolveEntityIdToName(entityId: number): string | null {
    if (this.resolver === null) return null;

    const asChar = this.resolver.resolveCharacter(entityId);
    if (asChar !== undefined) return asChar.name;

    const asFaction = this.resolver.resolveFaction(entityId);
    if (asFaction !== undefined) return asFaction.name;

    const asSite = this.resolver.resolveSite(entityId);
    if (asSite !== undefined) return asSite.name;

    const asArtifact = this.resolver.resolveArtifact(entityId);
    if (asArtifact !== undefined) return asArtifact.name;

    return null;
  }

  /**
   * Format an event using the verb pattern map.
   * Returns null if no pattern matches or resolution fails.
   */
  private formatWithVerbPattern(event: WorldEvent): string | null {
    const pattern = SUBTYPE_VERB_MAP[event.subtype];
    if (pattern === undefined) return null;

    // Resolve participant names
    const participantNames: string[] = [];
    for (const id of event.participants) {
      const name = this.resolveEntityIdToName(id as unknown as number);
      participantNames.push(name ?? `Entity #${id}`);
    }

    // Also check event.data for named entities
    const data = event.data as Record<string, unknown>;
    if (participantNames.length === 0 && typeof data['factionName'] === 'string') {
      participantNames.push(data['factionName']);
    }

    // Substitute {0}, {1}, etc. with participant names
    let result = pattern;
    for (let i = 0; i < participantNames.length; i++) {
      const name = participantNames[i];
      if (name !== undefined) {
        result = result.replace(`{${i}}`, name);
      }
    }

    // Resolve location if pattern uses {loc}
    if (result.includes('{loc}') && event.location !== undefined) {
      const locName = this.resolveEntityIdToName(event.location as unknown as number);
      if (locName !== null) {
        result = result.replace('{loc}', locName);
      }
    }

    // Clean up unresolved placeholders — remove them gracefully
    result = result.replace(/\s*\{[0-9]+\}/g, '');
    result = result.replace(/\s*\{loc\}/g, '');

    // Clean up trailing prepositions left by removed placeholders
    result = result.replace(/\s+(with|to|on|at|from|in)\s*$/i, '');

    return result;
  }

  /**
   * Enhance an existing description string by prepending participant name.
   */
  private enhanceDescription(description: string, event: WorldEvent): string {
    if (event.participants.length === 0) return description;

    const firstName = this.resolveEntityIdToName(event.participants[0] as unknown as number);
    if (firstName === null) return description;

    // Avoid duplicating the name if description already starts with it
    if (description.startsWith(firstName)) return description;

    // For short generic descriptions, prepend the name
    return `${firstName}: ${description}`;
  }

  /**
   * Get the category color for an event.
   */
  getCategoryColor(event: WorldEvent): string {
    return CATEGORY_COLORS[event.category];
  }

  /**
   * Get the significance color for an event.
   */
  getSignificanceColor(event: WorldEvent): string {
    return getSignificanceColor(event.significance);
  }

  /**
   * Resolve an entity ID to a display name.
   */
  private resolveEntityName(entityId: EntityId | number, world: World): string {
    // Try EntityResolver first
    const resolvedName = this.resolveEntityIdToName(entityId as number);
    if (resolvedName !== null) return resolvedName;

    // Cast to EntityId for component lookup
    const id = entityId as EntityId;

    // Try to get a name from the Status component (titles)
    if (world.hasStore('Status')) {
      const status = world.getComponent(id, 'Status');
      if (status !== undefined) {
        const titles = (status as { titles?: string[] }).titles;
        if (titles !== undefined && titles.length > 0) {
          const title = titles[0];
          if (title !== undefined) {
            return title;
          }
        }
      }
    }

    // Fallback to "Entity #ID"
    return `Entity #${entityId}`;
  }

  /**
   * Capitalize the first letter of a string.
   */
  private capitalize(str: string): string {
    if (str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Default formatter instance.
 */
export const defaultFormatter = new EventFormatter();
