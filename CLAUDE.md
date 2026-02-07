# Fantasy World Simulator (Æternum)

## What This Is
Procedural fantasy world simulator inspired by Dwarf Fortress Legends Mode. Generates living fantasy worlds and simulates their evolution across centuries. Players observe and lightly influence ("cultivate") a generated world through an ASCII terminal interface with dual event streams: raw logs + narrative prose.

## Design Pillars
1. Emergent storytelling over scripted content — no hand-authored events
2. Depth over breadth — fewer entities with rich interconnection
3. Observation and cultivation — player nudges, never commands
4. Believability through complexity — every event has traceable causation
5. Layered interpretation — same events as data, logs, and literary prose

## Architecture
- **ECS**: All world objects are entities with composable components
- **Event-Driven**: Simulation produces events → systems react → narrative transforms
- **Tick-Based**: 1 tick = 1 day. 6 frequency tiers: Daily/Weekly/Monthly/Seasonal/Annual/Decadal
- **13-Step Tick Order**: Time → Environment → Economy → Politics → Social → Character AI → Magic → Religion → Military → Event Resolution → Narrative Generation → Cleanup/Indexing → Player Notification
- **Level-of-Detail**: Full (50 tiles), Reduced (200 tiles), Abstract (beyond)
- **Spatial Indexing**: Quadtree for map queries
- **Memory & Reputation**: Persistent memories with decay/distortion, multi-dimensional reputation propagating through social networks
- **Event Cascading**: Consequence chains across domains with dampening (max depth: 10)

## Packages
- `@fws/core` — ECS, simulation loop, time, events, LoD, spatial index, persistence
- `@fws/generator` — Terrain, ecology, cosmology, races, names, pre-history, initialization
- `@fws/renderer` — Terminal ASCII UI (blessed): 8 panels (map, event log, inspector, relationships, timeline, statistics, fingerprint, region detail)
- `@fws/narrative` — Template engine (281 templates, 5 tones), chronicler system, vignettes
- `@fws/cli` — Entry point, simulation controls, influence system, save/load UI

## Conventions
- **TypeScript**: Strict mode, no `any` types, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- **ESM**: `.js` extensions in import paths; `export type` for type-only exports
- **Branded IDs**: EntityId, CharacterId, FactionId, SiteId, ArtifactId, EventId, DeityId, BookId, RegionId, WarId, InfluenceActionId
- **Pure Functions**: Simulation logic is pure; classes only for entities/stores
- **Events**: Immutable records; systems communicate ONLY through event queue and shared component state
- **Influence System**: Maps to existing event categories (Religious, Personal, Cultural, Economic, Disaster) — never a separate 'Influence' category. Player actions feel like natural world events.
- **Testing**: Vitest, tests alongside source (`*.test.ts`), test every system in isolation
- **Context7**: Always use for library/API documentation, code generation, setup/configuration steps

## Commands
```bash
pnpm run typecheck                   # TypeScript validation (from workspace root)
pnpm run test                        # Run all tests
pnpm run test:watch                  # Watch mode
pnpm run start                       # Generate world and launch terminal UI
pnpm run start -- --seed 42          # Deterministic generation
pnpm run start -- --headless         # Run without UI (testing/CI)
pnpm run start -- --ticks 100        # Run specific tick count (headless)
```

## Subagent Routing
When delegating complex tasks to subagents, prefer:
- Project-specific game design, player engagement systems, emergent narrative gameplay → `fantasy-gdesigner`
- Game UI, graphics, sprite design → `ascii-ui-designer` 
- Simulation and narrative systems, simulated entities, storytelling, ECS → `aeternum-sim-dev` or `comp-sim-lead` or `fantasy-story-narrative`
- General game logic, game design → `voltagent-domains:game-developer`
- Backend architecture, APIs → `voltagent-domains:backend-developer` or `fullstack-developer`
- TypeScript, complex types, type-safe applications → `voltagent-lang:typescript-pro`
- Knowledge synthesis, merging data sources → `voltagent-meta:knowledge-synthesizer`
- Task organization, planning, priorities → `voltagent-meta:agent-organizer` or `fantasy-sim-story-worker`

## Current Phase
**Phase 8: UX Overhaul** (Tier 1-4 complete, Tier 5 remaining)

