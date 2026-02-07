# Æternum — UI Overhaul Implementation Guide

## For Claude Code in VS Code

**Purpose:** This document provides copy-paste-ready prompts and step-by-step implementation tasks to transform the current terminal UI from its broken prototype state into the intended design shown in the UI mockup. Each task includes the problem diagnosis, the solution approach, the exact Claude Code prompt to use, and verification steps.

**Prerequisites:** Phase 7 merged to main. All 2,612 tests passing. Fresh Claude Code sidebar session recommended.

**Branch Setup (Terminal: Shell):**
```bash
git checkout main
git pull
git checkout -b ui-overhaul/phase-1
```

---

## Understanding the Target Layout

The target UI (from ui_sample.png mockup) has five distinct zones:

```
┌─────────────────────────────────────────────────────────────────────┐
│ [BLUE] Top Navigation Bar — Entity Browser / Menu                   │
├─────────────────────────────────────┬───────────────────────────────┤
│                                     │                               │
│  [RED] Overview Map                 │  [YELLOW] Event Log           │
│  Full world map, zoomed out         │  High-significance events     │
│  Shows entire generated world       │  only, filtered by default    │
│  Fills this entire quadrant         │  Narrative prose format       │
│                                     │                               │
├─────────────────────────────────────┼───────────────────────────────┤
│                                     │                               │
│  [PINK] Detail Map                  │  [GREEN] Inspector            │
│  Close-up view of selected area     │  Narrative details about      │
│  from the overview map              │  whatever is selected on      │
│  Full tile-level rendering          │  either map view              │
│                                     │                               │
├─────────────────────────────────────┴───────────────────────────────┤
│ Status Bar: Year/Month/Day | Speed | Selection | IP                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout Proportions:**
The left column (maps) takes roughly 60% of width. The right column (event log + inspector) takes 40%. The top navigation bar is 1-2 rows. The status bar is 1 row. Within each column, the vertical split is roughly 50/50.

---

## Task 1 — Fix World Map Viewport Filling

### Problem

The world map renders only a thin strip of terrain (2-5 rows visible) instead of filling the entire top-left quadrant. The generated world data exists and is correct — the rendering pipeline just isn't computing the correct number of tile rows/columns based on the blessed box dimensions.

### Root Cause Analysis

The map panel's tile renderer likely calculates its grid dimensions from hardcoded values or from blessed box properties that return 0 during initial render (blessed boxes report dimensions only after the screen has fully laid out). The viewport needs to read actual rendered dimensions from the blessed box *after* layout completes, not during construction.

### Claude Code Prompt

```
Read CLAUDE.md. Starting UI Overhaul Task 1 — Fix World Map Viewport Filling.

The world map currently renders only a thin strip of terrain instead of filling its
panel area. Debug this by:

1. Read packages/renderer/src/map/map-panel.ts and packages/renderer/src/map/viewport.ts.
   Trace how the tile grid dimensions (rows × columns to render) are calculated.

2. Read packages/renderer/src/layout-manager.ts to understand how panel dimensions
   are assigned. Check if the blessed box width/height properties are being read
   correctly.

3. The likely issue: viewport dimensions are set during construction when the blessed
   box hasn't been laid out yet (reports 0×0). Fix by:
   a. Adding a resize handler that recalculates viewport dimensions when the blessed
      box reports its actual size.
   b. Deferring initial render until after screen.render() has been called at least once.
   c. The viewport should use (box.width - 2) for columns and (box.height - 2) for rows
      (subtracting border characters).

4. After fixing, the map should fill the ENTIRE panel area with terrain tiles.
   Every row from top to bottom of the map panel should show terrain.

5. Run existing tests to make sure nothing breaks: pnpm run test
6. Do a manual verification: pnpm run start -- --seed 42
   The map panel should show a full grid of colored terrain, not a thin strip.

Commit: "fix(renderer): map viewport fills entire panel area on resize"
```

### Verification

After implementation, `pnpm run start -- --seed 42` should show terrain filling the entire top-left panel from edge to edge. Resizing the terminal window should cause the map to re-fill the new dimensions.

---

## Task 2 — Fix Event Log Template Resolution

### Problem

Event log entries show garbled text like "Character:cstudyilorecoossquencee", "Character:ctrfteitem", and "Zhi Yamto was involvedtinfan e e event." instead of properly formatted narrative prose. Template variables like `{character.name}` and `{action}` are being partially resolved or concatenated with surrounding text.

### Root Cause Analysis

The NarrativeEngine's TemplateParser resolves `{variable.field}` placeholders using an EntityResolver that maps entity IDs to their component data. The garbled output suggests either: (a) the EntityResolver isn't receiving the correct World/component context at runtime, (b) template variables are being partially matched (e.g., `{character.` matches but `.name}` doesn't resolve, leaving fragments), or (c) the event formatter in the renderer is concatenating raw event type strings with partial narrative output.

### Claude Code Prompt

```
Read CLAUDE.md. UI Overhaul Task 2 — Fix Event Log Template Resolution.

