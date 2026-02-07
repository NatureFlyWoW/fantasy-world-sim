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
  relationship graph, timeline, statistics, region detail
- `@fws/narrative` — Template engine, 5 tones, literary devices, chronicler system,
  micro-narrative vignettes, chronicle export
- `@fws/cli` — Entry point, simulation controls, influence system, refinement UI

## Conventions
- Strict TypeScript, no `any` types ever
- Pure functions for simulation logic, classes for entities/stores
- Events are immutable records
- Branded types for all IDs: EntityId, CharacterId, FactionId, SiteId,
  ArtifactId, EventId, DeityId, BookId, RegionId, WarId, InfluenceActionId
- Influence system produces events mapped to existing categories
  (Religious, Personal, Cultural, Economic, Ecological) — never a
  separate 'Influence' category. Player actions must feel like natural
  world events.
- Test every system in isolation with Vitest
- Systems communicate ONLY through event queue and shared component state
- Never reference other systems directly
- Always use Context7 when in need of library/API documentation, code generation, setup or configuration steps

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

## Subagent Routing Preferences
When delegating complex tasks to subagents, prefer these domain specialists:
- Game logic, game simulation, gameplay loop, ECS design, game graphics, game UI → voltagent-domains:game-developer

- Backend architecture, APIs → voltagent-domains:backend-developer or voltagent-domains:fullstack-developer

- Adding TypeScript to projects, implementing complex type definitions, migrating JavaScript to TypeScript, building type-safe  applications. voltagent-lang:typescript-pro

- Summing up, collecting and merging together knowledge and data sources, combining many into few -> voltagent-meta:knowledge-synthesizer

Organizing, planing, making priorities and refinement tasks -> voltagent-meta:agent-organizer

Use best judgment for tasks that span multiple domains or are too 
small to warrant delegation.


## Current Phase
Phase 8: UX Overhaul (In Progress — Tier 1-4 complete, Tier 5 remaining)

### Phase 8 Tasks — IN PROGRESS
UX overhaul: "Names Not Numbers" entity resolution in event log, world dashboard
replacing empty inspector, click handling for menu bar and event log, context-sensitive
status bar hints, auto-pause on legendary events (sig 95+), pre-simulation welcome screen,
narrative-first UI with character AI templates, prose event descriptions, significance
word labels, narrative dashboard, region detail panel with biome prose.
Tier 4 UI redesign: rendering bug fixes (blessed tag balancing, ASCII title encoding),
menu bar active panel indicator, entity resolution World-based fallback, welcome screen
30-tick warmup, dashboard narrative synthesis, right-pane narrative context (participants/
location/consequences), region settlement overlay, chronicle-first layout, clickable
entity names in prose.
Tier 5 remaining: Chronicle narrative-primary view, event aggregation, story threads,
tone-affects-layout.
- [x] 8.1 — Names Not Numbers (EventFormatter wired to EntityResolver, SUBTYPE_VERB_MAP with ~50 verb patterns, resolves entity IDs to character/faction/site/artifact names, ENTITY_NAME_COLOR for clickable names; 17 new tests)
- [x] 8.2 — World Dashboard (Inspector empty state replaced with live dashboard: World Pulse domain balance bars via WorldFingerprintCalculator, Top Factions from Territory components, Active Tensions from sig 60+ Political/Military events, Recent Notable Events; dashboard scrolling; 12 new tests)
- [x] 8.3 — Click Handling (MenuBar.handleClick(x) coordinate-to-item mapping, EventLogPanel.handleClick(x,y) click-to-select events, Application menu bar click routing at y=0; 6 new tests)
- [x] 8.4 — Context-Sensitive Status Bar (getContextHints(panelId) returns panel-specific shortcut hints replacing static entity/focus info; 9 new tests)
- [x] 8.5 — Auto-Pause on Legendary Events (SimulationTimeControls legendaryPauseThreshold=95, immediate pause with 'auto-pause-legendary' reason, getLastLegendaryEvent() accessor; 9 new tests)
- [x] 8.6 — Story So Far Welcome Screen (WelcomeData interface, renderWelcomeScreen with seed/factions/settlements/tensions, shown before simulation starts; CLI builds welcomeData from generatedData; 3 new tests)
- [x] 8.7 — Narrative-First UI Overhaul (66 Character AI templates for 22 subtypes x 3 significance tiers in character-actions.ts, 281 total templates; SHORT_NARRATIVE_MAP ~70 subtype-to-prose entries + getShortNarrative() + getSignificanceLabel() in EventFormatter; significance displayed as colored word labels not numbers; DOMAIN_PROSE 6 domains x 5 thresholds for narrative dashboard; event aggregation in dashboard; RegionDetailPanel with 17 biome prose descriptions, 8-tier elevation/temperature/7-tier rainfall descriptors, 13 resource descriptions; 'narrative' 4-quadrant layout preset as default; panel key 8 + menu bar Region item; MapPanel selection handler wires cursor to region detail)
- [x] 8.8 — UI Redesign (rendering bug fixes: blessed tag balancing in region/inspector panels, ASCII-safe title encoding; menu bar active panel indicator with inverse styling; entity resolution World-based fallback for runtime entities; welcome screen 30-tick warmup with narrative prose; dashboard narrative synthesis paragraph + resolved names in tensions/tidings; right-pane narrative context with participants/location/consequences; region panel settlement/faction overlay via RegionOverlayData; chronicle-first layout: EventLog 60% full-height left, Map+Inspector/Region right; clickable entity names in prose via rightPaneEntitySpans tracking)
- [ ] 8.9 — Chronicle Narrative-Primary View (temporal grouping with period headers, significance-tiered display, chronicler identity header)
- [ ] 8.10 — Event Aggregation (time-window batching of sub-threshold events, expand-on-demand, two-threshold system)
- [ ] 8.11 — Story Threads (inline cascade connectors, arc progress headers, thread color-coding)
- [ ] 8.12 — Polish (tone affects layout, progressive tips)

