# Phase 13: Living Population — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add character-driven population simulation with birth/death/migration, settlement lifecycle (founding → growth → abandonment → ruins), and an ExplorationSystem that fills the empty Exploratory event category.

**Architecture:** Three new systems (PopulationSystem, SettlementLifecycleSystem, ExplorationSystem) following the Phase 3 internal Maps pattern. Non-notable characters are lightweight ECS entities (~30/settlement) that can be promoted to full notables via a Notability score. All existing systems emit demographic signals; PopulationSystem is the single writer to population data. ExecutionOrder re-scaled to 10x multiples to accommodate insertions.

**Tech Stack:** TypeScript strict mode, Vitest, ESM with .js extensions, branded types, EventBus pub/sub, PixiJS + HTML/CSS (Electron renderer)

**Design doc:** `docs/plans/2026-02-11-phase13-living-population-design.md`

**Working directory:** `.worktrees/phase-13-living-population`

---

## Priority 1: Non-Notable Character Infrastructure

### Task 1: Re-scale ExecutionOrder for new system slots

**Files:**
- Modify: `packages/core/src/engine/system.ts:14-28`
- Modify: test files that assert on specific order values (if any)

**Step 1: Update ExecutionOrder values**

Change `ExecutionOrder` const to 10x multiples with 3 new slots:

```typescript
export const ExecutionOrder = {
  TIME_ADVANCE: 10,
  ENVIRONMENT: 20,
  ECONOMY: 30,
  POPULATION: 35,           // NEW
  POLITICS: 40,
  SETTLEMENT_LIFECYCLE: 45, // NEW
  SOCIAL: 50,
  CHARACTER_AI: 60,
  EXPLORATION: 65,          // NEW
  MAGIC: 70,
  RELIGION: 80,
  MILITARY: 90,
  EVENT_RESOLUTION: 100,
  NARRATIVE_GENERATION: 110,
  CLEANUP_INDEXING: 120,
  PLAYER_NOTIFICATION: 130,
} as const;
```

All existing systems reference `ExecutionOrder.ECONOMY` etc. so they auto-update. The `ExecutionOrderValue` type expands automatically from `as const`.

**Step 2: Run typecheck to verify no breakage**

```bash
cd .worktrees/phase-13-living-population && pnpm run typecheck
```

If any test asserts literal order values (e.g., `expect(system.executionOrder).toBe(3)`), update those assertions.

**Step 3: Run tests**

```bash
pnpm run test
```

**Step 4: Commit**

```bash
git add packages/core/src/engine/system.ts
git commit -m "refactor: re-scale ExecutionOrder to 10x multiples for new system slots"
```

---

### Task 2: Add new component types

**Files:**
- Modify: `packages/core/src/ecs/component.ts`
- Modify: `packages/core/src/ecs/index.ts` (exports)

**Context:** The existing `Significance` component (line 91, 619-624) is for artifacts (historicalValue, legendaryStatus). Use `Notability` for non-notable character promotion tracking.

**Step 1: Add 4 new types to ComponentType union**

In `component.ts`, add to the Individual components section (after line 58, `'InterventionHistory'`):

```typescript
  // Population components
  | 'Notability'
  | 'Parentage'
  | 'Deceased'
  | 'HiddenLocation'
```

**Step 2: Add 4 new component interfaces**

After the last interface definition (before the AnyComponent union), add:

```typescript
export interface NotabilityComponent extends Component {
  readonly type: 'Notability';
  score: number;
  sparkHistory: Array<{ tick: number; description: string }>;
}

export interface ParentageComponent extends Component {
  readonly type: 'Parentage';
  motherId: number | null;
  fatherId: number | null;
}

export interface DeceasedComponent extends Component {
  readonly type: 'Deceased';
  cause: string;
  tick: number;
  locationId: number;
}

export interface HiddenLocationComponent extends Component {
  readonly type: 'HiddenLocation';
  locationType: 'ruins' | 'resource' | 'magical' | 'lore';
  revealed: boolean;
  revealedTick: number | null;
  x: number;
  y: number;
}
```

**Step 3: Add to AnyComponent union**

```typescript
  | NotabilityComponent
  | ParentageComponent
  | DeceasedComponent
  | HiddenLocationComponent
```

**Step 4: Add to exports in `packages/core/src/ecs/index.ts`**

Add to the type exports section:
```typescript
  NotabilityComponent,
  ParentageComponent,
  DeceasedComponent,
  HiddenLocationComponent,
```

**Step 5: Run typecheck**

```bash
pnpm run typecheck
```

**Step 6: Commit**

```bash
git add packages/core/src/ecs/component.ts packages/core/src/ecs/index.ts
git commit -m "feat: add Notability, Parentage, Deceased, HiddenLocation components"
```

---

### Task 3: Modify Population component to track non-notable entity IDs

**Files:**
- Modify: `packages/core/src/ecs/component.ts` (PopulationComponent)

**Step 1: Find and update PopulationComponent**

The existing PopulationComponent (around line 159-163) has `count` and `growthRate`. Add `nonNotableIds`:

```typescript
export interface PopulationComponent extends Component {
  readonly type: 'Population';
  count: number;
  growthRate: number;
  nonNotableIds: number[];
}
```

**Step 2: Search for all places that create PopulationComponent**

```bash
grep -rn "type: 'Population'" packages/ --include="*.ts" | grep -v test | grep -v node_modules
```

Update each to include `nonNotableIds: []` (or the appropriate initial value). Key files:
- `packages/generator/src/integration/populate-world.ts` — settlement creation
- Any test helpers creating Population components

