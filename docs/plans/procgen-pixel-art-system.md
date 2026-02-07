# Procedural Pixel Art Generation System

## Architecture Overview

This document defines the complete procedural pixel art generation pipeline for
Aetherum's graphical remake. The system replaces the ASCII terminal renderer with
pixel art generated via HTML5 Canvas 2D, served as PixiJS textures in the Electron
renderer process.

**Key principle:** Every visual asset is generated procedurally from the world seed.
Same seed produces identical visuals across sessions. No hand-authored sprite files.

### System Layers

```
WorldSeed (number)
  |
  +-- TerrainTileGenerator    -> 32x32 terrain tiles per biome (17 types)
  +-- TransitionTileGenerator -> 32x32 biome-edge blending tiles
  +-- NaturalFeatureGenerator -> Tree/rock/vegetation sprites
  +-- SettlementGenerator     -> Building/castle/farm sprites
  +-- HeraldryPixelGenerator  -> Pixel art shields/banners (replaces ASCII)
  +-- UIFrameGenerator        -> Ornate border/corner/badge sprites
  |
  +-- SpriteSheetPacker       -> Packs all into atlas textures
  +-- TextureCache            -> Session-lifetime cache, keyed by seed
```

### Proposed File Structure

```
packages/renderer/src/
  procgen/
    index.ts                    -- Public API: generateWorldTextures(seed)
    seeded-random.ts            -- SeededRandom class (xorshift128)
    color-utils.ts              -- HSL/RGB/hex conversion, blending, dithering
    noise-sampler.ts            -- Wraps SimplexNoise + fBm for tile generation
    terrain/
      terrain-tile-gen.ts       -- Per-biome 32x32 tile generation
      biome-palettes.ts         -- Color palette definitions per biome
      tile-transitions.ts       -- Edge blending / dithering between biomes
      river-renderer.ts         -- River path rendering across tiles
    features/
      tree-gen.ts               -- Procedural tree sprites (3 families)
      rock-gen.ts               -- Boulder/stone sprites
      vegetation-gen.ts         -- Grass clumps, flowers, crops
    structures/
      building-gen.ts           -- House/shop/temple building sprites
      castle-gen.ts             -- Modular castle assembly
      farm-gen.ts               -- Agricultural building sprites
      settlement-layout.ts      -- Composite settlement sprites
    heraldry/
      pixel-heraldry.ts         -- Pixel art coat of arms (replaces ASCII)
      shield-renderer.ts        -- Shield shape rasterization
      charge-renderer.ts        -- Heraldic device pixel patterns
    ui/
      frame-gen.ts              -- Ornate panel borders and corners
      badge-gen.ts              -- Event category icon badges
      icon-gen.ts               -- Resource/status icon sprites
    atlas/
      sprite-sheet.ts           -- Rectangle packing + atlas generation
      texture-cache.ts          -- PixiJS Texture.from(canvas) cache
```

---

## 1. TERRAIN TILE SYSTEM

### 1.1 Tile Specification

- **Tile size:** 32x32 pixels (top-down perspective)
- **Variants per biome:** 4 base variants + 4 detail variants = 8 tiles per biome
- **Total base tiles:** 17 biomes x 8 variants = 136 terrain tiles
- **Transition tiles:** ~80 additional for biome boundary blending
- **Format:** RGBA pixel data on OffscreenCanvas, packed into sprite atlas

### 1.2 Seeded Random & Noise Infrastructure

Reuses the existing `SimplexNoise` class from
`packages/renderer/src/map/simplex-noise.ts` and its `fbm()` function. A new
`SeededRandom` wrapper provides integer/float/choice helpers.

```typescript
// packages/renderer/src/procgen/seeded-random.ts

export class SeededRandom {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    // Initialize xorshift128 state from seed via splitmix32
    const sm = splitmix32(seed);
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();
  }

  /** Returns float in [0, 1). */
  next(): number {
    const t = this.s0 ^ (this.s0 << 11);
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = this.s3;
    this.s3 = (this.s3 ^ (this.s3 >>> 19)) ^ (t ^ (t >>> 8));
    return (this.s3 >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Float in [min, max). */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Pick random element from array. */
  choice<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Fork a sub-generator for independent stream. */
  fork(label: string): SeededRandom {
    let h = 5381;
    for (let i = 0; i < label.length; i++) {
      h = ((h << 5) + h + label.charCodeAt(i)) | 0;
    }
    return new SeededRandom((this.s0 ^ h) >>> 0);
  }
}

function splitmix32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return (t >>> 0) / 4294967296;
  };
}
```

### 1.3 Color Palette Definitions Per Biome

All palettes designed to match the medieval fantasy aesthetic from the mockup
images: earthy, desaturated tones with warm lighting bias. Each biome has a
structured palette with base, highlight, shadow, and detail colors.

```typescript
// packages/renderer/src/procgen/terrain/biome-palettes.ts

export interface BiomePalette {
  /** Primary fill colors (3-5 shades, light to dark). */
  readonly base: readonly string[];
  /** Highlight/accent colors for texture detail. */
  readonly highlights: readonly string[];
  /** Shadow/depth colors. */
  readonly shadows: readonly string[];
  /** Detail element colors (vegetation specks, stones, etc). */
  readonly details: readonly string[];
  /** Whether this biome supports dithering pattern overlay. */
  readonly useDithering: boolean;
  /** Top-left light factor (0.0=no lighting, 1.0=full). */
  readonly lightingStrength: number;
}

export const BIOME_PALETTES: Record<string, BiomePalette> = {

  // =========================================================================
  // WATER BIOMES
  // =========================================================================

  DeepOcean: {
    base:       ['#0a1428', '#0f1c38', '#142448', '#0c1830'],
    highlights: ['#1a3060', '#1e3868'],
    shadows:    ['#060e1c', '#081020'],
    details:    ['#182c50'],  // subtle wave crest hints
    useDithering: false,
    lightingStrength: 0.2,
  },

  Ocean: {
    base:       ['#0f2040', '#142850', '#1a3060', '#122445'],
    highlights: ['#205080', '#245890'],
    shadows:    ['#0a1830', '#0c1c38'],
    details:    ['#1a4070', '#184068'],
    useDithering: false,
    lightingStrength: 0.3,
  },

  Coast: {
    base:       ['#1a3050', '#1e3858', '#c0a878', '#b8a070'],
    highlights: ['#d0b888', '#245868'],
    shadows:    ['#142840', '#a08858'],
    details:    ['#e0c898', '#2868a0'],  // sand specks, foam
    useDithering: true,
    lightingStrength: 0.5,
  },

  // =========================================================================
  // TEMPERATE BIOMES
  // =========================================================================

  Plains: {
    base:       ['#4a7c3e', '#5a8c4e', '#6a9c5e', '#508844'],
    highlights: ['#7aac6e', '#88b878'],
    shadows:    ['#3a6830', '#2e5828'],
    details:    ['#8ab070', '#c8b860', '#6a8a50'],  // wildflowers, dry grass
    useDithering: true,
    lightingStrength: 0.6,
  },

  Forest: {
    base:       ['#2a5c34', '#326838', '#1e4a28', '#28583e'],
    highlights: ['#3a7844', '#448050'],
    shadows:    ['#163c1e', '#123018'],
    details:    ['#1a4020', '#4a8848', '#3e7240'],  // undergrowth variation
    useDithering: true,
    lightingStrength: 0.4,
  },

  DenseForest: {
    base:       ['#163c1e', '#1e4a28', '#122e18', '#1a4224'],
    highlights: ['#2a5c30', '#2e6434'],
    shadows:    ['#0e2410', '#0a1c0c'],
    details:    ['#0e2814', '#1a3c20'],  // deep canopy shadows
    useDithering: false,
    lightingStrength: 0.2,
  },

  // =========================================================================
  // ELEVATION BIOMES
  // =========================================================================

  Mountain: {
    base:       ['#6a7080', '#787e8e', '#5c6270', '#707888'],
    highlights: ['#8a90a0', '#98a0b0'],
    shadows:    ['#484e58', '#3c4048'],
    details:    ['#585e68', '#a0a8b8', '#4a5060'],  // stone texture
    useDithering: true,
    lightingStrength: 0.7,
  },

  HighMountain: {
    base:       ['#8a90a0', '#98a0b0', '#a8b0c0', '#c0c8d8'],
    highlights: ['#d0d8e8', '#e0e8f0', '#e8f0ff'],  // snow caps
    shadows:    ['#606878', '#505868'],
    details:    ['#b0b8c8', '#d8e0f0', '#707880'],  // snow + exposed rock
    useDithering: true,
    lightingStrength: 0.8,
  },

  // =========================================================================
  // ARID BIOMES
  // =========================================================================

  Desert: {
    base:       ['#c8a060', '#d0a868', '#b89850', '#c0a058'],
    highlights: ['#d8b878', '#e0c080'],
    shadows:    ['#a08040', '#907038'],
    details:    ['#e0c888', '#a88c48', '#c8a460'],  // sand ripples, stones
    useDithering: true,
    lightingStrength: 0.8,
  },

  Savanna: {
    base:       ['#a08838', '#b09840', '#8a7830', '#988034'],
    highlights: ['#c0a848', '#c8b050'],
    shadows:    ['#706020', '#605018'],
    details:    ['#687828', '#7a8a30', '#c8a838'],  // sparse grass, dry earth
    useDithering: true,
    lightingStrength: 0.7,
  },

  // =========================================================================
  // COLD BIOMES
  // =========================================================================

  Tundra: {
    base:       ['#7888a0', '#8898b0', '#6878a0', '#809098'],
    highlights: ['#98a8c0', '#a8b8cc'],
    shadows:    ['#586880', '#506078'],
    details:    ['#607088', '#4a5c78', '#90a0a8'],  // lichen, frozen earth
    useDithering: true,
    lightingStrength: 0.5,
  },

  IceCap: {
    base:       ['#c8d0e0', '#d0d8e8', '#d8e0f0', '#e0e8f8'],
    highlights: ['#e8f0ff', '#f0f8ff'],
    shadows:    ['#a0a8c0', '#90a0b8'],
    details:    ['#b0b8d0', '#a8b0c8'],  // ice cracks, subtle blue
    useDithering: false,
    lightingStrength: 0.6,
  },

  Taiga: {
    base:       ['#2e5840', '#386048', '#244c38', '#305a44'],
    highlights: ['#487050', '#507858'],
    shadows:    ['#1c3c28', '#183020'],
    details:    ['#c0c8d8', '#a0a8b0', '#3a6048'],  // snow patches, dark needles
    useDithering: true,
    lightingStrength: 0.4,
  },

  // =========================================================================
  // WET BIOMES
  // =========================================================================

  Swamp: {
    base:       ['#3a5428', '#4a6430', '#2e4820', '#3c5830'],
    highlights: ['#5a7438', '#607840'],
    shadows:    ['#243818', '#1e3010'],
    details:    ['#2a4830', '#506838', '#384c28'],  // murky water, moss
    useDithering: true,
    lightingStrength: 0.3,
  },

  Jungle: {
    base:       ['#1a5c28', '#226830', '#146024', '#1e642c'],
    highlights: ['#2a7838', '#328040'],
    shadows:    ['#103c18', '#0c2c10'],
    details:    ['#0e4418', '#268c34', '#1a5820'],  // dense canopy
    useDithering: false,
    lightingStrength: 0.3,
  },

  // =========================================================================
  // SPECIAL BIOMES
  // =========================================================================

  Volcano: {
    base:       ['#3a2018', '#4a2820', '#2e1810', '#3e2418'],
    highlights: ['#e04020', '#c83018', '#ff6030'],  // lava glow
    shadows:    ['#1e1008', '#180c04'],
    details:    ['#d03818', '#c0a060', '#5a3020'],  // lava veins, ash, scorched
    useDithering: true,
    lightingStrength: 0.4,
  },

  MagicWasteland: {
    base:       ['#2e1840', '#381e48', '#241438', '#301a42'],
    highlights: ['#8040c0', '#9050d0', '#b060e0'],  // magic glow
    shadows:    ['#180c28', '#140a20'],
    details:    ['#6030a0', '#a048e0', '#502888'],  // arcane sparks
    useDithering: true,
    lightingStrength: 0.5,
  },
};

// River palette (used by river-renderer.ts)
export const RIVER_PALETTE = {
  water:     ['#2860a0', '#3070b0', '#2468a8'],
  highlight: ['#4088c8', '#50a0d0'],
  bank:      ['#5a7a48', '#6a8a58', '#807050'],  // muddy edges
  foam:      ['#90c0e0', '#a0d0e8'],
};
```

