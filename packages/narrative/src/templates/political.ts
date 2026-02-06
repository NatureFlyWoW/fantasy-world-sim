/**
 * Political event narrative templates.
 * Covers: coronation, succession, coup, reform, treaty signing, war declaration, diplomatic crisis
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const politicalTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // CORONATION
  // ============================================================================

  // Epic Historical - Low Significance
  {
    id: 'political.coronation.epic.low',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'In accordance with tradition, {character.name} was crowned at {site.name}. The ceremony passed without incident.',
    requiredContext: [],
  },
  // Epic Historical - Medium Significance
  {
    id: 'political.coronation.epic.medium',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The crown of {faction.name} was placed upon the brow of {character.name} at {site.name}. The realm watched with keen interest as a new era began.',
    requiredContext: [],
  },
  // Epic Historical - High Significance
  {
    id: 'political.coronation.epic.high',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'In a ceremony that would echo through the ages, {character.name} ascended to the throne of {faction.name}. The assembled lords bent the knee, and destiny itself seemed to hold its breath. A new chapter in the annals of the realm had begun.',
    requiredContext: [],
  },

  // Personal Character Focus - All Significance Levels
  {
    id: 'political.coronation.personal.low',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 0, max: 40 },
    template: '{character.name} felt the cold weight of the crown settle upon {pronoun.possessive} head. It was done.',
    requiredContext: [],
  },
  {
    id: 'political.coronation.personal.medium',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'As the crown was placed upon {pronoun.possessive} head, {character.name} felt the weight of every soul in {faction.name} settle upon {pronoun.possessive} shoulders. {pronoun.subject} had dreamed of this moment, but the reality was heavier than any dream.',
    requiredContext: [],
  },
  {
    id: 'political.coronation.personal.high',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} closed {pronoun.possessive} eyes as the crown descended. In that moment between one heartbeat and the next, {pronoun.subject} was still just a person. Then the cold metal touched {pronoun.possessive} brow, and everything changed. The cheers of the crowd washed over {pronoun.object}, but {pronoun.subject} heard only the echo of duty calling.',
    requiredContext: [],
  },

  // Mythological
  {
    id: 'political.coronation.myth.high',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The heavens themselves marked the coronation of {character.name}. As the ancient crown touched {pronoun.possessive} brow, a shaft of light broke through the clouds above {site.name}. The gods had chosen, and mortal hands had only confirmed their will.',
    requiredContext: [],
  },

  // Political Intrigue
  {
    id: 'political.coronation.intrigue.medium',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 41, max: 70 },
    template: 'The coronation of {character.name} represented a significant shift in the power dynamics of {faction.name}. Several prominent nobles were notably absent from the ceremony, signaling potential future tensions.',
    requiredContext: [],
  },

  // Scholarly
  {
    id: 'political.coronation.scholarly.medium',
    category: EventCategory.Political,
    subtype: 'coronation',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'The coronation of {character.name} at {site.name} followed traditional ceremonial forms, though contemporary accounts note certain deviations from established precedent. The political implications of this succession would become apparent in subsequent years.',
    requiredContext: [],
  },

  // ============================================================================
  // SUCCESSION
  // ============================================================================

  {
    id: 'political.succession.epic.low',
    category: EventCategory.Political,
    subtype: 'succession',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'The succession passed peacefully to the rightful heir. {character.name} assumed {pronoun.possessive} new responsibilities without opposition.',
    requiredContext: [],
  },
  {
    id: 'political.succession.epic.high',
    category: EventCategory.Political,
    subtype: 'succession',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A new age dawned for {faction.name} as {character.name} claimed the throne. The old order had passed, and with it, the certainties of a generation. All eyes now turned to the new ruler, wondering what fate awaited the realm.',
    requiredContext: [],
  },
  {
    id: 'political.succession.personal.high',
    category: EventCategory.Political,
    subtype: 'succession',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} had always known this day would come, but nothing could have prepared {pronoun.object} for the reality. Standing in the halls where {pronoun.possessive} predecessor once walked, {pronoun.subject} felt the impossible weight of expectation.',
    requiredContext: [],
  },

  // ============================================================================
  // COUP
  // ============================================================================

  {
    id: 'political.coup.epic.high',
    category: EventCategory.Political,
    subtype: 'coup',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'In a single bloody night, the throne of {faction.name} changed hands. {character.name} seized power, casting down the old order. The realm would remember this as the night when ambition triumphed over tradition.',
    requiredContext: [],
  },
  {
    id: 'political.coup.intrigue.high',
    category: EventCategory.Political,
    subtype: 'coup',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The coup was executed with precision. {character.name} and {pronoun.possessive} allies had spent months positioning assets and cultivating key relationships. When the moment came, the transition was swift and decisive. The old regime found itself without allies when it mattered most.',
    requiredContext: [],
  },
  {
    id: 'political.coup.personal.high',
    category: EventCategory.Political,
    subtype: 'coup',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'The blade was steady in {character.name}\'s hand as {pronoun.subject} faced the fallen ruler. Years of planning, of quiet rage, had led to this moment. {pronoun.subject} had told {pronoun.reflexive} it was for the good of the realm. Now, looking into those desperate eyes, {pronoun.subject} wondered if that was still true.',
    requiredContext: [],
  },

  // ============================================================================
  // REFORM
  // ============================================================================

  {
    id: 'political.reform.epic.medium',
    category: EventCategory.Political,
    subtype: 'reform',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} enacted sweeping reforms throughout {faction.name}. The old ways yielded to new laws, and the realm was transformed.',
    requiredContext: [],
  },
  {
    id: 'political.reform.scholarly.medium',
    category: EventCategory.Political,
    subtype: 'reform',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'The reforms implemented by {character.name} represented a significant departure from established practice. Analysis of contemporary documents suggests these changes were driven by both ideological conviction and practical necessity.',
    requiredContext: [],
  },

  // ============================================================================
  // TREATY
  // ============================================================================

  {
    id: 'political.treaty.epic.low',
    category: EventCategory.Political,
    subtype: 'treaty',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'A treaty was signed between the parties, formalizing an agreement of mutual benefit.',
    requiredContext: [],
  },
  {
    id: 'political.treaty.epic.high',
    category: EventCategory.Political,
    subtype: 'treaty',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'At {site.name}, bitter enemies laid down their swords and clasped hands in peace. The treaty would reshape the political landscape for generations, ending an age of conflict and ushering in an uncertain peace.',
    requiredContext: [],
  },
  {
    id: 'political.treaty.intrigue.high',
    category: EventCategory.Political,
    subtype: 'treaty',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The treaty negotiations represented a masterclass in diplomatic maneuvering. Both parties made calculated concessions, each believing they had secured the better deal. Only time would reveal who had truly won at the negotiating table.',
    requiredContext: [],
  },

  // ============================================================================
  // WAR DECLARATION
  // ============================================================================

  {
    id: 'political.war_declaration.epic.high',
    category: EventCategory.Political,
    subtype: 'war_declaration',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'With a voice that rang across the great hall, {character.name} declared war upon {faction.name}. The die was cast, and the fate of nations would be decided by steel and blood.',
    requiredContext: [],
  },
  {
    id: 'political.war_declaration.myth.high',
    category: EventCategory.Political,
    subtype: 'war_declaration',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The war drums thundered across the land as {character.name} raised the banner of war. The gods of battle stirred from their slumber, for mortal conflict of legendary proportions was about to unfold.',
    requiredContext: [],
  },
  {
    id: 'political.war_declaration.personal.high',
    category: EventCategory.Political,
    subtype: 'war_declaration',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'The words left {character.name}\'s lips, and there was no taking them back. War. {pronoun.subject} had unleashed it upon the world. {pronoun.subject} thought of all the families who would be torn apart, the children who would grow up without parents. But there was no other way.',
    requiredContext: [],
  },

  // ============================================================================
  // DIPLOMATIC CRISIS
  // ============================================================================

  {
    id: 'political.diplomatic_crisis.intrigue.high',
    category: EventCategory.Political,
    subtype: 'diplomatic_crisis',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The diplomatic incident sent shockwaves through the courts. Ambassadors were recalled, alliances were questioned, and the delicate balance of power teetered on the edge. Behind closed doors, frantic negotiations attempted to prevent open conflict.',
    requiredContext: [],
  },
  {
    id: 'political.diplomatic_crisis.epic.medium',
    category: EventCategory.Political,
    subtype: 'diplomatic_crisis',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'A diplomatic crisis erupted between the nations, threatening the fragile peace. Tensions mounted as both sides prepared for the worst.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'political.default.epic',
    category: EventCategory.Political,
    subtype: 'default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'A political development of note occurred in {faction.name}, reshaping the balance of power.',
    requiredContext: [],
  },
  {
    id: 'political.default.personal',
    category: EventCategory.Political,
    subtype: 'default',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 0, max: 100 },
    template: '{character.name} found {pronoun.reflexive} at the center of political change.',
    requiredContext: [],
  },
  {
    id: 'political.default.intrigue',
    category: EventCategory.Political,
    subtype: 'default',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 0, max: 100 },
    template: 'The political landscape shifted as new developments emerged.',
    requiredContext: [],
  },
];
