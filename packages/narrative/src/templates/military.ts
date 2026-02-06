/**
 * Military event narrative templates.
 * Covers: battle, siege, campaign, retreat, surrender, heroic stand, army movement, recruitment
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const militaryTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // BATTLE
  // ============================================================================

  // Epic Historical
  {
    id: 'military.battle.epic.low',
    category: EventCategory.Military,
    subtype: 'battle',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'A skirmish occurred near {site.name}. The engagement was brief, with few casualties on either side.',
    requiredContext: [],
  },
  {
    id: 'military.battle.epic.medium',
    category: EventCategory.Military,
    subtype: 'battle',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The armies clashed upon the fields near {site.name}. {#if event.data.victorious}{character.name} carried the day{#else}{character.name} was forced to withdraw{/if}, though the cost in blood was not insignificant.',
    requiredContext: [],
  },
  {
    id: 'military.battle.epic.high',
    category: EventCategory.Military,
    subtype: 'battle',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The Battle of {site.name} would be remembered for generations. When the sun rose, two great hosts faced each other across the blood-soaked earth. When it set, one remained standing. {#if event.data.victorious}{character.name} had won a victory that would echo through the ages.{#else}Despite valiant effort, {character.name} was defeated, and the realm trembled.{/if}',
    requiredContext: [],
  },

  // Personal Character Focus
  {
    id: 'military.battle.personal.high',
    category: EventCategory.Military,
    subtype: 'battle',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'In the chaos of battle, {character.name} fought with desperate fury. All around {pronoun.object}, soldiers fell and steel rang against steel. {pronoun.subject} could taste blood and dust, feel the burning in {pronoun.possessive} arms. When at last the horns sounded, {pronoun.subject} was still standing. But looking at the field of corpses, {pronoun.subject} wondered if this was truly victory.',
    requiredContext: [],
  },
  {
    id: 'military.battle.personal.medium',
    category: EventCategory.Military,
    subtype: 'battle',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name}\'s sword arm ached, but {pronoun.subject} would not falter. {pronoun.possessive} soldiers looked to {pronoun.object} for strength, and {pronoun.subject} would not fail them.',
    requiredContext: [],
  },

  // Mythological
  {
    id: 'military.battle.myth.high',
    category: EventCategory.Military,
    subtype: 'battle',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The earth itself groaned beneath the weight of the armies that clashed at {site.name}. Heroes of legend walked the field that day, their deeds worthy of the gods themselves. {character.name} strode through the carnage like a force of nature, and lesser mortals fell before {pronoun.object}.',
    requiredContext: [],
  },

  // Political Intrigue
  {
    id: 'military.battle.intrigue.medium',
    category: EventCategory.Military,
    subtype: 'battle',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 41, max: 70 },
    template: 'The engagement at {site.name} was as much a test of logistics and alliance management as martial prowess. {#if event.data.victorious}The victor\'s supply lines held while the enemy\'s coalition fractured.{#else}Critical allies failed to appear at the decisive moment.{/if}',
    requiredContext: [],
  },

  // Scholarly
  {
    id: 'military.battle.scholarly.high',
    category: EventCategory.Military,
    subtype: 'battle',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'The Battle of {site.name} represents a significant case study in military tactics of the period. Contemporary accounts, while sometimes contradictory, suggest that {#if event.data.victorious}superior positioning and morale contributed to the victory{#else}logistical failures and overconfidence led to the defeat{/if}.',
    requiredContext: [],
  },

  // ============================================================================
  // SIEGE
  // ============================================================================

  {
    id: 'military.siege.epic.high',
    category: EventCategory.Military,
    subtype: 'siege',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'For weeks, the armies of {faction.name} encircled {site.name}. Within the walls, {character.name} held firm, though supplies dwindled and hope faded. {#if event.data.victorious}At last, the siege was broken, and the defenders emerged triumphant.{#else}In the end, the walls fell, and with them, the dreams of a generation.{/if}',
    requiredContext: [],
  },
  {
    id: 'military.siege.personal.high',
    category: EventCategory.Military,
    subtype: 'siege',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'Day after day, {character.name} walked the walls of {site.name}, watching the enemy camp grow. The people looked to {pronoun.object} with desperate hope, and {pronoun.subject} could not let them see {pronoun.possessive} own despair. {pronoun.subject} rationed the last of the food, spoke words of courage {pronoun.subject} did not feel, and prayed for relief that might never come.',
    requiredContext: [],
  },
  {
    id: 'military.siege.intrigue.medium',
    category: EventCategory.Military,
    subtype: 'siege',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 41, max: 70 },
    template: 'The siege of {site.name} became a test of political will as much as military strength. Secret negotiations proceeded even as trebuchets hurled stones at the walls.',
    requiredContext: [],
  },

  // ============================================================================
  // CAMPAIGN
  // ============================================================================

  {
    id: 'military.campaign.epic.high',
    category: EventCategory.Military,
    subtype: 'campaign',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great campaign of {character.name} swept across the land like a storm. City after city fell before the advancing host. The military genius displayed would be studied by commanders for centuries to come.',
    requiredContext: [],
  },
  {
    id: 'military.campaign.scholarly.high',
    category: EventCategory.Military,
    subtype: 'campaign',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'The campaign undertaken by {character.name} demonstrates sophisticated understanding of both logistics and strategic initiative. Analysis of the operational tempo suggests careful planning and superior intelligence gathering.',
    requiredContext: [],
  },

  // ============================================================================
  // RETREAT
  // ============================================================================

  {
    id: 'military.retreat.epic.medium',
    category: EventCategory.Military,
    subtype: 'retreat',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'With bitter resolve, {character.name} ordered the retreat. The army withdrew in good order, preserving its strength for battles yet to come.',
    requiredContext: [],
  },
  {
    id: 'military.retreat.personal.medium',
    category: EventCategory.Military,
    subtype: 'retreat',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'The order to retreat was the hardest {character.name} had ever given. {pronoun.subject} watched {pronoun.possessive} soldiers\' faces as they turned from the enemy, saw the shame and relief mingled there. {pronoun.subject} shared both feelings.',
    requiredContext: [],
  },

  // ============================================================================
  // SURRENDER
  // ============================================================================

  {
    id: 'military.surrender.epic.high',
    category: EventCategory.Military,
    subtype: 'surrender',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'At {site.name}, {character.name} laid down {pronoun.possessive} sword and bent the knee. The war was over. A proud army had been brought low, and the realm would never be the same.',
    requiredContext: [],
  },
  {
    id: 'military.surrender.personal.high',
    category: EventCategory.Military,
    subtype: 'surrender',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name}\'s hand trembled as {pronoun.subject} offered {pronoun.possessive} sword. {pronoun.subject} had led these soldiers, promised them victory, and now {pronoun.subject} led them into captivity. The shame burned worse than any wound.',
    requiredContext: [],
  },

  // ============================================================================
  // HEROIC STAND
  // ============================================================================

  {
    id: 'military.heroic_stand.epic.high',
    category: EventCategory.Military,
    subtype: 'heroic_stand',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'Against impossible odds, {character.name} and a handful of warriors held the pass at {site.name}. Wave after wave of enemies broke upon their shields. Though they fell at last, their sacrifice bought precious time and earned immortal glory.',
    requiredContext: [],
  },
  {
    id: 'military.heroic_stand.myth.high',
    category: EventCategory.Military,
    subtype: 'heroic_stand',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The gods themselves looked down upon {site.name} that day. {character.name} stood like a titan of old, and the very earth seemed to rise in {pronoun.possessive} defense. Legends would speak of this stand until the stars grew cold.',
    requiredContext: [],
  },

  // ============================================================================
  // ARMY MOVEMENT
  // ============================================================================

  {
    id: 'military.army_movement.epic.low',
    category: EventCategory.Military,
    subtype: 'army_movement',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'The forces of {faction.name} marched toward {site.name}, their banners catching the wind.',
    requiredContext: [],
  },
  {
    id: 'military.army_movement.intrigue.medium',
    category: EventCategory.Military,
    subtype: 'army_movement',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 41, max: 70 },
    template: 'The repositioning of forces sent a clear message to neighboring powers. The troop movements were carefully calculated to project strength without committing to open hostilities.',
    requiredContext: [],
  },

  // ============================================================================
  // RECRUITMENT
  // ============================================================================

  {
    id: 'military.recruitment.epic.medium',
    category: EventCategory.Military,
    subtype: 'recruitment',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} raised the banner of {faction.name}, calling upon all loyal subjects to take up arms. From farm and forge they came, swelling the ranks of the host.',
    requiredContext: [],
  },
  {
    id: 'military.recruitment.personal.medium',
    category: EventCategory.Military,
    subtype: 'recruitment',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} looked into the faces of the new recruits—farmers, blacksmiths, merchants who had never held a sword. {pronoun.subject} would make soldiers of them, or watch them die trying.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'military.default.epic',
    category: EventCategory.Military,
    subtype: 'default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'Military action was undertaken by the forces of {faction.name}.',
    requiredContext: [],
  },
  {
    id: 'military.default.personal',
    category: EventCategory.Military,
    subtype: 'default',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 0, max: 100 },
    template: '{character.name} led {pronoun.possessive} soldiers into action.',
    requiredContext: [],
  },
];
