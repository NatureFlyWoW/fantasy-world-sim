## 11. Procedural Art Generation

### 11.1 Design Principle: Everything From the Seed

Every visual asset is generated procedurally from the world seed. Same seed
produces identical visuals across sessions. No hand-authored sprite files are
required for world content (UI chrome sprites are hand-authored).

### 11.2 Terrain Tile Generation

All terrain tiles are generated at world-load time from the world seed. The
procedural pipeline produces tile variant tables that determine per-tile
glyph selection and detail pixel placement.

**Tile variant system:**

Each biome has 8 tile variants (4 base + 4 detail). The variant is selected at
render time by `hash(worldX, worldY) % 8`. Each variant uses different glyph
weights and detail pixel placements, giving local visual variety without breaking
the palette constraint.

**Generation algorithm per variant:**

```
1. Fork SeededRandom from (worldSeed + biomeHash + variantIndex)
2. Select glyph from weighted pool using seeded random
3. Pre-compute detail pixel positions (0-5 per tile) using noise
4. Store as TileVariant { glyphIndex: number, detailPositions: [x,y][] }
```

At render time, the variant table is consulted per-tile for O(1) lookup. No
per-pixel computation at render time -- all procedural work happens at load.

### 11.3 Faction Heraldry Generation

The existing heraldry system (`widgets/heraldry.ts`) generates shields from
faction properties. For the pixel art renderer, the ASCII output is replaced
with canvas rendering:

**Shield sprite generation pipeline:**

```
Input: FactionProperties { culture, color, militaryStrength, ... }

1. Select shield shape from culture (knightly/round/totem)
2. Select field division from faction tendencies
3. Map faction color to nearest palette entry -> primary tincture
4. Select secondary tincture (contrast rule: light primary -> dark secondary)
5. Select charge category from dominant tendency
6. Render 48x48 canvas:
   a. Draw shield outline (2px border in AU0 #6b4e0a)
   b. Fill field with division pattern using primary/secondary tinctures
   c. Stamp charge glyph from charge atlas, centered
7. Cache as PixiJS Texture
```

**Charge atlas layout (64x64px, 4x4 grid of 16x16 glyphs):**

```
Row 0: Lion, Eagle, Dragon, Serpent     (animal charges)
Row 1: Sword, Axe, Shield, Tower       (weapon charges)
Row 2: Tree, Mountain, Star, Moon      (nature charges)
Row 3: Cross, Chalice, Eye, Book       (religious charges)
```

All charges are drawn in white, tinted at render time with the appropriate
tincture palette color.

### 11.4 Settlement Sprite Variation (Future Phase)

At future higher-resolution zoom levels, settlements could show a small cluster
of building glyphs instead of a single marker:

```
Village (pop < 500):    one house glyph
Town (pop 500-5000):    house + market glyph
City (pop 5000+):       house + market + wall glyph
Capital:                flag + house + market + wall glyph
```

Phase 1 uses single-glyph markers. This is a stretch goal.

### 11.5 Seasonal Palette Shifts (Future Phase)

If seasonal variation is desired, the terrain palette can shift per season. This
does NOT add new colors -- it remaps which palette entries biomes use:

| Season | Plains Primary | Forest Primary | Tundra Detail |
|---|---|---|---|
| Spring | TG #4a7c3e | TF #2a5c34 | TS #2868a0 |
| Summer | TG #4a7c3e | TF #2a5c34 | TG #4a7c3e |
| Autumn | TD #c8a060 | CP #d4a832 | TD #c8a060 |
| Winter | N2 #8a8a90 | TF #2a5c34 | FS #d0d8e8 |

Visible seasonal shift using only the existing 28 palette colors. Autumn turns
forests golden; winter adds gray to plains and white to tundra.

### 11.6 Noise Infrastructure

The existing `SimplexNoise` class from `packages/renderer/src/map/simplex-noise.ts`
and its `fbm()` function are reused. A `SeededRandom` wrapper (already specified in
`procgen-pixel-art-system.md`) provides integer/float/choice helpers and a `fork()`
method for independent sub-streams.