**Step 3: Run typecheck to find all breakage**

```bash
pnpm run typecheck
```

Fix every error — `exactOptionalPropertyTypes` means you can't leave it undefined; you must provide `nonNotableIds: []`.

**Step 4: Run tests**

```bash
pnpm run test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add nonNotableIds to PopulationComponent"
```

---

### Task 4: Non-notable entity creation utilities

**Files:**
- Create: `packages/core/src/systems/population-utils.ts`
- Create: `packages/core/src/systems/population-utils.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import { World } from '../ecs/world.js';
import { createNonNotable, type NonNotableConfig } from './population-utils.js';

describe('createNonNotable', () => {
  it('creates entity with correct lightweight components', () => {
    const world = new World();
    world.registerComponent('Position');
    world.registerComponent('Status');
    world.registerComponent('Notability');
    world.registerComponent('Parentage');
    world.registerComponent('CreatureType');

    const config: NonNotableConfig = {
      name: 'Ada Smith',
      race: 'Human',
      age: 25,
      profession: 'Blacksmith',
      siteId: 1,
      x: 10,
      y: 20,
      motherId: null,
      fatherId: null,
    };

    const entityId = createNonNotable(world, config);

    const status = world.getComponent(entityId, 'Status');
    expect(status).toBeDefined();
    // status should have name, titles:[], socialClass:'commoner'

    const notability = world.getComponent(entityId, 'Notability');
    expect(notability).toBeDefined();
    expect(notability.score).toBe(0);
    expect(notability.sparkHistory).toEqual([]);

    const parentage = world.getComponent(entityId, 'Parentage');
    expect(parentage).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/core/src/systems/population-utils.test.ts
```

**Step 3: Implement createNonNotable**

```typescript
import type { EntityId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';

export interface NonNotableConfig {
  name: string;
  race: string;
  age: number;
  profession: string;
  siteId: number;
  x: number;
  y: number;
  motherId: number | null;
  fatherId: number | null;
}

export function createNonNotable(world: World, config: NonNotableConfig): EntityId {
  const entityId = world.createEntity();

  world.addComponent(entityId, {
    type: 'Position',
    x: config.x,
    y: config.y,
  });

  world.addComponent(entityId, {
    type: 'Status',
    name: config.name,
    titles: [],
    socialClass: 'commoner',
    age: config.age,
    race: config.race,
    profession: config.profession,
  });

  world.addComponent(entityId, {
    type: 'CreatureType',
    species: config.race,
    subtype: 'commoner',
  });

  world.addComponent(entityId, {
    type: 'Notability',
    score: 0,
    sparkHistory: [],
  });

  world.addComponent(entityId, {
    type: 'Parentage',
    motherId: config.motherId,
    fatherId: config.fatherId,
  });

  return entityId;
}
```

Note: Check the exact fields of `StatusComponent` and `CreatureTypeComponent` in `component.ts` before implementing. Match whatever fields exist. Use `@ts-nocheck` only if following the existing pattern for cross-package files.

**Step 4: Run test**

```bash
pnpm vitest run packages/core/src/systems/population-utils.test.ts
```

**Step 5: Export from core index**

Add to `packages/core/src/index.ts`:
```typescript
export { createNonNotable, type NonNotableConfig } from './systems/population-utils.js';
```

**Step 6: Commit**

```bash
git add packages/core/src/systems/population-utils.ts packages/core/src/systems/population-utils.test.ts packages/core/src/index.ts
git commit -m "feat: add createNonNotable utility for lightweight character entities"
```

---

### Task 5: Seed non-notables during world generation

**Files:**
- Modify: `packages/generator/src/integration/populate-world.ts`
- Modify: `packages/generator/src/integration/smoke-test.test.ts`

**Step 1: Add non-notable seeding to populateWorldFromGenerated**

After settlements are created (in the settlement creation loop), for each settlement:
1. Determine soft cap based on population count (~30, or fewer for tiny settlements)
2. Generate non-notable entities using NameGenerator
3. Assign race from settlement demographics
4. Assign age (random distribution by race lifespan)
5. Assign profession (varied: farmer, smith, merchant, soldier, scholar, priest, etc.)
6. Add entity IDs to the settlement's `Population.nonNotableIds`

**Key pattern:** Follow the existing two-pass approach — create entities first, then resolve relationships.

**Step 2: Update smoke test assertions**

The smoke test logs "Settlements: 40 entities", "Characters: 15 entities". After this change, there will be many more entities. Update the assertion to count non-notables:

```typescript
it('populates non-notables for each settlement', () => {
  let totalNonNotables = 0;
  for (const [, siteId] of result.settlementIds) {
    const pop = ecsWorld.getComponent(siteId, 'Population');
    totalNonNotables += pop.nonNotableIds.length;
  }
  expect(totalNonNotables).toBeGreaterThan(100); // ~30 per settlement × 40 settlements
});
```

**Step 3: Run tests**

```bash
pnpm vitest run packages/generator/src/integration/smoke-test.test.ts
```

**Step 4: Commit**

```bash
git add packages/generator/src/integration/populate-world.ts packages/generator/src/integration/smoke-test.test.ts
git commit -m "feat: seed non-notable characters during world generation"
```

---

### Task 6: Rebuild core & generator packages

**Step 1: Rebuild**

```bash
pnpm --filter @fws/core run build && pnpm --filter @fws/generator run build
```

**Step 2: Full typecheck and test**

```bash
pnpm run typecheck && pnpm run test
```

**Step 3: Commit if any build artifacts changed**

---

