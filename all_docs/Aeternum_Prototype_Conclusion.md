# Æternum — First Prototype Conclusion

## What Was Built: Phases 0–7 Complete

Project Æternum set out to build a procedural fantasy world simulator inspired by Dwarf Fortress Legends Mode — a system where living worlds generate their own histories through emergent simulation rather than scripted content. After seven development phases spanning approximately 54 tasks and an estimated 40–65 focused Claude Code sessions, the first complete prototype exists. This document captures the full scope of what that prototype contains, what it does, and what was learned along the way.

---

## The Foundation: Architecture & Core Engine (Phases 0–1)

The project is organized as a TypeScript monorepo managed by pnpm, divided into five packages that form a clean dependency hierarchy: `@fws/core` (depends on nothing), `@fws/generator` (depends on core), `@fws/renderer` (depends on core), `@fws/narrative` (depends on core), and `@fws/cli` (depends on all four).

At the heart of everything sits an Entity-Component-System engine. Every object in the simulation — from mountain ranges to individual peasants — is an entity, which is nothing more than a unique identifier (a branded TypeScript type for compile-time safety). All data lives in components, and all logic lives in systems. The ECS uses Map-backed component stores with monotonic entity IDs (no recycling), and the `World.query()` method starts with the smallest store for efficiency. Branded types for EntityId, CharacterId, FactionId, SiteId, ArtifactId, EventId, DeityId, BookId, RegionId, WarId, and InfluenceActionId prevent an entire class of ID-mismatch bugs at compile time.

The event system serves as the primary communication backbone. An EventBus provides typed pub/sub, an EventLog maintains an append-only record indexed by id, entity, and time, and an EventQueue uses a significance-priority binary heap to ensure the most important events are processed first. Ten event categories (Political, Magical, Cultural, Religious, Scientific, Personal, Exploratory, Economic, Disaster, Military) organize every occurrence in the world. Every event is an immutable record carrying a ConsequenceRule that defines its cascade potential with dampening.

Time flows through a WorldClock that treats one tick as one day, with a 360-day calendar (12 months × 30 days). Six frequency tiers allow systems to run at different rates — daily for character AI and military, weekly for trade and reputation, monthly for economy and politics, seasonal for agriculture and culture, annual for technology and language, and decadal for geology and climate. A TickScheduler pre-registers 27 default systems. The TimeController supports seven speed modes from Paused through UltraFast (3650 days/second) and SlowMotion.

The simulation engine follows a strict 13-step tick order: Time Advance → Environment → Economy → Politics → Social → Character AI → Magic → Religion → Military → Event Resolution → Narrative Generation → Cleanup/Indexing → Player Notification. A Level-of-Detail manager divides the world into three zones — Full detail within 50 tiles of focus, Reduced within 200, and Abstract beyond — allowing the simulation to scale by computing only what matters near the player's attention.

The cascade engine, built during Phase 1 rather than deferred, enables cross-domain consequence chains. When a coronation occurs, economic shifts, military posturing, and cultural celebrations can ripple outward. The dampening formula (baseProbability × (1 - dampening)^depth) with a max cascade depth of 10 prevents infinite chains while still producing complex emergent behavior. Narrative arc detection identifies rising-action patterns across cascade chains.

A quadtree-based spatial index provides efficient neighbor queries for the map, supporting range searches and distance calculations that every spatial system depends on.

---

## World Generation (Phase 2)

The world generation pipeline runs through seven deterministic steps, all seeded from a single RNG seed for reproducibility.

Terrain generation builds heightmaps through tectonic simulation, carves hydrology (rivers, lakes, oceans), calculates climate from latitude, altitude, and ocean proximity, classifies biomes from climate data, distributes natural resources based on geology, and places ley lines as conduits for magical energy. Ecology builds on the terrain layer with biome-specific flora and fauna, resource deposits, and environmental characteristics.

