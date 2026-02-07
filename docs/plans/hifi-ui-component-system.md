# Aetherum Hi-Fi UI Component System

## Complete Design Specification for Electron + PixiJS + HTML/CSS

> Transitioning from blessed ASCII terminal to a high-fidelity pixel art graphical interface.
> This document provides implementation-ready specifications for every UI component.

---

## 1. OVERALL LAYOUT SPECIFICATION

### 1.1 Application Shell

The application window is an Electron BrowserWindow. The PixiJS canvas renders the isometric world map. HTML/CSS panels overlay or sit beside the canvas.

```
+========================================================================+
|  TOP BAR (36px)                                                        |
|  [AETHERUM] [<] [Year 1247, 3rd Moon] [<<|<|>||>|>>]   Map|Chronicle  |
+=============================+==========================================+
|                             |  EVENT LOG PANEL                         |
|                             |  (right column, top ~50%)                |
|   PIXI.JS CANVAS            |                                          |
|   (Isometric World Map)    |                                          |
|                             +------------------------------------------+
|   fills left column        |  INSPECTOR PANEL                         |
|   (58-65% of viewport)     |  (right column, bottom ~50%)             |
|                             |                                          |
|                             |                                          |
+=============================+==========================================+
|  STATUS BAR (24px)                                                     |
+========================================================================+
```

### 1.2 CSS Grid Root Layout

```css
:root {
  --topbar-height: 36px;
  --statusbar-height: 24px;
  --panel-min-width: 420px;
  --panel-max-ratio: 0.40;  /* 40% of viewport max */
  --panel-default-ratio: 0.35;  /* 35% default */
}

.app-root {
  display: grid;
  grid-template-columns: 1fr minmax(var(--panel-min-width), 35%);
  grid-template-rows: var(--topbar-height) 1fr var(--statusbar-height);
  grid-template-areas:
    "topbar  topbar"
    "map     panels"
    "status  status";
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0a0a0e;
}

.topbar        { grid-area: topbar; }
.map-container { grid-area: map; position: relative; }
.panel-column  { grid-area: panels; display: flex; flex-direction: column; }
.statusbar     { grid-area: status; }
```

### 1.3 Map Container

The PixiJS canvas fills the map grid cell. It renders the isometric world.

```css
.map-container {
  position: relative;
  overflow: hidden;
  background: #0a0a0e;
}

.map-container canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
```

### 1.4 Panel Column (Right Side)

The right column holds the Event Log (top) and Inspector (bottom), stacked vertically with a draggable resize divider between them.

```css
.panel-column {
  display: flex;
  flex-direction: column;
  background: rgba(18, 18, 22, 0.95);
  border-left: 1px solid #2a2825;
  min-width: var(--panel-min-width);
  overflow: hidden;
}

.panel-column .event-log-panel {
  flex: 1 1 50%;
  min-height: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-column .resize-divider {
  flex: 0 0 4px;
  background: #2a2825;
  cursor: row-resize;
  transition: background 150ms ease;
}

.panel-column .resize-divider:hover {
  background: #8b6914;
}

.panel-column .inspector-panel {
  flex: 1 1 50%;
  min-height: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

### 1.5 Responsive Breakpoints

| Viewport Width | Map Column | Panel Column | Notes |
|---|---|---|---|
| >= 1920px | 65% (1248px) | 35% (672px) | Full detail, comfortable reading |
| 1600px | 62% (992px) | 38% (608px) | Slight panel increase |
| 1280px | 58% (742px) | 42% (538px) | Minimum supported, tighter spacing |
| < 1280px | -- | -- | Show "minimum resolution" warning overlay |

```css
@media (max-width: 1280px) {
  .resolution-warning {
    display: flex;
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(10, 10, 14, 0.95);
    align-items: center;
    justify-content: center;
    color: #c9b896;
    font-family: 'Cinzel', serif;
    font-size: 16px;
    text-align: center;
  }
}

@media (min-width: 1600px) {
  .app-root {
    grid-template-columns: 1fr minmax(var(--panel-min-width), 35%);
  }
}