## Priority 2: PopulationSystem

### Task 7: PopulationSystem skeleton

**Files:**
- Create: `packages/core/src/systems/population-system.ts`
- Create: `packages/core/src/systems/population-system.test.ts`

**Step 1: Write basic test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { PopulationSystem } from './population-system.js';
import { SeededRNG } from '../utils/seeded-rng.js';

describe('PopulationSystem', () => {
  let world: World;
  let clock: WorldClock;
  let events: EventBus;
  let system: PopulationSystem;

  beforeEach(() => {
    world = new World();
    world.registerComponent('Population');
    world.registerComponent('Status');
    world.registerComponent('Notability');
    world.registerComponent('Parentage');
    world.registerComponent('Deceased');
    world.registerComponent('Position');
    world.registerComponent('CreatureType');
    world.registerComponent('Health');
    clock = new WorldClock();
    events = new EventBus();
    system = new PopulationSystem(new SeededRNG(42).fork('population'));
  });

  it('has correct system properties', () => {
    expect(system.name).toBe('PopulationSystem');
    expect(system.frequency).toBe(30); // Monthly
    expect(system.executionOrder).toBe(35); // After Economy
  });

  it('initializes without errors', () => {
    system.initialize(world);
    expect(system.isInitialized()).toBe(true);
  });
});
```

**Step 2: Implement skeleton**

```typescript
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { TickFrequency } from '../time/types.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { SeededRNG } from '../utils/seeded-rng.js';

export class PopulationSystem extends BaseSystem {
  readonly name = 'PopulationSystem';
  readonly frequency = TickFrequency.Monthly;
  readonly executionOrder = ExecutionOrder.POPULATION;

  // Internal Maps (Phase 3 pattern)
  private settlementPopulations: Map<number, number[]> = new Map();

  constructor(private readonly rng: SeededRNG) {
    super();
  }

  override initialize(world: World): void {
    super.initialize(world);
    this.loadSettlementData(world);
  }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    this.processAging(world, clock, events);
    this.processNaturalDeath(world, clock, events);
    this.processBirths(world, clock, events);
    this.processSparks(world, clock, events);
  }

  private loadSettlementData(world: World): void {
    // Load settlement → non-notable ID mappings from Population components
  }

  private processAging(_world: World, _clock: WorldClock, _events: EventBus): void {}
  private processNaturalDeath(_world: World, _clock: WorldClock, _events: EventBus): void {}
  private processBirths(_world: World, _clock: WorldClock, _events: EventBus): void {}
  private processSparks(_world: World, _clock: WorldClock, _events: EventBus): void {}
}
```

**Step 3: Run test, verify pass**

**Step 4: Export from core index and add to engine factory**

In `engine-factory.ts`, import and register:
```typescript
import { PopulationSystem } from '../systems/population-system.js';
// ...
systemRegistry.register(new PopulationSystem(rng.fork('population')));
```

**Step 5: Commit**

```bash
git commit -m "feat: add PopulationSystem skeleton with Monthly frequency"
```

---

### Task 8: Aging mechanics

**Files:**
- Modify: `packages/core/src/systems/population-system.ts`
- Modify: `packages/core/src/systems/population-system.test.ts`

**Step 1: Write aging test**

Test that after a Monthly tick, all non-notable characters age by 1 month (approximately). Since 1 tick = 1 day and Monthly = 30 ticks, each execute call ages characters by ~1 month. Age is stored in the Status component. Decide on age unit (years, stored as decimal? integer years incremented annually?).

Design decision: Store age as integer years in Status. Track `birthTick` in a new field or use `Notability.sparkHistory` first entry. Simplest: add a `birthTick: number` field to the non-notable's status tracking so we can compute age from `(currentTick - birthTick) / 360`.

Alternative: Track age directly, increment it when `currentTick % 360 === birthDay`. For simplicity, use the `processAging` method to check if any non-notable has crossed a year boundary since last execution.

Test:
```typescript
it('ages non-notables by checking year boundaries', () => {
  // Create settlement with non-notable at age 25
  // Advance clock to cross a year boundary (tick 360)
  // Execute system
  // Verify age incremented
});
```

**Step 2: Implement processAging**

For each settlement's non-notables:
1. Read Status component (has `age` field)
2. Check if current tick crosses a year boundary for this character
3. If so, increment age
4. If age exceeds race lifespan threshold, flag for natural death check

Need a race → lifespan lookup table. Add to population-utils.ts:
```typescript
export const RACE_LIFESPANS: Record<string, { expected: number; maximum: number }> = {
  Human: { expected: 70, maximum: 100 },
  Elf: { expected: 500, maximum: 800 },
  Dwarf: { expected: 200, maximum: 350 },
  // ... match races from generator
};
```

Check `packages/generator/src/races/` for actual race definitions and lifespans.

**Step 3: Run tests, commit**

```bash
git commit -m "feat: PopulationSystem aging mechanics with race lifespan tables"
```

---

### Task 9: Natural death mechanics

**Files:**
- Modify: `packages/core/src/systems/population-system.ts`
- Modify: `packages/core/src/systems/population-system.test.ts`

**Step 1: Write death test**

```typescript
it('kills elderly non-notables with increasing probability', () => {
  // Create non-notable at age 95 (human expected lifespan 70)
  // Execute multiple monthly ticks
  // Verify character eventually gets Deceased component
  // Verify character removed from settlement's nonNotableIds
  // Verify death event emitted
});

