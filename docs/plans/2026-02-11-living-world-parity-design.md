# Phase 11: Living World — Electron/CLI Parity

**Status:** Proposed
**Priority:** #1 — Blocking all further feature work
**Branch:** `feature/phase-11-living-world`
**Prerequisite:** Phase 10 (merged)

---

## Problem Statement

The Electron frontend produces bland, generic output because three major subsystems were never wired in:

1. **The `@fws/narrative` package is completely absent from Electron.** Zero imports. The Electron chronicle reimplemented event formatting with two static lookup tables (~70 entries each) producing the same sentence every time a subtype fires. The CLI uses the full 281-template narrative engine with 5 tones, chronicler bias, vignettes, and entity resolution.

2. **`populate-world.ts` drops most generator data.** The bridge creates minimal ECS components — enough for simulation systems, not enough for display. Characters lose attributes, skills, relationships, goals, memories, beliefs, possessions, health, and reputations. Factions lose their names (no Status component), race, and religion. Settlements lose demographics, culture, and type.

3. **The chronicle renderer has structural performance issues** — O(n log n) re-aggregation of all events every frame, full DOM teardown per render, layout thrashing — causing visual bugs at speed.

### Visible Symptoms

| Symptom | Root Cause |
|---------|-----------|
| "character negotiate treaty" instead of prose | No narrative engine in Electron |
| "Faction #2", "#2" in inspectors | Factions missing Status component |
| "No demographic data available" for towns | No PopulationDemographics component |
| Empty character inspector sections | No Attribute/Personality/Health/Skill/Goal |
| Characters not detected as characters in snapshots | Snapshot checks `Allegiance` not `Membership` |
| Identical text for same event type | Static lookup table, no template variation |
| Chronicle bugs out at speed | O(n log n) full rebuild per frame |
| "Political currents shifted as 2 events unfolded 2" | Duplicate count in aggregate cards |

---

## Priority 1: Narrative Engine Integration

### Architecture Decision

The narrative engine is a **formatting layer**, not simulation logic. In the CLI, it runs in the renderer process (EventLogPanel creates NarrativeEngine). For Electron, we have two options:

**Option A — Main process generates prose, IPC carries it (Recommended)**
- NarrativeEngine + EntityResolver live in main process alongside SimulationRunner
- `SerializedEvent` gains `narrativeTitle` and `narrativeBody` fields
- Renderer displays pre-generated prose
- Pros: Single source of truth, EntityResolver has direct World access, no duplicate engine
- Cons: Slightly larger IPC payloads

