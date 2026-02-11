# @fws/electron

Electron + PixiJS graphical frontend (primary renderer).

## Directory Layout
- `src/main/` — Node.js main process: index.ts, simulation-runner.ts, ipc-bridge.ts
- `src/main/inspectors/` — 8 sub-inspectors (character, faction, site, artifact, event, region, commoner) + shared.ts
- `src/main/entity-inspector.ts` — Inspector coordinator (dispatches to sub-inspectors)
- `src/main/legends-provider.ts` — Legends data aggregation
- `src/preload/` — Context bridge (MUST be CJS — esbuild bundles to .cjs)
- `src/renderer/` — Browser process entry, PixiJS app, layout, UI events
- `src/renderer/chronicle/` — EventStore, EventFormatter, EventAggregator, ChronicleRenderer, ChroniclePanel
- `src/renderer/inspector/` — InspectorPanel (nav history, sections, entity markers)
- `src/renderer/map/` — TilemapRenderer, Viewport, OverlayManager, InputHandler, Tooltip
- `src/renderer/legends/` — LegendsPanel, LegendsRenderer, LegendsStore
- `src/renderer/procgen/` — charge-atlas, heraldry-renderer, icon-atlas
- `src/shared/` — IPC channel names, shared types (SerializedEvent, WorldSnapshot)
- `src/styles/` — 14 CSS files. `variables.css` (palette), `layout.css` (CSS Grid)

## Conventions
- Main process files use `@ts-nocheck` for cross-package imports
- Branded types cast to `number` for IPC serialization
- PixiJS v8: `import 'pixi.js/unsafe-eval'` BEFORE Application init
- PixiJS v8: object form for Graphics — `.fill({ color: num })`, `.stroke({ width, color })`
- Entity markers: `[[e:TYPE:ID:NAME]]` in content strings -> clickable spans in renderer
- CSS layout selectors MUST use `#app.layout--X` / `#app.view--X` for specificity
- SerializedEvent uses `.tick` not `.timestamp` (unlike WorldEvent)
- Build order: tsc (main) -> esbuild (preload) -> vite build (renderer)

## After Editing
- Must `pnpm run build` in @fws/core and @fws/generator FIRST if they have new exports
- `pnpm run start:electron` to launch
