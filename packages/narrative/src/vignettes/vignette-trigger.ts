/**
 * Vignette Trigger System - detects narrative moments worthy of micro-narrative vignettes.
 * Vignettes are 200-500 word prose passages that bring key moments to life.
 */

import type { EntityId, EventId, CharacterId, FactionId } from '@fws/core';
import type { WorldEvent } from '@fws/core';
import type { Memory } from '@fws/core';
import type { WorldTime } from '@fws/core';
import { PersonalityTrait } from '@fws/core';

/**
 * Emotional content categories for vignette triggers.
 * These represent the emotional core of a vignette-worthy moment.
 */
export enum EmotionalContent {
  /** Deep personal betrayal */
  Betrayal = 'betrayal',
  /** Profound loss - death, destruction, exile */
  Loss = 'loss',
  /** Great victory or achievement */
  Triumph = 'triumph',
  /** Romantic or familial love */
  Love = 'love',
  /** Public shame or defeat */
  Humiliation = 'humiliation',
  /** Revelation or discovery */
  Discovery = 'discovery',
  /** Moral choice or ethical dilemma */
  MoralCrisis = 'moral_crisis',
  /** Transformation or change */
  Transformation = 'transformation',
  /** Reunion after separation */
  Reunion = 'reunion',
  /** Sacrifice for others */
  Sacrifice = 'sacrifice',
  /** Confrontation with past */
  Reckoning = 'reckoning',
  /** Fear and terror */
  Terror = 'terror',
}

/**
 * Vignette archetypes - narrative patterns for structuring micro-narratives.
 */
export enum VignetteArchetype {
  /** Quiet moment before conflict - building tension */
  BeforeTheStorm = 'before_the_storm',
  /** Moment of finding something significant */
  TheDiscovery = 'the_discovery',
  /** Face-to-face encounter between opposed parties */
  TheConfrontation = 'the_confrontation',
  /** Moment of final parting */
  TheFarewell = 'the_farewell',
  /** Moment of crowning/ascending/triumph */
  TheAscension = 'the_ascension',
  /** Moment of defeat and despair */
  TheFall = 'the_fall',
  /** Moment of sacrifice or selfless act */
  TheSacrifice = 'the_sacrifice',
  /** Moment of realization or understanding */
  TheRevelation = 'the_revelation',
  /** Moment of choice between options */
  TheCrossroads = 'the_crossroads',
  /** Meeting again after long separation */
  TheReunion = 'the_reunion',
  /** Confronting one's own actions/past */
  TheReckoning = 'the_reckoning',
  /** Moment of transformation */
  TheChange = 'the_change',
  /** Quiet reflection on events */
  TheAftermath = 'the_aftermath',
  /** Confession or revelation of secret */
  TheConfession = 'the_confession',
  /** Making a vow or promise */
  TheOath = 'the_oath',
}

/**
 * A trigger condition that must be met for a vignette.
 */
export interface TriggerCondition {
  readonly type: TriggerConditionType;
  /** Minimum value for threshold-based conditions */
  readonly threshold?: number;
  /** Specific category, trait, or type required */
  readonly specificValue?: string;
  /** Whether this condition is optional vs required */
  readonly required: boolean;
  /** Weight for scoring (higher = more important) */
  readonly weight: number;
}

/**
 * Types of trigger conditions.
 */
export enum TriggerConditionType {
  /** Event significance above threshold */
  SignificanceThreshold = 'significance_threshold',
  /** Event is in specific category */
  EventCategory = 'event_category',
  /** Involves character with specific trait intensity */
  CharacterTrait = 'character_trait',
  /** Character has strong memory of related event */
  RelatedMemory = 'related_memory',
  /** Multiple factions involved */
  MultiFaction = 'multi_faction',
  /** Location has historical significance */
  HistoricLocation = 'historic_location',
  /** Character is at life milestone */
  LifeMilestone = 'life_milestone',
  /** Relationship threshold (love, hate, rivalry) */
  RelationshipIntensity = 'relationship_intensity',
  /** Time since last related event */
  TemporalDistance = 'temporal_distance',
  /** Narrative arc phase */
  ArcPhase = 'arc_phase',
}

/**
 * Result of evaluating vignette triggers.
 */