it('preserves deceased entity in ECS (not deleted)', () => {
  // Kill a character
  // Verify entity still exists in world
  // Verify has Deceased component with cause, tick, locationId
  // Verify does NOT have Position component anymore (removed from active)
});
```

**Step 2: Implement processNaturalDeath**

For each settlement's non-notables:
1. Get age and race
2. Calculate death probability: 0 if age < expected lifespan, then increasing probability approaching maximum lifespan
3. Use `this.rng.next()` to roll against probability
4. If death: add `Deceased` component, remove from `Population.nonNotableIds`, emit `Personal` event with subtype `population.natural_death`

**Step 3: Run tests, commit**

```bash
git commit -m "feat: PopulationSystem natural death with race-based lifespan curves"
```

---

### Task 10: Birth mechanics

**Files:**
- Modify: `packages/core/src/systems/population-system.ts`
- Modify: `packages/core/src/systems/population-system.test.ts`

**Step 1: Write birth test**

```typescript
it('generates births based on settlement prosperity and safety', () => {
  // Create settlement with 30 non-notables, no active threats
  // Execute monthly tick
  // Verify 0-2 new non-notables created (probabilistic, use seeded RNG)
  // Verify new entities have age 0, parents from existing non-notables
});

it('assigns parents from existing non-notable pool', () => {
  // Create settlement with mixed-gender non-notables
  // Generate birth
  // Verify Parentage component has valid motherId and fatherId
});
```

**Step 2: Implement processBirths**

For each settlement:
1. Calculate birth rate from: base rate, economy component (prosperity), safety (no war events), current population vs. comfort threshold
2. Generate 0-N births per monthly tick (Poisson-like distribution using RNG)
3. For each birth: pick parents from non-notables, generate name using NameGenerator, create entity via `createNonNotable`, add to settlement's `nonNotableIds`

**Note:** Need access to NameGenerator in PopulationSystem. Either pass it in constructor or create a simple name generation function. Check how the generator package exports NameGenerator.

**Step 3: Run tests, commit**

```bash
git commit -m "feat: PopulationSystem birth mechanics with parent assignment"
```

---

### Task 11: Spark micro-events

**Files:**
- Modify: `packages/core/src/systems/population-system.ts`
- Modify: `packages/core/src/systems/population-system.test.ts`

**Step 1: Write spark test**

```typescript
it('occasionally generates spark events that increase Notability', () => {
  // Create settlement with 30 non-notables
  // Execute 12 monthly ticks (1 year)
  // With ~1-3% chance per character per month, expect some sparks
  // Verify at least one Notability.score > 0
  // Verify sparkHistory has entries
});
```

**Step 2: Implement processSparks**

Define spark types:
```typescript
const SPARK_TYPES = [
  { description: 'had a vivid prophetic dream', points: 8 },
  { description: 'displayed unusual talent', points: 12 },
  { description: 'survived a close brush with danger', points: 15 },
  { description: 'made a shrewd trade', points: 7 },
  { description: 'showed unexpected courage', points: 10 },
  { description: 'discovered a hidden skill', points: 11 },
  { description: 'earned respect through hard work', points: 6 },
  { description: 'witnessed something extraordinary', points: 9 },
];
```

For each non-notable: roll `rng.next()`, if < 0.02 (2%), pick random spark, add to sparkHistory, increment score.

**Step 3: Run tests, commit**

```bash
git commit -m "feat: PopulationSystem spark micro-events for Notability accumulation"
```

---

## Priority 3: Promotion System

### Task 12: Notability threshold detection and promotion

**Files:**
- Modify: `packages/core/src/systems/population-system.ts`
- Create: `packages/core/src/systems/promotion.ts`
- Create: `packages/core/src/systems/promotion.test.ts`

**Step 1: Write promotion test**

```typescript
it('promotes non-notable to full notable when Notability reaches 100', () => {
  // Create non-notable with Notability.score = 99
  // Add a spark that pushes score to 105
  // Verify entity gains: Personality, Goal, Memory components
  // Verify entity retains: Status, Position, Parentage, Notability
  // Verify Personality values are seeded from life history
});

it('emits promotion event with narrative potential', () => {
  // Promote a character
  // Verify event emitted with category Personal, subtype 'population.promotion'
  // Verify event.data includes character name, backstory summary
});