@media (min-width: 1280px) and (max-width: 1599px) {
  .app-root {
    grid-template-columns: 1fr minmax(var(--panel-min-width), 42%);
  }
  .event-card { padding: 6px 8px; }
  .panel-title { font-size: 16px; }
}
```

---

## 2. PANEL FRAME DESIGN

### 2.1 Base Panel Container

Every panel (Event Log, Inspector, future panels) shares the same frame structure.

```css
.panel {
  position: relative;
  background: rgba(22, 22, 28, 0.92);
  border: 1px solid #2a2825;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Optional frosted glass when panel overlays the map */
.panel--overlay {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  background: rgba(22, 22, 28, 0.85);
}

/* Fallback for browsers without backdrop-filter */
@supports not (backdrop-filter: blur(8px)) {
  .panel--overlay {
    background: rgba(22, 22, 28, 0.96);
  }
}
```

### 2.2 Ornate Corner Decorations

Each panel has four L-shaped metalwork corner ornaments. These are positioned absolutely at each corner. They are rendered as small sprites (PNG or SVG).

**Corner Ornament Specification (each 24x24px):**

```
Pixel art pattern for top-left corner (24x24):

Row 0-1:   ############............   (horizontal bar, 12px wide, 2px tall)
Row 2:     ##**########............   (decorative knot at corner, 4px detail)
Row 3:     ##**....................   (vertical bar begins)
Row 4-11:  ##......................   (vertical bar, 2px wide, continues down)

where:
  # = bronze (#8b6914)
  * = bright gold (#c9a84c) highlight for metallic sheen
  . = transparent
```

The corners are mirrored for each position:
- Top-left: as described
- Top-right: horizontally mirrored
- Bottom-left: vertically mirrored
- Bottom-right: both axes mirrored

The "knot" detail at each corner point is a 4x4px decorative element:
```
.*.
*#*
.*.
```
where `*` = bright gold (#c9a84c), `#` = deep bronze (#6b4e0a), `.` = bronze (#8b6914)

**CSS Implementation:**

```css
.panel-frame {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.panel-frame__corner {
  position: absolute;
  width: 24px;
  height: 24px;
  background-image: url('../assets/ui/corner-ornament.png');
  background-size: 24px 24px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.panel-frame__corner--tl { top: -1px;  left: -1px;  transform: none; }
.panel-frame__corner--tr { top: -1px;  right: -1px; transform: scaleX(-1); }
.panel-frame__corner--bl { bottom: -1px; left: -1px; transform: scaleY(-1); }
.panel-frame__corner--br { bottom: -1px; right: -1px; transform: scale(-1); }
```

**Alternative: Pure CSS corners (no sprite needed, simpler but less ornate):**

```css
.panel-frame-css::before,
.panel-frame-css::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  pointer-events: none;
  z-index: 2;
}

/* Top-left corner bracket */
.panel-frame-css::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid #8b6914;
  border-left: 2px solid #8b6914;
}

/* Top-right corner bracket */
.panel-frame-css::after {
  top: -1px;
  right: -1px;
  border-top: 2px solid #8b6914;
  border-right: 2px solid #8b6914;
}

/* Bottom corners use inner wrapper */
.panel-frame-inner::before {
  content: '';
  position: absolute;
  bottom: -1px;
  left: -1px;
  width: 20px;
  height: 20px;
  border-bottom: 2px solid #8b6914;
  border-left: 2px solid #8b6914;
  pointer-events: none;
  z-index: 2;
}

.panel-frame-inner::after {
  content: '';
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 20px;
  height: 20px;
  border-bottom: 2px solid #8b6914;
  border-right: 2px solid #8b6914;
  pointer-events: none;
  z-index: 2;
}
```

### 2.3 Panel Title Bar

```css
.panel-titlebar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 12px;
  background: linear-gradient(180deg, #252528 0%, #1e1e22 100%);
  border-bottom: 1px solid #2a2825;
  user-select: none;
}

.panel-titlebar__text {
  font-family: 'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif;
  font-size: 14px;
  font-weight: 600;
  color: #c9b896;
  letter-spacing: 0.5px;
  text-transform: none;
}

/* Decorative left accent (small ornamental line) */
.panel-titlebar__text::before {
  content: '';
  display: inline-block;
  width: 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #8b6914);
  margin-right: 8px;
  vertical-align: middle;
}

.panel-titlebar__text::after {
  content: '';
  display: inline-block;
  width: 16px;
  height: 1px;
  background: linear-gradient(90deg, #8b6914, transparent);
  margin-left: 8px;
  vertical-align: middle;
}
```

### 2.4 Panel Close / Minimize / Maximize Buttons

Styled as small medieval-themed controls (not OS-native).

```css
.panel-controls {
  display: flex;
  gap: 6px;
  align-items: center;
}

.panel-btn {
  width: 20px;
  height: 20px;
  border: 1px solid #3a3530;
  border-radius: 2px;
  background: #1a1a1e;
  color: #5a5548;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
  transition: all 150ms ease;
  font-family: 'Source Sans 3', sans-serif;
}

.panel-btn:hover {
  background: #2a2825;
  color: #c9b896;
  border-color: #4a4540;
}

.panel-btn--close:hover {
  background: #3a1515;
  color: #cc4040;
  border-color: #662020;
}

.panel-btn--maximize:hover {
  background: #1a2a1a;
  color: #40aa40;
  border-color: #205520;
}

/* Button icons (text content, no images needed) */
/* Close: x   Minimize: _   Maximize: [] */
```

### 2.5 Panel Content Area

```css
.panel-content {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
}
```

### 2.6 Panel Focus State

When a panel is focused (active for keyboard input), its border subtly glows.

```css
.panel--focused {
  border-color: #3a3530;
  box-shadow: inset 0 0 0 1px rgba(139, 105, 20, 0.3);
}

.panel--focused .panel-titlebar {
  background: linear-gradient(180deg, #2a2828 0%, #222220 100%);
}

.panel--focused .panel-titlebar__text {
  color: #ddd0b0;
}
```

---

## 3. EVENT LOG (CHRONICLE) PANEL

### 3.1 Panel Structure

```
+--[TL corner]------ Chronicle ------[TR corner]--[x]--+
|  [Prose] [Compact] [Arcs] [Domain]       [R filter]  |
|--------------------------------------------------------|
|  -- Year 3, 2nd Moon --                               |
|                                                        |
|  [*] [crown] Treaty of Thornwall signed                |
|  Between Faction A and Faction B...                    |
|  Year 3, Day 45                                        |
|                                                        |
|  [.] [sword] Border skirmish near Ashford              |
|  Three patrols clashed at the river crossing...        |
|  Year 3, Day 42                                        |
|                                                        |
|  -- Year 3, 1st Moon --                               |
|  ...                                                   |
+--[BL corner]----------------------------[BR corner]--+
```

### 3.2 Chronicle Mode Tabs

The four chronicle viewing modes sit directly below the title bar.

```css
.chronicle-modes {
  display: flex;
  gap: 0;
  padding: 0 8px;
  background: #151518;
  border-bottom: 1px solid #2a2825;
  flex: 0 0 auto;
  height: 28px;
  align-items: stretch;
}

.chronicle-mode-tab {
  padding: 0 12px;
  font-family: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #5a5548;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease;
  line-height: 26px;
}

.chronicle-mode-tab:hover {
  color: #8a8070;
}

.chronicle-mode-tab--active {
  color: #c9b896;
  border-bottom-color: #8b6914;
}
```

### 3.3 Temporal Headers (Year/Season Dividers)

```css
.temporal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 6px;
  user-select: none;
}

.temporal-header__line {
  flex: 1;
  height: 1px;
  background: #2a2825;
}

.temporal-header__text {
  font-family: 'Cinzel', serif;
  font-size: 11px;
  font-weight: 400;
  color: #5a5548;
  letter-spacing: 1px;
  text-transform: uppercase;
  white-space: nowrap;
}
```

### 3.4 Event Card

Each event in the chronicle is rendered as a card with a colored left accent.

```css
.event-card {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  margin: 2px 4px;
  background: #1e1e24;
  border-left: 3px solid var(--category-color);
  border-radius: 3px;
  cursor: pointer;
  transition: background 150ms ease;
  position: relative;
}

.event-card:hover {
  background: #252530;
}

.event-card--selected {
  background: #222230;
  box-shadow: inset 0 0 0 1px rgba(var(--category-color-rgb), 0.3);
}

.event-card--aggregated {
  /* Aggregated/batched events get a subtler appearance */
  border-left-width: 2px;
  opacity: 0.85;
  padding: 6px 10px;
}
```

### 3.5 Category Badge

A small colored badge with an icon, placed at the left edge of each event card.

```css
.category-badge {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--category-color);
  position: relative;
}

.category-badge__icon {
  width: 14px;
  height: 14px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: brightness(0) invert(1); /* white icon on colored bg */
}
```

**Category Color Assignments:**

| Category | CSS Variable | Hex Color | Badge Shape | Icon |
|---|---|---|---|---|
| Political | `--cat-political` | `#d4a832` | Square | Crown |
| Military | `--cat-military` | `#c44040` | Square | Crossed swords |
| Economic | `--cat-economic` | `#3aad6a` | Square | Coins |
| Social | `--cat-social` | `#6888c8` | Square | Two figures |
| Cultural | `--cat-cultural` | `#40b0c8` | Square | Scroll |
| Religious | `--cat-religious` | `#b87acc` | Square | Star/chalice |
| Magical | `--cat-magical` | `#9040cc` | Square | Crystal |
| Personal | `--cat-personal` | `#6088cc` | Square | Silhouette |
| Disaster | `--cat-disaster` | `#cc6020` | Square | Flame |
| Exploratory | `--cat-exploratory` | `#70c040` | Square | Compass |

### 3.6 Significance Indicators

The significance of an event is shown as a small marker to the left of the card.

```css
.significance-indicator {
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* Trivial (0-19): barely visible dot */
.significance-indicator--trivial {
  width: 4px; height: 4px;
  background: #404040;
}

/* Minor (20-39): small gray dot */
.significance-indicator--minor {
  background: #606058;
}

/* Moderate (40-59): warm gold dot */
.significance-indicator--moderate {
  background: #c4a840;
}

/* Major (60-79): bright amber dot with subtle glow */
.significance-indicator--major {
  background: #cc6830;
  box-shadow: 0 0 4px rgba(204, 104, 48, 0.4);
}

/* Critical (80-94): red dot with glow */
.significance-indicator--critical {
  width: 8px; height: 8px;
  background: #cc3030;
  box-shadow: 0 0 6px rgba(204, 48, 48, 0.5);
}

/* Legendary (95-100): animated pulsing magenta */
.significance-indicator--legendary {
  width: 8px; height: 8px;
  background: #d040c0;
  box-shadow: 0 0 8px rgba(208, 64, 192, 0.6);
  animation: legendary-pulse 2s ease-in-out infinite;
}

@keyframes legendary-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(208, 64, 192, 0.4); }
  50%      { box-shadow: 0 0 12px rgba(208, 64, 192, 0.8); }
}
```

### 3.7 Event Card Content

```css
.event-card__body {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.event-card__title {
  font-family: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #e0d8c4;
  line-height: 1.3;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-card__description {
  font-family: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: #8a8070;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-card__timestamp {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 10px;
  color: #4a4540;
  margin-top: 3px;
}

.event-card__meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: 0 0 auto;
}
```

### 3.8 Entity Name Links (within event text)

```css
.entity-link {
  color: var(--entity-color);
  text-decoration: none;
  cursor: pointer;
  transition: text-decoration-color 100ms ease;
  font-weight: 500;
}

.entity-link:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

/* Entity type colors applied via inline style or data attribute */
.entity-link[data-type="character"] { --entity-color: #6088cc; }
.entity-link[data-type="faction"]   { --entity-color: #cc8830; }
.entity-link[data-type="site"]      { --entity-color: #c8b040; }
.entity-link[data-type="artifact"]  { --entity-color: #b850b8; }
.entity-link[data-type="region"]    { --entity-color: #50a868; }
```

### 3.9 Scrolling Behavior

```css
.chronicle-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  padding: 4px 0;
}

/* New event entry animation */
.event-card--entering {
  animation: card-enter 200ms ease-out;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 4. INSPECTOR PANEL

### 4.1 Panel Structure

```
+--[TL]----------- Inspector -----------[TR]--[_][x]--+
|  [< Back]  Faction A > Settlement > Character Name   |
|  [Elegic] [Section] [Card] [Depths] [Heads]          |
|--------------------------------------------------------|
|                                                        |
|  -- The Story So Far ---------------------- alive --  |
|                                                        |
|  Thinecormwhi Leaver was born in the small village     |
|  of Ashford, nestled among the eastern hills...        |
|                                                        |
|  -- Strengths & Renown ------------------- warrior -- |
|                                                        |
|  Health:  Hale and hardy          Strength: Notable    |
|  Wisdom:  Sharp of mind          Charisma: Inspiring   |
|                                                        |
|  -- Bonds & Loyalties -------------------- 3 ties --  |
|  ...                                                   |
+--[BL]------------------------------------[BR]--------+
```

### 4.2 Tab Bar

```css
.inspector-tabs {
  display: flex;
  gap: 0;
  padding: 0 8px;
  background: #151518;
  border-bottom: 1px solid #2a2825;
  flex: 0 0 auto;
  height: 30px;
  align-items: stretch;
}

.inspector-tab {
  padding: 0 14px;
  font-family: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #5a5548;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
  line-height: 28px;
  position: relative;
}

.inspector-tab:hover {
  color: #8a8070;
  background: rgba(42, 40, 37, 0.4);
}

.inspector-tab--active {
  color: #1a1a1a;
  background: #c9b896;
  font-weight: 600;
  border-bottom-color: transparent;
  border-radius: 3px 3px 0 0;
}

.inspector-tab--active:hover {
  background: #d4c8a0;
  color: #1a1a1a;
}
```

### 4.3 Breadcrumb Navigation

```css
.inspector-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 6px 12px;
  background: #141418;
  border-bottom: 1px solid #222220;
  flex: 0 0 auto;
  overflow: hidden;
}

.inspector-breadcrumbs__back {
  width: 24px;
  height: 24px;
  border: 1px solid #2a2825;
  border-radius: 3px;
  background: #1a1a1e;
  color: #5a5548;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  transition: all 150ms ease;
}

.inspector-breadcrumbs__back:hover {
  background: #252520;
  color: #c9b896;
  border-color: #3a3530;
}

.breadcrumb-item {
  font-family: 'Source Sans 3', sans-serif;
  font-size: 11px;
  color: #5a5548;
  cursor: pointer;
  text-decoration: none;
  transition: color 150ms ease;
}

.breadcrumb-item:hover {
  color: #8a8070;
  text-decoration: underline;
}

.breadcrumb-item--current {
  color: #c9b896;
  cursor: default;
  font-weight: 500;
}

.breadcrumb-item--current:hover {
  text-decoration: none;
}

.breadcrumb-separator {
  font-size: 10px;
  color: #3a3530;
  margin: 0 4px;
  user-select: none;
}
```

### 4.4 Section Headers (Collapsible)

Decorative section dividers with ornamental line styling.

```css
.inspector-section {
  margin-bottom: 4px;
}

.inspector-section__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 4px;
  cursor: pointer;
  user-select: none;
  transition: opacity 150ms ease;
}

