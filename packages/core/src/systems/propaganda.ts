/**
 * PropagandaSystem — false memories, organic distortion, and historian bias.
 *
 * Three forms of memory distortion:
 * 1. Organic distortion: personality-based drift (how people naturally misremember)
 * 2. Propaganda: organized campaigns to alter collective memory
 * 3. Historian bias: traits filter what gets recorded when compiling history
 */

import type { EntityId } from '../ecs/types.js';
import { PersonalityTrait } from './personality-traits.js';
import { MemoryCategory, MemoryRole } from './memory-types.js';
import type { Memory } from './memory-types.js';

// ── Propaganda types ────────────────────────────────────────────────────────

export enum PropagandaType {
  Victory = 'victory',             // Exaggerate wins, minimize losses
  Demonization = 'demonization',   // Paint target as villain
  Martyrdom = 'martyrdom',         // Elevate fallen ally to martyr
  DivineMandate = 'divineMandate', // Claim divine backing
  Revisionism = 'revisionism',     // Rewrite history wholesale
}

export interface PropagandaEffect {
  readonly type: PropagandaType;
  readonly sourceId: EntityId;
  readonly targetEventId: number;
  readonly narrativeOverride: string;
  readonly emotionalShift: number;    // How much to shift emotional weight
  readonly accuracyPenalty: number;   // How much accuracy to reduce
  readonly reach: number;             // 0-100, how far it spreads
  readonly credibility: number;       // 0-100, how believable
}

// ── Trait-based distortion tendencies ───────────────────────────────────────

interface DistortionTendency {
  readonly trait: PersonalityTrait;
  readonly emotionalBias: number;      // How much this trait shifts emotional recall
  readonly selfAggrandizement: number; // Probability of inflating own role (0-1)
  readonly villainization: number;     // How much they demonize opponents (0-1)
  readonly accuracyImpact: number;     // Additional accuracy loss per distortion pass
}

const DISTORTION_TENDENCIES: readonly DistortionTendency[] = [
  { trait: PersonalityTrait.Ambitious, emotionalBias: 5, selfAggrandizement: 0.3, villainization: 0.1, accuracyImpact: 2 },
  { trait: PersonalityTrait.Cruel, emotionalBias: -10, selfAggrandizement: 0.1, villainization: 0.4, accuracyImpact: 3 },
  { trait: PersonalityTrait.Paranoid, emotionalBias: -15, selfAggrandizement: 0.0, villainization: 0.5, accuracyImpact: 5 },
  { trait: PersonalityTrait.Vengeful, emotionalBias: -20, selfAggrandizement: 0.1, villainization: 0.6, accuracyImpact: 4 },
  { trait: PersonalityTrait.Empathetic, emotionalBias: 10, selfAggrandizement: -0.1, villainization: -0.2, accuracyImpact: 1 },
  { trait: PersonalityTrait.Idealistic, emotionalBias: 10, selfAggrandizement: 0.0, villainization: 0.2, accuracyImpact: 3 },
  { trait: PersonalityTrait.SelfAbsorbed, emotionalBias: 5, selfAggrandizement: 0.5, villainization: 0.1, accuracyImpact: 4 },
  { trait: PersonalityTrait.Forgiving, emotionalBias: 15, selfAggrandizement: -0.1, villainization: -0.3, accuracyImpact: 2 },
  { trait: PersonalityTrait.Scholarly, emotionalBias: 0, selfAggrandizement: -0.1, villainization: -0.1, accuracyImpact: -2 },
  { trait: PersonalityTrait.Creative, emotionalBias: 5, selfAggrandizement: 0.2, villainization: 0.1, accuracyImpact: 3 },
];

// ── Historian bias rules ────────────────────────────────────────────────────

