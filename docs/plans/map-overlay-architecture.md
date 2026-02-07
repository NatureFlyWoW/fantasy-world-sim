# Map Overlay System Architecture

## Status: Design Specification
## Author: comp-sim-lead
## Date: 2026-02-07

---

## 1. Problem Framing

The map currently renders only static terrain. The simulation produces rich world state -- settlements, faction territories, armies, trade networks, ley lines, artifacts, temples -- but none of it is visible on the map. This creates a fundamental disconnect between the living simulation and the player's primary spatial interface.

### Existing Infrastructure

The codebase already contains significant overlay scaffolding that is **architecturally complete but unconnected to simulation data**:

- **`packages/renderer/src/map/overlay.ts`**: Six overlay classes (`PoliticalOverlay`, `ResourceOverlay`, `MilitaryOverlay`, `TradeOverlay`, `MagicOverlay`, `ClimateOverlay`) with typed lookup function setters. None are wired to ECS data in the CLI.
- **`packages/renderer/src/themes/biome-chars.ts`**: Entity markers defined (`city`, `ruin`, `army`, `temple`, `academy`, `factionCapital`) but `MapPanel.setEntityLookup()` is never called.
- **`packages/renderer/src/map/map-panel.ts`**: Render pipeline already supports entity compositing (step 2) and overlay application (step 3), but both data sources are null at runtime.
- **`RenderContext`** already carries `world`, `spatialIndex`, `eventBus` -- everything needed to query live simulation state.

### What This Design Addresses

1. **Data Bridge**: How to extract overlay data from ECS and feed it to the existing overlay infrastructure.
2. **Multi-Layer Compositing**: Evolving from single-active overlay to simultaneous multi-layer rendering.
3. **Performance**: Caching strategy to avoid per-frame ECS queries.
4. **Update Strategy**: When overlay data refreshes relative to simulation ticks.
5. **User Controls**: How players toggle and interact with overlays.

### Subsystems Involved

- **Map Panel** (`packages/renderer/src/map/map-panel.ts`)
- **Overlay Manager** (`packages/renderer/src/map/overlay.ts`)
- **Tile Renderer** (`packages/renderer/src/map/tile-renderer.ts`)
- **ECS World & Components** (`packages/core/src/ecs/`)
- **Spatial Index** (`packages/core/src/spatial/spatial-index.ts`)
- **Event Bus** (`packages/core/src/events/`)
- **CLI Wiring** (`packages/cli/src/index.ts`)

---

## 2. Data Architecture

### 2.1 Data Bridge: `MapOverlayBridge`

A new class in `packages/renderer/src/map/` that serves as the adapter between ECS simulation state and the overlay rendering system. It queries the ECS World, caches results in tile-indexed maps, and provides the lookup functions that existing overlay classes expect.

```
ECS World (components) --> MapOverlayBridge (cache) --> Overlay Lookup Functions --> OverlayManager --> MapPanel
```

#### Location

```
packages/renderer/src/map/overlay-bridge.ts
```

#### Core Interface

```typescript
interface MapOverlayBridge {
  // Initialization
  setContext(context: RenderContext): void;
  setEntityResolver(resolver: EntityResolver): void;

  // Cache management
  refreshAll(): void;
  refreshLayer(layer: OverlayLayer): void;
  markDirty(layer: OverlayLayer): void;
  refreshIfDirty(): void;

  // Provide lookup functions to existing overlay classes
  getTerritoryLookup(): TerritoryLookup;
  getResourceLookup(): ResourceLookup;
  getMilitaryLookup(): MilitaryLookup;
  getTradeLookup(): TradeLookup;
  getMagicLookup(): MagicLookup;
  getClimateLookup(): ClimateLookup;

  // Provide entity lookup for MapPanel.setEntityLookup()
  getEntityLookup(): EntityLookup;

  // Event subscription management
  subscribeToEvents(eventBus: EventBus): Unsubscribe;

  // Statistics for debugging/status bar
  getStats(): OverlayBridgeStats;
}

interface OverlayBridgeStats {
  readonly settlementCount: number;
  readonly territoryTileCount: number;
  readonly activeWarCount: number;
  readonly tradeRouteCount: number;
  readonly lastRefreshTick: number;
}
```

### 2.2 Cache Data Structures

Each layer maintains a `Map<string, Data>` keyed by `"x,y"` tile coordinate strings. This provides O(1) lookup per tile during rendering, which is critical since `renderCell()` is called for every visible tile every frame.

```typescript
// Tile key helper
function tileKey(x: number, y: number): string { return `${x},${y}`; }

// Per-layer caches
type SettlementCache = Map<string, SettlementOverlayEntry>;
type TerritoryCache = Map<string, TerritoryOverlayEntry>;
type MilitaryCache = Map<string, MilitaryOverlayEntry>;
type TradeCache = Map<string, TradeOverlayEntry>;
type MagicCache = Map<string, MagicOverlayEntry>;

// Cache entry types
interface SettlementOverlayEntry {
  readonly entityId: EntityId;
  readonly name: string;
  readonly size: 'hamlet' | 'village' | 'town' | 'city' | 'capital';
  readonly factionColor: string;
  readonly population: number;
}

interface TerritoryOverlayEntry {
  readonly factionId: number;
  readonly factionColor: string;
  readonly isBorder: boolean;
  readonly isCapital: boolean;
}

interface MilitaryOverlayEntry {
  readonly hasArmy: boolean;
  readonly armySize: number;
  readonly isBesieged: boolean;
  readonly isContestedBorder: boolean;
  readonly warId?: number;
  readonly factionColor?: string;
}

interface TradeOverlayEntry {
  readonly hasRoute: boolean;
  readonly connections: readonly ('N' | 'S' | 'E' | 'W')[];
  readonly isHub: boolean;
  readonly volumeLevel: 'high' | 'medium' | 'low';
}

interface MagicOverlayEntry {
  readonly hasLeyLine: boolean;
  readonly hasAnomaly: boolean;
  readonly hasArtifact: boolean;
  readonly artifactName?: string;
  readonly leyLineDirection?: 'NS' | 'EW' | 'NESW' | 'NWSE';
}
```

