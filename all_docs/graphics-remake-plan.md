# Graphics Remake Plan: ASCII Terminal -> Pixel Art Desktop App

## Context

Aetherum currently runs as a Node.js terminal application using the `blessed` library for its UI. While functional, this limits the visual experience to ASCII characters and ANSI colors on a black terminal background. The user wants a dramatic visual overhaul to match their mockup images showing pixel art terrain, ornate medieval UI panels, card-based event logs, and tabbed inspectors.

**User decisions (confirmed):**
- Platform: Electron desktop app
- Map style: Top-down pixel art first (isometric later)
- Migration: Parallel packages (keep blessed as fallback)
- Art pipeline: Procedural generation (runtime, seed-based)

**What changes:** `@fws/renderer` (blessed) gets a sibling `@fws/electron` package
**What stays:** `@fws/core`, `@fws/generator`, `@fws/narrative` are completely untouched

---

## Architecture Overview

```
@fws/core (unchanged)          @fws/generator (unchanged)
       \                              /
        \                            /
         @fws/electron (NEW)  ------+---- @fws/narrative (unchanged)
         |
         +-- main/           (Electron main process - simulation runner)
         +-- renderer/        (Electron renderer - PixiJS + HTML/CSS)
         |    +-- pixi/       (Map canvas: terrain, features, overlays)
         |    +-- ui/         (HTML panels: event log, inspector, topbar)
         |    +-- procgen/    (Procedural sprite generation)
         |    +-- data/       (Data adapters extracted from blessed panels)
         |    +-- assets/     (Generated sprite atlases, fonts, icons)
         |    +-- styles/     (14 CSS files: variables, panels, cards, etc.)
         +-- shared/          (IPC types shared between processes)

@fws/renderer (blessed - PRESERVED as fallback, launched via `pnpm run start`)
@fws/cli (PRESERVED - still drives terminal mode)
```

### Technology Stack
- **Electron 33** - Desktop window, main/renderer processes
- **PixiJS 8** - 2D sprite rendering for the map canvas
- **Vite 5** - Bundler with HMR for the renderer process
- **HTML/CSS** - UI panels (no framework, vanilla web components)
- **Canvas 2D API** - Procedural sprite generation at startup

### IPC Pattern
- Simulation runs in Electron **main process** (direct access to ECS World)
- Renderer process receives **delta updates** per tick (~10KB: changed entities + new events)
- Inspector queries use **invoke/handle** for on-demand entity data
- Initial map load sends full tile data once (~800KB for 128x128 map)

---

## Data Reuse Strategy

**70% of current renderer code is reusable** (5,685 of 8,094 LOC analyzed):

| File | LOC | Reusable | Action |
|------|-----|----------|--------|
| `overlay-bridge.ts` | 1,092 | 92% | Extract territory flood-fill, trade tracing, dirty tracking |
| `event-formatter.ts` | 571 | 91% | Extract prose generation, SHORT_NARRATIVE_MAP, SUBTYPE_VERB_MAP |
| `tile-renderer.ts` | 316 | 82% | Extract biome-to-color mapping, entity marker data |
| `overlay.ts` | 759 | 72% | Extract overlay types, preset definitions, base overlay logic |
| `inspector-prose.ts` | 343 | 73% | Move prose tables directly (HEALTH_PROSE, PERSONALITY_AXIS, etc.) |
| `character-inspector.ts` | 774 | 58% | Extract ECS query logic, section data structures |
| `faction-inspector.ts` | 844 | 57% | Extract ECS query logic, section data structures |
| `inspector-panel.ts` | 1,366 | 70% | Extract entity type detection, navigation data model |
| `event-log-panel.ts` | 2,029 | 60% | Extract aggregation logic, chronicle mode data |

**Strategy:** Create `renderer/src/data/` adapters that port the pure-logic portions. The blessed-specific 30% (tag formatting, box rendering, key handlers) is replaced by HTML/CSS/PixiJS equivalents.

---

## Phased Implementation Plan

### Phase 1: Electron Scaffold + Basic Map (Foundation)

