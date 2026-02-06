# Fantasy World Simulator (Æternum)

## What This Is
A procedural fantasy world simulator inspired by Dwarf Fortress Legends Mode.
Generates living fantasy worlds and simulates their evolution across centuries.
Players observe and lightly influence ("cultivate") a generated world.
ASCII-aesthetic terminal interface with dual event streams: raw logs + narrative prose.

## Design Pillars
1. Emergent storytelling over scripted content — no hand-authored events
2. Depth over breadth — fewer entities with rich interconnection
3. Observation and cultivation — player nudges, never commands
4. Believability through complexity — every event has traceable causation
5. Layered interpretation — same events as data, logs, and literary prose

## Architecture
- **ECS**: All world objects are entities with composable components
- **Event-Driven**: Simulation produces events → systems react → narrative transforms
- **Tick-Based**: 1 tick = 1 day. Systems run at different frequencies:
  Daily (character AI, military), Weekly (trade, reputation), Monthly (economy, politics),
  Seasonal (agriculture, culture), Annual (tech, language), Decadal (geology, climate)
- **13-Step Tick Order**: Time → Environment → Economy → Politics → Social →
  Character AI → Magic → Religion → Military → Event Resolution →
  Narrative Generation → Cleanup/Indexing → Player Notification
- **Level-of-Detail**: Full (50 tiles), Reduced (200 tiles), Abstract (beyond)
- **Spatial Indexing**: Quadtree for map queries
- **Memory & Reputation**: Characters have persistent memories with decay/distortion,
  multi-dimensional reputation that propagates through social networks
- **Event Cascading**: Events trigger consequence chains across domains with dampening

## Packages
- `@fws/core` — ECS, simulation loop, time, events, LoD, spatial index, persistence
- `@fws/generator` — Terrain, ecology, cosmology, races, names, pre-history, init
- `@fws/renderer` — Terminal ASCII UI (blessed): map, event log, inspector,
  relationship graph, timeline, statistics
- `@fws/narrative` — Template engine, 5 tones, literary devices, chronicler system,
  micro-narrative vignettes, chronicle export
- `@fws/cli` — Entry point, simulation controls, influence system, refinement UI

## Conventions
- Strict TypeScript, no `any` types ever
- Pure functions for simulation logic, classes for entities/stores
- Events are immutable records
- Branded types for all IDs: EntityId, CharacterId, FactionId, SiteId,
  ArtifactId, EventId, DeityId, BookId, RegionId, WarId
- Test every system in isolation with Vitest
- Systems communicate ONLY through event queue and shared component state
- Never reference other systems directly

## Commands
```bash
pnpm run dev        # Start dev server
pnpm run build      # Production build
pnpm run test       # Run all tests
pnpm run test:watch # Watch mode
pnpm run typecheck  # TypeScript validation
pnpm run lint       # ESLint
pnpm run start                       # Generate world and launch terminal UI
pnpm run start -- --seed 42          # Deterministic generation with fixed seed
pnpm run start -- --headless         # Run without UI (for testing/CI)
pnpm run start -- --ticks 100        # Run specific tick count (headless mode)
```

## Current Phase
Phase 5: Narrative Engine (in progress)

### Phase 5 Tasks
- [x] 5.1 — Template Engine & Tones (NarrativeTemplate, TemplateParser, NarrativeEngine, 5 tones, 215 templates across 10 categories, literary devices)

### Phase 4 Tasks — COMPLETE
Renderer package complete with 7 panel types: Map, EventLog, Inspector, Relationships,
Timeline, Statistics, Fingerprint (placeholder). CLI entry point creates world → engine →
renderer pipeline. Application launchable with `pnpm run start`.
- [x] 4.1 — Terminal UI Framework (types, BasePanel, theme, layout manager, Application class)
- [x] 4.2 — World Map Renderer (viewport, tile-renderer, 6 overlays, minimap, MapPanel)
- [x] 4.3 — Dual Event Log (EventFormatter, EventLogPanel with filters, search, bookmarks, cascade)
- [x] 4.4 — Entity Inspector (InspectorPanel, CharacterInspector, LocationInspector, FactionInspector, ArtifactInspector)
- [x] 4.5 — Relationship Graph (graph-layout, graph-renderer, RelationshipsPanel with depth, filters)
- [x] 4.6 — Timeline, Statistics, and Full Integration (TimelinePanel, StatisticsPanel, CLI --headless mode)