### 2.3 ECS Query Strategy

Each cache is populated by querying ECS component stores. Queries use `World.getStore()` to iterate entities with relevant components, not per-tile lookups.

| Layer | ECS Components Queried | Typical Entity Count | Refresh Cost |
|-------|----------------------|---------------------|-------------|
| Settlements | `Position`, `Population`, `Status`, `Ownership` | 10-50 | O(n) low |
| Territory | `Territory`, `Position` (on factions + settlements) | 10-50 factions | O(n * territory_radius) medium |
| Military | `Military`, `Position`, `BattleList`, `TerritoryChange` | 0-10 armies | O(n) low |
| Trade | `Economy`, `Position` (on settlements with trade links) | 10-50 settlements | O(n^2) paths medium |
| Magic | Tile data (`leyLine` field) + `MagicalProperty`, `Position` | Terrain + 0-20 artifacts | O(tiles_with_ley) medium |
| Climate | Tile data (`temperature`, `rainfall`) | Already in tile data | O(1) per tile, no cache needed |

**Key optimization**: Settlement and military queries use `SpatialIndex.getEntitiesInRect()` scoped to the current viewport bounds, avoiding full-world iteration when only a portion is visible.

### 2.4 Spatial Indexing Integration

The existing `SpatialIndex` (QuadTree-backed) is perfect for viewport-scoped queries:

```typescript
// In MapOverlayBridge.refreshSettlements():
const bounds = viewport.getVisibleBounds();
const margin = 5; // Include entities just outside viewport for border rendering
const entityIds = this.spatialIndex.getEntitiesInRect(
  bounds.minX - margin,
  bounds.minY - margin,
  (bounds.maxX - bounds.minX) + margin * 2,
  (bounds.maxY - bounds.minY) + margin * 2
);
// Filter entityIds for those with Population component (settlements)
```

For territory computation, settlements serve as territory centers and we flood-fill outward to a faction-specific radius. This is computed from faction `Territory` component data.

---

## 3. Layer System Design

### 3.1 Overlay Layer Enum

Extend the existing `OverlayType` enum to support the multi-layer model while maintaining backward compatibility:

```typescript
// Extend existing OverlayType or add new enum
enum OverlayLayer {
  Territory = 'Territory',     // Faction territorial control (bg tinting)
  Settlements = 'Settlements', // Settlement markers (char + fg)
  Military = 'Military',       // Armies, war zones, conflict (char + fg + bg)
  Trade = 'Trade',             // Trade routes (char + fg)
  Magic = 'Magic',             // Ley lines, anomalies, artifacts (char + fg + bg)
  PointsOfInterest = 'POI',   // Temples, dungeons, ruins (char + fg)
  Climate = 'Climate',         // Temperature/rainfall gradients (bg)
}
```

### 3.2 Overlay Presets

Instead of toggling individual layers (which requires many keybindings), use **presets** that activate sensible layer combinations. This extends the existing `cycleOverlay()` pattern:

| Preset Name | Active Layers | Description |
|-------------|---------------|-------------|
| `None` | (none) | Terrain only |
| `Political` | Territory + Settlements | Who controls what, where people live |
| `Military` | Territory + Settlements + Military | Wars and armies overlaid on political map |
| `Economic` | Settlements + Trade | Trade networks and economic hubs |
| `Arcane` | Magic + PointsOfInterest | Ley lines, artifacts, temples |
| `Full` | All layers | Everything visible (may be visually busy) |

The existing `OverlayManager.cycleOverlay()` method is modified to cycle through these presets.

### 3.3 Multi-Layer Compositing Rules

Since each tile has exactly 3 visual channels (`char`, `fg`, `bg`), layers must share channels through priority and blending rules.

**Channel ownership by layer (highest priority first):**

| Priority | Layer | char | fg | bg |
|----------|-------|------|----|----|
| 7 (highest) | Cursor | override | override | override |
| 6 | Settlement | override | override | -- |
| 5 | Military (army) | override (if no settlement) | override | blend 0.2 red |
| 4 | POI | override (if no settlement/army) | override | -- |
| 3 | Trade Route | override (if no entity above) | override | -- |
| 2 | Territory | -- | -- | blend 0.3 faction color |
| 1 | Magic (ley line) | -- | blend 0.3 purple | blend 0.2 purple |
| 0 (lowest) | Terrain | base | base | base |

**Compositing algorithm** (applied in `renderCell`):

