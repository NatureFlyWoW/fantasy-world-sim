# Aeternum Sim Dev - Agent Memory

## Inspector System Architecture
- Polymorphic Context View: 6 sub-inspectors (Character, Location, Faction, Artifact, Event, Region)
- Each has `getSections()`, `render()`, `getEntitySpans()` methods
- Prose-first sections use atmospheric text before structured data
- Entity span tracking via `EntitySpanMap` for clickable names
- Shared utilities in `inspector-prose.ts` (renderBar, renderEntityName, renderDottedLeader, etc.)

## Section Structures (Post Prose-First Rewrite)
- **Character**: 7 sections (story-so-far, strengths-flaws, bonds-rivalries, worldly-standing, heart-mind, remembered-things, possessions-treasures)
- **Location**: 7 sections (living-portrait, people-peoples, power-governance, trade-industry, walls-works, notable-souls, the-annals)
- **Faction**: 8 sections (rise-reign, banner-creed, court-council, lands-holdings, swords-shields, alliances-enmities, coffers-commerce, chronicles)
- **Event**: 6 sections (what-happened, who-involved, where-when, why-matters, what-before, what-followed)
- **Region**: 5-6 sections (land, riches, dwellers, marks, echoes, +arcane if leyLine)
- **Artifact**: 8 sections (overview, creation, powers, consciousness, ownership, curses, significance, history) -- NOT yet rewritten

## Integration Wiring (Complete)
- EventLogPanel -> InspectorPanel: `setInspectEntityHandler` for entity name clicks, `setInspectEventHandler` for Enter on event
- MapPanel -> InspectorPanel: `inspectRegion()` called from selection handler in CLI index.ts
- InspectorPanel -> InspectorPanel: `setInspectHandler` for clicking entity names within inspector
- RelationshipsPanel -> InspectorPanel: `setInspectHandler` for clicking entity names
- TimelinePanel -> InspectorPanel: `setInspectHandler` for clicking events (EventId)
- Enter key on EventLogPanel inspects the **event** (via `inspectSelectedEvent`); 'i' key inspects primary participant
- Double-click pattern: clicking already-selected event in left pane triggers event inspection

## Key Patterns
- `exactOptionalPropertyTypes`: Use spread for conditional optional props: `...(condition ? { summaryHint: value } : {})`
- `toLocaleString()` produces locale-dependent separators (comma vs space on MINGW64) -- use `toContain` not `toBe` in tests
- `getStore()` needs double cast: `as unknown as { getAll: () => Map<...> }`
- Tests need `getStore` in MockWorldOverrides when inspectors query stores
- EventLogPanel autoScroll selects last event on addEvent -- test double-click with 2+ events

## Test Counts
- 2776 -> 2844 (Phase 8 inspector system rewrite)
- 2844 -> 2847 (integration wiring tests)
- sub-inspectors.test.ts: 51 tests (Location: 20, Faction: 19, Artifact: 12)
- character-inspector.test.ts: 33 tests
- event-inspector.test.ts: 19 tests
- region-inspector.test.ts: 24 tests
- event-log-panel.test.ts: 62 tests

## Remaining Work (Phase 8)
- ArtifactInspector prose-first rewrite (not yet started)
- 8.9-8.12: Chronicle view, event aggregation, story threads, polish
