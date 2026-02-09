# Phase 9.1: Map Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the world map with PixiJS in the Electron frontend — terrain tiles, entity markers, viewport controls, overlays, and tooltips.

**Architecture:** Programmatic glyph atlas (canvas-generated, white glyphs tinted at render time). Sprite pool of `viewportCols × viewportRows` tile sprites recycled on scroll. Viewport class handles pan/zoom/coordinate transforms. Overlays modify tile bg/fg colors. All data comes from WorldSnapshot via IPC.

**Tech Stack:** PixiJS v8 (Sprite, Container, Graphics, Texture), TypeScript strict, HTML/CSS tooltips

---

## File Map

All paths relative to `packages/electron/src/`.

| File | Purpose |
|------|---------|
| `renderer/map/glyph-atlas.ts` | Generate 256×384px glyph atlas canvas, export PixiJS textures |
| `renderer/map/biome-config.ts` | 17 biome configs: weighted glyph pools + 3 palette colors per biome |
| `renderer/map/viewport.ts` | Pan/zoom state, screen↔world coordinate transforms |
| `renderer/map/tilemap-renderer.ts` | Sprite pool, per-frame terrain rendering, entity markers |
| `renderer/map/overlay-manager.ts` | 6 overlay types, tile color modifications |
| `renderer/map/map-tooltip.ts` | HTML tooltip on tile hover |
| `renderer/map/index.ts` | Barrel export |
| `renderer/index.ts` | Wire map renderer to snapshot + tick deltas (modify existing) |
| `renderer/pixi-app.ts` | Expose app.stage (modify existing) |

---

### Task 1: Glyph Atlas Generator

**Files:**
- Create: `renderer/map/glyph-atlas.ts`

**Why:** PixiJS needs a sprite sheet of white glyphs to tint at render time. We generate this programmatically from a monospace font on an OffscreenCanvas, avoiding external asset dependencies.

**Step 1: Create the glyph atlas module**

```typescript
// renderer/map/glyph-atlas.ts
import { Texture, Rectangle } from 'pixi.js';

/** Tile dimensions in pixels */
export const TILE_W = 16;
export const TILE_H = 24;

/** Atlas grid: 16 columns × 16 rows = 256 glyph slots */
const ATLAS_COLS = 16;
const ATLAS_ROWS = 16;
const ATLAS_W = ATLAS_COLS * TILE_W;  // 256
const ATLAS_H = ATLAS_ROWS * TILE_H;  // 384

/**
 * All glyphs needed for terrain, entities, and overlays.
 * Index in this array = atlas slot index.
 */
const GLYPH_CHARS: string[] = [
  // Row 0-1: Terrain glyphs (32 slots)
  '.', ',', "'", '"', '`', '\u00B7', // plains: . , ' " ` ·
  '\u2660', '\u2663', '\u2191', '\u03C4', '\u0393', // forest: ♠ ♣ ↑ τ Γ
  '\u25B2', '^', '\u2302', '\u2229', 'n', // mountain: ▲ ^ ⌂ ∩ n
  '\u2248', '~', '\u223C', // water: ≈ ~ ∼
  '\u00B0', '\u00B4', 'V', '\u221A', // desert: ° ´ V √
  '\u2219', '\u207F', // tundra: ∙ ⁿ
  '\u2591', '\u2592', '\u2593', '\u2588', // shading: ░ ▒ ▓ █
  '*', '?', // misc
  ' ', ' ', // padding to 32

  // Row 2-3: Entity markers (32 slots)
  '\u263C', // ☼ settlement (sun)
  '\u2691', // ⚑ capital (flag)
  '\u2020', // † ruin (dagger)
  '\u2694', // ⚔ army (crossed swords)
  '\u271D', // ✝ temple
  '\u2727', // ✧ academy (sparkle)
  '\u2605', // ★ star (6pt)
  '\u2726', // ✦ artifact (4pt star)
  '@',      // character
  '\u2191', '\u2193', '\u2190', '\u2192', // arrows: ↑ ↓ ← →
  '\u2197', '\u2196', '\u2198', '\u2199', // diag arrows: ↗ ↖ ↘ ↙
  '\u2699', // ⚙ gear (besieged)
  '\u2302', // ⌂ trade hub
  ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', // pad to 32

  // Row 4-5: Overlay glyphs (32 slots)
  '\u2502', '\u2500', '\u2514', '\u2518', '\u250C', '\u2510', // box: │ ─ └ ┘ ┌ ┐
  '\u251C', '\u2524', '\u2534', '\u252C', '\u253C', // box: ├ ┤ ┴ ┬ ┼
  '\u00D7', // × ley line crossing
  '\u2219', // ∙ ley line dot
  ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', // pad to 32
];

/** Map from character to its atlas slot index */
const charToIndex = new Map<string, number>();
for (let i = 0; i < GLYPH_CHARS.length; i++) {
  const ch = GLYPH_CHARS[i];
  if (ch !== undefined && ch !== ' ' && !charToIndex.has(ch)) {
    charToIndex.set(ch, i);
  }
}

/** Look up the atlas index for a glyph character. Falls back to '.' if not found. */
export function glyphIndex(char: string): number {
  return charToIndex.get(char) ?? 0; // 0 = '.'
}

/**
 * Generate the glyph atlas as an OffscreenCanvas.
 * All glyphs are drawn in white (#FFFFFF) and tinted at render time.
 */
