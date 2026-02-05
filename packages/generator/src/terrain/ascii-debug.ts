/**
 * ASCII debug renderer for visual testing of generated terrain.
 * Uses the design doc's ASCII mapping for biome visualization.
 */

import type { WorldMap } from './world-map.js';
import { BiomeType, ResourceType } from './terrain-tile.js';

/**
 * Biome → ASCII character mapping.
 */
const BIOME_CHARS: Record<BiomeType, string> = {
  [BiomeType.DeepOcean]: '\u2248',     // ≈
  [BiomeType.Ocean]: '~',
  [BiomeType.Coast]: ',',
  [BiomeType.Plains]: '\u2591',         // ░
  [BiomeType.Forest]: '\u2593',         // ▓
  [BiomeType.DenseForest]: '\u2588',    // █
  [BiomeType.Mountain]: '\u2593',       // ▓
  [BiomeType.HighMountain]: '\u25B2',   // ▲
  [BiomeType.Desert]: '\u00B7',         // ·
  [BiomeType.Tundra]: '-',
  [BiomeType.Swamp]: '%',
  [BiomeType.Volcano]: '\u25B2',        // ▲
  [BiomeType.Jungle]: '\u2588',         // █
  [BiomeType.Savanna]: ':',
  [BiomeType.Taiga]: '\u2592',          // ▒
  [BiomeType.IceCap]: '#',
  [BiomeType.MagicWasteland]: '*',
};

/**
 * Resource → single character for resource layer.
 */
const RESOURCE_CHARS: Partial<Record<ResourceType, string>> = {
  [ResourceType.Food]: 'F',
  [ResourceType.Timber]: 'T',
  [ResourceType.Stone]: 'S',
  [ResourceType.Iron]: 'I',
  [ResourceType.Gold]: 'G',
  [ResourceType.Gems]: 'D',
  [ResourceType.MagicalComponents]: 'M',
  [ResourceType.LuxuryGoods]: 'L',
  [ResourceType.Fish]: 'f',
  [ResourceType.Copper]: 'C',
  [ResourceType.Tin]: 't',
  [ResourceType.Coal]: 'c',
  [ResourceType.Herbs]: 'H',
};

/**
 * Map elevation to a character for the elevation layer.
 */
function elevationChar(elevation: number): string {
  if (elevation < -500) return '\u2248';  // ≈ deep water
  if (elevation < 0) return '~';          // shallow water
  if (elevation < 500) return '.';
  if (elevation < 1500) return '-';
  if (elevation < 3000) return '=';
  if (elevation < 5000) return '^';
  if (elevation < 8000) return 'A';
  return '\u25B2';                         // ▲ peak
}

export class AsciiDebugRenderer {
  /**
   * Render a world map to an ASCII string for a given layer.
   * Optionally downsample for large maps.
   */
  renderToString(
    map: WorldMap,
    layer: 'biome' | 'elevation' | 'resources',
    maxWidth: number = 200,
    maxHeight: number = 60
  ): string {
    const w = map.getWidth();
    const h = map.getHeight();

    // Downsample factor
    const scaleX = Math.max(1, Math.ceil(w / maxWidth));
    const scaleY = Math.max(1, Math.ceil(h / maxHeight));

    const lines: string[] = [];
    lines.push(`=== ${layer.toUpperCase()} MAP (${w}x${h}, scale ${scaleX}:${scaleY}) ===`);

    for (let y = 0; y < h; y += scaleY) {
      let line = '';
      for (let x = 0; x < w; x += scaleX) {
        const tile = map.getTile(x, y);
        if (tile === undefined) {
          line += ' ';
          continue;
        }

        switch (layer) {
          case 'biome':
            // Show rivers as '~' overlaid on biome
            if (tile.riverId !== undefined && tile.elevation > 0) {
              line += '~';
            } else {
              line += BIOME_CHARS[tile.biome] ?? '?';
            }
            break;

          case 'elevation':
            line += elevationChar(tile.elevation);
            break;

          case 'resources': {
            const primaryRes = tile.resources[0];
            if (primaryRes !== undefined) {
              line += RESOURCE_CHARS[primaryRes] ?? '.';
            } else {
              line += '.';
            }
            break;
          }
        }
      }
      lines.push(line);
    }

    return lines.join('\n');
  }
}