Event log shows garbled text like "Character:cstudyilorecoossquencee" instead of
proper narrative prose. Diagnose and fix:

1. Read packages/narrative/src/transforms/template-parser.ts — understand how
   {variable.field} placeholders are resolved.

2. Read packages/narrative/src/transforms/narrative-engine.ts — understand how
   events are transformed into narrative text, specifically how EntityResolver
   provides entity data (character names, faction names, etc.).

3. Read packages/renderer/src/panels/event-formatter.ts — understand how the
   renderer formats events for display. Check if it's properly calling the
   narrative engine or falling back to raw event data.

4. Read packages/renderer/src/panels/event-log-panel.ts — check how formatted
   events are displayed and whether blessed color tags interfere with text.

5. Add diagnostic logging (temporary) in the narrative engine's resolve path:
   - Log when a template variable is found but can't be resolved
   - Log the entity context data being passed to the resolver
   - Check if World.getComponent() calls are returning undefined

6. The fix likely involves one or more of:
   a. Ensuring the NarrativeEngine receives a valid World reference with populated
      component data when processing runtime events (not just test fixtures)
   b. Fixing the EntityResolver to properly extract character/faction names from
      ECS components
   c. Fixing the event formatter to use narrative output when available, falling
      back to a CLEAN formatted string (not garbled concatenation) when not
   d. Ensuring blessed tag stripping doesn't corrupt the text

7. After fixing, event log entries should read like:
   "Year 3, Day 20: Zhi Yamto studied ancient lore at the Academy of Stars"
   NOT like: "Character:cstudyilorecoossquencee"

8. Run tests: pnpm run test
9. Manual verify: pnpm run start -- --seed 42, run sim for ~50 ticks

Commit: "fix(narrative,renderer): resolve template variables in event log display"
```

### Verification

After running simulation for ~50 ticks, every event log entry should display readable, grammatical narrative text with actual character names, location names, and action descriptions. No `{variable.field}` placeholders, no garbled concatenations.

---

## Task 3 — Implement Significance-Based Event Filtering

### Problem

The event log displays every single event regardless of significance, creating an unreadable wall of spam. Low-significance routine events (a character praying, routine trade) drown out world-shaping events (wars declared, kings crowned, catastrophes).

### Claude Code Prompt

```
Read CLAUDE.md. UI Overhaul Task 3 — Event Log Significance Filtering.

The event log shows every event regardless of importance, making it unreadable.
Implement significance-based filtering:

1. Read packages/renderer/src/panels/event-log-panel.ts to understand the current
   filter system. Check if significance filtering exists but isn't wired up, or
   if it needs to be built.

2. Implement a default significance threshold of 60 (on the 0-100 scale) for the
   main event log display. Events below this threshold should not appear in the
   log by default.

3. Add keyboard controls to adjust the threshold:
   - [ and ] keys to decrease/increase threshold by 10
   - Display current threshold in the event log panel header:
     "Event Log [Epic Historical] — Significance: 60+"

4. Implement category-specific significance overrides. For example:
   - Military events (battles, wars): show at significance 40+
   - Disaster events: show at significance 30+ (always notable)
   - Personal/routine events: show at significance 70+ (only major life events)

5. Add a "show all" toggle (key: A) that temporarily removes the filter,
   and a visual indicator when filtering is active.

6. When significance filtering is active, the event log should show maybe
   5-15 events per simulated year rather than hundreds.

7. Run tests, then manual verify with 100+ ticks of simulation.

Commit: "feat(renderer): significance-based event log filtering with adjustable threshold"
```

---

## Task 4 — Restructure Layout to Dual-Map + Navigation Bar

### Problem

The current layout has a single map panel with a minimap strip, an event log on the right, and an inspector below. The target layout requires: a top navigation bar, an overview map (top-left), a detail/close-up map (bottom-left), an event log (top-right), and an inspector (bottom-right).

### Claude Code Prompt

```
Read CLAUDE.md. UI Overhaul Task 4 — Restructure Layout to Target Design.

The UI needs to be restructured from the current layout to match the target design.
This is a significant refactor of packages/renderer/src/layout-manager.ts and
packages/renderer/src/app.ts.