export function generateGlyphAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);

  // Use a monospace font that covers Unicode block elements
  ctx.font = '16px "JetBrains Mono", "Consolas", monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < GLYPH_CHARS.length; i++) {
    const ch = GLYPH_CHARS[i];
    if (ch === undefined || ch === ' ') continue;

    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const cx = col * TILE_W + TILE_W / 2;
    const cy = row * TILE_H + TILE_H / 2;

    ctx.fillText(ch, cx, cy);
  }

  return canvas;
}

/** PixiJS base texture created from the atlas canvas. Set once during init. */
let atlasTexture: Texture | null = null;
const glyphTextures = new Map<number, Texture>();

/**
 * Initialize the atlas texture from the generated canvas.
 * Must be called once after PixiJS app is initialized.
 */
export function initGlyphAtlas(): void {
  const canvas = generateGlyphAtlas();
  atlasTexture = Texture.from({ resource: canvas, scaleMode: 'nearest' });
}

/**
 * Get a PixiJS Texture for a specific glyph slot (sub-rectangle of the atlas).
 */
export function getGlyphTexture(index: number): Texture {
  const cached = glyphTextures.get(index);
  if (cached !== undefined) return cached;

  if (atlasTexture === null) {
    throw new Error('Glyph atlas not initialized. Call initGlyphAtlas() first.');
  }

  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  const frame = new Rectangle(col * TILE_W, row * TILE_H, TILE_W, TILE_H);

  const tex = new Texture({ source: atlasTexture.source, frame });
  glyphTextures.set(index, tex);
  return tex;
}
```

**Step 2: Verify atlas renders**

This will be visually verified when the tilemap renders. No separate test needed — the atlas is an internal implementation detail consumed by the tilemap renderer.

**Step 3: Commit**

```bash
git add packages/electron/src/renderer/map/glyph-atlas.ts
git commit -m "feat(electron): add programmatic glyph atlas generator"
```

---

### Task 2: Biome Render Config (Palette-Correct)

**Files:**
- Create: `renderer/map/biome-config.ts`

**Why:** The terminal renderer's `biome-render-config.ts` uses non-palette colors with per-channel jitter. The Electron renderer needs palette-correct colors (3 per biome) per the design doc Section 2.3, plus the same weighted glyph pools.

**Step 1: Create biome config with palette colors**

```typescript
// renderer/map/biome-config.ts

/**
 * Biome rendering configuration for the PixiJS map renderer.
 *
 * Each biome has:
 * - Weighted glyph pool (chars with selection weights, matching biome-render-config.ts)
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
  readonly minZoom: number; // minimum zoom level where visible (1=closest)
}

export const ENTITY_MARKERS: Record<string, EntityMarkerConfig> = {
  village:   { char: '\u263C', fg: '#d4a832', minZoom: 1 },  // ☼ CP
  town:      { char: '\u263C', fg: '#d4a832', minZoom: 2 },  // ☼ CP
  city:      { char: '\u263C', fg: '#d4a832', minZoom: 3 },  // ☼ CP
  capital:   { char: '\u2691', fg: '#c9a84c', minZoom: 3 },  // ⚑ AU2
  ruin:      { char: '\u2020', fg: '#585860', minZoom: 1 },  // † N1
  temple:    { char: '\u2605', fg: '#b87acc', minZoom: 1 },  // ★ CR
  academy:   { char: '\u2727', fg: '#40b0c8', minZoom: 1 },  // ✧ CC
  army:      { char: '\u2694', fg: '#c44040', minZoom: 2 },  // ⚔ CM
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
```

**Step 2: Commit**

```bash
git add packages/electron/src/renderer/map/biome-config.ts
git commit -m "feat(electron): add palette-correct biome render configs"
```

---

### Task 3: Viewport (Screen↔World Transforms)

**Files:**
- Create: `renderer/map/viewport.ts`

**Why:** We need a Viewport class that handles pan/zoom state, converts between screen pixel coordinates and world tile coordinates, and supports 3 zoom levels. This is ported from the terminal renderer's viewport but adapted for pixel coordinates.

**Step 1: Create viewport module**

```typescript
// renderer/map/viewport.ts
import { TILE_W, TILE_H } from './glyph-atlas.js';

/** Discrete zoom levels. Value = how many world tiles per screen tile. */
export type ZoomLevel = 1 | 2 | 4;
const ZOOM_LEVELS: readonly ZoomLevel[] = [1, 2, 4];

export class Viewport {
  /** Center of viewport in world tile coordinates */
  private _centerX = 0;
  private _centerY = 0;
  /** Current zoom level */
  private _zoom: ZoomLevel = 1;
  /** Screen dimensions in pixels */
  private _screenW = 0;
  private _screenH = 0;
  /** World dimensions in tiles */
  private _worldW = 0;
  private _worldH = 0;

  get centerX(): number { return this._centerX; }
  get centerY(): number { return this._centerY; }
  get zoom(): ZoomLevel { return this._zoom; }
  get screenW(): number { return this._screenW; }
  get screenH(): number { return this._screenH; }

  /** Number of tiles visible horizontally */
  get viewCols(): number {
    return Math.ceil(this._screenW / TILE_W) + 1;
  }

  /** Number of tiles visible vertically */
  get viewRows(): number {
    return Math.ceil(this._screenH / TILE_H) + 1;
  }

  /** Total world tiles visible horizontally (accounting for zoom) */
  get worldCols(): number {
    return this.viewCols * this._zoom;
  }

  /** Total world tiles visible vertically (accounting for zoom) */
  get worldRows(): number {
    return this.viewRows * this._zoom;
  }

  setWorldSize(w: number, h: number): void {
    this._worldW = w;
    this._worldH = h;
  }

  setScreenSize(w: number, h: number): void {
    this._screenW = w;
    this._screenH = h;
  }

