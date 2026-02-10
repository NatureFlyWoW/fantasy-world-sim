# Phase 10: Code Improvement Plan

**Status:** In progress
**Phase:** 10 (following Phase 9 Graphics Overhaul completion)
**Decision:** Electron is the primary renderer; blessed is frozen as fallback
**Branch:** `feature/phase-10-code-improvement`
**Next:** Phase 11 — Code Review & Validation

---

## Context

Three expert reviews (TypeScript architecture, simulation architecture, game design) independently analyzed the codebase metrics and converged on a unified improvement plan. The full expert reports are available in `typescript_expert_review.md` and `codebase_analysis.md`.

Key metrics driving this plan:
- `entity-inspector.ts`: 2149 lines, CC 174/171/169/130/96 across 5 functions
- 135 lines of world generation duplicated between CLI and Electron bootstrappers
- InfluenceSystem: 5 switch blocks x 17 cases each for per-action logic
- 6 simulation system files at 1000-1600 lines with type blocks inlined
- SimplexNoise and Bresenham line drawing duplicated across packages

## Exclusions (explicitly decided against)

- **EventLogPanel decomposition** - blessed is frozen; Electron chronicle already clean (5 files, 1111 lines)
- **ECS archetypes/query caching** - premature optimization at current entity scale
- **Simulation system decomposition** - violates Phase 3 aggregate boundary pattern; internal Maps form consistency boundaries
- **New `@fws/shared-algorithms` package** - over-engineering; `core/utils/` is the right home
- **UI orchestrator abstraction** - leaky across fundamentally different rendering backends

---

## Priority 1: Split entity-inspector.ts into Sub-Inspectors

### Problem
Single 2149-line `@ts-nocheck` file consolidates all 6 inspector types. Five of the top 6 most complex functions in the entire codebase live here. Blocks What-If branching (needs per-World inspection), Export system (needs reusable prose tables), and per-entity enrichment.

### Target Structure
```
packages/electron/src/main/inspectors/
  shared.ts              (~200 lines)
  character-inspector.ts (~400 lines)
  faction-inspector.ts   (~400 lines)
  site-inspector.ts      (~350 lines)
  artifact-inspector.ts  (~250 lines)
  event-inspector.ts     (~200 lines)
  region-inspector.ts    (~250 lines)
  index.ts               (~50 lines)
```

### Design Decisions
- **Pure function signatures**: Each sub-inspector is `(world, clock, eventLog, entityId) => InspectorResponse`. Explicit params, no closures over shared state. Enables What-If by swapping the `world` param.
- **`shared.ts` contains**: Prose lookup tables (`HEALTH_PROSE`, `PERSONALITY_AXIS`, `SETTLEMENT_SIZE_PROSE`, `ECONOMIC_PROSE`), helper functions (`tickToYear`, `renderBar`, `entityMarker`). These become importable by the future Export system.
- **`index.ts` dispatcher**: Type-safe map keyed by entity type string with exhaustive checking. No default fallthrough.
- **Remove `@ts-nocheck`** from each new file. The CLI inspectors prove these functions type-check fine.
- **Each sub-inspector gets its own test file** mirroring the CLI test pattern.

### Approach
Mechanical extraction following the CLI's 6-file pattern (`packages/renderer/src/panels/` has `character-inspector.ts`, `faction-inspector.ts`, etc.). No behavioral changes. Line ranges from the monolith:
- `shared.ts`: lines 25-329 (helper functions + prose tables)
- `character-inspector.ts`: lines 365-753
- `faction-inspector.ts`: lines 754-1103
- `site-inspector.ts`: lines 1104-1435
- `artifact-inspector.ts`: lines 1436-1652
- `event-inspector.ts`: lines 1653-1861
- `region-inspector.ts`: lines 1862-2149

### Risk: Low
Pure file boundary refactoring. The CLI structure is the proven template.

---

## Priority 2: Extract World & Engine Factories

### Problem
Both `packages/cli/src/index.ts` (lines 185-319) and `packages/electron/src/main/simulation-runner.ts` (lines 122-260) duplicate ~135 lines: the 15-step world generation pipeline, 10-system registration with forked RNGs, and DreamingSystem + CharacterMemoryStore initialization.

### Target Structure
```typescript
// packages/generator/src/world-factory.ts
export function generateWorld(
  seed: number,
  config?: Partial<WorldConfig>
): GeneratedWorld
// Lifts CLI's generateWorld() (lines 185-272) to a shared export.

// packages/core/src/engine/engine-factory.ts
export function createSimulationEngine(
  world: World,
  clock: WorldClock,
  eventBus: EventBus,
  eventLog: EventLog,
  seed: number
): { engine: SimulationEngine; systems: RegisteredSystems }
// Lifts CLI's createSimulationEngine() (lines 277-319) to a shared export.
// Includes 30-tick warmup (pure simulation, no UI involvement).
```

