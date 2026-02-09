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