  centerOn(x: number, y: number): void {
    this._centerX = x;
    this._centerY = y;
    this.clamp();
  }

  pan(dx: number, dy: number): void {
    this._centerX += dx * this._zoom;
    this._centerY += dy * this._zoom;
    this.clamp();
  }

  zoomIn(): boolean {
    const idx = ZOOM_LEVELS.indexOf(this._zoom);
    if (idx <= 0) return false;
    this._zoom = ZOOM_LEVELS[idx - 1]!;
    this.clamp();
    return true;
  }

  zoomOut(): boolean {
    const idx = ZOOM_LEVELS.indexOf(this._zoom);
    if (idx >= ZOOM_LEVELS.length - 1) return false;
    this._zoom = ZOOM_LEVELS[idx + 1]!;
    this.clamp();
    return true;
  }

  /**
   * Convert a screen pixel position to world tile coordinates.
   * Returns the world tile (wx, wy) under the given pixel.
   */
  screenToWorld(px: number, py: number): { wx: number; wy: number } {
    const topLeftX = this._centerX - (this.viewCols * this._zoom) / 2;
    const topLeftY = this._centerY - (this.viewRows * this._zoom) / 2;
    const col = Math.floor(px / TILE_W);
    const row = Math.floor(py / TILE_H);
    return {
      wx: Math.floor(topLeftX + col * this._zoom),
      wy: Math.floor(topLeftY + row * this._zoom),
    };
  }

  /**
   * Convert world tile coords to screen pixel position (top-left corner of tile).
   * Returns null if the tile is off-screen.
   */
  worldToScreen(wx: number, wy: number): { px: number; py: number } | null {
    const topLeftX = this._centerX - (this.viewCols * this._zoom) / 2;
    const topLeftY = this._centerY - (this.viewRows * this._zoom) / 2;
    const col = (wx - topLeftX) / this._zoom;
    const row = (wy - topLeftY) / this._zoom;

    if (col < -1 || col > this.viewCols || row < -1 || row > this.viewRows) {
      return null;
    }

    return { px: col * TILE_W, py: row * TILE_H };
  }

  /** Get the top-left world tile coordinate of the viewport */
  getTopLeft(): { wx: number; wy: number } {
    return {
      wx: Math.floor(this._centerX - (this.viewCols * this._zoom) / 2),
      wy: Math.floor(this._centerY - (this.viewRows * this._zoom) / 2),
    };
  }

  private clamp(): void {
    const halfW = (this.viewCols * this._zoom) / 2;
    const halfH = (this.viewRows * this._zoom) / 2;
    this._centerX = Math.max(halfW, Math.min(this._worldW - halfW, this._centerX));
    this._centerY = Math.max(halfH, Math.min(this._worldH - halfH, this._centerY));
  }
}
```

**Step 2: Commit**

```bash
git add packages/electron/src/renderer/map/viewport.ts
git commit -m "feat(electron): add viewport with pan/zoom and coordinate transforms"
```

---

### Task 4: TilemapRenderer (Core Rendering)

**Files:**
- Create: `renderer/map/tilemap-renderer.ts`

**Why:** This is the heart of the map — a sprite pool that renders visible terrain tiles with background fills and glyph sprites, updates on viewport changes, and handles entity markers.

**Step 1: Create the tilemap renderer**

```typescript
// renderer/map/tilemap-renderer.ts
import { Container, Sprite, Graphics } from 'pixi.js';
import { TILE_W, TILE_H, glyphIndex, getGlyphTexture, initGlyphAtlas } from './glyph-atlas.js';
import { Viewport } from './viewport.js';
import { BIOME_CONFIGS, ENTITY_MARKERS, selectGlyph } from './biome-config.js';
import type { WorldSnapshot, TileSnapshot, EntitySnapshot, FactionSnapshot, TickDelta } from '../../shared/types.js';