export interface VignetteTriggerResult {
  /** Whether a vignette should be generated */
  readonly shouldTrigger: boolean;
  /** The detected archetype for the vignette */
  readonly archetype: VignetteArchetype;
  /** Primary emotional content */
  readonly primaryEmotion: EmotionalContent;
  /** Secondary emotional elements */
  readonly secondaryEmotions: readonly EmotionalContent[];
  /** Score from 0-1 indicating how strongly this triggers */
  readonly triggerStrength: number;
  /** Focal character for the vignette (POV) */
  readonly focalCharacter: CharacterId | undefined;
  /** Additional characters to feature */
  readonly supportingCharacters: readonly CharacterId[];
  /** Suggested mood/tone */
  readonly suggestedMood: VignetteMood;
  /** Key elements to incorporate */
  readonly keyElements: readonly string[];
}

/**
 * Mood for vignette generation.
 */
export enum VignetteMood {
  /** Dark, ominous */
  Foreboding = 'foreboding',
  /** Hopeful, uplifting */
  Hopeful = 'hopeful',
  /** Melancholic, wistful */
  Melancholy = 'melancholy',
  /** Tense, anxious */
  Tense = 'tense',
  /** Triumphant, jubilant */
  Triumphant = 'triumphant',
  /** Serene, peaceful */
  Serene = 'serene',
  /** Horrific, terrifying */
  Horror = 'horror',
  /** Intimate, personal */
  Intimate = 'intimate',
  /** Epic, grand */
  Epic = 'epic',
  /** Bittersweet */
  Bittersweet = 'bittersweet',
}

/**
 * Context for vignette trigger evaluation.
 */
export interface VignetteTriggerContext {
  /** The event being evaluated */
  readonly event: WorldEvent;
  /** Participant memories of related events */
  readonly participantMemories: ReadonlyMap<CharacterId, readonly Memory[]>;
  /** Character trait intensities */
  readonly characterTraits: ReadonlyMap<CharacterId, ReadonlyMap<PersonalityTrait, number>>;
  /** Relationships between characters */
  readonly relationships: ReadonlyMap<CharacterId, ReadonlyMap<CharacterId, number>>;
  /** Historic events at this location */
  readonly locationHistory: readonly EventId[];
  /** Current narrative arc phase (if any) */
  readonly arcPhase?: string;
  /** Function to get character's faction */
  readonly getCharacterFaction?: (id: CharacterId) => FactionId | undefined;
  /** Function to get character age */
  readonly getCharacterAge?: (id: CharacterId) => number | undefined;
  /** Current world time */
  readonly currentTime: WorldTime;
}

/**
 * Mapping from event subtypes to likely emotional content.
 */
const EVENT_SUBTYPE_EMOTIONS: ReadonlyMap<string, EmotionalContent[]> = new Map([
  ['character.death', [EmotionalContent.Loss, EmotionalContent.Terror]],
  ['character.birth', [EmotionalContent.Love, EmotionalContent.Triumph]],
  ['battle.resolved', [EmotionalContent.Triumph, EmotionalContent.Loss, EmotionalContent.Terror]],
  ['alliance.formed', [EmotionalContent.Triumph, EmotionalContent.Love]],
  ['alliance.broken', [EmotionalContent.Betrayal, EmotionalContent.Loss]],
  ['betrayal', [EmotionalContent.Betrayal, EmotionalContent.Humiliation]],
  ['coronation', [EmotionalContent.Triumph, EmotionalContent.Transformation]],
  ['abdication', [EmotionalContent.Loss, EmotionalContent.Sacrifice]],
  ['exile', [EmotionalContent.Loss, EmotionalContent.Humiliation]],
  ['return', [EmotionalContent.Reunion, EmotionalContent.Triumph]],
  ['marriage', [EmotionalContent.Love, EmotionalContent.Transformation]],
  ['discovery', [EmotionalContent.Discovery, EmotionalContent.Triumph]],
  ['artifact_found', [EmotionalContent.Discovery]],
  ['artifact_lost', [EmotionalContent.Loss]],
  ['treaty_signed', [EmotionalContent.Triumph, EmotionalContent.Transformation]],
  ['treaty_broken', [EmotionalContent.Betrayal]],
  ['siege.begun', [EmotionalContent.Terror, EmotionalContent.MoralCrisis]],
  ['siege.ended', [EmotionalContent.Triumph, EmotionalContent.Loss]],
  ['secret_revealed', [EmotionalContent.Discovery, EmotionalContent.Betrayal]],
  ['divine_intervention', [EmotionalContent.Discovery, EmotionalContent.Terror]],
  ['prophecy', [EmotionalContent.Discovery, EmotionalContent.Terror]],
  ['resurrection', [EmotionalContent.Reunion, EmotionalContent.Transformation]],
  ['transformation', [EmotionalContent.Transformation, EmotionalContent.Terror]],
  ['sacrifice', [EmotionalContent.Sacrifice, EmotionalContent.Love]],
  ['execution', [EmotionalContent.Loss, EmotionalContent.Terror, EmotionalContent.Reckoning]],
  ['rebellion', [EmotionalContent.MoralCrisis, EmotionalContent.Transformation]],
  ['coup', [EmotionalContent.Betrayal, EmotionalContent.Transformation]],
]);