The cosmological framework generates a unique pantheon of deities with domains and personalities, defines the world's magic system (types of magic, power sources, institutional structures), and establishes a planar structure that gives the world metaphysical depth. Racial genesis uses the cosmological context to produce distinct races with physiological characteristics, lifespans, cultural tendencies, and innate abilities. Each race gets a procedurally generated creation myth. A Markov chain name generator trained on culturally-inspired phoneme distributions ensures that elven names feel different from dwarven names, which feel different from orcish names, while names within a culture feel linguistically consistent. Seven distinct cultures provide the foundation for social variety.

Pre-history simulation is where the generator transitions from static placement to dynamic simulation. The simulation engine runs in fast-forward mode at reduced fidelity for the configured historical depth. During this phase, ancient empires rise and fall, legendary heroes perform great deeds, artifacts are forged during significant events, wars are fought that leave ruins and grudges, religions splinter and merge, and languages diverge from common ancestors. The output is the world's backstory — not hand-authored, but simulated.

Current state initialization crystallizes the fast-forwarded simulation into the world the player will observe. Active civilizations are established with governments, economies, militaries, and cultures derived from their simulated history. Named characters are generated in positions of power and significance, each with a personal history that connects to the world's past. Political structures reflect centuries of evolution. Initial tensions — border disputes, succession crises, religious conflicts, trade rivalries — are seeded from the pre-history's unresolved threads.

A post-generation refinement UI allows the player to adjust the world before simulation begins: moving territories, adjusting populations, creating characters with custom traits, establishing alliances or conflicts, and seeding specific events. This is the one moment of direct control the player receives before the influence system takes over.

Nine configurable parameters with named presets (including `standard_fantasy` and `kitchen_sink`) allow worlds to be tuned for different experiences. All generation is deterministic from seed — the same seed always produces the same world.

---

## The Living World: Ten Simulation Systems (Phase 3)

Phase 3 was the largest and most complex phase, producing ten interconnected simulation systems that give the world its life. Every system follows the same architectural rule: systems communicate only through the EventBus and shared component state, never referencing each other directly. The cascade engine serves as the sole integration point.

**Character AI** runs daily through a six-phase decision pipeline: Perceive (gather context from location, relationships, faction politics, and social network — which may be incomplete or wrong per the Memory system), Evaluate (assess current situation against personality traits and goals), Generate (produce candidate actions), Score (rank actions by expected utility weighted by personality), Execute (perform the chosen action, emitting events), and Reflect (update memories and adjust goals based on outcomes). Each character is a genuine agent making decisions based on limited, potentially distorted information.

**Memory & Reputation** gives characters persistent memories that decay and distort over time. Memory decay means old events fade unless they were emotionally significant. Reputation is multi-dimensional and propagates through social networks, so a character's reputation in a distant city depends on who has traveled there and what they said. Grudges persist across generations. Propaganda allows factions to deliberately manipulate reputation.

**Faction & Political** handles the full spectrum of governance: monarchies, republics, theocracies, tribal confederations, oligarchies, and magocracies. The system manages diplomacy, treaties (with enforcement mechanisms that can trigger consequences for violations), succession, coups, and political reform. Treaties are not just diplomatic flags — they have specific terms that are monitored and enforced.

**Economic** simulates resource production, trade networks, and markets. Settlements produce goods based on local resources, trade routes connect them, and market dynamics create economic events from booms to famines. The economic system was the highest-volume event producer in baseline testing, generating 3,997 events in a 365-tick simulation of a Small world.

**Military & Warfare** models army composition, battlefield resolution, siege mechanics, multi-stage campaigns, and the consequences of war (territory changes, refugee flows, economic damage, cultural destruction). Wars are not simple dice rolls — they involve logistics, morale, terrain advantages, and strategic decisions.

**Magic** governs magical research at institutions, artifact creation and the emergence of artifact consciousness, and magical catastrophes when things go wrong. The magic system is typed (elemental, necromancy, etc.) with distinct power sources, and magical research follows institutional structures (academies, towers, secret circles).

