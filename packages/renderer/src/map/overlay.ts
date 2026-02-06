/**
 * Map overlay system for displaying additional information layers.
 * Overlays modify the appearance of terrain tiles to show political,
 * military, economic, and other information.
 */

import type { RenderContext } from '../types.js';
import { blendColors } from '../theme.js';

/**
 * Types of overlays that can be displayed on the map.
 */
export enum OverlayType {
  None = 'None',
  Political = 'Political',
  Resources = 'Resources',
  Military = 'Military',
  Trade = 'Trade',
  Magic = 'Magic',
  Climate = 'Climate',
}

/**
 * Overlay modification for a tile.
 * All fields are optional - only specified fields modify the tile.
 */
export interface OverlayModification {
  readonly char?: string;
  readonly fg?: string;
  readonly bg?: string;
}

/**
 * Interface for overlay renderers.
 */
export interface OverlayRenderer {
  /** Get the overlay type */
  readonly type: OverlayType;

  /** Check if this overlay is currently active */
  isActive(): boolean;

  /** Toggle the overlay on/off */
  toggle(): void;

  /** Set the overlay active state */
  setActive(active: boolean): void;

  /**
   * Render the overlay at a specific world position.
   * @returns Modifications to apply, or null if no modification at this position
   */
  renderAt(x: number, y: number, context: RenderContext): OverlayModification | null;
}

/**
 * Base class for overlay implementations.
 */
export abstract class BaseOverlay implements OverlayRenderer {
  abstract readonly type: OverlayType;
  protected active = false;

  isActive(): boolean {
    return this.active;
  }

  toggle(): void {
    this.active = !this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  abstract renderAt(x: number, y: number, context: RenderContext): OverlayModification | null;
}

/**
 * Faction territory data for political overlay.
 */
export interface TerritoryData {
  readonly factionId: number;
  readonly factionColor: string;
  readonly isCapital: boolean;
  readonly isBorder: boolean;
}

/**
 * Territory lookup function type.
 */
export type TerritoryLookup = (x: number, y: number) => TerritoryData | null;

/**
 * Political overlay shows faction territories with colors and borders.
 */
export class PoliticalOverlay extends BaseOverlay {
  readonly type = OverlayType.Political;
  private territoryLookup: TerritoryLookup | null = null;

  /**
   * Set the territory lookup function.
   */
  setTerritoryLookup(lookup: TerritoryLookup): void {
    this.territoryLookup = lookup;
  }

  renderAt(x: number, y: number, _context: RenderContext): OverlayModification | null {
    if (this.territoryLookup === null) return null;

    const territory = this.territoryLookup(x, y);
    if (territory === null) return null;

    // Tint background with faction color
    const bgTint = blendColors('#000000', territory.factionColor, 0.3);

    // Border tiles get special treatment
    if (territory.isBorder) {
      return {
        bg: blendColors(bgTint, '#ffffff', 0.1),
      };
    }

    return { bg: bgTint };
  }
}

/**
 * Resource data for resource overlay.
 */
export interface ResourceData {
  readonly resources: readonly string[];
}

/**
 * Resource lookup function type.
 */
export type ResourceLookup = (x: number, y: number) => ResourceData | null;

/**
 * Resource overlay shows resource locations with icons.
 */
export class ResourceOverlay extends BaseOverlay {
  readonly type = OverlayType.Resources;
  private resourceLookup: ResourceLookup | null = null;

  /** Resource type to character mapping */
  private static readonly RESOURCE_ICONS: Readonly<Record<string, string>> = {
    Food: '\u273D',           // ✽
    Timber: '\u2663',         // ♣
    Stone: '\u25A0',          // ■
    Iron: '\u2692',           // ⚒
    Gold: '\u2605',           // ★
    Gems: '\u2666',           // ♦
    MagicalComponents: '\u2726', // ✦
    LuxuryGoods: '\u2727',    // ✧
    Fish: '\u2248',           // ≈
    Copper: '\u25CF',         // ●
    Tin: '\u25CB',            // ○
    Coal: '\u25AA',           // ▪
    Herbs: '\u2698',          // ⚘
  };

