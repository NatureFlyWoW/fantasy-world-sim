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
```

## Current Phase
Phase 1: Core Foundation

### Phase 1 Tasks
- [x] 1.1 — ECS Foundation (branded IDs, components, entity manager, world)
- [x] 1.2 — Event system (EventQueue, Event types, dispatch)
- [ ] 1.3 — Time system (TickClock, frequencies)
- [ ] 1.4 — Simulation loop orchestrator
- [ ] 1.5 — Spatial indexing (Quadtree)
- [ ] 1.6 — Level-of-Detail manager

## Decisions Log
- 2024: ECS uses Map-backed component stores, monotonic entity IDs (no recycling),
  branded types for compile-time safety. All component interfaces defined as
  placeholders — will be fleshed out per-system.
- 2024: World.query() starts with smallest store for efficiency
- 2024: Tests placed in src/ alongside implementation (*.test.ts pattern)
- 2024: Event queue is a significance-priority binary heap. Event log indexes by id,
  entity, and time for efficient queries. ConsequenceRule on each event defines
  cascade potential with dampening.

## Known Issues
(none currently)
