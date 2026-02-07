/**
 * Prose lookup tables and shared utilities for the polymorphic inspector system.
 * Provides atmospheric text generation following the BIOME_PROSE / DOMAIN_PROSE pattern.
 */

import type { EntityId } from '@fws/core';

// ─── Entity Span Tracking ────────────────────────────────────────────
// Identical pattern to EventLogPanel.rightPaneEntitySpans.
// Maps rendered row number to clickable entity name regions on that row.

export interface EntitySpan {
  readonly startCol: number;
  readonly endCol: number;
  readonly entityId: EntityId;
}

export type EntitySpanMap = Map<number, EntitySpan[]>;

/**
 * Create a fresh entity span map.
 */
export function createEntitySpanMap(): EntitySpanMap {
  return new Map();
}

/**
 * Record an entity span at a given row.
 */
export function addEntitySpan(
  map: EntitySpanMap,
  row: number,
  startCol: number,
  endCol: number,
  entityId: EntityId
): void {
  let spans = map.get(row);
  if (spans === undefined) {
    spans = [];
    map.set(row, spans);
  }
  spans.push({ startCol, endCol, entityId });
}

/**
 * Find which entity was clicked at (row, col) within a span map.
 * Returns the EntityId if found, undefined otherwise.
 */
export function findEntityAtPosition(
  map: EntitySpanMap,
  row: number,
  col: number
): EntityId | undefined {
  const spans = map.get(row);
  if (spans === undefined) return undefined;
  for (const span of spans) {
    if (col >= span.startCol && col < span.endCol) {
      return span.entityId;
    }
  }
  return undefined;
}

// ─── Color Constants ─────────────────────────────────────────────────

export const ENTITY_NAME_COLOR = '#88AAFF';
export const PROSE_COLOR = '#cccccc';
export const DIM_COLOR = '#888888';
export const POSITIVE_COLOR = '#44FF88';
export const NEGATIVE_COLOR = '#FF4444';
export const NEUTRAL_COLOR = '#CCCC44';

// ─── Entity Type Icons (ASCII-safe) ──────────────────────────────────

export const TYPE_ICONS: Readonly<Record<string, string>> = {
  character: '@',
  faction: '&',
  event: '!',
  region: '~',
  location: '#',
  artifact: '*',
  unknown: '?',
};

export const TYPE_COLORS: Readonly<Record<string, string>> = {
  character: '#88AAFF',
  faction: '#FF8844',
  event: '#CCCC44',
  region: '#44CC88',
  location: '#FFDD00',
  artifact: '#FF00FF',
  unknown: '#888888',
};

// ─── Health Prose ────────────────────────────────────────────────────

export const HEALTH_PROSE: Readonly<Record<string, string>> = {
  perfect: 'is in the prime of health',
  healthy: 'bears no significant wounds',
  injured: 'nurses injuries from recent conflict',
  wounded: 'suffers from grievous wounds',
  critical: 'clings to life by a thread',
  dead: 'has passed beyond the veil',
};

/**
 * Get health state key from current/maximum HP values.
 */
export function getHealthState(current: number, maximum: number): string {
  const pct = maximum > 0 ? current / maximum : 0;
  if (pct >= 1.0) return 'perfect';
  if (pct >= 0.75) return 'healthy';
  if (pct >= 0.5) return 'injured';
  if (pct >= 0.25) return 'wounded';
  if (pct > 0) return 'critical';
  return 'dead';
}

// ─── Personality Axis (Big Five) ─────────────────────────────────────

/**
 * Each axis maps to [low descriptor, high descriptor].
 * Values < 30 use the left, > 70 use the right, 30-70 are moderate (no mention).
 */
export const PERSONALITY_AXIS: Readonly<Record<string, readonly [string, string]>> = {
  openness: ['traditional and set in their ways', 'endlessly curious and open to new ideas'],
  conscientiousness: ['free-spirited and spontaneous', 'methodical and disciplined'],
  extraversion: ['reserved and introspective', 'gregarious and commanding'],
  agreeableness: ['sharp-tongued and confrontational', 'gentle and accommodating'],
  neuroticism: ['unnervingly calm under pressure', 'prone to anxiety and dark moods'],
};

/**
 * Get personality descriptor for a Big Five axis value (0-100).
 */
export function getPersonalityDescriptor(axis: string, value: number): string | null {
  const pair = PERSONALITY_AXIS[axis];
  if (pair === undefined) return null;
  if (value < 30) return pair[0];
  if (value > 70) return pair[1];
  return null; // moderate — no strong descriptor
}

// ─── Settlement Size Prose ───────────────────────────────────────────

export const SETTLEMENT_SIZE_PROSE: Readonly<Record<string, string>> = {
  Hamlet: 'A scattering of homes clustered together',
  Village: 'A modest village where everyone knows their neighbor',
  Town: 'A bustling town at the crossroads of trade',
  City: 'A city of consequence, its walls marking ambition in stone',
  'Large City': 'A great city whose name is known across the realm',
  Metropolis: 'A vast metropolis, teeming with life and intrigue',
};

/**
 * Get settlement size category from population.
 */
export function getSettlementSize(population: number): string {
  if (population < 100) return 'Hamlet';
  if (population < 1000) return 'Village';
  if (population < 5000) return 'Town';
  if (population < 25000) return 'City';
  if (population < 100000) return 'Large City';
  return 'Metropolis';
}