**Goal:** Working Electron app that loads a world, renders colored tiles on PixiJS canvas, shows basic HTML sidebar.

**New files to create:**
```
packages/electron/
  package.json                    # Electron + PixiJS + Vite deps
  tsconfig.json                   # Base config with workspace paths
  tsconfig.main.json              # Main process (NodeNext module)
  tsconfig.renderer.json          # Renderer process (Bundler module)
  vite.config.ts                  # Vite config with workspace aliases
  scripts/dev.mjs                 # Dev launcher (Vite + Electron)
  src/
    main/
      index.ts                    # Electron app, window creation
      preload.ts                  # Context bridge (IPC channels)
      ipc-handlers.ts             # IPC request handlers
      simulation-runner.ts        # World gen + simulation loop orchestration
    renderer/
      index.html                  # Entry HTML with CSS Grid layout shell
      main.ts                     # Vite entry: init PixiJS + mount UI
      pixi/
        map-renderer.ts           # PixiJS Application, tilemap container
        viewport.ts               # Camera: zoom, pan, smooth scrolling
      ui/
        app-shell.ts              # CSS Grid root, panel column, resize divider
      styles/
        variables.css             # 75 CSS custom properties (colors, fonts)
        reset.css                 # Global reset, box-sizing, selection
        layout.css                # CSS Grid shell, map container, panel column
        index.css                 # Imports all CSS in order
    shared/
      ipc-types.ts                # IPC channel names + payload types
```

**Root changes:**
- `pnpm-workspace.yaml` - add `packages/electron`
- `package.json` - add `start:electron`, `build:electron` scripts

**Key deps:** `electron@^33.2.0`, `pixi.js@^8.5.2`, `vite@^5.4.11`, `vite-plugin-electron@^0.28.8`

**Verification:** `pnpm run start:electron` opens an Electron window showing colored rectangles for terrain tiles with a dark sidebar placeholder.

---

### Phase 2: Procedural Terrain Sprites (Art Generation)

**Goal:** Replace colored rectangles with procedurally generated 32x32 pixel art terrain tiles.

**New files:**
```
packages/electron/src/renderer/
  procgen/
    seeded-random.ts              # xorshift128 PRNG, fork(), hashCombine()
    biome-palettes.ts             # 17 biome color palettes (base/highlight/shadow/detail)
    terrain-tile-gen.ts           # 5-layer tile generation (base, texture, detail, dither, lighting)
    tile-transitions.ts           # Domain-warped biome boundary blending
    river-overlay-gen.ts          # Bezier curve river rendering with banks
    texture-cache.ts              # TextureCache class: generate, cache, atlas pack
    sprite-sheet.ts               # Shelf-packing algorithm for atlas generation
```

**Algorithm per tile (5 layers):**
1. Base color - low-freq simplex noise (0.02) indexes into biome palette base array
2. Texture variation - mid-freq noise (0.08) blends toward highlight/shadow
3. Detail specks - high-freq noise (0.2) adds accent pixels (wildflowers, stone, lava)
4. Ordered dithering - 4x4 Bayer matrix for pixel art cross-hatch texture
5. Directional lighting - top-left gradient for consistent light source

**Tile count:** 17 biomes x 8 variants = 136 tiles + ~80 transition tiles = 216 total
**Atlas:** 512x512 RGBA, ~1MB GPU memory
**Generation time target:** <500ms async (yields to event loop every 20 tiles)

**Verification:** Map shows textured terrain tiles with visible biome variation, rivers, and smooth transitions.

---

### Phase 3: Natural Features + Settlements (Living Map)

**Goal:** Populate the map with tree sprites, settlement buildings, and entity markers.

