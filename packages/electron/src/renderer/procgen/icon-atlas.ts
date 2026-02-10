/**
 * Icon atlas for UI elements (event categories, entity types, actions).
 *
 * Generates a 160×32px canvas with 20 icons (10×2 grid of 16×16 cells).
 */

const ICON_CELL_W = 16;
const ICON_CELL_H = 16;
const ICON_COLS = 10;
const ICON_ROWS = 2;
const ICON_ATLAS_W = ICON_COLS * ICON_CELL_W; // 160
const ICON_ATLAS_H = ICON_ROWS * ICON_CELL_H; // 32

export type EventCategoryIcon =
  | 'Political' | 'Military' | 'Economic' | 'Social' | 'Religious'
  | 'Cultural' | 'Personal' | 'Environmental' | 'Magic' | 'Exploratory';

export type EntityActionIcon =
  | 'Character' | 'Faction' | 'Site' | 'Artifact' | 'Event'
  | 'Region' | 'Inspect' | 'Bookmark' | 'Filter' | 'Settings';

const ICON_INDEX_MAP: Record<EventCategoryIcon | EntityActionIcon, number> = {
  Political: 0, Military: 1, Economic: 2, Social: 3, Religious: 4,
  Cultural: 5, Personal: 6, Environmental: 7, Magic: 8, Exploratory: 9,
  Character: 10, Faction: 11, Site: 12, Artifact: 13, Event: 14,
  Region: 15, Inspect: 16, Bookmark: 17, Filter: 18, Settings: 19,
};

export function getIconIndex(name: EventCategoryIcon | EntityActionIcon): number {
  return ICON_INDEX_MAP[name] ?? 0;
}

/**
 * Generate the icon atlas canvas.
 */
