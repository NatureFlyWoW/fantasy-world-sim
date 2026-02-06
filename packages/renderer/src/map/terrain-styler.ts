/**
 * Advanced terrain styling engine.
 * Combines noise-based character selection, biome-border dithering,
 * color jitter, and elevation shading into a single rendering pass.
 */

import { SimplexNoise } from './simplex-noise.js';
import { BIOME_RENDER_CONFIGS } from '../themes/biome-render-config.js';
import type { BiomeRenderConfig, CharEntry } from '../themes/biome-render-config.js';
import { BiomeType } from '../themes/biome-chars.js';
import { blendColors } from '../theme.js';
import type { RenderableTile, RenderedTile } from './tile-renderer.js';

/**
 * Neighbor biome information for border dithering.
 */
export interface NeighborBiomes {
  readonly north?: string;
  readonly south?: string;
  readonly east?: string;
  readonly west?: string;
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
 * Convert RGB to hex string.
 */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const rh = clamp(r).toString(16).padStart(2, '0');
  const gh = clamp(g).toString(16).padStart(2, '0');
  const bh = clamp(b).toString(16).padStart(2, '0');
  return `#${rh}${gh}${bh}`;
}

/**
 * Get the BiomeRenderConfig for a biome string, with Plains fallback.
 */
function getConfig(biome: string): BiomeRenderConfig {
  const key = biome as BiomeType;
  return BIOME_RENDER_CONFIGS[key] ?? BIOME_RENDER_CONFIGS[BiomeType.Plains];
}

/**
 * Select a character from a weighted pool using a noise value in [0, 1).
 */
function selectFromPool(chars: readonly CharEntry[], noiseVal: number): string {
  // Clamp to [0, 1)
  const t = Math.max(0, Math.min(0.9999, noiseVal));
  let cumulative = 0;
  for (const entry of chars) {
    cumulative += entry.weight;
    if (t < cumulative) {
      return entry.char;
    }
  }
  // Fallback to last entry
  return chars[chars.length - 1]?.char ?? '.';
}

/**
 * Select a character from an elevation-driven pool.
 * Higher elevation → later entries in the pool (more dramatic chars).
 */
function selectByElevation(
  chars: readonly CharEntry[],
  normalizedElevation: number
): string {
  const idx = Math.min(
    chars.length - 1,
    Math.floor(normalizedElevation * chars.length)
  );
  return chars[idx]?.char ?? chars[0]?.char ?? '^';
}

/**
 * Advanced terrain rendering engine.
 * Uses multiple noise layers for character selection, border dithering,
 * and color variation to produce Dwarf Fortress-style rich ASCII terrain.
 */
export class TerrainStyler {
  private readonly densityNoise: SimplexNoise;   // scale 0.01 — large-scale density
  private readonly charNoise: SimplexNoise;      // scale 0.12 — character selection
  private readonly colorNoise: SimplexNoise;     // scale 0.28 — color jitter

  constructor(seed = 12345) {
    this.densityNoise = new SimplexNoise(seed);
    this.charNoise = new SimplexNoise(seed + 1000);
    this.colorNoise = new SimplexNoise(seed + 2000);
  }