```
1. Start with terrain RenderedTile (char, fg, bg)
2. If Territory layer active AND territory data exists:
     bg = blendColors(bg, factionColor, 0.3)
     if isBorder: bg = blendColors(bg, '#ffffff', 0.1)
3. If Magic layer active AND ley line data exists:
     fg = blendColors(fg, '#aa66ff', 0.3)
     bg = blendColors(bg, '#2a0840', 0.2)
4. If Trade layer active AND trade route exists AND no higher-priority char:
     char = route character (box-drawing)
     fg = trade color (volume-coded)
5. If POI layer active AND POI exists AND no higher-priority char:
     char = POI marker
     fg = POI color
6. If Military layer active AND army/war data exists:
     if no settlement here:
       char = army marker
     fg = military color (#ff4444)
     bg = blendColors(bg, '#ff0000', 0.15)
7. If Settlement layer active AND settlement exists:
     char = settlement size marker
     fg = faction color
```

Steps 4-7 progressively override the `char` channel -- the last one with data wins. This ensures settlements are always visible when they exist, and armies show on tiles without settlements.

### 3.4 Visual Priority for Conflicting Tiles

When a tile has both a settlement and an army (siege scenario), the settlement marker takes visual priority for `char`, but the background gets the military red tint and the `fg` shifts toward red to indicate the siege:

```typescript
// Siege compositing
if (hasSettlement && hasMilitary && military.isBesieged) {
  char = settlementMarker;           // Settlement char wins
  fg = blendColors(factionColor, '#ff4444', 0.5);  // Red-tinted faction color
  bg = blendColors(bg, '#ff0000', 0.25);            // Red background tint
}
```

---

## 4. Visual Specifications

### 4.1 Settlement Markers

Settlement size is determined from `Population` component data:

| Size | Population Range | Char | Notes |
|------|-----------------|------|-------|
| Hamlet | < 100 | `.` (period) | Minimal, blends with terrain |
| Village | 100-499 | `o` (lowercase o) | Small but visible |
| Town | 500-1999 | `O` (uppercase O) | Clearly marked |
| City | 2000-9999 | `@` | Dominant on map |
| Capital | Any (is_capital flag) | `#` | Always visible, faction's seat |

**Color**: Settlement `fg` uses the controlling faction's color. If no faction, uses `#f0d060` (gold).

**Rationale for ASCII-safe markers**: The existing `ENTITY_MARKERS` use Unicode symbols (sun, flag, etc.) which can render inconsistently across terminals. The proposed markers use basic ASCII that is universally supported. The more decorative Unicode markers from `biome-chars.ts` can be used as an optional "enhanced Unicode" rendering mode for terminals that support it.

### 4.2 Territory Visualization

Territory is shown through background color blending:

```
Interior tile: bg = blendColors(terrainBg, factionColor, 0.25)
Border tile:   bg = blendColors(terrainBg, factionColor, 0.35)
                    blendColors(result, '#ffffff', 0.08) // slight brightening
```

**Border detection**: A tile is a border if any orthogonal neighbor belongs to a different faction or is unclaimed. This produces organic-looking faction boundaries.

**Contested borders** (where two factions claim overlapping territory during war): alternate the faction color every other tile or blend both faction colors:

```
contested: bg = blendColors(faction1Color, faction2Color, 0.5)
           then blendColors(result, terrainBg, 0.6) // keep terrain visible
```

### 4.3 Military Indicators

| Condition | Char | fg | bg modification |
|-----------|------|----|----|
| Army (stationary) | `!` | `#ff4444` (red) | blend `#ff0000` at 0.15 |
| Army (moving N/S/E/W) | Direction arrows already in `MilitaryOverlay.DIRECTION_ARROWS` | `#ff4444` | blend `#ff0000` at 0.15 |
| Besieged settlement | Settlement marker (unchanged) | blend toward `#ff4444` | blend `#ff0000` at 0.25 |
| Recent battle site | `x` | `#cc4444` (dimmer red) | blend `#330000` at 0.1 |
| War front (contested border) | Territory border with alternating colors | -- | faction color alternation |

### 4.4 Trade Routes

Trade routes connect settlements with economic relationships. Rendered using box-drawing characters (already defined in `TradeOverlay.ROUTE_CHARS`):

| Connection | Char |
|-----------|------|
| Vertical (N-S) | `|` |
| Horizontal (E-W) | `-` |
| Corner (NE) | `+` |
| Intersection | `+` |
| Trade hub (settlement) | Settlement marker (unchanged) |

**Color coding by trade volume**:
- High volume: `#ffcc00` (gold)
- Medium volume: `#ccaa44` (amber)
- Low volume: `#887744` (dim brown)

**Route computation**: Bresenham line between connected settlements. Routes snap to passable terrain (avoid ocean, high mountain). This is computed in the data bridge, not per-frame.

### 4.5 Points of Interest

| Type | Char | fg | Notes |
|------|------|----|-------|
| Temple/Shrine | `+` | `#e0e0a0` (pale gold) | Religious sites |
| Academy/Library | `*` | `#60a0e0` (blue) | Knowledge centers |
| Ruin | `;` | `#808080` (grey) | Destroyed settlements |
| Dungeon | `v` | `#aa6644` (brown) | Underground complexes |
| Artifact location | `!` | `#ff00ff` (magenta) | Powerful items |

### 4.6 Magic Overlay

| Feature | Char | fg | bg |
|---------|------|----|-----|
| Ley line | (terrain char) | blend `#aa66ff` at 0.3 | blend `#2a0840` at 0.2 |
| Magical anomaly | (terrain char) | blend `#cc44ff` at 0.4 | blend `#440066` at 0.3 |
| Ley line nexus (intersection) | `*` | `#cc88ff` | blend `#3a1050` at 0.3 |

### 4.7 Zoom Level Behavior

At zoomed-out views (zoom > 1), each screen character represents multiple tiles. Overlay behavior adapts:

| Zoom | Tiles per char | Settlement display | Territory | Military | Trade |
|------|---------------|-------------------|-----------|----------|-------|
| 1x | 1 | All markers | Full borders | All armies | Route lines |
| 2x | 2x2 | Towns+ only | Simplified borders | Armies only | Hub markers only |
| 4x | 4x4 | Cities+ only | Faction shading | War fronts only | -- |
| 8x | 8x8 | Capitals only | Faction shading | -- | -- |
| 16x | 16x16 | Capitals only | Faction shading | -- | -- |

This prevents visual clutter at high zoom levels and is consistent with the existing LoD design philosophy.

---

## 5. Performance Strategy

### 5.1 Performance Budget

Target: Maintain 30fps rendering with all overlays active on a 100x100 world map. The render loop currently processes ~2000-4000 visible tiles per frame (depending on panel size and zoom).

**Per-frame budget at 30fps**: 33ms total, of which rendering should use no more than ~15ms.

**Per-tile overlay lookup budget**: 0.003ms (3 microseconds) per tile. With cached Map lookups this is easily achievable -- a `Map.get()` call takes ~50-100 nanoseconds.

### 5.2 Caching Strategy

```
Frame N: MapPanel.render()
  For each visible tile (x, y):
    1. Check renderCache (Map<"x,y", RenderedTile>)  -- O(1)
    2. If cache miss:
       a. Compute terrain style                       -- O(1) noise lookups
       b. Lookup entity from entityCache               -- O(1) Map.get
       c. Lookup overlays from layer caches            -- O(1) per layer, max 7 layers
       d. Composite and cache result                   -- O(1)
```

**Cache invalidation triggers:**
- Viewport pan/zoom: Clear entire renderCache (already implemented)
- Overlay toggle: Clear renderCache
- Overlay data refresh: Clear renderCache
- Cursor blink: Does NOT clear cache (cursor handled separately)

### 5.3 Overlay Data Refresh Timing

```
Tick N completes
  |
  v
MapOverlayBridge.onTick(tickNumber):
  For each dirty layer:
    If layer.lastRefresh + layer.minRefreshInterval <= tickNumber:
      Recompute layer cache from ECS queries
      layer.dirty = false
      layer.lastRefresh = tickNumber
      mapPanel.invalidateRenderCache()
```

**Minimum refresh intervals by layer:**

| Layer | Min Refresh Interval | Rationale |
|-------|---------------------|-----------|
| Settlements | 30 ticks (1 month) | Settlements change slowly |
| Territory | 30 ticks (1 month) | Territory shifts are infrequent |
| Military | 1 tick (1 day) | Armies move daily |
| Trade | 90 ticks (1 season) | Trade networks are stable |
| Magic | 90 ticks (1 season) | Ley lines are static; anomalies rare |
| POI | 30 ticks (1 month) | New temples/ruins are infrequent |
| Climate | Never (uses tile data directly) | Static terrain data |

**Critical event overrides**: Certain events force immediate dirty-marking regardless of interval:
- `settlement_founded`, `settlement_destroyed` -> Settlements dirty
- `war_declared`, `war_ended`, `battle_occurred` -> Military dirty
- `territory_changed` -> Territory dirty
- `trade_route_established` -> Trade dirty

### 5.4 Viewport-Scoped Queries

For settlement and military data, use `SpatialIndex.getEntitiesInRect()` scoped to the visible viewport plus margin, rather than iterating all entities globally. This scales with viewport size, not world size.

For territory, maintain a full-world cache since territory computation involves flood-fill that cannot be viewport-scoped efficiently. Territory is the most expensive layer but refreshes infrequently (monthly).

### 5.5 Memory Budget

| Layer | Entry Size (est.) | Max Entries (100x100 world) | Memory |
|-------|------------------|-----------------------------|--------|
| Settlements | 64 bytes | 50 | 3.2 KB |
| Territory | 32 bytes | 10,000 (worst case, all claimed) | 320 KB |
| Military | 48 bytes | 100 (armies + war zones) | 4.8 KB |
| Trade | 32 bytes | 500 (route tiles) | 16 KB |
| Magic | 32 bytes | 1,000 (ley line tiles) | 32 KB |
| POI | 48 bytes | 100 | 4.8 KB |
| **Total** | | | **~380 KB** |

This is well within acceptable limits.

---

## 6. Update Strategy

### 6.1 Recommended: Hybrid (Option D)

The update strategy combines tick-based refresh with event-driven dirty marking and lazy evaluation:

```
                     EventBus
                        |
                   [event listener]
                        |
                   markDirty(layer)
                        |
                   dirtyFlags Set
                        |
        +-----------+---+---+-----------+
        |           |       |           |
   [render frame]   |  [render frame]   |  ...
        |           |       |           |
   refreshIfDirty() |  refreshIfDirty() |
   (if map visible) |  (skip: not       |
        |           |   visible)        |
   recompute caches |                   |
   from ECS        |                   |
        |           |                   |
   invalidate      |                   |
   renderCache     |                   |
```

### 6.2 Justification

- **Not pure reactive** (Option A): Too many events per tick, would thrash caches. A single war tick might produce dozens of army movement events.
- **Not pure tick-based** (Option B): Wasteful when map panel is hidden (chronicle-first layout hides map sometimes). Also wasteful to recompute layers that have not changed.
- **Not pure lazy** (Option C): Would cause visible stale data if the player watches the map while the simulation runs fast.
- **Hybrid**: Event listeners mark layers dirty (cheap, O(1)). Actual recomputation happens at most once per render frame, and only for layers whose minimum refresh interval has elapsed. If the map panel is not visible (hidden by layout), no refresh occurs at all.

