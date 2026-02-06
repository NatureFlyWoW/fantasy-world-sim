/**
 * Minimap widget showing the entire world at maximum zoom-out.
 * Displays current viewport position as a highlighted rectangle.
 */

import type * as blessed from 'blessed';
import type { RenderContext } from '../types.js';
import type { Viewport } from './viewport.js';
import type { RenderableTile } from './tile-renderer.js';
import { renderAveragedRegion } from './tile-renderer.js';
import { THEME } from '../theme.js';

/**
 * Default minimap dimensions.
 */
export const MINIMAP_WIDTH = 20;
export const MINIMAP_HEIGHT = 10;

/**
 * Minimap configuration.
 */
export interface MinimapConfig {
  readonly width: number;
  readonly height: number;
  readonly position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Default minimap configuration.
 */
export const DEFAULT_MINIMAP_CONFIG: MinimapConfig = {
  width: MINIMAP_WIDTH,
  height: MINIMAP_HEIGHT,
  position: 'top-right',
};

/**
 * Tile data lookup function for minimap rendering.
 */
export type MinimapTileLookup = (x: number, y: number) => RenderableTile | null;

/**
 * Minimap rendering result for a single character position.
 */
export interface MinimapCell {
  readonly char: string;
  readonly fg: string;
  readonly bg: string;
}

/**
 * Minimap class for rendering world overview and viewport indicator.
 */
export class Minimap {
  private config: MinimapConfig;
  private visible = true;
  private worldWidth = 0;
  private worldHeight = 0;
  private tileLookup: MinimapTileLookup | null = null;

  // Cached minimap content
  private cache: MinimapCell[][] = [];
  private cacheValid = false;

  constructor(config: Partial<MinimapConfig> = {}) {
    this.config = { ...DEFAULT_MINIMAP_CONFIG, ...config };
  }

  /**
   * Set the world dimensions.
   */
  setWorldSize(width: number, height: number): void {
    if (this.worldWidth !== width || this.worldHeight !== height) {
      this.worldWidth = width;
      this.worldHeight = height;
      this.cacheValid = false;
    }
  }

  /**
   * Set the tile lookup function for terrain data.
   */
  setTileLookup(lookup: MinimapTileLookup): void {
    this.tileLookup = lookup;
    this.cacheValid = false;
  }

  /**
   * Toggle minimap visibility.
   */
  toggle(): void {
    this.visible = !this.visible;
  }

  /**
   * Set minimap visibility.
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  /**
   * Check if minimap is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Invalidate the cache (call when world terrain changes).
   */
  invalidateCache(): void {
    this.cacheValid = false;
  }

  /**
   * Get the minimap configuration.
   */
  getConfig(): MinimapConfig {
    return this.config;
  }

  /**
   * Calculate the scale factor from world to minimap.
   */
  getScale(): { x: number; y: number } {
    const innerWidth = this.config.width - 2; // Account for border
    const innerHeight = this.config.height - 2;

    return {
      x: this.worldWidth / innerWidth,
      y: this.worldHeight / innerHeight,
    };
  }

  /**
   * Convert minimap position to world position.
   */
  minimapToWorld(mx: number, my: number): { x: number; y: number } {
    const scale = this.getScale();
    return {
      x: Math.floor(mx * scale.x),
      y: Math.floor(my * scale.y),
    };
  }

  /**
   * Convert world position to minimap position.
   */
  worldToMinimap(wx: number, wy: number): { x: number; y: number } {
    const scale = this.getScale();
    const innerWidth = this.config.width - 2;
    const innerHeight = this.config.height - 2;

    return {
      x: Math.min(innerWidth - 1, Math.max(0, Math.floor(wx / scale.x))),
      y: Math.min(innerHeight - 1, Math.max(0, Math.floor(wy / scale.y))),
    };
  }

  /**
   * Render the minimap content (without viewport indicator).
   */
  renderContent(): MinimapCell[][] {
    if (this.cacheValid) {
      return this.cache;
    }

    const innerWidth = this.config.width - 2;
    const innerHeight = this.config.height - 2;
    const scale = this.getScale();

    const content: MinimapCell[][] = [];

    for (let my = 0; my < innerHeight; my++) {
      const row: MinimapCell[] = [];

      for (let mx = 0; mx < innerWidth; mx++) {
        const cell = this.renderCell(mx, my, scale);
        row.push(cell);
      }

      content.push(row);
    }

    this.cache = content;
    this.cacheValid = true;

    return content;
  }