interface HistorianBias {
  readonly trait: PersonalityTrait;
  /** Categories this historian trait prefers to record/emphasize */
  readonly preferredCategories: readonly MemoryCategory[];
  /** Categories this historian trait tends to downplay/omit */
  readonly suppressedCategories: readonly MemoryCategory[];
  /** Minimum significance for a memory to be included (0-100) */
  readonly significanceThreshold: number;
}

const HISTORIAN_BIASES: readonly HistorianBias[] = [
  {
    trait: PersonalityTrait.Ambitious,
    preferredCategories: [MemoryCategory.Political, MemoryCategory.Military],
    suppressedCategories: [MemoryCategory.Personal],
    significanceThreshold: 20,
  },
  {
    trait: PersonalityTrait.Scholarly,
    preferredCategories: [MemoryCategory.Scientific, MemoryCategory.Cultural],
    suppressedCategories: [],
    significanceThreshold: 10,
  },
  {
    trait: PersonalityTrait.Cruel,
    preferredCategories: [MemoryCategory.Military, MemoryCategory.Political],
    suppressedCategories: [MemoryCategory.Religious, MemoryCategory.Cultural],
    significanceThreshold: 30,
  },
  {
    trait: PersonalityTrait.Empathetic,
    preferredCategories: [MemoryCategory.Personal, MemoryCategory.Social],
    suppressedCategories: [MemoryCategory.Military],
    significanceThreshold: 15,
  },
  {
    trait: PersonalityTrait.Idealistic,
    preferredCategories: [MemoryCategory.Religious, MemoryCategory.Cultural],
    suppressedCategories: [MemoryCategory.Economic],
    significanceThreshold: 15,
  },
  {
    trait: PersonalityTrait.Pragmatic,
    preferredCategories: [MemoryCategory.Economic, MemoryCategory.Political],
    suppressedCategories: [MemoryCategory.Religious],
    significanceThreshold: 25,
  },
];

// ── PropagandaSystem ────────────────────────────────────────────────────────

export class PropagandaSystem {
  /**
   * Apply organic distortion to a memory based on personality traits.
   * Models how people naturally misremember things based on their biases.
   * Returns a NEW Memory with distorted values (does not mutate input).
   */
  organicDistortion(
    memory: Memory,
    traitValues: ReadonlyMap<string, number>,
    rng: () => number = Math.random,
  ): Memory {
    let emotionalShift = 0;
    let accuracyLoss = 0;
    let narrativePrefix = '';

    for (const tendency of DISTORTION_TENDENCIES) {
      const traitValue = traitValues.get(tendency.trait) ?? 0;
      if (traitValue <= 0) continue; // Only active (positive) traits cause distortion

      const intensity = traitValue / 100; // 0.0–1.0

      emotionalShift += tendency.emotionalBias * intensity;
      accuracyLoss += tendency.accuracyImpact * intensity;

      // Self-aggrandizement: if character was a participant/instigator, may inflate role
      if (
        (memory.myRole === MemoryRole.Participant || memory.myRole === MemoryRole.Instigator) &&
        tendency.selfAggrandizement > 0 &&
        rng() < tendency.selfAggrandizement * intensity
      ) {
        narrativePrefix = '[embellished] ';
      }

      // Villainization: victims remember antagonists more negatively
      if (memory.myRole === MemoryRole.Victim) {
        emotionalShift -= tendency.villainization * intensity * 10;
      }
    }

    return {
      ...memory,
      emotionalWeight: Math.max(-100, Math.min(100, memory.emotionalWeight + emotionalShift)),
      accuracy: Math.max(0, memory.accuracy - accuracyLoss),
      narrative: narrativePrefix + memory.narrative,
      participants: [...memory.participants],
    };
  }