.inspector-section__header:hover {
  opacity: 0.85;
}

.inspector-section__collapse-arrow {
  width: 10px;
  height: 10px;
  color: #5a5548;
  font-size: 8px;
  transition: transform 200ms ease;
  flex: 0 0 auto;
}

.inspector-section--collapsed .inspector-section__collapse-arrow {
  transform: rotate(-90deg);
}

.inspector-section__title {
  font-family: 'Cinzel', 'Palatino Linotype', serif;
  font-size: 12px;
  font-weight: 600;
  color: #c9b896;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

/* Decorative line extending from title */
.inspector-section__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, #3a3530, transparent);
  min-width: 20px;
}

/* Right-aligned summary hint */
.inspector-section__hint {
  font-family: 'Source Sans 3', sans-serif;
  font-size: 10px;
  color: #4a4540;
  white-space: nowrap;
  font-style: italic;
}

/* Section content */
.inspector-section__content {
  padding: 4px 12px 8px 22px;
  overflow: hidden;
  transition: max-height 200ms ease;
}

.inspector-section--collapsed .inspector-section__content {
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
```

### 4.5 Inspector Content: Prose Paragraphs

```css
.inspector-prose {
  font-family: 'Source Sans 3', sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: #b8b0a0;
  line-height: 1.55;
  margin-bottom: 8px;
}

.inspector-prose strong,
.inspector-prose b {
  color: #d8d0c0;
  font-weight: 600;
}
```

### 4.6 Inspector Content: Data Rows

```css
.data-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 2px 0;
  font-family: 'Source Sans 3', sans-serif;
  font-size: 12px;
}