### Phase 3 Tasks — COMPLETE
Simulation systems: Character AI, Memory/Reputation, Faction/Political (with Treaties),
Economic, Military, Magic, Religion, Cultural Evolution (with Oral Tradition),
Ecological Pressure, Secret Knowledge.
All systems communicate through events and cascade engine.
Secret Knowledge creates information asymmetry for Character AI.
Ecological Pressure creates environmental constraints on civilization.
- [x] 3.1 — Character AI System (6-phase pipeline: Perceive→Evaluate→Generate→Score→Execute→Reflect)
- [x] 3.2 — Memory & Reputation System (memory decay, reputation propagation, grudges, propaganda)
- [x] 3.3 — Faction & Political System (governments, diplomacy, treaties, enforcement, coups)
- [x] 3.4 — Economic System (resource production, trade networks, markets, economic events)
- [x] 3.5 — Military & Warfare (army composition, battles, sieges, campaigns, war consequences)
- [x] 3.6 — Magic System (research, institutions, artifact consciousness, catastrophes)
- [x] 3.7 — Religion System (divine power, interventions, church politics, syncretism)
- [x] 3.8 — Cultural Evolution (technology, artistic movements, philosophy, language, oral tradition)
- [x] 3.9 — Ecological Pressure (resource depletion, degradation, creature territories, invasive species)
- [x] 3.10 — Secret Knowledge (information asymmetry, revelation, perception filtering, discovery)

### Phase 2 Tasks — COMPLETE
World generation pipeline: geology → ecology → cosmology → races → pre-history → initialization → refinement.
Deterministic from seed. 9 configurable parameters with named presets.
- [x] 2.1 — Project scaffold + tooling
- [x] 2.2 — Terrain generation (heightmap, tectonics, hydrology, climate, biomes, resources, ley lines)
- [x] 2.3 — Ecology (biome classification, resource placement, flora, fauna)
- [x] 2.4 — Cosmological framework (pantheon, magic system, planar structure)
- [x] 2.5 — Racial genesis & name generation (races, population, Markov names, 7 cultures)
- [x] 2.6 — Pre-history simulation (year-by-year abstract sim, ruins, wars, legends, artifacts)
- [x] 2.7 — Current state initialization (settlements, factions, characters, tensions)
- [x] 2.8 — Post-generation refinement UI (menu, validator, applier)

### Phase 1 Tasks — COMPLETE
- [x] 1.1 — ECS Foundation (branded IDs, components, entity manager, world)
- [x] 1.2 — Event system (EventQueue, Event types, dispatch)
- [x] 1.3 — Time system (WorldClock, TimeController, TickScheduler)
- [x] 1.4 — Simulation loop orchestrator + LoD manager
- [x] 1.5 — Event cascade engine (cross-domain transitions, dampening, narrative arcs)
- [x] 1.6 — Spatial indexing (Quadtree, SpatialIndex facade, distance helpers)

## Decisions Log
- 2024: ECS uses Map-backed component stores, monotonic entity IDs (no recycling),
  branded types for compile-time safety. All component interfaces defined as
  placeholders — will be fleshed out per-system.
- 2024: World.query() starts with smallest store for efficiency
- 2024: Tests placed in src/ alongside implementation (*.test.ts pattern)
- 2024: Event queue is a significance-priority binary heap. Event log indexes by id,
  entity, and time for efficient queries. ConsequenceRule on each event defines
  cascade potential with dampening.
- 2024: Time module: 6 frequency tiers implemented. 1 tick = 1 day. Calendar: 12
  months × 30 days = 360 days/year. WorldTime interface for structured dates,
  TickNumber (raw number) for event timestamps. TickScheduler pre-registers 27
  default systems. TimeController supports Paused/Normal/Fast7/30/365/UltraFast3650/SlowMotion.
- 2024: Simulation engine: 13-step tick order implemented. LoD zones: Full (50),
  Reduced (200), Abstract (beyond). Significance override threshold: 85. All
  core infrastructure ready for Phase 2.
- 2024: Cascade engine built in Phase 1 to support all later systems. Cross-domain
  transitions map defined. Dampening formula: baseProbability × (1-dampening)^depth.
  Max cascade depth: 10. Narrative arc detection identifies rising-action patterns.
- 2024: Quadtree spatial index built. All core infrastructure ready for Phase 2.
  Phase 1 deliverables: ECS, Events, Time, SimLoop, Cascade Engine, Spatial Index.
- 2025: Phase 3 simulation systems complete. 10 interconnected systems:
  Character AI (6-phase decision loop), Memory/Reputation (decay, propagation, grudges),
  Faction/Political (treaties, enforcement), Economic (production, trade, markets),
  Military (battles, sieges, campaigns), Magic (research, artifacts, catastrophes),
  Religion (divine power, interventions), Cultural (tech, art, philosophy, language),
  Ecology (depletion, degradation, territories), Secrets (asymmetry, revelation, discovery).
  1392 tests total. Systems communicate via EventBus and shared component state.