**New files:**
```
packages/electron/src/renderer/
  procgen/
    tree-gen.ts                   # 3 families (conifer/deciduous/tropical), 3 sizes each
    rock-gen.ts                   # Boulder sprites (3 sizes)
    feature-placement.ts          # Poisson disk sampling per biome density
    building-gen.ts               # Modular buildings (wall material x roof style)
    castle-gen.ts                 # 5-tier castles from hamlet to capital
    settlement-layout.ts          # Composite settlement sprites with road networks
    faction-color.ts              # Faction color mask application to banners/shields
    pixel-heraldry.ts             # Pixel art coat of arms (replaces ASCII heraldry)
  pixi/
    feature-layer.ts              # PixiJS container for trees, rocks per tile
    settlement-layer.ts           # PixiJS container for settlement sprites
    marker-layer.ts               # Entity markers (armies, ruins, temples)
```

**Sprite counts:**
- Trees: 3 families x 3 sizes = 9 sprites
- Rocks: 3 sizes = 3 sprites
- Buildings: 3 wall materials x 4 roof styles = 12 archetypes
- Castles: 5 tiers (hamlet to capital)
- Settlements: 5 tiers (composited from buildings + castle + roads)

**Feature atlas:** 256x256 (~256KB)
**Structure atlas:** 1024x512 (~2MB)

**Verification:** Map shows forests with individual tree sprites, settlements with faction-colored flags, army markers on roads.

---

### Phase 4: UI Chrome + Event Log (Panel System)

**Goal:** Ornate medieval panel frames, card-based event log with category badges.

**New files:**
```
packages/electron/src/renderer/
  ui/
    panel-frame.ts                # Ornate corner ornaments, title bar, controls
    event-log-panel.ts            # Chronicle panel: modes, cards, temporal headers
    category-badge.ts             # 10 event category icons (16x16 pixel art)
  data/
    event-data-adapter.ts         # Extracts event formatting logic from blessed panels
    entity-resolver.ts            # Entity name resolution (from blessed buildEntityResolver)
  procgen/
    ui-frame-gen.ts               # Corner ornament sprite generation (24x24)
    badge-gen.ts                  # Category badge sprite generation (16x16)
  styles/
    typography.css                # Font imports (Cinzel, Source Sans 3, JetBrains Mono)
    panel-frame.css               # Panel base, corners, titlebar, focus states
    event-log.css                 # Chronicle modes, event cards, badges, significance
    scrollbar.css                 # Custom scrollbar styling
    animations.css                # Card entry, legendary pulse animations
```

**Color palette:** 75 CSS custom properties including:
- 10 category colors (desaturated from terminal palette: Political `#d4a832`, Military `#c44040`, etc.)
- 6 significance tiers (Trivial `#444440` to Legendary `#d040c0`)
- Warm parchment text tones (`#e0d8c4`, `#b0a890`, `#7a7060`)
- Gold accent system (`#8b6914`, `#c9a84c`, `#c9b896`)

**Typography:** Cinzel (serif headers), Source Sans 3 (body), JetBrains Mono (data)

**Verification:** Event log shows styled cards with colored category badges, significance dots, clickable entity names, temporal headers between time periods.

---

### Phase 5: Inspector Panel (Entity Deep-Dive)

**Goal:** Tabbed inspector with collapsible prose sections for all 6 entity types.

**New files:**
```
packages/electron/src/renderer/
  ui/
    inspector-panel.ts            # Tab bar, breadcrumbs, section container
    character-view.ts             # 7-section character inspector
    faction-view.ts               # 8-section faction inspector
    site-view.ts                  # 7-section site inspector
    event-view.ts                 # 6-section event inspector
    region-view.ts                # 6-section region inspector
    artifact-view.ts              # Artifact inspector
  data/
    character-data-adapter.ts     # Extract from character-inspector.ts (ECS queries)
    faction-data-adapter.ts       # Extract from faction-inspector.ts
    site-data-adapter.ts          # Extract from location-inspector.ts
    inspector-prose-data.ts       # Port prose lookup tables directly
  styles/
    inspector.css                 # Tabs, breadcrumbs, sections, prose, data rows, card grid
```

**Preserved data logic:**
- `HEALTH_PROSE`, `PERSONALITY_AXIS`, `SETTLEMENT_SIZE_PROSE` lookup tables
- `RELATION_CATEGORY_LABELS`, `MILITARY_STATE_PROSE`, `ECONOMIC_STATE_PROSE`
- Section structures (IDs, titles, summaryHints)
- Entity type detection and navigation model

