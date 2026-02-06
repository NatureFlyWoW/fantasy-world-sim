/**
 * Economic event narrative templates.
 * Covers: boom, bust, monopoly, trade route, innovation, famine, resource discovery
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const economicTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // BOOM
  // ============================================================================

  {
    id: 'economic.boom.epic.medium',
    category: EventCategory.Economic,
    subtype: 'boom',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'Prosperity came to {site.name}. Trade flourished, coffers filled, and the people knew a time of plenty that would be remembered fondly in leaner years.',
    requiredContext: [],
  },
  {
    id: 'economic.boom.epic.high',
    category: EventCategory.Economic,
    subtype: 'boom',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A golden age of commerce dawned across {faction.name}. Merchants grew wealthy beyond dreaming, and even the common folk enjoyed luxuries once reserved for nobles. The economic expansion would reshape the very structure of society.',
    requiredContext: [],
  },
  {
    id: 'economic.boom.intrigue.high',
    category: EventCategory.Economic,
    subtype: 'boom',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The economic boom created new centers of power. Merchant families rose to challenge traditional aristocracy, and the flow of coin reshaped political alliances. Those who controlled the new wealth controlled the future.',
    requiredContext: [],
  },
  {
    id: 'economic.boom.scholarly.medium',
    category: EventCategory.Economic,
    subtype: 'boom',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Economic indicators from this period suggest sustained growth across multiple sectors. Trade records document increased volume and diversification of goods exchanged.',
    requiredContext: [],
  },

  // ============================================================================
  // BUST
  // ============================================================================

  {
    id: 'economic.bust.epic.high',
    category: EventCategory.Economic,
    subtype: 'bust',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great collapse came without warning. Markets crashed, fortunes vanished overnight, and the proud merchants of yesterday became the beggars of tomorrow. The realm would spend generations recovering from the devastation.',
    requiredContext: [],
  },
  {
    id: 'economic.bust.personal.high',
    category: EventCategory.Economic,
    subtype: 'bust',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} watched {pronoun.possessive} life\'s work crumble to nothing. The numbers that had meant wealth now meant ruin. {pronoun.subject} had gambled everything on tomorrow, and tomorrow had betrayed {pronoun.object}.',
    requiredContext: [],
  },
  {
    id: 'economic.bust.intrigue.high',
    category: EventCategory.Economic,
    subtype: 'bust',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The economic collapse was not entirely accidental. Certain parties had positioned themselves to profit from the chaos, and as the dust settled, new powers emerged from the wreckage of the old order.',
    requiredContext: [],
  },

  // ============================================================================
  // MONOPOLY
  // ============================================================================

  {
    id: 'economic.monopoly.intrigue.high',
    category: EventCategory.Economic,
    subtype: 'monopoly',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'Control of the vital trade was consolidated into a single hand. Competitors were absorbed or eliminated, and the resulting monopoly gave its holders leverage that rivaled royal power.',
    requiredContext: [],
  },
  {
    id: 'economic.monopoly.epic.medium',
    category: EventCategory.Economic,
    subtype: 'monopoly',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} established dominance over the trade, becoming the sole source for essential goods. Those who wished to buy had no choice but to pay {pronoun.possessive} price.',
    requiredContext: [],
  },

  // ============================================================================
  // TRADE ROUTE
  // ============================================================================

  {
    id: 'economic.trade_route.epic.high',
    category: EventCategory.Economic,
    subtype: 'trade_route',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A new trade route was established, connecting distant lands and bringing exotic goods to hungry markets. Caravans laden with treasure wound their way across the realm, and the settlements along the route grew rich.',
    requiredContext: [],
  },
  {
    id: 'economic.trade_route.epic.medium',
    category: EventCategory.Economic,
    subtype: 'trade_route',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'Trade flourished along the new route between {site.name} and distant markets. Merchants found profit, and the flow of goods enriched all involved.',
    requiredContext: [],
  },
  {
    id: 'economic.trade_route.scholarly.medium',
    category: EventCategory.Economic,
    subtype: 'trade_route',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Archaeological evidence confirms the establishment of regular trade during this period. Distribution of goods indicates active commercial networks spanning considerable distances.',
    requiredContext: [],
  },

  // ============================================================================
  // INNOVATION
  // ============================================================================

  {
    id: 'economic.innovation.epic.high',
    category: EventCategory.Economic,
    subtype: 'innovation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A revolutionary new method of production transformed the industry. What had taken teams of craftsmen could now be done faster and cheaper. The old ways faded as the new proved irresistible.',
    requiredContext: [],
  },
  {
    id: 'economic.innovation.personal.medium',
    category: EventCategory.Economic,
    subtype: 'innovation',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} saw the potential where others saw only complications. With {pronoun.possessive} new approach, {pronoun.subject} could produce more at lower cost. The old guild masters scoffed—but they wouldn\'t be scoffing for long.',
    requiredContext: [],
  },

  // ============================================================================
  // FAMINE
  // ============================================================================

  {
    id: 'economic.famine.epic.high',
    category: EventCategory.Economic,
    subtype: 'famine',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great famine swept across {faction.name}. Crops failed, livestock perished, and the people starved. The suffering would leave scars on the collective memory that would not fade for generations.',
    requiredContext: [],
  },
  {
    id: 'economic.famine.personal.high',
    category: EventCategory.Economic,
    subtype: 'famine',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} looked at the empty granaries and felt {pronoun.possessive} stomach clench with more than hunger. The people were depending on {pronoun.object}, and {pronoun.subject} had nothing to give them. {pronoun.subject} would have to choose who ate and who starved.',
    requiredContext: [],
  },
  {
    id: 'economic.famine.myth.high',
    category: EventCategory.Economic,
    subtype: 'famine',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The gods had turned their faces from the land, and the earth refused to yield its bounty. The people prayed and sacrificed, but the heavens remained silent. Dark times had come, and none knew when they would end.',
    requiredContext: [],
  },

  // ============================================================================
  // RESOURCE DISCOVERY
  // ============================================================================

  {
    id: 'economic.resource_discovery.epic.high',
    category: EventCategory.Economic,
    subtype: 'resource_discovery',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'Beneath the hills of {site.name}, a great treasure was discovered. The wealth drawn from the earth would transform the region, attracting fortune-seekers from across the realm and shifting the balance of power.',
    requiredContext: [],
  },
  {
    id: 'economic.resource_discovery.epic.medium',
    category: EventCategory.Economic,
    subtype: 'resource_discovery',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'New resources were discovered near {site.name}. Extraction began immediately, and the local economy adjusted to the newfound wealth.',
    requiredContext: [],
  },
  {
    id: 'economic.resource_discovery.intrigue.high',
    category: EventCategory.Economic,
    subtype: 'resource_discovery',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The discovery immediately became the subject of intense political maneuvering. Multiple factions claimed rights to the resource, and what had seemed a blessing threatened to become a source of conflict.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'economic.default.epic',
    category: EventCategory.Economic,
    subtype: 'default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'An economic development of note occurred within {faction.name}.',
    requiredContext: [],
  },
  {
    id: 'economic.default.intrigue',
    category: EventCategory.Economic,
    subtype: 'default',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 0, max: 100 },
    template: 'Economic factors shifted the balance of power.',
    requiredContext: [],
  },
];