/** Simple hash for deterministic glyph selection per tile */
function tileNoise(wx: number, wy: number, seed: number): number {
  let h = (seed * 374761393 + wx * 668265263 + wy * 2147483647) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

/** Convert a hex color string to a numeric tint for PixiJS */
function hexToNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

interface TileSprite {
  bg: Graphics;
  glyph: Sprite;
}

export class TilemapRenderer {
  private readonly container = new Container();
  private readonly bgLayer = new Container();
  private readonly glyphLayer = new Container();
  private readonly markerLayer = new Container();

  private readonly viewport = new Viewport();
  private pool: TileSprite[] = [];
  private poolCols = 0;
  private poolRows = 0;

  // World data
  private tiles: readonly (readonly TileSnapshot[])[] = [];
  private entities: EntitySnapshot[] = [];
  private factionColors = new Map<number, string>();
  private mapWidth = 0;
  private mapHeight = 0;
  private seed = 42;

  // Dirty tracking
  private dirty = true;
  private lastCenterX = -1;
  private lastCenterY = -1;
  private lastZoom = -1;

  constructor() {
    this.container.addChild(this.bgLayer);
    this.container.addChild(this.glyphLayer);
    this.container.addChild(this.markerLayer);
  }

  /** The PixiJS container to add to stage */
  getContainer(): Container {
    return this.container;
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  /** Initialize from world snapshot */
  init(snapshot: WorldSnapshot): void {
    initGlyphAtlas();

    this.tiles = snapshot.tiles;
    this.mapWidth = snapshot.mapWidth;
    this.mapHeight = snapshot.mapHeight;
    this.entities = [...snapshot.entities];

    for (const f of snapshot.factions) {
      this.factionColors.set(f.id, f.color);
    }

    this.viewport.setWorldSize(this.mapWidth, this.mapHeight);
    this.viewport.centerOn(
      Math.floor(this.mapWidth / 2),
      Math.floor(this.mapHeight / 2),
    );

    this.dirty = true;
  }

  /** Call when the PixiJS canvas resizes */
  resize(screenW: number, screenH: number): void {
    this.viewport.setScreenSize(screenW, screenH);
    this.rebuildPool();
    this.dirty = true;
  }

  /** Handle tick delta updates (entity position changes, etc.) */
  handleTickDelta(_delta: TickDelta): void {
    // For now, mark dirty so entities re-render.
    // Future: only update changed entities from delta.changedEntities
    this.dirty = true;
  }

  /** Main render call — invoke from requestAnimationFrame or ticker */
  render(): void {
    if (!this.dirty && !this.viewportChanged()) return;

    this.dirty = false;
    this.lastCenterX = this.viewport.centerX;
    this.lastCenterY = this.viewport.centerY;
    this.lastZoom = this.viewport.zoom;

    this.renderTerrain();
    this.renderEntityMarkers();
  }

  // ── Pool management ─────────────────────────────────────────────────────

  private rebuildPool(): void {
    const cols = this.viewport.viewCols;
    const rows = this.viewport.viewRows;

    if (cols === this.poolCols && rows === this.poolRows) return;

    // Clear old sprites
    this.bgLayer.removeChildren();
    this.glyphLayer.removeChildren();
    this.pool = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bg = new Graphics();
        bg.rect(0, 0, TILE_W, TILE_H).fill(0x0c0c14);
        bg.x = c * TILE_W;
        bg.y = r * TILE_H;
        this.bgLayer.addChild(bg);

        const glyph = new Sprite(getGlyphTexture(0));
        glyph.x = c * TILE_W;
        glyph.y = r * TILE_H;
        glyph.tint = 0xffffff;
        this.glyphLayer.addChild(glyph);

        this.pool.push({ bg, glyph });
      }
    }

    this.poolCols = cols;
    this.poolRows = rows;
  }

  // ── Terrain rendering ─────────────────────────────────────────────────

  private renderTerrain(): void {
    const { wx: startX, wy: startY } = this.viewport.getTopLeft();
    const zoom = this.viewport.zoom;

    for (let r = 0; r < this.poolRows; r++) {
      for (let c = 0; c < this.poolCols; c++) {
        const idx = r * this.poolCols + c;
        const tile = this.pool[idx];
        if (tile === undefined) continue;

        const worldX = startX + c * zoom;
        const worldY = startY + r * zoom;

        if (zoom === 1) {
          this.renderSingleTile(tile, worldX, worldY);
        } else {
          this.renderComposite(tile, worldX, worldY, zoom);
        }
      }
    }
  }

  private renderSingleTile(tile: TileSprite, wx: number, wy: number): void {
    const tileData = this.getTile(wx, wy);
    if (tileData === null) {
      tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill(0x0c0c14);
      tile.glyph.visible = false;
      return;
    }

    const config = BIOME_CONFIGS[tileData.biome];
    if (config === undefined) {
      tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill(0x0c0c14);
      tile.glyph.visible = false;
      return;
    }

    // Background
    tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill(hexToNum(config.bg));

    // Glyph
    const noise = tileNoise(wx, wy, this.seed);
    const char = selectGlyph(config, noise);
    const glyphIdx = glyphIndex(char);

    tile.glyph.visible = true;
    tile.glyph.texture = getGlyphTexture(glyphIdx);
    tile.glyph.tint = hexToNum(config.fg);

    // River overlay
    if (tileData.riverId !== undefined) {
      tile.glyph.texture = getGlyphTexture(glyphIndex('~'));
      tile.glyph.tint = hexToNum('#2868a0'); // TS
    }
  }

  private renderComposite(tile: TileSprite, wx: number, wy: number, zoom: number): void {
    // At zoom > 1, pick the dominant biome from the NxN region
    const biomeCounts = new Map<string, number>();
    let dominantBiome = 'Ocean';
    let maxCount = 0;

    for (let dy = 0; dy < zoom; dy++) {
      for (let dx = 0; dx < zoom; dx++) {
        const td = this.getTile(wx + dx, wy + dy);
        if (td !== null) {
          const count = (biomeCounts.get(td.biome) ?? 0) + 1;
          biomeCounts.set(td.biome, count);
          if (count > maxCount) {
            maxCount = count;
            dominantBiome = td.biome;
          }
        }
      }
    }

    const config = BIOME_CONFIGS[dominantBiome];
    if (config === undefined) {
      tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill(0x0c0c14);
      tile.glyph.visible = false;
      return;
    }

    tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill(hexToNum(config.bg));

    const noise = tileNoise(wx, wy, this.seed);
    const char = selectGlyph(config, noise);
    tile.glyph.visible = true;
    tile.glyph.texture = getGlyphTexture(glyphIndex(char));
    tile.glyph.tint = hexToNum(config.fg);
  }

  // ── Entity markers ──────────────────────────────────────────────────

  private renderEntityMarkers(): void {
    this.markerLayer.removeChildren();
    const zoom = this.viewport.zoom;

    for (const entity of this.entities) {
      if (entity.type !== 'settlement') continue;

      // Determine marker type based on entity data
      const markerType = 'city'; // TODO: differentiate village/town/city/capital
      const markerConfig = ENTITY_MARKERS[markerType];
      if (markerConfig === undefined) continue;

      // Check zoom visibility
      if (zoom > markerConfig.minZoom) continue;

      const screenPos = this.viewport.worldToScreen(entity.x, entity.y);
      if (screenPos === null) continue;

      const marker = new Sprite(getGlyphTexture(glyphIndex(markerConfig.char)));
      marker.x = screenPos.px;
      marker.y = screenPos.py;
      marker.tint = hexToNum(markerConfig.fg);
      this.markerLayer.addChild(marker);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private getTile(wx: number, wy: number): TileSnapshot | null {
    if (wx < 0 || wy < 0 || wx >= this.mapWidth || wy >= this.mapHeight) return null;
    const row = this.tiles[wy];
    if (row === undefined) return null;
    return row[wx] ?? null;
  }

  private viewportChanged(): boolean {
    return (
      this.viewport.centerX !== this.lastCenterX ||
      this.viewport.centerY !== this.lastCenterY ||
      this.viewport.zoom !== this.lastZoom
    );
  }
}
```

**Step 2: Commit**

```bash
git add packages/electron/src/renderer/map/tilemap-renderer.ts
git commit -m "feat(electron): add TilemapRenderer with sprite pool and terrain rendering"
```

---

### Task 5: Keyboard & Mouse Input

**Files:**
- Create: `renderer/map/input-handler.ts`

**Why:** Map needs WASD/arrow panning, scroll-wheel zoom, and click-drag pan.

**Step 1: Create input handler**

```typescript
// renderer/map/input-handler.ts
import type { Viewport } from './viewport.js';

const PAN_SPEED = 3; // tiles per keypress

/**
 * Binds keyboard and mouse input to the Viewport.
 * Call once during initialization.
 */
export function bindMapInput(
  viewport: Viewport,
  canvas: HTMLCanvasElement,
  onDirty: () => void,
): () => void {
  // ── Keyboard ──────────────────────────────────────────────────────────

  function handleKeyDown(e: KeyboardEvent): void {
    let handled = true;
    switch (e.code) {
      case 'ArrowUp':    case 'KeyW': viewport.pan(0, -PAN_SPEED); break;
      case 'ArrowDown':  case 'KeyS': viewport.pan(0, PAN_SPEED);  break;
      case 'ArrowLeft':  case 'KeyA': viewport.pan(-PAN_SPEED, 0); break;
      case 'ArrowRight': case 'KeyD': viewport.pan(PAN_SPEED, 0);  break;
      case 'Equal': case 'NumpadAdd':     viewport.zoomIn();  break;
      case 'Minus': case 'NumpadSubtract': viewport.zoomOut(); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      onDirty();
    }
  }

  // ── Mouse scroll (zoom) ───────────────────────────────────────────────

  function handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.deltaY < 0) {
      viewport.zoomIn();
    } else {
      viewport.zoomOut();
    }
    onDirty();
  }

  // ── Click-drag (pan) ──────────────────────────────────────────────────

  let dragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // left click only
    dragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!dragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // Convert pixel delta to tile delta (negative because dragging moves view opposite)
    const tileDx = -dx / (16 / viewport.zoom);
    const tileDy = -dy / (24 / viewport.zoom);
    viewport.pan(tileDx, tileDy);
    onDirty();
  }

  function handleMouseUp(): void {
    dragging = false;
    canvas.style.cursor = 'default';
  }

  // ── Bind events ───────────────────────────────────────────────────────

  document.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    canvas.removeEventListener('wheel', handleWheel);
    canvas.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}