**Verification:** Click entity in event log -> inspector shows prose-first view with collapsible sections, back/forward navigation, breadcrumbs.

---

### Phase 6: Map Overlays + Interaction (Living World)

**Goal:** Political/military/economic overlay visualization, click-to-inspect, map controls.

**New files:**
```
packages/electron/src/renderer/
  pixi/
    overlay-renderer.ts           # 6 overlay types as PixiJS colored layers
    overlay-presets.ts            # 7 preset combinations
  data/
    overlay-data-adapter.ts       # Extract overlay-bridge.ts logic (flood-fill, trade routes)
    map-data-adapter.ts           # Tile lookup, entity position data
  ui/
    topbar.ts                     # Logo, date, speed controls, view tabs
    statusbar.ts                  # Tick, entities, events, FPS counters
    tooltip.ts                    # Entity hover tooltips on map
  styles/
    topbar.css                    # Logo, speed buttons, view tabs
    statusbar.css                 # Runtime statistics
    tooltip.css                   # Hover tooltip styling
```

**Overlay rendering:** Semi-transparent colored rectangles composited over terrain. Territory uses flood-fill from faction capitals (reused algorithm), trade routes use Bresenham line tracing (reused), military shows army markers with size indicators.

**Interaction:** Click tile -> inspect region. Click settlement -> inspect site. Click entity name -> inspect entity. Keyboard shortcuts preserved from terminal version.

**Verification:** Toggle 'o' to cycle overlay presets, click settlements to inspect, map zooms/pans smoothly.

---

### Phase 7: Polish + Seasonal Effects (Finish)

**New files:**
```
packages/electron/src/renderer/
  pixi/
    seasonal-filter.ts            # PixiJS ColorMatrixFilter for season color shifts
    minimap.ts                    # Small world overview in corner
  ui/
    welcome-screen.ts             # Modal welcome with world info
    modal.ts                      # Base modal component (save/load, settings)
  styles/
    modal.css                     # Dialog styling
  procgen/
    atmospheric-gen.ts            # Sky gradient, depth fog for distant tiles
```

**Seasonal palette shifts via PixiJS filter (no tile regeneration):**
- Spring: +10% saturation, -5deg hue, +5% brightness
- Summer: baseline
- Autumn: -15% saturation, +25deg hue, -5% brightness
- Winter: -35% saturation, -10deg hue, +10% brightness

**Verification:** Seasons visibly shift terrain colors, minimap shows full world, welcome modal displays on first launch.

---

## File Count Summary

| Phase | New Files | Estimated LOC |
|-------|-----------|---------------|
| 1: Scaffold | ~18 | ~2,500 |
| 2: Terrain | ~7 | ~3,000 |
| 3: Features | ~10 | ~4,000 |
| 4: Event Log | ~8 | ~3,500 |
| 5: Inspector | ~12 | ~4,000 |
| 6: Overlays | ~9 | ~3,000 |
| 7: Polish | ~6 | ~1,500 |
| **Total** | **~70** | **~21,500** |

Plus ~14 CSS files totaling ~2,000 LOC.

---

## Verification Plan

After each phase:
1. `pnpm run typecheck` - no TypeScript errors across all packages
2. `pnpm run test` - existing 2,955 tests still pass (simulation untouched)
3. `pnpm run start:electron` - visual verification of new features
4. `pnpm run start` - terminal mode still works (blessed preserved)

Phase-specific checks:
- Phase 1: Electron window opens, colored tile grid renders, sidebar visible
- Phase 2: Terrain shows pixel art textures with biome variation
- Phase 3: Trees populate forests, settlements show buildings with faction colors
- Phase 4: Event log shows styled cards, badges, significance indicators
- Phase 5: Inspector shows prose sections, entity navigation works
- Phase 6: Overlays visualize territories/trade/military, click-to-inspect works
- Phase 7: Seasons shift colors, minimap works, welcome screen displays

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scope creep | Strict 7-phase plan, each independently shippable |
| Performance (many sprites) | Texture atlases, viewport culling, dirty tracking |
| Electron complexity | Start simple (single window), add IPC incrementally |
| Art quality | Procedural algorithms + iteration; fallback to colored rectangles |
| Blessed regression | Parallel package, never modify `@fws/renderer` |
| Large data transfer | Delta-only IPC updates (~10KB/tick), full load only at startup |

