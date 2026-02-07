/**
 * MapOverlayBridge connects ECS world state to the existing map overlay
 * rendering system. It queries component stores, caches results in tile-keyed
 * Maps for O(1) lookup, and provides the lookup functions that the overlay
 * classes expect.
 *
 * Update strategy: hybrid (event-driven dirty flags + tick-interval refresh).
 * Each layer has a minimum refresh interval. Events mark layers dirty; actual
 * recomputation happens at most once per render frame for dirty layers whose
 * interval has elapsed.
 */

import type { World, SpatialIndex, EventBus } from '@fws/core';
import { EventCategory } from '@fws/core';
import type {
  EntityId,
  PositionComponent,
  PopulationComponent,
  EconomyComponent,
  MilitaryComponent,
  OwnershipComponent,
  StructuresComponent,
  MagicalPropertyComponent,
} from '@fws/core';
import type { TerritoryData, MilitaryData, TradeData, MagicData, ResourceData, ClimateData } from './overlay.js';
import type { MapEntity } from './tile-renderer.js';
import type { TileLookup } from './map-panel.js';
import type { Viewport } from './viewport.js';

// ============================================================================
// Cache entry types
// ============================================================================

/**
 * Settlement overlay data cached per tile.
 */
export interface SettlementOverlayEntry {
  readonly entityId: number;
  readonly name: string;
  readonly size: 'hamlet' | 'village' | 'town' | 'city' | 'capital';
  readonly factionColor: string;
  readonly population: number;
  readonly isCapital: boolean;
}

/**
 * Territory overlay data cached per tile.
 */
export interface TerritoryOverlayEntry {
  readonly factionId: number;
  readonly factionColor: string;
  readonly isBorder: boolean;
  readonly isCapital: boolean;
}

/**
 * Military overlay data cached per tile.
 */
export interface MilitaryOverlayEntry {
  readonly hasArmy: boolean;
  readonly armySize: number;
  readonly isBesieged: boolean;
  readonly isContestedBorder: boolean;
  readonly factionColor: string;
}

/**
 * Trade overlay data cached per tile.
 */
export interface TradeOverlayEntry {
  readonly hasRoute: boolean;
  readonly connections: readonly ('N' | 'S' | 'E' | 'W')[];
  readonly isHub: boolean;
  readonly volumeLevel: 'high' | 'medium' | 'low';
}

/**
 * Magic overlay data cached per tile.
 */
export interface MagicOverlayEntry {
  readonly hasLeyLine: boolean;
  readonly hasAnomaly: boolean;
  readonly hasArtifact: boolean;
}

/**
 * Entity marker data for the map entity lookup.
 */
export interface EntityMarkerEntry {
  readonly entityId: number;
  readonly type: string;
  readonly factionColor: string;
  readonly name: string;
}

// ============================================================================
// Overlay layers
// ============================================================================

/**
 * Identifiers for each overlay data layer.
 */
export enum OverlayLayer {
  Territory = 'Territory',
  Settlements = 'Settlements',
  Military = 'Military',
  Trade = 'Trade',
  Magic = 'Magic',
  Climate = 'Climate',
}

// ============================================================================
// Bridge statistics
// ============================================================================

/**
 * Statistics for debugging and status display.
 */
