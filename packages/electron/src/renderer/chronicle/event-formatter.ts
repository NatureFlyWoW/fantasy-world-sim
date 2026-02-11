import type { SerializedEvent } from '../../shared/types.js';

export type SignificanceTier = 'trivial' | 'minor' | 'moderate' | 'major' | 'critical' | 'legendary';

export interface FormattedEvent {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly categoryColor: string;
  readonly significanceTier: SignificanceTier;
  readonly timestamp: string;
  readonly entityIds: readonly number[];
}

export const CATEGORY_ICONS: Record<string, string> = {
  Political: '\u269C',
  Military: '\u2694',
  Magical: '\u2726',
  Cultural: '\u266B',
  Religious: '\u271D',
  Economic: '\u2696',
  Personal: '\u2660',
  Disaster: '\u2620',
  Scientific: '\u2604',
  Exploratory: '\u2609',
};

export const CATEGORY_COLORS: Record<string, string> = {
  Political: '#FFDD44',
  Military: '#FF4444',
  Magical: '#CC44FF',
  Cultural: '#44DDFF',
  Religious: '#FFAAFF',
  Economic: '#44FF88',
  Personal: '#88AAFF',
  Disaster: '#FF6600',
  Scientific: '#00FFCC',
  Exploratory: '#88FF44',
};

export const SIGNIFICANCE_THRESHOLDS: ReadonlyArray<{
  readonly min: number;
  readonly tier: SignificanceTier;
  readonly color: string;
}> = [
  { min: 95, tier: 'legendary', color: '#FF00FF' },
  { min: 80, tier: 'critical', color: '#FF2222' },
  { min: 60, tier: 'major', color: '#FF8844' },
  { min: 40, tier: 'moderate', color: '#CCCC44' },
  { min: 20, tier: 'minor', color: '#888888' },
  { min: 0, tier: 'trivial', color: '#666666' },
];

export const SUBTYPE_VERB_MAP: Record<string, string> = {
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
  'faction.treaty_expired': 'A treaty expired between {0} and {1}',
  'faction.coup_attempt': '{0} staged a coup attempt',
  'faction.coup_success': 'A coup succeeded in {0}',
  'faction.coup_failed': 'A coup attempt failed in {0}',
  'faction.reform_movement': 'A reform movement arose in {0}',
  'faction.war_declared': '{0} declared war on {1}',
  'battle.resolved': 'A battle was fought',
  'war.declared': '{0} declared war on {1}',
  'war.ended': 'The war between {0} and {1} ended',
  'siege.began': '{0} laid siege',
  'siege.ended': 'The siege ended',
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
  'magic.research_complete': 'Magical research was completed',
  'magic.institution_tension': 'Tensions rose in a magical institution',
  'magic.schism': 'A magical schism occurred',
  'magic.artifact_influence': 'An artifact exerted its influence',
  'magic.artifact_created': 'A magical artifact was created',
  'magic.catastrophe_ended': 'A magical catastrophe ended',
  'magic.catastrophe_contained': 'A magical catastrophe was contained',
  'magic.persecution_threat': 'Mages faced persecution',
  'religion.intervention': 'A divine intervention occurred',
  'religion.schism': 'A religious schism occurred',
  'religion.prophet_arose': 'A prophet arose',
  'religion.saint_recognized': 'A saint was recognized',
  'religion.syncretism': 'Religions blended together',
  'economy.trade_exclusivity_violated': 'A trade exclusivity pact was violated',
  'economy.market_crash': 'A market crash occurred',
  'economy.trade_route_opened': 'A new trade route opened',
  'ecology.resource_critical': 'Resources reached critical levels',
  'ecology.resource_depleted': 'Resources were depleted',
  'ecology.event_recovered': 'An environment recovered',
  'ecology.territory_expanded': 'Creature territory expanded',
  'ecology.invasive_spread': 'Invasive species spread',
};

export const SHORT_NARRATIVE_MAP: Record<string, string> = {
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
  'faction.treaty_expired': 'An old accord crumbles to dust',
  'faction.coup_attempt': 'Ambition challenges the throne',
  'faction.coup_success': 'Power changes hands in a single night',
  'faction.coup_failed': 'A bid for power meets its end',
  'faction.reform_movement': 'The people demand change',
  'faction.war_declared': 'Drums of war sound across borders',
  'battle.resolved': 'Steel clashes upon the field',
  'war.declared': 'Nations gird for war',
  'war.ended': 'The last sword is sheathed',
  'siege.began': 'Walls are surrounded and tested',
  'siege.ended': 'The siege reaches its conclusion',
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
  'magic.research_complete': 'Arcane secrets are unlocked',
  'magic.institution_tension': 'Rivalries simmer among the learned',
  'magic.schism': 'Wizards split over doctrine',
  'magic.artifact_influence': 'An artifact exerts its will',
  'magic.artifact_created': 'A new wonder enters the world',
  'magic.catastrophe_ended': 'Magical chaos subsides at last',
  'magic.catastrophe_contained': 'Desperate wards hold back disaster',
  'magic.persecution_threat': 'Suspicion turns against the gifted',
  'religion.intervention': 'The divine hand reaches into mortal affairs',
  'religion.schism': 'Faith fractures along doctrinal lines',
  'religion.prophet_arose': 'A voice cries out with divine authority',
  'religion.saint_recognized': 'Holiness is recognized and honored',
  'religion.syncretism': 'Faiths blend into something new',
  'economy.trade_exclusivity_violated': 'A trade pact is broken',
  'economy.market_crash': 'Fortune turns to ruin overnight',
  'economy.trade_route_opened': 'Commerce finds new pathways',
  'ecology.resource_critical': 'Resources dwindle to alarming levels',
  'ecology.resource_depleted': 'The land is stripped bare',
  'ecology.event_recovered': 'Nature slowly reclaims its balance',
  'ecology.territory_expanded': 'Wild creatures press into settled lands',
  'ecology.invasive_spread': 'Foreign species overrun the native',
};

