/**
 * Tile renderer for converting terrain data to ASCII characters with colors.
 */

import { BiomeType, BIOME_CHARS, ENTITY_MARKERS } from '../themes/biome-chars.js';
import type { EntityMarkerKey } from '../themes/biome-chars.js';
import { blendColors } from '../theme.js';

/**
 * Rendered tile output.
 */
export interface RenderedTile {
  readonly char: string;
  readonly fg: string;
  readonly bg: string;
}

/**
 * Minimal terrain tile interface for rendering.
 * Mirrors the essential fields from @fws/generator TerrainTile.
 */
export interface RenderableTile {
  readonly biome: string;
  readonly riverId?: number;
  readonly leyLine?: boolean;
  readonly resources?: readonly string[];
}

/**
 * Entity data for map rendering.
 */
export interface MapEntity {
  readonly type: EntityMarkerKey | string;
  readonly factionColor?: string;
  readonly name?: string;
}

/**
 * Render a single terrain tile.
 */
export function renderTile(tile: RenderableTile): RenderedTile {
  const biomeKey = tile.biome as BiomeType;
  const visual = BIOME_CHARS[biomeKey];

  if (visual === undefined) {
    // Unknown biome fallback
    return { char: '?', fg: '#ff00ff', bg: '#000000' };
  }

  // Check for river overlay
  if (tile.riverId !== undefined) {
    return {
      char: '~',
      fg: '#4488cc',
      bg: visual.bg,
    };
  }

  // Check for ley line overlay
  if (tile.leyLine === true) {
    return {
      char: visual.char,
      fg: '#cc88ff',
      bg: blendColors(visual.bg, '#2a0840', 0.5),
    };
  }

  return { ...visual };
}

/**
 * Render an averaged region of multiple tiles (for zoomed-out views).
 * Uses dominant biome for character, blends colors.
 */
export function renderAveragedRegion(tiles: readonly RenderableTile[]): RenderedTile {
  if (tiles.length === 0) {
    return { char: ' ', fg: '#000000', bg: '#000000' };
  }

  if (tiles.length === 1 && tiles[0] !== undefined) {
    return renderTile(tiles[0]);
  }

  // Count biome occurrences to find dominant
  const biomeCounts = new Map<string, number>();
  let hasRiver = false;
  let hasLeyLine = false;

  for (const tile of tiles) {
    const count = biomeCounts.get(tile.biome) ?? 0;
    biomeCounts.set(tile.biome, count + 1);

    if (tile.riverId !== undefined) hasRiver = true;
    if (tile.leyLine === true) hasLeyLine = true;
  }

  // Find dominant biome
  let dominantBiome = tiles[0]?.biome ?? BiomeType.Plains;
  let maxCount = 0;
  for (const [biome, count] of biomeCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantBiome = biome;
    }
  }

  const biomeKey = dominantBiome as BiomeType;
  const visual = BIOME_CHARS[biomeKey] ?? { char: '?', fg: '#ff00ff', bg: '#000000' };

  // Blend colors from all tiles
  const blendedFg = blendTileColors(tiles, 'fg');
  const blendedBg = blendTileColors(tiles, 'bg');

  // Apply overlays
  let char = visual.char;
  let fg = blendedFg;
  let bg = blendedBg;

  if (hasRiver) {
    fg = blendColors(fg, '#4488cc', 0.3);
  }

  if (hasLeyLine) {
    bg = blendColors(bg, '#2a0840', 0.3);
    fg = blendColors(fg, '#cc88ff', 0.2);
  }

  return { char, fg, bg };
}

/**
 * Blend colors from multiple tiles.
 */
function blendTileColors(tiles: readonly RenderableTile[], channel: 'fg' | 'bg'): string {
  if (tiles.length === 0) return '#000000';

  let r = 0, g = 0, b = 0;
  let count = 0;

  for (const tile of tiles) {
    const biomeKey = tile.biome as BiomeType;
    const visual = BIOME_CHARS[biomeKey];
    if (visual === undefined) continue;

    const color = channel === 'fg' ? visual.fg : visual.bg;
    const rgb = parseHex(color);
    r += rgb.r;
    g += rgb.g;
    b += rgb.b;
    count++;
  }

  if (count === 0) return '#000000';

  return toHex(
    Math.round(r / count),
    Math.round(g / count),
    Math.round(b / count)
  );
}