export interface OverlayBridgeStats {
  readonly settlementCount: number;
  readonly territoryTileCount: number;
  readonly militaryTileCount: number;
  readonly tradeRouteTileCount: number;
  readonly magicTileCount: number;
  readonly entityMarkerCount: number;
  readonly lastRefreshTick: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Per-layer minimum refresh intervals (in ticks).
 */
export interface OverlayBridgeConfig {
  readonly refreshIntervals: Readonly<Record<OverlayLayer, number>>;
  readonly viewportMargin: number;
  readonly territoryRadius: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_BRIDGE_CONFIG: OverlayBridgeConfig = {
  refreshIntervals: {
    [OverlayLayer.Territory]: 30,
    [OverlayLayer.Settlements]: 30,
    [OverlayLayer.Military]: 1,
    [OverlayLayer.Trade]: 90,
    [OverlayLayer.Magic]: 90,
    [OverlayLayer.Climate]: Infinity,
  },
  viewportMargin: 5,
  territoryRadius: 12,
};

// ============================================================================
// Faction color map (injected from CLI)
// ============================================================================

/**
 * Maps faction entity IDs to their display colors.
 * This must be provided by the CLI since faction colors live in the
 * generator's Faction objects, not in ECS components.
 */
export type FactionColorMap = ReadonlyMap<number, string>;

/**
 * Maps faction entity IDs to their capital settlement entity IDs.
 */
export type FactionCapitalMap = ReadonlyMap<number, number>;

// ============================================================================
// Tile key helper
// ============================================================================

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

// ============================================================================
// MapOverlayBridge
// ============================================================================

/**
 * Data bridge between ECS simulation state and the map overlay rendering
 * system. Provides cached, O(1) lookup functions for each overlay layer.
 */
export class MapOverlayBridge {
  private readonly config: OverlayBridgeConfig;
  private readonly world: World;
  // Optional dependencies (set after construction)
  private tileLookup: TileLookup | null = null;
  private factionColors: FactionColorMap = new Map();
  private factionCapitals: FactionCapitalMap = new Map();
  private viewport: Viewport | null = null;

  // Per-layer caches
  private readonly settlementCache: Map<string, SettlementOverlayEntry> = new Map();
  private readonly territoryCache: Map<string, TerritoryOverlayEntry> = new Map();
  private readonly militaryCache: Map<string, MilitaryOverlayEntry> = new Map();
  private readonly tradeCache: Map<string, TradeOverlayEntry> = new Map();
  private readonly magicCache: Map<string, MagicOverlayEntry> = new Map();
  private readonly entityMarkerCache: Map<string, EntityMarkerEntry> = new Map();

  // Dirty tracking
  private readonly dirtyLayers: Set<OverlayLayer> = new Set();
  private readonly lastRefreshTick: Map<OverlayLayer, number> = new Map();

  // Event unsubscribe functions
  private readonly unsubscribers: Array<() => void> = [];

  // Cached render invalidation callback
  private onCacheUpdated: (() => void) | null = null;

  constructor(
    world: World,
    spatialIndex: SpatialIndex,
    config?: Partial<OverlayBridgeConfig>,
  ) {
    this.world = world;
    // spatialIndex reserved for future viewport-scoped queries
    void spatialIndex;
    this.config = {
      ...DEFAULT_BRIDGE_CONFIG,
      ...config,
      refreshIntervals: {
        ...DEFAULT_BRIDGE_CONFIG.refreshIntervals,
        ...(config?.refreshIntervals),
      },
    };

    // All layers start dirty
    for (const layer of Object.values(OverlayLayer)) {
      this.dirtyLayers.add(layer);
      this.lastRefreshTick.set(layer, -Infinity);
    }
  }

  // ==========================================================================
  // Configuration setters
  // ==========================================================================

  /**
   * Set the tile lookup function for terrain-based queries (ley lines, climate).
   */
  setTileLookup(lookup: TileLookup): void {
    this.tileLookup = lookup;
    this.markDirty(OverlayLayer.Magic);
    this.markDirty(OverlayLayer.Climate);
  }

  /**
   * Set the faction color map (faction entity ID -> hex color string).
   */
  setFactionColors(colors: FactionColorMap): void {
    this.factionColors = colors;
    this.markDirty(OverlayLayer.Territory);
    this.markDirty(OverlayLayer.Settlements);
  }

  /**
   * Set the faction capital map (faction entity ID -> capital settlement entity ID).
   */
  setFactionCapitals(capitals: FactionCapitalMap): void {
    this.factionCapitals = capitals;
    this.markDirty(OverlayLayer.Territory);
    this.markDirty(OverlayLayer.Settlements);
  }

