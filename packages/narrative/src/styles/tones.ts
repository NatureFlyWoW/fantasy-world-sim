/**
 * Tone-specific vocabulary and phrasing for narrative generation.
 * Each tone produces distinctly different prose from the same event.
 */

import { NarrativeTone } from '../templates/types.js';

/**
 * Word substitutions for different tones.
 * Keys are neutral words, values are tone-specific alternatives.
 */
export interface ToneSubstitutions {
  readonly [neutralWord: string]: string;
}

/**
 * Phrase patterns for different tones.
 */
export interface TonePhrases {
  /** Opening phrases for narratives */
  readonly openings: readonly string[];
  /** Transitional phrases */
  readonly transitions: readonly string[];
  /** Closing phrases */
  readonly closings: readonly string[];
  /** Time reference phrases */
  readonly timeReferences: readonly string[];
  /** Consequence phrases */
  readonly consequences: readonly string[];
  /** Death phrases */
  readonly deaths: readonly string[];
  /** Victory phrases */
  readonly victories: readonly string[];
  /** Defeat phrases */
  readonly defeats: readonly string[];
  /** Discovery phrases */
  readonly discoveries: readonly string[];
  /** Foreshadowing phrases */
  readonly foreshadowing: readonly string[];
  /** Retrospective phrases */
  readonly retrospectives: readonly string[];
}

/**
 * Complete tone configuration.
 */
export interface ToneConfig {
  readonly substitutions: ToneSubstitutions;
  readonly phrases: TonePhrases;
  readonly characteristics: {
    readonly usePassiveVoice: boolean;
    readonly formalRegister: boolean;
    readonly emotionalLanguage: boolean;
    readonly archaicVocabulary: boolean;
    readonly analyticTone: boolean;
    readonly useReferences: boolean;
  };
}

/**
 * Epic Historical tone: Formal, passive, grandiose.
 */
export const EPIC_HISTORICAL_CONFIG: ToneConfig = {
  substitutions: {
    died: 'perished',
    killed: 'slew',
    kingdom: 'realm',
    country: 'realm',
    king: 'sovereign',
    queen: 'sovereign',
    war: 'conflict',
    battle: 'engagement',
    army: 'host',
    soldiers: 'warriors',
    attacked: 'assailed',
    defended: 'held fast',
    won: 'prevailed',
    lost: 'fell',
    very: 'exceeding',
    big: 'vast',
    small: 'meager',
    good: 'noble',
    bad: 'fell',
    evil: 'malevolent',
    happy: 'joyous',
    sad: 'mournful',
    angry: 'wrathful',
    love: 'devotion',
    hate: 'enmity',
    friend: 'ally',
    enemy: 'foe',
    people: 'folk',
    city: 'citadel',
    town: 'settlement',
    magic: 'arcane arts',
    spell: 'enchantment',
    god: 'divine power',
    temple: 'sanctum',
    money: 'coin',
    rich: 'prosperous',
    poor: 'destitute',
  },
  phrases: {
    openings: [
      'In the fullness of time,',
      'The annals record that',
      'Thus it came to pass that',
      'History would remember',
      'The chronicles tell of',
      'And so it was that',
      'In those days,',
      'The realm witnessed',
    ],
    transitions: [
      'Thereafter,',
      'In consequence,',
      'As fate decreed,',
      'The tide of fortune turned, and',
      'No sooner had this occurred than',
      'With the passage of time,',
      'Events conspired such that',
    ],
    closings: [
      'And thus the matter was concluded.',
      'So passed an age.',
      'The realm would never forget.',
      'Such was the way of things.',
      'And so the wheel of fate turned.',
      'History had spoken.',
    ],
    timeReferences: [
      'in the {year}th year of the age',
      'when the {season} winds blew',
      'as the old year gave way',
      'in days of old',
      'in the time before',
    ],
    consequences: [
      'This would prove fateful, for',
      'The consequences would echo through the ages.',
      'None could foresee what would follow.',
      'The seeds of future conflict were sown.',
    ],
    deaths: [
      'breathed their last',
      'was gathered to their ancestors',
      'passed from the mortal realm',
      'fell never to rise again',
      'met their end',
    ],
    victories: [
      'carried the day',
      'claimed a glorious victory',
      'prevailed against all odds',
      'emerged triumphant',
      'won a decisive engagement',
    ],
    defeats: [
      'suffered a crushing defeat',
      'was laid low',
      'knew the bitterness of loss',
      'was vanquished',
      'fell before the enemy',
    ],
    discoveries: [
      'unlocked secrets long hidden',
      'brought forth knowledge from darkness',
      'unveiled mysteries of old',
      'discovered what had been lost',
    ],
    foreshadowing: [
      'Though none yet knew, this would change everything.',
      'The shadow of future events loomed unseen.',
      'What seemed a small matter would prove momentous.',
      'Destiny was taking shape.',
    ],
    retrospectives: [
      'Looking back, we see the threads that led here.',
      'The roots of this moment lay in distant events.',
      'Long had the causes gathered.',
      'All that came before had led to this.',
    ],
  },
  characteristics: {
    usePassiveVoice: true,
    formalRegister: true,
    emotionalLanguage: false,
    archaicVocabulary: true,
    analyticTone: false,
    useReferences: false,
  },
};

