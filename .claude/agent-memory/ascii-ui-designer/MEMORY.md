# ASCII UI Designer -- Agent Memory

## Key Files
- `docs/plans/context-view-ux-architecture.md` -- UX spec for polymorphic inspector (5 entity types)
- `docs/plans/context-view-layout-spec.md` -- Blessed box structure, tag patterns, color palette, responsive rules
- `docs/plans/context-view-mockups.md` -- ASCII mockups for all 5 inspector types + empty state + responsive demos
- `packages/renderer/src/panels/inspector-panel.ts` -- Main inspector panel (InspectorPanel, HistoryEntry, InspectorMode)
- `packages/renderer/src/panels/character-inspector.ts` -- Character sub-inspector (8 sections)
- `packages/renderer/src/panels/faction-inspector.ts` -- Faction sub-inspector (9 sections, heraldry)
- `packages/renderer/src/panels/location-inspector.ts` -- Location sub-inspector (8 sections)
- `packages/renderer/src/panels/region-detail-panel.ts` -- Region prose (BIOME_PROSE, RESOURCE_PROSE)
- `packages/renderer/src/panels/event-formatter.ts` -- ENTITY_NAME_COLOR, SHORT_NARRATIVE_MAP, SUBTYPE_VERB_MAP
- `packages/renderer/src/theme.ts` -- UI_COLORS, ENTITY_COLORS, SIGNIFICANCE_COLORS, CATEGORY_COLORS
- `packages/renderer/src/panel.ts` -- BasePanel, MockScreen, MockBox, createMockBoxFactory

## Blessed Rendering Constraints
- All content is flat string[] joined with '\n' passed to setContent() -- no nested boxes
- Tags MUST close on every line: `{#88AAFF-fg}text{/}` -- multi-line spans corrupt character counting
- `{/}` closes all open tags -- use it as a universal closer
- Strip tags with `.replace(/\{[^}]*\}/g, '')` to measure display width
- getInnerDimensions() returns width-2, height-2 (border excluded)
- BasePanel.resize/moveTo/focus/blur must NOT call screen.render()

## Entity Span Tracking Pattern
- EventLogPanel uses `rightPaneEntitySpans: Map<number, Array<{ startCol: number; endCol: number; entityId: EntityId }>>`
- Row numbers are panel-content-relative (after scroll offset and border)
- startCol/endCol refer to visible character positions (tags stripped)
- Click detection: convert screen coords to panel coords, check spans map

## Current Inspector Problems (to fix)
- Shows "#entityId" instead of resolved names (Faction: #42, Character #12)
- No prose -- raw data dump style (Health: 80/100 (80%))
- Section titles are generic (Attributes, Personality, Goals)
- No clickable entity names (no entity spans tracking)
- No breadcrumb navigation
- No footer hint bar
- Entity type icons use Unicode emojis (should use ASCII: @, &, #, ~, !, *)
- Header shows "Entity #17" instead of resolved name

## Design Decisions Made
- 5 lines for header: type+rule, name+epithet, oneliner+temporal, breadcrumbs, thick divider
- Section accordion: '>' collapsed, 'v' expanded, [N] number key, right-aligned summary hint
- Footer: thin dash divider + context-sensitive key hints
- Prose-first: every section opens with narrative paragraph, data below
- 4-space indent for section content, 6-space for sub-items
- Entity names always #88AAFF, never bold (bold reserved for headers)
- Progress bars use [===------] format with color-coded fill by range
- Dotted leaders with #444444 dim color

## Color Quick Reference
- Clickable entity name: #88AAFF
- Character icon: #88AAFF, Faction: #FF8844, Region: #44CC88, Site: #FFDD00, Event: category color
- Primary text: #cccccc, Secondary: #888888, Dim: #666666, Very dim: #444444
- Positive affinity: #44FF88, Negative: #FF4444, Neutral: #CCCC44