export function generateIconAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ICON_ATLAS_W;
  canvas.height = ICON_ATLAS_H;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, ICON_ATLAS_W, ICON_ATLAS_H);

  const drawInCell = (row: number, col: number, drawFn: (cx: number, cy: number) => void) => {
    const cx = col * ICON_CELL_W + ICON_CELL_W / 2;
    const cy = row * ICON_CELL_H + ICON_CELL_H / 2;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    drawFn(cx, cy);
    ctx.restore();
  };

  // Row 0: Event categories
  drawInCell(0, 0, (cx, cy) => {
    // Political: Crown
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 2);
    ctx.lineTo(cx - 3, cy - 3);
    ctx.lineTo(cx, cy + 1);
    ctx.lineTo(cx + 3, cy - 3);
    ctx.lineTo(cx + 5, cy + 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fillRect(cx - 5, cy + 2, 10, 2);
  });

  drawInCell(0, 1, (cx, cy) => {
    // Military: Crossed swords
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 5);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.moveTo(cx + 5, cy - 5);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.stroke();
  });

  drawInCell(0, 2, (cx, cy) => {
    // Economic: Coin
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy);
  });

  drawInCell(0, 3, (cx, cy) => {
    // Social: Two figures
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 2, 0, Math.PI * 2);
    ctx.arc(cx + 3, cy - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 5, cy, 4, 5);
    ctx.fillRect(cx + 1, cy, 4, 5);
  });

  drawInCell(0, 4, (cx, cy) => {
    // Religious: Star in circle
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 3, cy + Math.sin(angle) * 3);
      ctx.stroke();
    }
  });

  drawInCell(0, 5, (cx, cy) => {
    // Cultural: Scroll
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 4);
    ctx.quadraticCurveTo(cx - 4, cy - 5, cx - 3, cy - 4);
    ctx.lineTo(cx + 3, cy - 4);
    ctx.quadraticCurveTo(cx + 4, cy - 5, cx + 5, cy - 4);
    ctx.lineTo(cx + 5, cy + 4);
    ctx.quadraticCurveTo(cx + 4, cy + 5, cx + 3, cy + 4);
    ctx.lineTo(cx - 3, cy + 4);
    ctx.quadraticCurveTo(cx - 4, cy + 5, cx - 5, cy + 4);
    ctx.closePath();
    ctx.stroke();
  });

  drawInCell(0, 6, (cx, cy) => {
    // Personal: Person silhouette
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 3, cy, 6, 5);
  });

  drawInCell(0, 7, (cx, cy) => {
    // Environmental: Tree
    ctx.fillRect(cx - 1, cy + 1, 2, 4);
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  drawInCell(0, 8, (cx, cy) => {
    // Magic: Sparkle
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 5, cy + Math.sin(angle) * 5);
      ctx.stroke();
    }
  });

  drawInCell(0, 9, (cx, cy) => {
    // Exploratory: Compass
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.stroke();
  });

  // Row 1: Entity/Action
  drawInCell(1, 0, (cx, cy) => {
    // Character: @ symbol
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('@', cx, cy);
  });

  drawInCell(1, 1, (cx, cy) => {
    // Faction: Shield
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 4, cy - 3);
    ctx.lineTo(cx + 4, cy + 2);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx - 4, cy + 2);
    ctx.lineTo(cx - 4, cy - 3);
    ctx.closePath();
    ctx.stroke();
  });

  drawInCell(1, 2, (cx, cy) => {
    // Site: Building
    ctx.fillRect(cx - 5, cy - 2, 10, 7);
    ctx.fillStyle = '#000000';
    ctx.fillRect(cx - 3, cy, 2, 3);
    ctx.fillRect(cx + 1, cy, 2, 3);
  });

  drawInCell(1, 3, (cx, cy) => {
    // Artifact: Diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx - 4, cy);
    ctx.closePath();
    ctx.stroke();
  });

  drawInCell(1, 4, (cx, cy) => {
    // Event: Clock
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 3);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 2, cy + 1);
    ctx.stroke();
  });

  drawInCell(1, 5, (cx, cy) => {
    // Region: Mountain
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 5, cy + 4);
    ctx.lineTo(cx - 5, cy + 4);
    ctx.closePath();
    ctx.stroke();
  });

  drawInCell(1, 6, (cx, cy) => {
    // Inspect: Magnifying glass
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 1, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy + 2);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.stroke();
  });

  drawInCell(1, 7, (cx, cy) => {
    // Bookmark: Ribbon
    ctx.fillRect(cx - 2, cy - 5, 4, 10);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy + 5);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx + 2, cy + 5);
    ctx.fill();
  });

  drawInCell(1, 8, (cx, cy) => {
    // Filter: Funnel
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 4);
    ctx.lineTo(cx + 5, cy - 4);
    ctx.lineTo(cx + 2, cy);
    ctx.lineTo(cx + 2, cy + 4);
    ctx.lineTo(cx - 2, cy + 4);
    ctx.lineTo(cx - 2, cy);
    ctx.closePath();
    ctx.stroke();
  });

  drawInCell(1, 9, (cx, cy) => {
    // Settings: Gear
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      ctx.fillRect(
        cx + Math.cos(angle) * 2.5 - 0.5,
        cy + Math.sin(angle) * 2.5 - 0.5,
        1, 2
      );
    }
  });

  return canvas;
}

/** Cached icon atlas canvas */
let cachedIconAtlasCanvas: HTMLCanvasElement | null = null;

function getOrCreateIconAtlas(): HTMLCanvasElement {
  if (cachedIconAtlasCanvas === null) {
    cachedIconAtlasCanvas = generateIconAtlas();
  }
  return cachedIconAtlasCanvas;
}

/**
 * Get a data URL for a specific icon (for CSS background-image usage).
 */
export function getIconDataUrl(name: EventCategoryIcon | EntityActionIcon): string {
  const canvas = getOrCreateIconAtlas();
  const index = getIconIndex(name);
  const col = index % ICON_COLS;
  const row = Math.floor(index / ICON_COLS);

  // Extract the 16×16 cell to a new canvas
  const cellCanvas = document.createElement('canvas');
  cellCanvas.width = ICON_CELL_W;
  cellCanvas.height = ICON_CELL_H;
  const ctx = cellCanvas.getContext('2d')!;
  ctx.drawImage(
    canvas,
    col * ICON_CELL_W, row * ICON_CELL_H, ICON_CELL_W, ICON_CELL_H,
    0, 0, ICON_CELL_W, ICON_CELL_H
  );

  return cellCanvas.toDataURL();
}