### 6.3 Event Subscriptions

```typescript
const LAYER_EVENTS: Record<OverlayLayer, readonly string[]> = {
  [OverlayLayer.Settlements]: [
    'settlement.founded',
    'settlement.destroyed',
    'settlement.population_milestone',
    'political.capital_moved',
  ],
  [OverlayLayer.Territory]: [
    'military.territory_gained',
    'military.territory_lost',
    'political.faction_formed',
    'political.faction_destroyed',
  ],
  [OverlayLayer.Military]: [
    'military.war_declared',
    'military.war_ended',
    'military.battle_occurred',
    'military.army_moved',
    'military.siege_begun',
    'military.siege_ended',
  ],
  [OverlayLayer.Trade]: [
    'economic.trade_route_established',
    'economic.trade_route_disrupted',
    'economic.market_crash',
  ],
  [OverlayLayer.Magic]: [
    'magic.anomaly_appeared',
    'magic.anomaly_resolved',
    'magic.artifact_created',
    'magic.artifact_moved',
  ],
  [OverlayLayer.PointsOfInterest]: [
    'religious.temple_built',
    'religious.temple_destroyed',
    'cultural.academy_founded',
    'settlement.destroyed',
  ],
  [OverlayLayer.Climate]: [],  // Static, never refreshed from events
};
```

---

## 7. API Design

### 7.1 Recommended: Class-Based Manager Pattern

The manager pattern fits the existing codebase style (OverlayManager, Minimap, TerrainStyler are all classes) and encapsulates cache state naturally.

#### 7.1.1 MapOverlayBridge

```typescript
// packages/renderer/src/map/overlay-bridge.ts

import type { RenderContext } from '../types.js';
import type { EntityId } from '@fws/core';
import type { EntityResolver } from '@fws/narrative';
import type { Viewport } from './viewport.js';
import type {
  TerritoryLookup, ResourceLookup, MilitaryLookup,
  TradeLookup, MagicLookup, ClimateLookup,
} from './overlay.js';
import type { EntityLookup, MapEntity } from './map-panel.js';

export enum OverlayLayer {
  Territory = 'Territory',
  Settlements = 'Settlements',
  Military = 'Military',
  Trade = 'Trade',
  Magic = 'Magic',
  PointsOfInterest = 'POI',
  Climate = 'Climate',
}

export interface OverlayBridgeConfig {
  /** Minimum ticks between refreshes, per layer */
  readonly refreshIntervals: Readonly<Record<OverlayLayer, number>>;
  /** Whether to use viewport-scoped queries where possible */
  readonly viewportScoped: boolean;
  /** Margin (in tiles) around viewport for scoped queries */
  readonly viewportMargin: number;
}

export const DEFAULT_BRIDGE_CONFIG: OverlayBridgeConfig = {
  refreshIntervals: {
    [OverlayLayer.Territory]: 30,
    [OverlayLayer.Settlements]: 30,
    [OverlayLayer.Military]: 1,
    [OverlayLayer.Trade]: 90,
    [OverlayLayer.Magic]: 90,
    [OverlayLayer.PointsOfInterest]: 30,
    [OverlayLayer.Climate]: Infinity,  // Never refreshed (uses tile data)
  },
  viewportScoped: true,
  viewportMargin: 5,
};

export class MapOverlayBridge {
  private readonly config: OverlayBridgeConfig;
  private context: RenderContext | null;
  private entityResolver: EntityResolver | null;
  private viewport: Viewport | null;

  // Per-layer caches
  private readonly settlementCache: Map<string, SettlementOverlayEntry>;
  private readonly territoryCache: Map<string, TerritoryOverlayEntry>;
  private readonly militaryCache: Map<string, MilitaryOverlayEntry>;
  private readonly tradeCache: Map<string, TradeOverlayEntry>;
  private readonly magicCache: Map<string, MagicOverlayEntry>;
  private readonly poiCache: Map<string, POIOverlayEntry>;

  // Dirty tracking
  private readonly dirtyLayers: Set<OverlayLayer>;
  private readonly lastRefreshTick: Map<OverlayLayer, number>;

  // Event subscription cleanup
  private unsubscribe: (() => void) | null;

  constructor(config?: Partial<OverlayBridgeConfig>);

  /** Connect to the simulation. Call once during setup. */
  setContext(context: RenderContext): void;

  /** Set entity resolver for name lookups. */
  setEntityResolver(resolver: EntityResolver): void;

  /** Set viewport reference for scoped queries. */
  setViewport(viewport: Viewport): void;

  /**
   * Subscribe to simulation events that trigger layer refreshes.
   * Returns unsubscribe function.
   */
  subscribeToEvents(): void;

  /** Unsubscribe from all events. Call on cleanup. */
  dispose(): void;

  /** Mark a layer as needing refresh. */
  markDirty(layer: OverlayLayer): void;

  /** Mark all layers dirty. */
  markAllDirty(): void;

  /**
   * Refresh any dirty layers whose refresh interval has elapsed.
   * Call this once per render frame (not per tile).
   * Returns true if any cache was updated.
   */
  refreshIfDirty(currentTick: number): boolean;

  /**
   * Force refresh all layers regardless of dirty state.
   * Useful after load or branch switch.
   */
  forceRefreshAll(currentTick: number): void;

  // === Lookup functions for existing overlay classes ===

  getTerritoryLookup(): TerritoryLookup;
  getResourceLookup(): ResourceLookup;
  getMilitaryLookup(): MilitaryLookup;
  getTradeLookup(): TradeLookup;
  getMagicLookup(): MagicLookup;
  getClimateLookup(): ClimateLookup;

  // === Entity lookup for MapPanel ===

  getEntityLookup(): EntityLookup;

  // === Statistics ===

  getStats(): OverlayBridgeStats;
}
```