it('never demotes a promoted character', () => {
  // Promote character, then reduce Notability.score below 100
  // Verify still has full notable components
});
```

**Step 2: Implement promotion logic**

Create `promote()` function in `promotion.ts`:
1. Generate Personality from sparkHistory (plague survivor → high neuroticism, low agreeableness; artisan → high openness, etc.)
2. Generate 1-2 Goals based on profession and experiences
3. Backfill Memory with key life events from sparkHistory
4. Add Health component if not present
5. Emit promotion event

Check the exact fields of PersonalityComponent, GoalComponent, MemoryComponent in `component.ts` to match existing notable character structure.

**Step 3: Wire into PopulationSystem**

After processing sparks, check all non-notables for threshold crossing. Call `promote()` for any that qualify.

**Step 4: Run tests, commit**

```bash
git commit -m "feat: promotion system — non-notables become notables at Notability >= 100"
```

---

### Task 13: Promotion narrative templates

**Files:**
- Modify: `packages/narrative/src/templates/personal.ts`

**Step 1: Add ~10 promotion templates**

Follow the existing template structure with multiple tones and significance ranges:

```typescript
{
  id: 'personal.promotion.epic.high',
  category: EventCategory.Personal,
  subtype: 'population.promotion',
  tone: NarrativeTone.EpicHistorical,
  significanceRange: { min: 60, max: 100 },
  template: '{character.name}, once a humble {event.data.profession} of {site.name}, has risen to prominence. {#if event.data.backstory}{event.data.backstory}{/if}',
  requiredContext: [],
},
```

Create variants for:
- Survivor archetype ("having endured...")
- Artisan archetype ("whose craft...")
- Scholar archetype ("whose wisdom...")
- Warrior archetype ("whose courage...")
- Visionary archetype ("whose visions...")

**Step 2: Run narrative tests**

```bash
pnpm vitest run packages/narrative/
```

**Step 3: Commit**

```bash
git commit -m "feat: add promotion narrative templates (10 variants across tones)"
```

---

## Priority 4: Causation Web

### Task 14: Wire existing systems to emit demographic signals

**Files:**
- Modify: `packages/core/src/systems/warfare.ts`
- Modify: `packages/core/src/systems/ecology.ts`
- Modify: `packages/core/src/systems/economics.ts`
- Modify: `packages/core/src/systems/religion.ts`
- Modify: `packages/core/src/systems/magic.ts`
- Modify: `packages/core/src/systems/culture.ts`
- Create: `packages/core/src/systems/demographic-signals.test.ts`

**Key principle:** Existing systems don't directly modify population. They emit events with demographic data that PopulationSystem reads. This keeps systems decoupled.

**Step 1: Define demographic event subtypes**

Add to PopulationSystem's event listening:
```typescript
// Listen for demographic signals from other systems
events.on(EventCategory.Military, (event) => {
  if (event.subtype === 'warfare.battle_casualties') {
    this.pendingCasualties.push(event);
  }
});
// Similar for disaster, economic, religion, magic, ecology, culture
```

**Step 2: Add demographic data to existing events**

For each system, add population-relevant data to events they already emit:

- **WarfareSystem**: On battle events, add `data.civilianCasualties: number`, `data.affectedSiteId: number`
- **DisasterSystem** (in ecology.ts): On plague/famine, add `data.mortalityRate: number`, `data.affectedSiteId: number`
- **EconomicSystem**: On boom/bust events, add `data.prosperityDelta: number`, `data.siteId: number`
- **ReligionSystem**: On persecution events, add `data.persecutedCount: number`, `data.sourceSiteId: number`
- **MagicSystem**: On catastrophe events, add `data.magicCasualties: number`, `data.affectedSiteId: number`
- **EcologySystem**: On collapse events, add `data.habitabilityDelta: number`, `data.siteId: number`
- **CulturalEvolutionSystem**: On cultural capital events, add `data.attractionPull: number`, `data.siteId: number`

These are additive changes — adding fields to existing `data` objects. No structural changes to existing events.

**Step 3: PopulationSystem reads demographic signals**

In `execute()`, before processing births/deaths:
1. Collect pending demographic events from the event bus
2. Apply casualty events: remove N non-notables from affected settlement, add Deceased components
3. Apply prosperity signals: modify birth rate for next tick
4. Apply habitability signals: modify migration pressure

**Step 4: Write integration test**

```typescript
it('war casualties reduce settlement population', () => {
  // Setup: settlement with 30 non-notables
  // Emit battle_casualties event with civilianCasualties: 5
  // Execute PopulationSystem
  // Verify 5 non-notables now have Deceased component
  // Verify settlement's nonNotableIds shrunk by 5
});
```

**Step 5: Run all tests**

```bash
pnpm run test
```

**Step 6: Commit**

```bash
git commit -m "feat: wire all systems to emit demographic signals for PopulationSystem"
```

---

### Task 15: Surviving trauma increases Notability

**Files:**
- Modify: `packages/core/src/systems/population-system.ts`
- Modify: `packages/core/src/systems/population-system.test.ts`

When a non-notable survives a disaster, battle, or other traumatic event (but isn't killed), boost their Notability score by +20-40.

```typescript
it('surviving plague boosts Notability by 20-40', () => {
  // Create settlement with 30 non-notables
  // Emit plague event that kills 10
  // Verify surviving non-notables gained +20-40 Notability
  // Verify sparkHistory records "survived the plague"
});
```

**Commit:**
```bash
git commit -m "feat: surviving trauma boosts non-notable Notability score"
```

---

## Priority 5: Migration & Settlement Lifecycle

### Task 16: Migration scoring and execution

**Files:**
- Create: `packages/core/src/systems/migration.ts`
- Create: `packages/core/src/systems/migration.test.ts`

**Step 1: Write migration scoring test**

```typescript
it('scores destinations by distance, safety, prosperity, and cultural affinity', () => {
  // Create 3 settlements: A (war-torn), B (prosperous, same race), C (prosperous, different race)
  // Score migration from A
  // Verify B scores higher than C (cultural affinity)
  // Verify both B and C score higher than A (push factor)
});
```

**Step 2: Implement migration scoring**

```typescript
export interface MigrationScore {
  targetSiteId: number;
  score: number;
  reason: string;
}