  /**
   * Style a single tile at world coordinates.
   */
  styleTile(
    tile: RenderableTile,
    wx: number,
    wy: number,
    neighbors?: NeighborBiomes
  ): RenderedTile {
    const config = getConfig(tile.biome);

    // --- Border dithering ---
    let charConfig = config;
    let blendFactor = 0; // 0 = use own biome, 1 = use neighbor
    let neighborConfig: BiomeRenderConfig | undefined;

    if (neighbors !== undefined) {
      const differentNeighbor = this.findDifferentNeighbor(tile.biome, neighbors);
      if (differentNeighbor !== undefined) {
        neighborConfig = getConfig(differentNeighbor);

        // Domain-warp the coordinates for organic borders
        const warpX = wx + this.densityNoise.noise2D(wx * 0.03, wy * 0.03) * 2.0;
        const warpY = wy + this.densityNoise.noise2D(wx * 0.03 + 100, wy * 0.03 + 100) * 2.0;

        // Sample blend factor
        blendFactor = (this.charNoise.noise2D(warpX * 0.25, warpY * 0.25) + 1) / 2;

        if (blendFactor < 0.35) {
          charConfig = neighborConfig;
        }
      }
    }

    // --- Character selection ---
    let char: string;

    // Check for river overlay first
    if (tile.riverId !== undefined) {
      char = '~';
    } else if (charConfig.elevationDriven === true && tile.elevation !== undefined) {
      // Elevation-driven: map normalized elevation to char index
      const normElev = this.normalizeElevation(tile.elevation);
      char = selectByElevation(charConfig.chars, normElev);
    } else {
      // Noise-driven character selection
      const charSample = this.charNoise.noise2D(wx * 0.12, wy * 0.12);
      const densitySample = this.densityNoise.noise2D(wx * 0.01, wy * 0.01);
      // Modulate: combine both noise layers to select char
      const combined = ((charSample + 1) / 2 + (densitySample + 1) / 4) % 1;
      char = selectFromPool(charConfig.chars, combined);
    }

    // --- Base colors ---
    let fg: string;
    let bg: string;

    if (tile.riverId !== undefined) {
      // River: blue fg on biome bg
      fg = '#4488cc';
      bg = config.bg;
    } else if (neighborConfig !== undefined && blendFactor > 0) {
      // Blend fg/bg between own and neighbor biome
      fg = blendColors(config.fg, neighborConfig.fg, blendFactor * 0.5);
      bg = blendColors(config.bg, neighborConfig.bg, blendFactor * 0.5);
    } else {
      fg = config.fg;
      bg = config.bg;
    }

    // --- Color jitter ---
    if (tile.riverId === undefined) {
      fg = this.applyJitter(fg, config.fgVariance, wx, wy, 0);
      bg = this.applyJitter(bg, config.bgVariance, wx, wy, 50);
    }

    // --- Elevation shading ---
    if (tile.elevation !== undefined && tile.riverId === undefined) {
      const brightnessFactor = this.elevationBrightness(tile.elevation);
      fg = this.applyBrightness(fg, brightnessFactor);
      bg = this.applyBrightness(bg, brightnessFactor);
    }

    // --- Ley line overlay ---
    if (tile.leyLine === true && tile.riverId === undefined) {
      fg = blendColors(fg, '#cc88ff', 0.4);
      bg = blendColors(bg, '#2a0840', 0.3);
    }

    return { char, fg, bg };
  }

  /**
   * Style an averaged region of tiles (for zoomed-out views).
   */
  styleAveragedRegion(
    tiles: readonly RenderableTile[],
    centerWx: number,
    centerWy: number
  ): RenderedTile {
    if (tiles.length === 0) {
      return { char: ' ', fg: '#0a0a1a', bg: '#0a0a1a' };
    }

    if (tiles.length === 1 && tiles[0] !== undefined) {
      return this.styleTile(tiles[0], centerWx, centerWy);
    }

    // Find dominant biome
    const biomeCounts = new Map<string, number>();
    let hasRiver = false;
    let hasLeyLine = false;
    let elevationSum = 0;
    let elevationCount = 0;

    for (const tile of tiles) {
      biomeCounts.set(tile.biome, (biomeCounts.get(tile.biome) ?? 0) + 1);
      if (tile.riverId !== undefined) hasRiver = true;
      if (tile.leyLine === true) hasLeyLine = true;
      if (tile.elevation !== undefined) {
        elevationSum += tile.elevation;
        elevationCount++;
      }
    }

    let dominantBiome = tiles[0]?.biome ?? BiomeType.Plains;
    let maxCount = 0;
    for (const [biome, count] of biomeCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantBiome = biome;
      }
    }

    const config = getConfig(dominantBiome);