---

## Key Reference Files (Existing, Read-Only)

- `packages/renderer/src/map/overlay-bridge.ts` - Territory flood-fill, trade tracing (reuse algorithms)
- `packages/renderer/src/panels/event-formatter.ts` - Prose generation, narrative maps (port to data adapter)
- `packages/renderer/src/panels/inspector-prose.ts` - Prose lookup tables (port directly)
- `packages/renderer/src/panels/character-inspector.ts` - Character ECS queries (extract data logic)
- `packages/renderer/src/panels/faction-inspector.ts` - Faction ECS queries (extract data logic)
- `packages/renderer/src/themes/biome-chars.ts` - Biome definitions (use as palette reference)
- `packages/renderer/src/map/terrain-styler.ts` - Noise-based variation (adapt algorithms)
- `packages/renderer/src/map/simplex-noise.ts` - SimplexNoise class (reuse directly)
- `packages/renderer/src/widgets/heraldry.ts` - CoA generation logic (adapt to pixel art)
- `packages/cli/src/index.ts` - World gen + panel wiring (adapt main flow to Electron)

---
---

# DETAILED SPECIFICATIONS (Subagent Research)

The following sections contain the detailed technical specifications produced by specialized research agents. These serve as implementation reference during each phase.

---

## Appendix A: Electron + PixiJS + Vite Configuration

### Package Structure
```
packages/electron/
  src/
    main/              # Main process (Node.js environment)
      index.ts         # Electron app entry point
      preload.ts       # Secure IPC bridge (context isolation)
      ipc-handlers.ts  # IPC request handlers
      simulation-runner.ts # ECS simulation orchestration
    renderer/          # Renderer process (Browser environment)
      index.html       # Entry HTML
      main.ts          # Vite entry point
    shared/            # Types shared between processes
      ipc-types.ts     # IPC channel definitions
  scripts/
    dev.mjs            # Development launcher (Vite + Electron)
  package.json
  tsconfig.json          # Base config
  tsconfig.main.json     # Main process config
  tsconfig.renderer.json # Renderer process config
  vite.config.ts         # Vite bundler config
  electron-builder.yml   # Distribution config
```

### Dependencies
```json
{
  "dependencies": {
    "@fws/core": "workspace:*",
    "@fws/generator": "workspace:*",
    "@fws/narrative": "workspace:*",
    "pixi.js": "^8.5.2"
  },
  "devDependencies": {
    "electron": "^33.2.0",
    "electron-builder": "^25.1.8",
    "vite": "^5.4.11",
    "vite-plugin-electron": "^0.28.8",
    "vite-plugin-electron-renderer": "^0.14.6",
    "tsx": "^4.7.0",
    "chokidar": "^4.0.1"
  }
}
```

### TypeScript Configuration (3-Layer)

**Main process (`tsconfig.main.json`):**
- `module: "NodeNext"`, `moduleResolution: "NodeNext"`
- `lib: ["ES2022"]` (no DOM types)
- `types: ["node"]`

**Renderer process (`tsconfig.renderer.json`):**
- `module: "ESNext"`, `moduleResolution: "Bundler"` (Vite-compatible)
- `lib: ["ES2022", "DOM", "DOM.Iterable"]`
- `types: ["vite/client"]`

### IPC Data Transfer Strategy

**Initial Load (one-time):** ~800KB for 128x128 map tiles
**Per-Tick Update (continuous):**
```typescript
interface WorldStateUpdate {
  tick: number;
  year: number; season: number; day: number;
  changedEntities: Array<{ id: string; components: Record<string, unknown> }>;
  recentEvents: WorldEvent[];
  stats: { entityCount: number; characterCount: number };
}
// Target: <10KB per tick
```