export function scoreMigrationTargets(
  sourceSiteId: number,
  world: World,
  pushFactor: number,
  migrantRace: string,
  migrantFaction: number,
): MigrationScore[] {
  // For each other settlement:
  // 1. Distance penalty (inversely proportional)
  // 2. Safety bonus (no active war/disaster events)
  // 3. Prosperity bonus (economy component)
  // 4. Cultural affinity: +20 if same dominant race, +10 if same faction
  // Return sorted by score descending
}
```

**Step 3: Implement migration execution**

```typescript
export function executeMigration(
  world: World,
  entityIds: number[],
  sourceSiteId: number,
  targetSiteId: number,
  clock: WorldClock,
  events: EventBus,
): void {
  // 1. Remove entities from source Population.nonNotableIds
  // 2. Add entities to target Population.nonNotableIds
  // 3. Update Position components to target site coordinates
  // 4. Update source/target Population.count
  // 5. Emit migration event (EventCategory.Personal, subtype 'population.migration')
}
```

**Step 4: Run tests, commit**

```bash
git commit -m "feat: migration scoring with cultural affinity and execution logic"
```

---

### Task 17: SettlementLifecycleSystem skeleton

**Files:**
- Create: `packages/core/src/systems/settlement-lifecycle.ts`
- Create: `packages/core/src/systems/settlement-lifecycle.test.ts`

**Step 1: Write basic test**

```typescript
describe('SettlementLifecycleSystem', () => {
  it('has correct system properties', () => {
    const system = new SettlementLifecycleSystem(rng);
    expect(system.name).toBe('SettlementLifecycleSystem');
    expect(system.frequency).toBe(30); // Monthly
    expect(system.executionOrder).toBe(45); // After Population
  });
});
```

**Step 2: Implement skeleton**

```typescript
export class SettlementLifecycleSystem extends BaseSystem {
  readonly name = 'SettlementLifecycleSystem';
  readonly frequency = TickFrequency.Monthly;
  readonly executionOrder = ExecutionOrder.SETTLEMENT_LIFECYCLE;

  constructor(private readonly rng: SeededRNG) { super(); }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    this.checkPopulationPressure(world, clock, events);
    this.updateGrowthTiers(world, clock, events);
    this.checkAbandonment(world, clock, events);
    this.processMigration(world, clock, events);
  }
}
```

**Step 3: Register in engine factory**

```typescript
systemRegistry.register(new SettlementLifecycleSystem(rng.fork('settlement')));
```

**Step 4: Run tests, commit**

```bash
git commit -m "feat: add SettlementLifecycleSystem skeleton"
```

---

### Task 18: Growth tier progression

**Files:**
- Modify: `packages/core/src/systems/settlement-lifecycle.ts`
- Modify: `packages/core/src/systems/settlement-lifecycle.test.ts`

**Step 1: Write tier test**

```typescript
it('promotes settlement from Village to Town when population crosses 75', () => {
  // Create settlement with status.socialClass = 'village', population.count = 74
  // Add 2 non-notables (pushing count to 76)
  // Execute system
  // Verify status updated to 'town'
  // Verify tier transition event emitted
});
```

**Step 2: Implement tier thresholds**

```typescript
const SETTLEMENT_TIERS = [
  { name: 'camp', minPop: 0 },
  { name: 'village', minPop: 15 },
  { name: 'town', minPop: 75 },
  { name: 'city', minPop: 300 },
  { name: 'capital', minPop: 1000 },
];
```

Check current tier from Status component, compare against population, emit event on tier change.

**Step 3: Run tests, commit**

```bash
git commit -m "feat: settlement growth tier progression (camp → village → town → city → capital)"
```

---

### Task 19: Organic settlement founding

**Files:**
- Modify: `packages/core/src/systems/settlement-lifecycle.ts`
- Modify: `packages/core/src/systems/settlement-lifecycle.test.ts`

**Step 1: Write founding test**

```typescript
it('founds new settlement when population pressure exceeds threshold', () => {
  // Create settlement at town tier with population 400 (well above 300 threshold)
  // Execute system
  // Verify new settlement entity created nearby
  // Verify some non-notables moved to new settlement
  // Verify founding event emitted
});
```

**Step 2: Implement population pressure check**

When population exceeds 1.5x the current tier's minPop:
1. Select 10-20% of non-notables as pioneers
2. Find suitable tile (check WorldMap for habitable biome, not too close to existing settlements)
3. Create new settlement entity with Position, Population, Status (as "camp"), Economy
4. Move pioneer entities to new settlement
5. If a notable has an Expansion goal, they lead the expedition
6. Emit founding event

**Step 3: Run tests, commit**

```bash
git commit -m "feat: organic settlement founding from population pressure"
```

---

### Task 20: Settlement abandonment to ruins

**Files:**
- Modify: `packages/core/src/systems/settlement-lifecycle.ts`
- Modify: `packages/core/src/systems/settlement-lifecycle.test.ts`

**Step 1: Write abandonment test**

```typescript
it('abandons settlement after population below 5 for 2+ years', () => {
  // Create settlement with population.count = 3, nonNotableIds = [a, b, c]
  // Track decline start tick
  // Advance 720+ ticks (2 years)
  // Execute system
  // Verify remaining non-notables migrated to nearest viable settlement
  // Verify settlement gains 'ruins' status
  // Verify abandonment event emitted
});