#### 7.1.2 Enhanced OverlayManager

Extend the existing `OverlayManager` class to support multi-layer compositing:

```typescript
// Changes to packages/renderer/src/map/overlay.ts

export interface OverlayPreset {
  readonly name: string;
  readonly label: string;
  readonly layers: readonly OverlayType[];
}

export const OVERLAY_PRESETS: readonly OverlayPreset[] = [
  { name: 'none',      label: 'Terrain',    layers: [] },
  { name: 'political', label: 'Political',  layers: [OverlayType.Political, /* Settlements handled via entityLookup */] },
  { name: 'military',  label: 'Military',   layers: [OverlayType.Political, OverlayType.Military] },
  { name: 'economic',  label: 'Economic',   layers: [OverlayType.Trade, OverlayType.Resources] },
  { name: 'arcane',    label: 'Arcane',     layers: [OverlayType.Magic] },
  { name: 'climate',   label: 'Climate',    layers: [OverlayType.Climate] },
  { name: 'full',      label: 'Full',       layers: [OverlayType.Political, OverlayType.Military, OverlayType.Trade, OverlayType.Magic] },
];

// New method on OverlayManager:
class OverlayManager {
  // ... existing methods ...

  /** Set active preset (activates multiple overlays simultaneously). */
  setPreset(presetName: string): void;

  /** Get current preset name. */
  getPresetName(): string;

  /** Cycle to next preset. */
  cyclePreset(): string;

  /**
   * Render ALL active overlays at a position, compositing results.
   * Returns composited OverlayModification.
   */
  renderAllAt(x: number, y: number, context: RenderContext): OverlayModification | null;
}
```

The `renderAllAt` method iterates active overlays in priority order (Territory -> Magic -> Trade -> Military) and composites their modifications using the channel rules from Section 3.3.

#### 7.1.3 MapPanel Changes

Minimal changes to `MapPanel.renderCell()`:

```typescript
// In map-panel.ts, renderCell method:
// Change line 479 from:
//   const overlayMod = this.overlayManager.renderAt(wx, wy, context);
// To:
//   const overlayMod = this.overlayManager.renderAllAt(wx, wy, context);
```

The entity lookup integration requires no MapPanel changes -- just calling `mapPanel.setEntityLookup(bridge.getEntityLookup())` in the CLI wiring.

### 7.2 Status Bar Integration

The status bar shows the active overlay preset:

```
Year 3, Month 7, Day 15 (Summer)  |  Speed: x1 (Normal)  |  Overlay: Political  |  [WASD] Pan  [O] Overlay
```

When the map panel is focused, the context hints include overlay controls:

```typescript
// In app.ts getContextHints():
case PanelId.Map:
  const overlayName = mapPanel.getOverlayManager().getPresetName();
  return `[WASD] Pan  [Z/X] Zoom  [O] Overlay: ${overlayName}  [Enter] Inspect`;
```

---

## 8. Integration Plan

### 8.1 CLI Wiring (`packages/cli/src/index.ts`)

The following wiring code goes in `launchTerminalUI()` after map panel creation:

```typescript
// === Map Overlay Bridge ===
// Create the bridge that connects ECS data to map overlays
const overlayBridge = new MapOverlayBridge();
overlayBridge.setContext(context);
overlayBridge.setEntityResolver(entityResolver);
overlayBridge.setViewport(mapPanel.getViewport());

// Wire entity lookup (shows settlements, armies, etc. on map)
mapPanel.setEntityLookup(overlayBridge.getEntityLookup());

// Wire overlay data lookup functions
const overlayManager = mapPanel.getOverlayManager();
const political = overlayManager.getOverlay<PoliticalOverlay>(OverlayType.Political);
if (political !== undefined) {
  political.setTerritoryLookup(overlayBridge.getTerritoryLookup());
}
const military = overlayManager.getOverlay<MilitaryOverlay>(OverlayType.Military);
if (military !== undefined) {
  military.setMilitaryLookup(overlayBridge.getMilitaryLookup());
}
const trade = overlayManager.getOverlay<TradeOverlay>(OverlayType.Trade);
if (trade !== undefined) {
  trade.setTradeLookup(overlayBridge.getTradeLookup());
}
const magic = overlayManager.getOverlay<MagicOverlay>(OverlayType.Magic);
if (magic !== undefined) {
  magic.setMagicLookup(overlayBridge.getMagicLookup());
}
const resource = overlayManager.getOverlay<ResourceOverlay>(OverlayType.Resources);
if (resource !== undefined) {
  resource.setResourceLookup(overlayBridge.getResourceLookup());
}

// Subscribe to simulation events for dirty tracking
overlayBridge.subscribeToEvents();

// Set default overlay preset (show political map with settlements)
overlayManager.setPreset('political');

// Force initial data population
overlayBridge.forceRefreshAll(context.clock.currentTick);
```

### 8.2 Render Loop Integration

In `MapPanel.render()`, add one line before the tile rendering loop:

