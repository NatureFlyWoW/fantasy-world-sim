# Aetherum Graphics & UI Remake

## A Complete Visual Design and Interaction Specification

> From ASCII terminal to constrained pixel art. Not retro for nostalgia -- retro because
> constraints produce clarity, and clarity serves a game about observing centuries of history.

**Revision:** 2.0 -- 2026-02-09
**Target platform:** Electron + PixiJS (map canvas) + HTML/CSS (panels)
**Current state:** blessed terminal UI (8 panels, 5 layouts, 2955 tests)

---

## Table of Contents

1. [Visual Philosophy](#1-visual-philosophy)
2. [Color System](#2-color-system)
3. [Tile & Grid System](#3-tile--grid-system)
4. [Typography](#4-typography)
5. [Panel System](#5-panel-system)
6. [Map View](#6-map-view)
7. [Chronicle / Event Log](#7-chronicle--event-log)
8. [Inspector System](#8-inspector-system)
9. [Interaction Design](#9-interaction-design)
10. [Animation & Motion](#10-animation--motion)
11. [Procedural Art Generation](#11-procedural-art-generation)
12. [Accessibility](#12-accessibility)
13. [Technical Approach](#13-technical-approach)
14. [Implementation Roadmap](#14-implementation-roadmap)

---

## 1. Visual Philosophy

### 1.1 The Caves of Qud Principle

Caves of Qud proves that a fixed, constrained palette -- 18 colors in their case --
produces visual cohesion that unconstrained palettes never achieve. Every tile uses
exactly three color slots: a primary glyph color, a detail/secondary color, and a
background color. The result is not "retro" in any nostalgic sense. It is *designed*.
The constraints are the design.

Aetherum adopts this principle with a wider but still bounded palette of 28 colors.
The constraint is that every visual element on screen -- terrain tiles, UI chrome,
event cards, inspector text -- draws exclusively from this palette. No gradients.
No alpha blending that produces off-palette intermediates. No arbitrary hex codes
invented per-component. Twenty-eight colors, used everywhere, producing a world
that feels unified even as it displays political maps, character inspectors, and
prose chronicles simultaneously.

### 1.2 Not Trying to Look Old

The goal is not to simulate a CRT monitor, a VGA card, or a specific era of hardware.
There are no scan lines. There is no vignetting. There is no fake screen curvature.
The aesthetic is *tile-based clarity* -- the same principle that makes subway maps,
chess boards, and spreadsheets readable. Each tile is a discrete unit of information.
Each color has a semantic meaning. The eye can parse the map at a glance because
the vocabulary is small and consistent.

This approach is *modern* in its UX thinking. Tooltips appear instantly. Panels
resize smoothly. Click targets are generous. Keyboard shortcuts have visual feedback.
The rendering technology is contemporary (PixiJS WebGL). Only the visual language
is constrained.

### 1.3 The Observation Fantasy

Aetherum is not an action game. The player watches centuries unfold. The UI must
serve this specific fantasy: **the god's-eye chronicler**, peering down at a living
world, watching factions rise and fall, characters scheme and die, empires expand
and crumble. The visual design supports this by:

- Making the map the dominant visual element (65-70% of screen)
- Treating the chronicle as a medieval manuscript, not a chat log
- Presenting entity details as prose first, data second
- Using restrained color to avoid visual fatigue over long sessions
- Ensuring text is readable at sizes that allow information density

The player should feel like they are reading an illuminated manuscript that updates
in real time, with a living map as its centerpiece illustration.

### 1.4 Why Constraints Inspire Rather Than Limit

A constrained palette forces every color decision to be intentional. When you have
16 million hex codes available, you reach for "close enough" and end up with
a UI that has 47 shades of gray. When you have four shades of gray (BG0-BG3),
each shade carries meaning:

- BG0: the void, the deepest layer, the app edge
- BG1: the surface, the panel background, the reading area
- BG2: the card, the elevated element, the thing worth noticing
- BG3: the hover, the "you are touching this," the interactive response

This semantic clarity extends to every palette group. The six terrain colors are
not decorative -- they are a mapping language. The six semantic colors are not
branding -- they are event categories made visible. The constraints produce a
visual system where nothing is arbitrary.

### 1.5 Reference Points

| Reference | What We Take From It |
|---|---|
| Caves of Qud | Constrained palette, tile grid, three-colors-per-tile |
| Dwarf Fortress (Steam) | Tile variation within biomes, entity markers on map |
| Crusader Kings III | Information hierarchy in character/faction panels |
| Total War campaign map | Territory visualization, army markers, trade routes |
| Medieval manuscripts | Decorative borders, section ornaments, serif headers |

What we explicitly avoid:
- Isometric 3D perspective in Phase 1 (adds complexity; possible future mode)
- High-fidelity pixel art with anti-aliasing (breaks the constrained palette)
- Animated character sprites (the game has no real-time action)
- Scan lines, vignetting, CRT effects (the user explicitly excluded these)
- Fake-retro screen distortion of any kind

---

## 2. Color System

### 2.1 The Master Palette (28 Colors)

Every pixel on screen uses one of these 28 colors. The palette is organized into
functional groups. HSL values are canonical; hex codes are derived.

```
PALETTE INDEX AND HEX VALUES

Backgrounds (4 colors):
  BG0  #0c0c14    HSL(240, 25%, 6%)     -- deepest background, app root
  BG1  #16161e    HSL(240, 15%, 10%)    -- panel backgrounds
  BG2  #22222c    HSL(240, 13%, 15%)    -- card surfaces, elevated elements
  BG3  #2e2e38    HSL(240, 10%, 20%)    -- hover states, active surfaces

Neutrals (4 colors):
  N0   #3a3a44    HSL(240, 8%, 25%)     -- borders, dividers, disabled
  N1   #585860    HSL(240, 4%, 36%)     -- tertiary text, deemphasized
  N2   #8a8a90    HSL(240, 3%, 55%)     -- secondary text, metadata
  N3   #c8c8cc    HSL(240, 5%, 80%)     -- primary text, body content

Chrome (3 colors):
  AU0  #6b4e0a    HSL(40, 82%, 23%)     -- deep bronze, ornament shadows
  AU1  #8b6914    HSL(40, 74%, 31%)     -- bronze, borders, accents
  AU2  #c9a84c    HSL(42, 50%, 54%)     -- gold, highlights, headers

Parchment (2 colors):
  PA0  #8a7856    HSL(36, 22%, 44%)     -- dark parchment, subtle accents
  PA1  #c9b896    HSL(38, 28%, 69%)     -- light parchment, tab fills, titles

World - Terrain (6 colors):
  TW   #1a3860    HSL(214, 56%, 24%)    -- deep water
  TS   #2868a0    HSL(208, 58%, 39%)    -- shallow water, rivers
  TG   #4a7c3e    HSL(108, 33%, 36%)    -- grassland, plains
  TF   #2a5c34    HSL(138, 37%, 26%)    -- forest, dense vegetation
  TM   #6a7080    HSL(220, 8%, 46%)     -- mountain, stone
  TD   #c8a060    HSL(38, 50%, 58%)     -- desert, sand, dry ground

World - Features (3 colors):
  FS   #d0d8e8    HSL(220, 32%, 86%)    -- snow, ice caps
  FL   #e04020    HSL(10, 75%, 50%)     -- lava, fire, volcanism
  FM   #9040cc    HSL(270, 55%, 52%)    -- magic, arcane energy

Semantic - Categories (6 colors):
  CP   #d4a832    HSL(42, 64%, 51%)     -- political (golden amber)
  CM   #c44040    HSL(0, 53%, 51%)      -- military (crimson)
  CE   #3aad6a    HSL(148, 50%, 45%)    -- economic (forest green)
  CS   #6888c8    HSL(216, 38%, 60%)    -- social / personal (steel blue)
  CR   #b87acc    HSL(280, 36%, 64%)    -- religious (lavender)
  CC   #40b0c8    HSL(190, 53%, 52%)    -- cultural / exploratory (teal)
```

### 2.2 Palette Rules

**Rule 1: Three colors per tile.** Every map tile uses exactly three palette entries:
one for the background fill, one for the primary glyph, and one for detail elements.
This mirrors Caves of Qud's approach and ensures visual consistency.

**Rule 2: No off-palette colors.** UI elements, text, borders, badges -- everything
uses palette colors. If a new visual element cannot be expressed with the existing
28 colors, the design is wrong, not the palette.

**Rule 3: Faction colors are drawn from the palette.** The first 6-8 factions are
assigned colors from the semantic category group (CP, CM, CE, CS, CR, CC) plus
AU2 and FM as additional faction slots. If more factions exist, they reuse colors
with distinct geometric symbols for differentiation.

**Rule 4: Significance uses brightness, not hue.** Event significance maps to the
neutral scale:

| Significance | Color | Usage |
|---|---|---|
| Trivial (0-19) | N0 #3a3a44 | Nearly invisible indicator |
| Minor (20-39) | N1 #585860 | Subtle gray dot |
| Moderate (40-59) | AU1 #8b6914 | Bronze dot |
| Major (60-79) | AU2 #c9a84c | Gold dot |
| Critical (80-94) | CM #c44040 | Red dot |
| Legendary (95-100) | FM #9040cc | Purple dot, pulsing |

### 2.3 Biome Color Assignments

Each biome uses three palette colors for its tile rendering:

| Biome | Background | Primary Glyph | Detail |
|---|---|---|---|
| Deep Ocean | BG0 #0c0c14 | TW #1a3860 | TS #2868a0 |
| Ocean | TW #1a3860 | TS #2868a0 | N2 #8a8a90 |
| Coast | TS #2868a0 | TD #c8a060 | TG #4a7c3e |
| Plains | BG1 #16161e | TG #4a7c3e | TD #c8a060 |
| Forest | BG0 #0c0c14 | TF #2a5c34 | TG #4a7c3e |
| Dense Forest | BG0 #0c0c14 | TF #2a5c34 | BG1 #16161e |
| Mountain | BG2 #22222c | TM #6a7080 | N2 #8a8a90 |
| High Mountain | TM #6a7080 | N2 #8a8a90 | FS #d0d8e8 |
| Desert | BG1 #16161e | TD #c8a060 | AU0 #6b4e0a |
| Tundra | BG2 #22222c | N2 #8a8a90 | FS #d0d8e8 |
| Swamp | BG0 #0c0c14 | TF #2a5c34 | TS #2868a0 |
| Jungle | BG0 #0c0c14 | TF #2a5c34 | CE #3aad6a |
| Savanna | BG1 #16161e | TD #c8a060 | TG #4a7c3e |
| Taiga | BG0 #0c0c14 | TF #2a5c34 | FS #d0d8e8 |
| Ice Cap | BG2 #22222c | FS #d0d8e8 | N2 #8a8a90 |
| Volcano | BG0 #0c0c14 | FL #e04020 | TM #6a7080 |
| Magic Wasteland | BG0 #0c0c14 | FM #9040cc | N1 #585860 |

### 2.4 Colorblind Considerations

The palette was designed with deuteranopia and protanopia in mind. Critical
distinctions are always encoded with shape or position in addition to color:

- Political (gold/amber) vs Military (red): crown badge vs crossed-sword badge
- Economic (green) vs Cultural (teal): coin icon vs scroll icon
- Forest (dark green) vs Plains (medium green): dense glyphs vs sparse glyphs

An optional high-contrast mode remaps the 6 semantic colors to maximize perceptual
distance for all three major colorblind types. See Section 12.2 for details.

---

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

---

## 4. Typography

### 4.1 Font Strategy

The game uses **two font contexts**: bitmap fonts on the PixiJS map canvas, and
web fonts in the HTML/CSS panels.

**Map canvas fonts (bitmap, pixel-perfect):**

A custom 8x12 bitmap font for map labels and a 6x10 bitmap font for tiny overlays.
Both are rendered via the glyph atlas as tinted sprites. No TrueType rendering, no
anti-aliasing on the map -- everything is snapped to the pixel grid, using palette
colors only.

```
Display bitmap font (8x12 pixels per glyph):

"A"          "E"          "R"
 .####.       ######       #####.
 ##..##       ##....       ##..##
 ##..##       ##....       ##..##
 ######       #####.       #####.
 ##..##       ##....       ##..#.
 ##..##       ##....       ##.##.
 ##..##       ######       ##..##
```

These fonts ship as sprite atlases and are rendered by the PixiJS sprite batch.

**Panel fonts (web fonts, CSS-rendered):**

Panel text (chronicle entries, inspector content) is rendered as HTML/CSS. This
allows text selection, copy-paste, and smooth scrolling. The web fonts approximate
the medieval-scholarly aesthetic of the bitmap fonts:

```css
:root {
  --font-display: 'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif;
  --font-body: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Consolas', monospace;
}
```

Cinzel provides medieval character for panel titles and section headers. Source Sans 3
provides excellent readability for prose and data. JetBrains Mono provides clear
monospace for timestamps, coordinates, and technical data.

### 4.2 Size Hierarchy

| Level | Font Family | Size | Weight | Color | Usage |
|---|---|---|---|---|---|
| Display XL | Cinzel | 22px | 700 | PA1 #c9b896 | Welcome screen title |
| Display L | Cinzel | 18px | 600 | PA1 #c9b896 | Panel titles |
| Display M | Cinzel | 14px | 600 | PA1 #c9b896 | Section headers |
| Body L | Source Sans 3 | 14px | 600 | N3 #c8c8cc | Event titles, entity names |
| Body M | Source Sans 3 | 13px | 400 | N2 #8a8a90 | Prose, descriptions |
| Body S | Source Sans 3 | 11px | 400 | N1 #585860 | Metadata, breadcrumbs, hints |
| Mono | JetBrains Mono | 10px | 400 | N1 #585860 | Timestamps, coordinates |

### 4.3 Text Color Assignments

All text uses palette colors exclusively:

| Role | Palette Entry | Hex | When Used |
|---|---|---|---|
| Primary text | N3 | #c8c8cc | Entity names, titles, important content |
| Secondary text | N2 | #8a8a90 | Body prose, descriptions, labels |
| Tertiary text | N1 | #585860 | Timestamps, coordinates, hints |
| Disabled text | N0 | #3a3a44 | Inactive tabs, unavailable options |
| Accent text | PA1 | #c9b896 | Panel titles, section headers |
| Link text | CS | #6888c8 | Clickable entity names |
| Danger text | CM | #c44040 | Warnings, destruction, death |
| Success text | CE | #3aad6a | Growth, creation, positive outcomes |

### 4.4 Line Height and Spacing

```css
:root {
  --leading-tight:   1.2;    /* Display text, headers */
  --leading-normal:  1.45;   /* Body text, descriptions */
  --leading-relaxed: 1.6;    /* Prose paragraphs, long-form reading */

  --space-xs: 2px;   --space-sm: 4px;   --space-md: 8px;
  --space-lg: 12px;  --space-xl: 16px;  --space-2xl: 24px;
}
```

---

## 5. Panel System

### 5.1 Application Layout

```
+========================================================================+
|  TOP BAR (36px) -- BG0 background, N0 border bottom                   |
|  [AETHERUM]  Year 1247, 3rd Moon  [<<][<][||][>][>>]   Map | Chronicle |
+=========================+==============================================+
|                         |                                              |
|                         |  EVENT LOG PANEL                             |
|                         |  (right column, top ~50%)                    |
|   PIXI.JS MAP CANVAS   |  BG1 background, ornate corners              |
|   (left column, 65%)   |                                              |
|                         +=====[ resize handle, 4px, N0 ]===============+
|   BG0 background       |                                              |
|   Grid of 16x24 tiles  |  INSPECTOR PANEL                             |
|                         |  (right column, bottom ~50%)                 |
|                         |  BG1 background, ornate corners              |
|                         |                                              |
+=========================+==============================================+
|  STATUS BAR (24px) -- BG0 background, N0 border top                   |
|  Tick: 4523  |  Entities: 847  |  Events: 2341  |  FPS: 30            |
+========================================================================+
```

**CSS Grid root:**

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
  overflow: hidden;
  background: #0c0c14;  /* BG0 */
}
```

### 5.2 Responsive Breakpoints

| Viewport Width | Map Column | Panel Column | Notes |
|---|---|---|---|
| >= 1920px | 65% (1248px) | 35% (672px) | Full detail, comfortable reading |
| 1600px | 62% (992px) | 38% (608px) | Slight panel increase |
| 1280px | 58% (742px) | 42% (538px) | Minimum supported, tighter spacing |
| < 1280px | -- | -- | "Minimum resolution" warning overlay |

### 5.3 Panel Frame Design

Every panel (Event Log, Inspector) is wrapped in an ornate frame. The frame is
purely decorative -- it does not affect layout or content flow.

**Frame anatomy:**

```
+--[TL]-------------- Panel Title ---------------[TR]--[x]--+
|                                                            |
|  Content area (scrollable)                                 |
|  Padding: 8px all sides                                    |
|                                                            |
+--[BL]----------------------------------------------[BR]--+

TL/TR/BL/BR = 24x24px corner ornaments (mirrored from single sprite)
```

**Corner ornament sprite (24x24 pixels, top-left orientation):**

```
Row 0-1:   ############............   Horizontal bar: AU1 (#8b6914), 12px wide
Row 2:     ##**########............   Knot detail: AU2 (#c9a84c) highlight
Row 3:     ##**....................   Vertical bar begins
Row 4-11:  ##......................   Vertical bar continues, 2px wide
           AU0 (#6b4e0a) shadow on inner edge
```

The knot detail at each corner point is a 4x4px decorative element:
```
.*.
*#*
.*.
```
Where `*` = AU2 (#c9a84c), `#` = AU0 (#6b4e0a), `.` = AU1 (#8b6914).

The corners are mirrored for each position:
- Top-left: as described
- Top-right: horizontally mirrored via `transform: scaleX(-1)`
- Bottom-left: vertically mirrored via `transform: scaleY(-1)`
- Bottom-right: both axes mirrored via `transform: scale(-1)`

Between corners, the border is a 1px line in N0 (#3a3a44).

**Panel background:** BG1 (#16161e) at 92% opacity (`rgba(22, 22, 30, 0.92)`)
so the map is faintly visible behind panels that overlay it.

**Alternative: Pure CSS corners (no sprite needed, simpler but less ornate):**

```css
.panel-frame-css::before {
  content: '';
  position: absolute;
  top: -1px; left: -1px;
  width: 20px; height: 20px;
  border-top: 2px solid #8b6914;    /* AU1 */
  border-left: 2px solid #8b6914;
  pointer-events: none;
}
/* Repeat for other three corners with appropriate border sides */
```

### 5.4 Panel Title Bar

32px tall. Background: linear gradient from BG2 (#22222c) to BG1 (#16161e), top
to bottom. Title text in PA1 (#c9b896) using Cinzel at 14px weight 600.

Decorative line accents flank the title text:

```css
.panel-titlebar__text::before {
  content: '';
  display: inline-block;
  width: 16px; height: 1px;
  background: linear-gradient(90deg, transparent, #8b6914);  /* AU1 */
  margin-right: 8px;
}
.panel-titlebar__text::after {
  content: '';
  display: inline-block;
  width: 16px; height: 1px;
  background: linear-gradient(90deg, #8b6914, transparent);
  margin-left: 8px;
}
```

Close/maximize buttons: 20x20px squares in the right corner.
- Normal: BG1 background, N1 (#585860) text
- Hover close: CM (#c44040) text
- Hover maximize: CE (#3aad6a) text

### 5.5 Resize Divider

The horizontal divider between Event Log and Inspector is 4px tall, colored N0
(#3a3a44). On hover, it transitions to AU1 (#8b6914) over 150ms. Cursor changes
to `row-resize`. Min panel height: 200px on each side.

### 5.6 Panel Scrolling

Custom-styled scrollbars using palette colors:

```css
.panel-content::-webkit-scrollbar { width: 8px; }
.panel-content::-webkit-scrollbar-track { background: #16161e; }    /* BG1 */
.panel-content::-webkit-scrollbar-thumb { background: #3a3a44; }    /* N0  */
.panel-content::-webkit-scrollbar-thumb:hover { background: #585860; } /* N1 */
.panel-content::-webkit-scrollbar-thumb:active { background: #8b6914; } /* AU1 */
```

### 5.7 Layout Presets

Five layout presets, cycled with `L` key (matching current blessed implementation):

| Preset | Map | Event Log | Inspector | Description |
|---|---|---|---|---|
| Default | Left 65% | Right top 50% | Right bottom 50% | Balanced view |
| Narrative | Right top 50% (map) | Left 60% full | Right bottom 50% | Chronicle-first |
| Map Focus | Full width 85%h | Bottom strip 15%h | Hidden | World observation |
| Log Focus | Right 40% | Left 60% full | Hidden | Reading mode |
| Split | Top 50% full | Bottom 50% full | Hidden | Equal split |

---

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

---

## 7. Chronicle / Event Log

### 7.1 Panel Structure

```
+--[TL]------------- Chronicle ---------------[TR]--[x]--+
|  [Prose] [Compact] [Arcs] [Domain]       [R filter]    |  <- mode tabs
|---------------------------------------------------------|
|  -- Year 3, 2nd Moon --                                 |  <- temporal header
|                                                         |
|  ** [crown] Treaty of Thornwall Signed                  |  <- legendary sig
|  House Ashford and The Iron Covenant have forged a      |
|  lasting peace after three years of bitter conflict...  |
|  Year 3, Day 45                                         |
|                                                         |
|  .  [sword] Border Skirmish near Ashford                |  <- minor sig
|  Three patrols clashed at the river crossing. No        |
|  significant losses were reported on either side.       |
|  Year 3, Day 42                                         |
|                                                         |
|  -- Year 3, 1st Moon --                                 |  <- temporal header
|  .  [coins] Economic activity across the realm          |  <- aggregated
|  4 trade deals and 2 resource discoveries this moon.    |
|                                                         |
+--[BL]----------------------------------------------[BR]--+
```

### 7.2 Chronicle Mode Tabs

Four modes, matching the current blessed implementation:

| Tab | Key | Description |
|---|---|---|
| Prose | `N` (cycle) | Full narrative prose, aggregated minor events |
| Compact | `N` | One-line per event with timestamp column |
| Arcs | `N` | Cascade chain tree view (cause -> effect) |
| Domain | `N` | Events grouped by category domain |

Tab styling (28px tall):
- Inactive: transparent background, N1 (#585860) text, no bottom border
- Hover: N2 (#8a8a90) text
- Active: PA1 (#c9b896) text, AU1 (#8b6914) 2px bottom border

```css
.chronicle-mode-tab {
  padding: 0 12px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  color: #585860;            /* N1 */
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  line-height: 26px;
  transition: color 150ms ease, border-color 150ms ease;
}

.chronicle-mode-tab--active {
  color: #c9b896;            /* PA1 */
  border-bottom-color: #8b6914; /* AU1 */
}
```

### 7.3 Event Cards

Each event is a card with a colored left accent bar:

```css
.event-card {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  margin: 2px 4px;
  background: #22222c;       /* BG2 */
  border-left: 3px solid;    /* category color via CSS variable */
  border-radius: 0;          /* no rounding -- pixel art aesthetic */
  cursor: pointer;
  transition: background 150ms ease;
  position: relative;
}

.event-card:hover {
  background: #2e2e38;       /* BG3 */
}

.event-card--selected {
  background: #2e2e38;       /* BG3 */
  border-left-width: 4px;    /* slightly thicker accent */
}

.event-card--aggregated {
  border-left-width: 2px;
  opacity: 0.85;
  padding: 6px 10px;
}
```

### 7.4 Category Badges

Each event card has a 22x22px badge showing a category icon:

```
+------+
| icon |   22x22px square
+------+   Background: category palette color
           Icon: 14x14px glyph from icon atlas, white (N3), centered

Categories and their icons:
  Political:   crown          CP #d4a832
  Military:    crossed swords CM #c44040
  Economic:    coins          CE #3aad6a
  Social:      two figures    CS #6888c8
  Cultural:    scroll         CC #40b0c8
  Religious:   star/chalice   CR #b87acc
  Magical:     crystal        FM #9040cc
  Personal:    silhouette     CS #6888c8  (shares Social hue)
  Disaster:    flame          CM #c44040  (shares Military hue)
  Exploratory: compass        CC #40b0c8  (shares Cultural hue)
```

Categories that share hues are differentiated by their unique icon shape.

### 7.5 Significance Indicators

A small marker to the left of each event card indicates its significance tier:

| Tier | Shape | Color | Size |
|---|---|---|---|
| Trivial (0-19) | middle-dot | N0 #3a3a44 | 4x4px |
| Minor (20-39) | bullet | N1 #585860 | 6x6px |
| Moderate (40-59) | circle | AU1 #8b6914 | 6x6px |
| Major (60-79) | diamond | AU2 #c9a84c | 6x6px |
| Critical (80-94) | star | CM #c44040 | 8x8px |
| Legendary (95-100) | double-star | FM #9040cc | 8x8px, pulsing anim |

### 7.6 Temporal Headers

Year/season dividers are centered text with decorative lines:

```
  --------  Year 3, 2nd Moon  --------
     N0         N1 text          N0

CSS: flex row, 1fr lines on each side, nowrap text center
```

```css
.temporal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 6px;
}

.temporal-header__line {
  flex: 1;
  height: 1px;
  background: #3a3a44;   /* N0 */
}

.temporal-header__text {
  font-family: var(--font-display);
  font-size: 11px;
  color: #585860;         /* N1 */
  letter-spacing: 1px;
  text-transform: uppercase;
  white-space: nowrap;
}
```

### 7.7 Entity Name Links

Entity names within event prose are rendered as clickable spans:

```css
.entity-link {
  color: #6888c8;            /* CS -- clickable entity blue */
  cursor: pointer;
  text-decoration: none;
  font-weight: 500;
  transition: text-decoration-color 100ms ease;
}

.entity-link:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
```

Clicking an entity name navigates the inspector to that entity. The link color
is always CS (#6888c8) regardless of entity type -- a single "this is clickable"
color. Entity type is communicated by the inspector header after navigation.

### 7.8 Aggregated Events

Events below significance 60 are batched by category and time period. An aggregated
entry uses a thinner left accent (2px instead of 3px) and slightly dimmer text
(N2 instead of N3 for the title). The aggregation prose templates from the current
`event-aggregator.ts` are reused directly.

### 7.9 Region Filtering

Pressing `R` toggles region-contextual filtering. When active, only events within
Manhattan distance of the viewport center are shown. A small indicator appears in
the mode tab bar:

```
[Prose] [Compact] [Arcs] [Domain]    [R: Region]
                                      CE color when active
                                      N1 color when inactive
```

### 7.10 Event Card Content Layout

```css
.event-card__title {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: #c8c8cc;            /* N3 */
  line-height: 1.3;
  margin-bottom: 2px;
}

.event-card__description {
  font-family: var(--font-body);
  font-size: 12px;
  color: #8a8a90;            /* N2 */
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-card__timestamp {
  font-family: var(--font-mono);
  font-size: 10px;
  color: #3a3a44;            /* N0 */
  margin-top: 3px;
}
```

---

## 8. Inspector System

### 8.1 Panel Structure

```
+--[TL]----------- Inspector -----------[TR]--[x]--+
|  [< Back]  House Ashford > Thornwall > Lord Aldric |  <- breadcrumbs
|  [Elegic] [Section] [Card] [Depths] [Heads]        |  <- tabs
|-----------------------------------------------------|
|                                                     |
|  v The Story So Far -------------------- alive --   |  <- section expanded
|                                                     |
|  Lord Aldric was born in the twilight years of the  |
|  old kingdom, amid whispers of war and the fading   |
|  light of an age. He rose through the ranks of      |
|  House Ashford with a combination of martial         |
|  prowess and shrewd diplomacy...                     |
|                                                     |
|  > Strengths & Renown ----------------- warrior --  |  <- collapsed
|  > Bonds & Loyalties --------------------- 3 ties   |  <- collapsed
|  > Worldly Standing ---------------------- Warlord  |  <- collapsed
|  > The Heart's Compass ------------- Ambitious      |  <- collapsed
|  > Memory & Legend -------------- 12 memories       |  <- collapsed
|  > Worldly Possessions ------------- 2 artifacts    |  <- collapsed
|                                                     |
+--[BL]-------------------------------------------[BR]--+
```

### 8.2 Entity Type Headers

When inspecting an entity, a header line shows the entity type:

| Entity Type | Icon | Color | Type Label |
|---|---|---|---|
| Character | @ | CS #6888c8 | CHARACTER |
| Faction | & | CP #d4a832 | FACTION |
| Site | # | AU2 #c9a84c | SETTLEMENT |
| Artifact | * | FM #9040cc | ARTIFACT |
| Event | ! | (category color) | EVENT |
| Region | ~ | CE #3aad6a | REGION |

The type label is rendered in the entity type's color, Display M font, uppercase,
with a 1px decorative line extending to the right edge.

### 8.3 Breadcrumb Navigation

A navigation trail showing the path to the current entity:

```
[<]  World > House Ashford > Thornwall > Lord Aldric
back  N1       N1              N1         PA1 (current)
```

- Back button: 24x24px, BG1 background, N1 text. Hover: BG2 background, PA1 text.
- Breadcrumb items: Body S (11px), N1 color. Hover: N2 color, underline.
- Separator: `>` glyph in N0 (#3a3a44).
- Current item: PA1 (#c9b896) color, 500 weight, no hover effect.

### 8.4 Inspector Tabs

Five view modes for entity display:

| Tab | Description |
|---|---|
| Elegic | Prose-first narrative sections (default) |
| Section | Structured data in labeled rows |
| Card | Grid of stat cards (2-column) |
| Depths | Raw data dump (for power users) |
| Heads | Relationships and social graph |

Tab styling: same as chronicle mode tabs (28px, same palette scheme).

Active tab uses PA1 (#c9b896) as background with BG0 (#0c0c14) text, creating
a parchment-on-dark effect that clearly indicates the active view.

### 8.5 Collapsible Sections

Section headers are clickable to expand/collapse:

```
Expanded:
  v [1] The Story So Far -------------------------------- alive
  ^       PA1 text              N0 line              N1 hint

Collapsed:
  > [2] Character & Temperament ------------------------ 5 traits
```

- Collapse arrow: `v` (expanded) or `>` (collapsed), 10x10px in N1
  Rotates -90deg when collapsed (200ms ease transition)
- Number key: `[1]` through `[9]`, Body S in N1, allows keyboard toggle
- Title: Display M (14px), Cinzel, PA1 (#c9b896), letter-spacing 0.5px
- Line: 1px `linear-gradient(90deg, N0, transparent)` filling remaining width
- Hint: Body S (11px) in N1 (#585860), italic, right-aligned

```css
.inspector-section__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 4px;
  cursor: pointer;
  user-select: none;
}

.inspector-section__title {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  color: #c9b896;     /* PA1 */
  letter-spacing: 0.5px;
}

.inspector-section__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, #3a3a44, transparent);  /* N0 */
}

.inspector-section__hint {
  font-family: var(--font-body);
  font-size: 10px;
  color: #585860;     /* N1 */
  font-style: italic;
}
```

### 8.6 Inspector Content Types

**Prose paragraphs:**

```css
.inspector-prose {
  font-family: var(--font-body);
  font-size: 13px;
  color: #8a8a90;    /* N2 */
  line-height: 1.55;
  margin-bottom: 8px;
}

.inspector-prose strong {
  color: #c8c8cc;    /* N3 */
  font-weight: 600;
}
```

**Data rows:**

```
Label                              Value
N1 text, 12px                      N3 text, 12px, right-aligned
```

Subtle background striping on odd rows: BG2 (#22222c) at 30% opacity.

**Progress bars:**

```
Label    [=====-----]  47%
         filled: category or faction color
         track: BG0 (#0c0c14)
```

6px tall, no border radius.

**Card grid (2-column layout):**

```css
.inspector-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
}

.inspector-card {
  background: #22222c;   /* BG2 */
  border: 1px solid #3a3a44;  /* N0 */
}

.inspector-card__header {
  padding: 4px 8px;
  background: #c9b896;  /* PA1 */
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 600;
  color: #0c0c14;        /* BG0 */
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### 8.7 Faction Heraldry Display

Faction heraldry is rendered as a 48x48px pixel art shield in the faction inspector
header. The existing ASCII heraldry system (`widgets/heraldry.ts`) is adapted to
draw on a canvas using palette colors:

- Shield shape: knightly (pointed bottom), round, or totem (tall rectangle)
- Field division: solid, per pale, per fess, quarterly, per bend
- Tinctures: mapped to palette colors (primary + secondary)
- Charge: pixel art icon from a 4x4 grid charge atlas (16 charges at 16x16px)
- Border: 2px outline in AU0 (#6b4e0a)

### 8.8 Character Portraits (Stretch Goal)

If implemented, procedural character portraits appear as a 48x64px pixel art face
in the inspector header. Generated from character traits using compositing layers
(face shape, hair, expression, scars, headwear). All layers use palette colors.

---

## 9. Interaction Design

### 9.1 Click Behaviors

| Target | Left Click | Right Click |
|---|---|---|
| Map tile | Select tile, show tooltip, center if far | Context menu |
| Settlement marker | Center map + inspect in Inspector | Context menu |
| Event card | Select card + show detail in right pane | Context menu |
| Entity name link | Navigate inspector to that entity | -- |
| Tab button | Switch to that tab/mode | -- |
| Breadcrumb item | Navigate inspector to ancestor entity | -- |
| Back button | Go to previous inspector entry | -- |
| Panel title bar | Focus that panel | -- |
| Resize divider | Begin drag resize | -- |
| Speed control | Set simulation speed | -- |

### 9.2 Hover States

All interactive elements have a hover state using palette transitions:

```
Default        -> Hover          (usage)
BG2 (#22222c)  -> BG3 (#2e2e38) for cards, list items
N1  (#585860)  -> N2  (#8a8a90) for text buttons
N0  (#3a3a44)  -> AU1 (#8b6914) for borders, dividers
BG1 (#16161e)  -> BG2 (#22222c) for panel backgrounds

All transitions: 150ms ease
```

### 9.3 Selection States

- **Selected event card:** BG3 background, 4px left accent (up from 3px)
- **Selected map tile:** 1px outline in AU2 (#c9a84c) around the tile
- **Focused panel:** Border changes from N0 to subtle AU1 inner glow

### 9.4 Keyboard Navigation

```
Global:
  Tab           Cycle focus between panels
  1-8           Focus panel by number
  Space         Toggle simulation pause/play
  +/-           Speed up/down
  Escape        Deselect / go back / close modal
  Q             Quit application
  L             Cycle layout presets
  O             Cycle map overlays
  F1            Toggle help overlay

Map panel focused:
  Arrow keys    Pan viewport 1 tile
  WASD          Pan viewport 1 tile (alternative)
  +/-           Zoom in/out
  R             Toggle region filter

Chronicle panel focused:
  Up/Down       Scroll events
  Enter         Inspect selected event
  N             Cycle chronicle mode
  R             Toggle region filter
  I             Inspect event participant

Inspector panel focused:
  1-9           Toggle section collapse
  Backspace     Navigate back
  Enter         Drill into selected sub-entity
  G             Center map on entity location
```

### 9.5 Focus Indicators

The focused panel has:
- Border: subtle inner glow via `box-shadow: inset 0 0 0 1px rgba(139, 105, 20, 0.3)`
- Title bar: slightly brighter gradient
- Title text: PA1 (#c9b896) brightens to full white (N3)

Keyboard focus ring (`:focus-visible`): 2px solid AU1 (#8b6914) outline, 1px offset.

### 9.6 Tooltip System

Tooltips appear after 300ms hover delay. Positioned near cursor, flipped if near
screen edge.

```css
.tooltip {
  position: fixed;
  z-index: 1000;
  max-width: 280px;
  padding: 8px 10px;
  background: #22222c;       /* BG2 */
  border: 1px solid #3a3a44; /* N0 */
  pointer-events: none;
  animation: tooltip-in 100ms ease 300ms both;
}
/* No border radius. No drop shadows. Pixel art aesthetic. */
```

### 9.7 Context Menus

Right-clicking entities shows a context menu:

```
+--[N0 border]-------------+
|  Inspect                  |  N3 text
|  Center Map               |  N3 text
|  ----                     |  N0 divider
|  Bookmark                 |  N2 text
|  Filter by Faction        |  N2 text
+---------------------------+

Background: BG2
Hover item: BG3
Active item: AU1 text
```

### 9.8 Modal Dialogs

For welcome screen, settings, confirmations:

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(12, 12, 20, 0.7);   /* BG0 at 70% */
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  width: 90%;
  max-width: 520px;
  background: #16161e;       /* BG1 */
  border: 1px solid #585860; /* N1 */
}

.modal__header {
  padding: 12px 16px;
  background: linear-gradient(180deg, #22222c, #16161e);  /* BG2 -> BG1 */
  border-bottom: 1px solid #3a3a44;  /* N0 */
}

.modal__title {
  font-family: var(--font-display);
  font-size: 16px;
  color: #c9b896;   /* PA1 */
}
```

Primary button: PA1 (#c9b896) background, BG0 (#0c0c14) text, AU2 (#c9a84c) border.
Secondary button: transparent background, N1 (#585860) text, N0 (#3a3a44) border.

---

## 10. Animation & Motion

### 10.1 What Animates and Why

Animation in Aetherum is restrained. The game is about centuries passing -- not about
moment-to-moment action. Animation serves three purposes:

1. **Aliveness:** Water tiles shimmer. This tells the player the world is running.
2. **Attention:** Legendary events pulse. This draws the eye to important events.
3. **Feedback:** Panels respond. This confirms the player's actions.

### 10.2 World Animations (PixiJS Canvas, 15fps Update Rate)

**Water shimmer:** Ocean and coast tiles cycle between two glyph variants every
2 seconds. The glyph swaps (e.g., `~` to `approx` to `~`), keeping the same
palette colors. Hard frame cuts, no smooth interpolation.

```
Frame 0 (0-59 at 15fps):    ~ glyph in TS (#2868a0)
Frame 1 (60-119):           approx glyph in TS (#2868a0)
Repeat.
```

**Lava pulse:** Volcano tiles cycle the primary glyph color between FL (#e04020)
and AU2 (#c9a84c) every 1.5 seconds. A hard cut, not a fade.

**Magic shimmer:** Magic Wasteland tiles and ley line overlays cycle between FM
(#9040cc) and CR (#b87acc) every 3 seconds.

**Flag waving:** Capital markers cycle between two glyph variants (flag-left,
flag-right) every 1 second.

### 10.3 UI Animations (CSS, 60fps)

**Event card entry:** New cards slide in from the top:

```css
@keyframes card-enter {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Duration: 200ms ease-out */
```

**Legendary pulse:** The significance indicator for legendary events pulses:

```css
@keyframes legendary-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1.0; }
}
/* Duration: 2s, infinite */
```

No `box-shadow` glow -- just opacity change, keeping within the palette constraint.

**Panel transitions:** When switching layouts, panels resize over 200ms `ease-out`.
Content redraws after transition completes (no reflow during animation).

**Tab switch:** Content fades in over 100ms when switching tabs.

**Section collapse:** Content `max-height` transition over 200ms ease.

**All hover transitions:** 150ms ease, uniform across the interface.

### 10.4 Loading States

During world generation, a hourglass glyph from the UI atlas rotates through 4
frames at 250ms intervals. Accompanied by text with animated dots:

```
Generating world...
Generating world.
Generating world..
Generating world...
(500ms per dot, cycling)
```

### 10.5 Simulation Speed Visual Feedback

The speed indicator in the top bar changes color based on simulation speed:

| Speed | Color | Label |
|---|---|---|
| Paused | CM #c44040 | `PAUSED` |
| Slow Motion | N1 #585860 | `0.5x` |
| Normal | N2 #8a8a90 | `1x` |
| Fast 7 | AU1 #8b6914 | `7x` |
| Fast 30 | AU2 #c9a84c | `30x` |
| Fast 365 | CP #d4a832 | `365x` |
| Ultra Fast | FM #9040cc | `3650x` |

The active speed button gets AU1 (#8b6914) background with BG0 text. The pause
button when active gets CM (#c44040) background.

---

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

---

## 12. Accessibility

### 12.1 Contrast Ratios

All text meets WCAG AA contrast requirements against its background:

| Text Color | Background | Contrast Ratio | Passes AA? |
|---|---|---|---|
| N3 (#c8c8cc) on BG1 (#16161e) | -- | 10.8:1 | Yes (AAA) |
| N2 (#8a8a90) on BG1 (#16161e) | -- | 5.4:1 | Yes (AA) |
| N1 (#585860) on BG1 (#16161e) | -- | 3.1:1 | Yes (AA large text only) |
| PA1 (#c9b896) on BG1 (#16161e) | -- | 8.2:1 | Yes (AAA) |
| N3 (#c8c8cc) on BG2 (#22222c) | -- | 8.1:1 | Yes (AAA) |
| PA1 (#c9b896) on BG2 (#22222c) | -- | 6.2:1 | Yes (AA) |
| N0 (#3a3a44) on BG1 (#16161e) | -- | 1.9:1 | Decorative only |

N0 is used only for decorative borders and disabled states -- never for content
that must be read.

### 12.2 Colorblind Modes

Three alternative palette mappings:

**Deuteranopia mode:** Remaps CE (#3aad6a) to CC (#40b0c8) and shifts terrain
greens to use more blue. Political (gold) vs Military (red) remains safe because
gold/red distinction is preserved in deuteranopia.

**Protanopia mode:** Remaps CM (#c44040) to a darker shade and adjusts FL to
use orange. Green/blue distinction maintained via brightness difference.

**Achromatopsia mode:** Remaps all semantic colors to a brightness-only scale.
Category icons become the sole differentiator.

### 12.3 Shape + Color Encoding

No information is encoded by color alone:

- Event categories: unique icon per category (crown, swords, coins, etc.)
- Significance: increasing dot size + different glyph shape per tier
- Factions: geometric symbol (square, triangle, diamond, circle, hex, etc.)
- Entity types: unique ASCII icon per type (@, &, #, *, !, ~)

### 12.4 Keyboard-Only Navigation

Every UI operation is achievable without a mouse. Full keyboard shortcut table in
Section 9.4. Focus indicators are always visible via `:focus-visible` with AU1
outline.

### 12.5 Screen Reader Considerations

- `<nav>` for top bar and breadcrumbs
- `<article>` for event cards
- `<section>` with `<h2>` for inspector sections
- `aria-label` on icon-only buttons
- `aria-expanded` on collapsible sections
- `role="tablist"` and `role="tab"` for tab bars
- Map canvas: `aria-label="World map"` with `aria-roledescription="interactive map"`

### 12.6 Scalable UI

Two scale factors supported:

- **1x (default):** 16x24 tiles, 13px body text
- **2x (large):** 32x48 tiles, 16px body text, all spacing doubled

Toggled with `Ctrl+=` / `Ctrl+-`. The 2x mode uses CSS `transform: scale(2)` on
the PixiJS canvas and CSS font size increases on panels.

---

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

---

## 14. Implementation Roadmap

### 14.1 Phase 0: Foundation (Week 1)

**Goal:** Electron app launches, shows empty PixiJS canvas and HTML panels.

**Tasks:**
1. Create `packages/electron/` package with Electron + PixiJS + Vite config
2. Set up main process with world generation and IPC
3. Set up renderer process with CSS Grid layout shell
4. Mount PixiJS Application in map container
5. Create `variables.css` with 28 palette colors
6. Create `reset.css` and `typography.css`
7. Verify: app launches, shows dark BG0 background with empty BG1 panels

### 14.2 Phase 1: Map Rendering (Week 2-3)

**Goal:** PixiJS canvas renders the world map with terrain tiles and entity markers.

**Tasks:**
1. Create glyph atlas (programmatic generation or hand-authored PNG)
2. Implement `TilemapRenderer` with sprite pool
3. Port biome glyph pools from `biome-render-config.ts`
4. Implement viewport panning (arrow keys, WASD, click-drag)
5. Implement 3 zoom levels
6. Implement entity markers (settlements, armies)
7. Port overlay system (Political, Military, Economic, Magic, Climate)
8. Implement map tooltips
9. Verify: world map renders at all zoom levels, overlays cycle with `O`

### 14.3 Phase 2: Panel Chrome (Week 3-4)

**Goal:** Event Log and Inspector panels have ornate frames, title bars, divider.

**Tasks:**
1. Create corner ornament sprite (24x24px PNG or CSS fallback)
2. Implement `panel-frame.css` with corner positioning and mirroring
3. Implement panel title bars with decorative Cinzel text
4. Implement resize divider with drag behavior and min-height enforcement
5. Implement panel focus states (border glow, title brightness)
6. Implement custom scrollbars in palette colors
7. Verify: panels look ornate, resize works, focus transitions are smooth

### 14.4 Phase 3: Event Log / Chronicle (Week 4-6)

**Goal:** Chronicle panel displays events with cards, badges, and temporal headers.

**Tasks:**
1. Implement chronicle mode tabs (Prose, Compact, Arcs, Domain)
2. Implement event card component with category badge and significance dot
3. Implement temporal header dividers
4. Implement entity name links (clickable CS-colored spans)
5. Port EventAggregator logic for prose mode
6. Port EventRegionFilter for spatial filtering
7. Implement card entry animation (200ms slide-in)
8. Implement legendary pulse animation (opacity cycle)
9. Wire IPC: new events -> card append
10. Verify: events display in all 4 modes, clicking entity names navigates

### 14.5 Phase 4: Inspector (Week 6-8)

**Goal:** Inspector panel displays all 6 entity types with prose sections.

**Tasks:**
1. Implement inspector tab bar (Elegic, Section, Card, Depths, Heads)
2. Implement breadcrumb navigation with history stack
3. Implement collapsible section headers (click + 1-9 keyboard)
4. Port 6 sub-inspectors (Character, Faction, Site, Artifact, Event, Region)
5. Implement prose paragraph styling
6. Implement data row styling with subtle striping
7. Implement entity name links within inspector prose
8. Wire IPC: inspector query/response for on-demand data
9. Verify: all entity types display correctly, navigation works

### 14.6 Phase 5: Top Bar and Status Bar (Week 8-9)

**Tasks:**
1. Implement top bar: logo (AU1 Cinzel), date display, speed controls
2. Implement speed control buttons with active state coloring
3. Implement view navigation tabs (Map, Chronicle, Inspector, etc.)
4. Implement status bar with tick/entity/event counts
5. Wire simulation speed controls to IPC commands
6. Verify: speed changes reflect in the UI, date updates, layout cycling

### 14.7 Phase 6: Polish (Week 9-12)

**Tasks:**
1. Implement tooltip system for all hover targets
2. Implement welcome screen modal (30-tick warmup)
3. Implement help overlay (F1)
4. Implement context menus (right-click on entities)
5. Create icon sprite sheet (10 categories + 10 entity/action icons)
6. Implement faction heraldry rendering (48x48px canvas shields)
7. Accessibility audit: contrast, keyboard nav, screen reader labels
8. Performance profiling and optimization of render loop
9. Implement 2x scale mode (Ctrl+=/Ctrl+-)
10. Implement colorblind palette modes

### 14.8 Phase 7: Stretch Goals (Future)

- Procedural character portraits (48x64px pixel art faces)
- Seasonal palette shifts (autumn golden forests, winter gray plains)
- Isometric rendering mode (alternative to top-down)
- Minimap (parchment-styled corner overlay)
- Timeline panel (full-width bottom drawer with year markers)
- Relationship graph (force-directed layout in PixiJS)
- Sound design (ambient world sounds + event notification chimes)

### 14.9 Migration Strategy

The blessed terminal UI is **preserved** as a fallback:

```
pnpm run start          -> blessed terminal UI (existing, unchanged)
pnpm run start:electron -> Electron pixel art UI (new)
```

The simulation core (`@fws/core`, `@fws/generator`, `@fws/narrative`) is
completely untouched. The Electron renderer creates a parallel `@fws/electron`
package that shares data-layer adapters extracted from `@fws/renderer`.

No blessed code is deleted until the Electron renderer reaches feature parity.

---

## Appendix A: Full-Screen ASCII Mockup

```
+===========================================================================+
|  AETHERUM          Year 3, 2nd Moon           [||]  1x    Map | Chronicle |
+====================================================+======================+
| .  ,  .  '  .  ,  .  '  .  ,  .  '  .  ,  .  , . | -- Chronicle ----- x |
| .  '  .  ,  .  S  C  |  C  S  .  '  .  ,  .  , . | [Prose][Compact]     |
| ,  .  '  S  C  S  C  S  C  |  C  .  '  .  ,  . . |                      |
| .  S  C  |  S  C  |  C  S  C  S  .  ,  .  '  . . | -- Year 3, 2nd Moon  |
| '  C  S  C  S  C  [*]  C  S  C  .  '  .  ,  . ,  |                      |
| .  S  C  |  S  C  |  C  S  C  S  .  ,  n  ^  A T  | ** [crown] Treaty    |
| ,  .  '  S  C  S  C  S  C  .  '  n  ^  A  ^  T ^  | House Ashford and   |
| .  '  .  ,  .  S  C  .  '  ,  ^  A  T  ^  n  ^  T | The Iron Covenant   |
| .  ,  .  '  .  ,  .  '  .  ^  A  ^  T  A  ^  T  ^ | forged a lasting    |
| ~  =  ~  =  ~  =  ~  .  '  n  ^  A  ^  ^  A  ^  n | peace...            |
| =  ~  =  ~  =  ~  =  ~  .  ^  A  T  n  ^  T  ^  ^ | Y3 D45              |
| ~  =  ~  =  ~  =  ~  =  ~  .  n  ^  ^  A  ^  n  . |                      |
| =  ~  =  ~  =  ~  =  ~  =  ~  .  .  n  ^  .  .  . | .  [sword] Border   |
| .  ,  .  '  .  ~  =  ~  =  ~  .  '  .  ,  .  , . | skirmish near       |
| '  .  ,  .  '  .  ~  =  .  '  .  ,  .  '  .  , . | Ashford...           |
| .  .  .  '  .  ,  .  '  .  ,  .  '  .  ,  .  , . | Y3 D42              |
| .  ,  .  '  .  ,  .  '  .  ,  .  '  .  ,  .  , . |                      |
| .  '  .  ,  .  '  .  ,  .  '  .  ,  .  '  .  , . | -- Year 3, 1st Moon  |
| ,  .  '  .  ,  .  '  .  ,  .  '  .  ,  .  '  . . | . [coins] Economic   |
| .  '  .  ,  .  '  .  ,  .  '  .  ,  .  '  .  , . | activity across the  |
| .  ,  .  '  .  ,  .  '  .  ,  .  '  .  ,  .  , . | realm. 4 trade deals |
+====================================================+======================+
|                                                    | -- Inspector ---- x  |
|  (continued map below, or map fills full height    | [<] World > Ashford  |
|   when Inspector is collapsed)                     | [Elegic] [Section]   |
|                                                    |                      |
|                                                    | > The Story So Far   |
|                                                    |   Lord Aldric was    |
|                                                    |   born in the twi-   |
|                                                    |   light years...     |
|                                                    |                      |
|                                                    | > Strengths & Renown |
|                                                    | > Bonds & Loyalties  |
+====================================================+======================+
|  Tick: 4523 | Entities: 847 | Events: 2341 | FPS: 30 | Overlay: Political |
+===========================================================================+

Legend:
  .  ,  '  "  `     Plains glyphs (TG #4a7c3e on BG1 #16161e)
  S  C  |  t         Forest glyphs (TF #2a5c34 on BG0 #0c0c14)
  n  ^  A  T         Mountain glyphs (TM #6a7080 on BG2 #22222c)
  ~  =               Water glyphs (TS #2868a0 on TW #1a3860)
  [*]                 Settlement marker (CP #d4a832)
```

---

## Appendix B: Palette Swatch Reference

```
BACKGROUNDS                    NEUTRALS
+------+------+------+------+  +------+------+------+------+
| BG0  | BG1  | BG2  | BG3 |  | N0   | N1   | N2   | N3   |
|0c0c14|16161e|22222c|2e2e38|  |3a3a44|585860|8a8a90|c8c8cc|
+------+------+------+------+  +------+------+------+------+

CHROME                          PARCHMENT
+------+------+------+         +------+------+
| AU0  | AU1  | AU2  |         | PA0  | PA1  |
|6b4e0a|8b6914|c9a84c|         |8a7856|c9b896|
+------+------+------+         +------+------+

WORLD - TERRAIN                 WORLD - FEATURES
+------+------+------+------+  +------+------+------+
| TW   | TS   | TG   | TF   |  | FS   | FL   | FM   |
|1a3860|2868a0|4a7c3e|2a5c34|  |d0d8e8|e04020|9040cc|
+------+------+------+------+  +------+------+------+
+------+------+
| TM   | TD   |
|6a7080|c8a060|
+------+------+

SEMANTIC - CATEGORIES
+------+------+------+------+------+------+
| CP   | CM   | CE   | CS   | CR   | CC   |
|d4a832|c44040|3aad6a|6888c8|b87acc|40b0c8|
+------+------+------+------+------+------+
  polit  milit  econ   social relig  cultr
```

---

## Appendix C: Mapping from Current Blessed System

| Current (blessed) | New (Electron + PixiJS) | Notes |
|---|---|---|
| `blessed.screen()` | Electron BrowserWindow | Full window container |
| `blessed.box()` + borders | `.panel` div + `.panel-frame` | Ornate corners replace ASCII borders |
| `BasePanel` class | Panel web component | Same lifecycle, different rendering |
| `THEME.ui.background` (#0a0a0a) | BG0 (#0c0c14) | Slightly bluer dark |
| `THEME.ui.text` (#cccccc) | N3 (#c8c8cc) | Warmer, slightly cooler |
| `CATEGORY_COLORS[Political]` (#FFDD44) | CP (#d4a832) | More muted, golden |
| `CATEGORY_COLORS[Military]` (#FF4444) | CM (#c44040) | Desaturated crimson |
| `SIGNIFICANCE_COLORS.legendary` (#FF00FF) | FM (#9040cc) | Purple, not magenta |
| `blessed.tags` for colored text | CSS classes | No tag balancing headaches |
| `screen.render()` | DOM auto-updates | No manual render calls |
| `MenuBar` class | `.topbar` nav element | Integrated date + speed + views |
| `LayoutManager` class | CSS Grid + resize observers | Responsive by default |
| `biome-render-config.ts` pools | Glyph atlas + variant tables | Same data, sprite rendering |
| `overlay-bridge.ts` cache | Same data structure | 92% code reuse |
| `event-aggregator.ts` | Same module | 100% code reuse (pure logic) |
| `event-filter.ts` | Same module | 100% code reuse (pure logic) |
| `inspector-prose.ts` tables | Same module | 100% code reuse (lookup tables) |
| `heraldry.ts` ASCII output | Canvas-rendered 48x48 shields | Same generation logic |

---

## Appendix D: Component Style Guide Quick Reference

### Event Card

```
Size:         full width of chronicle panel, variable height
Background:   BG2 (#22222c), hover BG3 (#2e2e38)
Left accent:  3px solid category color, 4px when selected
Badge:        22x22px, category color bg, white (N3) icon
Title:        Body L, N3 (#c8c8cc), 600 weight
Description:  Body M, N2 (#8a8a90), 400 weight, max 2 lines
Timestamp:    Mono, N0 (#3a3a44), 400 weight
Significance: 4-8px dot, positioned left of card, tier-colored
Entity links: CS (#6888c8), dotted underline on hover
```

### Inspector Section Header

```
Height:       auto (single line)
Padding:      8px 12px 4px
Arrow:        10px, N1 (#585860), rotates on collapse
Title:        Cinzel 12px, PA1 (#c9b896), 600 weight
Line:         1px, gradient N0 to transparent
Hint:         11px italic, N1 (#585860), right-aligned
```

### Panel Title Bar

```
Height:       32px
Background:   gradient BG2 -> BG1
Title:        Cinzel 14px, PA1 (#c9b896), 600 weight
Decorations:  16px gradient lines flanking title (AU1)
Close btn:    20x20px, BG1 bg, N1 text, CM on hover
Border:       1px N0 (#3a3a44) bottom
```

### Tooltip

```
Max width:    280px
Padding:      8px 10px
Background:   BG2 (#22222c)
Border:       1px solid N0 (#3a3a44)
Title:        Body M, N3 (#c8c8cc), 600 weight
Body:         Body S, N2 (#8a8a90)
Metadata:     Mono, N1 (#585860)
Delay:        300ms before show
Animation:    100ms fade-in after delay
```

---

*Design specification for Aetherum Fantasy World Simulator.*
*Revision 2.0 -- 2026-02-09*
*Authored by hifi-ui-designer for the graphics and UI remake.*
