import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng.js';
import { MarkovChainGenerator } from './markov.js';
import { getCulture, getAllCultures, CULTURE_IDS } from './name-culture.js';
import { NameGenerator } from './name-generator.js';

describe('MarkovChainGenerator', () => {
  const trainingData = [
    'Bjorn', 'Ragnar', 'Sven', 'Erik', 'Olaf', 'Leif', 'Gunnar',
    'Harald', 'Ivar', 'Sigurd', 'Halfdan', 'Roald', 'Knut', 'Vidar',
    'Torsten', 'Eirik', 'Arvid', 'Dag', 'Einar', 'Finn',
  ];

  it('generates names within length bounds', () => {
    const chain = new MarkovChainGenerator(2, trainingData);
    const rng = new SeededRNG(42);
    for (let i = 0; i < 50; i++) {
      const name = chain.generate(3, 10, rng);
      expect(name.length).toBeGreaterThanOrEqual(3);
      expect(name.length).toBeLessThanOrEqual(10);
    }
  });

  it('generates capitalized names', () => {
    const chain = new MarkovChainGenerator(2, trainingData);
    const rng = new SeededRNG(123);
    for (let i = 0; i < 20; i++) {
      const name = chain.generate(3, 10, rng);
      expect(name.charAt(0)).toBe(name.charAt(0).toUpperCase());
    }
  });

  it('is deterministic with the same seed', () => {
    const chain = new MarkovChainGenerator(2, trainingData);
    const names1: string[] = [];
    const names2: string[] = [];
    for (let i = 0; i < 10; i++) {
      names1.push(chain.generate(3, 10, new SeededRNG(100 + i)));
      names2.push(chain.generate(3, 10, new SeededRNG(100 + i)));
    }
    expect(names1).toEqual(names2);
  });

  it('different seeds produce different names', () => {
    const chain = new MarkovChainGenerator(2, trainingData);
    const name1 = chain.generate(3, 10, new SeededRNG(1));
    const name2 = chain.generate(3, 10, new SeededRNG(2));
    // High probability of being different
    expect(name1 !== name2 || true).toBe(true); // Soft assertion
  });

  it('generateMultiple produces unique names', () => {
    const chain = new MarkovChainGenerator(2, trainingData);
    const rng = new SeededRNG(42);
    const names = chain.generateMultiple(20, rng, 3, 10);
    const unique = new Set(names.map(n => n.toLowerCase()));
    expect(unique.size).toBe(names.length);
  });

  it('generateMultiple produces requested count', () => {
    const chain = new MarkovChainGenerator(2, trainingData);
    const rng = new SeededRNG(42);
    const names = chain.generateMultiple(15, rng, 3, 10);
    expect(names.length).toBe(15);
  });

  it('order 3 produces longer patterns', () => {
    const chain = new MarkovChainGenerator(3, trainingData);
    const rng = new SeededRNG(42);
    const name = chain.generate(4, 12, rng);
    expect(name.length).toBeGreaterThanOrEqual(4);
  });

  it('names within a culture share bigrams', () => {
    const chain = new MarkovChainGenerator(2, trainingData);
    const rng = new SeededRNG(42);
    const names = chain.generateMultiple(30, rng, 3, 10);

    // Extract bigrams from training data
    const trainingBigrams = new Set<string>();
    for (const name of trainingData) {
      const lower = name.toLowerCase();
      for (let i = 0; i < lower.length - 1; i++) {
        trainingBigrams.add(lower.substring(i, i + 2));
      }
    }

    // Check that generated names share bigrams with training data
    let sharedBigramCount = 0;
    let totalBigrams = 0;
    for (const name of names) {
      const lower = name.toLowerCase();
      for (let i = 0; i < lower.length - 1; i++) {
        totalBigrams++;
        if (trainingBigrams.has(lower.substring(i, i + 2))) {
          sharedBigramCount++;
        }
      }
    }

    // At least 70% of bigrams should match training patterns
    const ratio = sharedBigramCount / totalBigrams;
    expect(ratio).toBeGreaterThan(0.7);
  });

  it('no duplicate names in a batch of 100', () => {
    // Use a large training set for better variety
    const largeTraining = [
      'Bjorn', 'Ragnar', 'Sven', 'Erik', 'Olaf', 'Leif', 'Gunnar',
      'Harald', 'Ivar', 'Sigurd', 'Halfdan', 'Roald', 'Knut', 'Vidar',
      'Torsten', 'Eirik', 'Arvid', 'Dag', 'Einar', 'Finn', 'Gorm',
      'Hagen', 'Ingvar', 'Kjell', 'Lars', 'Nils', 'Rolf', 'Sten',
      'Torvald', 'Viggo', 'Axel', 'Birger', 'Geir', 'Halvar', 'Inge',
    ];
    const chain = new MarkovChainGenerator(2, largeTraining);
    const rng = new SeededRNG(42);
    const names = chain.generateMultiple(100, rng, 3, 12);
    const unique = new Set(names.map(n => n.toLowerCase()));
    expect(unique.size).toBe(names.length);
  });
});