it('preserves ruins as exploration target', () => {
  // Abandon a settlement
  // Verify entity still exists with History component
  // Verify Position component retained
  // Verify Population component removed or zeroed
});
```

**Step 2: Implement**

Track settlement decline periods in internal Map (`settlementDeclineStart: Map<number, number>`). When pop < 5, start tracking. If tracked for 720+ ticks, trigger abandonment.

**Step 3: Run tests, commit**

```bash
git commit -m "feat: settlement abandonment to ruins after extended depopulation"
```

---

### Task 21: Migration narrative templates

**Files:**
- Modify: `packages/narrative/src/templates/personal.ts` (or create a new `population.ts`)

Add ~15 migration templates:
- Refugee caravans
- Economic migration
- Religious exile
- Diaspora formation

And ~15 settlement lifecycle templates:
- Organic founding
- Tier progression
- Abandonment
- Resettlement

Follow the existing template format with multiple tones and significance ranges.

**Commit:**
```bash
git commit -m "feat: add migration and settlement lifecycle narrative templates (30 total)"
```

---

## Priority 6: ExplorationSystem & Hidden Content

### Task 22: Hidden content map generation

**Files:**
- Modify: `packages/generator/src/terrain/world-map.ts` (or create new file)
- Modify: `packages/generator/src/integration/populate-world.ts`

**Step 1: Seed hidden locations during world generation**

After terrain generation, seed 20-40 HiddenLocation entities:
```typescript
function seedHiddenLocations(world: World, worldMap: WorldMap, rng: SeededRNG): void {
  const count = 20 + Math.floor(rng.next() * 21); // 20-40
  for (let i = 0; i < count; i++) {
    const type = pickRandom(['ruins', 'resource', 'magical', 'lore'], rng);
    const { x, y } = findSuitableHiddenLocation(worldMap, rng);
    const entityId = world.createEntity();
    world.addComponent(entityId, {
      type: 'Position', x, y,
    });
    world.addComponent(entityId, {
      type: 'HiddenLocation',
      locationType: type,
      revealed: false,
      revealedTick: null,
      x, y,
    });
  }
}
```

**Step 2: Run tests, commit**

```bash
git commit -m "feat: seed hidden locations during world generation (20-40 per world)"
```

---

### Task 23: ExplorationSystem skeleton

**Files:**
- Create: `packages/core/src/systems/exploration-system.ts`
- Create: `packages/core/src/systems/exploration-system.test.ts`

**Step 1: Write basic test**

```typescript
describe('ExplorationSystem', () => {
  it('has correct system properties', () => {
    const system = new ExplorationSystem(rng);
    expect(system.name).toBe('ExplorationSystem');
    expect(system.frequency).toBe(30); // Monthly
    expect(system.executionOrder).toBe(65); // After Character AI
  });
});
```

**Step 2: Implement skeleton**

```typescript
export class ExplorationSystem extends BaseSystem {
  readonly name = 'ExplorationSystem';
  readonly frequency = TickFrequency.Monthly;
  readonly executionOrder = ExecutionOrder.EXPLORATION;

