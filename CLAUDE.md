# Fantasy World Simulator (Æternum)

## What This Is
Procedural fantasy world simulator inspired by Dwarf Fortress Legends Mode. Generates living fantasy worlds and simulates their evolution across centuries. Players observe and lightly influence ("cultivate") a generated world through an ASCII terminal interface with dual event streams: raw logs + narrative prose.

## Design Pillars
1. Emergent storytelling — no hand-authored events
2. Depth over breadth — fewer entities, rich interconnection
3. Observation and cultivation — nudges, never commands
4. Believability — every event has traceable causation
5. Layered interpretation — same events as data, logs, and literary prose

## Architecture
- **ECS**: Entities with composable components, Map-backed stores, monotonic IDs (branded types)
- **Event-Driven**: Simulation → events → systems react → narrative transforms
- **Tick-Based**: 1 tick = 1 day, 360 days/year. 6 frequency tiers: Daily/Weekly/Monthly/Seasonal/Annual/Decadal
- **13-Step Tick Order**: Time → Environment → Economy → Politics → Social → Character AI → Magic → Religion → Military → Event Resolution → Narrative → Cleanup → Player Notification
- **LoD**: Full (50 tiles), Reduced (200), Abstract (beyond). Significance override: 85
- **Event Cascading**: Dampening `baseProbability × (1-dampening)^depth`, max depth 10
- **Influence**: Processes BETWEEN ticks. Maps to existing event categories (Religious, Personal, Cultural, Economic, Disaster) — never a separate category

## Packages
- `@fws/core` — ECS, simulation loop, time, events, LoD, spatial index, persistence
- `@fws/generator` — Terrain, ecology, cosmology, races, names, pre-history
- `@fws/renderer` — Terminal ASCII UI (blessed): 8 panels, 5 layouts, 30fps
- `@fws/narrative` — 281 templates, 5 tones, chronicler system, vignettes
- `@fws/cli` — Entry point, controls, influence system, save/load
- `@fws/electron` — Electron + PixiJS graphical frontend (primary renderer)

## Conventions
- **TypeScript**: Strict mode, no `any`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- **ESM**: `.js` extensions in imports; `export type` for type-only exports
- **Branded IDs**: EntityId, CharacterId, FactionId, SiteId, ArtifactId, EventId, DeityId, BookId, RegionId, WarId, InfluenceActionId
- **Events**: Immutable records; systems communicate ONLY through EventBus + components
- **Testing**: Vitest, tests alongside source (`*.test.ts`)
- **Context7**: Always use for library/API docs

## Commands
```bash
pnpm run typecheck    # TypeScript validation (from workspace root)
pnpm run test         # Run all tests (2909 passing)
pnpm run start        # Generate world + terminal UI
pnpm run start -- --seed 42 --headless --ticks 100  # Deterministic headless run
pnpm run start:electron  # Launch Electron graphical UI
pnpm --filter @fws/core run build   # Rebuild core dist (required after adding new exports)
pnpm --filter @fws/generator run build  # Rebuild generator dist (same)
```

> **Build note:** `start:electron` only compiles the Electron package — it does NOT rebuild workspace dependencies. After adding new exports to `@fws/core` or `@fws/generator`, you must `pnpm run build` in those packages first or Electron will fail at runtime with missing export errors.

## Subagent Routing
- Game design, engagement, emergent narrative → `fantasy-gdesigner`
- UI, graphics, sprites → `hifi-ui-designer` / `procgen-pixel-artist`
- Simulation, ECS, storytelling → `aeternum-sim-dev` / `comp-sim-lead` / `fantasy-story-narrative`
- Performance, loop orchestration → `fantasy-sim-story-worker`
- TypeScript types → `voltagent-lang:typescript-pro`

## Phase History
- **1-2**: ECS foundation, world generation pipeline
- **3**: 10 simulation systems (Character AI, Memory, Faction, Economic, Military, Magic, Religion, Cultural, Ecology, Secrets)
- **4**: Terminal UI, 8 panels
- **5**: Narrative engine (281 templates, 5 tones, chronicler, vignettes)
- **6**: Simulation controls, influence system (17 actions, 3 categories, IP economy)
- **7**: World fingerprint, timeline branching, save/load, heraldry, dreaming
- **8**: UX Overhaul — prose-first chronicle (4 modes, aggregation, region filter), 6 polymorphic inspectors (Character/Faction/Site/Artifact/Event/Region), dynamic map overlays (6 layers, 7 presets, territory flood-fill, trade routes), click-to-inspect navigation
- **9 (COMPLETE)**: Graphics Overhaul — Electron + PixiJS frontend (primary renderer). IPC bridge, CSS Grid, PixiJS tilemap, pan/zoom, overlays, entity markers, panel chrome, world animations, procedural art (heraldry, tile variants, icon atlas), final polish & accessibility
- **10 (IN PROGRESS)**: Code Improvement — Split entity-inspector.ts monolith, extract world/engine factories, data-driven InfluenceSystem, type block extraction, shared algorithm deduplication. Design: `docs/plans/2026-02-10-post-phase9-code-improvement-design.md`
- **11 (PLANNED)**: Code Review — Post-improvement review and validation

## Common Pitfalls
- `TerrainTile` has NO `freshwater` — use `tile.riverId !== undefined`
- Must use `pnpm run typecheck`, not `npx tsc --noEmit`
- `import type` for enums used as values → TS1361. Use regular `import`
- `exactOptionalPropertyTypes`: Cannot assign `undefined` to optional — use spread
- Phase 3 systems use INTERNAL Maps, NOT ECS queries
- `WorldEvent.id` is `EventId` (branded), not `EntityId`
- Blessed tags MUST close on every line — multi-line spans corrupt rendering
- `buildEntityResolver()` needs World param for runtime fallback
- Template subtypes: simulation uses prefixed (`culture.technology_invented`), templates use simple (`technology_invented`)
- BasePanel `resize()`/`moveTo()`/`focus()`/`blur()` must NOT call `screen.render()`

## Design Documents
- `all_docs/game_design/game_design_index.md` — 19 section files (load only what you need)
- `all_docs/graphics_ui/graphics_ui_index.md` — 16 section files (Caves of Qud-inspired visual spec)

## Known Issues
- EventCategory.Exploratory has no system producing events