TARGET LAYOUT:
┌──────────────────────────────────────────────────────────────────┐
│ Navigation Bar (1-2 rows): [People] [Factions] [Sites] [Items]  │
├──────────────────────────────────┬───────────────────────────────┤
│                                  │                               │
│  Overview Map (full world)       │  Event Log (filtered)         │
│  ~60% width, ~48% height        │  ~40% width, ~48% height      │
│                                  │                               │
├──────────────────────────────────┼───────────────────────────────┤
│                                  │                               │
│  Detail Map (zoomed area)        │  Inspector (narrative)        │
│  ~60% width, ~48% height        │  ~40% width, ~48% height      │
│                                  │                               │
├──────────────────────────────────┴───────────────────────────────┤
│ Status: Year X, Month Y, Day Z (Season) | Speed | Selection     │
└──────────────────────────────────────────────────────────────────┘

Implementation plan:

1. Modify layout-manager.ts to create the new 5-zone layout:
   - navBar: blessed.box at top, height 3 (1 row + borders)
   - overviewMap: blessed.box at top-left, width 60%, height ~48%
   - eventLog: blessed.box at top-right, width 40%, height ~48%
   - detailMap: blessed.box at bottom-left, width 60%, height ~48%
   - inspector: blessed.box at bottom-right, width 40%, height ~48%
   - statusBar: blessed.box at bottom, height 1

2. Create a new OverviewMapPanel (or repurpose the existing MapPanel):
   - Always shows the entire world map zoomed to fit the panel
   - Highlights a selection rectangle showing what the detail view displays
   - Clicking/navigating here moves the detail view's focus
   - Uses the minimap's rendering approach but at full panel size

3. Create the DetailMapPanel (or adapt existing MapPanel):
   - Shows the zoomed-in, tile-by-tile view of the selected area
   - This is the current MapPanel behavior but properly viewport-filling
   - Arrow keys navigate within this view
   - Entity markers visible at zoom levels 1:1 through 4:1

4. Create a NavigationBar component:
   - Horizontal bar with tab-like buttons: [People] [Factions] [Sites] [Artifacts]
   - Each tab opens a browsable list overlay or changes the inspector to list mode
   - Tab/Shift+Tab cycles between tabs
   - Enter on a tab opens the entity browser for that type
   - The nav bar should also show current keybinding hints

5. Wire the overview map selection to the detail map viewport:
   - Cursor on overview map = selection rectangle
   - The detail map shows the area inside that rectangle
   - Moving the overview cursor updates the detail view in real-time

6. Wire entity selection from either map or event log to the inspector:
   - Clicking a tile on the detail map that contains an entity → inspector shows it
   - Pressing Enter on an event log entry → inspector shows involved entities
   - The inspector should show narrative-format descriptions, not raw data dumps

7. Update app.ts to use the new layout and wire all panels together.

8. Run all tests. Fix any test breakages from the layout refactor.
9. Manual verify: pnpm run start -- --seed 42

Commit: "feat(renderer): dual-map layout with navigation bar and inspector integration"
```

### Verification

On startup, the player should see: a navigation bar at top with entity type tabs, the full world map filling the top-left quadrant, the event log on the top-right showing filtered important events, a detail/zoomed view filling the bottom-left, and the inspector in the bottom-right ready to show selected entity details.

---

## Task 5 — Make Inspector Panel Narratively Rich

### Problem

The inspector panel shows "No entity selected" with basic instructions but doesn't produce meaningful output when entities are selected. The target is a narratively rich panel that reads like a short encyclopedia entry, not a debug data dump.

### Claude Code Prompt

```
Read CLAUDE.md. UI Overhaul Task 5 — Narrative Inspector Panel.

The inspector should display entity information as narrative prose, not raw data.
When a character is selected, instead of:

  Name: Zhi Yamto
  Age: 47
  Faction: Crimson Dynasty
  Traits: ambitious, scholarly, patient
  Health: 82/100

It should display:

  ═══ Zhi Yamto ═══
  Scholar of the Crimson Dynasty

  Zhi Yamto is a 47-year-old scholar serving the Crimson Dynasty. Known
  for her ambitious yet patient temperament, she has dedicated her life
  to the pursuit of arcane knowledge. Her health is robust, and her
  reputation among peers speaks of quiet determination.

  Recent Events:
  She recently completed a study of ancient protective wards at the
  Academy of Stars, adding to her growing expertise in magical theory.

  Relationships:
  Allied with Keeper Morath (mutual scholarly respect), rivalrous with
  Commander Vex (ideological disagreement over military spending).

