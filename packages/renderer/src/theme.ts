/**
 * Theme and color management for the renderer.
 * Provides consistent color schemes for UI elements, entities, and significance levels.
 */

import { EventCategory } from '@fws/core';
import { BiomeType, BIOME_CHARS } from './themes/biome-chars.js';
import type { BiomeVisual } from './themes/biome-chars.js';

/**
 * UI chrome colors.
 */
export const UI_COLORS = {
  borderFocused: '#4488FF',
  borderBlurred: '#444444',
  statusBar: '#222244',
  titleBar: '#333355',
  background: '#0a0a0a',
  text: '#cccccc',
  textDim: '#666666',
  textBright: '#ffffff',
  selection: '#335588',
  cursor: '#ffcc00',
} as const;

/**
 * Entity marker colors.
 */
export const ENTITY_COLORS = {
  city: '#FFDD00',
  ruin: '#886644',
  army: '#FF4444',
  temple: '#CC88FF',
  academy: '#44CCFF',
  capital: '#FFD700',
  character: '#88AAFF',
  faction: '#FF8844',
  artifact: '#FF00FF',
  settlement: '#FFDD00',
} as const;

/**
 * Significance level colors (0-100 scale).
 */
export const SIGNIFICANCE_COLORS = {
  trivial: '#666666',    // 0-19
  minor: '#888888',      // 20-39
  moderate: '#CCCC44',   // 40-59
  major: '#FF8844',      // 60-79
  critical: '#FF2222',   // 80-94
  legendary: '#FF00FF',  // 95-100
} as const;

/**
 * Event category colors.
 */
export const CATEGORY_COLORS: Readonly<Record<EventCategory, string>> = {
  [EventCategory.Political]: '#FFDD44',
  [EventCategory.Military]: '#FF4444',
  [EventCategory.Magical]: '#CC44FF',
  [EventCategory.Cultural]: '#44DDFF',
  [EventCategory.Religious]: '#FFAAFF',
  [EventCategory.Economic]: '#44FF88',
  [EventCategory.Personal]: '#88AAFF',
  [EventCategory.Disaster]: '#FF6600',
  [EventCategory.Scientific]: '#00FFCC',
  [EventCategory.Exploratory]: '#88FF44',
} as const;

/**
 * Consolidated theme object.
 */
export const THEME = {
  ui: UI_COLORS,
  entity: ENTITY_COLORS,
  significance: SIGNIFICANCE_COLORS,
  category: CATEGORY_COLORS,
} as const;

/**
 * Significance thresholds.
 */
export const SIGNIFICANCE_THRESHOLDS = {
  trivial: 0,
  minor: 20,
  moderate: 40,
  major: 60,
  critical: 80,
  legendary: 95,
} as const;

/**
 * Get the color for a significance value (0-100).
 */
export function getSignificanceColor(significance: number): string {
  if (significance >= SIGNIFICANCE_THRESHOLDS.legendary) {
    return SIGNIFICANCE_COLORS.legendary;
  }
  if (significance >= SIGNIFICANCE_THRESHOLDS.critical) {
    return SIGNIFICANCE_COLORS.critical;
  }
  if (significance >= SIGNIFICANCE_THRESHOLDS.major) {
    return SIGNIFICANCE_COLORS.major;
  }
  if (significance >= SIGNIFICANCE_THRESHOLDS.moderate) {
    return SIGNIFICANCE_COLORS.moderate;
  }
  if (significance >= SIGNIFICANCE_THRESHOLDS.minor) {
    return SIGNIFICANCE_COLORS.minor;
  }
  return SIGNIFICANCE_COLORS.trivial;
}

/**
 * Get the significance level name for a value.
 */
export function getSignificanceLevel(significance: number): keyof typeof SIGNIFICANCE_COLORS {
  if (significance >= SIGNIFICANCE_THRESHOLDS.legendary) {
    return 'legendary';
  }
  if (significance >= SIGNIFICANCE_THRESHOLDS.critical) {
    return 'critical';
  }
  if (significance >= SIGNIFICANCE_THRESHOLDS.major) {
    return 'major';
  }
  if (significance >= SIGNIFICANCE_THRESHOLDS.moderate) {
    return 'moderate';
  }
  if (significance >= SIGNIFICANCE_THRESHOLDS.minor) {
    return 'minor';
  }
  return 'trivial';
}

/**
 * Get the color for an event category.
 */
export function getCategoryColor(category: EventCategory): string {
  return CATEGORY_COLORS[category];
}

/**
 * Get the color for an entity type.
 */
export function getEntityColor(entityType: string): string {
  const lowerType = entityType.toLowerCase();

  if (lowerType.includes('city') || lowerType.includes('settlement')) {
    return ENTITY_COLORS.city;
  }
  if (lowerType.includes('ruin')) {
    return ENTITY_COLORS.ruin;
  }
  if (lowerType.includes('army') || lowerType.includes('military')) {
    return ENTITY_COLORS.army;
  }
  if (lowerType.includes('temple') || lowerType.includes('shrine')) {
    return ENTITY_COLORS.temple;
  }
  if (lowerType.includes('academy') || lowerType.includes('school')) {
    return ENTITY_COLORS.academy;
  }
  if (lowerType.includes('capital')) {
    return ENTITY_COLORS.capital;
  }
  if (lowerType.includes('character') || lowerType.includes('person')) {
    return ENTITY_COLORS.character;
  }
  if (lowerType.includes('faction') || lowerType.includes('nation')) {
    return ENTITY_COLORS.faction;
  }
  if (lowerType.includes('artifact')) {
    return ENTITY_COLORS.artifact;
  }

  // Default color for unknown types
  return UI_COLORS.text;
}

/**
 * Get rendering information for a biome.
 */
export function getBiomeRendering(biome: BiomeType): BiomeVisual {
  const visual = BIOME_CHARS[biome];
  if (visual !== undefined) {
    return visual;
  }
  // Fallback for unknown biomes
  return { char: '?', fg: '#ff00ff', bg: '#000000' };
}

/**
 * Re-export BiomeType for convenience.
 */
export { BiomeType };

/**
 * Convert hex color to blessed-compatible color string.
 * Blessed accepts colors as names ('red'), hex ('#ff0000'), or numbers (196).
 */
export function toBlessedColor(hex: string): string {
  // Blessed handles hex colors directly
  return hex;
}

/**
 * Blend two hex colors.
 * @param color1 First hex color
 * @param color2 Second hex color
 * @param ratio Blend ratio (0 = all color1, 1 = all color2)
 */
export function blendColors(color1: string, color2: string, ratio: number): string {
  const c1 = parseHex(color1);
  const c2 = parseHex(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
  const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
  const b = Math.round(c1.b + (c2.b - c1.b) * ratio);

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parse a hex color string to RGB components.
 */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Convert a number to a two-character hex string.
 */
function toHex(n: number): string {
  const clamped = Math.max(0, Math.min(255, n));
  return clamped.toString(16).padStart(2, '0');
}

/**
 * Get a dimmed version of a color.
 */
export function dimColor(hex: string, factor = 0.5): string {
  const { r, g, b } = parseHex(hex);
  return `#${toHex(Math.round(r * factor))}${toHex(Math.round(g * factor))}${toHex(Math.round(b * factor))}`;
}

/**
 * Get a brightened version of a color.
 */
export function brightenColor(hex: string, factor = 1.5): string {
  const { r, g, b } = parseHex(hex);
  return `#${toHex(Math.round(Math.min(255, r * factor)))}${toHex(Math.round(Math.min(255, g * factor)))}${toHex(Math.round(Math.min(255, b * factor)))}`;
}
