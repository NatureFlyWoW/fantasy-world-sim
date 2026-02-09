## 13. Technical Approach

### 13.1 Rendering Architecture

```
Electron Main Process
  |
  +-- WorldSimulation (ECS World, tick loop)
  |     sends delta updates per tick via IPC
  |
  +-- Electron BrowserWindow
        |
        +-- Renderer Process
              |
              +-- PixiJS Application (WebGL canvas)
              |     |
              |     +-- TilemapContainer (visible tile sprite grid)
              |     +-- OverlayContainer (territory, trade, magic)
              |     +-- MarkerContainer (settlements, armies)
              |     +-- AnimationLoop (water shimmer, flags)
              |
              +-- HTML/CSS Panels (DOM)
                    |
                    +-- TopBar (nav element)
                    +-- PanelColumn (flex column)
                    |     +-- EventLogPanel (scrollable div)
                    |     +-- ResizeDivider
                    |     +-- InspectorPanel (scrollable div)
                    +-- StatusBar (div)
                    +-- TooltipLayer (fixed positioned)
                    +-- ModalLayer (fixed positioned)
```

### 13.2 PixiJS Map Rendering

The map uses a `Container` with child sprites for each visible tile. Sprites are
recycled from an object pool when the viewport scrolls.

**Tile sprite pool:**
- Size: `viewportCols * viewportRows` sprites (e.g., 78 * 42 = 3,276)
- Each sprite: `Sprite` with texture from glyph atlas region
- Position: `(col * 16, row * 24)` pixels
- Background: `Graphics` rectangle drawn beneath each sprite
- Tint: applied via `sprite.tint` for palette color
- Scale mode: `SCALE_MODES.NEAREST` for pixel-perfect rendering

**Rendering order per frame:**
1. Clear background rectangles for visible tiles
2. Update sprite textures and tints (biome + noise selection)
3. Apply overlay modifications (territory tint, trade routes, etc.)
4. Update entity marker sprites (settlements, armies)
5. Run animation frame updates (water, lava, flags) at 15fps cadence

### 13.3 Sprite Sheet Organization

```
packages/renderer/assets/
  sprites/
    glyph-atlas.png        256x384px   16x16 grid of 16x24 glyph cells
    icon-atlas.png          160x32px    10x2 grid of 16x16 icon cells
    charge-atlas.png        64x64px     4x4 grid of 16x16 heraldic charges
    corner-ornament.png     24x24px     single corner, mirrored via CSS
    hourglass-anim.png      64x16px     4 frames x 16x16
  fonts/
    display-8x12.png        128x192px   16x16 grid of 8x12 glyph cells
    body-6x10.png           96x160px    16x16 grid of 6x10 glyph cells
```

All assets use `image-rendering: pixelated` / `image-rendering: crisp-edges`.

### 13.4 Data Flow (IPC)

**Simulation -> Renderer (per tick):**

```typescript
interface TickDelta {
  tick: number;
  time: { year: number; month: number; day: number };
  events: WorldEvent[];           // new events this tick
  changedEntities: EntityDelta[]; // components that changed
  removedEntities: EntityId[];    // entities removed
}
```

**Initial load (once):**

```typescript
interface WorldSnapshot {
  map: TerrainTile[][];           // 128x128 grid
  entities: EntitySnapshot[];     // all entities with components
  events: WorldEvent[];           // accumulated events
  factions: FactionSnapshot[];    // colors, names, heraldry properties
}
```

**Inspector queries (on demand, invoke/handle):**

```typescript
interface InspectorQuery {
  type: 'character' | 'faction' | 'site' | 'artifact' | 'event' | 'region';
  id: EntityId | EventId;
}

interface InspectorResponse {
  sections: InspectorSection[];   // pre-formatted section data
  prose: string[];                // prose paragraphs per section
  relatedEntities: EntityRef[];   // clickable references with IDs
}
```

### 13.5 Performance Targets

| Metric | Target | Method |
|---|---|---|
| Map render (full redraw) | < 8ms | PixiJS sprite batch |
| Map render (scroll 1 tile) | < 2ms | Pool recycle + position update |
| Event card append | < 1ms | DOM insertion |
| Inspector navigation | < 16ms | Full panel rebuild |
| IPC tick delta | < 2ms | Structured clone transfer |
| World generation (128x128) | < 5s | Main process, blocking |
| Total frame budget | < 16ms (60fps) | requestAnimationFrame |

### 13.6 CSS File Organization