.data-row__label {
  color: #6a6458;
  font-weight: 400;
}

.data-row__value {
  color: #c0b8a4;
  font-weight: 500;
  text-align: right;
}

/* Progress bars for stats */
.data-row__bar {
  flex: 0 0 80px;
  height: 6px;
  background: #1a1a1e;
  border-radius: 3px;
  overflow: hidden;
  margin-left: 8px;
}

.data-row__bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--bar-color, #8b6914);
  transition: width 300ms ease;
}
```

### 4.7 Inspector Card Layout (for grid displays like sample 3)

```css
.inspector-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
}

.inspector-card {
  background: #1e1e24;
  border: 1px solid #2a2825;
  border-radius: 3px;
  overflow: hidden;
}

.inspector-card__header {
  padding: 4px 8px;
  background: #c9b896;
  font-family: 'Cinzel', serif;
  font-size: 10px;
  font-weight: 600;
  color: #1a1a1a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.inspector-card__body {
  padding: 6px 8px;
}

.inspector-card__stat {
  font-family: 'Source Sans 3', sans-serif;
  font-size: 11px;
  color: #8a8070;
  line-height: 1.4;
}
```

---

## 5. TYPOGRAPHY SYSTEM

### 5.1 Font Families

```css
/* Import fonts (in HTML head or @import) */
/* Primary display: Cinzel - elegant serif with medieval character */
/* Body: Source Sans 3 - clean, highly readable sans-serif */
/* Data/mono: JetBrains Mono - clear monospace for numbers and timestamps */

@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-display: 'Cinzel', 'Palatino Linotype', 'Book Antiqua', 'Georgia', serif;
  --font-body: 'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
}
```

### 5.2 Font Size Scale (Modular, base 13px)

```css
:root {
  --text-xs:    10px;   /* Micro: badges, tiny labels */
  --text-sm:    11px;   /* Small: metadata, breadcrumbs, hints */
  --text-base:  13px;   /* Body: descriptions, prose, list items */
  --text-md:    14px;   /* Medium: event titles, important body text */
  --text-lg:    16px;   /* Large: section headers */
  --text-xl:    18px;   /* XL: panel titles */
  --text-2xl:   22px;   /* 2XL: display headings (welcome screen, etc.) */
}
```

### 5.3 Text Colors

```css
:root {
  --text-primary:     #e0d8c4;   /* Main content text: warm off-white */
  --text-secondary:   #b0a890;   /* Supporting text: muted tan */
  --text-tertiary:    #7a7060;   /* Deemphasized: warm gray */
  --text-quaternary:  #4a4540;   /* Very dim: timestamps, faint labels */
  --text-disabled:    #3a3530;   /* Disabled/inactive */
  --text-accent:      #c9b896;   /* Accent: gold-tan (headers, highlights) */
  --text-link:        #6088cc;   /* Clickable entity references */
  --text-link-hover:  #80a8e8;   /* Link hover state */
  --text-danger:      #cc4040;   /* Warnings, destruction, death */
  --text-success:     #40aa60;   /* Growth, creation, positive */
  --text-warning:     #cca030;   /* Caution, moderate alerts */
}
```

### 5.4 Line Height and Spacing

```css
:root {
  --leading-tight:   1.2;    /* Display text, headers */
  --leading-normal:  1.45;   /* Body text, descriptions */
  --leading-relaxed: 1.6;    /* Prose paragraphs, long-form text */

  --space-xs: 2px;
  --space-sm: 4px;
  --space-md: 8px;
  --space-lg: 12px;
  --space-xl: 16px;
  --space-2xl: 24px;
}
```

### 5.5 Typography Application

```css
/* Panel titles */
.type-panel-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-accent);
  line-height: var(--leading-tight);
  letter-spacing: 0.5px;
}

/* Section headings within panels */
.type-section-heading {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-accent);
  line-height: var(--leading-tight);
  letter-spacing: 0.3px;
}

/* Event titles */
.type-event-title {
  font-family: var(--font-body);
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-primary);
  line-height: var(--leading-normal);
}

/* Body text / prose */
.type-body {
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: 400;
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
}

/* Metadata (timestamps, coordinates) */
.type-meta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 400;
  color: var(--text-quaternary);
  line-height: var(--leading-normal);
}

