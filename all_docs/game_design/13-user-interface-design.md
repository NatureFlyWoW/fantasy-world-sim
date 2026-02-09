## 13. User Interface Design

The current interface is a terminal ASCII application built with the blessed library, rendering at 30fps. The visual philosophy prioritizes information density over graphical fidelity.

### 13.1 Panel Architecture

Eight panels provide different views of the simulation:

```
PANEL LAYOUT (Chronicle-First, Default)
+----------------------------------------------------------+
|  Menu Bar: Map | Chronicle | Inspector | Relations | ...  |
+----------------------------------------------------------+
|                           |                               |
|                           |         World Map             |
|                           |     (terrain, overlays,       |
|                           |      settlements, armies)     |
|     Event Chronicle       |                               |
|                           |-------------------------------|
|   (60% width, full height)|                               |
|                           |        Inspector              |
|   4 modes:                |   (polymorphic, prose-first,  |
|   - Prose (aggregated)    |    6 entity types,            |
|   - Compact (timeline)    |    clickable navigation)      |
|   - Story Arcs (cascade)  |                               |
|   - Domain Focus          |                               |
|                           |                               |
+----------------------------------------------------------+
|  Status Bar: Year 3, Month 7 | Speed: Normal | Overlay   |
+----------------------------------------------------------+
```

Five layout presets cycle with a key press: Narrative (chronicle-first), Default, Map Focus, Log Focus, Split.

### 13.2 The Chronicle (Event Log Panel)

The chronicle is the primary narrative interface, operating in four modes:

**Prose Mode (Default).** Events below significance 60 are aggregated into summary batches by category and participant. High-significance events display full narrative prose. 30 category-specific prose templates generate aggregated summaries.

**Compact Mode.** Timeline-style chronological listing with one-line entries, category badges, and significance indicators.

**Story Arcs Mode.** Cascade tree visualization showing how events chain together. Follows rising action patterns detected by the narrative significance amplifier.

**Domain Focus Mode.** Filters to a single event category (Military, Political, etc.) for deep domain analysis.

**Chronicle Mode Examples:**

```
PROSE MODE (aggregated low-significance events)
---------------------------------------------------------------

  ---- Year 3, Summer ----

  * A season of diplomatic maneuvering saw 4 political
    events reshape the northern frontier. The Iron
    Confederacy's ambassador met with three foreign courts.

  * Beneath the mountains, 3 economic developments unfolded
    as the dwarven mines yielded their treasures to eager
    merchants.

  ** The Betrayal at Dimholt Pass                    [!85]
     In the spring of Year 3, as the armies of the Iron
     Confederacy marched through the narrow defiles of
     Dimholt Pass, Azog the Pale turned his forces against
     his own allies...

  ---- Year 3, Autumn ----

  . Commerce continued its quiet rhythm as merchants plied
    the northern trade routes.

---------------------------------------------------------------

COMPACT MODE (timeline)
---------------------------------------------------------------

  Y3.S1  * Diplomatic envoy sent to Ashenveil       [Pol 35]
  Y3.S1  . Trade agreement renewed with Dale         [Eco 22]
  Y3.S1  . Birth of Thorin's nephew Fili            [Per 18]
  Y3.S2 ** BETRAYAL AT DIMHOLT PASS                 [Mil 85]
  Y3.S2  * War declared against Azog                [Mil 55]
  Y3.S2  * Armies recalled to Confederacy           [Mil 48]

---------------------------------------------------------------

STORY ARCS MODE (cascade tree)
---------------------------------------------------------------

  Azog pledges loyalty (Y1) ─┐
                              ├─> Azog denied mining rights (Y2)
  Mining rights dispute (Y2) ─┘         |
                                        v
                              THE BETRAYAL AT DIMHOLT (Y3) ★
                                   /        |        \
                                  v         v         v
                           War declared  Armies   Diplomatic
                           against Azog  recalled  crisis
                              |                      |
                              v                      v
                        Punitive        Alliance with
                        expedition      Kingdom of Dale

---------------------------------------------------------------
```