**Complete:**
- 8.1-8.2: Entity name resolution, world dashboard, significance labels
- 8.3-8.4: Click handling (menu bar, event log), context-sensitive status hints
- 8.5-8.6: Auto-pause on legendary events (sig 95+), welcome screen with warmup
- 8.7: Narrative-first UI (281 templates, prose events, region detail panel, BIOME_PROSE)
- 8.8: UI redesign (blessed tag fixes, menu bar active indicator, chronicle-first layout, clickable entity names)
- **Context View System (Foundation for 8.9-8.12):**
  - Polymorphic inspector with 6 entity types (Character, Faction, Site, Artifact, Event, Region)
  - Prose-first design with narrative paragraphs and structured data
  - Navigation system (history stack, breadcrumbs, back/forward)
  - Universal click-to-inspect (EventLog→Event, Map→Region, Inspector→Entity)
  - 6 prose lookup tables (HEALTH_PROSE, PERSONALITY_AXIS, SETTLEMENT_SIZE_PROSE, etc.)
  - UX architecture: `docs/plans/context-view-ux-architecture.md`
  - Layout spec: `docs/plans/context-view-layout-spec.md`, `context-view-mockups.md`
- **Chronicle View Transformation (8.9-8.11):**
  - Event aggregation system (batches events <60 significance by category + participant)
  - 4 chronicle modes: Prose (aggregated), Compact (timeline), Story Arcs (cascade tree), Domain Focus
  - Region-contextual filtering (toggle 'r' key, spatial distance-based)
  - Prose-first rendering with significance indicators (✦★◆•·)
  - Temporal headers (year/season/month separators)
  - Enhanced right pane with causal chains and multiple perspectives
  - 30 category-specific prose templates for aggregated summaries

**Remaining:**
- 8.12: Polish (tone affects layout, progressive tips, dynamic map overlays)

**Previous Phases (Complete):**
- Phase 1-2: ECS foundation, world generation pipeline
- Phase 3: 10 simulation systems (Character AI, Memory/Reputation, Faction/Political, Economic, Military, Magic, Religion, Cultural, Ecology, Secrets)
- Phase 4: Terminal UI with 8 panels
- Phase 5: Narrative engine with 5 tones, chronicler system, vignettes
- Phase 6: Simulation controls, influence system (17 actions, 3 categories, IP economy)
- Phase 7: World fingerprint, timeline branching, save/load, heraldry, dreaming, introspection

**Test Count:** 2902 passing

## Key Architectural Decisions

**ECS Design:**
- Map-backed component stores, monotonic entity IDs (no recycling)
- Branded types for compile-time safety
- World.query() starts with smallest store for efficiency

**Event System:**
- Priority queue uses significance-based binary heap
- Events are immutable; ConsequenceRule defines cascade potential
- Dampening formula: `baseProbability × (1-dampening)^depth`
- Max cascade depth: 10
- Cross-domain transitions map event categories to consequence types

**Time System:**
- 1 tick = 1 day
- Calendar: 12 months × 30 days = 360 days/year
- 6 frequency tiers: Daily/Weekly/Monthly/Seasonal/Annual/Decadal
- TimeController: 7 speed modes (Paused/SlowMotion/Normal/Fast7/30/365/UltraFast3650)

**Simulation Engine:**
- 13-step tick order (immutable pipeline)
- LoD zones: Full (50 tiles), Reduced (200), Abstract (beyond)
- Significance override threshold: 85
- **Influence actions process BETWEEN ticks** (after tick N completes, before N+1 starts) to preserve clean 13-step architecture

**Phase 3 Systems Bridge:**
- Systems use **internal Maps**, NOT ECS queries for state
- Generator data bridges to system state via `initializeSystemsFromGenerated()`
- MagicSystem needs `registerInstitution()` + `startResearch()`
- CulturalEvolutionSystem needs `startResearch()` with high progress
- WarfareSystem needs `declareWar()` + `createArmy()`

**Renderer (blessed):**
- BasePanel abstraction for layout management
- Render loop throttled to 30fps
- MockScreen/MockBox enable headless testing
- **BasePanel methods (resize/moveTo/focus/blur) must NOT call screen.render()** — caller batches renders

## Common Pitfalls
- `TerrainTile` has NO `freshwater` property — use `tile.riverId !== undefined`
- Running `npx tsc --noEmit` from root won't work — must use `pnpm run typecheck`
- Unused type imports trigger TS6133 with strict config — clean up before commit
- `import type` for enums used as values causes TS1361 — use regular `import`
- `exactOptionalPropertyTypes`: Cannot assign `undefined` to optional — use spread operator
- Cross-package imports need: 1) explicit paths in child tsconfig 2) built declarations 3) vitest resolve aliases
- blessed: `screen.width`/`screen.height` returns 1 on MINGW64, `keys: true` intercepts arrow keys
- Template subtypes mismatch: simulation uses prefixed (`culture.technology_invented`), templates use simple (`technology_invented`)
- Phase 3 systems use INTERNAL Maps, NOT ECS queries for state
- `WorldEvent.id` is `EventId` (branded), not `EntityId`
- Blessed tags MUST close on every line — multi-line spans corrupt character counting
- `buildEntityResolver()` needs World param for runtime entity fallback (armies, institutions)

## Known Issues
- EventCategory.Exploratory has no system producing events (by design — no exploration system implemented yet)