/* Badges and micro labels */
.type-badge {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
```

---

## 6. COLOR PALETTE (Complete CSS Custom Properties)

### 6.1 Core Palette

```css
:root {
  /* ========================================
     BACKGROUNDS
     ======================================== */
  --bg-app:           #0a0a0e;   /* Application root background */
  --bg-panel:         #16161c;   /* Panel background (solid) */
  --bg-panel-alpha:   rgba(22, 22, 28, 0.92);  /* Panel bg with transparency */
  --bg-overlay:       rgba(22, 22, 28, 0.85);  /* Frosted overlay panels */
  --bg-surface:       #1e1e24;   /* Cards, list items, elevated surfaces */
  --bg-surface-hover: #252530;   /* Hover state on surfaces */
  --bg-surface-active:#2a2a36;   /* Active/pressed state */
  --bg-input:         #141418;   /* Input fields, search boxes */
  --bg-topbar:        #111116;   /* Top navigation bar */
  --bg-statusbar:     #0e0e12;   /* Bottom status bar */
  --bg-tab-bar:       #151518;   /* Tab bar background */

  /* ========================================
     BORDERS
     ======================================== */
  --border-subtle:    #1e1e22;   /* Very subtle dividers */
  --border-default:   #2a2825;   /* Default panel/card borders */
  --border-strong:    #3a3530;   /* Prominent borders, focused elements */
  --border-ornament:  #8b6914;   /* Bronze ornamental borders */
  --border-ornament-bright: #c9a84c;  /* Bright gold accents */
  --border-ornament-deep:   #6b4e0a;  /* Deep bronze shadows */

  /* ========================================
     ACCENT COLORS (Medieval Fantasy Theme)
     ======================================== */
  --accent-gold:      #8b6914;   /* Primary bronze/gold accent */
  --accent-gold-bright:#c9a84c;  /* Highlight gold */
  --accent-parchment: #c9b896;   /* Parchment tan (active tabs, headers) */
  --accent-parchment-dark: #8a7856;  /* Darker parchment */
  --accent-burgundy:  #6b2020;   /* Deep red accent */
  --accent-ink:       #2a2520;   /* Dark ink/sepia */

  /* ========================================
     EVENT CATEGORY COLORS
     ======================================== */
  --cat-political:    #d4a832;   /* Golden amber */
  --cat-military:     #c44040;   /* Crimson red */
  --cat-economic:     #3aad6a;   /* Forest green */
  --cat-social:       #6888c8;   /* Steel blue */
  --cat-cultural:     #40b0c8;   /* Teal */
  --cat-religious:    #b87acc;   /* Lavender purple */
  --cat-magical:      #9040cc;   /* Deep arcane purple */
  --cat-personal:     #6088cc;   /* Cornflower blue */
  --cat-disaster:     #cc6020;   /* Burnt orange */
  --cat-exploratory:  #70c040;   /* Leaf green */

  /* Category colors as RGB triples (for rgba() use) */
  --cat-political-rgb:   212, 168, 50;
  --cat-military-rgb:    196, 64, 64;
  --cat-economic-rgb:    58, 173, 106;
  --cat-social-rgb:      104, 136, 200;
  --cat-cultural-rgb:    64, 176, 200;
  --cat-religious-rgb:   184, 122, 204;
  --cat-magical-rgb:     144, 64, 204;
  --cat-personal-rgb:    96, 136, 204;
  --cat-disaster-rgb:    204, 96, 32;
  --cat-exploratory-rgb: 112, 192, 64;

  /* ========================================
     SIGNIFICANCE TIER COLORS
     ======================================== */
  --sig-trivial:      #444440;   /* 0-19: barely visible */
  --sig-minor:        #686860;   /* 20-39: subtle gray */
  --sig-moderate:     #c4a840;   /* 40-59: warm gold */
  --sig-major:        #cc6830;   /* 60-79: amber orange */
  --sig-critical:     #cc3030;   /* 80-94: crimson */
  --sig-legendary:    #d040c0;   /* 95-100: magenta */

  /* ========================================
     SEMANTIC COLORS
     ======================================== */
  --semantic-success:    #40aa60;
  --semantic-warning:    #cca030;
  --semantic-danger:     #cc4040;
  --semantic-info:       #5090cc;
  --semantic-success-bg: rgba(64, 170, 96, 0.12);
  --semantic-warning-bg: rgba(204, 160, 48, 0.12);
  --semantic-danger-bg:  rgba(204, 64, 64, 0.12);
  --semantic-info-bg:    rgba(80, 144, 204, 0.12);

  /* ========================================
     ENTITY TYPE COLORS (for name links)
     ======================================== */
  --entity-character: #6088cc;
  --entity-faction:   #cc8830;
  --entity-site:      #c8b040;
  --entity-artifact:  #b850b8;
  --entity-region:    #50a868;
  --entity-deity:     #ccaa50;
  --entity-army:      #cc4444;
  --entity-ruin:      #887060;

  /* ========================================
     FACTION COLORS (assigned dynamically per world)
     Sample defaults:
     ======================================== */
  --faction-1: #8060b0;  /* Purple */
  --faction-2: #409098;  /* Teal */
  --faction-3: #c8a040;  /* Amber */
  --faction-4: #b84040;  /* Red */
  --faction-5: #408840;  /* Green */
  --faction-6: #4070b0;  /* Blue */
  --faction-7: #b86830;  /* Burnt Sienna */
  --faction-8: #808080;  /* Silver/Gray */
}
```

### 6.2 Dark Mode (the only mode -- but here for completeness)

The entire palette above IS the dark mode. No light mode is planned. Every color is designed for dark backgrounds.

---

## 7. MENU BAR / TOP BAR

### 7.1 Layout Structure

```
+---------------------------------------------------------------------+
| [AETHERUM]  [<]  Year 1247, 3rd Moon  [<<][<][>||][>][>>]   Map|Ch  |
+---------------------------------------------------------------------+
   ^logo     ^back    ^date display      ^speed controls    ^view tabs
```

### 7.2 Top Bar CSS

```css
.topbar {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  background: var(--bg-topbar);
  border-bottom: 1px solid var(--border-default);
  user-select: none;
  z-index: 100;
}

/* Logo / Title */
.topbar__logo {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-gold);
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-right: 16px;
  flex: 0 0 auto;
}

/* Back button (for navigation context) */
.topbar__back {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-default);
  border-radius: 3px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  transition: all 150ms ease;
}

.topbar__back:hover {
  background: var(--bg-surface);
  color: var(--text-accent);
  border-color: var(--border-strong);
}

/* Date Display */
.topbar__date {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-accent);
  margin-right: 16px;
  flex: 0 0 auto;
}

/* Simulation Speed Controls */
.topbar__speed-controls {
  display: flex;
  gap: 2px;
  align-items: center;
  margin-right: auto; /* push view tabs to right */
}

.speed-btn {
  width: 26px;
  height: 24px;
  border: 1px solid var(--border-default);
  border-radius: 2px;
  background: transparent;
  color: var(--text-quaternary);
  font-size: 11px;
  font-family: var(--font-mono);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.speed-btn:hover {
  background: var(--bg-surface);
  color: var(--text-secondary);
  border-color: var(--border-strong);
}

/* Active speed button (current speed) */
.speed-btn--active {
  background: var(--accent-gold);
  color: #0a0a0e;
  border-color: var(--accent-gold-bright);
}

/* Pause button special styling */
.speed-btn--pause {
  width: 30px;
}

.speed-btn--pause.speed-btn--active {
  background: var(--semantic-danger);
  border-color: #dd5555;
}

/* Speed label */
.topbar__speed-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-quaternary);
  margin-left: 6px;
  min-width: 50px;
}

/* View Navigation Tabs */
.topbar__views {
  display: flex;
  gap: 0;
  align-items: stretch;
  height: 100%;
}

.topbar__view-tab {
  padding: 0 14px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-quaternary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
  line-height: 34px;
  white-space: nowrap;
}

.topbar__view-tab:hover {
  color: var(--text-tertiary);
}

.topbar__view-tab--active {
  color: var(--text-accent);
  border-bottom-color: var(--accent-gold);
}

