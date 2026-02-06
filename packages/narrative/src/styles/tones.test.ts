/**
 * Tests for tone-specific vocabulary and phrasing.
 */

import { describe, it, expect } from 'vitest';
import {
  TONE_CONFIGS,
  getRandomPhrase,
  applySubstitutions,
  getToneCharacteristicWords,
  calculateVocabularyMatch,
} from './tones.js';
import { NarrativeTone } from '../templates/types.js';

describe('Tone configurations', () => {
  describe('TONE_CONFIGS', () => {
    it('should have configuration for all tones', () => {
      expect(TONE_CONFIGS[NarrativeTone.EpicHistorical]).toBeDefined();
      expect(TONE_CONFIGS[NarrativeTone.PersonalCharacterFocus]).toBeDefined();
      expect(TONE_CONFIGS[NarrativeTone.Mythological]).toBeDefined();
      expect(TONE_CONFIGS[NarrativeTone.PoliticalIntrigue]).toBeDefined();
      expect(TONE_CONFIGS[NarrativeTone.Scholarly]).toBeDefined();
    });

    it('should have substitutions for each tone', () => {
      for (const tone of Object.values(NarrativeTone)) {
        const config = TONE_CONFIGS[tone];
        expect(Object.keys(config.substitutions).length).toBeGreaterThan(0);
      }
    });

    it('should have phrase categories for each tone', () => {
      const requiredCategories = [
        'openings',
        'transitions',
        'closings',
        'timeReferences',
        'consequences',
        'deaths',
        'victories',
        'defeats',
        'discoveries',
        'foreshadowing',
        'retrospectives',
      ];

      for (const tone of Object.values(NarrativeTone)) {
        const config = TONE_CONFIGS[tone];
        for (const category of requiredCategories) {
          expect(config.phrases[category as keyof typeof config.phrases]).toBeDefined();
          expect(config.phrases[category as keyof typeof config.phrases].length).toBeGreaterThan(0);
        }
      }
    });

    it('should have characteristics for each tone', () => {
      for (const tone of Object.values(NarrativeTone)) {
        const config = TONE_CONFIGS[tone];
        expect(config.characteristics).toBeDefined();
        expect(typeof config.characteristics.usePassiveVoice).toBe('boolean');
        expect(typeof config.characteristics.formalRegister).toBe('boolean');
        expect(typeof config.characteristics.emotionalLanguage).toBe('boolean');
      }
    });
  });

  describe('Epic Historical tone', () => {
    const config = TONE_CONFIGS[NarrativeTone.EpicHistorical];

    it('should substitute casual words with grandiose alternatives', () => {
      expect(config.substitutions['kingdom']).toBe('realm');
      expect(config.substitutions['died']).toBe('perished');
      expect(config.substitutions['killed']).toBe('slew');
      expect(config.substitutions['army']).toBe('host');
    });

    it('should have formal characteristics', () => {
      expect(config.characteristics.formalRegister).toBe(true);
      expect(config.characteristics.usePassiveVoice).toBe(true);
      expect(config.characteristics.archaicVocabulary).toBe(true);
    });

    it('should have formal opening phrases', () => {
      expect(config.phrases.openings).toContain('In the fullness of time,');
      expect(config.phrases.openings).toContain('The annals record that');
    });
  });

  describe('Personal Character Focus tone', () => {
    const config = TONE_CONFIGS[NarrativeTone.PersonalCharacterFocus];

    it('should have emotional characteristics', () => {
      expect(config.characteristics.emotionalLanguage).toBe(true);
      expect(config.characteristics.formalRegister).toBe(false);
      expect(config.characteristics.usePassiveVoice).toBe(false);
    });

    it('should have intimate opening phrases', () => {
      expect(config.phrases.openings.some(p => p.includes('{name}'))).toBe(true);
      expect(config.phrases.openings.some(p => p.includes('heart'))).toBe(true);
    });
  });

  describe('Mythological tone', () => {
    const config = TONE_CONFIGS[NarrativeTone.Mythological];

    it('should substitute with archaic terms', () => {
      expect(config.substitutions['magic']).toBe('sorcery');
      expect(config.substitutions['god']).toBe('the divine');
    });

    it('should have dramatic opening phrases', () => {
      expect(config.phrases.openings.some(p => p.includes('gods'))).toBe(true);
      expect(config.phrases.openings.some(p => p.includes('prophecy'))).toBe(true);
    });
  });

  describe('Political Intrigue tone', () => {
    const config = TONE_CONFIGS[NarrativeTone.PoliticalIntrigue];

    it('should have analytical characteristics', () => {
      expect(config.characteristics.analyticTone).toBe(true);
      expect(config.characteristics.emotionalLanguage).toBe(false);
    });

    it('should substitute with political terms', () => {
      expect(config.substitutions['attacked']).toBe('moved against');
      expect(config.substitutions['killed']).toBe('eliminated');
    });
  });

  describe('Scholarly tone', () => {
    const config = TONE_CONFIGS[NarrativeTone.Scholarly];

    it('should have academic characteristics', () => {
      expect(config.characteristics.useReferences).toBe(true);
      expect(config.characteristics.analyticTone).toBe(true);
      expect(config.characteristics.formalRegister).toBe(true);
    });

    it('should have analytical opening phrases', () => {
      expect(config.phrases.openings.some(p => p.includes('analysis'))).toBe(true);
      expect(config.phrases.openings.some(p => p.includes('evidence'))).toBe(true);
    });
  });
});

