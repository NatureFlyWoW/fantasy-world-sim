/**
 * Population and settlement lifecycle narrative templates.
 * Covers: migration, settlement founding, tier progression, abandonment,
 * population milestones, promotion, and natural death.
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const populationTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // MIGRATION
  // ============================================================================

  {
    id: 'population.migration.epic.low',
    category: EventCategory.Personal,
    subtype: 'migration',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'A small group departed {site.name}, seeking better fortune elsewhere.',
    requiredContext: [],
  },
  {
    id: 'population.migration.epic.medium',
    category: EventCategory.Personal,
    subtype: 'migration',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'A caravan of {data.migrantCount} souls left {site.name} behind, their wagons laden with what meager possessions they could carry. They journeyed toward new lands, hoping to find what their homeland could no longer provide.',
    requiredContext: [],
  },
  {
    id: 'population.migration.epic.high',
    category: EventCategory.Personal,
    subtype: 'migration',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great exodus from {site.name} would be remembered for generations. {data.migrantCount} people — families, tradesmen, farmers — abandoned the place of their birth. It was not courage that drove them forth, but desperation, and the faint promise of something better beyond the horizon.',
    requiredContext: [],
  },
  {
    id: 'population.migration.personal.medium',
    category: EventCategory.Personal,
    subtype: 'migration',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'They gathered what they could in the cold hours before dawn. Children clutched at their parents\' cloaks as the caravan formed. No one spoke of why they were leaving — everyone already knew.',
    requiredContext: [],
  },
  {
    id: 'population.migration.myth.high',
    category: EventCategory.Personal,
    subtype: 'migration',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'Like the ancient wanderers of legend, the people of {site.name} took up the pilgrim\'s road. The gods themselves seemed to weep as {data.migrantCount} faithful departed, casting long shadows across the empty streets they left behind.',
    requiredContext: [],
  },
  {
    id: 'population.migration.political.medium',
    category: EventCategory.Personal,
    subtype: 'migration',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 41, max: 70 },
    template: 'The departure of {data.migrantCount} residents from {site.name} sent ripples through the local power structure. Fewer hands meant fewer taxes, fewer soldiers, fewer votes in the council. Those who remained watched the exodus with calculating eyes.',
    requiredContext: [],
  },
  {
    id: 'population.migration.scholarly.low',
    category: EventCategory.Personal,
    subtype: 'migration',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 0, max: 40 },
    template: 'Migration records indicate {data.migrantCount} individuals relocated from {site.name} during this period, likely driven by economic or security factors common to settlements of this size.',
    requiredContext: [],
  },

  // ============================================================================
  // SETTLEMENT FOUNDING
  // ============================================================================

  {
    id: 'population.founded.epic.medium',
    category: EventCategory.Personal,
    subtype: 'founded',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'Where once there was only wilderness, {data.pioneerCount} pioneers drove their stakes into the earth and declared a new settlement born. {data.newSettlementName} would grow from these humble beginnings.',
    requiredContext: [],
  },
  {
    id: 'population.founded.epic.high',
    category: EventCategory.Personal,
    subtype: 'founded',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'From the overcrowded streets of {data.sourceName}, a brave company of {data.pioneerCount} ventured forth to found {data.newSettlementName}. They cleared the land, raised walls, and planted crops. A new chapter in the history of these lands had begun.',
    requiredContext: [],
  },
  {
    id: 'population.founded.personal.medium',
    category: EventCategory.Personal,
    subtype: 'founded',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'The first night was the hardest. {data.pioneerCount} families huddled around hastily built fires, listening to the unfamiliar sounds of their new home. But by morning, determination had replaced fear, and the work of building began.',
    requiredContext: [],
  },
  {
    id: 'population.founded.myth.high',
    category: EventCategory.Personal,
    subtype: 'founded',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The seers spoke of it as destiny — that the land itself called to the {data.pioneerCount} souls who would become its first guardians. {data.newSettlementName} was not merely founded; it was summoned into being by the will of the earth.',
    requiredContext: [],
  },
  {
    id: 'population.founded.scholarly.medium',
    category: EventCategory.Personal,
    subtype: 'founded',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Historical records mark the founding of {data.newSettlementName} by {data.pioneerCount} settlers from {data.sourceName}. Population pressure in the parent settlement appears to have been the primary catalyst for this expansion.',
    requiredContext: [],
  },

  // ============================================================================
  // TIER PROGRESSION
  // ============================================================================

  {
    id: 'population.tier_change.epic.low',
    category: EventCategory.Personal,
    subtype: 'tier_change',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: '{data.settlementName} grew steadily, its status rising from {data.previousTier} to {data.newTier}.',
    requiredContext: [],
  },
  {
    id: 'population.tier_change.epic.medium',
    category: EventCategory.Personal,
    subtype: 'tier_change',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'With {data.population} souls now dwelling within its bounds, {data.settlementName} could no longer be called a mere {data.previousTier}. New walls were raised, a market square laid out, and the settlement was formally recognized as a {data.newTier}.',
    requiredContext: [],
  },
  {
    id: 'population.tier_change.epic.high',
    category: EventCategory.Personal,
    subtype: 'tier_change',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The rise of {data.settlementName} to the rank of {data.newTier} was a triumph of ambition and industry. Where {data.population} people had gathered, civilization flourished. From its former status as a humble {data.previousTier}, it had become a beacon of prosperity.',
    requiredContext: [],
  },
  {
    id: 'population.tier_change.personal.medium',
    category: EventCategory.Personal,
    subtype: 'tier_change',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'The oldest residents of {data.settlementName} remembered when it was nothing but a {data.previousTier}. Now, watching the bustle of {data.population} neighbors going about their daily lives, they marveled at how far they had come.',
    requiredContext: [],
  },
  {
    id: 'population.tier_change.scholarly.medium',
    category: EventCategory.Personal,
    subtype: 'tier_change',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Census records confirm {data.settlementName}\'s reclassification from {data.previousTier} to {data.newTier}, reflecting a population of {data.population}. This growth pattern is consistent with the settlement\'s economic trajectory.',
    requiredContext: [],
  },
  {
    id: 'population.tier_change.decline.epic.medium',
    category: EventCategory.Personal,
    subtype: 'tier_change',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'Once a proud {data.previousTier}, {data.settlementName} had diminished. With only {data.population} souls remaining, it was now reckoned no more than a {data.newTier}. The empty buildings stood as monuments to what had been.',
    requiredContext: [],
  },

  // ============================================================================
  // ABANDONMENT
  // ============================================================================

  {
    id: 'population.abandoned.epic.medium',
    category: EventCategory.Personal,
    subtype: 'abandoned',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'After {data.yearsInDecline} years of dwindling fortunes, the last inhabitants of {data.settlementName} departed. The settlement fell silent, claimed by the wild, and passed into the realm of ruins and memory.',
    requiredContext: [],
  },
  {
    id: 'population.abandoned.epic.high',
    category: EventCategory.Personal,
    subtype: 'abandoned',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'And so {data.settlementName} was no more. The last {data.population} residents scattered to the winds after {data.yearsInDecline} years of slow decline. What had once been a place of life and purpose was now a ruin, its stories preserved only in the memories of those who had called it home.',
    requiredContext: [],
  },
  {
    id: 'population.abandoned.personal.medium',
    category: EventCategory.Personal,
    subtype: 'abandoned',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'The last family to leave {data.settlementName} paused at the gate and looked back. There was nothing left to stay for — the wells had gone dry, the fields lay fallow, and the neighbors had all gone. They turned their backs and walked away, and did not look back again.',
    requiredContext: [],
  },
  {
    id: 'population.abandoned.myth.high',
    category: EventCategory.Personal,
    subtype: 'abandoned',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The spirits of {data.settlementName} mourned as the last mortal footsteps faded from its streets. For {data.yearsInDecline} years the place had withered, and now the ancient guardians of the land reclaimed what had been borrowed. Vines crept through windows. Roots split foundations. The earth remembered its own.',
    requiredContext: [],
  },
  {
    id: 'population.abandoned.scholarly.medium',
    category: EventCategory.Personal,
    subtype: 'abandoned',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'After approximately {data.yearsInDecline} years of sustained population decline, {data.settlementName} was formally abandoned. The remaining {data.population} residents dispersed to neighboring settlements. The site now stands as ruins, potentially of archaeological interest.',
    requiredContext: [],
  },

  // ============================================================================
  // PROMOTION (Non-notable → Notable)
  // ============================================================================

  {
    id: 'population.promotion.epic.medium',
    category: EventCategory.Personal,
    subtype: 'promotion',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'From humble origins as a {data.profession}, {data.name} rose to prominence. {data.backstory}. The annals would remember this one.',
    requiredContext: [],
  },
  {
    id: 'population.promotion.epic.high',
    category: EventCategory.Personal,
    subtype: 'promotion',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'There are those born to greatness and those who seize it. {data.name}, once a common {data.profession}, proved to be among the latter. Through {data.sparkCount} remarkable events — {data.backstory} — this figure emerged from obscurity to take a place among the notable figures of the age.',
    requiredContext: [],
  },
  {
    id: 'population.promotion.personal.medium',
    category: EventCategory.Personal,
    subtype: 'promotion',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{data.name} had always been different from the other {data.profession}s. Perhaps it was the way {data.backstory}. Whatever the cause, the community began to take notice, and whispers of this remarkable individual spread.',
    requiredContext: [],
  },
  {
    id: 'population.promotion.personal.high',
    category: EventCategory.Personal,
    subtype: 'promotion',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'It was said that {data.name} never sought fame. A {data.profession} by trade, {data.name} simply lived — but lived in such a way that others could not help but notice. {data.backstory}. In time, the name was spoken with respect in councils and taverns alike.',
    requiredContext: [],
  },
  {
    id: 'population.promotion.myth.high',
    category: EventCategory.Personal,
    subtype: 'promotion',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The fates had marked {data.name} for distinction. Though born to the humble craft of {data.profession}, destiny wove a grander tapestry. {data.backstory}. When the stars aligned, the commoner shed the cloak of anonymity and stepped into legend.',
    requiredContext: [],
  },
  {
    id: 'population.promotion.scholarly.medium',
    category: EventCategory.Personal,
    subtype: 'promotion',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Records indicate that {data.name}, previously employed as a {data.profession}, achieved notable status through a series of {data.sparkCount} distinguishing events: {data.backstory}. Notability assessment: {data.notabilityScore}.',
    requiredContext: [],
  },

  // ============================================================================
  // NATURAL DEATH
  // ============================================================================

  {
    id: 'population.natural_death.epic.low',
    category: EventCategory.Personal,
    subtype: 'natural_death',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: '{data.name} of {site.name} passed away peacefully at the age of {data.age}.',
    requiredContext: [],
  },
  {
    id: 'population.natural_death.epic.medium',
    category: EventCategory.Personal,
    subtype: 'natural_death',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'After {data.age} years of life, {data.name} the {data.profession} breathed {data.name}\'s last. The community mourned a soul who had been part of the fabric of {site.name} for as long as many could remember.',
    requiredContext: [],
  },
  {
    id: 'population.natural_death.personal.medium',
    category: EventCategory.Personal,
    subtype: 'natural_death',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'They found {data.name} in the morning, still and at peace. {data.age} years — a full life by any measure. The neighbors came to pay their respects, each carrying a memory of kindness given or received.',
    requiredContext: [],
  },
  {
    id: 'population.natural_death.scholarly.low',
    category: EventCategory.Personal,
    subtype: 'natural_death',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 0, max: 40 },
    template: 'Death record: {data.name}, {data.profession}, age {data.age}. Cause: natural. Location: {site.name}.',
    requiredContext: [],
  },
];