/* Separator between view groups */
.topbar__separator {
  width: 1px;
  height: 18px;
  background: var(--border-default);
  margin: 0 4px;
  align-self: center;
}
```

### 7.3 Speed Button Icons

| Button | Content | Title/Tooltip |
|---|---|---|
| Rewind | `<<` | "Ultra Slow (1 tick/2s)" |
| Slow | `<` | "Slow (1 tick/s)" |
| Pause/Play | `II` / `>` | "Pause" / "Play" |
| Fast | `>` | "Fast (7 ticks/s)" |
| Ultra | `>>` | "Ultra Fast (30 ticks/s)" |

### 7.4 View Tab Labels

| Tab | Label | Shortcut |
|---|---|---|
| Map | `Map` | `1` |
| Chronicle | `Chronicle` | `2` |
| Inspector | `Inspector` | `3` |
| Relations | `Relations` | `4` |
| Timeline | `Timeline` | `5` |
| Stats | `Stats` | `6` |

---

## 8. STATUS BAR

```css
.statusbar {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  background: var(--bg-statusbar);
  border-top: 1px solid var(--border-subtle);
  gap: 16px;
  z-index: 100;
}

.statusbar__item {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-quaternary);
  white-space: nowrap;
}

.statusbar__item-label {
  color: var(--text-disabled);
  margin-right: 4px;
}

.statusbar__item-value {
  color: var(--text-tertiary);
}

.statusbar__separator {
  width: 1px;
  height: 12px;
  background: var(--border-subtle);
}

/* Status bar items:
   Tick: 4523 | Entities: 847 | Events: 2341 | Layout: Default | FPS: 30 */
```

---

## 9. ICON SYSTEM

### 9.1 Sprite Sheet Specification

All icons are pixel art, rendered at native resolution and displayed with `image-rendering: pixelated`.

**Icon Sprite Sheet: `ui-icons.png`**
- Grid: 16x16px per icon cell
- Total sheet: 160x32px (10 columns x 2 rows)
- Row 1: Event category icons
- Row 2: Entity type icons + UI action icons

| Col | Row 1 (Category) | Row 2 (Entity/Action) |
|---|---|---|
| 0 | Crown (Political) | Character silhouette |
| 1 | Crossed swords (Military) | Shield (Faction) |
| 2 | Coins (Economic) | Tower (Site/Settlement) |
| 3 | Two figures (Social) | Gem (Artifact) |
| 4 | Scroll (Cultural) | Tree (Region) |
| 5 | Star (Religious) | Compass (Exploratory) |
| 6 | Crystal (Magical) | Gear (Settings) |
| 7 | Portrait (Personal) | Eye (Inspect) |
| 8 | Flame (Disaster) | Quill (Narrative) |
| 9 | Compass (Exploratory) | Hourglass (Time) |

### 9.2 Icon CSS

```css
.icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-image: url('../assets/ui/ui-icons.png');
  background-size: 160px 32px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  vertical-align: middle;
}

/* Category icons (row 0) */
.icon--political   { background-position: 0px 0px; }
.icon--military    { background-position: -16px 0px; }
.icon--economic    { background-position: -32px 0px; }
.icon--social      { background-position: -48px 0px; }
.icon--cultural    { background-position: -64px 0px; }
.icon--religious   { background-position: -80px 0px; }
.icon--magical     { background-position: -96px 0px; }
.icon--personal    { background-position: -112px 0px; }
.icon--disaster    { background-position: -128px 0px; }
.icon--exploratory { background-position: -144px 0px; }

/* Entity icons (row 1) */
.icon--character   { background-position: 0px -16px; }
.icon--faction     { background-position: -16px -16px; }
.icon--site        { background-position: -32px -16px; }
.icon--artifact    { background-position: -48px -16px; }
.icon--region      { background-position: -64px -16px; }
.icon--compass     { background-position: -80px -16px; }
.icon--settings    { background-position: -96px -16px; }
.icon--inspect     { background-position: -112px -16px; }
.icon--narrative   { background-position: -128px -16px; }
.icon--time        { background-position: -144px -16px; }

/* Icon sizes */
.icon--sm { width: 12px; height: 12px; background-size: 120px 24px; }
.icon--lg { width: 24px; height: 24px; background-size: 240px 48px; }
.icon--xl { width: 32px; height: 32px; background-size: 320px 64px; }
```

### 9.3 Significance Tier Icons

In addition to the dot indicators, significance can also be shown as inline text glyphs:

| Tier | Glyph | HTML Entity | CSS Class |
|---|---|---|---|
| Legendary | filled star | `&#9733;` | `.sig-legendary` |
| Critical | filled diamond | `&#9670;` | `.sig-critical` |
| Major | filled triangle | `&#9650;` | `.sig-major` |
| Moderate | filled circle | `&#9679;` | `.sig-moderate` |
| Minor | small bullet | `&#8226;` | `.sig-minor` |
| Trivial | middle dot | `&#183;` | `.sig-trivial` |

```css
.sig-glyph {
  display: inline-block;
  width: 14px;
  text-align: center;
  font-size: 10px;
}

.sig-legendary { color: var(--sig-legendary); text-shadow: 0 0 4px rgba(208, 64, 192, 0.5); }
.sig-critical  { color: var(--sig-critical); }
.sig-major     { color: var(--sig-major); }
.sig-moderate  { color: var(--sig-moderate); }
.sig-minor     { color: var(--sig-minor); }
.sig-trivial   { color: var(--sig-trivial); }
```

---

## 10. SCROLLBAR STYLING

```css
/* Custom scrollbars for the medieval theme */
.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: var(--bg-panel);
  border-left: 1px solid var(--border-subtle);
}

.panel-content::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 4px;
  border: 1px solid var(--bg-panel);
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: #4a4540;
}

.panel-content::-webkit-scrollbar-thumb:active {
  background: var(--accent-gold);
}
```

---

## 11. ANIMATION SPECIFICATIONS

### 11.1 Transition Defaults

```css
:root {
  --transition-fast:   100ms ease;
  --transition-normal: 150ms ease;
  --transition-slow:   250ms ease;
  --transition-panel:  200ms ease-out;
}
```

### 11.2 UI Animations

```css
/* Event card entering the chronicle */
@keyframes card-enter {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Legendary significance pulse */
@keyframes legendary-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(208, 64, 192, 0.4); }
  50%      { box-shadow: 0 0 12px rgba(208, 64, 192, 0.8); }
}

/* Panel focus glow */
@keyframes focus-glow {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(139, 105, 20, 0.2); }
  50%      { box-shadow: inset 0 0 0 1px rgba(139, 105, 20, 0.4); }
}

/* Loading spinner (pixel art hourglass rotation) */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Tab switch content fade */
@keyframes tab-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.panel-content--switching {
  animation: tab-fade-in 100ms ease;
}

/* Tooltip appearance */
@keyframes tooltip-in {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 12. TOOLTIP COMPONENT

For hovering over entities on the map or in panels.

```css
.tooltip {
  position: fixed;
  z-index: 1000;
  max-width: 280px;
  padding: 8px 10px;
  background: rgba(18, 18, 22, 0.96);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  animation: tooltip-in 100ms ease 80ms both; /* 80ms delay before showing */
}

