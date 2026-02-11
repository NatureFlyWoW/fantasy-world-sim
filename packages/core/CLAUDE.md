# @fws/core

ECS engine, simulation loop, events, time, spatial index, persistence, simulation systems.

## Directory Layout
- `src/ecs/` — World, Entity, Component system. `component.ts` has 104 ComponentType discriminants
- `src/engine/` — SimulationEngine, System interface, ExecutionOrder (13 steps), LoDManager
- `src/events/` — EventBus, CascadeEngine, WorldEvent, EventCategory (10 categories)
- `src/systems/` — 12+ simulation systems. Each has `{name}.ts` + `{name}-types.ts`
- `src/time/` — WorldClock, TickScheduler, TimeController, 6 frequency tiers
- `src/spatial/` — SpatialIndex (quadtree), distance calculations
- `src/persistence/` — NOT in barrel export (Node.js zlib dep). Import from path directly
- `src/utils/` — SeededRNG, SimplexNoise, geometry

## Conventions
- Systems use INTERNAL Maps for state, NOT ECS queries (Phase 3 pattern)
- Systems communicate only through EventBus + components, never direct references
- Branded IDs: EntityId, CharacterId, FactionId, SiteId, etc. in `ecs/types.ts`
- EventBus: `on(EventCategory, handler)` not `subscribe()`
- WorldClock: no-arg constructor, `advance()` not `tick()`
- `toEventId()` takes an EntityId, not a number
- All RNG through `SeededRNG.fork('label')`, never Math.random()
- `exactOptionalPropertyTypes`: use spread for conditional optional props

## After Editing
- `pnpm --filter @fws/core run build` if adding new exports (required before Electron)
- Tests: `pnpm --filter @fws/core run test`
