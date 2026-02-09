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