### Phase 7 Tasks — COMPLETE
Extended systems: World DNA Fingerprint (6-domain radial chart), Timeline Branching
(what-if scenarios, max 3 branches), Save/Load with auto-save and export,
Procedural Heraldry (ASCII shields with cultural variation and evolution),
Dreaming Layer (5 dream types, prophetic dream integration), Character Introspection
(first-person monologue from personality/memories).
- [x] 7.1 — World DNA Fingerprint (WorldFingerprintCalculator with 6 domains, civ palette, sparklines, complexity score; FingerprintPanel with hex chart, colored faction bar, sparklines, progress bar; 49 tests)
- [x] 7.2 — "What If" Timeline Branching (WorldSnapshotManager with deep-clone snapshot/restore, BranchRunner with 5 divergence actions and MAX_BRANCHES=3, BranchComparisonPanel with 3 views and divergence counter; 50 tests)
- [x] 7.3 — Save/Load & Export (SaveManager with full/incremental saves, gzip compression, auto-save rotation; ExportManager with 5 export types in 3 formats; SaveLoadController with Ctrl+S/F5/F6 keybindings; 58 tests)
- [x] 7.4 — Procedural Heraldry (ASCII shield templates per culture: knightly/round/totem; 5 field divisions; 28 charges in 4 categories; tincture derivation from faction values/biome; heraldry evolution on political events; 3 display sizes; FactionInspector integration; 60 tests)
- [x] 7.5 — Extended Character Systems (DreamingSystem with 5 dream types driven by emotional memory load, PlantedDream queue for PropheticDream influence integration; generateIntrospection with 8 voice types producing 100-300 word first-person monologue from personality/goals/memories/secrets; 82 tests)

### Phase 6 Tasks — COMPLETE
Player interaction: simulation controls (auto-slowdown on significant events),
focus system (LoD follows focused entity), bookmark/notification system,
and influence system (17 influence actions across 3 categories, with
believability and resistance checks). IP regenerates at 1/year with
narrative momentum penalty for old worlds.
- [x] 6.1 — Simulation Controls (time controls, focus, bookmarks, notifications)
- [x] 6.2 — Influence System (17 actions in Divine/Environmental/Cultural categories, believability checks, resistance from personality traits, IP economy with distance cost modifier)

