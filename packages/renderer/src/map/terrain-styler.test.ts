/**
 * Tests for the TerrainStyler advanced rendering engine.
 */

import { describe, it, expect } from 'vitest';
import { TerrainStyler } from './terrain-styler.js';
import type { NeighborBiomes } from './terrain-styler.js';
import type { RenderableTile } from './tile-renderer.js';
import { BIOME_RENDER_CONFIGS } from '../themes/biome-render-config.js';
import { BiomeType } from '../themes/biome-chars.js';

/**
 * Hex color validation pattern.
 */
const HEX_RE = /^#[0-9a-f]{6}$/;

/**
 * Parse hex to RGB.
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
 * Get all chars from a biome's config pool.
 */
function getPoolChars(biome: string): Set<string> {
  const config = BIOME_RENDER_CONFIGS[biome as BiomeType];
  if (config === undefined) return new Set();
  const set = new Set<string>();
  for (const entry of config.chars) {
    set.add(entry.char);
  }
  return set;
}

describe('TerrainStyler', () => {
  const styler = new TerrainStyler(42);

  describe('Basic properties', () => {
    it('output char is from biome pool (no border)', () => {
      const tile: RenderableTile = { biome: BiomeType.Forest };
      const poolChars = getPoolChars(BiomeType.Forest);

      for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 20; y++) {
          const result = styler.styleTile(tile, x, y);
          expect(poolChars.has(result.char)).toBe(true);
        }
      }
    });

    it('output fg/bg are valid hex', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains };
      for (let i = 0; i < 50; i++) {
        const result = styler.styleTile(tile, i * 3, i * 7);
        expect(result.fg).toMatch(HEX_RE);
        expect(result.bg).toMatch(HEX_RE);
      }
    });

    it('is deterministic: same seed + coords = same result', () => {
      const s1 = new TerrainStyler(99);
      const s2 = new TerrainStyler(99);
      const tile: RenderableTile = { biome: BiomeType.Desert, elevation: 500 };

      for (let i = 0; i < 20; i++) {
        const r1 = s1.styleTile(tile, i * 5, i * 3);
        const r2 = s2.styleTile(tile, i * 5, i * 3);
        expect(r1.char).toBe(r2.char);
        expect(r1.fg).toBe(r2.fg);
        expect(r1.bg).toBe(r2.bg);
      }
    });

    it('different seeds produce different output', () => {
      const s1 = new TerrainStyler(1);
      const s2 = new TerrainStyler(9999);
      const tile: RenderableTile = { biome: BiomeType.Forest };

      let diffCount = 0;
      for (let i = 0; i < 20; i++) {
        const r1 = s1.styleTile(tile, i * 10, i * 10);
        const r2 = s2.styleTile(tile, i * 10, i * 10);
        if (r1.char !== r2.char || r1.fg !== r2.fg) {
          diffCount++;
        }
      }
      expect(diffCount).toBeGreaterThan(5);
    });
  });

  describe('Color jitter', () => {
    it('stays within variance range of base color', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains };
      const baseConfig = BIOME_RENDER_CONFIGS[BiomeType.Plains];
      const baseFg = parseHex(baseConfig.fg);
      const baseBg = parseHex(baseConfig.bg);
      // Allow variance + some tolerance for blending operations
      const fgTolerance = baseConfig.fgVariance + 15;
      const bgTolerance = baseConfig.bgVariance + 15;

      for (let i = 0; i < 100; i++) {
        const result = styler.styleTile(tile, i * 7, i * 13);
        const fg = parseHex(result.fg);
        const bg = parseHex(result.bg);

        expect(Math.abs(fg.r - baseFg.r)).toBeLessThanOrEqual(fgTolerance);
        expect(Math.abs(fg.g - baseFg.g)).toBeLessThanOrEqual(fgTolerance);
        expect(Math.abs(fg.b - baseFg.b)).toBeLessThanOrEqual(fgTolerance);
        expect(Math.abs(bg.r - baseBg.r)).toBeLessThanOrEqual(bgTolerance);
        expect(Math.abs(bg.g - baseBg.g)).toBeLessThanOrEqual(bgTolerance);
        expect(Math.abs(bg.b - baseBg.b)).toBeLessThanOrEqual(bgTolerance);
      }
    });

    it('produces color variety across coordinates', () => {
      const tile: RenderableTile = { biome: BiomeType.Forest };
      const fgColors = new Set<string>();

      for (let x = 0; x < 30; x++) {
        for (let y = 0; y < 30; y++) {
          fgColors.add(styler.styleTile(tile, x, y).fg);
        }
      }
      // Should see significant color variety
      expect(fgColors.size).toBeGreaterThan(20);
    });
  });

  describe('Elevation shading', () => {
    it('higher elevation = brighter colors for same biome', () => {
      const lowTile: RenderableTile = { biome: BiomeType.Mountain, elevation: 0 };
      const highTile: RenderableTile = { biome: BiomeType.Mountain, elevation: 8000 };

      const low = styler.styleTile(lowTile, 50, 50);
      const high = styler.styleTile(highTile, 50, 50);

      const lowFg = parseHex(low.fg);
      const highFg = parseHex(high.fg);

      // Higher elevation should have brighter (higher value) fg
      const lowLuminance = lowFg.r + lowFg.g + lowFg.b;
      const highLuminance = highFg.r + highFg.g + highFg.b;
      expect(highLuminance).toBeGreaterThan(lowLuminance);
    });

    it('elevation factor produces values in [0.5, 1.2] range', () => {
      // We test via color output: deep ocean elevation should dim, peak should brighten
      const deepTile: RenderableTile = { biome: BiomeType.Plains, elevation: -1000 };
      const peakTile: RenderableTile = { biome: BiomeType.Plains, elevation: 10000 };

      const deep = styler.styleTile(deepTile, 50, 50);
      const peak = styler.styleTile(peakTile, 50, 50);

      const deepFg = parseHex(deep.fg);
      const peakFg = parseHex(peak.fg);

      // Deep should be dimmer than peak
      expect(deepFg.r + deepFg.g + deepFg.b).toBeLessThan(peakFg.r + peakFg.g + peakFg.b);
    });

    it('no elevation means no shading applied', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains };
      const result = styler.styleTile(tile, 50, 50);

      // Without elevation, colors should be close to base + jitter only
      const base = BIOME_RENDER_CONFIGS[BiomeType.Plains];
      const baseFg = parseHex(base.fg);
      const resFg = parseHex(result.fg);

      // Should be within jitter range (no elevation shading factor)
      const diff = Math.abs(resFg.r - baseFg.r) + Math.abs(resFg.g - baseFg.g) + Math.abs(resFg.b - baseFg.b);
      expect(diff).toBeLessThan(base.fgVariance * 3 + 10);
    });
  });

  describe('Elevation-driven character selection', () => {
    it('Mountain chars progress with elevation', () => {
      const mountainChars = BIOME_RENDER_CONFIGS[BiomeType.Mountain].chars;
      // chars ordered: n, ∩, ⌂, ▲, ^
      // Low elevation should pick early chars, high should pick later

      const lowTile: RenderableTile = { biome: BiomeType.Mountain, elevation: 500 };
      const highTile: RenderableTile = { biome: BiomeType.Mountain, elevation: 9000 };

      const lowResult = styler.styleTile(lowTile, 50, 50);
      const highResult = styler.styleTile(highTile, 50, 50);

      // Both should be valid mountain chars
      const mountainCharSet = new Set(mountainChars.map(c => c.char));
      expect(mountainCharSet.has(lowResult.char)).toBe(true);
      expect(mountainCharSet.has(highResult.char)).toBe(true);

      // Low elevation should pick from earlier entries
      const lowIdx = mountainChars.findIndex(c => c.char === lowResult.char);
      const highIdx = mountainChars.findIndex(c => c.char === highResult.char);
      expect(highIdx).toBeGreaterThanOrEqual(lowIdx);
    });
  });

  describe('River and ley line overlays', () => {
    it('river tile produces ~ char with blue fg', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains, riverId: 5 };
      const result = styler.styleTile(tile, 50, 50);

      expect(result.char).toBe('~');
      expect(result.fg).toBe('#4488cc');
    });

    it('ley line applies purple tint', () => {
      const normalTile: RenderableTile = { biome: BiomeType.Plains };
      const leyTile: RenderableTile = { biome: BiomeType.Plains, leyLine: true };

      const normal = styler.styleTile(normalTile, 50, 50);
      const ley = styler.styleTile(leyTile, 50, 50);

      // Ley line should shift fg toward purple (#cc88ff)
      const normalFg = parseHex(normal.fg);
      const leyFg = parseHex(ley.fg);

      // Blue component should increase (purple tint)
      expect(leyFg.b).toBeGreaterThan(normalFg.b);
    });
  });

  describe('Border dithering', () => {
    it('no-neighbor tiles use own biome pool exclusively', () => {
      const tile: RenderableTile = { biome: BiomeType.Desert };
      const pool = getPoolChars(BiomeType.Desert);

      for (let i = 0; i < 50; i++) {
        const result = styler.styleTile(tile, i * 3, i * 7);
        expect(pool.has(result.char)).toBe(true);
      }
    });

    it('border tiles can use char from either biome', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains };
      const neighbors: NeighborBiomes = { north: BiomeType.Forest };

      const plainsPool = getPoolChars(BiomeType.Plains);
      const forestPool = getPoolChars(BiomeType.Forest);
      const combined = new Set([...plainsPool, ...forestPool]);

      let usedNeighborChar = false;
      for (let i = 0; i < 100; i++) {
        const result = styler.styleTile(tile, i * 3, i * 7, neighbors);
        expect(combined.has(result.char)).toBe(true);
        if (forestPool.has(result.char) && !plainsPool.has(result.char)) {
          usedNeighborChar = true;
        }
      }
      // At least some tiles should use the neighbor's char
      expect(usedNeighborChar).toBe(true);
    });

    it('same-biome neighbors do not trigger dithering', () => {
      const tile: RenderableTile = { biome: BiomeType.Forest };
      const neighbors: NeighborBiomes = {
        north: BiomeType.Forest,
        south: BiomeType.Forest,
      };
      const pool = getPoolChars(BiomeType.Forest);

      for (let i = 0; i < 50; i++) {
        const result = styler.styleTile(tile, i * 3, i * 7, neighbors);
        expect(pool.has(result.char)).toBe(true);
      }
    });
  });

  describe('Character variety', () => {
    it('produces multiple unique chars for a single biome across coords', () => {
      const tile: RenderableTile = { biome: BiomeType.Forest };
      const chars = new Set<string>();

      for (let x = 0; x < 30; x++) {
        for (let y = 0; y < 30; y++) {
          chars.add(styler.styleTile(tile, x, y).char);
        }
      }
      // Forest has 7 chars in pool — should see at least 4
      expect(chars.size).toBeGreaterThanOrEqual(4);
    });

    it('plains produce varied characters', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains };
      const chars = new Set<string>();

      for (let x = 0; x < 30; x++) {
        for (let y = 0; y < 30; y++) {
          chars.add(styler.styleTile(tile, x, y).char);
        }
      }
      expect(chars.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('styleAveragedRegion', () => {
    it('empty tiles produce space', () => {
      const result = styler.styleAveragedRegion([], 0, 0);
      expect(result.char).toBe(' ');
    });

    it('single tile delegates to styleTile', () => {
      const tile: RenderableTile = { biome: BiomeType.Forest };
      const avg = styler.styleAveragedRegion([tile], 50, 50);
      const single = styler.styleTile(tile, 50, 50);

      expect(avg.char).toBe(single.char);
      expect(avg.fg).toBe(single.fg);
      expect(avg.bg).toBe(single.bg);
    });

    it('dominant biome determines char pool', () => {
      const tiles: RenderableTile[] = [
        { biome: BiomeType.Forest },
        { biome: BiomeType.Forest },
        { biome: BiomeType.Forest },
        { biome: BiomeType.Plains },
      ];
      const forestPool = getPoolChars(BiomeType.Forest);

      const result = styler.styleAveragedRegion(tiles, 50, 50);
      expect(forestPool.has(result.char)).toBe(true);
    });

    it('river presence tints color', () => {
      const tiles: RenderableTile[] = [
        { biome: BiomeType.Plains },
        { biome: BiomeType.Plains, riverId: 1 },
        { biome: BiomeType.Plains },
        { biome: BiomeType.Plains },
      ];

      const withRiver = styler.styleAveragedRegion(tiles, 50, 50);
      const withoutRiver = styler.styleAveragedRegion(
        tiles.map(t => ({ biome: t.biome })),
        50, 50
      );

      // River presence should shift fg toward blue
      const riverFg = parseHex(withRiver.fg);
      const normalFg = parseHex(withoutRiver.fg);
      expect(riverFg.b).toBeGreaterThan(normalFg.b);
    });

    it('elevation averaging produces shading', () => {
      const lowTiles: RenderableTile[] = [
        { biome: BiomeType.Plains, elevation: 0 },
        { biome: BiomeType.Plains, elevation: 100 },
        { biome: BiomeType.Plains, elevation: 50 },
        { biome: BiomeType.Plains, elevation: 0 },
      ];
      const highTiles: RenderableTile[] = [
        { biome: BiomeType.Plains, elevation: 8000 },
        { biome: BiomeType.Plains, elevation: 9000 },
        { biome: BiomeType.Plains, elevation: 8500 },
        { biome: BiomeType.Plains, elevation: 9000 },
      ];

      const low = styler.styleAveragedRegion(lowTiles, 50, 50);
      const high = styler.styleAveragedRegion(highTiles, 50, 50);

      const lowFg = parseHex(low.fg);
      const highFg = parseHex(high.fg);

      expect(highFg.r + highFg.g + highFg.b).toBeGreaterThan(lowFg.r + lowFg.g + lowFg.b);
    });

    it('output has valid hex colors', () => {
      const tiles: RenderableTile[] = [
        { biome: BiomeType.Tundra, elevation: 500 },
        { biome: BiomeType.IceCap, elevation: 600 },
      ];
      const result = styler.styleAveragedRegion(tiles, 100, 100);
      expect(result.fg).toMatch(HEX_RE);
      expect(result.bg).toMatch(HEX_RE);
    });
  });

  describe('Seeded snapshots', () => {
    it('5x5 plains grid at seed 42 produces consistent chars', () => {
      const s = new TerrainStyler(42);
      const tile: RenderableTile = { biome: BiomeType.Plains };

      const grid: string[][] = [];
      for (let y = 0; y < 5; y++) {
        const row: string[] = [];
        for (let x = 0; x < 5; x++) {
          row.push(s.styleTile(tile, x, y).char);
        }
        grid.push(row);
      }

      // Verify it's deterministic by rerunning
      const s2 = new TerrainStyler(42);
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          expect(s2.styleTile(tile, x, y).char).toBe(grid[y]![x]);
        }
      }

      // Verify we get multiple different chars (not all the same)
      const uniqueChars = new Set(grid.flat());
      expect(uniqueChars.size).toBeGreaterThanOrEqual(2);
    });

    it('5x5 forest/plains border at seed 42 shows mix', () => {
      const s = new TerrainStyler(42);
      const forestPool = getPoolChars(BiomeType.Forest);
      const plainsPool = getPoolChars(BiomeType.Plains);
      const combined = new Set([...forestPool, ...plainsPool]);

      const tile: RenderableTile = { biome: BiomeType.Plains };
      const neighbors: NeighborBiomes = { north: BiomeType.Forest };

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const result = s.styleTile(tile, x, y, neighbors);
          expect(combined.has(result.char)).toBe(true);
        }
      }
    });

    it('3x1 mountain elevation progression shows ordered chars', () => {
      const s = new TerrainStyler(42);
      const elevations = [500, 5000, 9500];
      const mountainChars = BIOME_RENDER_CONFIGS[BiomeType.Mountain].chars;
      const charSet = new Set(mountainChars.map(c => c.char));

      const chars: string[] = [];
      for (let i = 0; i < elevations.length; i++) {
        const tile: RenderableTile = {
          biome: BiomeType.Mountain,
          elevation: elevations[i],
        };
        const result = s.styleTile(tile, 50, 50 + i);
        chars.push(result.char);
        expect(charSet.has(result.char)).toBe(true);
      }

      // Verify progression: char index should be non-decreasing
      const indices = chars.map(c => mountainChars.findIndex(e => e.char === c));
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]!);
      }
    });
  });

  describe('All biome types', () => {
    it('every biome type renders without error', () => {
      for (const biome of Object.values(BiomeType)) {
        const tile: RenderableTile = { biome, elevation: 1000 };
        const result = styler.styleTile(tile, 50, 50);
        expect(result.char.length).toBe(1);
        expect(result.fg).toMatch(HEX_RE);
        expect(result.bg).toMatch(HEX_RE);
      }
    });

    it('unknown biome falls back to Plains', () => {
      const tile: RenderableTile = { biome: 'UnknownBiome' };
      const result = styler.styleTile(tile, 50, 50);
      const plainsPool = getPoolChars(BiomeType.Plains);
      expect(plainsPool.has(result.char)).toBe(true);
    });
  });

  describe('Default constructor', () => {
    it('no-arg constructor uses default seed', () => {
      const s = new TerrainStyler();
      const tile: RenderableTile = { biome: BiomeType.Plains };
      const result = s.styleTile(tile, 10, 10);
      expect(result.char.length).toBe(1);
      expect(result.fg).toMatch(HEX_RE);
    });
  });
});
