/**
 * Biome rendering configuration for the PixiJS map renderer.
 *
 * Each biome has:
 * - Weighted glyph pool (chars with selection weights, from biome-render-config.ts)
 * - Three palette colors: background, primary glyph, detail
 *   (per design doc Section 2.3 — strictly on-palette)
 */

export interface GlyphEntry {
  readonly char: string;
  readonly weight: number;
}

export interface BiomeRenderConfig {
  readonly glyphs: readonly GlyphEntry[];
  /** Background fill color (hex) */
  readonly bg: string;
  /** Primary glyph tint color (hex) */
  readonly fg: string;
  /** Detail color for future dithering pass (hex) */
  readonly detail: string;
}

/**
 * Palette colors from design doc Section 2.1.
 * Referenced here to keep biome config self-contained.
 */
const P = {
  BG0: '#0c0c14', BG1: '#16161e', BG2: '#22222c',
  N0: '#3a3a44', N1: '#585860', N2: '#8a8a90',
  TW: '#1a3860', TS: '#2868a0', TG: '#4a7c3e', TF: '#2a5c34',
  TM: '#6a7080', TD: '#c8a060',
  FS: '#d0d8e8', FL: '#e04020', FM: '#9040cc',
  AU0: '#6b4e0a',
  CE: '#3aad6a',
} as const;

/**
 * Rendering config for all 17 biome types.
 *
 * Glyph pools ported from packages/renderer/src/themes/biome-render-config.ts.
 * Colors mapped to 28-color palette per design doc Section 2.3.
 */
export const BIOME_CONFIGS: Record<string, BiomeRenderConfig> = {
  DeepOcean: {
    glyphs: [
      { char: '\u2248', weight: 0.50 }, { char: '~', weight: 0.30 },
      { char: '\u223C', weight: 0.20 },
    ],
    bg: P.BG0, fg: P.TW, detail: P.TS,
  },
  Ocean: {
    glyphs: [
      { char: '\u2248', weight: 0.40 }, { char: '~', weight: 0.35 },
      { char: '\u223C', weight: 0.25 },
    ],
    bg: P.TW, fg: P.TS, detail: P.N2,
  },
  Coast: {
    glyphs: [
      { char: '~', weight: 0.40 }, { char: '.', weight: 0.25 },
      { char: ',', weight: 0.20 }, { char: '\u223C', weight: 0.15 },
    ],
    bg: P.TS, fg: P.TD, detail: P.TG,
  },
  Plains: {
    glyphs: [
      { char: '.', weight: 0.40 }, { char: ',', weight: 0.20 },
      { char: '\u00B7', weight: 0.15 }, { char: "'", weight: 0.10 },
      { char: '"', weight: 0.10 }, { char: '`', weight: 0.05 },
    ],
    bg: P.BG1, fg: P.TG, detail: P.TD,
  },
  Forest: {
    glyphs: [
      { char: '\u2660', weight: 0.25 }, { char: '\u2663', weight: 0.25 },
      { char: '\u2191', weight: 0.15 }, { char: '\u03C4', weight: 0.10 },
      { char: '"', weight: 0.10 }, { char: "'", weight: 0.08 },
      { char: '.', weight: 0.07 },
    ],
    bg: P.BG0, fg: P.TF, detail: P.TG,
  },
  DenseForest: {
    glyphs: [
      { char: '\u2660', weight: 0.30 }, { char: '\u2663', weight: 0.30 },
      { char: '\u2191', weight: 0.15 }, { char: '\u0393', weight: 0.10 },
      { char: '\u03C4', weight: 0.10 }, { char: '"', weight: 0.05 },
    ],
    bg: P.BG0, fg: P.TF, detail: P.BG1,
  },
  Mountain: {
    glyphs: [
      { char: '\u2302', weight: 0.25 }, { char: '\u25B2', weight: 0.25 },
      { char: '\u2229', weight: 0.20 }, { char: '^', weight: 0.20 },
      { char: 'n', weight: 0.10 },
    ],
    bg: P.BG2, fg: P.TM, detail: P.N2,
  },
  HighMountain: {
    glyphs: [
      { char: '\u25B2', weight: 0.40 }, { char: '^', weight: 0.30 },
      { char: '\u2302', weight: 0.20 }, { char: '\u2229', weight: 0.10 },
    ],
    bg: P.TM, fg: P.N2, detail: P.FS,
  },
  Desert: {
    glyphs: [
      { char: '.', weight: 0.25 }, { char: '\u00B7', weight: 0.20 },
      { char: '\u00B0', weight: 0.15 }, { char: ',', weight: 0.10 },
      { char: '~', weight: 0.10 }, { char: '\u00B4', weight: 0.05 },
      { char: 'V', weight: 0.05 }, { char: '\u221A', weight: 0.05 },
      { char: '\u2248', weight: 0.05 },
    ],
    bg: P.BG1, fg: P.TD, detail: P.AU0,
  },
  Tundra: {
    glyphs: [
      { char: '\u00B7', weight: 0.25 }, { char: '\u2219', weight: 0.20 },
      { char: '\u00B0', weight: 0.20 }, { char: '*', weight: 0.10 },
      { char: '\u207F', weight: 0.10 }, { char: '\u2591', weight: 0.10 },
      { char: '\u2592', weight: 0.05 },
    ],
    bg: P.BG2, fg: P.N2, detail: P.FS,
  },
  Swamp: {
    glyphs: [
      { char: '~', weight: 0.30 }, { char: '\u2663', weight: 0.20 },
      { char: '.', weight: 0.15 }, { char: ',', weight: 0.15 },
      { char: "'", weight: 0.10 }, { char: '"', weight: 0.10 },
    ],
    bg: P.BG0, fg: P.TF, detail: P.TS,
  },
  Jungle: {
    glyphs: [
      { char: '\u2588', weight: 0.20 }, { char: '\u2660', weight: 0.20 },
      { char: '\u2663', weight: 0.20 }, { char: '\u0393', weight: 0.15 },
      { char: '\u2191', weight: 0.15 }, { char: '\u03C4', weight: 0.10 },
    ],
    bg: P.BG0, fg: P.TF, detail: P.CE,
  },
  Savanna: {
    glyphs: [
      { char: '.', weight: 0.30 }, { char: ',', weight: 0.20 },
      { char: "'", weight: 0.15 }, { char: '\u00B7', weight: 0.15 },
      { char: '\u2191', weight: 0.10 }, { char: '"', weight: 0.10 },
    ],
    bg: P.BG1, fg: P.TD, detail: P.TG,
  },
  Taiga: {
    glyphs: [
      { char: '\u2191', weight: 0.25 }, { char: '\u2660', weight: 0.20 },
      { char: '\u2663', weight: 0.20 }, { char: '.', weight: 0.15 },
      { char: "'", weight: 0.10 }, { char: '\u00B7', weight: 0.10 },
    ],
    bg: P.BG0, fg: P.TF, detail: P.FS,
  },
  IceCap: {
    glyphs: [
      { char: '\u2591', weight: 0.30 }, { char: '\u2592', weight: 0.25 },
      { char: '\u2593', weight: 0.15 }, { char: '\u00B0', weight: 0.15 },
      { char: '*', weight: 0.15 },
    ],
    bg: P.BG2, fg: P.FS, detail: P.N2,
  },
  Volcano: {
    glyphs: [
      { char: '\u25B2', weight: 0.35 }, { char: '^', weight: 0.25 },
      { char: '\u2593', weight: 0.20 }, { char: '\u2592', weight: 0.10 },
      { char: '*', weight: 0.10 },
    ],
    bg: P.BG0, fg: P.FL, detail: P.TM,
  },
  MagicWasteland: {
    glyphs: [
      { char: '\u2593', weight: 0.20 }, { char: '\u2592', weight: 0.20 },
      { char: '*', weight: 0.15 }, { char: '\u00B7', weight: 0.15 },
      { char: '\u2219', weight: 0.15 }, { char: '?', weight: 0.15 },
    ],
    bg: P.BG0, fg: P.FM, detail: P.N1,
  },
};

