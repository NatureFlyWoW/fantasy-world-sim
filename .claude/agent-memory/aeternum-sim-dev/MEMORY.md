# Aeternum Sim Dev - Agent Memory

## Key Files
- Systems: `packages/core/src/systems/` — character-ai.ts, faction-system.ts, economics.ts, warfare.ts, magic.ts, religion.ts, culture.ts, ecology.ts, secret.ts, oral-tradition.ts
- Phase 13 systems: population-system.ts, settlement-lifecycle.ts, exploration-system.ts, migration.ts, promotion.ts
- Components: `packages/core/src/ecs/component.ts` (104 ComponentType discriminants)
- Branded IDs: `packages/core/src/ecs/types.ts`
- Events: `packages/core/src/events/types.ts` (WorldEvent, EventCategory), `event-bus.ts`, `cascade-engine.ts`
- Engine: `packages/core/src/engine/simulation-engine.ts`, `system.ts` (BaseSystem, ExecutionOrder)
- Bridge: `packages/generator/src/integration/populate-world.ts`
- CLI wiring: `packages/cli/src/index.ts`
- Electron wiring: `packages/electron/src/main/simulation-runner.ts`
- Full map: `docs/CODEBASE_MAP.md`

## Inspector System Architecture
- Polymorphic Context View: 6 sub-inspectors (Character, Location, Faction, Artifact, Event, Region)
- Each has `getSections()`, `render()`, `getEntitySpans()` methods
- Prose-first sections use atmospheric text before structured data
- Entity span tracking via `EntitySpanMap` for clickable names
- Shared utilities in `inspector-prose.ts` (renderBar, renderEntityName, renderDottedLeader, etc.)

## Section Structures
- **Character**: 7 sections (story-so-far, strengths-flaws, bonds-rivalries, worldly-standing, heart-mind, remembered-things, possessions-treasures)
- **Location**: 7 sections (living-portrait, people-peoples, power-governance, trade-industry, walls-works, notable-souls, the-annals)
- **Faction**: 8 sections (rise-reign, banner-creed, court-council, lands-holdings, swords-shields, alliances-enmities, coffers-commerce, chronicles)
- **Event**: 6 sections (what-happened, who-involved, where-when, why-matters, what-before, what-followed)
- **Region**: 5-6 sections (land, riches, dwellers, marks, echoes, +arcane if leyLine)
- **Artifact**: 8 sections (overview, creation, powers, consciousness, ownership, curses, significance, history)

## Integration Wiring
- EventLogPanel -> InspectorPanel: `setInspectEntityHandler` + `setInspectEventHandler`
- MapPanel -> InspectorPanel: `inspectRegion()` via CLI index.ts
- InspectorPanel -> InspectorPanel: `setInspectHandler` for entity name clicks
- Enter on EventLogPanel inspects **event**; 'i' inspects primary participant

## Key Patterns
- `exactOptionalPropertyTypes`: Use spread for conditional optional props
- `toLocaleString()` locale-dependent — use `toContain` not `toBe` in tests
- `getStore()` needs double cast: `as unknown as { getAll: () => Map<...> }`
- Tests need `getStore` in MockWorldOverrides when inspectors query stores

## MapOverlayBridge Architecture
- `overlay-bridge.ts`: 6 cached layers (Settlements, Territory, Military, Trade, Magic, EntityMarkers)
- Cache key: `"x,y"` string for O(1) tile lookup
- Hybrid update: event-driven dirty flags + tick-interval refresh per layer
- Territory: diamond flood-fill from capitals, Trade: Bresenham line between wealthy settlements
- 7 overlay presets, `renderAllAt()` for multi-layer compositing

## Test Counts
- 2955 total (Phase 8 complete)
- overlay-bridge.test.ts: 53, overlay.test.ts: 44, sub-inspectors.test.ts: 51
- character-inspector.test.ts: 33, event-inspector.test.ts: 19, region-inspector.test.ts: 24
