/**
 * Religious event narrative templates.
 * Covers: schism, miracle, prophet emergence, holy war, conversion, divine intervention
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const religiousTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // SCHISM
  // ============================================================================

  {
    id: 'religious.schism.epic.high',
    category: EventCategory.Religious,
    subtype: 'schism',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great schism tore the faithful apart. What had been one church became two, each claiming true doctrine. The division would echo through generations, spawning conflicts both theological and martial.',
    requiredContext: [],
  },
  {
    id: 'religious.schism.personal.high',
    category: EventCategory.Religious,
    subtype: 'schism',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} stood before the assembled faithful and spoke the words that would split the church. {pronoun.subject} knew the cost—friends would become enemies, families would be divided. But {pronoun.subject} could not keep silent about what {pronoun.subject} knew to be true.',
    requiredContext: [],
  },
  {
    id: 'religious.schism.scholarly.medium',
    category: EventCategory.Religious,
    subtype: 'schism',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'The religious schism can be attributed to both doctrinal disagreements and underlying political tensions. Contemporary accounts reveal deep divisions over matters of liturgy and ecclesiastical authority.',
    requiredContext: [],
  },

  // ============================================================================
  // MIRACLE
  // ============================================================================

  {
    id: 'religious.miracle.myth.high',
    category: EventCategory.Religious,
    subtype: 'miracle',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The divine touched the mortal world at {site.name}. The sick were healed, the blind given sight, and the dying rose from their beds. All present knew they had witnessed something beyond the natural order.',
    requiredContext: [],
  },
  {
    id: 'religious.miracle.epic.medium',
    category: EventCategory.Religious,
    subtype: 'miracle',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'A miracle occurred at {site.name}, strengthening the faith of the devoted. Pilgrims would come from across the realm to witness the site of divine intervention.',
    requiredContext: [],
  },
  {
    id: 'religious.miracle.personal.high',
    category: EventCategory.Religious,
    subtype: 'miracle',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} fell to {pronoun.possessive} knees as the miracle unfolded before {pronoun.object}. All {pronoun.possessive} doubts, all {pronoun.possessive} questions—they dissolved in the face of undeniable proof. The divine was real, and it had touched {pronoun.object}.',
    requiredContext: [],
  },
  {
    id: 'religious.miracle.scholarly.medium',
    category: EventCategory.Religious,
    subtype: 'miracle',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Contemporary accounts describe events at {site.name} in terms consistent with miraculous intervention. While skeptics have proposed alternative explanations, the documented testimonies remain compelling to believers.',
    requiredContext: [],
  },

  // ============================================================================
  // PROPHET EMERGENCE
  // ============================================================================

  {
    id: 'religious.prophet_emergence.myth.high',
    category: EventCategory.Religious,
    subtype: 'prophet_emergence',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'From humble origins arose {character.name}, touched by divine purpose. {pronoun.subject} spoke with the voice of the gods, and all who heard {pronoun.object} knew that a new prophet had emerged to guide the faithful.',
    requiredContext: [],
  },
  {
    id: 'religious.prophet_emergence.epic.high',
    category: EventCategory.Religious,
    subtype: 'prophet_emergence',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The emergence of {character.name} as prophet would reshape the religious landscape. {pronoun.possessive} teachings spread like wildfire, attracting both devoted followers and bitter enemies.',
    requiredContext: [],
  },
  {
    id: 'religious.prophet_emergence.personal.high',
    category: EventCategory.Religious,
    subtype: 'prophet_emergence',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} had not asked for this burden. The visions came unbidden, the words poured from {pronoun.possessive} lips without {pronoun.possessive} willing them. {pronoun.subject} was just an ordinary person—but the divine had chosen {pronoun.object}, and {pronoun.subject} could not refuse.',
    requiredContext: [],
  },

  // ============================================================================
  // HOLY WAR
  // ============================================================================

  {
    id: 'religious.holy_war.epic.high',
    category: EventCategory.Religious,
    subtype: 'holy_war',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'In the name of the divine, armies marched to war. The holy conflict would consume nations and generations, leaving scars upon the land and soul alike. Faith became a weapon, and believers shed blood for their beliefs.',
    requiredContext: [],
  },
  {
    id: 'religious.holy_war.myth.high',
    category: EventCategory.Religious,
    subtype: 'holy_war',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The gods themselves took sides as mortal armies clashed in their names. Angels and demons were said to walk the battlefield, and the outcome would determine not just the fate of nations but the balance of the heavens.',
    requiredContext: [],
  },
  {
    id: 'religious.holy_war.personal.high',
    category: EventCategory.Religious,
    subtype: 'holy_war',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} raised {pronoun.possessive} weapon in the name of {pronoun.possessive} god. {pronoun.subject} did not want to kill, but the enemy was an enemy of the faith. Each life {pronoun.subject} took was an offering, {pronoun.subject} told {pronoun.reflexive}. Each death brought {pronoun.object} closer to the divine.',
    requiredContext: [],
  },

  // ============================================================================
  // CONVERSION
  // ============================================================================

  {
    id: 'religious.conversion.epic.medium',
    category: EventCategory.Religious,
    subtype: 'conversion',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} embraced the new faith, abandoning the beliefs of {pronoun.possessive} ancestors. {pronoun.possessive} conversion would prove influential, bringing others to follow in {pronoun.possessive} footsteps.',
    requiredContext: [],
  },
  {
    id: 'religious.conversion.personal.high',
    category: EventCategory.Religious,
    subtype: 'conversion',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'The old prayers felt hollow on {character.name}\'s lips. {pronoun.subject} had found something new, something that filled the void {pronoun.subject} had carried all {pronoun.possessive} life. {pronoun.subject} knew {pronoun.possessive} family would never understand, but {pronoun.subject} could not deny the truth that had found {pronoun.object}.',
    requiredContext: [],
  },

  // ============================================================================
  // DIVINE INTERVENTION
  // ============================================================================

  {
    id: 'religious.divine_intervention.myth.high',
    category: EventCategory.Religious,
    subtype: 'divine_intervention',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The gods reached down from the heavens and touched the mortal world directly. Their divine will was made manifest, and none who witnessed it could doubt the existence of powers beyond mortal ken.',
    requiredContext: [],
  },
  {
    id: 'religious.divine_intervention.epic.high',
    category: EventCategory.Religious,
    subtype: 'divine_intervention',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'Divine intervention saved {site.name} from certain destruction. The faithful saw their prayers answered in the most dramatic fashion, while skeptics scrambled for natural explanations.',
    requiredContext: [],
  },
  {
    id: 'religious.divine_intervention.personal.high',
    category: EventCategory.Religious,
    subtype: 'divine_intervention',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} felt the presence of the divine like a warm light flooding through {pronoun.possessive} being. {pronoun.subject} was being guided, protected, used for purposes beyond {pronoun.possessive} understanding. It was terrifying and glorious in equal measure.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'religious.default.epic',
    category: EventCategory.Religious,
    subtype: 'default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'A religious event of significance occurred, affecting the faithful.',
    requiredContext: [],
  },
  {
    id: 'religious.default.myth',
    category: EventCategory.Religious,
    subtype: 'default',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 0, max: 100 },
    template: 'The divine stirred, and the mortal world took notice.',
    requiredContext: [],
  },
];
