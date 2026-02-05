/**
 * Core type definitions for the renderer package.
 */

import type { World } from '@fws/core';
import type { WorldClock } from '@fws/core';
import type { EventLog } from '@fws/core';
import type { EventBus } from '@fws/core';
import type { SpatialIndex } from '@fws/core';

/**
 * Panel identifiers for the UI layout.
 */
export enum PanelId {
  Map = 'Map',
  EventLog = 'EventLog',
  Inspector = 'Inspector',
  RelationshipGraph = 'RelationshipGraph',
  Timeline = 'Timeline',
  Statistics = 'Statistics',
  Fingerprint = 'Fingerprint',
}

/**
 * Keyboard shortcut binding.
 */
export interface KeyBinding {
  readonly key: string;
  readonly action: string;
  readonly description: string;
}

/**
 * Rendering context provided to all panels.
 * Contains references to the simulation state needed for display.
 */
export interface RenderContext {
  readonly world: World;
  readonly clock: WorldClock;
  readonly eventLog: EventLog;
  readonly eventBus: EventBus;
  readonly spatialIndex: SpatialIndex;
}

/**
 * Layout specification for a panel.
 */
export interface PanelLayout {
  readonly id: PanelId;
  x: number;
  y: number;
  width: number;
  height: number;
  focused: boolean;
}

/**
 * Simulation speed settings.
 */
export enum SimulationSpeed {
  Paused = 0,
  Normal = 1,
  Fast7 = 7,
  Fast30 = 30,
  Fast365 = 365,
  UltraFast3650 = 3650,
  SlowMotion = 0.5,
}

/**
 * Get display name for simulation speed.
 */
export function getSpeedDisplayName(speed: SimulationSpeed): string {
  switch (speed) {
    case SimulationSpeed.Paused:
      return 'Paused';
    case SimulationSpeed.Normal:
      return '×1 (Normal)';
    case SimulationSpeed.Fast7:
      return '×7 (Week)';
    case SimulationSpeed.Fast30:
      return '×30 (Month)';
    case SimulationSpeed.Fast365:
      return '×365 (Year)';
    case SimulationSpeed.UltraFast3650:
      return '×3650 (Decade)';
    case SimulationSpeed.SlowMotion:
      return '×0.5 (Slow)';
    default:
      return `×${speed}`;
  }
}

/**
 * Season names for display.
 */
export function getSeasonName(month: number): string {
  if (month >= 1 && month <= 3) return 'Winter';
  if (month >= 4 && month <= 6) return 'Spring';
  if (month >= 7 && month <= 9) return 'Summer';
  return 'Autumn';
}

/**
 * Format world time for display.
 */
export function formatWorldTime(year: number, month: number, day: number): string {
  const season = getSeasonName(month);
  return `Year ${year}, Month ${month}, Day ${day} (${season})`;
}

/**
 * Selected entity information for display.
 */
export interface SelectedEntity {
  readonly id: number;
  readonly type: string;
  readonly name: string;
}

/**
 * Application state for the renderer.
 */
export interface AppState {
  readonly speed: SimulationSpeed;
  readonly selectedEntity: SelectedEntity | null;
  readonly focusedPanel: PanelId;
  readonly focusLocation: { x: number; y: number } | null;
  readonly helpVisible: boolean;
}

/**
 * Layout preset names.
 */
export type LayoutPreset = 'default' | 'map-focus' | 'log-focus' | 'split';
