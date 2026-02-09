## 3. Tile & Grid System

### 3.1 Tile Dimensions

**Tile size: 16x24 pixels** (width x height).

This is the same aspect ratio Caves of Qud uses, and it exists for a reason: the
16:24 ratio (2:3) accommodates readable glyphs inside each cell. A 16x16 tile
makes characters look squat. A 16x24 tile gives vertical breathing room for
ascenders and descenders, and it makes the map feel taller -- more like a landscape
viewed from above than a floor plan.

```
Single tile anatomy (16x24 pixels):

+----------------+   16px wide
|                |
|    BG fill     |   Background: solid palette color
|                |
|   ####         |   Primary glyph: rendered in glyph color
|   #  #         |   from a bitmap font or glyph atlas
|   ####         |
|   #            |
|   #            |
|                |
|      ..        |   Detail: small accent pixels in detail color
|     . .        |   (noise-driven placement, optional per biome)
|                |
+----------------+   24px tall
```

### 3.2 Grid Dimensions

At 1920x1080 resolution with the panel column taking 35% width:

- **Map area:** 1248 x 1020 pixels (after top bar 36px + status bar 24px)
- **Map grid:** 78 columns x 42 rows = 3,276 visible tiles
- **World size:** 128x128 tiles (the full generated world)
- **Zoom levels:** 3 discrete levels
  - Level 1 (closest): 1 world tile = 1 screen tile (16x24px per tile)
  - Level 2 (medium): 4 world tiles = 1 screen tile (2x2 composited)
  - Level 3 (world): 16 world tiles = 1 screen tile (4x4 composited)

At zoom level 3, the entire 128x128 world fits in 32x32 screen tiles = 512x768px,
well within the map viewport. This gives the player a "pull back and see everything"
option.

### 3.3 Glyph Atlas

Rather than rendering individual Unicode characters at runtime (expensive, font-
dependent), all tile glyphs are pre-rendered into a **glyph atlas** -- a sprite
sheet of 16x24 pixel glyphs in a single color (white), tinted at render time.

**Atlas layout:** 16 columns x 16 rows = 256 glyph slots = 256x384 pixel atlas.

**Glyph assignments by category:**

```
Row 0-1:  Terrain glyphs (32 slots)
  Plains:  . , ' " ` middle-dot
  Forest:  spade, club, up-arrow, tau, double-quote
  Mountain: triangle, caret, house, intersection
  Water:   tilde, approx, wave
  Desert:  dot, degree, comma
  Snow:    light-shade, medium-shade, degree, asterisk

Row 2-3:  Entity markers (32 slots)
  Settlement: sun (large/small), house
  Capital: flag, crown
  Ruin: dagger, broken-column
  Army: crossed-swords, arrow-N/S/E/W/NE/NW/SE/SW
  Temple: cross, star
  Academy: sparkle
  Character: @
  Artifact: four-pointed-star

Row 4-5:  Overlay glyphs (32 slots)
  Trade routes: box-drawing chars (horizontal, vertical, corners, tees, cross)
  Resources: coins, gem, pickaxe, herb, fish
  Magic: ley-line dots, anomaly, crystal

Row 6-7:  UI glyphs (32 slots)
  Category icons: crown, swords, coins, figures, scroll, star,
                  crystal, portrait, flame, compass
  Navigation: arrows, back, forward, collapse/expand
  Status: checkmark, warning, error, hourglass

Rows 8-15: Reserved for future expansion
```

### 3.4 Tile Composition at Render Time

Each visible tile is drawn in three passes:

1. **Background fill:** A solid rectangle of the biome's background palette color.
2. **Primary glyph:** A glyph from the atlas, tinted with the biome's primary color.
   The specific glyph is selected by noise (seeded by world position), giving each
   tile a different character from its biome's pool. Weight tables control frequency
   (e.g., plains: 40% dot, 20% comma, 15% middle-dot, etc.).
3. **Detail pass (optional):** For biomes with dithering enabled, a small number
   of pixels in the detail color are placed using high-frequency noise. This breaks
   up the flatness without adding a new glyph.

```
Example: Plains tile at world position (34, 17)

Step 1: Fill 16x24 rect with BG1 (#16161e)
Step 2: Noise selects glyph "." from plains pool -> render in TG (#4a7c3e)
Step 3: 3 detail pixels placed at noise-driven positions in TD (#c8a060)

Result: Dark background, green dot, with a few sand-colored specks.
The tile next to it might get "," or "'" -- same colors, different glyph.
```

### 3.5 Top-Down vs Isometric

**Decision: Top-down for Phase 1.** The mockup images show isometric pixel art,
which looks beautiful, but isometric rendering dramatically increases complexity:

- Tile sorting requires depth ordering
- Click detection needs coordinate transformation
- Overlapping tiles require careful z-ordering
- Performance cost is 2-3x higher per tile
- Terrain transitions become four-directional instead of rectilinear

Top-down with the constrained palette produces a Caves of Qud / Dwarf Fortress
aesthetic that is equally compelling and far more practical. The 16x24 tile ratio
and biome-specific glyph pools create visual richness without isometric complexity.

If isometric is desired in the future, it can be added as a second rendering mode
that shares the same glyph atlas and palette, with additional tile-stacking logic.