/**
 * Render an entity marker that overlays terrain.
 */
export function renderEntityMarker(
  entityType: EntityMarkerKey | string,
  factionColor?: string
): RenderedTile {
  // Check if it's a known marker type
  const marker = ENTITY_MARKERS[entityType as EntityMarkerKey];

  if (marker !== undefined) {
    return {
      char: marker.char,
      fg: factionColor ?? marker.fg,
      bg: '#000000', // Transparent background (let terrain show through)
    };
  }

  // Default entity marker for unknown types
  return {
    char: '*',
    fg: factionColor ?? '#ffffff',
    bg: '#000000',
  };
}

/**
 * Get the appropriate entity marker type for an entity.
 */
export function getEntityMarkerType(entityType: string): EntityMarkerKey | null {
  const lowerType = entityType.toLowerCase();

  if (lowerType.includes('capital')) return 'factionCapital';
  if (lowerType.includes('city') || lowerType.includes('settlement') || lowerType.includes('town') || lowerType.includes('village')) return 'city';
  if (lowerType.includes('ruin')) return 'ruin';
  if (lowerType.includes('army') || lowerType.includes('military')) return 'army';
  if (lowerType.includes('temple') || lowerType.includes('shrine') || lowerType.includes('church')) return 'temple';
  if (lowerType.includes('academy') || lowerType.includes('school') || lowerType.includes('university')) return 'academy';

  return null;
}

/**
 * Resource type to display character mapping.
 */
export const RESOURCE_CHARS: Readonly<Record<string, string>> = {
  Food: '\u273D',           // ✽
  Timber: '\u2663',         // ♣
  Stone: '\u25A0',          // ■
  Iron: '\u2692',           // ⚒
  Gold: '\u2605',           // ★
  Gems: '\u2666',           // ♦
  MagicalComponents: '\u2726', // ✦
  LuxuryGoods: '\u2727',    // ✧
  Fish: '\u2248',           // ≈
  Copper: '\u25CF',         // ●
  Tin: '\u25CB',            // ○
  Coal: '\u25AA',           // ▪
  Herbs: '\u2698',          // ⚘
};

/**
 * Resource type to color mapping.
 */
export const RESOURCE_COLORS: Readonly<Record<string, string>> = {
  Food: '#88cc44',
  Timber: '#44aa44',
  Stone: '#888888',
  Iron: '#aaaacc',
  Gold: '#ffcc00',
  Gems: '#ff44ff',
  MagicalComponents: '#aa44ff',
  LuxuryGoods: '#ff8844',
  Fish: '#4488ff',
  Copper: '#cc8844',
  Tin: '#cccccc',
  Coal: '#444444',
  Herbs: '#44cc88',
};

/**
 * Render a resource marker.
 */
export function renderResourceMarker(resourceType: string): RenderedTile {
  const char = RESOURCE_CHARS[resourceType] ?? '\u00B7'; // · fallback
  const fg = RESOURCE_COLORS[resourceType] ?? '#888888';

  return {
    char,
    fg,
    bg: '#000000',
  };
}

/**
 * Parse a hex color string to RGB.
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
 * Convert RGB to hex string.
 */
function toHex(r: number, g: number, b: number): string {
  const rh = Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0');
  const gh = Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0');
  const bh = Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0');
  return `#${rh}${gh}${bh}`;
}

/**
 * Composite a tile with an entity marker overlay.
 * The entity marker's character and foreground replace the terrain,
 * but the terrain's background shows through.
 */
export function compositeEntityOnTile(
  terrain: RenderedTile,
  entity: RenderedTile
): RenderedTile {
  return {
    char: entity.char,
    fg: entity.fg,
    bg: terrain.bg,
  };
}

/**
 * Composite a tile with a resource marker overlay.
 * Only shows if the terrain permits (not on water).
 */
export function compositeResourceOnTile(
  terrain: RenderedTile,
  resource: RenderedTile,
  biome: string
): RenderedTile {
  // Don't show resources on water tiles
  if (biome === BiomeType.DeepOcean || biome === BiomeType.Ocean) {
    return terrain;
  }

  return {
    char: resource.char,
    fg: resource.fg,
    bg: terrain.bg,
  };
}