  constructor(private readonly rng: SeededRNG) { super(); }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    this.processCharacterDiscovery(world, clock, events);
    this.processFrontierEncounters(world, clock, events);
    this.processWorldRevealedSecrets(world, clock, events);
  }
}
```

**Step 3: Register in engine factory**

```typescript
systemRegistry.register(new ExplorationSystem(rng.fork('exploration')));
```

**Step 4: Run tests, commit**

```bash
git commit -m "feat: add ExplorationSystem skeleton filling EventCategory.Exploratory"
```

---

### Task 24: Character-driven discovery

**Files:**
- Modify: `packages/core/src/systems/exploration-system.ts`
- Modify: `packages/core/src/systems/exploration-system.test.ts`

**Step 1: Write discovery test**

```typescript
it('sends notable on expedition to discover hidden location', () => {
  // Create notable character with adventurous personality
  // Create hidden location within range
  // Execute system
  // Verify expedition event emitted (EventCategory.Exploratory)
  // After multiple ticks, verify discovery event
  // Verify HiddenLocation.revealed = true
});
```

**Step 2: Implement**

Each monthly tick:
1. Find notables/high-Notability non-notables with adventurous traits
2. Check if any hidden locations are within range (50-200 tiles)
3. Start expedition (multi-tick, tracked in internal Map)
4. On completion: reveal location, emit discovery event, award Notability to explorer

**Step 3: Run tests, commit**

```bash
git commit -m "feat: character-driven exploration and discovery of hidden locations"
```

---

### Task 25: Frontier encounters

**Files:**
- Modify: `packages/core/src/systems/exploration-system.ts`
- Modify: `packages/core/src/systems/exploration-system.test.ts`

**Step 1: Write frontier test**

```typescript
it('generates frontier events for new settlements (< 2 years old)', () => {
  // Create settlement with age < 720 ticks, tier 'camp'
  // Execute system
  // Verify frontier event emitted (danger, opportunity, or wonder)
});
```

**Step 2: Implement**

Define frontier event types:
```typescript
const FRONTIER_EVENTS = [
  { subtype: 'exploration.frontier_danger', significance: 40, description: 'dangerous creatures' },
  { subtype: 'exploration.frontier_opportunity', significance: 30, description: 'fertile land' },
  { subtype: 'exploration.frontier_wonder', significance: 50, description: 'natural wonder' },
  { subtype: 'exploration.frontier_hardship', significance: 35, description: 'harsh conditions' },
  { subtype: 'exploration.frontier_discovery', significance: 45, description: 'hidden resource' },
];
```

**Step 3: Run tests, commit**

```bash
git commit -m "feat: frontier encounters for new settlements"
```

---

### Task 26: World-revealed secrets

**Files:**
- Modify: `packages/core/src/systems/exploration-system.ts`
- Modify: `packages/core/src/systems/exploration-system.test.ts`

**Step 1: Write world-reveal test**

```typescript
it('reveals hidden location when environmental event occurs nearby', () => {
  // Create hidden location at (50, 50)
  // Emit disaster event (earthquake) near (50, 50)
  // Execute system
  // Verify hidden location revealed
  // Verify discovery event emitted with EventCategory.Exploratory
});
```

**Step 2: Implement**

Listen for environmental events (Disaster, Ecological). When an event occurs near a hidden location (within 30 tiles), roll for reveal chance (20-50% based on event severity). On reveal, set `revealed: true`, `revealedTick: currentTick`, emit discovery event.

**Step 3: Run tests, commit**

```bash
git commit -m "feat: world-revealed secrets from environmental events"
```

---

### Task 27: Exploration narrative templates

**Files:**
- Create: `packages/narrative/src/templates/exploration.ts`
- Modify: `packages/narrative/src/templates/index.ts` (if templates have a central registration)

Add ~20 exploration templates:
- Ruins discovered
- Resource found
- Magical anomaly
- Lost artifact recovered
- Frontier danger/opportunity/wonder
- World-revealed secrets

Register templates in the narrative engine's template collection.

**Commit:**
```bash
git commit -m "feat: add exploration narrative templates (20 variants)"
```

---

## Priority 7: Electron UI Integration

### Task 28: Non-notable inspector view

**Files:**
- Create: `packages/electron/src/main/inspectors/commoner-inspector.ts`
- Modify: `packages/electron/src/main/inspectors/index.ts`

**Step 1: Create simplified inspector**

Non-notables get a shorter inspector: name, age, race, profession, Notability score, parentage, location. No personality/goals/memory sections.

Follow the pattern from `character-inspector.ts`:
```typescript
export function inspectCommoner(
  id: number,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  // Read: Status, Notability, Parentage, Position, CreatureType
  // Build 2-3 sections: Overview, Life Events (sparkHistory), Family
  // Return InspectorResponse
}
```

**Step 2: Wire into inspector dispatcher**

In `inspectors/index.ts`, detect non-notables by checking for Notability component without Personality:
```typescript
if (world.hasComponent(entityId, 'Notability') && !world.hasComponent(entityId, 'Personality')) {
  return inspectCommoner(query.id, world, eventLog, clock);
}
```

**Commit:**
```bash
git commit -m "feat: simplified commoner inspector for non-notable characters"
```

---

### Task 29: Settlement inspector population section

**Files:**
- Modify: `packages/electron/src/main/inspectors/site-inspector.ts`

Add a "Population" section to the site inspector showing:
- Current population count and tier
- Recent migration (arrivals/departures in last year)
- Growth trend (increasing/stable/declining)
- Notable residents (links to character inspectors)
- Non-notable count and profession breakdown

**Commit:**
```bash
git commit -m "feat: add population section to settlement inspector"
```

---

### Task 30: Legends Viewer updates

**Files:**
- Modify: `packages/electron/src/main/legends-provider.ts`
- Modify: `packages/electron/src/shared/types.ts`

Update legends provider to:
1. Include non-notables in Characters tab with a "commoner" indicator
2. Show deceased characters with death cause
3. Show settlement tier history
4. Show ruins in Sites tab

Add to CharacterSummary:
```typescript
readonly isNotable: boolean;
readonly deceased: boolean;
readonly deathCause?: string;
```

**Commit:**
```bash
git commit -m "feat: legends viewer shows non-notables, deceased, and settlement history"
```

---

### Task 31: Population narrative templates

**Files:**
- Create or modify: `packages/narrative/src/templates/population.ts`

Add ~20 population event templates:
- Settlement-scale birth/death
- Remarkable individual births/deaths
- Population milestones
- Aging landmarks

**Commit:**
```bash
git commit -m "feat: add population narrative templates (20 variants)"
```

---

## Final Integration

### Task 32: Full integration test

**Files:**
- Modify: `packages/generator/src/integration/smoke-test.test.ts`
- Modify: `packages/cli/src/integration/full-pipeline.test.ts`

Add test cases:
```typescript
it('generates population events after 365 ticks', () => {
  // Verify EventCategory.Personal has population.* subtypes
  // Verify EventCategory.Exploratory has events (was previously 0!)
  // Verify settlement count may have changed (new foundings or abandonments)
  // Verify non-notable count has changed (births, deaths)
});

it('produces Exploratory category events', () => {
  // This directly addresses the Known Issue in CLAUDE.md
  const exploratoryEvents = events.filter(e => e.category === EventCategory.Exploratory);
  expect(exploratoryEvents.length).toBeGreaterThan(0);
});
```

**Commit:**
```bash
git commit -m "feat: integration tests verify population simulation and Exploratory events"
```

---

### Task 33: Rebuild all packages and final verification

```bash
pnpm --filter @fws/core run build
pnpm --filter @fws/generator run build
pnpm --filter @fws/narrative run build
pnpm run typecheck
pnpm run test
```

Verify:
- All tests pass (should be ~3000+ now)
- No typecheck errors
- Exploratory category has events
- Non-notables appear in simulation

**Final commit:**
```bash
git commit -m "chore: rebuild all packages for Phase 13 integration"
```

---

## Summary

| Priority | Tasks | Key Deliverables |
|----------|-------|------------------|
| P1: Infrastructure | 1-6 | Components, ExecutionOrder, non-notable creation, world gen seeding |
| P2: PopulationSystem | 7-11 | Birth, aging, death, spark events |
| P3: Promotion | 12-13 | Notability threshold, component backfill, narrative templates |
| P4: Causation Web | 14-15 | All systems emit demographic signals, trauma survival |
| P5: Migration & Settlements | 16-21 | Migration scoring, SettlementLifecycleSystem, tier progression, abandonment |
| P6: Exploration | 22-27 | Hidden content map, ExplorationSystem, 3 discovery pathways |
| P7: Electron UI | 28-31 | Commoner inspector, settlement population section, legends updates |
| Final | 32-33 | Integration tests, full verification |

**Total: 33 tasks, ~80-100 new narrative templates, 3 new systems, 4 new components**
