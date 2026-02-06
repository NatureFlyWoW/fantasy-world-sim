/**
 * Personal event narrative templates.
 * Covers: birth, death, marriage, betrayal, friendship, achievement, romance, feud
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const personalTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // BIRTH
  // ============================================================================

  {
    id: 'personal.birth.epic.low',
    category: EventCategory.Personal,
    subtype: 'birth',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'A child was born to the family, continuing the line.',
    requiredContext: [],
  },
  {
    id: 'personal.birth.epic.high',
    category: EventCategory.Personal,
    subtype: 'birth',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'Into the world came {character.name}, heir to {faction.name}. The realm rejoiced at the birth, for the succession was secured. Little did they know the mark this child would leave upon history.',
    requiredContext: [],
  },
  {
    id: 'personal.birth.personal.high',
    category: EventCategory.Personal,
    subtype: 'birth',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'When the cry of the newborn filled the chamber, {character.name} wept with joy. {pronoun.subject} held the tiny life in {pronoun.possessive} arms and made silent promises. This child would know love. This child would be protected. No matter the cost.',
    requiredContext: [],
  },
  {
    id: 'personal.birth.myth.high',
    category: EventCategory.Personal,
    subtype: 'birth',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The night {character.name} was born, a new star appeared in the heavens. The seers whispered of destiny, of a life touched by forces beyond mortal ken. The child\'s cry echoed through planes unseen.',
    requiredContext: [],
  },

  // ============================================================================
  // DEATH
  // ============================================================================

  {
    id: 'personal.death.epic.low',
    category: EventCategory.Personal,
    subtype: 'death',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: '{character.name} passed from this world, their time having come at last.',
    requiredContext: [],
  },
  {
    id: 'personal.death.epic.medium',
    category: EventCategory.Personal,
    subtype: 'death',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The passing of {character.name} was mourned throughout {faction.name}. {pronoun.subject} had lived a life of consequence, and {pronoun.possessive} absence would be felt for years to come.',
    requiredContext: [],
  },
  {
    id: 'personal.death.epic.high',
    category: EventCategory.Personal,
    subtype: 'death',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'And so passed {character.name}, whose name was written large in the annals of {faction.name}. The realm mourned as one, for a giant had fallen. {pronoun.possessive} deeds would be remembered when the stones of {site.name} had crumbled to dust.',
    requiredContext: [],
  },
  {
    id: 'personal.death.personal.high',
    category: EventCategory.Personal,
    subtype: 'death',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'In the end, {character.name} faced death with the same courage {pronoun.subject} had shown in life. {pronoun.subject} thought of those {pronoun.subject} was leaving behind, of words left unsaid and paths not taken. Then {pronoun.subject} closed {pronoun.possessive} eyes and let go.',
    requiredContext: [],
  },
  {
    id: 'personal.death.myth.high',
    category: EventCategory.Personal,
    subtype: 'death',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'When {character.name} drew {pronoun.possessive} final breath, the very air seemed to still. It is said that the gods themselves paused to honor the passing of one who had walked so close to divinity while still mortal.',
    requiredContext: [],
  },

  // ============================================================================
  // MARRIAGE
  // ============================================================================

  {
    id: 'personal.marriage.epic.low',
    category: EventCategory.Personal,
    subtype: 'marriage',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: '{character.name} was wed in a ceremony attended by family and close allies.',
    requiredContext: [],
  },
  {
    id: 'personal.marriage.epic.high',
    category: EventCategory.Personal,
    subtype: 'marriage',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The union of {character.name} was celebrated across the realm. Lords and ladies gathered at {site.name} to witness the joining of great houses. This marriage would shape the political landscape for a generation.',
    requiredContext: [],
  },
  {
    id: 'personal.marriage.personal.high',
    category: EventCategory.Personal,
    subtype: 'marriage',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'As {character.name} spoke the vows, {pronoun.possessive} heart was full to bursting. All the scheming, all the politics—none of it mattered in this moment. {pronoun.subject} looked into the eyes of {pronoun.possessive} beloved and saw the future.',
    requiredContext: [],
  },
  {
    id: 'personal.marriage.intrigue.high',
    category: EventCategory.Personal,
    subtype: 'marriage',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The marriage represented a carefully negotiated alliance. Both families had assessed the political advantages, and the union cemented bonds that would prove strategically valuable in the conflicts to come.',
    requiredContext: [],
  },

  // ============================================================================
  // BETRAYAL
  // ============================================================================

  {
    id: 'personal.betrayal.epic.high',
    category: EventCategory.Personal,
    subtype: 'betrayal',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The betrayal of {character.name} would be spoken of in whispers for generations. One who had been trusted above all others turned against their lord, and the consequences would shake the very foundations of {faction.name}.',
    requiredContext: [],
  },
  {
    id: 'personal.betrayal.personal.high',
    category: EventCategory.Personal,
    subtype: 'betrayal',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'The knife went in, and with it, {character.name}\'s faith in everything {pronoun.subject} had believed. {pronoun.subject} stared into the face of one {pronoun.subject} had trusted, searching for some explanation. There was none to be found.',
    requiredContext: [],
  },
  {
    id: 'personal.betrayal.intrigue.high',
    category: EventCategory.Personal,
    subtype: 'betrayal',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The defection represented a calculated gambit. Years of building trust had been leveraged for a single, devastating strike. The betrayer had assessed the risks and rewards and found the latter more compelling.',
    requiredContext: [],
  },

  // ============================================================================
  // FRIENDSHIP
  // ============================================================================

  {
    id: 'personal.friendship.epic.medium',
    category: EventCategory.Personal,
    subtype: 'friendship',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The bond between {character.name} and their companion would prove unbreakable. Forged in shared trials, it would endure until the end of their days.',
    requiredContext: [],
  },
  {
    id: 'personal.friendship.personal.medium',
    category: EventCategory.Personal,
    subtype: 'friendship',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} found in {pronoun.possessive} friend something {pronoun.subject} had never known {pronoun.subject} was missing. Here was someone who understood, who accepted, who would stand beside {pronoun.object} against any storm.',
    requiredContext: [],
  },

  // ============================================================================
  // ACHIEVEMENT
  // ============================================================================

  {
    id: 'personal.achievement.epic.high',
    category: EventCategory.Personal,
    subtype: 'achievement',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} accomplished what none had achieved before. The feat would be remembered as a turning point, proof that mortal will could overcome any obstacle.',
    requiredContext: [],
  },
  {
    id: 'personal.achievement.personal.high',
    category: EventCategory.Personal,
    subtype: 'achievement',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'When it was done, {character.name} stood in silence for a long moment. All the years of struggle, all the sacrifices—it had led here. {pronoun.subject} had done it. {pronoun.subject} had actually done it.',
    requiredContext: [],
  },
  {
    id: 'personal.achievement.myth.high',
    category: EventCategory.Personal,
    subtype: 'achievement',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The deed of {character.name} echoed through the planes. Mortal hands had touched the divine, and the world was forever changed. Songs would be sung of this achievement until the end of days.',
    requiredContext: [],
  },

  // ============================================================================
  // ROMANCE
  // ============================================================================

  {
    id: 'personal.romance.personal.medium',
    category: EventCategory.Personal,
    subtype: 'romance',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'Love came to {character.name} unexpectedly. {pronoun.subject} had thought {pronoun.possessive} heart closed to such things, but here was someone who made {pronoun.object} feel alive in ways {pronoun.subject} had forgotten were possible.',
    requiredContext: [],
  },
  {
    id: 'personal.romance.epic.high',
    category: EventCategory.Personal,
    subtype: 'romance',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The love of {character.name} would become the stuff of legend. Poets would sing of their devotion, and generations hence, lovers would invoke their names as paragons of true affection.',
    requiredContext: [],
  },

  // ============================================================================
  // FEUD
  // ============================================================================

  {
    id: 'personal.feud.epic.medium',
    category: EventCategory.Personal,
    subtype: 'feud',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'A bitter enmity grew between {character.name} and their rival. What had begun as simple disagreement festered into hatred that would consume both their houses.',
    requiredContext: [],
  },
  {
    id: 'personal.feud.personal.high',
    category: EventCategory.Personal,
    subtype: 'feud',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} could not forgive. Every time {pronoun.subject} closed {pronoun.possessive} eyes, {pronoun.subject} saw what had been done. The hatred burned like a fire in {pronoun.possessive} chest, consuming everything else. {pronoun.subject} would have {pronoun.possessive} revenge, no matter the cost.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'personal.default.epic',
    category: EventCategory.Personal,
    subtype: 'default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'A significant event occurred in the life of {character.name}.',
    requiredContext: [],
  },
  {
    id: 'personal.default.personal',
    category: EventCategory.Personal,
    subtype: 'default',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 0, max: 100 },
    template: '{character.name} experienced something that would change {pronoun.object}.',
    requiredContext: [],
  },
];