  /**
   * Set the viewport reference for scoped queries.
   */
  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  /**
   * Set a callback invoked when overlay caches are updated.
   * The MapPanel can use this to invalidate its render cache.
   */
  setOnCacheUpdated(callback: () => void): void {
    this.onCacheUpdated = callback;
  }

  // ==========================================================================
  // Dirty flag management
  // ==========================================================================

  /**
   * Mark a single layer as needing refresh.
   */
  markDirty(layer: OverlayLayer): void {
    this.dirtyLayers.add(layer);
  }

  /**
   * Mark all layers as dirty.
   */
  markAllDirty(): void {
    for (const layer of Object.values(OverlayLayer)) {
      this.dirtyLayers.add(layer);
    }
  }

  // ==========================================================================
  // Event subscription
  // ==========================================================================

  /**
   * Subscribe to simulation events that trigger layer dirty flags.
   * Call once during setup. Call dispose() to unsubscribe.
   */
  subscribeToEvents(eventBus: EventBus): void {
    // Military events -> Military layer dirty
    this.unsubscribers.push(
      eventBus.on(EventCategory.Military, () => {
        this.markDirty(OverlayLayer.Military);
        this.markDirty(OverlayLayer.Territory);
      })
    );

    // Political events -> Territory + Settlements dirty
    this.unsubscribers.push(
      eventBus.on(EventCategory.Political, () => {
        this.markDirty(OverlayLayer.Territory);
        this.markDirty(OverlayLayer.Settlements);
      })
    );

    // Economic events -> Trade dirty
    this.unsubscribers.push(
      eventBus.on(EventCategory.Economic, () => {
        this.markDirty(OverlayLayer.Trade);
      })
    );

    // Magical events -> Magic dirty
    this.unsubscribers.push(
      eventBus.on(EventCategory.Magical, () => {
        this.markDirty(OverlayLayer.Magic);
      })
    );
  }

  /**
   * Unsubscribe from all events and release resources.
   */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
  }

  // ==========================================================================
  // Refresh logic
  // ==========================================================================

  /**
   * Refresh any dirty layers whose minimum interval has elapsed.
   * Call once per render frame (not per tile).
   * Returns true if any cache was updated (caller should invalidate render cache).
   */
  refreshIfDirty(currentTick: number): boolean {
    let anyUpdated = false;

    for (const layer of this.dirtyLayers) {
      const interval = this.config.refreshIntervals[layer];
      const lastRefresh = this.lastRefreshTick.get(layer) ?? -Infinity;

      if (currentTick - lastRefresh >= interval) {
        this.refreshLayer(layer, currentTick);
        this.lastRefreshTick.set(layer, currentTick);
        this.dirtyLayers.delete(layer);
        anyUpdated = true;
      }
    }

    if (anyUpdated && this.onCacheUpdated !== null) {
      this.onCacheUpdated();
    }

    return anyUpdated;
  }

  /**
   * Force refresh all layers regardless of dirty state or intervals.
   * Useful after save/load or branch switch.
   */
  forceRefreshAll(currentTick: number): void {
    for (const layer of Object.values(OverlayLayer)) {
      this.refreshLayer(layer, currentTick);
      this.lastRefreshTick.set(layer, currentTick);
      this.dirtyLayers.delete(layer);
    }

    if (this.onCacheUpdated !== null) {
      this.onCacheUpdated();
    }
  }

  /**
   * Refresh a single layer's cache from ECS data.
   */
  private refreshLayer(layer: OverlayLayer, _currentTick: number): void {
    switch (layer) {
      case OverlayLayer.Settlements:
        this.refreshSettlements();
        this.refreshEntityMarkers();
        break;
      case OverlayLayer.Territory:
        this.refreshTerritory();
        break;
      case OverlayLayer.Military:
        this.refreshMilitary();
        break;
      case OverlayLayer.Trade:
        this.refreshTrade();
        break;
      case OverlayLayer.Magic:
        this.refreshMagic();
        break;
      case OverlayLayer.Climate:
        // Climate uses tileLookup directly, no cache needed
        break;
    }
  }