### 1.4 Terrain Tile Generation Algorithm

Each 32x32 tile is generated by layering noise-driven color selection with
dithering patterns, detail placement, and top-left lighting.

```typescript
// packages/renderer/src/procgen/terrain/terrain-tile-gen.ts

import { SimplexNoise, fbm } from '../../map/simplex-noise.js';
import { BIOME_PALETTES } from './biome-palettes.js';
import type { BiomePalette } from './biome-palettes.js';
import { SeededRandom } from '../seeded-random.js';

const TILE_SIZE = 32;

/** Noise layers used by terrain generation. */
interface TerrainNoises {
  /** Large-scale color variation (frequency ~0.02). */
  base: SimplexNoise;
  /** Medium-scale texture (frequency ~0.08). */
  texture: SimplexNoise;
  /** Fine detail (frequency ~0.2). */
  detail: SimplexNoise;
  /** Dithering pattern driver (frequency ~0.15). */
  dither: SimplexNoise;
}

/**
 * Generate a single 32x32 terrain tile for a biome.
 *
 * @param biome      - BiomeType string (e.g., 'Plains', 'Forest')
 * @param variantIdx - 0-7, selects which variant of this biome to generate
 * @param seed       - World seed for determinism
 * @returns          - ImageData (32x32 RGBA)
 */
export function generateTerrainTile(
  biome: string,
  variantIdx: number,
  seed: number,
): ImageData {
  const palette = BIOME_PALETTES[biome] ?? BIOME_PALETTES['Plains']!;
  const tileSeed = hashCombine(seed, hashString(biome), variantIdx);

  const noises: TerrainNoises = {
    base:    new SimplexNoise(tileSeed),
    texture: new SimplexNoise(tileSeed + 1000),
    detail:  new SimplexNoise(tileSeed + 2000),
    dither:  new SimplexNoise(tileSeed + 3000),
  };

  const rng = new SeededRandom(tileSeed + 4000);
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const color = sampleTerrainPixel(x, y, variantIdx, palette, noises, rng);
      const idx = (y * TILE_SIZE + x) * 4;
      imageData.data[idx]     = color.r;
      imageData.data[idx + 1] = color.g;
      imageData.data[idx + 2] = color.b;
      imageData.data[idx + 3] = 255;
    }
  }

  return imageData;
}

/**
 * Sample a single pixel's color for a terrain tile.
 *
 * Layer stack (bottom to top):
 *   1. Base color from palette, selected by low-frequency noise
 *   2. Texture variation from medium-frequency noise
 *   3. Detail elements (specks, stones) from high-frequency noise
 *   4. Ordered dithering pattern (Bayer 4x4) for subtle texture
 *   5. Top-left directional lighting (brighten NW, darken SE)
 */
function sampleTerrainPixel(
  px: number,
  py: number,
  variant: number,
  palette: BiomePalette,
  noises: TerrainNoises,
  rng: SeededRandom,
): { r: number; g: number; b: number } {
  // --- World-space coordinates (offset by variant for uniqueness) ---
  const wx = px + variant * TILE_SIZE;
  const wy = py;

  // --- Layer 1: Base color selection ---
  // Low-frequency noise selects which base shade to use
  const baseNoise = (noises.base.noise2D(wx * 0.02, wy * 0.02) + 1) / 2;
  const baseIdx = Math.floor(baseNoise * palette.base.length);
  const baseColor = parseHex(
    palette.base[Math.min(baseIdx, palette.base.length - 1)]!
  );

  // --- Layer 2: Texture variation ---
  // Medium-frequency noise adds color shift toward highlights or shadows
  const texNoise = noises.texture.noise2D(wx * 0.08, wy * 0.08);
  let { r, g, b } = baseColor;

  if (texNoise > 0.3) {
    // Shift toward highlights
    const hlColor = parseHex(
      palette.highlights[
        Math.floor(((texNoise - 0.3) / 0.7) * palette.highlights.length)
      ] ?? palette.highlights[0]!
    );
    const t = (texNoise - 0.3) / 0.7 * 0.4;  // max 40% blend
    r = lerp(r, hlColor.r, t);
    g = lerp(g, hlColor.g, t);
    b = lerp(b, hlColor.b, t);
  } else if (texNoise < -0.3) {
    // Shift toward shadows
    const shColor = parseHex(
      palette.shadows[
        Math.floor(((-texNoise - 0.3) / 0.7) * palette.shadows.length)
      ] ?? palette.shadows[0]!
    );
    const t = (-texNoise - 0.3) / 0.7 * 0.3;  // max 30% blend
    r = lerp(r, shColor.r, t);
    g = lerp(g, shColor.g, t);
    b = lerp(b, shColor.b, t);
  }

  // --- Layer 3: Detail specks ---
  // High-frequency noise places occasional detail pixels
  const detailNoise = noises.detail.noise2D(wx * 0.2, wy * 0.2);
  if (detailNoise > 0.7 && palette.details.length > 0) {
    const detailColor = parseHex(
      palette.details[
        Math.floor(((detailNoise - 0.7) / 0.3) * palette.details.length)
      ] ?? palette.details[0]!
    );
    const t = 0.6;  // strong detail presence
    r = lerp(r, detailColor.r, t);
    g = lerp(g, detailColor.g, t);
    b = lerp(b, detailColor.b, t);
  }

  // --- Layer 4: Ordered dithering ---
  if (palette.useDithering) {
    const ditherNoise = noises.dither.noise2D(wx * 0.15, wy * 0.15);
    const bayerValue = BAYER_4X4[py % 4]![px % 4]!;
    const ditherOffset = (bayerValue / 16 - 0.5) * 8;  // +/- 4 color levels
    const ditherModulation = ditherNoise * 0.5 + 0.5;   // 0-1
    r += ditherOffset * ditherModulation;
    g += ditherOffset * ditherModulation;
    b += ditherOffset * ditherModulation;
  }

  // --- Layer 5: Top-left directional lighting ---
  if (palette.lightingStrength > 0) {
    // Gradient from top-left (bright) to bottom-right (dark)
    const lightFactor = 1.0 +
      palette.lightingStrength * 0.15 * (1.0 - (px + py) / (TILE_SIZE * 2));
    r *= lightFactor;
    g *= lightFactor;
    b *= lightFactor;
  }

  return {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(b), 0, 255),
  };
}

/** 4x4 Bayer ordered dithering matrix (values 0-15). */
const BAYER_4X4: readonly (readonly number[])[] = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function hashCombine(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    h ^= v;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
```

### 1.5 Per-Biome Generation Notes

Each biome type has specific procedural characteristics beyond the palette:

**Plains:**
- Base: Smooth green with gentle luminance waves (low-frequency noise)
- Details: Occasional wildflower pixels (yellow #c8b860, white #d0d0c0) at 5% density
- Texture: Subtle grass stripe patterns using Bayer dithering
- Variants: 0-3 have more green, 4-7 shift toward drier yellow-green

**Forest:**
- Base: Dark green with blue undertones
- Details: Very dark pixels (#0e2814) represent canopy gaps/shadow
- No tree sprites ON the tile itself (trees are separate feature sprites)
- Dithering creates leaf canopy texture illusion
- Variants: 0-3 lighter (forest edge), 4-7 darker (deep interior)

**DenseForest:**
- Like Forest but 20% darker overall, no dithering (uniform canopy)
- Occasional bright green pixels for light breaking through canopy

**Mountain:**
- Base color selection driven by vertical gradient (top=lighter, bottom=darker)
  within each tile to suggest slope facing
- Detail pixels include occasional stone texture (lighter grey spots)
- Variants: 0-3 have more exposed rock, 4-7 include sparse vegetation

**HighMountain:**
- Top third of tile biased toward snow palette (#d0d8e8, #e0e8f0)
- Snow line determined by detail noise threshold (>0.4 = snow)
- Exposed rock patches where noise dips below threshold
- Strong top-left lighting for dramatic ridgeline effect

**Desert:**
- Warm sand tones with subtle dune wave pattern
- Detail noise creates occasional darker stone/shadow specks
- Dithering simulates sand grain texture
- Variants: 0-3 pale sand, 4-7 deeper ochre/rocky desert

**Coast:**
- Tile is split: top portion water-tinted, bottom portion sand-tinted
- Split position varies by variant (40-60% mark)
- Transition uses dithering between sand and shallow water colors
- Foam detail pixels (#e0c898) at the water line

**Swamp:**
- Dark muddy green base with scattered water pixels (#2a4830)
- Detail noise places darker spots (standing water) and lighter moss
- No strong dithering (murky, undifferentiated look)

**Jungle:**
- Very dark saturated green, minimal lighting (dense canopy blocks light)
- Occasional bright green pixels (#268c34) where sunlight penetrates
- Similar to DenseForest but warmer green hue

**Tundra:**
- Cold blue-grey palette with sparse texture
- Detail pixels include frozen earth patches (darker) and ice crystals (lighter)
- Moderate dithering for stony/frozen ground texture

**IceCap:**
- Nearly white with subtle blue shadows
- Very low contrast between base shades
- No dithering (smooth ice surface)
- Occasional crack lines (thin dark pixels)

**Taiga:**
- Between Forest and Tundra: dark green base with snow patches
- Detail layer includes white/grey pixels for snow on ground
- Snow density controlled by detail noise (>0.5 = snow patch)

**Savanna:**
- Warm yellow-brown base, desaturated green details
- Sparse grass tufts (detail pixels in muted green)
- High dithering intensity for dry-earth texture
- Strong top-left lighting (open landscape)

**Volcano:**
- Dark stone base with rare bright lava pixels (#e04020, #ff6030)
- Lava vein probability controlled by detail noise (>0.85 = lava pixel)
- Otherwise grey-brown scorched earth
- Subtle red underglow in shadows

**MagicWasteland:**
- Purple-black base with sporadic arcane glow pixels
- Glow pixels (#9050d0, #b060e0) appear where detail noise > 0.75
- Unsettling visual: dithering pattern is irregular (noise-modulated Bayer)
- Variants cycle between more/less purple intensity

### 1.6 Tile Transition / Blending Between Biomes

Biome edges use noise-driven per-pixel blending. For each map tile adjacent to
a different biome, a transition tile is generated that mixes the two palettes.

```typescript
// packages/renderer/src/procgen/terrain/tile-transitions.ts

/**
 * Generate a transition tile that blends biomeA into biomeB.
 *
 * @param biomeA        - The "from" biome (this tile's biome)
 * @param biomeB        - The neighbor biome (blending into)
 * @param direction     - Which edge is the neighbor: 'N' | 'S' | 'E' | 'W'
 * @param seed          - World seed
 * @returns             - 32x32 ImageData with blended terrain
 *
 * Algorithm:
 *   1. Compute a blend gradient across the tile in the neighbor direction
 *   2. Domain-warp the gradient with low-frequency noise for organic edges
 *   3. For each pixel, generate BOTH biome colors, then lerp by blend factor
 *   4. Apply per-pixel dithering at the blend boundary for crisp pixel look
 */
export function generateTransitionTile(
  biomeA: string,
  biomeB: string,
  direction: 'N' | 'S' | 'E' | 'W',
  seed: number,
): ImageData {
  const paletteA = BIOME_PALETTES[biomeA] ?? BIOME_PALETTES['Plains']!;
  const paletteB = BIOME_PALETTES[biomeB] ?? BIOME_PALETTES['Plains']!;
  const tSeed = hashCombine(seed, hashString(biomeA + biomeB + direction));

  const warpNoise = new SimplexNoise(tSeed);
  const blendNoise = new SimplexNoise(tSeed + 500);

  const imageData = new ImageData(TILE_SIZE, TILE_SIZE);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      // Base gradient (0.0 at biomeA side, 1.0 at biomeB side)
      let gradient: number;
      switch (direction) {
        case 'N': gradient = 1.0 - y / TILE_SIZE; break;
        case 'S': gradient = y / TILE_SIZE; break;
        case 'E': gradient = x / TILE_SIZE; break;
        case 'W': gradient = 1.0 - x / TILE_SIZE; break;
      }

      // Domain warp for organic boundary
      const warpX = x + warpNoise.noise2D(x * 0.08, y * 0.08) * 6;
      const warpY = y + warpNoise.noise2D(x * 0.08 + 50, y * 0.08 + 50) * 6;
      const noiseWarp = (blendNoise.noise2D(warpX * 0.1, warpY * 0.1) + 1) / 2;

      // Combine gradient with noise for final blend factor
      let blend = gradient * 0.6 + noiseWarp * 0.4;

      // Dithering at boundary (crisp pixel art transitions)
      const bayerThreshold = BAYER_4X4[y % 4]![x % 4]! / 16;
      if (blend > 0.3 && blend < 0.7) {
        blend = blend > bayerThreshold ? 1.0 : 0.0;
      } else {
        blend = blend > 0.5 ? 1.0 : 0.0;
      }

      // Sample both biome colors and select based on blend
      // (Could lerp for smoother result, but hard-cut with dithering
      //  looks more like authentic pixel art)
      const colorA = sampleBiomeBaseColor(x, y, paletteA, tSeed);
      const colorB = sampleBiomeBaseColor(x, y, paletteB, tSeed + 100);

      const idx = (y * TILE_SIZE + x) * 4;
      if (blend < 0.5) {
        imageData.data[idx]     = colorA.r;
        imageData.data[idx + 1] = colorA.g;
        imageData.data[idx + 2] = colorA.b;
      } else {
        imageData.data[idx]     = colorB.r;
        imageData.data[idx + 1] = colorB.g;
        imageData.data[idx + 2] = colorB.b;
      }
      imageData.data[idx + 3] = 255;
    }
  }

  return imageData;
}
```

### 1.7 River Rendering Across Tiles

Rivers are rendered as a separate sprite layer on tiles that have `riverId`.
The river path follows a gentle curve through the tile center, with width
determined by accumulated flow.

```typescript
// packages/renderer/src/procgen/terrain/river-renderer.ts

/**
 * Generate a river overlay for a tile.
 *
 * @param entryEdge  - Which edge the river enters ('N','S','E','W', or null)
 * @param exitEdge   - Which edge the river exits
 * @param width      - River width in pixels (2-8, derived from flow volume)
 * @param seed       - For consistent curve shape
 * @returns          - 32x32 ImageData with alpha (river pixels opaque, rest transparent)
 *
 * Algorithm:
 *   1. Compute entry/exit points on tile edges
 *   2. Generate cubic bezier curve between them with noise-warped control points
 *   3. For each pixel, compute distance to curve
 *   4. If within river width: water color
 *   5. If within width+1: bank color (muddy edge)
 *   6. Else: transparent
 */
export function generateRiverOverlay(
  entryEdge: 'N' | 'S' | 'E' | 'W' | null,
  exitEdge: 'N' | 'S' | 'E' | 'W',
  width: number,
  seed: number,
): ImageData {
  const imageData = new ImageData(TILE_SIZE, TILE_SIZE);
  const rng = new SeededRandom(seed);

  // Entry/exit coordinates on tile edges
  const entry = edgePoint(entryEdge ?? oppositeEdge(exitEdge), rng);
  const exit = edgePoint(exitEdge, rng);

  // Control points for bezier curve (noise-warped toward center)
  const cx = TILE_SIZE / 2 + rng.nextFloat(-4, 4);
  const cy = TILE_SIZE / 2 + rng.nextFloat(-4, 4);
  const cp1 = { x: lerp(entry.x, cx, 0.5), y: lerp(entry.y, cy, 0.5) };
  const cp2 = { x: lerp(exit.x, cx, 0.5), y: lerp(exit.y, cy, 0.5) };

  // Sample bezier curve points
  const curvePoints: { x: number; y: number }[] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    curvePoints.push(cubicBezier(entry, cp1, cp2, exit, t));
  }

  // For each pixel, compute minimum distance to curve
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let minDist = Infinity;
      for (const cp of curvePoints) {
        const dx = x - cp.x;
        const dy = y - cp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) minDist = dist;
      }

      const idx = (y * TILE_SIZE + x) * 4;
      const halfWidth = width / 2;

      if (minDist <= halfWidth) {
        // Water pixel
        const waterShade = RIVER_PALETTE.water[
          Math.floor(rng.next() * RIVER_PALETTE.water.length)
        ]!;
        const c = parseHex(waterShade);
        // Subtle highlight near center of river
        const centerFactor = 1.0 - minDist / halfWidth;
        if (centerFactor > 0.6) {
          const hl = parseHex(RIVER_PALETTE.highlight[0]!);
          c.r = lerp(c.r, hl.r, (centerFactor - 0.6) * 0.5);
          c.g = lerp(c.g, hl.g, (centerFactor - 0.6) * 0.5);
          c.b = lerp(c.b, hl.b, (centerFactor - 0.6) * 0.5);
        }
        imageData.data[idx]     = clamp(Math.round(c.r), 0, 255);
        imageData.data[idx + 1] = clamp(Math.round(c.g), 0, 255);
        imageData.data[idx + 2] = clamp(Math.round(c.b), 0, 255);
        imageData.data[idx + 3] = 255;
      } else if (minDist <= halfWidth + 1.5) {
        // Bank pixel (muddy edge)
        const bankColor = parseHex(
          RIVER_PALETTE.bank[Math.floor(rng.next() * RIVER_PALETTE.bank.length)]!
        );
        imageData.data[idx]     = bankColor.r;
        imageData.data[idx + 1] = bankColor.g;
        imageData.data[idx + 2] = bankColor.b;
        imageData.data[idx + 3] = 200;  // semi-transparent for blending
      }
      // else: remains transparent (0,0,0,0)
    }
  }

  return imageData;
}
```

---

## 2. NATURAL FEATURE SPRITES

### 2.1 Tree Generation

Trees match the triangle-conifer style from the mockup images. Three families:
conifer (most common), deciduous (round canopy), and tropical (palm-like).

**Conifer tree (most common in mockups):**
- Height: 8-14 pixels
- Shape: Stacked triangles narrowing toward top
- Trunk: 1-2px wide brown column, 2-4px tall
- Canopy: 2-3 stacked triangle layers in dark green

```typescript
// packages/renderer/src/procgen/features/tree-gen.ts

export type TreeFamily = 'conifer' | 'deciduous' | 'tropical';

export interface TreeSpec {
  readonly family: TreeFamily;
  readonly height: number;        // total height in pixels
  readonly canopyLayers: number;  // number of triangle tiers (conifer)
  readonly canopyWidth: number;   // max width of lowest canopy tier
  readonly trunkHeight: number;
  readonly trunkWidth: number;
}

const TREE_PALETTES = {
  conifer: {
    canopy:  ['#1a4a28', '#225830', '#1e5028', '#2a5c34'],
    canopyHL: ['#2e6838', '#347040'],       // sunlit side
    canopySH: ['#123018', '#0e2814'],       // shadow side
    trunk:   ['#4a3828', '#3e3020', '#564030'],
  },
  deciduous: {
    canopy:  ['#3a6e38', '#447840', '#4a8248'],
    canopyHL: ['#5a9050', '#64a058'],
    canopySH: ['#2a5428', '#224820'],
    trunk:   ['#5a4430', '#4e3c28', '#644c38'],
  },
  tropical: {
    canopy:  ['#288038', '#308840', '#389048'],
    canopyHL: ['#40a050', '#48a858'],
    canopySH: ['#1c6028', '#186020'],
    trunk:   ['#6a5840', '#5e5038', '#705e48'],
  },
};

/**
 * Generate a tree sprite.
 *
 * @param family  - Tree family (determines shape + colors)
 * @param size    - 'small' (8px), 'medium' (11px), 'large' (14px)
 * @param seed    - For variation within family
 * @returns       - ImageData with alpha channel (transparent background)
 *
 * Conifer algorithm:
 *   1. Draw trunk (centered, brown, 1-2px wide)
 *   2. Stack 2-3 triangle layers from bottom to top
 *   3. Each layer is narrower than the one below
 *   4. Left side of each triangle: highlight color (top-left light)
 *   5. Right side: shadow color
 *   6. Occasional detail pixels at triangle edges
 *
 * Deciduous algorithm:
 *   1. Draw trunk
 *   2. Draw filled circle/ellipse for canopy
 *   3. Apply noise-based edge irregularity
 *   4. Light/shadow split on canopy circle
 *
 * Tropical algorithm:
 *   1. Draw tall thin curved trunk
 *   2. Draw 3-5 frond lines radiating from top
 *   3. Fronds droop with slight curve
 */
export function generateTreeSprite(
  family: TreeFamily,
  size: 'small' | 'medium' | 'large',
  seed: number,
): ImageData {
  const heights: Record<string, number> = { small: 8, medium: 11, large: 14 };
  const height = heights[size]!;
  const width = Math.ceil(height * 0.8);  // slightly narrower than tall
  const imageData = new ImageData(width, height);
  const rng = new SeededRandom(seed);
  const pal = TREE_PALETTES[family];

  if (family === 'conifer') {
    drawConiferTree(imageData, width, height, pal, rng);
  } else if (family === 'deciduous') {
    drawDeciduousTree(imageData, width, height, pal, rng);
  } else {
    drawTropicalTree(imageData, width, height, pal, rng);
  }

  return imageData;
}

function drawConiferTree(
  img: ImageData,
  w: number,
  h: number,
  pal: typeof TREE_PALETTES.conifer,
  rng: SeededRandom,
): void {
  const cx = Math.floor(w / 2);
  const trunkH = Math.max(2, Math.floor(h * 0.2));
  const canopyH = h - trunkH;

  // Draw trunk
  const trunkColor = parseHex(rng.choice(pal.trunk));
  for (let y = h - trunkH; y < h; y++) {
    setPixel(img, w, cx, y, trunkColor);
    if (w > 6) setPixel(img, w, cx - 1, y, trunkColor);  // wider trunk for large
  }

  // Draw canopy as stacked triangles
  const layers = canopyH > 8 ? 3 : 2;
  const layerHeight = Math.floor(canopyH / layers) + 1;

  for (let layer = 0; layer < layers; layer++) {
    const layerTop = layer * (layerHeight - 1);  // overlap by 1px
    const maxWidth = Math.floor((w - 2) * (1 - layer * 0.2));

    for (let ly = 0; ly < layerHeight; ly++) {
      const y = layerTop + ly;
      if (y >= canopyH) break;

      // Triangle width at this row (widest at bottom of layer)
      const progress = ly / layerHeight;
      const rowWidth = Math.max(1, Math.floor(maxWidth * progress));
      const left = cx - Math.floor(rowWidth / 2);
      const right = cx + Math.ceil(rowWidth / 2);

      for (let x = left; x <= right; x++) {
        if (x < 0 || x >= w) continue;
        // Left = highlight, right = shadow
        const isLight = x <= cx;
        let color: { r: number; g: number; b: number };
        if (isLight) {
          color = parseHex(rng.choice(
            ly === layerHeight - 1 ? pal.canopy : pal.canopyHL
          ));
        } else {
          color = parseHex(rng.choice(
            ly === layerHeight - 1 ? pal.canopy : pal.canopySH
          ));
        }
        setPixel(img, w, x, y, color);
      }
    }
  }
}

// (deciduous and tropical implementations follow similar structure)
```

### 2.2 Rock/Boulder Generation

```typescript
/**
 * Generate a rock sprite using Voronoi-inspired shape.
 *
 * @param size  - 'small' (4x4), 'medium' (6x6), 'large' (8x8)
 * @param seed  - Variation seed
 *
 * Algorithm:
 *   1. Define rock outline as a noisy circle/ellipse
 *   2. Fill interior with stone palette colors
 *   3. Apply top-left lighting (highlight top-left quadrant)
 *   4. Add 1px shadow line on bottom-right edge
 */
const ROCK_PALETTE = {
  base:      ['#686868', '#787878', '#606060'],
  highlight: ['#909090', '#9a9a9a'],
  shadow:    ['#484848', '#3c3c3c'],
  mossy:     ['#5a6848', '#4e5c40'],  // optional moss tint
};
```

### 2.3 Vegetation Placement on Terrain Tiles

Trees and rocks are NOT baked into terrain tiles. Instead, a placement map
determines where feature sprites appear on each map tile. This allows:
- Overlapping sprites between tiles
- Dynamic density based on biome
- Feature removal without regenerating terrain

```typescript
/**
 * Compute feature placement for a world tile at (wx, wy).
 *
 * @param biome     - Biome determines which features and density
 * @param wx, wy    - World coordinates
 * @param seed      - World seed
 * @returns         - Array of feature placements within this tile
 *
 * Uses Poisson disk sampling (via Bridson's algorithm) seeded deterministically
 * to prevent features from overlapping or forming unnatural grids.
 *
 * Density by biome:
 *   DenseForest:  0.25 (1 tree per ~4x4 pixel area)
 *   Forest:       0.15
 *   Taiga:        0.12
 *   Jungle:       0.20
 *   Savanna:      0.03 (very sparse trees)
 *   Plains:       0.02 (occasional tree clusters)
 *   Mountain:     0.01 (rare stunted trees, boulders instead)
 *   Others:       0 (no trees)
 */
export interface FeaturePlacement {
  readonly x: number;          // pixel offset within tile
  readonly y: number;
  readonly type: 'tree' | 'rock' | 'bush';
  readonly family: TreeFamily | 'boulder' | 'shrub';
  readonly size: 'small' | 'medium' | 'large';
  readonly spriteSeed: number; // seed for this specific sprite's variation
}

const BIOME_FEATURE_DENSITY: Record<string, number> = {
  DenseForest: 0.25,
  Forest: 0.15,
  Taiga: 0.12,
  Jungle: 0.20,
  Savanna: 0.03,
  Plains: 0.02,
  Mountain: 0.01,
  Swamp: 0.08,
};

const BIOME_TREE_FAMILY: Record<string, TreeFamily> = {
  DenseForest: 'conifer',
  Forest: 'deciduous',
  Taiga: 'conifer',
  Jungle: 'tropical',
  Savanna: 'deciduous',
  Plains: 'deciduous',
  Swamp: 'deciduous',
};
```

---

## 3. SETTLEMENT / STRUCTURE SPRITES

### 3.1 Building Component System

Buildings are assembled from modular components: foundation, walls, roof, and
decorations. Each component is a small pixel pattern that can be composed.

```typescript
// packages/renderer/src/procgen/structures/building-gen.ts

export type RoofStyle = 'peaked' | 'flat' | 'domed' | 'spired';
export type WallMaterial = 'stone' | 'wood' | 'stucco';
export type BuildingSize = 'small' | 'medium' | 'large';

export interface BuildingSpec {
  readonly width: number;       // 8-24px
  readonly height: number;      // 10-28px
  readonly wallMaterial: WallMaterial;
  readonly roofStyle: RoofStyle;
  readonly stories: number;     // 1-3
  readonly hasChimney: boolean;
  readonly hasWindow: boolean;
  readonly hasDoor: boolean;
}

const BUILDING_PALETTES = {
  stone: {
    wall:     ['#8a8a80', '#7a7a70', '#9a9a90'],
    wallHL:   ['#a0a098', '#aaaa9e'],
    wallSH:   ['#686860', '#606058'],
    mortar:   ['#707068'],  // lines between stones
  },
  wood: {
    wall:     ['#6a5438', '#5e4c30', '#745c40'],
    wallHL:   ['#806848', '#887050'],
    wallSH:   ['#4e3c24', '#463420'],
    planks:   ['#584830'],  // horizontal plank lines
  },
  stucco: {
    wall:     ['#c8b898', '#c0b090', '#d0c0a0'],
    wallHL:   ['#d8c8a8', '#e0d0b0'],
    wallSH:   ['#a89878', '#a09070'],
    detail:   ['#b0a080'],
  },
  roof: {
    thatch:   ['#8a7040', '#7e6438', '#966848'],
    slate:    ['#505060', '#484858', '#585868'],
    tile:     ['#a04830', '#943c28', '#b05038'],
    wood:     ['#5a4830', '#4e3c28', '#644c38'],
  },
};

/**
 * Generate a building sprite.
 *
 * Algorithm:
 *   1. Determine dimensions from BuildingSpec
 *   2. Draw wall rectangle with material-appropriate texture
 *      - Stone: horizontal mortar lines every 3-4px, vertical every 5-7px
 *      - Wood: horizontal plank lines every 2-3px
 *      - Stucco: smooth with subtle noise
 *   3. Draw roof on top
 *      - Peaked: triangle rising from top of walls
 *      - Flat: single row of darker pixels
 *      - Domed: semi-circle
 *      - Spired: tall narrow triangle (churches/temples)
 *   4. Add details
 *      - Windows: 2x2 dark blue pixels with light-yellow pixel (lamplight)
 *      - Door: 2x3 dark rectangle at bottom center
 *      - Chimney: 2px wide stack on one side of roof
 *   5. Apply top-left lighting
 *   6. Add 1px cast shadow on right side
 */
export function generateBuilding(
  spec: BuildingSpec,
  factionColor: string,
  seed: number,
): ImageData {
  // ... implementation follows the algorithm above
}
```

### 3.2 Castle Generation (Modular Assembly)

Castles are composites of towers, walls, gatehouse, and keep. Sized by
settlement population tier.

```typescript
// packages/renderer/src/procgen/structures/castle-gen.ts

export interface CastleSpec {
  readonly tier: 'hamlet' | 'village' | 'town' | 'city' | 'capital';
  readonly factionColor: string;
  readonly cultureStyle: 'european' | 'eastern' | 'elvish' | 'dwarven';
}

/**
 * Castle component dimensions by tier:
 *
 * Hamlet (24x20):
 *   - Single tower (8x12)
 *   - Low wall sections (4px tall)
 *
 * Village (32x24):
 *   - Keep building (12x16)
 *   - 2 corner towers (6x10 each)
 *   - Connecting walls
 *
 * Town (48x36):
 *   - Central keep (14x18)
 *   - 4 corner towers (8x12)
 *   - Gatehouse (10x14) in front wall
 *   - Inner courtyard implied
 *
 * City (64x48):
 *   - Tall central keep (16x22)
 *   - 4 outer towers (10x14)
 *   - 2 inner towers (8x12)
 *   - Double wall with gatehouse
 *   - Flag/banner on keep using faction color
 *
 * Capital (80x56):
 *   - Grand palace/keep (20x26)
 *   - 6 towers (varying sizes)
 *   - Triple wall with barbican gatehouse
 *   - Multiple flags/banners
 *   - Cathedral/temple spire alongside
 *
 * Algorithm:
 *   1. Lay out component positions based on tier template
 *   2. Generate each component (tower, wall, keep) as sub-sprite
 *   3. Composite in painter's order (back walls first, then buildings, then front)
 *   4. Apply faction color to banners and shield emblems
 *   5. Apply unified lighting pass
 */

const CASTLE_PALETTE = {
  stone:      ['#8a8a80', '#7a7a70', '#9a9a90'],
  stoneHL:    ['#a0a098', '#aaaa9e'],
  stoneSH:    ['#606058', '#585850'],
  mortar:     ['#686860'],
  roofSlate:  ['#505060', '#484858'],
  woodAccent: ['#5a4830', '#4e3c28'],
  window:     ['#202838', '#283040'],
  windowGlow: ['#c8b060', '#d0b868'],  // warm lamplight
  door:       ['#3a2820', '#2e2018'],
  flag:       [],  // filled with faction color at generation time
};

/**
 * Generate a tower sub-sprite.
 *
 * Tower pixel pattern (8x12 example):
 *
 *   Row 0:    ..XXXX..    Crenellation (battlements)
 *   Row 1:    ..X..X..    Crenellation gap
 *   Row 2:    .XXXXXX.    Top wall
 *   Row 3:    .X....X.    Wall with interior
 *   Row 4:    .X....X.    Wall
 *   Row 5:    .X.WW.X.    Wall with window (W=dark blue)
 *   Row 6:    .X....X.    Wall
 *   Row 7:    .X....X.    Wall
 *   Row 8:    .X.WW.X.    Wall with window
 *   Row 9:    .X....X.    Wall
 *   Row 10:   .X.DD.X.    Wall with door (D=dark brown)
 *   Row 11:   .XXXXXX.    Foundation
 *
 *   X = stone wall color (with mortar lines and lighting)
 *   . = transparent
 *   W = window
 *   D = door (only on ground-level towers)
 */
```

### 3.3 Farm Building Sprites

```typescript
/**
 * Farm buildings include: farmhouse, barn, silo, windmill.
 *
 * Farmhouse (12x10):
 *   - Wooden walls with peaked thatch roof
 *   - Single door, 1-2 windows
 *   - Chimney on one side
 *
 * Barn (16x12):
 *   - Large wooden structure, wide doors
 *   - Red-brown wood palette variant
 *   - Cross-bracing pattern on walls (X pattern in darker wood)
 *
 * Windmill (10x18):
 *   - Stone tower base (6x8)
 *   - Domed/conical roof
 *   - 4 blade arms (rendered as lines, 8px reach)
 *   - Blades use thin pixel lines
 *
 * Crop fields (32x32 tile overlay):
 *   - Horizontal furrow lines every 3-4px (alternating dark/light brown)
 *   - Crop pixels in green/yellow depending on growth stage
 *   - Growth stages: bare(brown), sprouting(light green), growing(green), harvest(yellow)
 */

const FARM_PALETTE = {
  soil:       ['#6a5030', '#5e4428', '#7a5c38'],
  crop_bare:  ['#6a5030'],
  crop_sprout:['#7a9838', '#688830'],
  crop_grow:  ['#5a8828', '#4e7c20'],
  crop_ripe:  ['#c8a830', '#b89828', '#d0b038'],
  thatch:     ['#8a7040', '#7e6438'],
  barnWood:   ['#6a3828', '#5e3020', '#784038'],
};
```

### 3.4 Settlement Layout (Composite Sprites)

Settlements are composed by placing building sprites around a central structure.

```typescript
/**
 * Settlement composition by tier:
 *
 * Hamlet:
 *   Total sprite: 48x40
 *   - 1 farmhouse (center)
 *   - 1-2 small outbuildings
 *   - Surrounding farmland hint
 *
 * Village:
 *   Total sprite: 64x48
 *   - 1 small castle/manor (center-back)
 *   - 3-5 houses clustered around
 *   - 1 larger building (tavern/temple)
 *   - Road connecting buildings (brown path)
 *
 * Town:
 *   Total sprite: 80x64
 *   - Town castle (center-back)
 *   - 8-12 buildings in rough grid
 *   - Market square (open area, lighter ground)
 *   - Wall outline surrounding settlement
 *   - Road network
 *
 * City:
 *   Total sprite: 96x80
 *   - Large castle complex (back)
 *   - 15-20 buildings, multiple districts
 *   - Cathedral/temple (tall spired building)
 *   - Thick walls with gatehouse
 *   - Internal roads
 *
 * Capital:
 *   Total sprite: 112x96
 *   - Grand castle/palace (back center)
 *   - 25+ buildings, dense layout
 *   - Multiple landmark buildings (cathedral, academy, market hall)
 *   - Double walls
 *   - Harbor/dock section if coastal
 *
 * Layout algorithm:
 *   1. Place central structure (castle/manor)
 *   2. Place road spine from gatehouse outward
 *   3. For each remaining building:
 *      a. Pick random position adjacent to existing road
 *      b. Check no overlap with placed buildings (AABB test)
 *      c. Extend road to new building
 *   4. Draw walls around perimeter (for town+)
 *   5. Apply faction color to flags/banners
 */
```

### 3.5 Faction Color Application

Faction color is applied to:
- Banner/flag pixels on castle keeps and towers
- Shield emblems on gatehouses
- Roof accent color on faction-specific buildings (optional subtle tint)

```typescript
/**
 * Apply faction color to a settlement sprite.
 *
 * Strategy: Certain pixels are tagged as "faction-colorable" during generation.
 * These are stored as a separate mask alongside the sprite data.
 *
 * Faction color application:
 *   1. Parse faction hex color
 *   2. Generate 3-shade palette: base, highlight (+20% brightness), shadow (-20%)
 *   3. Replace tagged pixels with faction palette
 *   4. Ensure contrast against stone/wood surroundings
 */
export function applyFactionColor(
  sprite: ImageData,
  factionMask: Uint8Array,  // 1 byte per pixel: 0=no, 1=base, 2=highlight, 3=shadow
  factionColor: string,
): void {
  const base = parseHex(factionColor);
  const highlight = {
    r: clamp(Math.round(base.r * 1.3), 0, 255),
    g: clamp(Math.round(base.g * 1.3), 0, 255),
    b: clamp(Math.round(base.b * 1.3), 0, 255),
  };
  const shadow = {
    r: clamp(Math.round(base.r * 0.6), 0, 255),
    g: clamp(Math.round(base.g * 0.6), 0, 255),
    b: clamp(Math.round(base.b * 0.6), 0, 255),
  };

  for (let i = 0; i < factionMask.length; i++) {
    const mask = factionMask[i]!;
    if (mask === 0) continue;
    const idx = i * 4;
    const color = mask === 1 ? base : mask === 2 ? highlight : shadow;
    sprite.data[idx]     = color.r;
    sprite.data[idx + 1] = color.g;
    sprite.data[idx + 2] = color.b;
  }
}
```

---

## 4. PIXEL ART HERALDRY (Replacing ASCII)

### 4.1 Shield Shape Rasterization

Replaces the ASCII shield templates from `packages/renderer/src/widgets/heraldry.ts`
with pixel art rendered to Canvas.

```typescript
// packages/renderer/src/procgen/heraldry/shield-renderer.ts

/**
 * Shield sizes:
 *   Badge:    16x16  (event log, inline)
 *   Marker:   24x24  (map settlement markers)
 *   Panel:    32x32  (inspector panels)
 *   Large:    48x48  (faction detail view)
 *
 * Shield shapes (matching existing ShieldShape type):
 *
 * 'knightly' (European heater shield):
 *   Pixel outline at 32x32:
 *     - Top edge: flat, 24px wide, centered
 *     - Sides: vertical for top half, then taper inward
 *     - Bottom: comes to a point at center-bottom
 *     - 2px border in dark grey (#404040)
 *     - Interior filled with field pattern
 *
 * 'round' (circular shield):
 *   - Circle inscribed in sprite bounds (Bresenham circle)
 *   - 2px border
 *
 * 'totem' (tall rectangular/tombstone shape):
 *   - Flat top, vertical sides, rounded bottom
 *   - Narrower than knightly (20px wide at 32x32)
 */

export function renderPixelShield(
  shape: ShieldShape,
  size: number,
  primaryColor: string,
  secondaryColor: string,
  division: FieldDivision,
): ImageData {
  const imageData = new ImageData(size, size);

  // Step 1: Generate shield outline mask
  const mask = generateShieldMask(shape, size);

  // Step 2: Fill field with division pattern
  fillFieldDivision(imageData, mask, size, division, primaryColor, secondaryColor);

  // Step 3: Draw border (2px at 32x32, 1px at 16x16)
  const borderWidth = size >= 32 ? 2 : 1;
  drawShieldBorder(imageData, mask, size, borderWidth, '#404040');

  return imageData;
}

/**
 * Shield mask: 2D boolean array. true = inside shield, false = outside.
 *
 * Knightly shield mask generation (32x32):
 *   Rows 0-3:   width = 24, centered (x: 4-27)
 *   Rows 4-15:  width = 26, centered (x: 3-28)
 *   Rows 16-23: width narrows linearly from 26 to 14
 *   Rows 24-29: width narrows from 14 to 2
 *   Rows 30-31: width = 2 (the point)
 *
 * Scaled proportionally for other sizes.
 */
```

### 4.2 Charge (Device) Pixel Patterns

Each heraldic charge is stored as a small pixel pattern (8x8 at base scale,
scaled to shield size). These replace the ASCII charge symbols.

```typescript
// packages/renderer/src/procgen/heraldry/charge-renderer.ts

/**
 * Charge pixel patterns at 8x8 base resolution.
 * Each pattern is a 2D array: 0=transparent, 1=charge color, 2=outline.
 *
 * The patterns are procedurally "drawn" rather than stored as literal arrays,
 * using simple geometric primitives.
 *
 * Lion (rampant, simplified):
 *   2x3 body, 1px tail curving up, 2px head, 1px crown hint
 *   Total: recognizable quadruped silhouette facing left
 *
 * Sword (vertical):
 *   1px wide blade (5px tall), 3px crossguard, 1px pommel
 *
 * Eagle (displayed):
 *   Wings spread: 6px wide at widest
 *   Body: 2px wide, 4px tall
 *   Symmetric
 *
 * Star (6-pointed):
 *   Two overlapping triangles, 6px diameter
 *
 * Crown:
 *   3 points rising from 5px base band, 4px tall total
 *
 * Tree (oak):
 *   1px trunk, 5x4 round canopy
 *
 * Tower:
 *   3px wide, 6px tall, crenellations on top, door at bottom
 *
 * Book (open):
 *   2 rectangles side by side (pages), 4x3px total
 */

/**
 * Render a charge onto a shield at the specified position and scale.
 *
 * @param imageData   - Shield image to draw onto
 * @param charge      - Charge definition (name determines pattern)
 * @param cx, cy      - Center position on shield
 * @param scale       - Scale factor (1.0 = 8x8, 2.0 = 16x16)
 * @param chargeColor - Color for charge pixels
 */
export function drawCharge(
  imageData: ImageData,
  chargeName: string,
  cx: number,
  cy: number,
  scale: number,
  chargeColor: string,
): void {
  const pattern = getChargePattern(chargeName);
  const color = parseHex(chargeColor);
  const outline = { r: Math.round(color.r * 0.3), g: Math.round(color.g * 0.3), b: Math.round(color.b * 0.3) };

  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      const val = pattern[py]![px]!;
      if (val === 0) continue;

      const drawColor = val === 1 ? color : outline;
      const sx = Math.round(cx + (px - 4) * scale);
      const sy = Math.round(cy + (py - 4) * scale);

      // Draw scaled pixel (may be multiple actual pixels)
      for (let dy = 0; dy < Math.ceil(scale); dy++) {
        for (let dx = 0; dx < Math.ceil(scale); dx++) {
          setPixelSafe(imageData, sx + dx, sy + dy, drawColor);
        }
      }
    }
  }
}

/**
 * Charge pattern definitions.
 * 0 = transparent, 1 = charge color, 2 = charge outline (darker)
 */
function getChargePattern(name: string): number[][] {
  switch (name) {
    case 'Sword':
      return [
        [0,0,0,2,0,0,0,0],  // pommel
        [0,0,0,1,0,0,0,0],  // grip
        [0,0,2,1,2,0,0,0],  // crossguard
        [0,0,0,1,0,0,0,0],  // blade
        [0,0,0,1,0,0,0,0],
        [0,0,0,1,0,0,0,0],
        [0,0,0,1,0,0,0,0],
        [0,0,0,2,0,0,0,0],  // tip
      ];
    case 'Star':
      return [
        [0,0,0,1,0,0,0,0],
        [0,0,1,1,1,0,0,0],
        [0,1,1,1,1,1,0,0],
        [1,1,1,2,1,1,1,0],
        [0,1,1,1,1,1,0,0],
        [0,0,1,1,1,0,0,0],
        [0,1,1,0,1,1,0,0],
        [0,1,0,0,0,1,0,0],
      ];
    case 'Crown':
      return [
        [0,0,0,0,0,0,0,0],
        [0,1,0,1,0,1,0,0],
        [0,1,0,1,0,1,0,0],
        [0,1,1,1,1,1,0,0],
        [0,2,1,1,1,2,0,0],
        [0,2,1,1,1,2,0,0],
        [0,2,2,2,2,2,0,0],
        [0,0,0,0,0,0,0,0],
      ];
    case 'Tower':
      return [
        [0,0,1,0,1,0,0,0],  // crenellations
        [0,0,1,1,1,0,0,0],
        [0,0,1,2,1,0,0,0],  // window
        [0,0,1,1,1,0,0,0],
        [0,0,1,2,1,0,0,0],  // window
        [0,0,1,1,1,0,0,0],
        [0,0,1,2,1,0,0,0],  // door
        [0,0,1,1,1,0,0,0],  // base
      ];
    // ... additional charges follow same pattern
    default:
      // Fallback: simple diamond
      return [
        [0,0,0,1,0,0,0,0],
        [0,0,1,1,1,0,0,0],
        [0,1,1,1,1,1,0,0],
        [1,1,1,2,1,1,1,0],
        [0,1,1,1,1,1,0,0],
        [0,0,1,1,1,0,0,0],
        [0,0,0,1,0,0,0,0],
        [0,0,0,0,0,0,0,0],
      ];
  }
}
```

---

## 5. UI ELEMENT GENERATION

### 5.1 Ornate Medieval Frame System

Panel borders use procedurally generated corner pieces and edge tiles.
Matches the ornate metalwork style visible in the mockup images.

```typescript
// packages/renderer/src/procgen/ui/frame-gen.ts

/**
 * Frame components:
 *   - Corner piece: 16x16px ornate bracket
 *   - Horizontal edge: 16x4px repeating pattern
 *   - Vertical edge: 4x16px repeating pattern
 *   - Divider: 1px line with midpoint ornament
 *
 * Color palette for UI frames:
 *   Border base:    #4a4840  (dark bronze/iron)
 *   Border HL:      #6a6458  (lighter bronze)
 *   Border shadow:  #2e2c28  (deep shadow)
 *   Rivet/detail:   #8a8478  (bright metallic accent)
 *   Inner glow:     #3a3830  (subtle warm inner edge)
 *
 * Corner piece algorithm (16x16):
 *   1. Draw L-shaped bracket:
 *      - Horizontal arm: 16px wide, 3px tall, at top
 *      - Vertical arm: 3px wide, 16px tall, at left
 *   2. Add corner fill: 6x6 decorative pattern at top-left
 *   3. Decorative elements:
 *      - Corner rivet (2x2 bright pixel)
 *      - Curl/scroll at end of each arm (2px radius quarter-circle)
 *      - Optional gem/stud at corner (1px bright colored pixel)
 *   4. Apply bevel: top/left edges = highlight, bottom/right = shadow
 *
 * The 4 corners are generated by flipping/rotating a single corner sprite.
 */

export const UI_FRAME_PALETTE = {
  base:       '#4a4840',
  highlight:  '#6a6458',
  shadow:     '#2e2c28',
  rivet:      '#8a8478',
  innerGlow:  '#3a3830',
  gem:        '#c8a040',  // gold stud
};

export function generateCornerSprite(seed: number): ImageData {
  const size = 16;
  const imageData = new ImageData(size, size);

  // L-bracket base
  const base = parseHex(UI_FRAME_PALETTE.base);
  const hl = parseHex(UI_FRAME_PALETTE.highlight);
  const sh = parseHex(UI_FRAME_PALETTE.shadow);
  const rivet = parseHex(UI_FRAME_PALETTE.rivet);

  // Horizontal arm (top, full width, 3px tall)
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < 3; y++) {
      const color = y === 0 ? hl : y === 2 ? sh : base;
      setPixel(imageData, size, x, y, color);
    }
  }

  // Vertical arm (left, 3px wide, full height)
  for (let y = 3; y < size; y++) {
    for (let x = 0; x < 3; x++) {
      const color = x === 0 ? hl : x === 2 ? sh : base;
      setPixel(imageData, size, x, y, color);
    }
  }

  // Corner decorative fill (5x5 at top-left)
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      setPixel(imageData, size, x, y, base);
    }
  }

  // Rivet at corner (2x2)
  setPixel(imageData, size, 1, 1, rivet);
  setPixel(imageData, size, 2, 1, rivet);
  setPixel(imageData, size, 1, 2, rivet);
  setPixel(imageData, size, 2, 2, hl);

  // Scroll curl at horizontal arm end
  setPixel(imageData, size, size - 2, 1, hl);
  setPixel(imageData, size, size - 1, 2, hl);

  // Scroll curl at vertical arm end
  setPixel(imageData, size, 1, size - 2, hl);
  setPixel(imageData, size, 2, size - 1, hl);

  return imageData;
}

/**
 * Generate horizontal edge tile (repeating pattern, 16x4).
 * Pattern: alternating raised studs and grooves.
 */
export function generateHEdgeTile(): ImageData {
  // ... 16x4 repeating metalwork pattern
}

/**
 * Generate vertical edge tile (4x16 repeating pattern).
 */
export function generateVEdgeTile(): ImageData {
  // ... 4x16 repeating metalwork pattern
}
```

### 5.2 Event Category Badge Sprites

```typescript
// packages/renderer/src/procgen/ui/badge-gen.ts

/**
 * Event badges: 16x16 pixel art icons with colored backgrounds.
 *
 * Badge structure:
 *   - Background: rounded rectangle (12x12) filled with category color
 *   - Icon: 8x8 symbol centered on background
 *   - 1px border in darker shade of category color
 *
 * Category icons:
 *   Political:    Crown symbol (gold on dark yellow)
 *   Military:     Crossed swords (red on dark red)
 *   Magical:      Star/sparkle (purple on dark purple)
 *   Cultural:     Lyre/scroll (cyan on dark cyan)
 *   Religious:    Sun/cross (pink on dark pink)
 *   Economic:     Coin/scales (green on dark green)
 *   Personal:     Portrait circle (blue on dark blue)
 *   Disaster:     Flame/crack (orange on dark orange)
 *   Scientific:   Flask/gear (teal on dark teal)
 *   Exploratory:  Compass/flag (lime on dark lime)
 *
 * Badge generation algorithm:
 *   1. Fill 12x12 rounded rect with category bg color (20% darker than CATEGORY_COLORS)
 *   2. Draw 1px border (40% darker than category color)
 *   3. Render 8x8 icon pattern centered (using category-specific pixel pattern)
 *   4. Icon color: white or bright category color for visibility
 */

const BADGE_BG_COLORS: Record<string, string> = {
  Political:   '#b8a030',
  Military:    '#b83030',
  Magical:     '#9030b8',
  Cultural:    '#30a8b8',
  Religious:   '#b878b8',
  Economic:    '#30b868',
  Personal:    '#6088b8',
  Disaster:    '#b85800',
  Scientific:  '#00b898',
  Exploratory: '#68b830',
};
```

---

## 6. TECHNICAL IMPLEMENTATION

### 6.1 Canvas 2D Generation Pipeline

All sprite generation uses `OffscreenCanvas` (or fallback `document.createElement('canvas')`)
for off-screen rendering. Generated ImageData is converted to PixiJS textures.

```typescript
// packages/renderer/src/procgen/atlas/texture-cache.ts

import type { Texture, BaseTexture } from 'pixi.js';

export class TextureCache {
  private readonly cache = new Map<string, Texture>();
  private readonly worldSeed: number;

  constructor(worldSeed: number) {
    this.worldSeed = worldSeed;
  }

  /**
   * Get or generate a terrain tile texture.
   * Key format: "terrain:{biome}:{variant}"
   */
  getTerrainTile(biome: string, variant: number): Texture {
    const key = `terrain:${biome}:${variant}`;
    let tex = this.cache.get(key);
    if (tex !== undefined) return tex;

    const imageData = generateTerrainTile(biome, variant, this.worldSeed);
    tex = this.imageDataToTexture(imageData);
    this.cache.set(key, tex);
    return tex;
  }

  /**
   * Get or generate a tree sprite texture.
   */
  getTreeSprite(family: TreeFamily, size: string, seed: number): Texture {
    const key = `tree:${family}:${size}:${seed}`;
    let tex = this.cache.get(key);
    if (tex !== undefined) return tex;

    const imageData = generateTreeSprite(family, size as any, seed);
    tex = this.imageDataToTexture(imageData);
    this.cache.set(key, tex);
    return tex;
  }

  /**
   * Convert ImageData to a PixiJS Texture.
   */
  private imageDataToTexture(imageData: ImageData): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    // PixiJS can create textures from canvas elements
    return Texture.from(canvas, {
      scaleMode: 0,  // NEAREST (no blurring for pixel art)
    });
  }

  /**
   * Pre-generate all tiles for current world.
   * Call once at world load, runs asynchronously to avoid blocking.
   */
  async pregenerate(): Promise<void> {
    const biomes = [
      'DeepOcean', 'Ocean', 'Coast', 'Plains', 'Forest', 'DenseForest',
      'Mountain', 'HighMountain', 'Desert', 'Tundra', 'Swamp', 'Volcano',
      'Jungle', 'Savanna', 'Taiga', 'IceCap', 'MagicWasteland',
    ];

    let count = 0;
    for (const biome of biomes) {
      for (let variant = 0; variant < 8; variant++) {
        this.getTerrainTile(biome, variant);
        count++;
        // Yield to event loop every 20 tiles to prevent jank
        if (count % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
  }

  /**
   * Clear all cached textures (call on world change).
   */
  clear(): void {
    for (const tex of this.cache.values()) {
      tex.destroy(true);
    }
    this.cache.clear();
  }
}
```

### 6.2 Sprite Sheet Packing

For optimal GPU performance, individual sprites are packed into atlas textures.

```typescript
// packages/renderer/src/procgen/atlas/sprite-sheet.ts

/**
 * Atlas packing strategy:
 *
 * Atlas 1 - Terrain (512x512):
 *   17 biomes x 8 variants = 136 tiles at 32x32
 *   136 * 32 * 32 = 139,264 pixels
 *   512x512 = 262,144 pixels (fits with room for transitions)
 *
 * Atlas 2 - Transitions (512x512):
 *   ~80 transition tiles at 32x32 = 81,920 pixels (fits easily)
 *
 * Atlas 3 - Features (256x256):
 *   Trees: 3 families x 3 sizes x 4 variants = 36 sprites (~12x14 avg)
 *   Rocks: 3 sizes x 4 variants = 12 sprites (~6x6 avg)
 *   Vegetation: 8 variants at ~8x8
 *   Total: ~56 sprites, fits in 256x256
 *
 * Atlas 4 - Structures (1024x512):
 *   Buildings: 10 types x 4 variants = 40 sprites (~16x16 avg)
 *   Castles: 5 tiers = 5 sprites (24x20 to 112x96)
 *   Farms: 4 types x 4 variants = 16 sprites
 *   Total: ~61 sprites, needs more width due to castle sizes
 *
 * Atlas 5 - UI (256x256):
 *   Corners: 4 at 16x16
 *   Edges: 2 at 16x4 and 2 at 4x16
 *   Badges: 10 at 16x16
 *   Icons: 15 at 16x16
 *   Heraldry: per-faction, generated separately
 *
 * Packing algorithm: Simple shelf packer (sort by height, place in rows).
 */

export interface PackedSprite {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SpriteAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly sprites: Map<string, PackedSprite>;
  readonly width: number;
  readonly height: number;
}

/**
 * Pack multiple ImageData items into a single atlas canvas.
 * Uses shelf-packing algorithm.
 */
export function packSpriteSheet(
  items: Array<{ key: string; imageData: ImageData }>,
  atlasWidth: number,
  atlasHeight: number,
): SpriteAtlas {
  // Sort by height descending for better packing
  const sorted = [...items].sort((a, b) => b.imageData.height - a.imageData.height);

  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d')!;

  const sprites = new Map<string, PackedSprite>();
  let shelfY = 0;
  let shelfHeight = 0;
  let cursorX = 0;

  for (const item of sorted) {
    const w = item.imageData.width;
    const h = item.imageData.height;

    // Start new shelf if item doesn't fit horizontally
    if (cursorX + w > atlasWidth) {
      shelfY += shelfHeight;
      shelfHeight = 0;
      cursorX = 0;
    }

    // Check vertical overflow
    if (shelfY + h > atlasHeight) {
      console.warn(`Sprite atlas overflow: ${item.key} did not fit`);
      continue;
    }

    ctx.putImageData(item.imageData, cursorX, shelfY);
    sprites.set(item.key, {
      key: item.key,
      x: cursorX,
      y: shelfY,
      width: w,
      height: h,
    });

    cursorX += w;
    shelfHeight = Math.max(shelfHeight, h);
  }

  return { canvas, sprites, width: atlasWidth, height: atlasHeight };
}
```

### 6.3 Integration with Existing Map Rendering

The procgen system interfaces with the existing map panel through a new
`PixelMapRenderer` that replaces the ASCII `TerrainStyler`.

```typescript
/**
 * Integration points with existing codebase:
 *
 * 1. MapPanel (map-panel.ts):
 *    Currently calls TerrainStyler.styleTile() for each visible tile,
 *    producing {char, fg, bg} for blessed terminal rendering.
 *
 *    New flow:
 *    - MapPanel becomes a PixiJS Container
 *    - Each visible tile is a Sprite using the cached terrain texture
 *    - Feature sprites (trees, rocks) are child Sprites positioned within tiles
 *    - Settlement sprites are placed at settlement coordinates
 *    - Overlay system draws colored tint sprites on top
 *
 * 2. BiomeType mapping:
 *    The 17 BiomeType values from biome-chars.ts map 1:1 to biome palette keys.
 *    No additional biome types needed.
 *
 * 3. Overlay system:
 *    Overlay modifications currently set {char, fg, bg} overrides.
 *    New flow: overlays produce colored semi-transparent rectangles
 *    drawn over terrain tiles, with overlay icons as small sprites.
 *
 * 4. Seed propagation:
 *    World seed from `--seed` CLI arg flows through:
 *      CLI -> WorldGenerator -> TextureCache(seed) -> all generators
 *    Each generator derives sub-seeds via hashCombine().
 *
 * 5. Zoom levels:
 *    - World view (1px per tile): Simple colored rectangle per tile
 *    - Region view (4px per tile): Terrain tile + tiny settlement markers
 *    - Local view (32px per tile): Full terrain + features + buildings
 *    - Detail view (64px per tile): Terrain scaled 2x + all features
 */
```

### 6.4 Caching Strategy

```
Generation timing targets:
  Single terrain tile (32x32):     < 1ms
  All terrain variants (136):      < 200ms
  All transition tiles (~80):      < 100ms
  Tree sprite (single):            < 0.5ms
  Feature set for visible area:    < 50ms
  Settlement sprite (city):        < 5ms
  Full atlas generation:           < 500ms (async, non-blocking)
  Heraldry per faction:            < 2ms

Memory budget:
  Terrain atlas (512x512 RGBA):    1 MB
  Transition atlas (512x512):      1 MB
  Feature atlas (256x256):         256 KB
  Structure atlas (1024x512):      2 MB
  UI atlas (256x256):              256 KB
  Per-faction heraldry (48x48 x4): ~36 KB per faction
  Total for 20 factions:           ~5.5 MB GPU texture memory

Cache lifetime:
  - Generated once per world seed at initialization
  - Cleared on world change / new game
  - Faction heraldry regenerated on heraldry evolution events
  - Seasonal palette variants swapped by modifying a color matrix uniform
    (not regenerating tiles)
```

### 6.5 Seasonal Palette Variation

Rather than regenerating all tiles per season, apply a PixiJS ColorMatrixFilter
to the terrain container.

```typescript
/**
 * Seasonal color adjustments applied as post-processing:
 *
 * Spring: Saturation +10%, slight green shift
 *   ColorMatrix: multiply green channel by 1.1, others by 1.05
 *
 * Summer: Base colors (no filter)
 *
 * Autumn: Hue rotate +30deg, saturation -10%
 *   ColorMatrix: shift red/green balance, reduce saturation
 *   Specific: green channels reduced, red/yellow boosted
 *
 * Winter: Desaturate 30%, brightness +10%
 *   ColorMatrix: reduce saturation, add white shift
 *   Snow overlay sprites appear on applicable biomes
 *
 * Implementation:
 *   terrainContainer.filters = [seasonalColorMatrix];
 *   seasonalColorMatrix.reset();
 *   seasonalColorMatrix.saturate(seasonSaturation);
 *   seasonalColorMatrix.hueRotate(seasonHueShift);
 */

export const SEASONAL_ADJUSTMENTS = {
  spring:  { saturation: 1.1,  hueRotate: -5,  brightness: 1.05 },
  summer:  { saturation: 1.0,  hueRotate: 0,   brightness: 1.0  },
  autumn:  { saturation: 0.85, hueRotate: 25,  brightness: 0.95 },
  winter:  { saturation: 0.65, hueRotate: -10, brightness: 1.1  },
};
```

---

## 7. DETERMINISM VALIDATION

### 7.1 Test Strategy

```typescript
/**
 * Every generator must pass determinism tests:
 *
 * test("terrain tile is deterministic", () => {
 *   const tile1 = generateTerrainTile('Plains', 0, 12345);
 *   const tile2 = generateTerrainTile('Plains', 0, 12345);
 *   expect(tile1.data).toEqual(tile2.data);
 * });
 *
 * test("different seeds produce different tiles", () => {
 *   const tile1 = generateTerrainTile('Plains', 0, 12345);
 *   const tile2 = generateTerrainTile('Plains', 0, 54321);
 *   expect(tile1.data).not.toEqual(tile2.data);
 * });
 *
 * test("tree sprite is deterministic", () => {
 *   const tree1 = generateTreeSprite('conifer', 'medium', 42);
 *   const tree2 = generateTreeSprite('conifer', 'medium', 42);
 *   expect(tree1.data).toEqual(tree2.data);
 * });
 *
 * test("heraldry pixel art matches ASCII heraldry decisions", () => {
 *   // The pixel heraldry system should use the same generateCoatOfArms()
 *   // logic for determining colors/charges, just render differently
 *   const props = { name: 'TestFaction', culture: 'nordic', ... };
 *   const arms = generateCoatOfArms(props);
 *   const pixelArms = generatePixelHeraldry(props, 32);
 *   // Verify the dominant colors in pixelArms match arms.primary.hex / arms.secondary.hex
 * });
 *
 * test("full atlas generation completes under 500ms", () => {
 *   const start = performance.now();
 *   const cache = new TextureCache(12345);
 *   await cache.pregenerate();
 *   const elapsed = performance.now() - start;
 *   expect(elapsed).toBeLessThan(500);
 * });
 */
```

### 7.2 Seed Derivation Map

```
worldSeed (CLI --seed argument)
  |
  +-- terrain_seed = hashCombine(worldSeed, hash("terrain"))
  |     +-- tile(biome, variant) = hashCombine(terrain_seed, hash(biome), variant)
  |     +-- transition(biomeA, biomeB, dir) = hashCombine(terrain_seed, hash(A+B+dir))
  |     +-- river(riverId) = hashCombine(terrain_seed, hash("river"), riverId)
  |
  +-- feature_seed = hashCombine(worldSeed, hash("features"))
  |     +-- tree(wx, wy) = hashCombine(feature_seed, wx, wy)
  |     +-- rock(wx, wy) = hashCombine(feature_seed, hash("rock"), wx, wy)
  |
  +-- structure_seed = hashCombine(worldSeed, hash("structures"))
  |     +-- settlement(siteId) = hashCombine(structure_seed, siteId)
  |     +-- building(siteId, idx) = hashCombine(structure_seed, siteId, idx)
  |
  +-- heraldry_seed = hashCombine(worldSeed, hash("heraldry"))
  |     +-- faction(factionId) = hashCombine(heraldry_seed, factionId)
  |
  +-- ui_seed = hashCombine(worldSeed, hash("ui"))
        (UI elements are seed-independent but included for completeness)
```

---

## 8. IMPLEMENTATION PRIORITY

### Phase 1 (Core terrain - enables map rendering):
1. `seeded-random.ts` - SeededRandom class
2. `biome-palettes.ts` - All 17 biome palettes
3. `terrain-tile-gen.ts` - Terrain tile generation
4. `texture-cache.ts` - Basic cache with PixiJS integration
5. Tests for determinism

### Phase 2 (Natural features - makes map look alive):
6. `tree-gen.ts` - 3 tree families
7. `rock-gen.ts` - Rock sprites
8. `vegetation-gen.ts` - Grass/flower/crop details
9. Feature placement system (Poisson disk sampling)

### Phase 3 (Settlements - shows civilization):
10. `building-gen.ts` - Individual building sprites
11. `castle-gen.ts` - Modular castle assembly
12. `settlement-layout.ts` - Composite settlement sprites
13. Faction color application

### Phase 4 (Polish):
14. `tile-transitions.ts` - Biome edge blending
15. `river-renderer.ts` - River overlay tiles
16. `pixel-heraldry.ts` - Pixel art shields/banners
17. `frame-gen.ts` + `badge-gen.ts` - UI elements
18. `sprite-sheet.ts` - Atlas packing
19. Seasonal color matrix system

---

## Appendix A: Complete Biome Color Reference

| Biome          | Base Primary | Base Dark    | Highlight    | Shadow       | Detail       |
|----------------|-------------|-------------|-------------|-------------|-------------|
| DeepOcean      | #0f1c38     | #0a1428     | #1a3060     | #060e1c     | #182c50     |
| Ocean          | #142850     | #0f2040     | #205080     | #0a1830     | #1a4070     |
| Coast          | #1e3858     | #1a3050     | #d0b888     | #142840     | #e0c898     |
| Plains         | #5a8c4e     | #4a7c3e     | #7aac6e     | #3a6830     | #8ab070     |
| Forest         | #326838     | #2a5c34     | #3a7844     | #163c1e     | #1a4020     |
| DenseForest    | #1e4a28     | #163c1e     | #2a5c30     | #0e2410     | #0e2814     |
| Mountain       | #787e8e     | #6a7080     | #8a90a0     | #484e58     | #585e68     |
| HighMountain   | #98a0b0     | #8a90a0     | #d0d8e8     | #606878     | #b0b8c8     |
| Desert         | #d0a868     | #c8a060     | #d8b878     | #a08040     | #e0c888     |
| Savanna        | #b09840     | #a08838     | #c0a848     | #706020     | #687828     |
| Tundra         | #8898b0     | #7888a0     | #98a8c0     | #586880     | #607088     |
| IceCap         | #d0d8e8     | #c8d0e0     | #e8f0ff     | #a0a8c0     | #b0b8d0     |
| Taiga          | #386048     | #2e5840     | #487050     | #1c3c28     | #c0c8d8     |
| Swamp          | #4a6430     | #3a5428     | #5a7438     | #243818     | #2a4830     |
| Jungle         | #226830     | #1a5c28     | #2a7838     | #103c18     | #0e4418     |
| Volcano        | #4a2820     | #3a2018     | #e04020     | #1e1008     | #d03818     |
| MagicWasteland | #381e48     | #2e1840     | #8040c0     | #180c28     | #6030a0     |

## Appendix B: Tree Sprite Dimensions

| Family     | Small (8px)  | Medium (11px) | Large (14px) |
|-----------|-------------|--------------|-------------|
| Conifer   | 6w x 8h     | 9w x 11h    | 11w x 14h  |
| Deciduous | 7w x 8h     | 10w x 11h   | 12w x 14h  |
| Tropical  | 8w x 8h     | 10w x 11h   | 12w x 14h  |

## Appendix C: Settlement Sprite Dimensions

| Tier     | Sprite Size | Buildings | Has Walls | Has Castle |
|---------|------------|-----------|-----------|-----------|
| Hamlet  | 48x40      | 1-2       | No        | No        |
| Village | 64x48      | 3-5       | No        | Small     |
| Town    | 80x64      | 8-12      | Yes       | Medium    |
| City    | 96x80      | 15-20     | Yes       | Large     |
| Capital | 112x96     | 25+       | Double    | Grand     |

## Appendix D: Performance Targets

| Operation                    | Target    | Complexity    |
|-----------------------------|----------|---------------|
| Single terrain tile          | < 1ms    | O(32*32) = O(1024) |
| All terrain variants (136)   | < 200ms  | O(136 * 1024) |
| Single tree sprite           | < 0.5ms  | O(~100 pixels) |
| Feature placement (1 tile)   | < 0.1ms  | O(density * area) |
| Settlement sprite (city)     | < 5ms    | O(buildings * pixels) |
| Full atlas pregeneration     | < 500ms  | All above combined |
| Per-frame tile lookup        | < 0.01ms | O(1) cache lookup |
