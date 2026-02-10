# Chronicle Panel — Electron Implementation Plan

## Context

Phase 9.1-9.2 delivered a solid map renderer with overlays, entity markers, and rich tooltips. The two side panels (Chronicle + Inspector) are empty HTML shells. The Chronicle is the primary story-reading interface — it's where the world comes alive for the player.

## Scope

**Layer 1+2**: Event cards with category badges, significance indicators, temporal headers, Prose mode (with aggregation), Compact mode, entity name links, region filter. EventFormatter-based descriptions (verb patterns), not full NarrativeEngine.

**Deferred**: Story Arcs mode, Domain mode, detail pane, chronicler system, vignettes, NarrativeEngine integration.

## Architecture

```
Main process (simulation-runner.ts)
  │ TickDelta.events: SerializedEvent[]   (already being sent)
  ▼
Renderer process (index.ts)
  │ chronicle.addEvents(delta.events)
  ▼
ChroniclePanel
  ├── EventStore: accumulates events, entity name index
  ├── EventFormatter: verb-pattern descriptions + entity resolution
  ├── EventAggregator: groups low-sig events by category+time (Prose mode)
  ├── ChronicleRenderer: DOM element creation + virtual scroll
  └── FilterState: category toggles, min significance, region filter
```

No new IPC channels. TickDelta already carries all needed data.

## New Files

```
packages/electron/src/renderer/chronicle/
  ├── chronicle-panel.ts     — Panel controller (modes, scroll, selection)
  ├── event-store.ts         — Event accumulation + entity name index
  ├── event-formatter.ts     — Verb-pattern descriptions + significance labels
  ├── event-aggregator.ts    — Prose-mode grouping (sig<60 by category+time)
  └── chronicle-renderer.ts  — DOM element creation + virtual scroll
packages/electron/src/styles/
  └── chronicle.css          — Event cards, badges, headers, mode tabs
```

## Step 1: Event Store + Formatter

### event-store.ts (~80 lines)

```typescript
export class EventStore {
  private events: SerializedEvent[] = [];
  private entityNames = new Map<number, string>();
  private readonly MAX_EVENTS = 5000;

  addEvents(events: readonly SerializedEvent[]): void
  updateEntityNames(entities: readonly EntitySnapshot[]): void
  getEntityName(id: number): string   // fallback: "Entity #id"
  getAll(): readonly SerializedEvent[]
  getFiltered(filter: ChronicleFilter): readonly SerializedEvent[]
  clear(): void
}

interface ChronicleFilter {
  readonly categories?: ReadonlySet<string>;
  readonly minSignificance?: number;
  readonly regionCenter?: { readonly x: number; readonly y: number };
  readonly regionRadius?: number;
}
```

- Simple FIFO eviction at 5000 events (splice oldest)
- Entity names from EntitySnapshot.name + EntitySnapshot.id mapping
- Region filter: check participant entity positions within Manhattan distance

### event-formatter.ts (~150 lines)

```typescript
interface FormattedEvent {
  readonly title: string;
  readonly description: string;
  readonly icon: string;          // Unicode category icon
  readonly categoryColor: string; // hex
  readonly significanceTier: SignificanceTier;
  readonly timestamp: string;     // "Year 3, Day 45"
  readonly entityIds: readonly number[];  // for clickable links
}

type SignificanceTier = 'trivial' | 'minor' | 'moderate' | 'major' | 'critical' | 'legendary';

function formatEvent(event: SerializedEvent, getName: (id: number) => string): FormattedEvent
function getSignificanceTier(sig: number): SignificanceTier
```

Port from blessed `event-formatter.ts`:
- `SUBTYPE_VERB_MAP`: ~40 entries mapping subtypes to verb patterns with `{0}`, `{1}` placeholders
- `CATEGORY_ICONS`: Political ⚜, Military ⚔, Economic ⛃, etc.
- `CATEGORY_COLORS`: map of category → hex color string
- `SIGNIFICANCE_TIERS`: thresholds and tier metadata

Formatting fallback chain:
1. SUBTYPE_VERB_MAP lookup → substitute participant names
2. event.data.description field (if present)
3. Humanize subtype: "culture.technology_invented" → "Technology invented"

### Verify Step 1