  /**
   * Render a single minimap cell by averaging world tiles.
   */
  private renderCell(mx: number, my: number, scale: { x: number; y: number }): MinimapCell {
    if (this.tileLookup === null) {
      return { char: ' ', fg: '#000000', bg: '#000000' };
    }

    // Calculate world tile range for this minimap cell
    const worldX = Math.floor(mx * scale.x);
    const worldY = Math.floor(my * scale.y);
    const worldEndX = Math.min(this.worldWidth, Math.floor((mx + 1) * scale.x));
    const worldEndY = Math.min(this.worldHeight, Math.floor((my + 1) * scale.y));

    // Collect tiles in this region
    const tiles: RenderableTile[] = [];
    for (let wy = worldY; wy < worldEndY; wy++) {
      for (let wx = worldX; wx < worldEndX; wx++) {
        const tile = this.tileLookup(wx, wy);
        if (tile !== null) {
          tiles.push(tile);
        }
      }
    }

    if (tiles.length === 0) {
      return { char: ' ', fg: '#000000', bg: '#000000' };
    }

    // Use averaged region renderer
    const rendered = renderAveragedRegion(tiles);
    return { char: rendered.char, fg: rendered.fg, bg: rendered.bg };
  }

  /**
   * Get the viewport indicator rectangle in minimap coordinates.
   */
  getViewportRect(viewport: Viewport): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const bounds = viewport.getVisibleBounds();
    const topLeft = this.worldToMinimap(bounds.minX, bounds.minY);
    const bottomRight = this.worldToMinimap(bounds.maxX, bounds.maxY);

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: Math.max(1, bottomRight.x - topLeft.x + 1),
      height: Math.max(1, bottomRight.y - topLeft.y + 1),
    };
  }

  /**
   * Check if a minimap position is within the viewport indicator.
   */
  isInViewport(mx: number, my: number, viewport: Viewport): boolean {
    const rect = this.getViewportRect(viewport);
    return (
      mx >= rect.x &&
      mx < rect.x + rect.width &&
      my >= rect.y &&
      my < rect.y + rect.height
    );
  }

  /**
   * Render the minimap to a blessed box.
   * This renders both content and viewport indicator.
   */
  renderToBox(
    box: blessed.Widgets.BoxElement,
    viewport: Viewport,
    _context: RenderContext
  ): void {
    if (!this.visible) {
      box.hide();
      return;
    }

    box.show();
    const content = this.renderContent();
    const viewportRect = this.getViewportRect(viewport);

    // Build the content string with blessed tags for colors
    let output = '';

    for (let my = 0; my < content.length; my++) {
      const row = content[my];
      if (row === undefined) continue;

      for (let mx = 0; mx < row.length; mx++) {
        const cell = row[mx];
        if (cell === undefined) continue;

        // Check if this cell is on the viewport border
        const isViewportBorder = this.isViewportBorder(mx, my, viewportRect);

        if (isViewportBorder) {
          // Highlight viewport border
          output += `{${THEME.ui.borderFocused}-fg}{${cell.bg}-bg}${cell.char}{/}`;
        } else {
          output += `{${cell.fg}-fg}{${cell.bg}-bg}${cell.char}{/}`;
        }
      }

      if (my < content.length - 1) {
        output += '\n';
      }
    }

    box.setContent(output);
  }

  /**
   * Check if a position is on the viewport border.
   */
  private isViewportBorder(
    mx: number,
    my: number,
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    const inX = mx >= rect.x && mx < rect.x + rect.width;
    const inY = my >= rect.y && my < rect.y + rect.height;

    if (!inX || !inY) return false;

    // Check if on border
    const isLeftEdge = mx === rect.x;
    const isRightEdge = mx === rect.x + rect.width - 1;
    const isTopEdge = my === rect.y;
    const isBottomEdge = my === rect.y + rect.height - 1;

    return isLeftEdge || isRightEdge || isTopEdge || isBottomEdge;
  }

  /**
   * Get position for placing the minimap box.
   */
  getPosition(
    parentWidth: number,
    parentHeight: number
  ): { top: number; left: number } {
    const margin = 1;

    switch (this.config.position) {
      case 'top-left':
        return { top: margin, left: margin };
      case 'top-right':
        return { top: margin, left: parentWidth - this.config.width - margin };
      case 'bottom-left':
        return { top: parentHeight - this.config.height - margin, left: margin };
      case 'bottom-right':
        return {
          top: parentHeight - this.config.height - margin,
          left: parentWidth - this.config.width - margin,
        };
    }
  }
}

/**
 * Create a blessed box configured for the minimap.
 */
export function createMinimapBox(
  boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement,
  config: MinimapConfig,
  parentWidth: number,
  parentHeight: number
): blessed.Widgets.BoxElement {
  const minimap = new Minimap(config);
  const position = minimap.getPosition(parentWidth, parentHeight);

  return boxFactory({
    top: position.top,
    left: position.left,
    width: config.width,
    height: config.height,
    border: { type: 'line' },
    style: {
      border: { fg: THEME.ui.borderBlurred },
      bg: THEME.ui.background,
    },
    label: ' Map ',
    tags: true,
  });
}
