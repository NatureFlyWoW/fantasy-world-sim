# Comp-Sim-Lead Agent Memory

## Map/Overlay System Architecture
- Overlay classes in `packages/renderer/src/map/overlay.ts` (Political, Resource, Military, Trade, Magic, Climate)
- All 6 overlays connected via MapOverlayBridge (overlay-bridge.ts) — ECS data flows to render
- Entity markers in `biome-chars.ts`, wired through `MapPanel.setEntityLookup()`
- OverlayManager uses preset-based model (7 presets: None, Political, Military, Economic, Arcane, Climate, Full)
- MapPanel render pipeline: terrain -> entity marker -> overlay -> cache
- RenderContext has `world`, `spatialIndex`, `eventBus` for live queries

## Key File Locations
- Map panel: `packages/renderer/src/map/map-panel.ts`
- Overlay system: `packages/renderer/src/map/overlay.ts`
- Overlay bridge: `packages/renderer/src/map/overlay-bridge.ts`
- Tile renderer: `packages/renderer/src/map/tile-renderer.ts`
- Viewport: `packages/renderer/src/map/viewport.ts`
- Terrain styler: `packages/renderer/src/map/terrain-styler.ts`
- Biome chars/entity markers: `packages/renderer/src/themes/biome-chars.ts`
- Spatial index: `packages/core/src/spatial/spatial-index.ts`
- CLI wiring: `packages/cli/src/index.ts`

## Key Bindings (Map Panel)
- WASD/arrows: pan, Z/X: zoom, O: cycle overlay, M: minimap, Enter: inspect
- Global keys taken: q, tab, space, escape, f1, m, l, 1-8, +/=, -/_, f, b

## Patterns
- Lookup function injection: `panel.setFooLookup((x,y) => data)`
- Cache invalidation via `invalidateCache()` clears render cache Map
- All panel methods (resize/moveTo/focus/blur) must NOT call screen.render()
- CLI uses `@ts-nocheck` due to cross-package import complexity

## Simulation Systems (core/src/systems/)
- CharacterAI, FactionPolitical, Economic, Warfare, Magic, Religion, Cultural, Ecology, OralTradition
- Systems use internal Maps, NOT ECS queries for state
- Bridge via `initializeSystemsFromGenerated()`
