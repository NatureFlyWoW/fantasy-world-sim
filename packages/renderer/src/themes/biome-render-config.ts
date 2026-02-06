/**
 * Weighted character pools and color configuration for advanced ASCII terrain rendering.
 * Each biome has multiple characters with weights for noise-driven selection,
 * dual foreground/background colors, and per-channel color jitter ranges.
 */

import { BiomeType } from './biome-chars.js';

/**
 * A single character entry with its selection weight.
 */
export interface CharEntry {
  readonly char: string;
  readonly weight: number;
}

/**
 * Full rendering configuration for a biome.
 */
export interface BiomeRenderConfig {
  readonly chars: readonly CharEntry[];
  /** Base foreground hex color */
  readonly fg: string;
  /** Base background hex color (midnight-blue tinted) */
  readonly bg: string;
  /** Max RGB jitter per channel for foreground (0-25) */
  readonly fgVariance: number;
  /** Max RGB jitter per channel for background (0-15) */
  readonly bgVariance: number;
  /** If true, character selection uses elevation rather than noise */
  readonly elevationDriven?: true;
}

/**
 * Rendering configuration for all 17 biome types.
 * Character pools follow Dwarf Fortress / Brogue / CoQ design patterns:
 * multiple weighted glyphs per biome for visual variety.
 * Background colors carry the Aeternum midnight-blue tint.
 */
