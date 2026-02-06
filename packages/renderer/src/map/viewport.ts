/**
 * Viewport manages the view into the world map.
 * Handles panning, zooming, and coordinate transformations.
 */

/**
 * Valid zoom levels.
 * 1 = full detail (1 tile = 1 char)
 * 2 = region view (2×2 tiles = 1 char)
 * 4 = kingdom view (4×4 tiles = 1 char)
 * 8 = continent view (8×8 tiles = 1 char)
 * 16 = world overview (16×16 tiles = 1 char)
 */
export type ZoomLevel = 1 | 2 | 4 | 8 | 16;

/**
 * Ordered list of valid zoom levels for cycling.
 */
export const ZOOM_LEVELS: readonly ZoomLevel[] = [1, 2, 4, 8, 16];

/**
 * World coordinate position.
 */
export interface WorldPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Screen coordinate position.
 */
export interface ScreenPosition {
  readonly sx: number;
  readonly sy: number;
}

/**
 * Rectangular bounds in world coordinates.
 */
export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Viewport class manages the view into the world map.
 */
export class Viewport {
  /** Center position in world coordinates */
  private _x: number;
  private _y: number;

  /** Current zoom level (tiles per screen character) */
  private _zoom: ZoomLevel;

  /** Screen dimensions in characters */
  private _screenWidth: number;
  private _screenHeight: number;

  constructor(
    screenWidth: number,
    screenHeight: number,
    initialX = 0,
    initialY = 0,
    initialZoom: ZoomLevel = 1
  ) {
    this._screenWidth = screenWidth;
    this._screenHeight = screenHeight;
    this._x = initialX;
    this._y = initialY;
    this._zoom = initialZoom;
  }

  /** Get center X coordinate in world space */
  get x(): number {
    return this._x;
  }

  /** Get center Y coordinate in world space */
  get y(): number {
    return this._y;
  }

  /** Get current zoom level */
  get zoom(): ZoomLevel {
    return this._zoom;
  }

  /** Get screen width in characters */
  get screenWidth(): number {
    return this._screenWidth;
  }

  /** Get screen height in characters */
  get screenHeight(): number {
    return this._screenHeight;
  }

  /**
   * Pan the viewport by a delta in world coordinates.
   */
  pan(dx: number, dy: number): void {
    this._x += dx;
    this._y += dy;
  }

  /**
   * Zoom in one level (fewer tiles per character, more detail).
   * @returns true if zoom changed, false if already at minimum
   */
  zoomIn(): boolean {
    const currentIndex = ZOOM_LEVELS.indexOf(this._zoom);
    if (currentIndex > 0) {
      const newZoom = ZOOM_LEVELS[currentIndex - 1];
      if (newZoom !== undefined) {
        this._zoom = newZoom;
        return true;
      }
    }
    return false;
  }