```typescript
render(context: RenderContext): void {
  // Refresh overlay data if needed (once per frame, not per tile)
  this.overlayBridge?.refreshIfDirty(context.clock.currentTick);

  // ... existing render loop ...
}
```

Alternatively, the bridge refresh can happen in the CLI's render callback or the Application's render loop, keeping the bridge separate from the panel.

### 8.3 Existing Overlay Class Reuse

The existing overlay classes (`PoliticalOverlay`, `MilitaryOverlay`, etc.) are reused as-is. Their `renderAt()` methods already produce correct `OverlayModification` results. The only change is:

1. **OverlayManager**: Add `renderAllAt()` that composites results from multiple active overlays.
2. **OverlayManager**: Add preset cycling alongside the existing single-overlay cycling.
3. **MapPanel**: Change `renderCell()` to call `renderAllAt()` instead of `renderAt()`.

### 8.4 File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/renderer/src/map/overlay-bridge.ts` | **New file** | MapOverlayBridge class |
| `packages/renderer/src/map/overlay.ts` | Modify | Add preset support, `renderAllAt()` compositing |
| `packages/renderer/src/map/map-panel.ts` | Modify | Call `renderAllAt()`, expose bridge setter |
| `packages/renderer/src/map/index.ts` | Modify | Export new types |
| `packages/cli/src/index.ts` | Modify | Wire overlay bridge to map panel |
| `packages/renderer/src/app.ts` | Modify | Update status bar hints with overlay name |

### 8.5 Test Plan

| Test File | Coverage |
|-----------|----------|
| `overlay-bridge.test.ts` | Cache refresh, dirty tracking, ECS query mocking, event subscription |
| `overlay.test.ts` (extend) | Preset cycling, multi-layer compositing, channel priority |
| `map-panel.ts` (extend) | renderCell with multi-layer overlays, zoom-level filtering |

---

## 9. User Controls

### 9.1 Key Bindings (Map Panel Focused)

| Key | Action | Notes |
|-----|--------|-------|
| `o` | Cycle overlay preset | None -> Political -> Military -> Economic -> Arcane -> Climate -> Full -> None |
| `m` | Toggle minimap | Already implemented |
| `z` / `x` | Zoom in/out | Already implemented |
| `WASD` / arrows | Pan | Already implemented |
| `Enter` | Inspect entity at cursor | Already implemented |

The `o` key replaces the existing single-overlay cycling with preset cycling. No new key bindings are needed -- the preset model is simpler for the player than individual layer toggles.

### 9.2 Status Bar Feedback

When map panel is focused, the status bar shows:

```
Year 3, Month 7, Day 15 (Summer) | Speed: x1 | [WASD] Pan [Z/X] Zoom [O] Overlay: Political [Enter] Inspect
```

The overlay preset name updates immediately when `o` is pressed.

### 9.3 Map Panel Title

The map panel title reflects the active overlay:

```
[ World Map - Political ]
[ World Map - Military  ]
[ World Map             ]  (when preset is 'none')
```

### 9.4 Future Enhancement: Overlay Legend

A toggleable legend popup (similar to the existing help overlay) could show what each symbol means. This is not part of the initial implementation but is designed to be easy to add:

```
+--- Map Legend ---+
| @ City           |
| O Town           |
| o Village        |
| . Hamlet         |
| # Capital        |
| ! Army           |
| + Temple         |
| * Academy        |
| ; Ruin           |
| --- Trade Route  |
+------------------+
```

Triggered by pressing `?` when the map panel is focused.

---

## 10. Implementation Phases

### Phase A: Foundation (estimate: 1-2 sessions)

1. Create `MapOverlayBridge` class with cache structures
2. Implement settlement cache refresh from ECS queries
3. Wire `entityLookup` in CLI so settlement markers appear on the map
4. Write tests for bridge cache and settlement queries

**Validation**: Settlements appear on the map as ASCII markers at correct positions.

### Phase B: Territory and Multi-Layer (estimate: 1-2 sessions)

1. Implement territory cache with border detection
2. Wire `PoliticalOverlay` territory lookup
3. Add `renderAllAt()` to OverlayManager
4. Add overlay preset cycling
5. Write compositing tests

**Validation**: Faction territories visible as background coloring with settlement markers overlaid.

### Phase C: Military and Events (estimate: 1 session)

1. Implement military cache from warfare system data
2. Wire event subscriptions for dirty tracking
3. Implement siege visual compositing
4. Test war zones and army markers

**Validation**: Armies visible as markers, war zones tinted red, sieges show combined indicators.

### Phase D: Trade, Magic, POI (estimate: 1 session)

1. Implement trade route path computation and cache
2. Wire magic overlay data from ley line tile data and artifact positions
3. Implement POI cache from temple/academy/ruin entities
4. Add zoom-level filtering

**Validation**: All overlay layers functional, zoom behavior correct.

### Phase E: Polish (estimate: 1 session)

1. Status bar overlay name display
2. Map panel title update
3. Performance profiling and optimization
4. Legend popup (optional)
5. Integration tests with full simulation

**Validation**: System performs at 30fps with all overlays active on 100x100 world.

---

## 11. Edge Cases and Failure Modes

### 11.1 No ECS Data Available

If the ECS world has no settlements/factions/armies, overlay caches remain empty. All lookup functions return `null`. The map displays terrain only. This is the correct behavior during early generation or if systems have not yet produced entities.

### 11.2 Rapid Simulation Speed

