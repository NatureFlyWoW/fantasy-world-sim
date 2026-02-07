# Comp-Sim-Lead Agent Memory

## Map/Overlay System Architecture
- Overlay classes exist in `packages/renderer/src/map/overlay.ts` (Political, Resource, Military, Trade, Magic, Climate)
- All 6 overlay lookup functions are UNCONNECTED in CLI -- none wired to ECS data
- Entity markers defined in `biome-chars.ts` but `MapPanel.setEntityLookup()` never called
- OverlayManager uses single-active model (cycled with 'o' key)
- MapPanel render pipeline: terrain -> entity marker -> overlay -> cache
- RenderContext has `world`, `spatialIndex`, `eventBus` for live queries
- Architecture doc: `docs/plans/map-overlay-architecture.md`

## Key File Locations
- Map panel: `packages/renderer/src/map/map-panel.ts`
- Overlay system: `packages/renderer/src/map/overlay.ts`
- Tile renderer: `packages/renderer/src/map/tile-renderer.ts`
- Viewport: `packages/renderer/src/map/viewport.ts`
- Terrain styler: `packages/renderer/src/map/terrain-styler.ts`
- Biome chars/entity markers: `packages/renderer/src/themes/biome-chars.ts`
- Spatial index: `packages/core/src/spatial/spatial-index.ts`
- CLI wiring: `packages/cli/src/index.ts`
- Region detail panel: `packages/renderer/src/panels/region-detail-panel.ts`
- Render types: `packages/renderer/src/types.ts`

## Key Bindings (Map Panel)
- WASD/arrows: pan, Z/X: zoom, O: cycle overlay, M: minimap, Enter: inspect
- Global keys taken: q, tab, space, escape, f1, m, l, 1-8, +/=, -/_, f, b

## Patterns Observed
- Lookup function injection pattern: `panel.setFooLookup((x,y) => data)`
- Cache invalidation via `invalidateCache()` clears render cache Map
- Viewport culling is implicit (only visible tiles rendered in the loop)
- RegionDetailPanel already does inline ECS queries for overlay data in CLI
- All panel methods (resize/moveTo/focus/blur) must NOT call screen.render()
- CLI uses `@ts-nocheck` due to cross-package import complexity

## Simulation Systems (core/src/systems/)
- CharacterAI, FactionPolitical, Economic, Warfare, Magic, Religion, Cultural, Ecology, OralTradition
- Systems use internal Maps, NOT ECS queries for state
- Bridge via `initializeSystemsFromGenerated()`