**On-Demand Queries (user-initiated):**
```typescript
const entityData = await window.electron.queryEntities([clickedEntityId]);
```

### Security
- Context isolation enabled (`contextIsolation: true`)
- Node integration disabled in renderer (`nodeIntegration: false`)
- Sandbox enabled
- Preload script exposes only validated IPC channels via `contextBridge`

### Performance Targets
- 60 FPS PixiJS rendering
- <3 second startup to first render
- <200MB memory (Electron + PixiJS)
- <100ms per simulation tick
- <10ms IPC latency

---

## Appendix B: Procedural Pixel Art Generation System

### Biome Color Palettes (All 17)

Each palette has: `base` (3-5 primary fill), `highlights` (2-3 bright), `shadows` (2 dark), `details` (2-3 accent), `useDithering` flag, `lightingStrength` (0.0-0.8).

**Water:**
- DeepOcean: `['#0a1428', '#0f1c38', '#142448', '#0c1830']`, lighting 0.2
- Ocean: `['#0f2040', '#142850', '#1a3060', '#122445']`, lighting 0.3
- Coast: `['#1a3050', '#1e3858', '#c0a878', '#b8a070']` (mixed water+sand), lighting 0.5

**Temperate:**
- Plains: `['#4a7c3e', '#5a8c4e', '#6a9c5e', '#508844']`, details include wildflower yellow `#c8b860`, lighting 0.6
- Forest: `['#2a5c34', '#326838', '#1e4a28', '#28583e']`, lighting 0.4
- DenseForest: `['#163c1e', '#1e4a28', '#122e18', '#1a4224']`, no dithering, lighting 0.2

**Elevation:**
- Mountain: `['#6a7080', '#787e8e', '#5c6270', '#707888']`, lighting 0.7
- HighMountain: `['#8a90a0', '#98a0b0', '#a8b0c0', '#c0c8d8']`, snow at noise > 0.4, lighting 0.8

**Arid:**
- Desert: `['#c8a060', '#d0a868', '#b89850', '#c0a058']`, lighting 0.8
- Savanna: `['#a08838', '#b09840', '#8a7830', '#988034']`, lighting 0.7

**Cold:**
- Tundra: `['#7888a0', '#8898b0', '#6878a0', '#809098']`, lighting 0.5
- IceCap: `['#c8d0e0', '#d0d8e8', '#d8e0f0', '#e0e8f8']`, no dithering, lighting 0.6
- Taiga: `['#2e5840', '#386048', '#244c38', '#305a44']`, snow patches at noise > 0.5, lighting 0.4

**Wet:**
- Swamp: `['#3a5428', '#4a6430', '#2e4820', '#3c5830']`, lighting 0.3
- Jungle: `['#1a5c28', '#226830', '#146024', '#1e642c']`, no dithering, lighting 0.3

**Special:**
- Volcano: `['#3a2018', '#4a2820', '#2e1810', '#3e2418']`, lava at noise > 0.85, lighting 0.4
- MagicWasteland: `['#2e1840', '#381e48', '#241438', '#301a42']`, glow at noise > 0.75, lighting 0.5

**River:** water `['#2860a0', '#3070b0', '#2468a8']`, banks `['#5a7a48', '#6a8a58', '#807050']`, foam `['#90c0e0', '#a0d0e8']`

### Terrain Tile Algorithm (5 layers, 32x32px)

1. **Base Color:** SimplexNoise at freq 0.02, maps [-1,1] to [0,1], indexes into palette base array
2. **Texture Variation:** Noise at 0.08 freq. Above +0.3: blend 40% toward highlight. Below -0.3: blend 30% toward shadow
3. **Detail Specks:** Noise at 0.2 freq. Above 0.7 (top 15%): blend 60% of detail color
4. **Ordered Dithering:** 4x4 Bayer matrix `[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]`, modulated by noise at 0.15 freq
5. **Directional Lighting:** `1.0 + lightingStrength * 0.15 * (1.0 - (px + py) / (TILE_SIZE * 2))`

### Biome Transition Algorithm