  // ==========================================================================
  // Settlement cache builder
  // ==========================================================================

  private refreshSettlements(): void {
    this.settlementCache.clear();

    // Query entities that have both Position and Population (= settlements)
    if (!this.world.hasStore('Position') || !this.world.hasStore('Population')) {
      return;
    }

    const entities = this.world.query('Position', 'Population');

    for (const entityId of entities) {
      const pos = this.world.getComponent<PositionComponent>(entityId, 'Position');
      const pop = this.world.getComponent<PopulationComponent>(entityId, 'Population');
      if (pos === undefined || pop === undefined) continue;

      // Determine faction ownership and color
      const ownership = this.world.getComponent<OwnershipComponent>(entityId, 'Ownership');
      const ownerId = ownership?.ownerId ?? null;
      const factionColor = ownerId !== null
        ? (this.factionColors.get(ownerId) ?? '#f0d060')
        : '#f0d060';

      // Check if this is a capital
      let isCapital = false;
      if (ownerId !== null) {
        const capitalId = this.factionCapitals.get(ownerId);
        if (capitalId !== undefined && capitalId === (entityId as unknown as number)) {
          isCapital = true;
        }
      }

      // Determine settlement size from population
      const size = this.categorizeSettlementSize(pop.count, isCapital);

      // Get name from Status component if available
      let name = `Settlement #${entityId as unknown as number}`;
      if (this.world.hasStore('Status')) {
        const status = this.world.getComponent(entityId, 'Status');
        if (status !== undefined) {
          const titles = (status as { titles?: string[] }).titles;
          if (titles !== undefined && titles.length > 0 && titles[0] !== undefined) {
            name = titles[0];
          }
        }
      }

      const key = tileKey(pos.x, pos.y);
      const existing = this.settlementCache.get(key);

      // If there's already a settlement at this tile, keep the larger one
      if (existing !== undefined && existing.population >= pop.count) {
        continue;
      }

      this.settlementCache.set(key, {
        entityId: entityId as unknown as number,
        name,
        size,
        factionColor,
        population: pop.count,
        isCapital,
      });
    }
  }

  /**
   * Categorize settlement size from population count.
   */
  private categorizeSettlementSize(
    population: number,
    isCapital: boolean,
  ): 'hamlet' | 'village' | 'town' | 'city' | 'capital' {
    if (isCapital) return 'capital';
    if (population >= 2000) return 'city';
    if (population >= 500) return 'town';
    if (population >= 100) return 'village';
    return 'hamlet';
  }

  // ==========================================================================
  // Territory cache builder
  // ==========================================================================

