/**
 * Event formatter for rendering WorldEvents as text.
 * Provides raw format, significance bar, and participant resolution.
 */

import { EventCategory, ticksToWorldTime } from '@fws/core';
import type { WorldEvent, World, WorldClock, EntityId } from '@fws/core';
import type { EntityResolver } from '@fws/narrative';
import { CATEGORY_COLORS, getSignificanceColor, getSignificanceLevel } from '../theme.js';

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
 * Short narrative one-liners for event subtypes.
 * Used in dashboard and event list for atmospheric descriptions.
 */
const SHORT_NARRATIVE_MAP: Readonly<Record<string, string>> = {
  // Character AI actions
  'character.befriend': 'New bonds of friendship are forged',
  'character.trade': 'Merchants exchange wares at the crossroads',
  'character.craft_item': 'Skilled hands shape raw materials into something new',
  'character.study_lore': 'Ancient texts reveal forgotten knowledge',
  'character.pray': 'A soul seeks divine guidance',
  'character.journey': 'A traveler sets forth into the unknown',
  'character.experiment': 'Arcane forces are tested in secret',
  'character.steal': 'Shadowed hands claim what is not theirs',
  'character.proselytize': 'The faithful spread their creed',
  'character.research_spell': 'Mysteries of the arcane unfold',
  'character.enchant_item': 'Magic is bound into mortal craft',
  'character.forage': 'The wilds yield their bounty',
  'character.flee': 'Danger drives the desperate to flight',
  'character.seek_healing': 'The wounded seek restoration',
  'character.dream': 'Visions stir in restless slumber',
  'character.betray': 'Trust shatters like glass',
  'character.intimidate': 'Fear becomes a weapon',
  'character.show_mercy': 'Compassion stays the hand of judgment',
  'character.negotiate_treaty': 'Words forge what swords cannot',
  'character.forge_alliance': 'Former strangers unite under common cause',
  'character.rally_troops': 'A war cry echoes across the field',
  'character.plan_campaign': 'Strategy takes shape in the war room',

  // Faction / Political
  'faction.treaty_expired': 'An old accord crumbles to dust',
  'faction.coup_attempt': 'Ambition challenges the throne',
  'faction.coup_success': 'Power changes hands in a single night',
  'faction.coup_failed': 'A bid for power meets its end',
  'faction.reform_movement': 'The people demand change',
  'faction.war_declared': 'Drums of war sound across borders',

  // Military
  'battle.resolved': 'Steel clashes upon the field',
  'war.declared': 'Nations gird for war',
  'war.ended': 'The last sword is sheathed',
  'siege.began': 'Walls are surrounded and tested',
  'siege.ended': 'The siege reaches its conclusion',

  // Cultural
  'culture.technology_invented': 'Innovation reshapes the possible',
  'culture.technology_spread': 'Knowledge crosses borders',
  'culture.technology_suppressed': 'Progress is met with resistance',
  'culture.masterwork_created': 'A work of surpassing beauty emerges',
  'culture.artistic_movement_born': 'A new vision inspires the creative spirit',
  'culture.movement_spread': 'Cultural currents flow to new shores',
  'culture.movement_ended': 'An artistic era quietly fades',
  'culture.philosophy_founded': 'A new way of thinking takes root',
  'culture.philosophy_faded': 'Old wisdom passes from memory',
  'culture.language_imposed': 'A tongue is forced upon the conquered',
  'culture.loan_words_adopted': 'Languages mingle and evolve',
  'culture.dialect_became_language': 'A dialect finds its own voice',
  'culture.language_died': 'The last speaker falls silent',
  'culture.tradition_recorded': 'Oral tradition is committed to the page',

  // Magic
  'magic.research_complete': 'Arcane secrets are unlocked',
  'magic.institution_tension': 'Rivalries simmer among the learned',
  'magic.schism': 'Wizards split over doctrine',
  'magic.artifact_influence': 'An artifact exerts its will',
  'magic.artifact_created': 'A new wonder enters the world',
  'magic.catastrophe_ended': 'Magical chaos subsides at last',
  'magic.catastrophe_contained': 'Desperate wards hold back disaster',
  'magic.persecution_threat': 'Suspicion turns against the gifted',

  // Religion
  'religion.intervention': 'The divine hand reaches into mortal affairs',
  'religion.schism': 'Faith fractures along doctrinal lines',
  'religion.prophet_arose': 'A voice cries out with divine authority',
  'religion.saint_recognized': 'Holiness is recognized and honored',
  'religion.syncretism': 'Faiths blend into something new',

  // Economy
  'economy.trade_exclusivity_violated': 'A trade pact is broken',
  'economy.market_crash': 'Fortune turns to ruin overnight',
  'economy.trade_route_opened': 'Commerce finds new pathways',

  // Ecology / Disaster
  'ecology.resource_critical': 'Resources dwindle to alarming levels',
  'ecology.resource_depleted': 'The land is stripped bare',
  'ecology.event_recovered': 'Nature slowly reclaims its balance',
  'ecology.territory_expanded': 'Wild creatures press into settled lands',
  'ecology.invasive_spread': 'Foreign species overrun the native',
};

/**
 * Significance word labels for display.
 */
export const SIGNIFICANCE_LABELS: Readonly<Record<string, string>> = {
  trivial: 'Trivial',
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
  critical: 'Critical',
  legendary: 'Legendary',
};

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
   * Shows colored bar + word label instead of numeric value.
   */
  formatSignificanceBarColored(significance: number): string {
    const clamped = Math.max(0, Math.min(100, significance));
    const filledCount = Math.round((clamped / 100) * SIGNIFICANCE_BAR_WIDTH);
    const emptyCount = SIGNIFICANCE_BAR_WIDTH - filledCount;

    const color = getSignificanceColor(clamped);
    const filled = FILLED_BLOCK.repeat(filledCount);
    const empty = EMPTY_BLOCK.repeat(emptyCount);
    const label = this.getSignificanceLabel(clamped);

    return `{${color}-fg}${filled}{/}{#666666-fg}${empty}{/} {${color}-fg}${label}{/}`;
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
   * Get a short narrative one-liner for an event.
   * Uses SHORT_NARRATIVE_MAP for atmospheric descriptions.
   * Falls back to enhanced description or subtype parsing.
   */
  getShortNarrative(event: WorldEvent): string {
    // Try short narrative map first
    const narrative = SHORT_NARRATIVE_MAP[event.subtype];
    if (narrative !== undefined) {
      return narrative;
    }

    // Try resolver-based description
    if (this.resolver !== null) {
      const verbResult = this.formatWithVerbPattern(event);
      if (verbResult !== null) {
        return verbResult;
      }
    }

    // Try event.data description
    const data = event.data as Record<string, unknown>;
    if (typeof data['description'] === 'string') {
      return data['description'];
    }

    // Final fallback: humanize subtype
    const parts = event.subtype.split('.');
    if (parts.length >= 2) {
      const action = parts.slice(1).join(' ').replace(/_/g, ' ');
      return action.charAt(0).toUpperCase() + action.slice(1);
    }

    return event.subtype.replace(/_/g, ' ');
  }

  /**
   * Get a word label for a significance value.
   */
  getSignificanceLabel(significance: number): string {
    const level = getSignificanceLevel(significance);
    const label = SIGNIFICANCE_LABELS[level];
    return label ?? 'Unknown';
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