```

**Step 2: Commit**

```bash
git add packages/electron/src/renderer/map/input-handler.ts
git commit -m "feat(electron): add keyboard/mouse input handler for map navigation"
```

---

### Task 6: Map Tooltip

**Files:**
- Create: `renderer/map/map-tooltip.ts`
- Create: `renderer/map/index.ts` (barrel)
- Modify: `styles/index.css` (add tooltip import)
- Create: `styles/tooltip.css`

**Why:** Hovering over a tile for 300ms shows a tooltip with biome, coordinates, faction, and settlement info.

**Step 1: Create tooltip CSS**

```css
/* styles/tooltip.css */
.map-tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  background: var(--bg2);
  border: 1px solid var(--border-default);
  padding: var(--space-md) 10px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-primary);
  max-width: 280px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.map-tooltip.visible {
  opacity: 1;
}

.map-tooltip__biome {
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}

.map-tooltip__coords {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

.map-tooltip__faction {
  color: var(--text-secondary);
  margin-top: var(--space-xs);
}

.map-tooltip__settlement {
  color: var(--text-accent);
  margin-top: var(--space-xs);
}
```

**Step 2: Create tooltip module**

```typescript
// renderer/map/map-tooltip.ts
import type { Viewport } from './viewport.js';
import type { TileSnapshot, EntitySnapshot, FactionSnapshot } from '../../shared/types.js';

const SHOW_DELAY = 300; // ms

export class MapTooltip {
  private readonly el: HTMLDivElement;
  private viewport: Viewport | null = null;
  private tiles: readonly (readonly TileSnapshot[])[] = [];
  private entities: EntitySnapshot[] = [];
  private factions = new Map<number, FactionSnapshot>();
  private mapWidth = 0;
  private mapHeight = 0;

  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private currentWx = -1;
  private currentWy = -1;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'map-tooltip';
    document.body.appendChild(this.el);
  }

  setData(
    viewport: Viewport,
    tiles: readonly (readonly TileSnapshot[])[],
    entities: EntitySnapshot[],
    factions: FactionSnapshot[],
    mapWidth: number,
    mapHeight: number,
  ): void {
    this.viewport = viewport;
    this.tiles = tiles;
    this.entities = entities;
    this.factions.clear();
    for (const f of factions) this.factions.set(f.id, f);
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  /** Bind to the canvas for mouse tracking */
  bind(canvas: HTMLCanvasElement): () => void {
    const onMove = (e: MouseEvent): void => {
      if (this.viewport === null) return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { wx, wy } = this.viewport.screenToWorld(px, py);

      if (wx !== this.currentWx || wy !== this.currentWy) {
        this.currentWx = wx;
        this.currentWy = wy;
        this.hide();

        if (wx >= 0 && wy >= 0 && wx < this.mapWidth && wy < this.mapHeight) {
          this.hoverTimer = setTimeout(() => {
            this.show(wx, wy, e.clientX, e.clientY);
          }, SHOW_DELAY);
        }
      }

      // Update position even if already visible
      if (this.el.classList.contains('visible')) {
        this.position(e.clientX, e.clientY);
      }
    };

    const onLeave = (): void => {
      this.hide();
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }

  private show(wx: number, wy: number, mouseX: number, mouseY: number): void {
    const row = this.tiles[wy];
    const tile = row !== undefined ? row[wx] : undefined;
    if (tile === undefined) return;

    let html = `<div class="map-tooltip__biome">${tile.biome}  <span class="map-tooltip__coords">(${wx}, ${wy})</span></div>`;

    // Find faction controlling this tile (rough: nearest settlement)
    const entity = this.entities.find(e => e.x === wx && e.y === wy);
    if (entity !== undefined) {
      html += `<div class="map-tooltip__settlement">${entity.name} (${entity.type})</div>`;
      if (entity.factionId !== undefined) {
        const faction = this.factions.get(entity.factionId);
        if (faction !== undefined) {
          html += `<div class="map-tooltip__faction">Faction: <span style="color:${faction.color}">${faction.name}</span></div>`;
        }
      }
    }

    if (tile.resources !== undefined && tile.resources.length > 0) {
      html += `<div class="map-tooltip__faction">Resources: ${tile.resources.join(', ')}</div>`;
    }

    this.el.innerHTML = html;
    this.position(mouseX, mouseY);
    this.el.classList.add('visible');
  }

  private hide(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.el.classList.remove('visible');
  }

  private position(mouseX: number, mouseY: number): void {
    this.el.style.left = `${mouseX + 12}px`;
    this.el.style.top = `${mouseY + 12}px`;
  }
}
```

**Step 3: Create barrel export**

```typescript
// renderer/map/index.ts
export { TilemapRenderer } from './tilemap-renderer.js';
export { Viewport } from './viewport.js';
export { MapTooltip } from './map-tooltip.js';
export { bindMapInput } from './input-handler.js';
export { initGlyphAtlas, TILE_W, TILE_H } from './glyph-atlas.js';
```

**Step 4: Update styles/index.css**

Add `@import './tooltip.css';` to the cascade.

**Step 5: Commit**

```bash
git add packages/electron/src/renderer/map/ packages/electron/src/styles/tooltip.css packages/electron/src/styles/index.css
git commit -m "feat(electron): add map tooltip, barrel exports, and tooltip CSS"
```

---

### Task 7: Wire Map to Renderer Entry Point

**Files:**
- Modify: `renderer/index.ts`
- Modify: `renderer/pixi-app.ts`

**Why:** Connect TilemapRenderer + InputHandler + Tooltip to the existing renderer init flow. On snapshot load, initialize the map. On tick delta, update.

**Step 1: Update pixi-app.ts to expose stage**

Add a `getStage()` export alongside existing `getPixiApp()`.

**Step 2: Update renderer/index.ts**

Replace the existing init function to:
1. Init PixiJS (existing)
2. Create TilemapRenderer, add to stage
3. Load snapshot → `tilemap.init(snapshot)`, `tilemap.resize()`
4. Bind input handler
5. Create tooltip, set data, bind
6. Add tilemap.render() to the animation loop
7. Handle resize events with `tilemap.resize()`
8. Wire `handleTickDelta` to also call `tilemap.handleTickDelta(delta)`

The full updated `index.ts`:

```typescript
// renderer/index.ts (REPLACE entire file)
import { initPixiApp, getPixiApp } from './pixi-app.js';
import { createIpcClient } from './ipc-client.js';
import { TilemapRenderer } from './map/tilemap-renderer.js';
import { MapTooltip } from './map/map-tooltip.js';
import { bindMapInput } from './map/input-handler.js';
import type { TickDelta, WorldSnapshot } from '../shared/types.js';

// ── State ────────────────────────────────────────────────────────────────────

let totalTicks = 0;
let totalEntities = 0;
let totalEvents = 0;
let paused = true;
let speed = 1;

// FPS tracking
let frameCount = 0;
let lastFpsTime = performance.now();

// Map
const tilemap = new TilemapRenderer();
const tooltip = new MapTooltip();

// ── DOM refs ─────────────────────────────────────────────────────────────────

const tickEl = document.getElementById('status-tick')!;
const entitiesEl = document.getElementById('status-entities')!;
const eventsEl = document.getElementById('status-events')!;
const fpsEl = document.getElementById('status-fps')!;
const dateEl = document.getElementById('date-display')!;
const btnPause = document.getElementById('btn-pause')!;
const btnPlay = document.getElementById('btn-play')!;
const btnFast = document.getElementById('btn-fast')!;

// ── IPC ──────────────────────────────────────────────────────────────────────

const ipc = createIpcClient();

function updateStatusBar(): void {
  tickEl.textContent = `Tick: ${totalTicks}`;
  entitiesEl.textContent = `Entities: ${totalEntities}`;
  eventsEl.textContent = `Events: ${totalEvents}`;
}

function updateSpeedButtons(): void {
  btnPause.classList.toggle('active', paused);
  btnPlay.classList.toggle('active', !paused && speed === 1);
  btnFast.classList.toggle('active', !paused && speed > 1);
}

function handleTickDelta(delta: TickDelta): void {
  totalTicks = delta.tick;
  totalEvents += delta.events.length;
  dateEl.textContent = `Year ${delta.time.year}, Month ${delta.time.month}, Day ${delta.time.day}`;
  updateStatusBar();
  tilemap.handleTickDelta(delta);
}

// ── Controls ─────────────────────────────────────────────────────────────────

btnPause.addEventListener('click', () => {
  paused = true;
  ipc.sendCommand({ type: 'pause' });
  updateSpeedButtons();
});

btnPlay.addEventListener('click', () => {
  paused = false;
  speed = 1;
  ipc.sendCommand({ type: 'resume' });
  ipc.sendCommand({ type: 'set-speed', ticksPerSecond: 1 });
  updateSpeedButtons();
});

btnFast.addEventListener('click', () => {
  paused = false;
  speed = 7;
  ipc.sendCommand({ type: 'resume' });
  ipc.sendCommand({ type: 'set-speed', ticksPerSecond: 7 });
  updateSpeedButtons();
});

// Keyboard shortcuts (space handled separately — map keys handled by input handler)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (paused) {
      btnPlay.click();
    } else {
      btnPause.click();
    }
  }
});