1. Directional gradient (0.0 at biomeA, 1.0 at biomeB)
2. Domain warp at 0.08 freq, 6px magnitude for organic boundaries
3. Second noise at 0.1 freq: final blend = `gradient * 0.6 + noiseWarp * 0.4`
4. At blend zone (0.3-0.7): Bayer dithering for binary selection (no color interpolation)

### Tree Sprite Families

**Conifer:** Canopy `['#1a4a28', '#225830', '#1e5028', '#2a5c34']`, stacked triangle layers, left=highlight right=shadow
**Deciduous:** Canopy `['#3a6e38', '#447840', '#4a8248']`, trunk + noise-edged circular canopy
**Tropical:** Canopy `['#288038', '#308840', '#389048']`, tall curved trunk + radiating frond lines

Sizes: Small (6-8w x 8h), Medium (9-10w x 11h), Large (11-12w x 14h)

### Settlement Generation

**Castle tiers:**
| Tier | Size | Components |
|------|------|------------|
| Hamlet | 24x20 | Single tower, low walls |
| Village | 32x24 | Keep + 2 corner towers + walls |
| Town | 48x36 | Keep + 4 towers + gatehouse + courtyard |
| City | 64x48 | Tall keep + 4 outer + 2 inner towers + double wall |
| Capital | 80x56 | Grand palace + 6 towers + triple wall + barbican |

**Wall materials:** Stone `['#8a8a80', '#7a7a70', '#9a9a90']`, Wood `['#6a5438', '#5e4c30', '#745c40']`, Stucco `['#c8b898', '#c0b090', '#d0c0a0']`
**Roof styles:** Thatch, Slate, Tile (terracotta), Wood shingle

### Sprite Atlas Budget

| Atlas | Size | Contents | GPU Memory |
|-------|------|----------|------------|
| Terrain | 512x512 | 136 tiles at 32x32 | 1 MB |
| Transitions | 512x512 | ~80 tiles at 32x32 | 1 MB |
| Features | 256x256 | 36 trees + 12 rocks + vegetation | 256 KB |
| Structures | 1024x512 | 40 buildings + 5 castles + farms | 2 MB |
| UI | 256x256 | corners + edges + badges + icons | 256 KB |
| **Total** | | | **~5.5 MB** |

### Pixel Heraldry

Replaces ASCII coat of arms. Shield shapes: Knightly (heater), Round, Totem. Charges defined as 8x8 pixel patterns (sword, star, crown, tower, etc.). Uses same `generateCoatOfArms()` logic for deterministic decisions. Sizes: Badge 16x16, Marker 24x24, Panel 32x32, Large 48x48.

### Seasonal Color Shifts (via PixiJS ColorMatrixFilter)

| Season | Saturation | Hue | Brightness |
|--------|-----------|-----|------------|
| Spring | +10% | -5deg | +5% |
| Summer | base | 0 | base |
| Autumn | -15% | +25deg | -5% |
| Winter | -35% | -10deg | +10% |

---

## Appendix C: UI Component System (CSS Specifications)

### CSS Grid Root Layout
```css
.app-root {
  display: grid;
  grid-template-columns: 1fr minmax(420px, 35%);
  grid-template-rows: 36px 1fr 24px;
  grid-template-areas:
    "topbar  topbar"
    "map     panels"
    "status  status";
  width: 100vw;
  height: 100vh;
}
```

### Complete Color Palette (75 CSS Custom Properties)

**Backgrounds:**
- `--bg-app: #0a0a0e` (near-black with blue undertone)
- `--bg-panel: #16161c` (dark blue-charcoal)
- `--bg-surface: #1e1e24` (card backgrounds)
- `--bg-topbar: #111116`
- `--bg-statusbar: #0e0e12`

**Borders:**
- `--border-subtle: #1e1e22`
- `--border-default: #2a2825` (warm dark brown)
- `--border-ornament: #8b6914` (bronze metalwork)
- `--border-ornament-bright: #c9a84c` (gold highlight)

**Accents:**
- `--accent-gold: #8b6914`
- `--accent-gold-bright: #c9a84c`
- `--accent-parchment: #c9b896` (warm tan)

