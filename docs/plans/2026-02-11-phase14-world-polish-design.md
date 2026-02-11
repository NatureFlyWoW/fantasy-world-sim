# Phase 14: World Polish

Believability pass addressing narrative quality, map dynamism, demographic realism, and Legends filtering. Every change serves one goal: make the world feel alive and its history worth reading.

## P1: Foundation Fixes

Four bugs that actively break immersion.

### Template Resolution Failure

Exploration events emit subtype `'exploration.frontier_danger'` but fall through to generic fallback templates, producing literal `{data.settlementName}` in output. The `EventCategory.Exploratory` category was added in Phase 13 but may not be properly indexed in the narrative engine's template registry. Fix: trace the exact failure path and ensure Exploratory category templates are matched correctly during `findTemplate()`.

### Race Lifespan Registration

`PopulationSystem.registerRaceLifespan()` exists but is never called during engine initialization. All races fall back to human lifespan (expected: 70, maximum: 90). Elves die at 90 instead of 500.

Fix: during engine initialization in both CLI (`packages/cli/src/index.ts`) and Electron (`packages/electron/src/main/simulation-runner.ts`), iterate generated races and call `registerRaceLifespan(raceName, { expected, maximum })` for each. The race data is available from the generator's `RaceGenerator` output, which includes lifespan tiers (short-lived: 30-50, baseline: 60-90, long-lived: 200-500, ancient: 500-1000).

### Notable Character Age Formula

Current formula in `character-generator.ts`:
```
age = rng.nextInt(max(18, lifespan.min * 0.3), lifespan.max * 0.7)
```

Produces 18-year-old kings. Fix: shift to `lifespan.min * 0.4` to `lifespan.max * 0.8`, minimum 25 for humanoids. Rulers specifically should skew older (30+) since they need time to accumulate power and experience.

### Non-Notable Age Ranges

Currently hardcoded to human ranges (children 1-17, working 18-55, elderly 56-80) regardless of race. Fix: scale age buckets by the settlement's dominant race lifespan tier. An elf settlement's "working age" adults should be 50-300, not 18-55. Use the `RaceLifespan` data from `population-utils.ts` to compute age brackets proportionally.

## P2: Always-On Territory Map

Make the default map view tell a story without requiring overlay toggles.

### Territory Tint Layer

The Political overlay currently paints faction-colored diamonds around settlements, but only when toggled with `O`. Make a subtle version the permanent base layer. Each faction's controlled tiles get a 30-40% opacity color tint blended with terrain — forests stay green but with a faint blue wash for one faction, deserts stay tan with a red tinge for another. Terrain remains readable; political control is ambient.

Implementation: `TilemapRenderer.renderSingleTile()` already checks `overlayManager.getModification()`. Add a new "base political" mode that always applies the faction tint, independent of the active overlay selection. The `O` key continues cycling detailed overlays (economic, magic, ecology) which render on top.

### Settlement Marker Differentiation

Make settlement tiers visually distinct at a glance:
- **Camp**: small dot (·)
- **Village**: circle (○)
- **Town**: filled circle (●)
- **City**: square (■)
- **Capital**: star (★) with faction color glow

### Infrastructure Layer

As civilizations grow, the map accumulates visual evidence of their history. Infrastructure renders as persistent terrain modifications.

**Trade Roads**: The EconomicSystem tracks trade partnerships. When two settlements maintain active trade, a road path appears connecting them — rendered as dotted line (`···`) along the shortest terrain-passable route. Roads thicken (solid `───`) as trade volume increases over years. Abandoned routes gradually fade.

**Bridges**: When a road crosses a river tile (`tile.riverId`), a bridge marker (`═`) appears. Bridge construction generates a chronicle event. Bridge destruction during war is a military event.

**Fortifications**: Settlements at war or with high military presence grow walls. Towns get wooden palisades (subtle border), cities get stone walls (solid border), capitals get fortified walls with towers. Construction spans multiple ticks, generating chronicle events.

**Landmarks**:
- Temples/Shrines: major religious sites show temple marker (▲)
- Mines: settlements exploiting resource deposits show pick marker at deposit location
- Ruins: abandoned settlements leave crumbling walls and overgrown roads — visible history

**Implementation**: New `Infrastructure` component on site entities tracks built structures. Roads use A* pathfinding between settlement pairs, cached and updated when trade relationships change. The tilemap renderer reads infrastructure data from entity snapshots.

## P3: Narrative Overhaul

Chronicle/historian voice across all templates. Third-person past tense, like a learned historian recording events for posterity.

### Problem Tiers

1. **Broken templates** — literal `{data.settlementName}` appearing (resolution bug, fixed in P1)
2. **Generic fallbacks** — "A significant event occurred in the life of..." (tells nothing)
3. **Mechanical templates** — "With menacing presence at X, X bent Y to her will." (name repetition, no flavor)

### Target Voice

| Current | Target |
|---------|--------|
| "A magical event of note occurred at Brimmegdusta Raidele." | "Brimmegdusta Raidele spent the long winter nights bent over her workbench, weaving enchantments into steel until the blade hummed with purpose." |
| "A religious event of significance occurred, affecting the faithful." | "Word spread through the temple district that the gods had answered — or so the priests claimed." |
| "With menacing presence at Jiao Matsumoto, Jiao Matsumoto bent Wan Ogawatanabe to her will." | "Few dared refuse Jiao Matsumoto. Wan Ogawatanabe, cornered in the market square of Wolfvale, proved no exception." |
| "In the winter of Year 1, exploration frontier discovery." | "Scouts returning from the frontier brought welcome news — rich copper veins lay exposed in the hillsides north of the settlement." |

### Scope

- Rewrite all ~40 generic fallback templates with specific, category-appropriate prose
- Improve existing templates across all 11 template files: add `{#if}` conditional blocks for personality, season, location context
- Add template variants — 3-4 phrasings per event subtype so repeated events don't read identically
- Inspector timeline entries ("Y1 — A significant event occurred...") get the same treatment

### What Doesn't Change

- Template engine (Handlebars-style `{character.name}`, `{#if}` blocks)
- 5 tone system (Epic/Tragic/Hopeful/Dark/Neutral)
- Chronicler bias system

## P4: Legends Filtering

Full filtering suite for the Legends viewer. All filters composable (AND logic).

### Filter Bar

Compact filter strip at the top of the Legends panel, below category tabs.

### Time Period

Two input fields: "From Year ___" / "To Year ___". Typing a year instantly filters. Defaults to full range. Lets players focus on specific eras.

### Entity Involvement

Search-as-you-type text field. Type a character, faction, or site name to filter events involving that entity. Uses existing entity marker data (`[[e:TYPE:ID:NAME]]`) for matching. Clicking an entity name in the list auto-populates this filter.

### Event Category

Extend existing 6 category tabs with multi-select — enable 2-3 categories simultaneously. "All" toggle resets.

### Significance Level

Three toggleable chips: Minor / Moderate / Major. All on by default. Turning off Minor declutters to meaningful events only. Major-only gives a "great events of history" view.

### Implementation

All filtering client-side in `LegendsStore`. Existing `filteredEntries` getter gains additional filter predicates. No IPC changes needed. Filter state persists in `localStorage` per seed (same as favorites).

## Priority Order

1. **P1** — Foundation fixes (unblocks P3, enables race-aware aging)
2. **P2** — Always-on territory + infrastructure (biggest visual impact)
3. **P3** — Narrative overhaul (biggest prose quality impact, depends on P1 template fix)
4. **P4** — Legends filtering (UI enhancement, independent of others)
