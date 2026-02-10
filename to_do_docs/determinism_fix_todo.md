# Fix Simulation Determinism — Match DF Model

## Context

The simulation is **accidentally non-deterministic**. World generation is fully deterministic via `SeededRNG.fork()`, but 30+ `Math.random()` calls across 8 core systems mean the same seed produces different histories each run. This is a bug — the architecture was designed for determinism (WarfareSystem accepts RNG injection, CascadeEngine has injectable `randomFn`, CharacterAI/FactionSystem built their own `makeRng()`), but the wiring was never completed when Phase 3 systems were built, because `SeededRNG` lives only in `packages/generator/`.

**Goal**: Same seed = same world AND same history (DF model). Player Influence is the only source of divergence.

## Approach

Move `SeededRNG` into `@fws/core`, pass the world seed through `SimulationEngine`, give each system a forked RNG, and replace all `Math.random()` calls.

### Step 1: Move SeededRNG to core

- Copy `packages/generator/src/rng.ts` → `packages/core/src/utils/seeded-rng.ts`
- Re-export from `packages/generator/src/rng.ts` for backwards compatibility
- Export from core's barrel (`packages/core/src/index.ts`)

### Step 2: Add seed to SimulationEngine

**`packages/core/src/engine/simulation-engine.ts`**:
- Add `seed: number` as final constructor parameter (default `0`)
- Store as `this.seed`
- Expose via `getSeed(): number` getter

### Step 3: Create per-system forked RNGs

Each system that needs randomness gets a `SeededRNG` via its constructor. The fork label ensures independent streams:

```
rng.fork('warfare')    → WarfareSystem
rng.fork('magic')      → MagicSystem
rng.fork('religion')   → ReligionSystem
rng.fork('culture')    → CulturalEvolutionSystem
rng.fork('ecology')    → EcologySystem
rng.fork('oral')       → OralTradition
rng.fork('secrets')    → SecretManager
rng.fork('cascade')    → CascadeEngine (via randomFn)
rng.fork('character')  → CharacterAISystem (replaces makeRng)
rng.fork('faction')    → FactionSystem (replaces makeRng)
rng.fork('propaganda') → PropagandaSystem
rng.fork('reputation') → ReputationSystem
```

Systems store the RNG as a private member. Constructor signature change: add optional `rng?: SeededRNG` parameter.

### Step 4: Replace Math.random() calls (~30 sites)

| File | Calls | Pattern |
|------|-------|---------|
| `magic.ts` | ~14 | `Math.random()` → `this.rng.next()`, `Math.floor(Math.random() * N)` → `this.rng.nextInt(0, N-1)` |
| `religion.ts` | ~12 | Same pattern. Also fix prophet `characterId` generation. |
| `culture.ts` | 3 | Replace inline `const rng = () => Math.random()` with `() => this.rng.next()` |
| `ecology.ts` | 2 | Direct replacement |
| `warfare.ts` | 2 | Replace `Math.random` argument with `() => this.rng.next()` |
| `oral-tradition.ts` | 2 | Replace inline rng wrapper |
| `secret-manager.ts` | 1 | Direct replacement |
| `propaganda.ts` | 0 (default param) | Change default `rng = Math.random` → use injected rng |
| `reputation-system.ts` | 0 (default param) | Same — change default |

### Step 5: Fix CharacterAI and FactionSystem makeRng

Both have inline `makeRng(tick, entityId)` that doesn't incorporate the world seed. Two options:

- **Option A (minimal)**: Incorporate `this.rng.getSeed()` into the hash: `(tick * 2654435761 + entityId * 1597334677 + this.rng.getSeed() * 7) >>> 0`
- **Option B (clean)**: Replace `makeRng` entirely with `this.rng` usage, accepting that entity ordering affects the stream

Option A is safer — it preserves the entity-isolation property (adding/removing entities doesn't shift other entities' random streams) while incorporating the world seed for cross-seed variation.

### Step 6: Wire CascadeEngine

**`packages/core/src/events/cascade-engine.ts`** line 70: currently defaults to `Math.random`. SimulationEngine should pass a seeded function at construction:

```typescript
const cascadeRng = new SeededRNG(seed).fork('cascade');
const cascadeEngine = new CascadeEngine({ randomFn: () => cascadeRng.next() });
```

### Step 7: Wire BranchRunner

**`packages/core/src/persistence/branch-runner.ts`**: The `DifferentSeed` divergence stores a `seed` (line 69) and `Branch` has a `seed` field (line 95). Currently dead data. The `EngineFactory` callback that creates branch simulation engines needs to receive and use this seed.

### Step 8: Wire CLI and Electron entry points

**`packages/cli/src/index.ts`** `createSimulationEngine()` (around line 282):
- Create `SimulationEngine` with the seed parameter
- Create per-system RNGs from `rng.fork()` and pass to system constructors

**`packages/electron/src/main/simulation-runner.ts`**:
- Same pattern — pass seed through to simulation engine construction

### Step 9: Narrative package (intentionally non-deterministic)

**Leave `NarrativeEngine` template selection non-deterministic.** Template selection is presentation-only — same events, different prose. Like different chroniclers writing about the same history. This is a feature, not a bug.

Other narrative systems (`VignetteTrigger`, `BiasFilter`, `LostHistory`, `tones.ts`) already accept injectable `rng` parameters but default to `Math.random`. These affect what the player sees but not simulation state. They can optionally be wired to seeded RNG for full reproducibility, but it's lower priority.

## Files Modified

**Core (primary changes):**
- `packages/core/src/utils/seeded-rng.ts` — NEW (moved from generator)
- `packages/core/src/index.ts` — add export
- `packages/core/src/engine/simulation-engine.ts` — add seed parameter
- `packages/core/src/systems/magic.ts` — 14 Math.random() replacements
- `packages/core/src/systems/religion.ts` — 12 Math.random() replacements
- `packages/core/src/systems/culture.ts` — 3 replacements
- `packages/core/src/systems/ecology.ts` — 2 replacements
- `packages/core/src/systems/warfare.ts` — 2 call site changes
- `packages/core/src/systems/oral-tradition.ts` — 2 replacements
- `packages/core/src/systems/secret-manager.ts` — 1 replacement
- `packages/core/src/systems/character-ai.ts` — incorporate world seed into makeRng
- `packages/core/src/systems/faction-system.ts` — incorporate world seed into makeRng
- `packages/core/src/systems/propaganda.ts` — change default param
- `packages/core/src/systems/reputation-system.ts` — change default param
- `packages/core/src/events/cascade-engine.ts` — no change (already injectable)
- `packages/core/src/persistence/branch-runner.ts` — wire seed to engine factory

**Generator (backwards compat):**
- `packages/generator/src/rng.ts` — re-export from core

**Entry points:**
- `packages/cli/src/index.ts` — create RNGs, pass to systems
- `packages/electron/src/main/simulation-runner.ts` — same

**Tests:**
- `packages/core/src/systems/warfare.test.ts` — replace Math.random with seeded fn in tests

## Verification

1. **Determinism test**: Run `--seed 42 --headless --ticks 365` three times, compare WorldFingerprint — must be identical
2. **Seed variation test**: Run `--seed 42` and `--seed 43` for 365 ticks — histories must diverge significantly
3. **Existing test suite**: `pnpm run test` must pass (2909 tests)
4. **Typecheck**: `pnpm run typecheck` must pass
5. **Electron build**: `pnpm run start:electron` must launch and simulate correctly