At UltraFast3650 speed (3650 ticks per interval), many events fire between render frames. The dirty-flag system handles this correctly: many events may mark the same layer dirty, but refresh happens at most once per render frame. The minimum refresh interval (30 ticks for settlements) prevents thrashing.

### 11.3 Very Large Worlds

For worlds larger than 100x100, the territory cache (which is full-world) could become large. At 200x200 = 40,000 tiles with 32 bytes each = 1.28 MB. Still acceptable. For 500x500 worlds (not currently supported), territory computation would need spatial partitioning or chunking.

### 11.4 Layout Changes Hiding Map

When the layout switches to a mode where the map panel has zero dimensions (e.g., log-focus layout), the refresh-if-dirty check skips computation. When the map becomes visible again, dirty flags ensure data is refreshed on the next frame.

### 11.5 Save/Load and Branch Switching

After loading a save or switching branches, call `bridge.forceRefreshAll()` to rebuild all caches from the new world state. The dirty-flag mechanism does not cover wholesale world replacement.

---

## 12. Interaction with Other Systems

### 12.1 Region Detail Panel

The `RegionDetailPanel` already shows overlay data (controlling faction, nearby settlements) queried directly from ECS in the CLI's selection handler. Once the overlay bridge exists, the region detail panel can optionally read from the bridge's caches instead of performing its own ECS queries, reducing redundant work.

### 12.2 Inspector Panel

Clicking on a settlement marker (via `mapPanel.setSelectionHandler`) should open the inspector for that settlement entity. The `entityLookup` function already returns `MapEntity` with the entity ID, which the existing selection handler can pass to `inspectorPanel.inspect()`.

### 12.3 Narrative System

Overlay data is read-only and does not influence the simulation. This maintains the design constraint that overlays never modify world state.

### 12.4 LoD System

The overlay bridge respects the existing LoD zones. Entities in the Abstract zone (beyond 200 tiles from focus) are included in territory computations but may be simplified. Settlement markers in the Abstract zone use the simplest size classification.

---

## 13. Calibration and Tuning Knobs

| Parameter | Default | Effect of Increase | Location |
|-----------|---------|-------------------|----------|
| `territoryRefreshInterval` | 30 ticks | Less frequent territory updates, lower CPU | `DEFAULT_BRIDGE_CONFIG` |
| `militaryRefreshInterval` | 1 tick | N/A (already minimal) | `DEFAULT_BRIDGE_CONFIG` |
| `viewportMargin` | 5 tiles | More entities rendered at viewport edges, smoother panning | `DEFAULT_BRIDGE_CONFIG` |
| `territoryBlendAlpha` | 0.25 | Stronger faction color tinting, terrain less visible | `PoliticalOverlay.renderAt` |
| `borderBlendAlpha` | 0.35 | More visible borders | `PoliticalOverlay.renderAt` |
| `militaryBgAlpha` | 0.15 | More visible war zone tinting | `MilitaryOverlay.renderAt` |
| `settlementPopThresholds` | [100, 500, 2000] | Smaller/larger settlements get different markers | `SettlementOverlayEntry` |
| `tradeVolumeThresholds` | [low, medium, high] | Color intensity of trade routes | `TradeOverlayEntry` |
| `zoomLayerFilters` | See Section 4.7 | Which layers show at which zoom | `MapOverlayBridge` |

---

## 14. Metrics and Validation

### 14.1 Correctness Metrics

- Every settlement entity with `Position` + `Population` components appears on the map at the correct tile
- Territory coverage matches faction `Territory` component data
- No overlay data persists after an entity is destroyed
- Overlay toggles take effect within one render frame

### 14.2 Performance Metrics

- `MapOverlayBridge.refreshIfDirty()` execution time per call (target: < 5ms for settlement/military, < 50ms for territory)
- `OverlayManager.renderAllAt()` execution time per tile (target: < 0.01ms)
- Render frame time with all overlays active (target: < 15ms for 4000 visible tiles)
- Memory usage of all caches combined (target: < 1MB)

### 14.3 Visual Validation

- Screenshot comparison: terrain-only vs. political vs. military overlays
- Confirm settlement markers are visible on all terrain biome backgrounds
- Confirm territory colors are distinguishable between factions (requires minimum color distance)
- Confirm war zones are visually distinct from peaceful territory
- Confirm zoom filtering hides appropriate detail at each level

---

## Appendix A: File Tree

```
packages/renderer/src/map/
  overlay-bridge.ts          NEW - MapOverlayBridge class
  overlay-bridge.test.ts     NEW - Bridge unit tests
  overlay.ts                 MODIFY - Add presets, renderAllAt()
  overlay.test.ts            MODIFY - Extend with preset/compositing tests
  map-panel.ts               MODIFY - Call renderAllAt(), add bridge setter
  index.ts                   MODIFY - Export new types

packages/cli/src/
  index.ts                   MODIFY - Wire overlay bridge

packages/renderer/src/
  app.ts                     MODIFY - Status bar overlay name
```

## Appendix B: Compatibility Notes

- All existing overlay classes (`PoliticalOverlay`, `MilitaryOverlay`, etc.) are reused without modification to their `renderAt()` methods
- The existing `cycleOverlay()` method on `OverlayManager` is preserved for backward compatibility but deprecated in favor of `cyclePreset()`
- The existing `OverlayType` enum is preserved; `OverlayLayer` is a new enum used by the bridge
- No changes to the ECS, event system, or simulation systems are required
- Tests can mock `RenderContext` with a minimal World containing Position + Population stores