  /** Resource type to color mapping */
  private static readonly RESOURCE_COLORS: Readonly<Record<string, string>> = {
    Food: '#88cc44',
    Timber: '#44aa44',
    Stone: '#888888',
    Iron: '#aaaacc',
    Gold: '#ffcc00',
    Gems: '#ff44ff',
    MagicalComponents: '#aa44ff',
    LuxuryGoods: '#ff8844',
    Fish: '#4488ff',
    Copper: '#cc8844',
    Tin: '#cccccc',
    Coal: '#444444',
    Herbs: '#44cc88',
  };

  setResourceLookup(lookup: ResourceLookup): void {
    this.resourceLookup = lookup;
  }

  renderAt(x: number, y: number, _context: RenderContext): OverlayModification | null {
    if (this.resourceLookup === null) return null;

    const data = this.resourceLookup(x, y);
    if (data === null || data.resources.length === 0) return null;

    // Show the most valuable/first resource
    const resource = data.resources[0];
    if (resource === undefined) return null;

    const icon = ResourceOverlay.RESOURCE_ICONS[resource] ?? '\u00B7';
    const color = ResourceOverlay.RESOURCE_COLORS[resource] ?? '#888888';

    return {
      char: icon,
      fg: color,
    };
  }
}

/**
 * Military unit data for military overlay.
 */
export interface MilitaryData {
  readonly hasArmy: boolean;
  readonly armySize?: number;
  readonly isBesieged?: boolean;
  readonly movementDirection?: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';
}

/**
 * Military lookup function type.
 */
export type MilitaryLookup = (x: number, y: number) => MilitaryData | null;

/**
 * Military overlay shows army positions and movements.
 */
export class MilitaryOverlay extends BaseOverlay {
  readonly type = OverlayType.Military;
  private militaryLookup: MilitaryLookup | null = null;

  /** Direction to arrow character mapping */
  private static readonly DIRECTION_ARROWS: Readonly<Record<string, string>> = {
    N: '\u2191',   // ↑
    S: '\u2193',   // ↓
    E: '\u2192',   // →
    W: '\u2190',   // ←
    NE: '\u2197',  // ↗
    NW: '\u2196',  // ↖
    SE: '\u2198',  // ↘
    SW: '\u2199',  // ↙
  };

  setMilitaryLookup(lookup: MilitaryLookup): void {
    this.militaryLookup = lookup;
  }

  renderAt(x: number, y: number, _context: RenderContext): OverlayModification | null {
    if (this.militaryLookup === null) return null;

    const data = this.militaryLookup(x, y);
    if (data === null) return null;

    // Besieged settlements get special indicator
    if (data.isBesieged === true) {
      return {
        char: '\u2699', // ⚙
        fg: '#ff4444',
        bg: blendColors('#000000', '#ff0000', 0.2),
      };
    }

    // Army with movement direction
    if (data.hasArmy && data.movementDirection !== undefined) {
      const arrow = MilitaryOverlay.DIRECTION_ARROWS[data.movementDirection] ?? '\u2694';
      return {
        char: arrow,
        fg: '#ff4444',
      };
    }

    // Static army
    if (data.hasArmy) {
      return {
        char: '\u2694', // ⚔
        fg: '#ff4444',
      };
    }

    return null;
  }
}

/**
 * Trade route data for trade overlay.
 */
export interface TradeData {
  readonly hasTradeRoute: boolean;
  readonly connections: readonly ('N' | 'S' | 'E' | 'W')[];
  readonly isTradeHub?: boolean;
}

/**
 * Trade lookup function type.
 */
export type TradeLookup = (x: number, y: number) => TradeData | null;

/**
 * Trade overlay shows trade routes between settlements.
 */
export class TradeOverlay extends BaseOverlay {
  readonly type = OverlayType.Trade;
  private tradeLookup: TradeLookup | null = null;

  /** Connection patterns to box-drawing character mapping */
  private static readonly ROUTE_CHARS: Readonly<Record<string, string>> = {
    '': ' ',
    'N': '\u2502',      // │
    'S': '\u2502',      // │
    'E': '\u2500',      // ─
    'W': '\u2500',      // ─
    'NS': '\u2502',     // │
    'EW': '\u2500',     // ─
    'NE': '\u2514',     // └
    'NW': '\u2518',     // ┘
    'SE': '\u250C',     // ┌
    'SW': '\u2510',     // ┐
    'NSE': '\u251C',    // ├
    'NSW': '\u2524',    // ┤
    'NEW': '\u2534',    // ┴
    'SEW': '\u252C',    // ┬
    'NSEW': '\u253C',   // ┼
  };

