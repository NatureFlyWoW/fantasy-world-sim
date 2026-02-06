/**
 * Secret event narrative templates.
 * Covers: revelation, conspiracy discovered, identity exposed, prophecy fulfilled
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

// Note: Secret events map to EventCategory.Personal since there's no Secret category
// We use 'secret.' prefix in subtype to distinguish them

export const secretTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // REVELATION
  // ============================================================================

  {
    id: 'secret.revelation.epic.high',
    category: EventCategory.Personal,
    subtype: 'secret.revelation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A secret long hidden was at last revealed. The truth, when it emerged, shook the foundations of all that had been believed. Nothing would ever be quite the same again.',
    requiredContext: [],
  },
  {
    id: 'secret.revelation.personal.high',
    category: EventCategory.Personal,
    subtype: 'secret.revelation',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'The truth struck {character.name} like a physical blow. All these years, all these lies—and now, finally, {pronoun.subject} understood. The betrayal was complete, but so was {pronoun.possessive} knowledge. {pronoun.subject} would never be fooled again.',
    requiredContext: [],
  },
  {
    id: 'secret.revelation.intrigue.high',
    category: EventCategory.Personal,
    subtype: 'secret.revelation',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The revelation upended the political order. Alliances that had seemed solid collapsed overnight as the truth spread through the courts. Those who had traded in secrets suddenly found themselves exposed.',
    requiredContext: [],
  },
  {
    id: 'secret.revelation.myth.high',
    category: EventCategory.Personal,
    subtype: 'secret.revelation',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The veil was lifted, and mortals glimpsed truths that had been hidden since the dawn of time. The revelation changed the very understanding of the world, connecting past and present in ways that few could comprehend.',
    requiredContext: [],
  },

  // ============================================================================
  // CONSPIRACY DISCOVERED
  // ============================================================================

  {
    id: 'secret.conspiracy.epic.high',
    category: EventCategory.Personal,
    subtype: 'secret.conspiracy',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The conspiracy was exposed, its members dragged into the light. What had been whispered in shadows was now proclaimed from the rooftops. Justice—or vengeance—would follow.',
    requiredContext: [],
  },
  {
    id: 'secret.conspiracy.intrigue.high',
    category: EventCategory.Personal,
    subtype: 'secret.conspiracy',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The discovery of the conspiracy sent shockwaves through the establishment. Networks of loyalty and obligation were exposed, and many who had thought themselves secure found their positions suddenly precarious.',
    requiredContext: [],
  },
  {
    id: 'secret.conspiracy.personal.high',
    category: EventCategory.Personal,
    subtype: 'secret.conspiracy',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} stared at the evidence in {pronoun.possessive} hands. Names {pronoun.subject} had trusted, faces {pronoun.subject} had loved—all of them part of a web of deceit. {pronoun.subject} felt {pronoun.possessive} world crumbling around {pronoun.object}.',
    requiredContext: [],
  },

  // ============================================================================
  // IDENTITY EXPOSED
  // ============================================================================

  {
    id: 'secret.identity.epic.high',
    category: EventCategory.Personal,
    subtype: 'secret.identity',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The true identity was revealed at last. One who had walked among them as one thing was now known to be another entirely. The revelation would reshape relationships and rewrite histories.',
    requiredContext: [],
  },
  {
    id: 'secret.identity.personal.high',
    category: EventCategory.Personal,
    subtype: 'secret.identity',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'The mask fell, and {character.name}\'s true face was seen. {pronoun.subject} had lived so long in disguise that {pronoun.subject} had almost forgotten who {pronoun.subject} really was. Now there was nowhere left to hide.',
    requiredContext: [],
  },
  {
    id: 'secret.identity.myth.high',
    category: EventCategory.Personal,
    subtype: 'secret.identity',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The mortal form was cast aside, and the true nature of {character.name} stood revealed. {pronoun.subject} had walked among humanity for an age, but now the divine—or infernal—truth could no longer be concealed.',
    requiredContext: [],
  },

  // ============================================================================
  // PROPHECY FULFILLED
  // ============================================================================

  {
    id: 'secret.prophecy.myth.high',
    category: EventCategory.Personal,
    subtype: 'secret.prophecy',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The ancient prophecy was fulfilled. What had been foretold in ages past came to pass at last, and the world recognized the truth that seers had glimpsed across the gulf of time.',
    requiredContext: [],
  },
  {
    id: 'secret.prophecy.epic.high',
    category: EventCategory.Personal,
    subtype: 'secret.prophecy',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The prophecy—dismissed by many as mere legend—proved devastatingly accurate. Those who had prepared were vindicated; those who had scoffed found themselves unprepared for destiny\'s arrival.',
    requiredContext: [],
  },
  {
    id: 'secret.prophecy.personal.high',
    category: EventCategory.Personal,
    subtype: 'secret.prophecy',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} had always known the words of the prophecy, but {pronoun.subject} had never truly believed them—not until now. Standing in the fulfillment of ancient words, {pronoun.subject} finally understood {pronoun.possessive} purpose.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'secret.default.epic',
    category: EventCategory.Personal,
    subtype: 'secret.default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'A secret was revealed, changing the understanding of events.',
    requiredContext: [],
  },
  {
    id: 'secret.default.intrigue',
    category: EventCategory.Personal,
    subtype: 'secret.default',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 0, max: 100 },
    template: 'Hidden information came to light, with significant implications.',
    requiredContext: [],
  },
];