### Phase 5 Tasks — COMPLETE
Narrative engine complete. Chronicler system applies faction and ideological bias.
Lost History mechanic tracks preservation. Vignette system triggers 200-500 word
prose for high-significance events with 15 archetypes.
- [x] 5.1 — Template Engine & Tones (NarrativeTemplate, TemplateParser, NarrativeEngine, 5 tones, 215 templates across 10 categories, literary devices)
- [x] 5.2 — Chronicler System & Vignettes (Chronicler with 8 ideologies, ChroniclerBiasFilter with 8 bias types, LostHistoryTracker with preservation/loss simulation, VignetteTrigger with 12 emotions and 15 archetypes, VignetteGenerator producing 200-500 word prose)

### Phase 4 Tasks — COMPLETE
Renderer package complete with 8 panel types: Map, EventLog, Inspector, Relationships,
Timeline, Statistics, Fingerprint, RegionDetail. CLI entry point creates world → engine →
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
- 2025: Pre-Phase 6 runtime bugfixes for terminal UI launch:
  | Fix | Status | Description | Solution |
  |-----|--------|-------------|----------|
  | 2.1a | ✅ | CJS/ESM require fix | `createRequire` added for blessed import |
  | 2.1b | ✅ | Keybinding registration | Keys 1-6, Tab, arrows bound in app.ts |
  | 2.1c | ✅ | blessed `tags: true` | Color tags now parsed in BasePanel |
  | 2.1d | ✅ | Map terrain colors | tileLookup wired, biomes visible |
  | 2.1e | ✅ | Startup sequencing | Simulation waits for Space press |
  | 2.1f | ✅ | EntityResolver | Narrative resolves {character.name} |
  | 2.1g | ✅ | Layout proportions | Fixed: single LayoutManager + menu bar offset |
  Startup sequence: generateWorld → createPanels → app.start → renderInitialFrame
  → display "Speed: Paused | Press Space to begin" → wait for input → startSimLoop.
  2142 tests passing.
- 2025: Phase 6 influence system uses EXISTING EventCategory values instead of adding
  new EventCategory.Influence. This follows Design Pillar 3 (cultivation, not commands)
  and ensures influence events cascade naturally through existing systems.
  Mapping: InspireIdea/ArrangeMeeting/PersonalityNudge/RevealSecret/LuckModifier → Personal;
  PropheticDream/VisionOfFuture/EmpowerChampion → Religious;
  AdjustWeather/MinorGeology/AnimalMigration/TriggerNaturalEvent → Disaster;
  ResourceDiscovery → Economic; PromoteArt/StrengthenTradition/IntroduceForeignConcept → Cultural;
  EncourageResearch → Scientific. 17 action types total with costs, cooldowns, significance ranges.
- 2025: Pre-Phase 6 TimeController audit. TimeController in core provides: 7 speed modes
  (Paused/SlowMotion/Normal/Fast7/30/365/UltraFast3650), pause()/play()/fastForward()/slowMotion(),
  step units (day/week/month/year via getTicksForStep()), auto slow-down on significance.
  BUT: app.ts does NOT use TimeController — manages speed in its own state, duplicating logic.
  Phase 6.1 needs: (1) Wire app.ts to use TimeController instead of duplicating state,
  (2) Add single-step mode (step by day/week/month while paused), (3) Auto slow-down on
  significance >85 events, (4) Speed change events for UI notifications. 2143 tests passing.
- 2025: Pre-Phase 6 LoD Manager audit. LevelOfDetailManager provides: setFocus(x,y) for
  focus position, getDetailLevel(x,y) returning 'full'|'reduced'|'abstract', zone radii
  (Full=50, Reduced=200, Abstract=beyond), promoteToFullDetail(x,y,duration) for temporary
  overrides on significant events, shouldSimulateEntity(pos,sig?) for simulation filtering.
  MISSING: (1) Zone change events/callbacks when focus moves, (2) app.ts.setFocusLocation()
  not wired to LevelOfDetailManager.setFocus(). Phase 6.1 needs to connect renderer focus
  to LoD manager for influence system distance cost calculations.