.tooltip__title {
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.tooltip__body {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
}

.tooltip__meta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-quaternary);
  margin-top: 4px;
}
```

---

## 13. MODAL / DIALOG COMPONENT

For welcome screen, settings, confirmations.

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(5, 5, 8, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  position: relative;
  width: 90%;
  max-width: 520px;
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(180deg, #252528 0%, var(--bg-panel) 100%);
  border-bottom: 1px solid var(--border-default);
}

.modal__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-accent);
}

.modal__body {
  padding: 16px;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-default);
}

/* Primary action button */
.btn-primary {
  padding: 6px 16px;
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: 600;
  color: #0a0a0e;
  background: var(--accent-parchment);
  border: 1px solid var(--accent-gold-bright);
  border-radius: 3px;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.btn-primary:hover {
  background: #d4c8a0;
  border-color: #d8c060;
}

/* Secondary button */
.btn-secondary {
  padding: 6px 16px;
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-tertiary);
  background: transparent;
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.btn-secondary:hover {
  background: var(--bg-surface);
  color: var(--text-secondary);
}
```

---

## 14. GLOBAL RESET AND BASE STYLES

```css
/* Apply at the top of the main stylesheet */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Pixel art rendering */
img[data-pixelart],
canvas[data-pixelart] {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* Focus outline for keyboard navigation */
:focus-visible {
  outline: 2px solid var(--accent-gold);
  outline-offset: 1px;
}

/* Remove button defaults */
button {
  font: inherit;
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
}

/* Selection color */
::selection {
  background: rgba(139, 105, 20, 0.4);
  color: var(--text-primary);
}
```

---

## 15. ASSET MANIFEST

### 15.1 Required Sprite Assets

| Asset | File | Dimensions | Description |
|---|---|---|---|
| Corner ornament | `corner-ornament.png` | 24x24px | Single corner, mirror via CSS for all 4 |
| UI icons | `ui-icons.png` | 160x32px | 10x2 grid of 16x16 icons |
| Panel divider ornament | `divider-ornament.png` | 32x8px | Center ornament for section dividers |
| Parchment texture | `parchment-noise.png` | 128x128px | Tileable noise for subtle texture |
| Loading hourglass | `hourglass.png` | 16x16px (4 frames) | 64x16px strip, 4 frames |

### 15.2 Asset Directory Structure

```
packages/renderer/assets/
  ui/
    corner-ornament.png
    corner-ornament-focused.png    (brighter variant)
    ui-icons.png
    divider-ornament.png
    parchment-noise.png
    hourglass.png
  fonts/
    (web fonts loaded via Google Fonts CDN)
  map/
    (isometric tile sprites - handled by procgen-pixel-artist)
```

### 15.3 CSS File Organization

```
packages/renderer/src/styles/
  variables.css          -- All CSS custom properties (Section 6)
  reset.css              -- Global reset (Section 14)
  typography.css          -- Font imports and type classes (Section 5)
  layout.css             -- Grid layout and responsive (Section 1)
  panel-frame.css        -- Panel frame, corners, titlebar (Section 2)
  event-log.css          -- Chronicle panel styles (Section 3)
  inspector.css          -- Inspector panel styles (Section 4)
  topbar.css             -- Top bar and speed controls (Section 7)
  statusbar.css          -- Status bar (Section 8)
  icons.css              -- Icon sprite classes (Section 9)
  scrollbar.css          -- Custom scrollbar (Section 10)
  animations.css         -- Keyframes and transitions (Section 11)
  tooltip.css            -- Tooltip component (Section 12)
  modal.css              -- Modal/dialog component (Section 13)
  index.css              -- Imports all above in order
```

---

## 16. HTML COMPONENT TEMPLATES

### 16.1 Application Shell