/**
 * Personal Character Focus tone: Intimate, emotional, internal.
 */
export const PERSONAL_CHARACTER_CONFIG: ToneConfig = {
  substitutions: {
    kingdom: 'homeland',
    battle: 'fight',
    army: 'forces',
    war: 'struggle',
    victory: 'triumph',
    defeat: 'loss',
    death: 'passing',
    magic: 'power',
    god: 'faith',
  },
  phrases: {
    openings: [
      '{name} felt the weight of',
      'In {possessive} heart,',
      '{name} knew that',
      'A cold resolve settled in {possessive} chest as',
      '{name} could not shake the feeling that',
      'Something stirred within {name} as',
      'The memory of {event} haunted {name} still when',
    ],
    transitions: [
      'And yet,',
      'But {pronoun.subject} could not forget,',
      'The thought lingered,',
      'Despite everything,',
      'Something had changed,',
      'In that moment,',
    ],
    closings: [
      'Nothing would ever be the same.',
      'And {pronoun.subject} carried this burden forever after.',
      '{name} would remember this day.',
      'The world had shifted, imperceptibly but irrevocably.',
    ],
    timeReferences: [
      'in those long days',
      'as the seasons turned',
      'through sleepless nights',
      'in quiet moments',
    ],
    consequences: [
      '{pronoun.subject} knew this would haunt {pronoun.object}.',
      'The weight of it settled on {possessive} shoulders.',
      '{pronoun.subject} would carry this forever.',
    ],
    deaths: [
      'slipped away',
      'was lost to {pronoun.object} forever',
      'left {pronoun.object} alone',
      'departed this world',
    ],
    victories: [
      'felt a surge of triumph',
      'allowed {pronoun.reflexive} a moment of joy',
      'savored the sweet taste of success',
    ],
    defeats: [
      'tasted bitter defeat',
      'felt {possessive} world crumble',
      'watched {possessive} hopes die',
    ],
    discoveries: [
      'found what {pronoun.subject} had been seeking',
      'understood at last',
      'saw the truth with new eyes',
    ],
    foreshadowing: [
      '{pronoun.subject} could not know what lay ahead.',
      'If only {pronoun.subject} had known then...',
      'Little did {pronoun.subject} suspect.',
    ],
    retrospectives: [
      '{pronoun.subject} thought of all that had led here.',
      'The memories washed over {pronoun.object}.',
      'Everything had been building to this.',
    ],
  },
  characteristics: {
    usePassiveVoice: false,
    formalRegister: false,
    emotionalLanguage: true,
    archaicVocabulary: false,
    analyticTone: false,
    useReferences: false,
  },
};

/**
 * Mythological tone: Archaic, symbolic, larger-than-life.
 */