- 2025: Influence system tick positioning design. SimulationEngine.tick() follows 13-step
  order: TIME ADVANCE → systems 2-9 → EVENT RESOLUTION → tick listeners. Influence actions
  should be processed BETWEEN ticks (after tick N completes, before tick N+1 starts) to
  avoid modifying the existing pipeline. Implementation: add processInfluenceQueue() call
  at start of tick() before clearing pendingEvents. Influence events then cascade naturally
  through the next tick's systems. This preserves the clean 13-step architecture.
- 2026: Pre-Phase 6 review complete. Narrative engine wired into renderer
  pipeline. Influence events map to existing EventCategories (no new category)
  for natural feel. Influence actions processed between ticks (queued,
  applied before next tick starts). Focus system uses existing LoD manager
  setCenter/updateCenter API.
- 2026: Pre-Phase 6 performance baseline (Small world, 365 ticks, seed 42):
  Generation: 110ms, Simulation: 114ms, Per-tick: 0.31ms, Memory: 40MB heap / 134MB RSS, Events: 8343.
  9/10 event categories active. Economic (3997) and Personal (2132) dominate.
- 2026: Phase 6.1 Simulation Controls complete. packages/cli/src/controls/ with 4 modules:
  SimulationTimeControls (wraps TimeController, auto-slowdown on 3+ sig-90+ events in 30 ticks),
  FocusManager (entity focus with LoD integration, tracks events for focused entity),
  BookmarkManager (entity/event bookmarks with alerts), NotificationManager (configurable
  alerts by significance/category/bookmarked/focused). RenderContext extended with optional
  lodManager. CLI creates controls and wires to Application via callbacks. Keybindings:
  F (toggle focus on selected entity), B (toggle bookmark). 94 new tests, 2244 total.
- 2026: Phase 6.2 Influence System complete. InfluenceSystem in packages/core/src/systems/
  with 17 action types in 3 categories (Divine: 8, Environmental: 5, Cultural: 4).
  IP starts at 50, max 100, regenerates 1/year. Believability checks: PersonalityNudge
  limited to ±15 points, ArrangeMeeting requires characters within 50 tiles. Resistance
  checks based on Paranoid/Cautious/Patient traits with formula 0.7 - (resistance/200).
  Partial refund (50%) on resistance. Narrative momentum: worlds >5000 years slow regen.
  Distance modifier: +1% cost per tile from focus. InfluenceMenu in packages/cli/src/controls/
  with 7-state flow (category→action→target→params→confirm→result). Events map to existing
  categories (Personal, Religious, Disaster, Economic, Cultural, Scientific). 69 new tests,
  2313 total. Phase 6 complete.
- 2026: Phase 7.1 World DNA Fingerprint. WorldFingerprintCalculator in
  packages/core/src/systems/world-fingerprint.ts computes composite world identity:
  6 domain balance (Warfare/Magic/Religion/Commerce/Scholarship/Diplomacy from event
  category distribution), civilization palette (faction proportions from event
  participation), per-century sparklines (volatility, magic, population), complexity
  score (cascade chains depth>3 + cross-domain arcs, normalized 0-100). FingerprintPanel
  in packages/renderer/src/panels/fingerprint-panel.ts renders ASCII hex radar chart,
  colored faction bar, sparkline characters (▁▂▃▅▆█), progress bar. Panel cached by
  event count, key 7 activates, R refreshes. Core exports ALL_DOMAINS as
  FINGERPRINT_DOMAINS to avoid collision with religion system's ALL_DOMAINS.
  49 new tests (22 calculator + 27 panel), 2362 total.
- 2026: Phase 7.2 "What If" Timeline Branching. WorldSnapshotManager in
  packages/core/src/persistence/world-snapshot.ts deep-clones World/Clock/EventLog
  using custom deepCloneValue (structuredClone can't handle Component.serialize()
  functions). Snapshot captures aliveEntities, maxEntityId, componentData (Map of
  Maps), events. Restore recreates entities 0..maxId then destroys dead ones.
  BranchRunner in packages/core/src/persistence/branch-runner.ts manages up to
  MAX_BRANCHES=3 alternate timelines. 5 DivergenceAction types: ReverseOutcome
  (appends reversal event with new ID via createEvent), RemoveCharacter (destroys
  entity), ChangeDecision (patches component), AddEvent (injects event), DifferentSeed.
  EngineFactory callback lets caller wire SimulationEngine for branch execution.
  BranchComparisonPanel in packages/renderer/src/panels/branch-view.ts uses local
  BranchRef interface (avoids cross-package declaration rebuild). compareBranches()
  pure function diffs entities, events, territory ownership. 3 views: entities (e),
  events (v), territory (t). World.getRegisteredComponentTypes() added to support
  snapshot enumeration. 50 new tests (18 snapshot + 16 runner + 16 panel), 2412 total.