Implementation:

1. Read packages/renderer/src/panels/inspector-panel.ts and the sub-inspectors
   (character-inspector.ts, faction-inspector.ts, location-inspector.ts,
   artifact-inspector.ts).

2. Read packages/narrative/src/vignettes/introspection.ts — this already
   generates first-person monologue. Adapt similar logic for third-person
   inspector prose.

3. Create an InspectorNarrativeFormatter that takes entity component data and
   produces prose paragraphs:
   - Character: name/title line, faction affiliation, personality description
     derived from trait values, recent event summary (last 3-5 events involving
     this entity), key relationships with brief context
   - Faction: name/government type, territory description, current political
     situation, recent significant events, key figures
   - Location: name/type, geographic description from biome data, population,
     notable features, recent events here
   - Artifact: name, creation story from pre-history, current owner/location,
     known properties, legends about it

4. Wire the inspector to update whenever:
   - A map tile with an entity is selected (from detail map)
   - An event log entry is highlighted and Enter is pressed
   - A navigation bar entity browser item is selected

5. The inspector should have scrollable content (blessed scrollable box)
   since narrative descriptions can be longer than the panel.

6. Add color accents for section headers using blessed tags.

7. Run tests and manual verify.

Commit: "feat(renderer): narrative-format inspector with prose entity descriptions"
```

---

## Task 6 — Navigation Bar Entity Browser

### Problem

There is no way to browse the world's entities (characters, factions, settlements, artifacts) outside of stumbling upon them on the map or in the event log. The top navigation bar should provide organized access to all entities.

### Claude Code Prompt

```
Read CLAUDE.md. UI Overhaul Task 6 — Navigation Bar Entity Browser.

Implement the top navigation bar that provides access to entity browsers.

1. Create packages/renderer/src/panels/nav-bar.ts:
   - Horizontal bar at the top of the screen, height 3 (with borders)
   - Display tab buttons: [1:People] [2:Factions] [3:Sites] [4:Artifacts] [5:Events] [6:Stats] [7:DNA]
   - Number keys 1-7 activate the corresponding tab
   - Active tab is highlighted (different background color)
   - Show context-sensitive keybinding hints on the right side of the bar

2. For tabs 1-4, pressing the number key opens an entity list overlay:
   - A blessed list box that overlays the inspector panel area
   - Shows all entities of that type, sorted by significance/importance
   - Each list item: "Name — Brief descriptor" (e.g., "Zhi Yamto — Scholar, Crimson Dynasty")
   - Arrow keys navigate, Enter selects and updates the inspector
   - Escape closes the list and returns to normal view
   - The list should pull entities from World.query() with the relevant component types

3. For tab 5 (Events), show the event log in full-panel mode with
   expanded narrative detail per event.

4. For tabs 6-7, show the Statistics and Fingerprint panels respectively
   (these already exist — just need to be accessible from the nav bar).

5. Wire navigation bar state to the rest of the UI:
   - Selecting an entity from a list → updates inspector + centers detail map on entity
   - The nav bar should show the name of the currently inspected entity

6. Run tests and manual verify.

Commit: "feat(renderer): navigation bar with entity browser tabs"
```

---

## Task 7 — Startup Sequence and Initial Render Polish

### Problem

On startup, the world map shows almost nothing — just a thin strip. The simulation should not start automatically; the player should see the fully rendered world first, have a chance to explore it, and then press Space to begin the simulation.

### Claude Code Prompt

```
Read CLAUDE.md. UI Overhaul Task 7 — Startup Sequence Polish.

The startup experience needs to properly render the world before the player begins:

1. Read packages/cli/src/index.ts and packages/renderer/src/app.ts to understand
   the current startup sequence.

2. Ensure this sequence:
   a. Generate world (show "Generating world..." in a centered splash message)
   b. Create all panels and the layout
   c. Call screen.render() to compute blessed box dimensions
   d. THEN initialize map viewports using actual box dimensions (this is critical —
      viewports must read dimensions AFTER blessed has laid out the boxes)
   e. Render the full world map into both overview and detail panels
   f. Display startup message: "World generated. Press [Space] to begin simulation."
   g. Show world summary in the inspector: world name, size, number of factions,
      characters, settlements, seed value, brief pre-history summary
   h. Wait for Space press before starting the simulation tick loop

3. The initial render should show:
   - Overview map: full world visible, terrain colored by biome
   - Detail map: centered on the world's most significant settlement
   - Event log: pre-history summary events (founding of kingdoms, etc.)
   - Inspector: world overview prose
   - Status bar: "Year 1, Month 1, Day 1 (Spring) | Speed: Paused | Press Space to begin"

