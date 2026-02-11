# Codebase Map

> Read this file when you need to locate specific code. Not auto-loaded.
> All paths relative to `packages/{pkg}/src/` unless noted.

**Maintenance:** Update this file when you create, rename, move, or delete source files.
Add new entries under the correct package/directory section. Keep descriptions brief (one line).
When completing a phase, review all sections for accuracy.

## @fws/core (`packages/core/src/`)

### ecs/
- `component.ts` — 104 ComponentType discriminants (THE type registry)
- `component-store.ts` — Map-backed component storage
- `entity-manager.ts` — Monotonic ID generation, entity lifecycle
- `types.ts` — EntityId, CharacterId, FactionId, SiteId, ArtifactId, EventId, DeityId, BookId, RegionId, WarId (branded types)
- `world.ts` — World container (entities + stores + clock)
- `index.ts` — Barrel export

### engine/
- `simulation-engine.ts` — Main sim loop, tick orchestration
- `system.ts` — System interface, BaseSystem, ExecutionOrder (13-step enum)
- `system-registry.ts` — System registration and lookup
- `engine-factory.ts` — createSimulationEngine() helper
- `lod-manager.ts` — Level-of-Detail zone management
- `index.ts` — Barrel export

### events/
- `types.ts` — WorldEvent, EventCategory enum (10 categories), EventData
- `event-bus.ts` — EventBus (on/emit by EventCategory)
- `event-factory.ts` — createEvent() helper
- `event-log.ts` — EventLog storage
- `event-queue.ts` — Priority queue for event processing
- `cascade-engine.ts` — Event cascade with dampening
- `cross-domain-rules.ts` — Category-to-category transition rules
- `dampening.ts` — Dampening calculation
- `narrative-arc-detector.ts` — Rising action/climax/resolution detection
- `index.ts` — Barrel export

### systems/
Core simulation systems:
- `character-ai.ts` — Character decision-making (6-phase pipeline, largest system)
- `faction-system.ts` — Faction politics, diplomacy
- `economics.ts` — Trade, resources, wealth
- `warfare.ts` — Wars, armies, battles
- `magic.ts` — Magic institutions, research
- `religion.ts` — Religious practices, conversion
- `culture.ts` — Cultural evolution, technology
- `ecology.ts` — Environmental changes
- `secret.ts` — Secret knowledge system
- `oral-tradition.ts` — Memory/reputation system
- `dreaming.ts` — Dream event generation

Phase 13 systems:
- `population-system.ts` — Birth, aging, death, spark events (monthly)
- `population-utils.ts` — Shared population helpers
- `settlement-lifecycle.ts` — Tier progression, founding, abandonment
- `exploration-system.ts` — Discovery, frontier encounters, world secrets
- `migration.ts` — Population movement (push-pull model)
- `promotion.ts` — Non-notable to notable character promotion

Support systems:
- `influence-system.ts` — Player influence actions (data-driven)
- `influence-event-mapping.ts` — Influence-to-event routing
- `reputation-system.ts` — Character/faction reputation
- `secret-manager.ts` — Secret lifecycle management
- `grudge-system.ts` — Grudge tracking
- `propaganda.ts` — Faction propaganda
- `treaty-enforcement.ts` — Treaty management
- `perception-filter.ts` — LoD perception
- `memory-store.ts` — CharacterMemoryStore
- `discovery-actions.ts` — Discovery action templates
- `world-fingerprint.ts` — World state hashing
Type files:
- `personality-traits.ts` — 5 personality axes, trait logic
- `goal-types.ts` — LifeGoal, CharacterGoal, GoalPriority
- `action-types.ts` — ActionCategory, ActionTemplate, ACTION_TEMPLATES
- `warfare-types.ts` — War, Army, Battle types
- `economics-types.ts` — Trade, Market, Resource types
- `magic-types.ts` — MagicInstitution, Spell, Artifact types
- `religion-types.ts` — Religion, Doctrine types
- `culture-types.ts` — Language, Technology types
- `ecology-types.ts` — Biome, Resource types
- `diplomacy-types.ts` — Treaty, Alliance types
- `government-types.ts` — Government form types
- `influence-types.ts` — InfluenceActionId, InfluenceAction
- `memory-types.ts` — Memory entry types
- `reputation-types.ts` — Reputation metric types
- `secret-types.ts` — Secret, Rumor types
- `treaty-types.ts` — Treaty detail types
- `index.ts` — Barrel export (large, all systems + types)