**Category Colors (desaturated from terminal):**
- Political: `#d4a832`, Military: `#c44040`, Economic: `#3aad6a`
- Social: `#6888c8`, Cultural: `#40b0c8`, Religious: `#b87acc`
- Magical: `#9040cc`, Personal: `#6088cc`, Disaster: `#cc6020`, Exploratory: `#70c040`

**Significance:**
- Trivial: `#444440`, Minor: `#686860`, Moderate: `#c4a840`
- Major: `#cc6830`, Critical: `#cc3030`, Legendary: `#d040c0` (with pulse animation)

**Text:**
- `--text-primary: #e0d8c4` (warm parchment)
- `--text-secondary: #b0a890`
- `--text-tertiary: #7a7060`
- `--text-accent: #c9b896` (gold-tan for headers)

**Entity Link Colors:**
- Character: `#6088cc`, Faction: `#cc8830`, Site: `#c8b040`
- Artifact: `#b850b8`, Region: `#50a868`

### Typography
- **Cinzel** (serif) - Panel titles, section headers, decorative text (10-18px)
- **Source Sans 3** (sans-serif) - Body text, descriptions, UI labels (11-14px)
- **JetBrains Mono** (monospace) - Timestamps, coordinates, data (10-11px)

### Panel Frame
- Background: `rgba(22, 22, 28, 0.92)` with 1px border `#2a2825`
- Ornate corner sprites (24x24px, L-shaped bronze metalwork), mirrored via CSS transforms
- Title bar: 32px, Cinzel 14px, gradient background, flanked by gold gradient lines
- Focus state: subtle gold inner glow `box-shadow: inset 0 0 0 1px rgba(139, 105, 20, 0.3)`

### Event Card
- 3px left border in category color
- Category badge: 22x22px colored square with white icon
- Title: Source Sans 3 13px semibold `#e0d8c4`
- Description: 12px regular `#8a8070`, 2-line clamp
- Timestamp: JetBrains Mono 10px `#4a4540`
- Significance dot: 4-8px colored circle, legendary has 2s pulse animation
- Entry animation: 200ms translateY(-4px) + opacity fade

### Inspector Panel
- Tab bar: active tab inverts to dark text on parchment background (`#c9b896`)
- Breadcrumbs: back button + entity trail with chevron separators
- Section headers: Cinzel 12px gold, collapse arrow, gradient line, right-aligned hint
- Collapsible sections with `max-height` transition
- Card grid: 2-column CSS Grid for dashboard view (parchment headers on mini-cards)

### Top Bar
- Logo: "AETHERUM" in Cinzel 12px `#8b6914`, 3px letter-spacing
- Date display: Cinzel 14px `#c9b896`
- Speed controls: 5 buttons (26x24px), active = gold `#8b6914`, pause active = red `#cc4040`
- View tabs: 2px bottom border accent on active

### Status Bar
- 24px, JetBrains Mono 10px, `#4a4540` labels / `#7a7060` values
- Items: Tick, Entities, Events, Layout, FPS

### CSS File Organization (14 files)
1. variables.css, 2. reset.css, 3. typography.css, 4. layout.css
5. panel-frame.css, 6. event-log.css, 7. inspector.css, 8. topbar.css
9. statusbar.css, 10. icons.css, 11. scrollbar.css, 12. animations.css
13. tooltip.css, 14. modal.css
(All imported via index.css)

### Responsive Breakpoints
- 1920px+: Full detail (65% map / 35% panels)
- 1600px: Slightly wider panels (62/38)
- 1280px: Minimum supported (58/42), reduced padding
- Below 1280px: Warning overlay

### Sprite Assets Needed
- `corner-ornament.png` (24x24) - L-bracket corner, 1 orientation (CSS mirrors)
- `ui-icons.png` (160x32) - 10x2 grid of 16x16 icons
- `divider-ornament.png` (32x8) - Section divider center piece
- `parchment-noise.png` (128x128) - Tileable texture overlay
- `hourglass.png` (64x16) - 4-frame loading animation
