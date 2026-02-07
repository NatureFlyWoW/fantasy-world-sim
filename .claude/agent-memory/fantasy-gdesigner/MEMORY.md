# Fantasy Game Designer -- Agent Memory

## Key Design Decisions Made

### Context View Polymorphic Inspector (2026-02-07)
- Designed UX architecture for 5 entity inspector types + 2 new types (Event, Region)
- Design doc: `docs/plans/context-view-ux-architecture.md`
- Core pattern: prose-first sections with collapsible accordions, clickable entity names (#88AAFF), breadcrumb navigation
- Entity spans use the same Map<row, Array<{startCol, endCol, entityId}>> pattern as EventLogPanel.rightPaneEntitySpans
- Prose generation via lookup tables (matching BIOME_PROSE/DOMAIN_PROSE/RESOURCE_PROSE pattern)
- Events are not ECS entities (use EventId), regions are tile coordinates (not entities) -- both need special inspection paths
- Migration: 4 phases (shell/nav -> prose layer -> new inspectors -> polish)

## Codebase Knowledge

### Inspector Architecture
- InspectorPanel (inspector-panel.ts) delegates to 4 sub-inspectors: CharacterInspector, LocationInspector, FactionInspector, ArtifactInspector
- Each sub-inspector has getSections() returning InspectorSection[], render() returning string[]
- 4 modes: overview (collapsible sections), relationships, timeline, details (all expanded)
- History stack with back/forward already exists (HistoryEntry[])
- Entity type detection via component checks: Attribute=character, Position+Population=location, Territory=faction, CreationHistory/OwnershipChain=artifact

### Current Inspector Weaknesses (to fix)
- Entity IDs shown as "#123" instead of resolved names
- Data-dump style, no narrative prose
- No clickable entity references within inspector content
- No Event inspector or Region inspector
- Breadcrumbs show only "Entity #N", not names

### Renderer Patterns
- blessed tags MUST close on every line (multi-line spans corrupt character counting)
- ENTITY_NAME_COLOR = '#88AAFF' for clickable entity names
- BasePanel methods must NOT call screen.render() -- caller batches
- EventFormatter.resolveEntityIdToName() resolves through EntityResolver chain: character -> faction -> site -> artifact
- buildEntityResolver() needs World param for runtime entity fallback

### Narrative System
- NarrativeEngine produces NarrativeOutput: { title, body, tone, templateId }
- 5 tones: EpicHistorical, PersonalCharacterFocus, Mythological, PoliticalIntrigue, Scholarly
- EntityResolver interface: resolveCharacter, resolveFaction, resolveSite, resolveArtifact, resolveDeity
- ChroniclerBiasFilter applies perspective filtering to narratives
- 281 templates across 11 category files

### ECS Components Referenced by Inspectors
- Character: Attribute, Personality, Traits, Goal, Relationship, Grudges, Memory, Possession, Wealth, Status, Health, Membership
- Faction: Territory, Government, Doctrine, Military, Diplomacy, Economy, Hierarchy, History, Origin, Culture
- Location: Position, Population, PopulationDemographics, Biome, Climate, Economy, Resource, Government, Ownership, Structures, Condition, Military, Culture
- Artifact: Status, Value, Location, CreationHistory, Origin, MagicalProperty, Power, PowerLevel, Personality, Traits, Goal, OwnershipChain, Guardian, Curse, Significance

## Design Principles for Aeternum
- Prose-first, data-available (narrative paragraph before raw numbers)
- Every name is a door (clickable navigation)
- Layered depth: glimpse (collapsed) -> narrative (expanded) -> deep dive (click-through)
- Respect the Chronicler (use NarrativeEngine tones, support multiple perspectives)
- Observation and cultivation philosophy -- player watches, nudges, never commands
