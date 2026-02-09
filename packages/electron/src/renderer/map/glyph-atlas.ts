/**
 * Programmatic glyph atlas for PixiJS tile rendering.
 *
 * Generates a 256×384px canvas (16 cols × 16 rows of 16×24 cells) with all
 * terrain, entity, and overlay glyphs drawn in white. Glyphs are tinted at
 * render time via sprite.tint.
 */
import { Texture, Rectangle, CanvasSource } from 'pixi.js';

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
 * Empty string = unused slot.
 */
const GLYPH_CHARS: string[] = [
  // Row 0-1: Terrain glyphs (32 slots)
  '.', ',', "'", '"', '`', '\u00B7',    // 0-5:   plains . , ' " ` ·
  '\u2660', '\u2663', '\u2191', '\u03C4', '\u0393', // 6-10: forest ♠ ♣ ↑ τ Γ
  '\u25B2', '^', '\u2302', '\u2229', 'n', // 11-15: mountain ▲ ^ ⌂ ∩ n
  '\u2248', '~', '\u223C',               // 16-18: water ≈ ~ ∼
  '\u00B0', '\u00B4', 'V', '\u221A',     // 19-22: desert ° ´ V √
  '\u2219', '\u207F',                     // 23-24: tundra ∙ ⁿ
  '\u2591', '\u2592', '\u2593', '\u2588', // 25-28: shading ░ ▒ ▓ █
  '*', '?',                               // 29-30: misc
  '',                                     // 31: padding

  // Row 2-3: Entity markers (32 slots)
  '\u263C',   // 32: ☼ settlement (sun)
  '\u2691',   // 33: ⚑ capital (flag)
  '\u2020',   // 34: † ruin (dagger)
  '\u2694',   // 35: ⚔ army (crossed swords)
  '\u271D',   // 36: ✝ temple
  '\u2727',   // 37: ✧ academy (sparkle)
  '\u2605',   // 38: ★ star 6pt
  '\u2726',   // 39: ✦ artifact 4pt star
  '@',        // 40: character
  '\u2193',   // 41: ↓ south arrow
  '\u2190',   // 42: ← west arrow
  '\u2192',   // 43: → east arrow
  '\u2197',   // 44: ↗ NE arrow
  '\u2196',   // 45: ↖ NW arrow
  '\u2198',   // 46: ↘ SE arrow
  '\u2199',   // 47: ↙ SW arrow
  '\u2699',   // 48: ⚙ gear (besieged)
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', // 49-63: padding

  // Row 4-5: Overlay / box-drawing glyphs (32 slots)
  '\u2502', '\u2500', '\u2514', '\u2518', '\u250C', '\u2510', // 64-69: │ ─ └ ┘ ┌ ┐
  '\u251C', '\u2524', '\u2534', '\u252C', '\u253C',           // 70-74: ├ ┤ ┴ ┬ ┼
  '\u00D7',   // 75: × ley line crossing
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', // 76-95: padding
];

/** Map from character to its atlas slot index */
const charToIndex = new Map<string, number>();
for (let i = 0; i < GLYPH_CHARS.length; i++) {
  const ch = GLYPH_CHARS[i];
  if (ch !== undefined && ch !== '' && !charToIndex.has(ch)) {
    charToIndex.set(ch, i);
  }
}

/** Look up the atlas index for a glyph character. Falls back to 0 ('.') if not found. */
export function glyphIndex(char: string): number {
  return charToIndex.get(char) ?? 0;
}

/**
 * Generate the glyph atlas as a canvas element.
 * All glyphs drawn in white (#FFFFFF) for tinting at render time.
 */
export function generateGlyphAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);

  ctx.font = '16px "JetBrains Mono", "Consolas", monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < GLYPH_CHARS.length; i++) {
    const ch = GLYPH_CHARS[i];
    if (ch === undefined || ch === '') continue;

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
  if (atlasTexture !== null) return; // already initialized
  const canvas = generateGlyphAtlas();
  const source = new CanvasSource({ resource: canvas, scaleMode: 'nearest' });
  atlasTexture = new Texture({ source });
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
