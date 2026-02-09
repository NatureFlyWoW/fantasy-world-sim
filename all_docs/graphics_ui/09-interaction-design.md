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
