/**
 * Map rendering module.
 * Provides viewport management, tile rendering, overlays, and the map panel.
 */

// Viewport
export { Viewport, ZOOM_LEVELS } from './viewport.js';
export type { ZoomLevel, WorldPosition, ScreenPosition, WorldBounds } from './viewport.js';

// Tile renderer
export {
  renderTile,
  renderAveragedRegion,
  renderEntityMarker,
  getEntityMarkerType,
  renderResourceMarker,
  compositeEntityOnTile,
  compositeResourceOnTile,
  RESOURCE_CHARS,
  RESOURCE_COLORS,
} from './tile-renderer.js';
export type { RenderedTile, RenderableTile, MapEntity } from './tile-renderer.js';

// Overlays
export {
  OverlayType,
  BaseOverlay,
  PoliticalOverlay,
  ResourceOverlay,
  MilitaryOverlay,
  TradeOverlay,
  MagicOverlay,
  ClimateOverlay,
  OverlayManager,
} from './overlay.js';
export type {
  OverlayModification,
  OverlayRenderer,
  TerritoryData,
  TerritoryLookup,
  ResourceData,
  ResourceLookup,
  MilitaryData,
  MilitaryLookup,
  TradeData,
  TradeLookup,
  MagicData,
  MagicLookup,
  ClimateData,
  ClimateLookup,
} from './overlay.js';

// Minimap
export {
  Minimap,
  createMinimapBox,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  DEFAULT_MINIMAP_CONFIG,
} from './minimap.js';
export type { MinimapConfig, MinimapTileLookup, MinimapCell } from './minimap.js';

// Terrain styler
export { TerrainStyler } from './terrain-styler.js';
export type { NeighborBiomes } from './terrain-styler.js';

// Simplex noise
export { SimplexNoise, fbm } from './simplex-noise.js';

// Map panel
export { MapPanel, createMapPanelLayout } from './map-panel.js';
export type {
  EntityLookup,
  TileLookup,
  SelectionHandler,
  CursorPosition,
} from './map-panel.js';
