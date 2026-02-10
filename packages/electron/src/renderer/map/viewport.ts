/**
 * Viewport — manages pan/zoom state and screen↔world coordinate transforms.
 *
 * Screen coordinates are in pixels. World coordinates are in tiles.
 * Zoom levels: 1 (closest, 1 tile = 1 screen cell), 2 (2×2 composite), 4 (4×4 world view).
 */
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

  /** Number of screen-tile columns visible (based on pixel width) */
  get viewCols(): number {
    return Math.ceil(this._screenW / TILE_W) + 2;
  }

  /** Number of screen-tile rows visible (based on pixel height) */
  get viewRows(): number {
    return Math.ceil(this._screenH / TILE_H) + 2;
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
   */
  screenToWorld(px: number, py: number): { wx: number; wy: number } {
    const tl = this.getTopLeft();
    const { ox, oy } = this.getPixelOffset();
    // Subtract pixel offset so the fractional shift is accounted for
    const col = Math.floor((px - ox) / TILE_W);
    const row = Math.floor((py - oy) / TILE_H);
    return {
      wx: Math.floor(tl.wx + col * this._zoom),
      wy: Math.floor(tl.wy + row * this._zoom),
    };
  }

  /**
   * Convert world tile coords to screen pixel position (top-left corner).
   * Returns null if the tile is off-screen.
   */
  worldToScreen(wx: number, wy: number): { px: number; py: number } | null {
    const tl = this.getTopLeft();
    const col = (wx - tl.wx) / this._zoom;
    const row = (wy - tl.wy) / this._zoom;

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

  /**
   * Sub-pixel offset for smooth scrolling.
   * Returns the fractional pixel shift to apply to the tile container
   * so tiles don't snap to whole-tile boundaries.
   */
  getPixelOffset(): { ox: number; oy: number } {
    const halfW = (this.viewCols * this._zoom) / 2;
    const halfH = (this.viewRows * this._zoom) / 2;
    const rawX = this._centerX - halfW;
    const rawY = this._centerY - halfH;
    const fracX = rawX - Math.floor(rawX);
    const fracY = rawY - Math.floor(rawY);
    return {
      ox: -(fracX / this._zoom) * TILE_W,
      oy: -(fracY / this._zoom) * TILE_H,
    };
  }

  private clamp(): void {
    const halfW = (this.viewCols * this._zoom) / 2;
    const halfH = (this.viewRows * this._zoom) / 2;

    if (this._worldW > 0) {
      this._centerX = Math.max(halfW, Math.min(this._worldW - halfW, this._centerX));
    }
    if (this._worldH > 0) {
      this._centerY = Math.max(halfH, Math.min(this._worldH - halfH, this._centerY));
    }
  }
}
