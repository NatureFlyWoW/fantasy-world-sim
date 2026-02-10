/**
 * Charge atlas for heraldic symbols.
 *
 * Generates a 64×64px canvas with 16 charge glyphs (4×4 grid of 16×16 cells).
 * All charges drawn in white for runtime tinting.
 */
import { Texture, Rectangle, CanvasSource } from 'pixi.js';

/** Charge slot dimensions */
const CHARGE_CELL_W = 16;
const CHARGE_CELL_H = 16;
const CHARGE_COLS = 4;
const CHARGE_ROWS = 4;
const CHARGE_ATLAS_W = CHARGE_COLS * CHARGE_CELL_W; // 64
const CHARGE_ATLAS_H = CHARGE_ROWS * CHARGE_CELL_H; // 64

/** Charge category to row mapping */
export type ChargeCategory = 'animal' | 'weapon' | 'nature' | 'religious';
export type ChargeName =
  | 'Lion' | 'Eagle' | 'Dragon' | 'Serpent'
  | 'Sword' | 'Axe' | 'Shield' | 'Tower'
  | 'Tree' | 'Mountain' | 'Star' | 'Moon'
  | 'Cross' | 'Chalice' | 'Eye' | 'Book';

/** Map charge names to atlas indices (0-15) */
const CHARGE_INDEX_MAP: Record<ChargeName, number> = {
  Lion: 0, Eagle: 1, Dragon: 2, Serpent: 3,
  Sword: 4, Axe: 5, Shield: 6, Tower: 7,
  Tree: 8, Mountain: 9, Star: 10, Moon: 11,
  Cross: 12, Chalice: 13, Eye: 14, Book: 15,
};

/** Get atlas index for a charge name */
export function getChargeIndex(name: ChargeName): number {
  return CHARGE_INDEX_MAP[name] ?? 0;
}

/**
 * Generate the charge atlas canvas.
 * Each charge is drawn in white (#FFFFFF) centered in its 16×16 cell.
 */
