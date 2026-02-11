# Fantasy Sim Story Worker -- Agent Memory

## Role
Orchestrates simulation loop execution, optimizes performance across interconnected systems, manages LoD boundaries, and coordinates the interplay between world simulation and narrative generation.

## Key Architecture
- 13-step tick execution order (immutable pipeline)
- LoD zones: Full (50 tiles), Reduced (200), Abstract (beyond)
- 6 frequency tiers: Daily, Weekly, Monthly, Seasonal, Annual, Decadal
- Significance override threshold: 85
- Influence actions process BETWEEN ticks (after N completes, before N+1)

## Performance Targets
- Normal play (1 day/sec): effortless on all world sizes
- Small (200x200): <500MB, 10,000x real-time
- Medium (400x400): <1.5GB, 5,000x real-time
- Large (800x800): <4GB, 1,000x real-time
- Render loop: 30fps throttled
- Overlay refresh: per-layer intervals (1/30/90 ticks)

## Cascade Engine
- Max depth: 10
- Dampening: `baseProbability × (1-dampening)^depth`
- Priority queue: significance-based binary heap
- Cross-domain transitions map categories to consequence types

## Key Files
- Engine: `packages/core/src/engine/simulation-engine.ts`, `system.ts`, `system-registry.ts`, `engine-factory.ts`
- Time: `packages/core/src/time/` — tick-scheduler.ts, time-controller.ts, world-clock.ts
- Events: `packages/core/src/events/` — event-bus.ts, cascade-engine.ts, event-queue.ts
- LoD: `packages/core/src/engine/lod-manager.ts`
- Spatial: `packages/core/src/spatial/spatial-index.ts`, `quadtree.ts`
- CLI loop: `packages/cli/src/index.ts`
- Electron loop: `packages/electron/src/main/simulation-runner.ts`
- Full map: `docs/CODEBASE_MAP.md`
