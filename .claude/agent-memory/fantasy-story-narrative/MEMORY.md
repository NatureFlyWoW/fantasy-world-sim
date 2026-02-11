# Fantasy Story Narrative Agent Memory

## Key Files
- Templates: `packages/narrative/src/templates/` (11+ category files, 281+ templates)
- Template types: `packages/narrative/src/templates/types.ts` (NarrativeTemplate)
- Engine: `packages/narrative/src/transforms/narrative-engine.ts`
- Parser: `packages/narrative/src/transforms/template-parser.ts`
- Chronicler: `packages/narrative/src/chronicler/chronicler.ts`, bias-filter.ts, lost-history.ts
- Vignettes: `packages/narrative/src/vignettes/`
- Chronicle (terminal): `packages/renderer/src/panels/event-log-panel.ts`
- Chronicle (electron): `packages/electron/src/renderer/chronicle/`
- Full map: `docs/CODEBASE_MAP.md`

## Key Architecture Notes

### EventLogPanel (Chronicle View) - Phase 8.9
- File: `packages/renderer/src/panels/event-log-panel.ts`
- Transformed from raw event log to prose-based Chronicle View
- Four chronicle modes: prose (default), compact, arcs, domain
- Key 'n' cycles chronicle modes (NOT 'm' which is global maximize)
- Key 'r' toggles region filter
- Keys 'f' and 'b' are in app.ts globalKeys set but NOT handled globally -- they are dead keys
- EventAggregator in `event-aggregator.ts`, EventRegionFilter in `event-filter.ts`

### Aggregation System
- Events with significance >= 60 are always standalone (never aggregated)
- Groups by: time window (default 30 ticks) + category + primary participant
- Minimum 2 events to form an aggregation group
- `ChronicleEntry` union type: 'event' | 'aggregate' | 'header'
- `addTemporalHeaders()` inserts year/month headers

### Naming Conflicts to Watch
- `const chroniclers` declared twice in same function scope of `buildNarrativeContent` -- renamed second to `allChroniclers`
- PanelMode type extended with 'vignette' already via `as PanelMode` cast

### Test Count Progression
- Before: 2847 tests
- After Chronicle View: 2902 tests (+55)
- New test files: event-aggregator.test.ts (20), event-filter.test.ts (15), extended event-log-panel.test.ts (+20)

## Common Patterns
- Blessed tags MUST close on every line (from CLAUDE.md)
- `ticksToWorldTime()` for converting tick to {year, month, day}
- 360 days/year, 30 days/month, 12 months/year
- `getSignificanceColor()` and `getCategoryColor()` for theme colors
- `EventFormatter.getEventDescription()` resolves entity names via verb patterns
- `EventFormatter.getShortNarrative()` for atmospheric one-liners