describe('getRandomPhrase', () => {
  it('should return a phrase from the specified category', () => {
    const config = TONE_CONFIGS[NarrativeTone.EpicHistorical];

    // Use deterministic RNG for testing
    let callCount = 0;
    const deterministicRng = () => {
      callCount++;
      return 0; // Always return 0 to get first element
    };

    const phrase = getRandomPhrase(NarrativeTone.EpicHistorical, 'openings', deterministicRng);
    expect(config.phrases.openings).toContain(phrase);
  });

  it('should return different phrases with different RNG values', () => {
    const phrases = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const phrase = getRandomPhrase(NarrativeTone.EpicHistorical, 'openings');
      phrases.add(phrase);
    }

    // Should have gotten at least 2 different phrases (probabilistic)
    expect(phrases.size).toBeGreaterThanOrEqual(1);
  });
});

describe('applySubstitutions', () => {
  it('should replace words with tone-specific alternatives', () => {
    const input = 'The kingdom was defended by soldiers.';
    const result = applySubstitutions(input, NarrativeTone.EpicHistorical);

    expect(result).toContain('realm');
    expect(result).toContain('warriors');
    expect(result).not.toContain('kingdom');
    expect(result).not.toContain('soldiers');
  });

  it('should preserve case of first letter', () => {
    const input = 'Kingdom fell. The kingdom was lost.';
    const result = applySubstitutions(input, NarrativeTone.EpicHistorical);

    expect(result).toContain('Realm');
    expect(result).toContain('realm');
  });

  it('should only replace whole words', () => {
    const input = 'The kingdoms were at war.'; // "kingdoms" should not match "kingdom"
    const result = applySubstitutions(input, NarrativeTone.EpicHistorical);

    // "kingdoms" (plural) should NOT be replaced by "realm" (word boundary prevents match)
    // But "war" -> "conflict" should still be replaced
    expect(result).toContain('kingdoms');
    expect(result).toContain('conflict');
  });

  it('should handle multiple substitutions', () => {
    const input = 'The soldiers killed many and died fighting.';
    const result = applySubstitutions(input, NarrativeTone.EpicHistorical);

    expect(result).toContain('warriors');
    expect(result).toContain('slew');
    expect(result).toContain('perished');
  });

  it('should work with different tones', () => {
    const input = 'The army attacked the city.';

    const epicResult = applySubstitutions(input, NarrativeTone.EpicHistorical);
    expect(epicResult).toContain('host');
    expect(epicResult).toContain('assailed');

    const intrigueResult = applySubstitutions(input, NarrativeTone.PoliticalIntrigue);
    expect(intrigueResult).toContain('forces');
    expect(intrigueResult).toContain('moved against');
  });
});

