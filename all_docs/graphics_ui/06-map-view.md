## 6. Map View

### 6.1 Terrain Rendering

The map canvas is a PixiJS Container holding a grid of tile sprites. Each tile is
a 16x24 pixel sprite drawn from the glyph atlas and tinted with palette colors.

**Rendering pipeline per visible tile:**

1. Look up world tile at `(viewportX + col, viewportY + row)`
2. Get biome type from terrain data
3. Select glyph from biome's weighted glyph pool using `noise(worldX, worldY)`
4. Render background rectangle in biome's background palette color
5. Render glyph sprite tinted with biome's primary palette color
6. If overlay active, apply overlay modification (may change char/fg/bg)

**Glyph pools per biome** (weight-selected, inheriting from current
`biome-render-config.ts`):

```
Plains:      .40  ,20  mid-dot15  '10  "10  `05
Forest:      spade25  club25  up-arrow15  tau10  "10  '08  .07
DenseForest: spade30  club30  up-arrow15  Gamma10  tau10  "05
Mountain:    house25  triangle25  caret20  intersection20  n10
HighMountain: triangle40  caret30  house20  intersection10
Ocean:       approx40  tilde35  sim-tilde25
Desert:      .25  mid-dot20  degree15  ,10  ~10  acute05  V05  sqrt05  approx05
Swamp:       ~30  club20  .15  ,15  '10  "10
Jungle:      block20  spade20  club20  Gamma15  up-arrow15  tau10
Savanna:     .30  ,20  '15  mid-dot15  up-arrow10  "10
Tundra:      bullet20  mid-dot25  degree20  *10  super-n10  light-shade10  mid-shade05
IceCap:      light-shade30  mid-shade25  dense-shade15  degree15  *15
Taiga:       up-arrow25  spade20  club20  .15  '10  mid-dot10
Volcano:     triangle35  caret25  dense-shade20  mid-shade10  *10
MagicWaste:  dense-shade20  mid-shade20  *15  mid-dot15  bullet15  ?15
```

### 6.2 Settlement Markers

Settlements are entity markers rendered on top of terrain tiles. They replace the
terrain glyph with an entity marker glyph.

| Entity Type | Glyph | Color | Visible at Zoom |
|---|---|---|---|
| Village | sun-small | CP #d4a832 | Level 1 only |
| Town | sun-medium | CP #d4a832 | Level 1-2 |
| City | sun-large | CP #d4a832 | Level 1-3 |
| Capital | flag | AU2 #c9a84c | Level 1-3 |
| Ruin | dagger | N1 #585860 | Level 1 only |
| Temple | star-6pt | CR #b87acc | Level 1 only |
| Academy | sparkle | CC #40b0c8 | Level 1 only |

### 6.3 Territory Overlay

When the Political overlay is active, each tile's background color shifts toward
the controlling faction's palette-mapped color. The shift follows palette mixing
rules (no off-palette intermediates):

- Uncontested territory: background changes to the palette color closest to a
  30% blend of the biome background and the faction color
- Border tiles: use a brighter variant of the faction color for the background

Territory is computed by flood-fill from faction capitals (existing
`overlay-bridge.ts` logic), cached per tick, and invalidated when territorial
events fire.

### 6.4 Army Markers

Moving armies are shown as directional arrow glyphs in CM (#c44040). The arrow
direction matches the army's current movement vector:

```
North: up-arrow      South: down-arrow
East: right-arrow    West: left-arrow
NE/NW/SE/SW: diagonal arrow glyphs
Stationary: crossed-swords glyph
Besieged: gear glyph in CM on CM-tinted background
```

### 6.5 Trade Routes

When the Economic overlay is active, trade routes between settlements are drawn
using box-drawing characters in AU2 (#c9a84c):

```
Horizontal segment:  horizontal-line glyph
Vertical segment:    vertical-line glyph
Corner:              appropriate box-drawing corner glyph
Intersection:        cross glyph
Trade hub:           house glyph in brighter AU2
```

This reuses the existing `TradeOverlay` connection pattern logic.

### 6.6 Magic Overlay

Ley lines appear as dotted lines in FM (#9040cc). Magical anomalies tint the
background toward FM. Artifacts show a four-pointed-star glyph in FM.

### 6.7 Map Viewport Controls

| Action | Input | Effect |
|---|---|---|
| Pan | Arrow keys, WASD, click-drag | Move viewport 1 tile per keypress |
| Zoom in | Scroll up, `+` key | Switch to next closer zoom level |
| Zoom out | Scroll down, `-` key | Switch to next farther zoom level |
| Center on entity | Click entity in chronicle | Pan viewport to entity location |
| Cycle overlay | `O` key | None -> Political -> Military -> Economic -> Arcane -> Climate -> Full |

### 6.8 Map Tooltips

Hovering over a tile for 300ms shows a tooltip anchored to the mouse cursor:

```
+--[N0 border]-------------------+
|  Plains  (34, 17)              |  <- N3 text, Mono font
|  Faction: House Ashford        |  <- N2 text, faction color for name
|  Resources: Food, Timber       |  <- N2 text
|  Settlement: Thornwall (Town)  |  <- only if settlement present
+--------------------------------+

Background: BG2 (#22222c)
Border: 1px solid N0 (#3a3a44)
Max width: 280px
Padding: 8px 10px
No border radius (pixel art aesthetic).
No drop shadows.
```
