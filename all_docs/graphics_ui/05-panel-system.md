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