- 2026: Phase 7.3 Save/Load & Export. SaveManager in packages/core/src/persistence/
  save-manager.ts provides full saves (complete world state) and incremental saves
  (dirty entity deltas + event log deltas). Custom serializeValue/deserializeValue
  handles Maps/Sets via __t:'M'/__t:'S' tagged JSON. gzip compression (Node.js zlib)
  achieves >50% size reduction. Auto-save every 10 years, keeps last 5 rotated.
  ExportManager provides 5 export types (encyclopedia, chronicle, timeline, genealogy,
  faction history) in 3 formats (txt, md, json). Genealogy renders ASCII family tree
  with ┌──┴──┐ branching. SaveLoadController in packages/cli/src/controls/save-load-ui.ts
  with NodeSaveStorage for fs I/O. Keybindings: Ctrl+S (quick save), F5 (load menu),
  F6 (export menu). SaveStorage interface enables in-memory testing. All saves go to
  ~/.aeternum/saves/, exports to ~/.aeternum/exports/. 58 new tests (27 save + 31
  export), 2470 total.

- 2026: Phase 7.5 Extended Character Systems. DreamingSystem in
  packages/core/src/systems/dreaming.ts runs daily at CHARACTER_AI execution order.
  5 dream types: GoalResolution (stress reduction), FearReinforcement (phobia from
  trauma), CreativeInspiration (+20% research bonus), SecretProcessing (suspicion
  boost), OralTraditionVision (cultural identity). Dream probability formula:
  emotionalLoad/100 × 0.3 (max 30% per night). Emotional load = average of top 5
  memories by absolute emotional weight. PlantedDream queue integrates with
  PropheticDream influence action — planted dreams processed before natural dreams,
  preventing double-dreaming same tick. Events emitted as Personal/character.dream.
  Character Introspection in packages/narrative/src/vignettes/introspection.ts
  generates 100-300 word first-person monologue. 8 voice types determined from
  personality trait combinations (AmbitiousPatient, ImpulsivePassionate, Scholarly,
  ParanoidKnowledgeable, Empathetic, BraveIdealistic, CunningPragmatic, Default).
  Monologue assembles opening, location/faction context, goal reflection with
  progress notes, emotional memory coloring, ally/rival relationships, secret
  reflection, recent events, closing. Deterministic from seed. 82 new tests
  (46 dreaming + 36 introspection), 2612 total. Phase 7 complete.
- 2026: UI Overhaul Phase 1. Four fixes merged to main from ui-overhaul/phase-1:
  (1) Event log default minSignificance raised 0→40 in createDefaultFilter(),
  filtering out noisy CharacterAI actions (befriend/craft/study at sig ~20).
  (2) Keybinding catch-all: app.ts setupKeyBindings() replaced 4 hardcoded
  delegation blocks with single screen.on('keypress') handler that forwards all
  non-global keys to focused panel. Number keys 1-7 context-aware (Inspector
  section toggles vs panel switching). (3) Map init fix: CLI created duplicate
  LayoutManager causing double height subtraction; now uses Application's single
  LayoutManager via app.getLayoutManager(). Added applyLayout() call in
  renderInitialFrame() to sync panel dimensions before first render. (4) Top menu
  bar: MenuBar class (blessed box, top:0, height:1) with panel names, navigation
  via Tab/arrow keys. LayoutManager updated with MENU_BAR_HEIGHT=1, all layout
  functions offset panel y-values. Theme extended with 4 menu colors. 65 new tests
  (30 app + 14 menu-bar + 10 viewport-resize + 11 layout-manager), 2726 total.