  /**
   * Create a propaganda effect targeting a specific event.
   * Describes how memories of this event should be altered for the target audience.
   */
  createPropaganda(
    type: PropagandaType,
    sourceId: EntityId,
    targetEventId: number,
    reach: number,
    credibility: number,
  ): PropagandaEffect {
    let narrativeOverride: string;
    let emotionalShift: number;
    let accuracyPenalty: number;

    switch (type) {
      case PropagandaType.Victory:
        narrativeOverride = 'A glorious victory was achieved through superior leadership.';
        emotionalShift = 30;
        accuracyPenalty = 20;
        break;
      case PropagandaType.Demonization:
        narrativeOverride = 'The enemy revealed their true evil nature.';
        emotionalShift = -40;
        accuracyPenalty = 30;
        break;
      case PropagandaType.Martyrdom:
        narrativeOverride = 'A noble sacrifice was made for the greater good.';
        emotionalShift = 20;
        accuracyPenalty = 25;
        break;
      case PropagandaType.DivineMandate:
        narrativeOverride = 'The gods themselves ordained this outcome.';
        emotionalShift = 15;
        accuracyPenalty = 35;
        break;
      case PropagandaType.Revisionism:
        narrativeOverride = 'The true course of events has been revealed.';
        emotionalShift = 0;
        accuracyPenalty = 40;
        break;
    }

    return {
      type,
      sourceId,
      targetEventId,
      narrativeOverride,
      emotionalShift,
      accuracyPenalty,
      reach: Math.max(0, Math.min(100, reach)),
      credibility: Math.max(0, Math.min(100, credibility)),
    };
  }

  /**
   * Apply a propaganda effect to a memory.
   * Rolls against credibility — propaganda may be rejected.
   * Returns a new Memory if accepted, or the original if rejected.
   */
  applyPropaganda(
    memory: Memory,
    effect: PropagandaEffect,
    rng: () => number = Math.random,
  ): Memory {
    // Roll against credibility to see if this character accepts the propaganda
    if (rng() * 100 > effect.credibility) {
      return memory; // Rejected
    }

    return {
      ...memory,
      emotionalWeight: Math.max(
        -100,
        Math.min(100, memory.emotionalWeight + effect.emotionalShift),
      ),
      accuracy: Math.max(0, memory.accuracy - effect.accuracyPenalty),
      narrative: effect.narrativeOverride,
      participants: [...memory.participants],
    };
  }

  /**
   * Filter and bias memories through a historian's perspective.
   * Historians with certain traits emphasize or suppress certain categories.
   * Returns a filtered (and potentially reduced) array of memories.
   */
  filterHistorian(
    memories: readonly Memory[],
    historianTraits: ReadonlyMap<string, number>,
  ): readonly Memory[] {
    // Collect all active biases (only strongly-held traits cause bias)
    const activeBiases: HistorianBias[] = [];
    for (const bias of HISTORIAN_BIASES) {
      const traitValue = historianTraits.get(bias.trait) ?? 0;
      if (traitValue > 20) {
        activeBiases.push(bias);
      }
    }

    if (activeBiases.length === 0) {
      // Neutral historian: moderate significance filter only
      return memories.filter(m => m.significance >= 15);
    }

    // Build preferred and suppressed category sets
    const preferred = new Set<MemoryCategory>();
    const suppressed = new Set<MemoryCategory>();
    let minSignificance = 100;

    for (const bias of activeBiases) {
      for (const cat of bias.preferredCategories) {
        preferred.add(cat);
      }
      for (const cat of bias.suppressedCategories) {
        // Don't suppress if another active bias prefers it
        if (!preferred.has(cat)) {
          suppressed.add(cat);
        }
      }
      minSignificance = Math.min(minSignificance, bias.significanceThreshold);
    }

    return memories.filter(memory => {
      // Always include very significant events
      if (memory.significance >= 80) return true;

      // Suppress certain categories unless quite significant
      if (suppressed.has(memory.category) && memory.significance < 60) return false;

      // Preferred categories get a lower threshold
      if (preferred.has(memory.category)) {
        return memory.significance >= Math.max(5, minSignificance - 10);
      }

      // Default threshold
      return memory.significance >= minSignificance;
    });
  }
}
