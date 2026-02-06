/**
 * Tests for VignetteGenerator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VignetteGenerator } from './vignette-generator.js';
import type { VignetteGeneratorContext } from './vignette-generator.js';
import {
  EmotionalContent,
  VignetteArchetype,
  VignetteMood,
} from './vignette-trigger.js';
import type { VignetteTriggerResult } from './vignette-trigger.js';
import type { EntityId, CharacterId } from '@fws/core';
import { toEntityId, toCharacterId, toFactionId, toSiteId, toEventId, EventCategory, PersonalityTrait } from '@fws/core';
import type { WorldEvent } from '@fws/core';

describe('VignetteGenerator', () => {
  let generator: VignetteGenerator;
  const char1 = toCharacterId(toEntityId(100));
  const char2 = toCharacterId(toEntityId(101));
  const faction1 = toFactionId(toEntityId(200));
  const site1 = toSiteId(toEntityId(300));

  beforeEach(() => {
    // Use deterministic RNG for tests
    let seed = 12345;
    const deterministicRng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    generator = new VignetteGenerator(deterministicRng);
  });

  function createTestEvent(overrides?: Partial<WorldEvent>): WorldEvent {
    return {
      id: toEventId(toEntityId(1)),
      category: EventCategory.Political,
      subtype: 'treaty_signed',
      timestamp: 1000,
      participants: [char1 as EntityId, char2 as EntityId],
      causes: [],
      consequences: [],
      data: {},
      significance: 80,
      consequencePotential: [],
      location: site1,
      ...overrides,
    };
  }

  function createTestTriggerResult(overrides?: Partial<VignetteTriggerResult>): VignetteTriggerResult {
    return {
      shouldTrigger: true,
      archetype: VignetteArchetype.TheAscension,
      primaryEmotion: EmotionalContent.Triumph,
      secondaryEmotions: [],
      triggerStrength: 0.8,
      focalCharacter: char1,
      supportingCharacters: [char2],
      suggestedMood: VignetteMood.Triumphant,
      keyElements: ['coronation', 'emotion:triumph'],
      ...overrides,
    };
  }

  function createTestContext(
    event: WorldEvent,
    triggerResult: VignetteTriggerResult,
    overrides?: Partial<VignetteGeneratorContext>
  ): VignetteGeneratorContext {
    return {
      event,
      triggerResult,
      entityNames: new Map([
        [char1 as EntityId, 'King Aldric'],
        [char2 as EntityId, 'Lord Brennan'],
      ]),
      factionNames: new Map([[faction1, 'Kingdom of Valdoria']]),
      siteNames: new Map([[site1, 'Castle Ironhold']]),
      characterTraits: new Map<CharacterId, ReadonlyMap<PersonalityTrait, number>>([
        [char1, new Map<PersonalityTrait, number>([[PersonalityTrait.Ambitious, 75]])],
        [char2, new Map<PersonalityTrait, number>([[PersonalityTrait.Brave, 60]])],
      ]),
      characterTitles: new Map([
        [char1, 'King'],
        [char2, 'Lord'],
      ]),
      characterGenders: new Map([
        [char1, 'male'],
        [char2, 'male'],
      ]),
      ...overrides,
    };
  }

  describe('generate', () => {
    it('should generate a vignette with all required fields', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult();
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.id).toMatch(/^vignette_\d+$/);
      expect(vignette.eventId).toBe(event.id);
      expect(vignette.archetype).toBe(triggerResult.archetype);
      expect(vignette.emotion).toBe(triggerResult.primaryEmotion);
      expect(vignette.mood).toBe(triggerResult.suggestedMood);
      expect(vignette.focalCharacter).toBe(triggerResult.focalCharacter);
    });

    it('should generate prose between 200-500 words', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult();
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.wordCount).toBeGreaterThanOrEqual(200);
      expect(vignette.wordCount).toBeLessThanOrEqual(500);
    });

    it('should include focal character name in prose', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult();
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.prose).toContain('King Aldric');
    });

    it('should include location name when available', () => {
      const event = createTestEvent({ location: site1 });
      // Use BeforeTheStorm archetype which includes {location} in templates
      const triggerResult = createTestTriggerResult({
        archetype: VignetteArchetype.BeforeTheStorm,
        primaryEmotion: EmotionalContent.Terror,
        suggestedMood: VignetteMood.Foreboding,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.prose).toContain('Castle Ironhold');
    });

    it('should use correct pronouns for male characters', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({ focalCharacter: char1 });
      const context = createTestContext(event, triggerResult, {
        characterGenders: new Map([[char1, 'male'], [char2, 'male']]),
      });

      const vignette = generator.generate(context);

      // Should use he/him/his/himself
      expect(vignette.prose).toMatch(/\b(he|him|his|himself)\b/i);
    });

    it('should use correct pronouns for female characters', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({ focalCharacter: char1 });
      const context = createTestContext(event, triggerResult, {
        entityNames: new Map([
          [char1 as EntityId, 'Queen Elena'],
          [char2 as EntityId, 'Lady Mira'],
        ]),
        characterGenders: new Map([[char1, 'female'], [char2, 'female']]),
      });

      const vignette = generator.generate(context);

      // Should use she/her/her/herself
      expect(vignette.prose).toMatch(/\b(she|her|herself)\b/i);
    });

    it('should use correct pronouns for neutral characters', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({ focalCharacter: char1 });
      const context = createTestContext(event, triggerResult, {
        entityNames: new Map([
          [char1 as EntityId, 'The Sage'],
          [char2 as EntityId, 'The Oracle'],
        ]),
        characterGenders: new Map([[char1, 'neutral'], [char2, 'neutral']]),
      });

      const vignette = generator.generate(context);

      // Should use they/them/their/themselves
      expect(vignette.prose).toMatch(/\b(they|them|their|themselves)\b/i);
    });

    it('should track featured characters', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({
        focalCharacter: char1,
        supportingCharacters: [char2],
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.featuredCharacters).toContain(char1);
    });

    it('should include location in vignette', () => {
      const event = createTestEvent({ location: site1 });
      const triggerResult = createTestTriggerResult();
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.location).toBe(site1);
    });

    it('should set generation timestamp', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult();
      const context = createTestContext(event, triggerResult);

      const before = new Date();
      const vignette = generator.generate(context);
      const after = new Date();

      expect(vignette.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(vignette.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('archetypes', () => {
    it('should generate appropriate prose for BeforeTheStorm', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({
        archetype: VignetteArchetype.BeforeTheStorm,
        primaryEmotion: EmotionalContent.Terror,
        suggestedMood: VignetteMood.Foreboding,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.archetype).toBe(VignetteArchetype.BeforeTheStorm);
      expect(vignette.prose.length).toBeGreaterThan(0);
    });

    it('should generate appropriate prose for TheDiscovery', () => {
      const event = createTestEvent({ subtype: 'artifact_found' });
      const triggerResult = createTestTriggerResult({
        archetype: VignetteArchetype.TheDiscovery,
        primaryEmotion: EmotionalContent.Discovery,
        suggestedMood: VignetteMood.Hopeful,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.archetype).toBe(VignetteArchetype.TheDiscovery);
      expect(vignette.prose.length).toBeGreaterThan(0);
    });

    it('should generate appropriate prose for TheConfrontation', () => {
      const event = createTestEvent({ subtype: 'confrontation' });
      const triggerResult = createTestTriggerResult({
        archetype: VignetteArchetype.TheConfrontation,
        primaryEmotion: EmotionalContent.Reckoning,
        suggestedMood: VignetteMood.Tense,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.archetype).toBe(VignetteArchetype.TheConfrontation);
      expect(vignette.prose.length).toBeGreaterThan(0);
    });

    it('should generate appropriate prose for TheFarewell', () => {
      const event = createTestEvent({ subtype: 'exile' });
      const triggerResult = createTestTriggerResult({
        archetype: VignetteArchetype.TheFarewell,
        primaryEmotion: EmotionalContent.Loss,
        suggestedMood: VignetteMood.Melancholy,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.archetype).toBe(VignetteArchetype.TheFarewell);
      expect(vignette.prose.length).toBeGreaterThan(0);
    });

    it('should generate appropriate prose for TheFall', () => {
      const event = createTestEvent({ subtype: 'abdication' });
      const triggerResult = createTestTriggerResult({
        archetype: VignetteArchetype.TheFall,
        primaryEmotion: EmotionalContent.Humiliation,
        suggestedMood: VignetteMood.Foreboding,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.archetype).toBe(VignetteArchetype.TheFall);
      expect(vignette.prose.length).toBeGreaterThan(0);
    });

    it('should generate appropriate prose for TheSacrifice', () => {
      const event = createTestEvent({ subtype: 'sacrifice' });
      const triggerResult = createTestTriggerResult({
        archetype: VignetteArchetype.TheSacrifice,
        primaryEmotion: EmotionalContent.Sacrifice,
        suggestedMood: VignetteMood.Melancholy,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.archetype).toBe(VignetteArchetype.TheSacrifice);
      expect(vignette.prose.length).toBeGreaterThan(0);
    });

    it('should generate appropriate prose for TheReunion', () => {
      const event = createTestEvent({ subtype: 'return' });
      const triggerResult = createTestTriggerResult({
        archetype: VignetteArchetype.TheReunion,
        primaryEmotion: EmotionalContent.Reunion,
        suggestedMood: VignetteMood.Bittersweet,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.archetype).toBe(VignetteArchetype.TheReunion);
      expect(vignette.prose.length).toBeGreaterThan(0);
    });
  });

  describe('moods', () => {
    it('should incorporate foreboding mood elements', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({
        suggestedMood: VignetteMood.Foreboding,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      // Should contain mood-related words
      const moodWords = ['dark', 'ominous', 'heavy', 'looming', 'shadowed', 'grim', 'atmosphere', 'felt'];
      expect(moodWords.some(word => vignette.prose.toLowerCase().includes(word))).toBe(true);
    });

    it('should incorporate triumphant mood elements', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({
        suggestedMood: VignetteMood.Triumphant,
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      // Should contain mood-related words
      const moodWords = ['soaring', 'blazing', 'golden', 'radiant', 'magnificent', 'glorious', 'atmosphere', 'felt'];
      expect(moodWords.some(word => vignette.prose.toLowerCase().includes(word))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing focal character', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({
        focalCharacter: undefined,
        supportingCharacters: [],
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.focalCharacter).toBeUndefined();
      expect(vignette.prose.length).toBeGreaterThan(0);
      // Should use fallback "the figure"
      expect(vignette.prose.toLowerCase()).toContain('the figure');
    });

    it('should handle missing location', () => {
      // Create event without location property
      const event: WorldEvent = {
        id: toEventId(toEntityId(1)),
        category: EventCategory.Political,
        subtype: 'treaty_signed',
        timestamp: 1000,
        participants: [char1 as EntityId, char2 as EntityId],
        causes: [],
        consequences: [],
        data: {},
        significance: 80,
        consequencePotential: [],
        // location intentionally omitted
      };
      const triggerResult = createTestTriggerResult();
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.location).toBeUndefined();
      expect(vignette.prose.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs for multiple vignettes', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult();
      const context = createTestContext(event, triggerResult);

      const vignette1 = generator.generate(context);
      const vignette2 = generator.generate(context);
      const vignette3 = generator.generate(context);

      expect(vignette1.id).not.toBe(vignette2.id);
      expect(vignette2.id).not.toBe(vignette3.id);
      expect(vignette1.id).not.toBe(vignette3.id);
    });

    it('should handle empty supporting characters', () => {
      const event = createTestEvent();
      const triggerResult = createTestTriggerResult({
        supportingCharacters: [],
      });
      const context = createTestContext(event, triggerResult);

      const vignette = generator.generate(context);

      expect(vignette.featuredCharacters).toContain(char1);
      expect(vignette.prose.length).toBeGreaterThan(0);
    });
  });
});
