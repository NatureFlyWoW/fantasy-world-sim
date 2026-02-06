/**
 * @fws/renderer - Terminal ASCII UI (blessed-based)
 *
 * Provides a terminal interface for the fantasy world simulator with:
 * - Multiple panel layout (map, event log, inspector, etc.)
 * - Real-time event streaming with throttled rendering
 * - Configurable color themes
 * - Keyboard-driven navigation
 */

// Types
export {
  PanelId,
  SimulationSpeed,
  getSpeedDisplayName,
  getSeasonName,
  formatWorldTime,
} from './types.js';
export type {
  KeyBinding,
  RenderContext,
  PanelLayout,
  SelectedEntity,
  AppState,
  LayoutPreset,
} from './types.js';

// Theme
export {
  THEME,
  UI_COLORS,
  ENTITY_COLORS,
  SIGNIFICANCE_COLORS,
  CATEGORY_COLORS,
  SIGNIFICANCE_THRESHOLDS,
  getSignificanceColor,
  getSignificanceLevel,
  getCategoryColor,
  getEntityColor,
  getBiomeRendering,
  BiomeType,
  toBlessedColor,
  blendColors,
  dimColor,
  brightenColor,
} from './theme.js';

// Biome characters
export { BIOME_CHARS, ENTITY_MARKERS } from './themes/biome-chars.js';
export type { BiomeVisual, EntityMarker, EntityMarkerKey } from './themes/biome-chars.js';

// Panel base class
export { BasePanel, MockScreen, MockBox, createMockBoxFactory } from './panel.js';
export type { BorderStyle } from './panel.js';

// Layout management
export {
  LayoutManager,
  calculateDefaultLayout,
  calculateMapFocusLayout,
  calculateLogFocusLayout,
  calculateSplitLayout,
  calculateMaximizedLayout,
  getLayoutForPreset,
} from './layout-manager.js';
export type { ScreenDimensions, LayoutConfiguration } from './layout-manager.js';

// Application
export {
  Application,
  KEY_BINDINGS,
  DEFAULT_APP_CONFIG,
  formatStatusBarText,
  getNextSpeed,
  getPanelForKey,
} from './app.js';
export type { AppConfig } from './app.js';

// Map module
export * from './map/index.js';

// Factory function
import type { RenderContext } from './types.js';
import type { AppConfig } from './app.js';
import { Application } from './app.js';

/**
 * Create a new application instance.
 *
 * @param context - The render context with simulation state
 * @param config - Optional configuration overrides
 * @returns A new Application instance
 *
 * @example
 * ```ts
 * import { createApp } from '@fws/renderer';
 * import { World, WorldClock, EventLog, EventBus, SpatialIndex } from '@fws/core';
 *
 * const context = {
 *   world: new World(),
 *   clock: new WorldClock(),
 *   eventLog: new EventLog(),
 *   eventBus: new EventBus(),
 *   spatialIndex: new SpatialIndex(256, 256),
 * };
 *
 * const app = createApp(context);
 * app.start();
 * ```
 */
export function createApp(context: RenderContext, config?: Partial<AppConfig>): Application {
  return new Application(context, config);
}