    // Character selection from pool using noise at center
    let char: string;
    if (config.elevationDriven === true && elevationCount > 0) {
      const avgElev = elevationSum / elevationCount;
      char = selectByElevation(config.chars, this.normalizeElevation(avgElev));
    } else {
      const charSample = (this.charNoise.noise2D(centerWx * 0.12, centerWy * 0.12) + 1) / 2;
      char = selectFromPool(config.chars, charSample);
    }

    // Blend fg/bg from all tiles' configs
    let rFg = 0, gFg = 0, bFg = 0;
    let rBg = 0, gBg = 0, bBg = 0;
    let count = 0;

    for (const tile of tiles) {
      const c = getConfig(tile.biome);
      const fgRgb = parseHex(c.fg);
      const bgRgb = parseHex(c.bg);
      rFg += fgRgb.r; gFg += fgRgb.g; bFg += fgRgb.b;
      rBg += bgRgb.r; gBg += bgRgb.g; bBg += bgRgb.b;
      count++;
    }

    let fg = count > 0 ? toHex(rFg / count, gFg / count, bFg / count) : config.fg;
    let bg = count > 0 ? toHex(rBg / count, gBg / count, bBg / count) : config.bg;

    // Single color jitter at center
    fg = this.applyJitter(fg, config.fgVariance, centerWx, centerWy, 0);
    bg = this.applyJitter(bg, config.bgVariance, centerWx, centerWy, 50);

    // Average elevation shading
    if (elevationCount > 0) {
      const avgElev = elevationSum / elevationCount;
      const brightnessFactor = this.elevationBrightness(avgElev);
      fg = this.applyBrightness(fg, brightnessFactor);
      bg = this.applyBrightness(bg, brightnessFactor);
    }

    // River / ley line tinting
    if (hasRiver) {
      fg = blendColors(fg, '#4488cc', 0.3);
    }
    if (hasLeyLine) {
      fg = blendColors(fg, '#cc88ff', 0.2);
      bg = blendColors(bg, '#2a0840', 0.3);
    }

    return { char, fg, bg };
  }

  /**
   * Find the first neighbor biome that differs from the tile's own biome.
   */
  private findDifferentNeighbor(
    ownBiome: string,
    neighbors: NeighborBiomes
  ): string | undefined {
    if (neighbors.north !== undefined && neighbors.north !== ownBiome) return neighbors.north;
    if (neighbors.south !== undefined && neighbors.south !== ownBiome) return neighbors.south;
    if (neighbors.east !== undefined && neighbors.east !== ownBiome) return neighbors.east;
    if (neighbors.west !== undefined && neighbors.west !== ownBiome) return neighbors.west;
    return undefined;
  }

  /**
   * Normalize elevation to [0, 1] range.
   * Input: -1000 (deep ocean) to 10000 (mountain peak).
   */
  private normalizeElevation(elevation: number): number {
    const norm = (elevation + 1000) / 11000;
    return Math.max(0, Math.min(1, norm));
  }

  /**
   * Compute brightness factor from elevation.
   * Low elevation → darker (0.5), high elevation → brighter (1.2).
   */
  private elevationBrightness(elevation: number): number {
    const norm = this.normalizeElevation(elevation);
    const adjusted = Math.pow(norm, 1.5);
    return 0.5 + adjusted * 0.7;
  }

  /**
   * Apply per-channel color jitter using noise.
   */
  private applyJitter(
    hex: string,
    variance: number,
    wx: number,
    wy: number,
    offset: number
  ): string {
    if (variance === 0) return hex;

    const rgb = parseHex(hex);
    const rOff = this.colorNoise.noise2D((wx + offset) * 0.28, wy * 0.28) * variance;
    const gOff = this.colorNoise.noise2D(wx * 0.28, (wy + offset) * 0.28) * variance;
    const bOff = this.colorNoise.noise2D((wx + offset * 0.5) * 0.28, (wy + offset * 0.5) * 0.28) * variance;

    return toHex(rgb.r + rOff, rgb.g + gOff, rgb.b + bOff);
  }

  /**
   * Apply brightness factor to a hex color.
   */
  private applyBrightness(hex: string, factor: number): string {
    const rgb = parseHex(hex);
    return toHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
  }
}