**Religion** tracks divine power that waxes and wanes based on worshiper count and faith intensity. Gods can intervene in mortal affairs (at a cost), church politics create internal tensions within religions, and syncretism allows religions to merge when cultures meet. The religion system interfaces with the cascade engine to produce miracles, schisms, and holy wars.

**Cultural Evolution** is the slowest-changing but deepest system, tracking technological progression, artistic movements, philosophical schools, and language drift. Oral traditions mutate as they pass from generation to generation, creating cultural identity that evolves naturally. Technology advancement unlocks new possibilities for other systems.

**Ecological Pressure** creates environmental constraints on civilization. Resources deplete when overused, environmental degradation reduces land productivity, creature territories conflict with expanding settlements, and invasive species can destabilize ecosystems. This system ensures that the world pushes back against unchecked growth.

**Secret Knowledge** creates information asymmetry — the most distinctive system architecturally. Not all characters know all things. Secrets have holders, seekers, and consequences upon revelation. The perception filter ensures that when Character AI gathers information, it only receives what that character could plausibly know. Discovery events occur when characters uncover hidden truths, and these revelations cascade into political upheaval, personal betrayals, or religious crises.

A critical engineering challenge was the Generator-to-Simulation Bridge. Phase 3 systems use internal Maps for state rather than direct ECS queries, so a bridging function (`initializeSystemsFromGenerated()` in `populate-world.ts`) was built to translate world generation output into the format each simulation system expects. This bridge ensures that the MagicSystem receives registered institutions with active research, the CulturalEvolutionSystem inherits ongoing research with appropriate progress levels, the EcologySystem knows about existing regions, and the WarfareSystem can track ongoing conflicts from pre-history. After the bridge was implemented, 9 of 10 event categories produced events in the 365-tick smoke test (Exploratory remains silent by design — no exploration system has been implemented yet).

---

## The Terminal Interface: ASCII Renderer (Phase 4)

The renderer package uses the `blessed` library to build a terminal-based ASCII interface with seven panel types, all driven by the same event subscription model that powers the simulation.

The **World Map** renders terrain using colored ASCII characters with five zoom levels (1:1 to 16:1), six independently toggleable overlays (Political, Resources, Military, Trade, Magic, Climate), a minimap showing the full world with a viewport rectangle, and entity markers using Unicode symbols (☼ city, † ruin, ⚔ army, ✝ temple, ✧ academy, ⚑ capital). A dirty-flag system prevents unnecessary re-renders.

The **Dual Event Log** splits into two columns: raw data events (left, 55%) and narrative prose (right, 45%). Filters support category, significance threshold, entity, and location. The cascade chain is visualized as an indented tree structure. Live EventBus subscription provides flash highlights for events above significance 80 and terminal bell alerts above 95.

The **Entity Inspector** auto-detects entity type from components and provides four specialized inspectors: Character (8 sections covering attributes, personality, relationships, memories, goals, possessions, reputation, and history), Location (8 sections), Faction (8 sections including heraldry display), and Artifact (8 sections). Navigation history enables back/forward traversal. Sections are collapsible with number keys.

The **Relationship Graph** uses a concentric ring layout (BFS from center entity) with ASCII-rendered edges. Eleven relationship types are color-coded (ally, friend, family, rival, enemy, neutral, member, leader, vassal, trade, unknown), and line styles indicate strength (═ strong, ─ moderate, · weak). The panel supports 1–3 hop depth, six filters, cursor navigation, and a legend toggle.

The **Timeline Panel** displays a horizontal ASCII timeline with significance markers (· < ○ < ● < ★), three zoom levels (year at 30 ticks/char, decade at 360, century at 3600), parallel faction tracks, era markers, and category filtering.

The **Statistics Panel** offers five views (Overview, Population, Territory, Technology, Conflict) with ASCII bar charts and sparklines using Unicode block characters (▁▂▃▅▆█).

The **World DNA Fingerprint Panel** renders an ASCII hexagonal radar chart showing six-domain balance (Warfare, Magic, Religion, Commerce, Scholarship, Diplomacy), a colored faction bar, sparklines, and a complexity score.