/**
 * Mapping from emotional content to archetypes.
 */
const EMOTION_ARCHETYPES: ReadonlyMap<EmotionalContent, VignetteArchetype[]> = new Map([
  [EmotionalContent.Betrayal, [VignetteArchetype.TheRevelation, VignetteArchetype.TheConfrontation, VignetteArchetype.TheReckoning]],
  [EmotionalContent.Loss, [VignetteArchetype.TheFarewell, VignetteArchetype.TheFall, VignetteArchetype.TheAftermath]],
  [EmotionalContent.Triumph, [VignetteArchetype.TheAscension, VignetteArchetype.TheAftermath]],
  [EmotionalContent.Love, [VignetteArchetype.TheReunion, VignetteArchetype.TheFarewell, VignetteArchetype.TheOath]],
  [EmotionalContent.Humiliation, [VignetteArchetype.TheFall, VignetteArchetype.TheReckoning]],
  [EmotionalContent.Discovery, [VignetteArchetype.TheDiscovery, VignetteArchetype.TheRevelation]],
  [EmotionalContent.MoralCrisis, [VignetteArchetype.TheCrossroads, VignetteArchetype.TheConfession]],
  [EmotionalContent.Transformation, [VignetteArchetype.TheChange, VignetteArchetype.TheAscension]],
  [EmotionalContent.Reunion, [VignetteArchetype.TheReunion, VignetteArchetype.TheAftermath]],
  [EmotionalContent.Sacrifice, [VignetteArchetype.TheSacrifice, VignetteArchetype.TheFarewell]],
  [EmotionalContent.Reckoning, [VignetteArchetype.TheReckoning, VignetteArchetype.TheConfrontation]],
  [EmotionalContent.Terror, [VignetteArchetype.BeforeTheStorm, VignetteArchetype.TheConfrontation]],
]);

/**
 * Mapping from emotion to mood.
 */
const EMOTION_MOODS: ReadonlyMap<EmotionalContent, VignetteMood> = new Map([
  [EmotionalContent.Betrayal, VignetteMood.Tense],
  [EmotionalContent.Loss, VignetteMood.Melancholy],
  [EmotionalContent.Triumph, VignetteMood.Triumphant],
  [EmotionalContent.Love, VignetteMood.Intimate],
  [EmotionalContent.Humiliation, VignetteMood.Foreboding],
  [EmotionalContent.Discovery, VignetteMood.Hopeful],
  [EmotionalContent.MoralCrisis, VignetteMood.Tense],
  [EmotionalContent.Transformation, VignetteMood.Epic],
  [EmotionalContent.Reunion, VignetteMood.Bittersweet],
  [EmotionalContent.Sacrifice, VignetteMood.Melancholy],
  [EmotionalContent.Reckoning, VignetteMood.Foreboding],
  [EmotionalContent.Terror, VignetteMood.Horror],
]);

/**
 * VignetteTrigger evaluates events to determine if they warrant a micro-narrative.
 */
export class VignetteTrigger {
  private readonly rng: () => number;
  private readonly minimumSignificance: number;
  private readonly triggerThreshold: number;

