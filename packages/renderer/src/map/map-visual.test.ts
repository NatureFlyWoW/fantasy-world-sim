/**
 * Visual map rendering tests with actual WorldMap generation.
 * Renders viewports to string and writes .txt files for manual inspection.
 *
 * Note: Uses dynamic imports for @fws/generator to avoid cross-package
 * TypeScript dependency issues. The vitest config provides the alias.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Viewport } from './viewport.js';
import { renderTile, renderAveragedRegion } from './tile-renderer.js';
import type { RenderableTile } from './tile-renderer.js';
import { BIOME_CHARS, BiomeType } from '../themes/biome-chars.js';
import { OverlayManager, OverlayType, PoliticalOverlay } from './overlay.js';
import type { TerritoryData } from './overlay.js';
import type { RenderContext } from '../types.js';
import type { World, WorldClock, EventLog, EventBus, SpatialIndex } from '@fws/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Output directory for visual test frames.
 */
const TEST_OUTPUT_DIR = path.resolve(__dirname, '../../test-output');

/**
 * Ensure output directory exists.
 */
function ensureOutputDir(): void {
  if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Mock render context for overlay tests.
 */
const mockContext: RenderContext = {
  world: {} as World,
  clock: {} as WorldClock,
  eventLog: {} as EventLog,
  eventBus: {} as EventBus,
  spatialIndex: {} as SpatialIndex,
};

/**
 * Interface for WorldMap tile.
 */
interface GeneratorTile {
  biome: string;
  riverId?: number;
  leyLine?: boolean;
  resources?: readonly string[];
}

/**
 * Interface matching WorldMap from @fws/generator.
 */
interface GeneratorWorldMap {
  generate(): void;
  getTile(x: number, y: number): GeneratorTile | undefined;
  getWidth(): number;
  getHeight(): number;
}

/**
 * Render a viewport region to a string buffer.
 * Returns an array of strings (one per row).
 */
function renderViewportToStrings(
  viewport: Viewport,
  getTile: (x: number, y: number) => RenderableTile | undefined,
  worldWidth: number,
  worldHeight: number
): string[] {
  const lines: string[] = [];
  const zoom = viewport.zoom;

  for (let sy = 0; sy < viewport.screenHeight; sy++) {
    let line = '';
    for (let sx = 0; sx < viewport.screenWidth; sx++) {
      // Calculate world coordinates for this screen position
      const worldPos = viewport.screenToWorld(sx, sy);

      if (zoom === 1) {
        // Direct 1:1 mapping
        const tile = getTile(worldPos.x, worldPos.y);
        if (tile !== undefined) {
          const rendered = renderTile(tile);
          line += rendered.char;
        } else {
          line += ' ';
        }
      } else {
        // Averaged region for zoomed-out views
        const tiles: RenderableTile[] = [];
        for (let dy = 0; dy < zoom; dy++) {
          for (let dx = 0; dx < zoom; dx++) {
            const wx = worldPos.x + dx;
            const wy = worldPos.y + dy;
            if (wx >= 0 && wx < worldWidth && wy >= 0 && wy < worldHeight) {
              const tile = getTile(wx, wy);
              if (tile !== undefined) {
                tiles.push(tile);
              }
            }
          }
        }
        if (tiles.length > 0) {
          const rendered = renderAveragedRegion(tiles);
          line += rendered.char;
        } else {
          line += ' ';
        }
      }
    }
    lines.push(line);
  }

  return lines;
}

/**
 * Render a viewport with political overlay to strings.
 * Faction territories are indicated by color codes in the output.
 */
function renderViewportWithOverlay(
  viewport: Viewport,
  getTile: (x: number, y: number) => RenderableTile | undefined,
  overlayManager: OverlayManager,
  worldWidth: number,
  worldHeight: number
): string[] {
  const lines: string[] = [];
  const zoom = viewport.zoom;

  for (let sy = 0; sy < viewport.screenHeight; sy++) {
    let line = '';
    for (let sx = 0; sx < viewport.screenWidth; sx++) {
      const worldPos = viewport.screenToWorld(sx, sy);

      // Get overlay modification for this position
      const overlayMod = overlayManager.renderAt(worldPos.x, worldPos.y, mockContext);

      if (zoom === 1) {
        const tile = getTile(worldPos.x, worldPos.y);
        if (tile !== undefined) {
          const rendered = renderTile(tile);
          // If overlay provides a character, use it; otherwise use terrain
          const char = overlayMod?.char ?? rendered.char;
          line += char;
        } else {
          line += ' ';
        }
      } else {
        const tiles: RenderableTile[] = [];
        for (let dy = 0; dy < zoom; dy++) {
          for (let dx = 0; dx < zoom; dx++) {
            const wx = worldPos.x + dx;
            const wy = worldPos.y + dy;
            if (wx >= 0 && wx < worldWidth && wy >= 0 && wy < worldHeight) {
              const tile = getTile(wx, wy);
              if (tile !== undefined) {
                tiles.push(tile);
              }
            }
          }
        }
        if (tiles.length > 0) {
          const rendered = renderAveragedRegion(tiles);
          line += overlayMod?.char ?? rendered.char;
        } else {
          line += ' ';
        }
      }
    }
    lines.push(line);
  }

  return lines;
}

/**
 * Write rendered output to a file.
 */
function writeOutput(filename: string, lines: string[], header: string): void {
  ensureOutputDir();
  const content = [header, '='.repeat(80), ...lines].join('\n');
  fs.writeFileSync(path.join(TEST_OUTPUT_DIR, filename), content, 'utf-8');
}

describe('MapVisual', () => {
  let worldMap: GeneratorWorldMap;

  beforeAll(async () => {
    // Dynamic import to avoid cross-package TypeScript issues
    // The vitest.config.ts provides the alias for @fws/generator
    // @ts-expect-error - Module resolved at runtime via vitest alias config
    const generator = await import('@fws/generator') as {
      WorldMap: new (config: Record<string, unknown>, rng: { fork: (label: string) => unknown }) => GeneratorWorldMap;
      SeededRNG: new (seed: number) => { fork: (label: string) => unknown };
    };

    const config = {
      seed: 42,
      worldSize: 'small',
      magicPrevalence: 'moderate',
      civilizationDensity: 'normal',
      dangerLevel: 'moderate',
      historicalDepth: 'moderate',
      geologicalActivity: 'normal',
      raceDiversity: 'standard',
      pantheonComplexity: 'theistic',
      technologyEra: 'iron_age',
    };

    const rng = new generator.SeededRNG(42);
    worldMap = new generator.WorldMap(config, rng as unknown as { fork: (label: string) => unknown });
    worldMap.generate();
  });

  describe('Viewport rendering with real terrain', () => {
    it('Test 1: renders 40x20 viewport at position (100,100) zoom 1 with biome chars', () => {
      // Create viewport: 40 columns x 20 rows, centered at (100,100), zoom 1
      const viewport = new Viewport(40, 20, 100, 100, 1);

      const getTile = (x: number, y: number): RenderableTile | undefined => {
        const tile = worldMap.getTile(x, y);
        if (tile === undefined) return undefined;
        return {
          biome: tile.biome,
          ...(tile.riverId !== undefined ? { riverId: tile.riverId } : {}),
          ...(tile.leyLine !== undefined ? { leyLine: tile.leyLine } : {}),
          ...(tile.resources !== undefined ? { resources: tile.resources } : {}),
        };
      };

      const lines = renderViewportToStrings(
        viewport,
        getTile,
        worldMap.getWidth(),
        worldMap.getHeight()
      );

      // Write output file
      writeOutput(
        'test1-viewport-zoom1.txt',
        lines,
        `Viewport: 40x20 at (100,100) zoom=1\nWorld: ${worldMap.getWidth()}x${worldMap.getHeight()}`
      );

      // Verify dimensions
      expect(lines.length).toBe(20);
      for (const line of lines) {
        expect(line.length).toBe(40);
      }

      // Collect all unique chars from the rendered output
      const allChars = new Set<string>();
      for (const line of lines) {
        for (const char of line) {
          allChars.add(char);
        }
      }

      // Get all valid biome chars from BIOME_CHARS
      const validBiomeChars = new Set<string>();
      for (const biome of Object.values(BiomeType)) {
        const visual = BIOME_CHARS[biome];
        if (visual !== undefined) {
          validBiomeChars.add(visual.char);
        }
      }
      // Add river char
      validBiomeChars.add('~');
      // Add space for out-of-bounds
      validBiomeChars.add(' ');

      // Verify that at least some biome chars appear
      const foundBiomeChars = [...allChars].filter((c) => validBiomeChars.has(c));
      expect(foundBiomeChars.length).toBeGreaterThan(0);

      // Log what we found for debugging
      console.log('Found biome chars:', foundBiomeChars.join(', '));
    });

    it('Test 2: renders 40x20 viewport at zoom 4 with correct dimensions', () => {
      // Create viewport: 40 columns x 20 rows, centered at (100,100), zoom 4
      const viewport = new Viewport(40, 20, 100, 100, 4);

      const getTile = (x: number, y: number): RenderableTile | undefined => {
        const tile = worldMap.getTile(x, y);
        if (tile === undefined) return undefined;
        return {
          biome: tile.biome,
          ...(tile.riverId !== undefined ? { riverId: tile.riverId } : {}),
          ...(tile.leyLine !== undefined ? { leyLine: tile.leyLine } : {}),
          ...(tile.resources !== undefined ? { resources: tile.resources } : {}),
        };
      };

      const lines = renderViewportToStrings(
        viewport,
        getTile,
        worldMap.getWidth(),
        worldMap.getHeight()
      );

      // Write output file
      writeOutput(
        'test2-viewport-zoom4.txt',
        lines,
        `Viewport: 40x20 at (100,100) zoom=4 (each char = 4x4 tiles)\nWorld: ${worldMap.getWidth()}x${worldMap.getHeight()}`
      );

      // Verify screen dimensions are still 40x20
      expect(lines.length).toBe(20);
      for (const line of lines) {
        expect(line.length).toBe(40);
      }

      // At zoom 4, visible world area is 40*4 x 20*4 = 160x80 tiles
      // Verify the viewport reports correct tile coverage
      expect(viewport.getVisibleTilesWidth()).toBe(160);
      expect(viewport.getVisibleTilesHeight()).toBe(80);

      // Verify bounds calculation
      const bounds = viewport.getVisibleBounds();
      // Center at 100 with half-width of 20*4=80 → minX ≈ 20
      expect(bounds.maxX - bounds.minX).toBeGreaterThanOrEqual(160);
      expect(bounds.maxY - bounds.minY).toBeGreaterThanOrEqual(80);
    });

    it('Test 3: renders with political overlay showing faction colors', () => {
      // Create viewport: 40 columns x 20 rows, centered at (100,100), zoom 1
      const viewport = new Viewport(40, 20, 100, 100, 1);

      const getTile = (x: number, y: number): RenderableTile | undefined => {
        const tile = worldMap.getTile(x, y);
        if (tile === undefined) return undefined;
        return {
          biome: tile.biome,
          ...(tile.riverId !== undefined ? { riverId: tile.riverId } : {}),
          ...(tile.leyLine !== undefined ? { leyLine: tile.leyLine } : {}),
          ...(tile.resources !== undefined ? { resources: tile.resources } : {}),
        };
      };

      // Setup overlay manager with political overlay
      const overlayManager = new OverlayManager();
      overlayManager.setActiveOverlay(OverlayType.Political);

      // Create mock faction territories
      // Divide the viewport area into 4 quadrants with different factions
      const factionColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
      const politicalOverlay = overlayManager.getOverlay<PoliticalOverlay>(
        OverlayType.Political
      );

      if (politicalOverlay !== undefined) {
        politicalOverlay.setTerritoryLookup((x, y): TerritoryData | null => {
          // Only apply to land tiles (check if in map bounds)
          if (x < 0 || x >= worldMap.getWidth() || y < 0 || y >= worldMap.getHeight()) {
            return null;
          }

          const tile = worldMap.getTile(x, y);
          if (tile === undefined) return null;

          // Skip water biomes (use string comparison since we don't have access to generator BiomeType)
          if (
            tile.biome === 'DeepOcean' ||
            tile.biome === 'Ocean' ||
            tile.biome === 'Coast'
          ) {
            return null;
          }

          // Assign faction based on quadrant
          const quadrantX = x < 100 ? 0 : 1;
          const quadrantY = y < 100 ? 0 : 1;
          const factionId = quadrantY * 2 + quadrantX;
          const factionColor = factionColors[factionId] ?? '#808080';

          // Mark borders (edges of quadrants)
          const isBorder =
            x === 99 || x === 100 || y === 99 || y === 100;

          return {
            factionId,
            factionColor,
            isCapital: false,
            isBorder,
          };
        });
      }

      const lines = renderViewportWithOverlay(
        viewport,
        getTile,
        overlayManager,
        worldMap.getWidth(),
        worldMap.getHeight()
      );

      // Create an annotated version showing faction territories
      // Since we can't show colors in text, add faction ID markers
      const annotatedLines: string[] = [];

      for (let sy = 0; sy < viewport.screenHeight; sy++) {
        let line = '';
        for (let sx = 0; sx < viewport.screenWidth; sx++) {
          const worldPos = viewport.screenToWorld(sx, sy);
          const tile = worldMap.getTile(worldPos.x, worldPos.y);

          if (tile === undefined) {
            line += ' ';
          } else if (
            tile.biome === 'DeepOcean' ||
            tile.biome === 'Ocean' ||
            tile.biome === 'Coast'
          ) {
            // Water tiles - show as water
            const rendered = renderTile({
              biome: tile.biome,
              ...(tile.riverId !== undefined ? { riverId: tile.riverId } : {}),
              ...(tile.leyLine !== undefined ? { leyLine: tile.leyLine } : {}),
            });
            line += rendered.char;
          } else {
            // Land tiles - show faction number (0-3)
            const quadrantX = worldPos.x < 100 ? 0 : 1;
            const quadrantY = worldPos.y < 100 ? 0 : 1;
            const factionId = quadrantY * 2 + quadrantX;
            line += String(factionId);
          }
        }
        annotatedLines.push(line);
      }

      // Write both outputs
      writeOutput(
        'test3-political-overlay.txt',
        lines,
        `Political Overlay Test\nViewport: 40x20 at (100,100) zoom=1\nWorld: ${worldMap.getWidth()}x${worldMap.getHeight()}\n\nTerrain characters with political overlay active.\nFaction territories modify background colors (not visible in ASCII).`
      );

      writeOutput(
        'test3-political-annotated.txt',
        annotatedLines,
        `Political Overlay Annotated\nViewport: 40x20 at (100,100) zoom=1\nWorld: ${worldMap.getWidth()}x${worldMap.getHeight()}\n\nFaction territories shown as numbers 0-3.\nWater shown as water chars, land shown as faction ID.\nQuadrants: 0=NW, 1=NE, 2=SW, 3=SE (split at x=100, y=100)`
      );

      // Verify the overlay is active
      expect(overlayManager.getActiveOverlayType()).toBe(OverlayType.Political);

      // Verify output dimensions
      expect(lines.length).toBe(20);
      expect(annotatedLines.length).toBe(20);

      // Verify that faction IDs appear in the annotated output
      const allFactionChars = annotatedLines.join('');
      const hasFaction0 = allFactionChars.includes('0');
      const hasFaction1 = allFactionChars.includes('1');
      const hasFaction2 = allFactionChars.includes('2');
      const hasFaction3 = allFactionChars.includes('3');

      // At minimum, we should see at least one faction (the viewport is centered
      // at 100,100 which is exactly at the quadrant boundary)
      const factionCount = [hasFaction0, hasFaction1, hasFaction2, hasFaction3].filter(
        Boolean
      ).length;
      expect(factionCount).toBeGreaterThanOrEqual(1);

      console.log(
        'Factions visible:',
        [hasFaction0 && '0', hasFaction1 && '1', hasFaction2 && '2', hasFaction3 && '3']
          .filter(Boolean)
          .join(', ')
      );
    });
  });
});