### time/
- `world-clock.ts` — WorldClock (no-arg constructor, advance())
- `tick-scheduler.ts` — Frequency tier scheduling (6 tiers)
- `time-controller.ts` — TimeController (7 speed modes)
- `types.ts` — TickFrequency, TimeSpeed enums
- `index.ts` — Barrel export

### spatial/
- `spatial-index.ts` — SpatialIndex (quadtree-backed)
- `quadtree.ts` — Quadtree implementation
- `distance.ts` — Distance calculations
- `index.ts` — Barrel export

### persistence/ (NOT in barrel — import from path directly)
- `world-snapshot.ts` — WorldSnapshotManager, WorldSnapshot
- `branch-runner.ts` — BranchRunner, timeline branching
- `save-manager.ts` — SaveManager (Node.js zlib dependency)
- `export-manager.ts` — ExportManager, ExportFormat
- `index.ts` — Barrel export

### utils/
- `seeded-rng.ts` — SeededRNG (xoshiro128**), fork(), getSeed()
- `simplex-noise.ts` — SimplexNoise implementation
- `geometry.ts` — Geometry helpers
- `index.ts` — Barrel export

---

## @fws/generator (`packages/generator/src/`)

- `index.ts` — Package barrel export
- `world-factory.ts` — createGeneratedWorld() pipeline
- `rng.ts` — Generator RNG re-export from @fws/core

### terrain/
- `world-map.ts` — WorldMap class (the terrain grid)
- `terrain-tile.ts` — TerrainTile type (NO freshwater field!)
- `heightmap.ts` — Heightmap generation
- `hydrology.ts` — Rivers, lakes
- `biomes.ts` — Biome classification
- `climate.ts` — Temperature, moisture
- `tectonics.ts` — Plate tectonics
- `resources.ts` — Resource placement
- `flora.ts` — Plant generation
- `fauna.ts` — Animal generation
- `magical-creatures.ts` — Magical creature generation
- `ecological-baseline.ts` — Ecology initialization
- `dungeons.ts` — Dungeon generation
- `ascii-debug.ts` — Debug ASCII rendering
- `index.ts` — Barrel

### civilization/
- `character-generator.ts` — Notable character creation
- `faction-initializer.ts` — Faction setup
- `population.ts` — Initial population seeding
- `races.ts` — Race definitions and traits
- `settlement-placer.ts` — Settlement location selection
- `tension-seeder.ts` — Initial political tensions
- `index.ts` — Barrel

### cosmology/
- `pantheon.ts` — Deity/pantheon generation
- `magic-system.ts` — Magic system generation
- `planar.ts` — Planar cosmology
- `index.ts` — Barrel

### history/
- `pre-history.ts` — Pre-history event simulation
- `legendary-figures.ts` — Legendary character generation
- `artifact-forge.ts` — Artifact creation
- `index.ts` — Barrel

### character/
- `name-generator.ts` — NameGenerator facade (Markov chains)
- `markov.ts` — Markov chain implementation
- `name-culture.ts` — Culture-specific name rules
- `name-data.ts` — Name corpus data
- `index.ts` — Barrel

### config/
- `presets.ts` — World size presets (Small/Medium/Large/Epic)
- `types.ts` — GeneratorConfig type
- `resolver.ts` — Config resolution
- `index.ts` — Barrel

### integration/
- `populate-world.ts` — populateWorldFromGenerated() + initializeSystemsFromGenerated() (bridge file)

---

## @fws/narrative (`packages/narrative/src/`)

- `index.ts` — Package barrel export

### templates/ (11+ category files)
- `character-actions.ts` — Personal event templates
- `cultural.ts` — Cultural evolution templates
- `disaster.ts` — Natural disaster templates
- `ecological.ts` — Environmental templates
- `economic.ts` — Trade/market templates
- `exploration.ts` — Discovery/frontier templates
- `magical.ts` — Magic event templates
- `military.ts` — War/battle templates
- `personal.ts` — Character personal life templates
- `political.ts` — Political event templates
- `population.ts` — Birth/death/migration templates
- `religious.ts` — Religious event templates
- `secret.ts` — Secret knowledge templates
- `types.ts` — NarrativeTemplate, TemplateVariable, requiredContext
- `index.ts` — Template registry

