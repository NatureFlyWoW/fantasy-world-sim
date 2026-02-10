/**
 * TilemapRenderer — sprite pool-based terrain rendering for the PixiJS map.
 *
 * Maintains a grid of background Graphics + glyph Sprites sized to fill the
 * viewport. On each frame, updates textures and tints based on the world tile
 * data and current viewport position/zoom.
 */
import { Container, Sprite, Graphics } from 'pixi.js';
import { TILE_W, TILE_H, glyphIndex, getGlyphTexture, initGlyphAtlas } from './glyph-atlas.js';
import { Viewport } from './viewport.js';
import { BIOME_CONFIGS, ENTITY_MARKERS, selectGlyph } from './biome-config.js';
import { OverlayType } from './overlay-manager.js';
import type { OverlayManager, OverlayModification } from './overlay-manager.js';
import type {
  WorldSnapshot, TileSnapshot, EntitySnapshot, TickDelta, SerializedEvent,
} from '../../shared/types.js';

/** Deterministic hash for glyph selection per world tile */
function tileNoise(wx: number, wy: number, seed: number): number {
  let h = (seed * 374761393 + wx * 668265263 + wy * 2147483647) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

/** Convert hex color string (#RRGGBB) to numeric tint for PixiJS */
function hexToNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/** Weighted RGB average of biome background colors */
function blendBiomeColors(biomeCounts: Map<string, number>, total: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [biome, count] of biomeCounts) {
    const config = BIOME_CONFIGS[biome];
    if (config === undefined) continue;
    const weight = count / total;
    const hex = config.bg;
    r += parseInt(hex.slice(1, 3), 16) * weight;
    g += parseInt(hex.slice(3, 5), 16) * weight;
    b += parseInt(hex.slice(5, 7), 16) * weight;
  }
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

interface TileSprite {
  bg: Graphics;
  glyph: Sprite;
}

export class TilemapRenderer {
  private readonly container = new Container();
  private readonly bgLayer = new Container();
  private readonly glyphLayer = new Container();
  private readonly routeLayer = new Container();
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

  // Overlay
  private overlayManager: OverlayManager | null = null;

  // Event accumulation per tile
  private tileEvents = new Map<string, SerializedEvent[]>();

  // Dirty tracking
  private dirty = true;
  private lastCenterX = -1;
  private lastCenterY = -1;
  private lastZoom = -1;

  constructor() {
    this.container.addChild(this.bgLayer);
    this.container.addChild(this.glyphLayer);
    this.container.addChild(this.routeLayer);
    this.container.addChild(this.markerLayer);
  }

  /** The PixiJS container to add to stage */
  getContainer(): Container {
    return this.container;
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  setOverlayManager(manager: OverlayManager): void {
    this.overlayManager = manager;
  }

  markDirty(): void {
    this.dirty = true;
  }

  getEntities(): EntitySnapshot[] {
    return this.entities;
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

  /** Handle tick delta updates */
  handleTickDelta(delta: TickDelta): void {
    // Merge entity updates into local entity list
    if (delta.entityUpdates.length > 0) {
      const entityMap = new Map(this.entities.map(e => [e.id, e]));
      for (const update of delta.entityUpdates) {
        entityMap.set(update.id, update);
      }
      // Remove deleted entities
      for (const removedId of delta.removedEntities) {
        entityMap.delete(removedId);
      }
      this.entities = [...entityMap.values()];
    }

    // Accumulate events per tile for tooltip use
    for (const event of delta.events) {
      for (const pid of event.participants) {
        const entity = this.entities.find(e => e.id === pid);
        if (entity !== undefined) {
          const key = `${entity.x},${entity.y}`;
          const existing = this.tileEvents.get(key) ?? [];
          existing.push(event);
          // Keep only last 5 events per tile
          if (existing.length > 5) existing.shift();
          this.tileEvents.set(key, existing);
        }
      }
    }

    this.dirty = true;
  }

  /** Get accumulated events for a tile position */
  getTileEvents(wx: number, wy: number): readonly SerializedEvent[] {
    return this.tileEvents.get(`${wx},${wy}`) ?? [];
  }

  /** Get entities at a specific tile position */
  getEntitiesAt(wx: number, wy: number): EntitySnapshot[] {
    return this.entities.filter(e => e.x === wx && e.y === wy);
  }

  /** Main render call — invoke from requestAnimationFrame */
  render(): void {
    if (!this.dirty && !this.viewportChanged()) return;

    this.dirty = false;
    this.lastCenterX = this.viewport.centerX;
    this.lastCenterY = this.viewport.centerY;
    this.lastZoom = this.viewport.zoom;

    this.renderTerrain();
    this.renderEntityMarkers();

    // Apply sub-pixel offset for smooth scrolling
    const { ox, oy } = this.viewport.getPixelOffset();
    this.bgLayer.x = ox;
    this.bgLayer.y = oy;
    this.glyphLayer.x = ox;
    this.glyphLayer.y = oy;
    this.routeLayer.x = ox;
    this.routeLayer.y = oy;
    this.markerLayer.x = ox;
    this.markerLayer.y = oy;
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
        bg.rect(0, 0, TILE_W, TILE_H).fill({ color: 0x0c0c14 });
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
      tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill({ color: 0x0c0c14 });
      tile.glyph.visible = false;
      return;
    }

    const config = BIOME_CONFIGS[tileData.biome];
    if (config === undefined) {
      tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill({ color: 0x0c0c14 });
      tile.glyph.visible = false;
      return;
    }

    let bgColor = config.bg;
    let fgColor = config.fg;

    // River overlay
    let char: string;
    if (tileData.riverId !== undefined) {
      char = '~';
      fgColor = '#2868a0'; // TS
    } else {
      const noise = tileNoise(wx, wy, this.seed);
      char = selectGlyph(config, noise);
    }

    // Apply overlay modification
    if (this.overlayManager !== null) {
      const mod = this.overlayManager.getModification(wx, wy, tileData.temperature, tileData.rainfall);
      if (mod !== null) {
        if (mod.bg !== undefined) bgColor = mod.bg;
        if (mod.fg !== undefined) fgColor = mod.fg;
      }
    }

    tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill({ color: hexToNum(bgColor) });

    tile.glyph.visible = true;
    tile.glyph.texture = getGlyphTexture(glyphIndex(char));
    tile.glyph.tint = hexToNum(fgColor);
  }

  private renderComposite(tile: TileSprite, wx: number, wy: number, zoom: number): void {
    // Pick the dominant biome from the NxN region
    const biomeCounts = new Map<string, number>();
    let dominantBiome = 'Ocean';
    let maxCount = 0;
    let totalTiles = 0;

    for (let dy = 0; dy < zoom; dy++) {
      for (let dx = 0; dx < zoom; dx++) {
        const td = this.getTile(wx + dx, wy + dy);
        if (td !== null) {
          totalTiles++;
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
      tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill({ color: 0x0c0c14 });
      tile.glyph.visible = false;
      return;
    }

    // Dithered composite: blend BG colors if dominant < 75%
    let bgColor: string;
    let fgColor = config.fg;
    if (totalTiles > 0 && maxCount / totalTiles < 0.75) {
      bgColor = blendBiomeColors(biomeCounts, totalTiles);
    } else {
      bgColor = config.bg;
    }

    // Apply overlay for composite center tile
    if (this.overlayManager !== null) {
      const centerTile = this.getTile(wx, wy);
      const mod = this.overlayManager.getModification(
        wx, wy, centerTile?.temperature, centerTile?.rainfall,
      );
      if (mod !== null) {
        if (mod.bg !== undefined) bgColor = mod.bg;
        if (mod.fg !== undefined) fgColor = mod.fg;
      }
    }

    tile.bg.clear().rect(0, 0, TILE_W, TILE_H).fill({ color: hexToNum(bgColor) });

    const noise = tileNoise(wx, wy, this.seed);
    const char = selectGlyph(config, noise);
    tile.glyph.visible = true;
    tile.glyph.texture = getGlyphTexture(glyphIndex(char));
    tile.glyph.tint = hexToNum(fgColor);
  }

  // ── Entity markers ──────────────────────────────────────────────────

  /** Direction → arrow glyph char for army movement */
  private static readonly DIRECTION_ARROWS: Record<string, string> = {
    N: '\u2191', S: '\u2193', E: '\u2192', W: '\u2190',
    NE: '\u2197', NW: '\u2196', SE: '\u2198', SW: '\u2199',
  };

  private renderEntityMarkers(): void {
    this.markerLayer.removeChildren();
    const zoom = this.viewport.zoom;

    for (const entity of this.entities) {
      if (entity.type === 'unknown' || entity.type === 'character') continue;

      // Look up marker config by entity type
      const markerConfig = ENTITY_MARKERS[entity.type];
      if (markerConfig === undefined) continue;

      // Check zoom visibility
      if (zoom > markerConfig.maxZoom) continue;

      const screenPos = this.viewport.worldToScreen(entity.x, entity.y);
      if (screenPos === null) continue;

      // Use directional arrow for moving armies
      let char = markerConfig.char;
      if (entity.type === 'army' && entity.movementDirection !== undefined && entity.movementDirection !== 'stationary') {
        char = TilemapRenderer.DIRECTION_ARROWS[entity.movementDirection] ?? markerConfig.char;
      }

      const marker = new Sprite(getGlyphTexture(glyphIndex(char)));
      marker.x = screenPos.px;
      marker.y = screenPos.py;
      marker.tint = hexToNum(entity.factionId !== undefined
        ? (this.factionColors.get(entity.factionId) ?? markerConfig.fg)
        : markerConfig.fg);
      this.markerLayer.addChild(marker);
    }

    // Render trade routes when Economic overlay is active
    this.renderTradeRoutes();
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
