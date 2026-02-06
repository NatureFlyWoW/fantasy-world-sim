/**
 * Tests for biome render configuration data.
 */

import { describe, it, expect } from 'vitest';
import { BiomeType } from './biome-chars.js';
import { BIOME_RENDER_CONFIGS } from './biome-render-config.js';
import type { BiomeRenderConfig } from './biome-render-config.js';

describe('BiomeRenderConfig', () => {
  const allBiomes = Object.values(BiomeType);

  it('every BiomeType has an entry', () => {
    for (const biome of allBiomes) {
      expect(BIOME_RENDER_CONFIGS[biome]).toBeDefined();
    }
  });

  it('weights sum to approximately 1.0 per biome', () => {
    for (const biome of allBiomes) {
      const config = BIOME_RENDER_CONFIGS[biome];
      const total = config.chars.reduce((sum, c) => sum + c.weight, 0);
      expect(total).toBeGreaterThanOrEqual(0.99);
      expect(total).toBeLessThanOrEqual(1.01);
    }
  });

  it('all chars are single-character strings', () => {
    for (const biome of allBiomes) {
      const config = BIOME_RENDER_CONFIGS[biome];
      for (const entry of config.chars) {
        expect(entry.char.length).toBe(1);
      }
    }
  });

  it('all fg/bg match #[0-9a-f]{6}', () => {
    const hexPattern = /^#[0-9a-f]{6}$/;
    for (const biome of allBiomes) {
      const config = BIOME_RENDER_CONFIGS[biome];
      expect(config.fg).toMatch(hexPattern);
      expect(config.bg).toMatch(hexPattern);
    }
  });

  it('fgVariance in [0, 30], bgVariance in [0, 20]', () => {
    for (const biome of allBiomes) {
      const config = BIOME_RENDER_CONFIGS[biome];
      expect(config.fgVariance).toBeGreaterThanOrEqual(0);
      expect(config.fgVariance).toBeLessThanOrEqual(30);
      expect(config.bgVariance).toBeGreaterThanOrEqual(0);
      expect(config.bgVariance).toBeLessThanOrEqual(20);
    }
  });

  it('no background is pure #000000', () => {
    for (const biome of allBiomes) {
      const config = BIOME_RENDER_CONFIGS[biome];
      expect(config.bg).not.toBe('#000000');
    }
  });

  it('only Mountain, HighMountain, and Volcano have elevationDriven', () => {
    const elevationBiomes = new Set([
      BiomeType.Mountain,
      BiomeType.HighMountain,
      BiomeType.Volcano,
    ]);
    for (const biome of allBiomes) {
      const config = BIOME_RENDER_CONFIGS[biome];
      if (elevationBiomes.has(biome)) {
        expect(config.elevationDriven).toBe(true);
      } else {
        expect(config.elevationDriven).toBeUndefined();
      }
    }
  });

  it('every biome has 3+ characters', () => {
    for (const biome of allBiomes) {
      const config = BIOME_RENDER_CONFIGS[biome];
      expect(config.chars.length).toBeGreaterThanOrEqual(3);
    }
  });
});