  private refreshTerritory(): void {
    this.territoryCache.clear();

    // Build faction -> settlement positions mapping
    if (!this.world.hasStore('Position') || !this.world.hasStore('Population')) {
      return;
    }

    // Collect settlements grouped by owning faction
    const factionSettlements = new Map<number, Array<{ x: number; y: number; entityId: EntityId }>>();

    const entities = this.world.query('Position', 'Population');
    for (const entityId of entities) {
      const pos = this.world.getComponent<PositionComponent>(entityId, 'Position');
      const ownership = this.world.getComponent<OwnershipComponent>(entityId, 'Ownership');
      if (pos === undefined || ownership === undefined || ownership.ownerId === null) continue;

      const fId = ownership.ownerId;
      const existing = factionSettlements.get(fId) ?? [];
      existing.push({ x: pos.x, y: pos.y, entityId });
      factionSettlements.set(fId, existing);
    }

    // For each faction, flood-fill territory around its settlements
    const radius = this.config.territoryRadius;

    for (const [factionId, settlements] of factionSettlements) {
      const factionColor = this.factionColors.get(factionId) ?? '#808080';
      const capitalEntityId = this.factionCapitals.get(factionId);

      for (const settlement of settlements) {
        const isCapitalSettlement = capitalEntityId !== undefined &&
          capitalEntityId === (settlement.entityId as unknown as number);

        // Flood-fill a diamond shape around the settlement
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist > radius) continue;

            const tx = settlement.x + dx;
            const ty = settlement.y + dy;
            const key = tileKey(tx, ty);

            // Skip tiles already claimed by this faction (keep closest)
            const existing = this.territoryCache.get(key);
            if (existing !== undefined && existing.factionId === factionId) {
              continue;
            }

            // If another faction claims this tile, it becomes a border
            const isContested = existing !== undefined && existing.factionId !== factionId;

            this.territoryCache.set(key, {
              factionId,
              factionColor,
              isBorder: false, // Will be fixed in border pass
              isCapital: isCapitalSettlement && dx === 0 && dy === 0,
            });

            // If contested, also mark the previous faction's tile as border
            if (isContested && existing !== undefined) {
              // The current faction wins the tile, but let's mark as contested
              this.territoryCache.set(key, {
                factionId,
                factionColor,
                isBorder: true,
                isCapital: isCapitalSettlement && dx === 0 && dy === 0,
              });
            }
          }
        }
      }
    }

    // Second pass: detect borders (any tile where a neighbor is different)
    this.detectBorders();
  }

  /**
   * Mark territory tiles as borders where they touch a different faction
   * or unclaimed territory.
   */
  private detectBorders(): void {
    const offsets = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
    ] as const;

    // Collect border tiles (avoid modifying during iteration)
    const borderTiles: Array<{ key: string; entry: TerritoryOverlayEntry }> = [];

    for (const [key, entry] of this.territoryCache) {
      // Parse key to get coordinates
      const commaIdx = key.indexOf(',');
      if (commaIdx === -1) continue;
      const x = parseInt(key.slice(0, commaIdx), 10);
      const y = parseInt(key.slice(commaIdx + 1), 10);
      if (isNaN(x) || isNaN(y)) continue;

      // Check orthogonal neighbors
      let isBorder = false;
      for (const [ox, oy] of offsets) {
        const neighborKey = tileKey(x + ox, y + oy);
        const neighbor = this.territoryCache.get(neighborKey);
        if (neighbor === undefined || neighbor.factionId !== entry.factionId) {
          isBorder = true;
          break;
        }
      }

      if (isBorder && !entry.isBorder) {
        borderTiles.push({
          key,
          entry: { ...entry, isBorder: true },
        });
      }
    }

    // Apply border flags
    for (const { key, entry } of borderTiles) {
      this.territoryCache.set(key, entry);
    }
  }

  // ==========================================================================
  // Military cache builder
  // ==========================================================================

  private refreshMilitary(): void {
    this.militaryCache.clear();

    // Query entities with Position + Military (armies / militarized settlements)
    if (!this.world.hasStore('Position') || !this.world.hasStore('Military')) {
      return;
    }

    const entities = this.world.query('Position', 'Military');
    for (const entityId of entities) {
      const pos = this.world.getComponent<PositionComponent>(entityId, 'Position');
      const mil = this.world.getComponent<MilitaryComponent>(entityId, 'Military');
      if (pos === undefined || mil === undefined) continue;

      // Skip settlements (they have Population); we want army-like entities
      // or settlements with significant military presence
      const pop = this.world.getComponent<PopulationComponent>(entityId, 'Population');
      const isSettlement = pop !== undefined;

      // For settlements, only show military overlay if strength is high
      // (indicates garrison or active conflict)
      if (isSettlement && mil.strength < 50) continue;

      const key = tileKey(pos.x, pos.y);

      // Determine faction color
      const ownership = this.world.getComponent<OwnershipComponent>(entityId, 'Ownership');
      const ownerId = ownership?.ownerId ?? null;
      const factionColor = ownerId !== null
        ? (this.factionColors.get(ownerId) ?? '#ff4444')
        : '#ff4444';

      // Accumulate if multiple units at same tile
      const existing = this.militaryCache.get(key);

      this.militaryCache.set(key, {
        hasArmy: !isSettlement || mil.strength >= 100,
        armySize: mil.strength + (existing?.armySize ?? 0),
        isBesieged: isSettlement && mil.morale < 30,
        isContestedBorder: existing !== undefined && existing.factionColor !== factionColor,
        factionColor,
      });
    }
  }

  // ==========================================================================
  // Trade cache builder
  // ==========================================================================

  private refreshTrade(): void {
    this.tradeCache.clear();

    // Query settlements with Economy component
    if (!this.world.hasStore('Position') || !this.world.hasStore('Economy')) {
      return;
    }

    const entities = this.world.query('Position', 'Economy');

    // Collect trade hubs (wealthy settlements)
    const hubs: Array<{ x: number; y: number; wealth: number; entityId: EntityId }> = [];

    for (const entityId of entities) {
      const pos = this.world.getComponent<PositionComponent>(entityId, 'Position');
      const econ = this.world.getComponent<EconomyComponent>(entityId, 'Economy');
      if (pos === undefined || econ === undefined) continue;

      hubs.push({ x: pos.x, y: pos.y, wealth: econ.wealth, entityId });
    }

    // Sort by wealth descending, take top hubs
    hubs.sort((a, b) => b.wealth - a.wealth);
    const topHubs = hubs.slice(0, Math.min(10, hubs.length));

    // Mark hub tiles
    for (const hub of topHubs) {
      const key = tileKey(hub.x, hub.y);
      this.tradeCache.set(key, {
        hasRoute: true,
        connections: [],
        isHub: true,
        volumeLevel: hub.wealth > 5000 ? 'high' : hub.wealth > 1000 ? 'medium' : 'low',
      });
    }

    // Connect hubs that are within trade distance
    const TRADE_RANGE = 50;
    for (let i = 0; i < topHubs.length; i++) {
      const hubA = topHubs[i];
      if (hubA === undefined) continue;

      for (let j = i + 1; j < topHubs.length; j++) {
        const hubB = topHubs[j];
        if (hubB === undefined) continue;

        const dx = hubB.x - hubA.x;
        const dy = hubB.y - hubA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > TRADE_RANGE) continue;
        if (hubA.wealth + hubB.wealth < 500) continue;

        // Trace a line between the two hubs (Bresenham)
        this.traceTradeRoute(hubA.x, hubA.y, hubB.x, hubB.y,
          Math.min(hubA.wealth, hubB.wealth));
      }
    }
  }

  /**
   * Trace a trade route line between two points using Bresenham's algorithm.
   * Sets trade cache entries along the path with directional connections.
   */
  private traceTradeRoute(
    x0: number, y0: number,
    x1: number, y1: number,
    volume: number,
  ): void {
    const volumeLevel: 'high' | 'medium' | 'low' =
      volume > 5000 ? 'high' : volume > 1000 ? 'medium' : 'low';

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;
    let prevX = x0;
    let prevY = y0;

    while (true) {
      const key = tileKey(cx, cy);
      const existing = this.tradeCache.get(key);

      // Determine connections based on prev and next positions
      const connections = new Set<'N' | 'S' | 'E' | 'W'>(
        existing?.connections ?? []
      );

      // Connection from previous tile
      if (cx !== x0 || cy !== y0) {
        if (prevX < cx) connections.add('W');
        if (prevX > cx) connections.add('E');
        if (prevY < cy) connections.add('N');
        if (prevY > cy) connections.add('S');
      }

      // Connection toward next tile (approximate)
      if (cx !== x1 || cy !== y1) {
        if (x1 > cx) connections.add('E');
        if (x1 < cx) connections.add('W');
        if (y1 > cy) connections.add('S');
        if (y1 < cy) connections.add('N');
      }

      if (!existing?.isHub) {
        this.tradeCache.set(key, {
          hasRoute: true,
          connections: Array.from(connections) as ('N' | 'S' | 'E' | 'W')[],
          isHub: existing?.isHub ?? false,
          volumeLevel: existing?.volumeLevel ?? volumeLevel,
        });
      }

      if (cx === x1 && cy === y1) break;

      prevX = cx;
      prevY = cy;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  // ==========================================================================
  // Magic cache builder
  // ==========================================================================

  private refreshMagic(): void {
    this.magicCache.clear();

    // Use tile lookup to find ley lines (terrain data)
    if (this.tileLookup !== null && this.viewport !== null) {
      const bounds = this.viewport.getVisibleBounds();
      const margin = this.config.viewportMargin;

      for (let y = bounds.minY - margin; y <= bounds.maxY + margin; y++) {
        for (let x = bounds.minX - margin; x <= bounds.maxX + margin; x++) {
          const tile = this.tileLookup(x, y);
          if (tile !== null && tile.leyLine === true) {
            const key = tileKey(x, y);
            this.magicCache.set(key, {
              hasLeyLine: true,
              hasAnomaly: false,
              hasArtifact: false,
            });
          }
        }
      }
    }

    // Query entities with MagicalProperty + Position for artifacts/anomalies
    if (this.world.hasStore('MagicalProperty') && this.world.hasStore('Position')) {
      const entities = this.world.query('MagicalProperty', 'Position');
      for (const entityId of entities) {
        const pos = this.world.getComponent<PositionComponent>(entityId, 'Position');
        const magic = this.world.getComponent<MagicalPropertyComponent>(entityId, 'MagicalProperty');
        if (pos === undefined || magic === undefined) continue;

        const key = tileKey(pos.x, pos.y);
        const existing = this.magicCache.get(key);

        this.magicCache.set(key, {
          hasLeyLine: existing?.hasLeyLine ?? false,
          hasAnomaly: existing?.hasAnomaly ?? magic.powerLevel > 80,
          hasArtifact: true,
        });
      }
    }
  }

  // ==========================================================================
  // Entity marker cache builder
  // ==========================================================================

  private refreshEntityMarkers(): void {
    this.entityMarkerCache.clear();

    // Build entity markers from settlement cache
    for (const [key, settlement] of this.settlementCache) {
      let markerType: string;
      switch (settlement.size) {
        case 'capital':
          markerType = 'factionCapital';
          break;
        case 'city':
          markerType = 'city';
          break;
        case 'town':
          markerType = 'city';
          break;
        case 'village':
          markerType = 'city';
          break;
        case 'hamlet':
          markerType = 'city';
          break;
      }

      this.entityMarkerCache.set(key, {
        entityId: settlement.entityId,
        type: markerType,
        factionColor: settlement.factionColor,
        name: settlement.name,
      });
    }

    // Add ruins, temples, academies from Structures component
    if (this.world.hasStore('Structures') && this.world.hasStore('Position')) {
      const entities = this.world.query('Position', 'Structures');
      for (const entityId of entities) {
        const pos = this.world.getComponent<PositionComponent>(entityId, 'Position');
        const structures = this.world.getComponent<StructuresComponent>(entityId, 'Structures');
        if (pos === undefined || structures === undefined) continue;

        const key = tileKey(pos.x, pos.y);
        // Don't overwrite settlement markers
        if (this.entityMarkerCache.has(key)) continue;

        // Check building types for special markers
        for (const building of structures.buildings) {
          const lower = building.toLowerCase();
          if (lower.includes('temple') || lower.includes('shrine')) {
            this.entityMarkerCache.set(key, {
              entityId: entityId as unknown as number,
              type: 'temple',
              factionColor: '#e0e0a0',
              name: building,
            });
            break;
          }
          if (lower.includes('academy') || lower.includes('library') || lower.includes('school')) {
            this.entityMarkerCache.set(key, {
              entityId: entityId as unknown as number,
              type: 'academy',
              factionColor: '#60a0e0',
              name: building,
            });
            break;
          }
        }
      }
    }
  }

  // ==========================================================================
  // Lookup functions for existing overlay classes
  // ==========================================================================

  /**
   * Returns a TerritoryLookup function for the PoliticalOverlay.
   * The function closure captures `this` and reads from the territory cache.
   */
  getTerritoryLookup(): (x: number, y: number) => TerritoryData | null {
    return (x: number, y: number): TerritoryData | null => {
      const entry = this.territoryCache.get(tileKey(x, y));
      if (entry === undefined) return null;
      return {
        factionId: entry.factionId,
        factionColor: entry.factionColor,
        isCapital: entry.isCapital,
        isBorder: entry.isBorder,
      };
    };
  }

  /**
   * Returns a ResourceLookup function for the ResourceOverlay.
   * Reads resource data directly from tile lookup.
   */
  getResourceLookup(): (x: number, y: number) => ResourceData | null {
    return (x: number, y: number): ResourceData | null => {
      if (this.tileLookup === null) return null;
      const tile = this.tileLookup(x, y);
      if (tile === null || tile.resources === undefined || tile.resources.length === 0) {
        return null;
      }
      return { resources: tile.resources };
    };
  }

  /**
   * Returns a MilitaryLookup function for the MilitaryOverlay.
   */
  getMilitaryLookup(): (x: number, y: number) => MilitaryData | null {
    return (x: number, y: number): MilitaryData | null => {
      const entry = this.militaryCache.get(tileKey(x, y));
      if (entry === undefined) return null;
      return {
        hasArmy: entry.hasArmy,
        armySize: entry.armySize,
        isBesieged: entry.isBesieged,
      };
    };
  }

  /**
   * Returns a TradeLookup function for the TradeOverlay.
   */
  getTradeLookup(): (x: number, y: number) => TradeData | null {
    return (x: number, y: number): TradeData | null => {
      const entry = this.tradeCache.get(tileKey(x, y));
      if (entry === undefined) return null;
      return {
        hasTradeRoute: entry.hasRoute,
        connections: entry.connections,
        isTradeHub: entry.isHub,
      };
    };
  }

  /**
   * Returns a MagicLookup function for the MagicOverlay.
   */
  getMagicLookup(): (x: number, y: number) => MagicData | null {
    return (x: number, y: number): MagicData | null => {
      const entry = this.magicCache.get(tileKey(x, y));
      if (entry === undefined) return null;
      return {
        hasLeyLine: entry.hasLeyLine,
        hasMagicalAnomaly: entry.hasAnomaly,
        hasArtifact: entry.hasArtifact,
      };
    };
  }

  /**
   * Returns a ClimateLookup function for the ClimateOverlay.
   * Climate data comes directly from tile lookup (no cache needed).
   */
  getClimateLookup(): (x: number, y: number) => ClimateData | null {
    return (x: number, y: number): ClimateData | null => {
      if (this.tileLookup === null) return null;
      const tile = this.tileLookup(x, y);
      if (tile === null) return null;
      return {
        temperature: tile.temperature ?? 15,
        rainfall: tile.rainfall ?? 100,
      };
    };
  }

  // ==========================================================================
  // Entity lookup for MapPanel
  // ==========================================================================

  /**
   * Returns an EntityLookup function for MapPanel.setEntityLookup().
   * Shows settlement markers, temples, academies, etc.
   */
  getEntityLookup(): (x: number, y: number) => MapEntity | null {
    return (x: number, y: number): MapEntity | null => {
      const entry = this.entityMarkerCache.get(tileKey(x, y));
      if (entry === undefined) return null;
      return {
        type: entry.type,
        factionColor: entry.factionColor,
        name: entry.name,
      };
    };
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get overlay bridge statistics for debugging and status display.
   */
  getStats(): OverlayBridgeStats {
    let maxRefreshTick = 0;
    for (const tick of this.lastRefreshTick.values()) {
      if (tick > maxRefreshTick && tick !== -Infinity) {
        maxRefreshTick = tick;
      }
    }

    return {
      settlementCount: this.settlementCache.size,
      territoryTileCount: this.territoryCache.size,
      militaryTileCount: this.militaryCache.size,
      tradeRouteTileCount: this.tradeCache.size,
      magicTileCount: this.magicCache.size,
      entityMarkerCount: this.entityMarkerCache.size,
      lastRefreshTick: maxRefreshTick,
    };
  }
}
