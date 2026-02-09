import { describe, it, expect } from 'vitest';
import { WorldMap } from './world-map.js';
import { AsciiDebugRenderer } from './ascii-debug.js';
import { BiomeType } from './terrain-tile.js';
import { SeededRNG } from '../rng.js';
import type { WorldConfig } from '../config/types.js';
import { configFromPreset } from '../config/presets.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

function makeSmallConfig(seed: number): WorldConfig {
  return {
    ...configFromPreset('standard_fantasy', seed),
    worldSize: 'small',
  };
}

describe('WorldMap', () => {
  describe('generate', () => {
    let config: WorldConfig;
    let worldMap: WorldMap;
    let tiles: import('./terrain-tile.js').TerrainTile[][];

    beforeAll(() => {
      config = makeSmallConfig(42);
      const rng = new SeededRNG(config.seed);
      worldMap = new WorldMap(config, rng);
      tiles = worldMap.generate();
    });

    it('should generate a complete tile grid', () => {
      expect(tiles).toHaveLength(200);
      expect(tiles[0]).toHaveLength(200);
      expect(worldMap.getWidth()).toBe(200);
      expect(worldMap.getHeight()).toBe(200);
      expect(worldMap.isGenerated()).toBe(true);
    });

    it('should populate all tile fields', () => {
      const tile = worldMap.getTile(100, 100);
      expect(tile).toBeDefined();
      expect(typeof tile!.elevation).toBe('number');
      expect(typeof tile!.temperature).toBe('number');
      expect(typeof tile!.rainfall).toBe('number');
      expect(Object.values(BiomeType)).toContain(tile!.biome);
      expect(Array.isArray(tile!.resources)).toBe(true);
      expect(typeof tile!.plateId).toBe('number');
      expect(typeof tile!.leyLine).toBe('boolean');
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(config.seed);
      const map1 = new WorldMap(config, rng1);
      map1.generate();

      const rng2 = new SeededRNG(config.seed);
      const map2 = new WorldMap(config, rng2);
      map2.generate();

      // Compare a sample of tiles
      for (let y = 0; y < 200; y += 20) {
        for (let x = 0; x < 200; x += 20) {
          const t1 = map1.getTile(x, y)!;
          const t2 = map2.getTile(x, y)!;
          expect(t1.elevation).toBe(t2.elevation);
          expect(t1.biome).toBe(t2.biome);
          expect(t1.temperature).toBe(t2.temperature);
        }
      }
    });

    it('should produce diverse biomes', () => {
      const biomeSet = new Set<BiomeType>();
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          biomeSet.add(worldMap.getTile(x, y)!.biome);
        }
      }

      // Should have at least 5 different biome types
      expect(biomeSet.size).toBeGreaterThanOrEqual(5);
    });

    it('should generate rivers', () => {
      const rivers = worldMap.getRivers();
      expect(rivers.length).toBeGreaterThan(0);

      // At least some tiles should reference a river
      let riverTileCount = 0;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          if (worldMap.getTile(x, y)!.riverId !== undefined) {
            riverTileCount++;
          }
        }
      }
      expect(riverTileCount).toBeGreaterThan(0);
    });
  });

  describe('getTile', () => {
    let worldMap: WorldMap;

    beforeAll(() => {
      const config = makeSmallConfig(42);
      const rng = new SeededRNG(config.seed);
      worldMap = new WorldMap(config, rng);
      worldMap.generate();
    });

    it('should return undefined for out-of-bounds coordinates', () => {
      expect(worldMap.getTile(-1, 0)).toBeUndefined();
      expect(worldMap.getTile(0, -1)).toBeUndefined();
      expect(worldMap.getTile(200, 0)).toBeUndefined();
      expect(worldMap.getTile(0, 200)).toBeUndefined();
    });
  });

  describe('findSuitableSettlementSites', () => {
    let worldMap: WorldMap;

    beforeAll(() => {
      const config = makeSmallConfig(42);
      const rng = new SeededRNG(config.seed);
      worldMap = new WorldMap(config, rng);
      worldMap.generate();
    });

    it('should return scored settlement sites', () => {
      const sites = worldMap.findSuitableSettlementSites(10);

      expect(sites.length).toBeGreaterThan(0);
      expect(sites.length).toBeLessThanOrEqual(10);

      for (const site of sites) {
        expect(site.x).toBeGreaterThanOrEqual(0);
        expect(site.x).toBeLessThan(200);
        expect(site.y).toBeGreaterThanOrEqual(0);
        expect(site.y).toBeLessThan(200);
        expect(site.score).toBeGreaterThan(0);

        // Site should be on land
        const tile = worldMap.getTile(site.x, site.y)!;
        expect(tile.elevation).toBeGreaterThan(0);
      }
    });

    it('should return sites sorted by score descending', () => {
      const sites = worldMap.findSuitableSettlementSites(10);

      for (let i = 1; i < sites.length; i++) {
        expect(sites[i - 1]!.score).toBeGreaterThanOrEqual(sites[i]!.score);
      }
    });

    it('should throw if map not generated', () => {
      const config = makeSmallConfig(42);
      const rng = new SeededRNG(config.seed);
      const worldMap = new WorldMap(config, rng);

      expect(() => worldMap.findSuitableSettlementSites(5)).toThrow();
    });
  });

  describe('geological activity', () => {
    it('should generate more plates with volatile geology', () => {
      const volatileConfig: WorldConfig = {
        ...makeSmallConfig(42),
        geologicalActivity: 'volatile',
      };
      const dormantConfig: WorldConfig = {
        ...makeSmallConfig(42),
        geologicalActivity: 'dormant',
      };

      const rng1 = new SeededRNG(volatileConfig.seed);
      const map1 = new WorldMap(volatileConfig, rng1);
      map1.generate();

      const rng2 = new SeededRNG(dormantConfig.seed);
      const map2 = new WorldMap(dormantConfig, rng2);
      map2.generate();

      // Count unique plate IDs
      const plates1 = new Set<number>();
      const plates2 = new Set<number>();
      for (let y = 0; y < 200; y += 10) {
        for (let x = 0; x < 200; x += 10) {
          plates1.add(map1.getTile(x, y)!.plateId);
          plates2.add(map2.getTile(x, y)!.plateId);
        }
      }

      expect(plates1.size).toBeGreaterThan(plates2.size);
    });
  });

  describe('visual integration test', () => {
    it('should generate ASCII debug output for a small world', () => {
      const config = makeSmallConfig(42);
      const rng = new SeededRNG(config.seed);
      const worldMap = new WorldMap(config, rng);
      worldMap.generate();

      const renderer = new AsciiDebugRenderer();
      const biomeOutput = renderer.renderToString(worldMap, 'biome');
      const elevOutput = renderer.renderToString(worldMap, 'elevation');
      const resOutput = renderer.renderToString(worldMap, 'resources');

      // Verify output is non-empty
      expect(biomeOutput.length).toBeGreaterThan(100);
      expect(elevOutput.length).toBeGreaterThan(100);
      expect(resOutput.length).toBeGreaterThan(100);

      // Write to file for manual inspection
      const outDir = path.resolve(__dirname, '../../../../.debug-output');
      fs.mkdirSync(outDir, { recursive: true });

      fs.writeFileSync(
        path.join(outDir, 'world-biome.txt'),
        biomeOutput,
        'utf-8'
      );
      fs.writeFileSync(
        path.join(outDir, 'world-elevation.txt'),
        elevOutput,
        'utf-8'
      );
      fs.writeFileSync(
        path.join(outDir, 'world-resources.txt'),
        resOutput,
        'utf-8'
      );

      // Just verify the files were written (existence check)
      expect(fs.existsSync(path.join(outDir, 'world-biome.txt'))).toBe(true);
    });
  });
});