Import EventStore + EventFormatter in renderer/index.ts. Log formatted events to console on each tick delta. Confirm entity names resolve correctly.

## Step 2: Event Aggregator

### event-aggregator.ts (~120 lines)

```typescript
type ChronicleEntry =
  | { readonly kind: 'event'; readonly event: SerializedEvent; readonly formatted: FormattedEvent }
  | { readonly kind: 'aggregate'; readonly category: string; readonly count: number;
      readonly theme: string; readonly significance: number; readonly tick: number;
      readonly eventIds: readonly number[] }
  | { readonly kind: 'header'; readonly text: string; readonly tick: number };

function aggregateEvents(
  events: readonly SerializedEvent[],
  getName: (id: number) => string,
  timeWindow?: number,  // default 30
): readonly ChronicleEntry[]
```

Algorithm:
1. Separate: significance >= 60 → standalone event entries
2. Group sig < 60 by: `(category, primaryParticipant, Math.floor(tick / 30))`
3. Groups of 2+ events → aggregate entries with category-specific themes
4. Singles from groups → regular event entries
5. Merge all chronologically by tick
6. Insert temporal headers at year/month boundaries

Aggregate theme templates (AGGREGATION_THEMES):
- Military: "Steel rang as {count} skirmishes unfolded"
- Economic: "{count} trade deals shaped the realm's markets"
- Cultural: "{count} cultural developments emerged"
- Political: "{count} political maneuvers shifted the balance"
- Religious: "{count} religious events stirred the faithful"
- etc.

Temporal headers:
- Year boundary: "Year N" (display font, uppercase)
- Month boundary: "Season, Month N" (1-3=Winter, 4-6=Spring, 7-9=Summer, 10-12=Autumn)

### Verify Step 2

Call aggregateEvents() on stored events, log result. Confirm: high-sig events standalone, low-sig grouped, temporal headers present at boundaries.

## Step 3: Chronicle Renderer + Virtual Scroll

### chronicle-renderer.ts (~200 lines)

```typescript
export class ChronicleRenderer {
  constructor(container: HTMLElement)

  render(entries: readonly ChronicleEntry[], mode: 'prose' | 'compact'): void
  scrollToBottom(): void
  isAtBottom(): boolean
  destroy(): void

  onEntityClick: ((entityId: number) => void) | null;
}
```

**Virtual scroll implementation:**
- Fixed heights per entry kind: header=36px, aggregate=52px, event(prose)=80px, event(compact)=28px
- Pre-compute cumulative heights array
- On scroll event: binary search for first visible index
- Render visible entries + 10 buffer above/below
- Pool ~50 card DOM elements, reassign content on scroll

**Card DOM structure:**
```html
<div class="event-card" data-event-id="123">
  <div class="event-card__sig" data-tier="major"></div>
  <div class="event-card__badge" style="background: var(--cat-color)">⚜</div>
  <div class="event-card__body">
    <div class="event-card__title">Treaty Signed</div>
    <div class="event-card__desc"><span class="entity-link" data-entity-id="5">House Ashford</span> and...</div>
    <div class="event-card__time">Year 3, Day 45</div>
  </div>
</div>
```

**Entity link clicks:** Event delegation on container, `e.target.closest('.entity-link')`, read `data-entity-id`.

**Auto-scroll:** Track scroll position. If within 50px of bottom, auto-scroll on new entries. Otherwise show "New events" indicator.

### Verify Step 3

Render event cards in the panel. Scroll through events. Click entity names — confirm entityId logged. Verify virtual scroll works at 100+ events.

## Step 4: Chronicle CSS

### chronicle.css (~150 lines)

Port from design doc Section 7:
- `.chronicle-mode-tab` / `.chronicle-mode-tab--active` — tab styling
- `.event-card` — card with category-colored left border
- `.event-card__sig` — significance dot (6 tiers with colors/sizes)
- `.event-card__badge` — 22x22px category icon square
- `.event-card__title` / `__desc` / `__time` — text styling
- `.event-card--aggregated` — dimmer, thinner border
- `.temporal-header` — centered text with decorative lines
- `.entity-link` — clickable entity names (CS blue, dotted underline on hover)
- `.chronicle-new-events` — "New events ↓" indicator

All colors from existing CSS variables in variables.css. No new palette colors.

### Verify Step 4

