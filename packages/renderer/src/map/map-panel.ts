/**
 * Map panel for rendering the world map with terrain, entities, and overlays.
 */

import type * as blessed from 'blessed';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { BasePanel } from '../panel.js';
import { THEME } from '../theme.js';
import { Viewport } from './viewport.js';
import type { ZoomLevel } from './viewport.js';
import { renderEntityMarker, compositeEntityOnTile } from './tile-renderer.js';
import type { RenderableTile, MapEntity, RenderedTile } from './tile-renderer.js';
import { OverlayManager, OverlayType } from './overlay.js';
import type { OverlayModification } from './overlay.js';
import { TerrainStyler } from './terrain-styler.js';
import type { NeighborBiomes } from './terrain-styler.js';
import { Minimap, createMinimapBox, DEFAULT_MINIMAP_CONFIG } from './minimap.js';

/**
 * Map entity lookup function.
 */
export type EntityLookup = (x: number, y: number) => MapEntity | null;

/**
 * Tile lookup function.
 */
export type TileLookup = (x: number, y: number) => RenderableTile | null;

/**
 * Selection changed event handler.
 */
export type SelectionHandler = (entity: MapEntity | null, x: number, y: number) => void;

/**
 * Cursor position in world coordinates.
 */
export interface CursorPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Pan speed multiplier for keyboard navigation.
 */
const PAN_SPEED = 1;

/**
 * Pan speed at different zoom levels.
 */
const ZOOM_PAN_MULTIPLIER: Readonly<Record<ZoomLevel, number>> = {
  1: 1,
  2: 2,
  4: 4,
  8: 8,
  16: 16,
};

/**
 * Map panel extends BasePanel to render the world map.
 */
export class MapPanel extends BasePanel {
  private viewport: Viewport;
  private overlayManager: OverlayManager;
  private minimap: Minimap;
  private minimapBox: blessed.Widgets.BoxElement | null = null;

  // Data lookup functions
  private tileLookup: TileLookup | null = null;
  private entityLookup: EntityLookup | null = null;

  // World dimensions
  private worldWidth = 0;
  private worldHeight = 0;

  // Cursor state
  private cursorPosition: CursorPosition = { x: 0, y: 0 };
  private cursorVisible = true;
  private cursorBlink = false;
  private cursorBlinkTimer: ReturnType<typeof setInterval> | null = null;

  // Selection handler
  private onSelectionChanged: SelectionHandler | null = null;

  // Advanced terrain styler
  private terrainStyler: TerrainStyler = new TerrainStyler();