// ── FPS counter ──────────────────────────────────────────────────────────────

function renderLoop(): void {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fpsEl.textContent = `FPS: ${frameCount}`;
    frameCount = 0;
    lastFpsTime = now;
  }

  // Render map
  tilemap.render();

  requestAnimationFrame(renderLoop);
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const canvas = document.getElementById('pixi-canvas') as HTMLCanvasElement;
  const container = document.getElementById('map-container')!;

  // Initialize PixiJS
  const app = await initPixiApp(canvas, container);

  // Add tilemap to stage
  app.stage.addChild(tilemap.getContainer());

  // Subscribe to tick deltas
  ipc.onTickDelta(handleTickDelta);

  // Load initial world snapshot
  const snapshot: WorldSnapshot = await ipc.requestSnapshot();
  totalTicks = snapshot.events.length > 0
    ? snapshot.events[snapshot.events.length - 1]!.tick
    : 0;
  totalEntities = snapshot.entities.length;
  totalEvents = snapshot.events.length;

  console.log(`[renderer] World loaded: ${snapshot.mapWidth}x${snapshot.mapHeight}, ${snapshot.entities.length} entities`);

  // Initialize map
  tilemap.init(snapshot);
  tilemap.resize(app.screen.width, app.screen.height);

  // Bind input
  bindMapInput(tilemap.getViewport(), canvas, () => { /* dirty handled by viewport change detection */ });

  // Bind tooltip
  tooltip.setData(
    tilemap.getViewport(), snapshot.tiles, [...snapshot.entities],
    [...snapshot.factions], snapshot.mapWidth, snapshot.mapHeight,
  );
  tooltip.bind(canvas);

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    tilemap.resize(app.screen.width, app.screen.height);
  });
  resizeObserver.observe(container);

  updateStatusBar();
  updateSpeedButtons();

  // Start render loop
  requestAnimationFrame(renderLoop);
}