export const MYTHOLOGICAL_CONFIG: ToneConfig = {
  substitutions: {
    died: 'fell',
    killed: 'struck down',
    kingdom: 'domain',
    king: 'lord',
    queen: 'lady',
    war: 'strife',
    battle: 'clash',
    army: 'legion',
    soldiers: 'champions',
    attacked: 'fell upon',
    defended: 'stood against',
    won: 'conquered',
    lost: 'was overcome',
    magic: 'sorcery',
    spell: 'incantation',
    god: 'the divine',
    gods: 'the powers above',
    temple: 'sacred ground',
    evil: 'darkness',
    good: 'light',
    love: 'passion',
    hate: 'wrath',
    sky: 'heavens',
    earth: 'world below',
    sea: 'deep waters',
    fire: 'flame',
    mountain: 'peak',
    forest: 'wilds',
  },
  phrases: {
    openings: [
      'The gods wept when',
      'As foretold in ancient prophecy,',
      'The very earth trembled as',
      'Mortals dared to reach beyond their ken when',
      'The heavens themselves bore witness as',
      'In the age before ages,',
      'When the world was young,',
      'The stars aligned when',
    ],
    transitions: [
      'And the powers above looked on as',
      'Thus the wheel of fate turned,',
      'The threads of destiny wove together,',
      'As was written in the stars,',
      'The old forces stirred,',
    ],
    closings: [
      'And so the legend was born.',
      'Thus passed into myth.',
      'And the bards would sing of this for ages to come.',
      'The world would never be the same.',
      'And the gods nodded, satisfied.',
    ],
    timeReferences: [
      'in the dawn of time',
      'when the world was young',
      'in the age of heroes',
      'when legends walked the earth',
    ],
    consequences: [
      'The balance of the cosmos shifted.',
      'The very fabric of reality was altered.',
      'The ancient pacts trembled.',
      'New legends were born.',
    ],
    deaths: [
      'was claimed by the eternal darkness',
      'joined the ancestors in the halls beyond',
      'passed into legend',
      'was taken by the gods',
    ],
    victories: [
      'achieved glory immortal',
      'rose to legendary heights',
      'earned a place among the heroes of old',
    ],
    defeats: [
      'was cast down by fate',
      'fell before the inexorable tide',
      'knew the doom of mortals',
    ],
    discoveries: [
      'unveiled the mysteries of creation',
      'pierced the veil of the unknown',
      'found wisdom denied to mortals',
    ],
    foreshadowing: [
      'But the gods had other plans.',
      'Yet destiny was not finished.',
      'The prophecy was not yet complete.',
    ],
    retrospectives: [
      'All the ages had led to this moment.',
      'The ancient prophecies spoke of this day.',
      'The cycle was completing.',
    ],
  },
  characteristics: {
    usePassiveVoice: false,
    formalRegister: true,
    emotionalLanguage: true,
    archaicVocabulary: true,
    analyticTone: false,
    useReferences: false,
  },
};

/**
 * Political Intrigue tone: Detached, analytical, focused on maneuvering.
 */
export const POLITICAL_INTRIGUE_CONFIG: ToneConfig = {
  substitutions: {
    war: 'conflict',
    battle: 'engagement',
    army: 'forces',
    killed: 'eliminated',
    died: 'fell',
    attacked: 'moved against',
    defended: 'maintained position',
    friend: 'ally',
    enemy: 'adversary',
    love: 'alliance',
    hate: 'opposition',
    magic: 'arcane leverage',
    god: 'religious influence',
    temple: 'religious institution',
    money: 'capital',
    rich: 'well-resourced',
    poor: 'resource-poor',
  },
  phrases: {
    openings: [
      'The alliance shifted when',
      'A calculated gambit was made as',
      'The balance of power tilted when',
      'Behind closed doors,',
      'In a move that surprised few observers,',
      'Strategic considerations led to',
      'The political landscape changed when',
    ],
    transitions: [
      'This development prompted',
      'In response,',
      'The resulting power vacuum',
      'Subsequent negotiations',
      'The calculus changed,',
      'Observers noted that',
    ],
    closings: [
      'The new order was established.',
      'The political map was redrawn.',
      'A new equilibrium emerged.',
      'The implications would unfold over time.',
    ],
    timeReferences: [
      'in the current political climate',
      'given recent developments',
      'following the restructuring',
      'in the wake of events',
    ],
    consequences: [
      'This shifted the balance of power.',
      'The political implications were significant.',
      'New alliances would form in response.',
      'The establishment took note.',
    ],
    deaths: [
      'was removed from the board',
      'exited the political stage',
      'was eliminated as a factor',
    ],
    victories: [
      'consolidated power',
      'achieved a strategic victory',
      'strengthened their position',
    ],
    defeats: [
      'saw their influence wane',
      'suffered a political setback',
      'lost standing',
    ],
    discoveries: [
      'gained valuable intelligence',
      'uncovered useful information',
      'obtained leverage',
    ],
    foreshadowing: [
      'This would prove significant later.',
      'The full implications remained to be seen.',
      'Future developments would stem from this.',
    ],
    retrospectives: [
      'The chain of events leading here was clear.',
      'Previous maneuvers had set the stage.',
      'The groundwork had been laid.',
    ],
  },
  characteristics: {
    usePassiveVoice: true,
    formalRegister: true,
    emotionalLanguage: false,
    archaicVocabulary: false,
    analyticTone: true,
    useReferences: false,
  },
};

/**
 * Scholarly tone: Academic, referenced, analytical.
 */
