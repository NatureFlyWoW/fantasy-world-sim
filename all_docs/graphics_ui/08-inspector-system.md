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