```html
<div class="app-root">
  <!-- Top Bar -->
  <nav class="topbar">
    <span class="topbar__logo">AETHERUM</span>
    <button class="topbar__back" title="Back" aria-label="Go back">&lt;</button>
    <span class="topbar__date">Year 1, 1st Moon</span>
    <div class="topbar__speed-controls">
      <button class="speed-btn" title="Slow">&lt;&lt;</button>
      <button class="speed-btn" title="Slower">&lt;</button>
      <button class="speed-btn speed-btn--pause speed-btn--active" title="Pause">II</button>
      <button class="speed-btn" title="Play">&gt;</button>
      <button class="speed-btn" title="Fast">&gt;&gt;</button>
      <span class="topbar__speed-label">Paused</span>
    </div>
    <div class="topbar__separator"></div>
    <div class="topbar__views">
      <button class="topbar__view-tab topbar__view-tab--active">Map</button>
      <button class="topbar__view-tab">Chronicle</button>
      <button class="topbar__view-tab">Inspector</button>
      <button class="topbar__view-tab">Relations</button>
      <button class="topbar__view-tab">Timeline</button>
      <button class="topbar__view-tab">Stats</button>
    </div>
  </nav>

  <!-- Map Canvas -->
  <div class="map-container">
    <canvas id="pixi-canvas" data-pixelart></canvas>
    <!-- Map tooltips render here -->
  </div>

  <!-- Right Panel Column -->
  <div class="panel-column">
    <!-- Event Log Panel -->
    <div class="panel event-log-panel panel--focused">
      <div class="panel-frame">
        <div class="panel-frame__corner panel-frame__corner--tl"></div>
        <div class="panel-frame__corner panel-frame__corner--tr"></div>
        <div class="panel-frame__corner panel-frame__corner--bl"></div>
        <div class="panel-frame__corner panel-frame__corner--br"></div>
      </div>
      <div class="panel-titlebar">
        <span class="panel-titlebar__text">Chronicle</span>
        <div class="panel-controls">
          <button class="panel-btn panel-btn--maximize" title="Maximize">&#9633;</button>
          <button class="panel-btn panel-btn--close" title="Close">&times;</button>
        </div>
      </div>
      <div class="chronicle-modes">
        <button class="chronicle-mode-tab chronicle-mode-tab--active">Prose</button>
        <button class="chronicle-mode-tab">Compact</button>
        <button class="chronicle-mode-tab">Arcs</button>
        <button class="chronicle-mode-tab">Domain</button>
      </div>
      <div class="panel-content chronicle-scroll">
        <!-- Temporal header -->
        <div class="temporal-header">
          <span class="temporal-header__line"></span>
          <span class="temporal-header__text">Year 3, 2nd Moon</span>
          <span class="temporal-header__line"></span>
        </div>
        <!-- Event card -->
        <div class="event-card" style="--category-color: var(--cat-political);">
          <span class="significance-indicator significance-indicator--major"></span>
          <div class="category-badge" style="background: var(--cat-political);">
            <span class="icon icon--political category-badge__icon"></span>
          </div>
          <div class="event-card__body">
            <div class="event-card__title">Treaty of Thornwall Signed</div>
            <div class="event-card__description">
              <span class="entity-link" data-type="faction">House Ashford</span> and
              <span class="entity-link" data-type="faction">The Iron Covenant</span>
              have forged a lasting peace after three years of bitter conflict...
            </div>
            <div class="event-card__timestamp">Year 3, Day 45</div>
          </div>
        </div>
        <!-- More event cards... -->
      </div>
    </div>

    <!-- Resize Divider -->
    <div class="resize-divider"></div>

    <!-- Inspector Panel -->
    <div class="panel inspector-panel">
      <div class="panel-frame">
        <div class="panel-frame__corner panel-frame__corner--tl"></div>
        <div class="panel-frame__corner panel-frame__corner--tr"></div>
        <div class="panel-frame__corner panel-frame__corner--bl"></div>
        <div class="panel-frame__corner panel-frame__corner--br"></div>
      </div>
      <div class="panel-titlebar">
        <span class="panel-titlebar__text">Inspector</span>
        <div class="panel-controls">
          <button class="panel-btn panel-btn--maximize" title="Maximize">&#9633;</button>
          <button class="panel-btn panel-btn--close" title="Close">&times;</button>
        </div>
      </div>
      <div class="inspector-breadcrumbs">
        <button class="inspector-breadcrumbs__back" title="Back">&lt;</button>
        <span class="breadcrumb-item">World</span>
        <span class="breadcrumb-separator">&rsaquo;</span>
        <span class="breadcrumb-item">House Ashford</span>
        <span class="breadcrumb-separator">&rsaquo;</span>
        <span class="breadcrumb-item breadcrumb-item--current">Lord Aldric</span>
      </div>
      <div class="inspector-tabs">
        <button class="inspector-tab inspector-tab--active">Elegic</button>
        <button class="inspector-tab">Section</button>
        <button class="inspector-tab">Card</button>
        <button class="inspector-tab">Depths</button>
        <button class="inspector-tab">Heads</button>
      </div>
      <div class="panel-content">
        <!-- Section -->
        <div class="inspector-section">
          <div class="inspector-section__header">
            <span class="inspector-section__collapse-arrow">&#9662;</span>
            <span class="inspector-section__title">The Story So Far</span>
            <span class="inspector-section__line"></span>
            <span class="inspector-section__hint">alive</span>
          </div>
          <div class="inspector-section__content">
            <p class="inspector-prose">
              <strong class="entity-link" data-type="character">Lord Aldric</strong>
              was born in the twilight years of the old kingdom, amid whispers of
              war and the fading light of an age. He rose through the ranks of
              <span class="entity-link" data-type="faction">House Ashford</span>
              with a combination of martial prowess and shrewd diplomacy...
            </p>
          </div>
        </div>
        <!-- More sections... -->
      </div>
    </div>
  </div>

  <!-- Status Bar -->
  <div class="statusbar">
    <span class="statusbar__item">
      <span class="statusbar__item-label">Tick:</span>
      <span class="statusbar__item-value">4523</span>
    </span>
    <span class="statusbar__separator"></span>
    <span class="statusbar__item">
      <span class="statusbar__item-label">Entities:</span>
      <span class="statusbar__item-value">847</span>
    </span>
    <span class="statusbar__separator"></span>
    <span class="statusbar__item">
      <span class="statusbar__item-label">Events:</span>
      <span class="statusbar__item-value">2341</span>
    </span>
    <span class="statusbar__separator"></span>
    <span class="statusbar__item">
      <span class="statusbar__item-label">Layout:</span>
      <span class="statusbar__item-value">Default</span>
    </span>
    <span class="statusbar__separator"></span>
    <span class="statusbar__item">
      <span class="statusbar__item-label">FPS:</span>
      <span class="statusbar__item-value">30</span>
    </span>
  </div>
</div>
```

---

## 17. MAPPING FROM CURRENT BLESSED SYSTEM

This section maps the current terminal UI concepts to their HTML/CSS equivalents for developers implementing the transition.

| Current (blessed) | New (HTML/CSS) | Notes |
|---|---|---|
| `blessed.screen()` | Electron `BrowserWindow` | Full window container |
| `blessed.box()` with borders | `.panel` div with `.panel-frame` | Ornate corners replace ASCII borders |
| `BasePanel` class | Panel web component or React component | Same lifecycle, different rendering |
| `THEME.ui.background` (#0a0a0a) | `var(--bg-app)` (#0a0a0e) | Slightly bluer dark |
| `THEME.ui.text` (#cccccc) | `var(--text-secondary)` (#b0a890) | Warmer, less sterile |
| `THEME.ui.menuBar` (#1a1a3a) | `var(--bg-topbar)` (#111116) | Darker, less purple |
| `CATEGORY_COLORS[EventCategory.Political]` (#FFDD44) | `var(--cat-political)` (#d4a832) | More muted/golden |
| `CATEGORY_COLORS[EventCategory.Military]` (#FF4444) | `var(--cat-military)` (#c44040) | Slightly desaturated |
| `SIGNIFICANCE_COLORS.legendary` (#FF00FF) | `var(--sig-legendary)` (#d040c0) | Less neon, more regal |
| `blessed.tags` for colored text | CSS classes + inline styles | No tag balancing needed |
| `screen.render()` | DOM updates (automatic) | No manual render calls |
| `MenuBar` class | `.topbar` nav element | Integrated date+speed+views |
| `PanelId` enum | `data-panel-id` attributes | Same IDs, different selection |
| `LayoutManager` class | CSS Grid + resize observers | Responsive by default |

---

## 18. IMPLEMENTATION PRIORITY

### Phase 1: Foundation (implement first)
1. CSS variables file (`variables.css`)
2. Reset and base styles (`reset.css`)
3. Font loading (`typography.css`)
4. Grid layout shell (`layout.css`)
5. PixiJS canvas mount in map container

### Phase 2: Panel Chrome
1. Panel frame with corner ornaments (`panel-frame.css`)
2. Title bars and close/maximize buttons
3. Resize divider between Event Log and Inspector
4. Scrollbar styling

### Phase 3: Event Log
1. Chronicle mode tabs
2. Temporal headers
3. Event cards with category badges
4. Significance indicators
5. Entity name links
6. Entry animation

### Phase 4: Inspector
1. Tab bar
2. Breadcrumb navigation
3. Collapsible sections with ornamental headers
4. Prose paragraphs and data rows
5. Card grid layout

### Phase 5: Top Bar and Status Bar
1. Top bar layout with logo, date, speed controls
2. View navigation tabs
3. Status bar with runtime stats

### Phase 6: Polish
1. Tooltips
2. Modals (welcome screen, settings)
3. Icon sprite sheet creation
4. Corner ornament sprite creation
5. Accessibility pass (contrast, focus, keyboard)
6. Animation tuning

---

*Design specification by hifi-ui-designer for Aetherum Fantasy World Simulator.*
*Revision 1.0 -- 2026-02-07*