**Common Features Across Modes:**
- Temporal headers (year/season/month separators)
- Significance indicators using visual markers: Legendary (two stars), Critical (star), Major (diamond), Moderate (bullet), Minor (dot)
- Region-contextual filtering (toggle with 'r' key, spatial distance-based using Manhattan distance)
- Split pane: left shows event list, right shows selected event detail with causal chains and multiple chronicler perspectives
- Clickable entity names (colored `#88AAFF`) navigate to the inspector
- Event aggregation: events below significance 60 are batched by category and participant using 30 category-specific prose templates

### 13.3 The Context View (Polymorphic Inspector)

The inspector is a deep-dive panel supporting six entity types through a polymorphic shell with consistent interaction patterns.

**Design Principles:**
- **Prose-First, Data-Available.** Every section opens with narrative prose synthesized from data. Numbers remain accessible beneath, but first impression is always a story.
- **Every Name is a Door.** Any entity reference is clickable (`#88AAFF` color). Clicking navigates the inspector to that entity. The player explores a wiki of their emergent world.
- **Layered Depth.** Collapsed headers show one-line summaries. Expanding reveals prose. Within sections, sub-entities can be drilled into. Three layers: glimpse -> narrative -> deep dive.

**Shared Shell Components:**
- Header bar with entity type icon, name, one-liner summary, temporal context
- Breadcrumb navigation trail (max 4 segments, clickable)
- Section accordion (numbered 1-9, expand/collapse with keyboard)
- Footer hint bar (context-sensitive controls)
- History stack (50 entries max, back/forward navigation)

**Character Inspector (7 Sections):**

```
+-- @ CHARACTER -------------------------------------------+
|  Thorin Ironhand, the Unyielding                        |
|  Warlord of the Iron Confederacy  |  Year 247, Age 63  |
|  < Back   [World] > Iron Conf. > Thorin    Forward >    |
|==========================================================|
|                                                          |
|  v [1] The Story So Far                     12 events   |
|    Born in Year 184, Thorin's youth was forged in       |
|    the fires of the War of Broken Passes...             |
|                                                          |
|  v [2] Strengths & Flaws                    Cunning     |
|    A mind as sharp as forged steel...                   |
|    STR [=====-----------]  INT [===============----]    |
|                                                          |
|  > [3] Bonds & Rivalries                  8 relations   |
|  > [4] Worldly Standing                   Warlord       |
|  > [5] Heart & Mind                    Reclaim Erebor   |
|  > [6] Remembered Things               14 memories     |
|  > [7] Possessions & Treasures          3,400 gold     |
|                                                          |
|----------------------------------------------------------|
|  [1-7] Sections  [Bksp] Back  [t] Timeline  [g] Loc.   |
+----------------------------------------------------------+
```

**Faction Inspector (8 Sections):** Rise & Reign, Banner & Creed, Court & Council, Lands & Holdings, Swords & Shields, Alliances & Enmities, Coffers & Commerce, Chronicles.

**Site Inspector (7 Sections):** A Living Portrait, People & Peoples, Power & Governance, Trade & Industry, Walls & Works, Notable Souls, The Annals.

**Event Inspector (6 Sections):** What Happened (full narrative with multiple perspectives), Who Was Involved (all participants clickable), Where & When (location clickable), Why It Matters (significance analysis), What Came Before (causal chain upstream), What Followed (consequence chain downstream).

**Region Inspector (6 Sections):** The Land Itself (biome prose, climate, elevation), Riches of the Earth (resources), Those Who Dwell Here (controlling faction, inhabitants), Marks Upon the Land (nearby settlements), Echoes of the Past (historical events), Arcane Currents (ley lines, magic events).

**Artifact Inspector:** The artifact inspector tells the story of an object as a living participant in history:

```
+-- * ARTIFACT --------------------------------------------+
|  The Sundering Blade                                     |
|  Legendary Weapon  |  Created Year 47 by Vulkaron       |
|==========================================================|
|                                                          |
|  v [1] The Forging                                       |
|    Created during the Celestial War when the god         |
|    Vulkaron struck his hammer upon the World-Anvil,      |
|    this blade was meant to sever the bonds between       |
|    planes...                                             |
|                                                          |
|  v [2] Powers & Properties                               |
|    The blade severs magical bonds and disrupts           |
|    enchantments. Its edge never dulls, and it glows     |
|    faintly when planar boundaries are thin nearby.      |
|    Power Level: Legendary (95)                          |
|                                                          |
|  > [3] The Chain of Hands              7 owners         |
|    Vulkaron -> Hero Kaelin -> House Stormhold ->        |
|    Stolen by Azog -> Lost -> Recovered by Elara ->      |
|    Currently held by Queen Mira                         |
|                                                          |
|  > [4] The Blade's Will               Ambitious         |
|    This artifact has developed rudimentary will.        |
|    It inclines its wielder toward decisive action       |
|    and resistance to magical domination.                |
|                                                          |
|  > [5] Curse & Cost                                     |
|    Those who wield the Sundering Blade too long         |
|    become unable to form magical bonds of any kind.     |
|                                                          |
+----------------------------------------------------------+
```

**Cross-Type Navigation Flows:**

```
Character --> Faction (membership) --> Site (territory) --> Region (geography)
    |              |                       |                     |
    v              v                       v                     v
  Event <-----> Character              Event <---> Region     Event
    |              |                       |
    v              v                       v
Artifact      Character              Faction
```

Every entity type can reach every other type within 1-2 clicks. This creates the "wiki exploration" feeling.

### 13.4 The World Map (with Dynamic Overlays)

The map renders terrain with biome-specific ASCII characters and colors. Six overlay layers are composited onto the terrain, driven by live simulation data through the MapOverlayBridge:

**Six Cached Layers:**
- **Settlements:** Size-based markers (hamlet `.`, village `o`, town `O`, city `@`, capital `#`)
- **Territory:** Faction-colored background tinting with border detection
- **Military:** Army markers, war zone tinting, siege indicators
- **Trade:** Route lines between economic hubs (Bresenham tracing)
- **Magic:** Ley line highlighting, anomaly markers, artifact locations
- **Entity Markers:** Temples, academies, ruins, points of interest

**Seven Overlay Presets** (cycled with 'o' key):

| Preset | Active Layers |
|--------|---------------|
| None | Terrain only |
| Political | Territory + Settlements |
| Military | Territory + Settlements + Military |
| Economic | Settlements + Trade |
| Arcane | Magic + Points of Interest |
| Climate | Temperature/rainfall gradients |
| Full | All layers (visually busy) |

**Multi-Layer Compositing:** Layers share three visual channels (char, fg, bg) through priority rules. Settlements override army markers which override trade routes which override territory tinting. Siege scenarios composite settlement marker with military red tint.

**Performance:** Event-driven dirty flags with per-layer refresh intervals (Military: 1 tick, Settlements/Territory: 30 ticks, Trade/Magic: 90 ticks). O(1) tile lookups via cached Maps. Viewport-scoped queries using the SpatialIndex QuadTree. 30fps maintained with all overlays active.

### 13.5 Supporting Panels

**Relationships Panel.** Node-and-edge ASCII graph with color-coded relationship types:

| Color | Relationship Type |
|-------|------------------|
| Blue | Family |
| Green | Friendship |
| Red | Rivalry |
| Yellow | Political alliance |
| Purple | Religious affiliation |
| Cyan | Teacher-student |

Edge intensity indicates relationship strength. The graph supports filtering by type, temporal scrubbing to see how relationships evolved, cluster detection for factions and social groups, and centering on a selected entity with configurable depth (1-3 hops).

**Timeline Panel.** Horizontal timeline with key events marked by significance:

```
TIMELINE VIEW
---------------------------------------------------------------
                    Era of Founding
         |====================|
Year  0   10   20   30   40   50   60   70   80   90  100
      |    |    |    |    |    |    |    |    |    |    |
      .    .    .    *    .    .    **   .    .    .    .
Iron Confederacy ████████████████████████████████████████
Ashenveil Republic      ████████████████████████████████
Goblin Horde                    ████████████████████████
                    *=significant events  .=minor events
---------------------------------------------------------------
```

Parallel tracks for different civilizations (color-coded rows). Zoom from millennia overview to daily granularity. Event filtering, search, and branching visualization for What-If timelines.

**Statistics Panel.** Aggregate data visualization using ASCII bar charts, line charts, and area charts:
- Population by race and civilization over time
- Territory control stacked area chart
- Technology progress per civilization
- Magic prevalence charts
- Warfare intensity heatmaps
- Economic production trends
- Religion follower distributions

**World Fingerprint Panel.** Compact identity visualization showing balance glyph, civilization palette, volatility graph, magic curve, and complexity score (see Section 14).

**Region Detail Panel.** Atmospheric biome prose, resources, climate data for the map cursor's location. Uses the BIOME_PROSE and RESOURCE_PROSE lookup tables to generate immersive descriptions.

### 13.6 Keyboard and Mouse Controls

**Global Keys (always available):**

| Key | Action |
|-----|--------|
| Tab | Cycle focus between panels |
| Space | Pause/resume simulation |
| 1-8 | Focus panel by number |
| +/- | Increase/decrease simulation speed |
| L | Cycle layout preset |
| ? | Show help overlay |
| F5 | Quick save |
| F9 | Quick load |

**Map Panel Keys (when focused):**

| Key | Action |
|-----|--------|
| W/A/S/D or arrows | Pan map |
| Z/X | Zoom in/out |
| O | Cycle overlay preset |
| Enter | Inspect entity/region at cursor |
| M | Toggle minimap |

**Chronicle Panel Keys (when focused):**

| Key | Action |
|-----|--------|
| Up/Down | Scroll events |
| Enter | Inspect selected event |
| I | Inspect event participant |
| N | Cycle chronicle mode |
| R | Toggle region filtering |
| F | Filter by category |

**Inspector Panel Keys (when focused):**

| Key | Action |
|-----|--------|
| 1-9 | Toggle section expand/collapse |
| Up/Down | Scroll content |
| Left/Backspace | Navigate back |
| Right | Navigate forward |
| G | Go to entity's map location |
| Click (mouse) | Navigate to clicked entity name |

### 13.7 The Welcome Experience

When the player first starts the simulation, a welcome screen appears during a 30-tick warmup period. This warmup allows the simulation to establish initial state before the player begins observing. The welcome screen shows:

- World seed and generation parameters
- Key factions and their leaders
- Geographic overview (continent count, biome distribution)
- Initial tensions and conflicts
- Instructions for getting started

After the warmup, the welcome dismisses and the chronicle begins filling with events. The world dashboard (inspector panel with no entity selected) shows a narrative synthesis of the current era:

```
+-- WORLD PULSE -------------------------------------------+
|                                                          |
|  This is an age where skirmishes flare across frontiers, |
|  and faith moves multitudes to action. Meanwhile,        |
|  knowledge gathers dust in neglected halls.              |
|                                                          |
|  --- GREAT POWERS -------------------------------------- |
|    & Iron Confederacy -- 45,000 souls                   |
|    & Ashenveil Republic -- 32,000 souls                 |
|    & Goblin Horde -- 18,000 souls                       |
|                                                          |
|  --- WINDS OF CONFLICT --------------------------------- |
|    * Drums of war sound across borders                  |
|    * Ambition challenges the throne                     |
|                                                          |
|  --- RECENT TIDINGS ------------------------------------ |
|    * Steel clashes upon the field                       |
|    * Trust shatters like glass                          |
|                                                          |
|  Click any entity name to begin exploring the world.     |
+----------------------------------------------------------+
```

Faction names in the dashboard are clickable, opening the faction inspector.