export const BIOME_RENDER_CONFIGS: Readonly<Record<BiomeType, BiomeRenderConfig>> = {
  [BiomeType.Forest]: {
    chars: [
      { char: '\u2660', weight: 0.25 }, // ♠
      { char: '\u2663', weight: 0.25 }, // ♣
      { char: '\u2191', weight: 0.15 }, // ↑
      { char: '\u03C4', weight: 0.10 }, // τ
      { char: '"', weight: 0.10 },
      { char: "'", weight: 0.08 },
      { char: '.', weight: 0.07 },
    ],
    fg: '#2d8c2d',
    bg: '#0c1a10',
    fgVariance: 15,
    bgVariance: 8,
  },
  [BiomeType.DenseForest]: {
    chars: [
      { char: '\u2660', weight: 0.30 }, // ♠
      { char: '\u2663', weight: 0.30 }, // ♣
      { char: '\u2191', weight: 0.15 }, // ↑
      { char: '\u0393', weight: 0.10 }, // Γ
      { char: '\u03C4', weight: 0.10 }, // τ
      { char: '"', weight: 0.05 },
    ],
    fg: '#1a5c1a',
    bg: '#081408',
    fgVariance: 12,
    bgVariance: 6,
  },
  [BiomeType.Plains]: {
    chars: [
      { char: '.', weight: 0.40 },
      { char: ',', weight: 0.20 },
      { char: '\u00B7', weight: 0.15 }, // ·
      { char: "'", weight: 0.10 },
      { char: '"', weight: 0.10 },
      { char: '`', weight: 0.05 },
    ],
    fg: '#7ec850',
    bg: '#141e0c',
    fgVariance: 20,
    bgVariance: 8,
  },
  [BiomeType.Mountain]: {
    chars: [
      { char: 'n', weight: 0.10 },
      { char: '\u2229', weight: 0.20 },  // ∩
      { char: '\u2302', weight: 0.25 },  // ⌂
      { char: '\u25B2', weight: 0.25 },  // ▲
      { char: '^', weight: 0.20 },
    ],
    fg: '#9e9e9e',
    bg: '#1e1e28',
    fgVariance: 15,
    bgVariance: 10,
    elevationDriven: true,
  },
  [BiomeType.HighMountain]: {
    chars: [
      { char: '\u25B2', weight: 0.40 },  // ▲
      { char: '^', weight: 0.30 },
      { char: '\u2302', weight: 0.20 },  // ⌂
      { char: '\u2229', weight: 0.10 },  // ∩
    ],
    fg: '#d0d0d0',
    bg: '#2a2a34',
    fgVariance: 10,
    bgVariance: 8,
    elevationDriven: true,
  },
  [BiomeType.DeepOcean]: {
    chars: [
      { char: '\u2248', weight: 0.50 },  // ≈
      { char: '~', weight: 0.30 },
      { char: '\u223C', weight: 0.20 },  // ∼
    ],
    fg: '#1a3a6e',
    bg: '#0a1020',
    fgVariance: 8,
    bgVariance: 5,
  },
  [BiomeType.Ocean]: {
    chars: [
      { char: '\u2248', weight: 0.40 },  // ≈
      { char: '~', weight: 0.35 },
      { char: '\u223C', weight: 0.25 },  // ∼
    ],
    fg: '#2e6cba',
    bg: '#0f1838',
    fgVariance: 10,
    bgVariance: 6,
  },
  [BiomeType.Coast]: {
    chars: [
      { char: '~', weight: 0.40 },
      { char: '.', weight: 0.25 },
      { char: ',', weight: 0.20 },
      { char: '\u223C', weight: 0.15 },  // ∼
    ],
    fg: '#5ea8d4',
    bg: '#142840',
    fgVariance: 12,
    bgVariance: 8,
  },
  [BiomeType.Desert]: {
    chars: [
      { char: '.', weight: 0.25 },
      { char: '\u00B7', weight: 0.20 },  // ·
      { char: '\u00B0', weight: 0.15 },  // °
      { char: ',', weight: 0.10 },
      { char: '~', weight: 0.10 },
      { char: '\u00B4', weight: 0.05 },  // ´
      { char: 'V', weight: 0.05 },
      { char: '\u221A', weight: 0.05 },  // √
      { char: '\u2248', weight: 0.05 },  // ≈
    ],
    fg: '#e0c860',
    bg: '#28200c',
    fgVariance: 20,
    bgVariance: 10,
  },
  [BiomeType.Tundra]: {
    chars: [
      { char: '\u2219', weight: 0.20 },  // ∙
      { char: '\u00B7', weight: 0.25 },  // ·
      { char: '\u00B0', weight: 0.20 },  // °
      { char: '*', weight: 0.10 },
      { char: '\u207F', weight: 0.10 },  // ⁿ
      { char: '\u2591', weight: 0.10 },  // ░
      { char: '\u2592', weight: 0.05 },  // ▒
    ],
    fg: '#a0b8c8',
    bg: '#181e28',
    fgVariance: 10,
    bgVariance: 6,
  },
  [BiomeType.IceCap]: {
    chars: [
      { char: '\u2591', weight: 0.30 },  // ░
      { char: '\u2592', weight: 0.25 },  // ▒
      { char: '\u2593', weight: 0.15 },  // ▓
      { char: '\u00B0', weight: 0.15 },  // °
      { char: '*', weight: 0.15 },
    ],
    fg: '#e8f0ff',
    bg: '#303848',
    fgVariance: 8,
    bgVariance: 5,
  },
  [BiomeType.Swamp]: {
    chars: [
      { char: '~', weight: 0.30 },
      { char: '\u2663', weight: 0.20 },  // ♣
      { char: '.', weight: 0.15 },
      { char: ',', weight: 0.15 },
      { char: "'", weight: 0.10 },
      { char: '"', weight: 0.10 },
    ],
    fg: '#5a7a3a',
    bg: '#141e10',
    fgVariance: 15,
    bgVariance: 8,
  },
  [BiomeType.Jungle]: {
    chars: [
      { char: '\u2588', weight: 0.20 },  // █
      { char: '\u2660', weight: 0.20 },  // ♠
      { char: '\u2663', weight: 0.20 },  // ♣
      { char: '\u0393', weight: 0.15 },  // Γ
      { char: '\u2191', weight: 0.15 },  // ↑
      { char: '\u03C4', weight: 0.10 },  // τ
    ],
    fg: '#10802a',
    bg: '#061008',
    fgVariance: 12,
    bgVariance: 6,
  },
  [BiomeType.Savanna]: {
    chars: [
      { char: '.', weight: 0.30 },
      { char: ',', weight: 0.20 },
      { char: "'", weight: 0.15 },
      { char: '\u00B7', weight: 0.15 },  // ·
      { char: '\u2191', weight: 0.10 },  // ↑
      { char: '"', weight: 0.10 },
    ],
    fg: '#c8a830',
    bg: '#221e0c',
    fgVariance: 18,
    bgVariance: 8,
  },
  [BiomeType.Taiga]: {
    chars: [
      { char: '\u2191', weight: 0.25 },  // ↑
      { char: '\u2660', weight: 0.20 },  // ♠
      { char: '\u2663', weight: 0.20 },  // ♣
      { char: '.', weight: 0.15 },
      { char: "'", weight: 0.10 },
      { char: '\u00B7', weight: 0.10 },  // ·
    ],
    fg: '#3a6848',
    bg: '#0e1814',
    fgVariance: 12,
    bgVariance: 6,
  },
  [BiomeType.Volcano]: {
    chars: [
      { char: '\u25B2', weight: 0.35 },  // ▲
      { char: '^', weight: 0.25 },
      { char: '\u2593', weight: 0.20 },  // ▓
      { char: '\u2592', weight: 0.10 },  // ▒
      { char: '*', weight: 0.10 },
    ],
    fg: '#e04020',
    bg: '#2a0808',
    fgVariance: 15,
    bgVariance: 8,
    elevationDriven: true,
  },
  [BiomeType.MagicWasteland]: {
    chars: [
      { char: '\u2593', weight: 0.20 },  // ▓
      { char: '\u2592', weight: 0.20 },  // ▒
      { char: '*', weight: 0.15 },
      { char: '\u00B7', weight: 0.15 },  // ·
      { char: '\u2219', weight: 0.15 },  // ∙
      { char: '?', weight: 0.15 },
    ],
    fg: '#b040e0',
    bg: '#180828',
    fgVariance: 20,
    bgVariance: 10,
  },
};