  // Render cache
  private renderCache: Map<string, RenderedTile> = new Map();
  private cacheValid = false;
  private lastViewportX = 0;
  private lastViewportY = 0;
  private lastViewportZoom: ZoomLevel = 1;

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);

    // Map panel content is always sized to fit exactly — disable scrolling
    // to prevent blessed's scroll manager from clipping the rendered map
    const box = this.getBox() as unknown as Record<string, unknown>;
    box['scrollable'] = false;
    box['alwaysScroll'] = false;

    // Initialize viewport centered on panel
    const innerDims = this.getInnerDimensions();
    this.viewport = new Viewport(innerDims.width, innerDims.height, 0, 0, 1);

    // Initialize overlay manager
    this.overlayManager = new OverlayManager();

    // Initialize minimap
    this.minimap = new Minimap(DEFAULT_MINIMAP_CONFIG);

    // Set panel title
    this.setTitle('World Map');

    // Start cursor blink
    this.startCursorBlink();
  }

  /**
   * Set the world dimensions.
   */
  setWorldSize(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
    this.minimap.setWorldSize(width, height);

    // Center viewport on world
    this.viewport.setCenter(Math.floor(width / 2), Math.floor(height / 2));
    this.viewport.clampToWorld(width, height);

    // Initialize cursor at center
    this.cursorPosition = {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
    };

    this.invalidateCache();
  }

  /**
   * Set the tile lookup function.
   */
  setTileLookup(lookup: TileLookup): void {
    this.tileLookup = lookup;
    this.minimap.setTileLookup(lookup);
    this.invalidateCache();
  }

  /**
   * Set the entity lookup function.
   */
  setEntityLookup(lookup: EntityLookup): void {
    this.entityLookup = lookup;
    this.invalidateCache();
  }

  /**
   * Set the selection changed handler.
   */
  setSelectionHandler(handler: SelectionHandler): void {
    this.onSelectionChanged = handler;
  }

  /**
   * Set the world seed for terrain styling noise.
   */
  setWorldSeed(seed: number): void {
    this.terrainStyler = new TerrainStyler(seed);
    this.invalidateCache();
  }

  /**
   * Get the viewport.
   */
  getViewport(): Viewport {
    return this.viewport;
  }

  /**
   * Get the overlay manager.
   */
  getOverlayManager(): OverlayManager {
    return this.overlayManager;
  }

  /**
   * Get the minimap.
   */
  getMinimap(): Minimap {
    return this.minimap;
  }

  /**
   * Get the cursor position.
   */
  getCursorPosition(): CursorPosition {
    return this.cursorPosition;
  }

  /**
   * Set the cursor position.
   */
  setCursorPosition(x: number, y: number): void {
    this.cursorPosition = {
      x: Math.max(0, Math.min(this.worldWidth - 1, x)),
      y: Math.max(0, Math.min(this.worldHeight - 1, y)),
    };

    // Notify selection handler
    this.notifySelectionChanged();
  }

  /**
   * Render the map panel.
   */
  render(context: RenderContext): void {
    // Check if cache is valid
    this.checkCacheValidity();

    const innerDims = this.getInnerDimensions();

    // Sync viewport with actual panel dimensions (blessed box may have
    // been resized since the last explicit resize() call)
    if (innerDims.width !== this.viewport.screenWidth || innerDims.height !== this.viewport.screenHeight) {
      this.viewport.setScreenSize(innerDims.width, innerDims.height);
      this.viewport.clampToWorld(this.worldWidth, this.worldHeight);
      this.invalidateCache();
    }

    // Build content string
    let content = '';

    for (let sy = 0; sy < innerDims.height; sy++) {
      for (let sx = 0; sx < innerDims.width; sx++) {
        const worldPos = this.viewport.screenToWorld(sx, sy);
        const cell = this.renderCell(worldPos.x, worldPos.y, context);

        // Check if this is the cursor position
        const isCursor =
          this.cursorVisible &&
          worldPos.x === this.cursorPosition.x &&
          worldPos.y === this.cursorPosition.y;

        if (isCursor && this.cursorBlink) {
          // Render cursor as inverse colors
          content += `{${cell.bg}-fg}{${THEME.ui.cursor}-bg}${cell.char}{/}`;
        } else if (isCursor) {
          // Cursor visible but not blinking
          content += `{${THEME.ui.cursor}-fg}{${cell.bg}-bg}X{/}`;
        } else {
          content += `{${cell.fg}-fg}{${cell.bg}-bg}${cell.char}{/}`;
        }
      }

      if (sy < innerDims.height - 1) {
        content += '\n';
      }
    }

    this.setContent(content);

    // Render minimap if visible
    if (this.minimapBox !== null) {
      this.minimap.renderToBox(this.minimapBox, this.viewport, context);
    }
  }

  /**
   * Handle mouse click — move cursor to clicked world position.
   */
  handleClick(x: number, y: number): boolean {
    const worldPos = this.viewport.screenToWorld(x, y);
    this.setCursorPosition(worldPos.x, worldPos.y);
    this.invalidateCache();
    return true;
  }

  /**
   * Handle keyboard input.
   */
  handleInput(key: string): boolean {
    const panAmount = PAN_SPEED * ZOOM_PAN_MULTIPLIER[this.viewport.zoom];

    switch (key) {
      // Panning
      case 'up':
      case 'w':
        this.pan(0, -panAmount);
        return true;

      case 'down':
      case 's':
        this.pan(0, panAmount);
        return true;

      case 'left':
      case 'a':
        this.pan(-panAmount, 0);
        return true;

      case 'right':
      case 'd':
        this.pan(panAmount, 0);
        return true;

      // Zooming
      case 'z':
        this.zoomIn();
        return true;

      case 'x':
        this.zoomOut();
        return true;

      // Overlay cycling
      case 'o':
        this.cycleOverlay();
        return true;

      // Minimap toggle
      case 'm':
        this.minimap.toggle();
        return true;

      // Mouse wheel zoom
      case 'wheelup':
        this.zoomIn();
        return true;

      case 'wheeldown':
        this.zoomOut();
        return true;

      // Selection
      case 'enter':
        this.selectAtCursor();
        return true;

      default:
        return false;
    }
  }

  /**
   * Pan the viewport and cursor.
   */
  private pan(dx: number, dy: number): void {
    // Move cursor
    this.setCursorPosition(
      this.cursorPosition.x + dx,
      this.cursorPosition.y + dy
    );

    // Pan viewport to follow cursor if it goes off-screen
    const screenPos = this.viewport.worldToScreen(
      this.cursorPosition.x,
      this.cursorPosition.y
    );

    if (screenPos === null) {
      // Cursor is off-screen, center viewport on cursor
      this.viewport.setCenter(this.cursorPosition.x, this.cursorPosition.y);
      this.viewport.clampToWorld(this.worldWidth, this.worldHeight);
    }

    this.invalidateCache();
  }

  /**
   * Zoom in.
   */
  private zoomIn(): void {
    if (this.viewport.zoomIn()) {
      this.viewport.clampToWorld(this.worldWidth, this.worldHeight);
      this.invalidateCache();
    }
  }

  /**
   * Zoom out.
   */
  private zoomOut(): void {
    if (this.viewport.zoomOut()) {
      this.viewport.clampToWorld(this.worldWidth, this.worldHeight);
      this.invalidateCache();
    }
  }

  /**
   * Cycle through overlays.
   */
  private cycleOverlay(): void {
    this.overlayManager.cycleOverlay();
    this.invalidateCache();
  }

  /**
   * Select the entity at the cursor position.
   */
  private selectAtCursor(): void {
    this.notifySelectionChanged();
  }

  /**
   * Notify the selection handler of the current cursor selection.
   */
  private notifySelectionChanged(): void {
    if (this.onSelectionChanged === null) return;

    const entity = this.entityLookup?.(
      this.cursorPosition.x,
      this.cursorPosition.y
    ) ?? null;

    this.onSelectionChanged(entity, this.cursorPosition.x, this.cursorPosition.y);
  }

  /**
   * Get neighbor biome info for border dithering.
   */
  private getNeighborBiomes(wx: number, wy: number): NeighborBiomes {
    const n = this.tileLookup?.(wx, wy - 1);
    const s = this.tileLookup?.(wx, wy + 1);
    const e = this.tileLookup?.(wx + 1, wy);
    const w = this.tileLookup?.(wx - 1, wy);
    return {
      ...(n != null ? { north: n.biome } : {}),
      ...(s != null ? { south: s.biome } : {}),
      ...(e != null ? { east: e.biome } : {}),
      ...(w != null ? { west: w.biome } : {}),
    };
  }

  /**
   * Render a single cell at world coordinates.
   */
  private renderCell(wx: number, wy: number, context: RenderContext): RenderedTile {
    // Check cache first
    const cacheKey = `${wx},${wy}`;
    const cached = this.renderCache.get(cacheKey);
    if (cached !== undefined && this.cacheValid) {
      return cached;
    }

    // Get base terrain
    let cell: RenderedTile;

    if (this.viewport.zoom === 1) {
      // Full detail - single tile with advanced styling
      const tile = this.tileLookup?.(wx, wy);
      if (tile !== null && tile !== undefined) {
        const neighbors = this.getNeighborBiomes(wx, wy);
        cell = this.terrainStyler.styleTile(tile, wx, wy, neighbors);
      } else {
        cell = { char: ' ', fg: '#0a0a1a', bg: '#0a0a1a' };
      }
    } else {
      // Zoomed out - average multiple tiles with advanced styling
      const tiles = this.getTilesInRegion(wx, wy, this.viewport.zoom);
      cell = tiles.length > 0
        ? this.terrainStyler.styleAveragedRegion(tiles, wx, wy)
        : { char: ' ', fg: '#0a0a1a', bg: '#0a0a1a' };
    }

    // Apply entity marker if present
    const entity = this.entityLookup?.(wx, wy);
    if (entity !== null && entity !== undefined) {
      const marker = renderEntityMarker(entity.type, entity.factionColor);
      cell = compositeEntityOnTile(cell, marker);
    }

    // Apply overlay modification
    const overlayMod = this.overlayManager.renderAt(wx, wy, context);
    if (overlayMod !== null) {
      cell = this.applyOverlay(cell, overlayMod);
    }

    // Cache the result
    this.renderCache.set(cacheKey, cell);

    return cell;
  }

  /**
   * Get tiles in a region for zoomed-out rendering.
   */
  private getTilesInRegion(wx: number, wy: number, size: number): RenderableTile[] {
    if (this.tileLookup === null) return [];

    const tiles: RenderableTile[] = [];
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const tile = this.tileLookup(wx + dx, wy + dy);
        if (tile !== null) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  /**
   * Apply an overlay modification to a rendered tile.
   */
  private applyOverlay(tile: RenderedTile, mod: OverlayModification): RenderedTile {
    return {
      char: mod.char ?? tile.char,
      fg: mod.fg ?? tile.fg,
      bg: mod.bg ?? tile.bg,
    };
  }

  /**
   * Check if the render cache is still valid.
   */
  private checkCacheValidity(): void {
    if (
      this.viewport.x !== this.lastViewportX ||
      this.viewport.y !== this.lastViewportY ||
      this.viewport.zoom !== this.lastViewportZoom
    ) {
      this.invalidateCache();
      this.lastViewportX = this.viewport.x;
      this.lastViewportY = this.viewport.y;
      this.lastViewportZoom = this.viewport.zoom;
    }
  }

  /**
   * Invalidate the render cache.
   */
  private invalidateCache(): void {
    this.cacheValid = false;
    this.renderCache.clear();
  }

  /**
   * Start the cursor blink timer.
   */
  private startCursorBlink(): void {
    this.cursorBlinkTimer = setInterval(() => {
      this.cursorBlink = !this.cursorBlink;
    }, 500);
  }

  /**
   * Stop the cursor blink timer.
   */
  private stopCursorBlink(): void {
    if (this.cursorBlinkTimer !== null) {
      clearInterval(this.cursorBlinkTimer);
      this.cursorBlinkTimer = null;
    }
  }

  /**
   * Create the minimap box element.
   */
  createMinimapBox(
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ): void {
    const innerDims = this.getInnerDimensions();
    this.minimapBox = createMinimapBox(
      boxFactory,
      DEFAULT_MINIMAP_CONFIG,
      innerDims.width,
      innerDims.height
    );
    this.screen.append(this.minimapBox);
  }

  /**
   * Handle resize.
   */
  resize(width: number, height: number): void {
    super.resize(width, height);

    const innerDims = this.getInnerDimensions();
    this.viewport.setScreenSize(innerDims.width, innerDims.height);
    this.viewport.clampToWorld(this.worldWidth, this.worldHeight);

    this.invalidateCache();
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.stopCursorBlink();

    if (this.minimapBox !== null) {
      this.minimapBox.destroy();
      this.minimapBox = null;
    }

    super.destroy();
  }

  /**
   * Center the viewport on a world position.
   */
  centerOn(x: number, y: number): void {
    this.viewport.setCenter(x, y);
    this.viewport.clampToWorld(this.worldWidth, this.worldHeight);
    this.setCursorPosition(x, y);
    this.invalidateCache();
  }

  /**
   * Get the entity at a world position.
   */
  getEntityAt(x: number, y: number): MapEntity | null {
    return this.entityLookup?.(x, y) ?? null;
  }

  /**
   * Get the tile at a world position.
   */
  getTileAt(x: number, y: number): RenderableTile | null {
    return this.tileLookup?.(x, y) ?? null;
  }

  /**
   * Set the active overlay type.
   */
  setOverlay(type: OverlayType): void {
    this.overlayManager.setActiveOverlay(type);
    this.invalidateCache();
  }

  /**
   * Get the active overlay type.
   */
  getActiveOverlay(): OverlayType {
    return this.overlayManager.getActiveOverlayType();
  }
}

/**
 * Create a default layout for the map panel.
 */
export function createMapPanelLayout(
  x: number,
  y: number,
  width: number,
  height: number
): PanelLayout {
  return {
    id: PanelId.Map,
    x,
    y,
    width,
    height,
    focused: true,
  };
}
