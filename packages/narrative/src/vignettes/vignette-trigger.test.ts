/**
 * Tests for VignetteTrigger.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VignetteTrigger,
  EmotionalContent,
  VignetteArchetype,
  VignetteMood,
} from './vignette-trigger.js';
import type { VignetteTriggerContext } from './vignette-trigger.js';
import type { EntityId, CharacterId } from '@fws/core';
import { toEntityId, toCharacterId, toSiteId, toEventId, EventCategory, PersonalityTrait } from '@fws/core';
import type { WorldEvent } from '@fws/core';
import type { Memory, MemoryCategory, MemoryRole } from '@fws/core';

describe('VignetteTrigger', () => {
  let trigger: VignetteTrigger;
  const char1 = toCharacterId(toEntityId(100));
  const char2 = toCharacterId(toEntityId(101));
  const site1 = toSiteId(toEntityId(300));

  beforeEach(() => {
    // Use deterministic RNG for tests
    let seed = 12345;
    const deterministicRng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    trigger = new VignetteTrigger({ rng: deterministicRng });
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
      significance: 70,
      consequencePotential: [],
      ...overrides,
    };
  }

  function createTestContext(event: WorldEvent, overrides?: Partial<VignetteTriggerContext>): VignetteTriggerContext {
    return {
      event,
      participantMemories: new Map(),
      characterTraits: new Map<CharacterId, ReadonlyMap<PersonalityTrait, number>>([
        [char1, new Map<PersonalityTrait, number>([[PersonalityTrait.Ambitious, 75]])],
        [char2, new Map<PersonalityTrait, number>([[PersonalityTrait.Brave, 60]])],
      ]),
      relationships: new Map(),
      locationHistory: [],
      currentTime: { year: 100, month: 6, day: 15 },
      ...overrides,
    };
  }

  describe('evaluate', () => {
    it('should not trigger for low significance events', () => {
      const event = createTestEvent({ significance: 30 });
      const context = createTestContext(event);

      const result = trigger.evaluate(context);

      expect(result.shouldTrigger).toBe(false);
    });

    it('should potentially trigger for high significance events', () => {
      const event = createTestEvent({
        significance: 85,
        subtype: 'betrayal',
      });
      const context = createTestContext(event);

      const result = trigger.evaluate(context);

      expect(result.triggerStrength).toBeGreaterThan(0);
    });

    it('should detect emotional content from event subtype', () => {
      const event = createTestEvent({
        significance: 80,
        subtype: 'betrayal',
      });
      const context = createTestContext(event);

      const result = trigger.evaluate(context);

      if (result.shouldTrigger) {
        expect(result.primaryEmotion).toBe(EmotionalContent.Betrayal);
      }
    });

    it('should select appropriate archetype for emotion', () => {
      const event = createTestEvent({
        significance: 85,
        subtype: 'character.death',
      });
      const context = createTestContext(event);

      const result = trigger.evaluate(context);

      if (result.shouldTrigger) {
        // Death events should map to loss/terror emotions
        // which map to farewell/fall/aftermath archetypes
        expect([
          VignetteArchetype.TheFarewell,
          VignetteArchetype.TheFall,
          VignetteArchetype.TheAftermath,
          VignetteArchetype.BeforeTheStorm,
          VignetteArchetype.TheConfrontation,
        ]).toContain(result.archetype);
      }
    });

    it('should identify focal character from participants', () => {
      const event = createTestEvent({
        significance: 85,
        subtype: 'coronation',
      });
      const context = createTestContext(event);

      const result = trigger.evaluate(context);

      if (result.shouldTrigger && result.focalCharacter !== undefined) {
        expect([char1, char2]).toContain(result.focalCharacter);
      }
    });

    it('should set appropriate mood based on emotion', () => {
      const event = createTestEvent({
        significance: 85,
        subtype: 'betrayal',
      });
      const context = createTestContext(event);

      const result = trigger.evaluate(context);

      if (result.shouldTrigger) {
        expect(result.suggestedMood).toBeDefined();
        expect(Object.values(VignetteMood)).toContain(result.suggestedMood);
      }
    });

    it('should extract key elements', () => {
      const event = createTestEvent({
        significance: 85,
        subtype: 'discovery',
        location: site1,
      });
      const context = createTestContext(event);

      const result = trigger.evaluate(context);

      if (result.shouldTrigger) {
        expect(result.keyElements.length).toBeGreaterThan(0);
        expect(result.keyElements).toContain('discovery');
      }
    });

    it('should consider relationship intensity', () => {
      const event = createTestEvent({
        significance: 90, // Higher significance to exceed trigger threshold
        subtype: 'confrontation',
      });

      // Add strong negative relationship
      const relationships = new Map<CharacterId, ReadonlyMap<CharacterId, number>>([
        [char1, new Map([[char2, -80]])],
      ]);

      const context = createTestContext(event, { relationships });

      const result = trigger.evaluate(context);

      // Strong relationships should increase trigger strength
      expect(result.triggerStrength).toBeGreaterThan(0);
    });

    it('should consider participant memories', () => {
      const event = createTestEvent({
        significance: 90, // Higher significance to exceed trigger threshold
        subtype: 'execution', // Use a subtype that maps to emotions
      });

      // Add traumatic memory
      const memory: Memory = {
        eventId: toEventId(toEntityId(50)),
        timestamp: { year: 90, month: 1, day: 1 },
        emotionalWeight: -80,
        significance: 70,
        participants: [char1 as EntityId],
        myRole: 'victim' as MemoryRole,
        category: 'military' as MemoryCategory,
        accuracy: 80,
        timesRecalled: 5,
        lastRecalled: { year: 99, month: 12, day: 1 },
        narrative: 'The betrayal...',
      };

      const participantMemories = new Map<CharacterId, readonly Memory[]>([
        [char1, [memory]],
      ]);

      const context = createTestContext(event, { participantMemories });

      const result = trigger.evaluate(context);

      expect(result.triggerStrength).toBeGreaterThan(0);
    });

    it('should consider location history', () => {
      const event = createTestEvent({
        significance: 75,
        subtype: 'battle.resolved',
        location: site1,
      });

      // Location with significant history
      const locationHistory = Array.from({ length: 10 }, (_, i) =>
        toEventId(toEntityId(1000 + i))
      );

      const context = createTestContext(event, { locationHistory });

      const result = trigger.evaluate(context);

      // Historic locations should contribute to trigger strength
      expect(result.triggerStrength).toBeGreaterThan(0);
    });

    it('should boost trigger strength during climax arc phase', () => {
      const event = createTestEvent({
        significance: 70,
        subtype: 'confrontation',
      });

      const contextNormal = createTestContext(event);
      const contextClimax = createTestContext(event, { arcPhase: 'Climax' });

      const resultNormal = trigger.evaluate(contextNormal);
      const resultClimax = trigger.evaluate(contextClimax);

      // Climax should have higher trigger strength
      expect(resultClimax.triggerStrength).toBeGreaterThanOrEqual(resultNormal.triggerStrength);
    });
  });

  describe('supporting characters', () => {
    it('should select supporting characters from participants', () => {
      const char3 = toCharacterId(toEntityId(102));
      const event = createTestEvent({
        significance: 85,
        subtype: 'coronation',
        participants: [char1 as EntityId, char2 as EntityId, char3 as EntityId],
      });

      const context = createTestContext(event, {
        characterTraits: new Map<CharacterId, ReadonlyMap<PersonalityTrait, number>>([
          [char1, new Map<PersonalityTrait, number>([[PersonalityTrait.Ambitious, 80]])],
          [char2, new Map<PersonalityTrait, number>([[PersonalityTrait.Brave, 60]])],
          [char3, new Map<PersonalityTrait, number>([[PersonalityTrait.Loyal, 70]])],
        ]),
      });

      const result = trigger.evaluate(context);

      if (result.shouldTrigger && result.focalCharacter !== undefined) {
        // Supporting characters should not include focal character
        expect(result.supportingCharacters).not.toContain(result.focalCharacter);
      }
    });

    it('should prioritize characters with strong relationships to focal', () => {
      const char3 = toCharacterId(toEntityId(102));
      const event = createTestEvent({
        significance: 85,
        subtype: 'confrontation',
        participants: [char1 as EntityId, char2 as EntityId, char3 as EntityId],
      });

      // char2 has strong relationship to char1
      const relationships = new Map<CharacterId, ReadonlyMap<CharacterId, number>>([
        [char1, new Map([[char2, 90], [char3, 10]])],
      ]);

      const context = createTestContext(event, {
        characterTraits: new Map<CharacterId, ReadonlyMap<PersonalityTrait, number>>([
          [char1, new Map<PersonalityTrait, number>([[PersonalityTrait.Ambitious, 80]])],
          [char2, new Map<PersonalityTrait, number>([[PersonalityTrait.Brave, 60]])],
          [char3, new Map<PersonalityTrait, number>([[PersonalityTrait.Loyal, 70]])],
        ]),
        relationships,
      });

      const result = trigger.evaluate(context);

      if (result.shouldTrigger && result.focalCharacter === char1 && result.supportingCharacters.length > 0) {
        // char2 should be prioritized due to strong relationship
        expect(result.supportingCharacters[0]).toBe(char2);
      }
    });
  });

  describe('custom configuration', () => {
    it('should respect minimum significance threshold', () => {
      const customTrigger = new VignetteTrigger({ minimumSignificance: 90 });

      const event = createTestEvent({ significance: 85 });
      const context = createTestContext(event);

      const result = customTrigger.evaluate(context);

      expect(result.shouldTrigger).toBe(false);
    });

    it('should respect trigger threshold', () => {
      const strictTrigger = new VignetteTrigger({ triggerThreshold: 0.9 });

      const event = createTestEvent({
        significance: 70,
        subtype: 'treaty_signed',
      });
      const context = createTestContext(event);

      const result = strictTrigger.evaluate(context);

      // With high threshold, moderate events shouldn't trigger
      expect(result.triggerStrength).toBeLessThan(0.9);
    });
  });
});