// ─── Relationship Category Labels ────────────────────────────────────

export const RELATION_CATEGORY_PROSE: Readonly<Record<string, string>> = {
  family: 'FAMILY',
  ally: 'ALLIES',
  rival: 'RIVALS',
  neutral: 'NEUTRAL',
  vassal: 'VASSALS',
  overlord: 'OVERLORDS',
};

// ─── Military State Prose ────────────────────────────────────────────

export const MILITARY_PROSE: Readonly<Record<string, string>> = {
  peaceful: 'The realm enjoys a period of peace, though soldiers keep watch',
  mobilizing: 'War drums echo through the land as forces gather',
  at_war: 'Conflict rages across the frontiers',
  victorious: 'Recent victory has emboldened the armies',
  defeated: 'Defeat has left the forces weakened and demoralized',
};

/**
 * Get military state key from strength and morale.
 */
export function getMilitaryState(strength: number, morale: number): string {
  if (strength === 0) return 'peaceful';
  if (morale < 30) return 'defeated';
  if (morale > 85) return 'victorious';
  if (strength > 5000) return 'at_war';
  return 'mobilizing';
}

// ─── Economic State Prose ────────────────────────────────────────────

export const ECONOMIC_PROSE: Readonly<Record<string, string>> = {
  destitute: 'Poverty grips the populace, and coin is scarce as hope',
  poor: 'The people scrape by on meager earnings',
  modest: 'A modest economy sustains the daily needs of the people',
  comfortable: 'Trade flows steadily and the markets hum with activity',
  wealthy: 'Prosperity fills the coffers and lines the merchants\' purses',
  opulent: 'Vast wealth has transformed the land into a place of splendor',
};

/**
 * Get economic state key from wealth value.
 */
export function getEconomicState(wealth: number): string {
  if (wealth >= 50000) return 'opulent';
  if (wealth >= 20000) return 'wealthy';
  if (wealth >= 5000) return 'comfortable';
  if (wealth >= 1000) return 'modest';
  if (wealth >= 100) return 'poor';
  return 'destitute';
}

// ─── Significance Labels ─────────────────────────────────────────────

export const SIGNIFICANCE_LABELS: Readonly<Record<string, string>> = {
  trivial: 'Trivial',
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
  critical: 'Critical',
  legendary: 'Legendary',
};

/**
 * Get significance label from numeric value.
 */
export function getSignificanceLabel(value: number): string {
  if (value >= 96) return 'Legendary';
  if (value >= 81) return 'Critical';
  if (value >= 61) return 'Major';
  if (value >= 41) return 'Moderate';
  if (value >= 21) return 'Minor';
  return 'Trivial';
}

// ─── Diplomacy Labels ────────────────────────────────────────────────

/**
 * Get diplomatic relation label from affinity value.
 */
export function getDiplomacyLabel(relation: number): string {
  if (relation >= 80) return 'Allied';
  if (relation >= 50) return 'Friendly';
  if (relation >= 20) return 'Cordial';
  if (relation >= -20) return 'Neutral';
  if (relation >= -50) return 'Wary';
  if (relation >= -80) return 'Hostile';
  return 'At War';
}

// ─── Rendering Helpers ───────────────────────────────────────────────

const BAR_WIDTH = 20;
const FILLED_BLOCK = '\u2588'; // █
const EMPTY_BLOCK = '\u2591';  // ░

/**
 * Render an ASCII progress bar.
 */
export function renderBar(value: number, maxValue: number): string {
  const normalized = Math.max(0, Math.min(1, value / maxValue));
  const filledCount = Math.round(normalized * BAR_WIDTH);
  const emptyCount = BAR_WIDTH - filledCount;
  return FILLED_BLOCK.repeat(filledCount) + EMPTY_BLOCK.repeat(emptyCount);
}

/**
 * Render an entity name as a clickable blessed-tagged string.
 * Returns the rendered string and the plain-text length (for span tracking).
 */
export function renderEntityName(name: string): string {
  return `{${ENTITY_NAME_COLOR}-fg}${name}{/}`;
}

/**
 * Render a dotted leader line between name and label.
 */
export function renderDottedLeader(name: string, label: string, totalWidth: number): string {
  const minDots = 3;
  const nameLen = name.length;
  const labelLen = label.length;
  const dotsNeeded = Math.max(minDots, totalWidth - nameLen - labelLen - 2);
  return `${name} ${'·'.repeat(dotsNeeded)} ${label}`;
}

/**
 * Strip blessed tags from a string for character counting.
 */
export function stripTags(text: string): string {
  return text.replace(/\{[^}]*\}/g, '');
}

/**
 * Wrap text to a maximum line width, preserving words.
 */
export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

/**
 * Convert tick number to year.
 */
export function tickToYear(tick: number): number {
  return Math.floor(tick / 360) + 1;
}

/**
 * Convert tick number to season string.
 */
export function tickToSeason(tick: number): string {
  const month = Math.floor((tick % 360) / 30) + 1;
  if (month >= 1 && month <= 3) return 'Winter';
  if (month >= 4 && month <= 6) return 'Spring';
  if (month >= 7 && month <= 9) return 'Summer';
  return 'Autumn';
}