export function generateChargeAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CHARGE_ATLAS_W;
  canvas.height = CHARGE_ATLAS_H;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, CHARGE_ATLAS_W, CHARGE_ATLAS_H);

  // Drawing helpers
  const drawInCell = (row: number, col: number, drawFn: (cx: number, cy: number) => void) => {
    const cx = col * CHARGE_CELL_W + CHARGE_CELL_W / 2;
    const cy = row * CHARGE_CELL_H + CHARGE_CELL_H / 2;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    drawFn(cx, cy);
    ctx.restore();
  };

  // Row 0: Animal charges
  drawInCell(0, 0, (cx, cy) => {
    // Lion: stylized mane
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.fillRect(
        cx + Math.cos(angle) * 4 - 0.5,
        cy + Math.sin(angle) * 4 - 0.5,
        1, 3
      );
    }
  });

  drawInCell(0, 1, (cx, cy) => {
    // Eagle: V-shape with head
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 2);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx + 5, cy - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  drawInCell(0, 2, (cx, cy) => {
    // Dragon: S-curve with head
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 5);
    ctx.bezierCurveTo(cx - 2, cy - 2, cx + 2, cy + 2, cx + 4, cy + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 5, 2, 0, Math.PI * 2);
    ctx.fill();
    // Wings
    ctx.fillRect(cx - 1, cy - 2, 6, 1);
    ctx.fillRect(cx - 5, cy + 1, 6, 1);
  });

  drawInCell(0, 3, (cx, cy) => {
    // Serpent: wavy line
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 3);
    ctx.quadraticCurveTo(cx - 2, cy + 2, cx + 1, cy - 1);
    ctx.quadraticCurveTo(cx + 4, cy - 4, cx + 5, cy + 3);
    ctx.stroke();
  });

  // Row 1: Weapon charges
  drawInCell(1, 0, (cx, cy) => {
    // Sword: blade + crossguard + pommel
    ctx.fillRect(cx - 0.5, cy - 6, 1, 10); // blade
    ctx.fillRect(cx - 4, cy - 2, 8, 1);     // crossguard
    ctx.beginPath();
    ctx.arc(cx, cy + 5, 1.5, 0, Math.PI * 2);
    ctx.fill(); // pommel
  });

  drawInCell(1, 1, (cx, cy) => {
    // Axe: handle + blade
    ctx.fillRect(cx - 0.5, cy - 2, 1, 8);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx + 5, cy - 2);
    ctx.lineTo(cx + 4, cy + 1);
    ctx.lineTo(cx, cy - 1);
    ctx.closePath();
    ctx.fill();
  });

  drawInCell(1, 2, (cx, cy) => {
    // Shield: heater shape
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 4, Math.PI, 0, false);
    ctx.lineTo(cx + 4, cy + 3);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx - 4, cy + 3);
    ctx.closePath();
    ctx.stroke();
  });

  drawInCell(1, 3, (cx, cy) => {
    // Tower: rectangle with crenellations
    ctx.fillRect(cx - 4, cy - 4, 8, 9);
    ctx.clearRect(cx - 3, cy - 5, 2, 1);
    ctx.clearRect(cx, cy - 5, 2, 1);
    ctx.clearRect(cx + 3, cy - 5, 2, 1);
  });

  // Row 2: Nature charges
  drawInCell(2, 0, (cx, cy) => {
    // Tree: trunk + canopy
    ctx.fillRect(cx - 1, cy + 1, 2, 4);
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  drawInCell(2, 1, (cx, cy) => {
    // Mountain: triangle
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 5, cy + 4);
    ctx.lineTo(cx - 5, cy + 4);
    ctx.closePath();
    ctx.fill();
  });

  drawInCell(2, 2, (cx, cy) => {
    // Star: 6-pointed
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(angle) * 5,
        cy + Math.sin(angle) * 5
      );
      ctx.stroke();
    }
  });

  drawInCell(2, 3, (cx, cy) => {
    // Moon: crescent
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0.5, Math.PI * 2 - 0.5);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx + 2, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Row 3: Religious charges
  drawInCell(3, 0, (cx, cy) => {
    // Cross: Latin cross
    ctx.fillRect(cx - 1, cy - 5, 2, 10);
    ctx.fillRect(cx - 4, cy - 2, 8, 2);
  });

  drawInCell(3, 1, (cx, cy) => {
    // Chalice: goblet shape
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 4);
    ctx.lineTo(cx - 1, cy);
    ctx.lineTo(cx - 1, cy + 2);
    ctx.lineTo(cx - 3, cy + 3);
    ctx.lineTo(cx + 3, cy + 3);
    ctx.lineTo(cx + 1, cy + 2);
    ctx.lineTo(cx + 1, cy);
    ctx.lineTo(cx + 3, cy - 4);
    ctx.closePath();
    ctx.stroke();
  });

  drawInCell(3, 2, (cx, cy) => {
    // Eye: almond shape with pupil
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  drawInCell(3, 3, (cx, cy) => {
    // Book: open book
    ctx.fillRect(cx - 4, cy - 3, 8, 6);
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx, cy + 3);
    ctx.stroke();
  });

  return canvas;
}

/** Cached charge atlas canvas and texture */
let chargeAtlasCanvas: HTMLCanvasElement | null = null;
let chargeAtlasTexture: Texture | null = null;
const chargeTextureCache = new Map<number, Texture>();

/**
 * Initialize the charge atlas (call once during renderer init).
 */
export function initChargeAtlas(): void {
  if (chargeAtlasTexture !== null) return;
  chargeAtlasCanvas = generateChargeAtlas();
  const source = new CanvasSource({ resource: chargeAtlasCanvas, scaleMode: 'nearest' });
  chargeAtlasTexture = new Texture({ source });
}

/**
 * Get the raw charge atlas canvas for Canvas 2D compositing (used by heraldry renderer).
 */
export function getChargeAtlasCanvas(): HTMLCanvasElement {
  if (chargeAtlasCanvas === null) {
    initChargeAtlas();
  }
  return chargeAtlasCanvas!;
}

/**
 * Get a PixiJS texture for a specific charge (sub-rectangle of atlas).
 */
export function getChargeTexture(name: ChargeName): Texture {
  const index = getChargeIndex(name);
  const cached = chargeTextureCache.get(index);
  if (cached !== undefined) return cached;

  if (chargeAtlasTexture === null) {
    throw new Error('Charge atlas not initialized. Call initChargeAtlas() first.');
  }

  const col = index % CHARGE_COLS;
  const row = Math.floor(index / CHARGE_COLS);
  const frame = new Rectangle(
    col * CHARGE_CELL_W,
    row * CHARGE_CELL_H,
    CHARGE_CELL_W,
    CHARGE_CELL_H
  );

  const tex = new Texture({ source: chargeAtlasTexture.source, frame });
  chargeTextureCache.set(index, tex);
  return tex;
}