A significant engineering effort went into pre-Phase 6 runtime bugfixes. While all tests passed, actually running the terminal UI revealed CJS/ESM compatibility issues with the `blessed` library (solved with `createRequire`), keybinding registration failures, unparsed color tags (solved by enabling `tags: true` in BasePanel), black terrain rendering (solved by wiring tileLookup), and broken startup sequencing (solved by making the simulation wait for a Space key press before starting). The startup sequence was restructured to: generateWorld → createPanels → app.start → renderInitialFrame → display "Press Space to begin" → wait for input → startSimLoop.

---

## Narrative Engine (Phase 5)

The narrative engine transforms raw simulation events into literary prose through a template-based system with five distinct tones.

**Epic Historical** produces sweeping, grand prose ("In the twilight of the Age of Iron, the realm trembled..."). **Personal Character Focus** centers on individual experience and emotion. **Mythological** frames events as legend and divine narrative. **Political Intrigue** emphasizes calculation, power dynamics, and Machiavellian maneuvering. **Scholarly** adopts an academic, analytical voice with citations and caveats.

The **TemplateParser** handles entity references (`{character.name}`), pronoun resolution (`{pronoun.subject}`), and conditional logic (`{#if condition}...{#else}...{/if}`). A corpus of 215 templates spans 10 event categories (political, magical, cultural, religious, personal, economic, military, disaster, ecological, secret), with a fallback chain: specific template → category default → global fallback. Tone substitutions transform vocabulary systematically (kingdom→realm, etc.).

