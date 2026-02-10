/**
 * Tile variant pre-computation for faster terrain rendering.
 *
 * Generates 8 variants per biome (4 base + 4 detail variants) using seeded RNG.
 * At render time, hash(wx, wy) % 8 selects the variant for O(1) lookup.
 */
import { BIOME_CONFIGS, selectGlyph, type BiomeRenderConfig } from './biome-config.js';
import { glyphIndex } from './glyph-atlas.js';

export interface TileVariant {
  readonly glyphIndex: number;        // Pre-computed glyph atlas index
  readonly detailPositions: readonly [number, number][]; // 0-5 pixel positions for future detail pass
}

/**
 * Simple LCG for seeded random (matches SeededRNG pattern).
 */
class SimpleRNG {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }

  next(): number {
    this.state = ((this.state * 1103515245 + 12345) >>> 0) % 0x7fffffff;
    return this.state / 0x7fffffff;
  }
}

/**
 * Generate 8 tile variants for a single biome.
 */
function generateBiomeVariants(
  biome: string,
  config: BiomeRenderConfig,
  worldSeed: number
): TileVariant[] {
  const variants: TileVariant[] = [];
  const biomeHash = hashString(biome);

  for (let variantIdx = 0; variantIdx < 8; variantIdx++) {
    const seed = (worldSeed + biomeHash + variantIdx * 7919) >>> 0;
    const rng = new SimpleRNG(seed);

    // Select glyph from weighted pool
    const noise = rng.next();
    const char = selectGlyph(config, noise);
    const glyphIdx = glyphIndex(char);

    // Pre-compute 0-5 detail pixel positions (future enhancement)
    const detailCount = Math.floor(rng.next() * 6); // 0-5 details
    const detailPositions: [number, number][] = [];
    for (let i = 0; i < detailCount; i++) {
      const px = Math.floor(rng.next() * 16); // 0-15 (tile width)
      const py = Math.floor(rng.next() * 24); // 0-23 (tile height)
      detailPositions.push([px, py]);
    }

    variants.push({ glyphIndex: glyphIdx, detailPositions });
  }

  return variants;
}

/**
 * Hash string helper (matches heraldry pattern).
 */
function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Generate tile variant tables for all 17 biomes.
 * Call once during tilemap.init(snapshot).
 */
export function generateTileVariants(seed: number): Map<string, TileVariant[]> {
  const variantMap = new Map<string, TileVariant[]>();

  for (const [biome, config] of Object.entries(BIOME_CONFIGS)) {
    const variants = generateBiomeVariants(biome, config, seed);
    variantMap.set(biome, variants);
  }

  return variantMap;
}

/**
 * Select a tile variant for a world tile position.
 * Uses hash(wx, wy) % 8 for deterministic O(1) lookup.
 */
export function getTileVariant(
  variantMap: Map<string, TileVariant[]>,
  biome: string,
  wx: number,
  wy: number
): TileVariant | null {
  const variants = variantMap.get(biome);
  if (variants === undefined) return null;

  const hash = ((wx * 374761393) ^ (wy * 668265263)) >>> 0;
  const idx = hash % 8;
  return variants[idx] ?? null;
}
