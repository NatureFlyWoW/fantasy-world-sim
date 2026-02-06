/**
 * Magical event narrative templates.
 * Covers: discovery, catastrophe, artifact creation, duel, ascension, wild magic, planar rift
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const magicalTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // DISCOVERY
  // ============================================================================

  {
    id: 'magical.discovery.epic.low',
    category: EventCategory.Magical,
    subtype: 'discovery',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'A minor magical discovery was made, adding to the accumulated knowledge of the arcane.',
    requiredContext: [],
  },
  {
    id: 'magical.discovery.epic.high',
    category: EventCategory.Magical,
    subtype: 'discovery',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} unveiled a discovery that would reshape the understanding of the arcane arts. Secrets long hidden from mortal minds were at last brought to light, and the world of magic would never be the same.',
    requiredContext: [],
  },
  {
    id: 'magical.discovery.myth.high',
    category: EventCategory.Magical,
    subtype: 'discovery',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The veil between worlds grew thin as {character.name} pierced mysteries that even the gods had kept hidden. Knowledge forbidden since the dawn of creation was now in mortal hands, and the heavens trembled.',
    requiredContext: [],
  },
  {
    id: 'magical.discovery.scholarly.high',
    category: EventCategory.Magical,
    subtype: 'discovery',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'The magical discovery documented by {character.name} represents a paradigm shift in arcane theory. Subsequent experimentation confirmed the principles, leading to widespread revision of established doctrine.',
    requiredContext: [],
  },

  // ============================================================================
  // CATASTROPHE
  // ============================================================================

  {
    id: 'magical.catastrophe.epic.high',
    category: EventCategory.Magical,
    subtype: 'catastrophe',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A magical catastrophe of unprecedented scale struck {site.name}. The very fabric of reality twisted and tore, leaving devastation in its wake. The land itself bore scars that would not heal for generations.',
    requiredContext: [],
  },
  {
    id: 'magical.catastrophe.myth.high',
    category: EventCategory.Magical,
    subtype: 'catastrophe',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The gods wept as arcane forces beyond mortal control ravaged {site.name}. What was wrought that day echoed through every plane of existence. The wound in reality would bleed for eternity.',
    requiredContext: [],
  },
  {
    id: 'magical.catastrophe.personal.high',
    category: EventCategory.Magical,
    subtype: 'catastrophe',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} watched in horror as {pronoun.possessive} work spiraled beyond all control. This was not what {pronoun.subject} had intended. The screams of the dying filled {pronoun.possessive} ears, and {pronoun.subject} knew that nothing could ever wash this blood from {pronoun.possessive} hands.',
    requiredContext: [],
  },

  // ============================================================================
  // ARTIFACT CREATION
  // ============================================================================

  {
    id: 'magical.artifact_creation.epic.high',
    category: EventCategory.Magical,
    subtype: 'artifact_creation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'At {site.name}, {character.name} completed {pronoun.possessive} masterwork: an artifact of such power that its mere existence would alter the course of history. The creation process had consumed years and untold resources, but the result was beyond all expectation.',
    requiredContext: [],
  },
  {
    id: 'magical.artifact_creation.myth.high',
    category: EventCategory.Magical,
    subtype: 'artifact_creation',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'Into the artifact, {character.name} poured not just magic but a fragment of {pronoun.possessive} very soul. The creation awakened with a consciousness not entirely its own, bound to purposes that would outlast its creator by eons.',
    requiredContext: [],
  },
  {
    id: 'magical.artifact_creation.personal.high',
    category: EventCategory.Magical,
    subtype: 'artifact_creation',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'When the final enchantment settled into place, {character.name} collapsed in exhaustion. {pronoun.subject} had given everything to this creation. Looking at what {pronoun.subject} had wrought, {pronoun.subject} was not certain if {pronoun.subject} had created something wonderful or something terrible.',
    requiredContext: [],
  },

  // ============================================================================
  // DUEL
  // ============================================================================

  {
    id: 'magical.duel.epic.high',
    category: EventCategory.Magical,
    subtype: 'duel',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'Two masters of the arcane arts faced each other in a duel of devastating power. Lightning crackled, flames roared, and reality itself seemed to bend as they traded blows that shattered stone and scorched the very air.',
    requiredContext: [],
  },
  {
    id: 'magical.duel.myth.high',
    category: EventCategory.Magical,
    subtype: 'duel',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The duel between the archmages was more than mortal combat—it was a clash of philosophies, of worldviews made manifest in elemental fury. The heavens themselves chose sides as powers that could shake mountains were unleashed.',
    requiredContext: [],
  },
  {
    id: 'magical.duel.personal.medium',
    category: EventCategory.Magical,
    subtype: 'duel',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} drew upon every reserve of power, knowing that a single mistake meant death. {pronoun.possessive} opponent was skilled, but {pronoun.subject} had something to fight for. {pronoun.subject} would not fall here.',
    requiredContext: [],
  },

  // ============================================================================
  // ASCENSION
  // ============================================================================

  {
    id: 'magical.ascension.myth.high',
    category: EventCategory.Magical,
    subtype: 'ascension',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} transcended the bounds of mortality. In a blinding flash of power, {pronoun.subject} shed {pronoun.possessive} mortal form and joined the ranks of beings beyond mortal comprehension. A new power had entered the cosmos.',
    requiredContext: [],
  },
  {
    id: 'magical.ascension.epic.high',
    category: EventCategory.Magical,
    subtype: 'ascension',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The ascension of {character.name} marked the end of an era and the beginning of another. What had once been mortal was now something else entirely, and the world would feel the effects for ages to come.',
    requiredContext: [],
  },

  // ============================================================================
  // WILD MAGIC
  // ============================================================================

  {
    id: 'magical.wild_magic.epic.medium',
    category: EventCategory.Magical,
    subtype: 'wild_magic',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'A surge of wild magic swept through {site.name}, leaving chaos in its wake. The unpredictable energies transformed everything they touched, and none could say what strange new wonders or horrors had been created.',
    requiredContext: [],
  },
  {
    id: 'magical.wild_magic.myth.high',
    category: EventCategory.Magical,
    subtype: 'wild_magic',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The raw stuff of creation itself erupted from the wounded earth at {site.name}. Reality became fluid, and impossible things walked where normal folk once lived. The world remembered, in that moment, that magic was never truly tamed.',
    requiredContext: [],
  },

  // ============================================================================
  // PLANAR RIFT
  // ============================================================================

  {
    id: 'magical.planar_rift.epic.high',
    category: EventCategory.Magical,
    subtype: 'planar_rift',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A rift tore open in the fabric of reality at {site.name}, connecting the mortal world to planes beyond. Through it poured energies and entities from elsewhere, forever changing the land around it.',
    requiredContext: [],
  },
  {
    id: 'magical.planar_rift.myth.high',
    category: EventCategory.Magical,
    subtype: 'planar_rift',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The barriers between worlds shattered, and the mortal realm touched planes that mortal minds were not meant to comprehend. What came through the rift was neither wholly good nor wholly evil—it was simply other, and that was terrifying enough.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'magical.default.epic',
    category: EventCategory.Magical,
    subtype: 'default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'A magical event of note occurred at {site.name}.',
    requiredContext: [],
  },
  {
    id: 'magical.default.myth',
    category: EventCategory.Magical,
    subtype: 'default',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 0, max: 100 },
    template: 'The arcane forces stirred, and the world took notice.',
    requiredContext: [],
  },
];