export const SCHOLARLY_CONFIG: ToneConfig = {
  substitutions: {
    kingdom: 'polity',
    war: 'armed conflict',
    battle: 'military engagement',
    magic: 'arcane practices',
    god: 'deity',
    gods: 'divine entities',
    temple: 'religious institution',
  },
  phrases: {
    openings: [
      'Historical analysis suggests that',
      'The evidence indicates',
      'Contemporary sources record that',
      'According to available records,',
      'Scholarly consensus holds that',
      'Primary sources document that',
      'It is well established that',
    ],
    transitions: [
      'Furthermore,',
      'Additionally,',
      'It should be noted that',
      'This is consistent with',
      'Subsequent events confirm that',
      'The data suggests',
    ],
    closings: [
      'Further research may illuminate additional details.',
      'The historical record is incomplete but suggestive.',
      'These events require further scholarly attention.',
      'The significance of these developments is still debated.',
    ],
    timeReferences: [
      'in the period under consideration',
      'during this era',
      'at this point in the historical record',
      'according to the dating',
    ],
    consequences: [
      'The causal relationship is evident.',
      'This precipitated subsequent developments.',
      'The effects were measurable.',
      'Historical trajectories shifted.',
    ],
    deaths: [
      'ceased to be a historical actor',
      'is no longer attested in the record',
      'died according to sources',
    ],
    victories: [
      'achieved documented success',
      'prevailed according to accounts',
      'demonstrated military superiority',
    ],
    defeats: [
      'suffered documented reverses',
      'experienced significant losses',
      'was defeated according to sources',
    ],
    discoveries: [
      'represents a significant addition to knowledge',
      'expanded the documented understanding',
      'contributed new data',
    ],
    foreshadowing: [
      'Later events would prove this significant.',
      'The importance would become apparent.',
      'Subsequent analysis would highlight this.',
    ],
    retrospectives: [
      'Prior developments contextualize this.',
      'The causal chain is documented.',
      'Historical precedent informed this.',
    ],
  },
  characteristics: {
    usePassiveVoice: true,
    formalRegister: true,
    emotionalLanguage: false,
    archaicVocabulary: false,
    analyticTone: true,
    useReferences: true,
  },
};

/**
 * Map of tone to configuration.
 */
export const TONE_CONFIGS: Record<NarrativeTone, ToneConfig> = {
  [NarrativeTone.EpicHistorical]: EPIC_HISTORICAL_CONFIG,
  [NarrativeTone.PersonalCharacterFocus]: PERSONAL_CHARACTER_CONFIG,
  [NarrativeTone.Mythological]: MYTHOLOGICAL_CONFIG,
  [NarrativeTone.PoliticalIntrigue]: POLITICAL_INTRIGUE_CONFIG,
  [NarrativeTone.Scholarly]: SCHOLARLY_CONFIG,
};

/**
 * Get a random phrase from a category.
 */
export function getRandomPhrase(
  tone: NarrativeTone,
  category: keyof TonePhrases,
  rng: () => number = Math.random
): string {
  const config = TONE_CONFIGS[tone];
  const phrases = config.phrases[category];
  const index = Math.floor(rng() * phrases.length);
  return phrases[index] ?? '';
}

/**
 * Apply word substitutions for a tone.
 */
export function applySubstitutions(text: string, tone: NarrativeTone): string {
  const config = TONE_CONFIGS[tone];
  let result = text;

  for (const [neutral, replacement] of Object.entries(config.substitutions)) {
    // Replace whole words only, case-insensitive with case preservation
    const regex = new RegExp(`\\b${neutral}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // Preserve case of first letter
      if (match[0] === match[0]?.toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }

  return result;
}

/**
 * Get words characteristic of a tone (for vocabulary analysis).
 */
export function getToneCharacteristicWords(tone: NarrativeTone): string[] {
  const config = TONE_CONFIGS[tone];
  const words: string[] = [];

  // Collect substitution values
  for (const replacement of Object.values(config.substitutions)) {
    words.push(replacement);
  }

  // Collect words from phrases
  for (const phraseList of Object.values(config.phrases)) {
    for (const phrase of phraseList) {
      words.push(...phrase.split(/\s+/).filter((w: string) => w.length > 4));
    }
  }

  return [...new Set(words)];
}

/**
 * Calculate a vocabulary score for text against a tone.
 * Returns a value 0-1 indicating how well the text matches the tone's vocabulary.
 */
export function calculateVocabularyMatch(text: string, tone: NarrativeTone): number {
  const characteristicWords = getToneCharacteristicWords(tone);
  const textWords = text.toLowerCase().split(/\s+/);
  const textWordSet = new Set(textWords);

  let matches = 0;
  for (const word of characteristicWords) {
    if (textWordSet.has(word.toLowerCase())) {
      matches++;
    }
  }

  // Return ratio of matched characteristic words
  return characteristicWords.length > 0 ? matches / characteristicWords.length : 0;
}