- Pre-Phase 4: Added smoke test integration test (365-tick Small world validation)
  and pnpm run start entry point. Smoke test validates all 10 systems produce
  well-formed events, cascade chains respect depth limits, entity references are
  valid, and state is consistent. Start script generates world, runs 10-tick
  verification, and prints placeholder banner. Both use standard_fantasy preset.
- 2025: Generator-to-Simulation Bridge: Phase 3 systems use internal Maps (not ECS
  queries) for state. Added initializeSystemsFromGenerated() in populate-world.ts
  to bridge generator data to system internal state. MagicSystem needs registerInstitution()
  + startResearch(); CulturalEvolutionSystem needs startResearch() with high progress;
  EcologySystem needs registerRegion(); WarfareSystem needs declareWar() + createArmy().
  9/10 event categories now produce events in 365-tick smoke test (1392 tests passing).
- 2025: Renderer uses blessed for terminal UI. BasePanel abstraction allows
  panel-agnostic layout management. Render loop throttled to 30fps max.
  Status bar shows world date, speed, selected entity, and focus location.
  7 panel types: Map, EventLog, Inspector, Relationships, Timeline, Statistics, Fingerprint.
  MockScreen/MockBox classes enable headless testing. 1461 tests passing.
- 2025: Map uses viewport with 5 zoom levels (1:1 to 16:1). 6 overlay types toggle
  independently (Political, Resources, Military, Trade, Magic, Climate). Minimap
  shows full world with viewport rectangle. Dirty-flag system prevents unnecessary
  re-renders. Entity markers overlay terrain using Unicode symbols (☼ city, † ruin,
  ⚔ army, ✝ temple, ✧ academy, ⚑ capital). 1590 tests passing.
- 2025: Event log splits raw data (left 55%) and narrative prose (right 45%).
  Narrative panel shows placeholder until Phase 5 narrative engine is built.
  Filter supports category, significance threshold, entity, and location.
  Cascade chain visualized as indented tree. Live EventBus subscription with
  flash highlights (>80) and terminal bell (>95). 1669 tests passing.
- 2025: 4 inspector types: Character (8 sections), Location (8 sections),
  Faction (8 sections), Artifact (8 sections). Entity type auto-detected from
  components (Attribute→character, Position+Population→location, Territory→faction,
  CreationHistory/OwnershipChain→artifact). Inspect history enables back/forward
  navigation. Sections collapsible with number keys. 1770 tests passing.
- 2025: Relationship Graph uses concentric ring layout (BFS from center entity).
  graph-layout.ts provides node positioning with overlap resolution.
  graph-renderer.ts draws ASCII graph with colored edges (11 relationship types:
  ally, friend, family, rival, enemy, neutral, member, leader, vassal, trade,
  unknown). Line styles show strength (═ strong, ─ moderate, · weak).
  RelationshipsPanel supports depth 1-3 hops, 6 filters (all, positive, negative,
  family, political, economic), cursor navigation, legend toggle. 1872 tests passing.
- 2025: Timeline panel displays horizontal ASCII timeline with significance markers
  (· < ○ < ● < ★). 3 zoom levels: year (30 ticks/char), decade (360), century (3600).
  Parallel faction tracks, era markers, category filtering. Statistics panel shows
  5 views (Overview, Population, Territory, Technology, Conflict) with ASCII bar
  charts and sparklines. CLI supports --headless and --ticks flags for CI/testing.
  Phase 4 complete: world → simulation → renderer pipeline fully wired. 1941 tests.
- 2025: Narrative engine uses template-based prose generation with 5 tones
  (EpicHistorical, PersonalCharacterFocus, Mythological, PoliticalIntrigue, Scholarly).
  Templates organized by event category (10 files, 215 templates). TemplateParser
  handles entity references ({character.name}), pronouns ({pronoun.subject}),
  conditionals ({#if}/{#else}/{/if}). Literary devices applied post-template:
  epithet insertion, foreshadowing (rising arcs), retrospective (cascade chains),
  dramatic irony (secrets). Fallback chain: specific template → category default →
  global fallback. Tone substitutions transform vocabulary (kingdom→realm). 2029 tests.

## Known Issues
- EventCategory.Exploratory has no system producing events (by design — no exploration
  system implemented yet). All other 9 categories produce events after bridge initialization.