init().catch((err) => {
  console.error('[renderer] Initialization failed:', err);
});
```

**Step 3: Commit**

```bash
git add packages/electron/src/renderer/index.ts packages/electron/src/renderer/pixi-app.ts
git commit -m "feat(electron): wire tilemap renderer to main init flow"
```

---

### Task 8: Overlay Manager (Basic)

**Files:**
- Create: `renderer/map/overlay-manager.ts`
- Modify: `renderer/map/tilemap-renderer.ts` (add overlay integration)
- Modify: `renderer/map/input-handler.ts` (add 'O' key to cycle overlay)

**Why:** Overlays modify tile colors to show political territory, military positions, trade routes, magic, and climate. For Phase 1 we implement Political and Climate overlays as they're the simplest (just tile bg tinting). Military/Trade/Magic overlays can follow in Phase 2-3.

**Step 1: Create overlay manager**

```typescript
// renderer/map/overlay-manager.ts

export enum OverlayType {
  None = 'None',
  Political = 'Political',
  Climate = 'Climate',
  // Future: Military, Trade, Magic, Resources
}

const OVERLAY_CYCLE: OverlayType[] = [
  OverlayType.None,
  OverlayType.Political,
  OverlayType.Climate,
];

export interface OverlayModification {
  /** Override background color (hex), or null for no change */
  bg?: string;
  /** Override glyph tint (hex), or null for no change */
  fg?: string;
}

export class OverlayManager {
  private current: OverlayType = OverlayType.None;
  private factionTerritoryCache = new Map<string, { factionId: number; factionColor: string }>();

  get activeOverlay(): OverlayType { return this.current; }

  cycle(): OverlayType {
    const idx = OVERLAY_CYCLE.indexOf(this.current);
    this.current = OVERLAY_CYCLE[(idx + 1) % OVERLAY_CYCLE.length]!;
    return this.current;
  }