### Design Decisions
- **Warmup ticks inside the factory**: The 30-tick warmup is simulation logic, not UI logic. Both bootstrappers do the same warmup.
- **UI wiring stays in bootstrappers**: Panel setup, keyboard bindings, IPC handlers, and overlay configuration remain per-frontend. Only simulation setup is shared.
- **CLI's existing shape is nearly the target**: `generateWorld()` and `createSimulationEngine()` already exist as separate functions in `cli/src/index.ts` — this is a lift-and-export.

### After Extraction
Each bootstrapper reduces to:
```typescript
const generated = generateWorld(seed);
const world = new World();
populateWorldFromGenerated(world, generated);
const { engine } = createSimulationEngine(world, clock, eventBus, eventLog, seed);
initializeSystemsFromGenerated(engine, generated);
// ... then UI-specific wiring only
```

### Risk: Low-Medium
Main risk: Electron `SimRunner.initialize()` has IPC lifecycle constraints (world snapshot must be taken after population). Verify the factory call sequence aligns with `world:snapshot` emission timing.

---

## Priority 3: Data-Driven InfluenceSystem

### Problem
`influence-system.ts` has 5 methods each containing a switch with up to 17 cases (`buildEventData`, `buildNarrative`, `getParticipants`, `getActionTarget`, `getActionLocation`). Adding a new influence action type requires modifying all 5 switches.

### Target
Extend the existing `influence-event-mapping.ts` config table (already 314 lines) to include per-action behavior:

```typescript
interface InfluenceActionConfig {
  // Already exists:
  category: EventCategory;
  subtypePrefix: string;
  significanceRange: [number, number];
  cooldownTicks: number;
  ipCost: number;

  // New — replaces switch blocks:
  extractParticipants: (action: InfluenceAction, world: World) => EntityId[];
  extractLocation: (action: InfluenceAction) => SiteId | null;
  buildEventData: (action: InfluenceAction, world: World) => Record<string, unknown>;
  buildNarrative: (action: InfluenceAction, world: World) => string;
  believabilityCheck?: (action: InfluenceAction, world: World) => BelievabilityResult;
}
```

### Design Decisions
- **Unified pipeline preserved**: The 5-step `execute()` pipeline (cooldown -> cost -> believability -> resistance -> effect) stays intact. This preserves the Three Laws of Influence and the cultivation metaphor.
- **Config entries replace switch cases**: Same code, different organization. Each action's logic moves from inline switch cases to a config entry's function properties.
- **Adding new actions = adding config entries**: Espionage ("Plant Agent", "Intercept Message"), Treaties ("Propose Term", "Sabotage Negotiations") become config additions, not system modifications.
- **Fully testable per-action**: Each config entry's functions can be unit tested in isolation.

### Risk: Low
The config table already exists. This extends it with function-valued properties. The switch-case logic moves into config entries — same code, better organization.

---

## Priority 4: Extract Type Blocks from Simulation Systems (Brief Spec)

Six simulation system files (warfare.ts, magic.ts, culture.ts, religion.ts, ecology.ts, economics.ts) range from 1000-1600 lines. In each, 40-60% of the file is type definitions, enums, interfaces, and stat tables that precede the class.

**Action**: Extract these blocks into `*-types.ts` companion files, following the pattern already established for `treaty-types.ts`, `diplomacy-types.ts`, `action-types.ts`, `goal-types.ts`, `reputation-types.ts`, `secret-types.ts`, `memory-types.ts`, and `influence-types.ts`.

**Result**: Main system files drop from 1000-1600 lines to 400-700 lines each. No behavioral change, no architectural change — purely organizational.

---

## Priority 5: Extract Shared Algorithms to @fws/core (Brief Spec)

**SimplexNoise**: Move to `packages/core/src/utils/simplex-noise.ts`. Accept `SeededRNG` (already in core). The renderer constructs a `SeededRNG` from its seed number instead of using its own splitmix32. Eliminates CC=74 duplication.

**Bresenham line drawing**: Extract to `packages/core/src/utils/geometry.ts` as `bresenhamLine(x0, y0, x1, y1): Array<{x, y}>`. The trade route rendering (ASCII vs PixiJS) necessarily differs between renderers, but the geometry computation becomes shared.

---

## Metrics Targets

| Metric | Current Worst | Target | Notes |
|--------|--------------|--------|-------|
| Max CC per function | 174 | 40 | Game/sim codebases tolerate higher CC than web apps |
| Max file length | 2149 lines | 800 lines (systems), 600 lines (panels) | After type extraction |
| Max class methods | 96 | 40 | Aligns with largest simulation systems |
| Code duplication | 2 known instances | 0 cross-package duplication | Algorithm sharing via core |

## Future Features Unblocked

| Feature (from GDD) | Blocked By | Unblocked After |
|---------------------|-----------|----------------|
| What-If branching comparison | Inspector closures over single world | Priority 1 (pure function inspectors) |
| Export system (chronicles, encyclopedias) | Prose tables embedded in rendering code | Priority 1 (shared.ts) |
| Espionage system | 5 switch blocks per new action type | Priority 3 (data-driven config) |
| Treaty system | Same as espionage | Priority 3 |
| Headless test harness | Duplicated bootstrappers | Priority 2 (factory functions) |
