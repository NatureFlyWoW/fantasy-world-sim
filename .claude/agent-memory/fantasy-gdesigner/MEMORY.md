# Fantasy Game Designer -- Agent Memory

## Key Design Decisions Made

### Game Design Document v3.0 (2026-02-09)
- Wrote comprehensive GDD at `all_docs/game_design_new.md` (2319 lines)
- Split into 19 section files at `all_docs/game_design/` with `game_design_index.md`
- 19 main sections + appendices (A-J): cascade anatomy, glossary, template categories, AI worked example
- All data cross-referenced against source code (104 component types, 281 templates, 17 influence actions)

### Context View Polymorphic Inspector
- 6 inspector types: Character (7 sections), Faction (8), Site (7), Artifact (8), Event (6), Region (5-6)
- Prose-first sections with collapsible accordions, clickable entity names (#88AAFF), breadcrumb navigation
- Events use EventId (not EntityId), regions use tile coordinates — both need special inspection paths

## Codebase Knowledge

### Inspector Architecture (Phase 8 Complete)
- InspectorPanel delegates to 6 sub-inspectors (all prose-first, all with entity span tracking)
- History stack with back/forward, breadcrumbs showing resolved names
- Entity type detection via component checks
- All entity IDs resolve to names, all names are clickable

### Renderer Patterns
- blessed tags MUST close on every line
- ENTITY_NAME_COLOR = '#88AAFF' for clickable entity names
- BasePanel methods must NOT call screen.render()
- buildEntityResolver() needs World param for runtime entity fallback

### Narrative System
- NarrativeEngine produces NarrativeOutput: { title, body, tone, templateId }
- 5 tones: EpicHistorical, PersonalCharacterFocus, Mythological, PoliticalIntrigue, Scholarly
- 281 templates across 11 category files
- ChroniclerBiasFilter applies perspective filtering

## Design Principles for Aeternum
- Prose-first, data-available (narrative paragraph before raw numbers)
- Every name is a door (clickable navigation)
- Layered depth: glimpse (collapsed) -> narrative (expanded) -> deep dive (click-through)
- Observation and cultivation philosophy -- player watches, nudges, never commands