Visual check: cards have colored left borders, category badges, significance dots. Temporal headers have decorative lines. Entity names are blue and underline on hover.

## Step 5: Panel Controller + Wiring

### chronicle-panel.ts (~100 lines)

```typescript
export class ChroniclePanel {
  constructor(container: HTMLElement)

  addEvents(events: readonly SerializedEvent[]): void
  updateEntityNames(entities: readonly EntitySnapshot[]): void
  setMode(mode: 'prose' | 'compact'): void
  cycleMode(): void
  setRegionFilter(center: { x: number; y: number } | null): void
  toggleRegionFilter(viewportCenter: { x: number; y: number }): void
  destroy(): void
}
```

Wires: EventStore → EventFormatter → EventAggregator → ChronicleRenderer

Mode tab UI: Two buttons in panel titlebar area (Prose | Compact), styled per design doc.

### renderer/index.ts changes

- Import and instantiate ChroniclePanel
- Wire `handleTickDelta` to feed events and entity updates
- Add keyboard handlers: 'N' for mode cycle, 'R' for region filter
- Update HTML: replace placeholder content with mode tabs

### index.html changes

Update `#event-log-panel` structure:
```html
<div class="panel" id="event-log-panel">
  <div class="panel-titlebar">
    <span>Chronicle</span>
    <div class="chronicle-mode-tabs">
      <button class="chronicle-mode-tab chronicle-mode-tab--active" data-mode="prose">Prose</button>
      <button class="chronicle-mode-tab" data-mode="compact">Compact</button>
    </div>
  </div>
  <div class="panel-content" id="chronicle-content"></div>
</div>
```

### Verify Step 5

- Run simulation. Events appear in Chronicle panel as styled cards.
- Press N to switch between Prose and Compact modes.
- Press R to toggle region filter.
- Scroll through events. Auto-scroll works when at bottom.
- Entity names are clickable (logs entity ID for now).

## Step 6: Import Existing Data

### Port from blessed event-formatter.ts

Read `packages/renderer/src/panels/event-formatter.ts` and port:
- SUBTYPE_VERB_MAP (~40 entries)
- CATEGORY_ICONS mapping
- SHORT_NARRATIVE_MAP (for compact mode titles)

### Port from blessed event-aggregator.ts

Read `packages/renderer/src/panels/event-aggregator.ts` and port:
- AGGREGATION_PROSE templates
- CATEGORY_THEME_MAP
- Grouping algorithm

These are pure data + string operations — direct port with TypeScript strict mode adjustments.

## Future: NarrativeEngine Integration

**Best integration point: after Inspector panel (Phase 4) is complete.**

At that point both panels share entity resolution, and the narrative pipeline has a natural home:

1. Main process imports `@fws/narrative` (NarrativeEngine, Chronicler, BiasFilter)
2. During `emitTickDelta()`, generate narrative prose for significant events (sig >= 60)
3. Add `narrative?: { title: string; body: string; tone: string }` to `SerializedEvent`
4. Chronicle renderer checks for `.narrative` field — uses rich prose when available, falls back to EventFormatter
5. Later: add chronicler cycling (H key), tone cycling (T key), and "Other perspectives" section

This keeps the NarrativeEngine on the main process (full World access), sends pre-rendered prose over IPC, and requires zero renderer-side narrative logic.

## Dependency Graph

```
Step 1 (Store + Formatter) ──→ Step 2 (Aggregator) ──→ Step 3 (Renderer)
                                                              │
Step 4 (CSS) ─── can parallelize with Steps 1-3 ─────────────┤
                                                              ▼
                                                    Step 5 (Wiring)
                                                              │
Step 6 (Port data) ── can parallelize with Steps 3-5 ────────┘
```

Steps 1→2→3→5 are sequential. Steps 4 and 6 can parallelize.

## Verification

1. `pnpm run typecheck` — 0 errors
2. `pnpm run test` — all 2909 tests pass
3. `pnpm run start:electron` — app launches, Chronicle panel renders events
4. Run simulation for 1 in-game year — events accumulate, scroll works
5. Prose mode: low-sig events aggregated, temporal headers present
6. Compact mode: one line per event, fast scroll
7. Region filter: press R, only nearby events shown
8. Entity names clickable, significance dots colored correctly