/**
 * Get significance tier from numeric significance value.
 */
export function getSignificanceTier(sig: number): SignificanceTier {
  for (const threshold of SIGNIFICANCE_THRESHOLDS) {
    if (sig >= threshold.min) {
      return threshold.tier;
    }
  }
  return 'trivial';
}

/**
 * Get significance color from numeric significance value.
 */
export function getSignificanceColor(sig: number): string {
  for (const threshold of SIGNIFICANCE_THRESHOLDS) {
    if (sig >= threshold.min) {
      return threshold.color;
    }
  }
  return '#666666';
}

/**
 * Humanize a subtype string by taking the last segment, replacing underscores with spaces,
 * and capitalizing the first letter.
 */
function humanizeSubtype(subtype: string): string {
  const parts = subtype.split('.');
  const lastPart = parts[parts.length - 1];
  if (lastPart === undefined) {
    return subtype;
  }
  const words = lastPart.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Substitute placeholders {0}, {1}, etc. with entity names from participants.
 */
function substitutePlaceholders(template: string, participants: readonly number[], getName: (id: number) => string): string {
  let result = template;
  for (let i = 0; i < participants.length; i++) {
    const participantId = participants[i];
    if (participantId !== undefined) {
      const placeholder = `{${i}}`;
      const name = getName(participantId);
      result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), name);
    }
  }
  // Remove any unresolved placeholders
  result = result.replace(/\{\d+\}/g, '');
  return result;
}

/**
 * Format a SerializedEvent into a display-ready FormattedEvent with full descriptions.
 */
export function formatEvent(event: SerializedEvent, getName: (id: number) => string): FormattedEvent {
  const icon = CATEGORY_ICONS[event.category] ?? '?';
  const categoryColor = CATEGORY_COLORS[event.category] ?? '#888888';
  const significanceTier = getSignificanceTier(event.significance);

  const year = Math.floor(event.tick / 360) + 1;
  const day = (event.tick % 360) + 1;
  const timestamp = `Year ${year}, Day ${day}`;

  const entityIds = event.participants;

  // Title: prefer narrative engine prose, fallback to SHORT_NARRATIVE_MAP, then humanized subtype
  const title = (event.narrativeTitle.length > 0 ? event.narrativeTitle : undefined)
    ?? SHORT_NARRATIVE_MAP[event.subtype]
    ?? humanizeSubtype(event.subtype);

  // Description: prefer narrative engine prose, fallback to verb template, data.description, humanized subtype
  let description = '';
  if (event.narrativeBody.length > 0) {
    description = event.narrativeBody;
  } else {
    const verbTemplate = SUBTYPE_VERB_MAP[event.subtype];
    if (verbTemplate !== undefined) {
      description = substitutePlaceholders(verbTemplate, event.participants, getName);
    } else if (typeof event.data === 'object' && event.data !== null && 'description' in event.data && typeof event.data.description === 'string') {
      description = event.data.description;
    } else {
      description = humanizeSubtype(event.subtype);
    }
  }

  return {
    title,
    description,
    icon,
    categoryColor,
    significanceTier,
    timestamp,
    entityIds,
  };
}

/**
 * Format a SerializedEvent into a compact FormattedEvent (title uses verb template, empty description).
 */
export function formatEventCompact(event: SerializedEvent, getName: (id: number) => string): FormattedEvent {
  const icon = CATEGORY_ICONS[event.category] ?? '?';
  const categoryColor = CATEGORY_COLORS[event.category] ?? '#888888';
  const significanceTier = getSignificanceTier(event.significance);

  const year = Math.floor(event.tick / 360) + 1;
  const day = (event.tick % 360) + 1;
  const timestamp = `Year ${year}, Day ${day}`;

  const entityIds = event.participants;

  // Title: use verb template for compact mode
  let title = '';
  const verbTemplate = SUBTYPE_VERB_MAP[event.subtype];
  if (verbTemplate !== undefined) {
    title = substitutePlaceholders(verbTemplate, event.participants, getName);
  } else {
    title = humanizeSubtype(event.subtype);
  }

  return {
    title,
    description: '',
    icon,
    categoryColor,
    significanceTier,
    timestamp,
    entityIds,
  };
}