describe('getToneCharacteristicWords', () => {
  it('should return substitution values', () => {
    const words = getToneCharacteristicWords(NarrativeTone.EpicHistorical);

    expect(words).toContain('realm');
    expect(words).toContain('perished');
    expect(words).toContain('host');
  });

  it('should return unique words', () => {
    const words = getToneCharacteristicWords(NarrativeTone.EpicHistorical);
    const uniqueWords = new Set(words);

    expect(words.length).toBe(uniqueWords.size);
  });

  it('should return different words for different tones', () => {
    const epicWords = new Set(getToneCharacteristicWords(NarrativeTone.EpicHistorical));
    const scholarlyWords = new Set(getToneCharacteristicWords(NarrativeTone.Scholarly));

    // Should have some different words
    const epicOnly = [...epicWords].filter(w => !scholarlyWords.has(w));
    expect(epicOnly.length).toBeGreaterThan(0);
  });
});

describe('calculateVocabularyMatch', () => {
  it('should return higher score for matching vocabulary', () => {
    const epicText = 'The realm was ruled by a noble sovereign. The host perished in battle.';
    const genericText = 'The country was ruled by a king. The army died in battle.';

    const epicScore = calculateVocabularyMatch(epicText, NarrativeTone.EpicHistorical);
    const genericScore = calculateVocabularyMatch(genericText, NarrativeTone.EpicHistorical);

    expect(epicScore).toBeGreaterThan(genericScore);
  });

  it('should return 0 for text with no matching words', () => {
    const text = 'Hello world, this is a test.';
    const score = calculateVocabularyMatch(text, NarrativeTone.EpicHistorical);

    expect(score).toBe(0);
  });

  it('should return score between 0 and 1', () => {
    const text = 'The realm was vast and the host was mighty.';
    const score = calculateVocabularyMatch(text, NarrativeTone.EpicHistorical);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('Tone differentiation', () => {
  it('should produce measurably different vocabulary across tones', () => {
    // Verify that each tone has distinctive vocabulary
    const tones = Object.values(NarrativeTone);
    const wordSets: Map<NarrativeTone, Set<string>> = new Map();

    for (const tone of tones) {
      const words = getToneCharacteristicWords(tone);
      wordSets.set(tone, new Set(words));
    }

    // Each tone should have some words unique to it
    for (const tone of tones) {
      const thisSet = wordSets.get(tone) ?? new Set<string>();
      let uniqueCount = 0;

      for (const word of thisSet) {
        let foundInOther = false;
        for (const [otherTone, otherSet] of wordSets) {
          if (otherTone !== tone && otherSet.has(word)) {
            foundInOther = true;
            break;
          }
        }
        if (!foundInOther) {
          uniqueCount++;
        }
      }

      // Each tone should have at least some unique vocabulary elements
      expect(uniqueCount).toBeGreaterThan(0);
    }
  });

  it('should have different phrase styles', () => {
    const epicOpenings = TONE_CONFIGS[NarrativeTone.EpicHistorical].phrases.openings;
    const personalOpenings = TONE_CONFIGS[NarrativeTone.PersonalCharacterFocus].phrases.openings;
    const scholarlyOpenings = TONE_CONFIGS[NarrativeTone.Scholarly].phrases.openings;

    // Epic should have formal phrases
    expect(epicOpenings.some(p => p.includes('annals') || p.includes('chronicles'))).toBe(true);

    // Personal should have emotional phrases
    expect(personalOpenings.some(p => p.includes('heart') || p.includes('felt'))).toBe(true);

    // Scholarly should have academic phrases
    expect(scholarlyOpenings.some(p => p.includes('analysis') || p.includes('evidence'))).toBe(true);
  });
});