**Option B — Renderer process has its own NarrativeEngine**
- Import @fws/narrative in renderer via Vite bundle
- EntityResolver built from snapshot data
- Pros: Decoupled from main process
- Cons: EntityResolver lacks World access (can't resolve runtime entities like armies/artifacts), duplicates engine, bundle size increases ~50KB

**Decision: Option A.** The EntityResolver needs World access for runtime entity resolution, which only the main process has.

### Changes

**`packages/electron/src/main/simulation-runner.ts`**
- Import `createDefaultNarrativeEngine`, `EntityResolver`, `NarrativeTone` from `@fws/narrative`
- Build EntityResolver from generatedData + World (port CLI's `buildEntityResolver()` pattern)
- Create NarrativeEngine in `initialize()`
- In `serializeEvents()`: call `engine.render(event, resolver)` per event; attach `narrativeTitle` + `narrativeBody` to SerializedEvent
- Add IPC handler for tone cycling (renderer can request tone change)

**`packages/electron/src/shared/types.ts`**
- Extend `SerializedEvent`:
  ```typescript
  readonly narrativeTitle: string;
  readonly narrativeBody: string;
  readonly tone: string;
  ```

**`packages/electron/src/renderer/chronicle/event-formatter.ts`**
- Replace `SUBTYPE_VERB_MAP` / `SHORT_NARRATIVE_MAP` lookup tables with direct use of `narrativeTitle` and `narrativeBody` from the SerializedEvent
- Keep category icons and colors (those are renderer concerns)
- `formatEvent()` becomes a thin pass-through instead of a template engine

**`packages/electron/src/main/inspectors/shared.ts`**
- `eventDescription()`: use narrative engine to generate prose instead of falling back to `subtype.replace(/[._]/g, ' ')`
- Character "Story So Far" uses narrative prose per event

### EntityResolver Specification

Port from CLI `buildEntityResolver()` (packages/cli/src/index.ts lines 144-230):

```typescript
function buildEntityResolver(
  generatedData: GeneratedWorld,
  populationResult: PopulationResult,
  world: World
): EntityResolver
```

Static maps populated at init:
- **Characters**: from `generatedData.rulers` + `generatedData.notables` → name, title, gender
- **Factions**: from `generatedData.factions` → name
- **Sites**: from `generatedData.settlements` → name
- **Deities**: from `generatedData.pantheon.gods` → name, title

Runtime fallback: read Status component from World for entities created during simulation (armies, institutions, artifacts).

### Risk: Low-Medium
The CLI proves this works. Main risk: IPC payload size increase from prose strings. Mitigated by prose being short (typically < 200 chars per event).

---

## Priority 2: Entity Bridge Completion

### Problem

`populate-world.ts` creates entities with minimal components. The generator produces rich data that is discarded at the bridge layer.

### Data Currently Dropped

**Characters** (15 fields dropped):
- `gender`, `age`, `raceName` — identity
- `attributes` (STR/AGI/END/INT/WIS/CHA) — abilities
- `skills` (10+ skill types) — competencies
- `personality` (18 OCEAN traits) — stored as Traits but not as Personality component
- `relationships` (ally/rival/spouse/parent/etc.) — social graph
- `goals` (with priority) — motivation
- `memories` (with emotional weight) — backstory
- `beliefs` (with strength) — worldview
- `possessions` (weapon/armor/artifact/gold) — inventory
- `reputations` (per-faction standing) — political standing
- `health` (current/max/conditions) — physical state

**Factions** (4 fields dropped):
- `name` — no Status component (most critical gap)
- `primaryRace` — racial identity
- `religion` — theological alignment
- `color` — visual identity

**Settlements** (3 fields dropped):
- `dominantRace` — demographics
- `type` (city/town/village) — scale classification
- `nearRuin` — historical context

### Changes

**`packages/generator/src/integration/populate-world.ts`**

Add components to `populateFactions()`:
```
Status          { titles: [faction.name], socialClass: 'faction' }
```

Add components to `populateSettlements()`:
```
PopulationDemographics  { raceDistribution: Map([[dominantRace, population]]) }
```

Add components to `populateCharacters()`:
```
Attribute       { strength, agility, endurance, intelligence, wisdom, charisma }
Personality     { openness, conscientiousness, extraversion, agreeableness, neuroticism }
Health          { current, max, conditions }
Skill           { skills: Map }
Relationship    { relationships: [] }  (seed from generator relationships)
Goal            { goals: [] }          (seed from generator goals)
```

**`packages/electron/src/main/simulation-runner.ts`**
- `buildEntitySnapshots()`: check `Membership` instead of `Allegiance` for character faction detection

### Component Type Verification

Before adding components, verify each ComponentType discriminant exists in `packages/core/src/ecs/component.ts`. Known to exist: Attribute, Personality, Health, Skill, Relationship, Goal, PopulationDemographics, Status. Need to verify: exact field shapes match what the generator produces.

### Risk: Low
Pure data plumbing. No behavioral change. The simulation systems already handle these components when present — they were just never populated from the generator.

---

## Priority 3: Chronicle Performance

### Problem

The chronicle renderer has structural performance issues that cause visual bugs at speed:

1. **O(n log n) full re-aggregation** of ALL events (up to 5000) on every frame
2. **Full DOM teardown** — `innerHTML = ''` on every visible card every frame
3. **Layout thrashing** — read scrollHeight → write height → read scrollTop (forces sync reflow)
4. **Aggregation instability** — trimming old events changes aggregate groups, shifting scroll
5. **No scroll handler throttle** — updateVisibleCards fires on every scroll event
6. **No IPC batching** — one IPC message per tick at high speed

### Changes

**Incremental Entry Pipeline** (`chronicle-panel.ts`, `event-aggregator.ts`):
- Track `lastProcessedIndex` in EventStore
- On refresh, only process events from `lastProcessedIndex` to end
- New events either append to existing aggregate groups or create new entries
- Only re-aggregate the time window affected by new events, not all 5000
- Cache `FormattedEvent` results — same event ID always produces same formatted output

**Stable Virtual Scroll** (`chronicle-renderer.ts`):
- Track visible range `[startIdx, endIdx]` between renders
- On render: diff new range against old range. Only create/destroy cards that enter/leave viewport
- `populateCard()` only called for cards entering the viewport, not all visible cards
- Add `isUpdating` guard (already partially done) to prevent scroll handler re-entrance

**Layout Thrashing Fix** (`chronicle-renderer.ts`):
- Batch all reads before all writes:
  ```
  // READ phase
  const wasAtBottom = this.isAtBottom();
  const scrollTop = this.scrollContainer.scrollTop;
  // WRITE phase
  this.contentDiv.style.height = `${total}px`;
  // ... then updateVisibleCards
  ```

**Scroll Handler Throttle** (`chronicle-renderer.ts`):
- Gate handleScroll through `requestAnimationFrame`
- Only one updateVisibleCards per frame during scroll

**IPC Batching** (`simulation-runner.ts`):
- At 365x speed: run multiple `engine.run(1)` per setInterval (e.g. 6 ticks per 16ms)
- Accumulate events across batch, emit single TickDelta with combined events
- Reduces IPC overhead from ~60 messages/sec to ~10 messages/sec at high speed

**Ring Buffer for Event Store** (`event-store.ts`):
- Replace array + splice with ring buffer
- Avoids O(n) copy when trimming oldest events
- Stable indices for aggregation

### Risk: Medium
Performance refactoring with behavioral invariants to preserve (scroll position, entry ordering, mode switching). Requires careful testing. The incremental aggregation is the most complex change — must handle edge cases where new events join existing aggregate groups.

---

## Priority 4: Quick Inspector Fixes

These are small fixes that fall out of P1 and P2 but are listed for completeness:

1. **Faction name resolution** — After P2 adds Status to factions, `resolveName()` in shared.ts works automatically
2. **Character type detection** — After P2 adds Personality/Attribute, snapshot `buildEntitySnapshots()` detects characters. Also fix `Allegiance` → `Membership` check
3. **Demographics display** — After P2 adds PopulationDemographics, site inspector shows race data
4. **Event description prose** — After P1 provides narrative engine access, `eventDescription()` uses prose instead of raw subtype strings
5. **Aggregate card count** — Already fixed (removed duplicate `__count` span)
6. **Aggregate card clicks** — Already fixed (click inspects first constituent event)
7. **Chronicle tab layout** — Already fixed (CSS grid-template-areas for view--chronicle)

---

## Implementation Order

```
P2 (Entity Bridge)  ──→  P1 (Narrative Engine)  ──→  P4 (Inspector Fixes)
                                                            │
P3 (Chronicle Perf)  ────────────────────────────────────────┘
```

P2 before P1 because the EntityResolver needs complete ECS data to resolve names. P3 is independent and can be done in parallel. P4 is mostly automatic once P1+P2 land.

### Estimated Scope

| Priority | Files Modified | New Files | Complexity |
|----------|---------------|-----------|------------|
| P1 | 4 | 0 | Medium (port from CLI + IPC extension) |
| P2 | 2 | 0 | Low (data plumbing, generator types → ECS components) |
| P3 | 4 | 0 | Medium-High (incremental aggregation, virtual scroll diff) |
| P4 | 2 | 0 | Low (component name fixes, fallthrough updates) |

### Validation

- All 2923+ existing tests must pass (no behavioral changes to simulation)
- Typecheck clean across all 6 packages
- Manual verification: launch Electron, let simulation run to Year 5, verify:
  - Chronicle shows varied narrative prose (not static lookup text)
  - Inspector shows real faction names, character attributes, settlement demographics
  - Character "Story So Far" uses narrative prose
  - Chronicle handles 365x speed without visual bugs
  - Chronicle tab shows full-width panel (not black screen)
  - Aggregate cards show correct count (no duplication)

---

## Excluded from This Phase

- **Chronicler bias system** — Adds factional perspective to narration. Valuable but not parity-critical. The CLI's EventLogPanel doesn't use it either (it's in the chronicler module but not wired to the main display).
- **Vignette generation** — Literary vignettes for high-significance events. Nice-to-have, not blocking parity.
- **Tone cycling UI** — The infrastructure for tone selection will be in place (IPC handler), but the UI button/shortcut is deferred.
- **Additional character components** (Memories, Beliefs, Possessions, Reputations) — These require simulation system changes to produce/consume. Bridge only what simulation systems currently read.