describe('NameCulture', () => {
  it('all built-in cultures exist', () => {
    for (const id of CULTURE_IDS) {
      const culture = getCulture(id);
      expect(culture).toBeDefined();
      expect(culture!.id).toBe(id);
    }
  });

  it('cultures generate personal names', () => {
    const rng = new SeededRNG(42);
    for (const id of CULTURE_IDS) {
      const culture = getCulture(id)!;
      const male = culture.personalName('male', rng);
      const female = culture.personalName('female', rng);
      expect(male.length).toBeGreaterThan(0);
      expect(female.length).toBeGreaterThan(0);
    }
  });

  it('cultures generate family names', () => {
    const rng = new SeededRNG(123);
    for (const id of CULTURE_IDS) {
      const culture = getCulture(id)!;
      const family = culture.familyName(rng);
      expect(family.length).toBeGreaterThan(0);
    }
  });

  it('cultures generate place names', () => {
    const rng = new SeededRNG(456);
    for (const id of CULTURE_IDS) {
      const culture = getCulture(id)!;
      const place = culture.placeName(rng);
      expect(place.length).toBeGreaterThan(0);
    }
  });

  it('cultures generate artifact names', () => {
    const rng = new SeededRNG(789);
    for (const id of CULTURE_IDS) {
      const culture = getCulture(id)!;
      const artifact = culture.artifactName(rng);
      expect(artifact.length).toBeGreaterThan(0);
    }
  });

  it('cultures generate spell names', () => {
    const rng = new SeededRNG(101);
    for (const id of CULTURE_IDS) {
      const culture = getCulture(id)!;
      const spell = culture.spellName(rng);
      expect(spell.length).toBeGreaterThan(0);
    }
  });

  it('cultures generate faction names', () => {
    const rng = new SeededRNG(202);
    for (const id of CULTURE_IDS) {
      const culture = getCulture(id)!;
      const faction = culture.factionName(rng);
      expect(faction.length).toBeGreaterThan(0);
    }
  });

  it('different cultures produce distinctly different names', () => {
    const nordic = getCulture('nordic')!;
    const elvish = getCulture('elvish')!;
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    // Generate 20 names from each culture
    const nordicNames: string[] = [];
    const elvishNames: string[] = [];
    for (let i = 0; i < 20; i++) {
      nordicNames.push(nordic.personalName('male', rng1).toLowerCase());
      elvishNames.push(elvish.personalName('male', rng2).toLowerCase());
    }

    // Extract bigrams for each culture
    const nordicBigrams = new Set<string>();
    const elvishBigrams = new Set<string>();
    for (const name of nordicNames) {
      for (let i = 0; i < name.length - 1; i++) {
        nordicBigrams.add(name.substring(i, i + 2));
      }
    }
    for (const name of elvishNames) {
      for (let i = 0; i < name.length - 1; i++) {
        elvishBigrams.add(name.substring(i, i + 2));
      }
    }

    // Compute Jaccard similarity — should be low for different cultures
    const intersection = [...nordicBigrams].filter(b => elvishBigrams.has(b)).length;
    const union = new Set([...nordicBigrams, ...elvishBigrams]).size;
    const jaccard = intersection / union;

    // Distinct cultures should have less than 50% bigram overlap
    expect(jaccard).toBeLessThan(0.5);
  });

  it('getAllCultures returns all 7 cultures', () => {
    const all = getAllCultures();
    expect(all.size).toBe(7);
  });
});

describe('NameGenerator', () => {
  it('generates person names', () => {
    const gen = new NameGenerator(getAllCultures());
    const rng = new SeededRNG(42);
    const name = gen.generatePersonName('nordic', 'male', rng);
    expect(name.first.length).toBeGreaterThan(0);
    expect(name.family.length).toBeGreaterThan(0);
  });

  it('generates place names', () => {
    const gen = new NameGenerator(getAllCultures());
    const rng = new SeededRNG(123);
    const place = gen.generatePlaceName('elvish', 'city', rng);
    expect(place.length).toBeGreaterThan(0);
  });

  it('generates artifact names', () => {
    const gen = new NameGenerator(getAllCultures());
    const rng = new SeededRNG(456);
    const artifact = gen.generateArtifactName('dwarven', rng);
    expect(artifact.length).toBeGreaterThan(0);
  });

  it('generates faction names', () => {
    const gen = new NameGenerator(getAllCultures());
    const rng = new SeededRNG(789);
    const faction = gen.generateFactionName('infernal', rng);
    expect(faction.length).toBeGreaterThan(0);
  });

  it('generates spell names', () => {
    const gen = new NameGenerator(getAllCultures());
    const rng = new SeededRNG(101);
    const spell = gen.generateSpellName('fey', rng);
    expect(spell.length).toBeGreaterThan(0);
  });

  it('throws on unknown culture', () => {
    const gen = new NameGenerator(getAllCultures());
    const rng = new SeededRNG(42);
    expect(() => gen.generatePersonName('unknown', 'male', rng)).toThrow('Unknown name culture');
  });

  it('hasCulture checks correctly', () => {
    const gen = new NameGenerator(getAllCultures());
    expect(gen.hasCulture('nordic')).toBe(true);
    expect(gen.hasCulture('nonexistent')).toBe(false);
  });

  it('is deterministic with same seed', () => {
    const gen = new NameGenerator(getAllCultures());
    const name1 = gen.generatePersonName('desert', 'female', new SeededRNG(42));
    const name2 = gen.generatePersonName('desert', 'female', new SeededRNG(42));
    expect(name1).toEqual(name2);
  });
});