- 2026: UI Overhaul Phase 2. Five fixes for resize, keyboard, mouse, and color:
  (1) Resize black screen fix: removed premature screen.render() calls from
  BasePanel resize()/moveTo()/focus()/blur() — caller batches renders via
  applyLayout(). Added forceRender parameter to applyLayout() that re-renders
  all panel content after layout changes. Resize handler, maximizeCurrentPanel(),
  cycleLayout(), handleEscape() all pass forceRender=true. Cross-platform resize
  listens on both screen 'resize' and process.stdout 'resize'. Terminal dimension
  detection: PowerShell $Host.UI.RawUI.WindowSize fallback for mintty/MSYS2 where
  process.stdout.columns is undefined. syncBlessedDimensions() patches
  screen.program.cols/rows + screen.realloc() to fix blessed's 1x1 buffer.
  (2) Keyboard fix: removed keys:true and scrollable:true from BasePanel
  constructor (blessed intercepted arrow keys). Added 'f','b' to globalKeys set
  so focus/bookmark keybindings aren't forwarded to panels.
  (3) Mouse support: setupMouseHandling() in Application with click-to-focus +
  panel-relative click delegation, wheelup/wheeldown forwarded to focused panel.
  BasePanel.handleClick() default no-op. MapPanel: click moves cursor,
  wheelup/down zooms. EventLogPanel: wheelup/down scrolls by 3 lines.
  MockScreen extended with simulateClick() and simulateWheel().
  (4) Color fix: patchBlessedColorMatching() monkey-patches blessed.colors.match()
  which uses luma-weighted distance that maps dark saturated colors to greyscale
  palette entries (232-255). Replacement uses unweighted Euclidean distance across
  all 256 entries, separately tracking best colored (non-grey-diagonal) cube entry.
  For saturated inputs (>10%), prefers colored entry unless >4x worse than grey.
  Result cached by RGB hash. Called in createScreen() before widget creation.
  (5) Help overlay updated with mouse click and scroll entries.
- 2026: Phase 8 UX Overhaul Tier 1-2. "Names Not Numbers": EventFormatter wired to
  EntityResolver (from @fws/narrative) with SUBTYPE_VERB_MAP (~50 subtype-to-verb
  patterns). resolveEntityIdToName() tries character→faction→site→artifact. Verb
  patterns use {0}/{1}/{loc} placeholders with graceful cleanup of unresolved refs.
  enhanceDescription() prepends first participant name. ENTITY_NAME_COLOR=#88AAFF.
  World Dashboard: Inspector empty state replaced with renderWorldDashboard() showing
  World Pulse (WorldFingerprintCalculator.calculateFingerprint domain bars), Top Factions
  (Territory component iteration via getAll()), Active Tensions (sig 60+ Political/Military
  events), Recent Notable Events (top 8 by significance from last 200). Welcome screen
  (renderWelcomeScreen) shows seed/world size/factions/tensions before simulation starts.
  Click Handling: MenuBar.handleClick(x) maps x-coordinate to items (label.length+2 per
  item, 1 char separator). EventLogPanel.handleClick(x,y) selects events in left pane.
  Application routes y=0 clicks to menu bar. Context-sensitive status bar: getContextHints()
  returns panel-specific shortcut hints. Auto-pause: legendaryPauseThreshold (default 95)
  in AutoSlowdownConfig, checked before regular auto-slowdown. Existing auto-slowdown
  tests updated to use sig 90-94 (below legendary threshold). 164 new tests, 2776 total.

