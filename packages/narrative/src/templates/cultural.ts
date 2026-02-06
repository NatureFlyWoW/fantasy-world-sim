/**
 * Cultural event narrative templates.
 * Covers: artistic movement, technology invention, philosophy school, language change, oral tradition mutation
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const culturalTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // ARTISTIC MOVEMENT
  // ============================================================================

  {
    id: 'cultural.artistic_movement.epic.medium',
    category: EventCategory.Cultural,
    subtype: 'artistic_movement',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'A new artistic movement emerged from {site.name}, challenging established conventions and inspiring a generation of creators. The influence would spread far beyond its origins.',
    requiredContext: [],
  },
  {
    id: 'cultural.artistic_movement.epic.high',
    category: EventCategory.Cultural,
    subtype: 'artistic_movement',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The artistic revolution that began in {site.name} would reshape culture across the realm. Old masters were swept aside as young visionaries redefined beauty itself. Centuries hence, this would be remembered as a golden age.',
    requiredContext: [],
  },
  {
    id: 'cultural.artistic_movement.personal.high',
    category: EventCategory.Cultural,
    subtype: 'artistic_movement',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} looked at {pronoun.possessive} work and knew {pronoun.subject} had created something new. The old rules no longer applied—{pronoun.subject} had broken free of them. Others would follow, {pronoun.subject} knew. {pronoun.subject} had started something that could not be stopped.',
    requiredContext: [],
  },
  {
    id: 'cultural.artistic_movement.scholarly.medium',
    category: EventCategory.Cultural,
    subtype: 'artistic_movement',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'The artistic movement that emerged during this period represented a significant departure from established aesthetic principles. Analysis of surviving works reveals common thematic and stylistic elements.',
    requiredContext: [],
  },

  // ============================================================================
  // TECHNOLOGY INVENTION
  // ============================================================================

  {
    id: 'cultural.technology_invention.epic.high',
    category: EventCategory.Cultural,
    subtype: 'technology_invention',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The invention of {character.name} would transform civilization. What had once been impossible became commonplace, and the world adapted to a new reality. Progress, once measured in generations, now moved at breathtaking speed.',
    requiredContext: [],
  },
  {
    id: 'cultural.technology_invention.epic.medium',
    category: EventCategory.Cultural,
    subtype: 'technology_invention',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'A significant technological advance was achieved, improving upon existing methods and opening new possibilities for those who adopted it.',
    requiredContext: [],
  },
  {
    id: 'cultural.technology_invention.scholarly.high',
    category: EventCategory.Cultural,
    subtype: 'technology_invention',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'This technological innovation represents a crucial development in the material culture of the period. Archaeological evidence confirms rapid adoption across multiple regions, suggesting significant practical advantages.',
    requiredContext: [],
  },
  {
    id: 'cultural.technology_invention.personal.high',
    category: EventCategory.Cultural,
    subtype: 'technology_invention',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'Years of failed attempts, of ridicule and doubt—and now {character.name} held the working model in {pronoun.possessive} hands. It worked. {pronoun.subject} had done what everyone said was impossible. The world would change, and {pronoun.subject} had changed it.',
    requiredContext: [],
  },

  // ============================================================================
  // PHILOSOPHY SCHOOL
  // ============================================================================

  {
    id: 'cultural.philosophy_school.epic.high',
    category: EventCategory.Cultural,
    subtype: 'philosophy_school',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The philosophical teachings of {character.name} attracted followers from across the realm. {pronoun.possessive} ideas challenged fundamental assumptions about existence, knowledge, and virtue, and the debates they sparked would shape thought for ages.',
    requiredContext: [],
  },
  {
    id: 'cultural.philosophy_school.scholarly.high',
    category: EventCategory.Cultural,
    subtype: 'philosophy_school',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'The philosophical school founded during this period made significant contributions to epistemology and ethics. Primary texts reveal a sophisticated argumentative structure and engagement with prior traditions.',
    requiredContext: [],
  },
  {
    id: 'cultural.philosophy_school.personal.medium',
    category: EventCategory.Cultural,
    subtype: 'philosophy_school',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} gathered {pronoun.possessive} students and spoke of truth and meaning. Not all understood, but those who did found their worldviews transformed. {pronoun.subject} was teaching them not what to think, but how.',
    requiredContext: [],
  },

  // ============================================================================
  // LANGUAGE CHANGE
  // ============================================================================

  {
    id: 'cultural.language_change.epic.medium',
    category: EventCategory.Cultural,
    subtype: 'language_change',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The tongue of {faction.name} evolved, adopting new words and abandoning old forms. The speech of grandchildren would sound foreign to their ancestors.',
    requiredContext: [],
  },
  {
    id: 'cultural.language_change.scholarly.high',
    category: EventCategory.Cultural,
    subtype: 'language_change',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'Linguistic analysis of texts from this period reveals significant phonological and lexical shifts. The documented changes suggest extensive contact with neighboring language communities and subsequent creolization.',
    requiredContext: [],
  },

  // ============================================================================
  // ORAL TRADITION MUTATION
  // ============================================================================

  {
    id: 'cultural.oral_tradition.epic.medium',
    category: EventCategory.Cultural,
    subtype: 'oral_tradition',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The old stories changed in the telling, as they always had. Heroes grew greater, villains more monstrous, and the truths at the heart of the tales shifted to reflect new concerns.',
    requiredContext: [],
  },
  {
    id: 'cultural.oral_tradition.myth.high',
    category: EventCategory.Cultural,
    subtype: 'oral_tradition',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The legends grew in power with each retelling. What had begun as mere history transformed into myth, and the heroes of old ascended to stand beside the gods themselves in the stories of the people.',
    requiredContext: [],
  },
  {
    id: 'cultural.oral_tradition.scholarly.medium',
    category: EventCategory.Cultural,
    subtype: 'oral_tradition',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Comparison of variant traditions reveals significant narrative drift over time. Key elements persisted while details adapted to local contexts and contemporary concerns.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'cultural.default.epic',
    category: EventCategory.Cultural,
    subtype: 'default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'A cultural development of note occurred within {faction.name}.',
    requiredContext: [],
  },
  {
    id: 'cultural.default.scholarly',
    category: EventCategory.Cultural,
    subtype: 'default',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 0, max: 100 },
    template: 'Cultural changes during this period are documented in available sources.',
    requiredContext: [],
  },
];
