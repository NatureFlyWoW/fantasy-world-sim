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