  setTradeLookup(lookup: TradeLookup): void {
    this.tradeLookup = lookup;
  }

  /** Sort order for connection keys (must match ROUTE_CHARS keys) */
  private static readonly CONNECTION_ORDER: readonly string[] = ['N', 'S', 'E', 'W'];

  renderAt(x: number, y: number, _context: RenderContext): OverlayModification | null {
    if (this.tradeLookup === null) return null;

    const data = this.tradeLookup(x, y);
    if (data === null || !data.hasTradeRoute) return null;

    // Trade hubs get special marker
    if (data.isTradeHub === true) {
      return {
        char: '\u2302', // ⌂
        fg: '#ffcc00',
      };
    }

    // Build connection key for route character lookup
    // Sort by NSEW order to match ROUTE_CHARS keys
    const key = data.connections
      .slice()
      .sort((a, b) => {
        const aIndex = TradeOverlay.CONNECTION_ORDER.indexOf(a);
        const bIndex = TradeOverlay.CONNECTION_ORDER.indexOf(b);
        return aIndex - bIndex;
      })
      .join('');
    const char = TradeOverlay.ROUTE_CHARS[key] ?? '\u00B7';

    return {
      char,
      fg: '#ffcc00',
    };
  }
}

/**
 * Magic data for magic overlay.
 */
export interface MagicData {
  readonly hasLeyLine: boolean;
  readonly leyLineDirection?: 'NS' | 'EW' | 'NESW' | 'NWSE';
  readonly hasMagicalAnomaly?: boolean;
  readonly hasArtifact?: boolean;
}

/**
 * Magic lookup function type.
 */
export type MagicLookup = (x: number, y: number) => MagicData | null;

/**
 * Magic overlay shows ley lines, magical anomalies, and artifacts.
 */
export class MagicOverlay extends BaseOverlay {
  readonly type = OverlayType.Magic;
  private magicLookup: MagicLookup | null = null;

  /** Ley line direction characters */
  private static readonly LEY_LINE_CHARS: Readonly<Record<string, string>> = {
    NS: '\u00B7',     // · (dotted vertical)
    EW: '\u00B7',     // · (dotted horizontal)
    NESW: '\u00D7',   // × (crossing)
    NWSE: '\u00D7',   // × (crossing)
  };

  setMagicLookup(lookup: MagicLookup): void {
    this.magicLookup = lookup;
  }

  renderAt(x: number, y: number, _context: RenderContext): OverlayModification | null {
    if (this.magicLookup === null) return null;

    const data = this.magicLookup(x, y);
    if (data === null) return null;

    // Artifacts take priority
    if (data.hasArtifact === true) {
      return {
        char: '\u2726', // ✦
        fg: '#ff00ff',
      };
    }

    // Magical anomalies
    if (data.hasMagicalAnomaly === true) {
      return {
        fg: '#cc44ff',
        bg: blendColors('#000000', '#440066', 0.5),
      };
    }

    // Ley lines
    if (data.hasLeyLine) {
      const char = data.leyLineDirection !== undefined
        ? MagicOverlay.LEY_LINE_CHARS[data.leyLineDirection] ?? '\u00B7'
        : '\u00B7';

      return {
        char,
        fg: '#aa66ff',
      };
    }

    return null;
  }
}

/**
 * Climate data for climate overlay.
 */
export interface ClimateData {
  readonly temperature: number;  // Celsius
  readonly rainfall: number;     // cm/year
}

/**
 * Climate lookup function type.
 */
export type ClimateLookup = (x: number, y: number) => ClimateData | null;

/**
 * Climate overlay shows temperature and rainfall gradients.
 */
export class ClimateOverlay extends BaseOverlay {
  readonly type = OverlayType.Climate;
  private climateLookup: ClimateLookup | null = null;
  private mode: 'temperature' | 'rainfall' = 'temperature';

  setClimateLookup(lookup: ClimateLookup): void {
    this.climateLookup = lookup;
  }

  setMode(mode: 'temperature' | 'rainfall'): void {
    this.mode = mode;
  }

