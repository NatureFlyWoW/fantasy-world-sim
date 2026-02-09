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