4. After Space is pressed:
   - Status bar updates to show running speed
   - Simulation ticks begin
   - Events start flowing into the log

5. Run tests and manual verify with multiple terminal sizes.

Commit: "fix(cli,renderer): startup sequence renders full world before simulation begins"
```

---

## Task 8 — Color and Visual Polish

### Problem

Even when tiles render, the visual presentation is crude. Terrain biomes need distinct, readable colors. Entity markers need to stand out. Panel borders should create clear visual separation. The overall aesthetic should evoke a polished roguelike or Dwarf Fortress feel.

### Claude Code Prompt

```
Read CLAUDE.md. UI Overhaul Task 8 — Visual Polish.

Polish the visual presentation of the terminal UI:

1. Read packages/renderer/src/themes/biome-chars.ts and packages/renderer/src/theme.ts.

2. Define a comprehensive color palette for terrain biomes:
   - Deep Ocean: dark blue background
   - Shallow Water: blue background  
   - Beach/Coast: yellow text on dark background
   - Grassland: green text on dark background
   - Forest: dark green on black, dense characters (♠, ♣)
   - Dense Forest: bright green, double characters
   - Mountain: gray/white on dark, triangle chars (▲, △)
   - Snow/Tundra: white on dark blue
   - Desert: yellow on dark
   - Swamp: dark green on dark, wavy chars (~)
   - Volcanic: red on dark
   - Magical/Ley Line: magenta/purple

3. Entity markers should use bright, high-contrast colors:
   - Cities/Settlements: bright yellow ☼
   - Ruins: dark red †
   - Armies: bright red ⚔
   - Temples: bright cyan ✦
   - Academies: bright blue ✧
   - Capitals: bright white ⚑

4. Panel borders should use blessed's built-in line-drawing:
   - Active/focused panel: bright border color
   - Inactive panels: dim border color
   - Panel titles: centered, bold

5. Event log entries should have color-coded significance:
   - Significance 90+: bright white/bold — world-shaking
   - Significance 70-89: yellow — major event
   - Significance 50-69: cyan — notable
   - Significance 30-49: gray — minor (only visible if filter lowered)

6. The status bar should use color segments:
   - Date: white
   - Speed: green when running, red when paused
   - Selection: cyan
   - IP remaining: yellow

7. Run tests and manual verify.

Commit: "feat(renderer): comprehensive visual polish with biome colors and significance coding"
```

---

## Task Dependency Order

These tasks have dependencies and should be executed in this sequence:

```
Task 1 (Fix Map Viewport) ──────────┐
                                     │
Task 2 (Fix Template Resolution) ────┼──→ Task 3 (Significance Filtering)
                                     │
Task 7 (Startup Sequence) ──────────┘
                                     │
                                     ▼
                              Task 4 (Layout Restructure)
                                     │
                                     ├──→ Task 5 (Narrative Inspector)
                                     │
                                     ├──→ Task 6 (Navigation Bar)
                                     │
                                     └──→ Task 8 (Visual Polish)
```

Tasks 1, 2, and 7 can be done in parallel as they touch different files. Task 4 depends on all three being complete because it restructures the layout those fixes target. Tasks 5, 6, and 8 can be done in parallel after Task 4.

---

## Git Workflow

Each task should be committed separately on the `ui-overhaul/phase-1` branch. After all tasks are verified:

```bash
git checkout main
git merge ui-overhaul/phase-1
```

If any task grows too large, split it into a sub-branch:
```bash
git checkout ui-overhaul/phase-1
git checkout -b ui-overhaul/task-4-layout
# ... do work ...
git checkout ui-overhaul/phase-1
git merge ui-overhaul/task-4-layout
```

---

## Post-Overhaul: What's Next

After the UI overhaul, the prototype will be in a state where the simulation's emergent behavior is actually visible and interactive. From there, the remaining work falls into three categories:

**Simulation Gaps:** Enable the Exploratory event category with a proper exploration system. Fix the determinism bug (stray Math.random() calls). Investigate silent event categories and ensure all systems produce proportional event output.

**Phase 8 — Polish & Optimization:** Performance profiling with Large (800×800) worlds and 100+ year simulations. Memory optimization for long-running simulations. Batch processing for faction populations. Historical data compression for old events.

**Phase 9 — Documentation & Release:** README with screenshots, architecture docs, system interaction guide, CHANGELOG, and contributor guide. This is the prompting guide's Phase 9 task list.