  /**
   * Zoom out one level (more tiles per character, less detail).
   * @returns true if zoom changed, false if already at maximum
   */
  zoomOut(): boolean {
    const currentIndex = ZOOM_LEVELS.indexOf(this._zoom);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      const newZoom = ZOOM_LEVELS[currentIndex + 1];
      if (newZoom !== undefined) {
        this._zoom = newZoom;
        return true;
      }
    }
    return false;
  }

  /**
   * Set the zoom level directly.
   */
  setZoom(zoom: ZoomLevel): void {
    this._zoom = zoom;
  }

  /**
   * Set the center position of the viewport in world coordinates.
   */
  setCenter(x: number, y: number): void {
    this._x = x;
    this._y = y;
  }

  /**
   * Update the screen dimensions.
   */
  setScreenSize(width: number, height: number): void {
    this._screenWidth = width;
    this._screenHeight = height;
  }

  /**
   * Convert screen coordinates to world coordinates.
   * Screen coordinates are relative to the viewport (0,0 is top-left).
   */
  screenToWorld(sx: number, sy: number): WorldPosition {
    // Calculate the top-left world coordinate of the visible area
    const halfWidth = Math.floor(this._screenWidth / 2);
    const halfHeight = Math.floor(this._screenHeight / 2);

    const topLeftX = this._x - halfWidth * this._zoom;
    const topLeftY = this._y - halfHeight * this._zoom;

    // Convert screen position to world position
    return {
      x: topLeftX + sx * this._zoom,
      y: topLeftY + sy * this._zoom,
    };
  }

  /**
   * Convert world coordinates to screen coordinates.
   * @returns Screen position, or null if the world coordinate is off-screen.
   */
  worldToScreen(wx: number, wy: number): ScreenPosition | null {
    const bounds = this.getVisibleBounds();

    // Check if the world coordinate is within visible bounds
    if (wx < bounds.minX || wx > bounds.maxX || wy < bounds.minY || wy > bounds.maxY) {
      return null;
    }

    // Calculate screen position
    const halfWidth = Math.floor(this._screenWidth / 2);
    const halfHeight = Math.floor(this._screenHeight / 2);

    const topLeftX = this._x - halfWidth * this._zoom;
    const topLeftY = this._y - halfHeight * this._zoom;

    return {
      sx: Math.floor((wx - topLeftX) / this._zoom),
      sy: Math.floor((wy - topLeftY) / this._zoom),
    };
  }

  /**
   * Get the visible bounds in world coordinates.
   */
  getVisibleBounds(): WorldBounds {
    const halfWidth = Math.floor(this._screenWidth / 2);
    const halfHeight = Math.floor(this._screenHeight / 2);

    const minX = this._x - halfWidth * this._zoom;
    const minY = this._y - halfHeight * this._zoom;
    const maxX = this._x + halfWidth * this._zoom + (this._screenWidth % 2 === 0 ? 0 : this._zoom);
    const maxY = this._y + halfHeight * this._zoom + (this._screenHeight % 2 === 0 ? 0 : this._zoom);

    return { minX, minY, maxX, maxY };
  }

  /**
   * Check if a world coordinate is currently visible.
   */
  isVisible(wx: number, wy: number): boolean {
    const bounds = this.getVisibleBounds();
    return wx >= bounds.minX && wx < bounds.maxX && wy >= bounds.minY && wy < bounds.maxY;
  }

  /**
   * Clamp the viewport center to keep it within world bounds.
   * Ensures the viewport doesn't show areas outside the world.
   */
  clampToWorld(worldWidth: number, worldHeight: number): void {
    const halfWidth = Math.floor(this._screenWidth / 2) * this._zoom;
    const halfHeight = Math.floor(this._screenHeight / 2) * this._zoom;

    // Clamp center so visible area stays within world
    const minCenterX = halfWidth;
    const maxCenterX = worldWidth - halfWidth;
    const minCenterY = halfHeight;
    const maxCenterY = worldHeight - halfHeight;

    // Handle case where world is smaller than viewport
    if (maxCenterX < minCenterX) {
      this._x = Math.floor(worldWidth / 2);
    } else {
      this._x = Math.max(minCenterX, Math.min(maxCenterX, this._x));
    }

    if (maxCenterY < minCenterY) {
      this._y = Math.floor(worldHeight / 2);
    } else {
      this._y = Math.max(minCenterY, Math.min(maxCenterY, this._y));
    }
  }

  /**
   * Get the number of world tiles visible horizontally.
   */
  getVisibleTilesWidth(): number {
    return this._screenWidth * this._zoom;
  }

  /**
   * Get the number of world tiles visible vertically.
   */
  getVisibleTilesHeight(): number {
    return this._screenHeight * this._zoom;
  }

  /**
   * Center the viewport on a specific world position.
   */
  centerOn(x: number, y: number): void {
    this._x = x;
    this._y = y;
  }

  /**
   * Get the world position at the center of the viewport.
   */
  getCenter(): WorldPosition {
    return { x: this._x, y: this._y };
  }
}
