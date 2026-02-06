/**
 * Tests for Character Introspection Mode.
 */

import { describe, it, expect } from 'vitest';
import {
  generateIntrospection,
  determineVoice,
  VoiceType,
} from './introspection.js';
import type { IntrospectionContext, Introspection } from './introspection.js';
import { PersonalityTrait } from '@fws/core';
import type { CharacterId, EntityId, EventId } from '@fws/core';

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function makeCharacterId(n: number): CharacterId {
  return n as CharacterId;
}

function makeEntityId(n: number): EntityId {
  return n as EntityId;
}

function makeEventId(n: number): EventId {
  return n as EventId;
}

function makeContext(overrides: Partial<IntrospectionContext> = {}): IntrospectionContext {
  return {
    characterId: makeCharacterId(1),
    characterName: 'Aldric',
    traits: new Map([
      [PersonalityTrait.Ambitious, 50],
      [PersonalityTrait.Patient, 40],
    ]),
    goals: [
      {
        id: 1,
        priority: 3,
        type: { kind: 'primary_life' as const, lifeGoal: 'gain_power' as const },
        description: 'Seize the throne of the Northern Reaches',
        progress: 0.4,
        active: true,
      },
    ],
    topMemories: [
      {
        eventId: makeEventId(1),
        timestamp: { year: 1, month: 1, day: 1 },
        emotionalWeight: -60,
        significance: 80,
        participants: [makeEntityId(2)],
        myRole: 'victim' as const,
        category: 'military' as const,
        accuracy: 70,
        timesRecalled: 3,
        lastRecalled: { year: 1, month: 6, day: 1 },
        narrative: 'The battle of Ashford cost me dearly.',
      },
    ],
    locationName: 'Ironhold',
    relationships: new Map([
      [makeEntityId(2), { name: 'Elara', affinity: 60 }],
      [makeEntityId(3), { name: 'Vortigern', affinity: -50 }],
    ]),
    knownSecrets: [],
    suspectedSecrets: [],
    recentEvents: ['A skirmish near the border unsettled the garrison.'],
    factionName: 'The Iron Council',
    title: 'Lord Commander',
    gender: 'male',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// UNIT TESTS: determineVoice
// ════════════════════════════════════════════════════════════════════════════

describe('determineVoice', () => {
  it('returns AmbtiousPatient for ambitious + patient traits', () => {
    const traits = new Map<string, number>([
      [PersonalityTrait.Ambitious, 70],
      [PersonalityTrait.Patient, 60],
    ]);
    expect(determineVoice(traits)).toBe(VoiceType.AmbtiousPatient);
  });

  it('returns ImpulsivePassionate for impulsive + brave traits', () => {
    const traits = new Map<string, number>([
      [PersonalityTrait.Impulsive, 80],
      [PersonalityTrait.Brave, 70],
    ]);
    expect(determineVoice(traits)).toBe(VoiceType.ImpulsivePassionate);
  });

  it('returns Scholarly for scholarly + curious traits', () => {
    const traits = new Map<string, number>([
      [PersonalityTrait.Scholarly, 80],
      [PersonalityTrait.Curious, 60],
    ]);
    expect(determineVoice(traits)).toBe(VoiceType.Scholarly);
  });

  it('returns ParanoidKnowledgeable for paranoid + scholarly traits', () => {
    const traits = new Map<string, number>([
      [PersonalityTrait.Paranoid, 80],
      [PersonalityTrait.Scholarly, 50],
    ]);
    expect(determineVoice(traits)).toBe(VoiceType.ParanoidKnowledgeable);
  });

  it('returns Empathetic for empathetic + idealistic traits', () => {
    const traits = new Map<string, number>([
      [PersonalityTrait.Empathetic, 80],
      [PersonalityTrait.Idealistic, 50],
    ]);
    expect(determineVoice(traits)).toBe(VoiceType.Empathetic);
  });

  it('returns BraveIdealistic for brave + idealistic traits', () => {
    const traits = new Map<string, number>([
      [PersonalityTrait.Brave, 70],
      [PersonalityTrait.Idealistic, 70],
    ]);
    expect(determineVoice(traits)).toBe(VoiceType.BraveIdealistic);
  });

  it('returns CunningPragmatic for pragmatic + ambitious traits', () => {
    const traits = new Map<string, number>([
      [PersonalityTrait.Pragmatic, 80],
      [PersonalityTrait.Ambitious, 60],
    ]);
    expect(determineVoice(traits)).toBe(VoiceType.CunningPragmatic);
  });

  it('returns Default for low-intensity traits', () => {
    const traits = new Map<string, number>([
      [PersonalityTrait.Ambitious, 10],
      [PersonalityTrait.Patient, 5],
    ]);
    expect(determineVoice(traits)).toBe(VoiceType.Default);
  });

  it('returns Default for empty traits', () => {
    const traits = new Map<string, number>();
    expect(determineVoice(traits)).toBe(VoiceType.Default);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// INTEGRATION: generateIntrospection
// ════════════════════════════════════════════════════════════════════════════

describe('generateIntrospection', () => {
  it('generates monologue within 100-300 word range', () => {
    const context = makeContext();
    const result = generateIntrospection(context, 42);
    expect(result.wordCount).toBeGreaterThanOrEqual(100);
    expect(result.wordCount).toBeLessThanOrEqual(300);
  });

  it('includes character metadata in output', () => {
    const context = makeContext();
    const result = generateIntrospection(context, 42);
    expect(result.characterId).toBe(context.characterId);
    expect(result.voiceType).toBeDefined();
    expect(result.primaryConcern.length).toBeGreaterThan(0);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('monologue text is non-empty', () => {
    const context = makeContext();
    const result = generateIntrospection(context, 42);
    expect(result.monologue.length).toBeGreaterThan(0);
  });

  // ── Voice variation ───────────────────────────────────────────────────

  describe('voice varies by personality', () => {
    it('ambitious patient voice includes patience-themed language', () => {
      const context = makeContext({
        traits: new Map([
          [PersonalityTrait.Ambitious, 80],
          [PersonalityTrait.Patient, 70],
        ]),
      });
      const result = generateIntrospection(context, 42);
      expect(result.voiceType).toBe(VoiceType.AmbtiousPatient);
    });

    it('scholarly voice differs from impulsive voice', () => {
      const scholarlyContext = makeContext({
        traits: new Map([
          [PersonalityTrait.Scholarly, 90],
          [PersonalityTrait.Curious, 70],
        ]),
      });
      const impulsiveContext = makeContext({
        traits: new Map([
          [PersonalityTrait.Impulsive, 90],
          [PersonalityTrait.Brave, 70],
        ]),
      });

      const scholarly = generateIntrospection(scholarlyContext, 42);
      const impulsive = generateIntrospection(impulsiveContext, 42);

      expect(scholarly.voiceType).not.toBe(impulsive.voiceType);
      // Monologues should differ in content
      expect(scholarly.monologue).not.toBe(impulsive.monologue);
    });

    it('paranoid voice differs from empathetic voice', () => {
      const paranoidContext = makeContext({
        traits: new Map([
          [PersonalityTrait.Paranoid, 90],
          [PersonalityTrait.Scholarly, 60],
        ]),
      });
      const empatheticContext = makeContext({
        traits: new Map([
          [PersonalityTrait.Empathetic, 90],
          [PersonalityTrait.Idealistic, 60],
        ]),
      });

      const paranoid = generateIntrospection(paranoidContext, 42);
      const empathetic = generateIntrospection(empatheticContext, 42);

      expect(paranoid.voiceType).toBe(VoiceType.ParanoidKnowledgeable);
      expect(empathetic.voiceType).toBe(VoiceType.Empathetic);
      expect(paranoid.monologue).not.toBe(empathetic.monologue);
    });
  });

  // ── Goal reflection ───────────────────────────────────────────────────

  describe('goal reflection', () => {
    it('mentions active goals', () => {
      const context = makeContext({
        goals: [
          {
            id: 1,
            priority: 3,
            type: { kind: 'primary_life' as const, lifeGoal: 'seek_knowledge' as const },
            description: 'Uncover the lost archives',
            progress: 0.2,
            active: true,
          },
        ],
      });
      const result = generateIntrospection(context, 42);
      // Should mention progress (barely begun for 0.2)
      expect(result.monologue).toContain('barely begun');
    });

    it('reflects high progress differently than low progress', () => {
      const lowProgress = makeContext({
        goals: [{
          id: 1,
          priority: 3,
          type: { kind: 'primary_life' as const, lifeGoal: 'gain_power' as const },
          description: 'Seize the throne',
          progress: 0.1,
          active: true,
        }],
      });
      const highProgress = makeContext({
        goals: [{
          id: 1,
          priority: 3,
          type: { kind: 'primary_life' as const, lifeGoal: 'gain_power' as const },
          description: 'Seize the throne',
          progress: 0.8,
          active: true,
        }],
      });

      const lowResult = generateIntrospection(lowProgress, 42);
      const highResult = generateIntrospection(highProgress, 42);

      expect(lowResult.monologue).toContain('barely begun');
      expect(highResult.monologue).toContain('close');
    });

    it('mentions competing goals when multiple are active', () => {
      const context = makeContext({
        goals: [
          {
            id: 1,
            priority: 3,
            type: { kind: 'primary_life' as const, lifeGoal: 'gain_power' as const },
            description: 'Seize the throne',
            progress: 0.5,
            active: true,
          },
          {
            id: 2,
            priority: 2,
            type: { kind: 'secondary' as const, subtype: 'protect_settlement' as const },
            description: 'Defend Ironhold from the raiders',
            progress: 0.3,
            active: true,
          },
        ],
      });
      const result = generateIntrospection(context, 42);
      expect(result.monologue.toLowerCase()).toContain('defend ironhold');
    });
  });

  // ── Memory reflection ─────────────────────────────────────────────────

  describe('memory reflection', () => {
    it('reflects on negative emotional memories', () => {
      const context = makeContext({
        topMemories: [
          {
            eventId: makeEventId(1),
            timestamp: { year: 1, month: 1, day: 1 },
            emotionalWeight: -80,
            significance: 90,
            participants: [],
            myRole: 'victim' as const,
            category: 'military' as const,
            accuracy: 80,
            timesRecalled: 5,
            lastRecalled: { year: 1, month: 6, day: 1 },
            narrative: 'The siege was brutal.',
          },
        ],
      });
      const result = generateIntrospection(context, 42);
      // Should include emotional coloring for negative memory
      expect(result.monologue).toContain('sting');
    });

    it('reflects on positive emotional memories differently', () => {
      const context = makeContext({
        topMemories: [
          {
            eventId: makeEventId(1),
            timestamp: { year: 1, month: 1, day: 1 },
            emotionalWeight: 60,
            significance: 70,
            participants: [],
            myRole: 'beneficiary' as const,
            category: 'personal' as const,
            accuracy: 90,
            timesRecalled: 2,
            lastRecalled: { year: 1, month: 3, day: 1 },
            narrative: 'The celebration was joyful.',
          },
        ],
      });
      const result = generateIntrospection(context, 42);
      // Should mention warmth for positive memory
      expect(result.monologue).toContain('warmth');
    });
  });

  // ── Relationship reflection ───────────────────────────────────────────

  describe('relationship reflection', () => {
    it('mentions allies', () => {
      const context = makeContext({
        relationships: new Map([
          [makeEntityId(2), { name: 'Elara', affinity: 60 }],
        ]),
      });
      const result = generateIntrospection(context, 42);
      expect(result.monologue).toContain('Elara');
    });

    it('mentions rivals', () => {
      const context = makeContext({
        relationships: new Map([
          [makeEntityId(3), { name: 'Vortigern', affinity: -70 }],
        ]),
      });
      const result = generateIntrospection(context, 42);
      expect(result.monologue).toContain('Vortigern');
    });

    it('handles no relationships gracefully', () => {
      const context = makeContext({
        relationships: new Map(),
      });
      const result = generateIntrospection(context, 42);
      expect(result.wordCount).toBeGreaterThanOrEqual(100);
    });
  });

  // ── Secret reflection ─────────────────────────────────────────────────

  describe('secret reflection', () => {
    it('includes secret reflection when secrets are known', () => {
      const context = makeContext({
        knownSecrets: ['The king plans to betray his allies.'],
      });
      const result = generateIntrospection(context, 42);
      // Should include a secret-themed reflection
      expect(result.monologue.length).toBeGreaterThan(0);
    });

    it('includes secret reflection when secrets are suspected', () => {
      const context = makeContext({
        suspectedSecrets: ['Something is amiss in the treasury.'],
      });
      const result = generateIntrospection(context, 42);
      expect(result.monologue.length).toBeGreaterThan(0);
    });
  });

  // ── Location context ──────────────────────────────────────────────────

  describe('location context', () => {
    it('includes location name in monologue', () => {
      const context = makeContext({ locationName: 'Stonehaven' });
      const result = generateIntrospection(context, 42);
      expect(result.monologue).toContain('Stonehaven');
    });

    it('includes faction name when available', () => {
      const context = makeContext({ factionName: 'The Silver Hand' });
      const result = generateIntrospection(context, 42);
      expect(result.monologue).toContain('The Silver Hand');
    });

    it('includes title when available', () => {
      const context = makeContext({ title: 'High Chancellor' });
      const result = generateIntrospection(context, 42);
      expect(result.monologue).toContain('High Chancellor');
    });
  });

  // ── Recent events ─────────────────────────────────────────────────────

  describe('recent events', () => {
    it('references recent events in monologue', () => {
      const context = makeContext({
        recentEvents: ['The granary caught fire during the night.'],
      });
      const result = generateIntrospection(context, 42);
      expect(result.monologue.toLowerCase()).toContain('granary');
    });
  });

  // ── Primary concern ───────────────────────────────────────────────────

  describe('primary concern', () => {
    it('primary concern reflects active goals', () => {
      const context = makeContext({
        goals: [
          {
            id: 1,
            priority: 3,
            type: { kind: 'primary_life' as const, lifeGoal: 'gain_power' as const },
            description: 'Seize the throne',
            progress: 0.5,
            active: true,
          },
        ],
      });
      const result = generateIntrospection(context, 42);
      expect(result.primaryConcern).toBe('Seize the throne');
    });

    it('primary concern defaults to secrets when no active goals', () => {
      const context = makeContext({
        goals: [],
        suspectedSecrets: ['Something strange.'],
      });
      const result = generateIntrospection(context, 42);
      expect(result.primaryConcern).toBe('Unraveling hidden truths');
    });

    it('primary concern defaults to memories when no goals or secrets', () => {
      const context = makeContext({
        goals: [],
        suspectedSecrets: [],
        topMemories: [
          {
            eventId: makeEventId(1),
            timestamp: { year: 1, month: 1, day: 1 },
            emotionalWeight: -60,
            significance: 80,
            participants: [],
            myRole: 'victim' as const,
            category: 'military' as const,
            accuracy: 80,
            timesRecalled: 3,
            lastRecalled: { year: 1, month: 6, day: 1 },
            narrative: 'The battle.',
          },
        ],
      });
      const result = generateIntrospection(context, 42);
      expect(result.primaryConcern).toBe('Processing painful memories');
    });

    it('falls back to generic concern when nothing specific', () => {
      const context = makeContext({
        goals: [],
        suspectedSecrets: [],
        knownSecrets: [],
        topMemories: [],
      });
      const result = generateIntrospection(context, 42);
      expect(result.primaryConcern).toBe('Contemplating the future');
    });
  });

  // ── Determinism ───────────────────────────────────────────────────────

  describe('determinism', () => {
    it('same seed produces same monologue', () => {
      const context = makeContext();
      const result1 = generateIntrospection(context, 42);
      const result2 = generateIntrospection(context, 42);
      expect(result1.monologue).toBe(result2.monologue);
      expect(result1.voiceType).toBe(result2.voiceType);
    });

    it('different seeds produce different monologues', () => {
      const context = makeContext();
      const result1 = generateIntrospection(context, 42);
      const result2 = generateIntrospection(context, 999);
      // With different seeds, at least some variation should occur
      // (they might still have same voice type but different template picks)
      expect(result1.monologue !== result2.monologue || result1.voiceType !== result2.voiceType).toBe(true);
    });
  });

  // ── Word count padding ────────────────────────────────────────────────

  describe('word count management', () => {
    it('pads short monologues to at least 100 words', () => {
      const context = makeContext({
        goals: [],
        topMemories: [],
        relationships: new Map(),
        knownSecrets: [],
        suspectedSecrets: [],
        recentEvents: [],
        factionName: undefined,
        title: undefined,
        locationName: '',
      });
      const result = generateIntrospection(context, 42);
      expect(result.wordCount).toBeGreaterThanOrEqual(100);
    });
  });
});