- 2026: Narrative-First UI Overhaul (Phase 8 Tier 3). Two-phase approach: narrative
  quality first, then layout changes. Phase A: (1) 66 Character AI narrative templates
  (character-actions.ts) covering 22 subtypes (befriend, trade, craft_item, study_lore,
  pray, journey, experiment, steal, proselytize, research_spell, enchant_item, forage,
  flee, seek_healing, dream, betray, intimidate, show_mercy, negotiate_treaty,
  forge_alliance, rally_troops, plan_campaign) x 3 significance tiers (low 0-40,
  medium 41-70, high 71-100). Registered in template index, 281 total templates.
  (2) SHORT_NARRATIVE_MAP (~70 subtype→prose mappings) + getShortNarrative() +
  getSignificanceLabel() in EventFormatter. Right pane title now shows narrative prose
  instead of raw getEventDescription(). (3) Numeric significance removed everywhere:
  formatSignificanceBarColored() shows word labels (Trivial/Minor/Moderate/Major/
  Critical/Legendary); inspector events show colored significance char + narrative;
  event log detail shows word label not bar. (4) Dashboard narrative: DOMAIN_PROSE
  (6 domains x 5 value thresholds → atmospheric text), narrative empty states ("The
  realm knows an uneasy peace" vs "Warfare: 0"), event aggregation (groups repeated
  subtypes, shows count if >2), section headers renamed (TOP FACTIONS→GREAT POWERS,
  ACTIVE TENSIONS→WINDS OF CONFLICT, RECENT NOTABLE→RECENT TIDINGS).
  Phase B: (5) 'narrative' layout preset (4-quadrant: Map 40%x55% upper-left,
  RegionDetail 40%x45% lower-left, EventLog 60%x50% upper-right, Inspector 60%x50%
  lower-right). PanelId.RegionDetail added to enum. RegionDetail hidden (0x0) in all
  other presets. (6) RegionDetailPanel (region-detail-panel.ts): BIOME_PROSE 17 biome
  atmospheric descriptions, describeElevation (8 tiers), describeTemperature (8 tiers),
  describeRainfall (7 tiers), RESOURCE_PROSE (13 resources), 200ms cursor throttle,
  scroll support, empty state atmospheric prompt. (7) Wiring: MapPanel.setSelectionHandler
  feeds RegionDetailPanel.updateLocation with tile data from tileLookup. CLI sets
  'narrative' as default layout. LAYOUT_ORDER updated to cycle narrative→default→
  map-focus→log-focus→split. PANEL_INDEX extended to 8 panels. Menu bar includes
  Region item. Context hints for RegionDetail panel. 2776 tests passing.

- 2026: UI Redesign (Phase 8 Tier 4). 11 fixes across renderer and CLI:
  (1) Region panel blessed tag fix: tags must close on every line (blessed processes
  per-line); fixed empty state and inspector "Great Powers" empty state.
  (2) Inspector title: \u00C6 → AETERNUM (ASCII-safe for mintty/MSYS2).
  (3) Menu bar active panel indicator: added activePanelId field separate from
  selectedIndex; three-tier render style (active=inverse bg, keyboard-selected=bold,
  normal=plain). MenuBarItem extended with optional panelId field. app.ts itemProvider
  includes panelId on each item.
  (4) Entity resolution World-based fallback: buildEntityResolver() now accepts World
  parameter; resolveFromWorld() reads Status component for runtime entities (armies,
  institutions, artifacts) not in static generator snapshot.
  (5) Welcome screen 30-tick warmup: CLI runs 30 engine ticks silently before building
  welcome data; tensions built from actual event log (sig 50+ Political/Military);
  welcome text is narrative prose; dismissWelcome() flag set on first Space press.
  (6) Dashboard narrative depth: synthesized World Pulse paragraph combining top/bottom
  domain values; getActiveTensions() returns full WorldEvent objects; Winds of Conflict
  uses formatter.getEventDescription() with resolved names; Recent Tidings prepends
  primary participant name.
  (7) Right-pane narrative enrichment: buildNarrativeContent() adds Participants
  (resolved names), Location, Consequences (up to 3 cascade events with short narratives).
  (8) Region settlement/faction overlay: RegionOverlayData interface with
  controllingFaction and nearbySettlements; wired from CLI using Position/Population/
  Allegiance component queries.
  (9) Chronicle-first layout: narrative preset redesigned — EventLog 60% width full-height
  left column, Map upper-right 40%x50%, Inspector/Region lower-right 40%x50%.
  (10) Clickable entity names: rightPaneEntitySpans Map tracks entity name positions
  per line in right pane; handleClick() maps right-pane clicks to entity spans and
  calls onInspectEntity(). 2776 tests passing.

## Known Issues
- EventCategory.Exploratory has no system producing events (by design — no exploration
  system implemented yet). All other 9 categories produce events after bridge initialization.