  getMode(): 'temperature' | 'rainfall' {
    return this.mode;
  }

  toggleMode(): void {
    this.mode = this.mode === 'temperature' ? 'rainfall' : 'temperature';
  }

  renderAt(x: number, y: number, _context: RenderContext): OverlayModification | null {
    if (this.climateLookup === null) return null;

    const data = this.climateLookup(x, y);
    if (data === null) return null;

    if (this.mode === 'temperature') {
      return this.renderTemperature(data.temperature);
    } else {
      return this.renderRainfall(data.rainfall);
    }
  }

  private renderTemperature(temp: number): OverlayModification {
    // Map temperature from -40 to 40 Celsius to blue→red gradient
    const normalized = Math.max(0, Math.min(1, (temp + 40) / 80));

    // Blue (cold) → White (mild) → Red (hot)
    let color: string;
    if (normalized < 0.5) {
      // Blue to white
      color = blendColors('#0044ff', '#ffffff', normalized * 2);
    } else {
      // White to red
      color = blendColors('#ffffff', '#ff4400', (normalized - 0.5) * 2);
    }

    return { bg: blendColors('#000000', color, 0.4) };
  }

  private renderRainfall(rainfall: number): OverlayModification {
    // Map rainfall from 0 to 400 cm/year
    const normalized = Math.max(0, Math.min(1, rainfall / 400));

    // Tan (dry) → Green (moderate) → Blue (wet)
    let color: string;
    if (normalized < 0.5) {
      color = blendColors('#c4a86a', '#44aa44', normalized * 2);
    } else {
      color = blendColors('#44aa44', '#4488cc', (normalized - 0.5) * 2);
    }

    return { bg: blendColors('#000000', color, 0.4) };
  }
}

/**
 * Overlay manager handles multiple overlays and their state.
 */
export class OverlayManager {
  private overlays: Map<OverlayType, OverlayRenderer> = new Map();
  private activeOverlay: OverlayType = OverlayType.None;

  constructor() {
    // Create default overlays
    this.overlays.set(OverlayType.Political, new PoliticalOverlay());
    this.overlays.set(OverlayType.Resources, new ResourceOverlay());
    this.overlays.set(OverlayType.Military, new MilitaryOverlay());
    this.overlays.set(OverlayType.Trade, new TradeOverlay());
    this.overlays.set(OverlayType.Magic, new MagicOverlay());
    this.overlays.set(OverlayType.Climate, new ClimateOverlay());
  }

  /**
   * Get an overlay by type.
   */
  getOverlay<T extends OverlayRenderer>(type: OverlayType): T | undefined {
    return this.overlays.get(type) as T | undefined;
  }

  /**
   * Set the active overlay (only one can be active at a time).
   */
  setActiveOverlay(type: OverlayType): void {
    // Deactivate current overlay
    if (this.activeOverlay !== OverlayType.None) {
      const current = this.overlays.get(this.activeOverlay);
      if (current !== undefined) {
        current.setActive(false);
      }
    }

    this.activeOverlay = type;

    // Activate new overlay
    if (type !== OverlayType.None) {
      const overlay = this.overlays.get(type);
      if (overlay !== undefined) {
        overlay.setActive(true);
      }
    }
  }

  /**
   * Get the currently active overlay type.
   */
  getActiveOverlayType(): OverlayType {
    return this.activeOverlay;
  }

  /**
   * Cycle to the next overlay.
   */
  cycleOverlay(): OverlayType {
    const types = [
      OverlayType.None,
      OverlayType.Political,
      OverlayType.Resources,
      OverlayType.Military,
      OverlayType.Trade,
      OverlayType.Magic,
      OverlayType.Climate,
    ];

    const currentIndex = types.indexOf(this.activeOverlay);
    const nextIndex = (currentIndex + 1) % types.length;
    const nextType = types[nextIndex] ?? OverlayType.None;

    this.setActiveOverlay(nextType);
    return nextType;
  }

  /**
   * Render the active overlay at a position.
   */
  renderAt(x: number, y: number, context: RenderContext): OverlayModification | null {
    if (this.activeOverlay === OverlayType.None) return null;

    const overlay = this.overlays.get(this.activeOverlay);
    if (overlay === undefined || !overlay.isActive()) return null;

    return overlay.renderAt(x, y, context);
  }
}