Four literary devices are applied post-template: epithet insertion (giving characters dramatic appellations), foreshadowing (for events on rising narrative arcs), retrospective framing (for events at the end of cascade chains), and dramatic irony (when the narrative reveals information that characters in the story don't know, drawn from the Secret Knowledge system).

The **Chronicler System** introduces unreliable narration. Each chronicler is an in-world entity with an ideology (one of eight types) that biases their account. A ChroniclerBiasFilter with eight bias types systematically distorts events — a chronicler from Kingdom A subtly spins events in A's favor. Different chroniclers from different factions produce contradictory accounts of the same event. The player can switch chroniclers to see events from different perspectives.

The **Lost History** mechanic tracks which events have been preserved and which have been lost to time. Historical records degrade realistically — not all events survive in the chronicle, and the surviving accounts may be incomplete or distorted.

The **Vignette System** triggers 200–500 word prose pieces for high-significance events, using 15 archetypes and 12 emotional categories. These micro-narratives transform dry simulation data into moments of genuine storytelling — a coronation becomes a scene with atmosphere, dialogue patterns, and emotional weight.

---

## Player Interaction: Observation & Cultivation (Phase 6)

Phase 6 introduced the mechanisms through which the player engages with the simulation, following Design Pillar 3: observation and cultivation — the player nudges, never commands.

**Simulation Controls** wrap the core TimeController with UI integration. Seven speed modes, single-step advancement (by day, week, month, or year while paused), and an auto-slowdown feature that reduces speed to Normal when three or more events with significance above 90 occur within 30 ticks. The player can override with manual speed increases.

The **Focus System** lets the player select an entity to follow closely. Setting focus on a character, location, or faction adjusts the Level-of-Detail manager to provide full simulation detail around that entity's position, pans the map viewport to center on them, and tracks events relevant to the focused entity. This connects the LoD system to the player's attention.

A **Bookmark & Notification System** lets the player flag entities and events of interest. Configurable alerts trigger by significance threshold, event category, bookmarked entities, or focused entity involvement.

The **Influence System** is the core cultivation mechanic — the player's only tool for affecting the world, and it is deliberately limited. An Influence Point pool starts at 50 (max 100) and regenerates at 1 IP per year. Seventeen influence actions span three categories: Divine (8 actions — inspire idea, arrange meeting, personality nudge, reveal secret, luck modifier, prophetic dream, vision of future, empower champion), Environmental (5 — adjust weather, minor geology, animal migration, trigger natural event, resource discovery), and Cultural (4 — promote art, strengthen tradition, introduce foreign concept, encourage research).

Every influence action passes through a believability check (a personality nudge cannot shift a trait by more than 15 points; arranging a meeting requires the characters to be within 50 tiles) and a resistance check based on the target's personality traits (Paranoid, Cautious, Patient characters resist more strongly, with a formula of 0.7 - resistance/200). Failed resistance gives a 50% IP refund. Distance from the player's focus increases costs. Worlds older than 5,000 years slow IP regeneration through narrative momentum penalties.

Critically, influence events map to existing EventCategories rather than introducing a new "Influence" category. InspireIdea maps to Personal, PropheticDream maps to Religious, AdjustWeather maps to Disaster, ResourceDiscovery maps to Economic, and so on. This ensures that player interventions cascade naturally through existing systems and feel like world events rather than commands from outside the simulation. Influence actions are processed between ticks — queued after tick N completes, applied before tick N+1 starts — preserving the clean 13-step architecture.

---

## Extended Systems: The Finishing Layer (Phase 7)

Phase 7 added five systems that give the prototype its distinctive character.

The **World DNA Fingerprint** computes a composite identity for each generated world. Six domains (Warfare, Magic, Religion, Commerce, Scholarship, Diplomacy) are scored from event category distribution. A civilization palette shows faction proportions from event participation. Per-century sparklines track volatility, magical activity, and population over time. A complexity score (0–100) measures cascade chain depth and cross-domain arc frequency. The renderer displays all of this as an ASCII hexagonal radar chart with colored faction bars and sparkline characters.

**"What If" Timeline Branching** allows the player to snapshot the current world state, apply a divergence action, and run an alternate timeline to see how history might have unfolded differently. The WorldSnapshotManager performs deep cloning of the World, Clock, and EventLog (using a custom deepCloneValue because structuredClone cannot handle Component.serialize() functions). Five divergence action types are supported: ReverseOutcome, RemoveCharacter, ChangeDecision, AddEvent, and DifferentSeed. Up to three branches can exist simultaneously. The BranchComparisonPanel provides three views (entities, events, territory) with divergence counting, letting the player compare how a single change cascades across centuries.

**Save/Load & Export** provides full saves (complete world state) and incremental saves (dirty entity deltas plus event log deltas). Custom serialization handles Maps and Sets via tagged JSON (`__t:'M'`/`__t:'S'`). Gzip compression achieves over 50% size reduction. Auto-save triggers every 10 simulated years with the last 5 saves kept in rotation. Five export types (encyclopedia, chronicle, timeline, genealogy, faction history) produce output in three formats (txt, md, json). The genealogy export renders ASCII family trees with branching characters. All saves go to `~/.aeternum/saves/` and exports to `~/.aeternum/exports/`.

**Procedural Heraldry** generates unique visual symbols for each faction. Three shield template styles correspond to cultures (knightly, round, totem). Five field division patterns, 28 charges in four categories, and tincture derivation from faction values and biome produce heraldry that reflects identity. Heraldry evolves on political events — a revolution changes the flag. Three display sizes support different UI contexts, and heraldry integrates directly into the Faction Inspector panel.

**Extended Character Systems** add a Dreaming Layer and Character Introspection. The DreamingSystem runs daily with five dream types: GoalResolution (stress reduction), FearReinforcement (phobia development from trauma), CreativeInspiration (a 20% research bonus), SecretProcessing (suspicion boost when holding secrets), and OralTraditionVision (cultural identity reinforcement). Dream probability scales with emotional load — the average of a character's top 5 memories by emotional weight, capped at 30% per night. A PlantedDream queue integrates with the PropheticDream influence action, allowing the player's divine interventions to manifest as dreams that modify the character's next day's AI decisions. Character Introspection generates 100–300 word first-person monologues drawn from personality, goals, memories, secrets, and recent events, with eight voice types (AmbitiousPatient, ImpulsivePassionate, Scholarly, ParanoidKnowledgeable, Empathetic, BraveIdealistic, CunningPragmatic, Default) determined by personality trait combinations.

---

## Testing & Quality

The prototype carries 2,612 tests as of Phase 7 completion, all written with Vitest and placed alongside implementation files following the `*.test.ts` pattern. The test count grew steadily across phases: Phase 1 established the core infrastructure tests, Phase 3 brought the total to 1,392 across ten simulation systems, Phase 4 pushed it to 1,941 with renderer tests (using MockScreen and MockBox classes for headless testing), Phase 5 reached 2,029, Phase 6 hit 2,313, and Phase 7 concluded at 2,612.

Every system is tested in isolation. The ECS has tests for entity management, component stores, world queries, and branded type safety (using `ts-expect-error` comments to verify that the compiler rejects invalid ID assignments). The event system is tested across five modules (EventBus, EventQueue, EventLog, EventFactory, CascadeEngine). Each of the ten simulation systems has its own test file verifying event production, state transitions, and edge cases. The renderer panels are tested through MockScreen abstractions that avoid depending on an actual terminal. The narrative engine tests verify that the same event produces measurably different prose in different tones (word frequency analysis confirms vocabulary divergence).

A smoke test integration test generates a Small world with seed 42 and runs 365 ticks, validating that all 10 systems produce well-formed events, cascade chains respect depth limits, entity references are valid, and state is consistent. A headless mode (`--headless` flag with optional `--ticks` count) supports CI/testing without a terminal.

Strict TypeScript with no `any` types ever, enforced by continuous typechecking (`pnpm run typecheck`), provides an additional layer of safety. ESLint runs as a quality gate. Pre-commit hooks warn when editing on the main branch.

The pre-Phase 6 runtime verification revealed an important lesson: comprehensive unit tests do not guarantee correct runtime behavior. Template variable resolution, UI library compatibility (CJS/ESM), keybinding registration, color tag parsing, and startup sequencing all required fixes that were invisible to the test suite. This experience shaped the approach for Phase 8's integration testing.

---

## Performance Profile

A baseline measurement on a Small world (200×200) with seed 42 running 365 ticks established the following profile: world generation completes in 110ms, simulation runs in 114ms total (0.31ms per tick average), memory usage is 40MB heap / 134MB RSS, and 8,343 events are produced. Economic events dominate at 3,997 (48%), followed by Personal at 2,132 (26%). Nine of ten event categories are active, with only Exploratory silent by design.

These numbers confirm that the simulation is well within real-time performance on Small worlds. The 0.31ms per-tick average means the simulation could theoretically run at over 3,000× real-time speed, far exceeding the design target of 10,000× for Small worlds. Memory usage is modest, well below the 500MB target for Small worlds.

---

## What the Prototype Contains at a Glance

The first prototype of Æternum, after seven completed phases, is a procedural fantasy world simulator. When a user runs `pnpm run start`, the system generates a complete fantasy world — terrain, ecology, cosmology, races, civilizations, characters, pre-history — and presents it through an ASCII terminal interface. The simulation runs in real-time, producing thousands of events per simulated year across ten interconnected domains. Each event is transformed into narrative prose in one of five literary tones, filtered through the biased perspective of an in-world chronicler. The player can pause time, focus on individual characters or factions, inspect relationships and history, bookmark entities of interest, and gently influence events through a point-limited cultivation system. They can snapshot timelines and explore alternate histories, save and load worlds, export encyclopedias and chronicles, and examine procedurally generated heraldry. Characters dream, reflect in first-person monologues, and make decisions based on incomplete information colored by personality, memory, and secrets they may or may not know.

The codebase is a TypeScript monorepo of five packages, strictly typed with branded IDs, tested by 2,612 Vitest tests, and built on an event-driven ECS architecture where every occurrence in the world is traceable from cause to consequence. It is, by design, a system where stories emerge from complexity rather than being authored — where a trade dispute can cascade into a war, which produces a legendary hero, whose deeds inspire a religious movement, whose followers eventually overthrow the very kingdom that started the original dispute.