  /**
   * Build territory cache from entity positions.
   * Simple approach: each settlement "claims" a radius of tiles for its faction.
   */
  buildTerritoryCache(
    entities: readonly { x: number; y: number; factionId?: number }[],
    factionColors: Map<number, string>,
  ): void {
    this.factionTerritoryCache.clear();
    const TERRITORY_RADIUS = 8;

    for (const entity of entities) {
      if (entity.factionId === undefined) continue;
      const color = factionColors.get(entity.factionId);
      if (color === undefined) continue;

      for (let dy = -TERRITORY_RADIUS; dy <= TERRITORY_RADIUS; dy++) {
        for (let dx = -TERRITORY_RADIUS; dx <= TERRITORY_RADIUS; dx++) {
          // Diamond shape
          if (Math.abs(dx) + Math.abs(dy) > TERRITORY_RADIUS) continue;
          const key = `${entity.x + dx},${entity.y + dy}`;
          // Closer settlements win
          const existing = this.factionTerritoryCache.get(key);
          if (existing === undefined) {
            this.factionTerritoryCache.set(key, { factionId: entity.factionId, factionColor: color });
          }
        }
      }
    }
  }

  /**
   * Get overlay modification for a world tile.
   */
  getModification(wx: number, wy: number, temperature?: number, rainfall?: number): OverlayModification | null {
    switch (this.current) {
      case OverlayType.None:
        return null;

      case OverlayType.Political: {
        const territory = this.factionTerritoryCache.get(`${wx},${wy}`);
        if (territory === undefined) return null;
        // Tint background toward faction color (30% blend)
        return { bg: blendColors('#16161e', territory.factionColor, 0.3) };
      }

      case OverlayType.Climate: {
        if (temperature === undefined) return null;
        // Temperature gradient: cold (blue) → neutral → hot (red)
        const t = Math.max(-30, Math.min(50, temperature));
        const norm = (t + 30) / 80; // 0 = -30°C, 1 = 50°C
        const color = norm < 0.5
          ? blendColors('#1a3860', '#8a8a90', norm * 2)
          : blendColors('#8a8a90', '#c44040', (norm - 0.5) * 2);
        return { bg: color };
      }

      default:
        return null;
    }
  }
}

/** Blend two hex colors. t=0 returns c1, t=1 returns c2. */
function blendColors(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
```

**Step 2: Integrate into TilemapRenderer**

Add an `OverlayManager` field to `TilemapRenderer`. After rendering terrain bg/glyph, check `overlayManager.getModification()` and override tile bg/fg tint if non-null. Build territory cache in `init()`.

**Step 3: Add 'O' key to input handler**

In `handleKeyDown`, add case `'KeyO'` that calls a provided `onCycleOverlay` callback.

**Step 4: Commit**

```bash
git add packages/electron/src/renderer/map/overlay-manager.ts packages/electron/src/renderer/map/tilemap-renderer.ts packages/electron/src/renderer/map/input-handler.ts
git commit -m "feat(electron): add overlay manager with Political and Climate overlays"
```

---

### Task 9: Overlay Status Indicator

**Files:**
- Modify: `renderer/index.html` (add overlay indicator to status bar)
- Modify: `renderer/index.ts` (update overlay text on cycle)

**Why:** The user needs to see which overlay is active. Add a status bar item that shows the current overlay name.

**Step 1: Add overlay indicator to status bar HTML**

After the FPS span, add:
```html
<span class="status-separator">|</span>
<span class="status-item" id="status-overlay">Overlay: None</span>
```

**Step 2: Wire overlay cycle to status update**

In the input handler's onCycleOverlay callback, update the DOM element text.

**Step 3: Commit**

```bash
git add packages/electron/src/renderer/index.html packages/electron/src/renderer/index.ts
git commit -m "feat(electron): add overlay status indicator to status bar"
```

---

### Task 10: Final Verification & Cleanup

**Step 1: Run typecheck**

```bash
pnpm run typecheck
```

Expected: All 6 packages pass (0 errors).

**Step 2: Run tests**

```bash
pnpm run test
```

Expected: All 2,955 tests pass. (No new tests needed — renderer code runs in browser context and is verified visually.)

**Step 3: Visual verification**

```bash
pnpm run start:electron
```

Verify:
- [ ] Map renders with colored terrain tiles matching biome types
- [ ] Different biomes show different glyphs (spades for forest, dots for plains, etc.)
- [ ] WASD/arrow keys pan the viewport
- [ ] Scroll wheel zooms in/out through 3 levels
- [ ] Click-drag pans the map
- [ ] Settlement markers (☼) appear at settlement positions
- [ ] `O` key cycles overlays: None → Political (colored territories) → Climate (temperature gradient) → None
- [ ] Hover tooltip appears after 300ms showing biome name and coordinates
- [ ] FPS counter shows stable 60fps
- [ ] Status bar shows tick, entities, events, FPS, overlay type
- [ ] Play/Pause/Fast buttons work, date updates on tick

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(electron): Phase 9.1 complete — map rendering with terrain, markers, overlays, tooltips"
```

---

## Summary

| Task | Component | Files Created | Files Modified |
|------|-----------|--------------|----------------|
| 1 | Glyph Atlas | glyph-atlas.ts | — |
| 2 | Biome Config | biome-config.ts | — |
| 3 | Viewport | viewport.ts | — |
| 4 | TilemapRenderer | tilemap-renderer.ts | — |
| 5 | Input Handler | input-handler.ts | — |
| 6 | Map Tooltip + Barrel | map-tooltip.ts, index.ts, tooltip.css | index.css |
| 7 | Wire to Entry | — | index.ts, pixi-app.ts |
| 8 | Overlay Manager | overlay-manager.ts | tilemap-renderer.ts, input-handler.ts |
| 9 | Overlay Status | — | index.html, index.ts |
| 10 | Verification | — | — |

**Total new files:** 8
**Total modified files:** 5
**Estimated LOC:** ~900 new TypeScript + ~40 CSS