```
packages/renderer/src/styles/
  index.css             imports all below in order
  variables.css         28 palette colors + semantic aliases + typography vars
  reset.css             box-sizing, margin reset, pixel art rendering
  typography.css        font imports, size scale classes
  layout.css            CSS Grid root, responsive breakpoints
  panel-frame.css       panel chrome, corners, titlebar, focus, resize
  event-log.css         chronicle modes, event cards, badges, temporal headers
  inspector.css         tabs, breadcrumbs, sections, prose, data rows, cards
  topbar.css            logo, date, speed controls, view tabs
  statusbar.css         status items, separators
  icons.css             icon sprite classes and size variants
  scrollbar.css         custom scrollbar styling
  animations.css        keyframes, transition defaults
  tooltip.css           tooltip positioning and content
  modal.css             modal backdrop, dialog, buttons
```

### 13.7 CSS Custom Properties (variables.css)

```css
:root {
  /* ===== MASTER PALETTE (28 colors) ===== */

  /* Backgrounds */
  --bg0: #0c0c14;  --bg1: #16161e;  --bg2: #22222c;  --bg3: #2e2e38;

  /* Neutrals */
  --n0: #3a3a44;   --n1: #585860;   --n2: #8a8a90;   --n3: #c8c8cc;

  /* Chrome */
  --au0: #6b4e0a;  --au1: #8b6914;  --au2: #c9a84c;

  /* Parchment */
  --pa0: #8a7856;  --pa1: #c9b896;

  /* World - Terrain */
  --tw: #1a3860;   --ts: #2868a0;   --tg: #4a7c3e;   --tf: #2a5c34;
  --tm: #6a7080;   --td: #c8a060;

  /* World - Features */
  --fs: #d0d8e8;   --fl: #e04020;   --fm: #9040cc;

  /* Semantic - Categories */
  --cp: #d4a832;   --cm: #c44040;   --ce: #3aad6a;
  --cs: #6888c8;   --cr: #b87acc;   --cc: #40b0c8;

  /* ===== SEMANTIC ALIASES ===== */
  --text-primary:    var(--n3);
  --text-secondary:  var(--n2);
  --text-tertiary:   var(--n1);
  --text-disabled:   var(--n0);
  --text-accent:     var(--pa1);
  --text-link:       var(--cs);
  --text-danger:     var(--cm);
  --text-success:    var(--ce);

  --border-default:  var(--n0);
  --border-strong:   var(--n1);
  --border-ornament: var(--au1);

  --bg-panel:        var(--bg1);
  --bg-card:         var(--bg2);
  --bg-hover:        var(--bg3);

  /* ===== TYPOGRAPHY ===== */
  --font-display: 'Cinzel', 'Palatino Linotype', serif;
  --font-body:    'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Consolas', monospace;

  --text-xs:   10px;  --text-sm:   11px;  --text-base: 13px;
  --text-md:   14px;  --text-lg:   16px;  --text-xl:   18px;
  --text-2xl:  22px;

  /* ===== SPACING ===== */
  --space-xs: 2px;   --space-sm: 4px;   --space-md: 8px;
  --space-lg: 12px;  --space-xl: 16px;  --space-2xl: 24px;

  /* ===== TRANSITIONS ===== */
  --transition-fast:   100ms ease;
  --transition-normal: 150ms ease;
  --transition-slow:   250ms ease;
  --transition-panel:  200ms ease-out;
}
```

### 13.8 Data Reuse from Current Blessed Renderer

**70% of current renderer code is reusable** (extracted as pure-logic adapters):

| Source File | LOC | Reusable | Strategy |
|---|---|---|---|
| `overlay-bridge.ts` | 1,092 | 92% | Extract flood-fill, trade tracing, dirty tracking |
| `event-formatter.ts` | 571 | 91% | Extract prose generation, verb maps |
| `event-aggregator.ts` | ~400 | 100% | Use directly (pure logic, no blessed dependency) |
| `event-filter.ts` | ~200 | 100% | Use directly (pure logic) |
| `inspector-prose.ts` | 343 | 100% | Use directly (lookup tables) |
| `character-inspector.ts` | 774 | 58% | Extract ECS query logic |
| `faction-inspector.ts` | 844 | 57% | Extract ECS query logic |
| `inspector-panel.ts` | 1,366 | 70% | Extract navigation, type detection |
| `tile-renderer.ts` | 316 | 82% | Extract biome-to-color mapping |
| `overlay.ts` | 759 | 72% | Extract overlay types, presets, base logic |

Strategy: Create `packages/electron/src/renderer/data/` adapters that port the
pure-logic portions. The blessed-specific 30% (tag formatting, box rendering,
key handlers) is replaced by HTML/CSS/PixiJS equivalents.