  constructor(options?: Partial<{
    rng: () => number;
    minimumSignificance: number;
    triggerThreshold: number;
  }>) {
    this.rng = options?.rng ?? Math.random;
    this.minimumSignificance = options?.minimumSignificance ?? 60;
    this.triggerThreshold = options?.triggerThreshold ?? 0.5;
  }

  /**
   * Evaluate an event to determine if it should trigger a vignette.
   */
  evaluate(context: VignetteTriggerContext): VignetteTriggerResult {
    const event = context.event;

    // Basic significance check
    if (event.significance < this.minimumSignificance) {
      return this.noTrigger();
    }

    // Detect emotional content
    const emotions = this.detectEmotions(context);
    if (emotions.length === 0) {
      return this.noTrigger();
    }

    const primaryEmotion = emotions[0]!;
    const secondaryEmotions = emotions.slice(1);

    // Calculate trigger strength
    const triggerStrength = this.calculateTriggerStrength(context, emotions);

    if (triggerStrength < this.triggerThreshold) {
      return this.noTrigger();
    }

    // Select archetype
    const archetype = this.selectArchetype(context, primaryEmotion);

    // Determine focal character
    const focalCharacter = this.selectFocalCharacter(context);

    // Get supporting characters
    const supportingCharacters = this.selectSupportingCharacters(context, focalCharacter);

    // Determine mood
    const mood = EMOTION_MOODS.get(primaryEmotion) ?? VignetteMood.Epic;

    // Extract key elements
    const keyElements = this.extractKeyElements(context, emotions);

    return {
      shouldTrigger: true,
      archetype,
      primaryEmotion,
      secondaryEmotions,
      triggerStrength,
      focalCharacter,
      supportingCharacters,
      suggestedMood: mood,
      keyElements,
    };
  }

  /**
   * Detect emotional content from an event and context.
   */
  private detectEmotions(context: VignetteTriggerContext): EmotionalContent[] {
    const emotionScores = new Map<EmotionalContent, number>();

    // Check event subtype mapping
    const subtypeEmotions = EVENT_SUBTYPE_EMOTIONS.get(context.event.subtype);
    if (subtypeEmotions !== undefined) {
      for (const emotion of subtypeEmotions) {
        emotionScores.set(emotion, (emotionScores.get(emotion) ?? 0) + 1.0);
      }
    }

    // Analyze participant memories for emotional weight
    for (const [, memories] of context.participantMemories) {
      for (const memory of memories) {
        if (memory.emotionalWeight < -50) {
          emotionScores.set(EmotionalContent.Loss, (emotionScores.get(EmotionalContent.Loss) ?? 0) + 0.5);
        }
        if (memory.emotionalWeight > 50) {
          emotionScores.set(EmotionalContent.Triumph, (emotionScores.get(EmotionalContent.Triumph) ?? 0) + 0.5);
        }
      }
    }

    // Analyze relationships for emotional potential
    for (const [charId, relations] of context.relationships) {
      for (const [targetId, intensity] of relations) {
        if (intensity < -70) {
          // Strong negative relationship + event = potential confrontation
          if (this.areInSameEvent(charId, targetId, context.event)) {
            emotionScores.set(EmotionalContent.Reckoning, (emotionScores.get(EmotionalContent.Reckoning) ?? 0) + 0.7);
          }
        }
        if (intensity > 70) {
          // Strong positive relationship
          if (this.areInSameEvent(charId, targetId, context.event)) {
            emotionScores.set(EmotionalContent.Love, (emotionScores.get(EmotionalContent.Love) ?? 0) + 0.5);
          }
        }
      }
    }

    // Sort by score and return top emotions
    const sortedEmotions = [...emotionScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([emotion]) => emotion);

    return sortedEmotions.slice(0, 3);
  }

  /**
   * Calculate overall trigger strength.
   */
  private calculateTriggerStrength(
    context: VignetteTriggerContext,
    emotions: EmotionalContent[]
  ): number {
    let strength = 0;

    // Base strength from significance
    strength += context.event.significance / 100 * 0.4;

    // Emotional intensity
    strength += Math.min(emotions.length, 3) / 3 * 0.3;

    // Character involvement
    const characterCount = this.countCharacterParticipants(context);
    strength += Math.min(characterCount, 5) / 5 * 0.15;

    // Location history
    if (context.locationHistory.length > 3) {
      strength += 0.1;
    }

    // Arc phase bonus
    if (context.arcPhase === 'Climax' || context.arcPhase === 'FallingAction') {
      strength += 0.1;
    }

    // Relationship intensity bonus
    const maxRelationshipIntensity = this.getMaxRelationshipIntensity(context);
    if (Math.abs(maxRelationshipIntensity) > 80) {
      strength += 0.1;
    }

    return Math.min(1.0, strength);
  }

