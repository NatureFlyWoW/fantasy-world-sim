/**
 * Template type definitions for the narrative engine.
 * These types define how events are transformed into prose.
 */

import type { EventCategory, WorldEvent } from '@fws/core';
import type { World } from '@fws/core';
import type { WorldClock } from '@fws/core';
import type { ArcPhase } from '@fws/core';

/**
 * Narrative tone controls the voice and style of generated prose.
 * Each tone produces distinctly different text from the same event.
 */
export enum NarrativeTone {
  /** Formal register, passive constructions, grandiose vocabulary */
  EpicHistorical = 'EpicHistorical',
  /** Intimate, emotional, internal states visible */
  PersonalCharacterFocus = 'PersonalCharacterFocus',
  /** Archaic, symbolic, larger-than-life framing */
  Mythological = 'Mythological',
  /** Detached, analytical, focus on maneuvering */
  PoliticalIntrigue = 'PoliticalIntrigue',
  /** Academic, referenced, analytical */
  Scholarly = 'Scholarly',
}

/**
 * Significance range for template matching.
 * Templates are selected based on event significance falling within this range.
 */
export interface SignificanceRange {
  readonly min: number;
  readonly max: number;
}

/**
 * A narrative template transforms an event into prose.
 * Templates contain placeholders that are resolved against context.
 */
export interface NarrativeTemplate {
  /** Unique identifier for this template */
  readonly id: string;
  /** Event category this template handles */
  readonly category: EventCategory;
  /** Event subtype (e.g., "battle.resolved", "character.death") */
  readonly subtype: string;
  /** Tone this template is written in */
  readonly tone: NarrativeTone;
  /** Significance range this template is appropriate for */
  readonly significanceRange: SignificanceRange;
  /** The template string with placeholders */
  readonly template: string;
  /** Data fields that must exist in event.data for this template */
  readonly requiredContext: readonly string[];
}

/**
 * Gender for pronoun resolution.
 */
export type Gender = 'male' | 'female' | 'neutral';

/**
 * Resolved entity data for template rendering.
 */
export interface ResolvedEntity {
  readonly name: string;
  readonly title?: string;
  readonly epithet?: string;
  readonly gender?: Gender;
}

/**
 * Context provided to the template engine for rendering.
 * Contains all data needed to resolve placeholders.
 */
export interface TemplateContext {
  /** The event being narrated */
  readonly event: WorldEvent;
  /** World for resolving entity references */
  readonly world: World;
  /** Clock for temporal references */
  readonly clock: WorldClock;
  /** If this event is part of a detected narrative arc */
  readonly narrativeArc?: {
    readonly phase: ArcPhase;
    readonly peakSignificance: number;
    readonly domainTransitions: number;
  };
}

/**
 * Output from the narrative engine.
 */
export interface NarrativeOutput {
  /** Short title for the event */
  readonly title: string;
  /** Full narrative prose */
  readonly body: string;
  /** Tone used to generate this narrative */
  readonly tone: NarrativeTone;
  /** Template ID used (for debugging) */
  readonly templateId: string;
}

/**
 * Configuration for the narrative engine.
 */
export interface NarrativeEngineConfig {
  /** Default tone when no preference specified */
  readonly defaultTone: NarrativeTone;
  /** Whether to apply literary devices (epithet insertion, foreshadowing, etc.) */
  readonly applyLiteraryDevices: boolean;
  /** Whether to include retrospective references for cascade resolutions */
  readonly includeRetrospectives: boolean;
  /** Whether to add dramatic irony asides for secrets */
  readonly includeDramaticIrony: boolean;
  /** Optional seeded RNG for deterministic template selection.
   *  Must return a number in [0, 1). Defaults to Math.random. */
  readonly rng?: () => number;
}

/**
 * Entity resolver interface for looking up entity data.
 * This abstraction allows the narrative engine to work without
 * direct component access.
 */
export interface EntityResolver {
  /** Resolve a character by ID */
  resolveCharacter(characterId: number): ResolvedEntity | undefined;
  /** Resolve a faction by ID */
  resolveFaction(factionId: number): ResolvedEntity | undefined;
  /** Resolve a site/location by ID */
  resolveSite(siteId: number): ResolvedEntity | undefined;
  /** Resolve an artifact by ID */
  resolveArtifact(artifactId: number): ResolvedEntity | undefined;
  /** Resolve a deity by ID */
  resolveDeity(deityId: number): ResolvedEntity | undefined;
}

/**
 * Pronoun set for a given gender.
 */
export interface PronounSet {
  readonly subject: string;
  readonly object: string;
  readonly possessive: string;
  readonly reflexive: string;
}

/**
 * Pronoun lookup by gender.
 */
export const PRONOUNS: Record<Gender, PronounSet> = {
  male: {
    subject: 'he',
    object: 'him',
    possessive: 'his',
    reflexive: 'himself',
  },
  female: {
    subject: 'she',
    object: 'her',
    possessive: 'her',
    reflexive: 'herself',
  },
  neutral: {
    subject: 'they',
    object: 'them',
    possessive: 'their',
    reflexive: 'themselves',
  },
};

/**
 * Default configuration for the narrative engine.
 */
export const DEFAULT_ENGINE_CONFIG: NarrativeEngineConfig = {
  defaultTone: NarrativeTone.EpicHistorical,
  applyLiteraryDevices: true,
  includeRetrospectives: true,
  includeDramaticIrony: true,
};