### transforms/
- `narrative-engine.ts` — NarrativeEngine (template matching + rendering)
- `template-parser.ts` — Template string parsing ({variable}, {#if})

### chronicler/
- `chronicler.ts` — Unreliable narrator system
- `bias-filter.ts` — Faction/ideology bias
- `lost-history.ts` — Lost history tracker
- `index.ts` — Barrel

### vignettes/
- `vignette-generator.ts` — Rare scene generation (200-500 words)
- `vignette-trigger.ts` — Trigger heuristics (significance >85)
- `introspection.ts` — Character introspection vignettes
- `index.ts` — Barrel

### styles/
- `tones.ts` — 5 tone definitions (Epic, Personal, Mythological, Political, Scholarly)

---

## @fws/renderer (`packages/renderer/src/`)

Terminal ASCII UI (blessed-based). 8 panels, 5 layouts.

- `app.ts` — Application class, PANEL_INDEX, LAYOUT_ORDER
- `panel.ts` — BasePanel class
- `layout-manager.ts` — Layout preset management
- `theme.ts` — Color theme definitions
- `menu-bar.ts` — Menu bar component
- `types.ts` — Renderer types
- `spike-check.ts` — Blessed terminal UI non-interactive smoke test
- `spike-test.ts` — Blessed terminal UI spike test (Phase 4 evaluation)
- `index.ts` — Package barrel

### panels/
- `event-log-panel.ts` — Chronicle view (4 modes, aggregation)
- `inspector-panel.ts` — Polymorphic inspector host
- `character-inspector.ts` — Character detail inspector
- `faction-inspector.ts` — Faction detail inspector
- `location-inspector.ts` — Site detail inspector
- `artifact-inspector.ts` — Artifact detail inspector
- `event-inspector.ts` — Event detail inspector
- `region-inspector.ts` — Region detail inspector
- `inspector-prose.ts` — Shared prose utilities (renderBar, renderEntityName, etc.)
- `event-aggregator.ts` — Event grouping logic
- `event-filter.ts` — Event filtering
- `event-formatter.ts` — Event display formatting
- `stats.ts` — Statistics panel
- `timeline.ts` — Timeline panel
- `fingerprint-panel.ts` — World fingerprint panel
- `branch-view.ts` — Timeline branch view
- `relationships-panel.ts` — Relationship graph panel
- `region-detail-panel.ts` — Region detail panel
- `graph-layout.ts` — Graph layout algorithms
- `graph-renderer.ts` — Graph rendering
- `index.ts` — Barrel

### map/
- `map-panel.ts` — Map display panel
- `tile-renderer.ts` — ASCII tile rendering
- `viewport.ts` — Map viewport/scrolling
- `terrain-styler.ts` — Terrain visual styling
- `overlay.ts` — 6 overlay classes (Political, Resource, Military, Trade, Magic, Climate)
- `overlay-bridge.ts` — ECS-to-overlay cache bridge
- `minimap.ts` — Minimap widget
- `simplex-noise.ts` — Local noise utility
- `index.ts` — Barrel

### themes/
- `biome-chars.ts` — Biome ASCII chars + entity markers
- `biome-render-config.ts` — Biome rendering configuration

### widgets/
- `heraldry.ts` — ASCII heraldry renderer
- `index.ts` — Barrel

---

## @fws/cli (`packages/cli/src/`)

- `index.ts` — Main entry, system wiring, key bindings

### controls/
- `time-controls.ts` — Speed/pause controls
- `focus.ts` — Focus management
- `bookmarks.ts` — Bookmark system
- `notification.ts` — Notification manager
- `save-load-ui.ts` — Save/load interface
- `influence-ui.ts` — Influence action interface
- `index.ts` — Barrel

### menus/
- `refinement-menu.ts` — World refinement menu
- `refinement-applier.ts` — Apply refinements
- `refinement-validator.ts` — Validate refinements
- `refinement-types.ts` — Refinement types
- `index.ts` — Barrel

### integration/
- `perf-baseline.ts` — Performance benchmarking

---

## @fws/electron (`packages/electron/src/`)

### main/ (Node.js main process)
- `index.ts` — Electron main, window creation, IPC registration
- `simulation-runner.ts` — Sim loop management, snapshot creation
- `ipc-bridge.ts` — IPC channel handlers
- `entity-inspector.ts` — Inspector coordinator (dispatches to sub-inspectors)
- `legends-provider.ts` — Legends data provider

### main/inspectors/ (8 sub-inspectors)
- `character-inspector.ts` — Character inspection
- `faction-inspector.ts` — Faction inspection
- `site-inspector.ts` — Site/settlement inspection
- `artifact-inspector.ts` — Artifact inspection
- `event-inspector.ts` — Event inspection
- `region-inspector.ts` — Region inspection
- `commoner-inspector.ts` — Non-notable character inspection
- `shared.ts` — Shared inspector utilities (prose tables, formatters)
- `index.ts` — Inspector dispatcher

### preload/
- `preload.ts` — Context bridge (CJS output via esbuild)

### renderer/ (browser process)
- `index.ts` — Renderer entry, panel init
- `pixi-app.ts` — PixiJS Application wrapper
- `layout-manager.ts` — CSS Grid layout management
- `ui-events.ts` — UIEventBus (inspect-entity, center-map, panel-focus)
- `favorites-manager.ts` — Star/favorite system (localStorage)
- `ipc-client.ts` — IPC client wrapper
- `context-menu.ts` — Right-click context menu
- `help-overlay.ts` — F1 help overlay
- `notification-toast.ts` — Toast notifications
- `panel-divider.ts` — Panel resize dividers
- `welcome-screen.ts` — Welcome/loading screen

### renderer/chronicle/
- `event-store.ts` — Event storage
- `event-formatter.ts` — Event display formatting
- `event-aggregator.ts` — Event grouping
- `chronicle-renderer.ts` — Chronicle DOM rendering
- `chronicle-panel.ts` — Chronicle panel coordinator

### renderer/inspector/
- `inspector-panel.ts` — InspectorPanel (nav history, sections, entity markers)

### renderer/map/
- `tilemap-renderer.ts` — PixiJS tilemap rendering
- `tile-variants.ts` — Procedural tile variants
- `viewport.ts` — Pan/zoom viewport
- `overlay-manager.ts` — Map overlay management
- `tile-data-provider.ts` — Tile data for rendering
- `input-handler.ts` — Mouse/keyboard input
- `map-tooltip.ts` — Hover tooltips
- `glyph-atlas.ts` — Text glyph atlas
- `biome-config.ts` — Biome visual config

### renderer/legends/
- `legends-panel.ts` — Legends viewer panel
- `legends-renderer.ts` — Legends DOM rendering
- `legends-store.ts` — Legends data/state store

### renderer/procgen/
- `charge-atlas.ts` — Heraldry charge atlas
- `heraldry-renderer.ts` — Heraldry canvas rendering
- `icon-atlas.ts` — Icon sprite atlas

### shared/
- `ipc-channels.ts` — IPC channel name constants
- `types.ts` — Shared types (SerializedEvent, WorldSnapshot, InspectorResult, etc.)

### styles/ (14 CSS files)
- `variables.css` — 28-color palette + CSS custom properties
- `layout.css` — CSS Grid layout, view/layout classes
- `reset.css`, `typography.css`, `index.css`
- `chronicle.css`, `inspector.css`, `legends.css`
- `panel-frame.css`, `animations.css`
- `context-menu.css`, `help.css`, `toast.css`, `tooltip.css`

---

## Symbol Lookup

| Symbol | File |
|--------|------|
| ComponentType (104 variants) | core/src/ecs/component.ts |
| EntityId, CharacterId, FactionId, SiteId, ArtifactId, EventId, DeityId, BookId, RegionId, WarId | core/src/ecs/types.ts |
| EventCategory (10 categories) | core/src/events/types.ts |
| WorldEvent, EventData | core/src/events/types.ts |
| ExecutionOrder (13 steps) | core/src/engine/system.ts |
| TickFrequency (6 tiers) | core/src/time/types.ts |
| PersonalityTrait, ALL_TRAITS | core/src/systems/personality-traits.ts |
| LifeGoal, ALL_LIFE_GOALS | core/src/systems/goal-types.ts |
| ActionCategory, ACTION_TEMPLATES | core/src/systems/action-types.ts |
| NarrativeTemplate | narrative/src/templates/types.ts |
| SeededRNG | core/src/utils/seeded-rng.ts |
| InfluenceActionId, InfluenceAction | core/src/systems/influence-types.ts |
| WorldSnapshot, SerializedEvent | electron/src/shared/types.ts |
| BiomeType | renderer/src/themes/biome-chars.ts |

## Common Import Patterns

```typescript
// Branded IDs
import { type EntityId, type CharacterId, type FactionId, type SiteId } from '@fws/core';

// Events
import { EventCategory, type WorldEvent, createEvent } from '@fws/core';

// Components
import { ComponentType, type Component } from '@fws/core';

// Systems
import { CharacterAISystem, FactionPoliticalSystem } from '@fws/core';

// RNG
import { SeededRNG } from '@fws/core';

// World + ECS
import { World, WorldClock } from '@fws/core';

// Persistence (direct import, NOT through barrel)
import { WorldSnapshotManager } from '@fws/core/src/persistence/world-snapshot.js';
import { SaveManager } from '@fws/core/src/persistence/save-manager.js';

// Narrative
import { NarrativeEngine } from '@fws/narrative';
import { Chronicler } from '@fws/narrative';

// Generator
import { populateWorldFromGenerated, initializeSystemsFromGenerated } from '@fws/generator';
```