  /**
   * Select the most appropriate archetype for this vignette.
   */
  private selectArchetype(
    context: VignetteTriggerContext,
    primaryEmotion: EmotionalContent
  ): VignetteArchetype {
    const possibleArchetypes = EMOTION_ARCHETYPES.get(primaryEmotion) ?? [VignetteArchetype.TheAftermath];

    // Score each archetype based on context
    let bestArchetype = possibleArchetypes[0] ?? VignetteArchetype.TheAftermath;
    let bestScore = 0;

    for (const archetype of possibleArchetypes) {
      const score = this.scoreArchetype(archetype, context);
      if (score > bestScore) {
        bestScore = score;
        bestArchetype = archetype;
      }
    }

    return bestArchetype;
  }

  /**
   * Score an archetype's fit for the context.
   */
  private scoreArchetype(archetype: VignetteArchetype, context: VignetteTriggerContext): number {
    let score = this.rng() * 0.2; // Small random factor

    switch (archetype) {
      case VignetteArchetype.BeforeTheStorm:
        // Good for high-stakes events with buildup
        if (context.event.significance > 80) score += 0.3;
        break;

      case VignetteArchetype.TheConfrontation:
        // Good when enemies meet
        if (this.hasEnemiesInEvent(context)) score += 0.5;
        break;

      case VignetteArchetype.TheFarewell:
        // Good for death/departure events
        if (context.event.subtype.includes('death') || context.event.subtype.includes('exile')) {
          score += 0.5;
        }
        break;

      case VignetteArchetype.TheAscension:
        // Good for power transitions upward
        if (context.event.subtype.includes('coronation') || context.event.subtype.includes('promotion')) {
          score += 0.5;
        }
        break;

      case VignetteArchetype.TheFall:
        // Good for defeats and falls from power
        if (context.event.subtype.includes('defeat') || context.event.subtype.includes('abdication')) {
          score += 0.5;
        }
        break;

      case VignetteArchetype.TheReunion:
        // Good when separated characters meet
        if (context.event.subtype.includes('return') || context.event.subtype.includes('reunion')) {
          score += 0.5;
        }
        break;

      case VignetteArchetype.TheDiscovery:
        // Good for finding things
        if (context.event.subtype.includes('discovery') || context.event.subtype.includes('found')) {
          score += 0.5;
        }
        break;

      case VignetteArchetype.TheCrossroads:
        // Good for decision moments
        if (context.event.subtype.includes('choice') || context.event.subtype.includes('decision')) {
          score += 0.5;
        }
        break;

      default:
        score += 0.2;
    }

    return score;
  }