/** Settlement/entity marker config */
export interface EntityMarkerConfig {
  readonly char: string;
  readonly fg: string;
  /** Maximum zoom level where this marker is visible (1=closest, 4=farthest) */
  readonly maxZoom: number;
}

export const ENTITY_MARKERS: Record<string, EntityMarkerConfig> = {
  village:   { char: '\u263C', fg: '#d4a832', maxZoom: 1 },  // ☼ CP
  town:      { char: '\u263C', fg: '#d4a832', maxZoom: 2 },  // ☼ CP
  city:      { char: '\u263C', fg: '#d4a832', maxZoom: 4 },  // ☼ CP
  capital:   { char: '\u2691', fg: '#c9a84c', maxZoom: 4 },  // ⚑ AU2
  ruin:      { char: '\u2020', fg: '#585860', maxZoom: 1 },  // † N1
  temple:    { char: '\u2605', fg: '#b87acc', maxZoom: 1 },  // ★ CR
  academy:   { char: '\u2727', fg: '#40b0c8', maxZoom: 1 },  // ✧ CC
  army:      { char: '\u2694', fg: '#c44040', maxZoom: 2 },  // ⚔ CM
};

/**
 * Select a glyph from a biome's weighted pool using a noise value [0, 1).
 */
export function selectGlyph(config: BiomeRenderConfig, noise: number): string {
  let cumulative = 0;
  for (const entry of config.glyphs) {
    cumulative += entry.weight;
    if (noise < cumulative) return entry.char;
  }
  // Fallback to last glyph
  return config.glyphs[config.glyphs.length - 1]!.char;
}