  /**
   * Select the best focal character (POV) for the vignette.
   */
  private selectFocalCharacter(context: VignetteTriggerContext): CharacterId | undefined {
    const characterParticipants = context.event.participants.filter(p =>
      context.characterTraits.has(p as CharacterId)
    ) as CharacterId[];

    if (characterParticipants.length === 0) {
      return undefined;
    }

    // Score characters by emotional involvement and trait intensity
    let bestChar: CharacterId | undefined;
    let bestScore = -Infinity;

    for (const charId of characterParticipants) {
      let score = 0;

      // Memory emotional weight
      const memories = context.participantMemories.get(charId);
      if (memories !== undefined) {
        for (const memory of memories) {
          score += Math.abs(memory.emotionalWeight) / 100;
        }
      }

      // Trait intensity (dramatic personalities make better POV)
      const traits = context.characterTraits.get(charId);
      if (traits !== undefined) {
        for (const [, intensity] of traits) {
          score += Math.abs(intensity) / 100 * 0.3;
        }
      }

      // Relationship intensity
      const relations = context.relationships.get(charId);
      if (relations !== undefined) {
        for (const [, intensity] of relations) {
          score += Math.abs(intensity) / 100 * 0.2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestChar = charId;
      }
    }

    return bestChar;
  }

  /**
   * Select supporting characters for the vignette.
   */
  private selectSupportingCharacters(
    context: VignetteTriggerContext,
    focalCharacter: CharacterId | undefined
  ): CharacterId[] {
    const supporting: CharacterId[] = [];

    const characterParticipants = context.event.participants.filter(p =>
      context.characterTraits.has(p as CharacterId) && p !== focalCharacter
    ) as CharacterId[];

    // Prioritize characters with strong relationships to focal character
    if (focalCharacter !== undefined) {
      const focalRelations = context.relationships.get(focalCharacter);
      if (focalRelations !== undefined) {
        const sortedRelations = [...focalRelations.entries()]
          .filter(([id]) => characterParticipants.includes(id))
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

        for (const [charId] of sortedRelations.slice(0, 3)) {
          supporting.push(charId);
        }
      }
    }

    // Add remaining participants up to limit
    for (const charId of characterParticipants) {
      if (supporting.length >= 4) break;
      if (!supporting.includes(charId)) {
        supporting.push(charId);
      }
    }

    return supporting;
  }

  /**
   * Extract key elements to incorporate in the vignette.
   */
  private extractKeyElements(
    context: VignetteTriggerContext,
    emotions: EmotionalContent[]
  ): string[] {
    const elements: string[] = [];

    // Event-specific elements
    elements.push(context.event.subtype);

    // Location if present
    if (context.event.location !== undefined) {
      elements.push('location:' + context.event.location);
    }

    // Emotional elements
    for (const emotion of emotions) {
      elements.push('emotion:' + emotion);
    }

    // Relationship dynamics
    if (this.hasEnemiesInEvent(context)) {
      elements.push('conflict');
    }
    if (this.hasAlliesInEvent(context)) {
      elements.push('alliance');
    }

    // Historical weight
    if (context.locationHistory.length > 5) {
      elements.push('historic_location');
    }

    return elements;
  }

  /**
   * Create a no-trigger result.
   */
  private noTrigger(): VignetteTriggerResult {
    return {
      shouldTrigger: false,
      archetype: VignetteArchetype.TheAftermath,
      primaryEmotion: EmotionalContent.Loss,
      secondaryEmotions: [],
      triggerStrength: 0,
      focalCharacter: undefined,
      supportingCharacters: [],
      suggestedMood: VignetteMood.Serene,
      keyElements: [],
    };
  }

  /**
   * Check if two characters are in the same event.
   */
  private areInSameEvent(char1: CharacterId, char2: CharacterId, event: WorldEvent): boolean {
    return event.participants.includes(char1 as EntityId) &&
           event.participants.includes(char2 as EntityId);
  }

  /**
   * Count character participants in an event.
   */
  private countCharacterParticipants(context: VignetteTriggerContext): number {
    return context.event.participants.filter(p =>
      context.characterTraits.has(p as CharacterId)
    ).length;
  }

  /**
   * Get maximum relationship intensity among participants.
   */
  private getMaxRelationshipIntensity(context: VignetteTriggerContext): number {
    let max = 0;

    for (const [, relations] of context.relationships) {
      for (const [, intensity] of relations) {
        if (Math.abs(intensity) > Math.abs(max)) {
          max = intensity;
        }
      }
    }

    return max;
  }

  /**
   * Check if event has enemies meeting.
   */
  private hasEnemiesInEvent(context: VignetteTriggerContext): boolean {
    const participants = context.event.participants as CharacterId[];

    for (let i = 0; i < participants.length; i++) {
      const relations = context.relationships.get(participants[i]!);
      if (relations === undefined) continue;

      for (let j = i + 1; j < participants.length; j++) {
        const intensity = relations.get(participants[j]!);
        if (intensity !== undefined && intensity < -50) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if event has allies meeting.
   */
  private hasAlliesInEvent(context: VignetteTriggerContext): boolean {
    const participants = context.event.participants as CharacterId[];

    for (let i = 0; i < participants.length; i++) {
      const relations = context.relationships.get(participants[i]!);
      if (relations === undefined) continue;

      for (let j = i + 1; j < participants.length; j++) {
        const intensity = relations.get(participants[j]!);
        if (intensity !== undefined && intensity > 50) {
          return true;
        }
      }
    }

    return false;
  }
}
